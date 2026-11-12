/* 멘야마쯔리 파트너 - 알림 받기 (2026-11-12)
   - 본사가 보낸 알림을 휴대폰에 띄우고, 누르면 해당 공지·발주 화면으로 이동
   - 화면 파일은 저장해 두지 않음 (항상 최신 화면) */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: '멘야마쯔리 파트너', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || '멘야마쯔리 파트너', {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    icon: 'icon-192.png',
    badge: 'badge-96.png',
    data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data && e.notification.data.url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        c.postMessage({ type: 'open', url });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
