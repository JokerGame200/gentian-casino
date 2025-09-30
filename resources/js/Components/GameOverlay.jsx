// resources/js/Components/GameOverlay.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { postJson } from '@/utils/api';

export default function GameOverlay() {
  // frame = { url, withoutFrame: '0' | '1' }
  const [frame, setFrame] = useState(null);
  const scrollRef = useRef(0);

  // --- Spiel öffnen (ein Spiel gleichzeitig) ---
  const openGame = useCallback(async (gameId, options = {}) => {
    if (frame) return; // block: nur 1 Spiel gleichzeitig

    try {
      const res = await postJson('/api/games/open', { gameId, demo: !!options.demo });
      const data = await res.json();

      if (data?.status !== 'success') {
        throw new Error(data?.error || 'Spiel konnte nicht geöffnet werden.');
      }

      // Wenn Einbettung nicht erlaubt -> direkt weiterleiten
      if (String(data.withoutFrame) === '1') {
        window.location.assign(data.url);
        return;
      }

      // Seite "unter" dem Spiel einfrieren & Scrollposition merken
      scrollRef.current = window.scrollY || 0;
      document.body.classList.add('game-open');
      document.documentElement.classList.add('game-open');

      // Back-Button so verdrahten, dass er das Spiel schließt
      history.pushState({ game: true }, '');

      setFrame({ url: data.url, withoutFrame: '0' });
    } catch (e) {
      alert(e?.message || 'Spiel konnte nicht geöffnet werden.');
    }
  }, [frame]);

  // --- global verfügbar machen, damit z.B. Welcome.jsx das Overlay nutzen kann ---
  useEffect(() => {
    window.openGameViaOverlay = (gameId, options = {}) => openGame(gameId, options);
    return () => {
      try { delete window.openGameViaOverlay; } catch {}
    };
  }, [openGame]);

  // --- Spiel schließen ---
  const closeGame = useCallback(() => {
    setFrame(null);
    document.body.classList.remove('game-open');
    document.documentElement.classList.remove('game-open');

    // Scrollposition zurück
    try { window.scrollTo({ top: scrollRef.current || 0, behavior: 'auto' }); } catch {}

    // Falls wir einen History-Eintrag für das Spiel gesetzt haben -> wieder zurück
    if (history.state?.game) {
      try { history.back(); } catch {}
    }
  }, []);

  // --- Messages aus dem iFrame abfangen (postMessage) ---
  useEffect(() => {
    const onMsg = (event) => {
      const d = event.data;
      if (
        d === 'closeGame' ||
        d === 'close' ||
        d === 'notifyCloseContainer' ||
        (typeof d === 'string' && d.includes('GAME_MODE:LOBBY')) ||
        (d && typeof d === 'object' && d.closeGame !== undefined)
      ) {
        closeGame();
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [closeGame]);

  // --- ESC schließt Spiel ---
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && frame) closeGame();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [frame, closeGame]);

  // --- Browser-Zurück: schließt Spiel statt Seite zu verlassen ---
  useEffect(() => {
    const onPop = () => {
      if (frame) closeGame();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [frame, closeGame]);

  if (!frame) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90"
      // Klick auf den dunklen Hintergrund schließt das Spiel
      onClick={(e) => { if (e.target === e.currentTarget) closeGame(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Game overlay"
    >
      <div className="absolute top-2 right-3">
        <button
          onClick={closeGame}
          className="text-white text-2xl px-3 py-1.5 rounded hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
          aria-label="Close game"
          type="button"
        >
          ✕
        </button>
      </div>

      <div id="gameFrame" className="w-full h-full">
        <iframe
          title="Game"
          src={frame.url}
          className="w-full h-full"
          frameBorder="0"
          allow="fullscreen; clipboard-read; clipboard-write; autoplay"
          allowFullScreen
        />
      </div>
    </div>
  );
}
