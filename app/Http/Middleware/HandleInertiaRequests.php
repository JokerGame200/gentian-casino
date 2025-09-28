<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Route;

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

    /**
     * Define the props that are shared by default.
     */
    public function share(Request $request): array
    {
        // Parent-Anteile holen (beinhaltet z. B. ziggy, errors usw.)
        $parent = parent::share($request);

        $user  = $request->user();
        $roles = [];
        $role  = null;

        if ($user) {
            // Spatie: Rollen-Namen sicher ermitteln
            if (method_exists($user, 'roles')) {
                try {
                    $roles = $user->roles()->pluck('name')->all();
                } catch (\Throwable $e) {
                    $roles = [];
                }
            }

            // Fallback: einzelne role-Spalte direkt am User (z. B. 'admin', 'runner', 'user')
            if (isset($user->role) && $user->role) {
                $role = $user->role;
            }

            // Falls keine einzelne Rolle gesetzt, nimm die erste aus dem Spatie-Array
            if (!$role && !empty($roles)) {
                $role = $roles[0];
            }
        }

        $lowerRoles = array_map('strtolower', $roles);
        $roleLower  = strtolower((string) $role);

        $isAdmin  = in_array('admin', $lowerRoles, true) || $roleLower === 'admin' || $roleLower === 'administrator';
        $isRunner = in_array('runner', $lowerRoles, true) || $roleLower === 'runner';

        // Avatar-URL bestimmen: hochgeladenes Bild -> Platzhalter mit Initialen
        $avatarUrl = null;
        if ($user) {
            if (!empty($user->avatar_path) && Storage::disk('public')->exists($user->avatar_path)) {
                $avatarUrl = Storage::disk('public')->url($user->avatar_path);
            }

            if (!$avatarUrl) {
                if (Route::has('avatar.placeholder')) {
                    // Platzhalter via Controller (empfohlen)
                    $avatarUrl = route('avatar.placeholder', [
                        'name' => $user->name ?: 'User',
                        's'    => 128,
                    ]);
                } else {
                    // Fallback: eingebettetes SVG als Data-URI (mit vorab berechneten Werten)
                    $initial = mb_strtoupper(mb_substr($user->name ?: 'U', 0, 1, 'UTF-8'), 'UTF-8');
                    $size = 128;
                    $radius = (int) floor($size / 2);
                    $fontSize = (int) round($size * 0.42);
                    $bg = '#111827';  // gray-900
                    $fg = '#F59E0B';  // amber-500
                    $safe = htmlspecialchars($initial, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

                    $svg = <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="$size" height="$size" viewBox="0 0 $size $size">
  <rect width="100%" height="100%" fill="$bg" rx="$radius" ry="$radius"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, 'Noto Sans'"
        font-size="$fontSize" fill="$fg">$safe</text>
</svg>
SVG;
                    $avatarUrl = 'data:image/svg+xml;charset=UTF-8,' . rawurlencode($svg);
                }
            }
        }

        // auth.user sauber aufbauen (Front-End liest daraus)
        $auth = $parent['auth'] ?? [];
        $auth['user'] = $user ? [
            'id'                => $user->id,
            'name'              => $user->name,
            'email'             => $user->email,           // kann bei dir null sein
            'username'          => $user->username ?? null,
            'balance'           => $user->balance ?? 0,
            'currency'          => $user->currency ?? 'EUR',
            // Avatar
            'profile_photo_url' => $avatarUrl,             // Breeze-Kompatibilität
            'avatar_url'        => $avatarUrl,
            // Rollen-Infos
            'role'              => $role,                  // z. B. 'admin' | 'runner' | 'user'
            'roles'             => $roles,                 // Spatie-Rollenliste (Strings)
            'is_admin'          => $isAdmin,
            'is_runner'         => $isRunner,
        ] : null;

        // Flash zusammenführen – behält bestehende parent['flash'] bei
        // und erweitert um success/error sowie invite_url (für Invite-Flow)
        $flash = array_merge($parent['flash'] ?? [], [
            'success'    => fn () => $request->session()->get('success'),
            'error'      => fn () => $request->session()->get('error'),
            'invite_url' => fn () => $request->session()->get('invite_url'),
        ]);

        // Alles wieder mit Parent mergen
        return array_merge($parent, [
            'auth'  => $auth,
            'flash' => $flash,
        ]);
    }
}
