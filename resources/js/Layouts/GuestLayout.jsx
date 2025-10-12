import React from 'react';
import { Head } from '@inertiajs/react';

export default function GuestLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Head>
        <link rel="preload" as="image" href="/img/play4cash-logo-horizontal.svg" type="image/svg+xml" />
      </Head>
      {children}
    </div>
  );
}
