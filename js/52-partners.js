
/* ==========================================================
   멘야마쯔리 파트너(가맹점 앱) 연동 (2026-11-12)
   - 왼쪽 메뉴를 셋으로 나눔 (FC다움 해지 때 'FC다움' 묶음만 지우면 되게)
       가맹점 관리: 가맹점 현황
       FC다움: FC다움 공지 · FC다움 발주 (확인용, FC다움에서 처리)
       파트너 앱: 앱 공지 (읽음·확인·1:1 답변) · 앱 발주 (접수 → 발송·송장 → 완료 / 반려)
   - 가맹점주(mst) 계정은 워크스페이스 로그인 차단 (로그인 화면에서 처리)
   - 데이터: mst_hq_orders() · mst_hq_order_set(p) · mst_admin_notices() · fn_notice_open(id) · mst_hq_notice_reply(...) — 관리자·본사만
   ========================================================== */
(function(){
  const PAGE = 'mp-orders', STORE_URL = 'https://store.menyamatsuri.work';
  const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const won = n => Number(n || 0).toLocaleString('ko-KR');
  const can = () => !!(typeof SESSION !== 'undefined' && SESSION.user && (SESSION.user.role === 'admin' || SESSION.user.role === 'hq'));
  const ST = { received: ['접수 대기', 'new'], confirmed: ['접수 완료', 'ing'], shipped: ['발송', 'ship'], done: ['완료', 'done'], rejected: ['반려', 'off'], canceled: ['점주 취소', 'off'] };
  const COURIERS = ['롯데택배', 'CJ대한통운', '한진택배', '우체국택배', '로젠택배', '직접 배송'];
  const MP = { list: null, tab: 'todo', q: '', open: null, at: 0 };

  async function load(force){
    if (!window.SB || !can()) return [];
    if (!force && MP.list && Date.now() - MP.at < 60000) return MP.list;
    const { data, error } = await SB.rpc('mst_hq_orders'); if (error) throw error;
    MP.list = data || []; MP.at = Date.now(); badge(); return MP.list;
  }
  const todo = () => (MP.list || []).filter(o => o.status === 'received' || o.status === 'confirmed');

  /* ---------- 메뉴: 가맹점 관리 / FC다움 / 파트너 앱 ---------- */
  const NP = 'mp-notices';
  const MN = { list: null, at: 0, cur: null };
  function badge(){
    const set = (p, n) => { const a = document.querySelector(`#side .sub.js-mp-sub a[data-p="${p}"]`); if (!a) return;
      a.querySelector('.mp-badge')?.remove(); if (n) a.insertAdjacentHTML('beforeend', `<span class="nt-badge mm-sub-badge mp-badge">${n}</span>`); };
    set(PAGE, (MP.list || []).filter(o => o.status === 'received').length);
    set(NP, (MN.list || []).reduce((s, n) => s + (n.pending || 0), 0));
  }
  const catBtn = (cls, icon, name, open) => `<button class="cat ${cls} ${open ? 'open' : ''}" onclick="const o=this.classList.toggle('open');this.nextElementSibling.classList.toggle('open',o)">${ic(icon)}${name}${ic('chevron').replace('class="icon"', 'class="icon ar"')}</button>`;
  const link = (p, t, active) => `<a role="button" tabindex="0" data-p="${p}" class="${active === p ? 'on' : ''}" onclick="go('${p}')">${t}</a>`;
  function fixMenu(active){ return gmMenu(active); }  // 2026-11-16: '가맹점' 하나로 (아래 가맹점 통합)
  const renderSideMp = renderSide;
  renderSide = function(active){ const r = renderSideMp.apply(this, arguments); try { fixMenu(active); } catch (e) { console.warn('파트너 앱 메뉴 실패', e); } return r; };
  const goMp = go;
  go = function(p, t){
    if (p === PAGE || p === NP) {
      if (!can()) { toast('관리자·본사 계정만 볼 수 있어요.'); return goMp('dash'); }
      closeSide(); window.__curPage = p; renderSide(p); window.scrollTo(0, 0);
      if (p === PAGE) { MP.open = null; page(); } else { MN.cur = null; npPage(); }
      return;
    }
    return goMp(p, t);
  };
  window.mpOpen = id => { MP.open = id; MP.tab = 'all'; if (window.__curPage !== PAGE) go(PAGE); else draw(); setTimeout(() => document.getElementById('mp-o-' + id)?.scrollIntoView({ block: 'start' }), 300); };

  /* ---------- 화면 ---------- */
  async function page(){
    document.getElementById('main').innerHTML = simpleHero(['가맹점', '발주'], 'FRANCHISE ORDERS', '발주',
      '점주님이 멘야 파트너스에서 넣은 발주와 본사가 대신 넣은 발주예요. 접수 → 거래명세서·발송 → 완료 순서로 처리하면 점주 앱에 바로 보이고 알림이 가요.') +
      `<div id="mp-body"><section class="card"><div class="mp-empty">불러오는 중...</div></section></div>` + pageFoot();
    try { await load(true); } catch (e) { document.getElementById('mp-body').innerHTML = `<section class="card"><div class="mp-empty">불러오지 못했어요: ${h(e.message || e)}</div></section>`; return; }
    draw();
  }
  function draw(){
    const box = document.getElementById('mp-body'); if (!box) return;
    const L = MP.list || [], q = MP.q.replace(/\s/g, '');
    const tabs = [['todo', '처리할 발주', todo().length], ['ship', '발송·완료', L.filter(o => o.status === 'shipped' || o.status === 'done').length], ['all', '전체', L.length]];
    const shown = L.filter(o => (MP.tab === 'all' || (MP.tab === 'todo' ? ['received', 'confirmed'].includes(o.status) : ['shipped', 'done'].includes(o.status)))
      && (!q || (o.store + o.no + o.items.map(i => i.name).join('')).replace(/\s/g, '').includes(q)));
    const nNew = L.filter(o => o.status === 'received').length, nShip = L.filter(o => o.status === 'confirmed').length;
    box.innerHTML = `
      <div class="data-note"><span class="status-dot"></span><span>접수 대기 ${nNew}건 · 발송 대기 ${nShip}건</span><span class="tag">점주 앱과 바로 연동</span>
        <button class="btn primary mp-ref" onclick="mpProxy()">＋ 대신 발주 넣기</button><button class="btn ghost" onclick="mpReload()">새로고침</button></div>
      <section class="card"><div class="mp-bar"><div class="fnn-tabs" role="tablist">${tabs.map(([k, t, n]) => `<button type="button" role="tab" aria-selected="${MP.tab === k}" class="${MP.tab === k ? 'on' : ''}" onclick="mpTab('${k}')">${t} ${n}</button>`).join('')}</div>
        <input type="search" class="fnn-q" placeholder="매장·품목·발주번호" value="${h(MP.q)}" oninput="mpQ(this.value)"></div>
        <div class="mp-list">${shown.length ? shown.map(card).join('') : `<div class="mp-empty">${MP.tab === 'todo' ? '처리할 발주가 없어요.' : '해당하는 발주가 없어요.'}</div>`}</div></section>`;
  }
  function card(o){
    const s = ST[o.status] || [o.status, ''], open = MP.open === o.id || ['received', 'confirmed'].includes(o.status);
    const items = o.items.map(i => `<tr><td>${h(i.name)}</td><td class="n">${Number(i.qty)}${h(i.unit ? ' ' + i.unit : '')}</td><td class="n">${i.amount ? won(i.amount) + '원' : '<span class="mp-na">단가 미정</span>'}</td></tr>`).join('');
    const stmtBtn = `<button type="button" class="btn ghost" onclick="mpStmt(${o.id})">거래명세서 출력</button>`;
    const ship = (btn) => `<select id="mp-c-${o.id}">${COURIERS.map(c => `<option ${(o.courier || '롯데택배') === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        <input id="mp-i-${o.id}" inputmode="numeric" placeholder="송장번호" value="${h(o.invoice || '')}">${btn}`;
    const STEP = { received: 0, confirmed: 1, shipped: 2, done: 3 }, cur = STEP[o.status];
    const steps = cur == null ? '' : `<ol class="mp-steps">${['접수', '명세서 · 발송', '완료 처리'].map((t, i) => `<li class="${i < cur ? 'ok' : i === cur ? 'now' : ''}"><b>${i + 1}</b>${t}</li>`).join('')}</ol>`;
    let act = '';
    if (o.status === 'received') act = `<div class="mp-next"><p>주문 내용을 확인하고 접수해 주세요.</p><div class="mp-act"><button class="btn primary" onclick="mpSet(${o.id},'confirmed')">접수하기</button><button class="btn ghost" onclick="mpReject(${o.id})">반려</button></div></div>`;
    else if (o.status === 'confirmed') act = `<div class="mp-next"><p>거래명세서를 출력해 물건과 함께 보내고, 송장번호를 넣어 발송 처리해 주세요.</p><div class="mp-act">${stmtBtn}</div><div class="mp-act mp-ship">${ship(`<button class="btn primary" onclick="mpShip(${o.id})">발송 처리</button>`)}</div></div>`;
    else if (o.status === 'shipped') act = `<div class="mp-next"><p>점주가 물건을 받았으면 완료 처리해 주세요.</p><div class="mp-act"><button class="btn primary" onclick="mpSet(${o.id},'done')">완료 처리</button>${stmtBtn}</div>
        <details class="mp-fix"><summary>송장번호 고치기</summary><div class="mp-act mp-ship">${ship(`<button class="btn ghost" onclick="mpShip(${o.id},1)">송장 저장</button>`)}</div></details></div>`;
    else if (o.status === 'done') act = `<div class="mp-act">${stmtBtn}</div>`;
    const memo = ['canceled', 'rejected'].includes(o.status) ? '' : `<details class="mp-fix" ${o.hq_memo ? 'open' : ''}><summary>점주에게 안내 남기기${o.hq_memo ? ' · 남김' : ''}</summary>
        <div class="mp-act mp-ship"><input id="mp-m-${o.id}" maxlength="500" placeholder="예: 재고 확인했어요, 금요일 출고 예정 (점주 앱 발주 화면에 보여요)" value="${h(o.hq_memo || '')}"><button class="btn ghost" onclick="mpMemo(${o.id})">안내 저장</button></div></details>`;
    return `<article class="mp-o ${open ? 'open' : ''} ${o.status}" id="mp-o-${o.id}">
      <button type="button" class="mp-h" onclick="mpToggle(${o.id})"><span class="mp-st ${s[1]}">${s[0]}</span><b>${h(o.store)}</b>
        <span class="mp-sum">${h(o.items[0] ? o.items[0].name : '')}${o.items.length > 1 ? ` 외 ${o.items.length - 1}건` : ''}</span><span class="mp-tot">${won(o.total)}원</span><span class="mp-at">${h(o.at)}</span></button>
      ${open ? `<div class="mp-d"><div class="mp-meta">${h(o.no)} · ${h(o.by || '')}${o.invoice ? ` · ${h(o.courier || '')} ${h(o.invoice)}` : ''}${o.handled ? ` · 처리 ${h(o.handled)}` : ''}</div>
        <table class="mp-t"><tbody>${items}</tbody><tfoot><tr><td>합계</td><td></td><td class="n">${won(o.total)}원</td></tr></tfoot></table>
        ${o.memo ? `<div class="mp-memo"><b>점주 메모</b>${h(o.memo)}</div>` : ''}
        ${steps}
        ${act}
        ${memo}
        <details class="mp-log"><summary>처리 기록 ${o.logs.length}</summary>${o.logs.map(l => `<div><time>${h(l.at)}</time>${h(l.act)} · ${h(l.who || '')}${l.note ? ` · ${h(l.note)}` : ''}</div>`).join('')}
          ${['shipped', 'done'].includes(o.status) ? '' : `<button type="button" class="mp-del" onclick="mpDel(${o.id})">이 발주 삭제 (시험·잘못 넣은 발주)</button>`}</details></div>` : ''}
    </article>`;
  }
  /* 본사 대리 발주: 전화로 받은 주문을 매장을 골라 대신 넣음 → 바로 '접수 완료' */
  const PX = { form: null, store: '', qty: {}, memo: '전화 주문' };
  window.mpProxy = async () => {
    try { if (!PX.form) { const { data, error } = await SB.rpc('mst_hq_order_form'); if (error) throw error; PX.form = data; } }
    catch (e) { toast('불러오지 못했어요: ' + (e.message || e)); return; }
    PX.store = ''; PX.qty = {}; PX.memo = '전화 주문'; pxDraw();
  };
  function pxTotal(){ return (PX.form.items || []).reduce((a, i) => a + (PX.qty[i.id] || 0) * Number(i.price || 0), 0); }
  function pxDraw(){
    const F = PX.form, cats = [...new Set(F.items.map(i => i.cat || '기타'))];
    let m = document.getElementById('mp-px'); if (!m) { m = document.createElement('div'); m.id = 'mp-px'; document.body.appendChild(m); }
    const n = Object.values(PX.qty).filter(v => v > 0).length;
    m.innerHTML = `<div class="px-bg" onclick="pxClose()"></div><div class="px-box" role="dialog" aria-modal="true" aria-label="대신 발주 넣기">
      <div class="px-h"><b>대신 발주 넣기</b><button class="px-x" onclick="pxClose()" aria-label="닫기">✕</button></div>
      <p class="px-sub">전화로 받은 주문을 매장 대신 넣어요. 바로 <b>접수 완료</b>로 들어가고, 점주 앱에도 보이고 알림이 가요.</p>
      <div class="px-body">
        <label class="px-l">매장</label>
        <select id="px-s" onchange="pxStore(this.value)"><option value="">매장을 골라 주세요</option>
          ${F.stores.map(st => `<option value="${st.id}" ${String(PX.store) === String(st.id) ? 'selected' : ''}>${h(st.name)}${st.direct ? ' (직영)' : ''}${st.owner ? ' · ' + h(st.owner) : ''}</option>`).join('')}</select>
        <label class="px-l">품목 <small>수량을 넣은 품목만 발주돼요</small></label>
        <div class="px-items">${cats.map(c => `<div class="px-cat">${h(c)}</div>${F.items.filter(i => (i.cat || '기타') === c).map(i => `<div class="px-row ${PX.qty[i.id] ? 'on' : ''}">
          <span class="px-nm">${h(i.name)}<small>${h(i.unit || '')} · ${i.price ? won(i.price) + '원' : '단가 미정'}</small></span>
          <span class="px-q"><button type="button" onclick="pxQ(${i.id},-1)" aria-label="빼기">−</button><input inputmode="numeric" value="${PX.qty[i.id] || ''}" placeholder="0" oninput="pxSet(${i.id},this.value)" aria-label="${h(i.name)} 수량"><button type="button" onclick="pxQ(${i.id},1)" aria-label="더하기">＋</button></span></div>`).join('')}`).join('')}</div>
        <label class="px-l">메모 <small>점주 앱 발주 내역에 보여요</small></label>
        <input id="px-m" maxlength="500" value="${h(PX.memo)}" oninput="pxMemo(this.value)">
      </div>
      <div class="px-f"><span class="px-tot">${n}개 품목 · <b id="px-tot">${won(pxTotal())}원</b></span><button class="btn ghost" onclick="pxClose()">취소</button><button class="btn primary" id="px-go" onclick="pxGo()">발주 넣기</button></div></div>`;
  }
  window.pxClose = () => document.getElementById('mp-px')?.remove();
  window.pxStore = v => { PX.store = v; };
  window.pxMemo = v => { PX.memo = v; };
  window.pxQ = (id, d) => { PX.qty[id] = Math.max(0, Math.min(9999, (PX.qty[id] || 0) + d)); pxDraw(); };
  window.pxSet = (id, v) => { PX.qty[id] = Math.min(9999, parseInt(String(v).replace(/\D/g, ''), 10) || 0);
    const t = document.getElementById('px-tot'); if (t) t.textContent = won(pxTotal()) + '원'; };
  window.pxGo = async () => {
    const items = Object.entries(PX.qty).filter(([, q]) => q > 0).map(([id, qty]) => ({ id: +id, qty }));
    if (!PX.store) return toast('매장을 골라 주세요');
    if (!items.length) return toast('품목 수량을 넣어 주세요');
    const st = PX.form.stores.find(x => String(x.id) === String(PX.store));
    if (!confirm(`${st ? st.name : ''}에 ${items.length}개 품목, ${won(pxTotal())}원 발주를 넣을까요?`)) return;
    const b = document.getElementById('px-go'); b.disabled = true;
    const { data, error } = await SB.rpc('mst_hq_order_create', { p: { store_id: +PX.store, items, memo: PX.memo } });
    if (error) { b.disabled = false; return toast(error.message); }
    pxClose(); toast('발주를 넣었어요. 점주 앱에도 보여요.');
    MP.tab = 'todo'; MP.open = data && data.id; await load(true); draw();
  };
  window.mpDel = async id => {
    const o = (MP.list || []).find(x => x.id === id); if (!o) return;
    if (!confirm(`${o.store} ${won(o.total)}원 발주를 삭제할까요?\n점주 앱에서도 사라지고 되돌릴 수 없어요. 시험이나 잘못 넣은 발주일 때만 지워 주세요.`)) return;
    const { error } = await SB.rpc('mst_hq_order_delete', { p_id: id });
    if (error) return toast(error.message);
    toast('삭제했어요'); MP.open = null; await load(true); draw();
  };
  window.mpMemo = id => setOrder({ id, memo: (document.getElementById('mp-m-' + id).value || '').trim() }, '안내를 저장했어요. 점주 앱 발주 화면에 보여요.');
  window.mpReload = async () => { try { await load(true); draw(); } catch (e) { toast('불러오지 못했어요'); } };
  window.mpTab = k => { MP.tab = k; draw(); };
  let qT = 0; window.mpQ = v => { clearTimeout(qT); qT = setTimeout(() => { MP.q = v.trim(); draw(); }, 200); };
  window.mpToggle = id => { MP.open = MP.open === id ? null : id; draw(); };
  async function setOrder(p, msg){
    const { error } = await SB.rpc('mst_hq_order_set', { p });
    if (error) { toast(error.message); return false; }
    toast(msg); await load(true); draw(); return true;
  }
  window.mpSet = (id, status) => setOrder({ id, status }, status === 'confirmed' ? '접수했어요. 점주에게 알림이 가요.' : status === 'done' ? '완료 처리했어요' : '처리했어요');
  window.mpShip = (id, onlyInv) => {
    const inv = (document.getElementById('mp-i-' + id).value || '').trim(), cr = document.getElementById('mp-c-' + id).value;
    if (!inv && cr !== '직접 배송') { toast('송장번호를 넣어 주세요'); document.getElementById('mp-i-' + id).focus(); return; }
    return setOrder(Object.assign({ id, courier: cr, invoice: inv }, onlyInv ? {} : { status: 'shipped' }), onlyInv ? '송장번호를 저장했어요' : '발송 처리했어요. 점주에게 송장번호와 함께 알림이 가요.');
  };
  window.mpReject = id => {
    const why = prompt('반려 사유를 적어 주세요. 점주 앱 처리 기록에 남아요.');
    if (why === null) return;
    return setOrder({ id, status: 'rejected', memo: why }, '반려했어요');
  };

  /* ---------- 파트너 앱 > 앱 공지 ---------- */
  const NST = { active: ['게시 중', 'ship'], stopped: ['게시 중지', 'off'], closed: ['마감', 'off'] };
  async function npLoad(force){
    if (!window.SB || !can()) return [];
    if (!force && MN.list && Date.now() - MN.at < 60000) return MN.list;
    const { data, error } = await SB.rpc('mst_admin_notices'); if (error) throw error;
    MN.list = data || []; MN.at = Date.now(); badge(); return MN.list;
  }
  function npShell(){
    document.getElementById('main').innerHTML = simpleHero(['가맹점', '공지'], 'FRANCHISE NOTICE', '공지',
      '점주님께 보내는 공지예요. 여기서 쓰고, 매장별 읽음·확인을 보고, 점주 댓글에 바로 답변해요. 답변은 그 매장 점주에게만 보여요.') +
      `<div id="np-body"><section class="card"><div class="mp-empty">불러오는 중...</div></section></div>` + pageFoot();
  }
  async function npPage(){
    npShell();
    try { await npLoad(true); } catch (e) { document.getElementById('np-body').innerHTML = `<section class="card"><div class="mp-empty">불러오지 못했어요: ${h(e.message || e)}</div></section>`; return; }
    npList();
  }
  function npList(){
    const box = document.getElementById('np-body'); if (!box) return;
    const L = MN.list || [], pend = L.reduce((s, n) => s + (n.pending || 0), 0);
    box.innerHTML = `<div class="data-note"><span class="status-dot"></span><span>공지 ${L.length}건 · 답변 대기 ${pend}건</span>
        <button class="btn primary mp-ref" onclick="npEdit('new')">＋ 새 공지</button></div>
      <section class="card"><div class="mp-list">${L.length ? L.map(n => { const s = NST[n.status] || [n.status, 'off'];
        return `<button type="button" class="mp-h" onclick="npOpen(${n.id})"><span class="mp-st ${s[1]}">${s[0]}</span>
          <span class="mp-sum" style="color:#232621;font-weight:600">${n.pin ? '<em class="fnn-pin">필독</em>' : ''}${h(n.title)}</span>
          <span class="np-c">읽음 ${n.read}/${n.targets}${n.ack ? ` · 확인 ${n.acked}/${n.targets}` : ''}</span>
          ${n.pending ? `<span class="mp-st new">답변 대기 ${n.pending}</span>` : ''}<span class="mp-at">${h(n.at)}</span></button>`; }).join('')
        : '<div class="mp-empty">아직 올린 공지가 없어요. ＋ 새 공지로 첫 공지를 써 보세요.</div>'}</div></section>`;
  }
  window.npOpen = async function(id, tkey){
    if (window.__curPage !== NP) { closeSide(); window.__curPage = NP; renderSide(NP); npShell(); }
    const box = document.getElementById('np-body'); box.innerHTML = `<section class="card"><div class="mp-empty">불러오는 중...</div></section>`;
    const { data, error } = await SB.rpc('fn_notice_open', { p_id: id });
    if (error) { box.innerHTML = `<section class="card"><div class="mp-empty">열지 못했어요: ${h(error.message)}</div></section>`; return; }
    MN.cur = data; if (tkey) MN.open = tkey; npDetail(); window.scrollTo(0, 0);
    SB.rpc('mst_hq_seen', { p_id: id }).then(() => npLoad(true)).catch(() => {});  // 열어 보면 숫자 지움
  };
  window.npBack = () => { MN.cur = null; npLoad(true).then(npList).catch(() => npList()); };
  function npDetail(){
    const n = MN.cur, box = document.getElementById('np-body'); if (!n || !box) return;
    const T = n.targets || [], read = T.filter(t => t.read).length, resp = T.filter(t => t.resp).length, s = NST[n.status] || [n.status, 'off'];
    const th = n.threads || [];
    box.innerHTML = `<div class="fnn-dtop"><button type="button" class="fnn-back" onclick="npBack()">‹ 공지</button>
        <span class="gm-topbtns">${n.status === 'stopped' ? `<button class="btn ghost" onclick="npStatus(${n.id},'active')">다시 게시</button>` : n.status === 'active' ? `<button class="btn ghost" onclick="npStatus(${n.id},'stopped')">게시 중지</button>` : ''}<button class="btn primary" onclick="npEdit(${n.id})">수정</button></span></div>
      <section class="card fnn-art"><h2 class="fnn-h">${n.pinned ? '<em class="fnn-pin">필독</em>' : ''}${h(n.title)}</h2>
        <div class="fnn-meta">${h(n.at)} · ${h(n.author || '')} · ${T.length}개 매장 · <span class="mp-st ${s[1]}">${s[0]}</span>${n.end ? ` · 마감 ${h(n.end)}` : ''}</div>
        <div class="fnn-text">${h(n.body) || '<span class="na">본문 없음</span>'}</div>
        ${(n.files || []).length ? `<div class="fnn-files">${n.files.map((f, i) => `<button type="button" class="fnn-file" onclick="npFile(${i})">${ic('file')}<span>${h(f.name)}</span></button>`).join('')}</div>` : ''}</section>
      <section class="card"><div class="section-title"><strong>${ic('bell')}점주 대화</strong><small>매장마다 1:1 · 답변은 그 매장에만 보여요</small></div>
        ${th.length ? th.map(t => `<div class="np-th"><div class="np-thh"><b>${h(t.store)}</b> <em class="mp-st ${t.pend ? 'new' : 'off'}">${t.pend ? '답변 대기' : '답변 완료'}</em><small>${h(t.last)}</small></div>
          <div class="np-msgs">${t.msgs.map(m => `<div class="np-msg ${m.side}"><span>${m.side === 'store' ? h(t.store) : '본사'} · ${h(m.who)} · ${h(m.at)}</span><p>${h(m.body)}</p></div>`).join('')}</div>
          ${n.status === 'active' ? `<div class="fnn-rbox"><textarea id="npr-${h(t.tkey)}" maxlength="1000" placeholder="${h(t.store)}에 답변"></textarea><button type="button" onclick="npReply('${h(t.tkey)}')">보내기</button></div>` : ''}</div>`).join('')
          : '<div class="mp-empty">아직 점주 댓글이 없어요.</div>'}</section>
      <section class="card"><div class="section-title"><strong>${ic('check')}매장별 확인</strong><small>읽음 ${read} · ${n.response_required ? `확인 ${resp} · ` : ''}안 읽음 ${T.length - read}</small></div>
        <ul class="fnn-stores">${T.slice().sort((a, b) => (!!a.read - !!b.read)).map(t => `<li><b>${h(t.store)}${t.closed ? ' <small class="fnn-closed">폐점</small>' : ''}</b>
          <span class="fnn-ss ${t.resp ? 'resp' : t.read ? 'read' : 'un'}">${t.resp ? '확인 ' + h(t.resp) : t.read ? '읽음 ' + h(t.read) : '안 읽음'}</span></li>`).join('')}</ul></section>`;
    if (MN.open) setTimeout(() => document.getElementById('npr-' + MN.open)?.focus(), 200);
  }
  window.npFile = async i => {
    const f = MN.cur && MN.cur.files[i]; if (!f || !f.path) return;
    const w = window.open('', '_blank');
    const { data, error } = await SB.storage.from('franchise-notice-files').createSignedUrl(f.path, 600);
    if (error) { w && w.close(); return toast('파일을 열지 못했어요: ' + error.message); }
    if (w) w.location.href = data.signedUrl; else location.href = data.signedUrl;
  };
  window.npReply = async tkey => {
    const ta = document.getElementById('npr-' + tkey), v = (ta && ta.value || '').trim();
    if (!v) { toast('답변을 입력해 주세요'); return; }
    ta.disabled = true;
    const { error } = await SB.rpc('mst_hq_notice_reply', { p_notice: MN.cur.id, p_store: +tkey, p_body: v });
    if (error) { ta.disabled = false; toast(error.message); return; }
    toast('답변을 보냈어요. 점주에게 알림이 가요.'); MN.open = null; npLoad(true).catch(() => {}); npOpen(MN.cur.id);
  };
  // 예전 링크(가맹점 공지 화면 안의 답변 칸)도 동작하게
  window.fnReply = async (nid, tkey) => {
    const ta = document.getElementById('fnr-' + tkey), v = (ta && ta.value || '').trim();
    if (!v) { toast('답변을 입력해 주세요'); return; }
    const { error } = await SB.rpc('mst_hq_notice_reply', { p_notice: nid, p_store: +tkey, p_body: v });
    if (error) { toast(error.message); return; }
    toast('답변을 보냈어요'); npOpen(nid);
  };

  // 2분마다 새 발주 확인 (화면이 보일 때만)
  setInterval(() => { if (!document.hidden && can()) load(true).then(() => { if (window.__curPage === PAGE && !document.querySelector('.mp-ship input:focus')) draw(); }).catch(() => {}); }, 120000);
  setInterval(() => { if (!document.hidden && can()) npLoad(true).catch(() => {}); }, 120000);
  setTimeout(() => { if (can()) { load().catch(() => {}); npLoad().catch(() => {}); } try { fixMenu(window.__curPage); } catch (e) {} }, 1800);

  const st = document.createElement('style');
  st.textContent = `
  .mp-empty{text-align:center;color:#909b84;font-size:13px;padding:36px 10px}
  .mp-ref{margin-left:auto;min-height:34px;font-size:12px;padding:6px 12px}
  .mp-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:6px}
  .mp-o{border-top:1px solid #f0f2ec}.mp-o:first-child{border-top:0}
  .mp-h{display:flex;align-items:center;gap:12px;width:100%;border:0;background:none;padding:13px 4px;text-align:left;font:inherit;color:#232621;cursor:pointer}
  .mp-h:hover{background:#fafbf7}.mp-h b{width:96px;flex:none;font-size:13.5px}
  .mp-sum{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:#4b5246}
  .mp-tot{font-weight:700;font-size:13px;flex:none}.mp-at{font-size:11.5px;color:#7a8273;flex:none;width:112px;text-align:right}
  .mp-st{flex:none;font-size:11px;font-weight:700;border-radius:999px;padding:3px 9px;background:#eceee8;color:#5f6858}
  .mp-st.new{background:#fde8e8;color:#b3261e}.mp-st.ing{background:#e8eff9;color:#2a5ca8}.mp-st.ship{background:#e6f3ea;color:#2e7a4c}
  .mp-o.canceled .mp-h,.mp-o.rejected .mp-h{opacity:.6}
  .mp-d{padding:2px 4px 16px 4px}.mp-meta{font-size:12px;color:#7a8273;margin-bottom:8px}
  .mp-t{width:100%;border-collapse:collapse;font-size:13px}.mp-t td{padding:7px 8px;border-top:1px solid #f0f2ec}.mp-t td.n{text-align:right;white-space:nowrap}
  .mp-t tfoot td{font-weight:700;border-top:1px solid #cfd5c8}.mp-na{color:#b3261e;font-size:12px}
  .mp-memo{background:#f6f7f3;border-radius:8px;padding:10px 12px;font-size:13px;margin-top:10px}.mp-memo b{display:block;font-size:11.5px;color:#7a8273;margin-bottom:2px}
  .mp-act{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;align-items:center}
  .mp-ship select,.mp-ship input{height:38px;border:1px solid #d9ded2;border-radius:8px;padding:0 10px;font:inherit;font-size:13px;background:#fff}
  .mp-ship input{flex:1;min-width:160px;letter-spacing:.02em}
  #mp-px{position:fixed;inset:0;z-index:300;display:grid;place-items:center;padding:16px}
  #mp-px .px-bg{position:absolute;inset:0;background:rgba(20,22,18,.45)}
  #mp-px .px-box{position:relative;background:#fff;border-radius:16px;width:min(620px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25)}
  #mp-px .px-h{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 6px}#mp-px .px-h b{font-size:17px}
  #mp-px .px-x{border:0;background:none;font-size:16px;cursor:pointer;color:#6b7266}
  #mp-px .px-sub{margin:0 20px 6px;font-size:12.5px;color:#5f6858}
  #mp-px .px-body{overflow:auto;padding:4px 20px 12px}
  #mp-px .px-l{display:block;font-size:12.5px;font-weight:700;color:#4a5244;margin:14px 0 6px}#mp-px .px-l small{font-weight:500;color:#909b84;margin-left:6px}
  #mp-px select,#mp-px #px-m{box-sizing:border-box;width:100%;height:42px;border:1px solid #dcdfd5;border-radius:10px;padding:0 12px;font-size:14px;background:#fff}
  #mp-px .px-items{border:1px solid #e6e8e0;border-radius:12px;overflow:hidden}
  #mp-px .px-cat{background:#f5f6f2;font-size:12px;font-weight:800;color:#5f6858;padding:7px 12px}
  #mp-px .px-row{display:flex;align-items:center;gap:10px;padding:8px 12px;border-top:1px solid #f0f1ec}
  #mp-px .px-row.on{background:#fff7f6}
  #mp-px .px-nm{flex:1;min-width:0;font-size:13.5px;font-weight:600}#mp-px .px-nm small{display:block;font-weight:500;color:#909b84;font-size:12px}
  #mp-px .px-q{display:flex;align-items:center;gap:4px}
  #mp-px .px-q button{width:30px;height:30px;border:1px solid #dcdfd5;border-radius:8px;background:#fff;font-size:16px;cursor:pointer}
  #mp-px .px-q input{width:52px;height:30px;text-align:center;border:1px solid #dcdfd5;border-radius:8px;font-size:14px}
  #mp-px .px-f{display:flex;align-items:center;gap:8px;padding:12px 20px 16px;border-top:1px solid #eef0ea}
  #mp-px .px-tot{margin-right:auto;font-size:13px;color:#4a5244}#mp-px .px-tot b{font-size:16px;color:#1f241c}
  .mp-del{display:block;margin-top:10px;border:0;background:none;color:#a3262c;font-size:12px;cursor:pointer;padding:4px 0;text-decoration:underline}
  .mp-steps{list-style:none;display:flex;gap:6px;margin:14px 0 4px;padding:0}
  .mp-steps li{flex:1;display:flex;align-items:center;gap:6px;font-size:12px;color:#909b84;padding:7px 9px;border-radius:9px;background:#f5f6f2}
  .mp-steps li b{display:grid;place-items:center;width:19px;height:19px;border-radius:50%;background:#dfe3d8;color:#fff;font-size:11px;flex-shrink:0}
  .mp-steps li.ok{color:#2e7a4c}.mp-steps li.ok b{background:#2e7a4c}
  .mp-steps li.now{background:#fff;color:#1f241c;font-weight:700;box-shadow:inset 0 0 0 1.5px #c62429}.mp-steps li.now b{background:#c62429}
  .mp-next{margin-top:10px;padding:12px 14px;border:1px solid #e9e4d6;border-radius:12px;background:#fdfcf8}
  .mp-next>p{margin:0 0 8px;font-size:13px;color:#4a5244;font-weight:600}
  .mp-next .mp-act{margin-top:6px}
  .mp-fix{margin-top:10px;font-size:13px}.mp-fix summary{cursor:pointer;color:#5f6858;font-weight:600}
  .mp-log{margin-top:12px;font-size:12px;color:#5f6858}.mp-log summary{cursor:pointer;color:#7a8273}.mp-log div{padding:3px 0}.mp-log time{display:inline-block;width:80px;color:#909b84}
  .np-c{font-size:12px;color:#5f6858;flex:none}
  .np-th{border-top:1px solid #f0f2ec;padding:12px 2px}.np-th:first-of-type{border-top:0}
  .np-thh{display:flex;align-items:center;gap:8px;margin-bottom:8px}.np-thh small{margin-left:auto;color:#909b84;font-size:11.5px}.np-thh em{font-style:normal}
  .np-msgs{display:flex;flex-direction:column;gap:6px}
  .np-msg{max-width:78%;background:#f6f7f3;border-radius:10px;padding:8px 11px}.np-msg.hq{align-self:flex-end;background:#232621;color:#fff}
  .np-msg span{display:block;font-size:11px;opacity:.7}.np-msg p{margin:2px 0 0;font-size:13px;white-space:pre-wrap}
  .fnn-rbox{display:flex;gap:8px;margin-top:10px}.fnn-rbox textarea{flex:1;min-height:42px;border:1px solid #d9ded2;border-radius:8px;padding:9px 10px;font:inherit;font-size:13px;resize:vertical}
  .fnn-rbox button{flex:none;border:0;border-radius:8px;background:#c62429;color:#fff;font-weight:700;font-size:13px;padding:0 14px;cursor:pointer}
  @media (max-width:640px){.mp-h{flex-wrap:wrap;gap:6px 10px}.mp-h b{width:auto}.mp-sum{flex-basis:100%;order:5}.mp-at{width:auto;margin-left:auto}}`;
  document.head.appendChild(st);

  /* ==========================================================
     가맹점 통합 (2026-11-16)
     - 왼쪽 메뉴: '가맹점' 하나 (현황 · 공지 · 발주 · 품목 · 레시피 · 점주 계정 · FC다움)
     - 파트너 앱(store.menyamatsuri.work)은 점주 전용 → 본사 일은 전부 여기서
     - 공지 쓰기·수정·필독·게시 중지, 품목, 레시피, 점주 계정, 거래명세서 출력
     - 대시보드: 처리할 앱 발주 + 공지 읽음·확인·답변 대기
     ========================================================== */
  const IP = 'mp-items', RP = 'mp-recipes', AP = 'mp-accounts';
  const GM_PAGES = [IP, RP, AP];
  const isAdmin = () => !!(typeof SESSION !== 'undefined' && SESSION.user && SESSION.user.role === 'admin');
  async function rx(fn, args){ const { data, error } = await SB.rpc(fn, args || {}); if (error) throw new Error(error.message); return data; }
  const errMsg2 = e => h((e && e.message) || e || '');

  /* ---------- 공용 창 ---------- */
  function dlg(title, sub, body, foot, wide){
    let m = document.getElementById('mp-px'); if (!m) { m = document.createElement('div'); m.id = 'mp-px'; document.body.appendChild(m); }
    m.innerHTML = `<div class="px-bg" onclick="pxClose()"></div><div class="px-box ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${h(title)}">
      <div class="px-h"><b>${h(title)}</b><button class="px-x" onclick="pxClose()" aria-label="닫기">✕</button></div>
      ${sub ? `<p class="px-sub">${sub}</p>` : ''}<div class="px-body">${body}</div>${foot ? `<div class="px-f">${foot}</div>` : ''}</div>`;
    setTimeout(() => m.querySelector('.px-body input:not([type=checkbox]):not([type=file]),.px-body select,.px-body textarea')?.focus(), 40);
    return m;
  }
  const $$ = id => document.getElementById(id);
  function gmShell(crumb, eyebrow, title, desc){
    document.getElementById('main').innerHTML = simpleHero(['가맹점', crumb], eyebrow, title, desc) +
      `<div id="gm-body"><section class="card"><div class="mp-empty">불러오는 중...</div></section></div>` + pageFoot();
  }
  const gmBody = () => $$('gm-body');
  const gmFail = e => { const b = gmBody() || $$('np-body'); if (b) b.innerHTML = `<section class="card"><div class="mp-empty">불러오지 못했어요: ${errMsg2(e)}</div></section>`; };

  /* ---------- 파일 올리기 (공지·레시피 첨부) ---------- */
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round((n || 0) / 1024)) + 'KB';
  async function upFile(bucket, prefix, file){
    if (file.size > 52428800 && bucket === 'franchise-notice-files') throw new Error(`${file.name}: 50MB까지 올릴 수 있어요.`);
    if (file.size > 104857600) throw new Error(`${file.name}: 100MB까지 올릴 수 있어요.`);
    const dot = file.name.lastIndexOf('.'), ext = dot > 0 ? file.name.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, '') : '';
    const path = `${prefix}/${crypto.randomUUID()}/file${ext}`;
    const { error } = await SB.storage.from(bucket).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (error) throw new Error(`${file.name}: 올리지 못했어요 (${error.message})`);
    return { name: file.name, path, size: file.size, mime: file.type || '' };
  }
  async function rmFiles(bucket, paths){ if (paths && paths.length) { try { await SB.storage.from(bucket).remove(paths); } catch (e) {} } }
  function bindUp(boxId, inputId, bucket, prefix, st){
    const box = $$(boxId), inp = $$(inputId);
    const draw = () => { box.innerHTML = st.files.map((f, i) => `<div class="gm-up">${ic('file')}<span>${h(f.name)}</span><small>${f.size ? kb(f.size) : ''}</small><button type="button" data-rm="${i}">빼기</button></div>`).join(''); };
    box.onclick = e => { const b = e.target.closest('[data-rm]'); if (!b) return; const f = st.files.splice(+b.dataset.rm, 1)[0];
      if (f && st.fresh.includes(f.path)) { rmFiles(bucket, [f.path]); st.fresh = st.fresh.filter(p => p !== f.path); } draw(); };
    inp.onchange = async () => {
      const list = [...inp.files]; inp.value = '';
      for (const file of list) {
        const tmp = { name: file.name + ' (올리는 중...)', size: file.size, path: '' }; st.files.push(tmp); draw();
        try { const f = await upFile(bucket, prefix, file); Object.assign(tmp, f); st.fresh.push(f.path); }
        catch (e) { st.files.splice(st.files.indexOf(tmp), 1); toast(e.message || String(e)); }
        draw();
      }
    };
    draw();
  }

  /* ---------- 메뉴: '가맹점' 하나로 ---------- */
  function gmMenu(active){
    const nav = document.querySelector('#side .nav-items') || document.getElementById('side'); if (!nav || !can()) return;
    const fnSub = nav.querySelector('.sub.js-fn-menu:not(.js-fcd-menu)'); if (!fnSub) return;
    const old = {}; nav.querySelectorAll('.mp-badge').forEach(b => { const a = b.closest('a'); if (a) old[a.dataset.p] = b.textContent; });
    nav.querySelectorAll('.js-fcd-menu,.js-mp-menu').forEach(e => e.remove());
    const fnCat = fnSub.previousElementSibling;
    const pages = [['nh-week', '가맹점 현황'], [NP, '공지'], [PAGE, '발주'], [IP, '품목'], [RP, '레시피']]
      .concat(isAdmin() ? [[AP, '점주 계정']] : []).concat([['fn-notice', 'FC다움 공지'], ['fc-orders', 'FC다움 발주']]);
    const open = pages.some(p => p[0] === active);
    const html = catBtn('js-gm-menu', 'store', '가맹점', open) +
      `<div class="sub js-fn-menu js-gm-menu js-mp-sub ${open ? 'open' : ''}">${pages.map(([p, t]) =>
        (p === 'fn-notice' ? '<div class="gm-sep">FC다움 (해지 전까지)</div>' : '') + link(p, t, active)).join('')}</div>`;
    fnSub.insertAdjacentHTML('afterend', html);
    if (fnCat && fnCat.classList.contains('cat')) fnCat.remove();
    fnSub.remove();
    Object.entries(old).forEach(([p, n]) => { const a = nav.querySelector(`.js-mp-sub a[data-p="${p}"]`); if (a) a.insertAdjacentHTML('beforeend', `<span class="nt-badge mm-sub-badge mp-badge">${n}</span>`); });
    badge();
  }
  const goGm = go;
  go = function(p, t){
    if (GM_PAGES.includes(p)) {
      if (!can() || (p === AP && !isAdmin())) { toast(p === AP ? '관리자만 볼 수 있어요.' : '관리자·본사 계정만 볼 수 있어요.'); return goGm('dash'); }
      closeSide(); window.__curPage = p; renderSide(p); window.scrollTo(0, 0);
      if (p === IP) itPage(); else if (p === RP) rcPage(); else acPage();
      return;
    }
    return goGm(p, t);
  };

  /* ==========================================================
     공지 쓰기 · 수정 · 게시 중지
     ========================================================== */
  window.npEdit = async function(id){
    if (window.__curPage !== NP) { closeSide(); window.__curPage = NP; renderSide(NP); npShell(); }
    const box = $$('np-body'); box.innerHTML = `<section class="card"><div class="mp-empty">불러오는 중...</div></section>`;
    const isNew = id === 'new';
    let ad, n = null;
    try { [ad, n] = await Promise.all([rx('mst_admin_data'), isNew ? null : rx('mst_admin_notice_get', { p_id: +id })]); } catch (e) { return gmFail(e); }
    const stores = (ad.stores || []);
    const st = { sel: new Set((n ? n.stores : []).map(Number)), files: n ? n.files.slice() : [], fresh: [], q: '' };
    window.scrollTo(0, 0);
    box.innerHTML = `<div class="fnn-dtop"><button type="button" class="fnn-back" onclick="npLeave()">‹ 공지</button></div>
      <section class="card gm-form"><h2 class="gm-h2">${isNew ? '새 공지' : '공지 수정'}</h2>
      ${n && n.status !== 'active' ? `<div class="gm-note">${n.status === 'stopped' ? '게시 중지 상태예요. 점주 앱에서 보이지 않아요.' : '마감된 공지예요.'}</div>` : ''}
      <div class="gm-2col"><div>
        <label class="gm-l" for="ne-t">제목</label><input class="gm-in" id="ne-t" maxlength="120" value="${h(n ? n.title : '')}" placeholder="예: 12월 신메뉴 출시 안내">
        <label class="gm-l" for="ne-b">내용</label><textarea class="gm-in" id="ne-b" rows="10" placeholder="점주님께 전할 내용">${h(n ? n.body : '')}</textarea>
        <label class="gm-l">첨부 <small>사진·영상·문서, 10개까지</small></label><label class="gm-file">${ic('file')}파일 고르기<input type="file" id="ne-f" multiple hidden></label><div id="ne-fl"></div>
      </div><div>
        <label class="gm-l">받을 매장 <b id="ne-cnt" class="gm-red"></b></label>
        <div class="gm-chips-bar"><button type="button" class="gm-chip" id="ne-fc">가맹점 전체</button><button type="button" class="gm-chip" id="ne-acc">계정 있는 매장</button><button type="button" class="gm-chip" id="ne-none">모두 해제</button></div>
        <input class="gm-in" id="ne-q" placeholder="매장 이름 찾기">
        <div class="gm-chips" id="ne-chips"></div>
        <p class="gm-hint">'계정 n'은 멘야 파트너스를 쓰는 점주 수예요. 계정이 없는 매장은 공지를 받아도 볼 사람이 없어요.</p>
        <label class="gm-l">설정</label>
        <div class="gm-sw"><label><span><b>필독 (고정 공지)</b><small>점주 앱 맨 위에 고정하고 '필독 공지'로 알림</small></span><input type="checkbox" id="ne-pin" ${n && n.pin ? 'checked' : ''}></label>
          <label><span><b>댓글 받기</b><small>점주가 본사와 1:1로 대화할 수 있어요</small></span><input type="checkbox" id="ne-talk" ${!n || n.talk ? 'checked' : ''}></label>
          <label><span><b>확인 요청</b><small>점주가 '내용을 확인했어요'를 눌러야 해요</small></span><input type="checkbox" id="ne-ack" ${n && n.ack ? 'checked' : ''}></label></div>
        <label class="gm-l" for="ne-e">마감일 <small>선택 · 지나면 점주 앱에 '마감'으로 보여요</small></label><input class="gm-in" type="date" id="ne-e" value="${h(n && n.end ? n.end : '')}">
      </div></div>
      <div class="gm-actions">${!isNew ? (n.status === 'active' ? '<button type="button" class="btn ghost" id="ne-stop">게시 중지</button>' : '<button type="button" class="btn ghost" id="ne-resume">다시 게시</button>') : ''}
        <span class="gm-hint" style="margin:0 auto 0 0">${isNew ? '올리면 고른 매장 점주에게 바로 알림이 가요.' : '수정하면 새로 추가한 매장에만 알림이 가요.'}</span>
        <button type="button" class="btn ghost" onclick="npLeave()">취소</button><button type="button" class="btn primary" id="ne-save">${isNew ? '공지 올리기' : '저장하기'}</button></div></section>`;
    const draw = () => {
      const q = st.q.trim();
      $$('ne-chips').innerHTML = stores.filter(s => !q || s.name.includes(q)).map(s => `<button type="button" class="gm-chip ${st.sel.has(s.id) ? 'on' : ''}" data-s="${s.id}">${h(s.name)}${s.type === '직영' ? ' <small>직영</small>' : ''}${s.accounts ? ` <small>계정 ${s.accounts}</small>` : ''}</button>`).join('');
      $$('ne-cnt').textContent = st.sel.size ? st.sel.size + '곳' : '';
    };
    $$('ne-chips').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; const v = +b.dataset.s; st.sel.has(v) ? st.sel.delete(v) : st.sel.add(v); draw(); };
    $$('ne-q').oninput = e => { st.q = e.target.value; draw(); };
    $$('ne-fc').onclick = () => { stores.filter(s => s.type !== '직영').forEach(s => st.sel.add(s.id)); draw(); };
    $$('ne-acc').onclick = () => { stores.filter(s => s.accounts > 0).forEach(s => st.sel.add(s.id)); draw(); };
    $$('ne-none').onclick = () => { st.sel.clear(); draw(); };
    draw();
    bindUp('ne-fl', 'ne-f', 'franchise-notice-files', 'ws', st);
    window.npLeave = () => { if (st.fresh.length) rmFiles('franchise-notice-files', st.fresh); st.fresh = []; if (isNew) npBack(); else npOpen(+id); };
    $$('ne-save').onclick = async () => {
      const b = $$('ne-save');
      if (st.files.some(f => !f.path)) return toast('파일을 올리는 중이에요. 잠시만 기다려 주세요.');
      if (!$$('ne-t').value.trim()) return toast('제목을 입력해 주세요');
      if (!st.sel.size) return toast('받을 매장을 하나 이상 골라 주세요');
      if (isNew && !confirm(`${st.sel.size}개 매장에 공지를 올릴까요?\n올리면 해당 매장 점주에게 바로 알림이 가요.`)) return;
      b.disabled = true;
      try {
        const r = await rx('mst_admin_notice_save', { p: { id: isNew ? null : +id, title: $$('ne-t').value, body: $$('ne-b').value, pin: $$('ne-pin').checked, talk: $$('ne-talk').checked,
          ack: $$('ne-ack').checked, end: $$('ne-e').value, stores: [...st.sel], files: st.files.map(f => ({ name: f.name, path: f.path, size: f.size, mime: f.mime || '' })) } });
        await rmFiles('franchise-notice-files', r && r.removed); st.fresh = [];
        toast(isNew ? '공지를 올렸어요' : '저장했어요');
        await npLoad(true).catch(() => {});
        if (isNew) npBack(); else npOpen(+id);
      } catch (e) { b.disabled = false; toast(e.message || String(e)); }
    };
    const setSt = async (s, msg) => { try { await rx('mst_admin_notice_status', { p_id: +id, p_status: s }); toast(msg); await npLoad(true).catch(() => {}); npOpen(+id); } catch (e) { toast(e.message); } };
    const stop = $$('ne-stop'); if (stop) stop.onclick = () => { if (confirm('게시를 중지할까요?\n점주 앱에서 이 공지가 사라져요. 다시 게시할 수 있어요.')) setSt('stopped', '게시를 중지했어요'); };
    const res = $$('ne-resume'); if (res) res.onclick = () => setSt('active', '다시 게시했어요');
  };
  window.npStatus = async (id, s) => {
    if (s === 'stopped' && !confirm('게시를 중지할까요?\n점주 앱에서 이 공지가 사라져요. 다시 게시할 수 있어요.')) return;
    try { await rx('mst_admin_notice_status', { p_id: +id, p_status: s }); toast(s === 'stopped' ? '게시를 중지했어요' : '다시 게시했어요'); await npLoad(true).catch(() => {}); npOpen(+id); } catch (e) { toast(e.message); }
  };

  /* ==========================================================
     품목 (분류 접기 · 순서 · 단가 · 삭제)
     ========================================================== */
  const IT = { list: [], cats: [], open: new Set() };
  async function itPage(){
    gmShell('품목', 'ORDER ITEMS', '품목', '점주가 발주할 때 보는 품목과 단가예요. 단가는 부가세 포함 금액이에요. 분류를 먼저 만들고, 품목은 분류를 골라 넣어요.');
    try { [IT.list, IT.cats] = await Promise.all([rx('mst_admin_items'), rx('mst_admin_item_cats')]); } catch (e) { return gmFail(e); }
    itDraw();
  }
  function itDraw(){
    const box = gmBody(); if (!box) return;
    const list = IT.list, cats = IT.cats;
    const extra = [...new Set(list.map(i => i.cat || '').filter(c => !cats.some(x => x.name === c)))];
    const groups = [...cats.map(c => ({ c, name: c.name })), ...extra.map(n => ({ c: null, name: n }))];
    const noPrice = list.filter(i => i.active && !i.price).length;
    const y = window.scrollY;
    box.innerHTML = `<div class="data-note"><span class="status-dot"></span><span>품목 ${list.length}개${noPrice ? ` · <b class="gm-red">단가 미정 ${noPrice}개</b>` : ''}</span>
        <span class="gm-topbtns"><button class="btn primary" onclick="itEdit(null)">＋ 새 품목</button><button class="btn ghost" onclick="itCat(null)">＋ 분류 추가</button></span></div>
      ${groups.length ? groups.map((g, gi) => { const its = list.filter(i => (i.cat || '') === g.name), np = its.filter(i => i.active && !i.price).length, open = IT.open.has(g.name);
        return `<section class="card gm-acc ${open ? 'open' : ''}">
          <div class="gm-acc-h"><button type="button" class="gm-tgl" onclick="itToggle(${gi})">${ic('chevron')}<b>${h(g.name || '분류 없음')}</b><small>${its.length}개</small>${np ? `<em class="mp-st new">단가 미정 ${np}</em>` : ''}</button>
            ${g.c ? `<span class="gm-mv"><button type="button" title="분류 위로" ${gi === 0 ? 'disabled' : ''} onclick="itCatMove(${g.c.id},-1)">▲</button><button type="button" title="분류 아래로" ${gi === cats.length - 1 ? 'disabled' : ''} onclick="itCatMove(${g.c.id},1)">▼</button></span>` : ''}</div>
          <div class="gm-acc-b">${its.length ? its.map((i, k) => `<div class="gm-irow">
            <button type="button" class="gm-imain" onclick="itEdit(${i.id})"><span class="t ${i.active ? '' : 'off'}">${h(i.name)}</span><small>${i.unit ? h(i.unit) : '단위 없음'}${i.code ? ' · ' + h(i.code) : ''}${i.memo ? ' · ' + h(i.memo) : ''}</small></button>
            <span class="gm-ipr">${i.active ? (i.price ? `${won(i.price)}원` : '<em class="mp-st new">단가 미정</em>') : '<em class="mp-st off">판매 중지</em>'}</span>
            <span class="gm-mv"><button type="button" title="위로" ${k === 0 ? 'disabled' : ''} onclick="itMove(${i.id},-1)">▲</button><button type="button" title="아래로" ${k === its.length - 1 ? 'disabled' : ''} onclick="itMove(${i.id},1)">▼</button></span></div>`).join('') : '<div class="mp-empty">아직 품목이 없어요.</div>'}
            ${g.c ? `<div class="gm-acc-f"><button type="button" class="btn primary" onclick="itAdd(${gi})">＋ 이 분류에 품목 추가</button><button type="button" class="btn ghost" onclick="itCat(${g.c.id})">이름 바꾸기</button>${its.length ? '' : `<button type="button" class="btn ghost gm-redt" onclick="itCatDel(${g.c.id})">분류 삭제</button>`}</div>` : ''}</div></section>`; }).join('')
      : '<section class="card"><div class="mp-empty">분류가 없어요. 위의 ＋ 분류 추가로 식자재, 부자재처럼 분류를 먼저 만들어 주세요.</div></section>'}`;
    window.scrollTo(0, y);
    IT.groups = groups;
  }
  window.itAdd = gi => { const g = IT.groups[gi]; if (g) itEdit(null, g.name); };
  window.itToggle = gi => { const g = IT.groups[gi]; if (!g) return; IT.open.has(g.name) ? IT.open.delete(g.name) : IT.open.add(g.name); itDraw(); };
  window.itMove = async (id, d) => { try { IT.list = await rx('mst_admin_item_move', { p_id: id, p_dir: d }); itDraw(); } catch (e) { toast(e.message); } };
  window.itCatMove = async (id, d) => { try { IT.cats = await rx('mst_admin_item_cat_move', { p_id: id, p_dir: d }); IT.list = await rx('mst_admin_items'); itDraw(); } catch (e) { toast(e.message); } };
  window.itCatDel = async id => { const c = IT.cats.find(x => x.id === id); if (!c || !confirm(`'${c.name}' 분류를 삭제할까요?`)) return;
    try { IT.cats = await rx('mst_admin_item_cat_delete', { p_id: id }); IT.open.delete(c.name); toast('삭제했어요'); itDraw(); } catch (e) { toast(e.message); } };
  window.itCat = id => {
    const c = id ? IT.cats.find(x => x.id === id) : null;
    dlg(c ? '분류 이름 바꾸기' : '분류 추가', c ? '이름을 바꾸면 이 분류의 품목도 함께 바뀌어요.' : '예: 식자재, 부자재, 일회용품. 새 분류는 맨 아래에 생기고 ▲▼로 순서를 바꿀 수 있어요.',
      `<label class="px-l" for="gc-n">분류 이름</label><input class="gm-in" id="gc-n" maxlength="30" value="${h(c ? c.name : '')}">`,
      `<span style="flex:1"></span><button class="btn ghost" onclick="pxClose()">취소</button><button class="btn primary" id="gc-s">${c ? '저장' : '추가'}</button>`);
    $$('gc-s').onclick = async () => { const b = $$('gc-s'), nm = $$('gc-n').value.trim(); b.disabled = true;
      try { IT.cats = await rx('mst_admin_item_cat_save', { p: { id: c ? c.id : null, name: nm } });
        if (c && IT.open.delete(c.name)) IT.open.add(nm); if (!c) IT.open.add(nm);
        if (c) IT.list = await rx('mst_admin_items'); pxClose(); toast(c ? '바꿨어요' : '분류를 추가했어요'); itDraw(); }
      catch (e) { b.disabled = false; toast(e.message); } };
  };
  window.itEdit = (id, preCat) => {
    if (!IT.cats.length) { toast('분류를 먼저 추가해 주세요'); return itCat(null); }
    const it = id ? IT.list.find(x => x.id === id) : null, cur = it ? it.cat : (preCat || '');
    dlg(it ? '품목 수정' : '새 품목', '',
      `<label class="px-l" for="gi-c">분류</label><select class="gm-in" id="gi-c">${cur ? '' : '<option value="">분류를 골라 주세요</option>'}${IT.cats.map(c => `<option ${c.name === cur ? 'selected' : ''}>${h(c.name)}</option>`).join('')}</select>
       <label class="px-l" for="gi-n">품목 이름</label><input class="gm-in" id="gi-n" value="${h(it ? it.name : '')}" placeholder="예: 우마미소스 [5kg*2]">
       <div class="gm-row2"><div><label class="px-l" for="gi-u">단위</label><input class="gm-in" id="gi-u" value="${h(it ? it.unit : '')}" placeholder="box, 개"></div>
         <div><label class="px-l" for="gi-p">단가 <small>원, 부가세 포함</small></label><input class="gm-in" id="gi-p" inputmode="numeric" value="${it && it.price ? it.price : ''}" placeholder="0"></div></div>
       <label class="px-l" for="gi-m">점주에게 보일 메모 <small>선택</small></label><input class="gm-in" id="gi-m" maxlength="200" value="${h(it ? it.memo : '')}" placeholder="예: 1box = 1kg×10">
       <label class="gm-sw1"><input type="checkbox" id="gi-a" ${!it || it.active ? 'checked' : ''}> 판매 중 <small>끄면 점주 화면에서 숨겨져요</small></label>`,
      `${it ? '<button class="btn ghost gm-redt" id="gi-d">품목 삭제</button>' : ''}<span style="flex:1"></span><button class="btn ghost" onclick="pxClose()">취소</button><button class="btn primary" id="gi-s">저장</button>`);
    $$('gi-p').oninput = e => { e.target.value = e.target.value.replace(/\D/g, ''); };
    $$('gi-s').onclick = async () => { const b = $$('gi-s'), cat = $$('gi-c').value; b.disabled = true;
      try { IT.list = await rx('mst_admin_item_save', { p: { id: it ? it.id : null, cat, name: $$('gi-n').value, unit: $$('gi-u').value, price: $$('gi-p').value, memo: $$('gi-m').value, active: $$('gi-a').checked } });
        IT.cats = await rx('mst_admin_item_cats'); IT.open.add(cat); pxClose(); toast('저장했어요'); itDraw(); }
      catch (e) { b.disabled = false; toast(e.message); } };
    const d = $$('gi-d'); if (d) d.onclick = async () => {
      if (!confirm(`'${it.name}'을 삭제할까요?\n점주 발주 화면에서 사라지고 되돌릴 수 없어요. 지난 발주 내역은 그대로 남아요.\n잠시 빼 두려면 삭제 대신 '판매 중'을 끄세요.`)) return;
      try { IT.list = await rx('mst_admin_item_delete', { p_id: it.id }); IT.cats = await rx('mst_admin_item_cats'); pxClose(); toast('삭제했어요'); itDraw(); } catch (e) { toast(e.message); } };
  };

  /* ==========================================================
     레시피
     ========================================================== */
  const RC = { list: [] };
  async function rcPage(){
    gmShell('레시피', 'RECIPES', '레시피', "'공개'로 둔 레시피만 점주 앱에 보여요. 사진·영상·문서를 함께 올릴 수 있어요.");
    try { RC.list = await rx('mst_admin_recipes'); } catch (e) { return gmFail(e); }
    rcList();
  }
  function rcList(){
    const box = gmBody(); if (!box) return;
    const L = RC.list, cats = [...new Set(L.map(r => r.cat || '기타'))];
    box.innerHTML = `<div class="data-note"><span class="status-dot"></span><span>레시피 ${L.length}개 · 공개 ${L.filter(r => r.published).length}개</span>
        <span class="gm-topbtns"><button class="btn primary" onclick="rcEdit('new')">＋ 새 레시피</button></span></div>
      ${L.length ? cats.map(c => `<section class="card"><div class="section-title"><strong>${h(c)}</strong><small>${L.filter(r => (r.cat || '기타') === c).length}개</small></div>
        <div class="mp-list">${L.filter(r => (r.cat || '기타') === c).map(r => `<button type="button" class="mp-h" onclick="rcEdit(${r.id})">
          <span class="mp-st ${r.published ? 'ship' : 'off'}">${r.published ? '공개' : '비공개'}</span><span class="mp-sum" style="color:#232621;font-weight:600">${h(r.title)}</span>
          ${r.files.length ? `<span class="np-c">첨부 ${r.files.length}</span>` : ''}<span class="mp-at">${h(r.at)}${r.by ? ' · ' + h(r.by) : ''}</span></button>`).join('')}</div></section>`).join('')
        : '<section class="card"><div class="mp-empty">아직 레시피가 없어요. 사진이나 영상과 함께 올려 보세요.</div></section>'}`;
  }
  window.rcEdit = function(id){
    const box = gmBody(); if (!box) return;
    const isNew = id === 'new', r = isNew ? null : RC.list.find(x => x.id === +id);
    const cats = [...new Set(RC.list.map(x => x.cat).filter(Boolean))];
    const st = { files: r ? r.files.slice() : [], fresh: [] };
    window.scrollTo(0, 0);
    box.innerHTML = `<div class="fnn-dtop"><button type="button" class="fnn-back" onclick="rcLeave()">‹ 레시피</button></div>
      <section class="card gm-form"><h2 class="gm-h2">${isNew ? '새 레시피' : '레시피 수정'}</h2>
      <div class="gm-2col"><div>
        <label class="gm-l" for="re-c">분류</label><input class="gm-in" id="re-c" list="re-cl" value="${h(r ? r.cat : '')}" placeholder="예: 라멘, 사이드, 소스"><datalist id="re-cl">${cats.map(c => `<option value="${h(c)}">`).join('')}</datalist>
        <label class="gm-l" for="re-t">레시피 이름</label><input class="gm-in" id="re-t" maxlength="100" value="${h(r ? r.title : '')}" placeholder="예: 돈코츠 라멘">
        <label class="gm-l" for="re-b">만드는 법</label><textarea class="gm-in" id="re-b" rows="12" placeholder="재료, 양, 순서를 적어 주세요">${h(r ? r.body : '')}</textarea>
      </div><div>
        <label class="gm-l">사진·영상·문서 <small>20개까지</small></label><label class="gm-file">${ic('file')}파일 고르기<input type="file" id="re-f" multiple hidden></label><div id="re-fl"></div>
        <label class="gm-sw1" style="margin-top:16px"><input type="checkbox" id="re-p" ${r && r.published ? 'checked' : ''}> 공개 <small>켜면 모든 가맹점 점주가 볼 수 있어요</small></label>
      </div></div>
      <div class="gm-actions">${r ? '<button type="button" class="btn ghost gm-redt" id="re-d">레시피 삭제</button>' : ''}<span style="flex:1"></span>
        <button type="button" class="btn ghost" onclick="rcLeave()">취소</button><button type="button" class="btn primary" id="re-s">저장하기</button></div></section>`;
    bindUp('re-fl', 're-f', 'mst-recipes', 'r', st);
    window.rcLeave = () => { if (st.fresh.length) rmFiles('mst-recipes', st.fresh); st.fresh = []; rcList(); };
    $$('re-s').onclick = async () => {
      const b = $$('re-s');
      if (st.files.some(f => !f.path)) return toast('파일을 올리는 중이에요. 잠시만 기다려 주세요.');
      b.disabled = true;
      try {
        const x = await rx('mst_admin_recipe_save', { p: { id: r ? r.id : null, cat: $$('re-c').value, title: $$('re-t').value, body: $$('re-b').value, published: $$('re-p').checked,
          sort: r ? r.sort : '', files: st.files.map(f => ({ name: f.name, path: f.path, size: f.size, mime: f.mime || '' })) } });
        await rmFiles('mst-recipes', x && x.removed); st.fresh = [];
        RC.list = await rx('mst_admin_recipes'); toast('저장했어요'); rcList();
      } catch (e) { b.disabled = false; toast(e.message); }
    };
    const d = $$('re-d'); if (d) d.onclick = async () => {
      if (!confirm('레시피를 삭제할까요?\n첨부 파일도 함께 지워지고 되돌릴 수 없어요.')) return;
      try { const x = await rx('mst_admin_recipe_delete', { p_id: r.id }); await rmFiles('mst-recipes', x && x.removed); RC.list = await rx('mst_admin_recipes'); toast('삭제했어요'); rcList(); }
      catch (e) { toast(e.message); }
    };
  };

  /* ==========================================================
     점주 계정 (관리자만)
     ========================================================== */
  const AC = { users: [], stores: [] };
  async function adminUsers(body){
    const { data, error } = await SB.functions.invoke('admin-users', { body: { ...body, scope: 'mst' } });
    if (error) { let m = error.message; try { const j = await error.context.json(); m = j.error || m; } catch (e) {} throw new Error(m); }
    if (data && data.ok === false) throw new Error(data.error);
    return data;
  }
  const tempPw = () => { const c = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; crypto.getRandomValues(new Uint32Array(8)).forEach(x => s += c[x % c.length]); return s.slice(0, 4) + s.slice(4).replace(/[a-z]/g, d => String(d.charCodeAt(0) % 10)); };
  const guide = (id, pw) => `[멘야 파트너스]\n주소: ${STORE_URL}\n아이디: ${id}\n임시 비밀번호: ${pw}\n\n처음 로그인하면 비밀번호를 바꿔 주세요.\n휴대폰 홈 화면에 추가하면 앱처럼 쓸 수 있어요.`;
  async function acPage(){
    gmShell('점주 계정', 'OWNER ACCOUNTS', '점주 계정', '여기서 만든 계정은 멘야 파트너스(store.menyamatsuri.work)에만 들어갈 수 있어요. 워크스페이스 사용자 목록에는 보이지 않아요. (관리자만)');
    try { const d = await rx('mst_admin_data'); AC.users = d.users || []; AC.stores = d.stores || []; } catch (e) { return gmFail(e); }
    acList();
  }
  function acList(){
    const box = gmBody(); if (!box) return;
    const U = AC.users;
    box.innerHTML = `<div class="data-note"><span class="status-dot"></span><span>계정 ${U.length}개 · 사용 중 ${U.filter(u => u.active).length}개</span>
        <span class="gm-topbtns"><button class="btn primary" onclick="acEdit(null)">＋ 계정 만들기</button></span></div>
      <section class="card"><div class="mp-list">${U.length ? U.map(u => `<button type="button" class="mp-h" onclick="acEdit('${h(u.uid)}')">
          <span class="mp-st ${!u.active ? 'off' : u.first ? 'new' : 'ship'}">${!u.active ? '사용 중지' : u.first ? '첫 로그인 전' : '사용 중'}</span>
          <b>${h(u.store || '매장 없음')}</b><span class="mp-sum">${h(u.name)} · ${h(u.id)}${u.phone ? ' · ' + h(u.phone) : ''}</span><span class="mp-at">${h(u.created)} 생성</span></button>`).join('')
        : '<div class="mp-empty">아직 점주 계정이 없어요. 매장을 골라 첫 계정을 만들어 보세요.</div>'}</div></section>`;
  }
  function acGuide(title, id, pw){
    const t = guide(id, pw);
    dlg(title, '아래 안내를 점주님께 보내 주세요. 임시 비밀번호는 이 창을 닫으면 다시 볼 수 없어요.', `<pre class="gm-copy">${h(t)}</pre>`,
      `<span style="flex:1"></span><button class="btn ghost" id="ag-c">복사</button><button class="btn primary" onclick="pxClose();acReload()">닫기</button>`);
    $$('ag-c').onclick = async () => { try { await navigator.clipboard.writeText(t); toast('복사했어요'); } catch (e) { toast('복사하지 못했어요. 직접 선택해 복사해 주세요.'); } };
  }
  window.acReload = () => acPage();
  window.acEdit = uid => {
    const u = uid ? AC.users.find(x => x.uid === uid) : null, S2 = AC.stores;
    const opts = S2.map(s => `<option value="${s.id}" ${u && u.store_id === s.id ? 'selected' : ''}>${h(s.name)}${s.type === '직영' ? ' (직영)' : ''}${s.accounts ? ` · 계정 ${s.accounts}` : ''}</option>`).join('');
    if (!u) {
      const pw = tempPw();
      dlg('계정 만들기', '',
        `<label class="px-l" for="ac-s">매장</label><select class="gm-in" id="ac-s"><option value="">매장을 골라 주세요</option>${opts}</select>
         <label class="px-l" for="ac-i">아이디 <small>영문 소문자·숫자 2~30자 · 예: dorong</small></label><input class="gm-in" id="ac-i" autocapitalize="none" spellcheck="false">
         <label class="px-l" for="ac-n">점주 이름</label><input class="gm-in" id="ac-n">
         <label class="px-l" for="ac-p">연락처 <small>선택</small></label><input class="gm-in" id="ac-p" inputmode="tel">
         <label class="px-l" for="ac-w">임시 비밀번호</label><input class="gm-in" id="ac-w" value="${pw}">`,
        `<span style="flex:1"></span><button class="btn ghost" onclick="pxClose()">취소</button><button class="btn primary" id="ac-go">만들기</button>`);
      $$('ac-s').onchange = e => { const s = S2.find(x => x.id === +e.target.value); if (s && !$$('ac-n').value && s.owner) $$('ac-n').value = s.owner; };
      $$('ac-go').onclick = async () => { const b = $$('ac-go'), id = $$('ac-i').value.trim().toLowerCase(), p = $$('ac-w').value; b.disabled = true;
        try { await adminUsers({ action: 'create', store_id: +$$('ac-s').value || null, login_id: id, name: $$('ac-n').value, phone: $$('ac-p').value, password: p }); acGuide('계정을 만들었어요', id, p); }
        catch (e) { b.disabled = false; toast(e.message); } };
      return;
    }
    dlg(`${u.store || ''} · ${u.name}`, `아이디 ${h(u.id)}${u.first ? ' · 아직 첫 로그인을 하지 않았어요' : ''}${u.stopped ? ` · ${h(u.stopped)} 사용 중지` : ''}`,
      `<label class="px-l" for="ac-s">매장</label><select class="gm-in" id="ac-s">${opts}</select>
       <label class="px-l" for="ac-n">점주 이름</label><input class="gm-in" id="ac-n" value="${h(u.name)}">
       <label class="px-l" for="ac-p">연락처</label><input class="gm-in" id="ac-p" inputmode="tel" value="${h(u.phone || '')}">`,
      `<button class="btn ghost" id="ac-r">비밀번호 초기화</button><button class="btn ghost ${u.active ? 'gm-redt' : ''}" id="ac-a">${u.active ? '사용 중지' : '다시 사용'}</button><span style="flex:1"></span>
       <button class="btn ghost" onclick="pxClose()">취소</button><button class="btn primary" id="ac-go">저장</button>`);
    $$('ac-go').onclick = async () => { const b = $$('ac-go'); b.disabled = true;
      try { await adminUsers({ action: 'update', id: u.uid, name: $$('ac-n').value, phone: $$('ac-p').value, store_id: +$$('ac-s').value }); pxClose(); toast('저장했어요'); acPage(); }
      catch (e) { b.disabled = false; toast(e.message); } };
    $$('ac-r').onclick = async () => { if (!confirm('비밀번호를 초기화할까요?\n새 임시 비밀번호를 만들어요. 점주님은 다음 로그인 때 비밀번호를 다시 정해요.')) return;
      const p = tempPw(); try { await adminUsers({ action: 'reset_password', id: u.uid, password: p }); acGuide('비밀번호를 초기화했어요', u.id, p); } catch (e) { toast(e.message); } };
    $$('ac-a').onclick = async () => { if (u.active && !confirm('이 계정을 사용 중지할까요?\n바로 로그인할 수 없게 돼요. 폐점·양도 때 써 주세요. 다시 사용으로 되돌릴 수 있어요.')) return;
      try { await adminUsers({ action: 'set_active', id: u.uid, active: !u.active }); pxClose(); toast(u.active ? '사용 중지했어요' : '다시 사용하게 했어요'); acPage(); } catch (e) { toast(e.message); } };
  };

  /* ==========================================================
     거래명세서 출력 (본사 엑셀 양식 · 공급자용 + 공급받는자용 A4 한 장)
     ========================================================== */
  window.mpStmt = async id => {
    const w = window.open('', '_blank');
    if (!w) return toast('팝업이 막혀 있어요. 브라우저에서 팝업을 허용해 주세요.');
    w.document.write('<p style="font-family:sans-serif;padding:30px;color:#666">거래명세서를 만드는 중...</p>');
    let d; try { d = await rx('mst_statement', { p_id: id }); } catch (e) { w.document.body.innerHTML = `<p style="font-family:sans-serif;padding:30px;color:#c62429">${errMsg2(e)}</p>`; return; }
    const c = d.company || {}, it = d.items || [];
    const sup = it.reduce((a, i) => a + Number(i.supply || 0), 0), tax = it.reduce((a, i) => a + Number(i.tax || 0), 0);
    const [yy, mm, dd] = String(d.date || '').split('-'), dt = yy ? `${yy}년 ${+mm}월 ${+dd}일` : '';
    const ceo = String(c.ceo || '').split('').join(' ');
    const rows = it.map(i => `<tr><td>${h(i.name)}</td><td>${h(i.spec || '')}</td><td>${Number(i.qty)}</td><td>${won(Math.round(Number(i.price || 0) / 1.1))}</td><td>${won(i.supply)}</td><td>${won(i.tax)}</td></tr>`).join('')
      + '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>'.repeat(Math.max(0, 9 - it.length));
    const copy = kind => `<div class="stmt"><div class="shd"><div class="l"><h2>거래명세서<small>(${kind})</small></h2>
        <div class="to"><span>멘야마쯔리 ${h(d.store)}</span><span>귀하</span></div>
        <div class="bk"><span>${h(c.bank || '')} ${h(c.account || '')}</span><span>예금주 : ${h(c.holder || '')}</span></div>
        <div class="dt">${dt}</div><div class="tot"><span>합계 (부가세 포함)</span><b>₩${won(d.total)}</b></div></div>
      <table class="sup"><tbody><tr class="h"><td colspan="5">공급자</td></tr>
        <tr><td class="k">상호</td><td>${h(c.name || '')}</td><td>대표자</td><td>${h(ceo)}</td><td>(인)</td></tr>
        <tr><td class="k">등록번호</td><td colspan="4">${h(c.biz_no || '')}</td></tr>
        <tr><td class="k">주소</td><td colspan="4" style="height:36px">${h(c.addr || '')}</td></tr>
        <tr><td class="k">전화</td><td>${h(c.tel || '')}</td><td>팩스</td><td colspan="2">${h(c.fax || '')}</td></tr></tbody></table></div>
      <table class="lines"><colgroup><col style="width:30%"><col style="width:12%"><col style="width:12%"><col style="width:14%"><col style="width:18%"><col style="width:14%"></colgroup>
        <thead><tr><th>품명</th><th>규격</th><th>수량</th><th>단가</th><th>공급가액</th><th>세액</th></tr></thead><tbody>${rows}</tbody>
        <tfoot><tr><td>합계</td><td></td><td></td><td></td><td>${won(sup)}</td><td>${won(tax)}</td></tr></tfoot></table>
      <div class="ft"><span>입금자 : ${h(d.payer || '')}</span><span class="m">인수자</span><span>(인)</span></div></div>`;
    w.document.open();
    w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>거래명세서 ${h(d.store)} ${h(d.date)}</title>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;800&display=swap">
      <style>body{margin:0;background:#eef0ea;font-family:'Nanum Gothic',sans-serif;color:#111}
      .bar{position:sticky;top:0;display:flex;gap:8px;align-items:center;padding:10px 16px;background:#fff;border-bottom:1px solid #ddd;font-size:13px}
      .bar button{border:0;border-radius:8px;background:#c62429;color:#fff;font-weight:700;padding:9px 16px;font-size:13px;cursor:pointer}
      .pg{max-width:800px;margin:16px auto;background:#fff;padding:26px 30px}
      .stmt{font-size:11px;line-height:1.45;padding-bottom:20px}.stmt+.stmt{margin-top:26px;border-top:1px dashed #bbb;padding-top:26px}
      .shd{display:grid;grid-template-columns:1fr 1fr;gap:22px;align-items:start}
      .l h2{margin:0;font-size:29px;font-weight:800;display:flex;align-items:flex-start;gap:14px}.l h2 small{font-size:9px;font-weight:400;margin-top:4px}
      .l .to{font-size:15.5px;margin:10px 0 6px 46px;display:flex;gap:34px}.l .bk{display:flex;gap:46px;font-weight:800;font-size:11.5px;margin:4px 0}
      .l .dt{font-weight:800;font-size:11.5px;margin:4px 0 6px}.l .tot{display:flex;align-items:baseline;gap:96px;font-size:13px}.l .tot b{font-size:19px;font-weight:400}
      table{width:100%;border-collapse:collapse}.sup td{padding:5px 4px;border-bottom:1px solid #222;font-size:10.5px;vertical-align:top}
      .sup tr.h td{background:#b7dee8;font-weight:800;border-top:1px solid #222}.sup td.k{width:62px}
      .lines{margin-top:10px}.lines th{background:#b7dee8;font-weight:800;text-align:right;padding:4px 2px;border-top:1px solid #222;border-bottom:1px solid #222}
      .lines th:first-child,.lines td:first-child{text-align:left}.lines td{padding:3px 2px;text-align:right;height:18px}
      .lines tfoot td{background:#b7dee8;font-weight:800;border-top:1px solid #222;border-bottom:1px solid #222}
      .ft{display:flex;justify-content:space-between;font-size:13px;margin-top:8px}.ft .m{margin-left:auto;margin-right:200px}
      @media print{body{background:#fff}.bar{display:none}.pg{margin:0;padding:0;max-width:none}.stmt+.stmt{border-top:0;margin-top:14mm;padding-top:0}
        *{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:14mm 12mm}}</style></head>
      <body><div class="bar"><b>${h(d.store)} · ${h(d.no || '')}</b><span style="flex:1"></span><button onclick="print()">인쇄 · PDF 저장</button></div>
      <div class="pg">${copy('공급자용')}${copy('공급받는자용')}</div></body></html>`);
    w.document.close();
  };

  /* ==========================================================
     대시보드: 가맹점 앱 (처리할 발주 · 공지 현황)
     ========================================================== */
  function dashOrders(){
    const O = (MP.list || []).filter(o => o.status === 'received' || o.status === 'confirmed')
      .sort((a, b) => (a.status === 'received' ? 0 : 1) - (b.status === 'received' ? 0 : 1));
    const nNew = O.filter(o => o.status === 'received').length, nShip = O.length - nNew;
    return `<section class="card gmd-c"><div class="gmd-top"><span><em class="${nNew ? 'red' : ''}">${nNew}</em> 접수 대기</span><span><em>${nShip}</em> 발송 대기</span>
        <button class="btn ghost" onclick="go('${PAGE}')">발주 열기</button></div>
      ${O.length ? O.slice(0, 6).map(o => `<button type="button" class="gmd-row" onclick="mpOpen(${o.id})"><span class="mp-st ${o.status === 'received' ? 'new' : 'ing'}">${o.status === 'received' ? '접수 대기' : '발송 대기'}</span>
        <b>${h(o.store)}</b><span class="t">${h(o.items[0] ? o.items[0].name : '')}${o.items.length > 1 ? ` 외 ${o.items.length - 1}건` : ''}</span><small>${won(o.total)}원</small></button>`).join('')
        + (O.length > 6 ? `<div class="gmd-more">외 ${O.length - 6}건</div>` : '') : '<div class="gmd-empty">처리할 발주가 없어요.</div>'}</section>`;
  }
  function dashNotices(){
    const N = (MN.list || []).filter(n => n.status === 'active');
    const pend = (MN.list || []).reduce((s, n) => s + (n.pending || 0), 0);
    return `<section class="card gmd-c"><div class="gmd-top"><span><em>${N.length}</em> 게시 중</span><span><em class="${pend ? 'red' : ''}">${pend}</em> 답변 대기</span>
        <span class="gmd-btns"><button class="btn ghost" onclick="npEdit('new')">＋ 새 공지</button><button class="btn ghost" onclick="go('${NP}')">공지 열기</button></span></div>
      ${N.length ? N.slice(0, 5).map(n => { const un = n.targets - n.read, ua = n.ack ? n.targets - n.acked : 0;
        return `<button type="button" class="gmd-row" onclick="npOpen(${n.id})">${n.pin ? '<em class="fnn-pin">필독</em>' : ''}<span class="t">${h(n.title)}</span>
          <small>읽음 ${n.read}/${n.targets}${n.ack ? ` · 확인 ${n.acked}/${n.targets}` : ''}</small>${n.pending ? `<span class="mp-st new">답변 ${n.pending}</span>` : un ? `<span class="mp-st off">안 읽음 ${un}</span>` : ua ? `<span class="mp-st off">미확인 ${ua}</span>` : ''}</button>`; }).join('')
        : '<div class="gmd-empty">게시 중인 공지가 없어요.</div>'}</section>`;
  }
  /* 대시보드 순서: 1 본사 공지 · 2 FC다움 가맹점 공지 · 3 FC다움 가맹점 발주 · 4 파트너스 공지 · 5 파트너스 발주 · 6 제때 공급 현황 (바로가기 없음) */
  function gmDashOrder(){
    const main = document.getElementById('main'); if (!main) return;
    const secs = [...main.querySelectorAll('.dash-sec')]; if (!secs.length) return;
    const title = x => ((x.querySelector('.sec-head h2') || {}).textContent || '').trim();
    const find = (...ts) => secs.find(x => ts.includes(title(x)));
    const hq = main.querySelector('#nt-dash-sec') || find('본사 공지');
    const fn = find('가맹점 공지', '최근 점주 공지', 'FC다움 가맹점 공지');
    const fo = find('가맹점 발주', '본사 택배 발주', 'FC다움 가맹점 발주');
    const pn = main.querySelector('.gmd-n'), po = main.querySelector('.gmd-o');
    const jt = find('제때 공급 현황');
    const sc = find('바로가기'); if (sc) sc.remove();
    if (fn) fn.querySelector('.sec-head h2').textContent = 'FC다움 가맹점 공지';
    if (fo) fo.querySelector('.sec-head h2').textContent = 'FC다움 가맹점 발주';
    const order = [hq, fn, fo, pn, po, jt].filter(Boolean);
    const rest = secs.filter(x => !order.includes(x) && x !== sc);
    const anchor = order[0] || rest[0]; if (!anchor) return;
    const box = document.createElement('div'); anchor.before(box);
    [...order, ...rest].forEach(x => box.before(x)); box.remove();
    let n = 0; main.querySelectorAll('.dash-sec .sec-n').forEach(x => { x.textContent = String(++n); });
  }
  function gmDashInsert(){
    if (!can() || window.__curPage && window.__curPage !== 'dash') return false;
    const main = document.getElementById('main'); if (!main) return false;
    if (main.querySelector('.gmd-n')) { gmDashOrder(); return true; }
    const secs = [...main.querySelectorAll('.dash-sec')]; if (!secs.length) return false;
    const mk = (cls, t, sub, inner) => { const x = document.createElement('section'); x.className = 'dash-sec ' + cls;
      x.innerHTML = secHead('', t, { cls: 'mp', t: '멘야 파트너스' }, sub) + `<div class="gmd-box">${inner}</div>`; return x; };
    const pn = mk('gmd-n', '파트너스 공지', '게시 중 · 읽음·확인·답변 대기', '<div class="gmd-empty">불러오는 중...</div>');
    const po = mk('gmd-o', '파트너스 발주', '접수 대기 · 발송 대기', '<div class="gmd-empty">불러오는 중...</div>');
    secs[secs.length - 1].after(pn); pn.after(po);
    gmDashOrder();
    Promise.all([load(true), npLoad(true)]).then(() => {
      const a = pn.querySelector('.gmd-box'), b = po.querySelector('.gmd-box');
      if (a) a.innerHTML = dashNotices(); if (b) b.innerHTML = dashOrders();
    }).catch(e => { [pn, po].forEach(x => { const b = x.querySelector('.gmd-box'); if (b) b.innerHTML = `<div class="gmd-empty">불러오지 못했어요: ${errMsg2(e)}</div>`; }); });
    return true;
  }
  window.gmDashInsert = gmDashInsert;
  const pageDashboardGm = pageDashboard;
  pageDashboard = function(){
    const r = pageDashboardGm.apply(this, arguments);
    try {
      if (!gmDashInsert()) {   // 대시보드가 데이터를 받은 뒤 그려지는 경우: 나타나면 넣기
        const main = document.getElementById('main');
        if (main) { const ob = new MutationObserver(() => { if (gmDashInsert()) ob.disconnect(); }); ob.observe(main, { childList: true, subtree: true }); setTimeout(() => ob.disconnect(), 20000); }
      }
    } catch (e) { console.warn('대시보드 가맹점 앱 실패', e); }
    return r;
  };

  const st2 = document.createElement('style');
  st2.textContent = `
  .gm-sep{margin:10px 0 2px 22px;font-size:10px;letter-spacing:.3px;color:#6b7766}
  .gm-red{color:#c62429}.gm-redt{color:#c62429!important}
  .gm-topbtns{margin-left:auto;display:flex;gap:6px}.gm-topbtns .btn{min-height:34px;font-size:12px;padding:6px 12px}
  .gm-form{padding:22px 24px}.gm-h2{margin:0 0 14px;font-size:18px}
  .gm-note{background:#f5f6f1;border-radius:10px;padding:10px 12px;font-size:12.5px;color:#4d524a;margin-bottom:10px}
  .gm-2col{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:26px}
  .gm-l{display:block;font-size:12px;font-weight:700;color:#4a5244;margin:14px 0 6px}.gm-l small{font-weight:500;color:#909b84;margin-left:6px}
  .gm-in{box-sizing:border-box;width:100%;min-height:42px;border:1px solid #dcdfd5;border-radius:10px;padding:9px 12px;font:inherit;font-size:14px;background:#fff;color:#1f241c}
  textarea.gm-in{resize:vertical;line-height:1.6}
  .gm-in:focus{outline:none;border-color:#9da98c;box-shadow:0 0 0 3px #89947518}
  .gm-file{display:inline-flex;align-items:center;gap:6px;border:1px dashed #c9cebf;border-radius:10px;padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;color:#4a5244}
  .gm-file .icon{width:15px;height:15px}
  .gm-up{display:flex;align-items:center;gap:8px;padding:8px 2px;border-bottom:1px solid #f0f1ec;font-size:13px}.gm-up .icon{width:14px;height:14px;color:#8b9381}
  .gm-up span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gm-up small{color:#909b84}
  .gm-up button{border:0;background:none;color:#c62429;font-size:12px;cursor:pointer}
  .gm-chips-bar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
  .gm-chips{display:flex;flex-wrap:wrap;gap:6px;max-height:220px;overflow:auto;margin-top:8px;padding:2px}
  .gm-chip{border:1px solid #dcdfd5;background:#fff;border-radius:16px;padding:6px 12px;font-size:12.5px;cursor:pointer;color:#3c4436}
  .gm-chip small{color:#909b84;font-size:11px}.gm-chip.on{background:#232621;color:#fff;border-color:#232621}.gm-chip.on small{color:#c9cdc4}
  .gm-hint{font-size:11.5px;color:#8b9381;margin:6px 0 0;line-height:1.6}
  .gm-sw{border:1px solid #e6e8e0;border-radius:12px;overflow:hidden}
  .gm-sw label{display:flex;align-items:center;gap:12px;padding:10px 12px;border-top:1px solid #f0f1ec;cursor:pointer}.gm-sw label:first-child{border-top:0}
  .gm-sw span{flex:1}.gm-sw b{display:block;font-size:13px}.gm-sw small{font-size:11.5px;color:#8b9381}
  .gm-sw input,.gm-sw1 input{width:18px;height:18px;accent-color:#c62429}
  .gm-sw1{display:flex;align-items:center;gap:8px;margin-top:14px;font-size:13.5px;font-weight:600;cursor:pointer}.gm-sw1 small{font-weight:500;color:#8b9381}
  .gm-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:20px;padding-top:16px;border-top:1px solid #eef0ea}
  .gm-row2{display:grid;grid-template-columns:1fr 1.3fr;gap:10px}
  .gm-copy{white-space:pre-wrap;background:#f5f6f1;border-radius:10px;padding:12px 14px;font:inherit;font-size:13px;line-height:1.7;margin:0}
  .gm-acc{padding:0;overflow:hidden;margin-bottom:10px}
  .gm-acc-h{display:flex;align-items:center;gap:6px;padding:4px 10px 4px 6px}
  .gm-tgl{flex:1;min-width:0;display:flex;align-items:center;gap:10px;border:0;background:none;padding:12px 8px;cursor:pointer;text-align:left;font:inherit}
  .gm-tgl b{font-size:15px}.gm-tgl small{color:#8b9381;font-size:12px}
  .gm-tgl .icon{width:15px;height:15px;color:#8b9381;transform:rotate(-90deg);transition:transform .2s;flex-shrink:0}
  .gm-acc.open .gm-tgl .icon{transform:rotate(0)}
  .gm-acc-b{display:none;border-top:1px solid #eef0ea}.gm-acc.open .gm-acc-b{display:block}
  .gm-mv{display:flex;gap:2px;padding-left:8px;border-left:1px solid #eef0ea}
  .gm-mv button{width:30px;height:30px;border:0;border-radius:8px;background:none;color:#4a5244;cursor:pointer;font-size:11px}
  .gm-mv button:hover:not(:disabled){background:#f3f4ef}.gm-mv button:disabled{opacity:.25;cursor:default}
  .gm-irow{display:flex;align-items:center;gap:10px;padding:2px 10px 2px 6px;border-top:1px solid #f0f1ec}.gm-irow:first-child{border-top:0}
  .gm-imain{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;border:0;background:none;padding:10px 8px;text-align:left;cursor:pointer;font:inherit}
  .gm-imain .t{font-size:13.5px;font-weight:600;color:#232621}.gm-imain .t.off{color:#a3a99b}.gm-imain small{font-size:11.5px;color:#8b9381}
  .gm-imain:hover .t{color:#c62429}
  .gm-ipr{font-weight:700;font-size:13px;font-variant-numeric:tabular-nums;white-space:nowrap}
  .gm-acc-f{display:flex;gap:6px;flex-wrap:wrap;padding:10px 12px;background:#f8f9f5;border-top:1px solid #eef0ea}.gm-acc-f .btn{min-height:32px;font-size:12px;padding:5px 11px}
  #mp-px .px-box.wide{width:min(820px,100%)}
  #mp-px .gm-in{margin:0}
  .gmd-btns{margin-left:auto;display:flex;gap:6px}.gmd-btns .btn{margin-left:0!important}
  .gmd-c{padding:16px 18px;margin:0}
  .gmd-top{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:8px}.gmd-top b{font-size:14px}
  .gmd-top span{font-size:12px;color:#5e625b}.gmd-top em{font-style:normal;font-size:18px;font-weight:800;color:#232621;margin-right:2px}.gmd-top em.red{color:#c62429}
  .gmd-top .btn{margin-left:auto;min-height:30px;font-size:12px;padding:4px 10px}
  .gmd-row{display:flex;align-items:center;gap:8px;width:100%;border:0;border-top:1px solid #f0f1ec;background:none;padding:9px 2px;font:inherit;font-size:13px;text-align:left;cursor:pointer}
  .gmd-row b{flex:none;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .gmd-row .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#3c4436}
  .gmd-row small{flex:none;font-size:11.5px;color:#8b9381;font-variant-numeric:tabular-nums}
  .gmd-row:hover .t{color:#c62429}
  .gmd-empty{color:#909b84;font-size:13px;text-align:center;padding:18px 0;border-top:1px solid #f0f1ec}
  .gmd-more{font-size:11.5px;color:#8b9381;padding:6px 2px}
  .gmd-new{margin-top:8px;border:1px dashed #c9cebf;border-radius:10px;background:none;width:100%;padding:8px;font:inherit;font-size:12.5px;font-weight:700;color:#4a5244;cursor:pointer}
  .src.mp{background:#fbeaea;color:#a3262c}
  @media(max-width:860px){.gm-2col{grid-template-columns:1fr;gap:0}}
  @media(max-width:640px){.gm-form{padding:16px 14px}.gm-topbtns{margin-left:0;width:100%}.gm-topbtns .btn{flex:1}.gm-row2{grid-template-columns:1fr}
    .gm-irow{flex-wrap:wrap}.gm-ipr{margin-left:8px}}`;
  document.head.appendChild(st2);

})();
