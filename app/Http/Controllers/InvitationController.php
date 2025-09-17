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
    public function __construct()
    {
        // Nur Admins dürfen Invites erzeugen; Show/Register bleiben öffentlich
        $this->middleware(['auth','role:Admin'])->only(['create']);
    }

    // Formular für Registrierung per Token
    public function showRegistrationForm(string $token)
    {
        $invite = Invitation::where('token',$token)->firstOrFail();
        if ($invite->used_at) {
            return redirect()->route('login')->with('error','Einladungslink bereits verwendet.');
        }

        return Inertia::render('Auth/RegisterByInvite', [
            'token' => $invite->token,
            'role'  => $invite->role ?? 'User',
        ]);
    }

    // Registrierung über Invite
    public function register(Request $request, string $token)
    {
        $invite = Invitation::where('token', $token)->firstOrFail();

        $data = $request->validate([
            'username' => 'required|string|min:3|max:30|unique:users,username',
            'password' => 'required|string|min:8|confirmed',
        ]);

        // User anlegen
        $user = User::create([
            'username'  => $data['username'],
            'name'      => $data['username'], // wichtig, falls users.name NOT NULL
            'password'  => Hash::make($data['password']),
            // Bei User-Invites Runner-Zuordnung übernehmen; bei Runner-Invites NULL
            'runner_id' => ($invite->role === 'User') ? $invite->runner_id : null,
        ]);

        // Rolle aus Invite setzen (Default: User)
        $role = $invite->role ?: 'User';
        $user->assignRole($role);

        // Invite verbrauchen
        $invite->update(['used_at' => now()]);

        // einloggen & redirect
        Auth::login($user);

        return $user->hasRole('Runner')
            ? redirect()->route('runner.users')->with('success', 'Willkommen! Hier sind deine zugewiesenen Nutzer.')
            : redirect()->route('dashboard')->with('success', 'Registrierung erfolgreich.');
    }



        // Invite erzeugen (Admin & Runner)
    public function create(Request $request)
    {
        // Defense in depth – zusätzlich zur Middleware
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
        ]);

        return back()
            ->with('invite_link', url('/invite/'.$invite->token))
            ->with('success', 'Invite-Link erstellt.');
    }
    
}
