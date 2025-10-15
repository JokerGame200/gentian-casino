<?php

namespace App\Http\Controllers;

use App\Models\GameRound;
use App\Models\GameSession;
use App\Models\GameTransaction;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use App\Support\GamesCatalog;

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
            $imgStyle = (string) $request->query('img', 'game_img_2');
            $allowedImgs = GamesCatalog::ALLOWED_IMG_STYLES;
            if (!in_array($imgStyle, $allowedImgs, true)) {
                $imgStyle = in_array('game_img_2', $allowedImgs, true)
                    ? 'game_img_2'
                    : $allowedImgs[0];
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
            $data = GamesCatalog::decodeJsonSafe($resp);
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

            $flat = GamesCatalog::flattenContent($content);
            $flat = GamesCatalog::dedupe($flat);
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
        $pendingSession = null;

        try {
            $request->validate([
                'gameId' => ['required'],
                'demo'   => ['nullable'],
            ]);

            $user  = $request->user();
            if (!$user) {
                return response()->json(['status'=>'fail','error'=>'auth_required'], 401);
            }

            $gameId = (string) $request->input('gameId');
            $loginCandidate = trim((string) ($user->username ?? ''));
            $login = $loginCandidate !== '' ? $loginCandidate : ('u' . (string) $user->id);

            $maxActiveSessions = (int) config('gamesapi.max_active_sessions_per_user', 2);
            if ($maxActiveSessions <= 0) {
                $maxActiveSessions = null; // null => unbegrenzt
            }

            // Guard: begrenzte Anzahl aktiver/opening Sessions pro Nutzer zulassen.
            $guardResult = DB::transaction(function () use ($user, $gameId, $maxActiveSessions) {
                User::whereKey($user->id)->lockForUpdate()->first();

                $activeSessions = GameSession::where('user_id', $user->id)
                    ->whereIn('status', ['open', 'opening'])
                    ->orderBy('created_at')
                    ->lockForUpdate()
                    ->get();

                $now = Carbon::now();
                $staleOpeningBefore = $now->copy()->subMinutes(3);
                $staleHardBefore = $now->copy()->subMinutes((int) config('gamesapi.stale_session_minutes', 30));
                $definitelyActive = [];

                foreach ($activeSessions as $candidate) {
                    if ($candidate->status === 'opening'
                        && $candidate->created_at
                        && $candidate->created_at->lt($staleOpeningBefore)) {
                        $candidate->status = 'closed';
                        $candidate->closed_at = $now;
                        $candidate->save();
                        continue;
                    }

                    if ($candidate->status === 'open' && $candidate->closed_at) {
                        $candidate->status = 'closed';
                        $candidate->save();
                        continue;
                    }

                    if ($candidate->status === 'open'
                        && $candidate->updated_at
                        && $candidate->updated_at->lt($staleHardBefore)) {
                        $candidate->status = 'closed';
                        $candidate->closed_at = $now;
                        $candidate->save();
                        continue;
                    }

                    $lastActivity = $candidate->updated_at
                        ?? $candidate->opened_at
                        ?? $candidate->created_at;

                    $definitelyActive[] = $candidate;
                }

                if ($maxActiveSessions !== null && count($definitelyActive) >= $maxActiveSessions) {
                    /** @var GameSession $blocked */
                    $blocked = $definitelyActive[0];
                    Log::info('GAMES open blocked by active session', [
                        'user_id'    => $user->id,
                        'session_id' => $blocked->session_id,
                        'status'     => $blocked->status,
                        'updated_at' => $blocked->updated_at,
                        'active_cnt' => count($definitelyActive),
                        'limit'      => $maxActiveSessions,
                    ]);
                    return [
                        'blocked'      => $blocked,
                        'active_count' => count($definitelyActive),
                        'limit'        => $maxActiveSessions,
                    ];
                }

                $session = GameSession::create([
                    'user_id'    => $user->id,
                    'game_id'    => $gameId,
                    'session_id' => 'pending:' . Str::uuid(),
                    'status'     => 'opening',
                    'opened_at'  => null,
                    'bet_total'  => 0,
                    'win_total'  => 0,
                ]);

                return [
                    'session'      => $session,
                    'active_count' => count($definitelyActive),
                    'limit'        => $maxActiveSessions,
                ];
            });

            if (isset($guardResult['blocked'])) {
                /** @var GameSession $active */
                $active = $guardResult['blocked'];
                $activeGameName = $this->lookupGameName($active->game_id);
                Log::notice('GAMES open denied: active session exists', [
                    'user_id'    => $user->id,
                    'session_id' => $active->session_id,
                    'status'     => $active->status,
                    'game_id'    => $active->game_id,
                    'game_name'  => $activeGameName,
                    'active_cnt' => $guardResult['active_count'] ?? null,
                    'limit'      => $guardResult['limit'] ?? null,
                ]);
                return response()->json([
                    'status'    => 'fail',
                    'error'     => 'active_game_in_progress',
                    'sessionId' => $active->session_id,
                    'gameId'    => $active->game_id,
                    'gameName'  => $activeGameName,
                    'confidence'=> 'definite',
                ], 423);
            }

            /** @var GameSession|null $pendingSession */
            $pendingSession = $guardResult['session'] ?? null;
            if (!$pendingSession) {
                throw new \RuntimeException('open_session_guard_failed');
            }

            $payload = [
                'cmd'      => 'openGame',
                'hall'     => (string) config('gamesapi.hall_id'),
                'key'      => (string) config('gamesapi.hall_key'),
                'login'    => $login,
                'gameId'   => $gameId,
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
                $this->finalizePendingSession($pendingSession);
                return response()->json([
                    'status'=>'fail',
                    'error'=>'upstream_http_'.$resp->status(),
                    'upstream'=>$resp->body(),
                ], 502);
            }

            $data = GamesCatalog::decodeJsonSafe($resp);
            if (!$data || ($data['status'] ?? null) !== 'success') {
                Log::warning('GAMES open upstream logical/format fail', [
                    'err' => $data['error'] ?? 'upstream_invalid_json_or_fail',
                ]);
                $this->finalizePendingSession($pendingSession);
                return response()->json([
                    'status'=>'fail',
                    'error'=>$data['error'] ?? 'upstream_invalid_json_or_fail',
                    'upstream'=>$data ?: ['raw_head' => substr($resp->body() ?? '', 0, 300)],
                ], 422);
            }

            $game = $data['content']['game'] ?? [];
            $url  = $game['url'] ?? null;
            if (!$url) {
                $this->finalizePendingSession($pendingSession);
                return response()->json([
                    'status'=>'fail',
                    'error'=>'no_game_url',
                    'upstream'=>$data,
                ], 422);
            }

            $sessionId = $this->normalizeString($data['content']['gameRes']['sessionId'] ?? null);
            if (!$sessionId) {
                $this->finalizePendingSession($pendingSession);
                return response()->json([
                    'status'=>'fail',
                    'error'=>'no_session_id',
                    'upstream'=>$data,
                ], 422);
            }

            $resolvedGameId = $this->normalizeString(
                $data['content']['gameRes']['gameId']
                ?? $game['id']
                ?? $gameId
            ) ?? $gameId;

            $this->activatePendingSession($pendingSession, $sessionId, $resolvedGameId);

            return response()->json([
                'status'       => 'success',
                'url'          => $url,
                'withoutFrame' => $game['withoutFrame'] ?? '0',
                'sessionId'    => $sessionId,
            ]);
        } catch (\Throwable $e) {
            $this->finalizePendingSession($pendingSession);
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

    private function finalizePendingSession(?GameSession $session): void
    {
        if (!$session || !$session->exists || $session->status !== 'opening') {
            return;
        }

        if (!$session->opened_at) {
            $session->opened_at = Carbon::now();
        }
        $session->status = 'closed';
        $session->closed_at = Carbon::now();
        $session->save();
    }

    private function activatePendingSession(GameSession $session, string $sessionId, string $gameId): void
    {
        $session->session_id = $sessionId;
        $session->game_id = $gameId;
        $session->status = 'open';
        $session->opened_at = Carbon::now();
        $session->closed_at = null;
        $session->save();
    }

    public function close(Request $request)
    {
        $request->validate([
            'sessionId' => ['nullable', 'string', 'max:255'],
        ]);

        $user = $request->user();
        if (!$user) {
            return response()->json([
                'status' => 'fail',
                'error'  => 'invalid_context',
            ], 422);
        }

        $sessionId = $this->normalizeString($request->input('sessionId'));
        try {
            $closed = $this->closeUserSessions($user, $sessionId);

            return response()->json([
                'status'     => 'success',
                'sessionId'  => $sessionId,
                'closed_cnt' => $closed,
            ]);
        } catch (\Throwable $e) {
            Log::error('GAMES close API fail', [
                'msg'        => $e->getMessage(),
                'session_id' => $sessionId,
                'user_id'    => $user->id,
            ]);
            return response()->json([
                'status' => 'fail',
                'error'  => 'server_error',
            ], 500);
        }
    }

    public function exit(Request $request)
    {
        $user = $request->user();
        $sessionId = $this->normalizeString($request->query('sessionId') ?? $request->input('sessionId'));

        Log::info('GAMES exit request', [
            'session_id' => $sessionId,
            'user_id'    => $user?->id,
            'ip'         => $request->ip(),
        ]);

        try {
            if ($user || $sessionId) {
                $this->closeUserSessions($user, $sessionId);
            }
        } catch (\Throwable $e) {
            Log::error('GAMES exit close fail', [
                'msg'        => $e->getMessage(),
                'session_id' => $sessionId,
                'user_id'    => $user?->id,
            ]);
        }

        return redirect()->route('welcome');
    }

    public function ping(Request $request)
    {
        $request->validate([
            'sessionId' => ['required', 'string', 'max:255'],
        ]);

        $user = $request->user();
        if (!$user) {
            return response()->json([
                'status' => 'fail',
                'error'  => 'auth_required',
            ], 401);
        }

        $sessionId = $this->normalizeString($request->input('sessionId'));
        if (!$sessionId) {
            return response()->json([
                'status' => 'fail',
                'error'  => 'invalid_session_id',
            ], 422);
        }

        try {
            $wasActive = DB::transaction(function () use ($user, $sessionId) {
                $session = GameSession::where('user_id', $user->id)
                    ->whereIn('status', ['open', 'opening'])
                    ->where('session_id', $sessionId)
                    ->lockForUpdate()
                    ->first();

                if (!$session) {
                    return false;
                }

                $now = Carbon::now();
                if (!$session->opened_at) {
                    $session->opened_at = $now;
                }
                if ($session->status === 'opening') {
                    $session->status = 'open';
                }

                $session->updated_at = $now;
                $session->save();

                return true;
            });

            return response()->json([
                'status'     => 'success',
                'sessionId'  => $sessionId,
                'was_active' => $wasActive,
            ]);
        } catch (\Throwable $e) {
            Log::error('GAMES ping fail', [
                'msg'        => $e->getMessage(),
                'session_id' => $sessionId,
                'user_id'    => $user->id,
            ]);

            return response()->json([
                'status' => 'fail',
                'error'  => 'server_error',
            ], 500);
        }
    }

    private function lookupGameName(?string $gameIdentifier): ?string
    {
        $id = trim((string) ($gameIdentifier ?? ''));
        if ($id === '') {
            return null;
        }

        try {
            $row = DB::table('games')
                ->where(function ($query) use ($id) {
                    $query->where('id', $id)
                        ->orWhere('game_id', $id)
                        ->orWhere('uid', $id);
                })
                ->select(['name', 'title', 'display_name'])
                ->first();
        } catch (\Throwable) {
            return null;
        }

        if (!$row) {
            return null;
        }

        $data = (array) $row;
        foreach (['name', 'title', 'display_name'] as $key) {
            if (!empty($data[$key])) {
                return (string) $data[$key];
            }
        }

        return null;
    }

    private function closeUserSessions(?User $user, ?string $sessionId): int
    {
        if (!$user && !$sessionId) {
            return 0;
        }

        return DB::transaction(function () use ($user, $sessionId) {
            $query = GameSession::query()
                ->whereIn('status', ['open', 'opening'])
                ->lockForUpdate();

            if ($user) {
                $query->where('user_id', $user->id);
            }

            if ($sessionId) {
                $query->where('session_id', $sessionId);
            }

            $sessions = $query->get();
            $now = Carbon::now();
            $closed = 0;

            foreach ($sessions as $session) {
                if (!$session->opened_at) {
                    $session->opened_at = $now;
                }
                $session->status = 'closed';
                $session->closed_at = $now;
                $session->save();
                $closed++;
            }

            return $closed;
        });
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

            $bet = (float) ($data['bet'] ?? 0);
            $win = (float) ($data['win'] ?? 0);

            $tradeId = $this->normalizeString($data['tradeId'] ?? $data['trade_id'] ?? null);
            $existingTransaction = null;
            if ($tradeId) {
                $existingTransaction = GameTransaction::where('trade_id', $tradeId)->lockForUpdate()->first();
            }
            if ($existingTransaction) {
                $balanceValue = $existingTransaction->after_balance ?? $user->balance;
                $balance = number_format((float) $balanceValue, 2, '.', '');
                $currency = $user->currency ?? (string) config('gamesapi.currency', 'EUR');

                Log::info('GAMES writeBet DUPLICATE', [
                    'login'    => $login,
                    'trade_id' => $tradeId,
                    'bet'      => $bet,
                    'win'      => $win,
                    'balance'  => $balance,
                    'tx_id'    => $existingTransaction->id ?? null,
                ]);

                return response()->json([
                    'status'   => 'success',
                    'error'    => '',
                    'login'    => $login,
                    'balance'  => $balance,
                    'currency' => $currency,
                ]);
            }

            $current = (float) ($user->balance ?? 0);
            if ($bet > 0 && $current + 1e-9 < $bet) {
                Log::warning('GAMES writeBet FAIL_BALANCE', ['login'=>$login,'have'=>$current,'need'=>$bet]);
                return response()->json(['status'=>'fail','error'=>'fail_balance']);
            }

            $betPositive = max(0, $bet);
            $winPositive = max(0, $win);

            $user->balance = $current - $betPositive + $winPositive;
            $user->save();

            $after = (float) $user->balance;

            $sessionId = $this->normalizeString($data['sessionId'] ?? $data['session_id'] ?? null);
            $providerGameId = $this->normalizeNumericId($data['providerGameId'] ?? $data['provider_game_id'] ?? null);
            if ($providerGameId === null) {
                $providerGameId = $this->normalizeNumericId($data['gameId'] ?? $data['game_id'] ?? null);
            }

            $gameId = $this->normalizeString($data['gameId'] ?? $data['game_id'] ?? null);
            if (!$gameId) {
                $gameId = $this->normalizeString($data['game'] ?? $data['gameCode'] ?? null);
            }
            $gameKey = $gameId ?? ($providerGameId !== null ? (string) $providerGameId : null);

            $roundFinished = $this->normalizeBoolean($data['roundFinished'] ?? $data['round_finished'] ?? null);
            $sessionFinished = $this->normalizeBoolean($data['sessionFinished'] ?? $data['session_finished'] ?? null);
            $sessionStatus = $this->normalizeSessionStatus($data['sessionStatus'] ?? $data['session_status'] ?? null, $sessionFinished);

            $roundTime = $this->parseDateTimeValue($data['roundTime'] ?? $data['round_time'] ?? $data['time'] ?? null);
            $sessionOpenedAt = $this->parseDateTimeValue($data['sessionOpenedAt'] ?? $data['session_opened_at'] ?? null);
            $sessionClosedAt = $this->parseDateTimeValue($data['sessionClosedAt'] ?? $data['session_closed_at'] ?? null);

            $action = $this->normalizeString($data['action'] ?? $data['type'] ?? $data['gameAction'] ?? ($data['cmd'] ?? null));
            $betInfo = $this->encodeToJsonString($data['betInfo'] ?? $data['bet_info'] ?? null);
            $matrix = $this->encodeToJsonString($data['matrix'] ?? null);
            $winLines = $this->encodeToJsonString($data['winLines'] ?? $data['win_lines'] ?? null);

            $meta = is_array($data) ? $data : [];
            foreach ([
                'hall','key','cmd','login','bet','win','sessionId','session_id',
                'tradeId','trade_id','providerGameId','provider_game_id','gameId','game_id',
                'game','gameCode','game_code','roundFinished','round_finished',
                'sessionFinished','session_finished','sessionStatus','session_status',
                'sessionOpenedAt','session_opened_at','sessionClosedAt','session_closed_at',
                'roundTime','round_time','time','action','type','gameAction',
                'betInfo','bet_info','matrix','winLines','win_lines'
            ] as $removeKey) {
                if (array_key_exists($removeKey, $meta)) {
                    unset($meta[$removeKey]);
                }
            }
            $meta = array_filter($meta, static fn($value) => $value !== null);
            if ($meta === []) {
                $meta = null;
            }

            $session = null;
            if ($sessionId && $gameKey) {
                $session = GameSession::where('session_id', $sessionId)->lockForUpdate()->first();
                $sessionIsNew = false;
                if (!$session) {
                    $sessionIsNew = true;
                    $session = new GameSession([
                        'user_id'    => $user->id,
                        'game_id'    => $gameKey,
                        'session_id' => $sessionId,
                        'status'     => $sessionStatus ?? 'open',
                        'opened_at'  => $sessionOpenedAt ?? $roundTime ?? Carbon::now(),
                        'bet_total'  => 0,
                        'win_total'  => 0,
                    ]);
                } else {
                    if ($session->user_id !== $user->id) {
                        $session->user_id = $user->id;
                    }
                    if (!$session->game_id && $gameKey) {
                        $session->game_id = $gameKey;
                    }
                    if (!$session->opened_at && $sessionOpenedAt) {
                        $session->opened_at = $sessionOpenedAt;
                    }
                }

                if ($betPositive > 0) {
                    $session->bet_total = round(((float) $session->bet_total) + $betPositive, 2);
                }
                if ($winPositive > 0) {
                    $session->win_total = round(((float) $session->win_total) + $winPositive, 2);
                }

                if ($sessionStatus) {
                    if ($sessionStatus === 'closed') {
                        $session->status = 'closed';
                    } elseif ($session->status !== 'closed') {
                        $session->status = $sessionStatus;
                    }
                }

                if ($sessionClosedAt) {
                    $session->closed_at = $sessionClosedAt;
                } elseif (($sessionStatus === 'closed' || $sessionFinished === true) && !$session->closed_at) {
                    $session->closed_at = $roundTime ?? Carbon::now();
                }

                if ($sessionIsNew && ($sessionStatus === 'closed' || $sessionFinished === true) && !$session->closed_at) {
                    $session->closed_at = $roundTime ?? Carbon::now();
                }

                $session->save();
            }

            $round = null;
            if ($gameKey) {
                $roundData = [
                    'game_id'      => $gameKey,
                    'player_login' => $login,
                    'bet'          => $bet,
                    'win'          => $win,
                    'session_id'   => $sessionId,
                    'trade_id'     => $tradeId,
                    'action'       => $action,
                    'bet_info'     => $betInfo,
                    'matrix'       => $matrix,
                    'win_lines'    => $winLines,
                    'round_time'   => $roundTime,
                ];

                if ($tradeId) {
                    $round = GameRound::updateOrCreate(
                        ['trade_id' => $tradeId],
                        $roundData
                    );
                } else {
                    $round = GameRound::create($roundData);
                }
            }

            $transactionPayload = [
                'trade_id'         => $tradeId,
                'user_id'          => $user->id,
                'session_id'       => $sessionId,
                'provider_game_id' => $providerGameId,
                'bet'              => $bet,
                'win'              => $win,
                'before_balance'   => $current,
                'after_balance'    => $after,
                'action'           => $action,
                'round_finished'   => $roundFinished,
                'meta'             => $meta,
            ];

            $transaction = GameTransaction::create($transactionPayload);

            $balance  = number_format($after, 2, '.', '');
            $currency = $user->currency ?? (string) config('gamesapi.currency', 'EUR');

            Log::info('GAMES writeBet OK', [
                'login'      => $login,
                'bet'        => $bet,
                'win'        => $win,
                'new'        => $balance,
                'trade_id'   => $tradeId,
                'tx_id'      => $transaction->id ?? null,
                'session_id' => $session?->id,
                'round_id'   => $round?->id,
                'game_id'    => $gameKey,
            ]);

            return response()->json([
                'status'   => 'success',
                'error'    => '',
                'login'    => $login,
                'balance'  => $balance,
                'currency' => $currency,
            ]);
        });
    }

    private function normalizeBoolean(mixed $value): ?bool
    {
        if (is_bool($value)) {
            return $value;
        }
        if (is_numeric($value)) {
            return ((float) $value) > 0;
        }
        if (is_string($value)) {
            $normalized = strtolower(trim($value));
            if ($normalized === '') {
                return null;
            }
            if (in_array($normalized, ['1', 'true', 'yes', 'y', 'on'], true)) {
                return true;
            }
            if (in_array($normalized, ['0', 'false', 'no', 'n', 'off'], true)) {
                return false;
            }
        }
        return null;
    }

    private function normalizeSessionStatus(mixed $status, ?bool $finished): ?string
    {
        if (is_string($status)) {
            $normalized = strtolower(trim($status));
            if ($normalized !== '') {
                if (in_array($normalized, ['closed', 'close', 'closing', 'finished', 'finish', 'completed', 'complete', 'ended', 'end'], true)) {
                    return 'closed';
                }
                if (in_array($normalized, ['open', 'opening', 'active', 'start', 'started'], true)) {
                    return 'open';
                }
                return $normalized;
            }
        }
        if ($finished === true) {
            return 'closed';
        }
        return null;
    }

    private function parseDateTimeValue(mixed $value): ?Carbon
    {
        if ($value instanceof Carbon) {
            return $value;
        }
        if ($value instanceof \DateTimeInterface) {
            return Carbon::instance($value);
        }
        if (is_numeric($value)) {
            $numeric = (float) $value;
            if ($numeric <= 0) {
                return null;
            }
            if ($numeric > 9999999999) {
                return Carbon::createFromTimestamp((int) round($numeric / 1000));
            }
            return Carbon::createFromTimestamp((int) round($numeric));
        }
        if (is_string($value)) {
            $trimmed = trim($value);
            if ($trimmed === '') {
                return null;
            }
            try {
                return Carbon::parse($trimmed);
            } catch (\Throwable) {
                return null;
            }
        }
        return null;
    }

    private function encodeToJsonString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        if (is_string($value)) {
            $trimmed = trim($value);
            return $trimmed === '' ? null : $value;
        }
        if (is_scalar($value)) {
            return (string) $value;
        }
        try {
            $encoded = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            return $encoded === false ? null : $encoded;
        } catch (\Throwable) {
            return null;
        }
    }

    private function normalizeString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        if (is_string($value)) {
            $trimmed = trim($value);
            return $trimmed === '' ? null : $trimmed;
        }
        if (is_scalar($value)) {
            $string = trim((string) $value);
            return $string === '' ? null : $string;
        }
        return null;
    }

    private function normalizeNumericId(mixed $value): ?int
    {
        if (is_int($value)) {
            return $value;
        }
        if (is_numeric($value)) {
            $int = (int) $value;
            return $int >= 0 ? $int : null;
        }
        return null;
    }

}
