<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class UpdateLastSeen
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        $user = $request->user();
        if (!$user) {
            return $response;
        }

        static $columnExists = null;
        if ($columnExists === null) {
            $columnExists = Schema::hasColumn($user->getTable(), 'last_seen_at');
        }

        if (!$columnExists) {
            return $response;
        }

        $lastSeen = $user->last_seen_at;
        $now = now();

        if (!$lastSeen || $now->diffInSeconds($lastSeen) >= 60) {
            $user->forceFill(['last_seen_at' => $now])->saveQuietly();
        }

        return $response;
    }
}
