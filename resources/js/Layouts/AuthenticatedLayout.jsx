import React from "react";
import { Link, usePage } from "@inertiajs/react";

export default function AuthenticatedLayout({ header, children }) {
  const { auth } = usePage().props;
  const roles = (auth?.user?.roles ?? []);

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={route('dashboard')} className="font-semibold">Next2Win</Link>

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
            <Link
              href={route('logout')}
              method="post"
              as="button"
              className="text-sm text-red-600 hover:underline"
            >
              Logout
            </Link>
          </div>
        </div>
      </nav>

      {header && (
        <header className="bg-white shadow">
          <div className="mx-auto max-w-7xl py-6 px-4">
            {header}
          </div>
        </header>
      )}

      <main className="mx-auto max-w-7xl py-6 px-4">{children}</main>
    </div>
  );
}
