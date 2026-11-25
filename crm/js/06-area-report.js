/* ---------- 상권 리포트 (자체) — 예비점주 입점 상담용 ----------
   area-report : 반경 상가(소상공인 상가정보)·시군구 비교·프랜차이즈 개폐업·공정위 평균매출·네이버 리뷰
   area-pop    : 주소 검색(SGIS) / 반경 인구·연령·가구·1인가구·종사자(SGIS 집계구) + 음식점 인허가 개업·폐업(개인 포함)
                 + 지역 흐름(시군구 인구 추이·산업구조) / { mig: 시군구코드 } 전입·전출(KOSIS)
   종합 점수·등급은 아직 넣지 않음(우리 기준이 정해지면 추가) · 상권 유형은 근거 개수로만 추정(rpType) */
const RP = { place: null, r: 500, data: null, pop: null, popErr: '', mig: null, bld: null, busy: false, more: false, seq: 0 };
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
  const seq = ++RP.seq; RP.busy = true; RP.more = false; RP.data = null; RP.pop = null; RP.popErr = ''; RP.mig = null; RP.bld = null;
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
    // 전입·전출(KOSIS) — 시군구 코드는 상가정보 응답에서 나오므로 그다음에 부름
    if (data.center && data.center.sggCd) SB.functions.invoke('area-pop', { body: { mig: data.center.sggCd } }).then(({ data: m, error: me }) => {
      if (seq !== RP.seq) return;
      RP.mig = me || !m || !m.ok ? { err: errMsg(me || (m && m.error) || '불러오지 못했어요.') } : m;
      if (RP.data) rpRender(RP.data);
    });
    // 건축물대장(상가가 많은 법정동 2곳) — 처음 보는 동은 10~20초 걸림
    const lds = (data.ldongs || []).slice(0, 2).map(x => x.cd).filter(Boolean);
    if (lds.length) SB.functions.invoke('area-pop', { body: { bld: lds } }).then(({ data: m, error: me }) => {
      if (seq !== RP.seq) return;
      RP.bld = me || !m || !m.ok ? { err: errMsg(me || (m && m.error) || '불러오지 못했어요.') } : m;
      if (RP.data) rpRender(RP.data);
    });
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
      <text x="${x + bw / 2}" y="${H - ha + 1}" font-size="11" text-anchor="middle" fill="#232621">${nf(r.a)}</text>
      <text x="${x + bw * 1.5 + 2}" y="${H - hb + 1}" font-size="11" text-anchor="middle" fill="#232621">${nf(r.b)}</text>
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
/* 인구 천 명당 음식점 수 — 반경(집계구 인구)과 시군구(인구총조사) 모두 소상공인 상가정보 음식점 기준 */
function rpPerK(d){
  const p = RP.pop; if (!p) return null;
  const s = p.sgg || {}, k = (a, b) => b > 0 ? a / b * 1000 : null;
  return { r: k(d.food.n, p.pop), s: k(d.sggFood, s.pop), rw: k(d.food.n, p.pop + p.workers), sw: k(d.sggFood, (s.pop || 0) + (s.workers || 0)) };
}
const k1 = v => v == null || !isFinite(v) ? '-' : v.toFixed(1);
function rpPerKCard(d){
  const K = rpPerK(d), s = (RP.pop && RP.pop.sgg) || {};
  if (!K) return `<div class="rp-card"><h3>인구 천 명당 음식점 수</h3><p class="muted" style="margin:6px 0 0">${RP.popErr ? '인구 자료가 없어 계산할 수 없어요.' : '인구 자료를 불러오는 중이에요…'}</p></div>`;
  const ratio = K.r != null && K.s ? K.r / K.s : null;
  const tag = ratio == null ? '' : ratio >= 1.5 ? '<span class="rp-tag up">많음</span>' : ratio <= 0.67 ? '<span class="rp-tag dn">적음</span>' : '<span class="rp-tag">비슷</span>';
  const ratioW = K.rw != null && K.sw ? K.rw / K.sw : null;
  const tagW = ratioW == null ? '' : ratioW >= 1.5 ? '<span class="rp-tag up">많음</span>' : ratioW <= 0.67 ? '<span class="rp-tag dn">적음</span>' : '<span class="rp-tag">비슷</span>';
  return `<div class="rp-card"><h3>인구 천 명당 음식점 수</h3><p class="src">음식점 수(소상공인 상가정보) ÷ 인구(통계청 ${RP.pop.year}년) × 1,000 · 비교는 ${esc(s.name || '시군구')} 전체</p>
    <div class="tw"><table class="rp-tbl"><thead><tr><th>기준</th><th class="num">반경 안</th><th class="num">${esc(s.name || '시군구')}</th><th class="num">배수</th><th></th></tr></thead><tbody>
    <tr class="hl"><td>거주 인구 천 명당</td><td class="num"><b>${k1(K.r)}곳</b></td><td class="num muted">${k1(K.s)}곳</td><td class="num">${ratio != null ? ratio.toFixed(1) + '배' : '-'}</td><td>${tag}</td></tr>
    <tr><td>거주 + 종사자 천 명당</td><td class="num"><b>${k1(K.rw)}곳</b></td><td class="num muted">${k1(K.sw)}곳</td><td class="num">${ratioW != null ? ratioW.toFixed(1) + '배' : '-'}</td><td>${tagW}</td></tr>
    </tbody></table></div>
    <p class="rp-note" style="margin-top:8px">숫자가 높을수록 한 집이 나눠 먹는 수요가 적어요. 상업지·역세권은 거주 인구가 적어 높게 나오니, 직장인이 많은 곳은 <b>거주 + 종사자</b> 기준으로 함께 봐 주세요.</p></div>`;
}
function rpLine(pts, color){
  // pts: [{x, v}] — 인구 추이 선 그래프
  if (!pts.length) return '';
  const W = 640, H = 130, L = 8, R = 8, T = 20, B = 24;
  const vs = pts.map(p => p.v), mn = Math.min(...vs), mx = Math.max(...vs), pad = (mx - mn) * 0.15 || mx * 0.02 || 1;
  const lo = mn - pad, hi = mx + pad, sx = i => L + (pts.length === 1 ? (W - L - R) / 2 : i / (pts.length - 1) * (W - L - R)), sy = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(p.v).toFixed(1)}`).join('');
  const lab = i => i === 0 || i === pts.length - 1 || (pts.length > 6 && i === Math.floor((pts.length - 1) / 2));
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%" role="img" aria-label="연도별 인구"><line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="#c9ccc4"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
    ${pts.map((p, i) => `<circle cx="${sx(i).toFixed(1)}" cy="${sy(p.v).toFixed(1)}" r="${lab(i) ? 4 : 2.8}" fill="${lab(i) ? color : '#fff'}" stroke="${color}" stroke-width="1.5"><title>${p.x}년 ${nf(p.v)}명</title></circle>
      ${lab(i) ? `<text x="${sx(i).toFixed(1)}" y="${(sy(p.v) - 9).toFixed(1)}" font-size="11" text-anchor="${i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}" fill="#232621">${nf(p.v)}</text>` : ''}
      <text x="${sx(i).toFixed(1)}" y="${H - 8}" font-size="11" text-anchor="${i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}" fill="#6b6f68">${String(p.x).slice(2)}</text>`).join('')}</svg>`;
}
const chg = (a, b) => a && b != null ? (b - a) / a * 100 : null;
const pfs = v => v == null || isNaN(v) ? '-' : (v > 0 ? '+' : '') + v.toFixed(1) + '%';
const upDn = v => v == null ? '' : v >= 1 ? '<span class="rp-tag up">증가</span>' : v <= -1 ? '<span class="rp-tag dn">감소</span>' : '<span class="rp-tag">보합</span>';
function rpRegion(c){
  const p = RP.pop, R = p && p.region, s = (p && p.sgg) || {}, nm = esc(s.name || c.sgg || '시군구');
  if (!p) return `<div class="rp-card"><p class="muted" style="margin:0">${RP.popErr ? '통계청 자료를 불러오지 못했어요. ' + esc(RP.popErr) : '통계청 지역 자료를 불러오는 중이에요…'}</p></div>`;
  // 1) 시군구 인구 추이
  const tr = (R && R.trend) || [], last = tr[tr.length - 1], first = tr[0], y5 = tr.find(x => last && x.y === last.y - 5);
  const popCard = tr.length ? `<div class="rp-card"><h3>${nm} 인구 추이</h3><p class="src">통계청 SGIS 인구총조사 ${first.y}~${last.y}년 · 시군구 전체 거주 인구</p>
    <div class="rp-grid rp-fr"><div>${rpLine(tr.map(x => ({ x: x.y, v: x.pop })), '#2a78d6')}</div>
    <div class="tw"><table class="rp-tbl"><thead><tr><th>항목</th><th class="num">${first.y}</th>${y5 && y5 !== first ? `<th class="num">${y5.y}</th>` : ''}<th class="num">${last.y}</th><th class="num">5년 변화</th><th></th></tr></thead><tbody>
      ${[['거주 인구', 'pop', '명'], ['가구 수', 'fam', ''], ['종사자(직장인)', 'workers', '명']].map(([l, k, u]) => { const g = y5 ? chg(y5[k], last[k]) : null; return `<tr${k === 'pop' ? ' class="hl"' : ''}><td>${l}</td><td class="num muted">${nf(first[k])}</td>${y5 && y5 !== first ? `<td class="num muted">${nf(y5[k])}</td>` : ''}<td class="num"><b>${nf(last[k])}${u}</b></td><td class="num">${pfs(g)}</td><td>${upDn(g)}</td></tr>`; }).join('')}
      <tr><td>평균 나이</td><td class="num muted">${first.age ?? '-'}세</td>${y5 && y5 !== first ? `<td class="num muted">${y5.age ?? '-'}세</td>` : ''}<td class="num"><b>${last.age ?? '-'}세</b></td><td class="num">${y5 && y5.age && last.age ? (last.age - y5.age > 0 ? '+' : '') + (last.age - y5.age).toFixed(1) + '세' : '-'}</td><td></td></tr>
    </tbody></table></div></div></div>` : `<div class="rp-card"><h3>${nm} 인구 추이</h3><p class="muted" style="margin:6px 0 0">인구 추이 자료를 불러오지 못했어요.</p></div>`;
  // 2) 전입·전출
  const M = RP.mig;
  let migBody;
  if (!M) migBody = '<p class="muted" style="margin:6px 0 0">전입·전출 자료를 불러오는 중이에요…</p>';
  else if (M.need_key) migBody = '<p class="muted" style="margin:6px 0 0">통계청 KOSIS 인증키를 등록하면 자동으로 채워져요. (Supabase 비밀값 <b>KOSIS_API_KEY</b>)</p>';
  else if (M.err || !(M.years || []).length) migBody = `<p class="muted" style="margin:6px 0 0">전입·전출 자료를 불러오지 못했어요.${M.err ? ' <small>' + esc(M.err) + '</small>' : ''}</p>`;
  else {
    const ys = M.years, part = ys.filter(x => x.months && x.months < 12);
    const net = ys.reduce((a, x) => a + (x.months && x.months < 12 ? 0 : x.net), 0), full = ys.filter(x => !(x.months && x.months < 12)).length;
    migBody = `<div><div class="tw"><table class="rp-tbl"><thead><tr><th>연도</th><th class="num">전입</th><th class="num">전출</th><th class="num">순이동</th></tr></thead><tbody>
      ${ys.map(x => `<tr><td>${x.y}${x.months && x.months < 12 ? ` <small class="muted">(${x.months}개월)</small>` : ''}</td><td class="num">${nf(x.in)}</td><td class="num">${nf(x.out)}</td><td class="num"><b style="color:${x.net > 0 ? '#2a78d6' : x.net < 0 ? '#a8431a' : 'inherit'}">${x.net > 0 ? '+' : ''}${nf(x.net)}</b></td></tr>`).join('')}
      </tbody></table></div>
      <p class="rp-note" style="margin-top:8px">최근 ${full}년 순이동 합계 <b>${net > 0 ? '+' : ''}${nf(net)}명</b> — ${net > 0 ? '들어오는 사람이 더 많아요.' : net < 0 ? '나가는 사람이 더 많아요.' : '들고 나는 사람이 비슷해요.'}${part.length ? ' 올해는 나온 달까지만 더했어요.' : ''}</p></div>`;
  }
  const migNm = M && M.name ? esc(M.name) : nm, cityLv = M && M.code && RP.data && RP.data.center && M.code !== RP.data.center.sggCd;
  const migCard = `<div class="rp-card" style="margin-top:12px"><h3>${migNm} 전입·전출</h3><p class="src">통계청 국내인구이동통계(KOSIS) · ${migNm} 경계를 넘어 들어오고 나간 사람 수(같은 지역 안 이사는 뺌)${cityLv ? ` · 구 단위 자료가 없어 ${migNm} 전체 기준` : ''}</p>${migBody}</div>`;
  // 3) 산업구조 TOP10
  const ind = ((R && R.ind) || []).filter(x => x.corp > 0), tot = ind.reduce((a, x) => a + x.corp, 0), totW = ind.reduce((a, x) => a + x.worker, 0);
  const dTot = ind.reduce((a, x) => a + (x.dcorp || 0), 0), top10 = ind.slice().sort((a, b) => b.corp - a.corp).slice(0, 10);
  const indCard = tot ? `<div class="rp-card" style="margin-top:12px"><h3>${nm} 산업구조 TOP 10</h3><p class="src">통계청 전국사업체조사 ${R.ind_year}년 · 사업체 수 기준 · 오른쪽은 상담 위치가 있는 <b>${esc((p.center && p.center.dong) || '행정동')}</b> 비중과의 차이</p>
    <div class="tw"><table class="rp-tbl"><thead><tr><th>산업</th><th class="num">사업체</th><th class="num">비중</th><th class="num">종사자</th><th class="num">비중</th><th>${esc((p.center && p.center.dong) || '행정동')} − 시군구</th></tr></thead><tbody>
    ${top10.map(x => { const a = pct(x.corp, tot), dg = dTot && x.dcorp != null ? pct(x.dcorp, dTot) - a : null; return `<tr${x.cd === 'I' ? ' class="hl"' : ''}><td>${esc(x.nm)}</td><td class="num">${nf(x.corp)}</td><td class="num">${pf(a)}</td><td class="num">${nf(x.worker)}</td><td class="num muted">${pf(pct(x.worker, totW))}</td><td>${gapCell(dg)}</td></tr>`; }).join('')}
    </tbody></table></div>
    <p class="rp-note" style="margin-top:8px">사업체 ${nf(tot)}곳 · 종사자 ${nf(totW)}명. 종사자가 많은 산업(제조업·보건·교육 등)이 크면 점심·퇴근 수요가 받쳐 줘요.</p></div>` : `<div class="rp-card" style="margin-top:12px"><h3>${nm} 산업구조</h3><p class="muted" style="margin:6px 0 0">사업체 자료를 불러오지 못했어요.</p></div>`;
  return popCard + migCard + indCard;
}
/* 진입 기회 × 생존율 매트릭스
   생존율: 인허가 2023-11-19 이후 개업 코호트, 1년·2년 뒤 영업 중 비율(area-pop lic.surv — 반경 3km · 전국)
   공급: 소상공인 상가정보 음식 중분류 비중(반경) − 시군구 비중 */
const SV_MCLS = { '한식': '한식', '중식': '중식', '일식': '일식', '서양식': '양식', '동남아시아': '외국음식', '기타 외국': '외국음식', '기타 간이': '분식·간편식', '주점': '주점', '비알코올': '카페·디저트' };
function rpSurvRows(d){
  const S = RP.pop && RP.pop.lic && RP.pop.lic.surv; if (!S) return null;
  const nat = Object.fromEntries((S.nat || []).map(x => [x.g, x]));
  const sup = {};
  (d.food.mcls || []).forEach(m => { const g = SV_MCLS[String(m.nm).trim()]; if (!g) return;
    const o = (sup[g] ||= { n: 0, sgg: 0 }); o.n += m.n; o.sgg += m.sgg || 0; });
  const rate = (k, n) => n ? k / n * 100 : null;
  return (S.local || []).filter(l => nat[l.g]).map(l => {
    const N = nat[l.g], h = l.n2 >= 20 ? 2 : 1;
    const loc = h === 2 ? rate(l.k2, l.n2) : rate(l.k1, l.n1), na = h === 2 ? rate(N.k2, N.n2) : rate(N.k1, N.n1);
    const s = sup[l.g], gap = s && d.food.n && d.sggFood ? pct(s.n, d.food.n) - pct(s.sgg, d.sggFood) : null;
    const few = (h === 2 ? l.n2 : l.n1) < 20;
    const hi = loc != null && na != null ? loc >= na : null, lack = gap != null ? gap < 0 : null;
    const q = hi == null || lack == null || few ? null : lack && hi ? 'best' : !lack && hi ? 'stable' : lack && !hi ? 'risk' : 'avoid';
    return { g: l.g, opens: l.opens, l1: rate(l.k1, l.n1), n1: l.n1, l2: rate(l.k2, l.n2), n2: l.n2, a1: rate(N.k1, N.n1), a2: rate(N.k2, N.n2), h, loc, na, gap, few, q };
  });
}
const SV_Q = { best: ['◎ 최적 진입', '공급 부족 + 생존율 높음', '#2f6f4e'], stable: ['○ 안정·경쟁', '공급 충분 + 생존율 높음', '#2a78d6'], risk: ['△ 기회·위험', '공급 부족 + 생존율 낮음', '#d08a1e'], avoid: ['× 주의', '공급 충분 + 생존율 낮음', '#a8431a'] };
function rpSurv(d){
  const rows = rpSurvRows(d);
  if (!rows) return `<div class="rp-card"><p class="muted" style="margin:0">${RP.popErr ? '생존율 자료를 불러오지 못했어요.' : '생존율 자료를 불러오는 중이에요…'}</p></div>`;
  if (!rows.length) return '<div class="rp-card"><p class="muted" style="margin:0">반경 3km 안에 2023년 11월 이후 개업한 음식점이 없어 생존율을 계산할 수 없어요.</p></div>';
  const sv = (v, n) => v == null ? '<span class="muted">-</span>' : `${v.toFixed(1)}%${n != null && n < 20 ? ' <small class="muted">(표본 ' + n + ')</small>' : ''}`;
  const tag = r => r.q ? `<span class="rp-tag" style="border-color:${SV_Q[r.q][2]};color:${SV_Q[r.q][2]}">${SV_Q[r.q][0]}</span>` : '<span class="muted" style="font-size:11px">판단 보류</span>';
  const box = q => { const xs = rows.filter(r => r.q === q); return `<div style="border:1px solid #e3e5df;border-top:3px solid ${SV_Q[q][2]};border-radius:8px;padding:10px 12px;min-height:74px"><b style="color:${SV_Q[q][2]}">${SV_Q[q][0]}</b><div class="muted" style="font-size:11px;margin:2px 0 6px">${SV_Q[q][1]}</div>${xs.length ? xs.map(r => `<div style="font-size:13px${r.g === '일식' ? ';font-weight:700' : ''}">${esc(r.g)} <span class="muted" style="font-size:11px">${r.loc.toFixed(0)}%</span></div>`).join('') : '<div class="muted" style="font-size:12px">해당 없음</div>'}</div>`; };
  return `<div class="rp-card"><h3>업종별 생존율 — 반경 3km vs 전국</h3><p class="src">행정안전부 인허가(일반·휴게음식점) · 2023년 11월 이후 개업한 가게가 1년·2년 뒤에도 영업 중인 비율 · 공급은 반경 ${d.center.radius >= 1000 ? '1km' : d.center.radius + 'm'} 음식점 비중 − 시군구 비중</p>
    <div class="tw"><table class="rp-tbl"><thead><tr><th>업종</th><th class="num">3km 개업</th><th class="num">1년 생존<br><small>3km / 전국</small></th><th class="num">2년 생존<br><small>3km / 전국</small></th><th>공급(반경 − 시군구)</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr${r.g === '일식' ? ' class="hl"' : ''}><td>${esc(r.g)}</td><td class="num">${nf(r.opens)}</td><td class="num">${sv(r.l1, r.n1)} <span class="muted">/ ${r.a1 != null ? r.a1.toFixed(1) + '%' : '-'}</span></td><td class="num">${sv(r.l2, r.n2)} <span class="muted">/ ${r.a2 != null ? r.a2.toFixed(1) + '%' : '-'}</span></td><td>${gapCell(r.gap)}</td><td>${tag(r)}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="rp-card" style="margin-top:12px"><h3>진입 기회 × 생존율 매트릭스</h3><p class="src">공급 부족 = 반경 음식점 중 그 업종 비중이 시군구보다 낮음 · 생존율 높음 = 3km 생존율이 전국 같은 업종 이상(2년 표본이 20곳 미만이면 1년 기준) · 표본 20곳 미만은 판단 보류</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${box('best')}${box('stable')}${box('risk')}${box('avoid')}</div>
    <p class="rp-note" style="margin-top:8px">생존율은 2023년 11월부터 쌓인 인허가 자료라 아직 2년까지만 볼 수 있어요. 폐업 신고가 늦게 들어오는 경우가 있어 실제보다 조금 높게 나올 수 있어요.</p></div>`;
}
/* 교통 접근성 (지하철역·버스정류장 위치) */
const lnNm = s => String(s || '').replace(/^서울\s*도시철도\s*/, '').replace(/^(\S+?)\s*(도시철도|지하철)\s*(\d+호선)$/, '$1$3').trim();
const walk = m => Math.max(1, Math.round(m / 67));   // 도보 시속 4km
function rpTransit(){
  const T = RP.pop && RP.pop.transit, H3 = '<h3>교통 접근성 — 지하철역 · 버스정류장</h3>';
  if (!RP.pop) return `<div class="rp-card" style="margin-top:12px">${H3}<p class="muted" style="margin:6px 0 0">불러오는 중…</p></div>`;
  if (!T) return `<div class="rp-card" style="margin-top:12px">${H3}<p class="muted" style="margin:6px 0 0">교통 자료를 불러오지 못했어요.</p></div>`;
  const rr = T.r >= 1000 ? '1km' : T.r + 'm', st = T.rail_near || [], n0 = st[0], b0 = T.bus_near;
  const grade = !n0 || n0.d > 1000 ? ['역 멀음', '1km 안에 지하철역이 없어요 — 버스·차량 손님 위주', 'bad'] : n0.d <= 500 ? ['역세권', '가장 가까운 역까지 500m 이내', 'good'] : ['역 도보권', '가장 가까운 역까지 500m~1km', 'mid'];
  const kpi = (v, l, e) => `<div class="stat"><b>${v}</b><span>${l}</span><em>${e || ''}</em></div>`;
  return `<div class="rp-card" style="margin-top:12px">${H3}<p class="src">상담 위치에서 직선거리 · 도보 시간은 분당 67m(시속 4km)로 환산 · 지하철: 전국도시철도역사정보 표준데이터 · 버스: 국토교통부 전국 버스정류장 위치정보</p>
    <div class="rp-kpi" style="margin:4px 0 12px">
      ${kpi(n0 ? esc(n0.n) + '역' : '없음', '가장 가까운 지하철역', n0 ? nf(n0.d) + 'm · 도보 ' + walk(n0.d) + '분' : '2km 안에 없음')}
      ${kpi(nf(T.rail_1k) + '곳', '1km 안 지하철역', '노선 ' + nf(T.lines_1k) + '개 · 반경 ' + rr + ' 안 ' + nf(T.rail_r) + '곳')}
      ${kpi(b0 ? nf(b0.d) + 'm' : '-', '가장 가까운 버스정류장', b0 ? esc(b0.n) : '')}
      ${kpi(nf(T.bus_300) + ' · ' + nf(T.bus_500), '버스정류장 수', '300m · 500m 안')}
    </div>
    <div class="rp-grid" style="grid-template-columns:2fr minmax(200px,1fr)"><div class="tw"><table class="rp-tbl"><thead><tr><th>가까운 지하철역</th><th>노선</th><th class="num">거리</th><th class="num">도보</th></tr></thead><tbody>
      ${st.map((x, i) => `<tr${i === 0 ? ' class="hl"' : ''}><td>${esc(x.n)}</td><td>${esc(String(x.l || '').split(',').map(lnNm).join(' · '))}</td><td class="num">${nf(x.d)}m</td><td class="num">${walk(x.d)}분</td></tr>`).join('') || '<tr><td colspan="4" class="muted">2km 안에 지하철역이 없어요.</td></tr>'}
    </tbody></table></div>
    <div style="border-radius:10px;padding:14px 16px;background:${({ good: '#e8f4ec', mid: '#fdf3e2', bad: '#f8e9e7' })[grade[2]]};border:1px solid ${({ good: '#b9dcc4', mid: '#efd3a4', bad: '#e6c1bb' })[grade[2]]}"><b style="display:block;font-size:20px;color:${({ good: '#1f7a43', mid: '#a06212', bad: '#a8372a' })[grade[2]]}">${grade[0]}</b><span style="display:block;margin:4px 0 8px;font-size:13px">${grade[1]}</span><small class="muted" style="font-size:11.5px;line-height:1.5;display:block">참고: 역 500m 안이면 역세권, 1km 안이면 도보권으로 봤어요. 정류장 수는 방향별 정류장을 따로 센 숫자예요.</small></div></div>
    <p class="rp-note" style="margin-top:8px">신분당선·공항철도와 일부 경전철(의정부·용인·김포골드 등)은 공개 역 자료에 아직 없어 빠져 있어요. 버스 자료에는 정류장 위치만 있고 지나가는 노선 수는 없어요.</p></div>`;
}
/* 직장인(국민연금 가입 사업장) · 건물(건축물대장) */
const indNm = s => /BIZ_NO|미존재/.test(s || '') ? '업종 미분류' : String(s || '').replace(/\s+/g, ' ');
const won = v => v == null || !isFinite(v) ? '-' : nf(Math.round(v / 10000)) + '만원';
const annual = (ntc, w) => w > 0 ? ntc / w / 0.09 * 12 : null;   // 당월 고지금액 = 기준소득월액 × 9% → 연봉 역산
function rpWork(d){
  const N = d.nps, nm = cd => ((d.adongs || []).find(x => x.cd === cd) || {}).nm || cd;
  if (!N || !N.ym) return `<div class="rp-card"><h3>직장인구 — 국민연금 가입 사업장</h3><p class="muted" style="margin:6px 0 0">${N && !N.ym ? '국민연금 자료를 처음 불러오는 중이에요. 다 모이면 자동으로 채워져요.' : '국민연금 자료가 아직 없어요.'}</p></div>`;
  const avg = annual(N.ntc, N.workers), net = (N.jnew || 0) - (N.jlost || 0);
  const kpi = (v, l, e) => `<div class="stat"><b>${v}</b><span>${l}</span><em>${e || ''}</em></div>`;
  return `<div class="rp-card"><h3>직장인구 — 국민연금 가입 사업장</h3><p class="src">국민연금공단 ${esc(N.ym)} 기준 · 반경이 걸친 행정동 ${(N.by_dong || []).length}곳(${(N.by_dong || []).map(x => esc(nm(x.cd))).join(', ')}) 전체 합계 · 추정 연봉 = 고지금액 ÷ 9% × 12</p>
    <div class="rp-kpi" style="margin:4px 0 12px">${kpi(nf(N.workers) + '명', '직장인(가입자)', '사업장 ' + nf(N.wkpl) + '곳')}${kpi(won(avg), '추정 평균연봉', '1인당')}${kpi((net > 0 ? '+' : '') + nf(net) + '명', '이번 달 순증', '신규 ' + nf(N.jnew) + ' · 상실 ' + nf(N.jlost))}</div>
    <div class="rp-grid rp-fr"><div class="tw"><table class="rp-tbl"><thead><tr><th>업종 TOP</th><th class="num">직원</th><th class="num">추정 연봉</th></tr></thead><tbody>
      ${(N.by_ind || []).slice(0, 6).map(x => `<tr><td>${esc(indNm(x.nm))}</td><td class="num">${nf(x.workers)}</td><td class="num">${won(annual(x.ntc, x.workers))}</td></tr>`).join('')}</tbody></table></div>
    <div class="tw"><table class="rp-tbl"><thead><tr><th>직원 많은 사업장</th><th>업종</th><th class="num">직원</th></tr></thead><tbody>
      ${(N.top || []).slice(0, 7).map(x => `<tr><td>${esc(x.name)}</td><td>${esc(indNm(x.ind_nm))}</td><td class="num">${nf(x.workers)}</td></tr>`).join('')}</tbody></table></div></div>
    <p class="rp-note" style="margin-top:8px">국민연금에 가입한 사업장 기준이라 아르바이트·자영업자는 빠져요. 지점 직원을 본사 주소로 신고한 회사는 본사가 있는 동에 잡혀요.</p></div>`;
}
function rpBld(d){
  const B = RP.bld, nm = cd => ((d.ldongs || []).find(x => x.cd === cd) || {}).nm || cd;
  if (!B) return '<div class="rp-card" style="margin-top:12px"><h3>건물 구성 — 건축물대장</h3><p class="muted" style="margin:6px 0 0">건축물대장을 불러오는 중이에요… (처음 보는 동은 10~20초)</p></div>';
  if (B.err) return `<div class="rp-card" style="margin-top:12px"><h3>건물 구성 — 건축물대장</h3><p class="muted" style="margin:6px 0 0">건축물대장을 불러오지 못했어요. <small>${esc(B.err)}</small></p></div>`;
  const xs = (B.items || []).filter(x => x && x.n);
  if (!xs.length) return '<div class="rp-card" style="margin-top:12px"><h3>건물 구성 — 건축물대장</h3><p class="muted" style="margin:6px 0 0">건물 자료가 없어요.</p></div>';
  return xs.map((x, i) => {
    const mx = Math.max(1, ...(x.purps || []).map(p => p.n));
    return `<div class="rp-card" style="margin-top:12px"><h3>건물 구성 — ${esc(nm(x.ldong))}${i === 0 ? ' (상담 위치 주변 상가가 가장 많은 동)' : ''}</h3><p class="src">국토교통부 건축물대장(표제부, 주건축물) · 법정동 전체 ${nf(x.n)}동${x.capped ? ' · 건물이 많아 4,000동까지만 집계' : ''}</p>
      <div class="rp-grid rp-fr"><div>${(x.purps || []).slice(0, 8).map(p => `<div class="rp-hbar${/근린생활|판매/.test(p.nm) ? ' hl' : ''}"><span>${esc(p.nm)}</span><span class="tr"><i style="width:${p.n / mx * 100}%"></i></span><span>${pf(pct(p.n, x.n))}</span></div>`).join('')}</div>
      <div class="tw"><table class="rp-tbl"><tbody>
        <tr><td>평균 지상 층수</td><td class="num"><b>${x.avgFlr ?? '-'}층</b></td></tr>
        <tr><td>10층 이상 건물</td><td class="num">${nf(x.tall)}동 <span class="muted">(${pf(pct(x.tall, x.n))})</span></td></tr>
        <tr><td>준공 20년 이상</td><td class="num">${nf(x.old20)}동 <span class="muted">(${pf(pct(x.old20, x.ageN))})</span></td></tr>
        <tr><td>최근 5년 신축</td><td class="num">${nf(x.new5)}동 <span class="muted">(${pf(pct(x.new5, x.ageN))})</span></td></tr>
        <tr class="hl"><td>주거 세대 수</td><td class="num"><b>${nf(x.hhld)}세대</b></td></tr>
      </tbody></table></div></div></div>`;
  }).join('') + '<p class="rp-note" style="margin-top:8px">근린생활시설(1·2종)은 음식점·카페·학원 같은 동네 상가 건물이에요. 오래된 건물이 많으면 임대료가 낮은 대신 시설 보수가 필요할 수 있고, 최근 신축이 많으면 새 아파트·상가가 들어서는 성장 지역일 가능성이 높아요.</p>';
}
/* 상권 유형 판정(추정) — 이미 불러온 자료(인구·상가·교통·국민연금·건축물대장)를 시군구 평균과 견줘
   유형별 근거가 몇 개 맞는지 셈. 자료가 없는 근거는 빼고 셈. 가장 많이 맞은 유형(절반 이상, 2개 이상)을 고름 */
/* 상권 유형 화면 스타일 (이 기능 전용이라 여기서 넣음) */
document.head.insertAdjacentHTML('beforeend', '<style id="rp-ty-css">.rp-ty-box{border:1px solid var(--line);border-radius:12px;padding:16px 20px;background:#f6f7f4}.rp-ty-box .nm{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}.rp-ty-box .nm>b{font-size:26px;letter-spacing:-.02em;line-height:1.25}.rp-ty-box .nm span{font-size:13px;color:var(--sub);display:inline-flex;align-items:center;gap:6px}.rp-ty-box p{margin:8px 0 0;font-size:14px;line-height:1.65}.rp-ty-dots{display:inline-flex;gap:3px}.rp-ty-dots i{width:8px;height:8px;border-radius:50%;background:#d6d8d2}.rp-ty-dots i.on{background:#1c211e}.rp-ty-hits{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.rp-ty-hits span{font-size:12px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:3px 10px}.rp-ty-comp{margin-top:12px}.rp-ty-comp .lb{display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px}.rp-ty-comp .lb span{color:var(--sub)}.rp-ty-comp .rp-ty-seg{display:flex;height:22px;border-radius:6px;overflow:hidden;background:#f0f1ec}.rp-ty-comp .rp-ty-seg i{display:flex;align-items:center;padding:0 8px;color:#fff;font-style:normal;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden}.rp-ty-comp .rp-ty-seg.sm{height:8px;margin:6px 0 3px}.rp-ty-comp small{font-size:11.5px}.rp-ty-sum{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13px;margin-bottom:8px}.rp-cv-type{display:inline-flex;align-items:center;gap:8px;margin:12px 0 0 16px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.45);border-radius:999px;padding:4px 12px 4px 6px;font-size:13px}.rp-cv-type i{font-style:normal;font-size:11px;background:#fff;color:#1c211e;border-radius:999px;padding:1px 8px;font-weight:600}</style>');
const TY = {
  home:  { nm: '주거 상권', c: '#2f6f4e', bg: '#e8f4ec', desc: '아파트·주택 배후의 생활 상권이에요. 주민 고정 수요가 있어 매출이 꾸준한 편이고, 저녁·주말과 배달·포장 손님이 중심이에요. 평일 점심은 약할 수 있어요.' },
  office:{ nm: '오피스 상권', c: '#2a78d6', bg: '#eaf2fc', desc: '사는 사람보다 일하는 사람이 많은 업무 상권이에요. 평일 점심 회전이 매출의 핵심이고, 주말·공휴일에는 손님이 크게 줄 수 있어요.' },
  univ:  { nm: '대학가·청년 상권', c: '#7a4fc9', bg: '#f1ebfb', desc: '20대와 1인 가구가 많은 상권이에요. 가격에 민감하고 혼밥 손님이 많으며, 방학에는 매출이 줄 수 있어요.' },
  night: { nm: '번화가·역세권 상권', c: '#c62429', bg: '#fbeceb', desc: '음식점·술집이 몰려 있어 밖에서 찾아오는 손님이 많은 상권이에요. 저녁·주말 수요가 크지만 임대료와 경쟁도 높은 편이에요.' },
  ind:   { nm: '산업단지 상권', c: '#a06212', bg: '#fdf3e2', desc: '공장 근무자가 많은 상권이에요. 평일 점심과 퇴근 후 회식 수요가 크고, 주말은 약하며 구내식당과 경쟁해요.' },
};
function rpType(d){
  const p = RP.pop, s = (p && p.sgg) || {}, T = p && p.transit, N = d.nps, B = (RP.bld && !RP.bld.err && (RP.bld.items || []).filter(x => x && x.n)) || [];
  const ev = [];
  const add = (ty, ok, label, v, ref) => { if (ok != null) ev.push({ ty, ok: !!ok, label, v, ref }); };   // ok == null → 자료 없음, 뺌
  const lc = cd => { const r = (d.lcls || []).find(x => x.cd === cd); return r ? { a: pct(r.n, d.total), b: r.sgg != null && d.sggTotal ? pct(r.sgg, d.sggTotal) : null } : { a: 0, b: null }; };
  const mc = re => { const r = (d.food.mcls || []).filter(x => re.test(x.nm)); const n = r.reduce((a, x) => a + x.n, 0), g = r.reduce((a, x) => a + (x.sgg || 0), 0); return { a: pct(n, d.food.n), b: d.sggFood && r.length && r.every(x => x.sgg != null) ? pct(g, d.sggFood) : null }; };
  const pp = v => v == null ? '-' : v.toFixed(1) + '%', sg = v => '시군구 ' + pp(v);
  if (p && p.pop) {
    const tot = p.male.reduce((a, b) => a + b, 0) + p.female.reduce((a, b) => a + b, 0) || 1, sh = i => (p.male[i] + p.female[i]) / tot * 100;
    const sa = s.age_share || [], kid = sh(0) + sh(1), kidS = sa.length ? sa[0] + sa[1] : null, y20 = sh(2), y20S = sa.length ? sa[2] : null;
    const one = pct(p.one, p.households), oneS = pct(s.one, s.households);
    const ws = p.workers / p.pop, wsS = s.pop ? s.workers / s.pop : null;
    add('home', kidS == null ? null : kid >= kidS + 3, '0~19세 비중', pp(kid), sg(kidS) + ' +3%p 이상');
    add('home', oneS == null ? null : one <= oneS, '1인 가구 비율', pp(one), sg(oneS) + ' 이하');
    add('home', wsS == null ? null : ws <= wsS * 0.6, '종사자 ÷ 거주 인구', ws.toFixed(2) + '배', '시군구 ' + (wsS == null ? '-' : wsS.toFixed(2)) + '배의 60% 이하');
    add('univ', y20S == null ? null : y20 >= y20S + 6, '20대 비중', pp(y20), sg(y20S) + ' +6%p 이상');
    add('univ', oneS == null ? null : one >= oneS + 10, '1인 가구 비율', pp(one), sg(oneS) + ' +10%p 이상');
    add('office', wsS == null ? null : ws >= Math.max(1, wsS * 1.5), '종사자 ÷ 거주 인구', ws.toFixed(2) + '배', '1배 이상 · 시군구의 1.5배 이상');
  }
  if (d.total) {
    const e = lc('P1'), m = lc('M1'), f = lc('I2'), h = lc('I1'), pub = mc(/주점/);
    add('home', e.b == null ? null : e.a >= e.b + 4, '상가 중 학원(교육) 비중', pp(e.a), sg(e.b) + ' +4%p 이상');
    add('office', m.b == null ? null : m.a >= m.b + 3, '상가 중 사무실(과학·기술) 비중', pp(m.a), sg(m.b) + ' +3%p 이상');
    add('night', f.b == null ? null : f.a >= f.b + 5, '상가 중 음식점 비중', pp(f.a), sg(f.b) + ' +5%p 이상');
    add('night', pub.b == null ? null : pub.a >= pub.b + 3, '음식점 중 주점 비중', pp(pub.a), sg(pub.b) + ' +3%p 이상');
    add('night', h.b == null ? null : h.a > h.b && h.a >= 1, '상가 중 숙박 비중', pp(h.a), sg(h.b) + ' 초과 · 1% 이상');
    add('ind', pub.b == null ? null : pub.a >= pub.b + 3, '음식점 중 주점 비중(회식)', pp(pub.a), sg(pub.b) + ' +3%p 이상');
  }
  if (T) { const n0 = (T.rail_near || [])[0]; add('night', !!(n0 && n0.d <= 500), '가장 가까운 지하철역', n0 ? esc(n0.n) + '역 ' + nf(n0.d) + 'm' : '2km 안 없음', '500m 이내'); }
  const K = p ? rpPerK(d) : null;
  if (K && K.rw != null && K.sw) add('night', K.rw >= K.sw * 1.5, '거주+종사자 천 명당 음식점', k1(K.rw) + '곳', '시군구 ' + k1(K.sw) + '곳의 1.5배 이상');
  if (N && N.ym && N.workers) {
    const mf = (N.by_ind || []).filter(x => /제조업/.test(x.nm || '')).reduce((a, x) => a + x.workers, 0), mfp = pct(mf, N.workers);
    add('ind', mfp >= 30, '직장인 중 제조업(국민연금)', pp(mfp), '30% 이상');
    const uni = (N.top || []).find(x => /대학교|학교법인/.test(x.name || '') && x.workers >= 200);
    add('univ', !!uni, '행정동 안 대학교(국민연금)', uni ? esc(uni.name) : '없음', '직원 200명 이상');
    add('office', N.workers >= 10000 && mfp < 30, '행정동 사무직 직장인(국민연금)', nf(N.workers) + '명', '1만 명 이상 · 제조업 30% 미만');
  }
  if (B.length) {
    const n = B.reduce((a, x) => a + x.n, 0), cnt = re => B.reduce((a, x) => a + (x.purps || []).filter(q => re.test(q.nm)).reduce((b, q) => b + q.n, 0), 0);
    const hm = pct(cnt(/주택/), n), of = pct(cnt(/업무시설/), n), fc = pct(cnt(/공장|창고/), n), tl = pct(B.reduce((a, x) => a + (x.tall || 0), 0), n);
    add('home', hm >= 50, '건물 중 주택 비중', pp(hm), '50% 이상');
    add('office', of >= 8 || tl >= 15, '업무시설 · 10층 이상 건물 비중', pp(of) + ' · ' + pp(tl), '8% 또는 15% 이상');
    add('ind', fc >= 20, '건물 중 공장·창고 비중', pp(fc), '20% 이상');
  }
  const rank = Object.keys(TY).map(k => { const e = ev.filter(x => x.ty === k), m = e.filter(x => x.ok).length; return { k, ...TY[k], m, n: e.length, r: e.length ? m / e.length : 0 }; })
    .sort((a, b) => b.r - a.r || b.m - a.m);
  const ok = x => x && x.m >= 2 && x.r >= 0.5;
  const top = ok(rank[0]) ? rank[0] : null, sec = top && ok(rank[1]) ? rank[1] : null;
  return { rank, top, sec, ev };
}
const tyName = R => R.top ? R.top.nm + (R.sec ? ' + ' + R.sec.nm.replace(' 상권', '') : '') : '혼합형 상권';
const tyDots = x => `<span class="rp-ty-dots">${'<i class="on"></i>'.repeat(x.m)}${'<i></i>'.repeat(x.n - x.m)}</span>`;
/* 1쪽 맨 위: 유형 + 설명 + 맞은 근거 + 거주·직장인 구성 */
function rpTypeCard(d){
  const H3 = '<h3>상권 유형 <span class="rp-tag">추정</span></h3>';
  if (!RP.pop) return `<div class="rp-card">${H3}<p class="muted" style="margin:6px 0 0">${RP.popErr ? '인구 자료가 없어 판정할 수 없어요.' : '자료를 불러오는 중이에요…'}</p></div>`;
  const R = rpType(d), t = R.top, p = RP.pop, s = p.sgg || {};
  const hits = t ? R.ev.filter(e => e.ty === t.k && e.ok).concat(R.sec ? R.ev.filter(e => e.ty === R.sec.k && e.ok) : []) : [];
  const desc = t ? t.desc + (R.sec ? ' ' + R.sec.nm.replace(' 상권', '') + ' 성격도 함께 보여요.' : '') : '어느 한 유형의 근거도 절반 이상 맞지 않았어요. 여러 성격이 섞인 상권이라 시간대별 수요가 고른 편일 수 있어요.';
  const live = p.pop, work = p.workers, all = live + work || 1, sl = s.pop || 0, sw = s.workers || 0, sa = sl + sw || 1;
  const comp = `<div class="rp-ty-comp"><div class="lb"><b>반경 안 거주·직장인 구성</b><span>거주 ${nf(live)}명 · 종사자 ${nf(work)}명</span></div>
    <div class="rp-ty-seg"><i style="width:${live / all * 100}%;background:#2f6f4e">거주 ${Math.round(live / all * 100)}%</i><i style="width:${work / all * 100}%;background:#2a78d6">직장인 ${Math.round(work / all * 100)}%</i></div>
    ${sl ? `<div class="rp-ty-seg sm"><i style="width:${sl / sa * 100}%;background:#9cc3ad"></i><i style="width:${sw / sa * 100}%;background:#9fc0ea"></i></div><small class="muted">${esc(s.name || '시군구')} 전체: 거주 ${Math.round(sl / sa * 100)}% · 직장인 ${Math.round(sw / sa * 100)}%</small>` : ''}</div>`;
  return `<div class="rp-card">${H3}<p class="src">인구(통계청) · 상가(소상공인) · 교통 · 직장인(국민연금) · 건물(건축물대장)을 시군구 평균과 견줘 판정한 추정 · 판정 근거는 9쪽</p>
    <div class="rp-ty-box" style="${t ? `background:${t.bg};border-color:${t.c}55` : ''}">
      <div class="nm"><b style="${t ? 'color:' + t.c : ''}">${esc(tyName(R))}</b>${t ? `<span>근거 ${t.n}개 중 <b>${t.m}개</b> 해당 ${tyDots(t)}</span>` : ''}</div>
      <p>${desc}</p>
      ${hits.length ? `<div class="rp-ty-hits">${hits.map(e => `<span>${esc(e.label)} <b>${e.v}</b></span>`).join('')}</div>` : ''}
    </div>${comp}</div>`;
}
/* 9쪽: 판정 근거 전체 */
function rpTypeEv(d){
  if (!RP.pop) return '';
  const R = rpType(d), ord = R.rank.map(x => x.k);
  const evs = R.ev.slice().sort((a, b) => ord.indexOf(a.ty) - ord.indexOf(b.ty) || b.ok - a.ok);
  return `<div class="rp-card" style="margin-top:12px"><h3>상권 유형 판정 근거</h3><p class="src">유형마다 근거가 몇 개 맞는지 셈 · 자료가 없는 근거는 뺌 · 절반 이상, 2개 이상 맞은 유형 중 가장 높은 것으로 판정(2등도 같은 조건이면 함께 표시)</p>
    <div class="rp-ty-sum">${R.rank.map(x => `<span><b style="color:${x.c}">${esc(x.nm.replace(' 상권', ''))}</b> ${x.n ? x.m + '/' + x.n : '자료 없음'}</span>`).join('')}</div>
    <div class="tw"><table class="rp-tbl"><thead><tr><th>유형</th><th>근거</th><th class="num">이 상권</th><th>기준</th><th class="num">해당</th></tr></thead><tbody>
    ${evs.map(e => `<tr${e.ok ? ' class="hl"' : ''}><td><span style="color:${TY[e.ty].c};font-weight:600">${esc(TY[e.ty].nm.replace(' 상권', ''))}</span></td><td>${esc(e.label)}</td><td class="num">${e.v}</td><td class="muted">${e.ref}</td><td class="num">${e.ok ? '<b>✓</b>' : '<span class="muted">–</span>'}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="rp-note" style="margin-top:8px">기준선은 내부에서 정한 참고값이라 실제와 다를 수 있어요. 지하철 승하차·시간대 매출 자료는 아직 없어 빠져 있어요(365 상세분석 참고). 대학교는 국민연금 직원 200명 이상인 경우만 잡혀요.</p></div>`;
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
  if (p) { const R = rpType(d); out.push(`상권 유형(추정) <b>${esc(tyName(R))}</b>${R.top ? ` — 근거 ${R.top.n}개 중 ${R.top.m}개 해당` : ''}.`); }
  if (p) {
    const s = p.sgg || {}, dif = p.avg_age && s.avg_age ? +(p.avg_age - s.avg_age).toFixed(1) : null;
    out.push(`반경 안 거주 인구 <b>${nf(p.pop)}명</b>, 평균 <b>${p.avg_age}세</b>${dif != null ? ` (${esc(s.name)}보다 ${Math.abs(dif)}세 ${dif < 0 ? '젊음' : '많음'})` : ''}.`);
    const a = p.male.map((m, i) => m + p.female[i]), tot = a.reduce((x, y) => x + y, 0) || 1, top = a.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]).slice(0, 2).map(x => AGE_L[x[1]]);
    out.push(`많은 연령대는 <b>${top.join('·')}</b>, 1인 가구 <b>${pf(pct(p.one, p.households))}</b>(시군구 ${pf(pct(s.one, s.households))}), 종사자(직장인) <b>${nf(p.workers)}명</b>.`);
  }
  out.push(`음식점 <b>${nf(f.n)}곳</b> — 100m ${nf(f.r100)} · 300m ${nf(f.r300)}${c.radius >= 500 ? ' · 500m ' + nf(f.r500) : ''}. 상가 중 음식점 비중 ${pf(pct(f.n, d.total))}(시군구 ${pf(d.sggTotal ? pct(d.sggFood, d.sggTotal) : null)}).`);
  out.push(`우리 메뉴(면·돈가스·덮밥) 경쟁점 300m 안 <b>${nf(ours.filter(s => s.d <= 300).length)}곳</b>, 반경 전체 <b>${nf(ours.length)}곳</b>${ours[0] ? ` — 가장 가까운 곳 ${esc(ours[0].n)} ${nf(ours[0].d)}m` : ''}.`);
  const T = p && p.transit, t0 = T && (T.rail_near || [])[0];
  if (T) out.push(`가장 가까운 지하철역 ${t0 ? `<b>${esc(t0.n)}역</b>(${esc(String(t0.l || '').split(',').map(lnNm).join('·'))}) <b>${nf(t0.d)}m</b>, 도보 ${walk(t0.d)}분` : '<b>2km 안에 없음</b>'} · 500m 안 버스정류장 <b>${nf(T.bus_500)}곳</b>.`);
  if (d.nps && d.nps.ym) out.push(`반경이 걸친 행정동 직장인 <b>${nf(d.nps.workers)}명</b>(국민연금 ${esc(d.nps.ym)}), 추정 평균연봉 <b>${won(annual(d.nps.ntc, d.nps.workers))}</b>.`);
  const K = rpPerK(d);
  if (K && K.r != null) out.push(`인구 천 명당 음식점 <b>${k1(K.r)}곳</b>(${esc((p.sgg || {}).name || '시군구')} ${k1(K.s)}곳)${K.s ? ` — 시군구 평균의 <b>${(K.r / K.s).toFixed(1)}배</b>` : ''}.`);
  const tr = p && p.region && p.region.trend || [], tl = tr[tr.length - 1], t5 = tl && tr.find(x => x.y === tl.y - 5);
  if (tl && t5) { const g = chg(t5.pop, tl.pop); out.push(`${esc((p.sgg || {}).name || '시군구')} 인구는 5년 전보다 <b>${pfs(g)}</b>(${nf(t5.pop)} → ${nf(tl.pop)}명)${RP.mig && (RP.mig.years || []).length ? `, 최근 순이동 ${(() => { const y = RP.mig.years.filter(x => !(x.months && x.months < 12)).slice(-1)[0]; return y ? `${y.y}년 <b>${y.net > 0 ? '+' : ''}${nf(y.net)}명</b>` : '-'; })()}` : ''}.`); }
  const SR = rpSurvRows(d), jp = SR && SR.find(r => r.g === '일식');
  if (jp && jp.loc != null) out.push(`일식 ${jp.h}년 생존율(반경 3km) <b>${jp.loc.toFixed(1)}%</b> — 전국 ${jp.na != null ? jp.na.toFixed(1) + '%' : '-'}${jp.q ? `, 판정 <b>${SV_Q[jp.q][0]}</b>` : jp.few ? ' (표본 적음)' : ''}.`);
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
        <p class="rp-cv-addr">${esc(title)}</p><p class="rp-cv-sub">${esc([c.sido, c.sgg, c.dong].filter(Boolean).join(' '))} · 반경 ${rr}</p>${p ? `<span class="rp-cv-type"><i>상권 유형 · 추정</i>${esc(tyName(rpType(d)))}</span>` : ''}</div>
    </div>
    <div class="rp-cv-body">
    <div class="rp-kpi">
      <div class="stat"><b>${p ? nf(p.pop) : '…'}</b><span>거주 인구</span><em>${p ? '평균 ' + p.avg_age + '세' : '불러오는 중'}</em></div>
      <div class="stat"><b>${p ? nf(p.workers) : '…'}</b><span>종사자(직장인)</span><em>${p ? '사업체 ' + nf(p.corps) + '곳' : ''}</em></div>
      <div class="stat"><b>${p ? pf(onePct) : '…'}</b><span>1인 가구 비율</span><em>${p ? '시군구 ' + pf(pct(p.sgg.one, p.sgg.households)) : ''}</em></div>
      <div class="stat"><b>${nf(f.n)}</b><span>음식점</span><em>${(() => { const K = rpPerK(d); return K && K.r != null ? '인구 천 명당 ' + k1(K.r) + '곳' : '300m 안 ' + nf(f.r300) + '곳'; })()}</em></div>
      <div class="stat alert"><b>${nf(ours.filter(s => s.d <= 300).length)} · ${nf(ours.length)}</b><span>우리 메뉴 경쟁점</span><em>300m · ${rr}</em></div>
    </div>
    <div class="rp-sum"><h3>핵심 정리</h3><ul>${rpSummary(d).map(x => `<li>${x}</li>`).join('')}</ul>
      <p class="rp-note">종합 점수·등급은 넣지 않았어요. 아래 지표를 보고 판단해 주세요.</p></div>
    <div class="rp-toc"><b>목차</b><ol><li>상권 유형 · 배후 인구 · 교통</li><li>직장인구 · 건물</li><li>지역 흐름</li><li>우리 메뉴 경쟁점</li><li>음식점 개업·폐업</li><li>업종 구성</li><li>매출 참고</li><li>진입 판단 — 업종별 생존율</li><li>주변 음식점 목록 · 자료 출처</li></ol></div>
    <p class="rp-cv-foot"><img src="report-logo-dark.png" alt="">자료 기준 ${esc(when)} · 통계청 · 소상공인시장진흥공단 · 행정안전부 · 국민연금공단 · 국토교통부 · 공정거래위원회 · 내부용</p>
    </div>
  </section>
  ${pg(1, '상권 유형 · 배후 인구 · 교통', rpTypeCard(d) + rpPop(c).replace(/^<div class="rp-card full">/, '<div class="rp-card" style="margin-top:18px">') + rpTransit())}
  ${pg(2, '직장인구 · 건물', rpWork(d) + rpBld(d))}
  ${pg(3, '지역 흐름 — 인구 추이 · 전입·전출 · 산업구조', rpRegion(c))}
  ${pg(4, '우리 메뉴 경쟁점', `<p class="src">일식 면 요리·돈가스·덮밥(소상공인 업종) 또는 상호에 라멘·우동·소바·돈카츠 등이 들어간 곳 · 가까운 순</p>
    <div class="rp-grid rp-fr"><div class="rp-map">${rpMap(d)}</div>
    <div class="tw"><table class="rp-tbl"><thead><tr><th>상호</th><th>세부 업종</th><th>층</th><th class="num">거리</th></tr></thead><tbody>
    ${ours.slice(0, 12).map(x => `<tr class="hl"><td>${esc(x.n)}${x.b ? ' ' + esc(x.b) : ''}</td><td>${esc(x.s || catNm(x.m))}</td><td>${fl(x)}</td><td class="num">${nf(x.d)}m</td></tr>`).join('') || '<tr><td colspan="4" class="muted">반경 안에 우리 메뉴와 직접 겹치는 매장이 없어요.</td></tr>'}
    ${jpAll.filter(s => !OURS(s)).slice(0, 4).map(x => `<tr><td>${esc(x.n)}${x.b ? ' ' + esc(x.b) : ''}</td><td>${esc(x.s || catNm(x.m))}</td><td>${fl(x)}</td><td class="num">${nf(x.d)}m</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="rp-card" style="margin-top:12px"><h3>리뷰 많은 매장</h3><p class="src">네이버 방문자 리뷰 수 · 영업관리 매장 DB(일식·주점 등)에 있는 매장만</p>
    ${popu.length ? `<div class="tw"><table class="rp-tbl"><thead><tr><th>매장</th><th>업종</th><th class="num">리뷰</th><th class="num">거리</th></tr></thead><tbody>${popu.map(x => `<tr><td>${esc(x.name)}${x.branch ? ' ' + esc(x.branch) : ''}${x.is_chain ? ' <span class="rp-tag">체인</span>' : ''}</td><td>${esc(x.cat_s || x.cat_m || '')}</td><td class="num">${nf(x.naver_reviews)}</td><td class="num">${nf(x.dist)}m</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">리뷰 수가 확인된 매장이 아직 없어요.</p>'}</div>`)}
  ${pg(5, '음식점 개업·폐업', rpLic(d).replace(/^<div class="rp-card full"><h3>[^<]*<\/h3>/, '<div class="rp-card">'))}
  ${pg(6, '업종 구성', `${rpPerKCard(d)}<div class="rp-card" style="margin-top:12px"><h3>전체 업종 — ${esc(c.sgg)} 평균과 비교</h3><p class="src">소상공인 상가(상권)정보 · 반경 안 상가 ${nf(d.total)}곳 · 차이 = 반경 비중 − 시군구 비중, ±3%p 이상이면 많음/적음</p>${rpCompare(d.lcls, d.total, d.sggTotal, r => r.cd === 'I2')}</div>
    <div class="rp-grid" style="margin-top:12px"><div class="rp-card"><h3>음식점 구성 — 시군구 음식점과 비교</h3><p class="src">음식점 안에서의 비중</p>${rpCompare(f.mcls, f.n, sggF, r => /일식/.test(r.nm))}</div>
    <div class="rp-card"><h3>많은 음식 업종 TOP ${topS.length}</h3><p class="src">소분류 기준</p>${topS.map(x => `<div class="rp-hbar${/일식|돈가스|우동|라멘|덮밥|초밥/.test(x.nm) ? ' hl' : ''}"><span>${esc(x.nm)}</span><span class="tr"><i style="width:${x.n / mxS * 100}%"></i></span><span>${x.n}</span></div>`).join('')}</div></div>`)}
  ${pg(7, '매출 참고', `<div class="rp-card"><h3>업종별 프랜차이즈 평균매출</h3><p class="src">공정위 정보공개서 ${db.ftc_year || ''}년 · 전국 브랜드 기준(이 상권 실적 아님) · 월 환산, 만원</p>
    <div class="tw"><table class="rp-tbl"><thead><tr><th>업종</th><th class="num">브랜드 수</th><th class="num">중앙값</th><th class="num">평균</th></tr></thead><tbody>
    ${ftc.map(x => `<tr${/일식/.test(x.ind) ? ' class="hl"' : ''}><td>${esc(x.ind)}</td><td class="num">${nf(x.n)}</td><td class="num">${manwon(x.med)}</td><td class="num">${manwon(x.avg)}</td></tr>`).join('')}
    </tbody></table></div><p class="rp-note" style="margin-top:8px">이 상권의 실제 카드 매출·유동인구는 소상공인365 <b>상세분석</b> 탭에서 같은 주소로 확인해 주세요.</p></div>`)}
  ${pg(8, '진입 판단 — 업종별 생존율', rpSurv(d))}
  ${pg(9, '주변 음식점 목록 · 자료 출처', `<div class="rp-card"><h3>가까운 음식점 ${Math.min(st.length, 30)}곳</h3><p class="src">상담 위치에서 가까운 순 · 반경 안 음식점 ${nf(f.n)}곳 중</p>
    <div class="tw"><table class="rp-tbl"><thead><tr><th>상호</th><th>업종</th><th>세부</th><th>층</th><th class="num">거리</th></tr></thead><tbody>
    ${st.slice(0, 30).map(x => `<tr${OURS(x) ? ' class="hl"' : ''}><td>${esc(x.n)}${x.b ? ' ' + esc(x.b) : ''}</td><td>${esc(catNm(x.m))}</td><td>${esc(x.s || '')}</td><td>${fl(x)}</td><td class="num">${nf(x.d)}m</td></tr>`).join('')}
    </tbody></table></div></div>
    ${rpTypeEv(d)}
    <div class="rp-card" style="margin-top:12px"><p class="rp-note"><b>자료와 한계</b><br>· 인구·가구·종사자: 통계청 SGIS 인구총조사(집계구 단위, 1년 이상 늦게 반영). 인구가 아주 적은 집계구는 숫자가 가려져요.<br>· 지역 흐름: 시군구 인구 추이(SGIS 인구총조사), 전입·전출(통계청 국내인구이동통계, KOSIS), 산업구조(통계청 전국사업체조사).<br>· 직장인·추정 연봉: 국민연금공단 가입 사업장 내역(월 갱신, 행정동 단위). 건물: 국토교통부 건축물대장(법정동 단위).<br>· 교통: 전국도시철도역사정보 표준데이터(+인천교통공사), 국토교통부 전국 버스정류장 위치정보(월 갱신). 직선거리 기준.<br>· 상가 수·업종: 소상공인시장진흥공단 상가(상권)정보(분기 갱신, 폐업 반영이 늦을 수 있음).<br>· 개업·폐업·생존율: 행정안전부 인허가(일반·휴게음식점). 생존율은 2023년 11월 이후 개업분 기준.<br>· 평균매출: 공정거래위원회 정보공개서(브랜드 전국 평균, 이 상권 실적 아님).<br>· 리뷰: 네이버 플레이스(영업관리 DB 매장만).<br>· 유동인구·카드 매출은 공개 자료가 없어 소상공인365 상세분석을 참고해 주세요.</p></div>`)}
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
