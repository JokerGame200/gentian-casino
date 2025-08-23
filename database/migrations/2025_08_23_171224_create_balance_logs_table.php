<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::create('balance_logs', function (Blueprint $table) {
      $table->id();
      $table->foreignId('from_user_id')->nullable()->constrained('users')->nullOnDelete();
      $table->foreignId('to_user_id')->constrained('users')->cascadeOnDelete();
      $table->decimal('amount', 10, 2);
      $table->timestamp('created_at')->useCurrent();
    });
  }
  public function down(): void {
    Schema::dropIfExists('balance_logs');
  }
};
