/* ---------- 메뉴·화면 전환 ---------- */
const IC = {
  area: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>',
  fav: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  log: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  comm: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  listing: '<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  script: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  ingest: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
  ftc: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  naver: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'
};
const svg = k => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;
// 메뉴 묶음: 영업기획(분석·계획) → 매장 찾기(수집) → 리드 관리(연락·기록)
// 전체 매장 원본(공공데이터를 그대로 모은 것)은 영업 DB가 아니라서 '관리'에 둠
const DB_ITEM = ['db', '전체 매장 원본', '공공데이터로 모은 매장 전체 검색'];
const NAV_GROUPS = [
  ['영업기획', [['area', '상권분석', '소상공인365 상권·입지 분석'], ['ftc', '정보공개서 분석', '공정위 가맹점 수 변화'], ['naver', '급성장 브랜드', '인허가 최근 개업·폐업 추이'], ['script', '영업 스크립트', '통화하면서 보는 문구']]],
  ['매장 찾기', [['target', '샵인샵 타겟', '우리 메뉴·상권 기준 우편 대상'], ['listing', '양도 매물', '어사이드로 들어온 매물']]],
  ['리드 관리', [['inbox', '신청함', '랜딩 신청'], ['comm', '커뮤니티 리드', '카페 글·댓글·쪽지 준 분'], ['fav', '관심 매장', '담아 둔 매장'], ['log', '연락 기록', '통화·방문 기록']]]
];
const NAV = NAV_GROUPS.flatMap(g => g[1].map(([k, l]) => [k, l]));
const BNAV = [['fav', '관심'], ['target', '타겟'], ['log', '기록'], ['inbox', '신청함'], ['more', '더보기']];
state.badge = {};
function buildNav(){
  const b = state.badge;
  const link = ([k, l]) => `<a href="#${k}" data-v="${k}" class="${state.view === k ? 'on' : ''}" ${state.view === k ? 'aria-current="page"' : ''}>${svg(k)}<span>${l}</span>${b[k] ? `<em>${b[k]}</em>` : ''}</a>`;
  $('side').innerHTML = NAV_GROUPS.map(([g, items]) => `<div class="side-grp">${g}</div>` + items.map(link).join('')).join('') +
    '<div class="side-gap"></div><div class="side-grp">관리</div>' + link(DB_ITEM) + (state.admin ? link(['ingest', '수집 현황']) : '') +
    '<div class="side-gap"></div><a href="https://menyamatsuri.work/" class="ext">매장관리로 돌아가기</a>';
  const inMore = !BNAV.some(([k]) => k === state.view);
  $('bnav').innerHTML = BNAV.map(([k, l]) => {
    const on = k === 'more' ? inMore : state.view === k;
    const badge = k === 'more' ? (b.comm || b.listing) : b[k];
    return `<a href="#${k === 'more' ? state.view : k}" data-v="${k}" class="${on ? 'on' : ''}">${svg(k)}<span>${l}</span>${badge ? '<i class="dot"></i>' : ''}</a>`;
  }).join('');
}
function setBadges(s){
  state.badge = { inbox: s.inbox_new || 0, comm: s.comm_open || 0, listing: s.listings_new || 0, fav: s.favs || 0 };
  buildNav();
}
$('side').addEventListener('click', e => { const a = e.target.closest('a[data-v]'); if (!a) return; e.preventDefault(); go(a.dataset.v); });
$('bnav').addEventListener('click', e => {
  const a = e.target.closest('a[data-v]'); if (!a) return; e.preventDefault();
  if (a.dataset.v === 'more') return openMore();
  go(a.dataset.v);
});
function openMore(){
  const inBar = BNAV.map(([k]) => k);
  const btn = ([k, t, d]) => `<button data-v="${k}">${svg(k)}<span><b>${t}</b><small>${d}</small></span>${state.badge[k] ? `<em>${state.badge[k]}</em>` : ''}</button>`;
  const groups = NAV_GROUPS.map(([g, items]) => [g, items.filter(([k]) => !inBar.includes(k))]).filter(([, items]) => items.length);
  groups.push(['관리', [DB_ITEM].concat(state.admin ? [['ingest', '수집 현황', '지역 수집 진행·실패 확인']] : [])]);
  $('more-sheet').innerHTML = '<div class="sheet-hd">더보기</div>' + groups.map(([g, items]) => `<div class="sheet-grp">${g}</div>` + items.map(btn).join('')).join('') +
    `<a href="https://menyamatsuri.work/">매장관리로 돌아가기</a><button data-v="logout" class="lo">로그아웃</button>`;
  $('more-sheet').hidden = false; $('scrim').hidden = false;
}
$('more-sheet').addEventListener('click', async e => {
  const b = e.target.closest('button[data-v]'); if (!b) return;
  if (b.dataset.v === 'logout') { await SB.auth.signOut(); location.reload(); return; }
  closePanel(); go(b.dataset.v);
});
const VIEWS = ['fav', 'log', 'inbox', 'comm', 'listing', 'db', 'target', 'script', 'ingest', 'ftc', 'naver', 'area'];
function go(v){
  if (!VIEWS.includes(v) || (v === 'ingest' && !state.admin)) v = 'db';
  if (state.view === 'script' && v !== 'script' && SC.editing) {
    if (SC.dirty && !confirm('저장하지 않은 스크립트 수정 내용이 있어요. 나갈까요?')) { buildNav(); return; }
    SC.editing = false; SC.dirty = false;
  }
  state.view = v;
  VIEWS.forEach(k => $('sec-' + k).hidden = k !== v);
  $('filters').hidden = v !== 'db';
  document.querySelectorAll('.db-only').forEach(x => x.hidden = v !== 'db');
  if (location.hash !== '#' + v) history.replaceState(null, '', '#' + v);
  buildNav(); window.scrollTo(0, 0);
  load(true);
}
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v && v !== state.view && VIEWS.includes(v)) go(v); });
function setDbMode(m){
  state.dbMode = m; $('v-list').classList.toggle('on', m === 'list'); $('v-board').classList.toggle('on', m === 'board');
  $('list-view').hidden = m !== 'list'; $('board-view').hidden = m !== 'board'; load(true);
}
$('v-list').addEventListener('click', () => setDbMode('list'));
$('v-board').addEventListener('click', () => setDbMode('board'));
state.dbMode = 'list';


