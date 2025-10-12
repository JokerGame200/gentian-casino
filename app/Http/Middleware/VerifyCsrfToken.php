<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken as Middleware;

class VerifyCsrfToken extends Middleware
{
    /**
     * Diese URIs sind vom CSRF-Schutz ausgenommen.
     *
     * @var array<int, string>
     */
    protected $except = [
        'api/*',            // alle API-Endpoints stateless
    ];
}
