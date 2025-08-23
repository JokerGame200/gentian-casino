<?php

namespace App\Providers;

use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Gate;
use App\Models\User;

class AuthServiceProvider extends ServiceProvider
{
    protected $policies = [];

    public function boot(): void
    {
        Gate::define('manage-user-balance', function(User $actor, User $target){
            if ($actor->hasRole('Admin')) return true;
            if ($actor->hasRole('Runner') && $target->runner_id === $actor->id) return true;
            return false;
        });
    }
}

