// resources/js/Pages/Games/Lobby.jsx
import React, { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';

export default function Lobby() {
  const [games, setGames] = useState([]);
  const [frame, setFrame] = useState(null); // { url, iframe, withoutFrame }
  const scrollRef = useRef(0);

  useEffect(() => {
    fetch('/api/games/list', { method: 'POST', headers:{'X-Requested-With':'XMLHttpRequest'}})
      .then(r => r.json()).then(res => {
        if (res?.status === 'success') {
          // Flatten providers into one array
          const content = res.content || {};
          const list = Object.values(content).flat();
          setGames(list);
        }
      });
  }, []);

  // Lazy-load Thumbnails via IntersectionObserver (siehe Doku)
  useEffect(() => {
    const els = document.querySelectorAll('.game-tile[data-img]');
    if (!els.length) return;
    const obs = new IntersectionObserver((entries, ob) => {
      entries.forEach(e => {
        const el = e.target;
        if (e.isIntersecting && !el.dataset.loaded) {
          const src = el.getAttribute('data-img');
          const img = new Image();
          img.onload = () => {
            el.style.backgroundImage = `url(${src})`;
            el.dataset.loaded = '1';
            ob.unobserve(el);
          };
          img.onerror = img.onload;
          img.src = src;
        }
      });
    }, { rootMargin: '0px', threshold: 0.1 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [games]);

  // PostMessage Close (Variante 1 in Doku)
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

  // Popstate Back-Button → schließen
  useEffect(() => {
    function onPop() {
      if (document.body.classList.contains('game-open')) closeGame();
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function openGame(gameId) {
    scrollRef.current = Math.round(window.scrollY);
    fetch('/api/games/open', { method:'POST', headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'}, body: JSON.stringify({ gameId })})
      .then(r => r.json()).then(res => {
        if (res?.status === 'success') {
          const g = res.content?.game || {};
          const url = g.url;
          if (!url) return;
          // 16:9 / 3:4 Flags sind vorhanden (width)
          // withoutFrame=1 → redirect; sonst iframe
          if (String(g.withoutFrame) === '1') {
            window.location.assign(url);
            return;
          }
          setFrame({ url, iframe: g.iframe === '1', withoutFrame: g.withoutFrame === '1' });
          document.body.classList.add('game-open');
          history.pushState(null, '', window.location.search + `&id=${gameId}`);
        }
      });
  }

  function closeGame() {
    setFrame(null);
    document.body.classList.remove('game-open');
    // iframe aus DOM entfernen (Doku-Anforderung für sauberes popstate-Verhalten)
    const holder = document.getElementById('gameFrame');
    if (holder) holder.innerHTML = '';
    window.scrollTo(0, scrollRef.current || 0); // gespeicherte Position wiederherstellen
  }

  // beforeunload → Position speichern (Doku-Empfehlung)
  useEffect(() => {
    const fn = () => localStorage.pageScroll = Math.round(window.pageYOffset || 0);
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, []);

  return (
    <div className="lobby">
      <h1>Games</h1>
      <div className="grid">
        {games.map(g => (
          <button key={`${g.title}-${g.id}`}
                  className="game-tile"
                  data-img={g.img}
                  onClick={() => openGame(g.id)}
                  aria-label={`Open ${g.name}`}>
            <span className="caption">
              <strong>{g.name}</strong>
              <small>{g.title}</small>
            </span>
          </button>
        ))}
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
