// resources/js/Pages/Profile/Edit.jsx
import React, { useState, useEffect, useRef } from "react";
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage, Link } from '@inertiajs/react';
import DeleteUserForm from './Partials/DeleteUserForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

/* -------- shared helpers / styles -------- */

const HIDE_SCROLLBAR_CSS = `
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`;

// Dark-Theme für Breeze-Formulare + Akzentfarbe für Überschriften
const PROFILE_CSS = `
.profile-scope label { color: #e5e7eb; }
.profile-scope .text-gray-600, .profile-scope .text-gray-700 { color: rgba(255,255,255,.85) !important; }
.profile-scope input, .profile-scope select, .profile-scope textarea {
  background-color: rgba(255,255,255,.06) !important;
  border-color: rgba(255,255,255,.18) !important;
  color: #fff !important;
}
.profile-scope input::placeholder, .profile-scope textarea::placeholder { color: rgba(255,255,255,.6) !important; }
.profile-scope .bg-white { background-color: rgba(255,255,255,.06) !important; }
.profile-scope .border-gray-300 { border-color: rgba(255,255,255,.18) !important; }
.profile-scope .ring-1, .profile-scope .ring { box-shadow: none !important; }

/* Überschriften-Akzent — gleiches "Blau" wie die Reiter (Tailwind cyan-500) */
.accent-headings { --heading-color: #06b6d4; }
.accent-headings h1,
.accent-headings h2,
.accent-headings h3,
.accent-headings h4,
.accent-headings h5,
.accent-headings h6 { color: var(--heading-color) !important; }
`;

// Format für Balance
function formatCurrency(v, cur) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(Number(v ?? 0));
  } catch {
    const n = (isFinite(v) ? v : 0).toFixed(2);
    return `${n} ${cur}`;
  }
}
const initialsOf = (name) => {
  if (!name || typeof name !== 'string') return 'N2';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || 'N2';
};

export default function Edit({ mustVerifyEmail, status }) {
  const { props } = usePage();
  const user = (props?.auth?.user) || {};
  const balance = Number(user.balance ?? 0);
  const currency = user.currency ?? 'EUR';
  const initials = initialsOf(user.name);

  return (
    <AuthenticatedLayout>
      <Head title="Profile" />
      <style dangerouslySetInnerHTML={{ __html: HIDE_SCROLLBAR_CSS + PROFILE_CSS }} />
      <div className="min-h-screen bg-[#0a1726] text-white selection:bg-cyan-400/30">
        <Header
          user={user}
          initials={initials}
          balanceText={formatCurrency(balance, currency)}
        />

        {/* Überschriften im Reiter-Blau */}
        <main className="accent-headings max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="h-4" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Profile</h1>
          <p className="text-white/70 mt-1">Verwalte deine Kontoinformationen, Passwort und Konto-Löschung.</p>

          <div className="space-y-6 mt-8 profile-scope">
            <div className="bg-[#0f2236] border border-white/10 shadow rounded-2xl p-4 sm:p-8">
              <UpdateProfileInformationForm status={status} mustVerifyEmail={mustVerifyEmail} className="max-w-xl" />
            </div>

            <div className="bg-[#0f2236] border border-white/10 shadow rounded-2xl p-4 sm:p-8">
              <UpdatePasswordForm className="max-w-xl" />
            </div>

            <div className="bg-[#0f2236] border border-white/10 shadow rounded-2xl p-4 sm:p-8">
              <DeleteUserForm className="max-w-xl" />
            </div>
          </div>
        </main>
      </div>
    </AuthenticatedLayout>
  );
}

/* ------------------------------ Header (ohne Reiter) ------------------------------ */

function Header({ user, initials, balanceText }) {
  const [openProfile, setOpenProfile] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef(null);

  // Rollen ableiten
  const roleNames = [];
  if (user?.role) roleNames.push(user.role);
  if (Array.isArray(user?.roles)) {
    for (const r of user.roles) roleNames.push(typeof r === 'string' ? r : r?.name);
  }
  const roleSet = new Set(roleNames.filter(Boolean).map(s => String(s).toLowerCase()));
  const isAdmin = Boolean(user?.is_admin) || roleSet.has('admin') || roleSet.has('administrator');
  const isRunner = Boolean(user?.is_runner) || roleSet.has('runner');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onDoc = (e) => {
      if (!headerRef.current) return;
      if (!headerRef.current.contains(e.target)) setOpenProfile(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') setOpenProfile(false); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  return (
    <div ref={headerRef} className="sticky top-0 z-50">
      {/* Top bar */}
      <div className={`relative z-20 transition-colors ${scrolled ? 'bg-[#0b1b2b]/80' : 'bg-transparent'} backdrop-blur supports-[backdrop-filter]:backdrop-blur-md shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-14 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {/* Logo -> /welcome */}
              <Link href="/welcome" className="flex items-center gap-2 min-w-0" aria-label="Play4Cash home">
                <img
                  src="/img/play4cash-logo-horizontal.svg"
                  alt="play4cash"
                  className="h-6 w-auto select-none"
                  draggable="false"
                />
              </Link>
            </div>

            <div className="flex items-center gap-2">
              {/* Balance */}
              <div className="hidden sm:flex items-center gap-1 mr-2 select-text">
                <span
                  className="px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-emerald-100 text-sm cursor-default"
                  aria-label="Current balance"
                >
                  {balanceText}
                </span>
              </div>

              {/* Avatar + Menü (kein Button-Nesting) */}
              <div className="relative ml-1">
                <button
                  onClick={() => setOpenProfile(v => !v)}
                  aria-haspopup="menu"
                  aria-label="Profile menu"
                  aria-expanded={openProfile}
                  className="block"
                >
                  <Avatar imgUrl={user?.profile_photo_url} initials={initials} />
                </button>

                {openProfile && (
                  <MenuCard align="right">
                    <MenuItem title="Profile" href="/profile" />
                    {isAdmin && <MenuItem title="Admin-Panel" href="/admin/users" />}
                    {isRunner && <MenuItem title="User-Panel" href="/runner/users" />}
                    <MenuItem title="Logout" href="/logout" method="post" />
                  </MenuCard>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reiter / Kategorien wurden entfernt */}
    </div>
  );
}

function Avatar({ imgUrl, initials }) {
  return imgUrl ? (
    <img
      src={imgUrl}
      alt=""
      aria-label="Profile avatar"
      className="h-9 w-9 rounded-full object-cover ring-2 ring-white/10"
      loading="lazy"
    />
  ) : (
    <div
      aria-label="Profile avatar"
      className="h-9 w-9 rounded-full grid place-items-center bg-gradient-to-br from-cyan-400/80 to-emerald-400/80 text-black font-bold ring-2 ring-white/10"
    >
      {initials}
    </div>
  );
}

function MenuCard({ children, align = 'left' }) {
  return (
    <div
      role="menu"
      className={`absolute z-[80] mt-2 ${align === 'right' ? 'right-0' : 'left-0'} w-44 rounded-xl bg-[#0f2236] border border-white/10 shadow-lg overflow-hidden`}
    >
      <div className="py-1">{children}</div>
    </div>
  );
}

function MenuItem({ title, href, method }) {
  const base = "block w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition";
  if (href) {
    return (
      <Link href={href} method={method} className={base}>
        {title}
      </Link>
    );
  }
  return <div className={base}>{title}</div>;
}
