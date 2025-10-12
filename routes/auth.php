<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\PasswordController;

/*
|--------------------------------------------------------------------------
| Auth (ohne E-Mail-Verifizierung)
|--------------------------------------------------------------------------
*/

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login', [AuthenticatedSessionController::class, 'store']);
});

Route::middleware('auth')->group(function () {
    // Für Breeze: "UpdatePasswordForm"
    Route::put('/password', [PasswordController::class, 'update'])->name('password.update');

    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');
});
