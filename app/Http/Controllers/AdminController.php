<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\BalanceLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class AdminController extends Controller
{
    /**
     * Admin: Users-Übersicht + Runners + kompakte KPIs + Logs
     */
    public function index(Request $request)
    {
        // --- Users (mit Limits-Feldern fürs Admin-Panel) ---
        $users = User::query()
            ->with(['runner:id,username', 'roles:id,name'])
            ->select([
                'id',
                'username',
                'name',
                'balance',
                'currency',
                'runner_id',
                'runner_daily_limit',
                'runner_per_user_limit',
            ])
            ->orderByDesc('id')
            ->paginate(25)
            ->through(function (User $u) {
                // Rolle: Spatie zuerst, Fallback auf evtl. role-Spalte
                $role = optional($u->roles->first())->name ?? ($u->role ?? 'User');

                return [
                    'id'                     => $u->id,
                    'username'               => $u->username,
                    'name'                   => $u->name,
                    'balance'                => (float) ($u->balance ?? 0),
                    'currency'               => $u->currency ?? 'EUR',
                    'runner_id'              => $u->runner_id,
                    'role'                   => $role,
                    'runner_daily_limit'     => (float) ($u->runner_daily_limit ?? 1000),
                    'runner_per_user_limit'  => (float) ($u->runner_per_user_limit ?? 500),
                ];
            })
            ->withQueryString();

        // --- Runners (für Zuweisungen & Limits-Editor) ---
        $runners = User::query()
            ->with('roles:id,name')
            ->select(['id', 'username', 'name', 'runner_daily_limit', 'runner_per_user_limit'])
            ->get()
            ->filter(function (User $u) {
                // "Runner" via Spatie oder role-Spalte
                $isRunner = (method_exists($u, 'hasRole') && $u->hasRole('Runner')) || (($u->role ?? null) === 'Runner');
                return $isRunner;
            })
            ->values()
            ->map(function (User $u) {
                return [
                    'id'                    => $u->id,
                    'username'              => $u->username ?? $u->name ?? ('#'.$u->id),
                    'runner_daily_limit'    => (float) ($u->runner_daily_limit ?? 1000),
                    'runner_per_user_limit' => (float) ($u->runner_per_user_limit ?? 500),
                ];
            });

        // --- KPIs (leichtgewichtig) ---
        $stats = [
            'users'          => (int) (User::count()),
            'runners'        => (int) ($runners->count()),
            'deposits_today' => (float) BalanceLog::query()
                                    ->where('amount', '>', 0)
                                    ->where('created_at', '>=', now()->startOfDay())
                                    ->sum('amount'),
            // Optional/Beispiel: negatives als "GGR (today)" interpretieren
            'ggr_today'      => (float) abs(BalanceLog::query()
                                    ->where('amount', '<', 0)
                                    ->where('created_at', '>=', now()->startOfDay())
                                    ->sum('amount')),
        ];

        // --- Logs kompakt (für Tab "Logs" im Admin-Panel) ---
        $logs = BalanceLog::query()
            ->with([
                'fromUser:id,username',
                'toUser:id,username',
            ])
            ->orderByDesc('id')
            ->paginate(25)
            ->through(function (BalanceLog $log) {
                return [
                    'id'         => $log->id,
                    'from_user'  => [
                        'id'       => $log->from_user_id,
                        'username' => optional($log->fromUser)->username,
                    ],
                    'to_user'    => [
                        'id'       => $log->to_user_id,
                        'username' => optional($log->toUser)->username,
                    ],
                    'amount'     => (float) $log->amount,
                    'created_at' => optional($log->created_at)->toIso8601String(),
                ];
            })
            ->withQueryString();

        return Inertia::render('Admin/UsersPage', [
            'users'   => $users,
            'runners' => $runners,
            'stats'   => $stats,
            'logs'    => $logs,
        ]);
    }

    /**
     * Rolle setzen (Spatie + optionale role-Spalte synchron halten).
     */
    public function setRole(Request $request, User $user)
    {
        $data = $request->validate([
            'role' => ['required', Rule::in(['User', 'Runner', 'Admin'])],
        ]);
        $role = $data['role'];

        // Spatie-Rolle(n) setzen (falls installiert)
        if (method_exists($user, 'syncRoles')) {
            $user->syncRoles([$role]);
        }

        // Falls du zusätzlich eine role-Spalte pflegst, spiegeln:
        if (schema_has_column('users', 'role')) {
            $user->role = $role;
            $user->save();
        }

        return back()->with('success', "Rolle aktualisiert: {$role}");
    }

    /**
     * Runner für einen User zuweisen/entfernen.
     */
    public function assignRunner(Request $request, User $user)
    {
        $data = $request->validate([
            'runner_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $runnerId = $data['runner_id'] ?? null;

        if ($runnerId) {
            $runner = User::findOrFail($runnerId);
            $isRunner = (method_exists($runner, 'hasRole') && $runner->hasRole('Runner'))
                     || (($runner->role ?? null) === 'Runner');

            if (!$isRunner) {
                return back()->with('error', 'Der gewählte Betreuer ist kein Runner.');
            }
        }

        $user->runner_id = $runnerId;
        $user->save();

        return back()->with('success', 'Runner-Zuweisung aktualisiert.');
    }

    /**
     * User löschen (einfach/naiv; nach Bedarf härten).
     */
    public function destroy(User $user)
    {
        // Optional: Schutz, z. B. Admins nicht löschen, sich selbst nicht löschen, etc.
        if ((method_exists($user, 'hasRole') && $user->hasRole('Admin')) || (($user->role ?? null) === 'Admin')) {
            return back()->with('error', 'Admin-Konten können hier nicht gelöscht werden.');
        }

        $user->delete();

        return back()->with('success', 'Benutzer gelöscht.');
    }

    /**
     * NEU: Limits für Runner speichern.
     * Route: POST /admin/runners/{runner}/limits  (name: admin.runners.updateLimits)
     */
    public function updateRunnerLimits(Request $request, User $runner)
    {
        // Ziel muss wirklich ein Runner sein (Spatie oder role-Spalte)
        $isRunner = (method_exists($runner, 'hasRole') && $runner->hasRole('Runner'))
                || (($runner->role ?? null) === 'Runner');

        if (!$isRunner) {
            return back(303)->withErrors([
                'runner_daily_limit' => 'Limits können nur für Runner gesetzt werden.',
            ])->withInput();
        }

        $data = $request->validate([
            'runner_daily_limit'    => ['required','numeric','min:0','max:1000000'],
            'runner_per_user_limit' => ['required','numeric','min:0','max:1000000'],
        ]);

        // (Optional) Logik: pro-User <= daily
        if ($data['runner_per_user_limit'] > $data['runner_daily_limit']) {
            return back(303)->withErrors([
                'runner_per_user_limit' => 'Das Pro-User/Tag-Limit darf das Tageslimit nicht überschreiten.',
            ])->withInput();
        }

        // Explizit zuweisen -> unabhängig von $fillable
        $runner->runner_daily_limit    = $data['runner_daily_limit'];
        $runner->runner_per_user_limit = $data['runner_per_user_limit'];
        $runner->save();

        return back(303)->with('success', 'Runner-Limits aktualisiert.');
    }

}

/**
 * Kleines Helper, um robust zu prüfen, ob eine Spalte existiert, ohne Import der Schema-Facade überall.
 * (Vermeidet Fehler, falls du keine zusätzliche role-Spalte nutzt.)
 */
if (!function_exists('schema_has_column')) {
    function schema_has_column(string $table, string $column): bool
    {
        try {
            return \Illuminate\Support\Facades\Schema::hasColumn($table, $column);
        } catch (\Throwable $e) {
            return false;
        }
    }
}
