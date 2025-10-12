<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('games', function (Blueprint $table) {
            $table->id();
            $table->string('game_id')->unique();
            $table->string('name')->nullable();
            $table->string('provider')->nullable();   // API-Feld "title"
            $table->unsignedTinyInteger('device')->nullable(); // 0/1/2
            $table->string('categories')->nullable();
            $table->string('img_url')->nullable();
            $table->boolean('bm')->default(false);
            $table->boolean('demo')->default(false);
            $table->boolean('rewriterule')->default(false);
            $table->boolean('exitButton')->default(false);
            $table->timestamps();
        });
    }
    public function down(): void {
        Schema::dropIfExists('games');
    }
};
