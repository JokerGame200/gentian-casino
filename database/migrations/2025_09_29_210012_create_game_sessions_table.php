<?php

// database/migrations/2025_09_29_000000_create_game_sessions_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::create('game_sessions', function (Blueprint $t) {
      $t->id();
      $t->foreignId('user_id')->constrained()->cascadeOnDelete();
      $t->string('game_id', 64);
      $t->string('session_id', 128)->index();   // vom Provider (gameRes.sessionId)
      $t->string('status', 16)->default('open'); // open|closed
      $t->timestamp('opened_at')->nullable();
      $t->timestamp('closed_at')->nullable();
      $t->decimal('bet_total', 12, 2)->default(0);
      $t->decimal('win_total', 12, 2)->default(0);
      $t->timestamps();

      $t->index(['user_id', 'status']); // schneller Check auf aktive Session
    });
  }
  public function down(): void { Schema::dropIfExists('game_sessions'); }
};
