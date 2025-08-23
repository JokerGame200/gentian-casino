<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use App\Models\User;

class RunnerController extends Controller
{
    public function index()
    {
        $me = auth()->user();
        $users = User::where('runner_id',$me->id)
            ->select('id','username','balance','runner_id')
            ->orderBy('id','desc')->paginate(25);

        return Inertia::render('Runner/UsersPage', ['users'=>$users]);
    }
}

