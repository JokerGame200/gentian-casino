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
        $activityCutoff = now()->subMinutes(2);

        // Users-Tabelle für den Runner (paginiert für die Tabelle)
        $users = User::query()
            ->where('runner_id', $me->id)
            ->select('id','username','name','balance','runner_id','last_seen_at')
            ->withPresence()
            ->orderByDesc('id')
            ->paginate(25)
            ->through(function (User $u) use ($activityCutoff) {
                $isPlaying = (bool) $u->is_playing;
                $isLobby = !$isPlaying && $u->last_seen_at && $u->last_seen_at->greaterThan($activityCutoff);
                $presence = $isPlaying ? 'playing' : ($isLobby ? 'lobby' : 'offline');

                return [
                    'id'           => $u->id,
                    'username'     => $u->username,
                    'name'         => $u->name,
                    'balance'      => (float) ($u->balance ?? 0),
                    'runner_id'    => $u->runner_id,
                    'last_seen_at' => optional($u->last_seen_at)->toIso8601String(),
                    'is_playing'   => $isPlaying,
                    'presence'     => $presence,
                ];
            })
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
