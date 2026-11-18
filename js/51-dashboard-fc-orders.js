
/* ==========================================================
   대시보드 '가맹점 발주' 정리 (2026-11-11)
   - 큰 숫자 칸(새 발주 · 진행중) 대신 위에 작은 개수 표시 + 한 줄짜리 발주 목록
   - 미확인 → 진행중 순, 같은 상태는 최근 것부터, 최대 6건 (나머지는 '전체 발주 보기')
   - 데이터는 기존 FC(대시보드가 받아 둔 처리 대기 발주) 그대로 사용
   ========================================================== */
(function(){
  const URL_FC = 'https://fcdaum.com/comu/helpdesk/list', MAX = 6;
  const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function html(){
    const list = (FC || []).filter(q => fcStatus(q) !== '완료')
      .sort((a, b) => (fcStatus(a) === '미확인' ? 0 : 1) - (fcStatus(b) === '미확인' ? 0 : 1) || String(b.at).localeCompare(String(a.at)));
    const nNew = list.filter(q => fcStatus(q) === '미확인').length, nIng = list.length - nNew;
    const row = q => { const st = fcStatus(q), at = fcDate(q.at).slice(5);
      return `<div class="fcd-row"><span class="fcd-st ${st === '미확인' ? 'new' : 'ing'}">${st}</span>
        <span class="fcd-who"><b>${h(q.store)}</b><small>${h(at)} · ${h(q.by)}</small></span>
        <span class="fcd-items" title="${h(fcItems(q))}">${h(fcItems(q))}</span>
        <span class="fcd-amt">${fmt(q.total)}원</span></div>`; };
    return `<section class="card fcd">
      <div class="fcd-top"><span class="fcd-cnt"><b class="${nNew ? 'red' : ''}">${nNew}</b> 미확인</span><span class="fcd-cnt"><b>${nIng}</b> 진행중</span>
        <span class="fcd-acts"><button class="btn ghost" onclick="go('fc-orders')">전체 발주 보기</button><a class="btn" href="${URL_FC}" target="_blank" rel="noopener">FC다움에서 처리 ${ic('arrow')}</a></span></div>
      ${list.length ? `<div class="fcd-list">${list.slice(0, MAX).map(row).join('')}</div>${list.length > MAX ? `<button class="fcd-more" onclick="go('fc-orders')">외 ${list.length - MAX}건 더 보기</button>` : ''}`
        : '<div class="fcd-empty">처리할 발주가 없어요.</div>'}
      <p class="fcd-hint">확인·완료 처리는 FC다움에서 해요. 처리하면 몇 분 안에 여기서 빠져요.</p></section>`;
  }
  const pageDashboardFcd = pageDashboard;
  pageDashboard = function(){
    pageDashboardFcd.apply(this, arguments);
    const sec = [...document.querySelectorAll('#main .dash-sec')].find(s => ['본사 택배 발주', '가맹점 발주'].includes((s.querySelector('.sec-head h2') || {}).textContent));
    if (!sec) return;
    sec.querySelector('.sec-head h2').textContent = '가맹점 발주';
    [...sec.children].forEach(c => { if (!c.classList.contains('sec-head')) c.remove(); });
    sec.insertAdjacentHTML('beforeend', html());
  };
  const st = document.createElement('style');
  st.textContent = `
  .fcd{padding:16px 20px}
  .fcd-top{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:10px}
  .fcd-cnt{font-size:12px;color:#5e625b}
  .fcd-cnt b{font-size:20px;color:#232621;margin-right:3px}.fcd-cnt b.red{color:#c62429}
  .fcd-acts{margin-left:auto;display:flex;gap:6px}
  .fcd-acts .btn{min-height:34px;font-size:12px;padding:6px 12px;text-decoration:none}
  .fcd-acts .icon{width:13px;height:13px}
  .fcd-row{display:grid;grid-template-columns:62px 150px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 2px;border-top:1px solid #f0f1ec;font-size:13px}
  .fcd-st{font-size:11px;font-weight:700;border-radius:10px;padding:3px 0;text-align:center}
  .fcd-st.new{background:#c62429;color:#fff}.fcd-st.ing{background:#fff1d6;color:#8a5a00}
  .fcd-who{display:flex;flex-direction:column;gap:2px;min-width:0}
  .fcd-who b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fcd-who small{font-size:11px;color:#6b6f68}
  .fcd-items{color:#4d524a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fcd-amt{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
  .fcd-more{display:block;margin:6px auto 0;border:0;background:none;color:#5f6858;font-size:12px;cursor:pointer;padding:6px 10px}
  .fcd-empty{text-align:center;color:#909b84;font-size:13px;padding:22px 0;border-top:1px solid #f0f1ec}
  .fcd-hint{margin:8px 0 0;font-size:11px;color:#8b9381}
  @media(max-width:640px){.fcd-acts{margin-left:0;width:100%}.fcd-acts .btn{flex:1;justify-content:center}
    .fcd-row{grid-template-columns:56px minmax(0,1fr) auto;row-gap:4px}.fcd-items{grid-column:2/4;grid-row:2;font-size:12px}}`;
  document.head.appendChild(st);
})();
