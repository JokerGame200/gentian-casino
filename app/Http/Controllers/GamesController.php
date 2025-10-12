<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Illuminate\Support\Str;

class GamesController extends Controller
{
    public function welcome()
    {
        // TODO: Falls deine Tabelle nicht "games" heißt: anpassen.
        // Mögliche Spalten in deiner DB: id, name/title/display_name, provider/vendor/studio, image_file/image/img/thumb
        $rows = DB::table('games')
            ->select('*')
            ->orderBy('name') // ggf. anpassen
            ->limit(8000)     // Schutz gegen RAM-Spitzen
            ->get();

        $games = $rows->map(function ($r) {
            $a = (array) $r;

            // ID
            $id = $a['id'] ?? $a['game_id'] ?? $a['uid'] ?? null;

            // Name (fallbacks)
            $name = $a['name']
                ?? $a['title']
                ?? $a['display_name']
                ?? $a['game_name']
                ?? ($id ? ('Game '.$id) : 'Game');

            // Provider (fallbacks)
            $provider = $a['provider']
                ?? $a['vendor']
                ?? $a['studio']
                ?? $a['brand']
                ?? '';

            // Bilddatei aus DB herausfinden (erste gefüllte Spalte nehmen)
            $imgFile = null;
            foreach (['image_file','image','img','thumb','thumbnail','logo','icon'] as $k) {
                if (!empty($a[$k])) { $imgFile = $a[$k]; break; }
            }

            // Falls nur eine Zahl in der DB steht (z.B. 4426), .jpg anhängen
            if ($imgFile && preg_match('/^\d+$/', (string) $imgFile)) {
                $imgFile .= '.jpg';
            }

            // Finale URL ins /public/assets/games (so wie in deinen Apache-Logs)
            $imgUrl = $imgFile ? asset('assets/games/' . ltrim($imgFile, '/')) : null;

            return [
                'id'       => $id,
                'name'     => $name,
                'provider' => $provider,
                'img'      => $imgUrl,
            ];
        })->filter(fn ($g) => !empty($g['id']) && !empty($g['name']))
          ->values();

        return Inertia::render('Welcome', [
            'games'         => $games,
            'games_source'  => 'server',   // nur zur Kontrolle
        ]);
    }
}
