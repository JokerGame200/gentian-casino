<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\GamesApiController;

Route::get('/ping', fn() => response()->json(['ok' => true]));

Route::middleware(['throttle:60,1'])->group(function () {
    // öffentlich – Browser darf ohne Session-Cookies zugreifen
    Route::post('/games/list', [GamesApiController::class, 'list'])->name('api.games.list');

    // optional nur für eingeloggte User (wenn du openGame nicht öffentlich willst)
    Route::post('/games/open', [GamesApiController::class, 'open'])
        // ->middleware('auth')    // <- auskommentiert lassen, wenn du erstmal testen willst
        ->name('api.games.open');
});
