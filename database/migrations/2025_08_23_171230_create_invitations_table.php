<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::create('invitations', function (Blueprint $table) {
      $table->id();
      $table->string('token', 64)->unique();
      $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
      $table->foreignId('runner_id')->nullable()->constrained('users')->nullOnDelete();
      $table->timestamp('used_at')->nullable();
      $table->timestamps();
    });
  }
  public function down(): void {
    Schema::dropIfExists('invitations');
  }
};

