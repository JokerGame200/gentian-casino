<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\BalanceLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

class AdminController extends Controller
{
    /**
     * Admin-Panel (UsersPage)
     * Liefert: users, runners, stats, logs (gleich wie /admin/logs)
     */
    public function index(Request $request)
    {
        $auth = Auth::user();

        // KPIs für heute
        $start = now()->startOfDay();
        $end   = now()->endOfDay();

        // Summe heutiger Einzahlungen (kind = 'deposit')
        $depositsToday = (float) BalanceLog::whereBetween('created_at', [$start, $end])
            ->where('kind', 'deposit')
            ->sum('amount');

        // GGR = Stakes - Winnings
        // Annahme: bet = Einsatz (negativ gespeichert), win = Gewinn (positiv)
        $stakes = (float) BalanceLog::whereBetween('created_at', [$start, $end])
            ->where('kind', 'bet')
            ->sum(DB::raw('ABS(amount)'));
        $wins   = (float) BalanceLog::whereBetween('created_at', [$start, $end])
            ->where('kind', 'win')
            ->sum('amount');
        $ggrToday = $stakes - $wins;

        return Inertia::render('Admin/UsersPage', [
            // Nutzerliste
            'users' => fn () =>
                User::with(['runner:id,username', 'roles:id,name'])
                    ->select('id', 'username', 'name', 'balance', 'runner_id')
                    ->orderByDesc('id')
                    ->paginate(25)
                    ->through(function (User $u) {
                        return [
                            'id'        => $u->id,
                            'username'  => $u->username,
                            'name'      => $u->name,
                            'balance'   => (float) ($u->balance ?? 0),
                            'runner_id' => $u->runner_id,
                            'role'      => optional($u->roles->first())->name ?? 'User',
                        ];
                    })
                    ->withQueryString(),

            // Runner-Auswahl
            'runners' => fn () =>
                User::whereHas('roles', fn ($q) => $q->where('name', 'Runner'))
                    ->orderBy('username')
                    ->get(['id', 'username']),

            // KPIs
            'stats' => [
                'users'          => User::count(),
                'runners'        => User::whereHas('roles', fn($q)=>$q->where('name','Runner'))->count(),
                'deposits_today' => $depositsToday,
                'ggr_today'      => $ggrToday,
            ],

            // Logs (gleiches Dataset wie /admin/logs), als Closure für Partial Reload
            'logs' => fn () => $this->logsQuery($auth)
                ->paginate(50)
                ->through(function (BalanceLog $l) {
                    return [
                        'id'         => $l->id,
                        'created_at' => optional($l->created_at)->toIso8601String() ?? (string) $l->created_at,
                        'amount'     => (float) $l->amount,
                        'from_user'  => ['id' => $l->from_user_id, 'username' => optional($l->fromUser)->username],
                        'to_user'    => ['id' => $l->to_user_id,   'username' => optional($l->toUser)->username],
                    ];
                })
                ->withQueryString(),
        ]);
    }

    /**
     * Basis-Query für Logs; Runner sehen nur relevante Logs.
     */
    protected function logsQuery(?User $auth)
    {
        $q = BalanceLog::with([
                'fromUser:id,username',
                'toUser:id,username',
            ])
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($auth && method_exists($auth, 'hasRole') && $auth->hasRole('Runner')) {
            if (method_exists($auth, 'assignedUsers')) {
                $ids = $auth->assignedUsers()->pluck('id')->push($auth->id)->unique()->values();
                $q->where(function ($w) use ($ids) {
                    $w->whereIn('from_user_id', $ids)->orWhereIn('to_user_id', $ids);
                });
            } else {
                $q->where(function ($w) use ($auth) {
                    $w->where('from_user_id', $auth->id)->orWhere('to_user_id', $auth->id);
                });
            }
        }

        return $q;
    }

    /**
     * Rolle setzen (Spatie oder Fallback)
     */
    public function setRole(User $user, Request $request)
    {
        $data = $request->validate([
            'role' => 'required|in:User,Runner,Admin',
        ]);

        if (method_exists($user, 'syncRoles')) {
            $user->syncRoles([$data['role']]);
        } else {
            $user->role = $data['role'];
            $user->save();
        }

        return back()->with('success', 'Rolle aktualisiert.');
    }

    /**
     * Runner zuweisen/entfernen
     */
    public function assignRunner(User $user, Request $request)
    {
        $request->validate([
            'runner_id' => 'nullable|exists:users,id',
        ]);

        $runner = $request->runner_id ? User::findOrFail($request->runner_id) : null;

        if ($runner && method_exists($runner, 'hasRole') && ! $runner->hasRole('Runner')) {
            return back()->withErrors(['runner_id' => 'Ausgewählte Person ist kein Runner.']);
        }

        $user->runner_id = $runner?->id;
        $user->save();

        return back()->with('success', 'Runner-Zuordnung gespeichert.');
    }

    /**
     * Balance anpassen + Log schreiben
     * ✱ Verwenden, falls du balance.update auf AdminController routest.
     */
    public function updateBalance(User $user, Request $request)
    {
        $data = $request->validate([
            'amount' => 'required|numeric',
        ]);

        $amount = (float) $data['amount'];
        $actor  = Auth::user();

        DB::transaction(function () use ($user, $amount, $actor) {
            // Balance updaten
            $user->balance = (float) ($user->balance ?? 0) + $amount;
            $user->save();

            // Log schreiben
            $log = new BalanceLog([
                'from_user_id' => optional($actor)->id,
                'to_user_id'   => $user->id,
                'amount'       => $amount,
                'kind'         => $amount >= 0 ? 'deposit' : 'withdrawal',
            ]);

            // created_at manuell setzen (Model hat $timestamps=false)
            $log->created_at = now();
            $log->save();
        });

        return back()->with('success', 'Balance aktualisiert.');
    }

    /**
     * Benutzer löschen
     */
    public function destroy(User $user)
    {
        $me = Auth::id();

        if ((int) $user->id === (int) $me) {
            return back()->withErrors(['user' => 'Du kannst dich nicht selbst löschen.']);
        }

        if (method_exists($user, 'hasRole') && $user->hasRole('Runner') && method_exists($user, 'assignedUsers')) {
            if ($user->assignedUsers()->exists()) {
                return back()->withErrors(['user' => 'Dieser Runner hat noch zugewiesene User. Bitte zuerst umhängen.']);
            }
        }

        $user->delete();

        return back()->with('success', 'Benutzer gelöscht.');
    }

    /**
     * (Optional) Invite erzeugen — einfacher Flash-Link.
     */
    public function invite(Request $request)
    {
        $data = $request->validate([
            'role'      => 'required|in:User,Runner',
            'runner_id' => 'nullable|exists:users,id',
        ]);

        $token = Str::upper(Str::random(10));
        $url = url('/invite/' . $token);

        return back()->with('success', "Invite erstellt: {$url}");
    }
}
