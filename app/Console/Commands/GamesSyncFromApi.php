<?php

namespace App\Console\Commands;

use App\Models\Game;
use App\Support\GamesCatalog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GamesSyncFromApi extends Command
{
    protected $signature = 'games:sync 
        {--img=game_img_2 : Upstream image style (game_img_1, game_img_2)} 
        {--prune : Delete local entries that are missing upstream}
        {--dry : Fetch and display stats without writing to the database}';

    protected $description = 'Synchronize the game catalog with the upstream API (replaces Excel import).';

    public function handle(): int
    {
        $imgStyle = $this->normalizeImageStyle((string) $this->option('img'));
        $dryRun = (bool) $this->option('dry');
        $prune = (bool) $this->option('prune');

        $this->info(sprintf('Fetching game list from upstream (img=%s)…', $imgStyle));

        try {
            $catalog = $this->fetchGames($imgStyle);
        } catch (\Throwable $e) {
            $this->error('Failed to fetch games: ' . $e->getMessage());
            Log::error('games:sync fetch failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return self::FAILURE;
        }

        $games = $catalog['games'];
        $rawTotal = $catalog['raw_total'];
        $removed = $catalog['removed_total'];
        $total = count($games);

        $this->info(sprintf(
            'Upstream returned %d games (removed %d duplicates, final %d).',
            $rawTotal,
            $removed,
            $total
        ));

        if ($dryRun) {
            $this->comment('Dry run active – no database changes were made.');
            return self::SUCCESS;
        }

        $inserted = 0;
        $updated = 0;
        $unchanged = 0;
        $knownIds = [];

        foreach ($games as $raw) {
            $gameId = (string) ($raw['id'] ?? '');
            if ($gameId === '') {
                continue;
            }
            $knownIds[] = $gameId;

            $payload = [
                'game_id'     => $gameId,
                'name'        => $raw['name'] ?? null,
                'provider'    => $raw['provider'] ?? null,
                'device'      => isset($raw['device']) ? (int) $raw['device'] : null,
                'categories'  => $raw['categories'] ?? null,
                'img_url'     => $raw['img'] ?? null,
                'bm'          => ((int) ($raw['bm'] ?? 0)) === 1,
                'demo'        => ((int) ($raw['demo'] ?? 0)) === 1,
                'rewriterule' => ((int) ($raw['rewriterule'] ?? 0)) === 1,
                'exitButton'  => ((int) ($raw['exitButton'] ?? 0)) === 1,
            ];

            /** @var \App\Models\Game|null $model */
            $model = Game::where('game_id', $gameId)->first();
            if ($model) {
                $model->fill($payload);
                if ($model->isDirty()) {
                    $model->save();
                    $updated++;
                } else {
                    $unchanged++;
                }
            } else {
                Game::create($payload);
                $inserted++;
            }
        }

        $this->info(sprintf(
            'Sync complete: inserted=%d, updated=%d, unchanged=%d.',
            $inserted,
            $updated,
            $unchanged
        ));

        if ($prune && !empty($knownIds)) {
            $deleted = Game::whereNotIn('game_id', $knownIds)->delete();
            $this->warn("Pruned {$deleted} obsolete record(s).");
        }

        return self::SUCCESS;
    }

    /**
     * Fetches and normalizes games via the upstream API.
     *
     * @return array<int, array<string, mixed>>
     */
    protected function fetchGames(string $imgStyle): array
    {
        $payload = [
            'cmd'  => 'getGamesList',
            'hall' => (string) Config::get('gamesapi.hall_id'),
            'key'  => (string) Config::get('gamesapi.hall_key'),
            'img'  => $imgStyle,
        ];

        if ($cdn = (string) Config::get('gamesapi.cdn_url')) {
            $payload['cdnUrl'] = $cdn;
        }

        $endpoint = (string) Config::get('gamesapi.base_url');
        if ($endpoint === '') {
            throw new \RuntimeException('gamesapi.base_url is not configured.');
        }

        $response = Http::timeout(20)
            ->retry(2, 250)
            ->asForm()
            ->acceptJson()
            ->post($endpoint, $payload);

        if (!$response->ok()) {
            $status = $response->status();
            $bodyLen = strlen($response->body() ?? '');
            throw new \RuntimeException("Upstream HTTP {$status} (body length {$bodyLen}).");
        }

        $data = GamesCatalog::decodeJsonSafe($response);
        if (!$data || ($data['status'] ?? null) !== 'success') {
            $error = $data['error'] ?? 'upstream_invalid_json_or_fail';
            throw new \RuntimeException("Upstream returned failure status: {$error}.");
        }

        $content = $data['content'] ?? [];
        if (!is_array($content)) {
            return [
                'games' => [],
                'raw_total' => 0,
                'removed_total' => 0,
            ];
        }

        $flat = GamesCatalog::flattenContent($content);
        $deduped = GamesCatalog::dedupe($flat);

        return [
            'games' => $deduped,
            'raw_total' => count($flat),
            'removed_total' => max(count($flat) - count($deduped), 0),
        ];
    }

    protected function normalizeImageStyle(string $value): string
    {
        $allowed = GamesCatalog::ALLOWED_IMG_STYLES;
        if (!in_array($value, $allowed, true)) {
            $this->warn(sprintf(
                'Unsupported --img value "%s". Falling back to "%s".',
                $value,
                $allowed[0]
            ));
            return $allowed[0];
        }
        return $value;
    }
}
