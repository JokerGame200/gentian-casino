// resources/js/Pages/Welcome.jsx
import React, {
  memo, useCallback, useEffect, useLayoutEffect, useMemo,
  useRef, useState, useDeferredValue
} from 'react';
import { Head, usePage, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

/* ------------------------------ CSS ------------------------------ */
const PERF_CSS = `
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
.touch-momentum { -webkit-overflow-scrolling: touch; }
html, body { background-color: #0a1726; min-height: 100%; }
@supports (content-visibility: auto) {
  .island { content-visibility: auto; contain-intrinsic-size: 800px 450px; }
}
@media (prefers-reduced-motion: reduce) {
  .scroll-smooth { scroll-behavior: auto !important; }
}
.body-game-open { overflow: hidden; touch-action: none; }
:root { --viewport-vh: 100vh; --overlay-vh: 100vh; }
@supports (height: 100dvh) {
  :root { --viewport-vh: 100dvh; --overlay-vh: 100dvh; }
}
.overlay-fullscreen {
  width: 100vw;
  height: var(--overlay-vh, var(--viewport-vh, 100vh));
  min-height: var(--overlay-vh, var(--viewport-vh, 100vh));
}
`;

const PROVIDER_TABS = [
  'Home','All','rubyplay','hacksaw','3oaks','aristocrat','egaming','pragmatic','microgaming','novomatic',
  'jili','scientific_games','booming','firekirin','pgsoft','zitro','playngo','amatic','apollo',
  'fish','kajot','vegas','ainsworth','quickspin','NetEnt','habanero','igt','igrosoft','apex',
  'merkur','wazdan','egt','roulette','bingo','keno','table_games'
];

const NUMBER_WORD_MAP = {
  zero: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9',
};
const extractSlugParts = (slug) => {
  const s = slug || '';
  return {
    letters: s.replace(/[^a-z]/g, ''),
    digits: s.replace(/[^0-9]/g, ''),
  };
};
const normalizeSlug = (value) => {
  const normalized = stableProvider(value);
  if (!normalized) return '';
  const numericWordsReplaced = normalized.replace(
    /\b(zero|one|two|three|four|five|six|seven|eight|nine)\b/g,
    (match) => NUMBER_WORD_MAP[match] ?? match
  );
  return numericWordsReplaced
    .replace(/\s+/g, '')
    .replace(/zero|one|two|three|four|five|six|seven|eight|nine/g, (match) => NUMBER_WORD_MAP[match] ?? match);
};
const matchesProviderSlug = (providerSlug, tabSlug) => {
  if (!providerSlug || !tabSlug) return false;
  if (providerSlug === tabSlug) return true;
  if (providerSlug.startsWith(tabSlug)) return true;
  if (tabSlug.startsWith(providerSlug)) return true;
  if (providerSlug.includes(tabSlug)) return true;
  if (tabSlug.includes(providerSlug)) return true;
  const provParts = extractSlugParts(providerSlug);
  const tabParts = extractSlugParts(tabSlug);
  if (provParts.letters === tabParts.letters && provParts.digits === tabParts.digits) return true;
  return false;
};

const CATEGORY_PAGE_SIZE = 25;

const hasWindow = typeof window !== 'undefined';
const hasNavigator = typeof navigator !== 'undefined';
const hasDocument = typeof document !== 'undefined';
const nav = hasNavigator ? navigator : undefined;

const isIOSDevice = !!nav && (
  /iP(ad|hone|od)/.test(nav.userAgent || '') ||
  (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
);
const supportsResizeObserver = hasWindow && 'ResizeObserver' in window;
const supportsIntersectionObserver = hasWindow && 'IntersectionObserver' in window;
const supportsNativeSmoothScroll = (() => {
  if (!hasDocument || !document.documentElement) return false;
  try {
    return 'scrollBehavior' in document.documentElement.style;
  } catch {
    return false;
  }
})();

/* ------------------------------ Utils ------------------------------ */
function useRafThrottle(fn) {
  const frame = useRef(0), lastArgs = useRef([]), saved = useRef(fn);
  useEffect(() => { saved.current = fn; }, [fn]);
  const cb = useCallback((...args) => {
    lastArgs.current = args;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => { frame.current = 0; saved.current(...lastArgs.current); });
  }, []);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return cb;
}
function useMeasure() {
  const ref = useRef(null);
  const [rect, setRect] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const readRect = () => {
      const width = el.offsetWidth || el.clientWidth || 0;
      const height = el.offsetHeight || el.clientHeight || 0;
      setRect((prev) => (prev.width === width && prev.height === height) ? prev : { width, height });
    };

    readRect();

    if (supportsResizeObserver) {
      const ro = new ResizeObserver(() => readRect());
      ro.observe(el);
      return () => ro.disconnect();
    }

    if (hasWindow) {
      window.addEventListener('resize', readRect, { passive: true });
      return () => window.removeEventListener('resize', readRect);
    }
  }, []);
  return [ref, rect];
}
function useWindowSize() {
  const [s, setS] = useState({ w: typeof window !== 'undefined' ? window.innerWidth : 0, h: typeof window !== 'undefined' ? window.innerHeight : 0 });
  const onResize = useRafThrottle(() => setS({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => { window.addEventListener('resize', onResize, { passive: true }); return () => window.removeEventListener('resize', onResize); }, [onResize]);
  return s;
}

/* ------------------------------ Image utils ------------------------------ */
const TRANSPARENT_PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y1Q7u8AAAAASUVORK5CYII=';
const IMAGE_PREFETCH_CACHE = new Set();

const LazyImage = memo(function LazyImage({
  src,
  alt,
  className,
  style,
  loading = 'lazy',
  fetchPriority = 'low',
}) {
  const imgRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  useEffect(() => {
    const el = imgRef.current; if (!el) return;
    if (!supportsIntersectionObserver) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { setInView(true); io.disconnect(); break; }
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const targetOpacity = inView && loaded ? 1 : 0.25;

  return (
    <img
      ref={imgRef}
      src={inView ? src : TRANSPARENT_PX}
      alt={alt}
      className={className}
      style={{
        opacity: targetOpacity,
        transition: 'opacity 160ms ease-out',
        willChange: 'opacity',
        ...style,
      }}
      loading={loading}
      decoding="async"
      fetchpriority={fetchPriority}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(true)}
    />
  );
});

/* ---------- Normalisierung & Dedupe (fehlte in der letzten Version) ---------- */
const normalizeName = (s) => String(s ?? '')
  .toLowerCase()
  .replace(/[™®©]/g, '')
  .replace(/\b(deluxe|classic|cash\s*link|dx|hd|xxl|gold|megaways|mega\s*ways)\b/g, '')
  .replace(/[-_.:/\\]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const stableProvider = (s) => String(s ?? '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const isMeaningfulUrl = (u) => {
  if (!u) return false;
  const s = String(u).trim();
  if (!s || s === 'null' || s === 'undefined') return false;
  if (s.startsWith('data:') && s.length < 64) return false;
  return true;
};
const getName     = (g) => g?.name ?? g?.title ?? g?.display_name ?? g?.gameName ?? g?.label ?? g?.text ?? '';
const getProvider = (g) => g?.provider ?? g?.vendor ?? g?.studio ?? g?.brand ?? g?.providerName ?? '';
const pickImage = (g) => {
  const cands = [g?.img, g?.game_img_2, g?.game_img, g?.image2, g?.image, g?.img2, g?.thumb, g?.thumbnail, g?.logo, g?.icon, g?.images?.large, g?.images?.thumb, g?.assets?.thumb, g?.assets?.image];
  for (const x of cands) if (isMeaningfulUrl(x)) return String(x);
  return TRANSPARENT_PX;
};
const isHttpUrl = (src) => /^https?:/i.test(src || '');

function usePrefetchImages(games, options = {}) {
  const {
    initialCount = 32,
    range = null,
    buffer = 24,
    onlyIOS = true,
  } = options;
  const trackersRef = useRef([]);

  useEffect(() => () => {
    trackersRef.current = [];
  }, []);

  const queueImage = useCallback((candidate) => {
    if (!isMeaningfulUrl(candidate) || !isHttpUrl(candidate)) return;
    if (IMAGE_PREFETCH_CACHE.has(candidate)) return;
    if (typeof Image === 'undefined') return;
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'lazy';
    img.src = candidate;
    trackersRef.current.push(img);
    IMAGE_PREFETCH_CACHE.add(candidate);
  }, []);

  useEffect(() => {
    if ((onlyIOS && !isIOSDevice) || !Array.isArray(games) || games.length === 0) return;
    let count = 0;
    for (const game of games) {
      queueImage(pickImage(game));
      count += 1;
      if (count >= initialCount) break;
    }
  }, [games, initialCount, onlyIOS, queueImage]);

  useEffect(() => {
    if ((onlyIOS && !isIOSDevice) || !range || !Array.isArray(games) || games.length === 0) return;
    const startIdx = Math.max(0, range.start - buffer);
    const endIdx = Math.min(games.length - 1, range.end + buffer);
    for (let i = startIdx; i <= endIdx; i += 1) {
      queueImage(pickImage(games[i]));
    }
  }, [games, range?.start, range?.end, buffer, onlyIOS, queueImage]);
}
const buildKeyCandidates = (g) => {
  const idCands = [g?.uid, g?.uuid, g?.game_id, g?.sys_id, g?.id, g?.slug, g?.code, g?.key, g?.external_id].filter(v => v != null);
  const nameN = normalizeName(getName(g));
  const provN = stableProvider(getProvider(g));
  const keys = [
    ...idCands.map(v => `id:${String(v)}`),
    (provN && nameN) ? `provname:${provN}#${nameN}` : null,
    nameN ? `name:${nameN}` : null,
  ].filter(Boolean);
  return { keys, nameN, provN };
};
const hasBetterThumb = (a, b) => {
  const ia = String(a?.img || ''), ib = String(b?.img || '');
  const ph = (x) => !isMeaningfulUrl(x) || x.startsWith('data:');
  if (ph(ia) && !ph(ib)) return false;
  if (!ph(ia) && ph(ib)) return true;
  return ia.length >= ib.length;
};
function normalizeAndDedupe(list) {
  const map = new Map(); const reserved = new Set();
  for (const raw of list) {
    const name = String(getName(raw) || '').trim();
    const provider = String(getProvider(raw) || '').trim();
    const img = pickImage(raw);
    const { keys, nameN, provN } = buildKeyCandidates(raw);
    const nameLower = name.toLowerCase();
    const providerLower = provider.toLowerCase();
    const searchText = [nameLower, providerLower, nameN, provN].filter(Boolean).join('|');
    const norm = {
      ...raw,
      name,
      provider,
      img,
      _nameN: nameN,
      _provN: provN,
      _providerL: providerLower,
      _searchText: searchText,
    };

    let bucketKey = null;
    for (const k of keys) if (map.has(k)) { bucketKey = k; break; }
    if (!bucketKey) for (const k of keys) if (!reserved.has(k)) { bucketKey = k; break; }
    if (!bucketKey) bucketKey = provN && nameN ? `provname:${provN}#${nameN}` : (nameN || `rand:${Math.random().toString(36).slice(2)}`);

    const prev = map.get(bucketKey);
    if (!prev) { map.set(bucketKey, norm); keys.forEach(k => reserved.add(k)); }
    else { if (!hasBetterThumb(prev, norm)) map.set(bucketKey, norm); keys.forEach(k => reserved.add(k)); }
  }
  return [...map.values()];
}

/* ------------------------------ Seite ------------------------------ */
export default function Welcome() {
  const { props } = usePage();
  const user = props?.auth?.user || {};
  const preconnectRef = useRef(new Set());
  const viewportVarsRef = useRef({ height: 0 });
  const windowSize = useWindowSize();
  const isCompactLayout = windowSize.w ? windowSize.w < 768 : false;
  const prefetchInitial = isCompactLayout ? 24 : 64;
  const syncViewportVars = useCallback(() => {
    if (!hasWindow || !hasDocument) return;
    const visualViewport = window.visualViewport;
    const rawHeight = visualViewport?.height ?? window.innerHeight;
    const viewportHeight = Math.round((rawHeight || 0) * 1000) / 1000;
    if (!viewportHeight) return;
    if (Math.abs(viewportVarsRef.current.height - viewportHeight) < 0.5) return;
    viewportVarsRef.current.height = viewportHeight;
    document.documentElement.style.setProperty('--viewport-vh', `${viewportHeight}px`);
    document.documentElement.style.setProperty('--overlay-vh', `${viewportHeight}px`);
  }, []);
  const syncViewportVarsThrottled = useRafThrottle(syncViewportVars);
  useLayoutEffect(() => {
    syncViewportVars();
  }, [syncViewportVars]);
  useEffect(() => {
    if (!hasWindow || !hasDocument) return;

    const visualViewport = window.visualViewport;
    syncViewportVars();

    const onOrientationChange = () => syncViewportVars();
    const onViewportResize = () => syncViewportVarsThrottled();
    if (visualViewport) {
      visualViewport.addEventListener('resize', onViewportResize);
    } else {
      window.addEventListener('resize', onViewportResize, { passive: true });
    }
    window.addEventListener('orientationchange', onOrientationChange, { passive: true });
    return () => {
      if (visualViewport) {
        visualViewport.removeEventListener('resize', onViewportResize);
      } else {
        window.removeEventListener('resize', onViewportResize);
      }
      window.removeEventListener('orientationchange', onOrientationChange);
      document.documentElement.style.removeProperty('--viewport-vh');
      document.documentElement.style.removeProperty('--overlay-vh');
      viewportVarsRef.current.height = 0;
    };
  }, [syncViewportVars, syncViewportVarsThrottled]);

  // Live-Balance
  const [liveBalance, setLiveBalance] = useState(Number(user.balance ?? 0));
  const [liveCurrency, setLiveCurrency] = useState(user.currency ?? 'EUR');
  useEffect(() => { setLiveBalance(Number(user.balance ?? 0)); setLiveCurrency(user.currency ?? 'EUR'); }, [user.balance, user.currency]);

  useEffect(() => {
    let stop = false; let t;
    const tick = async () => {
      if (document.visibilityState !== 'visible') { t = setTimeout(tick, 12000); return; }
      try {
        const res = await fetch('/api/me', { headers: { 'Accept': 'application/json' }, credentials: 'include', cache: 'no-store' });
        const j = await res.json().catch(() => null);
        const u = j?.user || j?.data?.user || j;
        if (u && !stop) {
          if (Number.isFinite(+u.balance)) setLiveBalance(+u.balance);
          if (u.currency) setLiveCurrency(u.currency);
        }
      } catch {}
      if (!stop) t = setTimeout(tick, 12000);
    };
    t = setTimeout(tick, 12000);
    return () => { stop = true; clearTimeout(t); };
  }, []);

  const balanceText = (() => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: liveCurrency }).format(liveBalance); }
    catch { return `${(isFinite(liveBalance) ? liveBalance : 0).toFixed(2)} ${liveCurrency}`; }
  })();

  const initials = (() => {
    const n = String(user.name || '').trim(); if (!n) return 'N2';
    const p = n.split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() || '');
    return p.join('') || 'N2';
  })();

  // ------------ Games laden ------------
  const [games, setGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [gamesError, setGamesError] = useState('');
  const [launchMessage, setLaunchMessage] = useState(null);
  const launchMessageDelayRef = useRef(null);
  const launchMessageHideRef = useRef(null);
  const clearLaunchMessageTimers = useCallback(() => {
    if (launchMessageDelayRef.current) {
      clearTimeout(launchMessageDelayRef.current);
      launchMessageDelayRef.current = null;
    }
    if (launchMessageHideRef.current) {
      clearTimeout(launchMessageHideRef.current);
      launchMessageHideRef.current = null;
    }
  }, []);
  const dismissLaunchMessage = useCallback(() => {
    clearLaunchMessageTimers();
    setLaunchMessage(null);
  }, [clearLaunchMessageTimers]);
  const showLaunchMessage = useCallback((message, { delay = 0, duration = 9000 } = {}) => {
    clearLaunchMessageTimers();
    const reveal = () => {
      setLaunchMessage(message);
      if (duration > 0) {
        launchMessageHideRef.current = setTimeout(() => {
          dismissLaunchMessage();
        }, duration);
      }
    };
    if (delay > 0) {
      launchMessageDelayRef.current = setTimeout(() => {
        reveal();
        launchMessageDelayRef.current = null;
      }, delay);
    } else {
      reveal();
    }
  }, [clearLaunchMessageTimers, dismissLaunchMessage]);
  useEffect(() => () => {
    clearLaunchMessageTimers();
  }, [clearLaunchMessageTimers]);

  useEffect(() => {
    let alive = true;
    let controller;
    (async () => {
      try {
        setLoadingGames(true);
        if (typeof AbortController !== 'undefined') controller = new AbortController();
        const res = await fetch('/api/games/list?img=game_img_2', {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'include',
          cache: 'no-cache',
          signal: controller?.signal,
        });
        const json = await res.json().catch(() => null);
        const list = Array.isArray(json?.games) ? json.games : Array.isArray(json) ? json : [];
        if (alive) {
          const normalized = normalizeAndDedupe(list);
          setGames(normalized);
          setGamesError(list.length ? '' : 'No games found.');
        }
      } catch {
        if (alive) setGamesError('Fehler beim Laden der Spiele.');
      } finally {
        if (alive) setLoadingGames(false);
      }
    })();
    return () => { alive = false; controller?.abort(); };
  }, []);

  // ------------ Kategorien & Suche (Tabs aus Doku) ------------
  const [selectedCat, setSelectedCat] = useState(PROVIDER_TABS[0]);
  const providerTabs = PROVIDER_TABS;
  const normalizedSelectedCat = useMemo(() => {
    if (!selectedCat || selectedCat === 'Home' || selectedCat === 'All') return '';
    return normalizeSlug(selectedCat);
  }, [selectedCat]);
  const prettySelectedCat = useMemo(
    () => (selectedCat ? selectedCat.replace(/_/g, ' ') : ''),
    [selectedCat]
  );
  const isHomeTab = selectedCat === 'Home';
  const isAllTab = selectedCat === 'All';
  const [queries, setQueries] = useState({});
  const q = queries[selectedCat] ?? '';
  const dq = useDeferredValue(q);
  const setQ = useCallback((val) => setQueries(prev => ({ ...prev, [selectedCat]: val })), [selectedCat]);

  const filteredGames = useMemo(() => {
    const s = String(dq ?? '').trim().toLowerCase();
    let out = games;
    if (normalizedSelectedCat) {
      out = out.filter((g) => {
        const providerSlug = normalizeSlug(g?._provN || g?.provider || '');
        if (matchesProviderSlug(providerSlug, normalizedSelectedCat)) return true;
        const categoriesSlug = normalizeSlug(g?.categories || '');
        if (categoriesSlug && categoriesSlug.includes(normalizedSelectedCat)) return true;
        const aliases = Array.isArray(g?.aliases) ? g.aliases : [];
        for (const alias of aliases) {
          const aliasSlug = normalizeSlug(alias);
          if (matchesProviderSlug(aliasSlug, normalizedSelectedCat)) return true;
        }
        return false;
      });
    }
    if (s) {
      out = out.filter(g => g?._searchText?.includes(s));
    }
    return out;
  }, [games, normalizedSelectedCat, dq]);
  const collator = useMemo(() => new Intl.Collator(undefined, { sensitivity: 'base', numeric: true }), []);
  const alphabeticalGames = useMemo(() => {
    if (!Array.isArray(filteredGames) || filteredGames.length === 0) return filteredGames;
    const forSort = filteredGames.slice();
    forSort.sort((a, b) => {
      const nameA = a?._nameN || a?.name || '';
      const nameB = b?._nameN || b?.name || '';
      return collator.compare(nameA, nameB);
    });
    return forSort;
  }, [filteredGames, collator]);

  const providers = useMemo(() => {
    const by = new Map();
    for (const g of filteredGames) {
      const p = g.provider || 'Provider';
      if (!by.has(p)) by.set(p, []);
      by.get(p).push(g);
    }
    return [...by.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filteredGames]);
  const orderedBestOfProviders = useMemo(() => {
    if (!providers.length) return [];
    const remaining = [...providers];
    const result = [];
    const seen = new Set();
    const pushEntry = (entry, preferredTab = null) => {
      if (!entry) return;
      const [name, list] = entry;
      if (seen.has(name) || !Array.isArray(list) || list.length === 0) return;
      seen.add(name);
      const normalizedName = normalizeSlug(name);
      let targetTab = preferredTab;
      if (!targetTab) {
        targetTab = PROVIDER_TABS.find((tab) => {
          if (!tab || tab === 'Home' || tab === 'All') return false;
          return matchesProviderSlug(normalizeSlug(tab), normalizedName);
        }) || null;
      }
      result.push({ name, list, tab: targetTab || name });
    };
    for (const tab of PROVIDER_TABS) {
      if (!tab || tab === 'Home' || tab === 'All') continue;
      const normalizedTab = normalizeSlug(tab);
      const matchIndex = remaining.findIndex(([name]) => matchesProviderSlug(normalizeSlug(name), normalizedTab));
      if (matchIndex >= 0) {
        pushEntry(remaining[matchIndex], tab);
        remaining.splice(matchIndex, 1);
      }
    }
    for (const entry of remaining) pushEntry(entry);
    return result;
  }, [providers]);
  const goToTab = useCallback((tab) => {
    if (!tab) return;
    setSelectedCat(tab);
    if (hasWindow) {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        window.scrollTo(0, 0);
      }
    }
  }, [setSelectedCat]);

  usePrefetchImages(filteredGames, {
    initialCount: Math.min(filteredGames.length || 0, prefetchInitial),
    onlyIOS: false,
  });
  useEffect(() => {
    if (!hasDocument || !hasWindow) return;
    const head = document.head;
    if (!head) return;
    const seen = new Set();
    const origins = [];
    for (const game of filteredGames) {
      if (origins.length >= 4) break;
      const img = pickImage(game);
      if (!isMeaningfulUrl(img) || !isHttpUrl(img)) continue;
      try {
        const url = new URL(img, window.location.href);
        const origin = url.origin;
        if (origin === window.location.origin) continue;
        if (!seen.has(origin)) {
          seen.add(origin);
          origins.push(origin);
        }
      } catch {
        continue;
      }
    }
    const cache = preconnectRef.current;
    for (const origin of origins) {
      if (cache.has(origin)) continue;
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      link.crossOrigin = 'anonymous';
      head.appendChild(link);
      cache.add(origin);
    }
  }, [filteredGames]);

  // ------------ Spiel öffnen (Overlay iFrame) ------------
  const [overlay, setOverlay] = useState(null); // { url, sessionId }
  const overlayRef = useRef(null);
  const iframeRef = useRef(null);
  const lastClosedSessionIdRef = useRef(null);
  const openInFlightRef = useRef(false);

  const closeSession = useCallback((sessionId) => {
    if (!sessionId) return;
    if (lastClosedSessionIdRef.current === sessionId) return;
    lastClosedSessionIdRef.current = sessionId;

    const payload = JSON.stringify({ sessionId });
    const url = '/api/games/close';

    if (hasNavigator && typeof navigator.sendBeacon === 'function' && typeof Blob !== 'undefined') {
      try {
        const sent = navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
        if (sent) return;
      } catch {
        // Fallback zu fetch unten
      }
    }

    if (hasWindow && typeof fetch === 'function') {
      fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  }, []);

  const closeOverlay = useCallback((options = {}) => {
    const { skipHistory = false } = options;
    const currentOverlay = overlayRef.current;

    if (currentOverlay?.sessionId) {
      closeSession(currentOverlay.sessionId);
    }

    if (currentOverlay) {
      setOverlay(null);
    }

    if (hasDocument) {
      document.body.classList.remove('body-game-open');
    }

    if (!skipHistory && currentOverlay && hasWindow) {
      try { history.back(); } catch {}
    }
  }, [closeSession]);

  useEffect(() => { overlayRef.current = overlay; }, [overlay]);
  useLayoutEffect(() => {
    if (!overlay || !hasWindow || !hasDocument) return;

    const visualViewport = window.visualViewport;
    const setOverlayHeight = () => {
      const viewportHeight = visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--overlay-vh', `${viewportHeight}px`);
    };

    setOverlayHeight();

    const onResize = () => setOverlayHeight();
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });
    if (visualViewport) {
      visualViewport.addEventListener('resize', onResize);
    }

    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } catch {
      try { window.scrollTo(0, 0); } catch {}
    }

    const frame = iframeRef.current;
    if (frame && typeof frame.requestFullscreen === 'function') {
      frame.requestFullscreen().catch(() => {});
    }

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (visualViewport) {
        visualViewport.removeEventListener('resize', onResize);
      }
      document.documentElement.style.removeProperty('--overlay-vh');
    };
  }, [overlay]);
  useEffect(() => { lastClosedSessionIdRef.current = null; }, [overlay?.sessionId]);
  useEffect(() => {
    if (!overlay) return;

    const onEsc = (event) => {
      if (event.key === 'Escape') {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        closeOverlay();
      }
    };

    window.addEventListener('keydown', onEsc, true);
    if (hasDocument) {
      document.addEventListener('keydown', onEsc, true);
    }

    const frame = iframeRef.current;
    let frameWindow = null;
    const attachFrameListener = () => {
      if (!frame) return;
      try {
        frameWindow = frame.contentWindow || null;
        frameWindow?.addEventListener?.('keydown', onEsc, true);
      } catch {
        frameWindow = null;
      }
    };

    if (frame) {
      frame.addEventListener?.('load', attachFrameListener);
      attachFrameListener();
    }

    return () => {
      window.removeEventListener('keydown', onEsc, true);
      if (hasDocument) {
        document.removeEventListener('keydown', onEsc, true);
      }
      if (frame) {
        frame.removeEventListener?.('load', attachFrameListener);
      }
      try {
        frameWindow?.removeEventListener?.('keydown', onEsc, true);
      } catch {}
    };
  }, [overlay, closeOverlay]);

  useEffect(() => {
    if (!overlay || !hasDocument) return;

    const onFullscreenChange = () => {
      const activeOverlay = overlayRef.current;
      const fsElement = document.fullscreenElement || document.webkitFullscreenElement;
      if (!fsElement && activeOverlay) {
        closeOverlay();
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, [overlay, closeOverlay]);

  useEffect(() => {
    const onPop = () => {
      if (overlayRef.current) {
        closeOverlay({ skipHistory: true });
      }
    };
    const onMsg = (e) => {
      const d = e?.data;
      if (d === 'closeGame' || d === 'close' || d === 'notifyCloseContainer' ||
          (typeof d === 'string' && d.indexOf('GAME_MODE:LOBBY') >= 0) || d?.closeGame !== undefined) {
        closeOverlay();
      }
    };

    window.addEventListener('popstate', onPop);
    window.addEventListener('message', onMsg);

    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('message', onMsg);
    };
  }, [closeOverlay]);

  const activeSessionId = overlay?.sessionId || null;
  useEffect(() => {
    if (!activeSessionId || !hasWindow) return undefined;

    const handleBeforeUnload = () => closeSession(activeSessionId);
    const handleVisibility = () => {
      if (!hasDocument) return;
      if (document.visibilityState === 'hidden') {
        closeSession(activeSessionId);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    window.addEventListener('unload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      window.removeEventListener('unload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeSessionId, closeSession]);

  const openGame = useCallback(async (gameId, options = {}) => {
    if (openInFlightRef.current) {
      return;
    }
    openInFlightRef.current = true;
    dismissLaunchMessage();
    try {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
      const res = await fetch('/api/games/open', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-TOKEN': csrf,
        },
        body: JSON.stringify({ gameId, demo: !!options.demo }),
      });
      const data = await res.json();
      if (data?.status !== 'success') throw new Error(data?.error || 'open_failed');

      const withoutFrame = String(data.withoutFrame ?? '0') === '1';
      if (!withoutFrame) {
        setOverlay({ url: data.url, sessionId: data.sessionId || null });
        if (hasDocument) {
          document.body.classList.add('body-game-open');
        }
        if (hasWindow) {
          try { history.pushState({ g: gameId }, '', window.location.href); } catch {}
        }
      } else {
        window.location.assign(data.url);
      }
    } catch (e) {
      const errorCode = e?.data?.error || e?.message || '';
      if (e?.status === 423 || errorCode === 'active_game_in_progress') {
        showLaunchMessage({
          title: 'Another game is already running',
          body: 'Please close your other game window before starting a new one. This keeps your sessions safe.',
        }, { delay: 700 });
      } else {
        showLaunchMessage({
          title: 'We couldn’t open the game',
          body: 'Please refresh the page or try again in a moment.',
        }, { delay: 300 });
      }
    } finally {
      openInFlightRef.current = false;
    }
  }, [dismissLaunchMessage, showLaunchMessage, setOverlay]);


  const closeOverlayButton = useCallback(() => closeOverlay(), [closeOverlay]);
  const searchPlaceholder = isHomeTab
    ? 'Search games or providers…'
    : isAllTab
      ? 'Search all games…'
      : `Search in ${prettySelectedCat || 'games'}…`;

  /* ------------------------------ Render ------------------------------ */
  return (
    <AuthenticatedLayout>
      <Head title="Welcome">
        <link rel="icon" type="image/svg+xml" href="/img/play4cash-mark.svg" />
        <link rel="preload" as="image" href="/img/play4cash-logo-horizontal.svg" type="image/svg+xml" />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: PERF_CSS }} />

      <div
        className="min-h-screen bg-[#0a1726] text-white selection:bg-cyan-400/30"
        style={{ minHeight: 'var(--viewport-vh, 100vh)' }}
      >
        {launchMessage && (
          <div className="fixed top-6 left-1/2 z-[11000] w-full max-w-md -translate-x-1/2 px-4">
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#102238]/95 px-5 py-4 shadow-xl backdrop-blur">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-200 text-lg font-semibold">
                !
              </div>
              <div className="flex-1">
                <p className="text-base font-semibold text-white/95">{launchMessage.title}</p>
                <p className="mt-1 text-sm text-white/70">{launchMessage.body}</p>
              </div>
              <button
                type="button"
                onClick={dismissLaunchMessage}
                className="ml-2 rounded-full p-1 text-white/60 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                aria-label="Close message"
              >
                ×
              </button>
            </div>
          </div>
        )}
        <Header
          user={user}
          initials={initials}
          balanceText={balanceText}
          selectedCat={selectedCat}
          setSelectedCat={setSelectedCat}
          providerTabs={providerTabs}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="h-3" />
          <Hero />

          <div className="space-y-10 mt-8">
            {loadingGames ? (
              <div className="text-white/70">Lade Spiele…</div>
            ) : gamesError ? (
              <div className="text-red-300">{gamesError}</div>
            ) : isHomeTab ? (
              <>
                <SectionCarousel
                  title="All Games"
                  items={filteredGames}
                  onPlay={openGame}
                  rightNode={(
                    <button
                      type="button"
                      onClick={() => goToTab('All')}
                      className="px-3 py-1.5 rounded-lg border border-white/15 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                    >
                      Show all
                    </button>
                  )}
                  isCompact={isCompactLayout}
                />
                {orderedBestOfProviders.map(({ name: providerName, list, tab }) => {
                  const targetTab = providerTabs.includes(tab) ? tab : null;
                  return (
                    <SectionCarousel
                      key={providerName}
                      title={`Best of ${providerName}`}
                      items={list}
                      onPlay={openGame}
                      isCompact={isCompactLayout}
                      rightNode={
                        targetTab ? (
                          <button
                            type="button"
                            onClick={() => goToTab(targetTab)}
                            className="px-3 py-1.5 rounded-lg border border-white/15 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                          >
                            Show all
                          </button>
                        ) : null
                      }
                    />
                  );
                })}
              </>
            ) : isAllTab ? (
              <SectionGridVirtualized
                title="All Games"
                items={alphabeticalGames}
                onPlay={openGame}
                rightNode={<SearchInput value={q} onChange={setQ} placeholder={searchPlaceholder} />}
              />
            ) : (
              <SectionGridVirtualized
                title={`${prettySelectedCat || selectedCat} Games`}
                items={filteredGames}
                onPlay={openGame}
                rightNode={<SearchInput value={q} onChange={setQ} placeholder={searchPlaceholder} />}
              />
            )}
          </div>
        </main>
        <Footer />
      </div>

      {/* Game Overlay (iFrame) */}
      {overlay && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 overlay-fullscreen"
          style={{ height: 'var(--overlay-vh, var(--viewport-vh, 100vh))' }}
        >
          <div className="relative w-full h-full">
            <button
              onClick={closeOverlayButton}
              className="absolute top-3 left-3 z-[110] px-3 py-1.5 rounded-lg bg-white text-black text-sm font-semibold"
              aria-label="Close game"
            >
              Close
            </button>
            <iframe
              ref={iframeRef}
              id="gameFrame"
              title="Game"
              src={overlay.url}
              className="absolute inset-0 w-full h-full border-0"
              style={{ minHeight: 'var(--overlay-vh, var(--viewport-vh, 100vh))' }}
              allow="autoplay; fullscreen; clipboard-read; clipboard-write"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </AuthenticatedLayout>
  );
}

/* ------------------------------ Header ------------------------------ */
function Header({ user, initials, balanceText, selectedCat, setSelectedCat, providerTabs }) {
  const [openProfile, setOpenProfile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef(null);

  const roleNames = [];
  if (user?.role) roleNames.push(user.role);
  if (Array.isArray(user?.roles)) for (const r of user.roles) roleNames.push(typeof r === 'string' ? r : r?.name);
  const roleSet = new Set(roleNames.filter(Boolean).map(s => String(s).toLowerCase()));
  const isAdmin = Boolean(user?.is_admin) || roleSet.has('admin') || roleSet.has('administrator');
  const isRunner = Boolean(user?.is_runner) || roleSet.has('runner');

  const onScrollRaf = useRafThrottle(() => setScrolled(window.scrollY > 6));
  useEffect(() => { onScrollRaf(); window.addEventListener('scroll', onScrollRaf, { passive: true }); return () => window.removeEventListener('scroll', onScrollRaf); }, [onScrollRaf]);

  useEffect(() => {
    const onDoc = (e) => { if (!headerRef.current) return; if (!headerRef.current.contains(e.target)) setOpenProfile(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);
  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') { setOpenProfile(false); setDrawerOpen(false); } };
    window.addEventListener('keydown', onEsc, { passive: true });
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  return (
    <div ref={headerRef} className="sticky top-0 z-50">
      <div className={`relative z-20 transition-colors ${scrolled ? 'bg-[#0b1b2b]/80' : 'bg-transparent'} backdrop-blur supports-[backdrop-filter]:backdrop-blur-md shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-14 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/welcome" className="flex items-center gap-2 min-w-0" aria-label="Play4Cash home">
                <img
                  src="/img/play4cash-logo-horizontal.svg"
                  alt="play4cash"
                  className="h-8 sm:h-10 lg:h-12 w-auto select-none drop-shadow-[0_8px_24px_rgba(34,211,238,0.35)]"
                  draggable="false"
                  loading="eager"
                  decoding="async"
                  style={{ imageRendering: '-webkit-optimize-contrast' }}
                />
              </Link>
            </div>
            <div className="flex items-center gap-3 sm:gap-2">
              <div className="sm:hidden mr-1 select-text">
                <span className="px-2.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-emerald-100 text-xs font-medium cursor-default" aria-label="Current balance">
                  {balanceText}
                </span>
              </div>
              <button
                type="button"
                className="sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition"
                onClick={() => { setDrawerOpen(true); setOpenProfile(false); }}
                aria-label="Open categories"
              >
                <HamburgerIcon />
              </button>
              <div className="hidden sm:flex items-center gap-1 mr-2 select-text">
                <span className="px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-emerald-100 text-sm cursor-default" aria-label="Current balance">
                  {balanceText}
                </span>
              </div>
              <div className="relative sm:ml-1">
                <button onClick={() => setOpenProfile(v => !v)} aria-haspopup="menu" aria-label="Profile menu" aria-expanded={openProfile} className="block">
                  <Avatar
                    imgUrl={user?.profile_photo_url}
                    initials={initials}
                    status={user?.presence}
                  />
                </button>
                {openProfile && (
                  <MenuCard align="right">
                    <MenuItem title="Profile" href="/profile" />
                    {isAdmin && <MenuItem title="Admin-Panel" href="/admin/users" />}
                    {isRunner && <MenuItem title="Dealer panel" href="/runner/users" />}
                    <MenuItem title="Logout" href="/logout" method="post" />
                  </MenuCard>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative z-10 bg-[#0b1b2b]/85 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="hidden sm:flex items-center gap-2 overflow-x-auto no-scrollbar touch-momentum py-2">
            {providerTabs.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className={[
                  'px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition',
                  selectedCat === cat ? 'bg-cyan-500 text-black' : 'bg-white/5 hover:bg-white/10 text-white'
                ].join(' ')}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[18.5rem] max-w-[85vw] bg-[#0c1e31] border-l border-white/10 shadow-2xl p-5 overflow-y-auto touch-momentum">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base">Categories</h3>
              <button className="p-2 rounded-lg hover:bg-white/10" onClick={() => setDrawerOpen(false)} aria-label="Close drawer"><XIcon /></button>
            </div>
            <div className="flex flex-col gap-2">
              {providerTabs.map(cat => (
                <button
                  key={cat}
                  onClick={() => { setSelectedCat(cat); setDrawerOpen(false); }}
                  className={[
                    'px-3 py-2 rounded-xl text-sm text-left transition',
                    selectedCat === cat ? 'bg-cyan-500 text-black' : 'bg-white/5 hover:bg-white/10'
                  ].join(' ')}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Avatar / Menus ------------------------------ */
function Avatar({ imgUrl, initials, status, size = 'md' }) {
  const sizeConfig = size === 'sm'
    ? { box: 'h-7 w-7', text: 'text-xs', indicator: 'h-2.5 w-2.5', offset: '-bottom-0.5 -right-0.5' }
    : { box: 'h-9 w-9', text: 'text-sm', indicator: 'h-3 w-3', offset: '-bottom-0.5 -right-0.5' };

  const indicatorClass = status === 'playing'
    ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
    : status === 'lobby'
      ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
      : null;

  const title =
    status === 'playing' ? 'Gerade im Spiel' :
    status === 'lobby' ? 'Gerade in der Lobby' :
    undefined;

  return (
    <div className="relative inline-block" title={title}>
      {imgUrl ? (
        <img
          src={imgUrl}
          alt=""
          aria-label="Profile avatar"
          className={`${sizeConfig.box} rounded-full object-cover ring-2 ring-white/10`}
          loading="lazy"
        />
      ) : (
        <div
          aria-label="Profile avatar"
          className={`${sizeConfig.box} ${sizeConfig.text} rounded-full grid place-items-center bg-gradient-to-br from-cyan-400/80 to-emerald-400/80 text-black font-bold ring-2 ring-white/10`}
        >
          {initials}
        </div>
      )}
      {indicatorClass && (
        <span
          className={`absolute ${sizeConfig.offset} ${sizeConfig.indicator} rounded-full border-2 border-[#0a1726] ${indicatorClass}`}
        />
      )}
    </div>
  );
}
function MenuCard({ children, align = 'left' }) {
  return (
    <div role="menu" className={`absolute z-[80] mt-2 ${align === 'right' ? 'right-0' : 'left-0'} w-44 rounded-xl bg-[#0f2236] border border-white/10 shadow-lg overflow-hidden`}>
      <div className="py-1">{children}</div>
    </div>
  );
}
function MenuItem({ title, href, method }) {
  const base = "block w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition";
  if (href) return <Link href={href} method={method} className={base}>{title}</Link>;
  return <div className={base}>{title}</div>;
}

/* ------------------------------ Hero ------------------------------ */
function Hero() {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-[#0f2842] via-[#0b1f33] to-[#143a5d] border border-white/10">
      <div className="absolute -right-16 -top-16 opacity-30 pointer-events-none"><PromoSVG /></div>
      <div className="px-6 py-10 sm:px-10 sm:py-14">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">Spin & win up to 10,000</h1>
        <p className="mt-3 max-w-2xl text-white/70">Hot promos, fresh releases, instant-win games — all in one sleek lobby.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="px-4 py-2 rounded-xl bg-cyan-400 text-black font-semibold hover:brightness-110 transition">Play Now</button>
          <button className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">Learn more</button>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Carousels --------------------------- */
function SectionCarousel({ title, items, onPlay, rightNode = null, isCompact = false }) {
  const scrollerRef = useRef(null);
  const sentinelRef = useRef(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(true);
  const initialRenderCount = isCompact ? 24 : 60;
  const loadStep = isCompact ? 12 : 30;
  const [renderCount, setRenderCount] = useState(() => Math.min(items.length, initialRenderCount));

  useEffect(() => {
    setRenderCount(Math.min(items.length, initialRenderCount));
  }, [items, initialRenderCount]);

  usePrefetchImages(items, {
    initialCount: Math.min(renderCount, isCompact ? 32 : 72),
    range: { start: 0, end: renderCount },
    buffer: isCompact ? 18 : 36,
    onlyIOS: false,
  });

  const ensureAhead = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (renderCount >= items.length) return;
    const remainingPx = el.scrollWidth - (el.scrollLeft + el.clientWidth);
    const thresholdPx = el.clientWidth * (isCompact ? 2 : 3);
    if (remainingPx <= thresholdPx) {
      setRenderCount((prev) => {
        if (prev >= items.length) return prev;
        return Math.min(items.length, prev + loadStep);
      });
    }
  }, [renderCount, items.length, loadStep, isCompact]);

  useEffect(() => {
    if (!supportsIntersectionObserver) {
      setRenderCount((prev) => (prev === items.length ? prev : items.length));
      return;
    }
    if (renderCount >= items.length) return;
    const node = sentinelRef.current;
    if (!node) return;
    const root = scrollerRef.current ?? undefined;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setRenderCount((prev) => {
            if (prev >= items.length) return prev;
            return Math.min(items.length, prev + loadStep);
          });
          break;
        }
      }
    }, { root, rootMargin: isCompact ? '220px' : '120px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [items.length, loadStep, isCompact, renderCount]);

  const update = useRafThrottle(() => {
    const el = scrollerRef.current; if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    ensureAhead();
  });

  useEffect(() => {
    const el = scrollerRef.current; if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const onResize = () => update();
    window.addEventListener('resize', onResize, { passive: true });
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', onResize); };
  }, [update]);

  useEffect(() => {
    update();
  }, [renderCount, update]);

  const scrollBy = (dir) => {
    const el = scrollerRef.current; if (!el) return;
    const delta = Math.round(el.clientWidth * 0.9) * (dir === 'left' ? -1 : 1);
    if (supportsNativeSmoothScroll) {
      try {
        el.scrollBy({ left: delta, behavior: 'smooth' });
        return;
      } catch {}
    }
    el.scrollLeft += delta;
    ensureAhead();
  };

  const visibleItems = items.slice(0, renderCount);
  const priorityCutoff = isCompact ? 8 : 12;

  return (
    <section aria-label={title} className="island">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="text-lg sm:text-xl font-semibold truncate">{title}</h2>
        {rightNode}
      </div>
      <div className="relative group">
        <button
          className={`hidden md:grid place-items-center absolute -left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 border border-white/15 hover:bg-white/20 transition ${canL ? 'opacity-100' : 'opacity-0 pointer-events-none'} md:group-hover:opacity-100`}
          onClick={() => scrollBy('left')}
          aria-label="Scroll left"
        ><ArrowLeftIcon /></button>
        <div
          ref={scrollerRef}
          className="flex gap-3 overflow-x-auto no-scrollbar touch-momentum snap-x snap-mandatory scroll-smooth pr-1"
          style={isIOSDevice ? { WebkitOverflowScrolling: 'touch' } : undefined}
        >
          {visibleItems.map((g, idx) => (
            <GameCard
              key={gameReactKey(g)}
              game={g}
              onPlay={onPlay}
              variant="carousel"
              priority={idx < priorityCutoff}
            />
          ))}
          {renderCount < items.length && (
            <div ref={sentinelRef} className="w-px h-px flex-shrink-0 opacity-0" aria-hidden="true" />
          )}
        </div>
        <button
          className={`hidden md:grid place-items-center absolute -right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 border border-white/15 hover:bg-white/20 transition ${canR ? 'opacity-100' : 'opacity-0 pointer-events-none'} md:group-hover:opacity-100`}
          onClick={() => scrollBy('right')}
          aria-label="Scroll right"
        ><ArrowRightIcon /></button>
      </div>
    </section>
  );
}

/* --------------------------- Category Grid --------------------------- */
function SectionGridVirtualized({ title, items, onPlay, rightNode = null }) {
  const [visibleCount, setVisibleCount] = useState(CATEGORY_PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(CATEGORY_PAGE_SIZE);
  }, [items]);

  const displayItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount]
  );
  const hasMore = items.length > visibleCount;
  const handleShowMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + CATEGORY_PAGE_SIZE, items.length));
  }, [items.length]);

  usePrefetchImages(displayItems, {
    initialCount: Math.min(displayItems.length || 0, 72),
    buffer: 24,
    onlyIOS: false,
  });

  return (
    <section aria-label={title} className="island">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="text-lg sm:text-xl font-semibold truncate">{title}</h2>
        {rightNode}
      </div>
      <div className="rounded-xl border border-white/10 p-3 sm:p-4">
        {displayItems.length === 0 ? (
          <div className="text-white/60 text-sm">No games found.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {displayItems.map((g, idx) => (
              <GameCard
                key={gameReactKey(g)}
                game={g}
                onPlay={onPlay}
                variant="grid"
                priority={idx < 12}
              />
            ))}
          </div>
        )}
      </div>
      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={handleShowMore}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold hover:bg-white/10 transition"
          >
            Show more
          </button>
        </div>
      )}
    </section>
  );
}

const SearchInput = memo(function SearchInput({ value, onChange, placeholder }) {
  const inputRef = useRef(null);
  const hadFocusRef = useRef(false);
  const ensureFocus = useCallback(() => {
    if (!hadFocusRef.current || !hasDocument) return;
    const node = inputRef.current;
    if (!node || document.activeElement === node) return;
    node.focus({ preventScroll: true });
    try {
      const len = node.value.length;
      node.setSelectionRange(len, len);
    } catch {}
  }, []);

  useLayoutEffect(() => {
    ensureFocus();
  }, [ensureFocus, value]);

  const handleFocus = useCallback(() => {
    hadFocusRef.current = true;
  }, []);

  const handleBlur = useCallback(() => {
    hadFocusRef.current = false;
  }, []);

  const handleChange = useCallback((e) => {
    hadFocusRef.current = true;
    onChange(e.target.value);
  }, [onChange]);

  return (
    <div className="w-full sm:w-72">
      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoComplete="off"
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 pr-9 text-sm placeholder-white/50 outline-none focus:border-cyan-400/40"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60" aria-hidden="true"><SearchIcon /></span>
      </div>
    </div>
  );
});

/* --------------------------- Game Card --------------------------- */
function gameReactKey(g) {
  const p = String(g?.provider || '').toLowerCase();
  if (g?.uid) return `uid:${g.uid}`;
  if (g?.uuid) return `uuid:${g.uuid}`;
  if (g?.sys_id) return `sys:${g.sys_id}`;
  if (g?.game_id) return `gid:${g.game_id}`;
  if (g?.id != null) return `id:${p}#${g.id}`;
  const name = String(g?.name || '').toLowerCase().trim();
  if (name) return `name:${p}#${name}`;
  return `${p}-${Math.random().toString(36).slice(2)}`;
}
const GameCard = memo(function GameCard({ game, onPlay, variant = 'carousel', heightPx, priority = false }) {
  const title = game.name || `Game ${game.id}`;
  const provider = game.provider || 'Provider';
  const img = game.img || TRANSPARENT_PX;
  const containerCls = variant === 'grid'
    ? 'w-full'
    : 'snap-start flex-shrink-0 basis-1/2 sm:basis-1/2 md:basis-1/4 xl:basis-1/6';
  const cardStyle = variant === 'grid' && heightPx
    ? { height: `${heightPx}px`, backgroundColor: '#10263b', willChange: 'transform' }
    : { aspectRatio: '16 / 9', backgroundColor: '#10263b', willChange: 'transform' };
  const imageLoadingMode = priority ? 'eager' : 'lazy';
  const imageFetchPriority = priority ? 'high' : 'low';
  const handlePlay = useCallback(() => {
    onPlay?.(game.id, { demo: false });
  }, [onPlay, game.id]);
  return (
    <article className={containerCls} aria-label={title}>
      <div className="relative rounded-xl overflow-hidden group/card bg-[#0d2236] border border-white/10"
           style={cardStyle}>
        <LazyImage
          src={img}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ backgroundColor: '#10263b' }}
          loading={imageLoadingMode}
          fetchPriority={imageFetchPriority}
        />
        <div className="absolute left-2 top-2 px-2 py-1 rounded-md bg-black/50 text-[10px] leading-none">{provider}</div>
        <div className="absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity">
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
            <div className="text-xs font-medium truncate">{title}</div>
          </div>
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 rounded-lg bg-white text-black text-sm font-semibold hover:brightness-95"
                onClick={handlePlay}
              >
                Play
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}, (prev, next) => (
  prev.game === next.game &&
  prev.onPlay === next.onPlay &&
  prev.variant === next.variant &&
  prev.heightPx === next.heightPx &&
  prev.priority === next.priority
));

/* ------------------------------ Footer ------------------------------ */
function Footer() {
  return (
    <footer className="mt-14 border-t border-white/10 bg-[#0a1726]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid gap-6 md:grid-cols-2 items-center">
          <div className="flex flex-wrap items-center gap-3">
            <PayIcon label="Coming soon: Crypto" />
            <PayIcon label="Wallet" />
            <span className="text-white/60 text-sm ml-1">24/7 Support</span>
          </div>
          <div className="flex justify-start md:justify-end">
            <label className="flex items-center gap-2 text-sm text-white/70">
              Language
              <select className="bg-white/5 border border-white/10 rounded-lg px-2 py-1">
                <option>English</option>
                <option>Deutsch</option>
                <option>Español</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------ Icons/SVG ------------------------------ */
function PromoSVG() {
  return (
    <svg width="320" height="320" viewBox="0 0 320 320" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(160 160) rotate(90) scale(160)">
          <stop stopColor="#22d3ee" stopOpacity="0.8"/><stop offset="1" stopColor="#22d3ee" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="160" cy="160" r="160" fill="url(#g1)"/>
      <g opacity=".35">
        {[...Array(10)].map((_, i) => (
          <circle key={i} cx="160" cy="160" r={20 + i * 15} stroke="#86efac" strokeOpacity=".6" strokeWidth="1.5" />
        ))}
      </g>
      <g>
        {[...Array(12)].map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const x = 160 + Math.cos(a) * 110;
          const y = 160 + Math.sin(a) * 110;
          return <circle key={i} cx={x} cy={y} r="6" fill="#22d3ee" />;
        })}
      </g>
    </svg>
  );
}
function ArrowLeftIcon()  { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>); }
function ArrowRightIcon() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>); }
function HamburgerIcon()  { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>); }
function XIcon()          { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>); }
function SearchIcon()     { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="M20 20l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>); }
function PayIcon({ label }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
      <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="20" height="12" rx="2" stroke="currentColor" className="text-white/50" />
        <rect x="3" y="3" width="6" height="2" rx="1" fill="currentColor" className="text-cyan-300" />
        <rect x="3" y="6.5" width="16" height="1.5" rx=".75" fill="currentColor" className="text-white/30" />
        <rect x="3" y="9.5" width="10" height="1.5" rx=".75" fill="currentColor" className="text-white/30" />
      </svg>
      <span className="text-xs text-white/70">{label}</span>
    </div>
  );
}
