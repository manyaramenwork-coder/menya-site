
/* ==========================================================
   프로필 사진 + 사이드바 접기 (2026-11-04 밤)
   - 사진: Supabase Storage 'avatars'(비공개, <uid>.jpg, 1MB·jpeg) + profiles.avatar_ver
           avatar_map() = {uid: 버전}, avatar_set(uid, 버전|null) — 본인 또는 관리자만
   - 화면에서 256px 정사각형 JPEG로 줄여서 올림
   - 보이는 곳: 상단 사용자, 사용자 관리 목록·편집·등록, 결재라인 선택·결재 단계·참조
   - 사이드바 접기: PC(861px 이상)만, 접으면 아이콘만 + 올리면 하위 메뉴, 상태는 이 기기에 기억
   ========================================================== */
(function(){
  const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const AV = { map: {}, url: {}, ver: {}, at: 0, busy: null, uid: '' };
  const BUCKET = 'avatars', SIZE = 256;
  const me = () => (typeof SESSION !== 'undefined' && SESSION.user) ? SESSION.user : null;
  const ini = n => (String(n || '?').trim() || '?')[0];

  /* ---------- 사진 그리기 ---------- */
  function inner(uid, name){
    const u = uid && AV.url[uid];
    return u ? `<img src="${h(u)}" alt="" loading="lazy" onerror="this.remove()">` : h(ini(name));
  }
  window.mmAv = function(uid, name, cls){
    return `<span class="mm-av ${cls || ''}" data-av="${h(uid || '')}" data-n="${h(name || '')}" aria-hidden="true">${inner(uid, name)}</span>`;
  };
  function paint(){
    document.querySelectorAll('[data-av]').forEach(el => {
      const uid = el.dataset.av; if (!uid) return;
      const want = AV.url[uid] || '';
      const img = el.querySelector('img');
      if (want && img && img.getAttribute('src') === want) return;
      if (!want && !img && el.textContent) return;
      el.innerHTML = inner(uid, el.dataset.n);
    });
  }
  window.mmAvPaint = paint;

  /* ---------- 사진 목록 불러오기 (서명 주소 12시간) ---------- */
  async function load(force){
    const u = me(); if (!u || !window.SB) return;
    if (AV.uid !== u.uid) { AV.uid = u.uid; AV.map = {}; AV.url = {}; AV.ver = {}; AV.at = 0; }
    if (!force && AV.at && Date.now() - AV.at < 6 * 3600e3) return paint();
    if (AV.busy) return AV.busy;
    AV.busy = (async () => {
      try {
        const { data, error } = await SB.rpc('avatar_map'); if (error) throw error;
        AV.map = data || {};
        for (const k of Object.keys(AV.url)) if (!AV.map[k]) { delete AV.url[k]; delete AV.ver[k]; }
        const need = Object.keys(AV.map).filter(k => force || AV.ver[k] !== AV.map[k] || !AV.url[k]);
        if (need.length) {
          const { data: s, error: e2 } = await SB.storage.from(BUCKET).createSignedUrls(need.map(k => k + '.jpg'), 12 * 3600);
          if (e2) throw e2;
          (s || []).forEach((r, i) => { const k = need[i]; if (r && r.signedUrl) { AV.url[k] = r.signedUrl; AV.ver[k] = AV.map[k]; } });
        }
        AV.at = Date.now();
      } catch (e) { console.warn('사진 불러오기 실패', e); }
      finally { AV.busy = null; paint(); }
    })();
    return AV.busy;
  }
  window.mmAvLoad = load;

  /* ---------- 사진 줄이기: 가운데 정사각형 256px JPEG ---------- */
  function shrink(file){
    return new Promise((ok, no) => {
      if (!file || !/^image\//.test(file.type || 'image/')) return no(new Error('사진 파일만 올릴 수 있어요.'));
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth, hh = img.naturalHeight, s = Math.min(w, hh);
          const c = document.createElement('canvas'); c.width = c.height = SIZE;
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, SIZE, SIZE);
          g.drawImage(img, (w - s) / 2, (hh - s) / 2, s, s, 0, 0, SIZE, SIZE);
          c.toBlob(b => { URL.revokeObjectURL(url); b ? ok(b) : no(new Error('사진을 바꾸지 못했어요.')); }, 'image/jpeg', 0.86);
        } catch (e) { URL.revokeObjectURL(url); no(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); no(new Error('이 사진은 열 수 없어요. 다른 사진(JPG·PNG)으로 해 주세요.')); };
      img.src = url;
    });
  }
  async function upload(uid, blob){
    const { error } = await SB.storage.from(BUCKET).upload(uid + '.jpg', blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
    if (error) throw new Error('사진을 올리지 못했어요. (' + error.message + ')');
    const r = await SB.rpc('avatar_set', { u: uid, ver: Date.now() }); if (r.error) throw r.error;
    delete AV.ver[uid]; await load(true);
  }
  async function remove(uid){
    const r = await SB.rpc('avatar_set', { u: uid, ver: null }); if (r.error) throw r.error;
    try { await SB.storage.from(BUCKET).remove([uid + '.jpg']); } catch (e) {}
    delete AV.url[uid]; delete AV.ver[uid]; await load(true);
  }

  /* ---------- 사진 바꾸기 창 (본인 또는 관리자) ---------- */
  let PICK = null;
  window.mmPhoto = function(uid, name){
    if (!uid || !window.SB) return;
    const u = me(); const admin = !!(u && u.role === 'admin');
    if (!u || (uid !== u.uid && !admin)) return toast('본인 사진만 바꿀 수 있어요.');
    PICK = { uid, name, blob: null, del: false };
    const has = !!AV.url[uid];
    iModal(uid === u.uid ? '내 사진' : name + '님 사진', `
      <div class="mm-ph">
        <div class="mm-ph-pre" id="mm-ph-pre">${mmAv(uid, name, 'xl')}</div>
        <p class="mm-ph-tip">얼굴이 가운데 오는 사진이 좋아요. 정사각형으로 잘라서 작게 저장돼요.</p>
        <div class="mm-ph-btns">
          <label class="btn ghost mm-ph-file">${ic('plus')}사진 고르기<input type="file" accept="image/*" onchange="mmPhotoFile(this)" hidden></label>
          <button type="button" class="btn ghost mm-ph-del" id="mm-ph-del" onclick="mmPhotoDel()" ${has ? '' : 'hidden'}>사진 지우기</button>
        </div>
        <div class="u-err" id="mm-ph-err" role="alert"></div>
      </div>`, mmPhotoSave, '저장');
    document.getElementById('im-save').disabled = true;
  };
  window.mmPhotoFile = async function(inp){
    const f = inp.files && inp.files[0]; inp.value = ''; if (!f || !PICK) return;
    const err = document.getElementById('mm-ph-err'); err.textContent = '';
    try {
      PICK.blob = await shrink(f); PICK.del = false;
      const pre = document.getElementById('mm-ph-pre');
      pre.innerHTML = `<span class="mm-av xl"><img src="${URL.createObjectURL(PICK.blob)}" alt=""></span>`;
      document.getElementById('mm-ph-del').hidden = false;
      document.getElementById('im-save').disabled = false;
    } catch (e) { err.textContent = e.message; }
  };
  window.mmPhotoDel = function(){
    if (!PICK) return;
    PICK.blob = null; PICK.del = !!AV.url[PICK.uid];
    document.getElementById('mm-ph-pre').innerHTML = `<span class="mm-av xl">${h(ini(PICK.name))}</span>`;
    document.getElementById('mm-ph-del').hidden = true;
    document.getElementById('im-save').disabled = !PICK.del;
  };
  async function mmPhotoSave(){
    if (!PICK) return;
    const b = document.getElementById('im-save'), err = document.getElementById('mm-ph-err');
    b.disabled = true; b.textContent = '저장 중...';
    try {
      if (PICK.blob) await upload(PICK.uid, PICK.blob); else if (PICK.del) await remove(PICK.uid);
      document.getElementById('inv-modal')?.remove();
      toast(PICK.blob ? '사진을 바꿨어요.' : '사진을 지웠어요.'); PICK = null;
    } catch (e) { err.textContent = e.message || String(e); b.disabled = false; b.textContent = '저장'; }
  }

  /* ---------- 상단 사용자: 사진 + 누르면 내 사진 바꾸기 ---------- */
  if (typeof setTopUser === 'function') {
    const base = setTopUser;
    setTopUser = function(u){
      base.apply(this, arguments);
      const a = document.querySelector('.top .av'); if (!a || !u) return;
      a.dataset.av = u.uid || ''; a.dataset.n = u.name || '';
      a.classList.add('mm-av-top'); a.setAttribute('role', 'button'); a.tabIndex = 0;
      a.title = '내 사진 바꾸기'; a.setAttribute('aria-label', '내 사진 바꾸기');
      a.onclick = () => { const m = me(); if (m) mmPhoto(m.uid, m.name); };
      a.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); a.onclick(); } };
      if (AV.url[u.uid]) a.innerHTML = inner(u.uid, u.name);
      load();
    };
  }
  // 이 코드보다 로그인 복원이 먼저 끝난 경우에도 상단 사진을 붙임
  try { if (me() && typeof setTopUser === 'function') setTopUser(me()); } catch (e) {}

  /* ---------- 사용자 등록·편집 화면에 사진 칸 ---------- */
  let NEWPIC = null;
  if (typeof userForm === 'function') {
    const base = userForm;
    userForm = function(u, mode){
      const html = base.apply(this, arguments);
      const row = mode === 'edit' && u
        ? `<div class="mm-avf">${mmAv(u.uid, u.name, 'lg')}<div><b>사진</b><small>목록·결재라인·상단에 보여요</small></div><button type="button" class="btn ghost" onclick="mmPhoto('${h(u.uid)}', this.closest('.modal').querySelector('#u-name').value || '${h(u.name)}')">사진 바꾸기</button></div>`
        : `<div class="mm-avf"><span class="mm-av lg" id="mm-new-av">?</span><div><b>사진 <span>선택</span></b><small>나중에 본인이 직접 바꿀 수도 있어요</small></div><label class="btn ghost">사진 고르기<input type="file" accept="image/*" onchange="mmNewPic(this)" hidden></label><button type="button" class="btn ghost" id="mm-new-del" onclick="mmNewPic(null)" hidden>빼기</button></div>`;
      if (mode !== 'edit') NEWPIC = null;
      return row + html;
    };
  }
  window.mmNewPic = async function(inp){
    const box = document.getElementById('mm-new-av'), del = document.getElementById('mm-new-del'); if (!box) return;
    if (!inp) { NEWPIC = null; box.textContent = (document.getElementById('u-name')?.value || '?')[0]; del.hidden = true; return; }
    const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
    try { NEWPIC = await shrink(f); box.innerHTML = `<img src="${URL.createObjectURL(NEWPIC)}" alt="">`; del.hidden = false; }
    catch (e) { const er = document.getElementById('u-err'); if (er) er.textContent = e.message; }
  };
  // 계정을 만든 직후 고른 사진 올리기 (실패해도 계정은 그대로)
  window.mmAvAfterCreate = async function(uid){
    if (!NEWPIC || !uid) return;
    const b = NEWPIC; NEWPIC = null;
    try { await upload(uid, b); } catch (e) { setTimeout(() => toast('계정은 만들었지만 사진은 못 올렸어요. 편집에서 다시 올려 주세요.'), 3200); }
  };

  /* ---------- 사이드바 접기 (PC) ---------- */
  const KEY = 'mm-side-col', wide = () => window.matchMedia('(min-width: 861px)').matches;
  let col = false; try { col = localStorage.getItem(KEY) === '1'; } catch (e) {}
  const top = document.querySelector('.top');
  if (top && !document.getElementById('mm-sidetog')) {
    top.insertAdjacentHTML('afterbegin', `<button class="mm-sidetog" id="mm-sidetog" type="button" onclick="mmSideToggle()"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z M9 5v14"/><path class="mm-st-ar" d="M15 10l-2 2 2 2"/></svg></button>`);
  }
  function applyCol(){
    document.body.classList.toggle('mm-col', col);
    const b = document.getElementById('mm-sidetog');
    if (b) { const t = col ? '메뉴 펼치기' : '메뉴 접기'; b.title = t; b.setAttribute('aria-label', t); b.setAttribute('aria-pressed', String(col)); }
    hideFly();
  }
  window.mmSideToggle = function(){ col = !col; try { localStorage.setItem(KEY, col ? '1' : '0'); } catch (e) {} applyCol(); };

  // 접힌 상태: 아이콘에 올리거나 누르면 옆에 하위 메뉴
  const fly = document.createElement('div'); fly.id = 'mm-fly'; fly.hidden = true; document.body.appendChild(fly);
  let flyCat = null, flyT = 0;
  const on = () => col && wide();
  function showFly(cat){
    clearTimeout(flyT);
    if (flyCat === cat && !fly.hidden) return;
    flyCat = cat;
    const sub = cat.nextElementSibling && cat.nextElementSibling.classList.contains('sub') ? cat.nextElementSibling : null;
    const title = (cat.textContent || '').replace(/\d+\+?$/, '').replace('준비중', '').trim();
    fly.innerHTML = `<div class="mm-fly-t">${h(title)}${cat.querySelector('.soon') ? '<small>준비중</small>' : ''}</div>`;
    if (sub) {
      const box = document.createElement('div'); box.className = 'mm-fly-l';
      sub.querySelectorAll('a').forEach(a => { const c = a.cloneNode(true); c.addEventListener('click', hideFly); box.appendChild(c); });
      fly.appendChild(box); fly.classList.add('has'); 
    } else fly.classList.remove('has');
    fly.hidden = false;
    const r = cat.getBoundingClientRect(), sr = document.getElementById('side').getBoundingClientRect();
    fly.style.left = (sr.right + 6) + 'px';
    const fh = fly.offsetHeight;
    fly.style.top = Math.max(8, Math.min(r.top, window.innerHeight - fh - 8)) + 'px';
  }
  function hideFly(){ clearTimeout(flyT); fly.hidden = true; flyCat = null; }
  const later = () => { clearTimeout(flyT); flyT = setTimeout(hideFly, 220); };
  const side = document.getElementById('side');
  if (side) {
    side.addEventListener('mouseover', e => { if (!on()) return; const c = e.target.closest('.cat'); if (c) showFly(c); });
    side.addEventListener('mouseleave', () => { if (on()) later(); });
    side.addEventListener('click', e => {
      if (!on()) return;
      const c = e.target.closest('.cat'); if (!c) return;
      const sub = c.nextElementSibling && c.nextElementSibling.classList.contains('sub');
      if (sub) { e.stopPropagation(); e.preventDefault(); showFly(c); } else hideFly();
    }, true);
    side.addEventListener('scroll', hideFly);
  }
  fly.addEventListener('mouseenter', () => clearTimeout(flyT));
  fly.addEventListener('mouseleave', later);
  document.addEventListener('click', e => { if (!fly.hidden && !fly.contains(e.target) && !(side && side.contains(e.target))) hideFly(); });
  window.addEventListener('resize', hideFly);
  if (typeof go === 'function') { const g = go; go = function(){ hideFly(); return g.apply(this, arguments); }; }
  applyCol();

  /* ---------- 스타일 ---------- */
  const st = document.createElement('style');
  st.textContent = `
  .mm-av{width:26px;height:26px;border-radius:50%;background:#ecede7;color:#49523f;display:inline-grid;place-items:center;font-weight:700;font-size:11px;flex:none;overflow:hidden;vertical-align:middle;line-height:1}
  .mm-av img{width:100%;height:100%;object-fit:cover;display:block}
  .mm-av.sm{width:20px;height:20px;font-size:10px}
  .mm-av.lg{width:48px;height:48px;font-size:17px}
  .mm-av.xl{width:112px;height:112px;font-size:38px}
  .top .av{overflow:hidden}.top .av img{width:100%;height:100%;object-fit:cover;display:block}
  .mm-av-top{cursor:pointer}.mm-av-top:hover{box-shadow:0 0 0 2px #e9c8c9}.mm-av-top:focus-visible{outline:2px solid #c62429;outline-offset:2px}
  .mm-ph{display:flex;flex-direction:column;align-items:center;gap:12px;padding:6px 0 2px;text-align:center}
  .mm-ph-tip{margin:0;font-size:12px;color:#7a836f;line-height:1.6}
  .mm-ph-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
  .mm-ph-btns .btn,.mm-avf .btn{cursor:pointer;display:inline-flex;align-items:center;gap:6px;min-height:36px;font-size:12px;padding:7px 14px}
  .mm-ph-del{color:#a3262c}
  .mm-avf{display:flex;align-items:center;gap:12px;padding:0 0 14px;margin-bottom:14px;border-bottom:1px solid #eef0e8}
  .mm-avf>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
  .mm-avf b{font-size:12px;color:#49523f}.mm-avf b span{font-weight:400;color:#a0a797;font-size:11px;margin-left:4px}
  .mm-avf small{font-size:11px;color:#969c8e}
  .mm-who{display:flex;align-items:center;gap:9px}.mm-who>div{min-width:0}
  .ap-pp>div>span.mm-av{flex:none;margin-right:-2px}
  .ap-steps .mm-av{margin-right:6px}
  .ap-meta .mm-av{margin-right:5px}
  .mm-sidetog{display:none;border:0;background:none;color:#7b8370;padding:6px;margin-left:-8px;border-radius:7px;cursor:pointer}
  .mm-sidetog:hover{background:#f3f4ee;color:#363e31}
  .mm-sidetog .icon{width:20px;height:20px}
  body.mm-col .mm-st-ar{transform:rotate(180deg);transform-origin:14px 12px}
  #mm-fly{position:fixed;z-index:7000;min-width:180px;max-width:240px;background:var(--side,#1d241b);color:#e4e8de;border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.28);padding:8px;border:1px solid #ffffff14}
  #mm-fly[hidden]{display:none}
  .mm-fly-t{font-size:12px;font-weight:600;padding:7px 10px;color:#fff;display:flex;align-items:center;gap:8px}
  .mm-fly-t small{font-size:9px;color:#84917d;background:#ffffff0d;padding:2px 5px;border-radius:3px;font-weight:400}
  #mm-fly.has .mm-fly-t{border-bottom:1px solid #ffffff12;margin-bottom:4px}
  .mm-fly-l a{display:block;padding:9px 10px;border-radius:6px;font-size:12px;color:#b8c2b0;text-decoration:none;cursor:pointer;line-height:1.4}
  .mm-fly-l a:hover{background:#ffffff0b;color:#fff}
  .mm-fly-l a.on{background:#c62429;color:#fff}
  @media(min-width:861px){
    .mm-sidetog{display:inline-flex}
    .side,.top,.main{transition:width .18s,left .18s,margin-left .18s,max-width .18s}
    body.mm-col .side{width:72px;padding:0 10px;overflow-x:hidden}
    body.mm-col .top{left:72px}
    body.mm-col .main{margin-left:72px;max-width:calc(100% - 72px)}
    body.mm-col .toast{left:calc(50% + 36px)}
    body.mm-col .side .side-brand,body.mm-col .side .workspace,body.mm-col .side .nav-label,body.mm-col .side .side-bottom,body.mm-col .side .soon,body.mm-col .side .cat .ar,body.mm-col .side .sub{display:none!important}
    body.mm-col .side .nav-items{padding-top:22px}
    body.mm-col .side .nav-soon-label{font-size:0;height:1px;padding:0;background:#ffffff16;margin:12px 10px}
    body.mm-col .side .cat{font-size:0;gap:0;justify-content:center;padding:12px 0;position:relative}
    body.mm-col .side .cat .icon{margin:0}
    body.mm-col .side .cat:has(+ .sub a.on),body.mm-col .side .cat.on-dash{background:#c62429;color:#fff}
    body.mm-col .side .cat:has(+ .sub a.on) .icon,body.mm-col .side .cat.on-dash .icon{color:#fff}
    body.mm-col .side .cat .nt-badge{position:absolute;top:5px;right:6px;font-size:9px;min-width:15px;height:15px;padding:0 4px;line-height:15px}
  }`;
  document.head.appendChild(st);
})();
