import React from 'react';
import { useForm, router, usePage } from '@inertiajs/react';
import { useInertiaAutoRefresh } from '@/hooks/useInertiaAutoRefresh';

export default function RunnerUsersPage({ users }) {
  // 🔄 Alle 4s NUR die Users-Prop aktualisieren:
  useInertiaAutoRefresh(['users'], 4000);

  const { props } = usePage();
  const flashSuccess = props?.flash?.success;
  const flashError = props?.flash?.error;

  const list = Array.isArray(users?.data) ? users.data : (users || []);
  
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Meine Nutzer</h1>

      {(flashSuccess || flashError) && (
        <div>
          {flashSuccess && <div className="rounded border border-green-600/30 bg-green-50 px-3 py-2 text-green-700">{flashSuccess}</div>}
          {flashError &&   <div className="rounded border border-red-600/30 bg-red-50 px-3 py-2 text-red-700">{flashError}</div>}
        </div>
      )}

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">ID</th>
              <th className="text-left p-2">Username</th>
              <th className="text-left p-2">Balance</th>
              <th className="text-left p-2">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {list.map(u => <UserRow key={u.id} user={u} />)}
            {list.length === 0 && (
              <tr><td colSpan={4} className="p-3 text-center text-gray-500">Noch keine Nutzer zugewiesen.</td></tr>
            )}
          </tbody>
        </table>
      </div>

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
    </div>
  );
}

function UserRow({ user }) {
  const form = useForm({ amount: '' });

  const save = () => {
    const n = parseFloat(form.data.amount);
    if (isNaN(n) || n === 0) return;
    form.post(route('balance.update', user.id), {
      preserveScroll: true,
      onSuccess: () => form.setData('amount', ''),
    });
  };

  return (
    <tr className="border-t">
      <td className="p-2">{user.id}</td>
      <td className="p-2">{user.username}</td>
      <td className="p-2 font-mono">{Number(user.balance ?? 0).toFixed(2)}</td>
      <td className="p-2">
        <div className="flex items-center gap-2">
          <input
            name="amount"
            type="number"
            min="0.01"
            max="500"
            step="0.01"
            placeholder="Betrag (+, max. 500€)"
            value={form.data.amount}
            onChange={(e) => form.setData('amount', e.target.value)}
            className="border rounded px-2 py-1 w-28"
          />
          <button
            onClick={save}
            disabled={form.processing}
            className="px-2 py-1 rounded bg-green-600 text-white"
          >
            Speichern
          </button>
        </div>
        {form.errors.amount && <div className="text-red-600 text-xs mt-1">{form.errors.amount}</div>}
      </td>
    </tr>
  );
}
