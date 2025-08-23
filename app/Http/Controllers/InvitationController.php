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
    // Gäste: Formular zur Registrierung mit Token anzeigen
    public function showRegistrationForm(string $token)
    {
        return Inertia::render('Auth/RegisterInvite', ['token' => $token]);
    }

    // Gäste: Registrierung durchführen (One-Time)
    public function register(string $token, Request $request)
    {
        $data = $request->validate([
            'username' => 'required|string|max:50|unique:users,username',
            'password' => 'required|string|min:6|confirmed',
        ]);

        $invite = Invitation::where('token',$token)->firstOrFail();
        if ($invite->used_at) abort(410,'Link wurde bereits verwendet.');

        $user = User::create([
            'username'  => $data['username'],
            'password'  => Hash::make($data['password']),
            'balance'   => 0,
            'runner_id' => $invite->runner_id,
            'email'     => null,
            'name'      => $data['username'],
        ]);
        $user->assignRole('User');

        $invite->used_at = now();
        $invite->save();

        Auth::login($user);
        return redirect()->route('dashboard');
    }

    // Admin/Runner: Einladungslink erzeugen
    public function create(Request $request)
    {
        $request->validate([
            'runner_id' => 'nullable|exists:users,id'
        ]);

        $token = Str::random(48);

        $invite = Invitation::create([
            'token'      => $token,
            'created_by' => auth()->id(),
            'runner_id'  => $request->runner_id
                ?? (auth()->user()->hasRole('Runner') ? auth()->id() : null),
        ]);

        return back()->with('invite_link', url('/invite/'.$invite->token));
    }
}

