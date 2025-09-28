<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class InvitationController extends Controller
{
    /**
     * Registrierungsformular über Invite-Token anzeigen.
     * Zeigt eine einfache HTML-Seite, wenn der Token ungültig/abgelaufen/benutzt ist.
     */
    public function showRegistrationForm(string $token)
    {
        $invite = Invitation::where('token', $token)->first();

        if (!$invite || $this->isInviteInvalid($invite)) {
            return $this->expiredPage();
        }

        return Inertia::render('Auth/RegisterByInvite', [
            'token' => $invite->token,
            'role'  => $invite->role ?? 'User',
        ]);
    }

    /**
     * Registrierung mit Invite durchführen (nur Username + Passwort).
     * Markiert den Invite als verbraucht und loggt den User ein.
     */
    public function register(Request $request, string $token)
    {
        $invite = Invitation::where('token', $token)->first();

        if (!$invite || $this->isInviteInvalid($invite)) {
            return $this->expiredPage();
        }

        $data = $request->validate([
            'username' => 'required|string|min:3|max:30|unique:users,username',
            'password' => 'required|string|min:8|confirmed',
        ]);

        // User anlegen
        $user = User::create([
            'username'  => $data['username'],
            'name'      => $data['username'], // falls users.name NOT NULL ist
            'password'  => Hash::make($data['password']),
            // Bei User-Invites Runner-Zuordnung übernehmen; bei Runner-Invites NULL
            'runner_id' => ($invite->role === 'User') ? $invite->runner_id : null,
        ]);

        // Rolle aus Invite setzen (Default: User)
        $role = $invite->role ?: 'User';
        $user->assignRole($role);

        // Invite verbrauchen
        $invite->update(['used_at' => now()]);

        // Einloggen & Redirect
        Auth::login($user);

        return $user->hasRole('Runner')
            ? redirect()->route('runner.users')->with('success', 'Willkommen! Hier sind deine zugewiesenen Nutzer.')
            : redirect()->route('dashboard')->with('success', 'Registrierung erfolgreich.');
    }

    /**
     * Invite erzeugen (Admin-Action).
     * Flasht invite_url, damit der Link unter dem Formular angezeigt werden kann.
     */
    public function create(Request $request)
    {
        // Defense-in-depth zusätzlich zur Route/Middleware
        abort_unless(auth()->user()?->hasRole('Admin'), 403);

        $data = $request->validate([
            'role' => 'required|in:User,Runner',
            'runner_id' => 'nullable|integer|exists:users,id',
        ]);

        // Nur bei User-Invites eine Runner-Zuordnung mitschicken
        $runnerIdForInvite = $data['role'] === 'User'
            ? ($data['runner_id'] ?? null)
            : null;

        $invite = Invitation::create([
            'token'      => Str::random(48),
            'created_by' => auth()->id(),
            'runner_id'  => $runnerIdForInvite,
            'role'       => $data['role'],
            // Optional: Ablaufdatum setzen, falls gewünscht
            // 'expires_at' => now()->addDays(7),
        ]);

        $url = route('invite.show', ['token' => $invite->token]);

        return back()
            ->with('invite_url', $url) // <- wichtig für die Anzeige unter dem Formular
            ->with('success', 'Invite-Link erstellt.');
    }

    /**
     * Prüft, ob der Invite ungültig ist (benutzt oder abgelaufen).
     */
    protected function isInviteInvalid(Invitation $invite): bool
    {
        if ($invite->used_at) return true;
        // expires_at ist optional – nur prüfen, wenn vorhanden
        if (!empty($invite->expires_at) && now()->greaterThan($invite->expires_at)) return true;
        return false;
        }

    /**
     * Minimalistische HTML-Seite für ungültige/abgelaufene Einladungen (HTTP 410).
     */
    protected function expiredPage()
    {
        $login = route('login');
        $html = <<<HTML
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Invite abgelaufen</title>
  <style>
    body{background:#0b1b2b;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
    .card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:24px;max-width:520px;text-align:center}
    .card h1{font-size:22px;margin:0 0 8px}
    .card p{color:#cbd5e1;margin:0 0 16px}
    .btn{display:inline-block;padding:10px 14px;border-radius:10px;background:#22d3ee;color:#000;text-decoration:none;font-weight:600}
  </style>
</head>
<body>
  <div class="card">
    <h1>Dieser Einladungslink ist ungültig oder abgelaufen</h1>
    <p>Bitte fordere einen neuen Link beim Administrator an.</p>
    <a class="btn" href="{$login}">Zur Anmeldung</a>
  </div>
</body>
</html>
HTML;

        return response($html, 410)->header('Content-Type', 'text/html; charset=UTF-8');
    }
}
