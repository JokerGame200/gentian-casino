// resources/js/Pages/Admin/UsersPage.jsx
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

export default function AdminPanel({ users, runners = [], stats = {}, logs }) {
  const { props } = usePage();
  const user = props?.auth?.user || {};

  const balance = Number(user.balance ?? 0);
  const currency = user.currency ?? 'EUR';

  const formatCurrency = (v, cur) => {
    try { return new Intl.NumberFormat(undefined, { style:'currency', currency:cur }).format(v); }
    catch { return `${(Number(v)||0).toFixed(2)} ${cur}`; }
  };
  const initials = (() => {
    const name = user.name || '';
    const parts = name.trim().split(/\s+/).slice(0,2);
    return (parts.map(p=>p[0]?.toUpperCase()||'').join('')) || 'N2';
  })();

  const [tab, setTab] = useState('Users');

  const safeUsers = Array.isArray(users?.data) ? users.data : (users || []);
  const kpis = {
    users: stats.users ?? safeUsers.length ?? 0,
    runners: stats.runners ?? runners.length ?? 0,
    depositsToday: stats.deposits_today ?? 0,
    ggrToday: stats.ggr_today ?? 0,
  };

  return (
    <AuthenticatedLayout>
      <Head title="Admin Panel" />
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
            {tab === 'Settings' && (
              <ComingSoon title="Settings">Brand, Sprachen, Wartungsmodus, Feature-Toggles.</ComingSoon>
            )}
          </div>
        </main>
      </div>
    </AuthenticatedLayout>
  );
}

/* ============================ Header (Tabs, keine Navigation) ============================ */

function Header({ user, initials, balanceText, tab, setTab }) {
  const [openBal, setOpenBal] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    const onDoc = (e) => {
      if (!headerRef.current) return;
      if (!headerRef.current.contains(e.target)) { setOpenBal(false); setOpenProfile(false); }
    };
    const onEsc = (e) => { if (e.key === 'Escape') { setOpenBal(false); setOpenProfile(false); setDrawerOpen(false); } };
    document.addEventListener('click', onDoc);
    window.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('click', onDoc); window.removeEventListener('keydown', onEsc); };
  }, []);

  const tabs = [
    { key: 'Users', label: 'Users' },
    { key: 'Invites', label: 'Invites' },
    { key: 'Logs', label: 'Logs' },
    { key: 'Settings', label: 'Settings' },
  ];

  return (
    <div ref={headerRef} className="sticky top-0 z-50">
      {/* Top bar */}
      <div className={`relative z-20 ${scrolled ? 'bg-[#0b1b2b]/80' : 'bg-transparent'} backdrop-blur shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-14 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg font-semibold tracking-wide">Next2Win</span>
              <span className="text-xs ml-2 px-2 py-0.5 rounded bg-white/10 border border-white/10">Admin</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="sm:hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10"
                onClick={() => { setDrawerOpen(true); setOpenBal(false); setOpenProfile(false); }}
                aria-label="Open sections"
              >
                <DotsIcon /><span className="text-sm">Sections</span>
              </button>

              <div className="hidden sm:flex items-center gap-1 mr-2">
                <button
                  onClick={() => { setOpenBal(v=>!v); setOpenProfile(false); }}
                  aria-haspopup="menu" aria-expanded={openBal}
                  className="relative px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/25 hover:bg-emerald-500/25 text-emerald-100 text-sm"
                >
                  {balanceText}
                  {openBal && (
                    <MenuCard onClose={() => setOpenBal(false)}>
                      <MenuItem title="Deposit" href="/transactions/deposit" />
                      <MenuItem title="Withdraw" href="/transactions/withdraw" />
                      <MenuItem title="Transactions" href="/transactions" />
                    </MenuCard>
                  )}
                </button>
              </div>

              <button
                onClick={() => { setOpenProfile(v=>!v); setOpenBal(false); }}
                aria-haspopup="menu" aria-expanded={openProfile} aria-label="Profile menu"
                className="relative ml-1"
              >
                <Avatar imgUrl={user.profile_photo_url} initials={initials} />
                {openProfile && (
                  <MenuCard align="right" onClose={() => setOpenProfile(false)}>
                    <MenuItem title="Profile" href={routeUrl('profile.edit', '/profile')} />
                    <MenuItem title="Settings" href="/settings" />
                    <MenuItem title="Logout" href={routeUrl('logout', '/logout')} method="post" />
                  </MenuCard>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative z-10 bg-[#0b1b2b]/85 backdrop-blur border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="hidden sm:flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setOpenBal(false); setOpenProfile(false); }}
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

      {/* Mobile Drawer */}
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
              {['Users','Invites','Logs','Settings'].map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setDrawerOpen(false); }}
                  className={[
                    'px-3 py-2 rounded-xl text-sm text-left transition',
                    tab === t ? 'bg-cyan-500 text-black' : 'bg-white/5 hover:bg-white/10'
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
  const saveRole = () => {
    const action = routeUrl('admin.setRole', (id)=>`/admin/users/${id}/role/set`, user.id);
    roleForm.post(action, { preserveScroll: true });
  };

  const runnerForm = useForm({ runner_id: user.runner_id ?? '' });
  const saveRunner = () => {
    const action = routeUrl('admin.assignRunner', (id)=>`/admin/users/${id}/assign-runner`, user.id);
    runnerForm.post(action, { preserveScroll: true });
  };

  const balanceForm = useForm({ amount: '' });
  const doBalance = () => {
    const raw = parseFloat(balanceForm.data.amount);
    if (isNaN(raw) || raw === 0) return;
    const action = routeUrl('balance.update', (id)=>`/users/${id}/balance`, user.id);
    balanceForm.post(action, { preserveScroll: true, onSuccess: () => balanceForm.setData('amount','') });
  };

  const [deleting, setDeleting] = useState(false);
  const deleteUser = () => {
    if (!confirm(`Delete user "${user.username || user.name}"?`)) return;
    const action = routeUrl('admin.users.destroy', (id)=>`/admin/users/${id}`, user.id);
    router.delete(action, { preserveScroll: true, onStart:()=>setDeleting(true), onFinish:()=>setDeleting(false) });
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

      <Td>
        <div className="flex items-center gap-2">
          <select
            value={roleForm.data.role}
            onChange={(e)=>roleForm.setData('role', e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"
          >
            <option value="User">User</option>
            <option value="Runner">Runner</option>
            <option value="Admin">Admin</option>
          </select>
          <button onClick={saveRole} disabled={roleForm.processing}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-400 text-black text-sm font-semibold hover:brightness-110 disabled:opacity-60">
            Save
          </button>
        </div>
        {roleForm.errors.role && <div className="text-rose-300 text-xs mt-1">{roleForm.errors.role}</div>}
      </Td>

      <Td>
        <div className="flex items-center gap-2">
          <select
            value={runnerForm.data.runner_id || ''}
            onChange={(e)=>runnerForm.setData('runner_id', e.target.value || '')}
            className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5"
          >
            <option value="">— none —</option>
            {runners.map(r => <option key={r.id} value={r.id}>{r.username}</option>)}
          </select>
          <button onClick={saveRunner} disabled={runnerForm.processing}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-400 text-black text-sm font-semibold hover:brightness-110 disabled:opacity-60">
            Save
          </button>
        </div>
        {runnerForm.errors.runner_id && <div className="text-rose-300 text-xs mt-1">{runnerForm.errors.runner_id}</div>}
      </Td>

      <Td className="text-right font-mono">{Number(user.balance ?? 0).toFixed(2)}</Td>

      <Td>
        <div className="flex flex-wrap items-center gap-2">
          <input type="number" step="0.01" placeholder="Amount"
                 value={balanceForm.data.amount}
                 onChange={(e)=>balanceForm.setData('amount', e.target.value)}
                 className="w-28 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5" max="500" />
          <button onClick={doBalance} disabled={balanceForm.processing}
                  className="px-2.5 py-1.5 rounded-lg bg-green-400 text-black text-sm font-semibold hover:brightness-110 disabled:opacity-60"
                  title="Apply balance change">
            Apply
          </button>
          <button onClick={deleteUser} disabled={deleting}
                  className="px-2.5 py-1.5 rounded-lg border border-rose-400 text-rose-300 hover:bg-rose-400/10 text-sm">
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
  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold">Invites</h2>
      <InviteForm runners={runners} />
      <div className="rounded-xl border border-white/10 p-4 bg-white/5 text-white/80">
        Tip: Du findest den erzeugten Invite-Link jeweils in den Flash-Messages nach dem Erstellen.
      </div>
    </section>
  );
}

function InviteForm({ runners }) {
  const form = useForm({ role: 'User', runner_id: '' });
  const submit = (e) => {
    e.preventDefault();
    const action = routeUrl('admin.invite', '/admin/invite');
    form.post(action, { preserveScroll: true });
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
function Avatar({ imgUrl, initials }) {
  return imgUrl
    ? <img src={imgUrl} alt="" aria-label="Profile avatar" className="h-9 w-9 rounded-full object-cover ring-2 ring-white/10" loading="lazy" />
    : <div aria-label="Profile avatar" className="h-9 w-9 rounded-full grid place-items-center bg-gradient-to-br from-cyan-400/80 to-emerald-400/80 text-black font-bold ring-2 ring-white/10">{initials}</div>;
}
function MenuCard({ children, align='left', onClose }) {
  return (
    <div role="menu" className={`absolute z-[80] mt-2 ${align === 'right' ? 'right-0' : 'left-0'} w-48 rounded-xl bg-[#0f2236] border border-white/10 shadow-lg overflow-hidden`} onClick={onClose}>
      <div className="py-1">{children}</div>
    </div>
  );
}
function MenuItem({ title, href, method }) {
  if (href) return <Link href={href} method={method} as="button" className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition">{title}</Link>;
  return <button className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition">{title}</button>;
}
function DotsIcon() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>); }
function XIcon() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>); }
