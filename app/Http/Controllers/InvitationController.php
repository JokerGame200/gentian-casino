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
        $invite = Invitation::where('token',$token)->firstOrFail();
        abort_if($invite->used_at, 410, 'Invite bereits verwendet.');

        $data = $request->validate([
            'username' => 'required|string|min:3|max:30|unique:users,username',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = User::create([
            'username'  => $data['username'],
            'password'  => Hash::make($data['password']),
            'runner_id' => ($invite->role === 'User') ? $invite->runner_id : null,
        ]);

        $user->assignRole($invite->role ?? 'User');

        $invite->used_at = now();
        $invite->save();

        Auth::login($user);
        return redirect()->route('dashboard')->with('success','Konto erstellt.');
    }

    // Invite erzeugen (Admin & Runner)
    public function create(Request $request)
    {
        $data = $request->validate([
            'role'      => 'required|in:User,Runner',
            'runner_id' => 'nullable|exists:users,id',
        ]);

        // Runner dürfen nur User-Einladungen erstellen
        if (auth()->user()->hasRole('Runner') && $data['role'] !== 'User') {
            return back()->withErrors(['role' => 'Runner dürfen nur User-Einladungen erstellen.']);
        }

        // Falls runner_id gesetzt: muss wirklich ein Runner sein
        $runnerId = $data['runner_id'] ?? null;
        if ($runnerId) {
            $runner = User::findOrFail($runnerId);
            if (! $runner->hasRole('Runner')) {
                return back()->withErrors(['runner_id' => 'Ausgewählte Person ist kein Runner.']);
            }
        }

        // Runner-Invite hat nie runner_id; User-Invite kann optional eine runner_id haben
        $runnerIdForInvite = $data['role'] === 'User'
            ? ($runnerId ?? (auth()->user()->hasRole('Runner') ? auth()->id() : null))
            : null;

        $invite = Invitation::create([
            'token'      => Str::random(48),
            'created_by' => auth()->id(),
            'runner_id'  => $runnerIdForInvite,
            'role'       => $data['role'],
        ]);

        return back()
            ->with('invite_link', url('/invite/'.$invite->token))
            ->with('success','Invite-Link erstellt.');
    }
}
