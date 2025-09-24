<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\GameTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GamesApiController extends Controller
{
    public function callback(Request $r)
    {
        $data = $r->all();
        // Schnelle Validierung
        $cmd = $r->string('cmd')->toString();
        $hall = $r->string('hall')->toString();
        $login = $r->string('login')->toString();

        // Hall / Key / Sign prüfen
        if (! $this->validateHallAndKeyOrSign($r)) {
            return response()->json(['status'=>'fail','error'=>'auth_failed'], 200);
        }

        $user = User::where('username', $login)->orWhere('email',$login)->first();
        if (! $user) {
            return response()->json(['status'=>'fail','error'=>'user_not_found'], 200);
        }

        if ($cmd === 'getBalance') {
            return response()->json([
                'status' => 'success',
                'error' => '',
                'login' => $login,
                'balance' => number_format((float)$user->balance, 2, '.', ''),
                'currency' => $user->currency ?? 'EUR',
            ], 200);
        }

        if ($cmd === 'writeBet') {
            // Nur bet/win sind „verpflichtend“; tradeId, sessionId etc. optional
            $bet = (string) $r->input('bet','0');
            $win = (string) $r->input('win','0');
            $tradeId = (string) $r->input('tradeId','');
            $sessionId = (string) $r->input('sessionId','');
            $action = (string) $r->input('action','');
            $roundFinished = $r->has('round_finished') ? (bool)$r->input('round_finished') : null;

            try {
                $result = DB::transaction(function () use ($user, $bet, $win, $tradeId, $sessionId, $action, $roundFinished, $r) {
                    // Idempotenz: existiert tradeId bereits?
                    if ($tradeId && GameTransaction::where('trade_id',$tradeId)->exists()) {
                        // Antworte einfach mit aktuellem Kontostand
                        $user->refresh();
                        return $user;
                    }

                    // Row lock
                    $u = User::where('id',$user->id)->lockForUpdate()->first();
                    $before = (float)$u->balance;
                    $betF = round((float)$bet, 2);
                    $winF = round((float)$win, 2);

                    if ($betF > 0 && $before < $betF) {
                        // fail_balance (wie gefordert)
                        throw new \RuntimeException('fail_balance');
                    }

                    $after = $before - $betF + $winF;
                    $u->balance = $after;
                    $u->save();

                    GameTransaction::create([
                        'user_id' => $u->id,
                        'session_id' => $sessionId ?: null,
                        'trade_id' => $tradeId ?: null,
                        'provider_game_id' => (int)$r->input('gameId'),
                        'bet' => $betF,
                        'win' => $winF,
                        'before_balance' => $before,
                        'after_balance' => $after,
                        'action' => $action ?: null,
                        'round_finished' => $roundFinished,
                        'meta' => [
                            'betInfo' => $r->input('betInfo'),
                            'matrix' => $r->input('matrix'),
                            'date' => $r->input('date'),
                            'winLines' => $r->input('WinLines'),
                        ],
                    ]);

                    return $u;
                });

                return response()->json([
                    'status'=>'success',
                    'error'=>'',
                    'login'=>$login,
                    'balance'=> number_format((float)$result->balance, 2, '.', ''),
                    'currency'=>$result->currency ?? 'EUR',
                ], 200);

            } catch (\RuntimeException $e) {
                if ($e->getMessage()==='fail_balance') {
                    return response()->json(['status'=>'fail','error'=>'fail_balance'], 200);
                }
                return response()->json(['status'=>'fail','error'=>'writeBet:fail_response'], 200);
            } catch (\Throwable $e) {
                return response()->json(['status'=>'fail','error'=>'writeBet:fail_response'], 200);
            }
        }

        return response()->json(['status'=>'fail','error'=>'cmd_unknown'], 200);
    }

    protected function validateHallAndKeyOrSign(Request $r): bool
    {
        if ((bool)config('gamesapi.use_sign')) {
            $sign = (string)$r->input('sign','');
            if ($sign === '') return false;
            $data = $r->except(['sign']);
            ksort($data, SORT_STRING);
            $data[] = config('gamesapi.hall_key');
            $calc = hash('sha256', implode(':', $data));
            return hash_equals($calc, $sign);
        } else {
            return $r->input('hall') == config('gamesapi.hall_id')
                && (string)$r->input('key') === (string)config('gamesapi.hall_key');
        }
    }
}
