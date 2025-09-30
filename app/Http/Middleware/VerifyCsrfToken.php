<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken as Middleware;

class VerifyCsrfToken extends Middleware
{
    // ...
    protected $except = [
        'api/games/*',   // <— hier eintragen (ohne führenden Slash)
        // 'api/games/*',        // (optional) wenn du alle Games-API-Postings ausnehmen willst
    ];
}
