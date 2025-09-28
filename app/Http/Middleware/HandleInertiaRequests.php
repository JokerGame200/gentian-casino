<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        return array_merge(parent::share($request), [
            'auth' => [
                'user' => function () use ($request) {
                    $u = $request->user();
                    if (!$u) return null;

                    return [
                        'id'         => $u->id,
                        'name'       => $u->name,
                        'username'   => $u->username ?? null,
                        'role'       => $u->role ?? null,
                        'runner_id'  => $u->runner_id ?? null,
                        'balance'    => $u->balance ?? 0,
                        'currency'   => $u->currency ?? 'EUR',
                        'avatar_url' => $u->avatar_url, // Datei-URL oder Initialen-SVG
                    ];
                },
            ],

            'flash' => [
                'status'  => fn () => session('status'),
                'success' => fn () => session('success'),
                'error'   => fn () => session('error'),
            ],

            // Invite-Kontext (ohne E-Mail)
            'invite' => function () use ($request) {
                $token  = $request->route('token');
                $invite = $request->attributes->get('invite'); // von invite_token Middleware

                if (!$token && !$invite) return null;

                return [
                    'token'      => $token,
                    'role'       => $invite->role       ?? ($invite['role']       ?? null),
                    'expires_at' => $invite->expires_at ?? ($invite['expires_at'] ?? null),
                    'used'       => $invite->used       ?? ($invite['used']       ?? false),
                    'is_valid'   => $invite->is_valid   ?? ($invite['is_valid']   ?? true),
                    'message'    => session('invite_message'),
                ];
            },
        ]);
    }
}
