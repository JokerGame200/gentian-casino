// resources/js/Pages/Auth/RegisterByInvite.jsx
import React, { useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import GuestLayout from '@/Layouts/GuestLayout';

// Ziggy helpers (safe fallbacks if route names are missing)
const ziggyHas = (name) =>
  typeof window !== 'undefined' &&
  window?.Ziggy?.routes &&
  Object.prototype.hasOwnProperty.call(window.Ziggy.routes, name);

const routeUrl = (name, params, fallback) => {
  if (ziggyHas(name) && typeof route === 'function') return route(name, params);
  return fallback;
};

export default function RegisterByInvite({ token }) {
  const { flash } = usePage().props;
  const { data, setData, post, processing, errors, reset } = useForm({
    username: '',
    password: '',
    password_confirmation: '',
  });

  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    const action = routeUrl('invite.register', { token }, `/invite/${token}`);
    post(action, {
      onFinish: () => reset('password', 'password_confirmation'),
    });
  };

  return (
    <GuestLayout>
      <Head title="Accept invite" />

      <div className="min-h-screen bg-[#0a1726] text-white flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Header / wordmark */}
          <div className="text-center mb-6">
            <div className="flex justify-center pl-3 sm:pl-6 md:pl-10">
              <img
                src="/img/play4cash-logo-horizontal.svg"
                alt="play4cash"
                className="h-10 sm:h-12 w-auto drop-shadow-[0_8px_24px_rgba(34,211,238,0.35)] select-none mx-auto"
                loading="eager"
                decoding="async"
                draggable="false"
                style={{ imageRendering: '-webkit-optimize-contrast' }}
              />
            </div>
            <p className="text-sm text-white/70 mt-1">Create your account via invite</p>
          </div>

          {/* Flash messages */}
          {(flash?.success || flash?.error) && (
            <div className="mb-4 space-y-2">
              {flash.success && (
                <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm">
                  {flash.success}
                </div>
              )}
              {flash.error && (
                <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm">
                  {flash.error}
                </div>
              )}
            </div>
          )}

          {/* Card */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0f1f33] to-[#0b1626] p-6 shadow-lg">
            <form onSubmit={submit} className="space-y-4 max-w-sm mx-auto">
              {/* Username */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium mb-1">
                  Username
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
                {errors?.username && (
                  <p className="mt-1 text-sm text-rose-300">{errors.username}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    name="password"
                    value={data.password}
                    autoComplete="new-password"
                    onChange={(e) => setData('password', e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
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
                {errors?.password && (
                  <p className="mt-1 text-sm text-rose-300">{errors.password}</p>
                )}
              </div>

              {/* Password confirmation */}
              <div>
                <label htmlFor="password_confirmation" className="block text-sm font-medium mb-1">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="password_confirmation"
                    type={showPw2 ? 'text' : 'password'}
                    name="password_confirmation"
                    value={data.password_confirmation}
                    autoComplete="new-password"
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw2((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                    aria-label={showPw2 ? 'Hide password' : 'Show password'}
                  >
                    {showPw2 ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M3 3l18 18M10.6 10.6a3 3 0 104.24 4.24M9.88 5.1A9.9 9.9 0 0121 12s-1.9 3.5-5.1 5.52M7.5 7.5C5.17 8.83 3 12 3 12s1.64 3.02 4.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.6"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={processing}
                  className="inline-flex items-center justify-center rounded-lg bg-cyan-500 px-6 py-2.5 text-black font-semibold hover:brightness-110 disabled:opacity-60 transition"
                >
                  {processing ? 'Registering…' : 'Register'}
                </button>
              </div>
            </form>
          </div>

          {/* Footer hint */}
          <p className="mt-6 text-center text-xs text-white/50">
            This invite link is single use and may expire after redemption.
          </p>
        </div>
      </div>
    </GuestLayout>
  );
}
