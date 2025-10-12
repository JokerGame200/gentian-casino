// resources/js/utils/api.js

const CSRF =
  document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? null;

function buildUrl(url, params) {
  const u = new URL(url, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        u.searchParams.set(k, String(v));
      }
    });
  }
  return u.toString();
}

async function parseJsonResponse(res) {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();
  let data;

  if (ct.includes('application/json') || ct.includes('text/json')) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Ungültige JSON-Antwort vom Server.');
    }
  } else {
    // Manche Backends schicken JSON mit text/plain
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function getJson(url, { params = {}, signal } = {}) {
  const res = await fetch(buildUrl(url, params), {
    method: 'GET',
    credentials: 'include', // Cookies/Sessions mitsenden
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    cache: 'no-store',
    signal,
  });
  return parseJsonResponse(res);
}

export async function postJson(url, body = {}, { signal } = {}) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(CSRF ? { 'X-CSRF-TOKEN': CSRF } : {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal,
  });
  return parseJsonResponse(res);
}

// Bequeme Kurz-Wrapper (optional)
export const api = {
  games: {
    list: (params) => getJson('/api/games/list', { params }),
    open: (payload) => postJson('/api/games/open', payload),
  },
  me: {
    balance: () => getJson('/api/me/balance'),
    user: () => getJson('/api/me'),
  },
};
