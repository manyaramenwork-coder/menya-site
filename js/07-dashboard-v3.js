// v3: dashboard first after login
renderSide=function(active){
 const nav=brandMenus.map(([id,icon,title])=>{
  if(id==='dash')return `<button class="cat ${active==='dash'?'open on-dash':''}" onclick="go('dash')">${ic(icon)}${title}</button>`;
  if(id==='jette'){const open=active==='store-orders'||active==='period-sales';return `<button class="cat ${open?'open':''}" aria-expanded="${open}" onclick="const on=this.classList.toggle('open');this.nextElementSibling.classList.toggle('open',on);this.setAttribute('aria-expanded',on)">${ic(icon)}${title}${ic('chevron').replace('class="icon"','class="icon ar"')}</button><div class="sub ${open?'open':''}"><a role="button" tabindex="0" class="${active==='store-orders'?'on':''}" onclick="go('store-orders')">매장별 주문내역 조회</a><a role="button" tabindex="0" class="${active==='period-sales'?'on':''}" onclick="go('period-sales')">기간별 공급가 조회</a></div>`}
  return `<button class="cat" onclick="go('soon','${title}')">${ic(icon)}${title}<span class="soon">준비중</span></button>`}).join('');
 document.getElementById('side').innerHTML=`<div class="side-brand"><a class="side-home" href="http://xn--oy2b1b9w518abwh.com/index.php" target="_blank" rel="noopener" title="멘야마쯔리 홈페이지 열기" aria-label="멘야마쯔리 홈페이지 열기 (새 창)"><img src="${BRAND.light}" alt="멘야마쯔리 브랜드 로고"></a><button class="side-close" onclick="closeSide()" aria-label="메뉴 닫기">${ic('close')}</button></div><div class="workspace"><div class="box">HQ</div><div>멘야마쯔리 본사<small>STORE MANAGEMENT</small></div></div><div class="nav-label">WORKSPACE</div><div class="nav-items">${nav}</div><div class="side-bottom"><div class="brand-mini"><strong>한 그릇의 정성, 매장의 기준.</strong><small>MENYAMATSURI COMPANY</small></div><div class="side-copyright">MENYAMATSURI · INTERNAL WORKSPACE<br>© MENYAMATSURI COMPANY</div></div>`;
};
const goV2=go;
go=function(p,title){if(p==='dash'){closeSide();renderSide('dash');return pageDashboard()}return goV2(p,title)};
function openStore(store){go('store-orders');const s=document.getElementById('st');s.value=store;document.querySelector('#view button[data-v="product"]').click();runStoreOrders();document.getElementById('res').scrollIntoView({behavior:'smooth'})}
function pageDashboard(){
 // v5.2: 서버(dash_data)에서 집계한 결과 사용 — 계산 방식은 기존과 동일
 const J=DASH.jt||{supply:0,orders:0,stores:[],prods:[]};
 const supply=J.supply, orders=J.orders;
 const stores=J.stores.map(s=>({store:s[0],supply:s[1],orders:{size:s[2]}}));const maxS=stores.length?stores[0].supply||1:1;
 const prods=J.prods.map(p=>({name:String(p[1]).replace(/\(.*$/,'').replace(/_.*$/,''),supply:p[2]}));const maxP=prods.length?prods[0].supply||1:1;
 const low=stores.slice(-3).reverse();
 document.getElementById('main').innerHTML=`
 <div class="crumb">${ic('home')}<span>워크스페이스</span><span>/</span><span>대시보드</span></div>
 <header class="page-hero"><div class="hero-copy"><div class="eyebrow">DASHBOARD · ${META.dashLabel}</div><h1>안녕하세요, ${greetName()}</h1><p>이번 달 매장 공급 현황을 한눈에 확인하세요. 매장을 누르면 상세 주문내역으로 이동해요.</p></div><div class="hero-image"><span>MENYAMATSURI</span></div></header>
 ${dataNote()}
 <div class="sum dash-sum">
  <div class="k hl"><div class="l">${ic('coin')}제때 공급가 (부가세 제외)</div><div class="v">${fmt(supply)}<small>원</small></div></div>
  <div class="k"><div class="l">${ic('file')}주문 건수</div><div class="v">${fmt(orders)}<small>건</small></div></div>
  <div class="k"><div class="l">${ic('store')}거래 매장</div><div class="v">${stores.length}<small>곳</small></div></div>
  <div class="k"><div class="l">${ic('grid')}매장당 평균 공급가</div><div class="v">${fmt(stores.length?supply/stores.length:0)}<small>원</small></div></div>
 </div>
 <div class="dash-grid">
  <section class="card"><div class="section-title"><strong>${ic('store')}매장별 공급가 순위</strong><small>막대를 누르면 상세 조회</small></div>
   <div class="rank">${stores.map((s,i)=>`<button class="rank-row" onclick="openStore('${s.store}')"><span class="rk ${i<3?'first':''}">${i+1}</span><span class="rn">${s.store}</span><span class="rb"><i style="width:${Math.max(3,s.supply/maxS*100)}%"></i></span><span class="rv">${fmt(s.supply)}</span></button>`).join('')}</div></section>
  <div class="dash-col">
   <section class="card"><div class="section-title"><strong>${ic('box')}품목별 공급가 TOP 8</strong><small>${META.dashLabel} 전체 매장</small></div>
    <div class="prod">${prods.map(p=>`<div class="prod-row"><span class="pn" title="${p.name}">${p.name}</span><span class="pb"><i style="width:${Math.max(3,p.supply/maxP*100)}%"></i></span><span class="pv">${fmt(p.supply/10000)}만</span></div>`).join('')}</div></section>
   <section class="card"><div class="section-title"><strong>${ic('info')}확인이 필요한 매장</strong><small>공급가 하위 3곳</small></div>
    ${low.map(s=>`<button class="alert-row" onclick="openStore('${s.store}')"><span>${s.store}</span><span>${fmt(s.supply)}원 · ${s.orders.size}건</span></button>`).join('')}</section>
  </div>
 </div>
 <section class="card"><div class="section-title"><strong>${ic('grid')}바로가기</strong></div><div class="shortcuts">
  <button onclick="go('store-orders')">${ic('truck')}<b>매장별 주문내역 조회</b><small>제때 관리</small></button>
  <button onclick="go('period-sales')">${ic('coin')}<b>기간별 공급가 조회</b><small>제때 관리</small></button>
  <button onclick="go('soon','매장 관리')">${ic('store')}<b>매장 관리</b><small>준비중</small></button>
  <button onclick="go('soon','매뉴얼 관리')">${ic('book')}<b>매뉴얼 관리</b><small>준비중</small></button>
 </div></section>`+pageFoot();
}
doLogin=function(){const id=document.getElementById('uid'),pw=document.getElementById('upw');if(id.value.trim()==='admin'&&pw.value==='1234'){document.getElementById('login').style.display='none';document.getElementById('app').style.display='block';document.getElementById('lerr').textContent='';go('dash');window.scrollTo(0,0)}else{document.getElementById('lerr').textContent='아이디 또는 비밀번호가 맞지 않아요.'}};
