import React from 'react';
import { useForm, router, usePage } from '@inertiajs/react';

export default function UsersPage({ users, runners = [] }) {
  const { props } = usePage();
  const inviteLink = props?.flash?.invite_link;
  const flashSuccess = props?.flash?.success;
  const flashError = props?.flash?.error;

  // ========== Invite-Form ==========
  const invite = useForm({
    role: 'User',     // Invite-Typ
    runner_id: '',    // optional: Runner für User-Invite
  });

  const submitInvite = (e) => {
    e.preventDefault();
    invite.post(route('admin.invite'), { preserveScroll: true });
  };

  const list = Array.isArray(users?.data) ? users.data : (users || []);

  const copyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      alert('Link in die Zwischenablage kopiert.');
    } catch {
      // Fallback
      window.prompt('Zum Kopieren STRG+C benutzen:', inviteLink);
    }
  };

  return (
    <div className="space-y-8">
      {/* Flash-Messages */}
      {(flashSuccess || flashError || inviteLink) && (
        <div className="space-y-2">
          {flashSuccess && (
            <div className="rounded border border-green-600/30 bg-green-50 px-3 py-2 text-green-700">
              {flashSuccess}
            </div>
          )}
          {flashError && (
            <div className="rounded border border-red-600/30 bg-red-50 px-3 py-2 text-red-700">
              {flashError}
            </div>
          )}
          {inviteLink && (
            <div className="rounded border border-blue-600/30 bg-blue-50 px-3 py-3">
              <div className="text-sm font-semibold text-blue-800 mb-2">Invite-Link</div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="border rounded px-2 py-1 w-full"
                />
                <a
                  href={inviteLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 rounded bg-blue-600 text-white"
                >
                  Öffnen
                </a>
                <button
                  onClick={copyInvite}
                  className="px-2 py-1 rounded border border-blue-600 text-blue-700 hover:bg-blue-600 hover:text-white"
                >
                  Kopieren
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invite-Block */}
      <form onSubmit={submitInvite} className="space-y-3 border rounded p-3">
        <label className="block">
          <span className="text-sm">Einladungs-Typ</span>
          <select
            name="role"
            value={invite.data.role}
            onChange={(e) => invite.setData('role', e.target.value)}
            className="border rounded px-2 py-1 w-full"
          >
            <option value="User">User</option>
            <option value="Runner">Runner</option>
          </select>
        </label>

        {invite.data.role === 'User' && (
          <label className="block">
            <span className="text-sm">Optional: Runner zuweisen</span>
            <select
              name="runner_id"
              value={invite.data.runner_id || ''}
              onChange={(e) => invite.setData('runner_id', e.target.value || '')}
              className="border rounded px-2 py-1 w-full"
            >
              <option value="">– keiner / später zuweisen –</option>
              {runners.map((r) => (
                <option key={r.id} value={r.id}>{r.username}</option>
              ))}
            </select>
          </label>
        )}

        <button disabled={invite.processing} className="px-3 py-1 rounded bg-blue-600 text-white">
          Invite erstellen
        </button>

        {invite.errors.role && <div className="text-red-600 text-sm">{invite.errors.role}</div>}
        {invite.errors.runner_id && <div className="text-red-600 text-sm">{invite.errors.runner_id}</div>}
      </form>

      {/* Userverwaltung */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Userverwaltung</h2>
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-2">ID</th>
                <th className="text-left p-2">Username</th>
                <th className="text-left p-2">Rolle</th>
                <th className="text-left p-2">Runner</th>
                <th className="text-left p-2">Balance</th>
                <th className="text-left p-2">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <UserRow key={u.id} user={u} runners={runners} />
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-3 text-center text-gray-500">Keine Nutzer gefunden.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* (Optional) einfache Pagination: */}
        {users?.links && (
          <div className="flex gap-2 flex-wrap">
            {users.links.map((l, i) => (
              <button
                key={i}
                className={`px-2 py-1 rounded border ${l.active ? 'bg-gray-200' : ''}`}
                dangerouslySetInnerHTML={{ __html: l.label }}
                onClick={() => l.url && router.visit(l.url, { preserveScroll: true })}
                disabled={!l.url}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function UserRow({ user, runners }) {
  // ---------- Balance ändern ----------
  const balanceForm = useForm({ amount: '' });

  const doBalance = (sign) => {
    const raw = parseFloat(balanceForm.data.amount);
    if (isNaN(raw) || raw === 0) return;
    const amt = sign === 'plus' ? Math.abs(raw) : -Math.abs(raw);
    balanceForm.setData('amount', amt);
    balanceForm.post(route('balance.update', user.id), {
      preserveScroll: true,
      onSuccess: () => balanceForm.setData('amount', ''),
    });
  };

  // ---------- Runner zuweisen ----------
  const runnerForm = useForm({
    runner_id: user.runner_id ?? '',
  });

  const saveRunner = () => {
    runnerForm.post(route('admin.assignRunner', user.id), { preserveScroll: true });
  };

  // ---------- Rolle ändern ----------
  const roleForm = useForm({
    role: user.role ?? 'User',
  });

  const saveRole = () => {
    roleForm.post(route('admin.setRole', user.id), { preserveScroll: true });
  };

  // ---------- User löschen ----------
  const [deleting, setDeleting] = React.useState(false);
  const deleteUser = () => {
    if (!confirm(`User "${user.username}" wirklich löschen?`)) return;
    router.delete(route('admin.users.destroy', user.id), {
      preserveScroll: true,
      onStart: () => setDeleting(true),
      onFinish: () => setDeleting(false),
    });
  };

  return (
    <tr className="border-t">
      <td className="p-2">{user.id}</td>
      <td className="p-2">{user.username}</td>

      {/* Rolle */}
      <td className="p-2">
        <div className="flex items-center gap-2">
          <select
            name="role"
            value={roleForm.data.role}
            onChange={(e) => roleForm.setData('role', e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="User">User</option>
            <option value="Runner">Runner</option>
          </select>
          <button
            onClick={saveRole}
            disabled={roleForm.processing}
            className="px-2 py-1 rounded bg-amber-600 text-white"
          >
            Speichern
          </button>
        </div>
        {roleForm.errors.role && <div className="text-red-600 text-xs mt-1">{roleForm.errors.role}</div>}
      </td>

      {/* Runner */}
      <td className="p-2">
        <div className="flex items-center gap-2">
          <select
            name="runner_id"
            value={runnerForm.data.runner_id || ''}
            onChange={(e) => runnerForm.setData('runner_id', e.target.value || '')}
            className="border rounded px-2 py-1"
          >
            <option value="">— keiner —</option>
            {runners.map((r) => (
              <option key={r.id} value={r.id}>{r.username}</option>
            ))}
          </select>
          <button
            onClick={saveRunner}
            disabled={runnerForm.processing}
            className="px-2 py-1 rounded bg-indigo-600 text-white"
          >
            Speichern
          </button>
        </div>
        {runnerForm.errors.runner_id && <div className="text-red-600 text-xs mt-1">{runnerForm.errors.runner_id}</div>}
      </td>

      {/* Balance */}
      <td className="p-2 font-mono">{Number(user.balance ?? 0).toFixed(2)}</td>

      {/* Aktionen (nur „Speichern“ + Löschen) */}
      <td className="p-2">
        <div className="flex items-center gap-2">
          <input
            name="amount"
            type="number"
            step="0.01"
            placeholder="Betrag"
            value={balanceForm.data.amount}
            onChange={(e) => balanceForm.setData('amount', e.target.value)}
            className="border rounded px-2 py-1 w-28"
          />
          <button
            onClick={() => doBalance('plus')}
            disabled={balanceForm.processing}
            className="px-2 py-1 rounded bg-green-600 text-white"
            title="Guthaben speichern"
          >
            Speichern
          </button>
        </div>

        {/* Delete */}
        <div className="mt-2">
          <button
            onClick={deleteUser}
            disabled={deleting}
            className="px-2 py-1 rounded border border-red-600 text-red-700 hover:bg-red-600 hover:text-white"
            title="User löschen"
          >
            {deleting ? 'Löschen…' : 'Löschen'}
          </button>
        </div>
      </td>
    </tr>
  );
}
