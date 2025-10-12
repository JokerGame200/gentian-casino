<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GameRound extends Model
{
    protected $fillable = [
        'game_id','player_login','bet','win','session_id','trade_id',
        'action','bet_info','matrix','win_lines','round_time',
    ];

    protected $casts = [
        'bet' => 'decimal:2',
        'win' => 'decimal:2',
        'round_time' => 'datetime',
    ];
}
