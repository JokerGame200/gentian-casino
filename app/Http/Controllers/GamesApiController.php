<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GamesApiController extends Controller
{
    /**
     * Echte Spiele-Liste vom Provider holen und flach normalisieren.
     */
    public function list(Request $request)
    {
        $imgStyle = $request->input('img', 'game_img_2');

        $payload = [
            'cmd'  => 'getGamesList',
            'hall' => config('gamesapi.hall_id'),
            'key'  => config('gamesapi.hall_key'),
            'img'  => $imgStyle,
        ];
        // Nur setzen, wenn du ein /resources-Proxy-Setup hast:
        if ($cdn = config('gamesapi.cdn_url')) {
            $payload['cdnUrl'] = $cdn;
        }

        $resp = Http::timeout(20)->asJson()
            ->post(config('gamesapi.base_url'), $payload);

        if (!$resp->ok()) {
            return response()->json([
                'status'   => 'fail',
                'error'    => 'upstream_http_'.$resp->status(),
                'upstream' => $resp->body(),
            ], 502);
        }

        $data = $resp->json();
        if (!is_array($data) || ($data['status'] ?? null) !== 'success') {
            return response()->json([
                'status'   => 'fail',
                'error'    => $data['error'] ?? 'upstream_fail',
                'upstream' => $data,
            ], 422);
        }

        $content = $data['content'] ?? [];
        $flat    = [];
        foreach ($content as $providerTitle => $games) {
            foreach ($games as $g) {
                $flat[] = [
                    'id'         => (string)($g['id'] ?? ''),
                    'name'       => $g['name'] ?? '',
                    'img'        => $g['img'] ?? null,
                    'device'     => (int)($g['device'] ?? 2),
                    'provider'   => $g['title'] ?? $providerTitle,
                    'categories' => $g['categories'] ?? '',
                    'demo'       => (int)($g['demo'] ?? 0),
                    'rewriterule'=> (int)($g['rewriterule'] ?? 0),
                    'exitButton' => (int)($g['exitButton'] ?? 0),
                ];
            }
        }

        usort($flat, fn($a,$b) => [$a['provider'],$a['name']] <=> [$b['provider'],$b['name']]);

        return response()->json(['status'=>'success', 'games'=>$flat]);
    }

    /**
     * Spiel starten (Demo/Play) -> URL für iFrame zurückgeben.
     * Login = User-ID, damit getBalance/writeBet den User sicher finden.
     */
    public function open(Request $request)
    {
        $request->validate([
            'gameId' => ['required'],
            'demo'   => ['nullable'],
        ]);

        $user  = $request->user();
        $login = (string) $user->id; // stabil & eindeutig

        $payload = [
            'cmd'      => 'openGame',
            'hall'     => config('gamesapi.hall_id'),
            'key'      => config('gamesapi.hall_key'),
            'login'    => $login,
            'gameId'   => (string) $request->input('gameId'),
            'domain'   => config('app.url'),
            'exitUrl'  => route('games.exit'),
            'language' => app()->getLocale() ?: 'en',
            'demo'     => $request->boolean('demo') ? '1' : '0',
        ];
        if ($cdn = config('gamesapi.cdn_url')) {
            $payload['cdnUrl'] = $cdn; // nur mit Proxy-Setup nutzen
        }

        $resp = Http::timeout(20)->asJson()
            ->post(config('gamesapi.open_url'), $payload);

        if (!$resp->ok()) {
            return response()->json([
                'status'=>'fail',
                'error'=>'upstream_http_'.$resp->status(),
                'upstream'=>$resp->body(),
            ], 502);
        }

        $data = $resp->json();
        if (!is_array($data) || ($data['status'] ?? null) !== 'success') {
            return response()->json([
                'status'=>'fail',
                'error'=>$data['error'] ?? 'upstream_fail',
                'upstream'=>$data,
            ], 422);
        }

        $game = $data['content']['game'] ?? [];
        $url  = $game['url'] ?? null;
        if (!$url) {
            return response()->json([
                'status'=>'fail',
                'error'=>'no_game_url',
                'upstream'=>$data,
            ], 422);
        }

        return response()->json([
            'status'       => 'success',
            'url'          => $url,
            'withoutFrame' => $game['withoutFrame'] ?? '0',
            'sessionId'    => $data['content']['gameRes']['sessionId'] ?? null,
        ]);
    }

    /**
     * Callback vom Game-Server: getBalance / writeBet.
     * Muss öffentlich erreichbar sein, ohne CSRF.
     */
    public function callback(Request $request)
    {
        $data = $request->json()->all();
        if (!$data) $data = $request->all();

        // Log eingehender Callback
        Log::info('GAMES CALLBACK HIT', [
            'ip'   => $request->ip(),
            'cmd'  => $data['cmd'] ?? null,
            'hall' => $data['hall'] ?? null,
            'login'=> $data['login'] ?? null,
        ]);

        // Auth prüfen (Sign-Modus ist bei dir aus)
        if (($data['hall'] ?? '') !== (string) config('gamesapi.hall_id')
         || ($data['key']  ?? '') !== (string) config('gamesapi.hall_key')) {
            Log::warning('GAMES CALLBACK AUTH FAILED', ['sent_hall' => $data['hall'] ?? null]);
            return response()->json(['status'=>'fail','error'=>'auth_failed'], 403);
        }

        $cmd = $data['cmd'] ?? '';
        if ($cmd === 'getBalance')  return $this->handleGetBalance($data);
        if ($cmd === 'writeBet')    return $this->handleWriteBet($data);

        return response()->json(['status'=>'fail','error'=>'unknown_cmd'], 400);
    }

    /**
     * getBalance: echten Kontostand als String Decimal(12,2) liefern.
     */
    protected function handleGetBalance(array $data)
    {
        $login = trim((string)($data['login'] ?? ''));
        if ($login === '') return response()->json(['status'=>'fail','error'=>'user_not_found']);

        // erst nach ID (weil open() login = User-ID setzt), dann Fallback username/email
        $user = null;
        if (preg_match('/^\d+$/', $login)) {
            $user = User::find((int) $login);
        }
        if (!$user) {
            $user = User::where('username', $login)->orWhere('email', $login)->first();
        }
        if (!$user) return response()->json(['status'=>'fail','error'=>'user_not_found']);

        $balance  = number_format((float)($user->balance ?? 0), 2, '.', '');
        $currency = $user->currency ?? config('gamesapi.currency', 'EUR');

        Log::info('GAMES getBalance OK', ['login' => $login, 'balance' => $balance]);

        return response()->json([
            'status'   => 'success',
            'error'    => '',
            'login'    => $login,
            'balance'  => $balance,
            'currency' => $currency,
        ]);
    }

    /**
     * writeBet: bet abziehen, win gutschreiben (atomar), neuen Saldo zurück.
     */
    protected function handleWriteBet(array $data)
    {
        $login = trim((string)($data['login'] ?? ''));
        if ($login === '') return response()->json(['status'=>'fail','error'=>'user_not_found']);

        $query = User::query();
        if (preg_match('/^\d+$/', $login)) {
            $query->where('id', (int) $login);
        } else {
            $query->where(function ($q) use ($login) {
                $q->where('username', $login)->orWhere('email', $login);
            });
        }
        $user = $query->lockForUpdate()->first();
        if (!$user) return response()->json(['status'=>'fail','error'=>'user_not_found']);

        $bet = (float)($data['bet'] ?? 0);
        $win = (float)($data['win'] ?? 0);

        return DB::transaction(function () use ($user, $bet, $win, $login) {
            $current = (float)($user->balance ?? 0);

            if ($current + 1e-9 < $bet) {
                Log::warning('GAMES writeBet FAIL_BALANCE', ['login' => $login, 'have' => $current, 'need' => $bet]);
                return response()->json(['status'=>'fail','error'=>'fail_balance']);
            }

            $user->balance = $current - $bet + $win;
            $user->save();

            $balance  = number_format((float)$user->balance, 2, '.', '');
            $currency = $user->currency ?? config('gamesapi.currency', 'EUR');

            Log::info('GAMES writeBet OK', ['login' => $login, 'bet' => $bet, 'win' => $win, 'new' => $balance]);

            return response()->json([
                'status'   => 'success',
                'error'    => '',
                'login'    => $login,
                'balance'  => $balance,
                'currency' => $currency,
            ]);
        });
    }
}
