// v3.1: 기간별 공급가 조회 - 추가 조건 (기본 접힘)
const STORE_META=MASTER;
const metaOf=s=>STORE_META[s]||{type:'가맹',status:'영업중'};
const CATS=[...new Set(ROWS.map(r=>r.cat).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
function syncBasis(){const want=document.getElementById('adv-order')?.checked?'order':'ship';document.querySelectorAll('#basis button').forEach(b=>b.classList.toggle('on',b.dataset.v===want));const sp=document.querySelector('label[for=d1] span');if(sp)sp.textContent=want==='order'?'주문일 기준':'배송일 기준';}
const filteredBase=filtered;
filtered=function(){
  let rows=filteredBase();
  const cat=document.getElementById('adv-cat')?.value||'';
  const type=document.getElementById('adv-type')?.value||'';
  const activeOnly=document.getElementById('adv-active')?.checked;
  if(cat) rows=rows.filter(r=>r.cat===cat);
  if(type) rows=rows.filter(r=>metaOf(r.store).type===type);
  if(activeOnly) rows=rows.filter(r=>metaOf(r.store).status==='영업중');
  return rows;
};
function advBlock(){
  return `<details class="adv" id="adv" ontoggle="advCount()">
   <summary><span class="adv-t">${ic('filter')}추가 조건</span><span class="adv-badge" id="adv-badge"></span><span class="adv-h">필요할 때만 펼쳐서 사용하세요</span>${ic('chevron').replace('class="icon"','class="icon adv-ar"')}</summary>
   <div class="adv-grid">
    <label class="adv-chk"><input type="checkbox" id="adv-order" onchange="advCount()"><span><b>주문(발주)일 기준으로 보기</b><small>기본은 배송일 기준이에요. 켜면 월 보고서 숫자와 다를 수 있어요.</small></span></label>
    <label class="adv-chk"><input type="checkbox" id="adv-active" onchange="advCount()"><span><b>현재 영업중 매장만 보기</b><small>끄면 그 기간에 주문한 폐점 매장도 포함돼요. (기본: 포함)</small></span></label>
    <div class="f"><label for="adv-cat">품목 대분류</label><select id="adv-cat" onchange="advCount()"><option value="">전체 품목</option>${CATS.map(c=>`<option>${c}</option>`).join('')}</select></div>
    <div class="f"><label for="adv-type">매장 유형<span>유형 입력 전: 쌍용점만 직영</span></label><select id="adv-type" onchange="advCount()"><option value="">전체</option><option>직영</option><option>가맹</option><option>딜리버리</option></select></div>
    <div class="f"><label for="pq">제품 검색<span>선택</span></label><input type="text" id="pq" placeholder="예: 육수, 차슈, 면" oninput="advCount()"></div>
   </div></details>`;
}
function advCount(){
  const n=[document.getElementById('adv-order')?.checked,document.getElementById('adv-active')?.checked,document.getElementById('adv-cat')?.value,document.getElementById('adv-type')?.value,document.getElementById('pq')?.value?.trim()].filter(Boolean).length;
  const b=document.getElementById('adv-badge'); if(b){b.textContent=n?`${n}개 적용`:'';b.style.display=n?'inline-block':'none'}
}
const pageStoreBase=pageStoreOrders;pageStoreOrders=function(){pageStoreBase();};
const pagePeriodBase=pagePeriodSales;
pagePeriodSales=function(){
  pagePeriodBase();
  const actions=document.querySelector('.query-card .actions');
  actions.insertAdjacentHTML('beforebegin',advBlock());
  advCount();
};
const runPeriodV31=runPeriod;
runPeriod=function(){
  syncBasis();
  runPeriodV31();
  const res=document.getElementById('res'); if(!res||!res.firstElementChild) return;
  const msgs=[];
  if(document.getElementById('adv-order')?.checked) msgs.push('<b>주문(발주)일 기준</b>으로 집계했어요. 배송일 기준인 월 보고서·매출과 숫자가 다를 수 있어요.');
  const extra=[document.getElementById('adv-active')?.checked&&'영업중 매장만',document.getElementById('adv-cat')?.value&&('대분류: '+document.getElementById('adv-cat').value),document.getElementById('adv-type')?.value&&('유형: '+document.getElementById('adv-type').value),document.getElementById('pq')?.value?.trim()&&('제품: '+document.getElementById('pq').value.trim())].filter(Boolean);
  if(extra.length) msgs.push('추가 조건 적용: '+extra.join(' · '));
  if(msgs.length) res.insertAdjacentHTML('afterbegin',`<div class="adv-warn ${document.getElementById('adv-order')?.checked?'order':''}">${ic('info')}<div>${msgs.join('<br>')}</div></div>`);
};
