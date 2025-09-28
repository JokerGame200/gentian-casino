import React, { useRef, useState, useEffect } from "react";
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Transition } from '@headlessui/react';
import { Link, useForm, usePage } from '@inertiajs/react';

export default function UpdateProfileInformation({ mustVerifyEmail, status, className = '' }) {
  const user = usePage().props.auth.user; // enthält avatar_url dank Middleware
  const fileRef = useRef();

  const { data, setData, patch, errors, processing, recentlySuccessful, reset, transform } = useForm({
    name: user.name || '',
    email: user.email || '',
    avatar: null,
    remove_avatar: false,
  });

  // Vorschau-URL (Start = aktuelle avatar_url oder Fallback)
  const [preview, setPreview] = useState(user.avatar_url);

  useEffect(() => {
    // Revoke Object URLs on unmount
    return () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview); };
  }, [preview]);

  const onFileChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    setData('avatar', file);
    setData('remove_avatar', false);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    }
  };

  const onRemoveClick = () => {
    // Entfernen vormerken (Backend setzt avatar=null)
    setData('avatar', null);
    setData('remove_avatar', true);
    fileRef.current.value = '';
    // Fallback auf Initialen-SVG
    const params = new URLSearchParams({ name: user.name || 'User', s: 128 });
    setPreview(route('avatar.placeholder') + '?' + params.toString());
  };

  // Wichtig: forceFormData = true, damit Inertia multipart sendet
  const submit = (e) => {
    e.preventDefault();
    patch(route('profile.update'), {
      forceFormData: true,
      preserveScroll: true,
      onSuccess: () => {
        // wenn erfolgreich & es war ein Blob, Objekt-URL aufräumen
        if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
      }
    });
  };

  return (
    <section className={className}>
      <header>
        <h2 className="text-lg font-medium text-gray-900">Profile Information</h2>
        <p className="mt-1 text-sm text-gray-600">
          Update your account's profile information, avatar and email address.
        </p>
      </header>

      <form onSubmit={submit} className="mt-6 space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <img
            src={preview}
            alt="Avatar preview"
            className="h-20 w-20 rounded-full ring-2 ring-amber-500/40 object-cover bg-gray-100"
          />
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              id="avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFileChange}
              className="block w-full text-sm text-gray-900 file:me-4 file:rounded-md file:border-0 file:bg-amber-600 file:px-3 file:py-2 file:text-white hover:file:bg-amber-700"
            />
            <button
              type="button"
              onClick={onRemoveClick}
              className="text-sm text-gray-700 underline hover:text-gray-900 self-start"
            >
              Avatar entfernen (Initialen verwenden)
            </button>
            <InputError className="mt-2" message={errors.avatar} />
          </div>
        </div>

        {/* Name */}
        <div>
          <InputLabel htmlFor="name" value="Name" />
          <TextInput
            id="name"
            className="mt-1 block w-full"
            value={data.name}
            onChange={(e) => setData('name', e.target.value)}
            required
            isFocused
            autoComplete="name"
          />
          <InputError className="mt-2" message={errors.name} />
        </div>

        {/* Email */}
        <div>
          <InputLabel htmlFor="email" value="Email" />
          <TextInput
            id="email"
            type="email"
            className="mt-1 block w-full"
            value={data.email}
            onChange={(e) => setData('email', e.target.value)}
            required
            autoComplete="username"
          />
          <InputError className="mt-2" message={errors.email} />
        </div>

        {mustVerifyEmail && user.email_verified_at === null && (
          <div>
            <p className="mt-2 text-sm text-gray-800">
              Your email address is unverified.
              <Link
                href={route('verification.send')}
                method="post"
                as="button"
                className="ms-2 rounded-md text-sm text-gray-600 underline hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                Resend verification email
              </Link>
            </p>
            {status === 'verification-link-sent' && (
              <div className="mt-2 text-sm font-medium text-green-600">
                A new verification link has been sent to your email address.
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-4">
          <PrimaryButton disabled={processing}>Save</PrimaryButton>
          <Transition
            show={recentlySuccessful}
            enter="transition ease-in-out"
            enterFrom="opacity-0"
            leave="transition ease-in-out"
            leaveTo="opacity-0"
          >
            <p className="text-sm text-gray-600">Saved.</p>
          </Transition>
        </div>
      </form>
    </section>
  );
}
