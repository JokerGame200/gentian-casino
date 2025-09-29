<?php
// app/Http/Controllers/GamesApiController.php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

class GamesApiController extends Controller
{
    public function list(Request $request)
    {
    $hall = (string) config('gamesapi.hall_id', env('GAMESAPI_HALL_ID'));
    $key  = (string) config('gamesapi.hall_key', env('GAMESAPI_HALL_KEY'));
    $base = rtrim((string) config('gamesapi.base_url', env('GAMESAPI_BASE_URL', 'https://api.gamesapi.biz/API')), '/') . '/';
    $img  = $request->input('img', 'game_img_2');
    $cdn  = $request->input('cdnUrl', config('gamesapi.cdn_url'));

    if ($hall === '' || $key === '') {
        return response()->json([
            'status' => 'fail',
            'error'  => 'server_not_configured',
            'hint'   => 'Setze GAMESAPI_HALL_ID und GAMESAPI_HALL_KEY in .env',
        ], 500);
    }

    $payload = ['hall'=>$hall, 'key'=>$key, 'cmd'=>'getGamesList', 'img'=>$img] + ($cdn ? ['cdnUrl'=>$cdn] : []);
    $cacheKey = 'gamesapi:list:' . md5(json_encode($payload));
    $ttl = now()->addMinutes((int) $request->integer('cache', 30));

    if (!$request->boolean('refresh', false)) {
        if ($cached = Cache::get($cacheKey)) {
            return response()->json($cached);
        }
    }

    // 1) Versuch: JSON POST (laut Doku: METHOD POST, REQUEST json)
    $resp = Http::timeout(20)->acceptJson()->asJson()->post($base, $payload);

    $data = null;
    try { $data = $resp->json(); } catch (\Throwable $e) { $data = null; }

    // Wenn HTTP nicht OK → Fehlermeldung mit Rohtext zurückgeben
    if (!$resp->ok()) {
        return response()->json([
            'status' => 'fail',
            'error'  => 'upstream_http_'.$resp->status(),
            'raw'    => Str::limit($resp->body(), 400),
        ], 502);
    }

    // Wenn kein JSON, könnte der Server Form erwartet haben → 2) Fallback: asForm
    if (!is_array($data)) {
        $resp2 = Http::timeout(20)->acceptJson()->asForm()->post($base, $payload);
        try { $data = $resp2->json(); } catch (\Throwable $e) { $data = null; }
        if (!$resp2->ok() || !is_array($data)) {
            return response()->json([
                'status' => 'fail',
                'error'  => 'upstream_not_json',
                'raw'    => Str::limit($resp2->body() ?: $resp->body(), 500),
            ], 502);
        }
    }

    // Manche Implementierungen sparen "status" aus → Normalisieren
    if (!isset($data['status'])) {
        // Wenn "content" plausibel aussieht, als success interpretieren
        $data = ['status' => 'success', 'error' => '', 'content' => $data['content'] ?? $data];
    }

    // Wenn status=fail aber error leer ist → sprechende Meldung
    if (($data['status'] ?? null) !== 'success' && empty($data['error'])) {
        $data['error'] = 'upstream_fail_no_error';
    }

    Cache::put($cacheKey, $data, $ttl);
    return response()->json($data);
}
}
