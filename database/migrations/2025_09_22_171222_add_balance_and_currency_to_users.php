<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::table('users', function (Blueprint $t) {
      if (!Schema::hasColumn('users','balance')) {
        $t->decimal('balance', 12, 2)->default(0);
      }
      if (!Schema::hasColumn('users','currency')) {
        $t->string('currency', 3)->default('EUR');
      }
    });

    Schema::create('game_transactions', function (Blueprint $t) {
      $t->id();
      $t->foreignId('user_id')->constrained()->cascadeOnDelete();
      $t->string('session_id')->nullable();
      $t->string('trade_id')->nullable();       // vom Anbieter
      $t->unsignedBigInteger('provider_game_id')->nullable();
      $t->decimal('bet', 12, 2)->default(0);
      $t->decimal('win', 12, 2)->default(0);
      $t->decimal('before_balance', 12, 2)->default(0);
      $t->decimal('after_balance', 12, 2)->default(0);
      $t->string('action')->nullable();         // z.B. "spin", "freeSpin"
      $t->boolean('round_finished')->nullable();
      $t->json('meta')->nullable();             // matrix, betInfo, etc.
      $t->timestamps();
      $t->unique(['trade_id']);                 // Idempotenz
    });
  }
  public function down(): void {
    Schema::dropIfExists('game_transactions');
    Schema::table('users', function (Blueprint $t) {
      $t->dropColumn(['balance','currency']);
    });
  }
};
