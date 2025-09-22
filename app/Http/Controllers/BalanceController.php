<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use App\Models\User;
use App\Models\BalanceLog;

class BalanceController extends Controller
{

    public function me(Request $request)
    {
        return response()->json([
            'balance'    => (float) ($request->user()->balance ?? 0),
            'updated_at' => now()->toIso8601String(),
        ]);
    }

    public function index(\Illuminate\Http\Request $request)
    {
        // damit funktionieren bestehende Routen weiter
        return $this->logs($request);
    }

    /**
     * Guthaben eines Users anpassen.
     * - Admin: darf + und - (Betrag ≠ 0)
     * - Runner: darf NUR + (Betrag > 0) und nur bei seinen zugewiesenen Nutzern
     */
    public function store(Request $request, User $user)
    {
        $actor = $request->user();

        // Admin = alle, Runner = nur eigene Nutzer
        Gate::authorize('manage-user-balance', $user);

        // Validation: Runner >0 und ≤500; Admin ≠0
        $rules = ['amount' => ['required','numeric']];
        if ($actor->hasRole('Runner')) {
            $rules['amount'][] = 'gt:0';
            $rules['amount'][] = 'lte:500'; // pro Vorgang max. 500
        }
        $data = $request->validate($rules, [
            'amount.gt'  => 'Der Betrag muss größer als 0 sein.',
            'amount.lte' => 'Runner dürfen pro Vorgang maximal 500,00 € gutschreiben.',
        ]);

        $amount = round((float) $data['amount'], 2);

        if (!$actor->hasRole('Runner') && $amount == 0.0) {
            return back()->withErrors(['amount' => 'Betrag darf nicht 0 sein.']);
        }

        DB::transaction(function () use ($actor, $user, $amount) {
            // Zusätzliche Tageslimits nur für Runner
            if ($actor->hasRole('Runner')) {
                $start = now()->startOfDay();
                $end   = now()->endOfDay();

                // 1) Pro Nutzer pro Tag max. 500 (nur positive Beträge zählen)
                $sumUserToday = BalanceLog::where('from_user_id', $actor->id)
                    ->where('to_user_id', $user->id)
                    ->whereBetween('created_at', [$start, $end])
                    ->where('amount', '>', 0)
                    ->sum('amount');

                if ($sumUserToday + $amount > 1000) {
                    throw ValidationException::withMessages([
                        'amount' => 'Tageslimit 1000,00 € für diesen Nutzer würde überschritten. Heute bereits: ' .
                            number_format($sumUserToday, 2, ',', '.') . ' €.',
                    ]);
                }

                // 2) Gesamt pro Tag max. 1.000 (alle Nutzer)
                $sumRunnerToday = BalanceLog::where('from_user_id', $actor->id)
                    ->whereBetween('created_at', [$start, $end])
                    ->where('amount', '>', 0)
                    ->sum('amount');

                if ($sumRunnerToday + $amount > 1000) {
                    throw ValidationException::withMessages([
                        'amount' => 'Dein Tageslimit (1.000,00 €) würde überschritten. Heute bereits: ' .
                            number_format($sumRunnerToday, 2, ',', '.') . ' €.',
                    ]);
                }
            }

            // Balance anpassen + Log schreiben
            $user->balance = ($user->balance ?? 0) + $amount;
            $user->save();

            BalanceLog::create([
                'from_user_id' => $actor->id,
                'to_user_id'   => $user->id,
                'amount'       => $amount, // Runner: immer >0; Admin: ±
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
