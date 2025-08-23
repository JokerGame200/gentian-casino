<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Invitation extends Model
{
    protected $fillable = ['token','created_by','runner_id','role','used_at'];

    public function creator(){ return $this->belongsTo(User::class,'created_by'); }
    public function runner() { return $this->belongsTo(User::class,'runner_id'); }
}
