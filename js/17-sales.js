
/* ---------- 매출 관리: N오더(VD) 매장별 매출 조회 ---------- */
let SALES = {stores:[],rows:[]}; // {stores:[], rows:[[date, storeIdx, bills, total, disc, net, card, cash]]}
// 2026-11-19: 직영점(쌍용·불당)은 '직영점 매출 조회'(55-direct-sales)로 따로 봄 → 여기는 가맹점만
const S_DIRECT = name => /쌍용|불당/.test(String(name || ''));
const S_FC = i => !S_DIRECT(SALES.stores[i]);
PATHS.chart = 'M3 21h18 M6 17v-5 M11 17V7 M16 17v-8 M21 17V4';
let S_MIN = SALES.rows.length ? SALES.rows[0][0] : '', S_MAX = SALES.rows.length ? SALES.rows[SALES.rows.length-1][0] : '';
const sDow = d => '일월화수목금토'[new Date(d + 'T00:00:00').getDay()];
function sRange(k){
  const m = S_MAX.slice(0,7);
  if (k === 'cur') return [m + '-01', S_MAX];
  if (k === 'prev') { const p = ymAdd(m, -1); return [p + '-01', p + '-' + String(new Date(+p.slice(0,4), +p.slice(5,7), 0).getDate()).padStart(2,'0')]; }
  if (k === 'q3') return [ymAdd(m, -2) + '-01', S_MAX];
  if (k === 'year') return [S_MAX.slice(0,4) + '-01-01', S_MAX];
  return [S_MIN, S_MAX];
}
function ymAdd(ym, k){ let y = +ym.slice(0,4), mo = +ym.slice(5,7) + k; while (mo < 1) { mo += 12; y--; } while (mo > 12) { mo -= 12; y++; } return y + '-' + String(mo).padStart(2,'0'); }
function setSRange(k){ const [a, b] = sRange(k); document.getElementById('d1').value = a; document.getElementById('d2').value = b; runSales(); }
function pageSales(){
  const [a, b] = sRange('cur');
  const upd = META.salesUpdated ? META.salesUpdated + ' 업데이트' : S_MAX + '까지';
  document.getElementById('main').innerHTML = simpleHero(['매출 관리','가맹점 매출 조회'], 'N오더 · 이지포스 · SALES REPORT', '가맹점 매출 조회', '가맹점 포스 매출을 기간·매장별로 확인하세요. 금액은 순매출(할인 뺀 금액) 기준이에요. 쌍용점·불당점은 직영점 매출 조회에서 봐요.') +
  `<div class="data-note"><span class="status-dot"></span><span>N오더 · 이지포스 자동 수집 · ${S_MIN} ~ ${S_MAX} · ${upd}</span><span class="tag">가맹점</span></div>
  <section class="card query-card"><div class="section-title"><strong>${ic('filter')}조회 조건</strong></div>
   <div class="filters">
    <div class="f"><label for="d1">영업일</label><div class="daterow"><input type="date" id="d1" value="${a}" min="${S_MIN}" max="${S_MAX}"><span>~</span><input type="date" id="d2" value="${b}" min="${S_MIN}" max="${S_MAX}"></div></div>
    <div class="f"><label for="s-st">매장 선택</label><select id="s-st"><option value="">전체 가맹점</option>${SALES.stores.map((s, i) => S_FC(i) ? `<option value="${i}">${esc(s)}</option>` : '').join('')}</select></div>
    <div class="f"><label>보기 방식</label>${segHtml('sview',[['day','일별'],['month','월별'],['store','매장별']])}</div>
   </div>
   <div class="s-quick">${[['cur','이번 달'],['prev','지난 달'],['q3','최근 3개월'],['year','올해'],['all','전체']].map(([k,t]) => `<button class="btn ghost" onclick="setSRange('${k}')">${t}</button>`).join('')}</div>
   <div class="actions"><span class="filter-hint">${ic('info')}이지포스 매장은 총매출·순매출만 들어와요. 영수건수·카드·현금은 N오더 매장만 있어 객단가도 N오더 매장 기준이에요.</span><button class="btn ghost" onclick="pageSales()">${ic('reset')}초기화</button><button class="btn primary" onclick="runSales()">${ic('search')}조회</button></div>
  </section><div id="res"></div>` + pageFoot();
  document.querySelectorAll('#sview button').forEach(btn => btn.addEventListener('click', () => setTimeout(runSales, 0)));
  runSales();
}
function runSales(){
  const a = document.getElementById('d1').value, b = document.getElementById('d2').value, st = document.getElementById('s-st').value, view = segVal('sview');
  const rows = SALES.rows.filter(r => r[0] >= a && r[0] <= b && (st === '' ? S_FC(r[1]) : r[1] === +st));
  const T = rows.reduce((s, r) => { s.bills += r[2]; s.bnet += r[2] ? r[5] : 0; s.total += r[3]; s.disc += r[4]; s.net += r[5]; s.card += r[6]; s.cash += r[7]; return s; }, {bills:0,bnet:0,total:0,disc:0,net:0,card:0,cash:0});
  const days = new Set(rows.map(r => r[0])).size;
  const stIdx = st === '' ? [...new Set(rows.map(r => r[1]))].sort((x, y) => x - y) : [+st];
  let head, body, html;
  if (view === 'store') {
    const g = {}; rows.forEach(r => { const o = g[r[1]] || (g[r[1]] = {days:new Set(),bills:0,total:0,disc:0,net:0,card:0,cash:0}); o.days.add(r[0]); o.bills += r[2]; o.total += r[3]; o.disc += r[4]; o.net += r[5]; o.card += r[6]; o.cash += r[7]; });
    const list = Object.entries(g).map(([k, o]) => ({k: SALES.stores[k], ...o})).sort((x, y) => y.net - x.net);
    const max = Math.max(1, ...list.map(o => o.net));
    head = ['매장','영업일수','영수건수','총매출','할인금액','순매출','객단가','비중','카드','현금'];
    body = list.map(o => [o.k, o.days.size, o.bills, o.total, o.disc, o.net, o.bills ? Math.round(o.net / o.bills) : 0, T.net ? (o.net / T.net * 100).toFixed(1) + '%' : '0%', o.card, o.cash]);
    html = `<table><thead><tr><th>매장</th><th class="n">영업일수</th><th class="n">영수건수</th><th class="n">총매출</th><th class="n">할인</th><th>순매출</th><th class="n">객단가</th><th class="n">비중</th><th class="n">카드</th><th class="n">현금</th></tr></thead><tbody>${list.map((o, i) => `<tr><td><b>${esc(o.k)}</b></td><td class="n">${o.days.size}일</td><td class="n">${o.bills ? fmt(o.bills) : '-'}</td><td class="n">${fmt(o.total)}</td><td class="n">${fmt(o.disc)}</td><td><span class="bar" style="width:${Math.max(2, o.net / max * 160)}px"></span>${fmt(o.net)}</td><td class="n">${body[i][6] ? fmt(body[i][6]) : '-'}</td><td class="n">${body[i][7]}</td><td class="n">${fmt(o.card)}</td><td class="n">${fmt(o.cash)}</td></tr>`).join('')}</tbody></table>`;
  } else {
    const keyOf = r => view === 'month' ? r[0].slice(0,7) : r[0];
    const g = {}; rows.forEach(r => { const k = keyOf(r); const o = g[k] || (g[k] = {by:{}, bills:0, bnet:0, net:0, total:0, disc:0}); o.by[r[1]] = (o.by[r[1]] || 0) + r[5]; o.bills += r[2]; o.bnet += r[2] ? r[5] : 0; o.net += r[5]; o.total += r[3]; o.disc += r[4]; });
    const keys = Object.keys(g).sort().reverse();
    const max = Math.max(1, ...keys.map(k => g[k].net));
    const lab = k => view === 'month' ? k.replace('-', '년 ') + '월' : k.slice(5).replace('-', '/') + ' (' + sDow(k) + ')';
    const multi = stIdx.length > 1;
    head = [view === 'month' ? '월' : '날짜', ...(multi ? stIdx.map(i => SALES.stores[i]) : []), '순매출 합계', '영수건수', '객단가', '총매출', '할인금액'];
    body = keys.map(k => { const o = g[k]; return [view === 'month' ? k : k, ...(multi ? stIdx.map(i => o.by[i] || 0) : []), o.net, o.bills, o.bills ? Math.round(o.bnet / o.bills) : 0, o.total, o.disc]; });
    html = `<table><thead><tr><th>${head[0]}</th>${multi ? stIdx.map(i => `<th class="n">${esc(SALES.stores[i])}</th>`).join('') : ''}<th>순매출 합계</th><th class="n">영수건수</th><th class="n">객단가</th><th class="n">할인</th></tr></thead><tbody>${keys.map(k => { const o = g[k]; const we = view === 'day' && /[토일]/.test(sDow(k)); return `<tr><td class="${we ? 's-we' : ''}">${lab(k)}</td>${multi ? stIdx.map(i => `<td class="n">${o.by[i] ? fmt(o.by[i]) : '-'}</td>`).join('') : ''}<td><span class="bar" style="width:${Math.max(2, o.net / max * 140)}px"></span><b>${fmt(o.net)}</b></td><td class="n">${o.bills ? fmt(o.bills) : '-'}</td><td class="n">${o.bills ? fmt(o.bnet / o.bills) : '-'}</td><td class="n">${fmt(o.disc)}</td></tr>`; }).join('')}</tbody></table>`;
  }
  LAST = { head, body };
  const unit = view === 'store' ? '개 매장' : view === 'month' ? '개월' : '일';
  document.getElementById('res').innerHTML = `
   <div class="sum period"><div class="k hl"><div class="l">${ic('coin')}순매출</div><div class="v">${fmt(T.net)}<small>원</small></div></div>
   <div class="k"><div class="l">${ic('file')}영수건수</div><div class="v">${fmt(T.bills)}<small>건</small></div></div>
   <div class="k"><div class="l">${ic('store')}객단가</div><div class="v">${T.bills ? fmt(T.bnet / T.bills) : '-'}<small>원</small></div></div>
   <div class="k"><div class="l">${ic('clock')}하루 평균</div><div class="v">${days ? fmt(T.net / days) : 0}<small>원 · ${days}일</small></div></div></div>
   <div class="card"><div class="meta"><div class="left"><strong>${view === 'store' ? '매장별' : view === 'month' ? '월별' : '일별'} 매출</strong><span class="count">${body.length}${unit}</span></div><button class="btn ghost" onclick="dlCsv('가맹점_매출')">${ic('download')}CSV 다운로드</button></div>
   ${body.length ? `<div class="tbl-wrap">${html}</div>` : '<div class="empty">조건에 맞는 매출이 없어요.</div>'}</div>`;
}
(function(){
  const st = document.createElement('style');
  st.textContent = '.s-quick{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 12px}.s-quick .btn{padding:6px 12px;font-size:12px}td.s-we{color:#c8102e}';
  document.head.appendChild(st);
})();
// 메뉴: 제때 관리 아래에 "매출 관리" 추가 (가맹점 / 직영점 두 줄)
const renderSideSales = renderSide;
renderSide = function(active){
  renderSideSales(active);
  const btn = [...document.querySelectorAll('#side .cat')].find(b => b.textContent.includes('제때 관리'));
  if (!btn) return;
  const anchor = btn.nextElementSibling && btn.nextElementSibling.classList.contains('sub') ? btn.nextElementSibling : btn;
  const open = active === 'sales-report' || active === 'direct-sales';
  anchor.insertAdjacentHTML('afterend', `<button class="cat ${open?'open':''}" onclick="const on=this.classList.toggle('open');this.nextElementSibling.classList.toggle('open',on)">${ic('chart')}매출 관리${ic('chevron').replace('class="icon"','class="icon ar"')}</button><div class="sub ${open?'open':''}"><a role="button" tabindex="0" class="${active==='sales-report'?'on':''}" onclick="go('sales-report')">가맹점 매출 조회</a><a role="button" tabindex="0" class="${active==='direct-sales'?'on':''}" onclick="go('direct-sales')">직영점 매출 조회</a></div>`);
};
const goSales = go;
go = function(p, t){ if (p === 'sales-report') { closeSide(); renderSide(p); pageSales(); window.scrollTo(0,0); return; } return goSales(p, t); };
