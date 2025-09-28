// database/migrations/2025_09_28_000000_add_runner_limits_to_users_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Gilt nur, wenn der User tatsächlich Runner ist.
            $table->decimal('runner_daily_limit', 12, 2)->default(1000)->after('runner_id');
            $table->decimal('runner_per_user_limit', 12, 2)->default(500)->after('runner_daily_limit');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['runner_daily_limit', 'runner_per_user_limit']);
        });
    }
};
