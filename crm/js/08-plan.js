/* ---------- 영업기획: 정보공개서 분석 · 급성장 브랜드 ---------- */
const RST = { '미조사': 't-r0', '조사중': 't-r1', '완료': 't-r2' };
const rTag = s => `<span class="tag ${RST[s] || 't-r0'}">${esc(s || '미조사')}</span>`;
const fmt = v => v === null || v === undefined ? '<span class="muted">-</span>' : Number(v).toLocaleString();
const diff = (a, b) => (a === null || a === undefined || b === null || b === undefined) ? '<span class="muted">-</span>'
  : (a - b > 0 ? `<span class="up">+${(a - b).toLocaleString()}</span>` : a - b < 0 ? `<span class="dn">${(a - b).toLocaleString()}</span>` : '0');
function spark(series){
  const v = (series || []).map(x => +x[1] || 0); if (v.length < 2) return '';
  const w = 72, h = 22, mx = Math.max(...v, 1), st = w / (v.length - 1);
  const pts = v.map((y, i) => `${(i * st).toFixed(1)},${(h - 2 - (y / mx) * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linejoin="round"/></svg>`;
}
const ftWon = v => v ? (v >= 100000 ? (v / 100000).toFixed(1).replace(/\.0$/, '') + '억' : Math.round(v / 10).toLocaleString() + '만') : '-'; // 공정위 평균매출 단위: 천원 (100,000천원 = 1억)

// 업종 여러 개 선택 (비어 있으면 전체). 묶음: 식사 업종만(기본) / 우리 관련 / 전체
const FT_NOMEAL = ['커피', '음료 (커피 외)', '제과제빵', '아이스크림/빙수'];
const FT_OURS = ['일식', '분식', '주점'];
state.ft = { d: null, t: null, inds: new Set(), all: [], preset: 'meal' };
function ftPreset(k){
  state.ft.preset = k;
  state.ft.inds = new Set(k === 'ours' ? FT_OURS : k === 'meal' ? (state.ft.all || []).filter(x => !FT_NOMEAL.includes(x)) : []);
  document.querySelectorAll('#ft-preset button').forEach(b => b.classList.toggle('on', b.dataset.p === k));
}
async function loadFtc(){
  try {
    if (state.ft.preset === 'meal' && !state.ft.inds.size) {   // 첫 진입: 업종 목록을 받아 '식사 업종만' 적용
      if (!state.ft.all.length) { const d0 = await rpc('sp_ftc_list', { p: { min_n: 100000 } }); state.ft.all = d0.industries || []; }
      ftPreset('meal');
    }
    const d = await rpc('sp_ftc_list', { p: { q: $('ft-q').value.trim(), inds: [...state.ft.inds], min_n: $('ft-min').value, sort: $('ft-sort').value } });
    state.ft.d = d; renderFtc();
  } catch (e) { toast(errMsg(e), true); }
}
function renderFtc(){
  const d = state.ft.d || {}, rows = d.rows || [];
  if (d.industries) state.ft.all = d.industries;
  $('ft-inds').innerHTML = (state.ft.all || []).map(x => `<button data-i="${esc(x)}" class="${state.ft.inds.has(x) ? 'on' : ''}" aria-pressed="${state.ft.inds.has(x)}">${esc(x)}</button>`).join('');
  const ys = d.years || [], L = d.latest;
  const yv = (r, y) => { const v = r.ys ? r.ys[String(y)] : null; return v ? Number(v).toLocaleString() : '<span class="muted">-</span>'; };
  const pc = v => v === null || v === undefined ? '<span class="muted">-</span>' : v + '%';
  $('ft-head').innerHTML = `<tr><th>브랜드</th><th>업종</th><th>추이</th>${ys.map(y => `<th class="num">${y}년${y === L ? '<br><small>(최신)</small>' : ''}</th>`).join('')}<th class="num">1년<br>신규 개점</th><th class="num">1년<br>순증</th><th class="num">폐점률</th><th class="num">3년 연평균<br>증가율</th><th class="num">평균 매출</th><th class="num">CRM 매장<br><small>(청주)</small></th><th>조사</th></tr>`;
  $('ft-count').textContent = (d.total || 0).toLocaleString() + '개 브랜드' + (d.total > rows.length ? ` · 상위 ${rows.length}개 표시` : '');
  $('ft-rows').innerHTML = rows.length ? rows.map(r => `<tr data-k="${esc(r.key)}">
    <td><div class="nm">${esc(r.brand)}</div><div class="sm">${esc(r.corp || '')}</div></td>
    <td>${esc(r.ind || '')}</td><td>${spark(ys.map(y => [y, (r.ys || {})[String(y)] || 0]))}</td>
    ${ys.map(y => `<td class="num">${y === L ? '<b>' + yv(r, y) + '</b>' : yv(r, y)}</td>`).join('')}
    <td class="num"><b>${fmt(r.new)}</b></td>
    <td class="num">${r.net === null || r.net === undefined ? '<span class="muted">-</span>' : r.net > 0 ? `<span class="up">+${r.net.toLocaleString()}</span>` : r.net < 0 ? `<span class="dn">${r.net.toLocaleString()}</span>` : '0'}</td>
    <td class="num">${r.crate !== null && r.crate !== undefined && r.crate >= 10 ? `<span class="dn"><b>${r.crate}%</b></span>` : pc(r.crate)}</td>
    <td class="num">${pc(r.cagr)}</td>
    <td class="num">${ftWon(r.sales)}</td>
    <td class="num">${r.crm ? r.crm.toLocaleString() + (r.cj ? ` <small class="muted">(${r.cj})</small>` : '') : '<span class="muted">-</span>'}</td>
    <td>${rTag(r.st)}</td></tr>`).join('')
    : `<tr><td colspan="${10 + ys.length}" class="muted" style="text-align:center;padding:40px">조건에 맞는 브랜드가 없어요.</td></tr>`;
}
['ft-min', 'ft-sort'].forEach(id => $(id).addEventListener('change', loadFtc));
$('ft-preset').addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if (b) { ftPreset(b.dataset.p); loadFtc(); } });
$('ft-inds').addEventListener('click', e => {
  const b = e.target.closest('button[data-i]'); if (!b) return;
  const x = b.dataset.i; state.ft.inds.has(x) ? state.ft.inds.delete(x) : state.ft.inds.add(x);
  state.ft.preset = 'custom'; document.querySelectorAll('#ft-preset button').forEach(el => el.classList.remove('on'));
  loadFtc();
});
$('ft-q').addEventListener('input', () => { clearTimeout(state.ft.t); state.ft.t = setTimeout(loadFtc, 350); });
$('ft-rows').addEventListener('click', e => { const tr = e.target.closest('tr[data-k]'); if (tr) openBrand(tr.dataset.k); });

/* 급성장 브랜드: 인허가 최근 3년 개업·폐업 (license_events, 수집기 license-event-fetch)
   한시적·팝업 영업은 서버에서 빼고 셈. 제외 표시한 브랜드(license_brand_excl)는 기본으로 숨김 */
state.nv = { d: null, t: null };
async function loadNaver(){
  try {
    const d = await rpc('sp_growth_list', { p: { q: $('nv-q').value.trim(), induty: $('nv-ind').value, min_n: $('nv-min').value, sort: $('nv-sort').value, surge: $('nv-surge').checked, excl: $('nv-excl').value } });
    state.nv.d = d; renderNaver();
  } catch (e) { toast(errMsg(e), true); }
}
function renderNaver(){
  const d = state.nv.d || {}, rows = d.rows || [], pg = d.progress || {};
  const sel = $('nv-ind'), cur = sel.value;
  sel.innerHTML = '<option value="">전체 업종</option>' + (d.industries || []).map(x => `<option>${esc(x)}</option>`).join(''); sel.value = cur;
  $('nv-count').textContent = (d.total || 0).toLocaleString() + '개 브랜드' + (d.total > rows.length ? ` · 상위 ${rows.length}개 표시` : '') + (d.excl_count ? ` · 제외 ${d.excl_count}개` : '');
  const nb = $('nv-note'), busy = pg.jobs && pg.finished < pg.jobs;
  nb.hidden = !busy;
  if (busy) nb.innerHTML = `<b>아직 수집 중이에요${pg.total ? ` (약 ${Math.round(100 * pg.done / pg.total)}%)` : ''}.</b> <span class="muted">최근 개업·폐업부터 들어와서 지금은 1년 숫자가 먼저 차고, 3년 숫자와 ‘최근 급증’ 표시는 수집이 끝나야 정확해요.</span>`;
  const fy = rows.find(r => r.fy); $('nv-fy').textContent = fy ? fy.fy + '년 가맹점' : '가맹점';
  const net = v => v > 0 ? `<span class="up">+${v.toLocaleString()}</span>` : v < 0 ? `<span class="dn">${v.toLocaleString()}</span>` : '0';
  $('nv-rows').innerHTML = rows.length ? rows.map(r => `<tr data-k="${esc(r.key)}"${r.ex ? ' class="ex"' : ''}>
    <td><div class="nm">${esc(r.brand)}${r.surge && !r.ex ? ' <span class="tag t-new">최근 급증</span>' : ''}</div>${r.ex ? `<div class="sm">제외함${r.ex_reason ? ' · ' + esc(r.ex_reason) : ''}</div>` : ''}</td>
    <td>${esc(r.ind || '')}</td>
    <td class="num">${Number(r.o1).toLocaleString()}</td><td class="num">${Number(r.c1).toLocaleString()}</td>
    <td class="num"><b>${net(r.n1)}</b></td><td class="num">${net(r.n3)}</td>
    <td class="num">${r.crate == null ? '<span class="muted">-</span>' : r.crate + '%'}</td>
    <td class="num">${fmt(r.fn)}</td><td class="num">${r.fpct == null ? '<span class="muted">-</span>' : r.fpct + '%'}</td>
    <td>${rTag(r.st)}</td>
    <td><button class="btn sm" data-ex="${esc(r.bkey)}" data-on="${r.ex ? 0 : 1}" data-nm="${esc(r.brand)}">${r.ex ? '되돌리기' : '제외'}</button></td></tr>`).join('')
    : `<tr><td colspan="11" class="muted" style="text-align:center;padding:40px">${$('nv-excl').value === 'only' ? '제외한 브랜드가 없어요.' : '조건에 맞는 브랜드가 없어요.'}</td></tr>`;
}
async function toggleExcl(b){
  const on = b.dataset.on === '1', nm = b.dataset.nm || '';
  let reason = '';
  if (on) {
    reason = prompt(`'${nm}'을(를) 급성장 목록에서 뺄까요?\n이유를 적어 두면 나중에 보기 좋아요 (비워도 돼요).`, '흔한 상호라 다른 가게가 섞임');
    if (reason === null) return;
  } else if (!confirm(`'${nm}'을(를) 다시 급성장 목록에 넣을까요?`)) return;
  b.disabled = true;
  try {
    await rpc('sp_growth_exclude', { p: { bkey: b.dataset.ex, on, reason: (reason || '').trim() } });
    toast(on ? `'${nm}'을(를) 목록에서 뺐어요` : `'${nm}'을(를) 다시 넣었어요`);
    loadNaver();
  } catch (e) { toast(errMsg(e), true); b.disabled = false; }
}
['nv-ind', 'nv-min', 'nv-sort', 'nv-surge', 'nv-excl'].forEach(id => $(id).addEventListener('change', loadNaver));
$('nv-q').addEventListener('input', () => { clearTimeout(state.nv.t); state.nv.t = setTimeout(loadNaver, 350); });
$('nv-rows').addEventListener('click', e => {
  const b = e.target.closest('button[data-ex]'); if (b) { toggleExcl(b); return; }
  const tr = e.target.closest('tr[data-k]'); if (tr) openBrand(tr.dataset.k);
});


/* 정보공개서 원문 (공정위 가맹사업거래 API, 서버 함수 ftc-disclosure 경유) */
const FTC_SEARCH = q => 'https://franchise.ftc.go.kr/mnu/00013/program/userRqst/list.do?column=brd&searchKeyword=' + encodeURIComponent(q || '');
function discBox(d, name){
  const ds = d.disc || [], top = ds[0];
  const link = `<a class="btn sm" href="${esc(FTC_SEARCH(name))}" target="_blank" rel="noopener">공정위 사이트에서 찾기 ↗</a>`;
  if (!top) return `<div class="dc-hd"><h4 style="margin:0">정보공개서 원문</h4>${link}</div><p class="muted" style="margin:0">CRM에서 바로 열 수 있는 정보공개서가 없어요. 공정위 사이트에서 찾아보세요 (가맹사업거래 로그인 필요).</p>`;
  return `<div class="dc-hd"><h4 style="margin:0">정보공개서 원문 <small class="muted">${esc(top.brand || '')} · ${esc(top.corp || '')}${top.rgsno ? ' · 등록번호 ' + esc(top.rgsno) : ''}</small></h4>
    <span style="display:flex;gap:6px">${link}<button class="btn sm pri" data-dc="${top.sn}">CRM에서 열기</button></span></div>
    <div id="dc-body"><p class="muted" style="margin:0">가맹비·교육비·인테리어·로열티·계약기간 요약과 목차별 본문을 불러와요. 처음 열 때 10~20초 걸릴 수 있어요.</p></div>`;
}
const kwon = k => k === null || k === undefined ? '-' : (k >= 100000 ? (k / 100000).toFixed(2).replace(/\.?0+$/, '') + '억' : (k / 10).toLocaleString(undefined, { maximumFractionDigits: 1 }) + '만원'); // 천원 단위 → 만원/억
// 정보공개서 접기: 본문은 그대로 두고 숨기기만 함 (다시 열 때 공정위를 다시 부르지 않음)
function foldDisc(){
  const body = $('dc-body'), btn = document.querySelector('#panel [data-dc]');
  if (body) body.hidden = true;
  if (btn) { btn.dataset.st = 'folded'; btn.textContent = 'CRM에서 열기'; btn.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
}
async function openDisc(sn){
  const box = $('dc-body'); if (!box) return;
  box.innerHTML = '<p class="muted" style="margin:0">공정위에서 불러오는 중…</p>';
  try {
    const { data, error } = await SB.functions.invoke('ftc-disclosure', { body: { sn } });
    if (error) { let m = error.message; try { const j = await error.context.json(); m = j.error || m; } catch (_) {} throw new Error(m); }
    if (data.error) throw new Error(data.error);
    renderDisc(data);
  } catch (e) { box.innerHTML = `<p class="muted" style="margin:0;color:var(--brand-d)">${esc(errMsg(e))}</p>`; }
}
function renderDisc(x){
  const s = x.summary || {}, secs = x.sections || [];
  const rows = [
    ['최초 가맹금 합계', kwon(s.initial_total)], ['가입비', kwon(s.join_fee)], ['교육비', kwon(s.edu_fee)], ['보증금', kwon(s.deposit)],
    ['기타 비용 합계' + (s.other_area_m2 ? ` (${Math.round(s.other_area_m2 / 3.3058)}평 기준)` : ''), kwon(s.other_total)],
    ['인테리어' + (s.interior_per_3_3 ? ` (평당 ${kwon(s.interior_per_3_3)})` : ''), kwon(s.interior)],
    ['로열티', s.royalty || '-'], ['계약 기간', s.term_years ? s.term_years + '년' : '-']
  ];
  const OPEN = /부담|계약\s*및\s*갱신\s*기간|교육ㆍ훈련의 최소시간|영업지역 보호|영업 시작까지 필요한 절차/;
  let html = '', grp = '';
  secs.forEach(c => {
    if (c.lvl === 1) { html += `<h5>${esc(c.title)}</h5>`; if (c.text) html += `<details><summary>내용</summary><pre>${esc(c.text)}</pre></details>`; return; }
    if (!c.text) { html += `<div class="sm muted" style="margin:6px 2px 0;padding-left:${(c.lvl - 2) * 12}px">${esc(c.title)}</div>`; return; }
    html += `<details style="margin-left:${(c.lvl - 2) * 12}px"${OPEN.test(c.title) ? ' open' : ''}><summary>${esc(c.title)}</summary><pre>${esc(c.text)}</pre></details>`;
  });
  $('dc-body').innerHTML = `<div class="dc-sum">${rows.map(([l, v]) => `<div><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>
    <p class="muted" style="margin:0">요약은 본문에서 자동으로 뽑은 값이라 원문과 다를 수 있어요 (부가세 포함 여부는 본문 확인). ${x.cached ? '저장된 사본 · ' + esc(shortDate(String(x.fetched_at).slice(0, 10))) : '방금 불러옴'}</p>
    <div class="dc-sec">${html}</div>
    <div style="text-align:center;margin-top:10px"><button class="btn sm" data-dcfold="1">접기 ▲</button></div>`;
}

/* 인허가 기록 (license_events, sp_brand_licenses) */
state.lc = { months: 12, mode: 'all', d: null };
const NAVER_MAP = (n, a) => 'https://map.naver.com/p/search/' + encodeURIComponent([n, (a || '').split(',')[0]].filter(Boolean).join(' '));
// 인허가 기록 접기: 불러온 목록은 그대로 두고 숨기기만 함
function foldLic(){
  const body = $('lc-body'), btn = document.querySelector('#panel [data-lc]');
  if (body) body.hidden = true;
  if (btn) { btn.dataset.st = 'folded'; btn.textContent = '열기'; btn.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
}
async function loadLic(){
  const box = $('lc-body'); if (!box || !state.brand) return;
  box.innerHTML = '<p class="muted" style="margin:0">불러오는 중…</p>';
  try { state.lc.d = await rpc('sp_brand_licenses', { p_key: state.brand.key, p: { months: state.lc.months, mode: state.lc.mode } }); renderLic(); }
  catch (e) { box.innerHTML = `<p class="muted" style="margin:0;color:var(--brand-d)">${esc(errMsg(e))}</p>`; }
}
function renderLic(){
  const d = state.lc.d || {}, s = d.sum || {}, rows = d.rows || [], f24 = d.ftc_new2024;
  const seg = (k, v, l) => `<button data-${k}="${v}" class="${(k === 'lcm' ? state.lc.months : state.lc.mode) == v ? 'on' : ''}">${l}</button>`;
  let trust = '';
  if (f24) {
    const r = (s.open2024 || 0) / f24;
    const msg = r >= 0.6 && r <= 1.6 ? ['비슷해요', '이름 매칭이 잘 된 브랜드예요.'] : r > 1.6 ? ['인허가가 많아요', '비슷한 이름의 다른 가게가 섞였을 수 있어요.'] : ['인허가가 적어요', '상호를 브랜드명과 다르게 신고하는 매장이 많거나, 아직 수집 중이에요.'];
    trust = `<p class="muted" style="margin:0 0 8px">2024년 개업: 인허가 <b>${(s.open2024 || 0).toLocaleString()}</b>곳 · 정보공개서 신규 개점 <b>${Number(f24).toLocaleString()}</b>곳 → <b>${msg[0]}</b>. ${msg[1]}</p>`;
  }
  $('lc-body').innerHTML = `<div class="dc-sum" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      <div><span>최근 1년 개업</span><b>${fmt(s.open1)}</b></div><div><span>최근 1년 폐업</span><b>${fmt(s.close1)}</b></div>
      <div><span>영업 중 (${esc(String(s.since || '').slice(0, 4))}년~ 개업)</span><b>${fmt(s.open_all)}</b></div><div><span>폐업 (수집 기간)</span><b>${fmt(s.close_all)}</b></div></div>
    ${trust}
    <div class="dc-hd"><div style="display:flex;gap:6px;flex-wrap:wrap"><div class="seg">${seg('lcm', 12, '최근 1년')}${seg('lcm', 36, '3년')}</div><div class="seg">${seg('lcd', 'all', '전체')}${seg('lcd', 'open', '개업·영업 중')}${seg('lcd', 'closed', '폐업')}</div></div>
      <button class="btn sm" data-lccopy="1"${rows.length ? '' : ' disabled'}>목록 복사</button></div>
    ${rows.length ? `<div class="tbl-wrap"><table class="bp-tbl"><thead><tr><th>상호</th><th>주소</th><th>개업</th><th>폐업</th><th class="num">면적</th><th></th></tr></thead><tbody>${rows.map(r => `<tr>
        <td><b>${esc(r.name)}</b><div class="sm">${r.kind === 'rest' ? '휴게' : '일반'}${r.st === '03' ? ' · <span class="dn">폐업</span>' : ''}</div></td>
        <td class="sm">${esc(r.addr || '')}</td><td class="sm">${esc(r.open || '-')}</td><td class="sm">${esc(r.close || '-')}</td>
        <td class="num sm">${r.area ? Math.round(r.area / 3.3058) + '평' : '-'}</td>
        <td><a class="nv" href="${esc(NAVER_MAP(r.name, r.addr))}" target="_blank" rel="noopener">지도</a></td></tr>`).join('')}</tbody></table></div>
        ${rows.length >= 500 ? '<p class="muted" style="margin:6px 0 0">최근 500곳까지만 보여요.</p>' : ''}`
      : '<p class="muted" style="margin:0">이 기간에 잡힌 매장이 없어요.</p>'}
    <p class="muted" style="margin:6px 0 0">상호에 브랜드명이 들어간 매장만 잡혀요 (직영·가맹 구분 없음). 인허가 3년치 수집이 끝나기 전에는 숫자가 적게 나올 수 있어요.</p>
    <div style="text-align:center;margin-top:10px"><button class="btn sm" data-lcfold="1">접기 ▲</button></div>`;
}
function copyLic(){
  const rows = (state.lc.d || {}).rows || [];
  const tsv = ['상호\t주소\t구분\t개업일\t폐업일\t면적(㎡)'].concat(rows.map(r => [r.name, r.addr, r.kind === 'rest' ? '휴게' : '일반', r.open || '', r.close || '', r.area || ''].join('\t'))).join('\n');
  navigator.clipboard.writeText(tsv).then(() => toast(`${rows.length}곳을 복사했어요 (엑셀에 붙여넣기)`), () => toast('복사하지 못했어요', true));
}

/* 브랜드 상세 (두 화면 공용) */
async function openBrand(key){
  try {
    const d = await rpc('sp_brand_detail', { p_key: key });
    state.cur = null; state.brand = d; state.lc = { months: 12, mode: 'all', d: null }; renderBrand(d);
    $('scrim').hidden = false; $('panel').hidden = false;
  } catch (e) { toast(errMsg(e), true); }
}
function renderBrand(d){
  const f = d.ftc || [], rs = d.research || {}, st = rs.status || '미조사';
  const name = (f.length ? f[f.length - 1].brand : '') || d.key;
  const corps = [...new Set(f.map(x => x.corp).filter(Boolean))];
  const snaps = d.snaps || [], regs = d.regions || [], mx = Math.max(1, ...regs.map(x => x.n));
  const ftcTbl = f.length ? `<div class="tbl-wrap"><table class="bp-tbl"><thead><tr>${corps.length > 1 ? '<th>법인</th>' : ''}<th>연도</th><th class="num">가맹점</th><th class="num">신규</th><th class="num">종료</th><th class="num">해지</th><th class="num">평균 매출</th></tr></thead><tbody>` +
    f.map(x => `<tr>${corps.length > 1 ? `<td>${esc(x.corp || '')}</td>` : ''}<td>${x.yr}</td><td class="num"><b>${fmt(x.n)}</b></td><td class="num">${fmt(x.new)}</td><td class="num">${fmt(x.end)}</td><td class="num">${fmt(x.cncl)}</td><td class="num">${ftWon(x.sales)}</td></tr>`).join('') +
    '</tbody></table></div><p class="muted" style="margin:6px 0 0">연도는 숫자의 기준 시점(그해 말)이에요. 공정위 통계는 1년 늦게 올라와서 최신 연도는 원문에서 확인하세요. 평균 매출은 가맹점 1곳당 연간 금액이에요.</p>'
    : '<p class="muted" style="margin:0">정보공개서에서 이 이름의 브랜드를 찾지 못했어요. 신생 브랜드이거나, 같은 이름을 쓰는 개인 매장일 수 있어요.</p>';
  $('panel').innerHTML = `<div class="panel-hd"><div><h2 id="p-name">${esc(name)}</h2><div class="sm">${esc(corps.join(' · ') || '정보공개서 미등록')}${f.length ? ' · ' + esc(f[f.length - 1].ind || '') : ''}</div></div><button class="x" aria-label="닫기" data-x>×</button></div>
  <div class="panel-bd">
    <div class="box"><h4>조사 메모 <small class="muted">${rs.updated_at ? esc(shortDate(String(rs.updated_at).slice(0, 10))) + ' · ' + esc(rs.updated_by || '') : ''}</small></h4>
      <div class="note-st" role="group" aria-label="조사 상태">${['미조사', '조사중', '완료'].map(x => `<button data-st="${x}" class="${x === st ? 'on' : ''}">${x}</button>`).join('')}</div>
      <div class="fld full"><label for="bn-note">가맹 조건 · 홍보 채널 · 메뉴 특징 · 영업 방식</label><textarea id="bn-note" rows="6" placeholder="예: 가맹비 면제 이벤트, 인스타 릴스 위주 모집, 1인 운영 가능 소형 매장, 본사 직영 상권분석 제공">${esc(rs.note || '')}</textarea></div>
      <div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn pri" id="bn-save">저장</button></div>
    </div>
    <div class="box" id="dc-box">${discBox(d, name)}</div>
    <div class="box"><h4>정보공개서 숫자 <small class="muted">공정위 가맹점 현황</small></h4>${ftcTbl}</div>
    <div class="box" id="lc-box"><div class="dc-hd"><h4 style="margin:0">인허가 기록 <small class="muted">행안부 일반·휴게음식점 영업 신고</small></h4><button class="btn sm pri" data-lc="1">열기</button></div>
      <div id="lc-body"><p class="muted" style="margin:0">이 브랜드 이름으로 잡힌 매장의 개업·폐업 신고 목록이에요. 매장마다 네이버 지도로 실제 영업 여부를 확인할 수 있어요.</p></div></div>
    <div class="box"><h4>CRM 매장 수 <small class="muted">현재 ${fmt(d.now)}곳</small></h4>
      ${snaps.length ? `<p class="muted" style="margin:0 0 8px">${snaps.map(x => `${esc(shortDate(x[0]))} ${Number(x[1]).toLocaleString()}곳`).join(' → ')}</p>` : '<p class="muted" style="margin:0 0 8px">월별 기록이 아직 없어요 (매장 2곳 이상인 브랜드만 기록).</p>'}
      ${regs.length ? '<div class="bp-bars">' + regs.map(x => `<div><span title="${esc(x.r)}">${esc(x.r)}</span><i style="width:${Math.round(x.n / mx * 220)}px"></i><b>${x.n}</b></div>`).join('') + '</div>' : ''}
    </div>
  </div>`;
}
$('panel').addEventListener('click', async e => {
  if (!state.brand || state.cur) return;
  if (e.target.closest('[data-x]')) return closePanel();
  const dc = e.target.closest('[data-dc]');
  if (e.target.closest('[data-dcfold]')) { foldDisc(); return; }
  if (dc) {
    if (dc.dataset.st === 'open') { foldDisc(); return; }
    if (dc.dataset.st === 'folded') { $('dc-body').hidden = false; dc.dataset.st = 'open'; dc.textContent = '접기'; return; }
    dc.disabled = true; await openDisc(+dc.dataset.dc); dc.disabled = false;
    if ($('dc-body') && $('dc-body').querySelector('.dc-sum')) { dc.dataset.st = 'open'; dc.textContent = '접기'; }
    return;
  }
  const lc = e.target.closest('[data-lc]');
  if (e.target.closest('[data-lcfold]')) { foldLic(); return; }
  if (lc) {
    if (lc.dataset.st === 'open') { foldLic(); return; }
    if (lc.dataset.st === 'folded') { $('lc-body').hidden = false; lc.dataset.st = 'open'; lc.textContent = '접기'; return; }
    lc.disabled = true; await loadLic(); lc.disabled = false;
    if (state.lc.d) { lc.dataset.st = 'open'; lc.textContent = '접기'; }
    return;
  }
  const lf = e.target.closest('[data-lcm],[data-lcd]');
  if (lf) { if (lf.dataset.lcm) state.lc.months = +lf.dataset.lcm; if (lf.dataset.lcd) state.lc.mode = lf.dataset.lcd; await loadLic(); return; }
  if (e.target.closest('[data-lccopy]')) { copyLic(); return; }
  const sb = e.target.closest('.note-st button');
  if (sb) { $('panel').querySelectorAll('.note-st button').forEach(b => b.classList.toggle('on', b === sb)); return; }
  if (e.target.id === 'bn-save') {
    const st = ($('panel').querySelector('.note-st button.on') || {}).dataset?.st || '미조사';
    const f = state.brand.ftc || [];
    try {
      const r = await rpc('sp_brand_note_save', { p: { key: state.brand.key, brand: (f.length ? f[f.length - 1].brand : state.brand.key), status: st, note: $('bn-note').value.trim() } });
      state.brand.research = r; renderBrand(state.brand); toast('조사 메모를 저장했어요');
      if (state.view === 'ftc') loadFtc(); else if (state.view === 'naver') loadNaver();
    } catch (err) { toast(errMsg(err), true); }
  }
});

