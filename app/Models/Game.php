<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Game extends Model
{
    protected $fillable = [
        'game_id',
        'name',
        'provider',
        'device',
        'categories',
        'img_url',
        'bm',
        'demo',
        'rewriterule',
        'exitButton',
    ];

    protected $casts = [
        'bm' => 'bool',
        'demo' => 'bool',
        'rewriterule' => 'bool',
        'exitButton' => 'bool',
        'device' => 'int',
    ];
}
