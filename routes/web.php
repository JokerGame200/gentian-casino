<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\{AdminController,RunnerController,BalanceController,InvitationController};

// Root -> Login oder Dashboard
Route::get('/', fn() => auth()->check()
    ? redirect()->route('dashboard')
    : redirect()->route('login'));

// Breeze/Auth-Routen laden
require __DIR__.'/auth.php';

// Gäste: Invite-Registrierung (One-Time)
Route::middleware('guest')->group(function () {
    Route::get('/invite/{token}', [InvitationController::class,'showRegistrationForm'])
        ->middleware('invite_token')->name('register.invite');
    Route::post('/invite/{token}', [InvitationController::class,'register'])
        ->middleware('invite_token');
});

// Geschützt
Route::middleware('auth')->group(function () {
    Route::get('/dashboard', function () {
        $u = auth()->user();
        if ($u->hasRole('Admin'))  return redirect()->route('admin.users');
        if ($u->hasRole('Runner')) return redirect()->route('runner.users');
        return inertia('Dashboard'); // einfache User-Seite
    })->name('dashboard');

    // Admin
    Route::middleware('role:Admin')->prefix('admin')->group(function () {
        Route::get('/users', [AdminController::class,'index'])->name('admin.users');
        Route::post('/users/{user}/assign-runner', [AdminController::class,'assignRunner'])->name('admin.assignRunner');
        Route::post('/invite', [InvitationController::class,'create'])->name('admin.invite');
        Route::get('/logs', [BalanceController::class,'index'])->name('admin.logs');
    });

    // Runner
    Route::middleware('role:Runner')->prefix('runner')->group(function () {
        Route::get('/users', [RunnerController::class,'index'])->name('runner.users');
        Route::post('/invite', [InvitationController::class,'create'])->name('runner.invite');
        Route::get('/logs', [BalanceController::class,'index'])->name('runner.logs');
    });

    // Guthaben ändern (Admin ODER Runner) – Gate prüft Zieluser
    Route::post('/users/{user}/balance', [BalanceController::class,'store'])
        ->middleware('role:Admin|Runner')->name('balance.update');
});
