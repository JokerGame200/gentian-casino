<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use App\Models\User;
use App\Models\BalanceLog;

class BalanceController extends Controller
{
    public function store(Request $request, User $user)
    {
        $data = $request->validate([
            'amount' => 'required|numeric'
        ]);

        if (! Gate::allows('manage-user-balance', $user)) {
            abort(403,'Nicht erlaubt.');
        }

        DB::transaction(function() use ($user,$data) {
            $user->balance = (float)$user->balance + (float)$data['amount'];
            $user->save();

            BalanceLog::create([
                'from_user_id' => auth()->id(),
                'to_user_id'   => $user->id,
                'amount'       => $data['amount'],
            ]);
        });

        return back()->with('success','Guthaben aktualisiert.');
    }

    public function index()
    {
        $actor = auth()->user();

        $q = BalanceLog::query()->with([
            'fromUser:id,username',
            'toUser:id,username,runner_id'
        ]);

        if ($actor->hasRole('Runner')) {
            $q->whereHas('toUser', fn($qq)=>$qq->where('runner_id',$actor->id));
        }

        $logs = $q->latest('created_at')->paginate(25);
        // Benenne die Inertia-Seite so, wie du sie anlegst:
        return inertia('AdminOrRunner/LogsPage', ['logs'=>$logs]);
    }
}

