<?php

namespace App\Http\Controllers;

// app/Http/Controllers/RunnerController.php

use Inertia\Inertia;
use App\Models\User;
use App\Models\BalanceLog; // <-- sicherstellen, dass dieses Model existiert (s.u.)

class RunnerController extends Controller
{
    public function index()
    {
        $me = auth()->user();

        // Users-Tabelle für den Runner (paginiert für die Tabelle)
        $users = User::query()
            ->where('runner_id', $me->id)
            ->select('id','username','name','balance','runner_id')
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString();

        // Alle zugewiesenen User-IDs (nicht paginiert!) – für zuverlässiges Log-Scoping
        $assignedIds = User::where('runner_id', $me->id)->pluck('id');

        // Logs: nur Einträge, bei denen from/to zu einem zugewiesenen User gehört
        $logs = BalanceLog::query()
            ->with([
                'fromUser:id,username',
                'toUser:id,username',
            ])
            ->where(function ($q) use ($assignedIds) {
                $q->whereIn('from_user_id', $assignedIds)
                  ->orWhereIn('to_user_id', $assignedIds);
            })
            ->latest('id')            // oder ->latest('created_at')
            ->paginate(25)
            ->withQueryString();

        return Inertia::render('Runner/UsersPage', [
            'users'              => $users,
            'logs'               => $logs,
            'assigned_user_ids'  => $assignedIds, // für das Frontend-Filter (nicht paginiert!)
        ]);
    }
}
