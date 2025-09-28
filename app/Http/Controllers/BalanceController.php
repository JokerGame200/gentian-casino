<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\BalanceLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class BalanceController extends Controller
{
    /**
     * GET /api/balance/me  (optional in deiner web.php)
     */
    public function me(Request $request)
    {
        $user = Auth::user();
        return response()->json([
            'id'      => $user->id,
            'balance' => (float) ($user->balance ?? 0),
        ]);
    }

    /**
     * POST balance.update => /users/{user}/balance
     * Setzt 'kind' + 'created_at', damit Deposits/GGR-Auswertung funktioniert.
     */
    public function store(User $user, Request $request)
    {
        $data = $request->validate([
            'amount' => 'required|numeric',
        ]);

        $amount = (float) $data['amount'];
        $actor  = Auth::user();

        DB::transaction(function () use ($user, $amount, $actor) {
            $user->balance = (float) ($user->balance ?? 0) + $amount;
            $user->save();

            $log = new BalanceLog([
                'from_user_id' => optional($actor)->id,
                'to_user_id'   => $user->id,
                'amount'       => $amount,
                'kind'         => $amount >= 0 ? 'deposit' : 'withdrawal',
            ]);
            $log->created_at = now();
            $log->save();
        });

        return back()->with('success', 'Balance aktualisiert.');
    }

    /**
     * Logs-Seite (Admin/Runner) – deine bestehende Ansicht
     * Optional; wenn du schon eine eigene Implementierung hast, lass diese Methode so wie sie ist.
     */
    public function index(Request $request)
    {
        $auth = Auth::user();

        $query = BalanceLog::with([
                'fromUser:id,username',
                'toUser:id,username',
            ])
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($auth && method_exists($auth, 'hasRole') && $auth->hasRole('Runner')) {
            if (method_exists($auth, 'assignedUsers')) {
                $ids = $auth->assignedUsers()->pluck('id')->push($auth->id)->unique()->values();
                $query->where(function ($w) use ($ids) {
                    $w->whereIn('from_user_id', $ids)->orWhereIn('to_user_id', $ids);
                });
            } else {
                $query->where(function ($w) use ($auth) {
                    $w->where('from_user_id', $auth->id)->orWhere('to_user_id', $auth->id);
                });
            }
        }

        $logs = $query->paginate(50)->withQueryString();

        // Passe den View-Namen an deine bestehende Logs-Seite an (z.B. 'Admin/LogsPage')
        return Inertia::render('Admin/LogsPage', [
            'logs' => $logs->through(function (BalanceLog $l) {
                return [
                    'id'         => $l->id,
                    'created_at' => optional($l->created_at)->toIso8601String() ?? (string) $l->created_at,
                    'amount'     => (float) $l->amount,
                    'from_user'  => ['id' => $l->from_user_id, 'username' => optional($l->fromUser)->username],
                    'to_user'    => ['id' => $l->to_user_id,   'username' => optional($l->toUser)->username],
                ];
            }),
        ]);
    }
}
