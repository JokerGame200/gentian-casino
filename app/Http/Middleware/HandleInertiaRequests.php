<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;
use Illuminate\Support\Facades\Auth;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }


    public function share($request): array
    {
        return array_merge(parent::share($request), [
            'auth' => [
                'user' => fn () => Auth::user() ? [
                    'id'       => Auth::user()->id,
                    'username' => Auth::user()->username,
                    'roles'    => Auth::user()->getRoleNames(), // Collection -> Frontend
                ] : null
            ],
            'flash' => [
                'success'     => fn() => session('success'),
                'error'       => fn() => session('error'),
                'invite_link' => fn() => session('invite_link'),
            ],
        ]);
    }

}
