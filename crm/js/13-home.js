/* ---------- 새 화면 구성 (2026-11-23 시안) ----------
   홈 대시보드 · 접히는 사이드 메뉴 · 상단 검색/알림/사용자 · 상권분석 옆 요약 패널
   14-add-boot.js(boot)보다 먼저 불러와야 함. 기존 함수(go·load·buildNav·show·rpShow·rpPick·rpDraw)를 감싸서 바꾸고, 원래 동작은 그대로 둠.
   숫자는 전부 실제 영업관리 DB(lead_stats·lead_list)에서만 가져옴 — 없는 숫자는 만들지 않음. */
Object.assign(IC, {
  home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  plan: '<path d="M3 3v18h18"/><path d="M7 15l3-4 3 2 5-6"/>',
  store: '<path d="M4 9h16l-1-5H5z"/><path d="M5 9v11h14V9"/><path d="M9 20v-5h6v5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.4.2 4.2 2 4.9 4.9"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  pin: '<path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  check: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'
});
const ico = (k, s) => `<svg width="${s || 20}" height="${s || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;
if (!VIEWS.includes('home')) VIEWS.unshift('home');
BNAV[0] = ['home', '홈'];
const HM = { stats: null, cats: null, tab: 'cat' };
const TITLES = { home: '홈 대시보드', area: '상권분석', ftc: '정보공개서 분석', naver: '급성장 브랜드', script: '영업 스크립트', db: '전체 매장 원본', target: '샵인샵 타겟', listing: '양도 매물', inbox: '신청함', comm: '커뮤니티 리드', fav: '관심 매장', log: '연락 기록', ingest: '수집 현황' };
const GROUP_IC = { '영업기획': 'plan', '매장 찾기': 'store', '리드 관리': 'users' };
let navOpen = {}; try { navOpen = JSON.parse(localStorage.getItem('crm-nav') || '{}') || {}; } catch (e) {}

/* 시작 화면 = 상권분석. 주소에 화면이 없거나(#map 같은 옛 주소 포함) 전체 매장 원본이면 상권분석부터 */
const START_VIEW = 'area';
{ const h0 = location.hash.slice(1); if (!VIEWS.includes(h0) || h0 === 'db') history.replaceState(null, '', '#' + START_VIEW); }

/* lead_stats는 무거워서(5초 안팎) 30초 동안 같은 결과를 같이 씀 */
let statsP = null;
function getStats(){
  if (!statsP) { statsP = rpc('lead_stats'); statsP.then(() => setTimeout(() => { statsP = null; }, 30000), () => { statsP = null; }); }
  return statsP;
}

/* 첫 화면을 lead_stats 기다리지 않고 바로 띄움 — 요약 숫자·필터는 뒤에서 채움 */
boot = async function(){
  const { data } = await SB.auth.getSession();
  if (!data.session) { show('login'); return; }
  show('app');
  try {
    const { data: me } = await SB.from('profiles').select('name, role').eq('id', data.session.user.id).maybeSingle();
    $('me').textContent = me && me.name ? me.name : '';
    state.admin = !!(me && me.role === 'admin');
  } catch (e) {}
  go(location.hash.slice(1) || START_VIEW);
  getStats().then(s => { applyStats(s); fillFilters(s); if (state.view === 'home') { HM.stats = s; renderHome(); } })
    .catch(e => { if (/권한/.test((e && e.message) || '')) show('noperm'); else toast(errMsg(e), true); });
};

/* ---------- 사이드 메뉴 ---------- */
buildNav = function(){
  const b = state.badge || {}, v = state.view;
  const sub = ([k, l]) => `<a href="#${k}" data-v="${k}" class="sub${v === k ? ' on' : ''}" ${v === k ? 'aria-current="page"' : ''}><span>${l}</span>${b[k] ? `<em>${b[k]}</em>` : ''}</a>`;
  const grp = (g, items, icon) => {
    const has = items.some(([k]) => k === v), open = has || navOpen[g] !== false;
    const cnt = items.reduce((n, [k]) => n + (b[k] || 0), 0);
    return `<div class="nav-grp${open ? ' open' : ''}${has ? ' cur' : ''}"><button type="button" class="nav-gh" data-g="${esc(g)}" aria-expanded="${open}">${ico(icon)}<span>${g}</span>${!open && cnt ? `<em>${cnt}</em>` : ''}<i class="chev">${ico('chev', 16)}</i></button><div class="nav-sub">${items.map(sub).join('')}</div></div>`;
  };
  $('side').innerHTML =
    `<a class="side-brand" href="#home" data-v="home"><span class="logo">${ico('store', 22)}</span><span><b>멘야마쯔리</b><small>MENYA MATSURI</small></span></a>` +
    `<div class="side-sys">샵인샵 영업관리 시스템</div>` +
    `<a href="#home" data-v="home" class="top-item${v === 'home' ? ' on' : ''}">${ico('home')}<span>홈 대시보드</span></a>` +
    NAV_GROUPS.map(([g, items]) => grp(g, items, GROUP_IC[g] || 'plan')).join('') +
    grp('관리', [DB_ITEM].concat(state.admin ? [['ingest', '수집 현황']] : []), 'gear') +
    `<div class="side-foot"><a href="https://menyamatsuri.work/" class="ext">${ico('out', 18)}<span>매장관리로 돌아가기</span></a></div>`;
  const inMore = !BNAV.some(([k]) => k === v);
  $('bnav').innerHTML = BNAV.map(([k, l]) => {
    const on = k === 'more' ? inMore : v === k;
    const badge = k === 'more' ? (b.comm || b.listing) : b[k];
    return `<a href="#${k === 'more' ? v : k}" data-v="${k}" class="${on ? 'on' : ''}">${ico(k === 'home' ? 'home' : k)}<span>${l}</span>${badge ? '<i class="dot"></i>' : ''}</a>`;
  }).join('');
  const n = (b.inbox || 0) + (b.comm || 0) + (b.listing || 0);
  const bn = $('top-bell-n'); if (bn) { bn.textContent = n > 99 ? '99+' : n; bn.hidden = !n; }
};
$('side').addEventListener('click', e => {
  const h = e.target.closest('.nav-gh'); if (!h) return;
  const g = h.dataset.g, box = h.parentNode, open = !box.classList.contains('open');
  box.classList.toggle('open', open); h.setAttribute('aria-expanded', open);
  navOpen[g] = open; try { localStorage.setItem('crm-nav', JSON.stringify(navOpen)); } catch (e2) {}
});

/* ---------- 상단바: 제목·검색·알림·사용자 ---------- */
(() => {
  const top = document.querySelector('header.top'); if (!top || $('top-title')) return;
  const me = $('me'), lo = $('logout'), back = top.querySelector('a.hide-m');
  const title = document.createElement('div'); title.className = 'top-title'; title.id = 'top-title'; title.textContent = '샵인샵 영업관리';
  const f = document.createElement('form'); f.className = 'top-search'; f.id = 'top-search'; f.setAttribute('role', 'search');
  f.innerHTML = `${ico('search', 18)}<input type="search" id="top-q" placeholder="매장, 상호, 주소, 전화번호를 검색하세요." aria-label="매장 검색" autocomplete="off">`;
  const bell = document.createElement('a'); bell.className = 'top-ic'; bell.href = '#inbox'; bell.id = 'top-bell'; bell.title = '새 신청·커뮤니티·양도 매물';
  bell.innerHTML = `${ico('bell', 21)}<i id="top-bell-n" hidden></i>`;
  const help = document.createElement('a'); help.className = 'top-ic hide-m'; help.href = '#script'; help.title = '영업 스크립트';
  help.innerHTML = `<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/></svg>`;
  const u = document.createElement('details'); u.className = 'me-menu'; u.id = 'me-menu';
  u.innerHTML = `<summary><span class="av" id="me-av">${ico('users', 18)}</span><span class="me-t"><b id="me-name"></b><small id="me-role">샵인샵 영업관리</small></span><i class="chev">${ico('chev', 16)}</i></summary><div class="me-pop"></div>`;
  const pop = u.querySelector('.me-pop');
  if (back) { back.className = 'me-link'; back.innerHTML = ico('store', 16) + ' 매장관리로'; pop.appendChild(back); }
  if (lo) { lo.className = 'me-link'; lo.innerHTML = ico('out', 16) + ' 로그아웃'; pop.appendChild(lo); }
  me.hidden = true;
  const sp = top.querySelector('.sp');
  top.insertBefore(title, sp); top.insertBefore(f, sp);
  top.appendChild(bell); top.appendChild(help); top.appendChild(u);
  f.addEventListener('submit', e => { e.preventDefault(); const q = $('top-q').value.trim(); $('f-q').value = q; if (state.view === 'db') load(true); else go('db'); });
  bell.addEventListener('click', e => { e.preventDefault(); go('inbox'); });
  help.addEventListener('click', e => { e.preventDefault(); go('script'); });
  document.addEventListener('click', e => { if (!e.target.closest('#me-menu')) u.open = false; });
  new MutationObserver(() => { const n = me.textContent.trim(); $('me-name').textContent = n || '사용자'; $('me-av').textContent = n ? n.slice(-2) : ''; if (!n) $('me-av').innerHTML = ico('users', 18); $('me-role').textContent = state.admin ? '관리자' : '샵인샵 영업'; })
    .observe(me, { childList: true, characterData: true, subtree: true });
})();
const _show = show;
show = function(w){ _show(w); document.body.classList.toggle('in-app', w === 'app'); };

/* ---------- 화면 전환 ---------- */
const _go = go;
go = function(v){
  _go(v);
  const t = $('top-title'); if (t) t.textContent = TITLES[state.view] || '샵인샵 영업관리';
  const mr = $('me-role'); if (mr) mr.textContent = state.admin ? '관리자' : '샵인샵 영업';
  document.body.dataset.view = state.view;
};
const _load = load;
load = function(reset){ if (state.view === 'home') return loadHome(); return _load(reset); };

/* ---------- 홈 대시보드 ---------- */
const nfm = n => (n == null || isNaN(n)) ? '-' : Number(n).toLocaleString();
const rate = (a, b) => b ? Math.round(a / b * 100) : 0;
async function loadHome(){
  const box = $('home-body');
  if (!HM.stats) box.innerHTML = '<div class="rp-empty muted">불러오는 중이에요…</div>';
  try {
    const [s, l] = await Promise.all([getStats(), HM.cats ? Promise.resolve(null) : rpc('lead_list', { p: { limit: 1, offset: 0, sort: 'score' } }).catch(() => null)]);
    HM.stats = s; if (l && l.cats) HM.cats = l.cats;
    if (typeof setBadges === 'function') setBadges(s);
    if (state.view !== 'home') return;
    renderHome();
  } catch (e) { box.innerHTML = `<div class="rp-empty muted">대시보드를 불러오지 못했어요.<br><small>${esc(errMsg(e))}</small></div>`; }
}
function heroArt(){
  return `<svg class="hero-art" viewBox="0 0 360 220" aria-hidden="true">
    <defs><linearGradient id="hg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8f74ff"/><stop offset="1" stop-color="#5b3df0"/></linearGradient>
    <linearGradient id="hg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e9e4ff"/></linearGradient></defs>
    <ellipse cx="190" cy="200" rx="150" ry="16" fill="#d9d1ff" opacity=".6"/>
    <rect x="22" y="40" width="74" height="56" rx="10" fill="#fff" opacity=".85"/>
    <rect x="34" y="70" width="8" height="16" rx="2" fill="#b7a6ff"/><rect x="47" y="62" width="8" height="24" rx="2" fill="#9c86ff"/><rect x="60" y="54" width="8" height="32" rx="2" fill="#7c5cff"/><rect x="73" y="48" width="8" height="38" rx="2" fill="#5b3df0"/>
    <rect x="110" y="92" width="190" height="104" rx="10" fill="url(#hg2)" stroke="#d6ccff"/>
    <path d="M100 70h210l-12 34H112z" fill="url(#hg1)"/>
    <g fill="#fff" opacity=".9"><path d="M124 70h22l-4 34h-22z"/><path d="M168 70h22l-2 34h-22z"/><path d="M212 70h22l0 34h-22z"/><path d="M256 70h22l2 34h-22z"/></g>
    <path d="M112 104q12 10 24 0q12 10 24 0q12 10 24 0q12 10 24 0q12 10 24 0q12 10 24 0q12 10 24 0q12 10 21 0" fill="none" stroke="#5b3df0" stroke-width="4" stroke-linecap="round"/>
    <rect x="132" y="126" width="56" height="70" rx="6" fill="#efeaff" stroke="#c9bcff"/><rect x="204" y="126" width="78" height="44" rx="6" fill="#efeaff" stroke="#c9bcff"/>
    <rect x="150" y="52" width="110" height="24" rx="6" fill="#1d2050"/><text x="205" y="69" text-anchor="middle" font-size="13" font-weight="800" fill="#fff" font-family="Pretendard Variable,sans-serif">멘야마쯔리</text>
    <path d="M292 8c-15 0-26 11-26 25 0 19 26 41 26 41s26-22 26-41c0-14-11-25-26-25z" fill="url(#hg1)"/><circle cx="292" cy="33" r="9" fill="#fff"/>
  </svg>`;
}
function renderHome(){
  const s = HM.stats || {}, st = s.stages || {};
  const kpi = (icon, label, val, unit, sub, tone) => `<div class="kpi ${tone || ''}"><span class="kpi-ic">${ico(icon, 22)}</span><span class="kpi-l">${label}</span><b>${nfm(val)}<small>${unit}</small></b><span class="kpi-s">${sub}</span></div>`;
  const quick = [['area', 'pin', '상권 리포트 만들기'], ['log', 'log', '연락 기록'], ['target', 'target', '샵인샵 타겟 보기'], ['script', 'script', '영업 스크립트']];
  const bar = (label, a, b, note) => { const p = rate(a, b); return `<div class="pb"><div class="pb-t"><span>${label} <small>${note}</small></span><b>${b ? p + '%' : '-'}</b></div><div class="pb-b"><i style="width:${Math.min(100, p)}%"></i></div></div>`; };
  const alerts = [
    [s.inbox_new, '신청함에 연락 안 한 신청', 'inbox', 'hot'],
    [s.overdue, '재연락 기한이 지난 매장', 'fav', 'hot'],
    [s.due_today, '오늘 재연락할 매장', 'fav', ''],
    [s.comm_open, '커뮤니티 답장 대기', 'comm', ''],
    [s.listings_new, '최근 7일 새 양도 매물', 'listing', '']
  ].filter(a => a[0] > 0);
  const flow = STAGES.slice(0, 7).map(([k, l]) => [l, st[k] || 0]);
  const fmax = Math.max(1, ...flow.slice(1).map(x => x[1]));
  const cats = Object.entries(HM.cats || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const regs = (s.regions || []).slice().sort((a, b) => b.n - a.n).slice(0, 6).map(r => [((r.sido || '') + ' ' + (r.sigungu || '')).trim() || '지역 미상', r.n]);
  const rows = HM.tab === 'cat' ? cats : regs, rmax = Math.max(1, ...rows.map(r => r[1]));
  const place = RP && RP.place ? RP.place : null;
  $('home-body').innerHTML = `
  <div class="hm-top">
    <div class="hero"><div class="hero-t"><span class="pill">샵인샵 영업 통합관리</span><h2>데이터로 찾는<br><em>최적의 샵인샵 매장</em>,<br>멘야마쯔리와 함께</h2><p>상권분석부터 매장 수집, 연락 기록까지<br>한 곳에서 관리하는 샵인샵 영업 전용 화면이에요.</p></div>${heroArt()}</div>
    ${kpi('store', '전체 매장 수', s.total, '곳', '공공데이터로 모은 원본')}
    ${kpi('phone', '이번 주 통화', s.calls_week, '건', `연결 ${nfm(s.connected_week)}건`)}
    ${kpi('heart', '이번 주 신규 관심', s.interested_week, '곳', `미팅 진행 ${nfm(s.meetings)}곳`)}
    ${kpi('check', '계약', s.contracts, '건', '누적 계약', 'ok')}
  </div>
  <div class="hm-grid">
    <div class="hm-col">
      <div class="hcard"><h3>빠른 실행</h3><div class="quick">${quick.map(([k, i, l]) => `<button type="button" data-go="${k}"><span>${ico(i, 20)}</span>${l}</button>`).join('')}</div></div>
      <div class="hcard"><h3>이번 주 영업 현황</h3>${bar('통화 연결률', s.connected_week || 0, s.calls_week || 0, `${nfm(s.connected_week)} / ${nfm(s.calls_week)}건`)}${bar('관심 전환율', s.interested_week || 0, s.connected_week || 0, `연결 중 ${nfm(s.interested_week)}곳`)}</div>
      <div class="hcard"><div class="hc-hd"><h3>${ico('bell', 18)} 주요 알림</h3></div>${alerts.length ? `<ul class="alerts">${alerts.map(([n, t, k, c]) => `<li><button type="button" data-go="${k}" class="${c}"><span>${t}</span><b>${nfm(n)}</b></button></li>`).join('')}</ul>` : '<p class="muted" style="margin:6px 0 0">지금 처리할 알림이 없어요.</p>'}</div>
    </div>
    <div class="hm-col">
      <div class="hcard area-card">
        <div class="hc-hd"><h3>상권분석</h3><span class="muted">주소로 상담 위치를 찾아 상권 보고서를 만들어요.</span></div>
        <div class="hm-tabs">${SBIZ.map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === 'report' ? 'on' : ''}">${l}</button>`).join('')}</div>
        <form class="hm-search" id="hm-search"><div class="in">${ico('search', 18)}<input type="search" id="hm-q" placeholder="상담 위치 주소 또는 매장 이름 (예: 청주시 서원구 개신동)" value="${esc(place ? place.label || '' : '')}" autocomplete="off"></div>
          <div class="seg" id="hm-rad">${[300, 500, 1000].map(r => `<button type="button" data-r="${r}" class="${RP.r === r ? 'on' : ''}">${r >= 1000 ? '1km' : r + 'm'}</button>`).join('')}</div>
          <button class="btn pri" type="submit">${ico('plan', 16)} 분석하기</button></form>
        ${place ? `<p class="muted hm-last">${ico('pin', 15)} 최근 분석 위치: <b>${esc(place.label || '')}</b> · 반경 ${RP.r >= 1000 ? '1km' : RP.r + 'm'} <button type="button" class="lnk" data-go="area">이어서 보기</button></p>` : ''}
        <h4>영업 단계 흐름 <small>전체 매장 기준</small></h4>
        <div class="funnel">${flow.map(([l, n], i) => `<div class="fn"><span class="fn-l">${l}</span><div class="fn-b"><i style="width:${i === 0 ? 100 : Math.max(2, n / fmax * 100)}%"></i></div><b>${nfm(n)}</b></div>`).join('')}</div>
        <p class="muted" style="margin:6px 0 0;font-size:12px">'수집'은 전체 매장이라 막대를 꽉 채워 표시했어요. 나머지 막대는 1차 통화~계약 중 가장 많은 단계를 기준으로 그렸어요.</p>
      </div>
    </div>
    <div class="hm-col">
      <div class="hcard"><div class="hc-hd"><h3>${ico('pin', 18)} 수집 매장 구성</h3></div>
        <div class="seg2 hm-seg" id="hm-tab"><button type="button" data-t="cat" class="${HM.tab === 'cat' ? 'on' : ''}">업종별</button><button type="button" data-t="reg" class="${HM.tab === 'reg' ? 'on' : ''}">지역별</button></div>
        ${rows.length ? `<div class="hbars">${rows.map(([l, n]) => `<div class="hb"><span title="${esc(l)}">${esc(l)}</span><div><i style="width:${Math.max(3, n / rmax * 100)}%"></i></div><b>${nfm(n)}</b></div>`).join('')}</div>` : '<p class="muted">자료가 없어요.</p>'}
      </div>
      <div class="hcard"><div class="hc-hd"><h3>${ico('check', 18)} 영업관리 현황</h3><button type="button" class="lnk" data-go="db">전체보기 ›</button></div>
        <div class="mini4">
          <button type="button" data-go="inbox">${ico('inbox', 20)}<span>새 신청</span><b>${nfm(s.inbox_new)}<small>건</small></b></button>
          <button type="button" data-go="db">${ico('users', 20)}<span>미팅</span><b>${nfm(st.meeting || 0)}<small>곳</small></b></button>
          <button type="button" data-go="db">${ico('script', 20)}<span>제안</span><b>${nfm(st.proposal || 0)}<small>곳</small></b></button>
          <button type="button" data-go="fav">${ico('cal', 20)}<span>오늘 재연락</span><b>${nfm(s.due_today)}<small>곳</small></b></button>
        </div>
      </div>
    </div>
  </div>`;
}
$('home-body').addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
  const t = e.target.closest('#hm-tab button[data-t]'); if (t) { HM.tab = t.dataset.t; renderHome(); return; }
  const r = e.target.closest('#hm-rad button[data-r]'); if (r) { RP.r = +r.dataset.r; document.querySelectorAll('#hm-rad button').forEach(x => x.classList.toggle('on', x === r)); if (typeof rpRad === 'function') rpRad(); return; }
  const tab = e.target.closest('.hm-tabs button[data-tab]'); if (tab) { AR.tab = tab.dataset.tab; try { localStorage.setItem('crm-area-tab', AR.tab); } catch (e2) {} go('area'); }
});
$('home-body').addEventListener('submit', e => {
  if (e.target.id !== 'hm-search') return; e.preventDefault();
  const q = $('hm-q').value.trim();
  AR.tab = 'report'; try { localStorage.setItem('crm-area-tab', 'report'); } catch (e2) {}
  go('area');
  if (q && (!RP.place || q !== RP.place.label)) { $('rp-q').value = q; const sb = $('rp-search'); if (sb) setTimeout(() => sb.click(), 50); }
});

/* ---------- 상권 리포트: 지도 옆 요약 패널 ---------- */
(() => {
  const map = $('rp-map'); if (!map || $('rp-side')) return;
  const stage = document.createElement('div'); stage.className = 'rp-stage';
  map.parentNode.insertBefore(stage, map); stage.appendChild(map);
  const side = document.createElement('aside'); side.className = 'rp-side'; side.id = 'rp-side'; stage.appendChild(side);
  side.addEventListener('click', e => { if (e.target.closest('#rp-side-go')) $('rp-go').click(); });
})();
function rpSideRender(){
  const side = $('rp-side'); if (!side) return;
  const p = RP.place, r = RP.r >= 1000 ? '1km' : RP.r + 'm';
  const step = (n, t, d, done) => `<li class="${done ? 'done' : ''}"><span>${done ? '✓' : n}</span><div><b>${t}</b><small>${d}</small></div></li>`;
  const items = [['users', '배후 인구', '반경 인구·연령·가구·1인가구·종사자'], ['store', '경쟁점', '반경 안 우리 메뉴(라멘·우동·돈카츠·덮밥) 매장'], ['plan', '개업·폐업 추이', '음식점 인허가 기준'], ['db', '업종 구성', '반경과 시군구 비중 비교'], ['check', '프랜차이즈 평균매출', '공정위 정보공개서']];
  side.innerHTML = `
    <div class="hcard"><div class="hc-hd"><h3>${ico('pin', 18)} 선택 위치 요약</h3></div>
      ${p ? `<p class="rs-addr">${esc(p.label || '선택한 위치')}</p><div class="rs-kv"><span>분석 반경</span><b>${r}</b></div><div class="rs-kv"><span>좌표</span><b>${p.lat != null ? (+p.lat).toFixed(5) + ', ' + (+p.lng).toFixed(5) : '-'}</b></div>`
          : '<p class="muted" style="margin:4px 0 0">아직 고른 위치가 없어요. 위 검색창에 주소나 매장 이름을 넣어 주세요.</p>'}
      <button type="button" class="btn pri rs-go" id="rp-side-go" ${p ? '' : 'disabled'}>${ico('plan', 16)} 이 위치로 분석하기</button>
    </div>
    <div class="hcard"><h3>진행 순서</h3><ol class="rs-steps">${step(1, '주소 검색', '주소·매장 이름으로 찾기', !!p)}${step(2, '핀 확인', '핀을 끌거나 지도를 눌러 조정', !!p)}${step(3, '분석하기', 'A4 보고서 7~9장으로 정리', false)}</ol></div>
    <div class="hcard"><h3>보고서에 들어가는 내용</h3><ul class="rs-items">${items.map(([i, t, d]) => `<li><span>${ico(i, 16)}</span><div><b>${t}</b><small>${d}</small></div></li>`).join('')}</ul></div>`;
}
const _rpPick = rpPick;
rpPick = function(){ _rpPick(); rpSideRender(); };
const _rpShow = rpShow;
rpShow = function(report){ _rpShow(report); const s = $('rp-side'); if (s) s.hidden = !!report; };
const _rpDraw = rpDraw;
rpDraw = function(fit){
  _rpDraw(fit);
  try {
    if (NM.circle) NM.circle.setOptions({ strokeColor: '#6b4df5', fillColor: '#7c5cff', fillOpacity: .1 });
    NM.dots.forEach(d => d.setOptions({ fillColor: '#6b4df5' }));
  } catch (e) {}
};
rpSideRender();
