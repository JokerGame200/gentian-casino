// resources/js/Layouts/AuthenticatedLayout.jsx
import React from 'react';
import { Head } from '@inertiajs/react';
import GameOverlay from '@/Components/GameOverlay';

export default function AuthenticatedLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-900">
      <Head>
        <link rel="preload" as="image" href="/img/play4cash-logo-horizontal.svg" type="image/svg+xml" />
      </Head>
      {children}
      {/* Overlay global einmal rendern */}
      <GameOverlay />

      {/* Scroll auf der Seite sperren, wenn ein Spiel offen ist */}
      <style>{`
        html.game-open, body.game-open { overflow: hidden !important; }
      `}</style>
    </div>
  );
}
