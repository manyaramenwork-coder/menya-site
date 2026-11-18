
/* ==========================================================
   매뉴얼 관리 (2026-11-03) — 운영매뉴얼 · 조리매뉴얼 · 서류매뉴얼
   - 보기: 모든 계정 / 등록·새 버전·정보 수정: 관리자·본사 / 삭제: 관리자
   - 형식: 운영·조리 = PDF만, 서류 = PDF·한글·워드·엑셀 / 파일당 20MB
   - 새 버전을 올리면 이전 버전은 최근 3개까지만 보관 (그 이전은 자동 삭제)
   - 파일: Supabase Storage 'manual-files' (비공개, 10분짜리 링크로 열기)
   - 관리자 화면에 저장공간 사용량 표시 (무료 플랜 1GB)
   ========================================================== */
(function(){
  PATHS.plus = PATHS.plus || 'M12 5v14 M5 12h14';
  PATHS.layers = 'M12 3 2 8l10 5 10-5z M2 13l10 5 10-5 M2 18l10 5 10-5';
  const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PAGES = { 'man-ops': ['ops', '운영매뉴얼', 'OPERATION MANUAL', '매장 운영 기준을 담은 매뉴얼이에요. 제목을 누르면 바로 열려요.'],
                  'man-cook': ['cook', '조리매뉴얼', 'RECIPE MANUAL', '메뉴별 조리 기준이에요. 제목을 누르면 바로 열려요.'],
                  'man-doc': ['doc', '서류매뉴얼', 'FORMS · DOCUMENTS', '신청서·양식 등 서류 모음이에요. PDF는 바로 열리고, 한글·워드·엑셀은 내려받아져요.'] };
  const KIND = { ops: '운영매뉴얼', cook: '조리매뉴얼', doc: '서류매뉴얼' };
  const BUCKET = 'manual-files', MAXB = 20 * 1024 * 1024;
  const MIME = { pdf: 'application/pdf', hwp: 'application/x-hwp', hwpx: 'application/haansofthwpx', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  const OK = { ops: ['pdf'], cook: ['pdf'], doc: ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'xls', 'xlsx'] };
  const ext = n => (String(n).split('.').pop() || '').toLowerCase();
  const kb = b => b >= 1073741824 ? (b / 1073741824).toFixed(2) + 'GB' : b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB';
  const EXT_LAB = e => ({ pdf: 'PDF', hwp: '한글', hwpx: '한글', doc: '워드', docx: '워드', xls: '엑셀', xlsx: '엑셀' }[e] || e.toUpperCase());
  const MN = { data: null, uid: '', kind: 'ops', f: { q: '', brand: '', sort: 'old' }, cur: null };
  const pubTxt = d => d ? d.replace(/-/g, '.') : '';
  const writer = () => !!(MN.data && MN.data.writer), admin = () => !!(MN.data && MN.data.admin);
  const closeM = () => document.getElementById('inv-modal')?.remove();
  const uid4 = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const brNames = () => ((MN.data && MN.data.brands) || []).filter(b => b.active).map(b => b.name);
  const brSort = list => { const all = ((MN.data && MN.data.brands) || []).map(b => b.name); return [...(list || [])].sort((a, b) => (all.indexOf(a) + 1 || 99) - (all.indexOf(b) + 1 || 99)); };

  /* ---------- 스타일 ---------- */
  const st = document.createElement('style');
  st.textContent = `
  .mn-usage{display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:12px;color:#4a5244}
  .mn-usage b{font-size:13px;color:#2d3726}
  .mn-usage .bar{flex:1 1 220px;height:8px;border-radius:99px;background:#eef0e8;overflow:hidden;margin:0;display:block}
  .mn-usage .bar i{display:block;height:100%;background:#6f8a5a;border-radius:99px}
  .mn-usage .bar i.warn{background:#c9952b}.mn-usage .bar i.over{background:#c62429}
  .mn-usage small{color:#8b9381;font-size:11px}
  .mn-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto auto;gap:4px 12px;align-items:center;border-top:1px solid var(--line);padding:13px 4px}
  .mn-row:first-child{border-top:0}
  .mn-row:hover{background:#fafbf7}
  .mn-ext{width:38px;height:38px;border-radius:8px;display:grid;place-items:center;font-size:10px;font-weight:700;background:#fbeeee;color:#a3262c}
  .mn-ext.hwp{background:#e9f1fa;color:#2c5a8a}.mn-ext.doc{background:#e8eefb;color:#2f4f9a}.mn-ext.xls{background:#e8f4ec;color:#2b6b41}
  .mn-main{min-width:0;cursor:pointer}
  .mn-t{font-size:14px;font-weight:500;color:#222b1e;display:flex;align-items:center;gap:6px;min-width:0}
  .mn-t span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mn-main:hover .mn-t span{color:#c62429;text-decoration:underline;text-underline-offset:3px}
  .mn-d{font-size:12px;color:#7d8574;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mn-br{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}
  .mn-br em{font-style:normal;font-size:10px;padding:2px 7px;border-radius:5px;background:#f0f2eb;color:#5f6a52}
  .mn-m{font-size:12px;color:#8b9381;white-space:nowrap;text-align:right;line-height:1.6}
  .mn-m b{font-weight:600;color:#4f6b3b}
  .mn-v{flex:none;font-size:10px;font-weight:700;padding:2px 6px;border-radius:5px;background:#eef2e5;color:#435833}
  .mn-meta{display:grid;grid-template-columns:70px 1fr;gap:7px 10px;font-size:13px;color:#2d3726;margin-bottom:14px}
  .mn-meta>span:nth-child(odd){color:#8b9381;font-size:12px}
  .mn-open{width:100%;justify-content:center;padding:11px;font-size:13px}
  .mn-olds{margin-top:16px;padding-top:14px;border-top:1px dashed var(--line)}
  .mn-olds b{display:block;font-size:13px;color:#2d3726;margin-bottom:8px}
  .mn-olds button{display:flex;align-items:center;gap:10px;width:100%;border:0;background:#f6f7f3;border-radius:8px;padding:9px 11px;margin-bottom:6px;font-size:12px;color:#3f4839;cursor:pointer;text-align:left}
  .mn-olds button:hover{background:#eef0e8}
  .mn-olds button span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mn-olds small{color:#8b9381}
  .mn-pick{display:flex;align-items:center;gap:8px;font-size:13px;color:#3f4839;background:#f6f7f3;border-radius:8px;padding:9px 11px;margin-top:6px}
  .mn-pick span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mn-pick small{color:#8b9381}
  .mn-pub{font-size:12px;color:#4f6b3b;margin-top:3px;font-weight:500}
  .mn-sort{margin-left:auto;display:flex;gap:4px}
  #mn-add{display:flex;gap:6px}
  .mn-foot-l{margin-right:auto;display:flex;gap:6px;flex-wrap:wrap}
  @media(max-width:640px){.mn-row{grid-template-columns:38px minmax(0,1fr) auto}.mn-m{grid-column:2;text-align:left}.mn-row .bi-b{grid-row:1;grid-column:3}}`;
  document.head.appendChild(st);

  /* ---------- 데이터 ---------- */
  async function load(){
    if (!SESSION.user || SESSION.mustChange || !window.SB) return null;
    if (MN.uid !== SESSION.user.uid) { MN.uid = SESSION.user.uid; MN.data = null; }
    const { data, error } = await SB.rpc('manual_data');
    if (error) { console.warn('매뉴얼 불러오기 실패', error); return null; }
    MN.data = data; return data;
  }

  /* ---------- 메뉴: '매뉴얼 관리' (준비중 → 사용) ---------- */
  const renderSideMn = renderSide;
  renderSide = function(active){
    renderSideMn(active);
    const nav = document.querySelector('#side .nav-items'); if (!nav) return;
    nav.querySelectorAll('.js-mn-menu').forEach(e => e.remove());
    const open = !!PAGES[active];
    const html = `<button class="cat js-mn-menu ${open ? 'open' : ''}" onclick="const on=this.classList.toggle('open');this.nextElementSibling.classList.toggle('open',on)">${ic('book')}매뉴얼 관리${ic('chevron').replace('class="icon"', 'class="icon ar"')}</button><div class="sub js-mn-menu ${open ? 'open' : ''}">${Object.entries(PAGES).map(([k, v]) => `<a role="button" tabindex="0" class="${k === active ? 'on' : ''}" onclick="go('${k}')">${v[1]}</a>`).join('')}</div>`;
    const soon = nav.querySelector('.nav-soon-label');
    if (soon) soon.insertAdjacentHTML('beforebegin', html); else nav.insertAdjacentHTML('beforeend', html);
  };
  const goMn = go;
  go = function(p, t){
    if (p === 'soon' && t === '매뉴얼 관리') p = 'man-ops';
    if (PAGES[p]) {
      document.getElementById('nt-pop')?.remove();
      closeSide(); renderSide(p); window.__curPage = p; MN.kind = PAGES[p][0]; pageManual(p); window.scrollTo(0, 0); return;
    }
    return goMn(p, t);
  };

  /* ---------- 목록 화면 ---------- */
  function pageManual(p){
    const [, title, eye, desc] = PAGES[p];
    document.getElementById('main').innerHTML = simpleHero(['매뉴얼 관리', title], eye, title, desc) +
      `<section class="card" id="mn-usage-card" style="display:none"></section>
      <section class="card"><div class="bi-bar"><div class="bi-top"><input type="text" id="mn-q" placeholder="제목으로 찾기" value="${h(MN.f.q)}" oninput="mnQ(this.value)"><span id="mn-add"></span></div>
      <div class="bi-row" id="mn-chips"></div></div><div class="bi-cnt" id="mn-cnt"></div><div id="mn-list"><div class="bi-empty">불러오는 중...</div></div></section>` + pageFoot();
    if (MN.data) draw();
    load().then(d => { if (window.__curPage !== p) return; d ? draw() : (document.getElementById('mn-list').innerHTML = '<div class="bi-empty">매뉴얼을 불러오지 못했어요. 새로고침해 주세요.</div>'); });
  }
  let qT = 0;
  window.mnQ = v => { clearTimeout(qT); qT = setTimeout(() => { MN.f.q = v.trim(); draw(); }, 200); };
  window.mnBr = v => { MN.f.brand = v; draw(); };
  window.mnSort = v => { MN.f.sort = v; draw(); };
  function drawUsage(){
    const c = document.getElementById('mn-usage-card'); if (!c) return;
    const u = MN.data && MN.data.usage; if (!u) { c.style.display = 'none'; return; }
    const pct = Math.min(100, u.total / u.limit * 100);
    c.style.display = '';
    c.innerHTML = `<div class="mn-usage">${ic('layers')}<span>저장공간 <b>${kb(u.total)}</b> / ${kb(u.limit)}</span>
      <span class="bar"><i class="${pct >= 90 ? 'over' : pct >= 70 ? 'warn' : ''}" style="width:${Math.max(pct, 0.5)}%"></i></span>
      <small>매뉴얼 ${kb(u.manual)} · 공지 첨부 ${kb(u.notice)} · 상신 첨부 ${kb(u.approval || 0)} · 관리자만 보여요</small></div>`;
  }
  function draw(){
    const box = document.getElementById('mn-list'); if (!box || !MN.data) return;
    drawUsage();
    document.getElementById('mn-add').innerHTML = (MN.kind === 'doc' && window.apNew ? `<button class="btn ghost" onclick="apNew()">${ic('stamp')}작성해서 상신</button> ` : '') + (writer() ? `<button class="btn" onclick="mnEdit()">${ic('plus')}${MN.kind === 'doc' ? '서류 등록' : '매뉴얼 등록'}</button>` : '');
    const names = brNames();
    if (MN.f.brand && !names.includes(MN.f.brand)) MN.f.brand = '';
    document.getElementById('mn-chips').innerHTML = `<span>소속</span>` + [['', '전체'], ...names.map(x => [x, x])]
      .map(([v, t]) => `<button class="bi-c ${MN.f.brand === v ? 'on' : ''}" onclick="mnBr('${h(v)}')">${h(t)}</button>`).join('')
      + `<span class="mn-sort">${[['old', '오래된 순'], ['new', '최신 순']].map(([v, t]) => `<button class="bi-c ${MN.f.sort === v ? 'on' : ''}" onclick="mnSort('${v}')">${t}</button>`).join('')}</span>`;
    const q = MN.f.q.toLowerCase();
    const all = MN.data.list.filter(m => m.kind === MN.kind);
    const dir = MN.f.sort === 'new' ? -1 : 1;
    const list = all.filter(m => (!q || m.title.toLowerCase().includes(q)) && (!MN.f.brand || m.brands.includes(MN.f.brand)))
      .sort((a, b) => (!a.pub - !b.pub) || (a.pub && b.pub && a.pub !== b.pub ? (a.pub < b.pub ? -dir : dir) : 0) || a.title.localeCompare(b.title, 'ko'));
    document.getElementById('mn-cnt').textContent = `${list.length}건`;
    box.innerHTML = list.length ? `<div class="bi-list">${list.map(m => {
        const e = ext(m.name), cls = { hwp: 'hwp', hwpx: 'hwp', doc: 'doc', docx: 'doc', xls: 'xls', xlsx: 'xls' }[e] || '';
        return `<div class="mn-row"><span class="mn-ext ${cls}">${EXT_LAB(e)}</span>
        <div class="mn-main" role="button" tabindex="0" onclick="mnView(${m.id})" onkeydown="if(event.key==='Enter')mnView(${m.id})">
          <div class="mn-t"><span>${h(m.title)}</span><em class="mn-v">v${m.version}</em></div>
          ${m.pub ? `<div class="mn-pub">발행 ${pubTxt(m.pub)}</div>` : ''}
          ${m.descr ? `<div class="mn-d">${h(m.descr)}</div>` : ''}
          <div class="mn-br">${brSort(m.brands).map(b => `<em>${h(b)}</em>`).join('')}</div></div>
        <div class="mn-m">${m.at} 수정<br>${kb(m.size)}</div>
        <button class="bi-b" type="button" onclick="mnInfo(${m.id})">${writer() ? '관리' : '정보'}</button></div>`; }).join('')}</div>`
      : `<div class="bi-empty">${all.length ? '조건에 맞는 항목이 없어요.' : `등록된 ${KIND[MN.kind]}이 없어요.` + (writer() ? '<br>위의 등록 버튼으로 첫 파일을 올려보세요.' : '')}</div>`;
  }

  /* ---------- 열기 (PDF는 새 창, 그 외는 내려받기) ---------- */
  async function openFile(f){
    if (!f) return;
    const dl = ext(f.name) !== 'pdf';
    const w = dl ? null : window.open('', '_blank');
    try {
      const { data, error } = await SB.storage.from(BUCKET).createSignedUrl(f.path, 600, dl ? { download: f.name } : undefined);
      if (error) throw error;
      if (w) w.location.href = data.signedUrl; else location.href = data.signedUrl;
    } catch (e) { w && w.close(); toast('파일을 열지 못했어요: ' + (e.message || e)); }
  }
  async function getOne(id){
    const { data, error } = await SB.rpc('manual_open', { p_id: id });
    if (error) { toast(error.message); await load(); draw(); return null; }
    return data;
  }
  window.mnView = async function(id){ const m = await getOne(id); if (m) openFile(m.file); };
  window.mnOld = i => openFile(MN.cur && MN.cur.olds[i] && MN.cur.olds[i].file);

  /* ---------- 정보 · 관리 ---------- */
  window.mnInfo = async function(id){
    const m = await getOne(id); if (!m) return;
    MN.cur = m;
    const isPdf = ext(m.file.name) === 'pdf';
    iModal(m.title, `<div class="mn-meta">
        <span>분류</span><span>${KIND[m.kind]}</span>
        <span>소속</span><span>${brSort(m.brands).map(h).join(', ')}</span>
        <span>발행일</span><span>${m.pub ? pubTxt(m.pub) : '<span style="color:#9aa38f">미입력</span>'}</span>
        <span>현재 버전</span><span>v${m.version} · ${h(m.at)} · ${h(m.by)}</span>
        <span>파일</span><span>${h(m.file.name)} (${kb(m.file.size || 0)})</span>
        <span>처음 등록</span><span>${h(m.made)}</span>
        ${m.descr ? `<span>설명</span><span style="white-space:pre-wrap">${h(m.descr)}</span>` : ''}
      </div>
      <button class="bi-b mn-open" type="button" onclick="mnView(${m.id})">${ic(isPdf ? 'file' : 'download')}${isPdf ? '열기' : '내려받기'}</button>
      ${m.kind === 'doc' && window.apNew ? `<button class="bi-b mn-open" type="button" style="margin-top:6px" onclick="apNew(${m.id})">${ic('stamp')}이 양식으로 상신</button>` : ''}
      ${m.olds.length ? `<div class="mn-olds"><b>이전 버전 (최근 3개까지 보관)</b>${m.olds.map((o, i) => `<button type="button" onclick="mnOld(${i})"><em class="mn-v">v${o.version}</em><span>${h(o.file.name)}</span><small>${h(o.at)} · ${h(o.by)}</small></button>`).join('')}</div>` : ''}`,
      closeM, '닫기');
    const foot = document.querySelector('#inv-modal .im-foot');
    foot.querySelector('.btn.ghost')?.remove();
    if (writer()) foot.insertAdjacentHTML('afterbegin', `<div class="mn-foot-l"><button class="btn ghost" onclick="mnEdit(${m.id},true)">새 버전 올리기</button><button class="btn ghost" onclick="mnEdit(${m.id})">정보 수정</button>${admin() ? `<button class="btn ghost" style="color:#a3262c" onclick="mnDel(${m.id})">삭제</button>` : ''}</div>`);
  };

  /* ---------- 등록 · 정보 수정 · 새 버전 ---------- */
  let ED = null;
  window.mnEdit = function(id, newVer){
    if (!writer()) return toast('관리자·본사 계정만 올릴 수 있어요.');
    const m = id && MN.cur && MN.cur.id === id ? MN.cur : { kind: MN.kind, title: '', brands: [], descr: '', pub: '' };
    ED = { id: id || '', newVer: !!newVer, file: null, kind: m.kind };
    const names = brNames(), list = [...names, ...m.brands.filter(x => !names.includes(x))];
    const fileF = `<div class="f wide"><label>${id ? '새 파일' : '파일'} <span id="mn-fhelp"></span></label>
        <input type="file" id="mn-file" onchange="mnPick(this)"><div id="mn-pick"></div>
        ${id ? `<div class="bi-help">올리면 v${MN.cur.version + 1}이 되고, 지금 파일(v${MN.cur.version})은 이전 버전으로 보관돼요. 이전 버전은 최근 3개까지만 남아요.</div>` : ''}</div>`;
    const infoF = `<div class="f wide"><label>제목</label><input id="mn-title" maxlength="100" value="${h(m.title)}" placeholder="예) 오픈·마감 체크리스트"></div>
      <div class="f"><label>발행일 <span>목록이 이 날짜 순서로 정렬돼요</span></label><input type="date" id="mn-pub" value="${h(m.pub || '')}"></div>
      <div class="f"><label>분류</label><select id="mn-kind" onchange="mnKind(this.value)">${Object.entries(KIND).map(([k, t]) => `<option value="${k}" ${k === m.kind ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="f wide"><label>소속 <span>여러 개 고를 수 있어요</span></label><div class="bi-brs">${list.map(n => `<label class="bi-chk"><input type="checkbox" name="mn-br" value="${h(n)}" ${m.brands.includes(n) ? 'checked' : ''}>${h(n)}</label>`).join('')}</div></div>
      <div class="f wide"><label>설명 <span>선택 · 500자 이내</span></label><textarea id="mn-descr" maxlength="500" placeholder="예) 2026년 11월 개정 — 마감 청소 항목 추가">${h(m.descr)}</textarea></div>`;
    iModal(newVer ? `새 버전 올리기 · ${m.title}` : id ? '정보 수정' : (MN.kind === 'doc' ? '서류 등록' : '매뉴얼 등록'),
      `<div class="im-grid">${newVer ? fileF : id ? infoF : infoF + fileF}</div>`, save, newVer ? '올리기' : id ? '수정' : '등록');
    mnKind(m.kind);
  };
  window.mnKind = function(k){
    ED.kind = k;
    const hp = document.getElementById('mn-fhelp'), inp = document.getElementById('mn-file');
    if (hp) hp.textContent = (k === 'doc' ? 'PDF·한글·워드·엑셀' : 'PDF만') + ' · 20MB 이하';
    if (inp) inp.accept = OK[k].map(e => '.' + e).join(',');
    if (ED.file && !OK[k].includes(ext(ED.file.name))) { ED.file = null; drawPick(); toast('고른 파일이 이 분류에 맞지 않아 뺐어요.'); }
  };
  function drawPick(){
    const b = document.getElementById('mn-pick'); if (!b) return;
    b.innerHTML = ED.file ? `<div class="mn-pick">${ic('file')}<span>${h(ED.file.name)}</span><small>${kb(ED.file.size)}</small></div>` : '';
  }
  window.mnPick = function(inp){
    const f = inp.files[0]; inp.value = '';
    if (!f) return;
    if (!OK[ED.kind].includes(ext(f.name))) return toast(ED.kind === 'doc' ? 'PDF·한글·워드·엑셀 파일만 올릴 수 있어요.' : '운영·조리 매뉴얼은 PDF만 올릴 수 있어요.');
    if (f.size > MAXB) return toast(`'${f.name}'이 20MB를 넘어요. PDF 용량을 줄여서 올려주세요.`);
    ED.file = f; drawPick();
  };
  async function save(){
    const cur = ED.id ? MN.cur : null;
    const p = ED.newVer
      ? { id: ED.id, kind: cur.kind, title: cur.title, brands: cur.brands, descr: cur.descr, pub: cur.pub || '' }
      : { id: ED.id, kind: document.getElementById('mn-kind').value, title: document.getElementById('mn-title').value.trim(),
          brands: [...document.querySelectorAll('input[name=mn-br]:checked')].map(i => i.value), descr: document.getElementById('mn-descr').value.trim(),
          pub: document.getElementById('mn-pub').value };
    if (!p.title) return toast('제목을 입력해주세요.');
    if (!p.brands.length) return toast('소속을 하나 이상 골라주세요.');
    const needFile = !ED.id || ED.newVer;
    if (needFile && !ED.file) return toast('파일을 골라주세요.');
    const btn = document.getElementById('im-save'), lab = btn.textContent;
    btn.disabled = true; btn.textContent = ED.file ? '파일 올리는 중...' : '저장 중...';
    let up = null;
    try {
      if (ED.file) {
        const e = ext(ED.file.name), path = `${p.kind}/${uid4()}.${e}`;
        const { error } = await SB.storage.from(BUCKET).upload(path, ED.file, { contentType: ED.file.type || MIME[e], upsert: false });
        if (error) throw new Error(`파일 올리기 실패 (${error.message})`);
        up = { path, name: ED.file.name, size: ED.file.size, type: ED.file.type || MIME[e] };
        p.file = up;
      }
      btn.textContent = '저장 중...';
      const { data: r, error } = await SB.rpc('manual_save', { p });
      if (error) throw error;
      if (r.removed && r.removed.length) await SB.storage.from(BUCKET).remove(r.removed.map(f => f.path));
      closeM(); toast(ED.newVer ? '새 버전을 올렸어요.' : ED.id ? '정보를 수정했어요.' : '등록했어요.');
      await load(); draw();
      if (ED.id) mnInfo(r.id);
    } catch (e) {
      if (up) SB.storage.from(BUCKET).remove([up.path]);
      btn.disabled = false; btn.textContent = lab; toast('저장 실패: ' + (e.message || e));
    }
  }
  window.mnDel = async function(id){
    if (!confirm('이 항목을 삭제할까요? 이전 버전 파일까지 모두 지워지고 되돌릴 수 없어요.')) return;
    const { data: files, error } = await SB.rpc('manual_delete', { p_id: id });
    if (error) return toast('삭제 실패: ' + error.message);
    if (files && files.length) await SB.storage.from(BUCKET).remove(files.map(f => f.path));
    closeM(); toast('삭제했어요.');
    await load(); draw();
  };
})();
