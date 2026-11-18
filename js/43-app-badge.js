
/* ==========================================================
   앱 아이콘 숫자 (2026-11-06)
   - 숫자 = 상단 🔔 숫자와 같음 (안 읽은 공지 + 결재 차례 + 새 참조 + 내 상신 결과)
   - 앱을 열거나 화면으로 돌아올 때·2분마다 공지/결재를 새로 불러올 때 정확한 숫자로 맞춤
   - 앱이 꺼져 있을 때 알림이 오면 sw.js가 1씩 올림 (저장 위치: 캐시 '/__mm-badge')
   - 아이폰(홈 화면 앱 + 알림 허용)에서 숫자 표시 / 안드로이드는 휴대폰이 알림 개수로 자동 표시
   - 로그아웃하면 숫자 지움
   ========================================================== */
(function(){
  if (!('setAppBadge' in navigator)) return;
  const KEY = '/__mm-badge';
  let last = -1, timer = 0;
  async function save(n){
    try { const c = await caches.open('mm-badge'); await c.put(KEY, new Response(String(n))); } catch (e) {}
  }
  function count(){
    const u = (typeof SESSION !== 'undefined' && SESSION && SESSION.user) ? SESSION.user : null;
    if (!u) return 0;
    const b = document.getElementById('nt-bell'); if (!b) return 0;
    const m = (b.getAttribute('aria-label') || '').match(/(\d+)건/);   // 🔔에 적힌 숫자 그대로
    return m ? +m[1] : 0;
  }
  function apply(){
    clearTimeout(timer);
    timer = setTimeout(() => {
      const n = count(); if (n === last) return; last = n;
      try { (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch (e) {}
      save(n);
    }, 300);
  }
  // 🔔 숫자가 바뀔 때마다 따라감
  const top = document.querySelector('.top');
  if (top) new MutationObserver(apply).observe(top, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-label'] });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = -1; apply(); } });
  if (typeof logout === 'function') {
    const logoutBadge = logout;
    logout = function(){
      last = 0; try { navigator.clearAppBadge().catch(() => {}); } catch (e) {} save(0);
      return logoutBadge.apply(this, arguments);
    };
  }
  apply();
})();
