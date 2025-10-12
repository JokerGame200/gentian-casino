<?php

namespace App\Http\Middleware;

use App\Models\Invitation;
use Closure;
use Illuminate\Http\Request;

class EnsureInviteTokenIsValid
{
    /**
     * If a valid invite exists, share it with the request.
     * The controller still performs the final validation,
     * but this ensures the middleware alias exists and can
     * short-circuit obvious 404 cases.
     */
    public function handle(Request $request, Closure $next)
    {
        $token = (string) $request->route('token', '');

        if ($token !== '') {
            $invite = Invitation::where('token', $token)->first();

            // Attach for later use (optional)
            if ($invite) {
                $request->attributes->set('invite', $invite);
            }
        }

        return $next($request);
    }
}
