<?php

return [
    'base_url' => env('GAMESAPI_BASE_URL', ''),              // z.B. https://tbs2api.aslot.net/API/
    'open_url' => env('GAMESAPI_OPEN_URL', ''),              // z.B. https://tbs2api.aslot.net/API/openGame/
    'hall_id'  => env('GAMESAPI_HALL_ID', ''),
    'hall_key' => env('GAMESAPI_HALL_KEY', ''),
    'cdn_url'  => env('GAMESAPI_CDN_URL', null),
    'use_sign' => (bool) env('GAMESAPI_USE_SIGN', false),
    'currency' => env('GAMESAPI_CURRENCY', 'EUR'),
    'max_active_sessions_per_user' => (int) env('GAMESAPI_MAX_ACTIVE_SESSIONS', 1),
    'stale_session_minutes' => (int) env('GAMESAPI_STALE_MINUTES', 30),
    'stale_session_grace_seconds' => (int) env('GAMESAPI_STALE_GRACE_SECONDS', 10),
];
