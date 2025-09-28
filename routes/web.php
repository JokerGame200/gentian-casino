<?php

use Inertia\Inertia;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\{
    AdminController, RunnerController, BalanceController, AvatarController, InvitationController, ProfileController
};

// Root -> Login / Welcome
Route::get('/', fn () => auth()->check()
    ? redirect()->route('welcome')
    : redirect()->route('login'));

require __DIR__.'/auth.php';

// Gäste: Invite
Route::middleware('guest')->group(function () {
    Route::get('/invite/{token}', [InvitationController::class, 'showRegistrationForm'])
        ->middleware('invite_token')->name('invite.show');
    Route::post('/invite/{token}', [InvitationController::class, 'register'])
        ->middleware('invite_token')->name('invite.register');
});

// Auth
Route::middleware('auth')->group(function () {
    Route::get('/games', fn()=> Inertia::render('Games/Lobby'))->name('games.lobby');
    Route::view('/close.php', 'games/close')->name('games.exit');

    // Breeze Profile
    Route::get('/profile',  [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile',[ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile',[ProfileController::class, 'destroy'])->name('profile.destroy');
    Route::get('/avatar/placeholder', [AvatarController::class, 'placeholder'])
        ->name('avatar.placeholder');
    Route::get('/api/balance/me', [BalanceController::class, 'me'])->name('balance.me');

    // ---------- ADMIN ----------
    Route::middleware('role:Admin')->prefix('admin')->name('admin.')->group(function () {
        Route::get('/', [AdminController::class, 'index'])->name('index');
        Route::get('/users', [AdminController::class, 'index'])->name('users');

        Route::post('/invite', [InvitationController::class, 'create'])->name('invite');
        Route::post('/users/{user}/assign-runner', [AdminController::class, 'assignRunner'])->name('assignRunner');
        Route::post('/users/{user}/role/set', [AdminController::class, 'setRole'])->name('setRole');
        Route::delete('/users/{user}', [AdminController::class, 'destroy'])->name('users.destroy');
        Route::get('/logs', [BalanceController::class, 'index'])->name('logs');

        // FIX: kein zusätzliches /admin im Pfad; Name relativ -> ergibt admin.runners.updateLimits
        Route::post('/runners/{runner}/limits', [AdminController::class, 'updateRunnerLimits'])
            ->name('runners.updateLimits');
    });

    // ---------- RUNNER ----------
    Route::middleware('role:Runner')->prefix('runner')->name('runner.')->group(function () {
        Route::get('/users', [RunnerController::class, 'index'])->name('users');
        Route::get('/logs', [BalanceController::class, 'index'])->name('logs');
    });

    // Balance (Admin|Runner) – FIX: auf update zeigen, dort ist die Limit-Prüfung
    Route::post('/users/{user}/balance', [BalanceController::class, 'update'])
        ->middleware('role:Admin|Runner')->name('balance.update');

    // Welcome & Dashboard (verifiziert)
    Route::middleware('verified')->group(function () {
        Route::get('/welcome', fn () => Inertia::render('Welcome'))->name('welcome');

        Route::get('/dashboard', function () {
            $user = auth()->user();
            if ($user->hasRole('Admin'))  return redirect()->route('admin.index'); // angepasst
            if ($user->hasRole('Runner')) return redirect()->route('runner.users');
            return Inertia::render('Dashboard');
        })->name('dashboard');
    });
});