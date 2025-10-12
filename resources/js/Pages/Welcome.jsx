// resources/js/Pages/Welcome.jsx
import React, {
  memo, useCallback, useEffect, useLayoutEffect, useMemo,
  useRef, useState, useDeferredValue
} from 'react';
import { Head, usePage, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import * as ReactWindow from 'react-window';
const { FixedSizeList: List } = ReactWindow;

/* ------------------------------ CSS ------------------------------ */
const PERF_CSS = `
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
@supports (content-visibility: auto) {
  .island { content-visibility: auto; contain-intrinsic-size: 800px 450px; }
}
@media (prefers-reduced-motion: reduce) {
  .scroll-smooth { scroll-behavior: auto !important; }
}
.body-game-open { overflow: hidden; }
`;

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
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => {
      if (e?.contentRect) setRect({ width: e.contentRect.width, height: e.contentRect.height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
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

const LazyImage = memo(function LazyImage({ src, alt, className }) {
  const imgRef = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = imgRef.current; if (!el) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { setInView(true); io.disconnect(); break; }
    }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <img
      ref={imgRef}
      src={inView ? src : undefined}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      fetchpriority="low"
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
    const norm = { ...raw, name, provider, img, _nameN: nameN, _provN: provN };

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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingGames(true);
        const res = await fetch('/api/games/list?img=game_img_2', {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'include',
          cache: 'no-store',
        });
        const json = await res.json().catch(() => null);
        const list = Array.isArray(json?.games) ? json.games : Array.isArray(json) ? json : [];
        if (alive) {
          setGames(normalizeAndDedupe(list));
          setGamesError(list.length ? '' : 'Keine Spiele gefunden.');
        }
      } catch {
        if (alive) setGamesError('Fehler beim Laden der Spiele.');
      } finally {
        if (alive) setLoadingGames(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ------------ Kategorien & Suche (Tabs aus Doku) ------------
  const providerTabs = [
    'All','novomatic','ainsworth','pragmatic','NetEnt','microgaming','scientific_games','aristocrat',
    'quickspin','igt','scratch','igrosoft','amatic','apex','merkur','table_games','gclub',
    'habanero','apollo','wazdan','egt','roulette','bingo','keno'
  ];
  const [selectedCat, setSelectedCat] = useState('All');
  const [queries, setQueries] = useState({});
  const q = queries[selectedCat] ?? '';
  const dq = useDeferredValue(q);
  const setQ = useCallback((val) => setQueries(prev => ({ ...prev, [selectedCat]: val })), [selectedCat]);

  const filteredGames = useMemo(() => {
    const s = String(dq ?? '').trim().toLowerCase();
    let out = games;
    if (selectedCat !== 'All') {
      const cat = selectedCat.toLowerCase();
      out = out.filter(g => String(g?.provider || '').toLowerCase().includes(cat));
    }
    if (s) out = out.filter(g =>
      String(g?.name || '').toLowerCase().includes(s) ||
      String(g?.provider || '').toLowerCase().includes(s)
    );
    return normalizeAndDedupe(out);
  }, [games, selectedCat, dq]);

  const providers = useMemo(() => {
    const by = new Map();
    for (const g of filteredGames) {
      const p = g.provider || 'Provider';
      if (!by.has(p)) by.set(p, []);
      by.get(p).push(g);
    }
    return [...by.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filteredGames]);

  // ------------ Spiel öffnen (Overlay iFrame) ------------
  const [overlay, setOverlay] = useState(null); // { url, sessionId }
  useEffect(() => {
    const onPop = () => { if (document.body.classList.contains('body-game-open')) closeOverlay(); };
    window.addEventListener('popstate', onPop);
    const onMsg = (e) => {
      const d = e?.data;
      if (d === 'closeGame' || d === 'close' || d === 'notifyCloseContainer' ||
          (typeof d === 'string' && d.indexOf('GAME_MODE:LOBBY') >= 0) || d?.closeGame !== undefined) {
        closeOverlay();
      }
    };
    window.addEventListener('message', onMsg);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('message', onMsg); };
  }, []);

  async function openGame(gameId, options = {}) {
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
        document.body.classList.add('body-game-open');
        try { history.pushState({ g: gameId }, '', window.location.href); } catch {}
      } else {
        window.location.assign(data.url);
      }
    } catch (e) {
      alert(e?.message || 'Spiel konnte nicht geöffnet werden.');
    }
  }


  const closeOverlay = useCallback(() => {
    setOverlay(null);
    document.body.classList.remove('body-game-open');
    try { history.back(); } catch {}
  }, []);

  const SearchInput = memo(function SearchInput({ value, onChange, placeholder }) {
    const inputRef = useRef(null);
    const hadFocusRef = useRef(false);
    const vRef = useRef(value);
    useLayoutEffect(() => { vRef.current = value; }, [value]);
    useLayoutEffect(() => {
      if (hadFocusRef.current && inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
        const val = String(vRef.current ?? ''); try { inputRef.current.setSelectionRange(val.length, val.length); } catch {}
      }
    });
    return (
      <div className="w-full sm:w-72">
        <div className="relative">
          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 pr-9 text-sm placeholder-white/50 outline-none focus:border-cyan-400/40"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60" aria-hidden="true"><SearchIcon /></span>
        </div>
      </div>
    );
  });

  const searchPlaceholder = selectedCat === 'All' ? 'Search games or providers…' : `Search in ${selectedCat}…`;

  /* ------------------------------ Render ------------------------------ */
  return (
    <AuthenticatedLayout>
      <Head title="Welcome">
        <link rel="icon" type="image/svg+xml" href="/img/play4cash-mark.svg" />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: PERF_CSS }} />

      <div className="min-h-screen bg-[#0a1726] text-white selection:bg-cyan-400/30">
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
            ) : selectedCat === 'All' ? (
              <>
                <SectionCarousel
                  title="All Games"
                  items={filteredGames}
                  onPlay={openGame}
                  rightNode={<SearchInput value={q} onChange={setQ} placeholder={searchPlaceholder} />}
                />
                {providers.slice(0, 6).map(([providerName, list]) => (
                  <SectionCarousel key={providerName} title={`Best of ${providerName}`} items={list} onPlay={openGame} />
                ))}
              </>
            ) : (
              <SectionGridVirtualized
                title={`${selectedCat} Games`}
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
        <div className="fixed inset-0 z-[100] bg-black/90">
          <button
            onClick={closeOverlay}
            className="absolute top-3 left-3 z-[110] px-3 py-1.5 rounded-lg bg-white text-black text-sm font-semibold"
            aria-label="Close game"
          >
            Close
          </button>
          <iframe
            id="gameFrame"
            title="Game"
            src={overlay.url}
            className="absolute inset-0 w-full h-full border-0"
            allow="autoplay; fullscreen; clipboard-read; clipboard-write"
            allowFullScreen
          />
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
                <img src="/img/play4cash-logo-horizontal.svg" alt="play4cash" className="h-6 w-auto select-none" draggable="false" />
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="sm:hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition"
                onClick={() => { setDrawerOpen(true); setOpenProfile(false); }}
                aria-label="Open categories"
              >
                <DotsIcon /><span className="text-sm">Categories</span>
              </button>
              <div className="hidden sm:flex items-center gap-1 mr-2 select-text">
                <span className="px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-emerald-100 text-sm cursor-default" aria-label="Current balance">
                  {balanceText}
                </span>
              </div>
              <div className="relative ml-1">
                <button onClick={() => setOpenProfile(v => !v)} aria-haspopup="menu" aria-label="Profile menu" aria-expanded={openProfile} className="block">
                  <Avatar imgUrl={user?.profile_photo_url} initials={initials} />
                </button>
                {openProfile && (
                  <MenuCard align="right">
                    <MenuItem title="Profile" href="/profile" />
                    {isAdmin && <MenuItem title="Admin-Panel" href="/admin/users" />}
                    {isRunner && <MenuItem title="User-Panel" href="/runner/users" />}
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
          <div className="hidden sm:flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
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
          <div className="absolute bottom-0 inset-x-0 rounded-t-2xl bg-[#0c1e31] border-t border-white/10 p-4 max-h=[70vh]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Categories</h3>
              <button className="p-2 rounded-lg hover:bg-white/10" onClick={() => setDrawerOpen(false)} aria-label="Close drawer"><XIcon /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
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
function Avatar({ imgUrl, initials }) {
  return imgUrl ? (
    <img src={imgUrl} alt="" aria-label="Profile avatar" className="h-9 w-9 rounded-full object-cover ring-2 ring-white/10" loading="lazy" />
  ) : (
    <div aria-label="Profile avatar" className="h-9 w-9 rounded-full grid place-items-center bg-gradient-to-br from-cyan-400/80 to-emerald-400/80 text-black font-bold ring-2 ring-white/10">
      {initials}
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
function SectionCarousel({ title, items, onPlay, rightNode = null }) {
  const scrollerRef = useRef(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(true);

  const update = useRafThrottle(() => {
    const el = scrollerRef.current; if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  });

  useEffect(() => {
    const el = scrollerRef.current; if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const onResize = () => update();
    window.addEventListener('resize', onResize, { passive: true });
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', onResize); };
  }, [update]);

  const scrollBy = (dir) => {
    const el = scrollerRef.current; if (!el) return;
    const delta = Math.round(el.clientWidth * 0.9) * (dir === 'left' ? -1 : 1);
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

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
        <div ref={scrollerRef} className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth pr-1">
          {items.map((g) => <GameCard key={gameReactKey(g)} game={g} onPlay={openGameProxy(onPlay)} variant="carousel" />)}
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

/* --------------------------- Virtualized Grid --------------------------- */
function SectionGridVirtualized({ title, items, onPlay, rightNode = null }) {
  const [wrapRef, rect] = useMeasure();
  const { h: winH } = useWindowSize();
  const cols = useMemo(() => {
    const w = rect.width || 0;
    if (w >= 1280) return 6;
    if (w >= 768)  return 4;
    if (w >= 640)  return 3;
    return 2;
  }, [rect.width]);
  const gap = 12;
  const cellW = Math.max(100, Math.floor((rect.width - (cols - 1) * gap) / cols));
  const cellH = Math.round(cellW * 9 / 16);
  const rowH  = cellH;
  const rows = Math.ceil(items.length / cols);
  const listHeight = Math.min(winH * 0.9, rows * rowH);
  const Row = ({ index, style }) => {
    const start = index * cols;
    const rowItems = items.slice(start, start + cols);
    return (
      <div style={style}>
        <div className="grid" style={{ display:'grid', gridTemplateColumns:`repeat(${cols}, minmax(0, 1fr))`, gap:`${gap}px`, paddingBottom:'12px' }}>
          {rowItems.map((g) => (
            <GameCard key={gameReactKey(g)} game={g} onPlay={openGameProxy(onPlay)} variant="grid" heightPx={cellH} />
          ))}
          {rowItems.length < cols && Array.from({ length: cols - rowItems.length }).map((_, i) => <div key={`ph-${i}`} />)}
        </div>
      </div>
    );
  };
  return (
    <section aria-label={title} ref={wrapRef} className="island">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="text-lg sm:text-xl font-semibold truncate">{title}</h2>
        {rightNode}
      </div>
      <div className="rounded-xl border border-white/10" style={{ height: listHeight, overflow: 'auto' }}>
        <List height={listHeight} itemCount={rows} itemSize={rowH + 12} width={rect.width || 0} overscanCount={1} className="no-scrollbar">
          {Row}
        </List>
      </div>
    </section>
  );
}

/* --------------------------- Game Card --------------------------- */
function openGameProxy(onPlay) { return (id, opt) => onPlay?.(id, opt); }
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
function GameCard({ game, onPlay, variant = 'carousel', heightPx }) {
  const title = game.name || `Game ${game.id}`;
  const provider = game.provider || 'Provider';
  const img = game.img || TRANSPARENT_PX;
  const containerCls = variant === 'grid'
    ? 'w-full'
    : 'snap-start flex-shrink-0 basis-1/2 sm:basis-1/2 md:basis-1/4 xl:basis-1/6';
  const styleAspect = variant === 'grid' && heightPx ? { height: `${heightPx}px` } : undefined;
  return (
    <article className={containerCls} aria-label={title}>
      <div className="relative rounded-xl overflow-hidden group/card bg-[#0d2236] border border-white/10"
           style={variant === 'grid' ? styleAspect : { aspectRatio: '16 / 9' }}>
        <LazyImage src={img} alt={title} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute left-2 top-2 px-2 py-1 rounded-md bg-black/50 text-[10px] leading-none">{provider}</div>
        <div className="absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity">
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
            <div className="text-xs font-medium truncate">{title}</div>
          </div>
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 rounded-lg bg-white text-black text-sm font-semibold hover:brightness-95"
                onClick={() => onPlay?.(game.id, { demo: false })}
              >
                Play
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

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
function DotsIcon()       { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>); }
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
