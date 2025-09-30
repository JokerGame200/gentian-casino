<?php

use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\{
    AdminController,
    RunnerController,
    BalanceController,
    AvatarController,
    InvitationController,
    ProfileController,
    GamesApiController
};

// Root -> Login / Welcome
Route::get('/', fn () => auth()->check()
    ? redirect()->route('welcome')
    : redirect()->route('login'));

require __DIR__ . '/auth.php';

// Gäste: Invite
Route::middleware('guest')->group(function () {
    Route::get('/invite/{token}', [InvitationController::class, 'showRegistrationForm'])
        ->middleware('invite_token')
        ->name('invite.show');

    Route::post('/invite/{token}', [InvitationController::class, 'register'])
        ->middleware('invite_token')
        ->name('invite.register');
});

// Auth
Route::middleware('auth')->group(function () {
    // Optional: Lobby-Seite
    Route::get('/games', fn () => Inertia::render('Games/Lobby'))->name('games.lobby');

    // ---- GAMES API (über Web-Session + CSRF) ----
    Route::post('/api/games/list', [GamesApiController::class, 'list'])->name('games.list');
    Route::post('/api/games/open', [GamesApiController::class, 'open'])->name('games.open');

    // Exit-Seite (iFrame, sendet postMessage)
    Route::view('/close.php', 'games.close')->name('games.exit');

    // Breeze Profile
    Route::get('/profile',  [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // Avatar-Placeholder
    Route::get('/avatar/placeholder', [AvatarController::class, 'placeholder'])->name('avatar.placeholder');

    // ---------- BALANCE (JSON für Polling) ----------
    // Bevorzugter Endpoint, den dein Frontend alle 2s aufruft
    Route::get('/api/me/balance', [BalanceController::class, 'me'])
        ->name('api.me.balance');

    // Kompatible Aliase (falls dein Frontend andere Kandidaten probiert)
    Route::get('/api/balance/me', [BalanceController::class, 'me']);   // alt
    Route::get('/api/user/balance', [BalanceController::class, 'me']); // alias

    // Fallback: Liefert den eingeloggten User inkl. Balance/Currency
    Route::get('/api/me', function (Request $request) {
        $u = $request->user();
        return response()
            ->json([
                'user' => [
                    'id'       => $u->id,
                    'name'     => $u->name,
                    'username' => $u->username ?? null,
                    'balance'  => (float)($u->balance ?? 0),
                    'currency' => $u->currency ?? 'EUR',
                ],
            ])
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            ->header('Pragma', 'no-cache');
    })->name('api.me');

    // Optionaler Alias für /api/user
    Route::get('/api/user', function (Request $request) {
        $u = $request->user();
        return response()
            ->json([
                'user' => [
                    'id'       => $u->id,
                    'name'     => $u->name,
                    'username' => $u->username ?? null,
                    'balance'  => (float)($u->balance ?? 0),
                    'currency' => $u->currency ?? 'EUR',
                ],
            ])
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            ->header('Pragma', 'no-cache');
    })->name('api.user');

    // ---------- ADMIN ----------
    Route::middleware('role:Admin')->prefix('admin')->name('admin.')->group(function () {
        Route::get('/', [AdminController::class, 'index'])->name('index');
        Route::get('/users', [AdminController::class, 'index'])->name('users');

        Route::post('/invite', [InvitationController::class, 'create'])->name('invite');
        Route::post('/users/{user}/assign-runner', [AdminController::class, 'assignRunner'])->name('assignRunner');
        Route::post('/users/{user}/role/set', [AdminController::class, 'setRole'])->name('setRole');
        Route::delete('/users/{user}', [AdminController::class, 'destroy'])->name('users.destroy');
        Route::get('/logs', [BalanceController::class, 'index'])->name('logs');

        // Limits
        Route::post('/runners/{runner}/limits', [AdminController::class, 'updateRunnerLimits'])
            ->name('runners.updateLimits');
    });

    // ---------- RUNNER ----------
    Route::middleware('role:Runner')->prefix('runner')->name('runner.')->group(function () {
        Route::get('/users', [RunnerController::class, 'index'])->name('users');
        Route::get('/logs', [BalanceController::class, 'index'])->name('logs');
    });

    // Balance (Admin|Runner) – Update
    Route::post('/users/{user}/balance', [BalanceController::class, 'update'])
        ->middleware('role:Admin|Runner')
        ->name('balance.update');

    // Welcome & Dashboard (verifiziert)
    Route::middleware('verified')->group(function () {
        Route::get('/welcome', fn () => Inertia::render('Welcome'))->name('welcome');

        Route::get('/dashboard', function () {
            $user = auth()->user();
            if (method_exists($user, 'hasRole')) {
                if ($user->hasRole('Admin'))  return redirect()->route('admin.index');
                if ($user->hasRole('Runner')) return redirect()->route('runner.users');
            }
            return Inertia::render('Dashboard');
        })->name('dashboard');
    });
});
