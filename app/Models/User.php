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
    protected $fillable = [
        'username', 'email', 'name', 'password',
        'balance', 'currency',
        'runner_id',
        'runner_daily_limit',
        'runner_per_user_limit',
        'avatar',
    ];
    protected $appends = ['avatar_url'];
    protected $hidden = ['password','remember_token'];

    // balance als Dezimal mit 2 Nachkommastellen
    protected $casts = [
        'balance' => 'decimal:2',
        'runner_daily_limit' => 'decimal:2',
        'runner_per_user_limit' => 'decimal:2',
        'last_seen_at' => 'datetime',
        'is_playing' => 'boolean',
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
    public function gameSessions()
    {
        return $this->hasMany(GameSession::class);
    }
    public function scopeWithPresence($query)
    {
        return $query->addSelect([
            'last_seen_at',
            'is_playing' => GameSession::selectRaw('1')
                ->whereColumn('game_sessions.user_id', 'users.id')
                ->whereIn('status', ['open', 'opening'])
                ->whereNull('closed_at')
                ->limit(1),
        ]);
    }
    public function getPresenceStatusAttribute(): string
    {
        if ($this->is_playing) {
            return 'playing';
        }

        $lastSeen = $this->last_seen_at;
        if ($lastSeen && $lastSeen->gt(now()->subMinutes(2))) {
            return 'lobby';
        }

        return 'offline';
    }
}
