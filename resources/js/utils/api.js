// resources/js/utils/api.js
export async function postJson(url, body = {}) {
  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin', // Session-Cookies mitsenden
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',          // zwingt JSON-Fehler statt HTML
      'X-Requested-With': 'XMLHttpRequest',
      ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}),
    },
    body: JSON.stringify(body),
  });
  return res;
}
