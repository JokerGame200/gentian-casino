<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        /**
         * Globale Middlewares (für jede Anfrage).
         * (Diese beiden sind idempotent – doppelt schadet nicht,
         *  aber wir hängen sie hier einmal zentral ein.)
         */
        $middleware->append(\App\Http\Middleware\TrustProxies::class);
        $middleware->append(\App\Http\Middleware\TrimStrings::class);
        $middleware->append(\Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull::class);

        /**
         * Middleware-Aliasse (werden in Routes verwendet: auth, verified, throttle:api, usw.)
         */
        $middleware->alias([
            'auth'               => \App\Http\Middleware\Authenticate::class,
            'guest'              => \App\Http\Middleware\RedirectIfAuthenticated::class,
            'verified'           => \Illuminate\Auth\Middleware\EnsureEmailIsVerified::class,
            'password.confirm'   => \Illuminate\Auth\Middleware\RequirePassword::class,
            'signed'             => \App\Http\Middleware\ValidateSignature::class,
            'throttle'           => \Illuminate\Routing\Middleware\ThrottleRequests::class,
            'bindings'           => \Illuminate\Routing\Middleware\SubstituteBindings::class,
            'role'               => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'invite_token'       => \App\Http\Middleware\EnsureInviteTokenIsValid::class,
        ]);

        /**
         * WEB-Gruppe (Blade/Inertia, Session, CSRF, Auth).
         * Wir definieren sie explizit, damit Session & CSRF sicher aktiv sind.
         */
        $middleware->group('web', [
            \Illuminate\Cookie\Middleware\EncryptCookies::class,
            \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
            \Illuminate\Session\Middleware\StartSession::class,
            \Illuminate\View\Middleware\ShareErrorsFromSession::class,

            // Dein CSRF – enthält die /api/*-Ausnahme (siehe unten in VerifyCsrfToken)
            \App\Http\Middleware\VerifyCsrfToken::class,

            // Route Model Binding usw.
            \Illuminate\Routing\Middleware\SubstituteBindings::class,

            // Falls du Inertia verwendest (laravel/breeze + inertia)
            \App\Http\Middleware\HandleInertiaRequests::class,
        ]);

        /**
         * API-Gruppe (stateless). Throttle nutzt deinen in AppServiceProvider registrierten "api"-Limiter.
         */
        $middleware->group('api', [
            'throttle:api',
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
        ]);

        /**
         * Optional (falls du Sanctum-SPA-Cookies für /api nutzt):
         * $middleware->prependToGroup('api', \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class);
         * – Bei dir scheint API aber rein server-to-server zu sein; daher meist NICHT nötig.
         */
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })
    ->create();
