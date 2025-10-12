<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\GamesApiController;

// einfacher Ping zum Testen der Pipeline
Route::post('/callback-test', function () {
    return response()->json(['ok' => true, 'ts' => now()->toISOString()], 200);
});

// Games-Callback (getBalance / writeBet etc.)
Route::post('/games/callback', [GamesApiController::class, 'callback'])
    ->name('games.callback');

// Optional: rudimentäre OPTIONS-Preflight-Antwort (falls du die brauchst)
Route::options('{any}', function () {
    return response('', 204, [
        'Access-Control-Allow-Origin' => '*',
        'Access-Control-Allow-Methods' => 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers' => 'Content-Type, Authorization',
    ]);
})->where('any', '.*');
