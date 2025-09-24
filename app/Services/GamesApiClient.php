<?php
namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

class GamesApiClient {
    public function list(?string $img=null, ?string $cdnUrl=null): array {
        return Cache::remember("gamesapi:list:".($img ?: 'default'), 3600, function () use ($img,$cdnUrl) {
            $payload = ['hall'=>config('gamesapi.hall_id'),'key'=>config('gamesapi.hall_key'),'cmd'=>'getGamesList'];
            if ($img)   $payload['img']=$img;
            if ($cdnUrl)$payload['cdnUrl']=$cdnUrl;
            return (Http::asJson()->post(config('gamesapi.base_url'), $payload)->json()) ?: ['status'=>'fail','error'=>'empty_response'];
        });
    }
    public function open(array $params): array {
        $payload = array_merge([
            'cmd'=>'openGame','hall'=>config('gamesapi.hall_id'),'key'=>config('gamesapi.hall_key'),
            'domain'=>config('app.url'),'exitUrl'=>route('games.exit'),'language'=>'en','demo'=>'0',
        ], $params);
        return (Http::asJson()->post(config('gamesapi.open_url'), $payload)->json()) ?: ['status'=>'fail','error'=>'empty_response'];
    }
    public function jackpots(): array {
        $payload = ['hall'=>config('gamesapi.hall_id'),'key'=>config('gamesapi.hall_key'),'cmd'=>'jackpots'];
        return Cache::remember("gamesapi:jackpots", 60, fn()=> (Http::asJson()->post(config('gamesapi.base_url'), $payload)->json()) ?: ['status'=>'fail','error'=>'empty_response']);
    }
}
