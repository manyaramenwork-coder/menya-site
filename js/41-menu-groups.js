
/* ==========================================================
   메뉴 묶음 정리 · 상단 사용자 표시 (2026-11-06)
   - 왼쪽 메뉴: 운영 / 매장 데이터 / 분석 / 관리 / 준비 중 제목으로 묶음
     (목록에 없는 새 메뉴는 '관리' 맨 아래, 준비중 메뉴는 '준비 중'으로)
   - 거래처·계정 관리 아이콘: 책 → 건물(partner)
   - 상단 동그라미: 성 뺀 이름(3글자 → 뒤 2글자), 사진이 있으면 사진 우선, 오른쪽 아래 초록 점(로그인 중)
   - 기존 코드는 고치지 않고, 마지막 renderSide 뒤에 순서만 다시 정리
   ========================================================== */
(function(){
  const GROUPS = [
    ['운영', ['대시보드', '공지사항', '상신·결재', '가맹점 현황']],
    ['매장 데이터', ['매출 관리', '제때 관리', '본사 발주·재고', '인사관리']],
    ['분석', ['분석 시스템']],
    ['관리', ['매뉴얼 관리', '거래처·계정 관리', '사용자 관리']]
  ];
  const label = b => [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();

  function arrange(){
    const nav = document.querySelector('#side .nav-items'); if (!nav) return;
    nav.querySelectorAll(':scope > .nav-soon-label, :scope > .mm-nav-grp').forEach(e => e.remove());
    const buckets = GROUPS.map(() => []), soon = [], rest = [];
    [...nav.querySelectorAll(':scope > .cat')].forEach(b => {
      const sub = b.nextElementSibling && b.nextElementSibling.classList.contains('sub') ? b.nextElementSibling : null;
      const u = { name: label(b), b, sub };
      if (b.querySelector('.soon') && u.name !== '대시보드') return soon.push(u);
      const gi = GROUPS.findIndex(g => g[1].includes(u.name));
      gi < 0 ? rest.push(u) : buckets[gi].push(u);
    });
    buckets.forEach((list, gi) => list.sort((x, y) => GROUPS[gi][1].indexOf(x.name) - GROUPS[gi][1].indexOf(y.name)));
    buckets[3].push(...rest);
    GROUPS.map((g, i) => [g[0], buckets[i]]).concat([['준비 중', soon]]).forEach(([t, list]) => {
      if (!list.length) return;
      const lab = document.createElement('div'); lab.className = 'mm-nav-grp'; lab.textContent = t;
      nav.appendChild(lab);
      list.forEach(u => { nav.appendChild(u.b); if (u.sub) nav.appendChild(u.sub); });
    });
    // 거래처·계정 관리 아이콘 (매뉴얼 관리와 겹치지 않게)
    const bi = nav.querySelector(':scope > .cat.js-bi-menu');
    const ico = bi && bi.querySelector('svg.icon:not(.ar)');
    if (ico && typeof PATHS !== 'undefined' && PATHS.partner && !ico.dataset.mm) {
      ico.outerHTML = ic('partner').replace('<svg ', '<svg data-mm="1" ');
    }
  }
  const renderSideGrp = renderSide;
  renderSide = function(){
    const r = renderSideGrp.apply(this, arguments);
    try { arrange(); } catch (e) { console.warn('메뉴 정리 실패', e); }
    return r;
  };
  try { arrange(); } catch (e) {}

  /* ---------- 상단 동그라미: 이름 두 글자 ---------- */
  const shortName = n => {
    // 여러 단어 이름(예: 멘야마쯔리 관리자)은 마지막 단어를 그대로
    const w = String(n || '').trim().split(/\s+/);
    if (w.length > 1 && /^[가-힣]{2,3}$/.test(w[w.length - 1])) return w[w.length - 1];
    n = String(n || '').replace(/\s/g, '');
    if (/^[가-힣]{3,}$/.test(n)) return n.slice(-2);
    if (/^[가-힣]{2}$/.test(n)) return n;
    return (n[0] || '').toUpperCase();
  };
  function avName(){
    const a = document.querySelector('.top .av'); if (!a) return;
    if (a.querySelector('img')) { a.classList.remove('mm-av-nm'); return; }
    const u = (typeof SESSION !== 'undefined' && SESSION.user) || window.CURRENT_USER;
    const s = shortName(a.dataset.n || (u && u.name)); if (!s) return;
    if (a.textContent !== s) a.textContent = s;
    a.classList.toggle('mm-av-nm', s.length > 1);
    a.classList.toggle('mm-av-3', s.length > 2);
  }
  const av = document.querySelector('.top .av');
  if (av) { new MutationObserver(avName).observe(av, { childList: true, characterData: true, subtree: true }); avName(); }

  const st = document.createElement('style');
  st.textContent = `
  .mm-nav-grp{margin:16px 0 4px 14px;font-size:10px;letter-spacing:.12em;color:#7d8277}
  .nav-items>.mm-nav-grp:first-child{margin-top:4px}
  @media(min-width:861px){body.mm-col .side .mm-nav-grp{font-size:0;height:1px;padding:0;background:#ffffff16;margin:12px 10px}body.mm-col .side .nav-items>.mm-nav-grp:first-child{display:none}}
  .top .av{position:relative;overflow:visible!important;border-radius:8px!important;border:2px solid transparent!important;background-clip:padding-box!important}
  .top .av img{border-radius:6px}
  .top .av::after{content:"";position:absolute;inset:-2px;width:auto;height:auto;border:0;border-radius:9px;padding:2px;background:linear-gradient(135deg,#c62429,#f0a020,#2fa84f,#2f6fd6);background:conic-gradient(from var(--mm-av-a),#c62429,#f0a020,#2fa84f,#2f6fd6,#c62429);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;animation:mmAvSpin 4s linear infinite}
  @property --mm-av-a{syntax:'<angle>';inherits:false;initial-value:0deg}
  @keyframes mmAvSpin{to{--mm-av-a:360deg}}
  @media (prefers-reduced-motion:reduce){.top .av::after{animation:none}}
  .top .av.mm-av-nm{font-size:11px;letter-spacing:-.04em}
  .top .av.mm-av-3{font-size:9px;letter-spacing:-.08em}`;
  document.head.appendChild(st);
})();
