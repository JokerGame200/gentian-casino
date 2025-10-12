// resources/js/Pages/Games/Lobby.jsx
import React, { useEffect, useRef, useState } from 'react';

export default function Lobby() {
  const [games, setGames] = useState([]);
  const [frame, setFrame] = useState(null); // { url, iframe, withoutFrame }
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const scrollRef = useRef(0);

  useEffect(() => {
    setLoading(true);
    fetch('/api/games/list', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
    })
      .then(r => r.json())
      .then(res => {
        // Erwartete Struktur laut Doku: {status:"success", content: { provider_title: [ {id,name,img,...} ] }}. :contentReference[oaicite:0]{index=0}
        if (res?.status !== 'success') {
          const err = res?.error || (typeof res === 'object' ? JSON.stringify(res) : String(res));
          setLoadErr(res?.error);
          setGames([]);
          return;
        }
        const content = res?.content ?? res?.data ?? {};
        let list = [];
        if (Array.isArray(content)) {
          // falls der Provider die Anbieter nicht als Objekt, sondern als Array schickt
          list = content.flatMap(v => (Array.isArray(v) ? v : [v]));
        } else if (content && typeof content === 'object') {
          list = Object.values(content).flatMap(v => (Array.isArray(v) ? v : [v]));
        }
        // Defensive: nur Spiele mit id & name anzeigen
        list = list.filter(g => g && (g.id ?? g.gameId) && (g.name || g.title));
        setGames(list);
      })
      .catch(e => setLoadErr(String(e?.message || e)))
      .finally(() => setLoading(false));
  }, []);

  // Lazy-load Thumbnails via IntersectionObserver (mit HTTPS-Upgrade, um Mixed Content zu vermeiden)
  useEffect(() => {
    const els = document.querySelectorAll('.game-tile[data-img]');
    if (!els.length) return;
    const obs = new IntersectionObserver((entries, ob) => {
      entries.forEach(e => {
        const el = e.target;
        if (e.isIntersecting && !el.dataset.loaded) {
          let src = el.getAttribute('data-img') || '';
          if (src.startsWith('//')) src = 'https:' + src;
          if (src.startsWith('http://')) src = src.replace('http://', 'https://'); // Mixed-Content fix
          const img = new Image();
          img.onload = () => {
            el.style.backgroundImage = `url(${src})`;
            el.dataset.loaded = '1';
            ob.unobserve(el);
          };
          // auch bei onerror setzen, damit zumindest der Versuch in CSS passiert
          img.onerror = img.onload;
          img.src = src;
        }
      });
    }, { rootMargin: '0px', threshold: 0.1 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [games]);

  useEffect(() => {
    function onMsg(ev) {
      const d = ev.data;
      if (d === 'closeGame' || d === 'close' || d === 'notifyCloseContainer' || (typeof d === 'string' && d.includes('GAME_MODE:LOBBY'))) {
        closeGame();
      }
      if (d && typeof d === 'object' && d.closeGame !== undefined) {
        closeGame();
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => {
    function onPop() {
      if (document.body.classList.contains('game-open')) closeGame();
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function openGame(gameId) {
    scrollRef.current = Math.round(window.scrollY);
    fetch('/api/games/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ gameId }),
    })
      .then(r => r.json())
      .then(res => {
        // openGame Response enthält content.game mit url, iframe, withoutFrame, rewriterule usw. :contentReference[oaicite:1]{index=1}
        if (res?.status !== 'success') return;
        const g = res.content?.game || {};
        const url = g.url;
        if (!url) return;
        if (String(g.withoutFrame) === '1') {
          window.location.assign(url);
          return;
        }
        setFrame({ url, iframe: g.iframe === '1', withoutFrame: g.withoutFrame === '1' });
        document.body.classList.add('game-open');
        history.pushState(null, '', window.location.search + `&id=${gameId}`);
      });
  }

  function closeGame() {
    setFrame(null);
    document.body.classList.remove('game-open');
    const holder = document.getElementById('gameFrame');
    if (holder) holder.innerHTML = '';
    window.scrollTo(0, scrollRef.current || 0);
  }

  useEffect(() => {
    const fn = () => (localStorage.pageScroll = Math.round(window.pageYOffset || 0));
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, []);

  return (
    <div className="lobby">
      <h1>Games</h1>

      {loading && <p style={{opacity:.7}}>Loading games…</p>}
      {(!loading && loadErr) && <p style={{color:'#f55'}}>Error: {loadErr}</p>}
      {(!loading && !loadErr && games.length === 0) && <p style={{opacity:.7}}>No games found.</p>}

      <div className="grid">
        {games.map(g => {
          const id = g.id ?? g.gameId ?? String(Math.random());
          const name = g.name || g.title || 'Game';
          const provider = g.title || g.provider || '';
          // Bild-Link aus Doku-Feld "img"; bei Bedarf HTTPS upgraden. :contentReference[oaicite:2]{index=2}
          let img = g.img || '';
          if (img?.startsWith('//')) img = 'https:' + img;
          if (img?.startsWith('http://')) img = img.replace('http://', 'https://');

          return (
            <button key={`${name}-${id}`}
                    className="game-tile"
                    data-img={img}
                    onClick={() => openGame(id)}
                    aria-label={`Open ${name}`}>
              <span className="caption">
                <strong>{name}</strong>
                {provider ? <small>{provider}</small> : null}
              </span>
            </button>
          );
        })}
      </div>

      {frame && (
        <div className="overlay">
          <div className="bar">
            <button onClick={closeGame} aria-label="Close">✕</button>
          </div>
          <div id="gameFrame" className="frame">
            <iframe title="Game" src={frame.url} allowFullScreen />
          </div>
        </div>
      )}

      <style>{`
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
        .game-tile{position:relative;aspect-ratio:288/210;background:#111 center/cover no-repeat;border-radius:12px;border:1px solid #222}
        .caption{position:absolute;inset:auto 0 0 0;background:linear-gradient(transparent, rgba(0,0,0,.8));padding:8px 10px;color:#fff;text-align:left}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,.9);display:flex;flex-direction:column;z-index:1000}
        .bar{display:flex;justify-content:flex-end;padding:8px}
        .bar button{font-size:18px}
        .frame{flex:1;display:flex}
        .frame iframe{width:100%;height:100%;border:0}
        body.game-open{overflow:hidden}
      `}</style>
    </div>
  );
}
