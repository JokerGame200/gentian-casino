// resources/js/hooks/useInertiaAutoRefresh.js
import { useEffect, useRef } from 'react';
import { router } from '@inertiajs/react';

/**
 * Periodischer Inertia-Teilreload (keine ganze Seite, nur Props).
 * @param {string[]} only - Welche Props vom Server neu gezogen werden sollen.
 * @param {number} intervalMs - Intervall in ms.
 */
export function useInertiaAutoRefresh(only = [], intervalMs = 4000) {
  const running = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (running.current) return; // Überschneidungen vermeiden
      running.current = true;
      router.reload({
        only,
        preserveState: true,
        preserveScroll: true,
        onFinish: () => { running.current = false; },
      });
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs, JSON.stringify(only)]);
}
