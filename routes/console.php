<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::call(function () {
    \App\Models\GameSession::whereIn('status', ['open', 'opening'])
        ->update(['status' => 'closed', 'closed_at' => now()]);
})->everyFiveMinutes()->name('close-inactive-game-sessions');
