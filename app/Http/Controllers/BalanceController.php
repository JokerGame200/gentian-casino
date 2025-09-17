<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use App\Models\User;
use App\Models\BalanceLog;

class BalanceController extends Controller
{
    /**
     * Guthaben eines Users anpassen.
     * - Admin: darf + und - (Betrag ≠ 0)
     * - Runner: darf NUR + (Betrag > 0) und nur bei seinen zugewiesenen Nutzern
     */
    public function store(Request $request, User $user)
    {
        $actor = $request->user();

        // 1) Zugriff prüfen (Admin = alle, Runner = nur eigene runner_id)
        Gate::authorize('manage-user-balance', $user);

        // 2) Validierung: Runner nur > 0, Admin jede Zahl ≠ 0
        $rules = ['amount' => ['required', 'numeric']];
        if ($actor->hasRole('Runner')) {
            $rules['amount'][] = 'gt:0';
        }
        $data = $request->validate($rules);

        $amount = (float) $data['amount'];
        if (!$actor->hasRole('Runner') && $amount == 0.0) {
            return back()->withErrors(['amount' => 'Betrag darf nicht 0 sein.']);
        }

        // 3) Änderung + Log in einer Transaktion
        DB::transaction(function () use ($actor, $user, $amount) {
            $user->balance = ($user->balance ?? 0) + $amount;
            $user->save();

            BalanceLog::create([
                'from_user_id' => $actor->id,
                'to_user_id'   => $user->id,
                'amount'       => $amount, // negativ = Abzug (nur Admin möglich)
            ]);
        });

        return back()->with('success', 'Guthaben aktualisiert.');
    }

    /**
     * (Optional) Logs-Übersicht für Admin/Runner.
     * Runner sieht nur Logs seiner zugewiesenen Nutzer.
     * Passe den Inertia-View-Namen bei Bedarf an.
     */
    public function logs(Request $request)
    {
        $actor = $request->user();

        // Admin & Runner dürfen rein; andere nicht
        if (! $actor->hasRole('Admin') && ! $actor->hasRole('Runner')) {
            abort(403);
        }

        $q = BalanceLog::query()->with([
            'fromUser:id,username',
            'toUser:id,username,runner_id',
        ]);

        if ($actor->hasRole('Runner')) {
            $q->whereHas('toUser', fn ($qq) => $qq->where('runner_id', $actor->id));
        }

        $logs = $q->latest('created_at')->paginate(25);

        return inertia('AdminOrRunner/LogsPage', ['logs' => $logs]);
    }
}
