// resources/js/Pages/Welcome.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Head, usePage, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { postJson } from '@/utils/api';

const HIDE_SCROLLBAR_CSS = `
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`;

export default function Welcome() {
  const { props } = usePage();
  const user = (props?.auth?.user) || {};

  // --- Initialwerte aus Inertia
  const initialBalance = Number(user.balance ?? 0);
  const initialCurrency = user.currency ?? 'EUR';

  // --- Live-Status (wird alle 2s aktualisiert)
  const [liveBalance, setLiveBalance] = useState(initialBalance);
  const [liveCurrency, setLiveCurrency] = useState(initialCurrency);

  useEffect(() => {
    setLiveBalance(initialBalance);
    setLiveCurrency(initialCurrency);
  }, [initialBalance, initialCurrency]);

  // Polling-Endpoint (nach erstem Erfolg merken) + AbortController für saubere Abbrüche
  const balanceEndpointRef = useRef(null);
  const fetchAbortRef = useRef(null);

  // Parsed JSON -> {balance, currency}
  function parseBalancePayload(data) {
    const u = data?.user ?? data?.data ?? data ?? {};
    let b = u?.balance ?? data?.balance ?? data?.data?.balance;
    const c = u?.currency ?? data?.currency ?? data?.data?.currency;
    if (typeof b === 'string') {
      const f = parseFloat(b.replace(',', '.'));
      b = isNaN(f) ? undefined : f;
    }
    if (typeof b === 'number' && isFinite(b)) {
      return { balance: b, currency: c };
    }
    return null;
  }

  // Robust fetch mit Credentials + No-Cache + Content-Type-Check
  async function tryFetchBalance(url) {
    // Cache-Bust via ts=
    const ts = Date.now();
    const sep = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${sep}ts=${ts}`;

    // Vorherigen Fetch abbrechen
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    const res = await fetch(fullUrl, {
      method: 'GET',
      credentials: 'include', // wichtig bei Port/Domain-Unterschieden
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
      },
      signal: controller.signal,
    }).catch(() => null);

    if (!res || !res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('application/json')) return null; // z. B. HTML-Loginseite
    const json = await res.json().catch(() => null);
    return parseBalancePayload(json);
  }

  // Alle 2s Guthaben ziehen
  useEffect(() => {
    let stopped = false;

    const candidates = [
      '/api/me/balance', // bevorzugt
      '/api/user/balance',
      '/api/me',
      '/api/user',
      '/me',
    ];

    const fetchBalance = async () => {
      if (stopped) return;

      // wenn bekannt, nur diesen Endpoint nutzen
      const known = balanceEndpointRef.current;
      if (known) {
        const data = await tryFetchBalance(known);
        if (data && !stopped) {
          if (typeof data.balance === 'number') setLiveBalance(data.balance);
          if (data.currency) setLiveCurrency(data.currency);
        }
        return;
      }

      // sonst: Kandidaten durchprobieren, ersten funktionierenden merken
      for (const url of candidates) {
        const data = await tryFetchBalance(url);
        if (data && !stopped) {
          balanceEndpointRef.current = url;
          if (typeof data.balance === 'number') setLiveBalance(data.balance);
          if (data.currency) setLiveCurrency(data.currency);
          break;
        }
      }
    };

    // sofort + alle 2 Sekunden
    fetchBalance();
    const id = setInterval(fetchBalance, 2000);

    return () => {
      stopped = true;
      clearInterval(id);
      fetchAbortRef.current?.abort();
    };
  }, []);

  function formatCurrency(v, cur) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(v);
    } catch {
      const n = (isFinite(v) ? v : 0).toFixed(2);
      return `${n} ${cur}`;
    }
  }

  const balanceText = formatCurrency(liveBalance, liveCurrency);

  const initials = (name => {
    if (!name || typeof name !== 'string') return 'N2';
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || 'N2';
  })(user.name);

  // ----------------- Spiele laden usw. (unverändert) -----------------
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [games, setGames] = useState([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    postJson('/api/games/list', { img: 'game_img_2' })
      .then(r => r.json())
      .then(data => {
        if (!alive) return;
        if (data?.status !== 'success') throw new Error(data?.error || 'load_failed');
        setGames(Array.isArray(data.games) ? data.games : []);
        setLoadErr('');
      })
      .catch(e => { if (alive) setLoadErr(e?.message || 'Load failed'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const [selectedCat, setSelectedCat] = useState('All');
  const [q, setQ] = useState('');

  const textFrom = (g, keys) =>
    keys.map(k => String(g?.[k] ?? '')).join(' ').toLowerCase();

  const hasWord = (g, word) => {
    const w = String(word).toLowerCase();
    const pool = [
      textFrom(g, ['categories', 'collections', 'tags', 'type']),
      g?.popular ? 'popular' : '',
      g?.is_popular ? 'popular' : '',
      g?.exclusive ? 'exclusive' : '',
    ].join(' ');
    return pool.includes(w);
  };

  const isProvider = (g, name) =>
    String(g?.provider || '').toLowerCase().includes(String(name).toLowerCase());

  const categoryMap = {
    All:       () => true,
    Popular:   g => hasWord(g, 'popular'),
    Exclusive: g => hasWord(g, 'exclusive'),
    Arcade:    g => hasWord(g, 'arcade'),
    Novomatic: g => isProvider(g, 'novomatic'),
    Amatic:    g => isProvider(g, 'amatic'),
    Pragmatic: g => isProvider(g, 'pragmatic'),
    EGT:       g => isProvider(g, 'egt'),
    Wazdan:    g => isProvider(g, 'wazdan'),
    Aristocrat:g => isProvider(g, 'aristocrat'),
  };

  const filteredGames = useMemo(() => {
    const pred = categoryMap[selectedCat] || (() => true);
    let out = games.filter(pred);
    if (selectedCat === 'All') {
      const s = q.trim().toLowerCase();
      if (s) {
        out = out.filter(g =>
          String(g?.name || '').toLowerCase().includes(s) ||
          String(g?.provider || '').toLowerCase().includes(s)
        );
      }
    }
    return out;
  }, [games, selectedCat, q]);

  const providers = useMemo(() => {
    const by = new Map();
    for (const g of filteredGames) {
      const p = g.provider || 'Provider';
      if (!by.has(p)) by.set(p, []);
      by.get(p).push(g);
    }
    return [...by.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filteredGames]);

  async function openGame(gameId, options = {}) {
    try {
      if (typeof window.openGameViaOverlay === 'function') {
        await window.openGameViaOverlay(gameId, { ...options, demo: false });
      } else {
        const res = await fetch('/api/games/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId, demo: false }),
        });
        const data = await res.json();
        if (data?.status !== 'success') throw new Error(data?.error || 'open_failed');
        if (String(data.withoutFrame) === '1') window.location.assign(data.url);
        else window.location.assign(data.url);
      }
    } catch (e) {
      alert(e?.message || 'Spiel konnte nicht geöffnet werden.');
    }
  }

  const SearchRightSlot = (
    <div className="w-full sm:w-72">
      <label className="relative block">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search games or providers…"
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 pr-9 text-sm placeholder-white/50 outline-none focus:border-cyan-400/40"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60" aria-hidden="true">
          <SearchIcon />
        </span>
      </label>
    </div>
  );

  return (
    <AuthenticatedLayout>
      <Head title="Welcome">
        <link rel="icon" type="image/svg+xml" href="/img/play4cash-mark.svg" />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: HIDE_SCROLLBAR_CSS }} />
      <div className="min-h-screen bg-[#0a1726] text-white selection:bg-cyan-400/30">
        <Header
          user={user}
          initials={initials}
          balanceText={balanceText}
          selectedCat={selectedCat}
          setSelectedCat={(cat) => { setSelectedCat(cat); if (cat !== 'All') setQ(''); }}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="h-3" />
          <Hero />

          {loading && <div className="mt-8 text-white/80">Lade Spiele…</div>}
          {(!loading && loadErr) && <div className="mt-8 text-rose-300">Fehler: {loadErr}</div>}

          {(!loading && !loadErr) && (
            <div className="space-y-10 mt-8">
              <SectionCarousel
                title={selectedCat === 'All' ? 'All Games' : `${selectedCat} Games`}
                items={filteredGames}
                onPlay={openGame}
                rightNode={selectedCat === 'All' ? SearchRightSlot : null}
              />
              {providers.slice(0, 6).map(([providerName, list]) => (
                <SectionCarousel
                  key={providerName}
                  title={`Best of ${providerName}`}
                  items={list}
                  onPlay={openGame}
                />
              ))}
            </div>
          )}
        </main>
        <Footer />
      </div>
    </AuthenticatedLayout>
  );
}

/* ------------------------------ Header usw. bleiben unverändert ------------------------------ */
// ... (dein vorhandener Header, Hero, SectionCarousel, GameCard, Footer, Icons etc.)


/* ------------------------------ Header ------------------------------ */

function Header({ user, initials, balanceText, selectedCat, setSelectedCat }) {
  const [openProfile, setOpenProfile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef(null);

  const roleNames = [];
  if (user?.role) roleNames.push(user.role);
  if (Array.isArray(user?.roles)) {
    for (const r of user.roles) roleNames.push(typeof r === 'string' ? r : r?.name);
  }
  const roleSet = new Set(roleNames.filter(Boolean).map(s => String(s).toLowerCase()));

  const isAdmin = Boolean(user?.is_admin) || roleSet.has('admin') || roleSet.has('administrator');
  const isRunner = Boolean(user?.is_runner) || roleSet.has('runner');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onDoc = (e) => {
      if (!headerRef.current) return;
      if (!headerRef.current.contains(e.target)) setOpenProfile(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === 'Escape') {
        setOpenProfile(false);
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  // Neue Kategorie-Liste
  const categories = [
    'All',
    'Popular',
    'Exclusive',
    'Arcade',
    'Novomatic',
    'Amatic',
    'Pragmatic',
    'EGT',
    'Wazdan',
    'Aristocrat',
  ];

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
                  className="h-6 w-auto select-none"
                  draggable="false"
                />
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="sm:hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition"
                onClick={() => { setDrawerOpen(true); setOpenProfile(false); }}
                aria-label="Open categories"
              >
                <DotsIcon />
                <span className="text-sm">Categories</span>
              </button>

              <div className="hidden sm:flex items-center gap-1 mr-2 select-text">
                <span
                  className="px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-emerald-100 text-sm cursor-default"
                  aria-label="Current balance"
                >
                  {balanceText}
                </span>
              </div>

              <div className="relative ml-1">
                <button
                  onClick={() => setOpenProfile(v => !v)}
                  aria-haspopup="menu"
                  aria-label="Profile menu"
                  aria-expanded={openProfile}
                  className="block"
                >
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

      {/* Kategorien-Zeile */}
      <div className="relative z-10 bg-[#0b1b2b]/85 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="hidden sm:flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className={[
                  'px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition',
                  selectedCat === cat
                    ? 'bg-cyan-500 text-black shadow'
                    : 'bg-white/5 hover:bg-white/10 text-white'
                ].join(' ')}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Kategorien Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 rounded-t-2xl bg-[#0c1e31] border-t border-white/10 p-4 max-h=[70vh]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Categories</h3>
              <button className="p-2 rounded-lg hover:bg-white/10" onClick={() => setDrawerOpen(false)} aria-label="Close drawer"><XIcon /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                'All','Popular','Exclusive','Arcade',
                'Novomatic','Amatic','Pragmatic','EGT','Wazdan','Aristocrat'
              ].map(cat => (
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

function Avatar({ imgUrl, initials }) {
  return imgUrl ? (
    <img
      src={imgUrl}
      alt=""
      aria-label="Profile avatar"
      className="h-9 w-9 rounded-full object-cover ring-2 ring-white/10"
      loading="lazy"
    />
  ) : (
    <div
      aria-label="Profile avatar"
      className="h-9 w-9 rounded-full grid place-items-center bg-gradient-to-br from-cyan-400/80 to-emerald-400/80 text-black font-bold ring-2 ring-white/10"
    >
      {initials}
    </div>
  );
}

function MenuCard({ children, align = 'left' }) {
  return (
    <div
      role="menu"
      className={`absolute z-[80] mt-2 ${align === 'right' ? 'right-0' : 'left-0'} w-44 rounded-xl bg-[#0f2236] border border-white/10 shadow-lg overflow-hidden`}
    >
      <div className="py-1">{children}</div>
    </div>
  );
}

function MenuItem({ title, href, method }) {
  const base = "block w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition";
  if (href) {
    return (
      <Link href={href} method={method} className={base}>
        {title}
      </Link>
    );
  }
  return <div className={base}>{title}</div>;
}

/* ------------------------------ Hero ------------------------------ */

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-tr from-[#0f2842] via-[#0b1f33] to-[#143a5d] border border-white/10">
      <div className="absolute -right-16 -top-16 opacity-30 pointer-events-none">
        <PromoSVG />
      </div>
      <div className="px-6 py-10 sm:px-10 sm:py-14">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
          Spin & win up to 10,000
        </h1>
        <p className="mt-3 max-w-2xl text-white/70">
          Hot promos, fresh releases, instant-win games — all in one sleek lobby.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="px-4 py-2 rounded-xl bg-cyan-400 text-black font-semibold hover:brightness-110 transition">Play Now</button>
          <button className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition">Learn more</button>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Section / Cards --------------------------- */

function SectionCarousel({ title, items, onPlay, rightNode = null }) {
  const scrollerRef = useRef(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(true);

  const update = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    update();
    const on = () => update();
    el.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => {
      el.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
    };
  }, []);

  const scrollBy = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = Math.round(el.clientWidth * 0.9) * (dir === 'left' ? -1 : 1);
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <section aria-label={title}>
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="text-lg sm:text-xl font-semibold truncate">{title}</h2>
        {rightNode ? rightNode : null}
      </div>

      <div className="relative group">
        <button
          className={`hidden md:grid place-items-center absolute -left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 border border-white/15 hover:bg-white/20 transition ${canL ? 'opacity-100' : 'opacity-0 pointer-events-none'} md:group-hover:opacity-100`}
          onClick={() => scrollBy('left')}
          aria-label="Scroll left"
        >
          <ArrowLeftIcon />
        </button>

        <div
          ref={scrollerRef}
          className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth pr-1"
          onWheel={(e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.currentTarget.scrollLeft += e.deltaY; } }}
        >
          {items.map((g) => <GameCard key={`${g.provider}-${g.id}`} game={g} onPlay={onPlay} />)}
        </div>

        <button
          className={`hidden md:grid place-items-center absolute -right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 border border-white/15 hover:bg-white/20 transition ${canR ? 'opacity-100' : 'opacity-0 pointer-events-none'} md:group-hover:opacity-100`}
          onClick={() => scrollBy('right')}
          aria-label="Scroll right"
        >
          <ArrowRightIcon />
        </button>
      </div>
    </section>
  );
}

function GameCard({ game, onPlay }) {
  const [near, setNear] = useState(false);
  const [idle, setIdle] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    let obs;
    if ('IntersectionObserver' in window) {
      obs = new IntersectionObserver(
        (e) => { if (e[0]?.isIntersecting) { setNear(true); obs.disconnect(); } },
        { rootMargin: '400px' }
      );
      if (ref.current) obs.observe(ref.current);
    } else {
      setNear(true);
    }
    return () => obs?.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    const rIC = window.requestIdleCallback || (cb => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 200));
    const id = rIC(() => setIdle(true));
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(id);
      else clearTimeout(id);
    };
  }, [near]);

  const title = game.name || `Game ${game.id}`;
  const provider = game.provider || 'Provider';
  const img = game.img || TRANSPARENT_PX;

  return (
    <article
      ref={ref}
      tabIndex={0}
      className="snap-start flex-shrink-0 basis-1/2 sm:basis-1/2 md:basis-1/4 xl:basis-1/6"
      aria-label={title}
    >
      <div className="relative aspect-video rounded-xl overflow-hidden group/card bg-gradient-to-br from-cyan-400/20 via-indigo-400/15 to-emerald-400/20 border border-white/10">
        {/* Thumb */}
        {near && (
          <img src={img} alt={title} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        )}

        {/* Provider-Tag */}
        <div className="absolute left-2 top-2 px-2 py-1 rounded-md bg-black/50 text-[10px] leading-none">
          {provider}
        </div>

        {/* Hover: Titel + Button */}
        {(near && idle) && (
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
                {/* Demo-Button entfernt */}
              </div>
            </div>
          </div>
        )}
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
            <PayIcon label="Comming soon: Crypto" />
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
    <svg width="320" height="320" viewBox="0 0 320 320" fill="none" xmlns="https://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(160 160) rotate(90) scale(160)">
          <stop stopColor="#22d3ee" stopOpacity="0.8"/>
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0"/>
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

/* ------------------------------ Utils ------------------------------ */
const TRANSPARENT_PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y1Q7u8AAAAASUVORK5CYII=';
