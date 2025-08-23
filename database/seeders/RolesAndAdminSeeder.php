<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class RolesAndAdminSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['Admin','Runner','User'] as $r) {
            Role::findOrCreate($r);
        }

        if (!User::where('username','admin')->exists()) {
            $admin = User::create([
                'username' => 'admin',
                'password' => Hash::make('g8v22hsfEAH0xk0E'),
                'balance'  => 0,
                'email'    => null,
                'name'     => 'Administrator',
            ]);
            $admin->assignRole('Admin');
        }
    }
}

