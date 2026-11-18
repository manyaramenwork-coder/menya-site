// v3.2: FC다움 본사 택배 발주 (대시보드 카드 + 발주 관리 > FC다움 발주 목록)
let FC = [];
var FC_SYNCED = META.fcSynced;
const FC_URL = 'https://fcdaum.com/comu/helpdesk/list';
const fcStatus = q => q.done === '완료' ? '완료' : (q.confirmed === '확인' ? '진행중' : '미확인');
const fcItems = q => q.items.map(i => `${i[1].replace(/\s+/g, ' ')} ${fmt(i[2])}${i[3] || ''}`).join(', ');
const fcDate = s => s.slice(0, 16).replace('T', ' ');
function fcBadge(st){ return `<span class="fc-st ${st==='미확인'?'new':st==='진행중'?'ing':'done'}">${st==='미확인'?'NEW · 미확인':st}</span>`; }
function fcRow(q){
  return `<div class="fc-row ${fcStatus(q)==='미확인'?'is-new':''}"><div class="fc-l">${fcBadge(fcStatus(q))}<b>${q.store}</b><small>${fcDate(q.at)} · ${q.by} · 관리번호 ${q.no}</small></div><div class="fc-m">${fcItems(q)}</div><div class="fc-r">${fmt(q.total)}원</div></div>`;
}
function fcMonthly(){
  const m = {}; FC.forEach(q => { const k = q.at.slice(0, 7); m[k] = (m[k] || 0) + q.total; });
  return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
}
function fcSection(){
  const open = FC.filter(q => fcStatus(q) !== '완료');
  const nNew = open.filter(q => fcStatus(q) === '미확인').length, nIng = open.length - nNew;
  const thisM = FC_SYNCED.slice(0, 7);
  const monthRows = FC.filter(q => q.at.startsWith(thisM));
  const monthAmt = monthRows.reduce((s, q) => s + q.total, 0);
  const months = fcMonthly().filter(([k]) => k >= '2025-11');
  const maxM = Math.max(...months.map(m => m[1]));
  const items = {}; FC.forEach(q => q.items.forEach(i => { const k = i[1].replace(/\s+/g, ' ').replace(/\s*\[.*$/, ''); items[k] = (items[k] || 0) + (i[4] || 0); }));
  const topItems = Object.entries(items).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return `<section class="card fc-card">
    <div class="section-title"><strong>${ic('box')}FC다움 · 본사 택배 발주</strong><small>FC다움 기준 ${FC_SYNCED} · 5분마다 자동 동기화</small></div>
    <div class="fc-top">
      <div class="fc-kpi ${nNew?'alert':''}"><span>새 발주 (미확인)</span><b>${nNew}<small>건</small></b></div>
      <div class="fc-kpi"><span>진행중</span><b>${nIng}<small>건</small></b></div>
      <div class="fc-kpi"><span>이번 달 본사 발주</span><b>${fmt(monthAmt)}<small>원 · ${monthRows.length}건</small></b></div>
      <div class="fc-kpi spark"><span>월별 본사 발주 (최근 12개월)</span><div class="fc-spark">${months.map(([k, v]) => `<i title="${k} ${fmt(v)}원" style="height:${Math.max(8, v / maxM * 100)}%"></i>`).join('')}</div></div>
    </div>
    <div class="fc-sub">처리 대기 ${open.length}건</div>
    <div class="fc-list">${open.length ? open.map(fcRow).join('') : '<div class="empty">처리 대기 중인 발주가 없어요.</div>'}</div>
    <div class="fc-foot"><span>많이 주문한 품목: ${topItems.map(([k, v]) => `${k} ${fmt(v / 10000)}만`).join(' · ')}</span>
      <span><button class="btn ghost" onclick="go('fc-orders')">${ic('file')}전체 발주 보기</button><a class="btn" href="${FC_URL}" target="_blank" rel="noopener">${ic('arrow')}FC다움에서 처리하기</a></span></div>
    <p class="dash-hint">이 화면은 확인용이에요. 확인·완료 처리는 FC다움에서만 해요.</p>
  </section>`;
}
// 대시보드에 FC다움 카드 삽입 (요약 카드 바로 아래)
const pageDashboardV32 = pageDashboard;
pageDashboard = function(){
  pageDashboardV32();
  document.querySelector('.dash-sum').insertAdjacentHTML('afterend', fcSection());
};
// 발주 관리 > FC다움 발주 목록
function pageFcOrders(){
  const stores = [...new Set(FC.map(q => q.store))].sort((a, b) => a.localeCompare(b, 'ko'));
  document.getElementById('main').innerHTML = `
  <div class="crumb">${ic('home')}<span>워크스페이스</span><span>/</span><span>발주 관리</span><span>/</span><span>FC다움 본사 발주</span></div>
  <header class="page-hero"><div class="hero-copy"><div class="eyebrow">FC다움 · HQ ORDERS</div><h1>FC다움 본사 발주</h1><p>매장에서 FC다움으로 넣은 본사 택배 발주를 확인하세요. 처리는 FC다움에서 해요.</p></div><div class="hero-image"><span>MENYAMATSURI</span></div></header>
  <div class="data-note"><span class="status-dot"></span><span>FC다움 매장요청 (최근 1년) · ${FC_SYNCED} 기준</span><span class="tag">5분마다 자동 동기화</span></div>
  <section class="card query-card"><div class="section-title"><strong>${ic('filter')}조회 조건</strong></div>
   <div class="filters">
    <div class="f"><label for="fc-d1">등록일</label><div class="daterow"><input type="date" id="fc-d1" value="2025-10-26"><span>~</span><input type="date" id="fc-d2" value="2026-10-25"></div></div>
    <div class="f"><label for="fc-st">매장 선택</label><select id="fc-st"><option value="">전체 매장</option>${stores.map(s => `<option>${s}</option>`).join('')}</select></div>
    <div class="f"><label for="fc-status">진행 상태</label><select id="fc-status"><option value="">전체</option><option>미확인</option><option>진행중</option><option>완료</option></select></div>
    <div class="f"><label for="fc-q">품목 검색<span>선택</span></label><input type="text" id="fc-q" placeholder="예: 우마미소스, 유니폼" onkeydown="if(event.key==='Enter')runFc()"></div>
   </div>
   <div class="actions"><span class="filter-hint">${ic('info')}확인·완료 처리는 FC다움에서만 할 수 있어요.</span><button class="btn ghost" onclick="pageFcOrders()">${ic('reset')}초기화</button><button class="btn primary" onclick="runFc()">${ic('search')}조회</button></div>
  </section><div id="res"></div>` + pageFoot();
  runFc();
}
function runFc(){
  const a = document.getElementById('fc-d1').value, b = document.getElementById('fc-d2').value;
  const st = document.getElementById('fc-st').value, ss = document.getElementById('fc-status').value, q = document.getElementById('fc-q').value.trim();
  const list = FC.filter(x => { const d = x.at.slice(0, 10); return d >= a && d <= b && (!st || x.store === st) && (!ss || fcStatus(x) === ss) && (!q || x.items.some(i => i[1].includes(q))); });
  const amt = list.reduce((s, x) => s + x.total, 0);
  LAST = { head: ['등록일시', '매장', '작성자', '상태', '품목', '금액', '관리번호'], body: list.map(x => [fcDate(x.at), x.store, x.by, fcStatus(x), fcItems(x), x.total, x.no]) };
  document.getElementById('res').innerHTML = `
   <div class="sum period"><div class="k hl"><div class="l">${ic('coin')}발주 금액</div><div class="v">${fmt(amt)}<small>원</small></div></div>
   <div class="k"><div class="l">${ic('file')}발주 건수</div><div class="v">${list.length}<small>건</small></div></div>
   <div class="k"><div class="l">${ic('info')}미확인</div><div class="v">${list.filter(x => fcStatus(x) === '미확인').length}<small>건</small></div></div>
   <div class="k"><div class="l">${ic('clock')}진행중</div><div class="v">${list.filter(x => fcStatus(x) === '진행중').length}<small>건</small></div></div></div>
   <div class="card"><div class="meta"><div class="left"><strong>발주 목록</strong><span class="count">${list.length}건</span></div><button class="btn ghost" onclick="dlCsv('FC다움_본사발주')">${ic('download')}CSV 다운로드</button></div>
   <div class="fc-list tall">${list.length ? list.map(fcRow).join('') : '<div class="empty">조건에 맞는 발주가 없어요.</div>'}</div></div>`;
}
// 메뉴: 발주 관리를 펼치는 메뉴로
const renderSideV32 = renderSide;
renderSide = function(active){
  renderSideV32(active);
  const btn = [...document.querySelectorAll('#side .cat')].find(b => b.textContent.includes('발주 관리'));
  if (!btn) return;
  const open = active === 'fc-orders';
  btn.outerHTML = `<button class="cat ${open?'open':''}" onclick="const on=this.classList.toggle('open');this.nextElementSibling.classList.toggle('open',on)">${ic('box')}발주 관리${ic('chevron').replace('class="icon"','class="icon ar"')}</button><div class="sub ${open?'open':''}"><a role="button" tabindex="0" class="${open?'on':''}" onclick="go('fc-orders')">FC다움 본사 발주</a></div>`;
};
const goV32 = go;
go = function(p, t){ if (p === 'fc-orders'){ closeSide(); renderSide('fc-orders'); return pageFcOrders(); } return goV32(p, t); };
