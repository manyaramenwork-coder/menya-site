/* 멘야마쯔리 앱 서비스워커 — 항상 최신 우선, 데이터는 저장하지 않음
   2026-11-04 추가: 휴대폰 알림(푸시) 받기 · 알림 누르면 해당 화면으로 이동
   2026-11-06 추가: 알림 올 때 앱 아이콘 숫자 +1 (아이폰) */
const CACHE = 'menya-shell-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && k !== 'mm-badge').map(k => caches.delete(k)));
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

/* ---------- 휴대폰 알림 (2026-11-04 추가) ---------- */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: '멘야마쯔리', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title || '멘야마쯔리', {
      body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag,
      icon: '/icon-192.png', badge: '/icon-192.png', data: { url: d.url || '/' }
    }),
    bumpBadge()
  ]));
});

/* ---------- 앱 아이콘 숫자 (2026-11-06 추가) ----------
   앱이 꺼져 있을 때 알림이 오면 숫자를 1 올림. 앱을 열면 index.html이 정확한 숫자로 다시 맞춤.
   (아이폰만 해당 — 안드로이드는 휴대폰이 알림 개수로 자동 표시) */
async function bumpBadge(){
  if (!('setAppBadge' in self.navigator)) return;
  try {
    const c = await caches.open('mm-badge');
    const r = await c.match('/__mm-badge');
    const n = (r ? (parseInt(await r.text(), 10) || 0) : 0) + 1;
    await c.put('/__mm-badge', new Response(String(n)));
    await self.navigator.setAppBadge(n);
  } catch (err) {}
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (new URL(c.url).origin === self.location.origin) {
        await c.focus();
        c.postMessage({ type: 'mm-go', url });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
