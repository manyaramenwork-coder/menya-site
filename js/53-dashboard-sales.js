
/* ==========================================================
   대시보드 맨 위: 쌍용본점 매출 (2026-11-18)
   - 순매출 기준, 배달 매출은 아직 집계 전이라 제외
   - 이번 달 누적 · 전월 같은 기간 대비 · 최근 매출일 · 일별 막대(최근 매출일 강조)
   - 매출은 다음 날 들어오므로 비교 기간은 '이번 달 마지막으로 들어온 날'까지
   - '매출 조회' → 매장별 매출 조회에 쌍용점이 선택된 채로 이동 (2026-11-19부터 직영점 매출 조회로)
   - 데이터: 매출 관리와 같은 sales_data를 직접 받음 (LOADERS는 로그인 스크립트 안에만 있어 여기서 못 씀)
   - 2026-11-18 배달 추가: delivery_data(54-delivery-sales)의 순 배달매출을 더해 홀·포장 + 배달로 보여 줌. 두 자료는 각자 들어온 날까지
   - 2026-11-19 배민 포장(픽업) 추가: 포스·인프라D 어디에도 안 잡히는 배민 앱 결제 픽업. 따로 한 줄 + 막대 세 번째 색
   - 2026-11-19 모양 바꿈(방금 시안): 막대 그래프 없앰
       위: 홀·포장 | 배달 순매출(배달 총매출 + 배민 포장 − 수수료) 크게 나란히, 각자 전월 같은 날짜 대비
       가운데: 배달 내역 4칸(배달 총매출 · 배민 포장 · 배달 수수료 · 마일리지 잔액)
       아래: 쌍용점 합계(홀·포장 + 배달 순매출) 한 줄, 어제 한 줄
       배달 전월 대비는 지난달 배달 자료(주문·적립금)가 있을 때만 나옴
       '직영점 매출 조회 →' 로 이동 (55-direct-sales)
   ========================================================== */
(function(){
  const st = document.createElement('style');
  st.textContent = `
  .sv-box{background:var(--card,#fff);border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px}
  .sv-note{font-size:11px;color:var(--sub);display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;margin-bottom:14px}
  .sv-note b{font-weight:600;color:var(--ink)}
  .sv-note a{margin-left:auto;color:var(--brand);cursor:pointer;font-weight:600;white-space:nowrap}
  .sv-note a .icon{width:13px;height:13px;vertical-align:-2px}
  .sv-top{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:16px}
  .sv-l{font-size:12px;color:var(--sub)}
  .sv-v{font-size:30px;font-weight:700;letter-spacing:-1px;font-variant-numeric:tabular-nums;margin:2px 0 4px;line-height:1.2}
  .sv-v small{font-size:13px;font-weight:400;color:var(--sub);margin-left:3px}
  .sv-c{font-size:11px;color:var(--sub);line-height:1.7}
  .sv-up{color:#2f7d32;font-weight:600}.sv-dn{color:#c62429;font-weight:600}
  .sv-cap{font-size:11px;color:var(--sub);margin:0 0 8px}
  .sv-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
  .sv-t{background:#f4f5f1;border-radius:10px;padding:11px 13px;min-width:0}
  .sv-t span{display:block;font-size:11px;color:var(--sub)}
  .sv-t b{display:block;font-size:17px;font-variant-numeric:tabular-nums;margin:3px 0 1px;white-space:nowrap}
  .sv-t em{font-style:normal;font-size:10px;color:var(--sub)}
  .sv-t.minus b{color:#c62429}
  .sv-t.bal{background:transparent;border:1.5px dashed var(--line)}
  .sv-tot{margin-top:12px;font-size:12px;color:var(--sub)}
  .sv-tot b{color:var(--ink);font-variant-numeric:tabular-nums}
  .sv-yd{margin-top:12px;padding-top:11px;border-top:1px solid var(--line);font-size:12px;color:var(--sub);display:flex;flex-wrap:wrap;gap:4px 18px}
  .sv-yd b{color:var(--ink);font-variant-numeric:tabular-nums;margin-left:5px}
  .sv-empty{color:var(--sub);font-size:12px;text-align:center;padding:22px 0}
  @media(max-width:700px){.sv-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:580px){.sv-box{padding:15px}.sv-top{grid-template-columns:1fr;gap:12px}.sv-v{font-size:26px}.sv-note a{margin-left:0}}
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
    const today = kst(), ym = today.slice(0, 7), pym = prevYm(ym);
    const yd = (() => { const x = new Date(today + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); })();
    const md = k => `${+k.slice(5, 7)}/${+k.slice(8, 10)}`;
    const pctHtml = (now, base, lab) => {
      if (!base) return '';
      const p = Math.round((now - base) / base * 100);
      return p > 0 ? `<span class="sv-up">▲ ${p}%</span> ${lab}` : p < 0 ? `<span class="sv-dn">▼ ${-p}%</span> ${lab}` : `${lab} 같음`;
    };
    // 홀·포장(포스): 보통 전날까지 들어와요 → 이번 달 마지막으로 들어온 날 기준
    let last = '';
    SALES.rows.forEach(r => { if (r[1] === SV_IDX && r[0] <= today && r[0] > last) last = r[0]; });
    const end = last.slice(0, 7) === ym ? last : '';
    const d = end ? +end.slice(8, 10) : 0;
    const pEnd = pym + '-' + String(Math.min(d, dim(pym))).padStart(2, '0');
    let cur = 0, prev = 0, hY = null;
    SALES.rows.forEach(r => {
      if (r[1] !== SV_IDX) return;
      if (end && r[0].slice(0, 7) === ym && r[0] <= end) cur += r[5];
      else if (d && r[0] >= pym + '-01' && r[0] <= pEnd) prev += r[5];
      if (r[0] === yd) hY = (hY || 0) + r[5];
    });
    // 배달: 주문·적립금 두 파일이 다 있는 날까지. 배민 포장은 넣은 날까지
    const dDays = (SV_DV && SV_DV.days) || [];
    const both = x => x.hasOrders && x.hasLedger;
    let dEnd = '', kEnd = '', sales = 0, n = 0, fee = 0, pick = 0, pickN = 0, bal = null, hasPrevD = false;
    dDays.forEach(x => {
      if (x.d.slice(0, 7) === pym && both(x)) hasPrevD = true;
      if (x.d.slice(0, 7) !== ym || x.d > today) return;
      if (both(x)) { sales += x.sales || 0; n += x.n || 0; fee += (x.usedCall || 0) + (x.usedOther || 0); if (x.d > dEnd) dEnd = x.d; }
      if (x.hasPickup) { pick += x.pick || 0; pickN += x.pickN || 0; if (x.d > kEnd) kEnd = x.d; }
      if (x.balance != null && (!bal || x.d >= bal.d)) bal = { d: x.d, v: x.balance };
    });
    const dNet = sales + pick - fee, dEndAll = [dEnd, kEnd].sort().pop() || '';
    // 배달 전월 대비: 지난달 1일 ~ 이번 달 배달이 들어온 날과 같은 날짜까지 (지난달 배달 자료가 있을 때만)
    let dPrev = 0;
    if (hasPrevD && dEnd) {
      const de = +dEnd.slice(8, 10), ke = kEnd ? +kEnd.slice(8, 10) : 0;
      dDays.forEach(x => {
        if (x.d.slice(0, 7) !== pym) return;
        const day = +x.d.slice(8, 10);
        if (both(x) && day <= de) dPrev += (x.sales || 0) - (x.usedCall || 0) - (x.usedOther || 0);
        if (x.hasPickup && day <= ke) dPrev += x.pick || 0;
      });
    }
    // 어제 한 줄
    const xY = dDays.find(x => x.d === yd);
    const yParts = [`홀·포장<b>${hY != null ? won(hY) : '집계 전'}</b>`];
    if (SV_DV) {
      yParts.push(`배달<b>${xY && xY.hasOrders ? won(xY.sales) : '집계 전'}</b>`);
      yParts.push(`배민 포장<b>${xY && xY.hasPickup ? won(xY.pick) : '집계 전'}</b>`);
      yParts.push(`수수료<b>${xY && xY.hasLedger ? '−' + won((xY.usedCall || 0) + (xY.usedOther || 0)) : '집계 전'}</b>`);
    }
    const upd = META.salesUpdated ? META.salesUpdated + ' 업데이트' : '';
    const hallCmp = pctHtml(cur, prev, `전월 1~${d}일 대비`);
    const dCmp = dEnd ? pctHtml(dNet, dPrev, `전월 1~${+dEnd.slice(8, 10)}일 대비`) : '';
    const goLink = `<a role="button" tabindex="0" onclick="svGo()">직영점 매출 조회 ${typeof ic === 'function' ? ic('arrow') : '→'}</a>`;
    const head = `<div class="sv-note"><b>${esc(stores[SV_IDX])}</b><span>${+ym.slice(5)}월 1~${Math.max(d, dEndAll ? +dEndAll.slice(8, 10) : 0)}일 · 순매출 기준</span>${upd ? `<span>${upd}</span>` : ''}${goLink}</div>`;
    const hallBox = `<div><div class="sv-l">홀·포장</div><div class="sv-v">${won(cur)}<small>원</small></div>
      <div class="sv-c">${hallCmp ? hallCmp + ' · ' : ''}${end ? md(end) + '까지' : '이번 달 집계 전'}</div></div>`;
    if (!dEnd && !kEnd) {
      return head + `<div class="sv-top">${hallBox}<div><div class="sv-l">배달 순매출</div><div class="sv-v">-</div><div class="sv-c">이번 달 배달 자료를 아직 안 올렸어요</div></div></div>
        <div class="sv-yd"><span>어제 ${md(yd)}(${dow(yd)})</span>${yParts.map(x => `<span>${x}</span>`).join('')}</div>`;
    }
    return head + `<div class="sv-top">${hallBox}
        <div><div class="sv-l">배달 순매출</div><div class="sv-v">${won(dNet)}<small>원</small></div>
          <div class="sv-c">${dCmp ? dCmp + '<br>' : ''}배달 총매출 + 배민 포장 − 수수료 · ${dEndAll ? md(dEndAll) + '까지' : ''}</div></div></div>
      <div class="sv-cap">배달 내역</div>
      <div class="sv-tiles">
        <div class="sv-t"><span>배달 총매출</span><b>${won(sales)}</b><em>${n}건${dEnd ? ' · ' + md(dEnd) + '까지' : ''}</em></div>
        <div class="sv-t"><span>배민 포장</span><b>${won(pick)}</b><em>${pickN}건${kEnd ? ' · ' + md(kEnd) + '까지' : ''}</em></div>
        <div class="sv-t minus"><span>배달 수수료</span><b>${fee ? '−' + won(fee) : '0'}</b><em>마일리지 차감</em></div>
        <div class="sv-t bal"><span>마일리지 잔액</span><b>${bal ? won(bal.v) : '-'}</b><em>${bal ? md(bal.d) + ' 기준' : '기록 없음'}</em></div>
      </div>
      <div class="sv-tot">${esc(stores[SV_IDX])} 합계 <b>${won(cur + dNet)}원</b> (홀·포장 + 배달 순매출)</div>
      <div class="sv-yd"><span>어제 ${md(yd)}(${dow(yd)})</span>${yParts.map(x => `<span>${x}</span>`).join('')}</div>`;
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

  window.svGo = function(){ window.DS_STORE = 'sv'; window.DS_TAB = 'sales'; go('direct-sales'); };

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
