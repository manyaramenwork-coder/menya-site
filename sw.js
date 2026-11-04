/* 멘야마쯔리 앱 서비스워커 (2026-11-04)
   - 화면(페이지)은 항상 인터넷에서 최신으로 받음, 끊기면 '연결 없음' 화면
   - Supabase 등 데이터는 저장하지 않음 (가로채지 않음)
   - 휴대폰 알림(푸시) 받기 · 누르면 해당 화면으로 이동 */
const VER = 'mm-2026-11-04';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const OFFLINE = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>연결 없음 · 멘야마쯔리</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#f4f5f0;color:#232621}
div{text-align:center;padding:24px}b{display:block;font-size:18px;margin-bottom:8px}p{margin:0 0 18px;color:#6b7363;font-size:14px;line-height:1.6}
button{border:0;background:#c62429;color:#fff;border-radius:8px;padding:11px 22px;font-size:14px}</style></head>
<body><div><b>인터넷 연결이 없어요</b><p>연결이 돌아오면 다시 불러와 주세요.</p><button onclick="location.reload()">다시 불러오기</button></div></body></html>`;

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.mode !== 'navigate') return;
  e.respondWith(fetch(r).catch(() => new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: '멘야마쯔리', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || '멘야마쯔리', {
    body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag,
    icon: '/icon-192.png', badge: '/icon-192.png', data: { url: d.url || '/' }
  }));
});

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
