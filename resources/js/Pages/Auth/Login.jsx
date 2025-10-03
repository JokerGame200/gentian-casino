// resources/js/Pages/Auth/Login.jsx
import React, { useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import GuestLayout from '@/Layouts/GuestLayout';

// --- Ziggy helpers: sicher gegen fehlende Route-Namen ---
const ziggyHas = (name) =>
  typeof window !== 'undefined' &&
  window?.Ziggy?.routes &&
  Object.prototype.hasOwnProperty.call(window.Ziggy.routes, name);

const routeUrl = (name, fallback) => {
  // wenn Ziggy den Namen hat und das globale route() existiert -> URL bauen
  if (ziggyHas(name) && typeof route === 'function') return route(name);
  return fallback; // sonst sichere Fallback-URL benutzen
};

export default function Login() {
  const { props } = usePage();
  const status = props?.status || null;

  // Falls du Reset/Registration serverseitig steuern willst:
  // In deinem Controller/Route kannst du z.B. `Route::has('password.request')` setzen und als Prop schicken.
  const canResetPassword = ziggyHas('password.request'); // true nur wenn Route existiert
  const canRegister = ziggyHas('register');              // true nur wenn Route existiert

  const { data, setData, post, processing, errors, reset } = useForm({
    username: '',
    password: '',
    remember: false,
  });

  const [showPw, setShowPw] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    // Sichere URL ermitteln (benannter Route oder Fallback)
    const loginAction = routeUrl('login', '/login');
    post(loginAction, {
      onFinish: () => reset('password'),
    });
  };

  return (
    <GuestLayout>
      <Head title="Login" />
      <div className="min-h-screen bg-[#0a1726] text-white flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Header / wordmark */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2">
              <span className="text-xl font-semibold tracking-wide">000000</span>
            </div>
            <p className="text-sm text-white/70 mt-1">Welcome back — sign in to continue</p>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0f1f33] to-[#0b1626] p-6 shadow-lg">
            {status && (
              <div className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                {status}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              {/* Username */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium mb-1">
                  Benutzername
                </label>
                <input
                  id="username"
                  type="text"
                  name="username"
                  value={data.username}
                  autoComplete="username"
                  onChange={(e) => setData('username', e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-cyan-400"
                />
                {errors.username && (
                  <p className="mt-1 text-sm text-rose-300">{errors.username}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium mb-1">
                    Passwort
                  </label>
                  {canResetPassword && (
                    <Link
                      href={routeUrl('password.request', '/forgot-password')}
                      className="text-xs text-cyan-300 hover:text-cyan-200"
                    >
                      Passwort vergessen?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    name="password"
                    value={data.password}
                    autoComplete="current-password"
                    onChange={(e) => setData('password', e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                    aria-label={showPw ? 'Passwort verbergen' : 'Passwort anzeigen'}
                  >
                    {showPw ? (
                      // Eye-off
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M3 3l18 18M10.6 10.6a3 3 0 104.24 4.24M9.88 5.1A9.9 9.9 0 0121 12s-1.9 3.5-5.1 5.52M7.5 7.5C5.17 8.83 3 12 3 12s1.64 3.02 4.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      // Eye
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.6"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/>
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-rose-300">{errors.password}</p>
                )}
              </div>

              {/* Remember me */}
              <label className="inline-flex items-center gap-2 select-none">
                <input
                  type="checkbox"
                  name="remember"
                  checked={data.remember}
                  onChange={(e) => setData('remember', e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/5 text-cyan-400 focus:ring-cyan-400"
                />
                <span className="text-sm text-white/80">Eingeloggt bleiben</span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={processing}
                className="w-full rounded-lg bg-cyan-400 text-black font-semibold py-2.5 hover:brightness-110 disabled:opacity-60"
              >
                {processing ? 'Einloggen…' : 'Einloggen'}
              </button>
            </form>

            {/* Register (nur wenn Route existiert) */}
            {canRegister && (
              <div className="mt-5 text-center text-sm text-white/70">
                Kein Konto?{' '}
                <Link
                  href={routeUrl('register', '/register')}
                  className="text-cyan-300 hover:text-cyan-200"
                >
                  Registrieren
                </Link>
              </div>
            )}
          </div>

          {/* Footer hint */}
          <p className="mt-6 text-center text-xs text-white/50">
            Secure area — please use your account credentials.
          </p>
        </div>
      </div>
    </GuestLayout>
  );
}
