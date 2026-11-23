/* ---------- 상권분석: 소상공인365 오픈API iFrame ----------
   주소: https://bigdata.sbiz.or.kr/#/openApi/{서비스명}?certKey={인증키}
   인증키는 공개 저장소에 두지 않고 lead_settings('sbiz365_keys')에 저장 → sbiz_keys_get / sbiz_keys_set RPC */
const SBIZ = [
  ['report', '상권 리포트', '예비점주 입점 상담용 — 주소로 상담 위치를 고르고 분석하기를 누르면, 배후 인구·경쟁점·개업·폐업·업종 구성을 보고서로 만들어요.', 0],
  ['detail', '상세분석', '지역·업종을 골라 매출·유동인구·점포 수 등 상권 리포트를 봐요.', 0],
  ['locAnls', '입지분석', '후보 위치를 찍어 주변 입지 점수와 경쟁 환경을 봐요.', 0],
  ['startupPublic', '상권지도', '지도에서 업종별 밀집도와 상권 경계를 한눈에 봐요.', 0],
  ['hpReport', '트렌드 분석', '뜨는 상권·업종의 매출과 점포 변화 흐름을 봐요.', 0],
  ['dashboardStats', '인구통계', '지역별 인구·연령대·가구 분포를 봐요.', 1],
  ['dashboardStore', '업소통계', '지역·업종별 업소 수와 개·폐업 추이를 봐요.', 1]
];
const AR = { keys: null, tab: null };
try { AR.tab = localStorage.getItem('crm-area-tab'); } catch (e) {}
if (!SBIZ.some(x => x[0] === AR.tab)) AR.tab = SBIZ[0][0];
const sbizUrl = (svc, key) => 'https://bigdata.sbiz.or.kr/#/openApi/' + svc + '?certKey=' + encodeURIComponent(key);
async function loadArea(){
  $('ar-keys').hidden = !state.admin;
  if (AR.keys === null) {
    try { AR.keys = await rpc('sbiz_keys_get') || {}; }
    catch (e) { AR.keys = null; toast(errMsg(e), true); }
  }
  if (state.admin) $('ar-key-fields').innerHTML = SBIZ.filter(x => x[0] !== 'report').map(([k, l]) => `<div><label for="ark-${k}">${l} <small>(${k})</small></label><input id="ark-${k}" data-k="${k}" autocomplete="off" spellcheck="false" value="${esc((AR.keys || {})[k] || '')}"></div>`).join('');
  renderArea();
}
function renderArea(){
  const keys = AR.keys || {};
  $('ar-tabs').innerHTML = SBIZ.map(([k, l]) => `<button role="tab" data-t="${k}" class="${k === AR.tab ? 'on' : ''}" aria-selected="${k === AR.tab}">${l}</button>`).join('');
  const t = SBIZ.find(x => x[0] === AR.tab), key = keys[t[0]];
  const isRp = t[0] === 'report';
  $('ar-report').hidden = !isRp; $('ar-frame').hidden = isRp; if (state.admin) $('ar-keys').hidden = isRp;
  if (isRp) { $('ar-desc').textContent = t[2]; $('ar-open').hidden = true; if (RP.place && !$('rp-q').value) $('rp-q').value = RP.place.label || ''; rpPick(); if ($('rp-body').hidden) rpMapFrame(); return; }
  $('ar-desc').textContent = t[2] + ' 자료 출처: 소상공인시장진흥공단 소상공인365.';
  const box = $('ar-frame'); box.classList.toggle('tall', !!t[3]);
  if (!key) {
    $('ar-open').hidden = true;
    box.innerHTML = `<div class="ar-empty muted">${esc(t[1])} 인증키가 아직 등록되지 않았어요.${state.admin ? '<br>위의 <b>365 인증키 설정</b>을 열어 넣어 주세요.' : '<br>관리자에게 등록을 요청하세요.'}</div>`;
    return;
  }
  const url = sbizUrl(t[0], key);
  $('ar-open').href = url; $('ar-open').hidden = false;
  const f = box.querySelector('iframe');
  if (f && f.dataset.t === t[0]) return;
  box.innerHTML = `<iframe data-t="${t[0]}" src="${esc(url)}" title="소상공인365 ${esc(t[1])} 화면" loading="lazy" allow="geolocation; clipboard-write; fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
}


/* ---------- 상권 리포트: 주소 검색 버튼 + Enter 검색 ----------
   (06-area-report.js의 추천 목록·선택 로직을 그대로 쓰고, 버튼과 즉시 검색만 더함) */
(() => {
  const q = $('rp-q'), sug = $('rp-sug');
  if (!q || $('rp-search')) return;
  const st = document.createElement('style');
  st.textContent = '.rp-in{display:flex;gap:6px;align-items:center}.rp-in input{flex:1 1 auto;min-width:0}.rp-in #rp-search{flex:none;height:38px;padding:0 16px;white-space:nowrap}';
  document.head.appendChild(st);
  const w = document.createElement('div'); w.className = 'rp-in';
  q.parentNode.insertBefore(w, q); w.appendChild(q);
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn pri'; b.id = 'rp-search'; b.textContent = '검색';
  w.appendChild(b);
  let seq = 0;
  async function go(){
    if (typeof rpT !== 'undefined') clearTimeout(rpT);   // 입력 중 자동 검색 취소
    const v = q.value.trim();
    if (v.length < 2) { toast('주소나 매장 이름을 두 글자 이상 입력해 주세요.'); q.focus(); return; }
    const my = ++seq; b.disabled = true;
    sug.innerHTML = '<div class="muted" style="padding:10px 12px">찾는 중이에요…</div>'; sug.hidden = false;
    try {
      const [addr, shops] = await Promise.all([
        SB.functions.invoke('area-pop', { body: { q: v } }).then(r => (r.data && r.data.items) || []).catch(() => []),
        rpc('area_place_search', { q: v }).catch(() => [])
      ]);
      if (my !== seq) return;
      const rows = [...addr.map(a => ({ k: 'addr', label: a.label, sub: a.sub, lat: a.lat, lng: a.lng })),
                    ...(shops || []).map(r => ({ k: 'shop', label: r.name + (r.branch ? ' ' + r.branch : ''), sub: [r.sigungu, r.dong, r.cat].filter(Boolean).join(' · '), lat: r.lat, lng: r.lng, addr: r.addr }))];
      const grp = (k, t) => { const g = rows.map((r, i) => [r, i]).filter(([r]) => r.k === k); return g.length ? `<div class="rp-sg">${t}</div>` + g.map(([r, i]) => `<button data-i="${i}">${esc(r.label)}<small>${esc(r.sub || '')}</small></button>`).join('') : ''; };
      sug._rows = rows;
      sug.innerHTML = rows.length ? grp('addr', '주소') + grp('shop', '영업관리 매장') : '<div class="muted" style="padding:10px 12px">찾는 결과가 없어요. 도로명 주소(예: 불당25로 176)나 지번(예: 불당동 1497)으로 찾아 보세요.</div>';
      sug.hidden = false;
      if (rows.length === 1) sug.querySelector('button[data-i]').click();   // 결과가 하나면 바로 지도로
    } finally { if (my === seq) b.disabled = false; }
  }
  q.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); go(); } });
  b.addEventListener('click', go);
})();
