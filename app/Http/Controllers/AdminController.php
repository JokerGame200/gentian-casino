<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\User;

class AdminController extends Controller
{
    public function index()
    {
        $users = User::with(['runner:id,username'])
            ->select('id','username','balance','runner_id')
            ->orderBy('id','desc')->paginate(25);

        $runners = User::role('Runner')->select('id','username')->get();

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
}

