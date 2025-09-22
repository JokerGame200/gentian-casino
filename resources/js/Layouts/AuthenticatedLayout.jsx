import React from "react";
import { Link, usePage } from "@inertiajs/react";
import { useMyBalance } from '@/hooks/useMyBalance';

export default function AuthenticatedLayout({ header, children }) {
  const liveBalance = useMyBalance(2000);
  const { auth } = usePage().props;              // ← hol alles aus Inertia
  const roles = auth?.user?.roles ?? [];
  const safeBalance = Number(auth?.user?.balance ?? 0);

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={route('dashboard')} className="font-semibold">Next2Win</Link>

            {/* Kopfbereich + Live-Balance */}
            <div className="ml-4">
              <div className="ml-auto font-mono">
                Balance: {(liveBalance !== null ? liveBalance : safeBalance).toFixed(2)}
              </div>
            </div>

            {/* Admin-Links */}
            {roles.includes('Admin') && (
              <>
                <Link href={route('admin.users')} className="text-sm text-gray-700 hover:underline">
                  Benutzer
                </Link>
                <Link href={route('admin.logs')} className="text-sm text-gray-700 hover:underline">
                  Logs
                </Link>
              </>
            )}

            {/* Runner-Links */}
            {roles.includes('Runner') && (
              <>
                <Link href={route('runner.users')} className="text-sm text-gray-700 hover:underline">
                  Meine Spieler
                </Link>
                <Link href={route('runner.logs')} className="text-sm text-gray-700 hover:underline">
                  Meine Logs
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {auth?.user?.username} {roles.length ? `(${roles[0]})` : ''}
            </span>
            <Link href={route('logout')} method="post" as="button" className="text-sm text-red-600 hover:underline">
              Logout
            </Link>
          </div>
        </div>
      </nav>

      {header && (
        <header className="bg-white shadow">
          <div className="mx-auto max-w-7xl py-6 px-4">{header}</div>
        </header>
      )}

      <main className="mx-auto max-w-7xl py-6 px-4">{children}</main>
    </div>
  );
}
