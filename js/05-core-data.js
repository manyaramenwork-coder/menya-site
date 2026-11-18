
// ===== 데이터 자리 (2~6회차에서 메뉴별로 Supabase에서 채움) =====
let META = {jetteFrom:'',jetteTo:'',jetteUpdated:'',dashMonth:'',dashLabel:'',curFrom:'',prevFrom:'',prevTo:'',q3From:'',fcSynced:'',salesUpdated:'',fcVer:'',attSrc:''};
let MASTER = {};
let DATA_USERS = [];
let RAW = {rows:[],stores:[],prods:[],min:'',max:''};
let DASH = {jt:null};
// 행: [배송일, 주문일, 매장, 제품코드, 제품명, 대구분, 판매단위, 과세, 수량, 단가, 공급가, 부가세, 합계, 주문번호]
let ROWS = RAW.rows.map(r => { const p = RAW.prods[r[3]]; return {ship:r[0],order:r[1],store:RAW.stores[r[2]],code:p[0],name:p[1],cat:p[2],unit:p[3],tax:p[4],qty:r[4],price:r[5],supply:r[6],vat:r[7],total:r[8],no:r[9]}; });
let ALLROWS = ROWS;
let STORES = [...new Set(ROWS.map(r=>r.store))].sort((a,b)=>a.localeCompare(b,'ko'));
let DMIN = RAW.min, DMAX = RAW.max;
const fmt = n => Math.round(n).toLocaleString('ko-KR');

const MENU = [
  {id:'dash', icon:'🏠', name:'대시보드', soon:true},
  {id:'jette', icon:'🚚', name:'제때 관리', items:[
    {id:'store-orders', name:'매장별 주문내역 조회'},
    {id:'period-sales', name:'기간별 공급가 조회'},
  ]},
  {id:'supply', icon:'💰', name:'공급가 · 원가', soon:true},
  {id:'po', icon:'📦', name:'발주 관리', soon:true},
  {id:'manual', icon:'📘', name:'매뉴얼 관리', soon:true},
  {id:'store', icon:'🏪', name:'매장 관리', soon:true},
];

function renderSide(active){
  const s = document.getElementById('side');
  s.innerHTML = MENU.map(m => {
    if (m.soon) return `<div class="cat" onclick="go('soon','${m.name}')"><span>${m.icon}</span>${m.name}<span class="soon">준비중</span></div>`;
    const open = m.items.some(i=>i.id===active) || m.id==='jette';
    return `<div class="cat ${open?'open':''}" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')"><span>${m.icon}</span>${m.name}<span class="ar">▶</span></div>
      <div class="sub ${open?'open':''}">${m.items.map(i=>`<a class="${i.id===active?'on':''}" onclick="go('${i.id}')">${i.name}</a>`).join('')}</div>`;
  }).join('');
}

function go(page, title){
  document.querySelector('.side').classList.remove('show');
  renderSide(page);
  if (page==='store-orders') return pageStoreOrders();
  if (page==='period-sales') return pagePeriodSales();
  document.getElementById('main').innerHTML = `<div class="crumb">홈</div><h1>${title}</h1><div class="card placeholder"><div class="i">🛠️</div>이 메뉴는 다음 단계에서 만들 예정이에요.</div>`;
}

const storeOptions = (withAll=true) => (withAll?'<option value="">전체 매장</option>':'') + STORES.map(s=>`<option>${s}</option>`).join('');
let dateBlock = () => `
  <div class="f"><label>기간</label>
    <div class="daterow"><input type="date" id="d1" value="${META.curFrom}"><span>~</span><input type="date" id="d2" value="${DMAX}"></div>
    <div class="quick"><button onclick="setRange('m')">이번 달</button><button onclick="setRange('w1')">지난달</button><button onclick="setRange('h2')">최근 3개월</button></div>
  </div>`;
function setRange(k){
  const r = {m:[META.curFrom,DMAX], w1:[META.prevFrom,META.prevTo], h2:[META.q3From,DMAX]}[k];
  d1.value=r[0]; d2.value=r[1];
}
function segHtml(id, opts){ return `<div class="seg" id="${id}">${opts.map((o,i)=>`<button class="${i===0?'on':''}" data-v="${o[0]}" onclick="[...this.parentNode.children].forEach(b=>b.classList.remove('on'));this.classList.add('on')">${o[1]}</button>`).join('')}</div>`; }
const segVal = id => document.querySelector(`#${id} .on`).dataset.v;

function filtered(){
  const a=d1.value, b=d2.value, st=document.getElementById('st').value, basis=segVal('basis');
  const q=(document.getElementById('pq')?.value||'').trim();
  return ROWS.filter(r => { const d = basis==='ship'?r.ship:r.order; return d>=a && d<=b && (!st||r.store===st) && (!q||r.name.includes(q)||r.code.includes(q)); });
}

/* 매장별 주문내역 조회 */
function pageStoreOrders(){
  document.getElementById('main').innerHTML = `
    <div class="crumb">제때 관리 › 조회</div><h1>매장별 주문내역 조회</h1>
    <div class="notice">시안 데이터: 제때(JETTE) 가맹본부 계정에서 받은 2026년 9월 실제 주문 데이터예요. 실제 운영 시에는 매일 자동으로 업데이트돼요.</div>
    <div class="card">
      <div class="filters">
        ${dateBlock()}
        <div class="f"><label>매장</label><select id="st">${storeOptions()}</select></div>
        <div class="f"><label>날짜 기준</label>${segHtml('basis',[['ship','배송일'],['order','주문(발주)일']])}</div>
        <div class="f"><label>보기 방식</label>${segHtml('view',[['order','주문건별'],['product','제품별'],['item','상세(전체)']])}</div>
        <div class="f"><label>제품 검색 (선택)</label><input type="text" id="pq" placeholder="예: 육수, 차슈, 교자"></div>
      </div>
      <div class="actions"><button class="btn ghost" onclick="pageStoreOrders()">초기화</button><button class="btn" onclick="runStoreOrders()">🔍 조회</button></div>
    </div>
    <div id="res"></div>`;
  runStoreOrders();
}
let LAST=null;
function runStoreOrders(){
  const rows = filtered(), view = segVal('view');
  const sum = k => rows.reduce((s,r)=>s+r[k],0);
  const orders = new Set(rows.map(r=>r.no)).size, stores = new Set(rows.map(r=>r.store)).size;
  let head, body, foot, csv;
  if (view==='order'){
    const m = {};
    rows.forEach(r=>{ const o = m[r.no] ||= {ship:r.ship,order:r.order,store:r.store,no:r.no,lines:0,qty:0,supply:0,vat:0,total:0}; o.lines++; o.qty+=r.qty; o.supply+=r.supply; o.vat+=r.vat; o.total+=r.total; });
    const list = Object.values(m).sort((a,b)=>a.ship.localeCompare(b.ship)||a.store.localeCompare(b.store,'ko'));
    head = ['배송일','주문일','매장','주문번호','품목수','수량','공급가','부가세','합계'];
    body = list.map(o=>[o.ship,o.order,o.store,o.no,o.lines,o.qty,o.supply,o.vat,o.total]);
  } else if (view==='product'){
    const m = {};
    rows.forEach(r=>{ const o = m[r.code] ||= {code:r.code,name:r.name,cat:r.cat,unit:r.unit,qty:0,supply:0,vat:0,total:0,stores:new Set()}; o.qty+=r.qty; o.supply+=r.supply; o.vat+=r.vat; o.total+=r.total; o.stores.add(r.store); });
    const list = Object.values(m).sort((a,b)=>b.supply-a.supply);
    head = ['제품코드','제품명','구분','단위','주문매장수','수량','공급가','부가세','합계'];
    body = list.map(o=>[o.code,o.name,o.cat,o.unit,o.stores.size,o.qty,o.supply,o.vat,o.total]);
  } else {
    head = ['배송일','주문일','매장','제품명','단위','수량','단가','공급가','부가세','합계'];
    body = rows.slice().sort((a,b)=>a.ship.localeCompare(b.ship)).map(r=>[r.ship,r.order,r.store,r.name,r.unit,r.qty,r.price,r.supply,r.vat,r.total]);
  }
  const numFrom = head.length - (view==='item'?5:4);
  LAST = {head, body};
  const totals = head.map((h,i)=> i===0 ? '합계' : (['수량','공급가','부가세','합계','품목수'].includes(h) ? fmt(body.reduce((s,r)=>s+r[i],0)) : ''));
  document.getElementById('res').innerHTML = `
    <div class="sum">
      <div class="k"><div class="l">주문 건수</div><div class="v">${fmt(orders)}건</div></div>
      <div class="k"><div class="l">주문 매장</div><div class="v">${stores}곳</div></div>
      <div class="k hl"><div class="l">공급가 (부가세 제외)</div><div class="v">${fmt(sum('supply'))}원</div></div>
      <div class="k"><div class="l">부가세</div><div class="v">${fmt(sum('vat'))}원</div></div>
      <div class="k"><div class="l">합계</div><div class="v">${fmt(sum('total'))}원</div></div>
    </div>
    <div class="card">
      <div class="meta"><span>${fmt(body.length)}행</span><button class="btn ghost" style="padding:6px 12px;font-size:12px" onclick="dlCsv('매장별_주문내역')">⬇ 엑셀(CSV) 다운로드</button></div>
      ${body.length ? `<div class="tbl-wrap"><table><thead><tr>${head.map((h,i)=>`<th class="${i>=numFrom?'n':''}">${h}</th>`).join('')}</tr></thead>
      <tbody>${body.map(r=>`<tr>${r.map((v,i)=>`<td class="${i>=numFrom?'n':''}">${typeof v==='number'?fmt(v):v}</td>`).join('')}</tr>`).join('')}</tbody>
      <tfoot><tr>${totals.map((v,i)=>`<td class="${i>=numFrom?'n':''}">${v}</td>`).join('')}</tr></tfoot></table></div>` : '<div class="empty">조건에 맞는 주문이 없어요.</div>'}
    </div>`;
}

/* 기간별 공급가 조회 */
function pagePeriodSales(){
  document.getElementById('main').innerHTML = `
    <div class="crumb">제때 관리 › 조회</div><h1>기간별 공급가 조회</h1>
    <div class="notice">매장별로 기간 내 제때 공급가 합계를 보여줘요. 순매출(POS)을 연결하면 <b>공급가 비율</b> 열이 추가돼서 기존 월말 보고서를 대신할 수 있어요.</div>
    <div class="card">
      <div class="filters">
        ${dateBlock()}
        <div class="f"><label>매장</label><select id="st">${storeOptions()}</select></div>
        <div class="f"><label>날짜 기준</label>${segHtml('basis',[['ship','배송일'],['order','주문(발주)일']])}</div>
        <div class="f"><label>묶음 단위</label>${segHtml('grp',[['store','매장별'],['day','일별'],['week','주별']])}</div>
      </div>
      <div class="actions"><button class="btn ghost" onclick="pagePeriodSales()">초기화</button><button class="btn" onclick="runPeriod()">🔍 조회</button></div>
    </div>
    <div id="res"></div>`;
  runPeriod();
}
function weekKey(d){ const day = +d.slice(8,10); return `${d.slice(0,7)} ${Math.ceil(day/7)}주차`; }
function runPeriod(){
  const rows = filtered(), g = segVal('grp'), basis = segVal('basis');
  const key = r => g==='store' ? r.store : g==='day' ? (basis==='ship'?r.ship:r.order) : weekKey(basis==='ship'?r.ship:r.order);
  const m = {};
  rows.forEach(r=>{ const k=key(r); const o = m[k] ||= {k,orders:new Set(),supply:0,vat:0,total:0}; o.orders.add(r.no); o.supply+=r.supply; o.vat+=r.vat; o.total+=r.total; });
  let list = Object.values(m);
  list = g==='store' ? list.sort((a,b)=>b.supply-a.supply) : list.sort((a,b)=>a.k.localeCompare(b.k));
  const max = Math.max(1,...list.map(o=>o.supply)), tot = list.reduce((s,o)=>s+o.supply,0);
  const label = {store:'매장',day:'날짜',week:'주차'}[g];
  LAST = {head:[label,'주문건수','공급가','부가세','합계','비중(%)'], body:list.map(o=>[o.k,o.orders.size,o.supply,o.vat,o.total,(o.supply/tot*100).toFixed(1)])};
  document.getElementById('res').innerHTML = `
    <div class="sum">
      <div class="k hl"><div class="l">기간 공급가 합계</div><div class="v">${fmt(tot)}원</div></div>
      <div class="k"><div class="l">${label} 수</div><div class="v">${list.length}</div></div>
      <div class="k"><div class="l">${label}당 평균</div><div class="v">${fmt(list.length?tot/list.length:0)}원</div></div>
      <div class="k"><div class="l">순매출 대비 비율</div><div class="v" style="font-size:14px;color:var(--sub)">POS 연결 후 표시</div></div>
    </div>
    <div class="card">
      <div class="meta"><span>${list.length}행</span><button class="btn ghost" style="padding:6px 12px;font-size:12px" onclick="dlCsv('기간별_공급가')">⬇ 엑셀(CSV) 다운로드</button></div>
      ${list.length?`<div class="tbl-wrap"><table><thead><tr><th>${label}</th><th class="n">주문건수</th><th>공급가</th><th class="n">부가세</th><th class="n">합계</th><th class="n">비중</th></tr></thead><tbody>
      ${list.map(o=>`<tr><td>${o.k}</td><td class="n">${o.orders.size}</td><td><span class="bar" style="width:${Math.max(2,o.supply/max*160)}px"></span>${fmt(o.supply)}</td><td class="n">${fmt(o.vat)}</td><td class="n">${fmt(o.total)}</td><td class="n">${(o.supply/tot*100).toFixed(1)}%</td></tr>`).join('')}
      </tbody><tfoot><tr><td>합계</td><td class="n">${fmt(new Set(rows.map(r=>r.no)).size)}</td><td>${fmt(tot)}</td><td class="n">${fmt(list.reduce((s,o)=>s+o.vat,0))}</td><td class="n">${fmt(list.reduce((s,o)=>s+o.total,0))}</td><td class="n">100%</td></tr></tfoot></table></div>`:'<div class="empty">조건에 맞는 데이터가 없어요.</div>'}
    </div>`;
}

function dlCsv(name){
  if(!LAST) return;
  const esc = v => `"${String(v).replace(/"/g,'""')}"`;
  const csv = '\ufeff' + [LAST.head, ...LAST.body].map(r=>r.map(esc).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download = `${name}_${d1.value}_${d2.value}.csv`; a.click();
}

function doLogin(){
  if (uid.value.trim()==='admin' && upw.value==='1234'){ login.style.display='none'; app.style.display='block'; go('store-orders'); }
  else lerr.textContent = '아이디 또는 비밀번호가 맞지 않아요.';
}
function logout(){ app.style.display='none'; login.style.display='flex'; upw.value=''; }
