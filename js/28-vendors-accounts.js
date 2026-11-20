
/* ==========================================================
   거래처·계정 관리 (2026-11-03) — 거래처 현황 · 계정 현황
   - 2026-11-20 수정: 계정 등록·수정 창에 브라우저가 워크스페이스 로그인 아이디·비밀번호를 자동으로 채우던 문제 막음 · 아이디/비밀번호 글자를 눌러도 복사 · 잘못 저장된 계정에 "비밀번호 다시 입력 필요" 표시
   - 본사 계정(admin·hq)만 메뉴가 보이고 열 수 있음
   - 비밀번호는 Supabase Vault에 암호화 저장, 화면엔 [보기]·[복사] 할 때만 받아옴 (열람 기록 남음)
   - 사용 중지·관리자 전용 지정은 관리자만
   ========================================================== */
(function(){
  PATHS.key = 'M15 7a4 4 0 1 1-3.9 4.9L3 20v-3l2-2v-2h2l2-2 M16 7h.01';
  PATHS.copy = 'M9 9h11v11H9z M5 15H4V4h11v1';
  PATHS.eye = 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6';
  PATHS.link = 'M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6';
  PATHS.plus = 'M12 5v14 M5 12h14';
  PATHS.lock = 'M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4';
  PATHS.phone = 'M5 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2';

  // 분류는 Supabase base_categories에서 받아옴 (추가: 본사 누구나 / 이름·순서·숨김: 관리자)
  const catSrc = k => k === 'brand' ? { cats: BI.brands || [] } : ((k === 'acct' ? BI.acct : BI.vend) || { cats: [] });
  const setCats = (k, list) => { if (k === 'brand') BI.brands = list; else catSrc(k).cats = list; };
  const KLAB = { acct: '분류', vendor: '분류', brand: '소속' };
  // 소속은 여러 개 (예: 멘야마쯔리·금목돈 공용 업체)
  const brOrder = list => { const all = (BI.brands || []).map(b => b.name); return [...(list || [])].sort((a, b) => (all.indexOf(a) + 1 || 99) - (all.indexOf(b) + 1 || 99)); };
  const brTxt = list => brOrder(list).map(h).join('·');
  const splitBr = t => [...new Set(String(t || '').split(/\s*[,/·]\s*/).map(x => x.trim()).filter(Boolean))];
  function brChecks(cur){
    const names = catNames('brand'), list = [...names, ...(cur || []).filter(x => !names.includes(x))];
    return `<div class="bi-brs" id="bi-brs">${list.map(n => `<label class="bi-chk"><input type="checkbox" name="bi-br" value="${h(n)}" ${(cur || []).includes(n) ? 'checked' : ''}>${h(n)}</label>`).join('')}${adm() ? `<button type="button" class="bi-b" onclick="biBrNew()">${ic('plus')}새 소속</button>` : ''}</div>`;
  }
  const brPicked = () => [...document.querySelectorAll('input[name=bi-br]:checked')].map(i => i.value);
  window.biBrNew = function(){
    const n = (prompt('새 소속(브랜드) 이름을 입력하세요 (20자 이내)') || '').trim(); if (!n) return;
    const cur = brPicked();
    SB.rpc('cat_add', { p_kind: 'brand', p_name: n }).then(({ data, error }) => {
      if (error) return toast('추가 실패: ' + error.message);
      BI.brands = data; document.getElementById('bi-brs').outerHTML = brChecks([...cur, n]);
      toast(`'${n}' 소속을 추가했어요.`); (BI.page === 'acct' ? drawAcct : drawVend)();
    });
  };
  const catNames = k => (catSrc(k).cats || []).filter(c => c.active).map(c => c.name);
  const HOWS = ['아이디·비밀번호', '구글 로그인', '네이버 로그인', '카카오 로그인', '휴대폰 인증'];
  const PAGES = { 'vendor-list': '거래처 현황', 'acct-list': '계정 현황' };
  const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const can = () => !!(SESSION.user && (SESSION.user.role === 'admin' || SESSION.user.role === 'hq'));
  const adm = () => !!(SESSION.user && SESSION.user.role === 'admin');
  const won = v => (v === null || v === undefined || v === '') ? '-' : Number(v).toLocaleString('ko-KR') + '원';
  const BI = { acct: null, vend: null, af: { q: '', brand: '', cat: '', off: false }, vf: { q: '', brand: '', cat: '', off: false }, timers: {} };

  /* ---------- 스타일 ---------- */
  const st = document.createElement('style');
  st.textContent = `
  .bi-bar{display:flex;flex-direction:column;gap:12px}
  .bi-top{display:flex;gap:10px;align-items:center}
  .bi-top input[type=text]{flex:1;min-width:0;border:1px solid #dcdfd6;border-radius:8px;padding:10px 12px;font-size:13px}
  .bi-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  .bi-row > span{font-size:11px;color:#7d8574;width:34px;flex:none}
  .bi-c{border:1px solid #dcdfd6;background:#fff;color:#4f584a;border-radius:999px;padding:6px 12px;font-size:12px;cursor:pointer}
  .bi-c.on{background:#22311f;border-color:#22311f;color:#fff}
  .bi-off{font-size:12px;color:#6c7365;display:inline-flex;align-items:center;gap:6px;margin-left:auto}
  .bi-cnt{font-size:12px;color:#7d8574;margin:4px 2px 10px}
  .bi-list{display:flex;flex-direction:column}
  .bi-it{border-top:1px solid var(--line);padding:14px 2px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 14px;align-items:start}
  .bi-it:first-child{border-top:0}
  .bi-it.off{opacity:.55}
  .bi-it.hl{background:#fbf6ea;border-radius:8px;padding-left:10px;padding-right:10px}
  .bi-name{font-size:15px;font-weight:600;color:#222b1e;display:flex;flex-wrap:wrap;align-items:center;gap:6px}
  .bi-tag{font-size:11px;font-weight:500;padding:2px 8px;border-radius:6px;background:#eef1e8;color:#5c6653}
  .bi-tag.lock{background:#fbeeee;color:#a3262c}
  .bi-tag.stop{background:#ececec;color:#777}
  .bi-sub{font-size:12px;color:#7d8574;line-height:1.6;grid-column:1/-1}
  .bi-sub a{color:#4f6b3b}
  .bi-cred{grid-column:1/-1;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:6px 10px;align-items:center;font-size:13px}
  .bi-cred .k{font-size:11px;color:#8b9381}
  .bi-cred .v{font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-all;color:#2d3726}
  .bi-cred .v.mask{letter-spacing:2px;color:#9aa38f}
  .bi-acts{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}
  .bi-b{border:1px solid #dcdfd6;background:#fff;color:#3f4839;border-radius:8px;padding:6px 10px;font-size:12px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap;text-decoration:none}
  .bi-b .icon{width:13px;height:13px}
  .bi-b:hover{border-color:#b9c2ac}
  .bi-b.red{border-color:var(--brand);color:var(--brand)}
  .bi-items{grid-column:1/-1;border:1px solid #eceee7;border-radius:10px;overflow:hidden;margin-top:4px}
  .bi-items table{width:100%;border-collapse:collapse;font-size:12px}
  .bi-items th{background:#f6f7f3;color:#6c7365;font-weight:500;text-align:left;padding:8px 10px;white-space:nowrap}
  .bi-items td{border-top:1px solid #f0f1ec;padding:9px 10px;vertical-align:top}
  .bi-items td.n{text-align:right;white-space:nowrap}
  .bi-items tr.click{cursor:pointer}.bi-items tr.click:hover td{background:#fafbf7}
  .bi-items tr.off td{color:#aaa}
  .bi-items .bi-scroll{overflow-x:auto}
  .bi-tag .icon{width:11px;height:11px;vertical-align:-1px;margin-right:2px}
  .bi-items td,.bi-items th{position:static;background:none;border-bottom:0}.bi-items th{background:#f6f7f3}
  .bi-items table{table-layout:fixed;min-width:560px}.bi-items td{font-weight:400;color:#3f4839;white-space:normal}.bi-items td:first-child{color:#222b1e}
  .bi-items col.c1{width:34%}.bi-items col.c2{width:20%}.bi-items col.c3,.bi-items col.c4{width:13%}.bi-items col.c5{width:20%}
  .bi-empty{text-align:center;color:#909b84;font-size:12px;padding:40px 10px;line-height:2}
  .bi-log{font-size:12px;color:#5f6858}
  .bi-log div{display:grid;grid-template-columns:90px minmax(0,1fr) 50px 70px;gap:8px;padding:7px 0;border-top:1px solid #f0f1ec}
  .bi-log div:first-child{border-top:0}
  .bi-hist{margin-top:14px;border-top:1px dashed var(--line);padding-top:12px;font-size:12px}
  .bi-hist div{display:grid;grid-template-columns:90px 1fr 1fr 70px;gap:8px;padding:5px 0;color:#5f6858}
  .bi-hist div.h{color:#8b9381}
  .im-grid textarea{width:100%;box-sizing:border-box;border:1px solid #dcdfd6;border-radius:8px;padding:9px 10px;font-size:13px;min-height:70px;font-family:inherit;resize:vertical}
  .bi-pw{display:flex;gap:6px}.bi-pw input{flex:1}.bi-pw input.sec{-webkit-text-security:disc;text-security:disc}
  .bi-cred .v.cp{cursor:pointer}.bi-cred .v.cp:hover{text-decoration:underline dotted;text-underline-offset:3px}
  .bi-tag.warn{background:#fdecea;color:#b3261e;border-color:#f3c2bd}
  .bi-chk{display:flex;align-items:center;gap:8px;font-size:13px;color:#4a5244}
  .bi-chk input{width:auto !important}
  .bi-help{font-size:11px;color:#8b9381;margin-top:4px}
  .bi-cm{display:flex;flex-direction:column;gap:8px}
  .bi-brs{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:6px 0}
  .im-grid .bi-brs label.bi-chk{display:inline-flex;align-items:center;gap:6px;margin:0;font-size:14px;font-weight:500;color:#2d3726}
  .im-grid .bi-brs input[type=checkbox]{width:18px !important;height:18px;margin:0;accent-color:#22311f}
  .bi-sum{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
  .bi-sum span{font-size:12px;padding:5px 10px;border-radius:999px;background:#eef1e8;color:#3f4839}
  .bi-sum span.ok{background:#e3f3e8;color:#23703f}.bi-sum span.sk{background:#f1f1ee;color:#777}.bi-sum span.no{background:#fbeeee;color:#a3262c}
  .bi-pv{max-height:46vh;overflow:auto;border:1px solid #eceee7;border-radius:10px}
  .bi-pv table{width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap}
  .bi-pv th{position:sticky;top:0;background:#f6f7f3;color:#6c7365;font-weight:500;text-align:left;padding:7px 9px;font-size:11px;z-index:1;border-bottom:0}
  .bi-pv td{padding:7px 9px;border-top:1px solid #f0f1ec;border-bottom:0;background:#fff;color:#3f4839}
  .bi-pv td.st{font-weight:600}.bi-pv tr.sk td{color:#999}.bi-pv tr.no td{color:#a3262c}
  .bi-pv td.st.ok{color:#23703f}
  .bi-cm div{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:6px;align-items:center}
  .bi-cm input[type=text]{width:100%;box-sizing:border-box;border:1px solid #dcdfd6;border-radius:8px;padding:8px 10px;font-size:13px}
  .bi-cm div.hid input[type=text]{color:#aaa;background:#f6f6f4}
  .bi-cm label{font-size:12px;color:#6c7365;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
  @media(max-width:760px){.bi-top{flex-wrap:wrap}.bi-top input[type=text]{flex:1 1 100%}.bi-top .btn{flex:1}}
  @media(max-width:760px){
    .bi-it{grid-template-columns:1fr}
    .bi-acts{justify-content:flex-start}
    .bi-off{margin-left:0}
    .bi-log div{grid-template-columns:80px minmax(0,1fr) 40px}
    .bi-log div span:last-child{display:none}
    .bi-items table{min-width:0;table-layout:auto}.bi-items colgroup,.bi-items thead{display:none}
    .bi-items table,.bi-items tbody{display:block}
    .bi-items tr{display:grid;grid-template-columns:1fr 1fr;gap:2px 10px;padding:11px 12px;border-top:1px solid #f0f1ec}
    .bi-items tr:first-child{border-top:0}
    .bi-items td{display:block;border:0;padding:0}
    .bi-items td:first-child,.bi-items td.un,.bi-items td.ro{grid-column:1/-1}
    .bi-items td:first-child{font-weight:600}
    .bi-items td.un{font-size:11px;color:#8b9381}
    .bi-items td.n{text-align:left;margin-top:4px}
    .bi-items td.n::before{content:attr(data-l);display:block;font-size:10px;color:#8b9381}
    .bi-items td.ro{font-size:11px;color:#7a6125;margin-top:2px}.bi-items td.ro:empty{display:none}
  }`;
  document.head.appendChild(st);

  /* ---------- 메뉴: 거래처·계정 관리 ---------- */
  const renderSideBi = renderSide;
  renderSide = function(active){
    renderSideBi(active);
    const nav = document.querySelector('#side .nav-items'); if (!nav) return;
    nav.querySelectorAll('.js-bi-menu').forEach(e => e.remove());
    if (!can()) return;
    const open = !!PAGES[active];
    const html = `<button class="cat js-bi-menu ${open ? 'open' : ''}" onclick="const on=this.classList.toggle('open');this.nextElementSibling.classList.toggle('open',on)">${ic('book')}거래처·계정 관리${ic('chevron').replace('class="icon"', 'class="icon ar"')}</button><div class="sub js-bi-menu ${open ? 'open' : ''}">${Object.entries(PAGES).map(([k, t]) => `<a role="button" tabindex="0" class="${k === active ? 'on' : ''}" onclick="go('${k}')">${t}</a>`).join('')}</div>`;
    const soon = nav.querySelector('.nav-soon-label');
    if (soon) soon.insertAdjacentHTML('beforebegin', html); else nav.insertAdjacentHTML('beforeend', html);
  };
  const goBi = go;
  go = function(p, t){
    if (PAGES[p]) {
      if (!can()) { toast('본사 계정만 볼 수 있어요.'); return goBi('dash'); }
      closeSide(); renderSide(p); (p === 'acct-list' ? pageAcct : pageVend)(); window.scrollTo(0, 0); return;
    }
    return goBi(p, t);
  };

  function shell(title, eyebrow, desc){
    document.getElementById('main').innerHTML = simpleHero(['거래처·계정 관리', title], eyebrow, title, desc) +
      `<section class="card"><div id="bi-bar"></div><div id="bi-body"><div class="bi-empty">불러오는 중...</div></div></section><div id="bi-extra"></div>` + pageFoot();
  }
  function chips(list, cur, fn){
    return [['', '전체'], ...list.map(x => [x, x])].map(([v, t]) => `<button class="bi-c ${cur === v ? 'on' : ''}" onclick="${fn}('${v}')">${t}</button>`).join('');
  }
  const opt = (list, cur, blank) => (blank ? `<option value="">${blank}</option>` : '') + list.map(x => `<option ${x === cur ? 'selected' : ''}>${h(x)}</option>`).join('');
  const fld = (id, label, v, extra, ph) => `<div class="f ${extra || ''}"><label>${label}</label><input id="bi-${id}" value="${h(v)}" placeholder="${h(ph || '')}"></div>`;
  const gv = id => { const e = document.getElementById('bi-' + id); return e ? (e.type === 'checkbox' ? e.checked : e.value.trim()) : ''; };
  const busyBtn = (on) => { const b = document.getElementById('im-save'); if (b) { b.disabled = on; b.textContent = on ? '저장 중...' : '저장'; } };
  const closeM = () => document.getElementById('inv-modal')?.remove();
  const fixUrl = u => !u ? '' : (/^https?:\/\//i.test(u) ? u : 'https://' + u);

  /* ---------- 복사 (모바일 사파리 대응) ---------- */
  async function copyText(textOrPromise){
    try {
      if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        const blob = Promise.resolve(textOrPromise).then(t => new Blob([t], { type: 'text/plain' }));
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
        return true;
      }
      await navigator.clipboard.writeText(await textOrPromise); return true;
    } catch (e) {
      try { const t = await textOrPromise; const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch (e2) { return false; }
    }
  }

  /* ---------- 분류 선택 · 추가 · 정리 ---------- */
  function catSel(kind, cur){
    const names = catNames(kind), isB = kind === 'brand';
    const list = cur && !names.includes(cur) ? [...names, cur] : names;
    const canAdd = !isB || adm();
    return `<select id="${isB ? 'bi-brand' : 'bi-cat'}" data-prev="${h(cur || '')}" onchange="biCatNew(this,'${kind}')">${opt(list, cur, isB ? '' : '선택')}${canAdd ? `<option value="__new">+ 새 ${KLAB[kind]} 추가</option>` : ''}</select>`;
  }
  window.biCatNew = function(sel, kind){
    if (sel.value !== '__new') { sel.dataset.prev = sel.value; return; }
    const n = (prompt(`새 ${KLAB[kind]} 이름을 입력하세요 (20자 이내)`) || '').trim();
    if (!n) { sel.value = sel.dataset.prev || ''; return; }
    SB.rpc('cat_add', { p_kind: kind, p_name: n }).then(({ data, error }) => {
      if (error) { sel.value = sel.dataset.prev || ''; return toast('추가 실패: ' + error.message); }
      setCats(kind, data);
      sel.outerHTML = catSel(kind, n);
      toast(`'${n}' ${KLAB[kind]}을 추가했어요.`);
      const bar = document.getElementById('bi-bar');
      if (bar) (BI.page === 'acct' ? drawAcct : drawVend)();
    });
  };
  window.biCatManage = function(kind){
    const cats = catSrc(kind).cats || [];
    const L = KLAB[kind];
    iModal(kind === 'brand' ? '소속 정리 · 거래처·계정 공통' : '분류 정리 · ' + (kind === 'acct' ? '계정 현황' : '거래처 현황'), `
      <p class="im-now">이름을 바꾸면 그 ${L}으로 등록된 항목도 같이 바뀌어요. 숨긴 ${L}은 버튼과 선택 목록에서 빠지고, 이미 등록된 항목은 그대로 남아요.${kind === 'brand' ? ' 새 브랜드가 생기면 아래에서 추가하세요.' : ''}</p>
      <div class="bi-cm" id="bi-cm">${cats.map(c => `<div data-id="${c.id}" class="${c.active ? '' : 'hid'}"><input type="text" value="${h(c.name)}" maxlength="20">
        <button type="button" class="bi-b" onclick="const r=this.parentNode;r.previousElementSibling&&r.parentNode.insertBefore(r,r.previousElementSibling)" aria-label="위로">▲</button>
        <button type="button" class="bi-b" onclick="const r=this.parentNode;r.nextElementSibling&&r.parentNode.insertBefore(r.nextElementSibling,r)" aria-label="아래로">▼</button>
        <label><input type="checkbox" ${c.active ? '' : 'checked'} onchange="this.closest('div').classList.toggle('hid',this.checked)">숨김</label></div>`).join('')}</div>
      <div class="bi-top" style="margin-top:14px"><input type="text" id="bi-cm-new" maxlength="20" placeholder="새 ${L} 이름"><button type="button" class="bi-b" onclick="biCmAdd('${kind}')">${ic('plus')}추가</button></div>`, () => {
      const list = [...document.querySelectorAll('#bi-cm > div')].map(r => ({ id: +r.dataset.id, name: r.querySelector('input[type=text]').value.trim(), active: !r.querySelector('input[type=checkbox]').checked }));
      if (list.some(x => !x.name)) return toast(`빈 ${L} 이름이 있어요.`);
      busyBtn(true);
      SB.rpc('cat_manage', { p_kind: kind, p_list: list }).then(({ error }) => {
        if (error) { busyBtn(false); return toast('저장 실패: ' + error.message); }
        closeM(); toast(`${L}을 정리했어요.`);
        if (kind === 'brand') { BI.af.brand = ''; BI.vf.brand = ''; } else if (kind === 'acct') BI.af.cat = ''; else BI.vf.cat = '';
        if (BI.page === 'acct') loadAcct().then(drawAcct); else loadVend().then(drawVend);
      });
    });
  };

  window.biCmAdd = function(kind){
    const inp = document.getElementById('bi-cm-new'), n = (inp.value || '').trim();
    if (!n) return toast('이름을 입력해주세요.');
    SB.rpc('cat_add', { p_kind: kind, p_name: n }).then(({ data, error }) => {
      if (error) return toast('추가 실패: ' + error.message);
      setCats(kind, data); toast(`'${n}' ${KLAB[kind]}을 추가했어요.`);
      (BI.page === 'acct' ? drawAcct : drawVend)(); biCatManage(kind);
    });
  };

  /* ---------- 엑셀 양식 받기 · 일괄 등록 (관리자) ---------- */
  const XL = {
    acct: { file: '계정현황_양식.xlsx', title: '계정 현황', cols: [['소속', 'brand'], ['분류', 'cat'], ['사이트명', 'site'], ['아이디', 'uid'], ['비밀번호', 'pw'], ['로그인 주소', 'url'], ['로그인 방식', 'how'], ['용도', 'purpose'], ['메모', 'memo'], ['관리자 전용', 'adminOnly']],
      help: [['소속', '아래 소속 목록에서 적으세요. 여러 개면 쉼표로 — 예) 멘야마쯔리, 금목돈 (비우면 본사). 새 소속은 사이트의 [소속 정리]에서 먼저 추가하세요.'], ['분류', '아래 분류 목록에서 고르세요. 목록에 없는 이름을 적으면 새 분류로 추가돼요.'], ['사이트명', '꼭 적어야 해요. 같은 사이트가 여러 개면 괄호로 구분 — 예) VD 매출관리(멘야마쯔리)'], ['아이디', ''], ['비밀번호', '암호화되어 저장돼요. 등록이 끝나면 이 파일은 지워주세요.'], ['로그인 주소', '예) ebiz.jette.co.kr'], ['로그인 방식', '아이디·비밀번호 / 구글 로그인 / 네이버 로그인 / 카카오 로그인 / 휴대폰 인증'], ['용도', '짧게 — 예) 본사 발주'], ['메모', '담당자 연락처, 주문 요령 등'], ['관리자 전용', 'O 를 적으면 관리자만 볼 수 있어요.']] },
    vendor: { file: '거래처현황_양식.xlsx', title: '거래처 현황', cols: [['업체명', 'name'], ['소속', 'brand'], ['분류', 'cat'], ['연락처', 'tel'], ['담당자', 'manager'], ['주문 방법', 'how'], ['업체 메모', 'vmemo'], ['품목명', 'item'], ['구매 단위', 'unit'], ['공급가', 'cost'], ['점주 출고가', 'price'], ['재주문 기준', 'reorder'], ['소요 기간', 'lead'], ['품목 메모', 'imemo']],
      help: [['업체명', '꼭 적어야 해요. 품목이 여러 개면 한 줄에 품목 하나씩, 업체명을 줄마다 똑같이 적으세요.'], ['소속', '아래 소속 목록에서 적으세요. 여러 개면 쉼표로 — 예) 멘야마쯔리, 금목돈 (비우면 본사). 새 소속은 사이트의 [소속 정리]에서 먼저 추가하세요.'], ['분류', '아래 분류 목록에서 고르세요. 목록에 없는 이름을 적으면 새 분류로 추가돼요.'], ['연락처', '여러 개면 쉼표로 — 예) 070-1234-5678, 010-1234-5678'], ['담당자', ''], ['주문 방법', '예) 전화, 카톡, 사이트 주문'], ['업체 메모', '최소 주문량, 배송비, 할인 조건 등'], ['품목명', '예) 화산물티슈 (두툼)'], ['구매 단위', '예) 10박스 (1박스=520매)'], ['공급가', 'VAT 포함, 숫자만'], ['점주 출고가', 'VAT 포함, 숫자만'], ['재주문 기준', '예) 3~4박스 남으면 주문'], ['소요 기간', '예) 3주'], ['품목 메모', '']] }
  };
  function xlBtns(kind){ return `<button class="bi-b" onclick="biCatManage('brand')">${ic('filter')}소속 정리</button><button class="bi-b" onclick="biCatManage('${kind}')">${ic('filter')}분류 정리</button><button class="bi-b" onclick="biXlTemplate('${kind}')">${ic('download')}엑셀 양식 받기</button><button class="bi-b" onclick="biXlUpload('${kind}')">${ic('file')}엑셀로 일괄 등록</button>`; }
  let xlLoading = null;
  function loadXlsx(){
    if (window.XLSX) return Promise.resolve();
    if (xlLoading) return xlLoading;
    xlLoading = new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; sc.onload = ok; sc.onerror = () => { xlLoading = null; no(new Error('엑셀 도구를 불러오지 못했어요.')); }; document.head.appendChild(sc); });
    return xlLoading;
  }
  window.biXlTemplate = function(kind){
    const S = XL[kind];
    loadXlsx().then(() => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([S.cols.map(c => c[0])]);
      ws['!cols'] = S.cols.map(c => ({ wch: ['비밀번호', '아이디', '소속', '관리자 전용', '담당자', '소요 기간'].includes(c[0]) ? 12 : ['메모', '업체 메모', '품목 메모', '로그인 주소', '품목명', '연락처'].includes(c[0]) ? 30 : 18 }));
      XLSX.utils.book_append_sheet(wb, ws, '입력');
      const cats = catNames(kind);
      const rows = [['칸', '적는 방법'], ...S.help, [], ['소속 목록'], ...catNames('brand').map(b => [b]), [], ['분류 목록'], ...cats.map(c => [c])];
      const ws2 = XLSX.utils.aoa_to_sheet(rows); ws2['!cols'] = [{ wch: 14 }, { wch: 80 }];
      XLSX.utils.book_append_sheet(wb, ws2, '안내');
      XLSX.writeFile(wb, S.file);
      toast("'입력' 시트에 한 줄씩 적어서 [엑셀로 일괄 등록]으로 올려주세요.");
    }).catch(e => toast(e.message));
  };
  const norm = x => String(x ?? '').replace(/\s+/g, ' ').trim();
  const yes = x => /^(o|ㅇ|y|yes|예|1|true|v|✓|○)$/i.test(norm(x));
  window.biXlUpload = function(kind){
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.xls,.csv';
    inp.onchange = () => {
      const file = inp.files[0]; if (!file) return;
      loadXlsx().then(() => file.arrayBuffer()).then(buf => {
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets['입력'] || wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
        const S = XL[kind], names = S.cols.map(c => c[0].replace(/\s/g, ''));
        const hi = aoa.findIndex(r => r.some(c => names.includes(norm(c).replace(/\s/g, ''))));
        if (hi < 0) return toast('양식의 제목 줄(' + S.cols[0][0] + ' 등)을 찾지 못했어요. [엑셀 양식 받기]로 받은 파일을 써주세요.');
        const map = aoa[hi].map(c => { const k = names.indexOf(norm(c).replace(/\s/g, '')); return k >= 0 ? S.cols[k][1] : null; });
        const rows = aoa.slice(hi + 1).map(r => { const o = {}; map.forEach((k, i) => { if (k) o[k] = norm(r[i]); }); if (kind === 'acct') o.pw = String(r[map.indexOf('pw')] ?? '').trim(); return o; })
          .filter(o => Object.entries(o).some(([k, v]) => v !== '' && k !== 'adminOnly'));
        if (!rows.length) return toast('입력된 줄이 없어요.');
        xlPreview(kind, rows);
      }).catch(e => toast('파일을 읽지 못했어요: ' + e.message));
    };
    inp.click();
  };
  function xlPreview(kind, rows){
    const isA = kind === 'acct', cats = catNames(kind), newCats = new Set(), seen = new Set();
    const D = isA ? BI.acct : BI.vend;
    rows.forEach(o => {
      o.brs = splitBr(o.brand); o.brand = o.brs.join(', ');
      if (!o.brs.length && isA) { o.brs = ['본사']; o.brand = '본사'; } // 거래처는 빈칸이면 같은 업체 첫 줄의 소속을 따름
      const badBr = o.brs.some(b => !catNames('brand').includes(b));
      if (isA) {
        o.adminOnly = yes(o.adminOnly);
        const key = [o.site, o.uid || ''].join('|');
        if (!o.site) o._st = ['no', '제외 · 사이트명 없음'];
        else if (badBr) o._st = ['no', '제외 · 없는 소속'];
        else if (seen.has(key) || D.list.some(a => [a.site, a.uid || ''].join('|') === key)) o._st = ['sk', '건너뜀 · 이미 있음'];
        else o._st = ['ok', '등록'];
        seen.add(key);
      } else {
        const v = D.list.find(x => x.name === o.name);
        const key = o.name + '|' + (o.item || '');
        if (!o.name) o._st = ['no', '제외 · 업체명 없음'];
        else if (badBr) o._st = ['no', '제외 · 없는 소속'];
        else if (!o.item) o._st = (v || [...seen].some(k => k.startsWith(o.name + '|'))) ? ['sk', '건너뜀 · 업체 이미 있음'] : ['ok', '업체만 등록'];
        else if (seen.has(key) || (v && v.items.some(i => i.name === o.item))) o._st = ['sk', '건너뜀 · 이미 있음'];
        else o._st = ['ok', v ? '취급 품목 추가' : '등록'];
        seen.add(key);
      }
      if (o._st[0] === 'ok' && o.cat && !cats.includes(o.cat)) newCats.add(o.cat);
    });
    const ok = rows.filter(o => o._st[0] === 'ok'), sk = rows.filter(o => o._st[0] === 'sk').length, no = rows.filter(o => o._st[0] === 'no').length;
    const head = isA ? ['상태', '사이트명', '아이디', '비밀번호', '소속', '분류', '관리자 전용'] : ['상태', '업체명', '품목명', '공급가', '점주 출고가', '소속', '분류', '연락처'];
    const cell = o => isA ? [o.site, o.uid, o.pw ? '●●●●' : '', o.brand, o.cat, o.adminOnly ? 'O' : ''] : [o.name, o.item, o.cost, o.price, o.brand, o.cat, o.tel];
    iModal('엑셀 일괄 등록 · ' + XL[kind].title, `
      <div class="bi-sum"><span class="ok">등록 ${ok.length}</span><span class="sk">건너뜀 ${sk}</span><span class="no">제외 ${no}</span>${newCats.size ? `<span>새 분류 ${[...newCats].map(h).join(', ')}</span>` : ''}</div>
      <div class="bi-pv"><table><thead><tr>${head.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(o => `<tr class="${o._st[0]}"><td class="st ${o._st[0]}">${h(o._st[1])}</td>${cell(o).map(x => `<td>${h(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="im-warn">'등록'으로 표시된 줄만 들어가요. 이미 있는 항목은 건드리지 않고 건너뛰어요.${isA ? ' 등록이 끝나면 비밀번호가 적힌 엑셀 파일은 지워주세요.' : ''}</p>`, () => {
      if (!ok.length) return toast('등록할 줄이 없어요.');
      busyBtn(true);
      const payload = ok.map(o => { const c = Object.assign({}, o); delete c._st; delete c.brs; return c; });
      SB.rpc(isA ? 'acct_bulk' : 'vendor_bulk', { p_rows: payload }).then(({ data, error }) => {
        if (error) { busyBtn(false); return toast('등록 실패 (아무것도 들어가지 않았어요): ' + error.message); }
        closeM();
        toast(isA ? `계정 ${data.added}개를 등록했어요.` : `거래처 ${data.vendors}곳, 품목 ${data.items}개를 등록했어요.`);
        if (isA) loadAcct().then(drawAcct); else loadVend().then(drawVend);
      });
    }, `${ok.length}건 등록`);
    if (!ok.length) { const b = document.getElementById('im-save'); if (b) b.disabled = true; }
  }

  /* ==========================================================
     계정 현황
     ========================================================== */
  async function loadAcct(){
    const { data, error } = await SB.rpc('acct_data'); if (error) throw error;
    BI.acct = data; BI.brands = data.brands || []; BI.page = 'acct';
  }
  function pageAcct(){
    shell('계정 현황', 'BASE · ACCOUNTS', '업무에 쓰는 사이트의 아이디와 비밀번호를 확인하고, 바로 열어 로그인하세요.');
    loadAcct().then(drawAcct).catch(e => { document.getElementById('bi-body').innerHTML = `<div class="bi-empty">불러오지 못했어요: ${h(e.message)}<br><button class="bi-b" onclick="go('acct-list')">${ic('reset')}다시 불러오기</button></div>`; });
  }
  window.biAF = (k, v) => { BI.af[k] = v; drawAcct(); };
  function drawAcct(){
    const D = BI.acct; if (!D) return;
    const f = BI.af;
    document.getElementById('bi-bar').innerHTML = `<div class="bi-bar">
      <div class="bi-top"><input type="text" id="bi-aq" placeholder="사이트·아이디·메모 검색" value="${h(f.q)}" oninput="BI_aq(this.value)"><button class="btn primary" onclick="biAcctModal()">${ic('plus')}계정 등록</button></div>
      <div class="bi-row"><span>소속</span>${chips(catNames('brand'), f.brand, "biAF.bind(null,'brand')")}</div>
      <div class="bi-row"><span>분류</span>${chips(catNames('acct'), f.cat, "biAF.bind(null,'cat')")}</div>
      <div class="bi-row">${D.admin ? xlBtns('acct') : ''}<label class="bi-off"><input type="checkbox" ${f.off ? 'checked' : ''} onchange="biAF('off',this.checked)">사용 중지 항목도 보기</label></div></div>`;
    drawAcctList();
    const ex = document.getElementById('bi-extra');
    ex.innerHTML = D.admin ? `<section class="card"><div class="section-title"><strong>${ic('eye')}비밀번호 열람 기록</strong><small>최근 50건 · 관리자만 보여요</small></div>
      <div class="bi-log">${D.log.length ? D.log.map(l => `<div><span>${h(l.at)}</span><span>${h(l.site)}</span><span>${h(l.action)}</span><span>${h(l.who)}</span></div>`).join('') : '<p style="color:#909b84">아직 기록이 없어요.</p>'}</div></section>` : '';
  }
  window.BI_aq = v => { BI.af.q = v; drawAcctList(); };
  function drawAcctList(){
    const D = BI.acct, f = BI.af, q = f.q.toLowerCase();
    const list = D.list.filter(a => (f.off || a.active) && (!f.brand || (a.brs || []).includes(f.brand)) && (!f.cat || a.cat === f.cat) &&
      (!q || [a.site, a.uid, a.memo, a.purpose, a.vendor].join(' ').toLowerCase().includes(q)));
    const body = document.getElementById('bi-body');
    if (!D.list.length) { body.innerHTML = `<div class="bi-empty">등록된 계정이 없어요.<br>[계정 등록]으로 첫 계정을 추가하세요.</div>`; return; }
    body.innerHTML = `<div class="bi-cnt">${list.length}개</div><div class="bi-list">${list.length ? list.map(acctRow).join('') : '<div class="bi-empty">조건에 맞는 계정이 없어요.</div>'}</div>`;
    if (BI.hlAcct) { const e = document.getElementById('bi-a' + BI.hlAcct); if (e) { e.classList.add('hl'); e.scrollIntoView({ block: 'center' }); } BI.hlAcct = null; }
  }
  function acctRow(a){
    const url = fixUrl(a.url);
    const parts = [a.purpose, a.how && a.how !== '아이디·비밀번호' ? a.how : '', a.memo].filter(Boolean).map(h);
    if (a.vendorId) parts.push(`<a href="javascript:void(0)" onclick="biGoVendor(${a.vendorId})">거래처 정보: ${h(a.vendor)}</a>`);
    const sub = parts.join(' / ');
    return `<div class="bi-it ${a.active ? '' : 'off'}" id="bi-a${a.id}">
      <div class="bi-name">${h(a.site)}<span class="bi-tag">${brTxt(a.brs)}${a.cat ? ' · ' + h(a.cat) : ''}</span>${a.adminOnly ? `<span class="bi-tag lock">${ic('lock')}관리자 전용</span>` : ''}${a.active ? '' : '<span class="bi-tag stop">사용 중지</span>'}${a.pwCheck ? '<span class="bi-tag warn" title="워크스페이스 로그인 비밀번호가 잘못 저장돼 있어요. [수정]에서 이 사이트의 진짜 비밀번호를 다시 입력해주세요.">비밀번호 다시 입력 필요</span>' : ''}</div>
      <div class="bi-acts">${url ? `<a class="bi-b red" href="${h(url)}" target="_blank" rel="noopener">${ic('link')}열기</a>` : ''}<button class="bi-b" onclick="biAcctModal(${a.id})">${ic('edit')}수정</button></div>
      <div class="bi-cred">
        ${a.uid ? `<span class="k">아이디</span><span class="v cp" title="눌러서 아이디 복사" onclick="biCopyUid(${a.id})">${h(a.uid)}</span><span class="bi-acts"><button class="bi-b" title="아이디 복사" onclick="biCopyUid(${a.id})">${ic('copy')}복사</button></span>` : ''}
        ${a.hasPw ? `<span class="k">비밀번호</span><span class="v mask cp" id="bi-pw${a.id}" title="눌러서 비밀번호 복사" onclick="biCopyPw(${a.id})">●●●●●●●●</span><span class="bi-acts"><button class="bi-b" id="bi-pwb${a.id}" onclick="biReveal(${a.id})">${ic('eye')}보기</button><button class="bi-b" title="비밀번호 복사" onclick="biCopyPw(${a.id})">${ic('copy')}복사</button></span>` : ''}
      </div>
      ${sub ? `<div class="bi-sub">${sub}</div>` : ''}
      <div class="bi-sub" style="font-size:11px;color:#a0a796">수정 ${h(a.upd)}${a.by ? ' · ' + h(a.by) : ''}</div>
    </div>`;
  }
  window.biCopyUid = id => { const a = BI.acct.list.find(x => x.id === id); if (!a || !a.uid) return; copyText(String(a.uid).trim()).then(ok => toast(ok ? '아이디를 복사했어요.' : '복사가 안 돼요. 길게 눌러 직접 복사해주세요.')); };
  const fetchPw = (id, action) => SB.rpc('acct_reveal', { p_id: id, p_action: action }).then(({ data, error }) => { if (error) throw error; return data || ''; });
  function hidePw(id){
    const v = document.getElementById('bi-pw' + id), b = document.getElementById('bi-pwb' + id);
    if (v) { v.textContent = '●●●●●●●●'; v.classList.add('mask'); }
    if (b) b.innerHTML = ic('eye') + '보기';
    clearTimeout(BI.timers[id]); delete BI.timers[id];
  }
  window.biReveal = function(id){
    if (BI.timers[id]) return hidePw(id);
    fetchPw(id, '보기').then(pw => {
      const v = document.getElementById('bi-pw' + id), b = document.getElementById('bi-pwb' + id); if (!v) return;
      v.textContent = pw || '(비어 있음)'; v.classList.remove('mask'); if (b) b.innerHTML = ic('eye') + '숨김';
      BI.timers[id] = setTimeout(() => hidePw(id), 30000);
    }).catch(e => toast('불러오지 못했어요: ' + e.message));
  };
  window.biCopyPw = function(id){
    const p = fetchPw(id, '복사');
    copyText(p).then(ok => {
      if (ok) return toast('비밀번호를 복사했어요.');
      p.then(pw => { const v = document.getElementById('bi-pw' + id); if (v) { v.textContent = pw; v.classList.remove('mask'); BI.timers[id] = setTimeout(() => hidePw(id), 30000); } toast('자동 복사가 안 돼요. 보이는 비밀번호를 길게 눌러 복사해주세요.'); });
    }).catch(e => toast('불러오지 못했어요: ' + e.message));
  };
  window.biGoVendor = function(vid){ BI.hlVend = vid; BI.vf = { q: '', brand: '', cat: '', off: true }; go('vendor-list'); };

  window.biAcctModal = function(id){
    const D = BI.acct; const a = id ? D.list.find(x => x.id === id) : { brs: [BI.af.brand || '본사'], cat: BI.af.cat || '', site: '', uid: '', url: '', how: '아이디·비밀번호', purpose: '', memo: '', adminOnly: false, active: true, vendorId: null, hasPw: false };
    iModal(id ? '계정 수정 · ' + a.site : '계정 등록', `<div class="im-grid">
      <div class="f wide"><label>소속 <span>여러 개 선택 가능</span></label>${brChecks(a.brs)}</div>
      <div class="f"><label>분류</label>${catSel('acct', a.cat)}</div>
      ${fld('site', '사이트명', a.site, 'wide', '예) 제때, 배달의민족(본점)')}
      <div class="f"><label>아이디</label><input id="bi-uid" name="acct-uid-${Date.now()}" value="${h(a.uid)}" autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" readonly onfocus="this.removeAttribute('readonly')"></div>
      <div class="f"><label>비밀번호</label><div class="bi-pw"><input id="bi-pw" type="text" class="sec" name="acct-secret-${Date.now()}" autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" readonly onfocus="this.removeAttribute('readonly')" placeholder="${a.hasPw ? '바꿀 때만 입력' : '비밀번호'}"><button type="button" class="bi-b" title="보이기/숨기기" onclick="document.getElementById('bi-pw').classList.toggle('sec')">${ic('eye')}</button></div>${a.hasPw ? '<div class="bi-help">비워두면 지금 비밀번호가 그대로 유지돼요.</div>' : ''}</div>
      ${fld('url', '로그인 주소', a.url, 'wide', '예) ebiz.jette.co.kr')}
      <div class="f"><label>로그인 방식</label><input id="bi-how" list="bi-hows" value="${h(a.how)}"><datalist id="bi-hows">${HOWS.map(x => `<option value="${h(x)}">`).join('')}</datalist></div>
      ${fld('purpose', '용도', a.purpose, '', '짧게, 예) 본사 발주')}
      <div class="f wide"><label>메모</label><textarea id="bi-memo" placeholder="담당자 연락처, 주문 요령 등">${h(a.memo)}</textarea></div>
      <div class="f wide"><label>연결 거래처</label><select id="bi-vendor"><option value="">없음</option>${D.vendors.map(v => `<option value="${v.id}" ${v.id === a.vendorId ? 'selected' : ''}>${h(v.name)}</option>`).join('')}</select></div>
      ${D.admin ? `<div class="f"><label>공개 범위</label><label class="bi-chk"><input type="checkbox" id="bi-adminOnly" ${a.adminOnly ? 'checked' : ''}>관리자 전용 (직원에게 안 보임)</label></div>
      ${id ? `<div class="f"><label>사용</label><select id="bi-active"><option value="1" ${a.active ? 'selected' : ''}>사용</option><option value="0" ${a.active ? '' : 'selected'}>사용 중지</option></select></div>` : ''}` : ''}
    </div>`, () => {
      const p = { id: id || '', brs: brPicked(), cat: gv('cat'), site: gv('site'), uid: gv('uid'), pw: document.getElementById('bi-pw').value, url: gv('url'), how: gv('how'), purpose: gv('purpose'), memo: gv('memo'), vendorId: gv('vendor') };
      if (D.admin) { p.adminOnly = !!gv('adminOnly'); if (id) p.active = gv('active') === '1'; }
      if (!p.site) return toast('사이트명을 입력해주세요.');
      if (!p.brs.length) return toast('소속을 하나 이상 골라주세요.');
      busyBtn(true);
      const save = () => SB.rpc('acct_save', { p }).then(({ data, error }) => {
        if (error && /WS_PW_SAME/.test(error.message || '')) {
          if (confirm('입력한 비밀번호가 워크스페이스 로그인 비밀번호와 같아요.\n브라우저가 자동으로 채운 것일 수 있어요.\n\n이 사이트 비밀번호가 정말 이게 맞으면 [확인], 다시 입력하려면 [취소]를 눌러주세요.')) { p.force = true; return save(); }
          busyBtn(false); const i = document.getElementById('bi-pw'); if (i) { i.value = ''; i.focus(); } return;
        }
        if (error) { busyBtn(false); return toast('저장 실패: ' + error.message); }
        closeM(); toast(id ? '계정을 수정했어요.' : '계정을 등록했어요.'); BI.hlAcct = data;
        loadAcct().then(drawAcct);
      });
      save();
    });
  };

  /* ==========================================================
     거래처 현황
     ========================================================== */
  async function loadVend(){
    const { data, error } = await SB.rpc('vendor_data'); if (error) throw error;
    BI.vend = data; BI.brands = data.brands || []; BI.page = 'vend';
  }
  function pageVend(){
    shell('거래처 현황', 'BASE · VENDORS', '업체 연락처와 품목별 단가, 주문 요령을 확인하세요. 단가를 바꾸면 이력이 남아요.');
    loadVend().then(drawVend).catch(e => { document.getElementById('bi-body').innerHTML = `<div class="bi-empty">불러오지 못했어요: ${h(e.message)}<br><button class="bi-b" onclick="go('vendor-list')">${ic('reset')}다시 불러오기</button></div>`; });
  }
  window.biVF = (k, v) => { BI.vf[k] = v; drawVend(); };
  window.BI_vq = v => { BI.vf.q = v; drawVendList(); };
  function drawVend(){
    const f = BI.vf;
    document.getElementById('bi-bar').innerHTML = `<div class="bi-bar">
      <div class="bi-top"><input type="text" placeholder="업체·품목·연락처 검색" value="${h(f.q)}" oninput="BI_vq(this.value)"><button class="btn primary" onclick="biVendModal()">${ic('plus')}거래처 등록</button></div>
      <div class="bi-row"><span>소속</span>${chips(catNames('brand'), f.brand, "biVF.bind(null,'brand')")}</div>
      <div class="bi-row"><span>분류</span>${chips(catNames('vendor'), f.cat, "biVF.bind(null,'cat')")}</div>
      <div class="bi-row">${BI.vend.admin ? xlBtns('vendor') : ''}<label class="bi-off"><input type="checkbox" ${f.off ? 'checked' : ''} onchange="biVF('off',this.checked)">사용 중지 항목도 보기</label></div></div>`;
    drawVendList();
  }
  function telLinks(s){
    return h(s).replace(/(0\d{1,2}-?\d{3,4}-?\d{4}|1\d{3}-\d{4})/g, m => `<a href="tel:${m.replace(/-/g, '')}">${mmTel(m)}</a>`);
  }
  function drawVendList(){
    const D = BI.vend, f = BI.vf, q = f.q.toLowerCase();
    const list = D.list.filter(v => (f.off || v.active) && (!f.brand || (v.brs || []).includes(f.brand)) && (!f.cat || v.cat === f.cat) &&
      (!q || [v.name, v.tel, v.manager, v.memo, v.how, ...v.items.map(i => i.name)].join(' ').toLowerCase().includes(q)));
    const body = document.getElementById('bi-body');
    if (!D.list.length) { body.innerHTML = `<div class="bi-empty">등록된 거래처가 없어요.<br>[거래처 등록]으로 첫 업체를 추가하세요.</div>`; return; }
    body.innerHTML = `<div class="bi-cnt">${list.length}곳</div><div class="bi-list">${list.length ? list.map(vendRow).join('') : '<div class="bi-empty">조건에 맞는 거래처가 없어요.</div>'}</div>`;
    if (BI.hlVend) { const e = document.getElementById('bi-v' + BI.hlVend); if (e) { e.classList.add('hl'); e.scrollIntoView({ block: 'center' }); } BI.hlVend = null; }
  }
  function vendRow(v){
    const items = v.items.filter(i => BI.vf.off || i.active);
    return `<div class="bi-it ${v.active ? '' : 'off'}" id="bi-v${v.id}">
      <div class="bi-name">${h(v.name)}<span class="bi-tag">${brTxt(v.brs)}${v.cat ? ' · ' + h(v.cat) : ''}</span>${v.active ? '' : '<span class="bi-tag stop">사용 중지</span>'}</div>
      <div class="bi-acts">${v.accounts.map(a => `<button class="bi-b red" onclick="biGoAcct(${a.id})">${ic('key')}${h(a.site)} 계정</button>`).join('')}<button class="bi-b" onclick="biVendModal(${v.id})">${ic('edit')}수정</button></div>
      <div class="bi-sub">${[v.tel ? `${ic('phone').replace('class="icon"', 'class="icon" style="width:12px;height:12px;vertical-align:-1px"')} ${telLinks(v.tel)}` : '', v.manager ? '담당 ' + h(v.manager) : '', v.how ? '주문 ' + h(v.how) : ''].filter(Boolean).join(' / ')}</div>
      ${v.memo ? `<div class="bi-sub">${h(v.memo)}</div>` : ''}
      <div class="bi-items"><div class="bi-scroll"><table><colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="c5"></colgroup><thead><tr><th>취급 품목</th><th>구매 단위</th><th style="text-align:right">공급가</th><th style="text-align:right">점주 출고가</th><th>재주문 기준</th></tr></thead><tbody>
        ${items.length ? items.map(i => `<tr class="click ${i.active ? '' : 'off'}" onclick="biItemModal(${v.id},${i.id})"><td>${h(i.name)}${i.active ? '' : ' (중지)'}</td><td class="un">${h(i.unit)}</td><td class="n" data-l="공급가">${won(i.cost)}</td><td class="n" data-l="점주 출고가">${won(i.price)}</td><td class="ro">${h(i.reorder)}${i.lead ? (i.reorder ? ' / ' : '') + '소요 ' + h(i.lead) : ''}</td></tr>`).join('') : '<tr><td colspan="5" style="color:#a0a796">등록된 취급 품목이 없어요.</td></tr>'}
      </tbody></table></div></div>
      <div class="bi-sub" style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="font-size:11px;color:#a0a796">수정 ${h(v.upd)}${v.by ? ' · ' + h(v.by) : ''}</span><button class="bi-b" onclick="biItemModal(${v.id})">${ic('plus')}취급 품목 등록</button></div>
    </div>`;
  }
  window.biGoAcct = function(aid){ BI.hlAcct = aid; BI.af = { q: '', brand: '', cat: '', off: true }; go('acct-list'); };

  window.biVendModal = function(id){
    const D = BI.vend; const v = id ? D.list.find(x => x.id === id) : { name: '', brs: [BI.vf.brand || '본사'], cat: BI.vf.cat || '', tel: '', manager: '', how: '', memo: '', active: true };
    iModal(id ? '거래처 수정 · ' + v.name : '거래처 등록', `<div class="im-grid">
      ${fld('name', '업체명', v.name, 'wide')}
      <div class="f wide"><label>소속 <span>여러 개 선택 가능</span></label>${brChecks(v.brs)}</div>
      <div class="f"><label>분류</label>${catSel('vendor', v.cat)}</div>
      ${fld('tel', '연락처', mmTel(v.tel), 'wide', '여러 개면 쉼표로, 예) 070-1234-5678, 010-1234-5678')}
      ${fld('manager', '담당자', v.manager)}
      ${fld('how', '주문 방법', v.how, '', '예) 전화, 카톡, 사이트 주문')}
      <div class="f wide"><label>메모</label><textarea id="bi-memo" placeholder="최소 주문량, 배송비, 할인 조건 등">${h(v.memo)}</textarea></div>
      ${D.admin && id ? `<div class="f"><label>사용</label><select id="bi-active"><option value="1" ${v.active ? 'selected' : ''}>사용</option><option value="0" ${v.active ? '' : 'selected'}>사용 중지</option></select></div>` : ''}
    </div>${id ? '' : '<p class="im-warn">등록한 뒤 업체 아래 [취급 품목 등록]으로 사는 물건과 단가를 넣어주세요.</p>'}`, () => {
      const p = { id: id || '', name: gv('name'), brs: brPicked(), cat: gv('cat'), tel: gv('tel'), manager: gv('manager'), how: gv('how'), memo: gv('memo') };
      if (D.admin && id) p.active = gv('active') === '1';
      if (!p.name) return toast('업체명을 입력해주세요.');
      if (!p.brs.length) return toast('소속을 하나 이상 골라주세요.');
      busyBtn(true);
      SB.rpc('vendor_save', { p }).then(({ data, error }) => {
        if (error) { busyBtn(false); return toast('저장 실패: ' + error.message); }
        closeM(); toast(id ? '거래처를 수정했어요.' : '거래처를 등록했어요.'); BI.hlVend = data;
        loadVend().then(drawVend);
      });
    });
  };

  window.biItemModal = function(vid, iid){
    const D = BI.vend; const v = D.list.find(x => x.id === vid);
    const it = iid ? v.items.find(x => x.id === iid) : { name: '', unit: '', cost: '', price: '', reorder: '', lead: '', memo: '', active: true, hist: [] };
    const n = x => (x === null || x === undefined || x === '') ? '' : Number(x).toLocaleString('ko-KR');
    iModal((iid ? '취급 품목 수정 · ' : '취급 품목 등록 · ') + v.name, `<p class="im-now">발주가 들어가는 곳이 아니에요. 이 업체에서 사는 물건과 단가를 기록해 두는 곳이에요.</p><div class="im-grid">
      ${fld('name', '품목명', it.name, 'wide', '예) 화산물티슈 (두툼)')}
      ${fld('unit', '구매 단위', it.unit, 'wide', '예) 10박스 (1박스=520매)')}
      ${fld('cost', '공급가 (VAT 포함, 원)', n(it.cost), '', '숫자만')}
      ${fld('price', '점주 출고가 (VAT 포함, 원)', n(it.price), '', '숫자만')}
      ${fld('reorder', '재주문 기준', it.reorder, '', '예) 3~4박스 남으면 주문')}
      ${fld('lead', '소요 기간', it.lead, '', '예) 3주')}
      <div class="f wide"><label>메모</label><textarea id="bi-memo">${h(it.memo)}</textarea></div>
      ${D.admin && iid ? `<div class="f"><label>사용</label><select id="bi-active"><option value="1" ${it.active ? 'selected' : ''}>사용</option><option value="0" ${it.active ? '' : 'selected'}>사용 중지</option></select></div>` : ''}
    </div>
    ${iid ? `<div class="bi-hist"><div class="h"><span>변경일</span><span>공급가</span><span>점주 출고가</span><span>변경자</span></div>${it.hist.length ? it.hist.map(x => `<div><span>${h(x.at)}</span><span>${won(x.cost)}</span><span>${won(x.price)}</span><span>${h(x.by)}</span></div>`).join('') : '<div><span style="grid-column:1/-1">단가 이력이 없어요.</span></div>'}</div>` : ''}`, () => {
      const num = s => s.replace(/[^\d.]/g, '');
      const p = { id: iid || '', vendorId: vid, name: gv('name'), unit: gv('unit'), cost: num(gv('cost')), price: num(gv('price')), reorder: gv('reorder'), lead: gv('lead'), memo: gv('memo') };
      if (D.admin && iid) p.active = gv('active') === '1';
      if (!p.name) return toast('품목명을 입력해주세요.');
      busyBtn(true);
      SB.rpc('vendor_item_save', { p }).then(({ error }) => {
        if (error) { busyBtn(false); return toast('저장 실패: ' + error.message); }
        closeM(); toast(iid ? '취급 품목을 수정했어요.' : '취급 품목을 등록했어요.'); BI.hlVend = vid;
        loadVend().then(drawVend);
      });
    });
  };
})();
