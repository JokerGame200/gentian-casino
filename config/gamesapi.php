<?php
return [
  'base_url' => env('GAMESAPI_BASE_URL'),
  'open_url' => env('GAMESAPI_OPEN_URL'),
  'hall_id'  => env('GAMESAPI_HALL_ID'),
  'hall_key' => env('GAMESAPI_HALL_KEY'),
  'use_sign' => filter_var(env('GAMESAPI_USE_SIGN', false), FILTER_VALIDATE_BOOL),
];
