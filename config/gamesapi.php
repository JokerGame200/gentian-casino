<?php
// config/gamesapi.php
return [
    'base_url'  => env('GAMESAPI_BASE_URL', ''),
    'open_url'  => env('GAMESAPI_OPEN_URL', ''),
    'hall_id'   => env('GAMESAPI_HALL_ID', ''),
    'hall_key'  => env('GAMESAPI_HALL_KEY', ''),
    'cdn_url'   => env('GAMESAPI_CDN_URL', null),
    'use_sign'  => (bool) env('GAMESAPI_USE_SIGN', false),
    'currency'  => env('APP_CURRENCY', 'EUR'),
];
