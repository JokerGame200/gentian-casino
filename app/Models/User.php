<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;
use Illuminate\Support\Facades\Storage;
use Illuminate\Database\Eloquent\Casts\Attribute;

class User extends Authenticatable
{
    use Notifiable, HasRoles;

    // currency ergänzt
    protected $fillable = ['username','password','balance','runner_id','email','name','currency','avatar'];
    protected $appends = ['avatar_url'];
    protected $hidden = ['password','remember_token'];

    // balance als Dezimal mit 2 Nachkommastellen
    protected $casts = [
        'balance' => 'decimal:2',
    ];
    protected function avatarUrl(): Attribute
    {
        return Attribute::get(function () {
            if ($this->avatar) {
                return Storage::disk('public')->url($this->avatar);
            }
            // Fallback: dynamisches SVG mit Initialen
            return route('avatar.placeholder', [
                'name' => $this->name ?? 'U',
                's'    => 128,
            ]);
        });
    }
    public function runner()      { return $this->belongsTo(User::class, 'runner_id'); }
    public function assignedUsers(){ return $this->hasMany(User::class, 'runner_id'); }
}