
/* ==========================================================
   대시보드 맨 위: 쌍용본점 매출 (2026-11-18)
   - 순매출 기준, 배달 매출은 아직 집계 전이라 제외
   - 이번 달 누적 · 전월 같은 기간 대비 · 최근 매출일 · 일별 막대(최근 매출일 강조)
   - 매출은 다음 날 들어오므로 비교 기간은 '이번 달 마지막으로 들어온 날'까지
   - '매출 조회' → 매장별 매출 조회에 쌍용점이 선택된 채로 이동
   - 데이터: 매출 관리와 같은 sales_data를 직접 받음 (LOADERS는 로그인 스크립트 안에만 있어 여기서 못 씀)
   ========================================================== */
(function(){
  const st = document.createElement('style');
  st.textContent = `
  .sv-box{background:var(--card,#fff);border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px}
  .sv-note{font-size:11px;color:var(--sub);display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;margin-bottom:14px}
  .sv-note b{font-weight:600;color:var(--ink)}
  .sv-note a{margin-left:auto;color:var(--brand);cursor:pointer;font-weight:600;white-space:nowrap}
  .sv-note a .icon{width:13px;height:13px;vertical-align:-2px}
  .sv-body{display:flex;gap:22px;align-items:flex-end}
  .sv-nums{min-width:170px;flex-shrink:0}
  .sv-l{font-size:11px;color:var(--sub)}
  .sv-v{font-size:24px;font-weight:700;letter-spacing:-.8px;font-variant-numeric:tabular-nums;margin:2px 0}
  .sv-v small{font-size:12px;font-weight:400;color:var(--sub);margin-left:2px}
  .sv-up{color:#2f7d32;font-size:11px;font-weight:600}.sv-dn{color:#c62429;font-size:11px;font-weight:600}.sv-eq{color:var(--sub);font-size:11px}
  .sv-today{margin-top:10px;padding-top:10px;border-top:1px solid var(--line);font-size:12px;color:var(--sub)}
  .sv-today b{color:var(--ink);font-size:14px;font-variant-numeric:tabular-nums;margin-left:6px}
  .sv-chart{flex:1;min-width:0}
  .sv-bars{display:flex;align-items:flex-end;gap:3px;height:92px}
  .sv-bars i{flex:1;min-width:2px;border-radius:2px 2px 0 0;background:var(--sub);opacity:.32}
  .sv-bars i.we{opacity:.5}
  .sv-bars i.td{background:var(--brand);opacity:1}
  .sv-bars i.fu{height:2px!important;opacity:.15}
  .sv-ax{display:flex;justify-content:space-between;font-size:10px;color:var(--sub);margin-top:5px}
  .sv-empty{color:var(--sub);font-size:12px;text-align:center;padding:22px 0}
  @media(max-width:580px){.sv-box{padding:15px}.sv-body{flex-direction:column;align-items:stretch;gap:14px}.sv-bars{height:70px}.sv-note a{margin-left:0}}
  `;
  document.head.appendChild(st);

  const won = n => Math.round(n || 0).toLocaleString('ko-KR');
  const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const dim = ym => new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
  const prevYm = ym => { let y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1; if (!m) { m = 12; y--; } return y + '-' + String(m).padStart(2, '0'); };
  const dow = d => '일월화수목금토'[new Date(d + 'T00:00:00').getDay()];
  const can = () => !window.mmCan || mmCan('sales');
  let SV_IDX = -1;

  function svHtml(){
    const stores = (typeof SALES !== 'undefined' && SALES.stores) || [];
    SV_IDX = stores.findIndex(s => /쌍용/.test(s));
    if (SV_IDX < 0) return '<div class="sv-empty">매출 데이터에서 쌍용점을 찾지 못했어요.</div>';
    // 매출은 보통 전날까지 들어와요 → '오늘' 대신 마지막으로 들어온 날 기준
    const today = kst(), ym = today.slice(0, 7);
    let last = '';
    SALES.rows.forEach(r => { if (r[1] === SV_IDX && r[0] <= today && r[0] > last) last = r[0]; });
    const end = last.slice(0, 7) === ym ? last : '';          // 이번 달에 들어온 마지막 날
    const d = end ? +end.slice(8, 10) : 0;
    const pym = prevYm(ym), pEnd = pym + '-' + String(Math.min(d, dim(pym))).padStart(2, '0');
    const day = {}; let cur = 0, prev = 0;
    SALES.rows.forEach(r => {
      if (r[1] !== SV_IDX) return;
      if (end && r[0].slice(0, 7) === ym && r[0] <= end) { cur += r[5]; day[r[0]] = (day[r[0]] || 0) + r[5]; }
      else if (d && r[0] >= pym + '-01' && r[0] <= pEnd) prev += r[5];
    });
    const pct = prev ? Math.round((cur - prev) / prev * 100) : null;
    const cmp = pct === null ? '<span class="sv-eq">전월 비교 데이터 없음</span>'
      : pct > 0 ? `<span class="sv-up">▲ ${pct}% 전월 1~${d}일 대비</span>`
      : pct < 0 ? `<span class="sv-dn">▼ ${-pct}% 전월 1~${d}일 대비</span>`
      : `<span class="sv-eq">전월 1~${d}일과 같음</span>`;
    const n = dim(ym), max = Math.max(1, ...Object.values(day));
    let bars = '';
    for (let i = 1; i <= n; i++) {
      const k = ym + '-' + String(i).padStart(2, '0'), v = day[k] || 0, w = dow(k);
      const fut = !end || k > end;
      const cls = fut ? 'fu' : (k === end ? 'td' : (/[토일]/.test(w) ? 'we' : ''));
      bars += `<i class="${cls}" style="height:${Math.max(2, Math.round(v / max * 100))}%" title="${+ym.slice(5)}/${i}(${w}) ${fut ? (k <= today ? '집계 전' : '') : (v ? won(v) + '원' : '매출 없음')}"></i>`;
    }
    const lastTxt = end ? `${+end.slice(5, 7)}/${+end.slice(8)}(${dow(end)})<b>${won(day[end])}원</b>` : '이번 달 집계 전';
    const upd = META.salesUpdated ? META.salesUpdated + ' 업데이트' : '';
    return `<div class="sv-note"><b>${stores[SV_IDX]}</b><span>${+ym.slice(5)}월 · 순매출 기준 · 배달 매출 제외(집계 전) · 매출은 다음 날 들어와요</span>${upd ? `<span>${upd}</span>` : ''}<a role="button" tabindex="0" onclick="svGo()">매출 조회 ${typeof ic === 'function' ? ic('arrow') : '→'}</a></div>
      <div class="sv-body"><div class="sv-nums"><div class="sv-l">이번 달 누적</div><div class="sv-v">${won(cur)}<small>원</small></div>${cmp}
        <div class="sv-today">최근 ${lastTxt}</div></div>
        <div class="sv-chart"><div class="sv-bars">${bars}</div><div class="sv-ax"><span>1일</span><span>10일</span><span>20일</span><span>${n}일</span></div></div></div>`;
  }

  // 매출 데이터: 매출 조회 화면과 같은 sales_data를 받아 같은 변수(SALES)에 넣음. 30분 지나면 다시 받음
  let SV_AT = 0;
  async function svLoad(){
    if (SV_AT && Date.now() - SV_AT < 30 * 60e3 && SALES.rows.length) return;
    const { data, error } = await window.SB.rpc('sales_data'); if (error) throw error;
    Object.assign(META, data.meta || {});
    SALES = data.sales || { stores: [], rows: [] };
    S_MIN = SALES.rows.length ? SALES.rows[0][0] : ''; S_MAX = SALES.rows.length ? SALES.rows[SALES.rows.length - 1][0] : '';
    SV_AT = Date.now();
  }

  window.svGo = function(){ window.SV_PRE = SV_IDX; go('sales-report'); };
  const pageSalesSv = pageSales;
  pageSales = function(){
    const r = pageSalesSv.apply(this, arguments);
    if (window.SV_PRE != null && window.SV_PRE >= 0) {
      const sel = document.getElementById('s-st');
      if (sel) { sel.value = String(window.SV_PRE); try { runSales(); } catch (e) {} }
    }
    window.SV_PRE = null;
    return r;
  };

  // 맨 위 자리 지키기: 다른 칸들이 나중에 순서를 바꿔도 매출 칸을 첫 번째로 되돌리고 번호를 다시 매김
  function svPlace(){
    const main = document.getElementById('main'), s = document.getElementById('sv-dash-sec');
    if (!main || !s) return;
    const first = main.querySelector('.dash-sec:not(#sv-dash-sec)');
    if (first && (first.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING)) first.before(s);
    let n = 0;
    main.querySelectorAll('.dash-sec .sec-n').forEach(x => { const t = String(++n); if (x.textContent !== t) x.textContent = t; });
  }

  const pageDashboardSv = pageDashboard;
  pageDashboard = function(){
    const r = pageDashboardSv.apply(this, arguments);
    try {
      const main = document.getElementById('main');
      if (!main || !can() || document.getElementById('sv-dash-sec')) return r;
      const s = document.createElement('section'); s.className = 'dash-sec'; s.id = 'sv-dash-sec';
      s.innerHTML = secHead('1', '쌍용본점 매출', null, '') + '<div class="sv-box"><div class="sv-empty">불러오는 중...</div></div>';
      const first = main.querySelector('.dash-sec');
      if (first) first.before(s); else (main.querySelector('.page-hero') || main.firstChild).after(s);
      svPlace();
      const ob = new MutationObserver(() => { if (!document.getElementById('sv-dash-sec')) return ob.disconnect(); svPlace(); });
      ob.observe(main, { childList: true, subtree: true }); setTimeout(() => ob.disconnect(), 20000);
      svLoad().then(() => {
        const b = document.querySelector('#sv-dash-sec .sv-box'); if (b) b.innerHTML = svHtml();
      }).catch(e => {
        const b = document.querySelector('#sv-dash-sec .sv-box');
        if (b) b.innerHTML = `<div class="sv-empty">매출을 불러오지 못했어요. ${(e && e.message) || ''}</div>`;
      });
    } catch (e) { console.warn('대시보드 쌍용점 매출 실패', e); }
    return r;
  };
})();
