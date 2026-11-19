
/* ==========================================================
   대시보드 맨 위: 쌍용본점 매출 (2026-11-18)
   - 순매출 기준, 배달 매출은 아직 집계 전이라 제외
   - 이번 달 누적 · 전월 같은 기간 대비 · 최근 매출일 · 일별 막대(최근 매출일 강조)
   - 매출은 다음 날 들어오므로 비교 기간은 '이번 달 마지막으로 들어온 날'까지
   - '매출 조회' → 매장별 매출 조회에 쌍용점이 선택된 채로 이동
   - 데이터: 매출 관리와 같은 sales_data를 직접 받음 (LOADERS는 로그인 스크립트 안에만 있어 여기서 못 씀)
   - 2026-11-18 배달 추가: delivery_data(54-delivery-sales)의 순 배달매출을 더해 홀·포장 + 배달로 보여 줌. 두 자료는 각자 들어온 날까지
   - 2026-11-19 배민 포장(픽업) 추가: 포스·인프라D 어디에도 안 잡히는 배민 앱 결제 픽업. 따로 한 줄 + 막대 세 번째 색
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
  .sv-bars .sv-col{flex:1;min-width:2px;height:100%;display:flex;flex-direction:column;justify-content:flex-end}
  .sv-col b{display:block;width:100%}
  .sv-col .h{background:var(--sub);opacity:.32}
  .sv-col.we .h{opacity:.5}.sv-col.td .h{opacity:.75}
  .sv-col .d{background:var(--brand);border-radius:2px 2px 0 0}
  .sv-col .k{background:var(--brand);opacity:.4}
  .sv-col.fu .h{height:2px;opacity:.15}
  .sv-split{margin-top:10px;padding-top:10px;border-top:1px solid var(--line);font-size:12px;color:var(--sub);display:flex;flex-direction:column;gap:4px}
  .sv-split span{color:var(--ink);font-variant-numeric:tabular-nums}.sv-split em{font-style:normal;color:var(--sub);font-size:11px;margin-left:4px}
  .sv-split i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;vertical-align:-1px}
  .sv-split i.h{background:var(--sub);opacity:.5}.sv-split i.d{background:var(--brand)}.sv-split i.k{background:var(--brand);opacity:.4}
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
    // 홀·포장(포스): 보통 전날까지 들어와요 → 이번 달 마지막으로 들어온 날 기준
    const today = kst(), ym = today.slice(0, 7), pym = prevYm(ym), n = dim(ym);
    let last = '';
    SALES.rows.forEach(r => { if (r[1] === SV_IDX && r[0] <= today && r[0] > last) last = r[0]; });
    const end = last.slice(0, 7) === ym ? last : '';
    const d = end ? +end.slice(8, 10) : 0;
    const pEnd = pym + '-' + String(Math.min(d, dim(pym))).padStart(2, '0');
    const day = {}; let cur = 0, prev = 0;
    SALES.rows.forEach(r => {
      if (r[1] !== SV_IDX) return;
      if (end && r[0].slice(0, 7) === ym && r[0] <= end) { cur += r[5]; day[r[0]] = (day[r[0]] || 0) + r[5]; }
      else if (d && r[0] >= pym + '-01' && r[0] <= pEnd) prev += r[5];
    });
    // 배달(순): 주문·적립금 두 파일이 다 있는 날까지. 순 = 결제금액 − 적립금 차감 전부
    const dd = {}; let dEnd = '', dCur = 0, dPrev = 0, hasPrevD = false;
    const dDays = (SV_DV && SV_DV.days) || [];
    dDays.forEach(x => {
      if (!(x.hasOrders && x.hasLedger)) return;
      const v = x.sales - x.usedCall - x.usedOther;
      if (x.d.slice(0, 7) === ym && x.d <= today) { dd[x.d] = v; dCur += v; if (x.d > dEnd) dEnd = x.d; }
      else if (x.d.slice(0, 7) === pym) hasPrevD = true;
    });
    const de = dEnd ? +dEnd.slice(8, 10) : 0;
    if (de) dDays.forEach(x => { if (x.hasOrders && x.hasLedger && x.d.slice(0, 7) === pym && +x.d.slice(8, 10) <= de) dPrev += x.sales - x.usedCall - x.usedOther; });
    // 배민 포장: 넣은 날까지 (어사이드가 매일 오전 전날까지 넣음)
    const pk = {}; let kEnd = '', kCur = 0, kPrev = 0, hasPrevK = false;
    dDays.forEach(x => {
      if (!x.hasPickup) return;
      if (x.d.slice(0, 7) === ym && x.d <= today) { pk[x.d] = x.pick || 0; kCur += x.pick || 0; if (x.d > kEnd) kEnd = x.d; }
      else if (x.d.slice(0, 7) === pym) hasPrevK = true;
    });
    const ke = kEnd ? +kEnd.slice(8, 10) : 0;
    if (ke) dDays.forEach(x => { if (x.hasPickup && x.d.slice(0, 7) === pym && +x.d.slice(8, 10) <= ke) kPrev += x.pick || 0; });
    const withD = !!dEnd && hasPrevD, withK = !!kEnd && hasPrevK;
    const base = prev + (withD ? dPrev : 0) + (withK ? kPrev : 0), now = cur + (withD ? dCur : 0) + (withK ? kCur : 0);
    const pct = base ? Math.round((now - base) / base * 100) : null;
    const lab = withD || withK ? '전월 같은 기간 대비' : `홀·포장 전월 1~${d}일 대비`;
    const cmp = pct === null ? '<span class="sv-eq">전월 비교 데이터 없음</span>'
      : pct > 0 ? `<span class="sv-up">▲ ${pct}% ${lab}</span>` : pct < 0 ? `<span class="sv-dn">▼ ${-pct}% ${lab}</span>` : `<span class="sv-eq">${lab} 같음</span>`;
    const tot = cur + dCur + kCur, share = tot && dEnd ? Math.round(dCur / tot * 1000) / 10 : 0;
    const key = i => ym + '-' + String(i).padStart(2, '0');
    let max = 1; for (let i = 1; i <= n; i++) max = Math.max(max, (day[key(i)] || 0) + Math.max(0, dd[key(i)] || 0) + (pk[key(i)] || 0));
    let bars = '';
    for (let i = 1; i <= n; i++) {
      const k = key(i), hv = day[k] || 0, dv = Math.max(0, dd[k] || 0), kv = pk[k] || 0, w = dow(k);
      if ((!end || k > end) && !(k in dd) && !kv) { bars += `<i class="sv-col fu" title="${+ym.slice(5)}/${i}(${w}) ${k <= today ? '집계 전' : ''}"><b class="h"></b></i>`; continue; }
      const t = `${+ym.slice(5)}/${i}(${w})` + (end && k <= end ? ` 홀·포장 ${won(hv)}원` : ' 홀·포장 집계 전') + (k in dd ? ` · 배달 ${won(dd[k])}원` : '') + (kv ? ` · 배민 포장 ${won(kv)}원` : '');
      bars += `<i class="sv-col${k === end ? ' td' : ''}${/[토일]/.test(w) ? ' we' : ''}" title="${t}"><b class="d" style="height:${Math.round(dv / max * 100)}%"></b><b class="k" style="height:${Math.round(kv / max * 100)}%"></b><b class="h" style="height:${hv ? Math.max(2, Math.round(hv / max * 100)) : 0}%"></b></i>`;
    }
    const upd = META.salesUpdated ? META.salesUpdated + ' 업데이트' : '';
    const dNote = dEnd ? '배달은 순 배달매출(마일리지 차감 후)' : '배달 매출 제외(아직 안 올림)';
    return `<div class="sv-note"><b>${stores[SV_IDX]}</b><span>${+ym.slice(5)}월 · 순매출 기준 · ${dNote}</span>${upd ? `<span>${upd}</span>` : ''}<a role="button" tabindex="0" onclick="svGo()">매출 조회 ${typeof ic === 'function' ? ic('arrow') : '→'}</a></div>
      <div class="sv-body"><div class="sv-nums"><div class="sv-l">이번 달 누적</div><div class="sv-v">${won(tot)}<small>원</small></div>${cmp}
        <div class="sv-split"><span><i class="h"></i>홀·포장 ${won(cur)}${end ? `<em>${+end.slice(5, 7)}/${d}까지</em>` : ''}</span>${kEnd ? `<span><i class="k"></i>배민 포장 ${won(kCur)}<em>${+kEnd.slice(5, 7)}/${ke}까지</em></span>` : ''}${dEnd ? `<span><i class="d"></i>배달 ${won(dCur)} · ${share}%<em>${+dEnd.slice(5, 7)}/${de}까지</em></span>` : ''}</div></div>
        <div class="sv-chart"><div class="sv-bars">${bars}</div><div class="sv-ax"><span>1일</span><span>10일</span><span>20일</span><span>${n}일</span></div></div></div>`;
  }

  // 매출 데이터: 매출 조회 화면과 같은 sales_data를 받아 같은 변수(SALES)에 넣음. 30분 지나면 다시 받음
  // 배달: delivery_data (지난달 1일 ~ 오늘). 배달 매출 화면에서 저장하면 DV_DASH_AT=0 이 되어 다시 받음
  let SV_AT = 0, SV_DV = null; window.DV_DASH_AT = 0;
  async function svLoad(){
    const today = kst();
    const dvP = (window.DV_DASH_AT && Date.now() - window.DV_DASH_AT < 30 * 60e3) ? null
      : window.SB.rpc('delivery_data', { p_store: 1, p_from: prevYm(today.slice(0, 7)) + '-01', p_to: today })
          .then(({ data, error }) => { if (!error && data) { SV_DV = data; window.DV_DASH_AT = Date.now(); } }).catch(() => {});
    if (!(SV_AT && Date.now() - SV_AT < 30 * 60e3 && SALES.rows.length)) {
      const { data, error } = await window.SB.rpc('sales_data'); if (error) throw error;
      Object.assign(META, data.meta || {});
      SALES = data.sales || { stores: [], rows: [] };
      S_MIN = SALES.rows.length ? SALES.rows[0][0] : ''; S_MAX = SALES.rows.length ? SALES.rows[SALES.rows.length - 1][0] : '';
      SV_AT = Date.now();
    }
    if (dvP) await dvP;
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
