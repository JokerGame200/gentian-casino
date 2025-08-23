<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\User;

class AdminController extends Controller
{
    public function index()
    {
        $users = User::with(['runner:id,username', 'roles:id,name'])
            ->select('id','username','balance','runner_id')
            ->orderBy('id','desc')
            ->paginate(25)
            ->through(fn($u) => [
                'id'       => $u->id,
                'username' => $u->username,
                'balance'  => $u->balance,
                'runner_id'=> $u->runner_id,
                'runner'   => $u->runner ? ['id'=>$u->runner->id,'username'=>$u->runner->username] : null,
                'role'     => $u->getRoleNames()->first() ?? 'User',
            ]);

        $runners = User::role('Runner')
            ->select('id','username')
            ->orderBy('username')
            ->get();

        return Inertia::render('Admin/UsersPage', [
            'users'   => $users,
            'runners' => $runners,
        ]);
    }

    public function assignRunner(User $user, Request $request)
    {
        $request->validate(['runner_id' => 'nullable|exists:users,id']);
        $runner = $request->runner_id ? User::findOrFail($request->runner_id) : null;

        if ($runner && ! $runner->hasRole('Runner')) {
            return back()->withErrors(['runner_id' => 'Ausgewählte Person ist kein Runner.']);
        }

        $user->runner_id = $runner?->id;
        $user->save();

        return back()->with('success','Runner-Zuweisung gespeichert.');
    }
    // AdminController.php
    public function updateRole(Request $request, User $user)
    {
        $request->validate(['role' => 'required|in:User,Runner']);

        // Eigene Rolle nicht verändern & Admin nicht „wegnehmen“
        if ($user->id === auth()->id()) {
            return back()->withErrors(['role' => 'Eigene Rolle kann nicht geändert werden.']);
        }
        if ($user->hasRole('Admin')) {
            return back()->withErrors(['role' => 'Admin-Rollen werden hier nicht geändert.']);
        }

        $user->syncRoles([$request->role]);

        // Wenn zu Runner gewechselt wird, runner_id leeren (optional, je nach Logik)
        if ($request->role === 'Runner') {
            $user->runner_id = null;
            $user->save();
        }

        return back()->with('success', 'Rolle aktualisiert.');
    }



}

