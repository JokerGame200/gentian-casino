// resources/js/hooks/useMyBalance.js
import { useEffect, useState } from 'react';

export function useMyBalance(intervalMs = 4000) {
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    let stop = false;

    async function tick() {
      try {
        // Nutze Ziggy wenn vorhanden, sonst die fixe URL
        const url = (typeof window !== 'undefined' && typeof window.route === 'function')
          ? window.route('balance.me')
          : '/api/balance/me';

        const res = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        if (!res.ok) return;
        const json = await res.json();
        if (!stop) setBalance(json.balance);
      } catch (_) {}
    }

    tick(); // sofort
    const id = setInterval(tick, intervalMs);
    return () => { stop = true; clearInterval(id); };
  }, [intervalMs]);

  return balance;
}
