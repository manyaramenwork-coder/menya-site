/* ---------- 샵인샵 타겟 (지도로 좁혀 가기: 전국 → 시도 → 시·군 → 상권 → 매장) ----------
   전국·시도 단계는 미리 세어 둔 숫자(lead_target_regions, 15분마다 갱신)만 써서 바로 뜸.
   시·군을 고른 뒤에만 매장 목록(lead_target_list)을 불러옴.
   업종 = 홍보 이미지 6개 묶음(+기타 일식), 면적 = 20평 이하/초과/미확인, 경쟁점 = 반경 500m 라멘·돈카츠 수 (DB: sis_seg, sis_comp_*) */
const TG_SEGS = ['분식·김밥', '우동·소바', '덮밥', '초밥·일식', '텐동', '이자카야', '기타 일식'];
const TG_BANDS = ['20평 이하', '20평 초과', '미확인'];
state.tg = { lv: { sido: '충청북도', city: '청주시', hub: '' }, seg: '', band: '', check: '', sort: 'comp', exChain: true, exOwn: false,
  d: null, regs: null, regsAt: 0, meta: null, addHub: false, moveHub: null };
try { const s = JSON.parse(localStorage.getItem('crm-tg-lv') || 'null'); if (s && typeof s === 'object') state.tg.lv = { sido: s.sido || '', city: s.city || '', hub: s.hub || '' }; } catch (e) {}
const TG_COL = { '분식·김밥': '#f08c00', '우동·소바': '#2a78d6', '덮밥': '#7a4fc9', '초밥·일식': '#1f9e89', '텐동': '#c9a100', '이자카야': '#8b5a2b', '기타 일식': '#8a8e86' };
const TG_HUBC = { '대학가': '#7a4fc9', '오피스': '#2a78d6', '번화가': '#c62429', '역세권': '#1f9e89' };
document.head.insertAdjacentHTML('beforeend', `<style id="tg-css">
.tg-crumb{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:0 0 12px;font-size:15px}
.tg-crumb button{border:0;background:none;padding:4px 6px;border-radius:8px;color:var(--brand,#6b4df5);font:inherit;font-weight:600;cursor:pointer}
.tg-crumb button:hover{background:var(--brand-soft,#efebff)}.tg-crumb b{padding:4px 6px;color:var(--ink,#1d2045)}.tg-crumb i{color:#b5b7cc;font-style:normal}
.tg-main{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:14px;align-items:start;margin-bottom:14px}
.tg-mapwrap{position:relative}
#tg-map{height:max(520px,calc(100vh - 250px));border:1px solid var(--line,#e3e5df);border-radius:16px;overflow:hidden;background:#f4f4f8}
.tg-maptool{position:absolute;left:12px;top:12px;z-index:5;display:flex;gap:6px;align-items:center;flex-wrap:wrap;max-width:calc(100% - 70px)}
.tg-maptool .btn{background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.12)}
.tg-maptool .hint{background:rgba(255,255,255,.95);border-radius:10px;padding:6px 10px;font-size:12.5px;color:#555;box-shadow:0 2px 8px rgba(0,0,0,.1)}
#tg-addhub.on{background:#c62429;color:#fff;border-color:#c62429}
.tg-panel{background:#fff;border:1px solid var(--line,#e3e5df);border-radius:16px;box-shadow:var(--shadow);display:flex;flex-direction:column;max-height:max(520px,calc(100vh - 250px));overflow:hidden}
.tg-ph{padding:16px 18px 10px;border-bottom:1px solid var(--line,#eee)}
.tg-ph h3{margin:0;font-size:18px}.tg-ph h3 small{font-size:14px;color:var(--brand,#6b4df5);margin-left:6px}
.tg-ph p{margin:4px 0 0;font-size:13px;color:var(--sub,#6c7090)}
.tg-pb{overflow:auto;padding:6px 10px 12px;flex:1}
.tg-rg{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:center;width:100%;text-align:left;border:0;background:none;padding:10px 10px;border-radius:10px;cursor:pointer;font:inherit;color:inherit}
.tg-rg:hover{background:var(--brand-soft,#efebff)}.tg-rg b{font-size:15px}.tg-rg em{font-style:normal;font-weight:800;color:var(--brand,#6b4df5)}
.tg-rg .bar{grid-column:1/-1;height:5px;border-radius:9px;background:#f0eff7;overflow:hidden}.tg-rg .bar i{display:block;height:100%;background:var(--grad,#6b4df5);border-radius:9px}
.tg-rg small{grid-column:1/-1;color:var(--sub,#888);font-size:12px}
.tg-rg .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px}
.tg-all{display:block;width:calc(100% - 20px);margin:8px 10px 4px;text-align:center}
.tg-flt{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px 12px;border-bottom:1px solid var(--line,#eee)}
.tg-flt select{width:100%;min-width:0;font-size:13px;height:36px}
.tg-flt .opt{grid-column:1/-1;display:flex;gap:12px;font-size:13px;color:var(--sub,#666)}
.tg-acts{display:flex;gap:6px;padding:10px 12px;border-bottom:1px solid var(--line,#eee)}.tg-acts .btn{flex:1;font-size:13px;padding:7px 8px}
.tg-sum{font-size:12.5px;color:var(--sub,#666);padding:8px 12px 0}
.tgs{padding:11px 10px;border-bottom:1px solid #f1f0f7;cursor:pointer;border-radius:10px}.tgs:hover{background:#faf9ff}
.tgs .t{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.tgs .t b{font-size:14.5px}
.tgs .m{font-size:12.5px;margin-top:3px}.tgs .m .sg{font-weight:700}.tgs .sm{font-size:12px;color:#888;margin-top:2px}
.tgs.out b,.tgs.out .m,.tgs.out .sm{text-decoration:line-through;opacity:.55}
.tgm{display:block;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25);cursor:pointer}
.tgm.hl{width:18px;height:18px;box-shadow:0 0 0 3px rgba(107,77,245,.55)}
.tgc{display:block;width:11px;height:11px;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35);transform:rotate(45deg);cursor:pointer}
.tgh{display:inline-block;background:#fff;border:2px solid;border-radius:999px;padding:3px 10px;font-size:12.5px;font-weight:700;white-space:nowrap;cursor:pointer;transform:translate(-50%,-50%);box-shadow:0 2px 6px rgba(0,0,0,.12)}
.tgh.on{color:#fff!important}
.tgr-lb{transform:translate(-50%,-50%);text-align:center;cursor:pointer;white-space:nowrap;pointer-events:auto}
.tgr-lb b{display:block;font-size:12.5px;color:#1d2045;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff}
.tgr-lb span{display:inline-block;margin-top:2px;background:#1d2056;color:#fff;border-radius:999px;padding:1px 8px;font-size:12px;font-weight:800}
.tgr-lb.zero span{background:#b9bbd0}
.tg-leg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:var(--sub,#6b6f68);margin:8px 2px 0}
.tg-leg span{display:inline-flex;align-items:center;gap:5px}.tg-leg i{display:inline-block;width:10px;height:10px;border-radius:50%}
.tg-leg i.c{border-radius:0;transform:rotate(45deg);width:9px;height:9px}
.tg-iw{padding:10px 12px;font-size:13px;line-height:1.55;min-width:190px}.tg-iw b{font-size:14px}.tg-iw .a{display:flex;gap:6px;margin-top:8px}
.tg-iw button,.tg-iw a{font-size:12px;padding:4px 9px;border:1px solid #ccd;border-radius:6px;background:#fff;color:inherit;text-decoration:none;cursor:pointer}
.tg-ck{display:inline-flex;gap:4px;margin-top:5px}.tg-ck button{font-size:11.5px;padding:2px 8px;border:1px solid #d3d5dd;border-radius:999px;background:#fff;color:#555;cursor:pointer;line-height:1.5}
.tg-ck button.on[data-v="적합"]{background:#2f6f4e;border-color:#2f6f4e;color:#fff}.tg-ck button.on[data-v="배달샵"],.tg-ck button.on[data-v="부적합"]{background:#a8431a;border-color:#a8431a;color:#fff}
.tg-more{display:grid;grid-template-columns:1fr 1fr;gap:14px}
#tg-batches,#tg-basis{margin:0}#tg-batches summary,#tg-basis summary{cursor:pointer;font-size:14px}#tg-basis h4{margin:14px 0 4px;font-size:14px}
#tg-basis ul{margin:0;padding-left:18px;font-size:13px;line-height:1.7}#tg-basis .warn{color:#a8431a;font-weight:600}
#tg-bsum.due{color:#a06212;font-weight:700}
.tgb{border:1px solid var(--line,#e3e5df);border-radius:10px;padding:10px 12px;margin-top:10px;background:#fff}
.tgb .t{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}.tgb .t b{font-size:14px}.tgb .t .st{font-size:12px;border-radius:999px;padding:1px 9px;background:#eef0f4;color:#555}
.tgb .t .st.sent{background:#e8f4ec;color:#1f7a43}.tgb .t .st.due{background:#fdf3e2;color:#a06212}.tgb .a{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.tgb .a button{font-size:12.5px;padding:4px 10px}.tgb .items{margin-top:10px}
@media (max-width:1100px){.tg-main{grid-template-columns:1fr}.tg-panel{max-height:none}#tg-map{height:420px}.tg-more{grid-template-columns:1fr}}
</style>`);
$('sec-target').innerHTML = `
  <div class="sec-hd"><h1>샵인샵 타겟 <small id="tg-count"></small></h1></div>
  <nav class="tg-crumb" id="tg-crumb" aria-label="지역 단계"></nav>
  <div class="tg-main">
    <div class="tg-mapwrap">
      <div id="tg-map"></div>
      <div class="tg-maptool" id="tg-maptool" hidden><button class="btn" id="tg-addhub">＋ 상권 기준점 추가</button><span class="hint" id="tg-maphint" hidden></span></div>
      <div class="tg-leg" id="tg-leg"></div>
    </div>
    <aside class="tg-panel" id="tg-panel"></aside>
  </div>
  <div class="tg-more">
    <details class="box" id="tg-batches"><summary><b>우편 회차</b> <span class="muted" id="tg-bsum">불러오는 중…</span></summary><div id="tg-blist"></div></details>
    <details class="box" id="tg-basis"><summary><b>이 자료는 어떻게 만들었나요?</b> <span class="muted">수집 · 선정 · 상권 기준</span></summary><div id="tg-basis-body"></div></details>
  </div>`;

/* ---------- 지역 이름 ---------- */
const tgCity = sgg => (sgg || '').split(' ')[0];                 // '청주시 흥덕구' → '청주시'
const tgGeoCity = (sido, k) => sido === '세종특별자치시' ? '세종특별자치시' : ((k || '').match(/^(.+?시)(.+구)$/) || [, k])[1];  // 경계 자료 '청주시흥덕구' → '청주시'
const tgLevel = () => { const l = state.tg.lv; return l.hub ? 'stores' : l.city ? 'city' : l.sido ? 'sido' : 'nation'; };
const tgSave = () => { try { localStorage.setItem('crm-tg-lv', JSON.stringify(state.tg.lv)); } catch (e) {} };
function tgGo(sido, city, hub){ state.tg.lv = { sido: sido || '', city: city || '', hub: hub || '' }; tgSave(); state.tg.seg = ''; state.tg.band = ''; tgFit = true; loadTarget(); }
/* 미리 세어 둔 지역별 타겟 수 (체인 제외 여부에 맞춰 nc/n) */
function tgCounts(){
  const ex = state.tg.exChain, bySido = new Map(), byCity = new Map();
  (state.tg.regs || []).forEach(r => {
    const n = ex ? (r.nc || 0) : (r.n || 0);
    bySido.set(r.sido, (bySido.get(r.sido) || 0) + n);
    const k = r.sido + '|' + tgCity(r.sigungu); byCity.set(k, (byCity.get(k) || 0) + n);
  });
  return { bySido, byCity };
}

/* ---------- 불러오기 ---------- */
async function loadTarget(){
  const lv = state.tg.lv, level = tgLevel();
  try {
    if (!state.tg.regs || Date.now() - state.tg.regsAt > 5 * 60e3) {
      const r = await rpc('lead_target_regions');
      state.tg.regs = r.regions || []; state.tg.meta = r.meta || {}; state.tg.regsAt = Date.now();
    }
    if (level === 'nation' || level === 'sido') { state.tg.d = null; }
    else {
      tgPanelBusy();
      const d = await rpc('lead_target_list', { p: { sido: lv.sido, sigungu: lv.city, hub: lv.hub === 'all' ? '' : lv.hub,
        seg: state.tg.seg, band: state.tg.band, check: state.tg.check, limit: 3000,
        ex_own: state.tg.exOwn, ex_chain: state.tg.exChain, sort: state.tg.sort } });
      if (lv !== state.tg.lv) return;   // 그사이 다른 지역을 눌렀으면 버림
      state.tg.d = d;
      if (lv.hub && lv.hub !== 'all' && !(d.hubs || []).some(h => String(h.id) === String(lv.hub))) { lv.hub = ''; tgSave(); }
    }
    renderTarget(); tgMap();
  } catch (e) { toast(errMsg(e), true); }
  loadBatches();
}
function tgPanelBusy(){ const b = $('tg-panel').querySelector('.tg-pb'); if (b) b.innerHTML = '<p class="muted" style="padding:20px;text-align:center">불러오는 중이에요…</p>'; }

/* ---------- 경로 표시 (전국 › 충청북도 › 청주시 › 상권) ---------- */
function tgCrumb(){
  const lv = state.tg.lv, d = state.tg.d || {}, parts = [['전국', () => tgGo()]];
  if (lv.sido) parts.push([lv.sido, () => tgGo(lv.sido)]);
  if (lv.city) parts.push([lv.city, () => tgGo(lv.sido, lv.city)]);
  if (lv.hub) { const h = (d.hubs || []).find(x => String(x.id) === String(lv.hub)); parts.push([lv.hub === 'all' ? '상권 구분 없이 전체' : (h ? h.name : '상권'), null]); }
  $('tg-crumb').innerHTML = parts.map(([t], i) => i === parts.length - 1 ? `<b>${esc(t)}</b>` : `<button type="button" data-i="${i}">${esc(t)}</button>`).join('<i>›</i>');
  TG_CRUMB = parts;
}
let TG_CRUMB = [];
$('tg-crumb').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) TG_CRUMB[+b.dataset.i][1](); });

/* ---------- 오른쪽 목록 ---------- */
function tgRegList(items, sub){
  const max = Math.max(1, ...items.map(x => x[1]));
  return items.map(([k, n, extra]) => `<button type="button" class="tg-rg" data-k="${esc(k)}"><b>${extra && extra.dot ? `<i class="dot" style="background:${extra.dot}"></i>` : ''}${esc(extra && extra.label || k)}</b><em>${nf(n)}곳</em>
    <span class="bar"><i style="width:${Math.max(2, n / max * 100)}%"></i></span>${extra && extra.sub ? `<small>${esc(extra.sub)}</small>` : (sub ? `<small>${esc(sub)}</small>` : '')}</button>`).join('');
}
function renderTarget(){
  tgCrumb();
  const lv = state.tg.lv, level = tgLevel(), d = state.tg.d || {}, { bySido, byCity } = tgCounts(), P = $('tg-panel');
  const chainTxt = state.tg.exChain ? '체인 제외' : '체인 포함';
  $('tg-maptool').hidden = level === 'nation' || level === 'sido';
  if (level === 'nation') {
    const items = [...bySido].filter(([, n]) => n).sort((a, b) => b[1] - a[1]), all = items.reduce((a, [, n]) => a + n, 0);
    $('tg-count').textContent = nf(all) + '곳';
    P.innerHTML = `<div class="tg-ph"><h3>전국<small>${nf(all)}곳</small></h3><p>지도나 목록에서 시·도를 누르세요. 숫자는 우편 대상 타겟 매장 수예요(${chainTxt}).</p></div>
      <div class="tg-pb" data-lv="sido">${tgRegList(items)}</div>`;
  } else if (level === 'sido') {
    const items = [...byCity].filter(([k, n]) => n && k.startsWith(lv.sido + '|')).map(([k, n]) => [k.split('|')[1], n]).sort((a, b) => b[1] - a[1]);
    const all = items.reduce((a, [, n]) => a + n, 0);
    $('tg-count').textContent = nf(all) + '곳';
    P.innerHTML = `<div class="tg-ph"><h3>${esc(lv.sido)}<small>${nf(all)}곳</small></h3><p>시·군을 누르면 그 안의 상권(대학가·역세권·번화가)이 나와요.</p></div>
      <div class="tg-pb" data-lv="city">${items.length ? tgRegList(items) : '<p class="muted" style="padding:16px">이 지역은 아직 타겟 매장이 없어요.</p>'}</div>`;
  } else if (level === 'city') {
    const hubs = (d.hubs || []).slice().sort((a, b) => b.n - a.n);
    $('tg-count').textContent = nf(d.total || 0) + '곳';
    P.innerHTML = `<div class="tg-ph"><h3>${esc(lv.city)}<small>${nf(d.total || 0)}곳</small></h3><p>상권을 누르면 그 반경 안 매장이 나와요. 숫자는 상권 반경 안 타겟 수예요.</p></div>
      <div class="tg-pb" data-lv="hub">${hubs.length ? tgRegList(hubs.map(h => [String(h.id), h.n, { label: h.name + (tgGuess(h) ? ' ⚠' : ''), dot: TG_HUBC[h.kind] || '#555', sub: `${h.kind || ''} · 반경 ${nf(h.radius_m)}m${tgGuess(h) ? ' · 위치 확인 필요' : ''}` }]))
        : '<p class="muted" style="padding:16px">이 지역에 표시할 상권 기준점이 없어요. 지도에서 ‘＋ 상권 기준점 추가’로 만들 수 있어요.</p>'}
      <button type="button" class="btn tg-all" data-all="1">상권 구분 없이 ${esc(lv.city)} 전체 ${nf(d.total || 0)}곳 보기</button></div>`;
  } else tgStores(P, d);
  tgBasis(d);
}
function tgStores(P, d){
  const rows = d.rows || [], ck = d.checks || {}, b = d.bands || {};
  const opt = (v, l, n, cur) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(l)}${n == null ? '' : ` (${nf(n)})`}</option>`;
  const segAll = Object.values(d.segs || {}).reduce((a, n) => a + n, 0), bandAll = Object.values(b).reduce((a, n) => a + n, 0);
  const lv = state.tg.lv, h = (d.hubs || []).find(x => String(x.id) === String(lv.hub));
  $('tg-count').textContent = nf(d.total || 0) + '곳';
  P.innerHTML = `<div class="tg-ph"><h3>${esc(h ? h.name : lv.city + ' 전체')}<small>${nf(d.total || 0)}곳</small></h3>
      <p>${h ? `${esc(h.kind || '')} · 반경 ${nf(h.radius_m)}m 안` : '상권 구분 없이 시·군 전체'} · 20평 이하 ${nf(b['20평 이하'] || 0)} · 경쟁점 근처 ${nf(d.near_comp || 0)}</p></div>
    <div class="tg-flt">
      <select id="tg-f-seg" aria-label="업종">${opt('', '업종 전체', segAll, state.tg.seg)}${TG_SEGS.filter(k => (d.segs || {})[k] || state.tg.seg === k).map(k => opt(k, k, (d.segs || {})[k] || 0, state.tg.seg)).join('')}</select>
      <select id="tg-f-band" aria-label="면적">${opt('', '면적 전체', bandAll, state.tg.band)}${TG_BANDS.map(k => opt(k, k, b[k] || 0, state.tg.band)).join('')}</select>
      <select id="tg-f-check" aria-label="플레이스 확인">${opt('', '우편 대상', (ck['미확인'] || 0) + (ck['적합'] || 0), state.tg.check)}${opt('미확인', '확인 전', ck['미확인'] || 0, state.tg.check)}${opt('적합', '✓ 적합', ck['적합'] || 0, state.tg.check)}${opt('제외', '제외한 곳', (ck['배달샵'] || 0) + (ck['부적합'] || 0), state.tg.check)}</select>
      <select id="tg-f-sort" aria-label="정렬">${opt('comp', '경쟁점 적은 순', null, state.tg.sort)}${opt('area', '평수 작은 순', null, state.tg.sort)}${opt('density', '주변 매장 많은 순', null, state.tg.sort)}${opt('name', '이름순', null, state.tg.sort)}</select>
      <div class="opt"><label class="chk"><input type="checkbox" id="tg-f-chain" ${state.tg.exChain ? 'checked' : ''}>체인 제외</label><label class="chk"><input type="checkbox" id="tg-f-own" ${state.tg.exOwn ? 'checked' : ''}>우리 매장 제외</label></div>
    </div>
    <div class="tg-acts"><button class="btn" id="tg-copy">우편용 주소 복사</button><button class="btn pri" id="tg-mkbatch">＋ 우편 회차로 묶기</button></div>
    <div class="tg-pb" id="tg-list">${rows.length ? rows.map(tgCard).join('') : '<p class="muted" style="padding:24px;text-align:center">조건에 맞는 매장이 없어요.</p>'}</div>`;
}
function tgComp(r){
  const a = [];
  if (r.comp_ramen) a.push('라멘 ' + r.comp_ramen);
  if (r.comp_katsu) a.push('돈카츠 ' + r.comp_katsu);
  return a.length ? '경쟁 ' + a.join('·') : '경쟁점 없음';
}
const tgCard = r => `<div class="tgs${r.sis_check === '배달샵' || r.sis_check === '부적합' ? ' out' : ''}" data-id="${r.id}">
  <div class="t"><b>${esc(r.name)}${r.branch ? ' ' + esc(r.branch) : ''}</b>${r.is_own ? '<span class="tag t-B">우리 매장</span>' : ''}${!r.is_own && r.is_chain ? '<span class="tag t-C">체인</span>' : ''}<a class="nv" href="${esc(naverLink(r))}" target="_blank" rel="noopener" title="네이버 플레이스">N ${r.naver_url ? '플레이스' : '검색'}</a></div>
  <div class="m"><span class="sg" style="color:${TG_COL[r.seg] || '#888'}">${esc(r.seg || '')}</span> · ${r.pyeong == null ? '평수 미확인' : (r.area_band === '20평 이하' ? `<b>${r.pyeong}평</b>` : r.pyeong + '평')} · ${tgComp(r)}${r.mail_cnt ? ` · 우편 ${r.mail_cnt}회` : ''} · <span class="tag t-st">${esc(ST[r.stage] || r.stage || '')}</span></div>
  <div class="sm">${esc(r.addr_road || '')}${r.tel ? ' · ' + esc(tel(r.tel)) : ''}</div>${tgCkBtns(r)}</div>`;

$('tg-panel').addEventListener('click', e => {
  const lv = state.tg.lv;
  const rg = e.target.closest('.tg-rg');
  if (rg) { const k = rg.dataset.k, at = rg.closest('.tg-pb').dataset.lv;
    if (at === 'sido') tgGo(k); else if (at === 'city') tgGo(lv.sido, k); else if (at === 'hub') tgGo(lv.sido, lv.city, k); return; }
  if (e.target.closest('[data-all]')) { tgGo(lv.sido, lv.city, 'all'); return; }
  if (e.target.closest('#tg-copy')) { tgCopy(); return; }
  if (e.target.closest('#tg-mkbatch')) { tgMkBatch(); return; }
  const cb = e.target.closest('.tg-ck button'); if (cb) { tgSetCheck(cb.parentNode.dataset.id, cb.dataset.v); return; }
  if (e.target.closest('a')) return;
  const c = e.target.closest('.tgs[data-id]'); if (c) openLead(+c.dataset.id);
});
$('tg-panel').addEventListener('change', e => {
  const id = e.target.id, v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  if (id === 'tg-f-seg') { state.tg.seg = v; state.tg.band = ''; }
  else if (id === 'tg-f-band') state.tg.band = v;
  else if (id === 'tg-f-check') state.tg.check = v;
  else if (id === 'tg-f-sort') state.tg.sort = v;
  else if (id === 'tg-f-chain') state.tg.exChain = v;
  else if (id === 'tg-f-own') state.tg.exOwn = v;
  else return;
  loadTarget();
});
/* 목록 위에 마우스를 올리면 지도 핀을 크게 */
$('tg-panel').addEventListener('mouseover', e => { const c = e.target.closest('.tgs[data-id]'); tgHl(c ? c.dataset.id : null); });

/* ---------- 지도 ---------- */
const TM = { map: null, el: null, objs: [], iw: null, pins: {} };
let tgFit = true;
const TG_GEO = {};
async function tgGeo(name){
  if (TG_GEO[name]) return TG_GEO[name];
  const t = await (await fetch('geo/' + name + '.json?v=1')).json();   // topojson → [{p: 속성, polys: [[[lng,lat],...]...]}]
  const tf = t.transform, arcs = t.arcs.map(a => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * tf.scale[0] + tf.translate[0], y * tf.scale[1] + tf.translate[1]]; }); });
  const arc = i => i < 0 ? arcs[~i].slice().reverse() : arcs[i];
  const ring = ids => { const out = []; ids.forEach((i, k) => { const a = arc(i); out.push(...(k ? a.slice(1) : a)); }); return out; };
  return (TG_GEO[name] = t.objects[name].geometries.map(g => ({ p: g.properties,
    polys: g.type === 'Polygon' ? [g.arcs.map(ring)] : g.type === 'MultiPolygon' ? g.arcs.map(p => p.map(ring)) : [] })));
}
const tgArea = r => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(s / 2); };
function tgCenter(feats){   // 가장 큰 조각의 무게중심 (이름표 위치)
  let best = null, ba = -1;
  feats.forEach(f => f.polys.forEach(p => { const a = tgArea(p[0]); if (a > ba) { ba = a; best = p[0]; } }));
  if (!best) return null;
  let x = 0, y = 0, A = 0;
  for (let i = 0, j = best.length - 1; i < best.length; j = i++) { const c = best[j][0] * best[i][1] - best[i][0] * best[j][1]; A += c; x += (best[j][0] + best[i][0]) * c; y += (best[j][1] + best[i][1]) * c; }
  return A ? [y / (3 * A), x / (3 * A)] : [best[0][1], best[0][0]];
}
function tgBounds(feats){
  let a = 90, b = -90, c = 180, d = -180;
  feats.forEach(f => f.polys.forEach(p => p[0].forEach(([x, y]) => { a = Math.min(a, y); b = Math.max(b, y); c = Math.min(c, x); d = Math.max(d, x); })));
  return new naver.maps.LatLngBounds(new naver.maps.LatLng(a, c), new naver.maps.LatLng(b, d));
}
const tgShade = (n, max) => {   // 0 → 회색, 많을수록 진한 보라
  if (!n) return '#e9e9f0';
  const t = Math.sqrt(n / Math.max(1, max)), m = (a, b) => Math.round(a + (b - a) * t);
  return `rgb(${m(226, 91)},${m(219, 61)},${m(255, 240)})`;
};
async function tgEnsureMap(){
  const box = $('tg-map');
  if (TM.map && box.contains(TM.el)) return true;
  box.innerHTML = '<div style="width:100%;height:100%"></div>'; TM.el = box.firstChild; TM.map = null; TM.objs = [];
  const ok = typeof nmLoad === 'function' && await nmLoad();
  if (!ok) { box.innerHTML = '<div class="ar-empty muted" style="padding:40px;text-align:center">네이버 지도를 불러오지 못했어요. 오른쪽 목록으로 고를 수 있어요.</div>'; TM.el = null; return false; }
  TM.map = new naver.maps.Map(TM.el, { center: new naver.maps.LatLng(36.3, 127.8), zoom: 7, zoomControl: true, zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT }, mapDataControl: false, scaleControl: true });
  TM.iw = new naver.maps.InfoWindow({ content: '', borderColor: '#ccd', borderWidth: 1, anchorSize: new naver.maps.Size(10, 8), disableAnchor: false });
  naver.maps.Event.addListener(TM.map, 'click', e => {
    TM.iw.close();
    if (state.tg.moveHub) tgMoveHub(e.coord.lat(), e.coord.lng());
    else if (state.tg.addHub) tgAddHub(e.coord.lat(), e.coord.lng());
  });
  return true;
}
function tgClear(){ TM.objs.forEach(o => o.setMap(null)); TM.objs = []; TM.pins = {}; if (TM.iw) TM.iw.close(); }
/* 지역 면(시도·시군) 그리기: groups = [{key, label, n, feats}] */
function tgAreas(groups, onPick){
  const max = Math.max(1, ...groups.map(g => g.n)), P = (la, ln) => new naver.maps.LatLng(la, ln);
  groups.forEach(g => {
    const fill = tgShade(g.n, max), polys = [];
    g.feats.forEach(f => f.polys.forEach(p => {
      const pg = new naver.maps.Polygon({ map: TM.map, paths: p.map(r => r.map(([x, y]) => P(y, x))), fillColor: fill, fillOpacity: .78, strokeColor: '#fff', strokeWeight: 1.5, clickable: true });
      polys.push(pg); TM.objs.push(pg);
    }));
    const hover = on => polys.forEach(pg => pg.setOptions({ strokeColor: on ? '#3b1fc7' : '#fff', strokeWeight: on ? 3 : 1.5, fillOpacity: on ? .92 : .78 }));
    polys.forEach(pg => {
      naver.maps.Event.addListener(pg, 'mouseover', () => hover(true));
      naver.maps.Event.addListener(pg, 'mouseout', () => hover(false));
      naver.maps.Event.addListener(pg, 'click', () => onPick(g.key));
    });
    const c = tgCenter(g.feats);
    if (c) {
      const m = new naver.maps.Marker({ map: TM.map, position: P(c[0], c[1]), zIndex: 300, icon: { content: `<div class="tgr-lb${g.n ? '' : ' zero'}"><b>${esc(g.label)}</b><span>${nf(g.n)}</span></div>`, anchor: new naver.maps.Point(0, 0) } });
      naver.maps.Event.addListener(m, 'click', () => onPick(g.key));
      TM.objs.push(m);
    }
  });
}
async function tgMap(){
  if (!(await tgEnsureMap())) return;
  tgClear();
  const lv = state.tg.lv, level = tgLevel(), { bySido, byCity } = tgCounts();
  if (level === 'nation') {
    const sido = await tgGeo('sido');
    tgAreas(sido.map(f => ({ key: f.p.sidonm, label: f.p.sidonm.replace(/(특별자치도|특별자치시|특별시|광역시|통합특별시)$/, ''), n: bySido.get(f.p.sidonm) || 0, feats: [f] })), k => tgGo(k));
    $('tg-leg').innerHTML = '<span>색이 진할수록 타겟 매장이 많아요 · 지역을 누르면 들어가요</span>';
    if (tgFit) { tgFit = false; TM.map.fitBounds(tgBounds(sido), { top: 20, right: 20, bottom: 20, left: 20 }); }
    return;
  }
  const sgg = (await tgGeo('sgg')).filter(f => f.p.sidonm === lv.sido);
  const cities = new Map();
  sgg.forEach(f => { const k = tgGeoCity(lv.sido, f.p.sggk || f.p.sggnm); if (!cities.has(k)) cities.set(k, []); cities.get(k).push(f); });
  if (level === 'sido') {
    tgAreas([...cities].map(([k, feats]) => ({ key: k, label: k, n: byCity.get(lv.sido + '|' + k) || 0, feats })), k => tgGo(lv.sido, k));
    $('tg-leg').innerHTML = '<span>색이 진할수록 타겟 매장이 많아요 · 시·군을 누르면 상권이 나와요</span>';
    if (tgFit && sgg.length) { tgFit = false; TM.map.fitBounds(tgBounds(sgg), { top: 20, right: 20, bottom: 20, left: 20 }); }
    return;
  }
  /* 시·군 / 상권: 경계선 + 상권 원 + 매장 핀 */
  const P = (la, ln) => new naver.maps.LatLng(la, ln), feats = cities.get(lv.city) || [];
  feats.forEach(f => f.polys.forEach(p => TM.objs.push(new naver.maps.Polygon({ map: TM.map, paths: p.map(r => r.map(([x, y]) => P(y, x))), fillColor: '#6b4df5', fillOpacity: .03, strokeColor: '#6b4df5', strokeOpacity: .6, strokeWeight: 2, clickable: false }))));
  const d = state.tg.d || {}, rows = (d.rows || []).filter(r => r.lat), comps = d.comps || [], hubs = d.hubs || [];
  hubs.forEach(h => {
    const c = TG_HUBC[h.kind] || '#555', on = String(lv.hub) === String(h.id);
    TM.objs.push(new naver.maps.Circle({ map: TM.map, center: P(h.lat, h.lng), radius: h.radius_m, strokeColor: c, strokeOpacity: .9, strokeWeight: on ? 3 : 2, strokeStyle: 'shortdash', fillColor: c, fillOpacity: on ? .1 : .05, clickable: false }));
    const m = new naver.maps.Marker({ map: TM.map, position: P(h.lat, h.lng), zIndex: 300, icon: { content: `<span class="tgh${on ? ' on' : ''}" style="border-color:${c};color:${c};${on ? 'background:' + c : ''}">${esc(h.name)} ${nf(h.n)}</span>`, anchor: new naver.maps.Point(0, 0) } });
    naver.maps.Event.addListener(m, 'click', () => {
      TM.iw.setContent(`<div class="tg-iw"><b>${esc(h.name)}</b><br>${esc(h.kind || '')} 기준점 · 반경 ${nf(h.radius_m)}m · 타겟 ${nf(h.n)}곳<br>${tgGuess(h) ? '<span style="color:#a8431a">⚠ 위치 추정치: 확인 필요</span>' : '<span style="color:#2f6f4e">✓ 위치 확인됨</span>'}<div class="a"><button data-a="hub" data-id="${h.id}">${on ? '시·군으로 돌아가기' : '이 상권 매장 보기'}</button><button data-a="hmove" data-id="${h.id}">위치 옮기기</button><button data-a="hoff" data-id="${h.id}">숨기기</button></div></div>`);
      TM.iw.open(TM.map, m);
    });
    TM.objs.push(m);
  });
  if (level === 'stores') comps.forEach(c => {
    const m = new naver.maps.Marker({ map: TM.map, position: P(c.lat, c.lng), zIndex: 150, icon: { content: `<i class="tgc" style="background:${c.seg === '경쟁:라멘' ? '#c62429' : '#222'}"></i>`, anchor: new naver.maps.Point(7, 7) } });
    naver.maps.Event.addListener(m, 'click', () => { TM.iw.setContent(`<div class="tg-iw"><b>${esc(c.name)}${c.branch ? ' ' + esc(c.branch) : ''}</b><br>경쟁점 · ${c.seg === '경쟁:라멘' ? '라멘' : '돈카츠'}<div class="a"><button data-a="lead" data-id="${c.id}">매장 상세</button></div></div>`); TM.iw.open(TM.map, m); });
    TM.objs.push(m);
  });
  rows.forEach(r => {
    const m = new naver.maps.Marker({ map: TM.map, position: P(r.lat, r.lng), zIndex: 200, icon: { content: `<i class="tgm" style="background:${TG_COL[r.seg] || '#888'};${level === 'city' ? 'opacity:.55;width:9px;height:9px' : ''}"></i>`, anchor: new naver.maps.Point(level === 'city' ? 6 : 8, level === 'city' ? 6 : 8) } });
    naver.maps.Event.addListener(m, 'click', () => {
      TM.iw.setContent(`<div class="tg-iw"><b>${esc(r.name)}${r.branch ? ' ' + esc(r.branch) : ''}</b><br><span style="color:${TG_COL[r.seg] || '#888'};font-weight:700">${esc(r.seg || '')}</span> · ${r.pyeong == null ? '평수 미확인' : r.pyeong + '평'}<br>500m ${esc(tgComp(r))}<br><span style="color:#888">${esc(r.addr_road || '')}</span>${tgCkBtns(r)}<div class="a"><button data-a="lead" data-id="${r.id}">매장 상세</button><a href="${esc(naverLink(r))}" target="_blank" rel="noopener">N 플레이스</a></div></div>`);
      TM.iw.open(TM.map, m);
    });
    TM.objs.push(m); TM.pins[r.id] = { m, r };
  });
  const cnt = k => rows.filter(r => r.seg === k).length;
  $('tg-leg').innerHTML = (level === 'city' ? '<span>점선 원 = 상권 기준점 (누르면 그 상권 매장만) · 흐린 점 = 상권 밖 포함 전체 타겟</span>'
    : TG_SEGS.filter(cnt).map(k => `<span><i style="background:${TG_COL[k]}"></i>${esc(k)} ${cnt(k)}</span>`).join('') +
      '<span><i class="c" style="background:#c62429"></i>경쟁 라멘</span><span><i class="c" style="background:#222"></i>경쟁 돈카츠</span>');
  if (tgFit) {
    tgFit = false;
    const hub = hubs.find(h => String(h.id) === String(lv.hub));
    if (hub) { TM.map.setCenter(P(hub.lat, hub.lng)); TM.map.setZoom(hub.radius_m > 1000 ? 14 : 15); }
    else if (feats.length) TM.map.fitBounds(tgBounds(feats), { top: 20, right: 20, bottom: 20, left: 20 });
  }
}
let tgHlId = null;
function tgHl(id){
  if (id === tgHlId) return;
  const set = (k, on) => { const p = TM.pins[k]; if (!p) return; p.m.setIcon({ content: `<i class="tgm${on ? ' hl' : ''}" style="background:${TG_COL[p.r.seg] || '#888'}"></i>`, anchor: new naver.maps.Point(on ? 11 : 8, on ? 11 : 8) }); p.m.setZIndex(on ? 400 : 200); };
  if (tgHlId) set(tgHlId, false); tgHlId = id; if (id) set(id, true);
}
document.addEventListener('click', async e => {
  const cb = e.target.closest('.tg-iw .tg-ck button'); if (cb) { tgSetCheck(cb.parentNode.dataset.id, cb.dataset.v); return; }
  const b = e.target.closest('.tg-iw [data-a]'); if (!b) return;
  const id = b.dataset.id, lv = state.tg.lv;
  if (b.dataset.a === 'lead') { TM.iw.close(); openLead(+id); }
  if (b.dataset.a === 'hub') { TM.iw.close(); tgGo(lv.sido, lv.city, String(lv.hub) === id ? '' : id); }
  if (b.dataset.a === 'hmove') {
    const h = ((state.tg.d && state.tg.d.hubs) || []).find(x => String(x.id) === id); if (!h) return;
    TM.iw.close(); tgAddMode(false); state.tg.moveHub = h;
    tgHint(`'${h.name}'의 실제 위치(예: 정문)를 지도에서 누르세요.`);
  }
  if (b.dataset.a === 'hoff') {
    if (!confirm('이 기준점을 목록과 지도에서 숨길까요? (매장 데이터는 그대로예요)')) return;
    try { await rpc('lead_hub_off', { p_id: +id }); TM.iw.close(); if (String(lv.hub) === id) lv.hub = ''; tgSave(); toast('기준점을 숨겼어요'); loadTarget(); }
    catch (err) { toast(errMsg(err), true); }
  }
}, true);
function tgHint(t){ $('tg-maphint').textContent = t || ''; $('tg-maphint').hidden = !t; }
function tgAddMode(on){
  state.tg.addHub = on; $('tg-addhub').classList.toggle('on', on);
  $('tg-addhub').textContent = on ? '추가 취소' : '＋ 상권 기준점 추가';
  tgHint(on ? '기준점으로 삼을 곳(예: ○○대학교 정문)을 지도에서 누르세요.' : '');
}
$('tg-addhub').addEventListener('click', () => { state.tg.moveHub = null; tgAddMode(!state.tg.addHub); });
async function tgMoveHub(lat, lng){
  const h = state.tg.moveHub; state.tg.moveHub = null; tgAddMode(false);
  if (!confirm(`'${h.name}' 위치를 여기로 옮길까요?`)) return;
  try { await rpc('lead_hub_save', { p: { id: h.id, name: h.name, lat, lng } }); toast(`'${h.name}' 위치를 확인했어요`); tgGo(state.tg.lv.sido, state.tg.lv.city, String(h.id)); }
  catch (err) { toast(errMsg(err), true); }
}
async function tgAddHub(lat, lng){
  tgAddMode(false);
  const name = (prompt('기준점 이름 (예: 충북대 정문, 성안길)') || '').trim(); if (!name) return;
  const k = (prompt('종류 번호를 입력하세요\n1 대학가   2 오피스   3 번화가', '1') || '').trim();
  const kind = { '1': '대학가', '2': '오피스', '3': '번화가' }[k] || '대학가';
  const rad = parseInt(prompt('반경 (m)', kind === '번화가' ? '500' : '700'), 10) || 700;
  const lv = state.tg.lv;
  try {
    const h = await rpc('lead_hub_save', { p: { name, kind, lat, lng, radius_m: Math.min(Math.max(rad, 100), 3000), sido: lv.sido, sigungu: lv.city } });
    toast(`'${name}' 기준점을 추가했어요`); tgGo(lv.sido, lv.city, String(h.id));
  } catch (err) { toast(errMsg(err), true); }
}
/* 대표님 보고용: 자료 출처·선정 기준·상권 기준·한계 (숫자는 지금 고른 지역 기준) */
const tgGuess = h => /추정|확인 필요/.test(h.note || '');
const tgDay = v => v ? String(v).slice(0, 10) : '-';
function tgBasis(d){
  const m = d.meta || state.tg.meta || {}, b = d.bands || {}, all = Object.values(b).reduce((a, n) => a + n, 0), known = all - (b['미확인'] || 0);
  const guess = (d.hubs || []).filter(tgGuess), c = d.checks || {}, has = !!d.bands;
  $('tg-basis-body').innerHTML = `
  <h4>1. 어디서 모았나요</h4><ul>
    <li><b>매장 목록</b>: 소상공인시장진흥공단 「상가(상권)정보」 공공데이터. 마지막 반영 <b>${tgDay(m.src_date)}</b>. 분기마다 갱신돼서 최근 폐업한 곳이 늦게 빠질 수 있어요.</li>
    <li><b>평수</b>: 행정안전부 「인허가(일반·휴게음식점)」에 신고된 시설 면적. 상호·주소로 연결된 매장만 나와요. ${has ? `지금 지역 ${nf(all)}곳 중 <b>${nf(known)}곳 확인</b>` : '시·군을 고르면 확인된 수가 나와요'} (인허가 수집 ${tgDay(m.lic_at)}).</li>
    <li><b>업종 확인</b>: 네이버 플레이스 업종명. ${has ? `지금 지역에서 ${nf(m.naver_n || 0)}곳이 확인돼 있어요.` : ''}</li>
    <li><b>직원 확인</b>: 직원이 N 플레이스로 메뉴·배달 여부를 보고 [적합 / 배달샵 / 부적합]을 누른 결과예요. ${has ? `지금 지역 적합 ${nf(c['적합'] || 0)}곳, 배달샵 ${nf(c['배달샵'] || 0)}곳, 부적합 ${nf(c['부적합'] || 0)}곳, 아직 확인 전 ${nf(c['미확인'] || 0)}곳. ` : ''}배달샵·부적합은 우편 목록에서 빠져요.</li></ul>
  <h4>2. 어떤 매장을 골랐나요</h4><ul>
    <li>홍보 이미지의 <b>6개 업종</b>(분식·김밥, 우동·소바, 덮밥, 초밥·일식, 텐동, 이자카야)만 골라요. 판단 순서는 <b>상호 단어</b>(우동·텐동·이자카야 등) → <b>네이버 업종명</b> → <b>공공데이터 업종 분류</b>예요.</li>
    <li><b>빼는 곳</b>: 폐업, 연락 거부로 표시한 곳, 횟집, 일식 요소가 없는 일반 호프·포차. 라멘·돈카츠 전문점은 목록에서 빼고 <b>경쟁점</b>으로 따로 보여 줘요.</li>
    <li><b>체인</b>(기본으로 뺌): 같은 상호가 전국 3곳 이상이거나, 상호에 '○○점' 같은 지점명이 있거나, 직원이 체인으로 지정한 곳.</li>
    <li><b>평수</b>: 20평(66.1㎡)을 기준으로 이하·초과로 나눠요. 인허가 면적 ÷ 3.3058로 계산해요.</li></ul>
  <h4>3. 상권은 어떻게 봤나요</h4><ul>
    <li><b>상권 기준점</b>은 위치 하나와 반경이에요. 반경 안 매장을 <b>직선거리</b>로 세요. 기준점은 이렇게 만들었어요.
      <br>· <b>대학가</b>(반경 700m): 전국 버스정류장 이름에 '○○대학교'가 들어간 정류장 위치. 정문·후문 정류장이 있으면 그곳, 없으면 주변 음식점이 가장 많은 정류장이에요.
      <br>· <b>역세권</b>(반경 500m): 지하철역 위치(전국도시철도역사정보).
      <br>· <b>번화가</b>(반경 400m): 시군구마다 반경 300m 안 음식점이 가장 많이 몰린 지점 최대 3곳.
      <br>· <b>오피스</b>와 직원이 추가한 기준점: 직원이 지도에서 지정한 위치.
      <br>시·군마다 타겟이 3곳 이상인 기준점만, 많은 순으로 최대 25개까지 보여요.</li>
    ${!has ? '' : guess.length ? `<li class="warn">⚠ 표시된 기준점 ${guess.length}곳(${guess.slice(0, 8).map(h => esc(h.name)).join(', ')}${guess.length > 8 ? ' 등' : ''})은 자동으로 만들었거나 처음에 넣은 <b>추정 위치</b>예요. 지도에서 이름표를 누르고 '위치 옮기기'로 실제 위치(정문 등)를 찍어 주면 '확인됨'으로 바뀌어요.</li>` : '<li>기준점 위치는 모두 지도에서 확인한 위치예요.</li>'}
    <li><b>경쟁점 500m</b>: 매장마다 반경 500m 안 라멘·돈카츠 전문점 수예요. 매일 새벽 다시 계산해요 (마지막 ${tgDay(m.comp_at)}).</li></ul>
  <h4>4. 알아 둘 한계</h4><ul>
    <li>전국·시도 지도의 숫자는 15분마다 다시 세요. 방금 [적합/제외]를 누른 결과는 시·군 화면에는 바로, 전국·시도 숫자에는 15분 안에 반영돼요.</li>
    <li>업종은 상호와 공공 분류로 <b>자동 판정</b>해서 일부 틀릴 수 있어요. 우편을 보내기 전에 N 플레이스로 한 번 확인하는 걸 권해요.</li>
    <li>실제 매출·유동인구 자료는 들어 있지 않아요. 상권분석 메뉴의 상권 리포트·소상공인365에서 따로 봐야 해요.</li></ul>`;
}
/* 플레이스 확인: 적합 / 배달샵 / 부적합 (다시 누르면 취소) */
const TG_CK = ['적합', '배달샵', '부적합'];
const tgCkBtns = r => `<div class="tg-ck" data-id="${r.id}">${TG_CK.map(v => `<button data-v="${v}" class="${r.sis_check === v ? 'on' : ''}">${v === '적합' ? '✓ 적합' : v}</button>`).join('')}</div>`;
async function tgSetCheck(id, v){
  const d = state.tg.d || {}, r = (d.rows || []).find(x => String(x.id) === String(id));
  const nv = r && r.sis_check === v ? null : v;
  try {
    await rpc('lead_sis_check', { p_id: +id, p_val: nv });
    if (r) {
      const ck = d.checks || (d.checks = {}), k = x => x || '미확인';
      ck[k(r.sis_check)] = Math.max(0, (ck[k(r.sis_check)] || 0) - 1); ck[k(nv)] = (ck[k(nv)] || 0) + 1;
      r.sis_check = nv;
    }
    const card = document.querySelector(`.tgs[data-id="${id}"]`); if (card && r) card.outerHTML = tgCard(r);
    if (TM.iw) TM.iw.close();
    toast(nv ? `'${r ? r.name : '매장'}' ${nv}(으)로 표시했어요` : '확인 표시를 지웠어요');
  } catch (err) { toast(errMsg(err), true); }
}
/* ---------- 우편 회차: 목록 묶기 → 주소 복사 → 발송 완료(매장마다 우편 기록) → 1주 뒤 전화할 곳 ---------- */
if (typeof KIND === 'object' && KIND) KIND.mail = '우편 발송';
const TB = { list: [], open: null, items: {} };
const tbDay = v => v ? new Date(v).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) : '';
async function loadBatches(){
  try { TB.list = await rpc('lead_mail_batch_list') || []; renderBatches(); }
  catch (e) { $('tg-bsum').textContent = '불러오지 못했어요'; }
}
function renderBatches(){
  const L = TB.list, sent = L.filter(b => b.sent_at), due = sent.filter(b => Date.now() - new Date(b.sent_at) >= 7 * 864e5 && b.called < b.n);
  $('tg-bsum').textContent = L.length ? `${L.length}회차 · 발송 ${sent.length}${due.length ? ` · 전화할 회차 ${due.length}` : ''}` : '아직 없어요';
  $('tg-bsum').classList.toggle('due', !!due.length); if (due.length) $('tg-batches').open = true;
  $('tg-blist').innerHTML = L.length ? L.map(b => {
    const days = b.sent_at ? Math.floor((Date.now() - new Date(b.sent_at)) / 864e5) : null;
    const st = !b.sent_at ? '<span class="st">발송 전</span>'
      : (days >= 7 && b.called < b.n ? `<span class="st due">발송 ${tbDay(b.sent_at)} · ${days}일 지남 · 전화할 때예요</span>` : `<span class="st sent">발송 ${tbDay(b.sent_at)}</span>`);
    const op = TB.open === b.id, it = TB.items[b.id];
    return `<div class="tgb" data-id="${b.id}"><div class="t"><b>${esc(b.name)}</b><span>${nf(b.n)}곳</span>${st}${b.sent_at ? `<span class="muted" style="font-size:12px">전화 ${nf(b.called)}/${nf(b.n)}</span>` : ''}</div>
      ${b.note ? `<div class="muted" style="font-size:12px;margin-top:2px">${esc(b.note)}</div>` : ''}
      <div class="a"><button class="btn" data-b="open">${op ? '접기' : (b.sent_at ? '전화할 곳 보기' : '매장 보기')}</button><button class="btn" data-b="copy">주소 복사</button>
        ${b.sent_at ? '' : '<button class="btn pri" data-b="send">발송 완료로 기록</button><button class="btn" data-b="del">삭제</button>'}</div>
      ${op ? `<div class="items">${it ? tbItems(b, it) : '<span class="muted">불러오는 중…</span>'}</div>` : ''}</div>`;
  }).join('') : '<p class="muted" style="margin:8px 0 0">상권 매장 목록을 거른 뒤 <b>＋ 우편 회차로 묶기</b>를 누르면, 그 매장들이 한 회차로 저장돼요. 발송하고 <b>발송 완료로 기록</b>을 누르면 매장마다 우편 기록이 남고, 1주 뒤 전화할 곳을 여기서 볼 수 있어요.</p>';
}
function tbItems(b, items){
  return `<div class="tbl-wrap"><table><thead><tr><th>매장</th><th>업종</th><th>전화</th><th>${b.sent_at ? '발송 뒤 통화' : '단계'}</th></tr></thead><tbody>${items.map(r => `<tr data-id="${r.id}">
    <td><div class="nm">${esc(r.name)}${r.branch ? ' ' + esc(r.branch) : ''}<a class="nv" href="${esc(naverLink(r))}" target="_blank" rel="noopener">N</a></div><div class="sm">${esc(r.addr_road || '')}</div></td>
    <td>${esc(r.seg || '')}</td><td>${r.tel ? `<a href="tel:${esc(r.tel)}">${esc(tel(r.tel))}</a>` : '<span class="muted">없음</span>'}</td>
    <td>${b.sent_at ? (r.called ? `<b>${tbDay(r.called)}</b> ${esc(RES[r.call_result] || r.call_result || '')}` : '<span style="color:#a06212">아직</span>') : `<span class="tag t-st">${esc(ST[r.stage] || r.stage || '')}</span>`}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted" style="font-size:12px;margin:6px 0 0">매장을 누르면 상세가 열려요. 통화 결과를 남기면 여기 '발송 뒤 통화'에 표시돼요.</p>`;
}
async function tbLoadItems(id){
  try { const r = await rpc('lead_mail_batch_items', { p_id: id }); TB.items[id] = r.items || []; return TB.items[id]; }
  catch (e) { toast(errMsg(e), true); return null; }
}
$('tg-blist').addEventListener('click', async e => {
  const tr = e.target.closest('.items tr[data-id]');
  if (tr && !e.target.closest('a')) { openLead(+tr.dataset.id); return; }
  const btn = e.target.closest('button[data-b]'); if (!btn) return;
  const id = +btn.closest('.tgb').dataset.id, b = TB.list.find(x => x.id === id); if (!b) return;
  if (btn.dataset.b === 'open') { TB.open = TB.open === id ? null : id; renderBatches(); if (TB.open) { await tbLoadItems(id); renderBatches(); } }
  if (btn.dataset.b === 'copy') {
    const items = TB.items[id] || await tbLoadItems(id); if (!items) return;
    const lines = ['상호\t업종\t주소\t전화'].concat(items.map(r => [r.name + (r.branch ? ' ' + r.branch : ''), r.seg || '', r.addr_road || '', r.tel ? tel(r.tel) : ''].join('\t')));
    try { await navigator.clipboard.writeText(lines.join('\n')); toast(`'${b.name}' ${items.length}곳 주소를 복사했어요`); } catch (er) { toast('복사하지 못했어요. 브라우저 권한을 확인하세요', true); }
  }
  if (btn.dataset.b === 'send') {
    if (!confirm(`'${b.name}' ${b.n}곳에 우편을 보냈다고 기록할까요?\n매장마다 '우편 발송' 기록이 남고, 되돌릴 수 없어요.`)) return;
    try { await rpc('lead_mail_batch_send', { p_id: id }); toast('발송 완료로 기록했어요. 1주 뒤 전화할 곳이 표시돼요'); delete TB.items[id]; loadTarget(); }
    catch (er) { toast(errMsg(er), true); }
  }
  if (btn.dataset.b === 'del') {
    if (!confirm(`'${b.name}' 회차를 지울까요? (매장 데이터는 그대로예요)`)) return;
    try { await rpc('lead_mail_batch_delete', { p_id: id }); toast('회차를 지웠어요'); loadBatches(); }
    catch (er) { toast(errMsg(er), true); }
  }
});
async function tgMkBatch(){
  const d = state.tg.d || {}, rows = (d.rows || []).filter(r => r.sis_check !== '배달샵' && r.sis_check !== '부적합');
  if (!rows.length) { toast('묶을 매장이 없어요. 목록을 먼저 걸러 주세요', true); return; }
  const lv = state.tg.lv, hub = (d.hubs || []).find(h => String(h.id) === String(lv.hub));
  const now = new Date();
  const def = `${now.getFullYear()}.${now.getMonth() + 1} ${hub ? hub.name : lv.city || '전체'}${state.tg.seg ? ' ' + state.tg.seg : ''}`;
  const name = (prompt(`우편 회차 이름 (${rows.length}곳)`, def) || '').trim(); if (!name) return;
  const note = (prompt('메모 (선택: 우편 내용, 함께 돌린 인스타 광고 등)', '') || '').trim();
  try {
    const r = await rpc('lead_mail_batch_create', { p: { name, note, ids: rows.map(x => x.id),
      filter: { region: [lv.sido, lv.city], hub: hub ? hub.name : '', seg: state.tg.seg, band: state.tg.band, check: state.tg.check } } });
    toast(`'${name}' 회차에 ${r.n}곳을 담았어요`); TB.open = r.id; await loadBatches(); await tbLoadItems(r.id); renderBatches();
    $('tg-batches').open = true; $('tg-batches').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { toast(errMsg(e), true); }
}
async function tgCopy(){
  const rows = ((state.tg.d && state.tg.d.rows) || []).filter(r => r.sis_check !== '배달샵' && r.sis_check !== '부적합');
  if (!rows.length) { toast('복사할 매장이 없어요', true); return; }
  const lines = ['상호\t업종\t주소\t전화'].concat(rows.map(r => [r.name + (r.branch ? ' ' + r.branch : ''), r.seg || '', r.addr_road || '', r.tel ? tel(r.tel) : ''].join('\t')));
  try { await navigator.clipboard.writeText(lines.join('\n')); toast(`${rows.length}곳 주소를 복사했어요. 엑셀에 붙여 넣으세요`); }
  catch (e) { toast('복사하지 못했어요. 브라우저 권한을 확인하세요', true); }
}
