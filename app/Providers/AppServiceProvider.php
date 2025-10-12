<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        // In Produktion Links/Redirects auf HTTPS zwingen (Cloudflare/Proxy)
        if (config('app.env') === 'production') {
            URL::forceScheme('https');
        }

        // Throttle-Limiter "api" für throttle:api
        RateLimiter::for('api', function (Request $request) {
            return [
                // z.B. 120 req/min pro User-ID oder IP
                Limit::perMinute(120)->by(optional($request->user())->id ?: $request->ip()),
            ];
        });
    }
}
