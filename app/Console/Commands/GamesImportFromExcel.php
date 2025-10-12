<?php

namespace App\Console\Commands;

use App\Models\Game;
use Illuminate\Console\Command;
use PhpOffice\PhpSpreadsheet\IOFactory;

class GamesImportFromExcel extends Command
{
    protected $signature = 'games:import {--file=storage/app/imports/gameList-2025-10-11.xls}';
    protected $description = 'Import or update the game list from an XLS file';

    public function handle(): int
    {
        $file = base_path($this->option('file'));
        if (!is_file($file)) {
            $this->error("File not found: {$file}");
            return self::FAILURE;
        }

        $spreadsheet = IOFactory::load($file);
        $sheet = $spreadsheet->getSheet(0);
        $rows = $sheet->toArray(null, true, true, true);

        if (empty($rows)) {
            $this->warn('No data found.');
            return self::SUCCESS;
        }

        $header = array_shift($rows);
        $norm = fn($s) => strtolower(trim(preg_replace('/\s+/', '_', (string)$s)));

        $map = [];
        foreach ($header as $col => $name) {
            $map[$col] = $norm($name);
        }

        $inserted = 0; $updated = 0; $skipped = 0;

        foreach ($rows as $row) {
            $data = [];
            foreach ($row as $col => $val) {
                $data[$map[$col] ?? $col] = is_string($val) ? trim($val) : $val;
            }

            $gameId = $data['id'] ?? $data['game_id'] ?? null;
            if (!$gameId) { $skipped++; continue; }

            $payload = [
                'game_id'    => (string)$gameId,
                'name'       => $data['name'] ?? null,
                'provider'   => $data['title'] ?? $data['provider'] ?? null,
                'device'     => isset($data['device']) && $data['device'] !== '' ? (int)$data['device'] : null,
                'categories' => $data['categories'] ?? null,
                'img_url'    => $data['img'] ?? $data['image'] ?? null,
                'bm'         => (int)($data['bm'] ?? 0) === 1,
                'demo'       => (int)($data['demo'] ?? 0) === 1,
                'rewriterule'=> (int)($data['rewriterule'] ?? 0) === 1,
                'exitButton' => (int)($data['exitbutton'] ?? 0) === 1,
            ];

            $game = Game::where('game_id', $payload['game_id'])->first();
            if ($game) { $game->fill($payload)->save(); $updated++; }
            else       { Game::create($payload);           $inserted++; }
        }

        $this->info("Import complete: new={$inserted}, updated={$updated}, skipped={$skipped}");
        return self::SUCCESS;
    }
}
