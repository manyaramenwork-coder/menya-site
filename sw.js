/* 멘야마쯔리 앱 서비스워커 — 항상 최신 우선, 데이터는 저장하지 않음 */
const CACHE = 'menya-shell-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const OFFLINE = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>멘야마쯔리</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f7f3;color:#232621;
font-family:'Noto Sans KR','Malgun Gothic',sans-serif;text-align:center;padding:24px}
b{display:block;font-size:17px;margin-bottom:8px}p{margin:0 0 20px;color:#797d76;font-size:13px;line-height:1.7}
button{border:0;background:#c62429;color:#fff;border-radius:8px;padding:11px 22px;font:inherit;font-size:13px}</style>
</head><body><div><b>인터넷 연결이 없어요</b><p>연결을 확인한 뒤 다시 시도해 주세요.</p>
<button onclick="location.reload()">다시 시도</button></div></body></html>`;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Supabase·외부 데이터는 관여하지 않음

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() =>
      new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
    return;
  }
  // 이미지·아이콘 등: 서버 먼저, 실패 시에만 저장본
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    } catch (err) {
      const hit = await caches.match(req);
      if (hit) return hit;
      throw err;
    }
  })());
});
