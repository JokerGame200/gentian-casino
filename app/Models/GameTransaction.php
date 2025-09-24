<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GameTransaction extends Model
{
    protected $fillable = [
        'user_id','session_id','trade_id','provider_game_id',
        'bet','win','before_balance','after_balance',
        'action','round_finished','meta'
    ];
    protected $casts = ['meta'=>'array','round_finished'=>'boolean','bet'=>'decimal:2','win'=>'decimal:2','before_balance'=>'decimal:2','after_balance'=>'decimal:2'];
}
