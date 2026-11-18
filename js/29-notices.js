
/* ==========================================================
   공지사항 (2026-11-03) — 본사 공지 (직영점 대상)
   - 작성·필독 지정: 관리자·본사 / 수정·삭제: 관리자(전체) + 작성자 본인 / 보기: 모든 계정
   - 열면 자동 읽음 처리, 본사 계정(관리자·일반)은 읽음 현황 확인
   - 첨부: Supabase Storage 'notice-files' (비공개, 5개·개당 10MB)
   - 대시보드 맨 위 '본사 공지' 칸 + 상단 🔔 알림(안 읽은 공지)
   ========================================================== */
(function(){
  PATHS.bell = 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0';
  PATHS.pin = 'M12 17v5 M9 10.8V5h6v5.8l2 3.2v1H7v-1z';
  PATHS.clip = 'M21 11.5 12.5 20a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L10.2 17.7a1.7 1.7 0 0 1-2.4-2.4L15.5 7.6';
  PATHS.plus = PATHS.plus || 'M12 5v14 M5 12h14';
  const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NT = { data: null, uid: '', f: { q: '', mode: '' }, busy: false };
  const BUCKET = 'notice-files', MAXF = 5, MAXB = 10 * 1024 * 1024;
  const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  const ext = n => (String(n).split('.').pop() || '').toLowerCase();
  const isImg = f => /^image\//.test(f.type || MIME[ext(f.name)] || '');
  const kb = b => b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB';
  const canW = () => !!(SESSION.user && (SESSION.user.role === 'admin' || SESSION.user.role === 'hq'));
  const closeM = () => document.getElementById('inv-modal')?.remove();
  // 본문: 줄바꿈 유지, **굵게**, 주소는 링크
  const fmt = t => h(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

  /* ---------- 스타일 ---------- */
  const st = document.createElement('style');
  st.textContent = `
  .nt-bell{position:relative;border:0;background:none;color:#4f584a;padding:7px;cursor:pointer;display:grid;place-items:center}
  .nt-bell .icon{width:20px;height:20px}
  .nt-bell i{position:absolute;top:2px;right:0;min-width:16px;height:16px;padding:0 4px;box-sizing:border-box;border-radius:999px;background:#c62429;color:#fff;font-size:10px;font-style:normal;font-weight:700;display:grid;place-items:center;line-height:1}
  .nt-pop{position:fixed;top:62px;right:16px;width:min(340px,calc(100vw - 24px));background:#fff;border:1px solid #e3e6dd;border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.16);z-index:8000;overflow:hidden}
  .nt-pop .hd{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #eef0e8;font-size:13px;font-weight:600;color:#2d3726}
  .nt-pop .hd small{font-size:11px;font-weight:400;color:#8b9381}
  .nt-pop button.it{display:grid;grid-template-columns:8px minmax(0,1fr);gap:4px 10px;width:100%;text-align:left;border:0;border-bottom:1px solid #f2f3ee;background:#fff;padding:11px 14px;cursor:pointer}
  .nt-pop button.it:hover{background:#fafbf7}
  .nt-pop .dot{width:7px;height:7px;border-radius:50%;background:#c62429;margin-top:6px}
  .nt-pop .dot.no{background:transparent}
  .nt-pop .t{font-size:13px;color:#222b1e;font-weight:500;line-height:1.45}
  .nt-pop .s{grid-column:2;font-size:11px;color:#8b9381}
  .nt-pop .ft{display:block;width:100%;border:0;background:#f6f7f3;color:#3f4839;font-size:12px;padding:11px;cursor:pointer}
  .nt-pop .em{padding:22px 14px;text-align:center;font-size:12px;color:#909b84}
  .sub a .mm-sub-badge,.mm-fly-l a .mm-sub-badge{position:absolute;right:10px;top:50%;transform:translateY(-50%);margin:0}
  .mm-fly-l a{position:relative}
  .nt-badge{margin-left:auto;min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;border-radius:999px;background:#c62429;color:#fff;font-size:10px;font-weight:700;display:grid;place-items:center}
  .nt-row{display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:4px 10px;align-items:center;border-top:1px solid var(--line);padding:14px 4px;cursor:pointer}
  .nt-row:first-child{border-top:0}
  .nt-row:hover{background:#fafbf7}
  .nt-row .dot{width:7px;height:7px;border-radius:50%;background:#c62429}
  .nt-row .dot.no{background:transparent}
  .nt-row .t{font-size:14px;color:#222b1e;font-weight:500;display:flex;align-items:center;gap:6px;min-width:0}
  .nt-row .t span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .nt-row.read .t{color:#5f6858;font-weight:400}
  .nt-row .m{font-size:12px;color:#8b9381;white-space:nowrap;display:flex;align-items:center;gap:8px}
  .nt-row .m .icon{width:13px;height:13px;vertical-align:-2px}
  .nt-pin{flex:none;font-size:11px;font-weight:600;padding:2px 7px;border-radius:6px;background:#fbeeee;color:#a3262c}
  .nt-row.pinned{background:#fdf8f7}
  .nt-meta{font-size:12px;color:#8b9381;margin:-4px 0 14px}
  .nt-body{font-size:14px;line-height:1.75;color:#2d3726;white-space:pre-wrap;word-break:break-word}
  .nt-body a{color:#4f6b3b}
  .nt-imgs{display:flex;flex-direction:column;gap:10px;margin-top:14px}
  .nt-imgs img{max-width:100%;border-radius:8px;border:1px solid #eceee7}
  .nt-files{display:flex;flex-direction:column;gap:6px;margin-top:16px;padding-top:14px;border-top:1px dashed var(--line)}
  .nt-files .bi-b{justify-content:flex-start;padding:9px 12px;font-size:13px;white-space:normal;text-align:left}
  .nt-files .bi-b small{margin-left:auto;color:#8b9381;font-size:11px}
  .nt-reads{margin-top:16px;padding-top:14px;border-top:1px dashed var(--line);font-size:12px}
  .nt-reads b{display:block;font-size:13px;color:#2d3726;margin-bottom:8px}
  .nt-reads div{display:flex;justify-content:space-between;padding:5px 0;color:#4a5244}
  .nt-reads div.no span:last-child{color:#a3262c}
  .nt-flist{display:flex;flex-direction:column;gap:6px;margin-top:6px}
  .nt-flist div{display:flex;align-items:center;gap:8px;font-size:13px;color:#3f4839;background:#f6f7f3;border-radius:8px;padding:8px 10px}
  .nt-flist div span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .nt-flist div small{color:#8b9381}
  .nt-flist button{border:0;background:none;color:#a3262c;cursor:pointer;font-size:12px}
  .im-grid textarea.nt-ta{min-height:220px}
  .nt-foot-l{margin-right:auto;display:flex;gap:6px}
  .src.hq{background:#fbeeee;color:#a3262c}
  .nt-dash .ns-row{grid-template-columns:42px minmax(0,1fr) auto;cursor:pointer}
  .nt-dash .ns-row:hover .ns-title{color:#c62429}
  .nt-dash .ns-title{display:flex;align-items:center;gap:6px}
  .nt-dash .ns-title span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .nt-dash .ns-new{color:#c62429;font-weight:700}
  .nt-dash .ns-h a{cursor:pointer}
  .nt-dash .ns-empty{font-size:12px;color:#909b84;padding:8px 0}
  @media(max-width:580px){.nt-dash .ns-row{grid-template-columns:38px minmax(0,1fr)}.nt-row{grid-template-columns:10px minmax(0,1fr)}.nt-row .m{grid-column:2}.nt-pop{top:58px;right:8px}}`;
  document.head.appendChild(st);

  /* ---------- 데이터 ---------- */
  async function loadNotice(){
    if (!SESSION.user || SESSION.mustChange || !window.SB) return null;
    if (NT.uid !== SESSION.user.uid) { NT.uid = SESSION.user.uid; NT.data = null; }
    try {
      const { data, error } = await SB.rpc('notice_data');
      if (error) throw error;
      NT.data = data; drawBell(); drawSideBadge(); return data;
    } catch (e) { console.warn('공지 불러오기 실패', e); return null; }
  }
  window.ntLoad = loadNotice;
  function markRead(id){
    const n = NT.data && NT.data.list.find(x => x.id === id);
    if (n && !n.read) { n.read = true; NT.data.unread = Math.max(0, NT.data.unread - 1); }
    drawBell(); drawSideBadge(); drawDash();
    if (window.__curPage === 'notice') drawList();
  }

  /* ---------- 상단 🔔 알림 ---------- */
  function drawBell(){
    const u = document.querySelector('.top .user'); if (!u) return;
    let b = document.getElementById('nt-bell');
    if (!b) {
      u.insertAdjacentHTML('afterbegin', `<button class="nt-bell" id="nt-bell" type="button" aria-label="알림" onclick="ntPop(event)">${ic('bell')}</button>`);
      b = document.getElementById('nt-bell');
    }
    const n = ((NT.data && NT.data.unread) || 0) + (window.apAlert ? window.apAlert().count : 0);
    b.querySelector('i')?.remove();
    if (n) b.insertAdjacentHTML('beforeend', `<i>${n > 99 ? '99+' : n}</i>`);
    b.setAttribute('aria-label', n ? `알림 ${n}건` : '알림');
  }
  window.ntBell = () => drawBell();
  window.ntPop = function(e){
    e && e.stopPropagation();
    const old = document.getElementById('nt-pop'); if (old) return old.remove();
    const D = NT.data || { list: [], unread: 0 };
    const un = D.list.filter(x => !x.read).slice(0, 5);
    const p = document.createElement('div'); p.className = 'nt-pop'; p.id = 'nt-pop';
    p.innerHTML = `<div class="hd">알림<small>${D.unread ? `안 읽은 공지 ${D.unread}건` : ''}</small></div>` +
      (window.apAlert ? window.apAlert().html : '') + (un.length ? un.map(n => `<button class="it" type="button" onclick="document.getElementById('nt-pop').remove();ntOpen(${n.id})"><span class="dot"></span><span class="t">${n.pinned ? '<span class="nt-pin">필독</span> ' : ''}새 공지 · ${h(n.title)}</span><span class="s">${n.at}</span></button>`).join('')
        : (window.apAlert && window.apAlert().count ? '' : '<div class="em">새 알림이 없어요.</div>')) +
      `<button class="ft" type="button" onclick="document.getElementById('nt-pop').remove();go('notice')">공지사항 전체 보기</button>` +
      `<button class="ft" type="button" onclick="document.getElementById('nt-pop').remove();pushSettings()">휴대폰 알림 설정</button>`;
    document.body.appendChild(p);
  };
  document.addEventListener('click', e => { const p = document.getElementById('nt-pop'); if (p && !p.contains(e.target)) p.remove(); });

  /* ---------- 메뉴: 대시보드 바로 아래 '공지사항' ---------- */
  function drawSideBadge(){
    const b = document.querySelector('#side .js-nt-menu'); if (!b) return;
    b.querySelector('.nt-badge')?.remove();
    const n = (NT.data && NT.data.unread) || 0;
    if (n) b.insertAdjacentHTML('beforeend', `<span class="nt-badge">${n > 99 ? '99+' : n}</span>`);
  }
  const renderSideNt = renderSide;
  renderSide = function(active){
    renderSideNt(active);
    const nav = document.querySelector('#side .nav-items'); if (!nav) return;
    nav.querySelectorAll('.js-nt-menu').forEach(e => e.remove());
    const html = `<button class="cat js-nt-menu ${active === 'notice' ? 'open' : ''}" onclick="go('notice')">${ic('bell')}공지사항</button>`;
    const dash = nav.querySelector(':scope > .cat[onclick*="go(\'dash\')"]');
    if (dash) dash.insertAdjacentHTML('afterend', html); else nav.insertAdjacentHTML('afterbegin', html);
    drawSideBadge();
  };
  const goNt = go;
  go = function(p, t){
    document.getElementById('nt-pop')?.remove();
    if (p === 'notice') {
      closeSide(); renderSide('notice'); window.__curPage = 'notice'; pageNotice(); window.scrollTo(0, 0); return;
    }
    const r = goNt(p, t);
    if (p === 'dash') loadNotice().then(drawDash);
    return r;
  };

  /* ---------- 공지사항 페이지 ---------- */
  function pageNotice(){
    document.getElementById('main').innerHTML = simpleHero(['공지사항'], 'NOTICE', '공지사항', '본사가 직영점에 전하는 공지예요. 필독 공지는 맨 위에 고정돼요.') +
      `<section class="card"><div class="bi-bar"><div class="bi-top"><input type="text" id="nt-q" placeholder="제목으로 찾기" value="${h(NT.f.q)}" oninput="ntQ(this.value)">${canW() ? `<button class="btn" onclick="ntEdit()">${ic('plus')}공지 작성</button>` : ''}</div>
      <div class="bi-row" id="nt-chips"></div></div><div class="bi-cnt" id="nt-cnt"></div><div id="nt-list"><div class="bi-empty">불러오는 중...</div></div></section>` + pageFoot();
    if (NT.data) drawList();
    loadNotice().then(d => { if (window.__curPage === 'notice') d ? drawList() : (document.getElementById('nt-list').innerHTML = '<div class="bi-empty">공지를 불러오지 못했어요. 새로고침해 주세요.</div>'); });
  }
  let qT = 0;
  window.ntQ = v => { clearTimeout(qT); qT = setTimeout(() => { NT.f.q = v.trim(); drawList(); }, 200); };
  window.ntMode = m => { NT.f.mode = m; drawList(); };
  function drawList(){
    const box = document.getElementById('nt-list'); if (!box || !NT.data) return;
    const all = NT.data.list, q = NT.f.q.toLowerCase();
    const list = all.filter(n => (!q || n.title.toLowerCase().includes(q)) && (NT.f.mode !== 'pin' || n.pinned) && (NT.f.mode !== 'new' || !n.read));
    document.getElementById('nt-chips').innerHTML = [['', '전체'], ['pin', '필독'], ['new', `안 읽은 공지${NT.data.unread ? ' ' + NT.data.unread : ''}`]]
      .map(([v, t]) => `<button class="bi-c ${NT.f.mode === v ? 'on' : ''}" onclick="ntMode('${v}')">${t}</button>`).join('');
    document.getElementById('nt-cnt').textContent = `${list.length}건`;
    box.innerHTML = list.length ? `<div class="bi-list">${list.map(n => `<div class="nt-row ${n.read ? 'read' : ''} ${n.pinned ? 'pinned' : ''}" role="button" tabindex="0" onclick="ntOpen(${n.id})">
        <span class="dot ${n.read ? 'no' : ''}" title="${n.read ? '' : '안 읽음'}"></span>
        <div class="t">${n.pinned ? '<em class="nt-pin">필독</em>' : ''}<span>${h(n.title)}</span></div>
        <div class="m">${n.files ? `<span>${ic('clip')}${n.files}</span>` : ''}<span>${n.at}</span></div></div>`).join('')}</div>`
      : `<div class="bi-empty">${all.length ? '조건에 맞는 공지가 없어요.' : '등록된 공지가 없어요.' + (canW() ? '<br>[공지 작성]으로 첫 공지를 올려보세요.' : '')}</div>`;
  }

  /* ---------- 공지 보기 ---------- */
  async function signed(path, name, dl){
    const { data, error } = await SB.storage.from(BUCKET).createSignedUrl(path, 600, dl ? { download: name } : undefined);
    if (error) throw error; return data.signedUrl;
  }
  window.ntFile = async function(i){
    const f = (NT.cur && NT.cur.files || [])[i]; if (!f) return;
    const dl = !(/pdf$/i.test(f.type) || isImg(f));
    const w = window.open('', '_blank');
    try { const u = await signed(f.path, f.name, dl); if (w) w.location.href = u; else location.href = u; }
    catch (e) { w && w.close(); toast('파일을 열지 못했어요: ' + e.message); }
  };
  window.ntOpen = async function(id){
    toast('공지를 여는 중이에요...');
    const { data: n, error } = await SB.rpc('notice_open', { p_id: id });
    document.querySelector('.toast')?.remove();
    if (error) { toast(error.message); return loadNotice().then(() => { drawList(); drawDash(); }); }
    NT.cur = n; markRead(id);
    const files = n.files || [], imgs = files.map((f, i) => [f, i]).filter(([f]) => isImg(f));
    const reads = n.reads;
    const done = reads ? reads.filter(r => r.at).length : 0;
    iModal(n.title, `<div class="nt-meta">${n.pinned ? '<span class="nt-pin">필독</span> ' : ''}${h(n.at)} · ${h(n.by)}${n.upd ? ` · ${h(n.upd)} 수정` : ''}</div>
      <div class="nt-body">${fmt(n.body) || '<span style="color:#909b84">본문 없음</span>'}</div>
      ${imgs.length ? `<div class="nt-imgs" id="nt-imgs">${imgs.map(([f, i]) => `<img data-i="${i}" alt="${h(f.name)}" onclick="ntFile(${i})">`).join('')}</div>` : ''}
      ${files.length ? `<div class="nt-files">${files.map((f, i) => `<button class="bi-b" type="button" onclick="ntFile(${i})">${ic('clip')}<span>${h(f.name)}</span><small>${kb(f.size || 0)}</small></button>`).join('')}</div>` : ''}
      ${reads ? `<div class="nt-reads"><b>읽음 현황 ${done} / ${reads.length}</b>${reads.map(r => `<div class="${r.at ? '' : 'no'}"><span>${h(r.name)}</span><span>${r.at ? h(r.at) : '안 읽음'}</span></div>`).join('')}</div>` : ''}`,
      closeM, '확인');
    const foot = document.querySelector('#inv-modal .im-foot');
    foot.querySelector('.btn.ghost')?.remove();
    if (n.canEdit) foot.insertAdjacentHTML('afterbegin', `<div class="nt-foot-l"><button class="btn ghost" onclick="ntEdit(${n.id})">수정</button><button class="btn ghost" style="color:#a3262c" onclick="ntDel(${n.id})">삭제</button></div>`);
    imgs.forEach(async ([f, i]) => { try { const u = await signed(f.path); const el = document.querySelector(`#nt-imgs img[data-i="${i}"]`); if (el) el.src = u; } catch (e) {} });
  };

  /* ---------- 공지 작성 · 수정 (관리자·본사, 수정은 작성자 본인 또는 관리자) ---------- */
  let ED = null;
  window.ntEdit = function(id){
    if (!canW()) return toast('공지는 관리자·본사 계정만 쓸 수 있어요.');
    const n = id && NT.cur && NT.cur.id === id ? NT.cur : { title: '', body: '', pinned: false, files: [] };
    ED = { id: id || '', keep: [...(n.files || [])], removed: [], add: [] };
    iModal(id ? '공지 수정' : '공지 작성', `<div class="im-grid">
      <div class="f wide"><label>제목</label><input id="nt-title" maxlength="100" value="${h(n.title)}" placeholder="예) 11월 위생 점검 일정 안내"></div>
      <div class="f wide"><label>본문</label><textarea id="nt-text" class="nt-ta" placeholder="내용을 입력하세요">${h(n.body)}</textarea><div class="bi-help">**굵게** 처럼 별표 두 개로 감싸면 굵게 보여요. 인터넷 주소는 자동으로 링크가 돼요.</div></div>
      <div class="f wide"><label class="bi-chk"><input type="checkbox" id="nt-pin" ${n.pinned ? 'checked' : ''}>필독 공지 (목록·대시보드 맨 위에 고정)</label></div>
      <div class="f wide"><label>첨부 파일 <span>최대 ${MAXF}개 · 개당 10MB · PDF·이미지·엑셀</span></label>
        <input type="file" id="nt-file" multiple accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.xls,.xlsx" onchange="ntAddFiles(this)">
        <div class="nt-flist" id="nt-flist"></div></div>
    </div>`, ntSave, id ? '수정' : '등록');
    drawFiles();
  };
  function drawFiles(){
    const box = document.getElementById('nt-flist'); if (!box) return;
    box.innerHTML = ED.keep.map((f, i) => `<div>${ic('clip')}<span>${h(f.name)}</span><small>${kb(f.size || 0)}</small><button type="button" onclick="ntRmFile('keep',${i})">빼기</button></div>`).join('') +
      ED.add.map((f, i) => `<div>${ic('clip')}<span>${h(f.name)}</span><small>${kb(f.size)} · 새 파일</small><button type="button" onclick="ntRmFile('add',${i})">빼기</button></div>`).join('');
  }
  window.ntAddFiles = function(inp){
    for (const f of inp.files) {
      if (ED.keep.length + ED.add.length >= MAXF) { toast(`첨부는 ${MAXF}개까지예요.`); break; }
      if (!MIME[ext(f.name)]) { toast(`'${f.name}'은 올릴 수 없는 형식이에요.`); continue; }
      if (f.size > MAXB) { toast(`'${f.name}'이 10MB를 넘어요.`); continue; }
      ED.add.push(f);
    }
    inp.value = ''; drawFiles();
  };
  window.ntRmFile = function(k, i){ if (k === 'keep') ED.removed.push(...ED.keep.splice(i, 1)); else ED.add.splice(i, 1); drawFiles(); };
  const uid4 = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  async function ntSave(){
    const title = document.getElementById('nt-title').value.trim(), body = document.getElementById('nt-text').value.replace(/\s+$/, ''), pinned = document.getElementById('nt-pin').checked;
    if (!title) return toast('제목을 입력해주세요.');
    const btn = document.getElementById('im-save'), lab = btn.textContent;
    btn.disabled = true; btn.textContent = ED.add.length ? '파일 올리는 중...' : '저장 중...';
    const up = [];
    try {
      for (const f of ED.add) {
        const e = ext(f.name), path = `${new Date().getFullYear()}/${uid4()}.${e}`;
        const { error } = await SB.storage.from(BUCKET).upload(path, f, { contentType: f.type || MIME[e], upsert: false });
        if (error) throw new Error(`'${f.name}' 올리기 실패 (${error.message})`);
        up.push({ path, name: f.name, size: f.size, type: f.type || MIME[e] });
      }
      btn.textContent = '저장 중...';
      const { data: nid, error } = await SB.rpc('notice_save', { p: { id: ED.id, title, body, pinned, files: [...ED.keep, ...up] } });
      if (error) throw error;
      if (ED.removed.length) await SB.storage.from(BUCKET).remove(ED.removed.map(f => f.path));
      closeM(); toast(ED.id ? '공지를 수정했어요.' : '공지를 등록했어요.');
      await loadNotice(); drawList(); drawDash();
      if (ED.id) ntOpen(nid);
    } catch (e) {
      if (up.length) SB.storage.from(BUCKET).remove(up.map(f => f.path));
      btn.disabled = false; btn.textContent = lab; toast('저장 실패: ' + (e.message || e));
    }
  }
  window.ntDel = async function(id){
    if (!confirm('이 공지를 삭제할까요? 첨부 파일과 읽음 기록도 함께 지워져요.')) return;
    const { data: files, error } = await SB.rpc('notice_delete', { p_id: id });
    if (error) return toast('삭제 실패: ' + error.message);
    if (files && files.length) await SB.storage.from(BUCKET).remove(files.map(f => f.path));
    closeM(); toast('공지를 삭제했어요.');
    await loadNotice(); drawList(); drawDash();
  };

  /* ---------- 대시보드: 맨 위 '본사 공지' 칸 ---------- */
  function dashHtml(){
    const D = NT.data;
    const rows = !D ? '<div class="ns-empty">불러오는 중...</div>'
      : !D.list.length ? '<div class="ns-empty">등록된 본사 공지가 없어요.</div>'
      : D.list.slice(0, 3).map(n => `<div class="ns-row" role="button" tabindex="0" onclick="ntOpen(${n.id})"><span class="ns-date">${n.at.slice(5)}</span><span class="ns-title">${n.pinned ? '<em class="nt-pin">필독</em>' : ''}<span>${h(n.title)}</span></span><span class="ns-meta">${n.read ? (n.files ? '첨부 ' + n.files : '') : '<b class="ns-new">안 읽음</b>'}</span></div>`).join('');
    return `<section class="notice-strip wide nt-dash" id="nt-dash-box"><div class="ns-h">${ic('bell')}<b>본사 공지</b><a onclick="go('notice')">공지사항 전체 ${ic('arrow')}</a></div>${rows}</section>`;
  }
  function drawDash(){ const b = document.getElementById('nt-dash-box'); if (b) b.outerHTML = dashHtml(); }
  const pageDashboardNt = pageDashboard;
  pageDashboard = function(){
    pageDashboardNt();
    const main = document.getElementById('main'); if (!main || document.getElementById('nt-dash-sec')) return;
    const secs = [...main.querySelectorAll('.dash-sec')];
    const s = document.createElement('section'); s.className = 'dash-sec'; s.id = 'nt-dash-sec';
    s.innerHTML = secHead('1', '본사 공지', { cls: 'hq', t: '본사' }, '필독 고정 · 최근 3건') + dashHtml();
    if (secs.length) {
      secs.forEach(x => { const n = x.querySelector('.sec-n'); if (n && /^\d+$/.test(n.textContent.trim())) n.textContent = +n.textContent + 1; });
      secs[0].before(s);
    } else (main.querySelector('.page-hero') || main.firstChild).after(s);
  };

  // 2분마다 새 공지 확인 (화면이 보일 때만)
  setInterval(() => { if (!document.hidden) loadNotice().then(() => { drawDash(); if (window.__curPage === 'notice' && !document.getElementById('inv-modal')) drawList(); }); }, 120000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadNotice().then(drawDash); });
})();
