<?php

namespace App\Providers;

use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

// ⬇️ Neu:
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
        Vite::prefetch(concurrency: 3);

        // ⬇️ Neu: Balance-Gate
        Gate::define('manage-user-balance', function (User $actor, User $target) {
            if ($actor->hasRole('Admin')) {
                return true;
            }
            if ($actor->hasRole('Runner')) {
                return (int)$target->runner_id === (int)$actor->id;
            }
            return false;
        });
    }
}
