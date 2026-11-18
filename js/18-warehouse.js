
/* ---------- 본사 창고 관리: 재고 현황 / 입·출고 등록 / 입·출고 내역 ---------- */
let INV = {items:[],moves:[]}; // {items:[...], moves:[[일자,구분,코드,수량,거래처,메모,담당자,등록시각]]}
PATHS.warehouse = 'M3 21V9l9-6 9 6v12 M7 21v-8h10v8 M7 17h10';
const ih = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const iAdd = (d, k) => new Date(new Date(d + 'T00:00:00Z').getTime() + k * 864e5).toISOString().slice(0, 10);
const iNorm = s => String(s || '').replace(/\s+/g, '').replace(/[_\[\]()]/g, '');
const INV_CATS = ['식자재','일회용품','스티커','유니폼','식기','비품'];
const iName = it => it ? it.name + (it.spec ? ' · ' + it.spec : '') : '(삭제된 품목)';
const iItem = code => INV.items.find(x => x.code === code);
const iStores = () => Object.keys(MASTER).filter(k => MASTER[k].status === '영업중').sort((a, b) => a.localeCompare(b, 'ko'));

/* FC다움 본사 택배 발주 → 완료된 건은 자동 출고 */
function invFcMoves(){
  const out = [];
  FC.forEach(q => {
    const st = fcStatus(q); if (st === '미확인') return;
    q.items.forEach(i => {
      const n = iNorm(i[1]);
      const it = INV.items.find(x => x.fc && n.indexOf(iNorm(x.fc)) >= 0);
      const when = st === '완료' && q.doneAt ? q.doneAt : q.at; // 완료된 발주는 완료 시각 기준으로 차감
      if (it) out.push({date: when.slice(0, 10), key: when.slice(0, 16), type: st === '완료' ? 'FC출고' : 'FC예정', code: it.code, qty: i[2], party: q.store, memo: 'FC다움 ' + q.no + ' · ' + i[1].replace(/\s+/g, ' '), by: q.by});
    });
  });
  return out;
}
function invAllMoves(){
  const man = INV.moves.map(m => ({date: m[0], key: m[0] + ' ' + ((m[7] || '').slice(11, 16) || '23:59'), type: m[1], code: m[2], qty: m[3], party: m[4], memo: m[5], by: m[6], id: m[8], reg: m[9]}));
  return man.concat(invFcMoves()).sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}
function invCalc(){
  const all = invAllMoves(), today = iToday(), d30 = iAdd(today, -30), res = {};
  INV.items.forEach(it => res[it.code] = {it, base: null, baseDate: '', qty: 0, out30: 0, pending: 0, lastIn: ''});
  all.forEach(m => {
    const r = res[m.code]; if (!r) return;
    if (m.type === '재고조사') { r.base = m.qty; r.baseDate = m.date; r.qty = m.qty; return; }
    if (m.type === 'FC예정') { r.pending += m.qty; return; }
    const sign = m.type === '입고' ? 1 : -1;
    r.qty += sign * m.qty;
    if (m.type === '입고') r.lastIn = m.date;
    if (sign < 0 && m.date >= d30) r.out30 += m.qty;
  });
  return Object.values(res).map(r => {
    const known = r.base !== null;
    const low = known && r.it.min > 0 && r.qty <= r.it.min;
    const days = known && r.out30 > 0 ? Math.floor(r.qty / (r.out30 / 30)) : null;
    return Object.assign(r, {known, low, days, state: !known ? '조사 필요' : r.qty < 0 ? '확인 필요' : low ? '부족' : '여유'});
  });
}

/* 공통: 작은 창(모달) */
function iModal(title, body, onSave, saveLabel){
  document.getElementById('inv-modal')?.remove();
  const m = document.createElement('div'); m.id = 'inv-modal';
  m.innerHTML = `<div class="im-bg" onclick="document.getElementById('inv-modal').remove()"></div><div class="im-box" role="dialog" aria-label="${ih(title)}"><div class="im-head"><strong>${ih(title)}</strong><button class="im-x" onclick="document.getElementById('inv-modal').remove()" aria-label="닫기">${ic('close')}</button></div><div class="im-body">${body}</div><div class="im-foot"><button class="btn ghost" onclick="document.getElementById('inv-modal').remove()">취소</button><button class="btn primary" id="im-save">${saveLabel || '저장'}</button></div></div>`;
  document.body.appendChild(m);
  document.getElementById('im-save').onclick = onSave;
  setTimeout(() => m.querySelector('input:not([type=hidden]),select')?.focus(), 50);
}
function iSaveMoves(list, after){
  const btn = document.getElementById('im-save') || document.getElementById('io-save'); if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
  const done = r => {
    list.forEach(m => INV.moves.push([m.date, m.type, m.code, +m.qty, m.party || '', m.memo || '', (r && r.by) || (SESSION.user && SESSION.user.name) || '', (r && r.at) || (iToday() + ' 00:00')]));
    document.getElementById('inv-modal')?.remove(); toast(list.length + '건 저장했어요.'); after && after();
  };
  if (window.google && google.script && google.script.run) google.script.run.withSuccessHandler(done).withFailureHandler(e => { if (btn) { btn.disabled = false; btn.textContent = '저장'; } toast('저장 실패: ' + e.message); }).saveInvMoves(list, SESSION.token);
  else done(null);
}
function iStoreOptions(sel){ return `<option value="">선택 안 함</option>` + iStores().map(s => `<option ${s === sel ? 'selected' : ''}>${ih(s)}</option>`).join('') + `<option value="__etc">직접 입력</option>`; }

/* 1) 재고 현황 */
let INV_CAT = '';
function pageInvStock(){
  document.getElementById('main').innerHTML = simpleHero(['본사 창고 관리','재고 현황'], 'WAREHOUSE · STOCK', '본사 창고 재고 현황', '가맹점에 납품하는 본사 창고 재고예요. FC다움 본사 택배 발주가 완료되면 자동으로 빠져요.') +
  `<div class="data-note"><span class="status-dot"></span><span>현재고 = 마지막 재고조사 + 이후 입고 − 출고 (FC다움 완료 건 자동 포함)</span><span class="tag">테스트 운영</span></div>
  <div id="inv-kpi"></div>
  <section class="card query-card"><div class="inv-bar">
    <div class="inv-chips">${['', ...INV_CATS].map(c => `<button class="chip ${c === INV_CAT ? 'on' : ''}" onclick="INV_CAT='${c}';document.querySelectorAll('.inv-chips .chip').forEach(b=>b.classList.toggle('on',b===this));runInvStock()">${c || '전체'}</button>`).join('')}</div>
    <input type="search" id="inv-q" placeholder="품목·업체 검색" oninput="runInvStock()">
    <label class="adv-chk inline"><input type="checkbox" id="inv-low" onchange="runInvStock()"><span><b>부족·조사 필요만</b></span></label>
    <span class="inv-acts"><button class="btn ghost" onclick="invItemModal()">${ic('check')}품목 추가</button><button class="btn primary" onclick="go('inv-io')">${ic('box')}입·출고 등록</button></span>
  </div></section><div id="res"></div>` + pageFoot();
  runInvStock();
}
function runInvStock(){
  const rows = invCalc().filter(r => r.it.use !== '중지');
  const k = {all: rows.length, low: rows.filter(r => r.state === '부족' || r.state === '확인 필요').length, unk: rows.filter(r => !r.known).length,
    amt: rows.reduce((s, r) => s + (r.known && r.qty > 0 ? r.qty * r.it.cost : 0), 0)};
  document.getElementById('inv-kpi').innerHTML = `<div class="sum period">
    <div class="k"><div class="l">${ic('box')}관리 품목</div><div class="v">${k.all}<small>개</small></div></div>
    <div class="k ${k.low ? 'hl' : ''}"><div class="l">${ic('info')}부족 (적정재고 이하)</div><div class="v">${k.low}<small>개</small></div></div>
    <div class="k"><div class="l">${ic('search')}재고조사 필요</div><div class="v">${k.unk}<small>개</small></div></div>
    <div class="k"><div class="l">${ic('coin')}재고 금액 (매입가)</div><div class="v">${fmt(k.amt)}<small>원</small></div></div></div>`;
  const q = (document.getElementById('inv-q')?.value || '').trim(), onlyLow = document.getElementById('inv-low')?.checked;
  const order = {'부족': 0, '확인 필요': 0, '조사 필요': 1, '여유': 2};
  const list = rows.filter(r => (!INV_CAT || r.it.cat === INV_CAT) && (!q || (r.it.name + r.it.spec + r.it.vendor).includes(q)) && (!onlyLow || r.state !== '여유'))
    .sort((a, b) => order[a.state] - order[b.state] || INV_CATS.indexOf(a.it.cat) - INV_CATS.indexOf(b.it.cat) || a.it.code.localeCompare(b.it.code));
  LAST = {head: ['코드','분류','품목','규격','현재고','단위','상태','적정재고','최근30일 출고','출고 대기(FC 진행중)','매입단가','출고가','업체','연락처','마지막 재고조사'],
    body: list.map(r => [r.it.code, r.it.cat, r.it.name, r.it.spec, r.known ? r.qty : '', r.it.unit, r.state, r.it.min || '', r.out30, r.pending, r.it.cost, r.it.price, r.it.vendor, r.it.tel, r.baseDate])};
  document.getElementById('res').innerHTML = `<div class="card"><div class="meta"><div class="left"><strong>재고 목록</strong><span class="count">${list.length}개</span></div><button class="btn ghost" onclick="dlCsv('본사창고_재고현황')">${ic('download')}CSV 다운로드</button></div>
   ${list.length ? `<div class="tbl-wrap"><table class="inv-tbl"><thead><tr><th>품목</th><th>분류</th><th class="n">현재고</th><th class="n">적정</th><th class="n">30일 출고</th><th class="n">예상 소진</th><th class="n">출고가</th><th>업체</th><th>마지막 조사</th><th class="n">관리</th></tr></thead><tbody>
   ${list.map(r => `<tr class="${r.state === '부족' || r.state === '확인 필요' ? 'inv-low' : ''}"><td><b>${ih(r.it.name)}</b>${r.it.spec ? `<small>${ih(r.it.spec)}</small>` : ''}${r.it.loc ? `<small class="loc">📍 ${ih(r.it.loc)}</small>` : ''}</td><td>${ih(r.it.cat)}</td>
     <td class="n"><span class="inv-st s-${r.state.replace(' ', '')}">${r.state}</span> <b class="inv-q">${r.known ? fmt(r.qty) : '-'}</b> ${ih(r.it.unit)}${r.pending ? `<small>FC 진행중 ${r.pending}${ih(r.it.unit)} 출고 대기</small>` : ''}</td>
     <td class="n">${r.it.min ? fmt(r.it.min) : '-'}</td><td class="n">${r.out30 ? fmt(r.out30) : '-'}</td><td class="n">${r.days === null ? '-' : r.days + '일'}</td><td class="n">${r.it.price ? fmt(r.it.price) : '-'}</td>
     <td>${ih(r.it.vendor) || '-'}${r.it.tel ? `<small>${ih(mmTel(r.it.tel))}</small>` : ''}</td><td>${r.baseDate ? r.baseDate.slice(2).replace(/-/g, '.') : '<span class="miss">없음</span>'}</td>
     <td class="n inv-btns"><button onclick="invMoveModal('${r.it.code}','입고')">입고</button><button onclick="invMoveModal('${r.it.code}','출고')">출고</button><button onclick="invMoveModal('${r.it.code}','재고조사')">조사</button><button onclick="invItemModal('${r.it.code}')" title="품목 수정">✎</button></td></tr>`).join('')}
   </tbody></table></div>` : '<div class="empty">조건에 맞는 품목이 없어요.</div>'}</div>
   <p class="dash-hint">FC다움 발주가 '진행중'이면 출고 대기로만 표시하고, '완료'가 되면 재고에서 빠져요. 유니폼은 FC다움에 사이즈가 없어서 출고를 직접 등록해주세요.</p>`;
}
function invMoveModal(code, type){
  const it = iItem(code), r = invCalc().find(x => x.it.code === code);
  const party = type === '출고' ? `<div class="f"><label>매장</label><select id="im-party" onchange="document.getElementById('im-etc').style.display=this.value==='__etc'?'':'none'">${iStoreOptions('')}</select><input id="im-etc" placeholder="매장·사유 직접 입력" style="display:none;margin-top:6px"></div>`
    : type === '입고' ? `<div class="f"><label>업체</label><input id="im-party" value="${ih(it.vendor)}"></div>` : '';
  iModal(`${type} · ${iName(it)}`, `
    <p class="im-now">지금 재고: <b>${r && r.known ? fmt(r.qty) + ' ' + ih(it.unit) : '모름 (재고조사 필요)'}</b></p>
    <div class="im-grid"><div class="f"><label>일자</label><input type="date" id="im-date" value="${iToday()}"></div>
    <div class="f"><label>${type === '입고' ? '입고자' : type === '출고' ? '출고자' : '조사자'}</label><input id="im-by" value="${ih(meName())}"></div>
    <div class="f"><label>${type === '재고조사' ? '실제로 센 수량' : '수량'} (${ih(it.unit)})</label><input type="number" id="im-qty" min="0" step="1" inputmode="numeric"></div>
    ${party}<div class="f wide"><label>메모<span>선택</span></label><input id="im-memo" placeholder="${type === '출고' ? '예: 신규 오픈 지원' : type === '입고' ? '예: 10박스 주문분' : '예: 월말 실사'}"></div></div>
    ${type === '출고' && it.fc ? '<p class="im-warn">FC다움으로 들어온 발주는 완료되면 자동으로 빠져요. FC다움 밖에서 나간 것만 등록해주세요.</p>' : ''}`, () => {
    const qty = +document.getElementById('im-qty').value;
    if (!(qty > 0 || (type === '재고조사' && document.getElementById('im-qty').value !== '' && qty >= 0))) return toast('수량을 입력해주세요.');
    let p = document.getElementById('im-party')?.value || ''; if (p === '__etc') p = document.getElementById('im-etc').value.trim();
    iSaveMoves([{date: document.getElementById('im-date').value || iToday(), type, code, qty, party: p, memo: document.getElementById('im-memo').value.trim(), by: (document.getElementById('im-by')?.value || '').trim()}], () => runInvStock());
  });
}
function invItemModal(code){
  const it = code ? iItem(code) : {code: '', cat: INV_CAT || '일회용품', name: '', spec: '', unit: '개', vendor: '', tel: '', how: '', cost: 0, price: 0, min: 0, loc: '', fc: '', memo: '', use: '사용'};
  const f = (id, label, v, extra) => `<div class="f ${extra || ''}"><label>${label}</label><input id="ii-${id}" value="${ih(v)}"></div>`;
  iModal(code ? '품목 수정 · ' + it.code : '품목 추가', `<div class="im-grid">
    <div class="f"><label>분류</label><select id="ii-cat">${INV_CATS.map(c => `<option ${c === it.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    ${f('name', '품목명', it.name)}${f('spec', '규격·사이즈', it.spec)}${f('unit', '단위', it.unit)}
    ${f('vendor', '업체', it.vendor)}${f('tel', '연락처', mmTel(it.tel))}${f('how', '주문방법', it.how)}${f('loc', '창고 위치', it.loc)}
    ${f('cost', '매입단가 (VAT포함)', it.cost)}${f('price', '점주 출고가 (VAT포함)', it.price)}${f('min', '적정재고 (이하면 부족)', it.min)}
    ${f('fc', 'FC다움 품목명 (자동 출고 연결)', it.fc)}${f('memo', '메모', it.memo, 'wide')}
    <div class="f"><label>사용</label><select id="ii-use"><option ${it.use !== '중지' ? 'selected' : ''}>사용</option><option ${it.use === '중지' ? 'selected' : ''}>중지</option></select></div></div>
    ${code ? '' : '<p class="im-warn">추가한 뒤 재고조사로 지금 수량을 한 번 넣어주세요.</p>'}`, () => {
    const g = id => document.getElementById('ii-' + id).value.trim();
    const n = {code: it.code, cat: g('cat'), name: g('name'), spec: g('spec'), unit: g('unit'), vendor: g('vendor'), tel: g('tel'), how: g('how'), cost: +g('cost').replace(/,/g, '') || 0, price: +g('price').replace(/,/g, '') || 0, min: +g('min') || 0, loc: g('loc'), fc: g('fc'), memo: g('memo'), use: g('use')};
    if (!n.name) return toast('품목명을 입력해주세요.');
    const btn = document.getElementById('im-save'); btn.disabled = true; btn.textContent = '저장 중...';
    const done = c => { n.code = c || n.code || ('W' + String(INV.items.length + 1).padStart(3, '0')); const i = INV.items.findIndex(x => x.code === n.code); if (i >= 0) INV.items[i] = n; else INV.items.push(n); document.getElementById('inv-modal')?.remove(); toast('품목을 저장했어요.'); if (document.getElementById('inv-kpi')) runInvStock(); };
    SB.rpc('inv_save_item', { p: n }).then(({ data, error }) => { if (error) { btn.disabled = false; btn.textContent = '저장'; return toast('저장 실패: ' + error.message); } done(data); });
  });
}

/* 2) 입·출고 등록 (여러 품목 한 번에) */
function pageInvIo(){
  const opts = `<option value="">품목 선택</option>` + INV_CATS.map(c => `<optgroup label="${c}">${INV.items.filter(x => x.cat === c && x.use !== '중지').map(x => `<option value="${x.code}">${ih(iName(x))} (${ih(x.unit)})</option>`).join('')}</optgroup>`).join('');
  window.INV_OPTS = opts;
  document.getElementById('main').innerHTML = simpleHero(['본사 창고 관리','입·출고 등록'], 'WAREHOUSE · IN / OUT', '입·출고 등록', '창고에 들어오고 나간 물건, 직접 센 재고를 여러 품목 한 번에 등록하세요.') +
  `<section class="card query-card"><div class="section-title"><strong>${ic('box')}등록 내용</strong></div>
   <div class="filters">
    <div class="f"><label>구분</label>${segHtml('io-type', [['입고','입고 (들어옴)'],['출고','출고 (나감)'],['재고조사','재고조사 (실제 수량)']])}</div>
    <div class="f"><label for="io-date">일자</label><input type="date" id="io-date" value="${iToday()}"></div>
    <div class="f"><label for="io-by" id="io-by-l">입고자</label><input type="text" id="io-by" value="${ih(meName())}" placeholder="실제로 받거나 내준 사람"></div>
    <div class="f" id="io-party-f"></div>
   </div>
   <div id="io-help" class="im-warn"></div>
   <div class="tbl-wrap"><table class="io-tbl"><thead><tr><th>품목</th><th class="n">지금 재고</th><th class="n" id="io-qh">수량</th><th>메모</th><th></th></tr></thead><tbody id="io-lines"></tbody></table></div>
   <div class="actions"><button class="btn ghost" onclick="ioAddLine()">＋ 품목 추가</button><span class="filter-hint" id="io-sum"></span><button class="btn primary" id="io-save" onclick="ioSave()">${ic('check')}저장</button></div>
  </section>` + pageFoot();
  document.querySelectorAll('#io-type button').forEach(b => b.addEventListener('click', () => setTimeout(ioType, 0)));
  ioType(); ioAddLine(); ioAddLine(); ioAddLine();
}
function ioType(){
  const t = segVal('io-type');
  document.getElementById('io-party-f').innerHTML = t === '출고' ? `<label for="io-party">매장</label><select id="io-party" onchange="document.getElementById('io-etc').style.display=this.value==='__etc'?'':'none'">${iStoreOptions('')}</select><input type="text" id="io-etc" placeholder="매장·사유 직접 입력" style="display:none;margin-top:6px">`
    : t === '입고' ? `<label for="io-party">업체<span>선택</span></label><input type="text" id="io-party" placeholder="비우면 품목의 업체로 저장">` : `<label>&nbsp;</label><span class="filter-hint">센 수량이 그대로 현재고가 돼요.</span>`;
  document.getElementById('io-qh').textContent = t === '재고조사' ? '실제 수량' : '수량';
  const byl = document.getElementById('io-by-l'); if (byl) byl.textContent = t === '입고' ? '입고자' : t === '출고' ? '출고자' : '조사자';
  document.getElementById('io-help').innerHTML = t === '출고' ? 'FC다움 본사 택배 발주는 완료되면 자동으로 빠져요. 여기에는 FC다움 밖에서 나간 것(직접 전달, 신규 오픈 지원 등)만 등록해주세요.' : t === '입고' ? '업체에서 물건이 들어오면 등록해주세요. 현재고에 더해져요.' : '창고에서 직접 센 수량을 넣어주세요. 이 수량부터 다시 계산해요.';
}
function ioAddLine(){
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><select class="io-item" onchange="ioNow(this)">${window.INV_OPTS}</select></td><td class="n io-now">-</td><td class="n"><input type="number" class="io-qty" min="0" step="1" inputmode="numeric" oninput="ioSum()"></td><td><input class="io-memo" placeholder="선택"></td><td class="n"><button class="im-x" onclick="this.closest('tr').remove();ioSum()" aria-label="줄 삭제">${ic('close')}</button></td>`;
  document.getElementById('io-lines').appendChild(tr);
}
function ioNow(sel){ const r = invCalc().find(x => x.it.code === sel.value); sel.closest('tr').querySelector('.io-now').textContent = !r ? '-' : r.known ? fmt(r.qty) + ' ' + r.it.unit : '모름'; ioSum(); }
function ioSum(){ const n = [...document.querySelectorAll('#io-lines tr')].filter(tr => tr.querySelector('.io-item').value && tr.querySelector('.io-qty').value !== '').length; document.getElementById('io-sum').textContent = n ? n + '개 품목 저장 준비' : ''; }
function ioSave(){
  const t = segVal('io-type'), date = document.getElementById('io-date').value || iToday();
  let p = document.getElementById('io-party')?.value || ''; if (p === '__etc') p = document.getElementById('io-etc').value.trim();
  const list = [...document.querySelectorAll('#io-lines tr')].map(tr => ({code: tr.querySelector('.io-item').value, qty: tr.querySelector('.io-qty').value, memo: tr.querySelector('.io-memo').value.trim()}))
    .filter(x => x.code && x.qty !== '' && (+x.qty > 0 || (t === '재고조사' && +x.qty >= 0)))
    .map(x => ({date, type: t, code: x.code, qty: +x.qty, party: t === '입고' ? (p || iItem(x.code).vendor) : p, memo: x.memo, by: (document.getElementById('io-by')?.value || '').trim()}));
  if (!list.length) return toast('품목과 수량을 넣어주세요.');
  iSaveMoves(list, () => go('inv-log'));
}

/* 3) 입·출고 내역 */
function pageInvLog(){
  const t = iToday();
  document.getElementById('main').innerHTML = simpleHero(['본사 창고 관리','입·출고 내역'], 'WAREHOUSE · HISTORY', '입·출고 내역', '직접 등록한 입고·출고·재고조사와 FC다움 자동 출고를 한곳에서 확인하세요.') +
  `<section class="card query-card"><div class="section-title"><strong>${ic('filter')}조회 조건</strong></div>
   <div class="filters">
    <div class="f"><label for="d1">일자</label><div class="daterow"><input type="date" id="d1" value="${iAdd(t, -90)}"><span>~</span><input type="date" id="d2" value="${t}"></div></div>
    <div class="f"><label for="lg-type">구분</label><select id="lg-type"><option value="">전체</option><option>입고</option><option>출고</option><option value="FC출고">FC다움 출고 (자동)</option><option value="FC예정">FC다움 출고 대기</option><option>재고조사</option></select></div>
    <div class="f"><label for="lg-q">품목·매장 검색<span>선택</span></label><input id="lg-q" placeholder="예: 물티슈, 탕정" onkeydown="if(event.key==='Enter')runInvLog()"></div>
   </div>
   <div class="actions"><button class="btn ghost" onclick="pageInvLog()">${ic('reset')}초기화</button><button class="btn primary" onclick="runInvLog()">${ic('search')}조회</button></div>
  </section><div id="res"></div>` + pageFoot();
  runInvLog();
}
function runInvLog(){
  const a = document.getElementById('d1').value, b = document.getElementById('d2').value, ty = document.getElementById('lg-type').value, q = document.getElementById('lg-q').value.trim();
  const lab = {'입고': '입고', '출고': '출고', 'FC출고': 'FC다움 출고', 'FC예정': '출고 대기', '재고조사': '재고조사'};
  const list = invAllMoves().filter(m => m.date >= a && m.date <= b && (!ty || m.type === ty) && (!q || (iName(iItem(m.code)) + m.party + m.memo).includes(q))).reverse();
  const sumIn = list.filter(m => m.type === '입고').length, sumOut = list.filter(m => m.type === '출고' || m.type === 'FC출고').length;
  LAST = {head: ['일자','구분','코드','품목','수량','단위','매장·업체','메모','담당'], body: list.map(m => { const it = iItem(m.code) || {}; return [m.date, lab[m.type], m.code, iName(it), (m.type === '입고' ? '+' : m.type === '재고조사' ? '=' : '-') + m.qty, it.unit || '', m.party, m.memo, m.by]; })};
  document.getElementById('res').innerHTML = `<div class="sum period"><div class="k hl"><div class="l">${ic('file')}전체</div><div class="v">${list.length}<small>건</small></div></div>
    <div class="k"><div class="l">${ic('arrow')}입고</div><div class="v">${sumIn}<small>건</small></div></div><div class="k"><div class="l">${ic('box')}출고 (FC 포함)</div><div class="v">${sumOut}<small>건</small></div></div>
    <div class="k"><div class="l">${ic('search')}재고조사</div><div class="v">${list.filter(m => m.type === '재고조사').length}<small>건</small></div></div></div>
   <div class="card"><div class="meta"><div class="left"><strong>입·출고 기록</strong><span class="count">${list.length}건</span></div><button class="btn ghost" onclick="dlCsv('본사창고_입출고내역')">${ic('download')}CSV 다운로드</button></div>
   ${list.length ? `<div class="tbl-wrap"><table class="inv-tbl"><thead><tr><th>일자</th><th>구분</th><th>품목</th><th class="n">수량</th><th>매장·업체</th><th>메모</th><th>담당</th></tr></thead><tbody>
   ${list.map(m => { const it = iItem(m.code) || {}; return `<tr><td>${m.date.slice(2).replace(/-/g, '.')}</td><td><span class="inv-st t-${m.type}">${lab[m.type]}</span></td><td><b>${ih(it.name || m.code)}</b>${it.spec ? `<small>${ih(it.spec)}</small>` : ''}</td><td class="n"><b class="${m.type === '입고' ? 'plus' : m.type === '재고조사' ? '' : 'minus'}">${m.type === '입고' ? '+' : m.type === '재고조사' ? '=' : '−'}${fmt(m.qty)}</b> ${ih(it.unit || '')}</td><td>${ih(m.party) || '-'}</td><td class="memo">${ih(m.memo)}</td><td>${ih(m.by)}${m.reg && m.reg !== m.by ? `<small>등록 ${ih(m.reg)}</small>` : ''}${m.id && invCanEdit() ? `<button class="inv-x" onclick="invCancel(${+m.id})">취소</button>` : ''}</td></tr>`; }).join('')}
   </tbody></table></div>` : '<div class="empty">조건에 맞는 기록이 없어요.</div>'}</div>`;
}

(function(){
  const st = document.createElement('style');
  st.textContent = `.inv-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px}.inv-chips{display:flex;flex-wrap:wrap;gap:6px}.inv-chips .chip{border:1px solid #dcdfd6;background:#fff;border-radius:999px;padding:6px 13px;font-size:12px;cursor:pointer;color:#4a5244}.inv-chips .chip.on{background:#2b2f2a;color:#fff;border-color:#2b2f2a}#inv-q{border:1px solid #dcdfd6;border-radius:8px;padding:8px 11px;font-size:13px;min-width:170px}.inv-acts{margin-left:auto;display:flex;gap:8px}
  .inv-tbl td small{display:block;color:#969c8e;font-size:11px;margin-top:2px}.inv-tbl td small.loc{color:#7d8a6c}.inv-tbl tr.inv-low td{background:#fff6f5}.inv-q{font-size:15px}.inv-st{display:inline-block;border-radius:999px;padding:2px 8px;font-size:10.5px;font-weight:700;vertical-align:1px}
  .s-부족,.s-확인필요{background:#c8102e;color:#fff}.s-여유{background:#eaf1e4;color:#4b6b35}.s-조사필요{background:#f3eee2;color:#8a6d2b}.t-입고{background:#e6f0fa;color:#245a8f}.t-출고,.t-FC출고{background:#fde9e7;color:#a8261a}.t-FC예정{background:#f6efe0;color:#8a6d2b}.t-재고조사{background:#eceee8;color:#4a5244}
  .inv-btns{white-space:nowrap}.inv-btns button{border:1px solid #dcdfd6;background:#fff;border-radius:6px;padding:4px 8px;font-size:11.5px;margin-left:3px;cursor:pointer}.inv-btns button:hover{border-color:#c8102e;color:#c8102e}b.plus{color:#245a8f}b.minus{color:#a8261a}td.memo{max-width:280px;color:#6c7365;font-size:12px}.miss{color:#c8102e}
  #inv-modal{position:fixed;inset:0;z-index:9000;display:grid;place-items:center}#inv-modal .im-bg{position:absolute;inset:0;background:rgba(20,22,18,.45)}#inv-modal .im-box{position:relative;background:#fff;border-radius:14px;width:min(620px,94vw);max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.25)}
  .im-head{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #eceee8}.im-head strong{font-size:15px}.im-x{border:0;background:none;cursor:pointer;padding:4px;color:#7b8174}.im-body{padding:18px 22px}.im-foot{display:flex;justify-content:flex-end;gap:8px;padding:14px 22px;border-top:1px solid #eceee8}
  .im-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.im-grid .f.wide{grid-column:1/-1}.im-grid .f label{display:block;font-size:12px;color:#6c7365;margin-bottom:5px}.im-grid input,.im-grid select{width:100%;box-sizing:border-box;border:1px solid #dcdfd6;border-radius:8px;padding:9px 10px;font-size:13px}
  .im-now{margin:0 0 14px;font-size:13px;color:#4a5244}.im-warn{background:#fbf6ea;border:1px solid #efe3c4;color:#7a6125;border-radius:8px;padding:9px 12px;font-size:12px;margin:12px 0}
  .io-tbl select,.io-tbl input{width:100%;box-sizing:border-box;border:1px solid #dcdfd6;border-radius:8px;padding:8px 9px;font-size:13px}.io-tbl td:first-child{min-width:260px}.io-tbl .io-qty{max-width:110px;text-align:right}
  @media(max-width:580px){.im-grid{grid-template-columns:1fr}.inv-acts{margin-left:0}}`;
  document.head.appendChild(st);
})();
// 메뉴: 발주 관리 아래에 "본사 창고 관리"
const renderSideInv = renderSide;
renderSide = function(active){
  renderSideInv(active);
  const btn = [...document.querySelectorAll('#side .cat')].find(b => b.textContent.includes('발주 관리'));
  if (!btn) return;
  const anchor = btn.nextElementSibling && btn.nextElementSibling.classList.contains('sub') ? btn.nextElementSibling : btn;
  const items = [['inv-stock','재고 현황'],['inv-io','입·출고 등록'],['inv-log','입·출고 내역'],['inv-count','월말 재고조사']];
  const open = items.some(i => i[0] === active);
  anchor.insertAdjacentHTML('afterend', `<button class="cat ${open?'open':''}" onclick="const on=this.classList.toggle('open');this.nextElementSibling.classList.toggle('open',on)">${ic('warehouse')}본사 창고 관리${ic('chevron').replace('class="icon"','class="icon ar"')}</button><div class="sub ${open?'open':''}">${items.map(([k,t]) => `<a role="button" tabindex="0" class="${k===active?'on':''}" onclick="go('${k}')">${t}</a>`).join('')}</div>`);
};
const goInv = go;
go = function(p, t){
  const pages = {'inv-stock': pageInvStock, 'inv-io': pageInvIo, 'inv-log': pageInvLog, 'inv-count': (...a) => window.pageInvCount(...a)};
  if (pages[p]) { document.getElementById('inv-modal')?.remove(); closeSide(); renderSide(p); pages[p](); window.scrollTo(0,0); return; }
  return goInv(p, t);
};

