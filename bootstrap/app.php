<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',          // falls nicht vorhanden: Zeile auskommentieren
        commands: __DIR__.'/../routes/console.php', // lege eine leere Datei an, wenn nötig
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Inertia (Breeze) – nur ergänzen, falls nicht schon im Web-Stack
        $middleware->web(append: [
            \App\Http\Middleware\HandleInertiaRequests::class,
        ]);

        // === Spatie-Permission Aliasse (robust für beide Namensräume) ===
        $roleClass = class_exists(\Spatie\Permission\Middlewares\RoleMiddleware::class)
            ? \Spatie\Permission\Middlewares\RoleMiddleware::class
            : (class_exists(\Spatie\Permission\Middleware\RoleMiddleware::class)
                ? \Spatie\Permission\Middleware\RoleMiddleware::class
                : null);

        $permClass = class_exists(\Spatie\Permission\Middlewares\PermissionMiddleware::class)
            ? \Spatie\Permission\Middlewares\PermissionMiddleware::class
            : (class_exists(\Spatie\Permission\Middleware\PermissionMiddleware::class)
                ? \Spatie\Permission\Middleware\PermissionMiddleware::class
                : null);

        $ropClass = class_exists(\Spatie\Permission\Middlewares\RoleOrPermissionMiddleware::class)
            ? \Spatie\Permission\Middlewares\RoleOrPermissionMiddleware::class
            : (class_exists(\Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class)
                ? \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class
                : null);

        $aliases = [
            'invite_token' => \App\Http\Middleware\EnsureValidInviteToken::class,
        ];
        if ($roleClass) $aliases['role'] = $roleClass;
        if ($permClass) $aliases['permission'] = $permClass;
        if ($ropClass)  $aliases['role_or_permission'] = $ropClass;

        $middleware->alias($aliases);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })
    ->create();
