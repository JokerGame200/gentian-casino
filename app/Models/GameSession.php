<?php

// app/Models/GameSession.php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GameSession extends Model {
  protected $fillable = ['user_id','game_id','session_id','status','opened_at','closed_at','bet_total','win_total'];
  protected $casts = ['opened_at'=>'datetime','closed_at'=>'datetime'];
}
