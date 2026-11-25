/* ---------- 샵인샵 타겟 ---------- */
/* 업종 = 홍보 이미지 6개 묶음(+기타 일식), 면적 = 20평 이하/초과/미확인, 경쟁점 = 반경 500m 라멘·돈카츠 수 (DB: sis_seg, sis_comp_*) */
const TG_SEGS = ['분식·김밥', '우동·소바', '덮밥', '초밥·일식', '텐동', '이자카야', '기타 일식'];
const TG_BANDS = ['20평 이하', '20평 초과', '미확인'];
state.tg = { seg: '', band: '', d: null };
$('sec-target').innerHTML = `
  <div class="sec-hd"><h1>샵인샵 타겟 <small id="tg-count"></small></h1><button class="btn" id="tg-copy">우편용 주소 복사</button></div>
  <p class="muted">홍보 이미지의 업종(분식·김밥, 우동·소바, 덮밥, 초밥·일식, 텐동, 이자카야) 매장이에요. 라멘·돈카츠 전문점은 <b>경쟁점</b>이라 목록에서 빼고, 매장마다 <b>반경 500m 안 경쟁점 수</b>로 보여 줘요. 횟집은 제외해요. 평수는 인허가 자료가 연결된 매장만 나오고, 나머지는 '미확인'이에요.</p>
  <div class="bar">
    <select id="tg-region" aria-label="지역"><option value="">전체 지역</option></select>
    <select id="tg-sort" aria-label="정렬"><option value="comp">경쟁점 적은 순</option><option value="name">이름순</option><option value="area">평수 작은 순</option><option value="density">주변 매장 많은 순</option></select>
    <label class="chk"><input type="checkbox" id="tg-own">우리 매장 제외</label>
    <label class="chk"><input type="checkbox" id="tg-chain" checked>체인 제외</label>
  </div>
  <div class="chips" id="tg-seg" role="group" aria-label="업종"></div>
  <div class="chips" id="tg-band" role="group" aria-label="면적"></div>
  <section class="stats" id="tg-stats" aria-label="타겟 요약"></section>
  <div class="tbl-wrap">
    <table>
      <thead><tr><th>매장</th><th>업종</th><th>지역</th><th>상권</th><th>경쟁점 500m</th><th class="num">평수</th><th>단계</th><th class="num">우편</th></tr></thead>
      <tbody id="tg-rows"></tbody>
    </table>
  </div>`;
async function loadTarget(){
  const [sido, sigungu] = ($('tg-region').value || '|').split('|');
  try {
    const d = await rpc('lead_target_list', { p: { sido, sigungu, seg: state.tg.seg, band: state.tg.band,
      ex_own: $('tg-own').checked, ex_chain: $('tg-chain').checked, sort: $('tg-sort').value } });
    state.tg.d = d; renderTarget();
  } catch (e) { toast(errMsg(e), true); }
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
function renderTarget(){
  const d = state.tg.d || {}, rows = d.rows || [], regs = d.regions || [];
  const sel = $('tg-region'), cur = sel.value;
  const all = regs.reduce((a, r) => a + r.n, 0);
  sel.innerHTML = `<option value="">전체 지역 (${all.toLocaleString()})</option>` +
    regs.map(r => `<option value="${esc(r.sido + '|' + r.sigungu)}">${esc((r.sido + ' ' + r.sigungu).trim())} (${r.n.toLocaleString()})</option>`).join('');
  sel.value = cur;
  tgChips('tg-seg', TG_SEGS, d.segs || {}, state.tg.seg, '업종 전체');
  tgChips('tg-band', TG_BANDS, d.bands || {}, state.tg.band, '면적 전체');
  const b = d.bands || {};
  $('tg-stats').innerHTML = [
    ['지금 보이는', (d.total || 0) + '곳'], ['20평 이하', (b['20평 이하'] || 0) + '곳'], ['20평 초과', (b['20평 초과'] || 0) + '곳'],
    ['평수 미확인', (b['미확인'] || 0) + '곳'], ['경쟁점 근처', (d.near_comp || 0) + '곳'], ['체인', (d.chain || 0) + '곳']
  ].map(([l, v]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
  $('tg-count').textContent = (d.total || 0).toLocaleString() + '곳';
  $('tg-rows').innerHTML = rows.length ? rows.map(r => `<tr data-id="${r.id}">
    <td><div class="nm">${esc(r.name)}${r.branch ? ' ' + esc(r.branch) : ''}${r.is_own ? ' <span class="tag t-B">우리 매장</span>' : ''}${!r.is_own && r.is_chain ? ' <span class="tag t-C">체인</span>' : ''}<a class="nv" href="${esc(naverLink(r))}" target="_blank" rel="noopener" title="네이버 플레이스">N ${r.naver_url ? '플레이스' : '검색'}</a></div><div class="sm">${esc(r.addr_road || '')}${r.tel ? ' · ' + esc(tel(r.tel)) : ''}</div></td>
    <td>${esc(r.seg || '')}<div class="sm">${esc(r.naver_category || r.cat || '')}</div></td>
    <td>${esc([r.sigungu, r.dong].filter(Boolean).join(' '))}</td>
    <td>${r.hub_name ? esc(r.hub_name) + `<div class="sm">${esc(r.hub_kind || '')} · ${Number(r.dist_m || 0).toLocaleString()}m</div>` : '<span class="muted">-</span>'}</td>
    <td>${tgComp(r)}</td>
    <td class="num">${r.pyeong == null ? '<span class="muted">미확인</span>' : (r.area_band === '20평 이하' ? `<b>${r.pyeong}평</b>` : r.pyeong + '평')}</td>
    <td><span class="tag t-st">${esc(ST[r.stage] || r.stage || '')}</span></td>
    <td class="num">${r.mail_cnt ? r.mail_cnt + '회' : '-'}</td></tr>`).join('')
    : `<tr><td colspan="8" class="muted" style="text-align:center;padding:40px">조건에 맞는 매장이 없어요.</td></tr>`;
}
['tg-region', 'tg-sort', 'tg-own', 'tg-chain'].forEach(id => $(id).addEventListener('change', loadTarget));
$('tg-seg').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; state.tg.seg = b.dataset.v; state.tg.band = ''; loadTarget(); });
$('tg-band').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; state.tg.band = b.dataset.v; loadTarget(); });
$('tg-rows').addEventListener('click', e => { if (e.target.closest('a')) return; const tr = e.target.closest('tr[data-id]'); if (tr) openLead(+tr.dataset.id); });
$('tg-copy').addEventListener('click', async () => {
  const rows = (state.tg.d && state.tg.d.rows) || [];
  if (!rows.length) { toast('복사할 매장이 없어요', true); return; }
  const lines = ['상호\t업종\t주소\t전화'].concat(rows.map(r => [r.name + (r.branch ? ' ' + r.branch : ''), r.seg || '', r.addr_road || '', r.tel ? tel(r.tel) : ''].join('\t')));
  try { await navigator.clipboard.writeText(lines.join('\n')); toast(`${rows.length}곳 주소를 복사했어요. 엑셀에 붙여 넣으세요`); }
  catch (e) { toast('복사하지 못했어요. 브라우저 권한을 확인하세요', true); }
});
