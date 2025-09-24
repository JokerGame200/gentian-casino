<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('game_transactions')) {
            // Tabelle existiert bereits -> Migration als "erledigt" markieren
            return;
        }

        Schema::create('game_transactions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('session_id')->nullable()->index();
            $t->unsignedBigInteger('provider_game_id')->nullable()->index();
            $t->string('trade_id')->nullable()->unique();
            $t->decimal('bet', 12, 2)->default(0);
            $t->decimal('win', 12, 2)->default(0);
            $t->decimal('before_balance', 12, 2)->default(0);
            $t->decimal('after_balance', 12, 2)->default(0);
            $t->string('action')->nullable();
            $t->boolean('round_finished')->nullable();
            $t->json('meta')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_transactions');
    }
};
