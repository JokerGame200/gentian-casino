// resources/js/Components/GameOverlay.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { postJson } from '@/utils/api';

export default function GameOverlay() {
  // frame = { url, withoutFrame: '0' | '1' }
  const [frame, setFrame] = useState(null);
  const [notice, setNotice] = useState(null);
  const scrollRef = useRef(0);
  const openingRef = useRef(false);
  const noticeDelayRef = useRef(null);
  const noticeHideRef = useRef(null);
  const clearNoticeTimers = useCallback(() => {
    if (noticeDelayRef.current) {
      clearTimeout(noticeDelayRef.current);
      noticeDelayRef.current = null;
    }
    if (noticeHideRef.current) {
      clearTimeout(noticeHideRef.current);
      noticeHideRef.current = null;
    }
  }, []);
  const dismissNotice = useCallback(() => {
    clearNoticeTimers();
    setNotice(null);
  }, [clearNoticeTimers]);
  const showNotice = useCallback((message, { delay = 0, duration = 9000 } = {}) => {
    clearNoticeTimers();
    const reveal = () => {
      setNotice(message);
      if (duration > 0) {
        noticeHideRef.current = setTimeout(() => {
          dismissNotice();
        }, duration);
      }
    };
    if (delay > 0) {
      noticeDelayRef.current = setTimeout(() => {
        reveal();
        noticeDelayRef.current = null;
      }, delay);
    } else {
      reveal();
    }
  }, [clearNoticeTimers, dismissNotice]);
  useEffect(() => () => {
    clearNoticeTimers();
  }, [clearNoticeTimers]);

  // --- Open a game (only one at a time) ---
  const openGame = useCallback(async (gameId, options = {}) => {
    if (openingRef.current) {
      return;
    }
    if (frame) {
      showNotice({
        title: 'A game is already open',
        body: 'Please close the current game window before launching another one.',
      }, { delay: 500 });
      return;
    }

    openingRef.current = true;
    dismissNotice();
    try {
      const data = await postJson('/api/games/open', { gameId, demo: !!options.demo });
      if (!data || typeof data !== 'object') {
        throw new Error('The game could not be opened.');
      }
      if (data?.status !== 'success') {
        const err = new Error(data?.error || 'The game could not be opened.');
        err.data = data;
        throw err;
      }

      // If embedding is not allowed -> redirect directly
      if (String(data.withoutFrame) === '1') {
        window.location.assign(data.url);
        return;
      }

      // Freeze the page beneath the game and remember scroll position
      scrollRef.current = window.scrollY || 0;
      document.body.classList.add('game-open');
      document.documentElement.classList.add('game-open');

      // Wire the browser Back button to close the game
      history.pushState({ game: true }, '');

      setFrame({ url: data.url, withoutFrame: '0' });
    } catch (e) {
      const errorCode = e?.data?.error || e?.message || '';
      if (e?.status === 423 || errorCode === 'active_game_in_progress') {
        showNotice({
          title: 'Another game is already running',
          body: 'Please close the other game tab before starting a new one.',
        }, { delay: 700 });
      } else {
        showNotice({
          title: 'We couldn’t open the game',
          body: 'Please refresh the page or try again in a moment.',
        }, { delay: 300 });
      }
    } finally {
      openingRef.current = false;
    }
  }, [dismissNotice, frame, showNotice]);

  // --- Expose globally so Welcome.jsx can use the overlay ---
  useEffect(() => {
    window.openGameViaOverlay = (gameId, options = {}) => openGame(gameId, options);
    return () => {
      try { delete window.openGameViaOverlay; } catch {}
    };
  }, [openGame]);

  // --- Close the game ---
  const closeGame = useCallback(() => {
    setFrame(null);
    document.body.classList.remove('game-open');
    document.documentElement.classList.remove('game-open');

    // Restore scroll position
    try { window.scrollTo({ top: scrollRef.current || 0, behavior: 'auto' }); } catch {}

    // If a history entry for the game was added, go back
    if (history.state?.game) {
      try { history.back(); } catch {}
    }
  }, []);

  // --- Handle messages from the iFrame (postMessage) ---
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

  // --- ESC closes the game ---
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && frame) closeGame();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [frame, closeGame]);

  // --- Browser back: close the game instead of leaving the page ---
  useEffect(() => {
    const onPop = () => {
      if (frame) closeGame();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [frame, closeGame]);

  return (
    <>
      {notice && (
        <div className="pointer-events-none fixed top-6 left-1/2 z-[11000] w-full max-w-md -translate-x-1/2 px-4">
          <div className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-white/10 bg-[#102238]/95 px-5 py-4 shadow-xl backdrop-blur">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-200 text-lg font-semibold">
              !
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-white/95">{notice.title}</p>
              <p className="mt-1 text-sm text-white/70">{notice.body}</p>
            </div>
            <button
              type="button"
              onClick={dismissNotice}
              className="ml-2 rounded-full p-1 text-white/60 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
              aria-label="Close message"
            >
              ×
            </button>
          </div>
        </div>
      )}
      {frame && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90"
          // Clicking the dark backdrop closes the game
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
      )}
    </>
  );
}
