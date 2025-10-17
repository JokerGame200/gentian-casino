<?php

namespace App\Support;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class GamesCatalog
{
    public const ALLOWED_IMG_STYLES = ['game_img_1', 'game_img_2', 'game_img_5', 'game_img_6'];

    /**
     * Safely decode the upstream JSON response while logging malformed payloads.
     */
    public static function decodeJsonSafe(Response $response): ?array
    {
        $body = $response->body();
        try {
            $data = json_decode($body ?? '', true, 512, JSON_THROW_ON_ERROR);
            return is_array($data) ? $data : null;
        } catch (\Throwable $e) {
            Log::warning('GAMES upstream invalid JSON', [
                'err'  => $e->getMessage(),
                'len'  => strlen($body ?? ''),
                'head' => substr($body ?? '', 0, 1000),
            ]);
            return null;
        }
    }

    /**
     * Flatten upstream provider buckets into a simple game list.
     *
     * @param array<string|int, mixed> $content
     * @return array<int, array<string, mixed>>
     */
    public static function flattenContent(array $content): array
    {
        $flat = [];
        foreach ($content as $providerTitle => $games) {
            if (!is_iterable($games)) {
                continue;
            }
            foreach ($games as $game) {
                if (!is_array($game)) {
                    continue;
                }

                $resolvedId = self::resolveIdentifier($game);

                $flat[] = [
                    'id'         => $resolvedId,
                    'source_id'  => (string) ($game['id'] ?? ''),
                    'name'       => $game['name'] ?? '',
                    'img'        => $game['img'] ?? null,
                    'device'     => isset($game['device']) ? (int) $game['device'] : 2,
                    'provider'   => $game['title'] ?? (is_string($providerTitle) ? $providerTitle : ''),
                    'categories' => $game['categories'] ?? '',
                    'demo'       => (int) ($game['demo'] ?? 0),
                    'bm'         => (int) ($game['bm'] ?? 0),
                    'rewriterule'=> (int) ($game['rewriterule'] ?? 0),
                    'exitButton' => (int) ($game['exitButton'] ?? 0),
                    'aliases'    => $game['aliases'] ?? null,
                    '_raw'       => $game,
                ];
            }
        }
        return $flat;
    }

    /**
     * Remove duplicates while preferring entries with better metadata.
     *
     * @param array<int, array<string, mixed>> $games
     * @return array<int, array<string, mixed>>
     */
    public static function dedupe(array $games): array
    {
        $buckets = [];
        $aliases = [];

        foreach ($games as $raw) {
            $game = self::normalizeGame($raw);

            $candidates = [];
            $hasId = $game['id'] !== '';

            if ($hasId) {
                $candidates[] = 'id:' . $game['id'];
            } else {
                if ($game['_provider_norm'] !== '' && $game['_name_norm'] !== '') {
                    $candidates[] = 'provname:' . $game['_provider_norm'] . '#' . $game['_name_norm'];
                }
                if ($game['_img_key'] !== '') {
                    $candidates[] = 'img:' . $game['_img_key'];
                }
            }

            if (!$candidates) {
                $candidates[] = 'hash:' . md5(
                    ($game['name'] ?? '') . '|' .
                    ($game['provider'] ?? '') . '|' .
                    ($game['_img_key'] ?? '')
                );
            }

            $bucketKey = null;
            foreach ($candidates as $candidateKey) {
                if (isset($aliases[$candidateKey])) {
                    $bucketKey = $aliases[$candidateKey];
                    break;
                }
            }

            if (!$bucketKey) {
                $bucketKey = $candidates[0];
            }

            $current = $buckets[$bucketKey] ?? null;
            if (!$current || self::preferCandidateOverCurrent($current, $game)) {
                $buckets[$bucketKey] = $game;
            }

            $aliasKeys = $candidates;
            if ($hasId) {
                $aliasKeys = array_values(array_filter(
                    $aliasKeys,
                    static fn($candidateKey) => Str::startsWith($candidateKey, 'id:')
                ));
                if (!in_array($bucketKey, $aliasKeys, true)) {
                    $aliasKeys[] = $bucketKey;
                }
            }

            foreach ($aliasKeys as $candidateKey) {
                $aliases[$candidateKey] = $bucketKey;
            }
        }

        return array_values(array_map(function (array $game) {
            unset($game['_name_norm'], $game['_provider_norm'], $game['_img_key'], $game['_raw']);
            return $game;
        }, $buckets));
    }

    private static function normalizeGame(array $game): array
    {
        $id = trim((string) ($game['id'] ?? ''));
        $name = trim(preg_replace('/\s+/u', ' ', (string) ($game['name'] ?? '')));
        $provider = trim(preg_replace('/\s+/u', ' ', (string) ($game['provider'] ?? '')));
        $img = self::sanitizeImage($game['img'] ?? null);

        $nameNorm = self::normalizeNamePart($name);
        $providerNorm = self::normalizeProvider($provider);
        $imgKey = self::normalizeImageKey($img);

        return [
            ...$game,
            'id' => $id,
            'name' => $name !== '' ? $name : ($game['name'] ?? ''),
            'provider' => $provider,
            'img' => $img,
            '_name_norm' => $nameNorm,
            '_provider_norm' => $providerNorm,
            '_img_key' => $imgKey,
        ];
    }

    private static function resolveIdentifier(array $game): string
    {
        $candidates = [
            $game['id'] ?? null,
            $game['game_id'] ?? null,
            $game['uid'] ?? null,
            $game['uuid'] ?? null,
            $game['sys_id'] ?? null,
            $game['code'] ?? null,
            $game['key'] ?? null,
            $game['slug'] ?? null,
            $game['external_id'] ?? null,
        ];

        foreach ($candidates as $value) {
            if ($value === null) {
                continue;
            }
            $string = trim((string) $value);
            if ($string !== '') {
                return $string;
            }
        }

        return '';
    }

    private static function normalizeNamePart(?string $value): string
    {
        return (string) Str::of((string) ($value ?? ''))
            ->lower()
            ->replaceMatches('/[™®©]/u', '')
            ->replaceMatches('/[-_.:\/\\\\]+/u', ' ')
            ->replaceMatches('/\s+/u', ' ')
            ->trim();
    }

    private static function normalizeProvider(?string $value): string
    {
        return (string) Str::of((string) ($value ?? ''))
            ->lower()
            ->replaceMatches('/[^a-z0-9]+/u', ' ')
            ->replaceMatches('/\s+/u', ' ')
            ->trim();
    }

    private static function preferCandidateOverCurrent(array $current, array $candidate): bool
    {
        $currentHasId = $current['id'] !== '';
        $candidateHasId = $candidate['id'] !== '';
        if ($candidateHasId !== $currentHasId) {
            return $candidateHasId;
        }

        $currentHasProvider = $current['provider'] !== '';
        $candidateHasProvider = $candidate['provider'] !== '';
        if ($candidateHasProvider !== $currentHasProvider) {
            return $candidateHasProvider;
        }

        $currentScore = self::imageScore($current['img'] ?? null);
        $candidateScore = self::imageScore($candidate['img'] ?? null);
        if ($candidateScore !== $currentScore) {
            return $candidateScore > $currentScore;
        }

        $currentNameLen = strlen((string) ($current['name'] ?? ''));
        $candidateNameLen = strlen((string) ($candidate['name'] ?? ''));
        if ($candidateNameLen !== $currentNameLen) {
            return $candidateNameLen > $currentNameLen;
        }

        $currentLen = strlen(json_encode($current));
        $candidateLen = strlen(json_encode($candidate));
        return $candidateLen > $currentLen;
    }

    private static function imageScore(?string $url): int
    {
        $u = trim((string) ($url ?? ''));

        if ($u === '' || in_array(strtolower($u), ['null', 'undefined', 'na'], true)) {
            return 0;
        }

        if (Str::startsWith($u, 'data:')) {
            return strlen($u) >= 80 ? 2 : 1;
        }

        if (Str::startsWith($u, ['http://', 'https://'])) {
            return 5;
        }

        if (Str::startsWith($u, '//')) {
            return 4;
        }

        return 3;
    }

    private static function sanitizeImage($value): string
    {
        $img = trim((string) ($value ?? ''));
        if ($img === '' || in_array(strtolower($img), ['null', 'undefined', 'na'], true)) {
            return '';
        }
        return $img;
    }

    private static function normalizeImageKey(?string $img): string
    {
        $img = trim((string) ($img ?? ''));
        if ($img === '') {
            return '';
        }

        if (Str::startsWith($img, ['http://', 'https://'])) {
            return (string) Str::of($img)
                ->lower()
                ->before('#')
                ->before('?')
                ->trim('/');
        }

        return ltrim($img, '/');
    }
}
