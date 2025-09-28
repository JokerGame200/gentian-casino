<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Support\Str;

class ProfileController extends Controller
{
    /**
     * Profilseite anzeigen.
     */
    public function edit(Request $request): Response
    {
        // Keine E-Mail-Verifizierung nötig → immer false
        return Inertia::render('Profile/Edit', [
            'mustVerifyEmail' => false,
            'status' => session('status'),
        ]);
    }

    /**
     * Profil aktualisieren (Name + Avatar hochladen/entfernen).
     */
    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name'          => ['required', 'string', 'max:255'],
            'avatar'        => ['nullable', 'image', 'mimes:jpeg,jpg,png,webp', 'max:4096'], // 4 MB
            'remove_avatar' => ['nullable', 'boolean'],
        ]);

        // Avatar entfernen?
        if ($request->boolean('remove_avatar')) {
            if ($user->avatar_path && Storage::disk('public')->exists($user->avatar_path)) {
                Storage::disk('public')->delete($user->avatar_path);
            }
            $user->avatar_path = null;
        }

        // Neuer Avatar hochgeladen?
        if ($request->hasFile('avatar')) {
            // alten (falls vorhanden) löschen
            if ($user->avatar_path) {
                Storage::disk('public')->delete($user->avatar_path);
            }

            $ext  = $request->file('avatar')->extension();
            $name = now()->format('Ymd_His') . '-' . Str::random(8) . '.' . $ext;

            $path = $request->file('avatar')->storeAs(
                "avatars/{$user->id}",
                $name,
                'public' // -> /storage/avatars/{id}/{file}
            );

            $user->avatar_path = $path;
        }

        // Name übernehmen
        $user->name = $validated['name'];
        $user->save();

        return Redirect::route('profile.edit')
            ->with('status', 'profile-updated')
            ->with('success', 'Profil aktualisiert.');
    }

    /**
     * Account löschen.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Redirect::to('/');
    }
}
