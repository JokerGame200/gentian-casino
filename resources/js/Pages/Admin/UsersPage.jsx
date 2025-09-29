// resources/js/Pages/Admin/UsersPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, useForm, usePage, router, useRemember } from '@inertiajs/react';
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

export default function AdminPanel({ users, runners = [], stats = {}, logs }) {
  const { props } = usePage();
  const user = props?.auth?.user || {};
  const inviteUrl = props?.flash?.invite_url || '';

  // Tab-State persistent merken
  const [tab, setTab] = useRemember('Users', 'adminUsersTab');

  // Wenn ein neuer Invite erstellt wurde, automatisch den "Invites"-Tab anzeigen
  React.useEffect(() => {
    if (inviteUrl) setTab('Invites');
  }, [inviteUrl, setTab]);

  const balance = Number(user.balance ?? 0);
  const currency = user.currency ?? 'EUR';

  const formatCurrency = (v, cur) => {
    try { return new Intl.NumberFormat(undefined, { style:'currency', currency:cur }).format(v); }
    catch { return `( ${(Number(v)||0).toFixed(2)} ${cur} )`; }
  };
  const initials = (() => {
    const name = user.name || '';
    const parts = name.trim().split(/\s+/).slice(0,2);
    return (parts.map(p=>p[0]?.toUpperCase()||'').join('')) || 'N2';
  })();

  const safeUsers = Array.isArray(users?.data) ? users.data : (users || []);
  const kpis = {
    users: stats.users ?? safeUsers.length ?? 0,
    runners: stats.runners ?? runners.length ?? 0,
    depositsToday: stats.deposits_today ?? 0,
    ggrToday: stats.ggr_today ?? 0,
  };

  return (
    <AuthenticatedLayout>
      <Head title="Admin Panel">
        {/* Favicon nur für diese Seite */}
        <link rel="icon" type="image/svg+xml" href="/img/play4cash-mark.svg" />
        {/* Optional: Cache-Bust oder Fallbacks */}
        {/* <link rel="icon" href="/img/play4cash-mark.svg?v=1" head-key="fav" /> */}
        {/* <link rel="alternate icon" type="image/png" sizes="32x32" href="/img/play4cash-32.png" /> */}
      </Head>
      <style dangerouslySetInnerHTML={{ __html: HIDE_SCROLLBAR_CSS }} />
      <div className="min-h-screen bg-[#0a1726] text-white">
        <Header
          user={user}
          initials={initials}
          balanceText={formatCurrency(balance, currency)}
          tab={tab}
          setTab={setTab}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          {/* KPIs */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-6">
            <KpiCard label="Users" value={kpis.users} />
            <KpiCard label="Runners" value={kpis.runners} />
            <KpiCard label="Deposits (today)" value={formatCurrency(kpis.depositsToday, currency)} />
            <KpiCard label="GGR (today)" value={formatCurrency(kpis.ggrToday, currency)} />
          </section>

          {/* Content */}
          <div className="mt-8">
            {tab === 'Users' && <UsersAdmin users={users} runners={runners} />}
            {tab === 'Invites' && <InvitesAdmin runners={runners} />}
            {tab === 'Logs' && <LogsAdmin logs={logs} />}
            {tab === 'RunnerSettings' && <RunnerSettingsAdmin runners={runners} />}
          </div>
        </main>
      </div>
    </AuthenticatedLayout>
  );
}

/* ============================ Header (wie Welcome.jsx) ============================ */

function Header({ user, initials, balanceText, tab, setTab }) {
  const [openProfile, setOpenProfile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef(null);

  // Rollen wie in Welcome.jsx bestimmen
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

  // außerhalb Klick schließt Profilmenü
  useEffect(() => {
    const onDoc = (e) => {
      if (!headerRef.current) return;
      if (!headerRef.current.contains(e.target)) setOpenProfile(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  // ESC schließt Drawer & Menü
  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') { setOpenProfile(false); setDrawerOpen(false); } };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  // Tabs für Admin-Bereich (bleiben erhalten)
  const tabs = [
    { key: 'Users', label: 'Users' },
    { key: 'Invites', label: 'Invites' },
    { key: 'Logs', label: 'Logs' },
    { key: 'RunnerSettings', label: 'Runner Settings' },
  ];

  return (
    <div ref={headerRef} className="sticky top-0 z-50">
      {/* Top bar – identisch zu Welcome.jsx, aber ohne Kategorien */}
      <div className={`relative z-20 transition-colors ${scrolled ? 'bg-[#0b1b2b]/80' : 'bg-transparent'} backdrop-blur supports-[backdrop-filter]:backdrop-blur-md shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-14 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {/* Wortmarke -> /welcome */}
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
              {/* Mobile Drawer für Sektionen/Tabs */}
              <button
                className="sm:hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition"
                onClick={() => { setDrawerOpen(true); setOpenProfile(false); }}
                aria-label="Open sections"
              >
                <DotsIcon />
                <span className="text-sm">Sections</span>
              </button>

              {/* Guthaben – statische Pille (kein Dropdown → kein Button-Nesting) */}
              <div className="hidden sm:flex items-center gap-1 mr-2 select-text">
                <span
                  className="px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-emerald-100 text-sm cursor-default"
                  aria-label="Current balance"
                >
                  {balanceText}
                </span>
              </div>

              {/* Profil: Avatar-Button + Menü als Geschwister (keine Button-Verschachtelung) */}
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
                    <MenuItem title="Profile" href={routeUrl('profile.edit', '/profile')} />
                    {isAdmin && <MenuItem title="Admin-Panel" href="/admin/users" />}
                    {isRunner && <MenuItem title="User-Panel" href="/runner/users" />}
                    <MenuItem title="Logout" href={routeUrl('logout', '/logout')} method="post" />
                  </MenuCard>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin-Tabs (ersetzt in Welcome die Kategorien-Zeile) */}
      <div className="relative z-10 bg-[#0b1b2b]/85 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="hidden sm:flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={[
                  'px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition',
                  tab === t.key ? 'bg-cyan-500 text-black shadow' : 'bg-white/5 hover:bg-white/10 text-white'
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Drawer mit Tabs (Sections) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 rounded-t-2xl bg-[#0c1e31] border-t border-white/10 p-4 max-h-[70vh]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Sections</h3>
              <button className="p-2 rounded-lg hover:bg-white/10" onClick={() => setDrawerOpen(false)} aria-label="Close drawer">
                <XIcon />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setDrawerOpen(false); }}
                  className={[
                    'px-3 py-2 rounded-xl text-sm text-left transition',
                    tab === t.key ? 'bg-cyan-500 text-black' : 'bg-white/5 hover:bg-white/10'
                  ].join(' ')}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ Users ============================ */

function UsersAdmin({ users, runners }) {
  const { props } = usePage();
  const flashSuccess = props?.flash?.success;
  const flashError = props?.flash?.error;

  const list = Array.isArray(users?.data) ? users.data : (users || []);

  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    if (!q.trim()) return list;
    const s = q.toLowerCase();
    return list.filter(u =>
      String(u.id).includes(s) ||
      String(u.username || u.name || '').toLowerCase().includes(s) ||
      String(u.role || '').toLowerCase().includes(s)
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
            placeholder="Search by ID, name, role…"
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 outline-none focus:ring-2 focus:ring-cyan-400 w-56"
          />
        </div>

        <div className="overflow-x-auto no-scrollbar border border-white/10 rounded-xl">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-white/80">
              <tr>
                <Th>ID</Th>
                <Th>User</Th>
                <Th>Role</Th>
                <Th>Runner</Th>
                <Th className="text-right">Balance</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <UserRow key={u.id} user={u} runners={runners} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-white/60">No users found.</td>
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

/* ---- UserRow ---- */
function UserRow({ user, runners }) {
  const roleForm = useForm({ role: user.role ?? 'User' });
  const runnerForm = useForm({ runner_id: user.runner_id ?? '' });
  const balanceForm = useForm({ amount: '' });

  const postPromise = (form, action) => new Promise((resolve) => {
    form.post(action, { preserveScroll: true, onFinish: resolve });
  });

  const applyAll = async () => {
    // 1) Role change
    if ((roleForm.data.role || 'User') !== (user.role || 'User')) {
      const action = routeUrl('admin.setRole', (id)=>`/admin/users/${id}/role/set`, user.id);
      await postPromise(roleForm, action);
    }

    // 2) Runner assignment (only if target role is User)
    const targetRole = roleForm.data.role || user.role || 'User';
    const canAssignRunner = targetRole === 'User';
    const desiredRunnerId = canAssignRunner ? (runnerForm.data.runner_id || '') : '';
    const currentRunnerId = user.runner_id || '';
    if (canAssignRunner && desiredRunnerId !== currentRunnerId) {
      const action = routeUrl('admin.assignRunner', (id)=>`/admin/users/${id}/assign-runner`, user.id);
      await postPromise(runnerForm, action);
    }

    // 3) Balance adjustment
    const raw = parseFloat(balanceForm.data.amount);
    if (!isNaN(raw) && raw !== 0) {
      const action = routeUrl('balance.update', (id)=>`/users/${id}/balance`, user.id);
      await new Promise((resolve)=>{
        balanceForm.post(action, {
          preserveScroll: true,
          onFinish: () => { balanceForm.setData('amount',''); resolve(); }
        });
      });
    }
  };

  const [deleting, setDeleting] = useState(false);
  const deleteUser = () => {
    if (!confirm(`Delete user "${user.username || user.name}"?`)) return;
    const action = routeUrl('admin.users.destroy', (id)=>`/admin/users/${id}`, user.id);
    router.delete(action, { preserveScroll: true, onStart:()=>setDeleting(true), onFinish:()=>setDeleting(false) });
  };

  const targetRole = roleForm.data.role || user.role || 'User';
  const runnerAssignAllowed = targetRole === 'User';

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

      <Td>
        <select
          value={roleForm.data.role}
          onChange={(e)=>roleForm.setData('role', e.target.value)}
          className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"
        >
          <option value="User">User</option>
          <option value="Runner">Runner</option>
          <option value="Admin">Admin</option>
        </select>
        {roleForm.errors.role && <div className="text-rose-300 text-xs mt-1">{roleForm.errors.role}</div>}
      </Td>

      <Td>
        {runnerAssignAllowed ? (
          <select
            value={runnerForm.data.runner_id || ''}
            onChange={(e)=>runnerForm.setData('runner_id', e.target.value || '')}
            className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"
          >
            <option value="">— none —</option>
            {runners.map(r => <option key={r.id} value={r.id}>{r.username}</option>)}
          </select>
        ) : (
          <span className="text-white/50">— not applicable —</span>
        )}
        {runnerForm.errors.runner_id && <div className="text-rose-300 text-xs mt-1">{runnerForm.errors.runner_id}</div>}
      </Td>

      <Td className="text-right font-mono">{Number(user.balance ?? 0).toFixed(2)}</Td>

      <Td>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number" step="0.01" placeholder="Amount"
            value={balanceForm.data.amount}
            onChange={(e)=>balanceForm.setData('amount', e.target.value)}
            className="w-28 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"
            max="500" /* UI-Hardcap; Server prüft echte Limits */
          />
          <button
            onClick={applyAll}
            disabled={roleForm.processing || runnerForm.processing || balanceForm.processing}
            className="px-3 py-1.5 rounded-lg bg-green-400 text-black text-sm font-semibold hover:brightness-110 disabled:opacity-60"
            title="Apply all changes"
          >
            Apply
          </button>
          <button
            onClick={deleteUser}
            disabled={deleting}
            className="px-2.5 py-1.5 rounded-lg border border-rose-400 text-rose-300 hover:bg-rose-400/10 text-sm"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Td>
    </tr>
  );
}

/* ============================ Logs (gleiche Daten wie /admin/logs) ============================ */

function LogsAdmin({ logs }) {
  const [q, setQ] = useState('');

  // Alle 4s nur die Logs per Partial-Reload nachladen.
  useEffect(() => {
    const id = setInterval(() => {
      router.reload({ only: ['logs'], preserveState: true, preserveScroll: true });
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const items = Array.isArray(logs?.data) ? logs.data : (Array.isArray(logs) ? logs : []);

  const filtered = useMemo(() => {
    if (!q) return items;
    const s = q.toLowerCase();
    return items.filter((row) => {
      const fu = row?.from_user?.username ?? row?.fromUser?.username ?? '';
      const tu = row?.to_user?.username ?? row?.toUser?.username ?? '';
      return fu.toLowerCase().includes(s) || tu.toLowerCase().includes(s);
    });
  }, [items, q]);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Logs</h2>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Filter: Benutzer…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
          />
          <button
            onClick={() => router.reload({ only: ['logs'], preserveState: true, preserveScroll: true })}
            className="text-sm px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
          >
            Aktualisieren
          </button>
        </div>
      </div>

      <div className="overflow-x-auto no-scrollbar border border-white/10 rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-white/80">
            <tr>
              <Th className="w-48">Zeit</Th>
              <Th>Von</Th>
              <Th>An</Th>
              <Th className="text-right w-32">Betrag</Th>
            </tr>
          </thead>
        <tbody>
          {filtered.map((row) => {
            const id = row.id ?? `${row.created_at}-${row.to_user_id}-${row.from_user_id}`;
            const fromUser = row?.from_user ?? row?.fromUser ?? {};
            const toUser = row?.to_user ?? row?.toUser ?? {};
            const amount = Number(row?.amount ?? 0);
            const isPlus = amount >= 0;
            const dt = row?.created_at ? new Date(row.created_at) : null;
            const when = dt ? dt.toLocaleString() : '-';
            return (
              <tr key={id} className="border-t border-white/10">
                <Td className="whitespace-nowrap">{when}</Td>
                <Td>{fromUser?.username ?? `#${row?.from_user_id ?? '-'}`}</Td>
                <Td>{toUser?.username ?? `#${row?.to_user_id ?? '-'}`}</Td>
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
              <td colSpan={4} className="p-4 text-center text-white/60">Keine Einträge gefunden.</td>
            </tr>
          )}
        </tbody>
        </table>
      </div>

      {/* Pagination, wenn als Paginator geliefert */}
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

/* ============================ Invites & Shared Bits ============================ */

function InvitesAdmin({ runners }) {
  const { props } = usePage();
  // Holt den Link aus der Session-Flash (oder direkt, falls du ihn dauerhaft teilst)
  const inviteUrl = props?.flash?.invite_url || props?.invite_url || '';

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold">Invites</h2>
      <InviteForm runners={runners} />

      {inviteUrl ? (
        <InviteResultCard url={inviteUrl} />
      ) : (
        <div className="rounded-xl border border-white/10 p-4 bg-white/5 text-white/80">
          Nach dem Erstellen erscheint der Invite-Link hier unter dem Formular.
        </div>
      )}
    </section>
  );
}

function InviteForm({ runners }) {
  const form = useForm({ role: 'User', runner_id: '' });

  const submit = (e) => {
    e.preventDefault();
    const action = routeUrl('admin.invite', '/admin/invite');
    form.post(action, {
      preserveScroll: true,
      onSuccess: () => {
        // sanft zur Ergebnis-Karte scrollen
        requestAnimationFrame(() => {
          document.querySelector('[data-invite-result]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    });
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0f1f33] to-[#0b1626] p-5 space-y-4">
      <h3 className="font-semibold">Create Invite</h3>
      <label className="block text-sm">
        <span className="text-white/80">Type</span>
        <select
          name="role"
          value={form.data.role}
          onChange={(e)=>form.setData('role', e.target.value)}
          className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2"
        >
          <option value="User">User</option>
          <option value="Runner">Runner</option>
        </select>
      </label>

      {form.data.role === 'User' && (
        <label className="block text-sm">
          <span className="text-white/80">Assign Runner (optional)</span>
          <select
            name="runner_id"
            value={form.data.runner_id || ''}
            onChange={(e)=>form.setData('runner_id', e.target.value || '')}
            className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2"
          >
            <option value="">— none —</option>
            {runners.map(r => <option key={r.id} value={r.id}>{r.username}</option>)}
          </select>
        </label>
      )}

      <button disabled={form.processing}
              className="w-full rounded-lg bg-cyan-400 text-black font-semibold py-2.5 hover:brightness-110 disabled:opacity-60">
        {form.processing ? 'Creating…' : 'Create Invite'}
      </button>

      {form.errors.role && <p className="text-rose-300 text-sm">{form.errors.role}</p>}
      {form.errors.runner_id && <p className="text-rose-300 text-sm">{form.errors.runner_id}</p>}
    </form>
  );
}

/* ------- Runner Settings (NEU) ------- */
function RunnerSettingsAdmin({ runners }) {
  const [q, setQ] = useState('');
  const list = Array.isArray(runners) ? runners : [];
  const filtered = useMemo(() => {
    if (!q.trim()) return list;
    const s = q.toLowerCase();
    return list.filter(r =>
      String(r.id).includes(s) ||
      String(r.username || r.name || '').toLowerCase().includes(s)
    );
  }, [list, q]);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Runner Settings</h2>
        <input
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          placeholder="Search runner by ID or name…"
          className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 outline-none focus:ring-2 focus:ring-cyan-400 w-64"
        />
      </div>

      <div className="overflow-x-auto no-scrollbar border border-white/10 rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-white/80">
            <tr>
              <Th className="w-20">ID</Th>
              <Th>Runner</Th>
              <Th>Current Limits</Th>
              <Th>Update</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-t border-white/10">
                <Td>{r.id}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-white/10 grid place-items-center text-xs">
                      {(r.username || r.name || 'R').slice(0,2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.username || r.name || '—'}</div>
                      <div className="text-xs text-white/60 truncate">#{r.id}</div>
                    </div>
                  </div>
                </Td>
                <Td className="font-mono text-white/80">
                  Daily: {Number(r.runner_daily_limit ?? 0).toFixed(2)} €
                  <span className="text-white/40"> · </span>
                  Per-User/Tag: {Number(r.runner_per_user_limit ?? 0).toFixed(2)} €
                </Td>
                <Td>
                  <RunnerLimitsForm user={r} />
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-white/60">No runners found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------- RunnerLimitsForm ------- */
function RunnerLimitsForm({ user }) {
  const form = useForm({
    runner_daily_limit: user?.runner_daily_limit ?? 1000,
    runner_per_user_limit: user?.runner_per_user_limit ?? 500,
  });

  const save = () => {
    const action = routeUrl(
      'admin.runners.updateLimits',
      (id) => `/admin/runners/${id}/limits`,
      user.id
    );
    form.post(action, { preserveScroll: true });
  };

  const daily = Number(form.data.runner_daily_limit ?? 0);
  const perUser = Number(form.data.runner_per_user_limit ?? 0);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col">
        <label className="text-xs text-white/70">Daily Limit (€)</label>
        <input
          type="number" min="0" step="0.01"
          value={form.data.runner_daily_limit}
          onChange={(e)=>form.setData('runner_daily_limit', e.target.value)}
          className="w-28 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-white/70">Per User / Tag (€)</label>
        <input
          type="number" min="0" step="0.01"
          value={form.data.runner_per_user_limit}
          onChange={(e)=>form.setData('runner_per_user_limit', e.target.value)}
          className="w-32 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"
        />
      </div>
      <button
        onClick={save}
        disabled={form.processing}
        className="px-3 py-1.5 rounded-lg bg-cyan-400 text-black text-sm font-semibold hover:brightness-110 disabled:opacity-60"
      >
        Save Limits
      </button>

      {(form.errors.runner_daily_limit || form.errors.runner_per_user_limit) && (
        <div className="basis-full text-rose-300 text-xs mt-1">
          {form.errors.runner_daily_limit || form.errors.runner_per_user_limit}
        </div>
      )}

      <div className="basis-full text-[11px] text-white/60 mt-1">
        Aktuelle Werte: Daily {daily.toFixed(2)} € · Per-User/Tag {perUser.toFixed(2)} €
      </div>
    </div>
  );
}

/* ------- Shared UI bits ------- */
function KpiCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0f1f33] to-[#0b1626] p-5">
      <div className="text-sm text-white/70">{label}</div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight">{value}</div>
    </div>
  );
}
function ComingSoon({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0f1f33] to-[#0b1626] p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-white/70 text-sm">{children}</p>
    </div>
  );
}
function Alert({ tone='info', children }) {
  const map = {
    success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
    danger: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
    info: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200',
  };
  return <div className={`rounded-xl border px-3 py-2 ${map[tone]}`}>{children}</div>;
}
function Th({ children, className='' }) { return <th className={`text-left p-2 font-semibold ${className}`}>{children}</th>; }
function Td({ children, className='' }) { return <td className={`p-2 align-middle ${className}`}>{children}</td>; }

/* ------- Avatar / MenuCard / MenuItem wie in Welcome.jsx ------- */
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

/* ------- InviteResultCard (wie gehabt) ------- */
function InviteResultCard({ url }) {
  const [copied, setCopied] = React.useState(false);
  const [qrReady, setQrReady] = React.useState(false);
  const [qrFailed, setQrFailed] = React.useState(false);
  const canvasRef = React.useRef(null);

  // Externer Fallback-QR (keine Abhängigkeiten nötig)
  const fallbackQR = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&format=png&data=${encodeURIComponent(url)}`;

  // QR lokal über dynamische Lib erzeugen (wenn verfügbar)
  React.useEffect(() => {
    let cancelled = false;
    setQrReady(false);
    setQrFailed(false);

    (async () => {
      try {
        const mod = await import(/* @vite-ignore */ 'qrcode').catch(() => null);
        if (!mod || cancelled) throw new Error('qr-lib-missing');
        const QRCode = mod.default || mod;
        await QRCode.toCanvas(canvasRef.current, url, {
          errorCorrectionLevel: 'M',
          width: 224,
          margin: 1,
          color: { dark: '#000000', light: '#FFFFFF' }
        });
        if (!cancelled) setQrReady(true);
      } catch {
        if (!cancelled) setQrFailed(true);
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  const copy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(()=>setCopied(false), 1500);
    } catch {
      alert('Konnte den Link nicht automatisch kopieren. Markiere den Link und kopiere ihn manuell.');
    }
  };

  const downloadQR = () => {
    if (qrReady && canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'invite-qr.png';
      a.click();
    } else {
      const a = document.createElement('a');
      a.href = fallbackQR;
      a.download = 'invite-qr.png';
      a.click();
    }
  };

  const downloadLink = () => {
    const a = document.createElement('a');
    a.download = 'invite-link.txt';
    const blob = new Blob([url], { type: 'text/plain' });
    a.href = URL.createObjectURL(blob);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  };

  return (
    <div data-invite-result className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0f1f33] to-[#0b1626] p-5">
      <div className="text-sm text-white/70 mb-2">Invite-Link</div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex-1">
          <input
            type="text"
            readOnly
            value={url}
            onFocus={(e)=>e.target.select()}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-cyan-200 font-mono text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copy}
            className="px-3 py-2 rounded-lg bg-cyan-400 text-black text-sm font-semibold hover:brightness-110"
          >
            {copied ? 'Kopiert ✓' : 'Kopieren'}
          </button>
          <button
            onClick={downloadLink}
            className="px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white/90 text-sm hover:bg-white/15"
            title="Link als Datei speichern"
          >
            Als Datei
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        <div className="rounded-xl bg-white p-2 self-start">
          {qrReady && !qrFailed ? (
            <canvas ref={canvasRef} width={224} height={224} />
          ) : (
            <img
              src={fallbackQR}
              alt="Invite QR Code"
              width={224}
              height={224}
              className="block"
              crossOrigin="anonymous"
            />
          )}
        </div>

        <div className="flex-1">
          <div className="text-white/80 text-sm mb-2">
            Scanne den Code oder nutze den Link oben, um die Registrierung zu starten.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadQR}
              className="px-3 py-2 rounded-lg bg-emerald-400 text-black text-sm font-semibold hover:brightness-110"
            >
              QR als PNG speichern
            </button>
            <a
              href={fallbackQR}
              download="invite-qr.png"
              className="px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white/90 text-sm hover:bg-white/15"
              title="Direkt vom QR-Server laden"
            >
              Direkt laden
            </a>
          </div>

          <div className="text-[11px] text-white/60 mt-2">
            Hinweis: Lokal wird der QR per Canvas erzeugt. Falls die optionale QR-Lib nicht verfügbar ist,
            wird automatisch ein externer QR-Dienst verwendet.
          </div>
        </div>
      </div>
    </div>
  );
}
