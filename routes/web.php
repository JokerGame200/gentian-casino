<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\{
    AdminController,
    RunnerController,
    BalanceController,
    InvitationController,
    ProfileController
};

// Root -> Login oder Dashboard
Route::get('/', fn () => auth()->check()
    ? redirect()->route('dashboard')
    : redirect()->route('login')
);

// Breeze/Auth-Routen (Login, Register, Password, etc.)
require __DIR__ . '/auth.php';

/*
|--------------------------------------------------------------------------
| Gäste: Registrierung über Einladungslink
| - invite_token Middleware validiert den Token (EnsureValidInviteToken)
|--------------------------------------------------------------------------
*/
Route::middleware('guest')->group(function () {
    // Formular anzeigen
    Route::get('/invite/{token}', [InvitationController::class, 'showRegistrationForm'])
        ->middleware('invite_token')
        ->name('invite.show');

    // Registrierung absenden
    Route::post('/invite/{token}', [InvitationController::class, 'register'])
        ->middleware('invite_token')
        ->name('invite.register');
});

/*
|--------------------------------------------------------------------------
| Authentifiziert
|--------------------------------------------------------------------------
*/
Route::middleware('auth')->group(function () {

    // Dashboard: Rolle entscheidet über Zielseite
    Route::get('/dashboard', function () {
        $u = auth()->user();
        if ($u->hasRole('Admin'))  return redirect()->route('admin.users');
        if ($u->hasRole('Runner')) return redirect()->route('runner.users');
        return inertia('Dashboard'); // einfache User-Seite
    })->name('dashboard');

    // --- Breeze Profil-Routen (fix für Ziggy: profile.edit etc.) ---
    Route::get('/profile',  [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile',[ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile',[ProfileController::class, 'destroy'])->name('profile.destroy');

    /*
    |--------------------------------------------------------------------------
    | Admin-Bereich
    |--------------------------------------------------------------------------
    */
    Route::middleware('role:Admin')->prefix('admin')->group(function () {
        Route::get('/users', [AdminController::class, 'index'])->name('admin.users');
        Route::post('/users/{user}/assign-runner', [AdminController::class, 'assignRunner'])->name('admin.assignRunner');
        Route::post('/users/{user}/role', [AdminController::class, 'setRole'])->name('admin.setRole');
        Route::post('/users/{user}/role/set', [AdminController::class, 'updateRole'])->name('admin.setRole');

        // Invite erstellen (hier kann Admin User- oder Runner-Invite wählen)
        Route::post('/invite', [InvitationController::class, 'create'])->name('admin.invite');

        // Logs einsehen (gleiche Action wie Runner, aber separater Name)
        Route::get('/logs', [BalanceController::class, 'index'])->name('admin.logs');
    });

    /*
    |--------------------------------------------------------------------------
    | Runner-Bereich
    |--------------------------------------------------------------------------
    */
    Route::middleware('role:Runner')->prefix('runner')->group(function () {
        Route::get('/users', [RunnerController::class, 'index'])->name('runner.users');

        // Invite erstellen (Runner dürfen nur User-Invites erstellen)
        Route::post('/invite', [InvitationController::class, 'create'])->name('runner.invite');

        Route::get('/logs', [BalanceController::class, 'index'])->name('runner.logs');
    });

    /*
    |--------------------------------------------------------------------------
    | Guthaben ändern (nur Admin oder Runner)
    | Gate/Controller prüft, ob Zieluser zulässig ist.
    |--------------------------------------------------------------------------
    */
    Route::post('/users/{user}/balance', [BalanceController::class, 'store'])
        ->middleware('role:Admin|Runner')
        ->name('balance.update');
});
