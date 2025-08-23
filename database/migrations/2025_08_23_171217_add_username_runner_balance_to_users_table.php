<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
  public function up(): void {
    Schema::table('users', function (Blueprint $table) {
      $table->string('username')->unique()->after('id');

      // Breeze bringt meist 'name' und 'email' mit – 'email' darf optional sein:
      if (Schema::hasColumn('users','email')) {
        $table->string('email')->nullable()->change();
      }

      $table->decimal('balance', 10, 2)->default(0)->after('password');
      $table->foreignId('runner_id')->nullable()->after('balance')
            ->constrained('users')->nullOnDelete();
      $table->index('runner_id');
    });
  }

  public function down(): void {
    Schema::table('users', function (Blueprint $table) {
      $table->dropConstrainedForeignId('runner_id');
      $table->dropColumn(['username','balance','runner_id']);
    });
  }
};
