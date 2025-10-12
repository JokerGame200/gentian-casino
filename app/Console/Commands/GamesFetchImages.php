<?php

namespace App\Console\Commands;

use App\Models\Game;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class GamesFetchImages extends Command
{
    protected $signature = 'games:fetch-images {--force} {--only=*} {--limit=}';
    protected $description = 'Lädt Spiel-Thumbnails lokal nach public/assets/games/{game_id}.jpg';

    public function handle(): int
    {
        $force = (bool)$this->option('force');
        $only  = (array)$this->option('only');
        $limit = $this->option('limit') ? (int)$this->option('limit') : null;

        $dir = public_path('assets/games');
        if (!is_dir($dir)) mkdir($dir, 0775, true);

        $query = Game::query()->when(!empty($only), fn($q) => $q->whereIn('game_id', $only));
        if ($limit) $query->limit($limit);

        $count = 0; $ok = 0; $skip = 0; $err = 0;
        foreach ($query->cursor() as $game) {
            $count++;
            $dest = "{$dir}/{$game->game_id}.jpg";

            if (!$force && is_file($dest)) { $skip++; continue; }
            if (!$game->img_url) { $skip++; continue; }

            try {
                $resp = Http::timeout(20)->retry(2, 500)->get($game->img_url);
                if (!$resp->ok()) { $err++; continue; }
                file_put_contents($dest, $resp->body());
                $ok++;
            } catch (\Throwable $e) {
                $this->warn("Fehler bei {$game->game_id}: ".$e->getMessage());
                $err++;
            }
        }

        $this->info("Bilder: total={$count}, geladen={$ok}, übersprungen={$skip}, fehler={$err}");
        return self::SUCCESS;
    }
}
