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

    public function update(Request $request, User $user)
    {
        $actor = Auth::user();

        $data = $request->validate([
            'amount' => ['required','numeric'],
        ]);

        $amount = round((float) $data['amount'], 2);

        // ==== Runner erkennen (Spatie ODER role-Spalte) ====
        $isRunner = (method_exists($actor, 'hasRole') && $actor->hasRole('Runner'))
                || (($actor->role ?? null) === 'Runner');

        if ($isRunner) {
            // nur zugewiesene User
            if ((int)($user->runner_id ?? 0) !== (int)$actor->id) {
                return back()->with('error', 'Dieser User ist dir nicht zugewiesen.');
            }
            // nur gutschreiben
            if ($amount <= 0) {
                return back()->with('error', 'Runner dürfen hier nur Guthaben hinzufügen (positiver Betrag).');
            }

            $perUserLimit = (float)($actor->runner_per_user_limit ?? 500);
            $dailyLimit   = (float)($actor->runner_daily_limit ?? 1000);

            $todayStart = now()->startOfDay();

            $givenTodayTotal = (float) \App\Models\BalanceLog::query()
                ->where('from_user_id', $actor->id)
                ->where('created_at', '>=', $todayStart)
                ->where('amount', '>', 0)
                ->sum('amount');

            $givenTodayToThisUser = (float) \App\Models\BalanceLog::query()
                ->where('from_user_id', $actor->id)
                ->where('to_user_id', $user->id)
                ->where('created_at', '>=', $todayStart)
                ->where('amount', '>', 0)
                ->sum('amount');

            $remainingDay     = max(0, $dailyLimit - $givenTodayTotal);
            $remainingPerUser = max(0, $perUserLimit - $givenTodayToThisUser);
            $maxAllowed       = min($remainingDay, $remainingPerUser);

            if ($remainingDay <= 0) {
                return back()->with('error', 'Tageslimit erreicht.');
            }
            if ($remainingPerUser <= 0) {
                return back()->with('error', 'User-Tageslimit erreicht.');
            }
            if ($amount > $maxAllowed + 1e-6) {
                return back()->with('error', 'Maximal heute noch zulässig: ' . number_format($maxAllowed, 2, ',', '.') . ' €.');
            }
        }

        DB::transaction(function () use ($actor, $user, $amount) {
            $user->increment('balance', $amount);

            \App\Models\BalanceLog::create([
                'from_user_id' => $actor->id,
                'to_user_id'   => $user->id,
                'amount'       => $amount,
                // WICHTIG, weil $timestamps=false im Model:
                'created_at'   => now(),
                // optional: 'kind' => 'runner_topup',
            ]);
        });

        return back()->with('success', 'Balance aktualisiert.');
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
