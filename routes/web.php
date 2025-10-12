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

Route::get('/welcome', function () {
    return Inertia::render('Welcome');
})->name('welcome');

// Gäste: Invite
Route::middleware('guest')->group(function () {
    Route::get('/invite/{token}', [InvitationController::class, 'showRegistrationForm'])
        ->middleware('invite_token')->name('invite.show');
    Route::post('/invite/{token}', [InvitationController::class, 'register'])
        ->middleware('invite_token')->name('invite.register');
});

Route::middleware(['web', 'auth'])->group(function () {
    Route::get('/api/games/list', [GamesApiController::class, 'list']);
    Route::post('/api/games/open', [GamesApiController::class, 'open']);
});

Route::get('/games/exit', fn () => redirect()->route('welcome'))->name('games.exit');


Route::middleware('auth')->group(function () {

    // Breeze Profile
    Route::get('/profile',  [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // Avatar-Placeholder
    Route::get('/avatar/placeholder', [AvatarController::class, 'placeholder'])->name('avatar.placeholder');

    // ---------- BALANCE (JSON Polling) ----------
    Route::get('/api/me/balance', [BalanceController::class, 'me'])->name('api.me.balance');
    Route::get('/api/me', function (Request $request) {
        $u = $request->user();
        return response()->json([
            'user' => [
                'id'       => $u->id,
                'name'     => $u->name,
                'username' => $u->username ?? null,
                'balance'  => (float)($u->balance ?? 0),
                'currency' => $u->currency ?? 'EUR',
            ],
        ])->header('Cache-Control','no-store, no-cache, must-revalidate, max-age=0')
          ->header('Pragma','no-cache');
    })->name('api.me');

    // ---------- ADMIN ----------
    Route::middleware('role:Admin')->prefix('admin')->name('admin.')->group(function () {
        Route::get('/', [AdminController::class, 'index'])->name('index');
        Route::get('/users', [AdminController::class, 'index'])->name('users');
        Route::post('/invite', [InvitationController::class, 'create'])->name('invite');
        Route::post('/users/{user}/assign-runner', [AdminController::class, 'assignRunner'])->name('assignRunner');
        Route::post('/users/{user}/role/set', [AdminController::class, 'setRole'])->name('setRole');
        Route::delete('/users/{user}', [AdminController::class, 'destroy'])->name('users.destroy');
        Route::get('/logs', [BalanceController::class, 'index'])->name('logs');
        Route::post('/runners/{runner}/limits', [AdminController::class, 'updateRunnerLimits'])->name('runners.updateLimits');
    });

    // ---------- RUNNER ----------
    Route::middleware('role:Runner')->prefix('runner')->name('runner.')->group(function () {
        Route::get('/users', [RunnerController::class, 'index'])->name('users');
        Route::get('/logs', [BalanceController::class, 'index'])->name('logs');
    });

    // Balance Update (Admin|Runner)
    Route::post('/users/{user}/balance', [BalanceController::class, 'update'])
        ->middleware('role:Admin|Runner')->name('balance.update');

    // Welcome & Dashboard (verifiziert)
    Route::middleware('verified')->group(function () {
        
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
