import React from 'react';
import { useForm, Link, usePage } from '@inertiajs/react';

export default function UsersPage({ users, runners }) {
  const { flash } = usePage().props;
  const inviteForm = useForm({ runner_id: '' });

  const invite = (e) => {
    e.preventDefault();
    inviteForm.post(route('admin.invite'));
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Benutzerverwaltung</h1>

      {flash?.invite_link && (
        <div className="p-3 bg-green-50 border rounded">
          Einladungslink: <a className="underline" href={flash.invite_link}>{flash.invite_link}</a>
        </div>
      )}

      <form onSubmit={invite} className="flex items-end gap-2">
        <div>
          <label className="block text-sm">Runner (optional)</label>
          <select className="border p-2 rounded"
                  value={inviteForm.data.runner_id ?? ''}
                  onChange={e=>inviteForm.setData('runner_id', e.target.value || '')}>
            <option value="">– kein Runner –</option>
            {runners.map(r => <option key={r.id} value={r.id}>{r.username}</option>)}
          </select>
        </div>
        <button disabled={inviteForm.processing} className="bg-black text-white rounded px-4 py-2">
          Einladungslink erzeugen
        </button>
      </form>

      <table className="w-full border">
        <thead><tr className="bg-gray-100">
          <th className="p-2 text-left">ID</th>
          <th className="p-2 text-left">Username</th>
          <th className="p-2 text-left">Balance</th>
          <th className="p-2 text-left">Runner</th>
          <th className="p-2">Aktionen</th>
        </tr></thead>
        <tbody>
        {users.data.map(u => (
          <tr key={u.id} className="border-t">
            <td className="p-2">{u.id}</td>
            <td className="p-2">{u.username}</td>
            <td className="p-2">{Number(u.balance).toFixed(2)}</td>
            <td className="p-2">{u.runner?.username ?? '–'}</td>
            <td className="p-2">
              <BalanceButtons userId={u.id} />
              <Link className="ml-2 underline text-sm" href={route('admin.users')}>
                Runner zuweisen
              </Link>
            </td>
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
}

function BalanceButtons({ userId }) {
  const formPlus = useForm({ amount: 10 });
  const formMinus = useForm({ amount: -10 });

  return (
    <>
      <button className="px-2 py-1 bg-green-600 text-white rounded text-sm"
              disabled={formPlus.processing}
              onClick={() => formPlus.post(route('balance.update',{user:userId}))}>
        +10
      </button>
      <button className="ml-2 px-2 py-1 bg-red-600 text-white rounded text-sm"
              disabled={formMinus.processing}
              onClick={() => formMinus.post(route('balance.update',{user:userId}))}>
        -10
      </button>
    </>
  );
}
