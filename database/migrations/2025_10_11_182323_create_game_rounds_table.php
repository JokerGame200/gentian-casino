<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('game_rounds', function (Blueprint $table) {
            $table->id();
            $table->string('game_id')->index();
            $table->string('player_login')->index();
            $table->decimal('bet', 12, 2);
            $table->decimal('win', 12, 2);
            $table->string('session_id')->nullable()->index();
            $table->string('trade_id')->nullable()->index();
            $table->string('action')->nullable()->index();
            $table->text('bet_info')->nullable();
            $table->longText('matrix')->nullable();
            $table->longText('win_lines')->nullable();
            $table->dateTime('round_time')->nullable()->index(); // UTC empfohlen
            $table->timestamps();
        });
    }
    public function down(): void {
        Schema::dropIfExists('game_rounds');
    }
};
