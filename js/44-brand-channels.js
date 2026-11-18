
/* ==========================================================
   브랜드 채널 바로가기 (2026-11-07)
   - 접이식 메뉴 1줄: 홈페이지·블로그·인스타그램·유튜브·쌍용본점 플레이스
   - 모두 새 창으로 열림, 위치는 '관리' 묶음의 '사용자 관리' 바로 위
     (사용자 관리가 안 보이는 계정은 '관리' 묶음 맨 아래)
   - 기존 코드는 고치지 않고, 마지막 renderSide 뒤에 붙임
   ========================================================== */
(function(){
  const LINKS = [
    ['홈페이지', 'http://xn--oy2b1b9w518abwh.com/index.php'],
    ['블로그', 'https://blog.naver.com/menyamarsuri'],
    ['인스타그램', 'https://www.instagram.com/menyamatsuri_official/'],
    ['유튜브', 'https://www.youtube.com/@%EB%A9%98%EC%95%BC%EB%A7%88%EC%AF%94%EB%A6%AC-l2m'],
    ['쌍용본점 플레이스', 'https://naver.me/xExWvsyT']
  ];
  if (typeof PATHS !== 'undefined') PATHS.megaphone = 'M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z M16 9a4 4 0 0 1 0 6 M19 6a8 8 0 0 1 0 12';
  const EXT = '<svg class="icon bc-ext" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
  const label = b => [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
  let open = false;
  window.mmBcToggle = function(btn){
    open = btn.classList.toggle('open');
    btn.nextElementSibling.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  };

  function add(){
    const nav = document.querySelector('#side .nav-items'); if (!nav) return;
    nav.querySelectorAll('.js-bc-menu').forEach(e => e.remove());
    const html = `<button class="cat js-bc-menu ${open ? 'open' : ''}" aria-expanded="${open}" onclick="mmBcToggle(this)">${ic('megaphone')}브랜드 채널${ic('chevron').replace('class="icon"', 'class="icon ar"')}</button>` +
      `<div class="sub js-bc-menu ${open ? 'open' : ''}">${LINKS.map(([t, u]) => `<a class="bc-link" href="${u}" target="_blank" rel="noopener" title="${t} 열기 (새 창)">${t}${EXT}</a>`).join('')}</div>`;
    const cats = [...nav.querySelectorAll(':scope > .cat')];
    const users = cats.find(b => label(b) === '사용자 관리');
    if (users) return users.insertAdjacentHTML('beforebegin', html);
    const soonLab = [...nav.querySelectorAll(':scope > .mm-nav-grp')].find(e => e.textContent.trim() === '준비 중');
    if (soonLab) return soonLab.insertAdjacentHTML('beforebegin', html);
    nav.insertAdjacentHTML('beforeend', html);
  }
  const renderSideBc = renderSide;
  renderSide = function(){
    const r = renderSideBc.apply(this, arguments);
    try { add(); } catch (e) { console.warn('브랜드 채널 메뉴 실패', e); }
    return r;
  };
  try { add(); } catch (e) {}

  const st = document.createElement('style');
  st.textContent = `
  .sub a.bc-link{padding-right:32px}
  .sub a.bc-link .bc-ext{position:absolute;right:10px;top:50%;width:13px;height:13px;margin-top:-6.5px;opacity:.55}
  .sub a.bc-link:hover .bc-ext{opacity:1}
  .mm-fly-l a.bc-link{position:relative;padding-right:30px}
  .mm-fly-l a.bc-link .bc-ext{position:absolute;right:9px;top:50%;width:12px;height:12px;margin-top:-6px;opacity:.6}`;
  document.head.appendChild(st);
})();
