/* ---------- 로그인 ---------- */
function show(which){
  $('loginbox').hidden = which !== 'login'; $('noperm').hidden = which !== 'noperm'; $('app').hidden = which !== 'app';
  $('logout').hidden = which === 'login'; $('bnav').hidden = which !== 'app';
}
$('loginbox').addEventListener('submit', async e => {
  e.preventDefault();
  const id = $('uid').value.trim(), pw = $('upw').value;
  if (!id || !pw) { $('lerr').textContent = '아이디와 비밀번호를 입력하세요.'; return; }
  $('lerr').textContent = '';
  const email = (id.indexOf('@') >= 0 ? id : id + CFG.idDomain).toLowerCase();
  const { error } = await SB.auth.signInWithPassword({ email, password: pw });
  $('upw').value = '';
  if (error) { $('lerr').textContent = '아이디 또는 비밀번호를 확인하세요.'; return; }
  boot();
});
$('logout').addEventListener('click', async () => { await SB.auth.signOut(); location.reload(); });

async function boot(){
  const { data } = await SB.auth.getSession();
  if (!data.session) { show('login'); return; }
  try {
    const s = await rpc('lead_stats');
    show('app');
    const { data: me } = await SB.from('profiles').select('name, role').eq('id', data.session.user.id).maybeSingle();
    $('me').textContent = me && me.name ? me.name : '';
    state.admin = !!(me && me.role === 'admin');
    applyStats(s); fillFilters(s); go(location.hash.slice(1) || 'db');
  } catch (e) {
    if (/권한/.test(e.message || '')) show('noperm'); else { show('app'); toast(errMsg(e), true); }
  }
}

/* ---------- 요약·필터 ---------- */
function applyStats(s){
  const items = [
    ['이번 주 통화', s.calls_week + '건'], ['연결', s.connected_week + '건'], ['신규 관심', s.interested_week + '곳'],
    ['오늘 재연락', s.due_today + '곳'], ['기한 지남', s.overdue + '곳', s.overdue > 0], ['계약', s.contracts + '건']
  ];
  $('stats').innerHTML = items.map(([l, v, a]) => `<div class="stat${a ? ' alert' : ''}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
  state.users = s.users || [];
  setBadges(s);
  const lb = $('log-by'); if (lb && lb.options.length <= 2) lb.innerHTML = '<option value="">담당 전체</option><option value="me">나</option>' + state.users.map(u => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('');
}
function fillFilters(s){
  state.regions = s.regions || [];
  $('f-region').innerHTML = `<option value="">전체 지역 (${(s.total || 0).toLocaleString()})</option>` +
    state.regions.map(r => `<option value="${esc(r.sido + '|' + r.sigungu)}">${esc((r.sido + ' ' + r.sigungu).trim() || '지역 미상')} (${r.n.toLocaleString()})</option>`).join('');
  $('f-stage').innerHTML = '<option value="">전체 단계</option>' + STAGES.map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
}
function filters(){
  const [sido, sigungu] = ($('f-region').value || '|').split('|');
  return { sido, sigungu, stage: $('f-stage').value, lunch: $('f-lunch').value, org: $('f-org').value,
    mine: $('f-mine').checked, due: $('f-due').checked, chain: $('f-chain').checked, name_check: $('f-nc').checked, all: $('f-all').checked, q: $('f-q').value.trim(), cats: state.cats };
}
function renderCats(cats){
  const keys = Object.keys(cats || {}).sort((a, b) => cats[b] - cats[a]);
  $('cats').innerHTML = `<button data-c="" class="${state.cats.length ? '' : 'on'}">전체 업종</button>` +
    keys.map(k => `<button data-c="${esc(k)}" class="${state.cats.includes(k) ? 'on' : ''}">${esc(k)}<small>${cats[k].toLocaleString()}</small></button>`).join('');
}
$('cats').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const c = b.dataset.c;
  if (!c) state.cats = []; else state.cats = state.cats.includes(c) ? state.cats.filter(x => x !== c) : state.cats.concat(c);
  load(true);
});
['f-region', 'f-stage', 'f-lunch', 'f-org', 'f-mine', 'f-due', 'f-chain', 'f-nc', 'f-all'].forEach(id => $(id).addEventListener('change', () => load(true)));
let qT; $('f-q').addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(() => load(true), 300); });

