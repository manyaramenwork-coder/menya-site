
// v4.3: 메뉴 정리 - 발주 관리 + 본사 창고 관리 → "본사 발주·재고", 메뉴 순서 정리 (준비중은 아래로)
(function(){
  const NAV_ORDER = ['대시보드','매출 관리','제때 관리','본사 발주·재고','인사관리','공급가 · 원가','사용자 관리'];
  const PO_ITEMS = [['fc-orders','매장 발주 (FC다움)'],['inv-stock','재고 현황'],['inv-io','입·출고 등록'],['inv-log','입·출고 내역'],['inv-count','월말 재고조사']];
  const label = b => (b.childNodes ? [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('') : '').trim();
  const renderSideV43 = renderSide;
  renderSide = function(active){
    renderSideV43(active);
    window.__curPage = active;
    const nav = document.querySelector('#side .nav-items'); if (!nav) return;
    const cats = [...nav.querySelectorAll(':scope > .cat')];
    // 1) 발주 관리 + 본사 창고 관리 합치기
    const po = cats.find(b => label(b) === '발주 관리'), wh = cats.find(b => label(b) === '본사 창고 관리');
    if (wh) { if (wh.nextElementSibling && wh.nextElementSibling.classList.contains('sub')) wh.nextElementSibling.remove(); wh.remove(); }
    if (po) {
      if (po.nextElementSibling && po.nextElementSibling.classList.contains('sub')) po.nextElementSibling.remove();
      const open = PO_ITEMS.some(i => i[0] === active);
      po.outerHTML = `<button class="cat ${open?'open':''}" onclick="const on=this.classList.toggle('open');this.nextElementSibling.classList.toggle('open',on)">${ic('warehouse')}본사 발주·재고${ic('chevron').replace('class="icon"','class="icon ar"')}</button><div class="sub ${open?'open':''}">${PO_ITEMS.map(([k,t]) => `<a role="button" tabindex="0" class="${k===active?'on':''}" onclick="go('${k}')">${t}</a>`).join('')}</div>`;
    }
    // 2) 순서 정리: 사용 중인 메뉴 → 준비중 → 사용자 관리
    const units = [];
    [...nav.querySelectorAll(':scope > .cat')].forEach(b => { const sub = b.nextElementSibling && b.nextElementSibling.classList.contains('sub') ? b.nextElementSibling : null; units.push({name: label(b), b, sub}); });
    const rank = u => { const i = NAV_ORDER.indexOf(u.name); return i < 0 ? 50 : i; };
    units.sort((x, y) => rank(x) - rank(y)).forEach(u => { nav.appendChild(u.b); if (u.sub) nav.appendChild(u.sub); });
    nav.querySelector('.nav-soon-label')?.remove();
    const firstSoon = [...nav.querySelectorAll(':scope > .cat')].find(b => b.querySelector('.soon'));
    if (firstSoon) firstSoon.insertAdjacentHTML('beforebegin', '<div class="nav-soon-label">준비 중</div>');
  };
  const st = document.createElement('style');
  st.textContent = '.nav-soon-label{margin:14px 0 4px 14px;font-size:10px;letter-spacing:.12em;color:#7d8277}';
  document.head.appendChild(st);

  // 매장 발주 목록: 처리 대기 발주에 창고 재고 표시
  const fcRowV43 = fcRow;
  fcRow = function(q){
    const html = fcRowV43(q);
    if (!document.getElementById('fc-d1') || fcStatus(q) === '완료' || typeof invCalc !== 'function') return html;
    const calc = invCalc();
    const tags = q.items.map(i => {
      const n = iNorm(i[1]); const it = INV.items.find(x => x.fc && n.indexOf(iNorm(x.fc)) >= 0); if (!it) return '';
      const r = calc.find(c => c.it.code === it.code);
      if (!r || !r.known) return `<span class="fc-stk unk">창고 ${ih(it.name)}: 수량 모름</span>`;
      const short = r.qty < i[2];
      return `<span class="fc-stk ${short ? 'short' : 'ok'}">창고 ${ih(it.name)} ${fmt(r.qty)}${ih(it.unit)}${short ? ' · 부족' : ''}</span>`;
    }).filter(Boolean).join('');
    return tags ? html.replace(/<\/div>$/, `<div class="fc-stks">${tags}</div></div>`) : html;
  };
  const st2 = document.createElement('style');
  st2.textContent = '.fc-stks{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.fc-stk{font-size:11px;border-radius:999px;padding:2px 9px}.fc-stk.ok{background:#eaf1e4;color:#4b6b35}.fc-stk.short{background:#c8102e;color:#fff}.fc-stk.unk{background:#f3eee2;color:#8a6d2b}';
  document.head.appendChild(st2);

  // 화면 이름 맞추기
  const goV43 = go;
  go = function(p, t){
    const r = goV43(p, t);
    if (p === 'fc-orders' || p.indexOf('inv-') === 0) {
      const c = document.querySelector('.crumb');
      if (c) c.innerHTML = c.innerHTML.replace('<span>발주 관리</span>', '<span>본사 발주·재고</span>').replace('<span>본사 창고 관리</span>', '<span>본사 발주·재고</span>').replace('<span>FC다움 본사 발주</span>', '<span>매장 발주 (FC다움)</span>');
      if (p === 'fc-orders') { const h = document.querySelector('.page-hero h1'); if (h) h.textContent = '매장 발주 (FC다움)'; }
    }
    return r;
  };
  try { renderSide(window.__curPage || 'dash'); } catch(e) {}
})();

