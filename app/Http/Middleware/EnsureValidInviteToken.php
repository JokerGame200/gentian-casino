<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\Invitation;

class EnsureValidInviteToken
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->route('token');
        $invite = Invitation::where('token',$token)->first();

        if (!$invite || $invite->used_at) {
            return redirect()->route('login')
                ->with('error','Einladungslink ungültig oder bereits verwendet.');
        }
        return $next($request);
    }
}

