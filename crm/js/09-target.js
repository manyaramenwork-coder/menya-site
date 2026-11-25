/* ---------- 샵인샵 타겟 ---------- */
/* 업종 = 홍보 이미지 6개 묶음(+기타 일식), 면적 = 20평 이하/초과/미확인, 경쟁점 = 반경 500m 라멘·돈카츠 수 (DB: sis_seg, sis_comp_*) */
const TG_SEGS = ['분식·김밥', '우동·소바', '덮밥', '초밥·일식', '텐동', '이자카야', '기타 일식'];
const TG_BANDS = ['20평 이하', '20평 초과', '미확인'];
state.tg = { seg: '', band: '', hub: '', check: '', d: null, r: ['충청권', '충청북도', '청주시', ''], view: 'list', addHub: false };
try { if (localStorage.getItem('crm-tg-view') === 'map') state.tg.view = 'map'; } catch (e) {}
const TG_COL = { '분식·김밥': '#f08c00', '우동·소바': '#2a78d6', '덮밥': '#7a4fc9', '초밥·일식': '#1f9e89', '텐동': '#c9a100', '이자카야': '#8b5a2b', '기타 일식': '#8a8e86' };
const TG_HUBC = { '대학가': '#7a4fc9', '오피스': '#2a78d6', '번화가': '#c62429', '역세권': '#1f9e89' };
document.head.insertAdjacentHTML('beforeend', `<style id="tg-css">
#tg-map{height:max(480px,calc(100vh - 380px));border:1px solid var(--line,#e3e5df);border-radius:12px;overflow:hidden;margin-bottom:10px}
.tgm{display:block;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25);cursor:pointer}
.tgc{display:block;width:11px;height:11px;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35);transform:rotate(45deg);cursor:pointer}
.tgh{display:inline-block;background:#fff;border:2px solid;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:700;white-space:nowrap;cursor:pointer;transform:translate(-50%,-50%)}
.tg-leg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:var(--sub,#6b6f68);margin:-2px 0 12px}
.tg-leg span{display:inline-flex;align-items:center;gap:5px}.tg-leg i{display:inline-block;width:10px;height:10px;border-radius:50%}
.tg-leg i.c{border-radius:0;transform:rotate(45deg);width:9px;height:9px}
.tg-iw{padding:10px 12px;font-size:13px;line-height:1.55;min-width:190px}.tg-iw b{font-size:14px}.tg-iw .a{display:flex;gap:6px;margin-top:8px}
.tg-iw button,.tg-iw a{font-size:12px;padding:4px 9px;border:1px solid #ccd;border-radius:6px;background:#fff;color:inherit;text-decoration:none;cursor:pointer}
#tg-addhub.on{background:#c62429;color:#fff;border-color:#c62429}
#tg-basis{margin:0 0 12px}#tg-basis summary{cursor:pointer;font-size:14px}#tg-basis h4{margin:14px 0 4px;font-size:14px}
.tg-ck{display:inline-flex;gap:4px;margin-top:4px}.tg-ck button{font-size:11.5px;padding:2px 8px;border:1px solid #d3d5dd;border-radius:999px;background:#fff;color:#555;cursor:pointer;line-height:1.5}
.tg-ck button.on[data-v="적합"]{background:#2f6f4e;border-color:#2f6f4e;color:#fff}.tg-ck button.on[data-v="배달샵"],.tg-ck button.on[data-v="부적합"]{background:#a8431a;border-color:#a8431a;color:#fff}
tr.tg-out .nm,tr.tg-out .sm{text-decoration:line-through;opacity:.55}
#tg-batches{margin:0 0 12px}#tg-batches summary{cursor:pointer;font-size:14px}
.tgb{border:1px solid var(--line,#e3e5df);border-radius:10px;padding:10px 12px;margin-top:10px;background:#fff}
.tgb .t{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}.tgb .t b{font-size:14px}.tgb .t .st{font-size:12px;border-radius:999px;padding:1px 9px;background:#eef0f4;color:#555}
.tgb .t .st.sent{background:#e8f4ec;color:#1f7a43}.tgb .t .st.due{background:#fdf3e2;color:#a06212}.tgb .a{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.tgb .a button{font-size:12.5px;padding:4px 10px}.tgb .items{margin-top:10px}
#tg-basis ul{margin:0;padding-left:18px;font-size:13px;line-height:1.7}#tg-basis .warn{color:#a8431a;font-weight:600}
</style>`);
/* 지역: 권역 → 시도 → 시·군 → 구 (청주시 흥덕구 → 청주시 / 흥덕구) */
const TG_ZONES = [['수도권', ['서울특별시', '경기도', '인천광역시']], ['충청권', ['대전광역시', '세종특별자치시', '충청북도', '충청남도']],
  ['호남권', ['광주광역시', '전라남도', '전남광주통합특별시', '전북특별자치도', '전라북도']], ['영남권', ['부산광역시', '대구광역시', '울산광역시', '경상북도', '경상남도']],
  ['강원권', ['강원특별자치도', '강원도']], ['제주권', ['제주특별자치도']]];
const tgZoneOf = sido => (TG_ZONES.find(([, l]) => l.includes(sido)) || ['기타'])[0];
const tgSplit = sgg => { const i = (sgg || '').indexOf(' '); return i > 0 ? [sgg.slice(0, i), sgg.slice(i + 1)] : [sgg || '', '']; };
$('sec-target').innerHTML = `
  <div class="sec-hd"><h1>샵인샵 타겟 <small id="tg-count"></small></h1>
    <div class="row-btns"><div class="seg" role="group" aria-label="보기 방식"><button id="tg-v-list">목록</button><button id="tg-v-map">지도</button></div><button class="btn" id="tg-copy">우편용 주소 복사</button><button class="btn pri" id="tg-mkbatch">＋ 우편 회차로 묶기</button></div></div>
  <p class="muted">홍보 이미지의 업종(분식·김밥, 우동·소바, 덮밥, 초밥·일식, 텐동, 이자카야) 매장이에요. 라멘·돈카츠 전문점은 <b>경쟁점</b>이라 목록에서 빼고, 매장마다 <b>반경 500m 안 경쟁점 수</b>로 보여 줘요. 횟집은 제외해요. 평수는 인허가 자료가 연결된 매장만 나오고, 나머지는 '미확인'이에요.</p>
  <details class="box" id="tg-batches" open><summary><b>우편 회차</b> <span class="muted" id="tg-bsum">불러오는 중…</span></summary><div id="tg-blist"></div></details>
  <details class="box" id="tg-basis"><summary><b>이 자료는 어떻게 만들었나요?</b> <span class="muted">수집 · 선정 · 상권 기준</span></summary><div id="tg-basis-body"></div></details>
  <div class="bar">
    <select id="tg-r0" aria-label="권역"></select><select id="tg-r1" aria-label="시도"></select><select id="tg-r2" aria-label="시군"></select><select id="tg-r3" aria-label="구"></select>
    <select id="tg-sort" aria-label="정렬"><option value="comp">경쟁점 적은 순</option><option value="name">이름순</option><option value="area">평수 작은 순</option><option value="density">주변 매장 많은 순</option></select>
    <label class="chk"><input type="checkbox" id="tg-own">우리 매장 제외</label>
    <label class="chk"><input type="checkbox" id="tg-chain" checked>체인 제외</label>
  </div>
  <div class="chips" id="tg-check" role="group" aria-label="플레이스 확인"></div>
  <div class="chips" id="tg-hub" role="group" aria-label="상권 기준점"></div>
  <div class="chips" id="tg-seg" role="group" aria-label="업종"></div>
  <div class="chips" id="tg-band" role="group" aria-label="면적"></div>
  <section class="stats" id="tg-stats" aria-label="타겟 요약"></section>
  <div id="tg-mapbox" hidden>
    <div class="row-btns" style="margin-bottom:8px;align-items:center"><button class="btn" id="tg-addhub">＋ 기준점 추가</button><span class="muted" id="tg-maphint" style="font-size:13px">핀을 누르면 매장 정보가 보여요. 동그라미(기준점)를 누르면 그 상권만 걸러져요.</span></div>
    <div id="tg-map"></div>
    <div class="tg-leg" id="tg-leg"></div>
  </div>
  <div class="tbl-wrap" id="tg-tbl">
    <table>
      <thead><tr><th>매장</th><th>업종</th><th>지역</th><th>상권</th><th>경쟁점 500m</th><th class="num">평수</th><th>단계</th><th class="num">우편</th></tr></thead>
      <tbody id="tg-rows"></tbody>
    </table>
  </div>`;
async function loadTarget(){
  const [z, sido, si, gu] = state.tg.r;
  const sidos = !sido && z ? ((TG_ZONES.find(x => x[0] === z) || [, []])[1]) : [];
  const sigungu = si ? (gu ? si + ' ' + gu : si) : '';
  try {
    const d = await rpc('lead_target_list', { p: { sido, sidos, sigungu, seg: state.tg.seg, band: state.tg.band,
      hub: state.tg.hub, check: state.tg.check, limit: (si || state.tg.hub) ? 3000 : 1000,
      ex_own: $('tg-own').checked, ex_chain: $('tg-chain').checked, sort: $('tg-sort').value } });
    state.tg.d = d; renderTarget(); tgFit = true; if (state.tg.view === 'map') tgMap();
  } catch (e) { toast(errMsg(e), true); }
  loadBatches();
}
function tgChips(el, keys, counts, cur, allLbl){
  const all = keys.reduce((a, k) => a + (counts[k] || 0), 0);
  $(el).innerHTML = `<button data-v="" class="${!cur ? 'on' : ''}">${allLbl} <small>${all.toLocaleString()}</small></button>` +
    keys.filter(k => counts[k] || cur === k).map(k => `<button data-v="${esc(k)}" class="${cur === k ? 'on' : ''}">${esc(k)} <small>${(counts[k] || 0).toLocaleString()}</small></button>`).join('');
}
function tgComp(r){
  const a = [];
  if (r.comp_ramen) a.push('라멘 ' + r.comp_ramen);
  if (r.comp_katsu) a.push('돈카츠 ' + r.comp_katsu);
  return a.length ? `<b>${esc(a.join(' · '))}</b>` : '<span class="muted">없음</span>';
}
function tgOpts(el, allLbl, groups, cur){
  const all = [...groups.values()].reduce((a, n) => a + n, 0);
  $(el).innerHTML = `<option value="">${allLbl} (${all.toLocaleString()})</option>` +
    [...groups].map(([k, n]) => `<option value="${esc(k)}">${esc(k)} (${n.toLocaleString()})</option>`).join('');
  $(el).value = cur; $(el).hidden = !groups.size;
}
function tgRegions(regs){
  const [z, sido, si, gu] = state.tg.r, add = (m, k, n) => m.set(k, (m.get(k) || 0) + n);
  const m0 = new Map(), m1 = new Map(), m2 = new Map(), m3 = new Map();
  TG_ZONES.forEach(([k]) => m0.set(k, 0));
  regs.forEach(r => {
    const rz = tgZoneOf(r.sido), [rs, rg] = tgSplit(r.sigungu);
    add(m0, rz, r.n);
    if (z && rz === z) add(m1, r.sido, r.n);
    if (sido && r.sido === sido) add(m2, rs, r.n);
    if (si && r.sido === sido && rs === si && rg) add(m3, rg, r.n);
  });
  [...m0].forEach(([k, n]) => { if (!n) m0.delete(k); });
  tgOpts('tg-r0', '전국', m0, z);
  tgOpts('tg-r1', '권역 전체', z ? m1 : new Map(), sido);
  tgOpts('tg-r2', '시도 전체', sido ? m2 : new Map(), si);
  tgOpts('tg-r3', '시·군 전체', si ? m3 : new Map(), gu);
}
/* 대표님 보고용: 자료 출처·선정 기준·상권 기준·한계 (숫자는 지금 고른 지역 기준) */
const tgGuess = h => /추정|확인 필요/.test(h.note || '');
const tgDay = v => v ? String(v).slice(0, 10) : '-';
function tgBasis(d){
  const m = d.meta || {}, b = d.bands || {}, all = Object.values(b).reduce((a, n) => a + n, 0), known = all - (b['미확인'] || 0);
  const guess = (d.hubs || []).filter(tgGuess), c = d.checks || {};
  $('tg-basis-body').innerHTML = `
  <h4>1. 어디서 모았나요</h4><ul>
    <li><b>매장 목록</b>: 소상공인시장진흥공단 「상가(상권)정보」 공공데이터. 마지막 반영 <b>${tgDay(m.src_date)}</b>. 분기마다 갱신돼서 최근 폐업한 곳이 늦게 빠질 수 있어요.</li>
    <li><b>평수</b>: 행정안전부 「인허가(일반·휴게음식점)」에 신고된 시설 면적. 상호·주소로 연결된 매장만 나와요. 지금 지역 ${nf(all)}곳 중 <b>${nf(known)}곳 확인</b> (인허가 수집 ${tgDay(m.lic_at)}).</li>
    <li><b>업종 확인</b>: 네이버 플레이스 업종명. 지금 지역에서 ${nf(m.naver_n || 0)}곳이 확인돼 있어요.</li>
    <li><b>직원 확인</b>: 직원이 N 플레이스로 메뉴·배달 여부를 보고 [적합 / 배달샵 / 부적합]을 누른 결과예요. 지금 지역 적합 ${nf(c['적합'] || 0)}곳, 배달샵 ${nf(c['배달샵'] || 0)}곳, 부적합 ${nf(c['부적합'] || 0)}곳, 아직 확인 전 ${nf(c['미확인'] || 0)}곳. 배달샵·부적합은 우편 목록에서 빠져요.</li></ul>
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
      <br>칩에는 타겟이 3곳 이상인 기준점만, 많은 순으로 최대 25개까지 보여요.</li>
    ${guess.length ? `<li class="warn">⚠ 표시된 기준점 ${guess.length}곳(${guess.slice(0, 8).map(h => esc(h.name)).join(', ')}${guess.length > 8 ? ' 등' : ''})은 자동으로 만들었거나 처음에 넣은 <b>추정 위치</b>예요. 지도에서 이름표를 누르고 '위치 옮기기'로 실제 위치(정문 등)를 찍어 주면 '확인됨'으로 바뀌어요.</li>` : '<li>기준점 위치는 모두 지도에서 확인한 위치예요.</li>'}
    <li><b>경쟁점 500m</b>: 매장마다 반경 500m 안 라멘·돈카츠 전문점 수예요. 매일 새벽 다시 계산해요 (마지막 ${tgDay(m.comp_at)}).</li></ul>
  <h4>4. 알아 둘 한계</h4><ul>
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
    renderTarget(); if (TM.iw) TM.iw.close();
    toast(nv ? `'${r ? r.name : '매장'}' ${nv}(으)로 표시했어요` : '확인 표시를 지웠어요');
  } catch (err) { toast(errMsg(err), true); }
}
function renderTarget(){
  const d = state.tg.d || {}, rows = d.rows || [], regs = d.regions || [];
  tgRegions(regs);
  const hubs = d.hubs || [];
  $('tg-hub').innerHTML = hubs.length ? `<button data-v="" class="${!state.tg.hub ? 'on' : ''}">상권 전체</button>` +
    hubs.map(h => `<button data-v="${h.id}" class="${String(state.tg.hub) === String(h.id) ? 'on' : ''}" title="${esc(h.kind || '')} · 반경 ${h.radius_m}m"><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${TG_HUBC[h.kind] || '#555'};margin-right:4px"></i>${esc(h.name)}${tgGuess(h) ? ' ⚠' : ''} <small>${nf(h.n)}</small></button>`).join('') : '';
  tgBasis(d);
  const ck = d.checks || {}, ckBtn = (v, l, n) => `<button data-v="${v}" class="${state.tg.check === v ? 'on' : ''}">${l} <small>${nf(n || 0)}</small></button>`;
  $('tg-check').innerHTML = ckBtn('', '우편 대상', (ck['미확인'] || 0) + (ck['적합'] || 0)) + ckBtn('미확인', '확인 전', ck['미확인']) + ckBtn('적합', '✓ 적합', ck['적합']) + ckBtn('제외', '제외한 곳', (ck['배달샵'] || 0) + (ck['부적합'] || 0));
  tgChips('tg-seg', TG_SEGS, d.segs || {}, state.tg.seg, '업종 전체');
  tgChips('tg-band', TG_BANDS, d.bands || {}, state.tg.band, '면적 전체');
  const b = d.bands || {};
  $('tg-stats').innerHTML = [
    ['지금 보이는', (d.total || 0) + '곳'], ['20평 이하', (b['20평 이하'] || 0) + '곳'], ['20평 초과', (b['20평 초과'] || 0) + '곳'],
    ['평수 미확인', (b['미확인'] || 0) + '곳'], ['경쟁점 근처', (d.near_comp || 0) + '곳'], ['체인', (d.chain || 0) + '곳']
  ].map(([l, v]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
  $('tg-count').textContent = (d.total || 0).toLocaleString() + '곳';
  $('tg-rows').innerHTML = rows.length ? rows.map(r => `<tr data-id="${r.id}" class="${r.sis_check === '배달샵' || r.sis_check === '부적합' ? 'tg-out' : ''}">
    <td><div class="nm">${esc(r.name)}${r.branch ? ' ' + esc(r.branch) : ''}${r.is_own ? ' <span class="tag t-B">우리 매장</span>' : ''}${!r.is_own && r.is_chain ? ' <span class="tag t-C">체인</span>' : ''}<a class="nv" href="${esc(naverLink(r))}" target="_blank" rel="noopener" title="네이버 플레이스">N ${r.naver_url ? '플레이스' : '검색'}</a></div><div class="sm">${esc(r.addr_road || '')}${r.tel ? ' · ' + esc(tel(r.tel)) : ''}</div>${tgCkBtns(r)}</td>
    <td>${esc(r.seg || '')}<div class="sm">${esc(r.naver_category || r.cat || '')}</div></td>
    <td>${esc([r.sigungu, r.dong].filter(Boolean).join(' '))}</td>
    <td>${r.hub_name ? esc(r.hub_name) + `<div class="sm">${esc(r.hub_kind || '')} · ${Number(r.dist_m || 0).toLocaleString()}m</div>` : '<span class="muted">-</span>'}</td>
    <td>${tgComp(r)}</td>
    <td class="num">${r.pyeong == null ? '<span class="muted">미확인</span>' : (r.area_band === '20평 이하' ? `<b>${r.pyeong}평</b>` : r.pyeong + '평')}</td>
    <td><span class="tag t-st">${esc(ST[r.stage] || r.stage || '')}</span></td>
    <td class="num">${r.mail_cnt ? r.mail_cnt + '회' : '-'}</td></tr>`).join('')
    : `<tr><td colspan="8" class="muted" style="text-align:center;padding:40px">조건에 맞는 매장이 없어요.</td></tr>`;
}
['tg-r0', 'tg-r1', 'tg-r2', 'tg-r3'].forEach((id, i) => $(id).addEventListener('change', () => {
  state.tg.r = state.tg.r.map((v, j) => j < i ? v : j === i ? $(id).value : '');
  state.tg.hub = ''; loadTarget();
}));
/* 상권(기준점)은 구 경계에 걸쳐 있어서, 고르면 구 선택은 '전체'로 풂 */
function tgPickHub(v){ state.tg.hub = v; if (v) state.tg.r[3] = ''; loadTarget(); }
$('tg-check').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; state.tg.check = b.dataset.v; loadTarget(); });
$('tg-hub').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; tgPickHub(b.dataset.v); });
function tgView(v){
  state.tg.view = v; try { localStorage.setItem('crm-tg-view', v); } catch (e) {}
  $('tg-v-list').classList.toggle('on', v === 'list'); $('tg-v-map').classList.toggle('on', v === 'map');
  $('tg-mapbox').hidden = v !== 'map';   // 지도에서도 아래에 매장 목록은 그대로 보여 줌
  if (v === 'map' && state.tg.d) { tgFit = true; tgMap(); }
}
$('tg-v-list').addEventListener('click', () => tgView('list'));
$('tg-v-map').addEventListener('click', () => tgView('map'));
/* ---------- 지도 (네이버 지도, 06-area-report.js의 nmLoad 사용) ---------- */
const TM = { map: null, el: null, objs: [], iw: null };
let tgFit = true;
function tgLegend(){
  const d = state.tg.d || {}, rows = d.rows || [], cnt = k => rows.filter(r => r.seg === k).length;
  const cr = (d.comps || []).filter(c => c.seg === '경쟁:라멘').length, ck = (d.comps || []).filter(c => c.seg === '경쟁:돈카츠').length;
  $('tg-leg').innerHTML = TG_SEGS.filter(cnt).map(k => `<span><i style="background:${TG_COL[k]}"></i>${esc(k)} ${cnt(k)}</span>`).join('') +
    `<span><i class="c" style="background:#c62429"></i>경쟁 라멘 ${cr}</span><span><i class="c" style="background:#222"></i>경쟁 돈카츠 ${ck}</span>` +
    Object.entries(TG_HUBC).map(([k, c]) => `<span><i style="background:transparent;border:2px dashed ${c}"></i>${k} 기준점</span>`).join('') +
    ((d.total || 0) > rows.length ? `<span>· 핀은 ${rows.length.toLocaleString()}곳까지만 보여요. 지역을 좁혀 주세요</span>` : '');
}
async function tgMap(){
  const box = $('tg-map');
  if (!TM.map || !box.contains(TM.el)) {
    box.innerHTML = '<div style="width:100%;height:100%"></div>'; TM.el = box.firstChild; TM.map = null; TM.objs = [];
    const ok = typeof nmLoad === 'function' && await nmLoad();
    if (!ok) { box.innerHTML = '<div class="ar-empty muted">네이버 지도를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</div>'; TM.el = null; return; }
    TM.map = new naver.maps.Map(TM.el, { center: new naver.maps.LatLng(36.635, 127.47), zoom: 13, zoomControl: true, zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT }, mapDataControl: false, scaleControl: true });
    TM.iw = new naver.maps.InfoWindow({ content: '', borderColor: '#ccd', borderWidth: 1, anchorSize: new naver.maps.Size(10, 8), disableAnchor: false });
    naver.maps.Event.addListener(TM.map, 'click', e => {
      TM.iw.close();
      if (state.tg.moveHub) tgMoveHub(e.coord.lat(), e.coord.lng());
      else if (state.tg.addHub) tgAddHub(e.coord.lat(), e.coord.lng());
    });
  }
  TM.objs.forEach(o => o.setMap(null)); TM.objs = []; TM.iw.close();
  const d = state.tg.d || {}, rows = (d.rows || []).filter(r => r.lat), comps = d.comps || [], hubs = d.hubs || [];
  const P = (la, ln) => new naver.maps.LatLng(la, ln);
  hubs.forEach(h => {
    const c = TG_HUBC[h.kind] || '#555', on = String(state.tg.hub) === String(h.id);
    TM.objs.push(new naver.maps.Circle({ map: TM.map, center: P(h.lat, h.lng), radius: h.radius_m, strokeColor: c, strokeOpacity: .9, strokeWeight: on ? 3 : 2, strokeStyle: 'shortdash', fillColor: c, fillOpacity: on ? .08 : .03, clickable: false }));
    const m = new naver.maps.Marker({ map: TM.map, position: P(h.lat, h.lng), zIndex: 300, icon: { content: `<span class="tgh" style="border-color:${c};color:${c}">${esc(h.name)} ${nf(h.n)}</span>`, anchor: new naver.maps.Point(0, 0) } });
    naver.maps.Event.addListener(m, 'click', () => {
      TM.iw.setContent(`<div class="tg-iw"><b>${esc(h.name)}</b><br>${esc(h.kind || '')} 기준점 · 반경 ${nf(h.radius_m)}m · 타겟 ${nf(h.n)}곳<br>${tgGuess(h) ? '<span style="color:#a8431a">⚠ 위치 추정치 — 확인 필요</span>' : '<span style="color:#2f6f4e">✓ 위치 확인됨</span>'}<div class="a"><button data-a="hub" data-id="${h.id}">${on ? '전체 보기' : '이 상권만 보기'}</button><button data-a="hmove" data-id="${h.id}">위치 옮기기</button><button data-a="hoff" data-id="${h.id}">숨기기</button></div></div>`);
      TM.iw.open(TM.map, m);
    });
    TM.objs.push(m);
  });
  comps.forEach(c => {
    const m = new naver.maps.Marker({ map: TM.map, position: P(c.lat, c.lng), zIndex: 150, icon: { content: `<i class="tgc" style="background:${c.seg === '경쟁:라멘' ? '#c62429' : '#222'}"></i>`, anchor: new naver.maps.Point(7, 7) } });
    naver.maps.Event.addListener(m, 'click', () => { TM.iw.setContent(`<div class="tg-iw"><b>${esc(c.name)}${c.branch ? ' ' + esc(c.branch) : ''}</b><br>경쟁점 · ${c.seg === '경쟁:라멘' ? '라멘' : '돈카츠'}<div class="a"><button data-a="lead" data-id="${c.id}">매장 상세</button></div></div>`); TM.iw.open(TM.map, m); });
    TM.objs.push(m);
  });
  rows.forEach(r => {
    const m = new naver.maps.Marker({ map: TM.map, position: P(r.lat, r.lng), zIndex: 200, icon: { content: `<i class="tgm" style="background:${TG_COL[r.seg] || '#888'}"></i>`, anchor: new naver.maps.Point(8, 8) } });
    naver.maps.Event.addListener(m, 'click', () => {
      const comp = [r.comp_ramen ? '라멘 ' + r.comp_ramen : '', r.comp_katsu ? '돈카츠 ' + r.comp_katsu : ''].filter(Boolean).join(' · ') || '없음';
      TM.iw.setContent(`<div class="tg-iw"><b>${esc(r.name)}${r.branch ? ' ' + esc(r.branch) : ''}</b><br><span style="color:${TG_COL[r.seg] || '#888'};font-weight:700">${esc(r.seg || '')}</span> · ${r.pyeong == null ? '평수 미확인' : r.pyeong + '평'}<br>500m 경쟁점: ${esc(comp)}<br><span style="color:#888">${esc(r.addr_road || '')}</span>${tgCkBtns(r)}<div class="a"><button data-a="lead" data-id="${r.id}">매장 상세</button><a href="${esc(naverLink(r))}" target="_blank" rel="noopener">N 플레이스</a></div></div>`);
      TM.iw.open(TM.map, m);
    });
    TM.objs.push(m);
  });
  tgLegend();
  if (tgFit) {
    tgFit = false;
    const hub = hubs.find(h => String(h.id) === String(state.tg.hub));
    if (hub) { TM.map.setCenter(P(hub.lat, hub.lng)); TM.map.setZoom(hub.radius_m > 1000 ? 14 : 15); }
    else if (rows.length) {
      const la = rows.map(r => r.lat).sort((a, b) => a - b), ln = rows.map(r => r.lng).sort((a, b) => a - b), q = a => a[Math.floor(a.length * .03)], Q = a => a[Math.ceil(a.length * .97) - 1];
      TM.map.fitBounds(new naver.maps.LatLngBounds(P(q(la), q(ln)), P(Q(la), Q(ln))), { top: 30, right: 30, bottom: 30, left: 30 });
    }
  }
}
document.addEventListener('click', async e => {
  const cb = e.target.closest('.tg-iw .tg-ck button'); if (cb) { tgSetCheck(cb.parentNode.dataset.id, cb.dataset.v); return; }
  const b = e.target.closest('.tg-iw [data-a]'); if (!b) return;
  const id = b.dataset.id;
  if (b.dataset.a === 'lead') { TM.iw.close(); openLead(+id); }
  if (b.dataset.a === 'hub') { TM.iw.close(); tgPickHub(String(state.tg.hub) === id ? '' : id); }
  if (b.dataset.a === 'hmove') {
    const h = ((state.tg.d && state.tg.d.hubs) || []).find(x => String(x.id) === id); if (!h) return;
    TM.iw.close(); tgAddMode(false); state.tg.moveHub = h;
    $('tg-maphint').textContent = `'${h.name}'의 실제 위치(예: 정문)를 지도에서 누르세요.`;
  }
  if (b.dataset.a === 'hoff') {
    if (!confirm('이 기준점을 목록과 지도에서 숨길까요? (매장 데이터는 그대로예요)')) return;
    try { await rpc('lead_hub_off', { p_id: +id }); TM.iw.close(); if (String(state.tg.hub) === id) state.tg.hub = ''; toast('기준점을 숨겼어요'); loadTarget(); }
    catch (err) { toast(errMsg(err), true); }
  }
}, true);
function tgAddMode(on){
  state.tg.addHub = on; $('tg-addhub').classList.toggle('on', on);
  $('tg-addhub').textContent = on ? '추가 취소' : '＋ 기준점 추가';
  $('tg-maphint').textContent = on ? '기준점으로 삼을 곳(예: ○○대학교 정문)을 지도에서 누르세요.' : '핀을 누르면 매장 정보가 보여요. 동그라미(기준점)를 누르면 그 상권만 걸러져요.';
}
$('tg-addhub').addEventListener('click', () => { state.tg.moveHub = null; tgAddMode(!state.tg.addHub); });
async function tgMoveHub(lat, lng){
  const h = state.tg.moveHub; state.tg.moveHub = null; tgAddMode(false);
  if (!confirm(`'${h.name}' 위치를 여기로 옮길까요?`)) return;
  try { await rpc('lead_hub_save', { p: { id: h.id, name: h.name, lat, lng } }); toast(`'${h.name}' 위치를 확인했어요`); tgPickHub(String(h.id)); }
  catch (err) { toast(errMsg(err), true); }
}
async function tgAddHub(lat, lng){
  tgAddMode(false);
  const name = (prompt('기준점 이름 (예: 충북대 정문, 성안길)') || '').trim(); if (!name) return;
  const k = (prompt('종류 번호를 입력하세요\n1 대학가   2 오피스   3 번화가', '1') || '').trim();
  const kind = { '1': '대학가', '2': '오피스', '3': '번화가' }[k] || '대학가';
  const rad = parseInt(prompt('반경 (m)', kind === '번화가' ? '500' : '700'), 10) || 700;
  const [, sido, si, gu] = state.tg.r;
  try {
    const h = await rpc('lead_hub_save', { p: { name, kind, lat, lng, radius_m: Math.min(Math.max(rad, 100), 3000), sido, sigungu: si ? (gu ? si + ' ' + gu : si) : '' } });
    toast(`'${name}' 기준점을 추가했어요`); tgPickHub(String(h.id));
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
  }).join('') : '<p class="muted" style="margin:8px 0 0">위 목록을 거른 뒤 <b>＋ 우편 회차로 묶기</b>를 누르면, 그 매장들이 한 회차로 저장돼요. 발송하고 <b>발송 완료로 기록</b>을 누르면 매장마다 우편 기록이 남고, 1주 뒤 전화할 곳을 여기서 볼 수 있어요.</p>';
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
$('tg-mkbatch').addEventListener('click', async () => {
  const d = state.tg.d || {}, rows = (d.rows || []).filter(r => r.sis_check !== '배달샵' && r.sis_check !== '부적합');
  if (!rows.length) { toast('묶을 매장이 없어요. 목록을 먼저 걸러 주세요', true); return; }
  const hub = (d.hubs || []).find(h => String(h.id) === String(state.tg.hub));
  const now = new Date(), [, , si, gu] = state.tg.r;
  const def = `${now.getFullYear()}.${now.getMonth() + 1} ${hub ? hub.name : [si, gu].filter(Boolean).join(' ') || '전체'}${state.tg.seg ? ' ' + state.tg.seg : ''}`;
  const name = (prompt(`우편 회차 이름 (${rows.length}곳)`, def) || '').trim(); if (!name) return;
  const note = (prompt('메모 (선택: 우편 내용, 함께 돌린 인스타 광고 등)', '') || '').trim();
  try {
    const r = await rpc('lead_mail_batch_create', { p: { name, note, ids: rows.map(x => x.id),
      filter: { region: state.tg.r, hub: hub ? hub.name : '', seg: state.tg.seg, band: state.tg.band, check: state.tg.check } } });
    toast(`'${name}' 회차에 ${r.n}곳을 담았어요`); TB.open = r.id; await loadBatches(); await tbLoadItems(r.id); renderBatches();
    $('tg-batches').open = true; $('tg-batches').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { toast(errMsg(e), true); }
});

tgView(state.tg.view);
['tg-sort', 'tg-own', 'tg-chain'].forEach(id => $(id).addEventListener('change', loadTarget));
$('tg-seg').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; state.tg.seg = b.dataset.v; state.tg.band = ''; loadTarget(); });
$('tg-band').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; state.tg.band = b.dataset.v; loadTarget(); });
$('tg-rows').addEventListener('click', e => {
  const cb = e.target.closest('.tg-ck button'); if (cb) { tgSetCheck(cb.parentNode.dataset.id, cb.dataset.v); return; }
  if (e.target.closest('a')) return; const tr = e.target.closest('tr[data-id]'); if (tr) openLead(+tr.dataset.id); });
$('tg-copy').addEventListener('click', async () => {
  const rows = ((state.tg.d && state.tg.d.rows) || []).filter(r => r.sis_check !== '배달샵' && r.sis_check !== '부적합');
  if (!rows.length) { toast('복사할 매장이 없어요', true); return; }
  const lines = ['상호\t업종\t주소\t전화'].concat(rows.map(r => [r.name + (r.branch ? ' ' + r.branch : ''), r.seg || '', r.addr_road || '', r.tel ? tel(r.tel) : ''].join('\t')));
  try { await navigator.clipboard.writeText(lines.join('\n')); toast(`${rows.length}곳 주소를 복사했어요. 엑셀에 붙여 넣으세요`); }
  catch (e) { toast('복사하지 못했어요. 브라우저 권한을 확인하세요', true); }
});
