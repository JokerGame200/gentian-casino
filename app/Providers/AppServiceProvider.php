<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\Facades\Gate;
use App\Models\User;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // In Production absolute HTTPS-Links erzwingen
        if (config('app.env') === 'production') {
            if (config('app.url')) {
                URL::forceRootUrl(config('app.url')); // z. B. https://play4.cash
            }
            URL::forceScheme('https');
        }

        // Vite: Prefetch parallelisieren (optional)
        Vite::prefetch(concurrency: 3);

        /**
         * Gate: Darf $actor das Guthaben von $target managen?
         * - Admin: immer ja
         * - Runner: nur für seine zugewiesenen User (target.runner_id === actor.id)
         */
        Gate::define('manage-user-balance', function (User $actor, User $target) {
            // Spatie-Rollen robust & case-insensitiv prüfen
            $roleNames = method_exists($actor, 'getRoleNames')
                ? array_map('strtolower', $actor->getRoleNames()->all())
                : [];

            $singleRole = property_exists($actor, 'role') ? strtolower((string) $actor->role) : null;

            $isAdmin  = in_array('admin', $roleNames, true) || $singleRole === 'admin';
            $isRunner = in_array('runner', $roleNames, true) || $singleRole === 'runner';

            if ($isAdmin) {
                return true;
            }

            if ($isRunner) {
                return (int) ($target->runner_id ?? 0) === (int) $actor->id;
            }

            return false;
        });
    }
}
