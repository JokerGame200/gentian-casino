// resources/js/Pages/Runner/UsersPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, useForm, usePage, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

/* ---------- helpers (Ziggy-safe) ---------- */
const ziggyHas = (name) =>
  typeof window !== 'undefined' &&
  window?.Ziggy?.routes &&
  Object.prototype.hasOwnProperty.call(window.Ziggy.routes, name);
const routeUrl = (name, fallback, ...params) => {
  if (ziggyHas(name) && typeof route === 'function') return route(name, ...params);
  return typeof fallback === 'function' ? fallback(...params) : fallback;
};

const HIDE_SCROLLBAR_CSS = `
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`;
const PANEL_TEXT_CSS = `
.runner-panel { color: rgba(255, 255, 255, 0.9); }
.runner-panel table td { color: rgba(255, 255, 255, 0.82); }
.runner-panel table th { color: #ffffff; }
.runner-panel .text-white\\/90,
.runner-panel .text-white\\/80,
.runner-panel .text-white\\/70,
.runner-panel .text-white\\/60,
.runner-panel .text-white\\/50,
.runner-panel .text-white\\/40,
.runner-panel .text-white\\/30 {
  color: #ffffff !important;
}
.runner-panel .text-black,
.runner-panel .text-slate-900,
.runner-panel .text-slate-800,
.runner-panel .text-slate-700,
.runner-panel .text-gray-900,
.runner-panel .text-gray-800,
.runner-panel .text-gray-700,
.runner-panel .text-neutral-900,
.runner-panel .text-neutral-800 {
  color: #ffffff !important;
}
`;

export default function RunnerUsersPage({ users, logs, assigned_user_ids = [] }) {
  const { props } = usePage();
  const me = props?.auth?.user || {};

  const balance = Number(me.balance ?? 0);
  const currency = me.currency ?? 'EUR';

  const formatCurrency = (v, cur) => {
    try { return new Intl.NumberFormat(undefined, { style:'currency', currency:cur }).format(v); }
    catch { return `( ${(Number(v)||0).toFixed(2)} ${cur} )`; }
  };

  const initials = (() => {
    const name = me.name || me.username || '';
    const parts = name.trim().split(/\s+/).slice(0,2);
    return (parts.map(p=>p[0]?.toUpperCase()||'').join('')) || 'N2';
  })();

  const [tab, setTab] = useState('Users');

  // Auto-refresh users + logs every 4 seconds
  useEffect(() => {
    const id = setInterval(() => {
      router.reload({ only: ['users','logs'], preserveState: true, preserveScroll: true });
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <AuthenticatedLayout>
      <Head title="Dealer Panel" />
      <style dangerouslySetInnerHTML={{ __html: HIDE_SCROLLBAR_CSS + PANEL_TEXT_CSS }} />
      <div className="min-h-screen bg-[#0a1726] text-white runner-panel">
        <Header
          user={me}
          initials={initials}
          balanceText={formatCurrency(balance, currency)}
          tab={tab}
          setTab={setTab}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="mt-8">
            {tab === 'Users' && <UsersRunner users={users} currency={currency} me={me} />}
            {tab === 'Logs'  && <LogsRunner logs={logs} users={users} assignedIds={assigned_user_ids} />}
          </div>
        </main>
      </div>
    </AuthenticatedLayout>
  );
}

/* ============================ Header (mirrors Welcome.jsx) ============================ */
function Header({ user, initials, balanceText, tab, setTab }) {
  const [openProfile, setOpenProfile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef(null);

  // Derive roles like in Welcome.jsx
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

  // Clicking outside closes the profile menu
  useEffect(() => {
    const onDoc = (e) => {
      if (!headerRef.current) return;
      if (!headerRef.current.contains(e.target)) setOpenProfile(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  // ESC closes drawer & menu
  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === 'Escape') {
        setOpenProfile(false);
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  const tabs = ['Users', 'Logs'];

  return (
    <div ref={headerRef} className="sticky top-0 z-50">
      {/* Top bar – reused from Welcome.jsx */}
      <div className={`relative z-20 transition-colors ${scrolled ? 'bg-[#0b1b2b]/80' : 'bg-transparent'} backdrop-blur supports-[backdrop-filter]:backdrop-blur-md shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-14 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {/* Wordmark -> /welcome */}
              <Link href="/welcome" className="flex items-center gap-2 min-w-0" aria-label="Play4Cash home">
                <img
                  src="/img/play4cash-logo-horizontal.svg"
                  alt="play4cash"
                  className="h-8 sm:h-10 lg:h-12 w-auto select-none drop-shadow-[0_8px_24px_rgba(34,211,238,0.35)]"
                  draggable="false"
                  loading="eager"
                  decoding="async"
                  style={{ imageRendering: '-webkit-optimize-contrast' }}
                />
              </Link>
              <span className="text-xs ml-2 px-2 py-0.5 rounded bg-white/10 border border-white/10">Dealer</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Mobile button styled like "Categories" */}
              <button
                className="sm:hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition"
                onClick={() => { setDrawerOpen(true); setOpenProfile(false); }}
                aria-label="Open sections"
              >
                <DotsIcon />
                <span className="text-sm">Categories</span>
              </button>

              {/* Balance pill */}
              <div className="hidden sm:flex items-center gap-1 mr-2 select-text">
                <span
                  className="px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-emerald-100 text-sm cursor-default"
                  aria-label="Current balance"
                >
                  {balanceText}
                </span>
              </div>

              {/* Profile avatar button + menu (no nested buttons) */}
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
                      <MenuItem title="Profile" href={routeUrl('profile.edit','/profile')} />
                    {isAdmin && <MenuItem title="Admin panel" href={routeUrl('admin.users','/admin/users')} />}
                    {isRunner && <MenuItem title="Dealer panel" href={routeUrl('runner.users','/runner/users')} />}
                      <MenuItem title="Logout" href={routeUrl('logout','/logout')} method="post" />
                    </MenuCard>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs row – same styling as the categories row in Welcome.jsx */}
      <div className="relative z-10 bg-[#0b1b2b]/85 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="hidden sm:flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
            {tabs.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  'px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition',
                  tab === t ? 'bg-cyan-500 text-white shadow' : 'bg-white/5 hover:bg-white/10 text-white'
                ].join(' ')}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile drawer – same pattern as Welcome.jsx */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 rounded-t-2xl bg-[#0c1e31] border-t border-white/10 p-4 max-h:[70vh]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Categories</h3>
              <button className="p-2 rounded-lg hover:bg-white/10" onClick={() => setDrawerOpen(false)} aria-label="Close drawer"><XIcon /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {tabs.map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setDrawerOpen(false); }}
                  className={[
                    'px-3 py-2 rounded-xl text-sm text-left transition',
                    tab === t ? 'bg-cyan-500 text-white' : 'bg-white/5 hover:bg-white/10'
                  ].join(' ')}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ Users (assigned only) ============================ */
function UsersRunner({ users }) {
  const flashSuccess = usePage()?.props?.flash?.success;
  const flashError = usePage()?.props?.flash?.error;

  const list = Array.isArray(users?.data) ? users.data : (users || []);

  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    if (!q.trim()) return list;
    const s = q.toLowerCase();
    return list.filter(u =>
      String(u.id).includes(s) ||
      String(u.username || u.name || '').toLowerCase().includes(s)
    );
  }, [list, q]);

  return (
    <section className="space-y-6">
      {(flashSuccess || flashError) && (
        <div className="space-y-2">
          {flashSuccess && <Alert tone="success">{flashSuccess}</Alert>}
          {flashError && <Alert tone="danger">{flashError}</Alert>}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Users</h2>
          <input
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            placeholder="Search by ID or name…"
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 outline-none focus:ring-2 focus:ring-cyan-400 w-56"
          />
        </div>

        <div className="overflow-x-auto no-scrollbar border border-white/10 rounded-xl">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-white/80">
              <tr>
                <Th>ID</Th>
                <Th>User</Th>
                <Th className="text-right">Balance</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <UserRowRunner key={u.id} user={u} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-white/60">No users assigned yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {users?.links && (
          <div className="flex gap-2 flex-wrap mt-3">
            {users.links.map((l, i) => (
              <button
                key={i}
                className={`px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] ${l.active ? 'ring-1 ring-cyan-400' : ''}`}
                dangerouslySetInnerHTML={{ __html: l.label }}
                onClick={() => l.url && router.visit(l.url, { preserveScroll: true })}
                disabled={!l.url}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function UserRowRunner({ user }) {
  const form = useForm({ amount: '' });

  const apply = () => {
    const raw = parseFloat(form.data.amount);
    if (isNaN(raw) || raw === 0) return;
    const action = routeUrl('balance.update', (id)=>`/users/${id}/balance`, user.id);
    form.post(action, {
      preserveScroll: true,
      onFinish: () => form.setData('amount',''),
    });
  };

  return (
    <tr className="border-t border-white/10">
      <Td>{user.id}</Td>
      <Td>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-white/10 grid place-items-center text-xs">
            {(user.username || user.name || 'U').slice(0,2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{user.username || user.name || '—'}</div>
            <div className="text-xs text-white/60 truncate">#{user.id}</div>
          </div>
        </div>
      </Td>
      <Td className="text-right font-mono">{Number(user.balance ?? 0).toFixed(2)}</Td>
      <Td>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number" step="0.01" min="0.01"
            placeholder="Amount"
            value={form.data.amount}
            onChange={(e)=>form.setData('amount', e.target.value)}
            className="w-32 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"
          />
          <button
            onClick={apply}
            disabled={form.processing}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:brightness-110 disabled:opacity-60"
          >
            Save
          </button>
        </div>
        {form.errors.amount && <div className="text-rose-300 text-xs mt-1">{form.errors.amount}</div>}
      </Td>
    </tr>
  );
}

/* ============================ Logs (assigned users only) ============================ */
function LogsRunner({ logs, users, assignedIds = [] }) {
  const [q, setQ] = useState('');

  const allLogs = Array.isArray(logs?.data) ? logs.data : (Array.isArray(logs) ? logs : []);

  // Fallback: if assignedIds is empty, derive from paginated users
  const assignedFromUsers = Array.isArray(users?.data) ? users.data : (users || []);
  const assignedIdSet = useMemo(() => new Set(
    (assignedIds && assignedIds.length ? assignedIds : assignedFromUsers.map(u => u.id))
  ), [assignedIds, assignedFromUsers]);

  // Only keep logs where from/to belongs to assigned users
  const scoped = useMemo(() => {
    return allLogs.filter((row) => {
      const fu = row?.from_user_id ?? row?.fromUserId ?? row?.from_user?.id ?? row?.fromUser?.id;
      const tu = row?.to_user_id   ?? row?.toUserId   ?? row?.to_user?.id   ?? row?.toUser?.id;
      return assignedIdSet.has(fu) || assignedIdSet.has(tu);
    });
  }, [allLogs, assignedIdSet]);

  // Text filter for username/ID
  const filtered = useMemo(() => {
    if (!q.trim()) return scoped;
    const s = q.toLowerCase();
    return scoped.filter((row) => {
      const fromUser = row?.from_user ?? row?.fromUser ?? {};
      const toUser   = row?.to_user   ?? row?.toUser   ?? {};
      const fromName = String(fromUser?.username || fromUser?.name || '').toLowerCase();
      const toName   = String(toUser?.username   || toUser?.name   || '').toLowerCase();
      return (
        fromName.includes(s) ||
        toName.includes(s) ||
        String(row?.from_user_id ?? '').includes(s) ||
        String(row?.to_user_id ?? '').includes(s)
      );
    });
  }, [scoped, q]);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Logs</h2>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Filter: user…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
          />
          <button
            onClick={() => router.reload({ only: ['logs'], preserveState: true, preserveScroll: true })}
            className="text-sm px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto no-scrollbar border border-white/10 rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-white/80">
            <tr>
              <Th className="w-48">Time</Th>
              <Th>From</Th>
              <Th>To</Th>
              <Th className="text-right w-32">Amount</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const id = row.id ?? `${row.created_at}-${row.to_user_id}-${row.from_user_id}`;
              const fromUser = row?.from_user ?? row?.fromUser ?? {};
              const toUser   = row?.to_user   ?? row?.toUser   ?? {};
              const amount   = Number(row?.amount ?? 0);
              const isPlus   = amount >= 0;
              const dt = row?.created_at ? new Date(row.created_at) : null;
              const when = dt ? dt.toLocaleString() : '-';
              return (
                <tr key={id} className="border-t border-white/10">
                  <Td className="whitespace-nowrap">{when}</Td>
                  <Td>{fromUser?.username ?? `#${row?.from_user_id ?? '-'}`}</Td>
                  <Td>{toUser?.username   ?? `#${row?.to_user_id ?? '-'}`}</Td>
                  <Td className="text-right font-mono">
                    <span className={isPlus ? "text-emerald-300" : "text-rose-300"}>
                      {isPlus ? "+" : ""}{amount.toFixed(2)}
                    </span>
                  </Td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-white/60">No records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {Array.isArray(logs?.links) && logs.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {logs.links.map((l, i) => (
            <button
              key={i}
              className={`px-3 py-1.5 rounded-lg border border-white/10 text-sm ${l.active ? "bg-white/10" : "bg-white/[0.03] hover:bg-white/[0.06]"} ${!l.url ? "opacity-50 cursor-not-allowed" : ""}`}
              dangerouslySetInnerHTML={{ __html: l.label }}
              disabled={!l.url}
              onClick={() => l.url && router.visit(l.url, { preserveState: true, preserveScroll: true })}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ------- Shared UI bits (borrowed from Welcome.jsx) ------- */
function Alert({ tone='info', children }) {
  const map = {
    success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
    danger:  'border-rose-400/30 bg-rose-500/10 text-rose-200',
    info:    'border-cyan-400/30 bg-cyan-500/10 text-cyan-200',
  };
  return <div className={`rounded-xl border px-3 py-2 ${map[tone]}`}>{children}</div>;
}
function Th({ children, className='' }) { return <th className={`text-left p-2 font-semibold text-white ${className}`}>{children}</th>; }
function Td({ children, className='' }) { return <td className={`p-2 align-middle text-white/80 ${className}`}>{children}</td>; }
function Avatar({ imgUrl, initials }) {
  return imgUrl
    ? <img src={imgUrl} alt="" aria-label="Profile avatar" className="h-9 w-9 rounded-full object-cover ring-2 ring-white/10" loading="lazy" />
    : <div aria-label="Profile avatar" className="h-9 w-9 rounded-full grid place-items-center bg-gradient-to-br from-cyan-400/80 to-emerald-400/80 text-white font-bold ring-2 ring-white/10">{initials}</div>;
}
function MenuCard({ children, align='left' }) {
  return (
    <div role="menu" className={`absolute z-[80] mt-2 ${align === 'right' ? 'right-0' : 'left-0'} w-44 rounded-xl bg-[#0f2236] border border-white/10 shadow-lg overflow-hidden`}>
      <div className="py-1">{children}</div>
    </div>
  );
}
function MenuItem({ title, href, method }) {
  const base = "block w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition";
  if (href) return <Link href={href} method={method} className={base}>{title}</Link>;
  return <div className={base}>{title}</div>;
}
function DotsIcon() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>); }
function XIcon() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>); }
