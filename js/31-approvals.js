
/* ==========================================================
   상신·결재 (2026-11-03, 11-04 결재라인) — 순서대로 결재 + 참조
   - 상신: 모든 계정 (서류매뉴얼의 양식을 내려받아 작성 → 첨부해서 상신)
   - 결재라인: 관리자·본사 계정 중 최대 5명, 순서대로 승인 / 누구든 반려하면 반려로 끝 → 고쳐서 다시 상신하면 1번부터
   - 참조: 모든 계정 중 최대 10명, 처리 없이 열람만 (참조함)
   - 취소·수정: 아무도 승인하기 전까지만 / 결재라인 없는 예전 상신은 관리자가 처리
   - 첨부: Supabase Storage 'approval-files' (비공개, 상신자·관리자·결재라인·참조만 열람, 5개·개당 20MB)
   - 알림: 상단 🔔 — 내 결재 차례, 새 참조, 내 상신 결과
   ========================================================== */
(function(){
  PATHS.stamp = 'M9 3h6l-1 7h3a2 2 0 0 1 2 2v3H5v-3a2 2 0 0 1 2-2h3z M4 21h16 M6 18h12';
  PATHS.plus = PATHS.plus || 'M12 5v14 M5 12h14';
  PATHS.clip = PATHS.clip || 'M21 11.5 12.5 20a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L10.2 17.7a1.7 1.7 0 0 1-2.4-2.4L15.5 7.6';
  const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const AP = { data: null, uid: '', f: { q: '', st: '' }, cur: null };
  const PAGES = { 'ap-mine': '내 상신함', 'ap-box': '결재함', 'ap-cc': '참조함' };
  const canBox = () => !!(SESSION.user && (SESSION.user.role === 'admin' || SESSION.user.role === 'hq'));
  const MAXL = 5, MAXC = 10;
  const ST = { wait: ['대기', 'w'], ok: ['승인', 'o'], no: ['반려', 'n'], hold: ['보류', 'h'] };
  const BUCKET = 'approval-files', MAXF = 5, MAXB = 20 * 1024 * 1024;
  const MIME = { pdf: 'application/pdf', hwp: 'application/x-hwp', hwpx: 'application/haansofthwpx', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic' };
  const ext = n => (String(n).split('.').pop() || '').toLowerCase();
  const kb = b => b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB';
  const adm = () => !!(AP.data && AP.data.admin);
  const closeM = () => document.getElementById('inv-modal')?.remove();
  const uid4 = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const chip = s => `<em class="ap-st ${ST[s][1]}">${ST[s][0]}</em>`;
  const pName = p => p ? `${p.name}${p.title ? ' ' + p.title : ''}` : '';
  // 목록용 진행 상황: '김영환 승인 → 대표 대기'
  function progress(a){
    const L = a.line || [];
    if (!L.length) return a.status === 'wait' ? '관리자 결재 대기' : '';
    if (a.status === 'wait') {
      const done = L.filter(x => x.act === 'ok').map(x => x.name + ' 승인');
      return [...done, L[a.step].name + ' 대기'].join(' → ');
    }
    if (a.status === 'no') { const n = L.find(x => x.act === 'no'); return n ? n.name + ' 반려' : ''; }
    if (a.status === 'hold') { const n = L.find(x => x.act === 'hold'); return (n ? n.name + ' 보류' : '보류') + ' · 수정 후 다시 상신'; }
    return '최종 승인 · ' + L[L.length - 1].name;
  }

  const st = document.createElement('style');
  st.textContent = `
  .ap-st{flex:none;font-style:normal;font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px}
  .ap-st.w{background:#fbf3e2;color:#8a6417}.ap-st.o{background:#e8f1e1;color:#3b6420}.ap-st.n{background:#fbeeee;color:#a3262c}.ap-st.h{background:#fdeedd;color:#b25b0e}
  .ap-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:4px 12px;align-items:center;border-top:1px solid var(--line);padding:13px 4px;cursor:pointer}
  .ap-row:first-child{border-top:0}.ap-row:hover{background:#fafbf7}
  .ap-row .t{font-size:14px;font-weight:500;color:#222b1e;display:flex;align-items:center;gap:6px;min-width:0}
  .ap-row .t span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ap-row .t i{flex:none;width:7px;height:7px;border-radius:50%;background:#c62429}
  .ap-row .s{grid-column:2;font-size:12px;color:#8b9381;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ap-row .m{grid-row:1/3;grid-column:3;font-size:12px;color:#8b9381;text-align:right;white-space:nowrap;line-height:1.6}
  .ap-meta{display:grid;grid-template-columns:70px 1fr;gap:7px 10px;font-size:13px;color:#2d3726;margin-bottom:12px}
  .ap-meta>span:nth-child(odd){color:#8b9381;font-size:12px}
  .ap-memo{font-size:14px;line-height:1.7;color:#2d3726;white-space:pre-wrap;word-break:break-word;background:#f8f9f5;border-radius:8px;padding:10px 12px}
  .ap-reason.hold{background:#fdf1e4;color:#7a3f0a}
  .ap-reason{margin-top:12px;background:#fbeeee;color:#7c1f24;border-radius:8px;padding:10px 12px;font-size:13px;white-space:pre-wrap}
  .ap-reason b{display:block;font-size:12px;margin-bottom:3px}
  .ap-files{display:flex;flex-direction:column;gap:6px;margin-top:12px}
  .ap-files .bi-b{justify-content:flex-start;padding:9px 12px;font-size:13px;white-space:normal;text-align:left}
  .ap-files .bi-b small{margin-left:auto;color:#8b9381;font-size:11px}
  .ap-tl{margin:4px 0 14px;padding:12px;background:#f7f8f4;border-radius:10px;display:flex;flex-direction:column;gap:8px;max-height:340px;overflow-y:auto}
  .ap-tl>b{font-size:13px;color:#2d3726}
  .ap-tl .bb{max-width:86%;border-radius:10px;padding:8px 11px;font-size:12px;line-height:1.55;background:#fff;border:1px solid #e6e8e0;color:#2d3726}
  .ap-tl .bb.me{align-self:flex-start;border-top-left-radius:3px}
  .ap-tl .bb.ap{align-self:flex-end;border-top-right-radius:3px}
  .ap-tl .bb.ok{background:#eef5e8;border-color:#d5e5c8}.ap-tl .bb.hold{background:#fdf1e4;border-color:#f3d8b8}.ap-tl .bb.no{background:#fbeeee;border-color:#efd1d1}
  .ap-tl .hd{display:flex;gap:6px;align-items:baseline;flex-wrap:wrap;font-size:11px;color:#7d8574;margin-bottom:2px}
  .ap-tl .hd b{font-size:12px;color:#2d3726}.ap-tl .hd em{font-style:normal;font-weight:600}
  .ap-tl .tx{white-space:pre-wrap;word-break:break-word}
  .ap-tl .fl{font-size:11px;color:#5f6858;margin-top:3px}.ap-tl .fl s{color:#9a8f8f}
  .ap-log{margin-top:16px;padding-top:12px;border-top:1px dashed var(--line);font-size:12px;color:#4a5244}
  .ap-log b{display:block;font-size:13px;color:#2d3726;margin-bottom:6px}
  .ap-log div{display:grid;grid-template-columns:110px 1fr;gap:8px;padding:4px 0}
  .ap-log div span:first-child{color:#8b9381}
  .ap-foot-l{margin-right:auto;display:flex;gap:6px;flex-wrap:wrap}
  .ap-form{display:flex;gap:8px;align-items:center}
  .ap-form select{flex:1;min-width:0}
  .ap-brs{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px}
  .nt-pop .ap-it{display:grid;grid-template-columns:8px minmax(0,1fr);gap:4px 10px;width:100%;text-align:left;border:0;border-bottom:1px solid #f2f3ee;background:#fff;padding:11px 14px;cursor:pointer}
  .nt-pop .ap-it:hover{background:#fafbf7}
  .nt-pop .ap-it .dot{width:7px;height:7px;border-radius:50%;background:#c9952b;margin-top:6px}
  .nt-pop .ap-it .t{font-size:13px;color:#222b1e;font-weight:500;line-height:1.45}
  .nt-pop .ap-it .s{grid-column:2;font-size:11px;color:#8b9381}
  .ap-pp{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
  .ap-pp:empty{display:none}
  .ap-pp>div{display:flex;align-items:center;gap:8px;background:#f6f7f3;border-radius:8px;padding:7px 8px 7px 10px;font-size:13px;color:#2d3726}
  .ap-pp>div>b{flex:none;width:20px;height:20px;border-radius:50%;background:#2d3726;color:#fff;font-size:11px;display:grid;place-items:center}
  .ap-pp>div>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ap-pp small{color:#8b9381;margin-left:4px}
  .ap-pp button{flex:none;border:0;background:#fff;border-radius:6px;padding:4px 8px;font-size:12px;color:#5f6858;cursor:pointer}
  .ap-pp button:disabled{opacity:.35;cursor:default}
  .ap-pp.cc{flex-direction:row;flex-wrap:wrap}
  .ap-pp.cc>div{padding:5px 6px 5px 10px}
  .ap-steps{display:flex;flex-direction:column;gap:6px;margin:0 0 12px}
  .ap-steps>div{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:2px 10px;align-items:center;font-size:13px;color:#2d3726}
  .ap-steps>div>b{width:22px;height:22px;border-radius:50%;background:#eceee8;color:#5f6858;font-size:11px;display:grid;place-items:center}
  .ap-steps>div.ok>b{background:#3b6420;color:#fff}.ap-steps>div.no>b{background:#a3262c;color:#fff}.ap-steps>div.now>b{background:#c9952b;color:#fff}.ap-steps>div.hold>b{background:#d9771f;color:#fff}
  .ap-steps em{font-style:normal;font-size:12px;color:#8b9381;text-align:right;white-space:nowrap}
  .ap-steps>div.now em{color:#8a6417;font-weight:600}
  .ap-steps small{grid-column:2/4;font-size:12px;color:#7c1f24}
  @media(max-width:580px){.ap-row{grid-template-columns:auto minmax(0,1fr)}.ap-row .m{grid-row:auto;grid-column:2;text-align:left}.ap-log div{grid-template-columns:1fr}}`;
  document.head.appendChild(st);

  /* ---------- 데이터 · 알림 ---------- */
  async function load(){
    if (!SESSION.user || SESSION.mustChange || !window.SB) return null;
    if (AP.uid !== SESSION.user.uid) { AP.uid = SESSION.user.uid; AP.data = null; }
    const { data, error } = await SB.rpc('appr_data');
    if (error) { console.warn('상신 불러오기 실패', error); return null; }
    AP.data = data; window.ntBell && window.ntBell(); drawSideBadge(); return data;
  }
  window.apLoad = load;
  window.apAlert = function(){
    const D = AP.data; if (!D) return { count: 0, html: '' };
    const res = D.mine.filter(a => a.status !== 'wait' && !a.seen).slice(0, 5);
    const wait = D.wait || 0, ccn = D.ccnew || 0;
    const html = (wait ? `<button class="ap-it" type="button" onclick="document.getElementById('nt-pop').remove();go('ap-box')"><span class="dot"></span><span class="t">결재 차례 ${wait}건</span><span class="s">결재함에서 승인·반려해 주세요</span></button>` : '') +
      (ccn ? `<button class="ap-it" type="button" onclick="document.getElementById('nt-pop').remove();go('ap-cc')"><span class="dot" style="background:#3b5ba5"></span><span class="t">새 참조 ${ccn}건</span><span class="s">참조함에서 확인해 주세요</span></button>` : '') +
      res.map(a => `<button class="ap-it" type="button" onclick="document.getElementById('nt-pop').remove();apOpen(${a.id})"><span class="dot" style="background:${a.status === 'ok' ? '#5d8a3d' : a.status === 'hold' ? '#d9771f' : '#c62429'}"></span><span class="t">상신 ${ST[a.status][0]} · ${h(a.title)}</span><span class="s">${a.done}</span></button>`).join('');
    return { count: wait + ccn + D.results, html };
  };
  function drawSideBadge(){
    const b = document.querySelector('#side .js-ap-menu'); if (!b) return;
    b.querySelector('.nt-badge')?.remove();
    const n = AP.data ? (AP.data.wait || 0) + (AP.data.ccnew || 0) + AP.data.results : 0;
    if (n) b.querySelector('.icon.ar')?.insertAdjacentHTML('beforebegin', `<span class="nt-badge">${n > 99 ? '99+' : n}</span>`);
    // 하위 메뉴별 숫자: 결재함(내 차례) · 참조함(새 참조) · 내 상신함(결과 안 본 것)
    const per = { 'ap-box': AP.data ? AP.data.wait || 0 : 0, 'ap-cc': AP.data ? AP.data.ccnew || 0 : 0, 'ap-mine': AP.data ? AP.data.results || 0 : 0 };
    document.querySelectorAll('#side .sub.js-ap-menu a').forEach(a => {
      a.querySelector('.nt-badge')?.remove();
      const k = ((a.getAttribute('onclick') || '').match(/go\('([^']+)'\)/) || [])[1], c = per[k] || 0;
      if (c) a.insertAdjacentHTML('beforeend', `<span class="nt-badge mm-sub-badge">${c > 99 ? '99+' : c}</span>`);
    });
  }

  /* ---------- 메뉴 ---------- */
  const renderSideAp = renderSide;
  renderSide = function(active){
    renderSideAp(active);
    const nav = document.querySelector('#side .nav-items'); if (!nav) return;
    nav.querySelectorAll('.js-ap-menu').forEach(e => e.remove());
    const open = !!PAGES[active];
    const items = Object.entries(PAGES).filter(([k]) => k !== 'ap-box' || canBox());
    const html = `<button class="cat js-ap-menu ${open ? 'open' : ''}" onclick="const on=this.classList.toggle('open');this.nextElementSibling.classList.toggle('open',on)">${ic('stamp')}상신·결재${ic('chevron').replace('class="icon"', 'class="icon ar"')}</button><div class="sub js-ap-menu ${open ? 'open' : ''}">${items.map(([k, t]) => `<a role="button" tabindex="0" class="${k === active ? 'on' : ''}" onclick="go('${k}')">${t}</a>`).join('')}</div>`;
    const soon = nav.querySelector('.nav-soon-label');
    if (soon) soon.insertAdjacentHTML('beforebegin', html); else nav.insertAdjacentHTML('beforeend', html);
    drawSideBadge();
  };
  const goAp = go;
  go = function(p, t){
    if (PAGES[p]) {
      if (p === 'ap-box' && !canBox()) { toast('결재함은 관리자·본사 계정만 볼 수 있어요.'); p = 'ap-mine'; }
      document.getElementById('nt-pop')?.remove();
      closeSide(); renderSide(p); window.__curPage = p; AP.f.st = p === 'ap-box' ? 'turn' : ''; page(p); window.scrollTo(0, 0); return;
    }
    const r = goAp(p, t);
    if (!AP.data || AP.uid !== (SESSION.user && SESSION.user.uid)) load();
    return r;
  };

  /* ---------- 목록 ---------- */
  function page(p){
    const box = p === 'ap-box', cc = p === 'ap-cc';
    document.getElementById('main').innerHTML = simpleHero(['상신·결재', PAGES[p]], box ? 'APPROVAL BOX' : cc ? 'CC' : 'MY REQUESTS', PAGES[p],
      box ? '나를 결재라인에 넣은 상신이에요. 내 차례가 되면 열어서 승인하거나 사유를 적어 반려하세요.'
      : cc ? '참조로 받은 상신이에요. 처리할 일 없이 내용만 확인하면 돼요.'
      : '내가 올린 상신이에요. 반려되면 고쳐서 다시 올릴 수 있어요.') +
      `<section class="card"><div class="bi-bar"><div class="bi-top"><input type="text" id="ap-q" placeholder="제목으로 찾기" value="${h(AP.f.q)}" oninput="apQ(this.value)">${box || cc ? '' : `<button class="btn" onclick="apNew()">${ic('plus')}새 상신</button>`}</div>
      <div class="bi-row" id="ap-chips"></div></div><div class="bi-cnt" id="ap-cnt"></div><div id="ap-list"><div class="bi-empty">불러오는 중...</div></div></section>` + pageFoot();
    if (AP.data) draw();
    load().then(d => { if (window.__curPage !== p) return; d ? draw() : (document.getElementById('ap-list').innerHTML = '<div class="bi-empty">불러오지 못했어요. 새로고침해 주세요.</div>'); });
  }
  let qT = 0;
  window.apQ = v => { clearTimeout(qT); qT = setTimeout(() => { AP.f.q = v.trim(); draw(); }, 200); };
  window.apSt = v => { AP.f.st = v; draw(); };
  function draw(){
    const el = document.getElementById('ap-list'); if (!el || !AP.data) return;
    const box = window.__curPage === 'ap-box', cc = window.__curPage === 'ap-cc';
    const all = (box ? AP.data.box : cc ? AP.data.ccbox : AP.data.mine) || [], q = AP.f.q.toLowerCase();
    const cnt = s => all.filter(a => a.status === s).length;
    document.getElementById('ap-chips').innerHTML = [...(box ? [['turn', `내 차례 ${all.filter(a => a.turn).length}`]] : []), ['', '전체'], ['wait', `대기 ${cnt('wait')}`], ['ok', '승인'], ['hold', '보류'], ['no', '반려']]
      .map(([v, t]) => `<button class="bi-c ${AP.f.st === v ? 'on' : ''}" onclick="apSt('${v}')">${t}</button>`).join('');
    const list = all.filter(a => (!AP.f.st || (AP.f.st === 'turn' ? a.turn : a.status === AP.f.st)) && (!q || a.title.toLowerCase().includes(q)));
    document.getElementById('ap-cnt').textContent = `${list.length}건`;
    el.innerHTML = list.length ? `<div class="bi-list">${list.map(a => `<div class="ap-row" role="button" tabindex="0" onclick="apOpen(${a.id})">
        ${chip(a.status)}<div class="t">${(box && a.turn) || (cc && !a.ccSeen) || (!box && !cc && a.status !== 'wait' && !a.seen) ? `<i title="${box ? '내 차례' : cc ? '새 참조' : '새 결과'}"></i>` : ''}<span>${h(a.title)}</span></div>
        <div class="s">${box || cc ? h(a.who) + ' · ' : ''}${h(progress(a)) || (a.form ? h(a.form) : '양식 없음')}${a.files ? ` · 첨부 ${a.files}` : ''}</div>
        <div class="m">${a.at.slice(0, 10)} 상신${a.done ? `<br>${a.done.slice(0, 10)} ${ST[a.status][0]}` : ''}</div></div>`).join('')}</div>`
      : `<div class="bi-empty">${all.length ? '조건에 맞는 상신이 없어요.' : box ? '들어온 상신이 없어요.' : cc ? '참조로 받은 상신이 없어요.' : '올린 상신이 없어요.<br>[새 상신]이나 서류매뉴얼의 [작성해서 상신]으로 올려보세요.'}</div>`;
  }

  /* ---------- 보기 ---------- */
  window.apFile = async function(i){
    const f = (AP.cur && AP.cur.filelist || [])[i]; if (!f) return;
    const dl = !/^(pdf|jpe?g|png)$/.test(ext(f.name));
    const w = dl ? null : window.open('', '_blank');
    try {
      const { data, error } = await SB.storage.from(BUCKET).createSignedUrl(f.path, 600, dl ? { download: f.name } : undefined);
      if (error) throw error;
      if (w) w.location.href = data.signedUrl; else location.href = data.signedUrl;
    } catch (e) { w && w.close(); toast('파일을 열지 못했어요: ' + (e.message || e)); }
  };
  // 진행 기록: 상신자(왼쪽) · 결재자(오른쪽) 말풍선으로 누적
  function apTimeline(log){
    if (!log.length) return '';
    const cls = act => act === '승인' ? 'ap ok' : act === '보류' ? 'ap hold' : act === '반려' ? 'ap no' : /상신|수정/.test(act) ? 'me' : 'ap';
    const col = act => act === '승인' ? '#3b6420' : act === '보류' ? '#b25b0e' : act === '반려' ? '#a3262c' : '#4a5244';
    return `<div class="ap-tl"><b>진행 기록</b>${log.map(l => {
      const txt = l.reason || l.memo || '';
      const add = (l.add || []).length ? `<div class="fl">📎 ${l.act === '상신' ? '' : '추가 '}${l.add.map(h).join(', ')}</div>` : '';
      const del = (l.del || []).length ? `<div class="fl">뺀 파일 <s>${l.del.map(h).join(', ')}</s></div>` : '';
      return `<div class="bb ${cls(l.act)}"><div class="hd"><b>${h(l.by)}</b><em style="color:${col(l.act)}">${h(l.act)}</em><span>${h(l.at)}</span></div>${txt ? `<div class="tx">${h(txt)}</div>` : ''}${add}${del}</div>`;
    }).join('')}</div>`;
  }
  window.apOpen = async function(id){
    const { data: a, error } = await SB.rpc('appr_open', { p_id: id });
    if (error) { toast(error.message); await load(); draw(); return; }
    AP.cur = a;
    if (AP.data) {
      const r = AP.data.mine.find(x => x.id === id); if (r && !r.seen) { r.seen = true; AP.data.results = Math.max(0, AP.data.results - 1); }
      const c = (AP.data.ccbox || []).find(x => x.id === id); if (c && !c.ccSeen) { c.ccSeen = true; AP.data.ccnew = Math.max(0, (AP.data.ccnew || 0) - 1); }
      window.ntBell && window.ntBell(); drawSideBadge(); draw();
    }
    const L = a.line || [];
    const steps = L.length ? `<div class="ap-steps">${L.map((x, i) => {
        const now = a.status === 'wait' && i === a.step, cls = x.act === 'ok' ? 'ok' : x.act === 'no' ? 'no' : x.act === 'hold' ? 'hold' : now ? 'now' : '';
        const tx = x.act === 'ok' ? '승인 ' + x.at.slice(5) : x.act === 'no' ? '반려 ' + x.at.slice(5) : x.act === 'hold' ? '보류 ' + x.at.slice(5) : now ? '결재 차례' : a.status === 'wait' ? '예정' : '-';
        return `<div class="${cls}"><b>${i + 1}</b><span>${window.mmAv ? mmAv(x.uid, x.name, 'sm') : ''}${h(pName(x))}</span><em>${h(tx)}</em>${x.reason && x.act === 'ok' ? `<small style="color:#5f6858">${h(x.reason)}</small>` : ''}</div>`;
      }).join('')}</div>` : '';
    iModal(a.title, `<div class="ap-meta">
        <span>상태</span><span>${chip(a.status)}${a.done ? ` <small style="color:#8b9381">${h(a.done)} · ${h(a.by)}</small>` : ''}</span>
        <span>상신자</span><span>${h(a.who)} · ${h(a.at)}</span>
        <span>양식</span><span>${a.form ? h(a.form) : '양식 없음'}</span>
        <span>결재라인</span><span>${L.length ? '' : '관리자'}</span>
        </div>${steps}${apTimeline(a.log || [])}
      ${(a.cc || []).length ? `<div class="ap-meta"><span>참조</span><span>${a.cc.map(c => (window.mmAv ? mmAv(c.uid, c.name, 'sm') : '') + h(pName(c))).join(', ')}</span></div>` : ''}
      ${a.memo ? `<div class="ap-memo">${h(a.memo)}</div>` : ''}
      ${a.status === 'no' && a.reason ? `<div class="ap-reason"><b>반려 사유</b>${h(a.reason)}</div>` : ''}
      ${a.status === 'hold' && a.reason ? `<div class="ap-reason hold"><b>보류 · 고칠 내용</b>${h(a.reason)}</div>` : ''}
      ${a.status === 'ok' && a.reason ? `<div class="ap-memo" style="margin-top:12px"><b style="font-size:12px">결재 메모</b><br>${h(a.reason)}</div>` : ''}
      <div class="ap-files">${a.filelist.map((f, i) => `<button class="bi-b" type="button" onclick="apFile(${i})">${ic('clip')}<span>${h(f.name)}</span><small>${kb(f.size || 0)}</small></button>`).join('')}</div>
      `, closeM, '닫기');
    const foot = document.querySelector('#inv-modal .im-foot');
    foot.querySelector('.btn.ghost')?.remove();
    const b = [];
    const started = (a.line || []).some(x => x.act === 'ok');
    if (a.mine && a.status === 'wait' && !started) b.push(`<button class="btn ghost" onclick="apNew(null,${a.id})">수정</button>`, `<button class="btn ghost" style="color:#a3262c" onclick="apDel(${a.id},true)">상신 취소</button>`);
    if (a.mine && a.status === 'hold') b.push(`<button class="btn ghost" onclick="apNew(null,${a.id})">수정해서 다시 상신</button>`, `<button class="btn ghost" style="color:#a3262c" onclick="apDel(${a.id},true)">상신 취소</button>`);
    if (a.admin && a.status !== 'wait' && !a.mine) b.push(`<button class="btn ghost" style="color:#a3262c" onclick="apDel(${a.id})">삭제</button>`);
    if (b.length) foot.insertAdjacentHTML('afterbegin', `<div class="ap-foot-l">${b.join('')}</div>`);
    if (a.turn && a.status === 'wait') {
      const save = document.getElementById('im-save');
      save.textContent = '승인'; save.onclick = () => apDecide(a.id, true);
      save.insertAdjacentHTML('beforebegin', `<button class="btn ghost" style="color:#a3262c" onclick="apDecide(${a.id},false)">반려</button><button class="btn ghost" style="color:#b25b0e" onclick="apHold(${a.id})">보류</button>`);
    }
  };

  /* ---------- 승인 · 반려 (내 차례인 결재자) ---------- */
  window.apHold = function(id){
    const t = AP.cur && AP.cur.title;
    iModal('보류 · ' + t, `<div class="im-grid"><div class="f wide"><label>보류 사유 <span>고칠 내용을 적어주세요 · 상신한 사람에게 그대로 보여요</span></label>
      <textarea id="ap-reason" maxlength="500" placeholder="예) 사용 날짜를 적어서 다시 올려주세요"></textarea>
      <div class="bi-help">상신한 사람이 고쳐서 다시 올리면 내 차례부터 이어서 결재해요. 앞에서 승인한 결재는 그대로 남아요.</div></div></div>`, async () => {
      const r = document.getElementById('ap-reason').value.trim();
      if (!r) return toast('보류 사유를 적어주세요.');
      const btn = document.getElementById('im-save'); btn.disabled = true; btn.textContent = '처리 중...';
      const { error } = await SB.rpc('appr_hold', { p_id: id, p_reason: r });
      if (error) { btn.disabled = false; btn.textContent = '보류'; return toast('처리 실패: ' + error.message); }
      closeM(); toast('보류했어요. 상신한 사람에게 알렸어요.');
      await load(); draw();
    }, '보류');
  };
  window.apDecide = function(id, ok){
    const t = AP.cur && AP.cur.title;
    iModal(ok ? '승인 · ' + t : '반려 · ' + t, `<div class="im-grid"><div class="f wide"><label>${ok ? '결재 메모 <span>선택</span>' : '반려 사유 <span>상신한 사람에게 그대로 보여요</span>'}</label>
      <textarea id="ap-reason" maxlength="500" placeholder="${ok ? '예) 11/10 휴가 승인합니다' : '예) 날짜가 빠졌어요. 날짜를 적어서 다시 올려주세요'}"></textarea></div></div>`, async () => {
      const r = document.getElementById('ap-reason').value.trim();
      if (!ok && !r) return toast('반려 사유를 적어주세요.');
      const btn = document.getElementById('im-save'); btn.disabled = true; btn.textContent = '처리 중...';
      const { error } = await SB.rpc('appr_decide', { p_id: id, p_ok: ok, p_reason: r });
      if (error) { btn.disabled = false; btn.textContent = ok ? '승인' : '반려'; return toast('처리 실패: ' + error.message); }
      closeM(); toast(ok ? '승인했어요.' : '반려했어요.');
      await load(); draw();
    }, ok ? '승인' : '반려');
  };

  /* ---------- 새 상신 · 수정 · 다시 상신 ---------- */
  let ED = null;
  window.apNew = async function(formId, id){
    if (!AP.data) await load();
    if (!AP.data) return toast('불러오지 못했어요. 새로고침해 주세요.');
    const a = id && AP.cur && AP.cur.id === id ? AP.cur : { title: '', memo: '', filelist: [], formId: formId || null };
    const okId = (list, ap) => (list || []).filter(u => AP.data.people.some(p => p.id === u && (!ap || p.approver)));
    const src = id ? { line: a.lineIds, cc: a.ccIds } : (AP.data.last || {});
    ED = { id: id || '', keep: [...a.filelist], removed: [], add: [], line: okId(src.line, true).slice(0, MAXL), cc: okId(src.cc).slice(0, MAXC) };
    const forms = AP.data.forms;
    const brs = ((AP.data.brands || []).filter(b => b.active).map(b => b.name));
    forms.forEach(f => (f.brands || []).forEach(b => { if (!brs.includes(b)) brs.push(b); }));
    const f0 = a.formId && forms.find(f => String(f.id) === String(a.formId));
    ED.brs = brs; ED.br = (f0 && (f0.brands || [])[0]) || (brs.includes('본사') ? '본사' : brs[0] || ''); ED.form = a.formId || '';
    iModal(id ? (a.status === 'hold' ? '수정해서 다시 상신' : '상신 수정') : '새 상신', `<div class="im-grid">
      <div class="f wide"><label>양식 <span>서류매뉴얼에 올라온 양식</span></label><div class="ap-brs" id="ap-brs"></div><div class="ap-form"><select id="ap-form" onchange="apFormPick(this.value)"></select>
        <button type="button" class="bi-b" id="ap-dl" onclick="apFormDl()">${ic('download')}양식 받기</button></div></div>
      <div class="f wide"><label>제목</label><input id="ap-title" maxlength="100" value="${h(a.title)}" placeholder="예) 11월 연차 신청 (홍길동)"></div>
      <div class="f wide"><label>결재라인 <span>순서대로 결재해요 · 최대 ${MAXL}명</span></label><div class="ap-pp" id="ap-line"></div><select id="ap-addl" onchange="apPick('line',this)"></select></div>
      <div class="f wide"><label>참조 <span>선택 · 처리 없이 내용만 받아 봐요 · 최대 ${MAXC}명</span></label><div class="ap-pp cc" id="ap-cc"></div><select id="ap-addc" onchange="apPick('cc',this)"></select></div>
      <div class="f wide"><label>메모 <span>선택</span></label><textarea id="ap-memo" maxlength="1000" placeholder="결재자에게 전할 내용">${h(a.memo)}</textarea></div>
      <div class="f wide"><label>작성한 파일 <span>최대 ${MAXF}개 · 개당 20MB · PDF·한글·워드·엑셀·사진</span></label>
        <input type="file" id="ap-file" multiple accept="${Object.keys(MIME).map(e => '.' + e).join(',')}" onchange="apAdd(this)"><div class="nt-flist" id="ap-flist"></div></div>
    </div>`, save, id ? (a.status === 'hold' ? '다시 상신' : '수정') : '상신');
    drawForms(); apFormPick(document.getElementById('ap-form').value); drawFiles(); drawPick();
  };
  // 양식: 소속 버튼으로 나눠 보기
  function drawForms(){
    const b = document.getElementById('ap-brs'), sel = document.getElementById('ap-form'); if (!b || !sel) return;
    b.innerHTML = ED.brs.map(n => `<button type="button" class="bi-c ${ED.br === n ? 'on' : ''}" onclick="apBr('${h(n)}')">${h(n)}</button>`).join('');
    const list = AP.data.forms.filter(f => !ED.br || (f.brands || []).includes(ED.br));
    sel.innerHTML = `<option value="">${list.length ? '양식 없음' : '이 소속에 등록된 양식이 없어요'}</option>` +
      list.map(f => `<option value="${f.id}" ${String(f.id) === String(ED.form) ? 'selected' : ''}>${h(f.title)}</option>`).join('');
  }
  window.apBr = function(n){
    const sel = document.getElementById('ap-form'); ED.form = sel ? sel.value : ED.form;
    ED.br = n; drawForms(); apFormPick(document.getElementById('ap-form').value);
  };
  // 결재라인 · 참조 고르기 (이름 · 직책)
  const person = id => AP.data.people.find(p => p.id === id);
  const label = p => `${p.name}${p.title ? ' · ' + p.title : ''}${p.dept ? ' (' + p.dept + ')' : ''}`;
  function drawPick(){
    const L = document.getElementById('ap-line'), C = document.getElementById('ap-cc'); if (!L || !C) return;
    L.innerHTML = ED.line.map((u, i) => { const p = person(u); return p ? `<div><b>${i + 1}</b>${window.mmAv ? mmAv(p.id, p.name, 'sm') : ''}<span>${h(p.name)}<small>${h(p.title)}</small></span>
      <button type="button" onclick="apMove(${i})" ${i ? '' : 'disabled'} aria-label="앞으로">▲</button><button type="button" onclick="apUnpick('line',${i})">빼기</button></div>` : ''; }).join('');
    C.innerHTML = ED.cc.map((u, i) => { const p = person(u); return p ? `<div>${window.mmAv ? mmAv(p.id, p.name, 'sm') : ''}<span>${h(p.name)}<small>${h(p.title)}</small></span><button type="button" onclick="apUnpick('cc',${i})">빼기</button></div>` : ''; }).join('');
    const used = new Set([...ED.line, ...ED.cc]);
    const ap = AP.data.people.filter(p => p.approver && !used.has(p.id)), all = AP.data.people.filter(p => !used.has(p.id));
    const sl = document.getElementById('ap-addl'), sc = document.getElementById('ap-addc');
    sl.innerHTML = `<option value="">${ED.line.length >= MAXL ? `결재자는 ${MAXL}명까지예요` : ap.length ? '+ 결재자 추가' : '더 고를 수 있는 결재자가 없어요'}</option>` + (ED.line.length >= MAXL ? '' : ap.map(p => `<option value="${p.id}">${h(label(p))}</option>`).join(''));
    sc.innerHTML = `<option value="">${ED.cc.length >= MAXC ? `참조는 ${MAXC}명까지예요` : all.length ? '+ 참조 추가' : '더 고를 수 있는 사람이 없어요'}</option>` + (ED.cc.length >= MAXC ? '' : all.map(p => `<option value="${p.id}">${h(label(p))}</option>`).join(''));
  }
  window.apPick = function(k, sel){ const v = sel.value; if (!v) return; ED[k].push(v); drawPick(); };
  window.apUnpick = function(k, i){ ED[k].splice(i, 1); drawPick(); };
  window.apMove = function(i){ if (i < 1) return; [ED.line[i - 1], ED.line[i]] = [ED.line[i], ED.line[i - 1]]; drawPick(); };
  window.apFormPick = function(v){
    document.getElementById('ap-dl').style.display = v ? '' : 'none';
    const t = document.getElementById('ap-title'), f = AP.data.forms.find(x => String(x.id) === String(v));
    if (f && t && !t.value) t.value = f.title;
  };
  window.apFormDl = async function(){
    const v = document.getElementById('ap-form').value; if (!v) return;
    const { data: m, error } = await SB.rpc('manual_open', { p_id: +v });
    if (error) return toast(error.message);
    const dl = ext(m.file.name) !== 'pdf', w = dl ? null : window.open('', '_blank');
    const { data, error: e2 } = await SB.storage.from('manual-files').createSignedUrl(m.file.path, 600, dl ? { download: m.file.name } : undefined);
    if (e2) { w && w.close(); return toast('양식을 받지 못했어요: ' + e2.message); }
    if (w) w.location.href = data.signedUrl; else location.href = data.signedUrl;
  };
  function drawFiles(){
    const box = document.getElementById('ap-flist'); if (!box) return;
    box.innerHTML = ED.keep.map((f, i) => `<div>${ic('clip')}<span>${h(f.name)}</span><small>${kb(f.size || 0)}</small><button type="button" onclick="apRm('keep',${i})">빼기</button></div>`).join('') +
      ED.add.map((f, i) => `<div>${ic('clip')}<span>${h(f.name)}</span><small>${kb(f.size)} · 새 파일</small><button type="button" onclick="apRm('add',${i})">빼기</button></div>`).join('');
  }
  window.apAdd = function(inp){
    for (const f of inp.files) {
      if (ED.keep.length + ED.add.length >= MAXF) { toast(`첨부는 ${MAXF}개까지예요.`); break; }
      if (!MIME[ext(f.name)]) { toast(`'${f.name}'은 올릴 수 없는 형식이에요.`); continue; }
      if (f.size > MAXB) { toast(`'${f.name}'이 20MB를 넘어요.`); continue; }
      ED.add.push(f);
    }
    inp.value = ''; drawFiles();
  };
  window.apRm = function(k, i){ if (k === 'keep') ED.removed.push(...ED.keep.splice(i, 1)); else ED.add.splice(i, 1); drawFiles(); };
  async function save(){
    const title = document.getElementById('ap-title').value.trim(), memo = document.getElementById('ap-memo').value.trim(), formId = document.getElementById('ap-form').value;
    if (!title) return toast('제목을 입력해주세요.');
    if (!ED.line.length) return toast('결재라인에 결재자를 한 명 이상 넣어주세요.');
    if (!ED.keep.length && !ED.add.length) return toast('작성한 파일을 첨부해주세요.');
    const btn = document.getElementById('im-save'), lab = btn.textContent;
    btn.disabled = true; btn.textContent = ED.add.length ? '파일 올리는 중...' : '저장 중...';
    const up = [];
    try {
      for (const f of ED.add) {
        const e = ext(f.name), path = `${SESSION.user.uid}/${uid4()}.${e}`;
        const { error } = await SB.storage.from(BUCKET).upload(path, f, { contentType: f.type || MIME[e], upsert: false });
        if (error) throw new Error(`'${f.name}' 올리기 실패 (${error.message})`);
        up.push({ path, name: f.name, size: f.size, type: f.type || MIME[e] });
      }
      btn.textContent = '저장 중...';
      const { data: r, error } = await SB.rpc('appr_save', { p: { id: ED.id, formId, title, memo, files: [...ED.keep, ...up], line: ED.line, cc: ED.cc } });
      if (error) throw error;
      if (r.removed && r.removed.length) await SB.storage.from(BUCKET).remove(r.removed.map(f => f.path));
      closeM(); toast(ED.id ? '다시 올렸어요. 결재는 1번부터 다시 시작해요.' : '상신했어요. 결과가 나오면 🔔으로 알려드려요.');
      await load();
      if (window.__curPage === 'ap-mine') draw(); else go('ap-mine');
    } catch (e) {
      if (up.length) SB.storage.from(BUCKET).remove(up.map(f => f.path));
      btn.disabled = false; btn.textContent = lab; toast('저장 실패: ' + (e.message || e));
    }
  }
  window.apDel = async function(id, cancel){
    if (!confirm(cancel ? '이 상신을 취소할까요? 첨부 파일도 함께 지워져요.' : '이 상신을 삭제할까요? 첨부 파일도 함께 지워지고 되돌릴 수 없어요.')) return;
    const { data: files, error } = await SB.rpc('appr_delete', { p_id: id });
    if (error) return toast((cancel ? '취소' : '삭제') + ' 실패: ' + error.message);
    if (files && files.length) await SB.storage.from(BUCKET).remove(files.map(f => f.path));
    closeM(); toast(cancel ? '상신을 취소했어요.' : '삭제했어요.');
    await load(); draw();
  };

  // 2분마다 새 결재·결과 확인 (화면이 보일 때만)
  setInterval(() => { if (!document.hidden) load().then(() => { if (PAGES[window.__curPage] && !document.getElementById('inv-modal')) draw(); }); }, 120000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
})();
