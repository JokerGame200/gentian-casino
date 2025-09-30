<?php
// app/Http/Controllers/GamesWalletController.php
namespace App\Http\Controllers;

use App\Models\User;
use App\Models\GameSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GamesWalletController extends Controller
{
    public function handle(Request $request)
    {
        // Provider sendet POST JSON mit cmd=getBalance | writeBet. :contentReference[oaicite:4]{index=4}
        $cmd = $request->string('cmd')->lower();

        // Optional: Signatur-Modus unterstützen (anstelle von key) – auf Anfrage aktivierbar. :contentReference[oaicite:5]{index=5}
        $useSign = (bool) config('gamesapi.use_sign', env('GAMESAPI_USE_SIGN', false));
        $hall    = $request->string('hall');
        $key     = (string) config('gamesapi.hall_key', env('GAMESAPI_HALL_KEY'));

        if ($useSign) {
            // Prüfe SHA256-Signatur laut Manual (ksort + : + hall key). :contentReference[oaicite:6]{index=6}
            $sign = $request->string('sign');
            $data = $request->except(['sign']);
            ksort($data, SORT_STRING);
            $check = hash('sha256', implode(':', array_values($data)) . ':' . $key);
            if (!hash_equals($check, (string)$sign)) {
                return response()->json(['status'=>'fail','error'=>'bad_sign'], 200);
            }
        } else {
            if ($request->string('key') !== $key) {
                return response()->json(['status'=>'fail','error'=>'bad_key'], 200);
            }
        }

        // User ermitteln
        $login = $request->string('login'); // Provider schickt player login. :contentReference[oaicite:7]{index=7}
        $user  = User::where('username', $login)->orWhere('name', $login)->first();
        if (!$user) return response()->json(['status'=>'fail','error'=>'user_not_found'], 200); // :contentReference[oaicite:8]{index=8}

        if ($cmd === 'getbalance') {
            // Antwortformat: status, login, balance, currency. :contentReference[oaicite:9]{index=9}
            return response()->json([
                'status'   => 'success',
                'error'    => '',
                'login'    => (string) $login,
                'balance'  => number_format((float) ($user->balance ?? 0), 2, '.', ''),
                'currency' => (string) ($user->currency ?? 'EUR'),
            ], 200);
        }

        if ($cmd === 'writebet') {
            // Felder laut Doku (bet, win, gameId, sessionId, tradeId, action, ...). :contentReference[oaicite:10]{index=10}
            $bet  = (float) $request->input('bet', 0);
            $win  = (float) $request->input('win', 0);
            $sess = $request->string('sessionId');
            $gid  = $request->string('gameId');

            try {
                $result = DB::transaction(function() use ($user,$bet,$win,$sess,$gid,$request) {
                    // Nur eine offene Session des Users verbuchen (optional: auf sessionId matchen)
                    $gs = GameSession::where('user_id',$user->id)->where('status','open')->first();
                    if ($gs && $sess && $gs->session_id !== (string)$sess) {
                        // Session passt nicht → du kannst hier auch 'fail' senden
                    }

                    $balanceBefore = (float) ($user->balance ?? 0);

                    // 1) Bet abziehen – bei Unterdeckung: fail_balance. :contentReference[oaicite:11]{index=11}
                    if ($bet > 0) {
                        if ($balanceBefore + 1e-9 < $bet) {
                            return ['status'=>'fail','error'=>'fail_balance',
                                'login'=>$user->username ?? $user->name,
                                'balance'=>number_format($balanceBefore,2,'.',''),
                                'currency'=>$user->currency ?? 'EUR'];
                        }
                        $user->balance = $balanceBefore - $bet;
                        $balanceBefore = $user->balance;
                    }

                    // 2) Win gutschreiben
                    if ($win > 0) {
                        $user->balance = $balanceBefore + $win;
                    }

                    $user->save();

                    // 3) Session totals hochzählen
                    if ($gs) {
                        $gs->bet_total += $bet;
                        $gs->win_total += $win;
                        $gs->save();
                    }

                    return [
                        'status'   => 'success',
                        'error'    => '',
                        'login'    => $user->username ?? $user->name,
                        'balance'  => number_format((float)$user->balance, 2,'.',''),
                        'currency' => $user->currency ?? 'EUR',
                    ];
                });

                return response()->json($result, 200);

            } catch (\Throwable $e) {
                return response()->json(['status'=>'fail','error'=>'server_error'], 200);
            }
        }

        return response()->json(['status'=>'fail','error'=>'bad_cmd'], 200);
    }
}
