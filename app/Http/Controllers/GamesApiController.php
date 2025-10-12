<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Client\Response;

class GamesApiController extends Controller
{
    /**
     * GET /api/games/list
     * Provider-Liste holen und flach normalisieren.
     */
    public function list(Request $request)
    {
        try {
            // img-Parameter defensiv behandeln
            $imgStyle = $request->query('img', 'game_img_2');
            $allowedImgs = ['game_img_1', 'game_img_2'];
            if (!in_array($imgStyle, $allowedImgs, true)) {
                $imgStyle = 'game_img_2';
            }

            $payload = [
                'cmd'  => 'getGamesList',
                'hall' => (string) config('gamesapi.hall_id'),
                'key'  => (string) config('gamesapi.hall_key'),
                'img'  => $imgStyle,
            ];
            if ($cdn = (string) config('gamesapi.cdn_url')) {
                $payload['cdnUrl'] = $cdn;
            }

            // WICHTIG: Upstream erwartet x-www-form-urlencoded, NICHT JSON
            $resp = Http::timeout(20)
                ->retry(2, 250)
                ->asForm()
                ->acceptJson()
                ->post((string) config('gamesapi.base_url'), $payload);

            if (!$resp->ok()) {
                Log::warning('GAMES list upstream HTTP fail', [
                    'status'   => $resp->status(),
                    'body_len' => strlen($resp->body() ?? ''),
                ]);
                return response()->json([
                    'status'   => 'fail',
                    'error'    => 'upstream_http_'.$resp->status(),
                    'upstream' => $resp->body(),
                ], 502);
            }

            // Sichere JSON-Dekodierung (wirft keine 500)
            $data = $this->decodeJsonSafe($resp);
            if (!$data || ($data['status'] ?? null) !== 'success') {
                Log::warning('GAMES list upstream logical/format fail', [
                    'err'  => $data['error'] ?? 'upstream_invalid_json_or_fail',
                ]);
                return response()->json([
                    'status'   => 'fail',
                    'error'    => $data['error'] ?? 'upstream_invalid_json_or_fail',
                    'upstream' => $data ?: ['raw_head' => substr($resp->body() ?? '', 0, 300)],
                ], 422);
            }

            $content = $data['content'] ?? [];
            if (!is_array($content)) {
                $content = [];
            }

            $flat = [];
            foreach ($content as $providerTitle => $games) {
                if (!is_iterable($games)) continue;
                foreach ($games as $g) {
                    $flat[] = [
                        'id'         => (string)($g['id'] ?? ''),
                        'name'       => $g['name'] ?? '',
                        'img'        => $g['img'] ?? null,
                        'device'     => (int)($g['device'] ?? 2),
                        'provider'   => $g['title'] ?? (is_string($providerTitle) ? $providerTitle : ''),
                        'categories' => $g['categories'] ?? '',
                        'demo'       => (int)($g['demo'] ?? 0),
                        'rewriterule'=> (int)($g['rewriterule'] ?? 0),
                        'exitButton' => (int)($g['exitButton'] ?? 0),
                    ];
                }
            }

            usort($flat, fn($a,$b) => [$a['provider'],$a['name']] <=> [$b['provider'],$b['name']]);

            return response()->json([
                'status' => 'success',
                'games'  => $flat,
            ]);
        } catch (\Throwable $e) {
            // Alles andere sauber als 500 zurück, inkl. Log
            Log::error('GAMES list SERVER EX', [
                'msg'  => $e->getMessage(),
                'file' => $e->getFile().':'.$e->getLine(),
            ]);
            return response()->json([
                'status' => 'fail',
                'error'  => 'server_exception',
            ], 500);
        }
    }

    /**
     * POST /api/games/open
     * Spiel starten (Demo/Play) -> URL (iFrame oder Redirect).
     */
    public function open(Request $request)
    {
        try {
            $request->validate([
                'gameId' => ['required'],
                'demo'   => ['nullable'],
            ]);

            $user  = $request->user();
            if (!$user) {
                return response()->json(['status'=>'fail','error'=>'auth_required'], 401);
            }

            $login = 'u' . (string) $user->id;

            $payload = [
                'cmd'      => 'openGame',
                'hall'     => (string) config('gamesapi.hall_id'),
                'key'      => (string) config('gamesapi.hall_key'),
                'login'    => $login,
                'gameId'   => (string) $request->input('gameId'),
                'domain'   => (string) config('app.url'),
                'exitUrl'  => route('games.exit'),
                'language' => app()->getLocale() ?: 'en',
                'demo'     => $request->boolean('demo') ? '1' : '0',
            ];
            if ($cdn = (string) config('gamesapi.cdn_url')) {
                $payload['cdnUrl'] = $cdn;
            }

            $resp = Http::timeout(20)
                ->retry(2, 250)
                ->asForm()
                ->acceptJson()
                ->post((string) config('gamesapi.open_url'), $payload);

            if (!$resp->ok()) {
                Log::warning('GAMES open upstream HTTP fail', [
                    'status'   => $resp->status(),
                    'body_len' => strlen($resp->body() ?? ''),
                ]);
                return response()->json([
                    'status'=>'fail',
                    'error'=>'upstream_http_'.$resp->status(),
                    'upstream'=>$resp->body(),
                ], 502);
            }

            $data = $this->decodeJsonSafe($resp);
            if (!$data || ($data['status'] ?? null) !== 'success') {
                Log::warning('GAMES open upstream logical/format fail', [
                    'err' => $data['error'] ?? 'upstream_invalid_json_or_fail',
                ]);
                return response()->json([
                    'status'=>'fail',
                    'error'=>$data['error'] ?? 'upstream_invalid_json_or_fail',
                    'upstream'=>$data ?: ['raw_head' => substr($resp->body() ?? '', 0, 300)],
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
        } catch (\Throwable $e) {
            Log::error('GAMES open SERVER EX', [
                'msg'  => $e->getMessage(),
                'file' => $e->getFile().':'.$e->getLine(),
            ]);
            return response()->json([
                'status' => 'fail',
                'error'  => 'server_exception',
            ], 500);
        }
    }

    /**
     * Öffentlicher Callback vom Game-Server (keine CSRF, unter routes/api.php!).
     */
    public function callback(Request $request)
    {
        try {
            // sowohl JSON als auch x-www-form-urlencoded zulassen
            $data = $request->json()->all();
            if (!$data) $data = $request->all();

            Log::info('GAMES CALLBACK HIT', [
                'ip'    => $request->ip(),
                'cmd'   => $data['cmd'] ?? null,
                'hall'  => $data['hall'] ?? null,
                'login' => $data['login'] ?? null,
            ]);

            // Auth prüfen (Sign ist laut .env deaktiviert)
            if (($data['hall'] ?? '') !== (string) config('gamesapi.hall_id')
             || ($data['key']  ?? '') !== (string) config('gamesapi.hall_key')) {
                Log::warning('GAMES CALLBACK AUTH FAILED', ['sent_hall' => $data['hall'] ?? null]);
                return response()->json(['status'=>'fail','error'=>'auth_failed'], 403);
            }

            $cmd = (string) ($data['cmd'] ?? '');
            if ($cmd === 'getBalance')  return $this->handleGetBalance($data);
            if ($cmd === 'writeBet')    return $this->handleWriteBet($data);

            return response()->json(['status'=>'fail','error'=>'unknown_cmd'], 400);

        } catch (\Throwable $e) {
            Log::error('GAMES CALLBACK EXCEPTION', [
                'msg'  => $e->getMessage(),
                'file' => $e->getFile().':'.$e->getLine(),
            ]);
            return response()->json(['status'=>'fail','error'=>'server_error'], 500);
        }
    }

    /**
     * getBalance: echten Kontostand als Decimal(12,2) liefern.
     * Akzeptiert "u{ID}" oder reine ID, sonst username/email.
     */
    protected function handleGetBalance(array $data)
    {
        $login = trim((string)($data['login'] ?? ''));
        if ($login === '') return response()->json(['status'=>'fail','error'=>'user_not_found']);

        if (preg_match('/^u?(\d+)$/', $login, $m)) {
            $user = User::find((int) $m[1]);
        } else {
            $user = User::where('username', $login)->orWhere('email', $login)->first();
        }
        if (!$user) return response()->json(['status'=>'fail','error'=>'user_not_found']);

        $balance  = number_format((float)($user->balance ?? 0), 2, '.', '');
        $currency = $user->currency ?? (string) config('gamesapi.currency', 'EUR');

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
     * Akzeptiert "u{ID}" oder reine ID, sonst username/email.
     */
    protected function handleWriteBet(array $data)
    {
        $login = trim((string)($data['login'] ?? ''));
        if ($login === '') return response()->json(['status'=>'fail','error'=>'user_not_found']);

        if (preg_match('/^u?(\d+)$/', $login, $m)) {
            $query = User::where('id', (int) $m[1]);
        } else {
            $query = User::where(function ($q) use ($login) {
                $q->where('username', $login)->orWhere('email', $login);
            });
        }

        return DB::transaction(function () use ($query, $data, $login) {
            $user = $query->lockForUpdate()->first();
            if (!$user) return response()->json(['status'=>'fail','error'=>'user_not_found']);

            $bet = (float)($data['bet'] ?? 0);
            $win = (float)($data['win'] ?? 0);

            $current = (float)($user->balance ?? 0);
            if ($bet > 0 && $current + 1e-9 < $bet) {
                Log::warning('GAMES writeBet FAIL_BALANCE', ['login'=>$login,'have'=>$current,'need'=>$bet]);
                return response()->json(['status'=>'fail','error'=>'fail_balance']);
            }

            $user->balance = $current - max(0,$bet) + max(0,$win);
            $user->save();

            $balance  = number_format((float)$user->balance, 2, '.', '');
            $currency = $user->currency ?? (string) config('gamesapi.currency', 'EUR');

            Log::info('GAMES writeBet OK', ['login'=>$login,'bet'=>$bet,'win'=>$win,'new'=>$balance]);

            return response()->json([
                'status'   => 'success',
                'error'    => '',
                'login'    => $login,
                'balance'  => $balance,
                'currency' => $currency,
            ]);
        });
    }

    /**
     * Sichere JSON-Dekodierung mit Logging, ohne Exception nach außen.
     */
    private function decodeJsonSafe(Response $resp): ?array
    {
        $body = $resp->body();
        try {
            $data = json_decode($body ?? '', true, 512, JSON_THROW_ON_ERROR);
            return is_array($data) ? $data : null;
        } catch (\Throwable $e) {
            Log::warning('GAMES upstream invalid JSON', [
                'err'  => $e->getMessage(),
                'len'  => strlen($body ?? ''),
                'head' => substr($body ?? '', 0, 1000),
            ]);
            return null;
        }
    }
}
