/* ---------- 상권 리포트 (자체) — 예비점주 입점 상담용 ----------
   area-report : 반경 상가(소상공인 상가정보)·시군구 비교·프랜차이즈 개폐업·공정위 평균매출·네이버 리뷰
   area-pop    : 주소 검색(SGIS) / 반경 인구·연령·가구·1인가구·종사자(SGIS 집계구) + 음식점 인허가 개업·폐업(개인 포함)
   종합 점수·등급은 아직 넣지 않음(우리 기준이 정해지면 추가) */
const RP = { place: null, r: 500, data: null, pop: null, popErr: '', busy: false, more: false, seq: 0 };
try { const s = JSON.parse(localStorage.getItem('crm-rp') || 'null'); if (s && s.place) { RP.place = s.place; RP.r = s.r || 500; } } catch (e) {}
const nf = n => (n == null || isNaN(n)) ? '-' : Number(n).toLocaleString();
const pct = (a, b) => b ? a / b * 100 : null;
const pf = v => v == null || isNaN(v) ? '-' : v.toFixed(1) + '%';
const manwon = k => k == null || !k ? '-' : nf(Math.round(k / 120)) + '만';   // 공정위 연매출(천원) → 월 만원
const OURS = s => /일식 면 요리|일식 카레\/돈가스\/덮밥/.test(s.s || '') || /라멘|라면|우동|소바|돈카츠|돈까스|돈가스|카츠|마제|츠케멘|규동|덮밥/.test(s.n || '');
const JP = s => /일식/.test(s.m || '') || OURS(s);
const AGE_L = ['0~9세', '10대', '20대', '30대', '40대', '50대', '60대', '70대', '80대', '90세+'];
function rpRad(){ document.querySelectorAll('#rp-rad button').forEach(b => b.classList.toggle('on', +b.dataset.r === RP.r)); }
rpRad();
let rpT = null;
$('rp-q').addEventListener('input', () => {
  clearTimeout(rpT); const q = $('rp-q').value.trim();
  if (q.length < 2) { $('rp-sug').hidden = true; return; }
  rpT = setTimeout(async () => {
    const [addr, shops] = await Promise.all([
      SB.functions.invoke('area-pop', { body: { q } }).then(r => (r.data && r.data.items) || []).catch(() => []),
      rpc('area_place_search', { q }).catch(() => [])
    ]);
    const rows = [...addr.map(a => ({ k: 'addr', label: a.label, sub: a.sub, lat: a.lat, lng: a.lng })),
                  ...(shops || []).map(r => ({ k: 'shop', label: r.name + (r.branch ? ' ' + r.branch : ''), sub: [r.sigungu, r.dong, r.cat].filter(Boolean).join(' · '), lat: r.lat, lng: r.lng, addr: r.addr }))];
    const grp = (k, t) => { const g = rows.map((r, i) => [r, i]).filter(([r]) => r.k === k); return g.length ? `<div class="rp-sg">${t}</div>` + g.map(([r, i]) => `<button data-i="${i}">${esc(r.label)}<small>${esc(r.sub || '')}</small></button>`).join('') : ''; };
    $('rp-sug').innerHTML = rows.length ? grp('addr', '주소') + grp('shop', '영업관리 매장') : '<div class="muted" style="padding:10px 12px">찾는 결과가 없어요. 도로명 주소(예: 불당25로 176)나 지번(예: 불당동 1497)으로 찾아 보세요.</div>';
    $('rp-sug').hidden = false; $('rp-sug')._rows = rows;
  }, 300);
});
$('rp-sug').addEventListener('click', e => {
  const b = e.target.closest('button[data-i]'); if (!b) return;
  const r = $('rp-sug')._rows[+b.dataset.i];
  $('rp-sug').hidden = true; $('rp-q').value = r.label;
  RP.place = { lat: r.lat, lng: r.lng, label: r.label, addr: r.addr || (r.k === 'addr' ? r.label : '') };
  try { localStorage.setItem('crm-rp', JSON.stringify({ place: RP.place, r: RP.r })); } catch (e2) {}
  RP.data = null; RP.pop = null; rpPick(); rpShow(false); rpMapFrame(true);
});
document.addEventListener('click', e => { if (!e.target.closest('.rp-find')) $('rp-sug').hidden = true; });
$('rp-rad').addEventListener('click', e => { const b = e.target.closest('button[data-r]'); if (!b) return; RP.r = +b.dataset.r; rpRad(); rpPick(); rpDraw(true); if (RP.place && !$('rp-body').hidden) rpLoad(false); });
$('rp-fresh').addEventListener('click', () => { if (RP.place && confirm('공공데이터를 새로 불러올까요? (10~30초 걸려요)')) rpLoad(true); });
$('rp-print').addEventListener('click', () => window.print());
async function rpLoad(fresh){
  if (!RP.place) return;
  try { localStorage.setItem('crm-rp', JSON.stringify({ place: RP.place, r: RP.r })); } catch (e) {}
  const seq = ++RP.seq; RP.busy = true; RP.more = false; RP.data = null; RP.pop = null; RP.popErr = '';
  rpShow(true);
  $('rp-body').innerHTML = `<div class="rp-empty muted">${esc(RP.place.label || '선택한 위치')} 반경 ${RP.r >= 1000 ? '1km' : RP.r + 'm'} 상권을 불러오는 중이에요…<br><small>처음 보는 지역은 10~30초 걸릴 수 있어요.</small></div>`;
  const body = { lat: RP.place.lat, lng: RP.place.lng, radius: RP.r, fresh: !!fresh };
  SB.functions.invoke('area-pop', { body }).then(({ data, error }) => {
    if (seq !== RP.seq) return;
    if (error || !data || !data.ok) RP.popErr = errMsg(error || (data && data.error) || '인구 자료를 불러오지 못했어요.'); else RP.pop = data;
    if (RP.data) rpRender(RP.data);
  });
  try {
    const { data, error } = await SB.functions.invoke('area-report', { body });
    if (seq !== RP.seq) return;
    if (error) throw error;
    if (!data || !data.ok) throw new Error((data && data.error) || '불러오지 못했어요.');
    RP.data = data; rpRender(data);
  } catch (e) {
    if (seq === RP.seq) $('rp-body').innerHTML = `<div class="rp-empty muted">상권 정보를 불러오지 못했어요.<br><small>${esc(errMsg(e))}</small></div>`;
  } finally { if (seq === RP.seq) RP.busy = false; }
}
function gapCell(g){
  if (g == null) return '<span class="muted">-</span>';
  const w = Math.min(50, Math.abs(g) / 10 * 50);
  const cls = Math.abs(g) < 1 ? 'mid' : g < 0 ? 'neg' : 'pos';
  const st = g < 0 ? `right:50%;width:${w}%` : `left:50%;width:${Math.max(w, .8)}%`;
  return `<div class="rp-gap" title="반경 비중 − 시군구 비중 = ${g > 0 ? '+' : ''}${g.toFixed(1)}%p"><div class="ax"><i class="bar ${cls}" style="${st}"></i></div><b>${g > 0 ? '+' : ''}${g.toFixed(1)}%p</b></div>`;
}
const gapTag = g => g == null ? '' : g >= 3 ? '<span class="rp-tag up">많음</span>' : g <= -3 ? '<span class="rp-tag dn">적음</span>' : '<span class="rp-tag">비슷</span>';
const catNm = m => String(m).trim() === '비알코올' ? '카페·음료' : String(m).trim();
function rpCompare(rows, tot, sggTot, hl){
  return `<div class="tw"><table class="rp-tbl"><thead><tr><th>업종</th><th class="num">반경 안</th><th class="num">비중<br><small>반경 / 시군구</small></th><th>차이</th><th></th></tr></thead><tbody>${rows.map(r => {
    const a = pct(r.n, tot), b = r.sgg != null && sggTot ? pct(r.sgg, sggTot) : null, g = b == null ? null : a - b;
    return `<tr class="${hl && hl(r) ? 'hl' : ''}"><td>${esc(catNm(r.nm))}</td><td class="num">${nf(r.n)}</td><td class="num">${pf(a)} <span class="muted">/ ${pf(b)}</span></td><td>${gapCell(g)}</td><td>${gapTag(g)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function rpMap(d){
  const R = d.center.radius, W = 440, C = W / 2, k = (C - 14) / R, lat0 = d.center.lat, cosl = Math.cos(lat0 * Math.PI / 180);
  const pt = s => [C + (s.ln - d.center.lng) * 111000 * cosl * k, C - (s.la - lat0) * 111000 * k];
  const rings = [100, 300, 500, 1000].filter(x => x <= R).map(x => `<circle cx="${C}" cy="${C}" r="${x * k}" fill="none" stroke="#c9ccc4" stroke-dasharray="3 4"/><text x="${C + 4}" y="${C - x * k + 12}" font-size="11" fill="#8a8e86">${x >= 1000 ? '1km' : x + 'm'}</text>`).join('');
  const st = d.stores || [];
  const dot = (s, f, r) => { const [x, y] = pt(s); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${f}" stroke="#fff" stroke-width="1"><title>${esc(s.n)} · ${esc(s.s || catNm(s.m))} · ${s.d}m</title></circle>`; };
  const ours = st.filter(OURS), jp = st.filter(s => JP(s) && !OURS(s)), rest = st.filter(s => !JP(s));
  return `<svg viewBox="0 0 ${W} ${W}" role="img" aria-label="반경 안 음식점 분포">${rings}
    ${rest.map(s => dot(s, '#c3c6be', 3)).join('')}${jp.map(s => dot(s, '#2a78d6', 3.4)).join('')}${ours.map(s => dot(s, '#c62429', 4.4)).join('')}
    <circle cx="${C}" cy="${C}" r="6" fill="#232621" stroke="#fff" stroke-width="2"/></svg>
    <div class="rp-legend"><span><i style="background:#c62429"></i>우리 메뉴 경쟁(면·돈가스·덮밥) ${ours.length}</span><span><i style="background:#2a78d6"></i>그 밖의 일식 ${jp.length}</span><span><i style="background:#c3c6be"></i>그 밖의 음식점 ${rest.length}</span><span><i style="background:#232621"></i>상담 위치</span></div>`;
}
function rpBars(rows, colors, labels){
  // rows: [{y, a, b}] 두 계열 막대 (a=개업, b=폐업)
  const mx = Math.max(1, ...rows.flatMap(r => [r.a, r.b]));
  const H = 120, bw = 18, gw = 70, W = rows.length * gw + 20, now = new Date().getFullYear();
  const bars = rows.map((r, i) => {
    const x = 20 + i * gw, ha = r.a / mx * H, hb = r.b / mx * H;
    return `<rect x="${x}" y="${H - ha + 6}" width="${bw}" height="${Math.max(ha, 1)}" rx="4" fill="${colors[0]}"><title>${r.y}년 ${labels[0]} ${r.a}곳</title></rect>
      <rect x="${x + bw + 2}" y="${H - hb + 6}" width="${bw}" height="${Math.max(hb, 1)}" rx="4" fill="${colors[1]}"><title>${r.y}년 ${labels[1]} ${r.b}곳</title></rect>
      <text x="${x + bw / 2}" y="${H - ha + 1}" font-size="11" text-anchor="middle" fill="#232621">${r.a}</text>
      <text x="${x + bw * 1.5 + 2}" y="${H - hb + 1}" font-size="11" text-anchor="middle" fill="#232621">${r.b}</text>
      <text x="${x + bw + 1}" y="${H + 22}" font-size="12" text-anchor="middle" fill="#6b6f68">${r.y}${r.y === now ? ' (올해)' : ''}</text>`;
  }).join('');
  return `<svg viewBox="0 -14 ${W} ${H + 44}" style="width:100%;max-width:${W * 1.3}px" role="img" aria-label="연도별 ${labels.join('·')}"><line x1="14" x2="${W}" y1="${H + 6}" y2="${H + 6}" stroke="#c9ccc4"/>${bars}</svg>
    <div class="rp-legend"><span><i style="background:${colors[0]};border-radius:2px"></i>${labels[0]}</span><span><i style="background:${colors[1]};border-radius:2px"></i>${labels[1]}</span></div>`;
}
const yrs4 = () => { const n = new Date().getFullYear(); return [n - 3, n - 2, n - 1, n]; };
function rpPop(c){
  const p = RP.pop;
  if (!p) return `<div class="rp-card full"><h3>배후 인구</h3><p class="muted" style="margin:6px 0 0">${RP.popErr ? '인구 자료를 불러오지 못했어요. ' + esc(RP.popErr) : '통계청 인구 자료를 불러오는 중이에요…'}</p></div>`;
  const tot = p.male.reduce((a, b) => a + b, 0) + p.female.reduce((a, b) => a + b, 0) || 1;
  const sh = p.male.map((m, i) => (m + p.female[i]) / tot * 100);
  const mx = Math.max(...p.male, ...p.female, 1);
  const s = p.sgg || {};
  const onePct = pct(p.one, p.households), sggOne = pct(s.one, s.households);
  const top2 = sh.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 2).map(x => AGE_L[x[1]]);
  const row = (l, a, b, note) => `<tr><td>${l}</td><td class="num"><b>${a}</b></td><td class="num muted">${b}</td>${note != null ? `<td>${note}</td>` : '<td></td>'}</tr>`;
  return `<div class="rp-card full"><h3>배후 인구 — 반경 ${c.radius >= 1000 ? '1km' : c.radius + 'm'}</h3><p class="src">통계청 SGIS 인구총조사 ${p.year}년 · 반경 안 집계구 ${p.areas}곳 합계(집계구 중심점 기준) · 비교는 ${esc(s.name || '시군구')} 전체</p>
    <div class="rp-grid rp-popg">
      <div>
        <div class="rp-pyr" role="img" aria-label="연령·성별 인구">
          <div class="rp-pyr-h"><span>남</span><span></span><span>여</span><span class="num">비중 (시군구)</span></div>
          ${AGE_L.map((l, i) => `<div class="rp-pyr-r${i >= 2 && i <= 4 ? ' key' : ''}"><span class="l"><i style="width:${p.male[i] / mx * 100}%" title="${l} 남 ${nf(p.male[i])}명"></i><em>${nf(p.male[i])}</em></span><span class="c">${l}</span><span class="r"><i style="width:${p.female[i] / mx * 100}%" title="${l} 여 ${nf(p.female[i])}명"></i><em>${nf(p.female[i])}</em></span><span class="num">${pf(sh[i])} <span class="muted">(${pf((s.age_share || [])[i])})</span></span></div>`).join('')}
        </div>
        <div class="rp-legend"><span><i style="background:#2a78d6;border-radius:2px"></i>남</span><span><i style="background:#eb6834;border-radius:2px"></i>여</span><span>굵은 줄: 20~40대(주 고객층)</span></div>
      </div>
      <div><div class="tw"><table class="rp-tbl"><thead><tr><th>항목</th><th class="num">반경 안</th><th class="num">${esc(s.name || '시군구')}</th><th></th></tr></thead><tbody>
        ${row('거주 인구', nf(p.pop) + '명', nf(s.pop) + '명')}
        ${row('평균 나이', (p.avg_age ?? '-') + '세', (s.avg_age ?? '-') + '세', p.avg_age && s.avg_age ? (p.avg_age < s.avg_age - 2 ? '<span class="rp-tag dn">젊음</span>' : p.avg_age > s.avg_age + 2 ? '<span class="rp-tag up">높음</span>' : '<span class="rp-tag">비슷</span>') : '')}
        ${row('20~40대 비중', pf(sh[2] + sh[3] + sh[4]), pf(((s.age_share || [])[2] || 0) + ((s.age_share || [])[3] || 0) + ((s.age_share || [])[4] || 0)))}
        ${row('가구 수', nf(p.households), nf(s.households))}
        ${row('1인 가구 비율', pf(onePct), pf(sggOne), onePct != null && sggOne != null ? (onePct > sggOne + 3 ? '<span class="rp-tag up">많음</span>' : onePct < sggOne - 3 ? '<span class="rp-tag dn">적음</span>' : '<span class="rp-tag">비슷</span>') : '')}
        ${row('종사자(직장인) 수', nf(p.workers) + '명', nf(s.workers) + '명')}
        ${row('사업체 수', nf(p.corps), '-')}
      </tbody></table></div>
      <p class="rp-note" style="margin-top:8px">많은 연령대: <b>${top2.join(', ')}</b>. 종사자 수는 그 지역 사업체에서 일하는 사람 수라 점심 수요를 가늠할 때 봐요.${p.masked ? ` 인구가 아주 적은 집계구 ${p.masked}곳은 통계청이 숫자를 가려서 0으로 계산돼요.` : ''}</p></div>
    </div></div>`;
}
function rpLic(d){
  const L = RP.pop && RP.pop.lic, db = d.db || {};
  const ys = yrs4();
  const prog = L ? L.progress : null;
  if (L && prog >= 100) {
    const rows = ys.map(y => { const r = (L.by_year || []).find(x => x.y === y) || {}; return { y, a: r.opens || 0, b: r.closes || 0 }; });
    const cl = (L.closed || []).slice(0, 15), ty = (L.by_type || []).slice(0, 8);
    return `<div class="rp-card full"><h3>음식점 개업·폐업 흐름 (개인 매장 포함)</h3><p class="src">행정안전부 인허가(일반·휴게음식점) · 2023년 11월 이후 · 반경 안 ${nf(L.n)}건</p>
      <div class="rp-grid rp-fr"><div>${rpBars(rows, ['#2a78d6', '#eb6834'], ['개업', '폐업'])}
        <div class="tw" style="margin-top:8px"><table class="rp-tbl"><thead><tr><th>업태</th><th class="num">개업(영업 중)</th><th class="num">폐업</th></tr></thead><tbody>${ty.map(t => `<tr${/일식/.test(t.typ) ? ' class="hl"' : ''}><td>${esc(t.typ)}</td><td class="num">${nf(t.opens)}</td><td class="num">${nf(t.closes)}</td></tr>`).join('')}</tbody></table></div></div>
        <div class="tw"><table class="rp-tbl"><thead><tr><th>최근 폐업 매장</th><th>업태</th><th>폐업일</th><th class="num">영업 기간</th><th class="num">평수</th><th class="num">거리</th></tr></thead><tbody>
        ${cl.map(x => `<tr${/일식/.test(x.bizstat || '') ? ' class="hl"' : ''}><td>${esc(x.name)}</td><td>${esc(x.bizstat || '-')}</td><td>${esc(x.close_date)}</td><td class="num">${x.yrs != null ? x.yrs + '년' : '-'}</td><td class="num">${x.py ? x.py + '평' : '-'}</td><td class="num">${nf(x.dist)}m</td></tr>`).join('') || '<tr><td colspan="6" class="muted">반경 안에 폐업 기록이 없어요.</td></tr>'}
        </tbody></table></div></div></div>`;
  }
  const ev = db.fr_events || [];
  const rows = ys.map(y => { const r = (db.fr_by_year || []).find(x => x.y === y) || {}; return { y, a: r.opens || 0, b: r.closes || 0 }; });
  return `<div class="rp-card full"><h3>음식점 개업·폐업 흐름</h3><p class="src">지금은 공정위 등록 <b>프랜차이즈 매장만</b> 보여요 · 개인 매장 포함 자료는 수집 중${prog != null ? ` (${prog}%)` : ''}이고, 다 모이면 자동으로 바뀌어요</p>
    <div class="rp-grid rp-fr"><div>${rpBars(rows, ['#2a78d6', '#eb6834'], ['개업', '폐업'])}</div>
      <div class="tw"><table class="rp-tbl"><thead><tr><th>매장</th><th>업종</th><th>개업</th><th>폐업</th><th class="num">거리</th><th class="num">브랜드 월평균매출</th></tr></thead><tbody>
      ${ev.slice(0, 12).map(e => `<tr${/일식/.test(e.ind || '') ? ' class="hl"' : ''}><td>${esc(e.name)}</td><td>${esc(e.ind || '-')}</td><td>${esc(e.open_date || '-')}</td><td>${e.close_date ? '<b style="color:#a8431a">' + esc(e.close_date) + '</b>' : '<span class="muted">영업 중</span>'}</td><td class="num">${nf(e.dist)}m</td><td class="num">${manwon(e.avg_sales)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">반경 안에 잡힌 프랜차이즈 개업·폐업이 없어요.</td></tr>'}
      </tbody></table></div></div></div>`;
}
function rpShow(report){
  $('rp-body').hidden = !report; $('rp-map').hidden = report;
  $('rp-back').hidden = !report; $('rp-print').hidden = !report; $('rp-fresh').hidden = !report;
  $('rp-go').hidden = report;
}
function rpPick(){
  const ok = !!RP.place;
  $('rp-go').disabled = !ok;
  $('rp-pick').innerHTML = ok ? `상담 위치 <b>${esc(RP.place.label || '')}</b> · 반경 ${RP.r >= 1000 ? '1km' : RP.r + 'm'} — 지도에서 핀이 맞는 자리인지 확인해 주세요. 다르면 <b>핀을 끌거나 지도를 눌러</b> 옮기고, 맞으면 <b>분석하기</b>를 눌러요.` : '예비점주님이 알려 준 주소(또는 매장 이름)를 검색해 상담 위치를 골라 주세요. 지도를 눌러서 고를 수도 있어요. (365 상권지도는 옆 <b>상권지도</b> 탭에서 볼 수 있어요)';
}
/* 위치 확인 지도: 네이버 지도(워크스페이스와 같은 키). 핀을 끌거나 지도를 눌러 위치 조정 → 분석하기
   ※ 네이버 클라우드 Maps 앱의 Web 서비스 URL에 https://crm.menyamatsuri.work 가 등록돼 있어야 열림 */
const NAVER_ID = 'timg82m9f5';
const NM = { map: null, el: null, mk: null, circle: null, dots: [], loading: null };
function nmLoad(){
  if (window.naver && naver.maps && naver.maps.Map) return Promise.resolve(true);
  if (NM.loading) return NM.loading;
  NM.loading = new Promise(ok => {
    const s = document.createElement('script');
    s.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=' + NAVER_ID;
    s.onload = () => ok(!!(window.naver && naver.maps && naver.maps.Map));
    s.onerror = () => { NM.loading = null; ok(false); };
    document.head.appendChild(s);
    setTimeout(() => ok(!!(window.naver && naver.maps && naver.maps.Map)), 10000);
  });
  return NM.loading;
}
async function rpMapFrame(fit){
  const box = $('rp-map');
  if (!NM.map || !NM.el || !box.contains(NM.el)) {
    box.innerHTML = '<div class="rp-nmap" style="height:max(520px,calc(100vh - 300px))"></div>';
    NM.el = box.firstChild; NM.map = null; NM.mk = null; NM.circle = null; NM.dots = [];
    const ok = await nmLoad();
    if (!ok) { box.innerHTML = '<div class="ar-empty muted">네이버 지도를 불러오지 못했어요.<br><small>네이버 클라우드 Maps 앱 설정의 Web 서비스 URL에 https://crm.menyamatsuri.work 가 등록돼 있는지 확인해 주세요.<br>지도가 없어도 주소로 고른 위치로 분석하기는 할 수 있어요.</small></div>'; NM.el = null; return; }
    const c = RP.place ? new naver.maps.LatLng(RP.place.lat, RP.place.lng) : new naver.maps.LatLng(36.815, 127.105);
    NM.map = new naver.maps.Map(NM.el, { center: c, zoom: RP.place ? (RP.r >= 1000 ? 15 : 16) : 13, zoomControl: true, zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT }, mapDataControl: false, scaleControl: true });
    naver.maps.Event.addListener(NM.map, 'click', e => rpSetPin(e.coord.lat(), e.coord.lng()));
    fit = true;
  }
  rpDraw(fit);
}
function rpSetPin(lat, lng){
  if (!RP.place) RP.place = { label: '지도에서 고른 위치' };
  RP.place.lat = +(+lat).toFixed(6); RP.place.lng = +(+lng).toFixed(6);
  if (!/위치 조정|지도에서 고른/.test(RP.place.label || '')) RP.place.label = (RP.place.label || '') + ' (위치 조정)';
  RP.data = null; RP.pop = null;
  try { localStorage.setItem('crm-rp', JSON.stringify({ place: RP.place, r: RP.r })); } catch (e) {}
  rpPick(); rpDraw(false);
}
function rpDraw(fit){
  if (!NM.map || !RP.place) return;
  const p = new naver.maps.LatLng(RP.place.lat, RP.place.lng);
  if (!NM.mk) {
    NM.mk = new naver.maps.Marker({ map: NM.map, position: p, draggable: true, title: '상담 위치 (끌어서 옮기기)' });
    naver.maps.Event.addListener(NM.mk, 'dragend', () => { const q = NM.mk.getPosition(); rpSetPin(q.lat(), q.lng()); });
  } else NM.mk.setPosition(p);
  if (!NM.circle) NM.circle = new naver.maps.Circle({ map: NM.map, center: p, radius: RP.r, strokeColor: '#c62429', strokeOpacity: .7, strokeWeight: 2, fillColor: '#c62429', fillOpacity: .06, clickable: false });
  else { NM.circle.setCenter(p); NM.circle.setRadius(RP.r); }
  NM.dots.forEach(x => x.setMap(null)); NM.dots = [];
  const d = RP.data;
  if (d && d.center && Math.abs(d.center.lat - RP.place.lat) < 1e-5 && Math.abs(d.center.lng - RP.place.lng) < 1e-5)
    (d.stores || []).filter(OURS).forEach(s => NM.dots.push(new naver.maps.Circle({ map: NM.map, center: new naver.maps.LatLng(s.la, s.ln), radius: 10, strokeColor: '#fff', strokeWeight: 1, fillColor: '#c62429', fillOpacity: .9, clickable: false })));
  if (fit) { NM.map.setCenter(p); NM.map.setZoom(RP.r >= 1000 ? 15 : 16); }
}
$('rp-go').addEventListener('click', () => rpLoad(false));
$('rp-back').addEventListener('click', () => { rpShow(false); rpMapFrame(); });
function rpSummary(d){
  const p = RP.pop, f = d.food, st = d.stores || [], ours = st.filter(OURS), c = d.center, out = [];
  if (p) {
    const s = p.sgg || {}, dif = p.avg_age && s.avg_age ? +(p.avg_age - s.avg_age).toFixed(1) : null;
    out.push(`반경 안 거주 인구 <b>${nf(p.pop)}명</b>, 평균 <b>${p.avg_age}세</b>${dif != null ? ` (${esc(s.name)}보다 ${Math.abs(dif)}세 ${dif < 0 ? '젊음' : '많음'})` : ''}.`);
    const a = p.male.map((m, i) => m + p.female[i]), tot = a.reduce((x, y) => x + y, 0) || 1, top = a.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]).slice(0, 2).map(x => AGE_L[x[1]]);
    out.push(`많은 연령대는 <b>${top.join('·')}</b>, 1인 가구 <b>${pf(pct(p.one, p.households))}</b>(시군구 ${pf(pct(s.one, s.households))}), 종사자(직장인) <b>${nf(p.workers)}명</b>.`);
  }
  out.push(`음식점 <b>${nf(f.n)}곳</b> — 100m ${nf(f.r100)} · 300m ${nf(f.r300)}${c.radius >= 500 ? ' · 500m ' + nf(f.r500) : ''}. 상가 중 음식점 비중 ${pf(pct(f.n, d.total))}(시군구 ${pf(d.sggTotal ? pct(d.sggFood, d.sggTotal) : null)}).`);
  out.push(`우리 메뉴(면·돈가스·덮밥) 경쟁점 300m 안 <b>${nf(ours.filter(s => s.d <= 300).length)}곳</b>, 반경 전체 <b>${nf(ours.length)}곳</b>${ours[0] ? ` — 가장 가까운 곳 ${esc(ours[0].n)} ${nf(ours[0].d)}m` : ''}.`);
  const L = p && p.lic;
  if (L && L.progress >= 100) { const y = new Date().getFullYear() - 1, r = (L.by_year || []).find(x => x.y === y) || {}; out.push(`작년(${y}) 반경 안 음식점 개업 <b>${nf(r.opens || 0)}곳</b>, 폐업 <b>${nf(r.closes || 0)}곳</b>(개인 매장 포함).`); }
  else { const y = new Date().getFullYear() - 1, r = ((d.db || {}).fr_by_year || []).find(x => x.y === y) || {}; out.push(`작년(${y}) 프랜차이즈 개업 <b>${nf(r.opens || 0)}곳</b>, 폐업 <b>${nf(r.closes || 0)}곳</b>(개인 매장은 수집 중).`); }
  return out;
}
function rpRender(d){
  rpShow(true);
  const c = d.center, f = d.food, db = d.db || {}, sggF = d.sggFood, rr = c.radius >= 1000 ? '1km' : c.radius + 'm', p = RP.pop;
  const st = d.stores || [], ours = st.filter(OURS), jpAll = st.filter(JP);
  const when = (d.cached_at || d.at || '').slice(0, 10), today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const topS = f.scls.slice(0, 12), mxS = Math.max(1, ...topS.map(x => x.n));
  const ftc = (db.ftc_ind || []).slice().sort((a, b) => b.med - a.med);
  const popu = (db.popular || []).slice(0, 10);
  const onePct = p ? pct(p.one, p.households) : null;
  const title = RP.place && RP.place.label ? RP.place.label : (c.sgg + ' ' + c.dong);
  const pg = (n, t, body) => `<section class="rp-page"><div class="rp-ph"><span>${n ? String(n).padStart(2, '0') : ''}</span><h3>${t}</h3><img src="report-logo-dark.png" alt="멘야마쯔리" class="rp-ph-logo"></div>${body}<div class="rp-pf"><b>멘야마쯔리 상권 분석 보고서</b><span>${esc(title)} · 반경 ${rr} · ${esc(today)}</span><em>내부용</em></div></section>`;
  const fl = x => esc(x.f ? (/^\d+$/.test(x.f) ? x.f + '층' : x.f) : '-');
  $('rp-body').innerHTML = `<div class="rp-doc">
  <section class="rp-page rp-cover">
    <div class="rp-cv-hero"><img class="bg" src="report-cover.jpg" alt=""><i class="ov"></i>
      <div class="rp-cv-top"><img class="lg-l" src="report-logo-light.png" alt="멘야마쯔리"><img class="lg-d" src="report-logo-dark.png" alt="멘야마쯔리"><span>내부용 · ${esc(today)}</span></div>
      <div class="rp-cv-ttl"><small>MENYAMATSURI · STORE LOCATION REPORT</small><h1>상권 분석 보고서</h1>
        <p class="rp-cv-addr">${esc(title)}</p><p class="rp-cv-sub">${esc([c.sido, c.sgg, c.dong].filter(Boolean).join(' '))} · 반경 ${rr}</p></div>
    </div>
    <div class="rp-cv-body">
    <div class="rp-kpi">
      <div class="stat"><b>${p ? nf(p.pop) : '…'}</b><span>거주 인구</span><em>${p ? '평균 ' + p.avg_age + '세' : '불러오는 중'}</em></div>
      <div class="stat"><b>${p ? nf(p.workers) : '…'}</b><span>종사자(직장인)</span><em>${p ? '사업체 ' + nf(p.corps) + '곳' : ''}</em></div>
      <div class="stat"><b>${p ? pf(onePct) : '…'}</b><span>1인 가구 비율</span><em>${p ? '시군구 ' + pf(pct(p.sgg.one, p.sgg.households)) : ''}</em></div>
      <div class="stat"><b>${nf(f.n)}</b><span>음식점</span><em>300m 안 ${nf(f.r300)}곳</em></div>
      <div class="stat alert"><b>${nf(ours.filter(s => s.d <= 300).length)} · ${nf(ours.length)}</b><span>우리 메뉴 경쟁점</span><em>300m · ${rr}</em></div>
    </div>
    <div class="rp-sum"><h3>핵심 정리</h3><ul>${rpSummary(d).map(x => `<li>${x}</li>`).join('')}</ul>
      <p class="rp-note">종합 점수·등급은 넣지 않았어요. 아래 지표를 보고 판단해 주세요.</p></div>
    <div class="rp-toc"><b>목차</b><ol><li>배후 인구</li><li>우리 메뉴 경쟁점</li><li>음식점 개업·폐업</li><li>업종 구성</li><li>매출 참고</li><li>주변 음식점 목록 · 자료 출처</li></ol></div>
    <p class="rp-cv-foot"><img src="report-logo-dark.png" alt="">자료 기준 ${esc(when)} · 통계청 SGIS · 소상공인시장진흥공단 · 행정안전부 · 공정거래위원회 · 내부용</p>
    </div>
  </section>
  ${pg(1, '배후 인구', rpPop(c).replace(/^<div class="rp-card full">/, '<div class="rp-card">'))}
  ${pg(2, '우리 메뉴 경쟁점', `<p class="src">일식 면 요리·돈가스·덮밥(소상공인 업종) 또는 상호에 라멘·우동·소바·돈카츠 등이 들어간 곳 · 가까운 순</p>
    <div class="rp-grid rp-fr"><div class="rp-map">${rpMap(d)}</div>
    <div class="tw"><table class="rp-tbl"><thead><tr><th>상호</th><th>세부 업종</th><th>층</th><th class="num">거리</th></tr></thead><tbody>
    ${ours.slice(0, 12).map(x => `<tr class="hl"><td>${esc(x.n)}${x.b ? ' ' + esc(x.b) : ''}</td><td>${esc(x.s || catNm(x.m))}</td><td>${fl(x)}</td><td class="num">${nf(x.d)}m</td></tr>`).join('') || '<tr><td colspan="4" class="muted">반경 안에 우리 메뉴와 직접 겹치는 매장이 없어요.</td></tr>'}
    ${jpAll.filter(s => !OURS(s)).slice(0, 4).map(x => `<tr><td>${esc(x.n)}${x.b ? ' ' + esc(x.b) : ''}</td><td>${esc(x.s || catNm(x.m))}</td><td>${fl(x)}</td><td class="num">${nf(x.d)}m</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="rp-card" style="margin-top:12px"><h3>리뷰 많은 매장</h3><p class="src">네이버 방문자 리뷰 수 · 영업관리 매장 DB(일식·주점 등)에 있는 매장만</p>
    ${popu.length ? `<div class="tw"><table class="rp-tbl"><thead><tr><th>매장</th><th>업종</th><th class="num">리뷰</th><th class="num">거리</th></tr></thead><tbody>${popu.map(x => `<tr><td>${esc(x.name)}${x.branch ? ' ' + esc(x.branch) : ''}${x.is_chain ? ' <span class="rp-tag">체인</span>' : ''}</td><td>${esc(x.cat_s || x.cat_m || '')}</td><td class="num">${nf(x.naver_reviews)}</td><td class="num">${nf(x.dist)}m</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">리뷰 수가 확인된 매장이 아직 없어요.</p>'}</div>`)}
  ${pg(3, '음식점 개업·폐업', rpLic(d).replace(/^<div class="rp-card full"><h3>[^<]*<\/h3>/, '<div class="rp-card">'))}
  ${pg(4, '업종 구성', `<div class="rp-card"><h3>전체 업종 — ${esc(c.sgg)} 평균과 비교</h3><p class="src">소상공인 상가(상권)정보 · 반경 안 상가 ${nf(d.total)}곳 · 차이 = 반경 비중 − 시군구 비중, ±3%p 이상이면 많음/적음</p>${rpCompare(d.lcls, d.total, d.sggTotal, r => r.cd === 'I2')}</div>
    <div class="rp-grid" style="margin-top:12px"><div class="rp-card"><h3>음식점 구성 — 시군구 음식점과 비교</h3><p class="src">음식점 안에서의 비중</p>${rpCompare(f.mcls, f.n, sggF, r => /일식/.test(r.nm))}</div>
    <div class="rp-card"><h3>많은 음식 업종 TOP ${topS.length}</h3><p class="src">소분류 기준</p>${topS.map(x => `<div class="rp-hbar${/일식|돈가스|우동|라멘|덮밥|초밥/.test(x.nm) ? ' hl' : ''}"><span>${esc(x.nm)}</span><span class="tr"><i style="width:${x.n / mxS * 100}%"></i></span><span>${x.n}</span></div>`).join('')}</div></div>`)}
  ${pg(5, '매출 참고', `<div class="rp-card"><h3>업종별 프랜차이즈 평균매출</h3><p class="src">공정위 정보공개서 ${db.ftc_year || ''}년 · 전국 브랜드 기준(이 상권 실적 아님) · 월 환산, 만원</p>
    <div class="tw"><table class="rp-tbl"><thead><tr><th>업종</th><th class="num">브랜드 수</th><th class="num">중앙값</th><th class="num">평균</th></tr></thead><tbody>
    ${ftc.map(x => `<tr${/일식/.test(x.ind) ? ' class="hl"' : ''}><td>${esc(x.ind)}</td><td class="num">${nf(x.n)}</td><td class="num">${manwon(x.med)}</td><td class="num">${manwon(x.avg)}</td></tr>`).join('')}
    </tbody></table></div><p class="rp-note" style="margin-top:8px">이 상권의 실제 카드 매출·유동인구는 소상공인365 <b>상세분석</b> 탭에서 같은 주소로 확인해 주세요.</p></div>`)}
  ${pg(6, '주변 음식점 목록 · 자료 출처', `<div class="rp-card"><h3>가까운 음식점 ${Math.min(st.length, 30)}곳</h3><p class="src">상담 위치에서 가까운 순 · 반경 안 음식점 ${nf(f.n)}곳 중</p>
    <div class="tw"><table class="rp-tbl"><thead><tr><th>상호</th><th>업종</th><th>세부</th><th>층</th><th class="num">거리</th></tr></thead><tbody>
    ${st.slice(0, 30).map(x => `<tr${OURS(x) ? ' class="hl"' : ''}><td>${esc(x.n)}${x.b ? ' ' + esc(x.b) : ''}</td><td>${esc(catNm(x.m))}</td><td>${esc(x.s || '')}</td><td>${fl(x)}</td><td class="num">${nf(x.d)}m</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="rp-card" style="margin-top:12px"><p class="rp-note"><b>자료와 한계</b><br>· 인구·가구·종사자: 통계청 SGIS 인구총조사(집계구 단위, 1년 이상 늦게 반영). 인구가 아주 적은 집계구는 숫자가 가려져요.<br>· 상가 수·업종: 소상공인시장진흥공단 상가(상권)정보(분기 갱신, 폐업 반영이 늦을 수 있음).<br>· 개업·폐업: 행정안전부 인허가(일반·휴게음식점).<br>· 평균매출: 공정거래위원회 정보공개서(브랜드 전국 평균, 이 상권 실적 아님).<br>· 리뷰: 네이버 플레이스(영업관리 DB 매장만).<br>· 유동인구·카드 매출은 공개 자료가 없어 소상공인365 상세분석을 참고해 주세요.</p></div>`)}
  </div>`;
}
$('ar-tabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-t]'); if (!b) return;
  AR.tab = b.dataset.t; try { localStorage.setItem('crm-area-tab', AR.tab); } catch (err) {}
  renderArea();
});
$('ar-key-save').addEventListener('click', async () => {
  const p = {}; document.querySelectorAll('#ar-key-fields input').forEach(i => p[i.dataset.k] = i.value.trim());
  try { AR.keys = await rpc('sbiz_keys_set', { p }) || {}; toast('인증키를 저장했어요.'); $('ar-keys').open = false; $('ar-frame').innerHTML = ''; renderArea(); }
  catch (e) { toast(errMsg(e), true); }
});


