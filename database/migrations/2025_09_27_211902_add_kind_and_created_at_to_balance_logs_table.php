<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('balance_logs', function (Blueprint $table) {
            if (!Schema::hasColumn('balance_logs', 'kind')) {
                $table->string('kind', 20)->default('adjustment')->index();
            }
            if (!Schema::hasColumn('balance_logs', 'created_at')) {
                $table->timestamp('created_at')->nullable()->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('balance_logs', function (Blueprint $table) {
            if (Schema::hasColumn('balance_logs', 'kind')) {
                $table->dropColumn('kind');
            }
            // created_at könntest du behalten; wenn du es rückgängig machen willst, auskommentierung entfernen:
            // if (Schema::hasColumn('balance_logs', 'created_at')) {
            //     $table->dropColumn('created_at');
            // }
        });
    }
};
