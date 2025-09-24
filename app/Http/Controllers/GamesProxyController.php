<?php

namespace App\Http\Controllers;

use App\Services\GamesApiClient;
use Illuminate\Http\Request;

class GamesProxyController extends Controller
{
    public function __construct(private GamesApiClient $client) {}

    public function list(Request $r) {
        $img = $r->string('img')->toString() ?: null; // game_img_2 / 5 / 6
        $cdn = $r->string('cdnUrl')->toString() ?: null;
        return response()->json($this->client->list($img, $cdn));
    }

    public function open(Request $r) {
        $r->validate([
            'gameId' => 'required',
        ]);
        $user = $r->user();
        $res = $this->client->open([
            'login' => $user->username ?? $user->email,
            'gameId'=> (string)$r->input('gameId'),
            'cdnUrl'=> $r->input('cdnUrl'),
            'demo'  => $r->boolean('demo') ? '1' : '0',
        ]);
        return response()->json($res);
    }

    public function jackpots() {
        return response()->json($this->client->jackpots());
    }
}
