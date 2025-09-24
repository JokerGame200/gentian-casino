<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use Notifiable, HasRoles;

    // currency ergänzt
    protected $fillable = ['username','password','balance','runner_id','email','name','currency'];

    protected $hidden = ['password','remember_token'];

    // balance als Dezimal mit 2 Nachkommastellen
    protected $casts = [
        'balance' => 'decimal:2',
    ];

    public function runner()      { return $this->belongsTo(User::class, 'runner_id'); }
    public function assignedUsers(){ return $this->hasMany(User::class, 'runner_id'); }
}
