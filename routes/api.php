<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\GamesApiController;
use App\Http\Controllers\GamesProxyController;

// Platzhalterroute (optional)
Route::get('/ping', fn () => 'ok');

Route::post('/gamesapi/callback', [GamesApiController::class, 'callback'])  // getBalance & writeBet
  ->middleware(['throttle:120,1']); // schnell, aber begrenzt

// interne Proxies (Frontend ruft DICH auf)
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/games/list', [GamesProxyController::class, 'list']);
    Route::post('/games/open', [GamesProxyController::class, 'open']);
    Route::get('/games/jackpots', [GamesProxyController::class, 'jackpots']);
});