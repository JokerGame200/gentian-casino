import React from 'react';
import { useForm, usePage } from '@inertiajs/react';

export default function RegisterInvite({ token }) {
  const { flash } = usePage().props;
  const { data, setData, post, processing, errors } = useForm({
    username: '',
    password: '',
    password_confirmation: ''
  });

  const submit = (e) => {
    e.preventDefault();
    post(`/invite/${token}`);
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Konto erstellen</h1>
      {flash?.error && <div className="text-red-600 mb-2">{flash.error}</div>}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm">Benutzername</label>
          <input className="w-full border p-2 rounded"
                 value={data.username}
                 onChange={e=>setData('username', e.target.value)} />
          {errors.username && <div className="text-red-600 text-sm">{errors.username}</div>}
        </div>
        <div>
          <label className="block text-sm">Passwort</label>
          <input type="password" className="w-full border p-2 rounded"
                 value={data.password}
                 onChange={e=>setData('password', e.target.value)} />
          {errors.password && <div className="text-red-600 text-sm">{errors.password}</div>}
        </div>
        <div>
          <label className="block text-sm">Passwort bestätigen</label>
          <input type="password" className="w-full border p-2 rounded"
                 value={data.password_confirmation}
                 onChange={e=>setData('password_confirmation', e.target.value)} />
        </div>
        <button disabled={processing} className="bg-black text-white rounded px-4 py-2">
          Registrieren
        </button>
      </form>
    </div>
  );
}
