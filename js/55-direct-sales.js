/* ==========================================================
   직영점 매출 조회 (2026-11-19) — 매출 관리 > 직영점 매출 조회
   - 매출 메뉴를 가맹점 매출 조회(17-sales, 쌍용·불당 뺌) / 직영점 매출 조회(이 파일)로 나눔
   - 매장: 쌍용점 · 불당점 / 탭: 매출 조회 · 배달 정산
   - 매출 조회: 기간을 골라 일별·월별로 봄
       쌍용점 = 홀·포장(포스) + 배달 순매출(인프라D 결제금액 + 배민 포장 − 마일리지 차감 전부)
       불당점 = 홀·포장(포스)만 (배달 자료 연결 안 됨)
   - 배달 정산 탭: 예전 '배달 매출' 화면(54-delivery-sales)을 그대로 탭 안에 그림. 쌍용점 · 관리자·본사만
   - 대시보드 '직영점 매출 조회 →' 는 window.DS_STORE / DS_TAB 를 정해 두고 go('direct-sales')
   ========================================================== */
(function(){
  const PAGE = 'direct-sales', DV_STORE_ID = 1;
  const STORES = [['sv', '쌍용점', /쌍용/], ['bd', '불당점', /불당/]];
  const won = n => Math.round(n || 0).toLocaleString('ko-KR');
  const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const dow = d => '일월화수목금토'[new Date(d + 'T00:00:00').getDay()];
  const md = d => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
  const ymAddL = (ym, k) => { let y = +ym.slice(0, 4), m = +ym.slice(5, 7) + k; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return y + '-' + String(m).padStart(2, '0'); };
  const lastDay = ym => ym + '-' + String(new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate()).padStart(2, '0');
  const canSales = () => !window.mmCan || mmCan('sales');
  const canDv = () => !!(window.dvCan && dvCan());
  const DS = { store: 'sv', tab: 'sales', a: '', b: '', view: 'day', dv: null, dvKey: '' };

  const st = document.createElement('style');
  st.textContent = `
  .ds-bar{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:0 0 16px}
  .ds-bar .seg{min-width:200px}
  .ds-bar .seg button{font-size:12px;padding:7px 16px}
  .ds-cov{font-size:11px;color:var(--sub);margin:-6px 0 14px;line-height:1.8}
  .ds-cov b{color:var(--ink);font-weight:600}
  .ds-sub{font-size:10px;color:var(--sub);margin-top:6px;white-space:normal;line-height:1.6}
  .ds-t td.minus{color:#c62429}
  .ds-t td.na{color:#b4bba8}
  td.ds-we{color:#c8102e}
  `;
  document.head.appendChild(st);

  // ---------- 데이터 ----------
  let SALES_AT_DS = 0;
  async function loadSalesDs(){
    if (SALES.rows.length && SALES_AT_DS && Date.now() - SALES_AT_DS < 30 * 60e3) return;
    if (SALES.rows.length && !SALES_AT_DS) { SALES_AT_DS = Date.now(); return; }   // 대시보드·가맹점 화면이 이미 받아 둠
    const { data, error } = await window.SB.rpc('sales_data'); if (error) throw error;
    Object.assign(META, data.meta || {});
    SALES = data.sales || { stores: [], rows: [] };
    S_MIN = SALES.rows.length ? SALES.rows[0][0] : ''; S_MAX = SALES.rows.length ? SALES.rows[SALES.rows.length - 1][0] : '';
    SALES_AT_DS = Date.now();
  }
  async function loadDv(a, b){
    const key = a + '~' + b + '@' + (window.DV_DASH_AT || 0);
    if (DS.dv && DS.dvKey === key) return DS.dv;
    const { data, error } = await window.SB.rpc('delivery_data', { p_store: DV_STORE_ID, p_from: a, p_to: b });
    if (error) throw error;
    DS.dv = data || { days: [] }; DS.dvKey = key;
    return DS.dv;
  }
  const storeIdx = code => { const s = STORES.find(x => x[0] === code); return s ? (SALES.stores || []).findIndex(n => s[2].test(n)) : -1; };
  const storeName = code => (STORES.find(x => x[0] === code) || [])[1] || '';

  function range(k){
    const t = kst(), ym = t.slice(0, 7);
    if (k === 'prev') { const p = ymAddL(ym, -1); return [p + '-01', lastDay(p)]; }
    if (k === 'q3') return [ymAddL(ym, -2) + '-01', t];
    if (k === 'year') return [t.slice(0, 4) + '-01-01', t];
    return [ym + '-01', t];
  }

  // ---------- 화면 ----------
  function page(){
    if (!STORES.some(s => s[0] === DS.store)) DS.store = 'sv';
    if (DS.tab === 'dv' && !(DS.store === 'sv' && canDv())) DS.tab = 'sales';
    const tabs = [['sales', '매출 조회']].concat(DS.store === 'sv' && canDv() ? [['dv', '배달 정산']] : []);
    const seg = (id, opts, cur, fn) => `<div class="seg" id="${id}" role="group">${opts.map(([k, t]) => `<button class="${k === cur ? 'on' : ''}" aria-pressed="${k === cur}" onclick="${fn}('${k}')">${t}</button>`).join('')}</div>`;
    document.getElementById('main').innerHTML = simpleHero(['매출 관리', '직영점 매출 조회'], 'DIRECT STORES · SALES', '직영점 매출 조회',
      '쌍용점·불당점 매출을 기간별로 봐요. 쌍용점은 홀·포장에 배달 순매출(배민 포장 포함, 수수료 뺀 금액)까지 합쳐서 보여 줘요.') +
      `<div class="ds-bar">${seg('ds-store', STORES.map(s => [s[0], s[1]]), DS.store, 'dsStore')}${tabs.length > 1 ? seg('ds-tab', tabs, DS.tab, 'dsTab') : ''}</div>
      <div id="ds-body"></div>` + pageFoot();
    const body = document.getElementById('ds-body');
    if (DS.tab === 'dv') { window.dvRender(body); return; }
    if (!DS.a) [DS.a, DS.b] = range('cur');
    body.innerHTML = `<section class="card query-card"><div class="section-title"><strong>${ic('filter')}조회 조건 · ${storeName(DS.store)}</strong></div>
      <div class="filters">
        <div class="f"><label for="d1">영업일</label><div class="daterow"><input type="date" id="d1" value="${DS.a}"><span>~</span><input type="date" id="d2" value="${DS.b}"></div></div>
        <div class="f"><label>보기 방식</label><div class="seg" id="ds-view">${[['day', '일별'], ['month', '월별']].map(([k, t]) => `<button class="${DS.view === k ? 'on' : ''}" onclick="dsView('${k}')">${t}</button>`).join('')}</div></div>
      </div>
      <div class="s-quick">${[['cur', '이번 달'], ['prev', '지난 달'], ['q3', '최근 3개월'], ['year', '올해']].map(([k, t]) => `<button class="btn ghost" onclick="dsRange('${k}')">${t}</button>`).join('')}</div>
      <div class="actions"><span class="filter-hint">${ic('info')}${DS.store === 'sv' ? '홀·포장은 포스 순매출, 배달은 인프라D 자료와 배민 포장을 올린 날까지 들어가요.' : '불당점은 포스(홀·포장) 매출만 있어요.'}</span><button class="btn ghost" onclick="dsRange('cur')">${ic('reset')}초기화</button><button class="btn primary" onclick="dsRun()">${ic('search')}조회</button></div>
    </section><div id="res"><div class="card"><div class="empty">불러오는 중...</div></div></div>`;
    run();
  }

  async function run(){
    const res = document.getElementById('res'); if (!res) return;
    const d1 = document.getElementById('d1'), d2 = document.getElementById('d2');
    let a = d1.value, b = d2.value; if (a && b && a > b) [a, b] = [b, a];
    if (!a || !b) { res.innerHTML = '<div class="card"><div class="empty">기간을 골라 주세요.</div></div>'; return; }
    DS.a = a; DS.b = b;
    const code = DS.store, my = (DS.seq = (DS.seq || 0) + 1);
    let dv = null, dvErr = '';
    try {
      const jobs = [loadSalesDs()];
      if (code === 'sv') jobs.push(loadDv(a, b).then(x => { dv = x; }).catch(e => { dvErr = (e && e.message) || '불러오지 못했어요'; }));
      await Promise.all(jobs);
    } catch (e) { if (my === DS.seq) res.innerHTML = `<div class="card"><div class="empty">매출을 불러오지 못했어요. ${esc((e && e.message) || '')}</div></div>`; return; }
    if (my !== DS.seq || !document.getElementById('res')) return;
    draw(a, b, dv, dvErr);
  }

  function draw(a, b, dv, dvErr){
    const res = document.getElementById('res'), code = DS.store, idx = storeIdx(code), name = storeName(code);
    if (idx < 0) { res.innerHTML = `<div class="card"><div class="empty">매출 데이터에서 ${name}을 찾지 못했어요.</div></div>`; LAST = null; return; }
    const withDv = code === 'sv';
    // 날짜별로 모음
    const g = {}, at = d => g[d] || (g[d] = { hall: 0, bills: 0, hasHall: false, n: 0, sales: 0, hasOrd: false, pick: 0, pickN: 0, hasPick: false, fee: 0, hasLed: false });
    let lastHall = '';
    SALES.rows.forEach(r => { if (r[1] !== idx || r[0] < a || r[0] > b) return; const o = at(r[0]); o.hall += r[5]; o.bills += r[2]; o.hasHall = true; if (r[0] > lastHall) lastHall = r[0]; });
    let bal = null;
    if (withDv && dv) (dv.days || []).forEach(x => {
      if (x.d < a || x.d > b) return;
      const o = at(x.d);
      if (x.hasOrders) { o.hasOrd = true; o.sales += x.sales || 0; o.n += x.n || 0; }
      if (x.hasLedger) { o.hasLed = true; o.fee += (x.usedCall || 0) + (x.usedOther || 0); }
      if (x.hasPickup) { o.hasPick = true; o.pick += x.pick || 0; o.pickN += x.pickN || 0; }
      if (x.balance != null) bal = { d: x.d, v: x.balance };
    });
    const net = o => o.sales + o.pick - o.fee;
    const month = DS.view === 'month';
    const groups = {};
    Object.keys(g).forEach(d => {
      const k = month ? d.slice(0, 7) : d, o = g[d];
      const t = groups[k] || (groups[k] = { hall: 0, bills: 0, hasHall: false, n: 0, sales: 0, hasOrd: false, pick: 0, pickN: 0, hasPick: false, fee: 0, hasLed: false, days: 0 });
      ['hall', 'bills', 'n', 'sales', 'pick', 'pickN', 'fee'].forEach(f => { t[f] += o[f]; });
      ['hasHall', 'hasOrd', 'hasPick', 'hasLed'].forEach(f => { t[f] = t[f] || o[f]; });
      t.days++;
    });
    const keys = Object.keys(groups).sort().reverse();
    const T = Object.values(g).reduce((s, o) => { s.hall += o.hall; s.bills += o.bills; s.n += o.n; s.sales += o.sales; s.pick += o.pick; s.pickN += o.pickN; s.fee += o.fee; return s; }, { hall: 0, bills: 0, n: 0, sales: 0, pick: 0, pickN: 0, fee: 0 });
    const tNet = net(T), tAll = T.hall + (withDv ? tNet : 0), days = Object.keys(g).length;
    const lab = k => month ? k.replace('-', '년 ') + '월' : `${md(k)} (${dow(k)})`;
    const cell = (on, v, cls = '') => on ? `<td class="n ${cls}">${v}</td>` : '<td class="n na">-</td>';
    let head, body, html;
    if (withDv) {
      head = [month ? '월' : '날짜', '홀·포장', '영수건수', '배달 건수', '배달 총매출', '배민 포장 건수', '배민 포장', '배달 수수료', '배달 순매출', '합계'];
      body = keys.map(k => { const o = groups[k]; return [k, o.hall, o.bills, o.n, o.sales, o.pickN, o.pick, -o.fee, net(o), o.hall + net(o)]; });
      html = `<table class="ds-t"><thead><tr><th>${head[0]}</th><th class="n">홀·포장</th><th class="n">배달 총매출</th><th class="n">배민 포장</th><th class="n">배달 수수료</th><th class="n">배달 순매출</th><th class="n">합계</th></tr></thead><tbody>${keys.map(k => {
        const o = groups[k], we = !month && /[토일]/.test(dow(k)), anyDv = o.hasOrd || o.hasPick || o.hasLed;
        return `<tr><td class="${we ? 'ds-we' : ''}">${lab(k)}</td>${cell(o.hasHall, won(o.hall))}${cell(o.hasOrd, `${won(o.sales)}<span class="ds-sub"> · ${o.n}건</span>`)}${cell(o.hasPick, o.pickN ? `${won(o.pick)}<span class="ds-sub"> · ${o.pickN}건</span>` : '0')}${cell(o.hasLed, o.fee ? '−' + won(o.fee) : '0', 'minus')}${cell(anyDv, won(net(o)))}<td class="n"><b>${won(o.hall + net(o))}</b></td></tr>`;
      }).join('')}</tbody><tfoot><tr><td>합계</td><td class="n">${won(T.hall)}</td><td class="n">${won(T.sales)}</td><td class="n">${won(T.pick)}</td><td class="n">−${won(T.fee)}</td><td class="n">${won(tNet)}</td><td class="n">${won(tAll)}</td></tr></tfoot></table>`;
    } else {
      head = [month ? '월' : '날짜', '홀·포장 순매출', '영수건수', '객단가'];
      body = keys.map(k => { const o = groups[k]; return [k, o.hall, o.bills, o.bills ? Math.round(o.hall / o.bills) : 0]; });
      html = `<table class="ds-t"><thead><tr><th>${head[0]}</th><th class="n">홀·포장 순매출</th><th class="n">영수건수</th><th class="n">객단가</th></tr></thead><tbody>${keys.map(k => {
        const o = groups[k], we = !month && /[토일]/.test(dow(k));
        return `<tr><td class="${we ? 'ds-we' : ''}">${lab(k)}</td><td class="n"><b>${won(o.hall)}</b></td><td class="n">${o.bills ? won(o.bills) : '-'}</td><td class="n">${o.bills ? won(o.hall / o.bills) : '-'}</td></tr>`;
      }).join('')}</tbody><tfoot><tr><td>합계</td><td class="n">${won(T.hall)}</td><td class="n">${T.bills ? won(T.bills) : '-'}</td><td class="n">${T.bills ? won(T.hall / T.bills) : '-'}</td></tr></tfoot></table>`;
    }
    LAST = { head, body };
    // 어디까지 들어왔는지
    let cov = `홀·포장 <b>${lastHall ? md(lastHall) : '-'}</b>까지`;
    if (withDv) {
      if (dvErr) cov += ` · 배달 자료를 불러오지 못했어요 (${esc(dvErr)})`;
      else {
        const last = f => Object.keys(g).filter(d => g[d][f]).sort().pop();
        const lo = last('hasOrd'), ll = last('hasLed'), lp = last('hasPick');
        cov += ` · 배달 주문 <b>${lo ? md(lo) : '-'}</b> · 적립금 <b>${ll ? md(ll) : '-'}</b> · 배민 포장 <b>${lp ? md(lp) : '-'}</b>까지`;
        if (bal) cov += ` · 마일리지 잔액 <b>${won(bal.v)}</b>원 (${md(bal.d)} 기준)`;
      }
    }
    const tiles = withDv
      ? `<div class="sum period"><div class="k hl"><div class="l">${ic('coin')}${name} 합계</div><div class="v">${won(tAll)}<small>원</small></div><div class="ds-sub">홀·포장 + 배달 순매출</div></div>
        <div class="k"><div class="l">${ic('store')}홀·포장</div><div class="v">${won(T.hall)}<small>원</small></div><div class="ds-sub">영수 ${won(T.bills)}건</div></div>
        <div class="k"><div class="l">${ic('box')}배달 순매출</div><div class="v">${won(tNet)}<small>원</small></div><div class="ds-sub">배달 ${won(T.sales)} + 배민 포장 ${won(T.pick)} − 수수료 ${won(T.fee)}</div></div>
        <div class="k"><div class="l">${ic('clock')}하루 평균</div><div class="v">${days ? won(tAll / days) : 0}<small>원 · ${days}일</small></div></div></div>`
      : `<div class="sum period"><div class="k hl"><div class="l">${ic('coin')}홀·포장 순매출</div><div class="v">${won(T.hall)}<small>원</small></div></div>
        <div class="k"><div class="l">${ic('file')}영수건수</div><div class="v">${won(T.bills)}<small>건</small></div></div>
        <div class="k"><div class="l">${ic('store')}객단가</div><div class="v">${T.bills ? won(T.hall / T.bills) : '-'}<small>원</small></div></div>
        <div class="k"><div class="l">${ic('clock')}하루 평균</div><div class="v">${days ? won(T.hall / days) : 0}<small>원 · ${days}일</small></div></div></div>`;
    res.innerHTML = `<div class="ds-cov">${cov}</div>${tiles}
      <div class="card"><div class="meta"><div class="left"><strong>${name} ${month ? '월별' : '일별'} 매출</strong><span class="count">${keys.length}${month ? '개월' : '일'}</span></div><button class="btn ghost" onclick="dlCsv('직영점_매출_${name}')">${ic('download')}CSV 다운로드</button></div>
      ${keys.length ? `<div class="tbl-wrap">${html}</div>` : '<div class="empty">이 기간에 들어온 매출이 없어요.</div>'}
      ${withDv ? '<div class="dv-note">배달 순매출 = 인프라D 결제금액 + 배민 포장 − 마일리지 차감 전부(배달료·부가세·월 관리비 등). 아직 안 올린 날은 - 로 보여요.</div>' : ''}</div>`;
  }

  window.dsStore = k => { if (k === DS.store) return; DS.store = k; if (k !== 'sv') DS.tab = 'sales'; page(); };
  window.dsTab = k => { if (k === DS.tab) return; DS.tab = k; page(); };
  window.dsView = k => { DS.view = k; document.querySelectorAll('#ds-view button').forEach(b => b.classList.toggle('on', b.getAttribute('onclick').includes(`'${k}'`))); run(); };
  window.dsRange = k => { const [a, b] = range(k); document.getElementById('d1').value = a; document.getElementById('d2').value = b; run(); };
  window.dsRun = run;

  const goDs = go;
  go = function(p, t){
    if (p === PAGE) {
      if (!canSales()) { toast('이 메뉴를 볼 권한이 없어요. 관리자에게 문의해주세요.'); return goDs('dash'); }
      if (window.DS_STORE) { DS.store = window.DS_STORE; window.DS_STORE = null; }
      if (window.DS_TAB) { DS.tab = window.DS_TAB; window.DS_TAB = null; }
      DS.dvKey = '';   // 화면 들어올 때마다 배달 자료는 새로 받음
      closeSide(); renderSide(p); window.__curPage = p; page(); window.scrollTo(0, 0); return;
    }
    return goDs(p, t);
  };
})();
