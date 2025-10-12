<?php
// routes/api.php
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\GamesApiController;

/**
 * OPTIONAL: Spiel schließen (z. B. von deiner SPA aus),
 * nur wenn du Sanctum wirklich benutzt. Sonst weglassen oder in web.php packen.
 */
Route::middleware('auth:sanctum')->post('/games/close', function (Request $r) {
    if ($u = $r->user()) {
        \App\Models\GameSession::where('user_id', $u->id)
            ->where('status', 'open')
            ->update(['status' => 'closed', 'closed_at' => now()]);
    }
    return response()->json(['ok' => true]);
})->name('api.games.close');

/**
 * WICHTIG: Provider-Callback (getBalance / writeBet)
 * Öffentlich, KEIN Login, KEIN CSRF (api-Gruppe hat standardmäßig kein CSRF).
 * Hier NICHT 'auth:sanctum' o. ä. verwenden.
 */
Route::post('/games/callback', [GamesApiController::class, 'callback'])
    ->name('games.callback');

// (optional) Preflight fürs BO-Testtool
Route::options('/games/callback', fn () => response('', 204));

/**
 * NICHT HIER definieren:
 * - /games/list
 * - /games/open
 * Diese stehen in routes/web.php unter 'auth' (Web-Session + CSRF).
 *
 * Entferne außerdem alle alten/anderen Callback-Routen wie:
 *   Route::post('/games/callback', [GamesWalletController::class,'handle'])
 * …sonst gibt es Kollisionen.
 */
