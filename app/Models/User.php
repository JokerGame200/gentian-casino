<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use Notifiable, HasRoles;

    protected $fillable = ['username','password','balance','runner_id','email','name'];

    protected $hidden = ['password','remember_token'];

    public function runner()      { return $this->belongsTo(User::class, 'runner_id'); }
    public function assignedUsers(){ return $this->hasMany(User::class, 'runner_id'); }
}
