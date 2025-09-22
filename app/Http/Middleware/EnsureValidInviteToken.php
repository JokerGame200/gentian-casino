<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\Invitation;

class EnsureValidInviteToken
{
    public function handle($request, \Closure $next)
    {
        $token  = $request->route('token');
        $invite = \App\Models\Invitation::where('token', $token)->first();

        if (! $invite) {
            // optional eigene 404-Seite:
            return response()->file(public_path('invite-expired.html'))->setStatusCode(404);
        }

        $expired = !empty($invite->expires_at) && now()->greaterThan($invite->expires_at);
        if ($invite->used_at || $expired) {
            return response()->file(public_path('invite-expired.html'))->setStatusCode(410);
        }

        // optional fürs Controller-Handling
        $request->attributes->set('invite', $invite);

        return $next($request);
    }

}
