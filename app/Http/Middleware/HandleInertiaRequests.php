<?php

namespace App\Http\Middleware;

use App\Models\GameSession;
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
        // Parent-Anteile (ziggy, errors, etc.)
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

            // Fallback: einzelne role-Spalte direkt am User
            if (!empty($user->role)) {
                $role = $user->role;
            }

            // Wenn keine Einzelrolle, nimm erste Spatie-Rolle
            if (!$role && !empty($roles)) {
                $role = $roles[0];
            }

            $hasOpenGame = GameSession::query()
                ->where('user_id', $user->id)
                ->whereIn('status', ['open', 'opening'])
                ->whereNull('closed_at')
                ->exists();

            $activityCutoff = now()->subMinutes(2);
            $isLobby = !$hasOpenGame && $user->last_seen_at && $user->last_seen_at->greaterThan($activityCutoff);
            $presence = $hasOpenGame ? 'playing' : ($isLobby ? 'lobby' : 'offline');
        }

        $lowerRoles = array_map('strtolower', $roles);
        $roleLower  = strtolower((string) $role);

        $isAdmin  = in_array('admin', $lowerRoles, true) || $roleLower === 'admin' || $roleLower === 'administrator';
        $isRunner = in_array('runner', $lowerRoles, true) || $roleLower === 'runner';

        // Avatar-URL bestimmen: hochgeladenes Bild -> Platzhalter -> Data-URI
        $avatarUrl = null;
        if ($user) {
            // 1) eigenes Bild im "public"-Disk?
            if (!empty($user->avatar_path) && Storage::disk('public')->exists($user->avatar_path)) {
                $avatarUrl = Storage::disk('public')->url($user->avatar_path);
                $avatarUrl = $this->forceHttps($avatarUrl);
            }

            // 2) Platzhalter-Route (absolute URL)
            if (!$avatarUrl && Route::has('avatar.placeholder')) {
                $tmp = route('avatar.placeholder', [
                    'name' => $user->name ?: 'User',
                    's'    => 128,
                ], true); // absolute URL
                $avatarUrl = $this->forceHttps($tmp);
            }

            // 3) Fallback: Data-URI (SVG mit Initiale)
            if (!$avatarUrl) {
                $initial  = mb_strtoupper(mb_substr($user->name ?: 'U', 0, 1, 'UTF-8'), 'UTF-8');
                $size     = 128;
                $radius   = (int) floor($size / 2);
                $fontSize = (int) round($size * 0.42);
                $bg       = '#111827'; // gray-900
                $fg       = '#F59E0B'; // amber-500
                $safe     = htmlspecialchars($initial, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

                // sprintf statt Heredoc (vermeidet Parser-Fallen)
                $svg = sprintf(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' .
                    '<rect width="100%%" height="100%%" fill="%s" rx="%d" ry="%d"/>' .
                    '<text x="50%%" y="50%%" dominant-baseline="middle" text-anchor="middle" ' .
                    'font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, \'Helvetica Neue\', Arial, \'Noto Sans\'" ' .
                    'font-size="%d" fill="%s">%s</text></svg>',
                    $size, $size, $size, $size, $bg, $radius, $radius, $fontSize, $fg, $safe
                );

                $avatarUrl = 'data:image/svg+xml;charset=UTF-8,' . rawurlencode($svg);
            }
        }

        // auth.user Props für Frontend
        $auth = $parent['auth'] ?? [];
        $auth['user'] = $user ? [
            'id'                => $user->id,
            'name'              => $user->name,
            'email'             => $user->email ?? null,
            'username'          => $user->username ?? null,
            'balance'           => $user->balance ?? 0,
            'currency'          => $user->currency ?? 'EUR',
            'profile_photo_url' => $avatarUrl, // Breeze-Kompatibilität
            'avatar_url'        => $avatarUrl,
            'role'              => $role,      // 'admin' | 'runner' | 'user'
            'roles'             => $roles,     // Spatie-Rollenliste
            'is_admin'          => $isAdmin,
            'is_runner'         => $isRunner,
            'is_playing'        => $hasOpenGame ?? false,
            'presence'          => $presence   ?? 'offline',
            'last_seen_at'      => optional($user->last_seen_at)->toIso8601String(),
        ] : null;

        // Flash-Messages (+ Invite-URL) lazy (Closures)
        $flash = array_merge($parent['flash'] ?? [], [
            'success'    => fn () => $request->session()->get('success'),
            'error'      => fn () => $request->session()->get('error'),
            'invite_url' => fn () => $request->session()->get('invite_url'),
        ]);

        return array_merge($parent, [
            'auth'  => $auth,
            'flash' => $flash,
        ]);
    }

    /**
     * Erzwinge https in absoluten URLs (gegen Mixed Content).
     */
    private function forceHttps(?string $url): ?string
    {
        if (!$url) {
            return $url;
        }
        // Nur Schema tauschen, Rest unangetastet lassen
        return preg_replace('#^http://#i', 'https://', $url);
    }
}
