
/* ==========================================================
   가맹점 관리 > 가맹점 공지 (2026-11-11)
   - FC다움 스마트공지를 Supabase가 10분마다 받아 둔 것을 보여줌 (fc-notice-sync)
   - 데이터: fn_notice_data() · fn_notice_open(id) — 관리자·본사만
   - 첨부: Storage 'franchise-notice-files' (비공개, 10분짜리 링크로 열기)
   - 메뉴: '가맹점 현황' 단일 메뉴 → '가맹점 관리'(가맹점 현황 · 가맹점 공지)로 묶음
   - 대시보드: '최근 점주 공지' 칸 → 최근 점주 댓글(7일, 최대 3) + 최근 공지
   - 당분간 작성·답글은 FC다움에서 (이 화면은 보기 전용)
   ========================================================== */
(function(){
  const PAGE = 'fn-notice', BUCKET = 'franchise-notice-files';
  const FC_URL = 'https://fcdaum.com/comu/snotice/for-store';
  const RECENT = 14, DASH_RECENT = 7;
  const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const can = () => !!(typeof SESSION !== 'undefined' && SESSION.user && (SESSION.user.role === 'admin' || SESSION.user.role === 'hq'));
  const ST = { active: ['진행 중', 'on'], closed: ['마감', ''], stopped: ['중단', ''], scheduled: ['예약', 'on'], draft: ['작성 중', ''] };
  const dt = d => { const y = String(new Date().getFullYear()); return !d ? '' : d.slice(0, 4) === y ? d.slice(5).replace('-', '.') : d.slice(2).replace(/-/g, '.'); };
  const kb = b => !b ? '' : b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB';
  const FN = { data: null, at: 0, uid: '', tab: 'all', q: '', cur: null, view: 'status', filt: 'all', open: null, all: {}, more: false };

  async function load(force){
    if (!window.SB || !can()) return null;
    const uid = SESSION.user.uid || SESSION.user.id;
    if (FN.uid !== uid) { FN.uid = uid; FN.data = null; FN.at = 0; }
    if (!force && FN.data && Date.now() - FN.at < 120000) return FN.data;
    const { data, error } = await SB.rpc('fn_notice_data');
    if (error) throw error;
    FN.data = data; FN.at = Date.now(); badge();
    return data;
  }
  const recentPend = (days) => ((FN.data && FN.data.pending) || []).filter(p => p.days <= days);

  /* ---------- 메뉴: 가맹점 현황 → 가맹점 관리(현황 · 공지) ---------- */
  function badge(){
    const a = document.querySelector('#side .sub.js-fn-menu a[data-p="' + PAGE + '"]'); if (!a) return;
    a.querySelector('.nt-badge')?.remove();
    const n = recentPend(RECENT).length;
    if (n) a.insertAdjacentHTML('beforeend', `<span class="nt-badge mm-sub-badge">${n}</span>`);
  }
  function fixMenu(active){
    const nav = document.querySelector('#side .nav-items'); if (!nav) return;
    nav.querySelectorAll('.js-fn-menu').forEach(e => e.remove());
    const nh = nav.querySelector(':scope > .cat.js-nh-menu'); if (!nh) return;
    const open = active === PAGE || active === 'nh-week' || active === 'fc-orders';
    // 본사 택배 발주(FC다움 매장 발주)는 가맹점 관리로 옮김 → 본사 발주·재고에서는 뺌
    nav.querySelectorAll('.sub:not(.js-fn-menu) a[onclick="go(\'fc-orders\')"]').forEach(a => a.remove());
    nh.insertAdjacentHTML('beforebegin', `<button class="cat js-fn-menu ${open ? 'open' : ''}" onclick="const o=this.classList.toggle('open');this.nextElementSibling.classList.toggle('open',o)">${ic('store')}가맹점 관리${ic('chevron').replace('class="icon"', 'class="icon ar"')}</button>
      <div class="sub js-fn-menu ${open ? 'open' : ''}"><a role="button" tabindex="0" data-p="nh-week" class="${active === 'nh-week' ? 'on' : ''}" onclick="go('nh-week')">가맹점 현황</a><a role="button" tabindex="0" data-p="${PAGE}" class="${active === PAGE ? 'on' : ''}" onclick="go('${PAGE}')">가맹점 공지</a><a role="button" tabindex="0" data-p="fc-orders" class="${active === 'fc-orders' ? 'on' : ''}" onclick="go('fc-orders')">가맹점 발주</a></div>`);
    nh.remove();
    badge();
  }
  const renderSideFn = renderSide;
  renderSide = function(active){
    const r = renderSideFn.apply(this, arguments);
    try { fixMenu(active); } catch (e) { console.warn('가맹점 관리 메뉴 실패', e); }
    return r;
  };
  try { fixMenu(window.__curPage); } catch (e) {}

  const goFn = go;
  go = function(p, t){
    if (p === PAGE) {
      if (!can()) { toast('관리자·본사 계정만 볼 수 있어요.'); return goFn('dash'); }
      document.getElementById('nt-pop')?.remove();
      closeSide(); renderSide(p); window.__curPage = p; FN.cur = null; pageList(); window.scrollTo(0, 0); return;
    }
    const r = goFn(p, t);
    if (p === 'fc-orders') {
      const fix = () => {
        const c = document.querySelector('#main .crumb'), hh = document.querySelector('#main .page-hero h1');
        if (c) c.innerHTML = c.innerHTML.replace(/<span>본사 발주·재고<\/span>|<span>발주 관리<\/span>/, '<span>FC다움</span>').replace('<span>매장 발주 (FC다움)</span>', '<span>FC다움 발주</span>');
        if (hh && /매장 발주|FC다움 본사 발주/.test(hh.textContent)) hh.textContent = 'FC다움 발주';
        const hero = document.querySelector('#main > .page-hero');
        if (hero && !document.querySelector('#main .pg-guide') && typeof pageGuide === 'function')
          hero.insertAdjacentHTML('afterend', pageGuide('fc', 'FC다움 10분마다 업데이트 · 확인용 화면', [['수집', 'FC다움에서 10분마다 새 발주를 가져와요.'], ['처리', '이 화면은 확인용이에요. 확인·완료 처리는 FC다움에서 해 주세요.']]));
      };
      fix(); Promise.resolve(r).then(fix);
    }
    return r;
  };

  /* ---------- 목록 ---------- */
  function shell(){
    document.getElementById('main').innerHTML = simpleHero(['FC다움', 'FC다움 공지'], 'FCDAUM NOTICE', 'FC다움 공지',
      'FC다움 스마트공지를 10분마다 가져와요. 공지 작성과 매장 댓글 답글은 FC다움에서 해 주세요. 멘야 파트너스 공지는 가맹점 > 공지에서 봐요.') +
      `<div id="fnn-body"><section class="card"><div class="fnn-empty">불러오는 중...</div></section></div>` + pageFoot();
  }
  async function pageList(){
    shell();
    try { await load(); } catch (e) { document.getElementById('fnn-body').innerHTML = `<section class="card"><div class="fnn-empty">불러오지 못했어요: ${h(e.message || e)}</div></section>`; return; }
    if (window.__curPage === PAGE && !FN.cur) drawList();
  }
  function rowsOf(){
    const q = FN.q.replace(/\s/g, '').toLowerCase();
    return (FN.data.list || []).filter(n => (FN.tab === 'all' || (FN.tab === 'active' ? n.status === 'active' : n.status !== 'active'))
        && (!q || (n.title + (n.tags || []).join('')).replace(/\s/g, '').toLowerCase().includes(q)))
      .sort((a, b) => ((b.pin && b.status === 'active') - (a.pin && a.status === 'active')) || b.at.localeCompare(a.at));
  }
  function drawList(){
    const D = FN.data, box = document.getElementById('fnn-body'); if (!box) return;
    const c = D.counts || {}, pend = recentPend(RECENT), shown = FN.more ? pend : pend.slice(0, 5);
    box.innerHTML = `
      <div class="data-note"><span class="status-dot"></span><span>FC다움 마지막 확인 ${h(D.synced ? D.synced.at : '-')}</span><span class="tag">10분마다 자동</span>
        <a class="btn ghost fnn-ext" href="${FC_URL}" target="_blank" rel="noopener">FC다움에서 공지 쓰기 ${ic('arrow')}</a></div>
      ${false ? `<section class="card fnn-pend"><div class="section-title"><strong>${ic('bell')}점주 댓글 · 본사 답글 전</strong><small>최근 ${RECENT}일 · ${pend.length}건 · 답글은 FC다움에서</small></div>
        ${shown.map(p => `<button type="button" class="fnn-prow" onclick="fnOpen(${p.nid},'talk','${h(p.tkey)}')"><b>${h(p.store)}</b><span class="m"><span class="t">${h(p.body)}</span><small>${h(p.title)}</small></span><span class="d">${h(p.at)}</span></button>`).join('')}
        ${pend.length > 5 ? `<button type="button" class="fnn-more" onclick="fnMore()">${FN.more ? '접기' : `${pend.length - 5}건 더 보기`}</button>` : ''}</section>` : ''}
      <section class="card"><div class="fnn-bar">
        <div class="fnn-tabs" role="tablist">${[['all', `전체 ${c.total || 0}`], ['active', `진행 중 ${c.active || 0}`], ['closed', `마감 ${c.closed || 0}`]].map(([k, t]) => `<button type="button" role="tab" aria-selected="${FN.tab === k}" class="${FN.tab === k ? 'on' : ''}" onclick="fnTab('${k}')">${t}</button>`).join('')}</div>
        <input type="search" class="fnn-q" placeholder="제목·태그 검색" aria-label="공지 검색" value="${h(FN.q)}" oninput="fnQ(this.value)"></div>
        <div id="fnn-list"></div></section>`;
    drawRows();
  }
  function drawRows(){
    const el = document.getElementById('fnn-list'); if (!el) return;
    const list = rowsOf();
    el.innerHTML = list.length ? list.map(n => {
      const st = ST[n.status] || [n.status, ''], pct = n.total ? Math.round(n.read / n.total * 100) : 0;
      return `<button type="button" class="fnn-row ${n.status === 'active' ? '' : 'done'}" onclick="fnOpen(${n.id})">
        <span class="fnn-l"><span class="fnn-t">${n.pin && n.status === 'active' ? '<em class="fnn-pin">필독</em>' : ''}${h(n.title)}</span>
          <span class="fnn-s">${n.total}개 매장 · ${n.read}곳 읽음 · <span class="fnn-st ${st[1]}">${st[0]}</span>${n.files ? ` · 첨부 ${n.files}` : ''}</span></span>
        ${n.pend ? `<span class="fnn-cb new">점주 댓글 ${n.pend}</span>` : n.cmt ? `<span class="fnn-cb">댓글 ${n.cmt}</span>` : ''}
        <span class="fnn-date">${dt(n.at)}</span></button>`;
    }).join('') : `<div class="fnn-empty">조건에 맞는 공지가 없어요.</div>`;
  }
  let qT = 0;
  window.fnQ = v => { clearTimeout(qT); qT = setTimeout(() => { FN.q = v.trim(); drawRows(); }, 200); };
  window.fnTab = k => { FN.tab = k; drawList(); };
  window.fnMore = () => { FN.more = !FN.more; drawList(); };

  /* ---------- 상세 ---------- */
  window.fnOpen = async function(id, view, tkey){
    if (window.__curPage !== PAGE) { closeSide(); renderSide(PAGE); window.__curPage = PAGE; shell(); }
    FN.view = view || 'status'; FN.filt = 'all'; FN.open = tkey || null; FN.all = {};
    document.getElementById('fnn-body').innerHTML = `<section class="card"><div class="fnn-empty">불러오는 중...</div></section>`;
    window.scrollTo(0, 0);
    const { data, error } = await SB.rpc('fn_notice_open', { p_id: id });
    if (error) { document.getElementById('fnn-body').innerHTML = `<section class="card"><div class="fnn-empty">열지 못했어요: ${h(error.message)}</div></section>`; return; }
    FN.cur = data;
    if (!FN.open && FN.view === 'talk' && data.threads.length) FN.open = data.threads[0].tkey;
    SB.rpc('mst_hq_seen', { p_id: id }).then(() => load(true)).catch(() => {});  // 2026-11-12: 열어 보면 '점주 댓글' 숫자 지움
    drawDetail();
  };
  window.fnBack = () => { FN.cur = null; if (FN.data) drawList(); else pageList(); window.scrollTo(0, 0); };
  function drawDetail(){
    const n = FN.cur, box = document.getElementById('fnn-body'); if (!box || !n) return;
    const st = ST[n.status] || [n.status, ''];
    const F = n.files.map((f, i) => Object.assign({ i }, f)), imgs = F.filter(f => f.kind === 'image' && f.path), others = F.filter(f => !(f.kind === 'image' && f.path));
    box.innerHTML = `
      <div class="fnn-dtop"><button type="button" class="fnn-back" onclick="fnBack()">‹ 가맹점 공지</button><a class="btn ghost fnn-ext" href="${FC_URL}" target="_blank" rel="noopener">FC다움에서 열기 ${ic('arrow')}</a></div>
      <section class="card fnn-art">
        <h2 class="fnn-h">${n.pinned && n.status === 'active' ? '<em class="fnn-pin">필독</em>' : ''}${h(n.title)}</h2>
        <div class="fnn-meta">${h(n.at)} · ${h(n.author || '')} · ${n.targets.length}개 매장 · <span class="fnn-st ${st[1]}">${st[0]}</span>${n.end ? ` · 마감 ${h(n.end)}` : ''}${(n.tags || []).length ? ` · ${n.tags.map(t => '#' + h(t)).join(' ')}` : ''}</div>
        <div class="fnn-text">${h(n.body) || '<span class="na">본문 없음</span>'}</div>
        ${imgs.length ? `<div class="fnn-imgs">${imgs.map((f, i) => `<button type="button" class="fnn-img" data-i="${i}" onclick="fnFile(${f.i})" aria-label="${h(f.name)} 크게 보기"><span>불러오는 중</span></button>`).join('')}</div>` : ''}
        ${others.length ? `<div class="fnn-files">${others.map(f => `<button type="button" class="fnn-file" onclick="fnFile(${f.i})" ${f.path ? '' : 'disabled'}>${ic('file')}<span>${h(f.name)}</span><small>${f.path ? kb(f.size) : '예전 파일 · 이름만 남아 있어요'}</small></button>`).join('')}</div>` : ''}
      </section>
      <section class="card fnn-panel">
        <div class="fnn-ptabs" role="tablist"><button type="button" role="tab" aria-selected="${FN.view === 'status'}" class="${FN.view === 'status' ? 'on' : ''}" onclick="fnView('status')">수신현황</button><button type="button" role="tab" aria-selected="${FN.view === 'talk'}" class="${FN.view === 'talk' ? 'on' : ''}" onclick="fnView('talk')">대화 ${n.threads.length ? `<i class="${n.threads.some(t => t.pend) ? 'new' : ''}">${n.threads.length}</i>` : ''}</button></div>
        <div id="fnn-pbody"></div></section>`;
    drawPanel();
    if (imgs.length) signImgs(imgs);
  }
  async function signImgs(imgs){
    try {
      const { data } = await SB.storage.from(BUCKET).createSignedUrls(imgs.map(f => f.path), 600);
      (data || []).forEach((r, i) => { const b = document.querySelector(`.fnn-img[data-i="${i}"]`); if (b && r.signedUrl) b.innerHTML = `<img src="${h(r.signedUrl)}" alt="${h(imgs[i].name)}" loading="lazy">`; });
    } catch (e) {}
  }
  window.fnFile = async function(i){
    const f = FN.cur && FN.cur.files[i]; if (!f || !f.path) return;
    const path = f.path, name = f.name;
    const dl = !/\.(pdf|jpe?g|png|gif|webp|mp4)$/i.test(path);
    const w = dl ? null : window.open('', '_blank');
    const { data, error } = await SB.storage.from(BUCKET).createSignedUrl(path, 600, dl ? { download: name } : undefined);
    if (error) { w && w.close(); return toast('파일을 열지 못했어요: ' + error.message); }
    if (w) w.location.href = data.signedUrl; else location.href = data.signedUrl;
  };
  window.fnView = v => { FN.view = v; if (v === 'talk' && !FN.open && FN.cur.threads.length) FN.open = FN.cur.threads[0].tkey; drawDetail(); };
  function drawPanel(){
    const n = FN.cur, el = document.getElementById('fnn-pbody'); if (!el) return;
    if (FN.view === 'status') {
      const T = n.targets, read = T.filter(t => t.read).length, resp = T.filter(t => t.resp).length, un = T.length - read;
      const talk = new Set(n.threads.filter(t => t.pend).map(t => t.tkey));
      const list = T.filter(t => FN.filt === 'all' || (FN.filt === 'un' ? !t.read : FN.filt === 'read' ? t.read && !t.resp : t.resp));
      el.innerHTML = `<div class="fnn-cnt"><span><b>${read}</b> 읽음</span><span><b>${resp}</b> 응답</span><span><b class="${un ? 'red' : ''}">${un}</b> 미확인</span></div>
        <div class="fnn-sbar"><i style="width:${T.length ? resp / T.length * 100 : 0}%"></i><i class="r" style="width:${T.length ? (read - resp) / T.length * 100 : 0}%"></i></div>
        <div class="fnn-chips">${[['all', '전체'], ['un', `미확인 ${un}`], ['read', `읽음만 ${read - resp}`], ['resp', `응답 ${resp}`]].map(([k, t]) => `<button type="button" class="${FN.filt === k ? 'on' : ''}" onclick="fnFilt('${k}')">${t}</button>`).join('')}</div>
        <ul class="fnn-stores">${list.map(t => `<li><b>${h(t.store)}${t.closed ? ' <small class="fnn-closed">폐점</small>' : ''}</b>
          ${talk.has(t.tkey) ? `<button type="button" class="fnn-cb new" onclick="fnTalk('${h(t.tkey)}')">점주 댓글</button>` : ''}
          <span class="fnn-ss ${t.resp ? 'resp' : t.read ? 'read' : 'un'}">${t.resp ? '응답 ' + h(t.resp) : t.read ? '읽음 ' + h(t.read) : '미확인'}</span></li>`).join('') || '<li class="fnn-empty">해당하는 매장이 없어요.</li>'}</ul>`;
      return;
    }
    if (!n.threads.length) { el.innerHTML = `<div class="fnn-empty">이 공지에는 매장 댓글이 없어요.</div>`; return; }
    el.innerHTML = `<p class="fnn-note">매장마다 따로 대화해요. 답글은 FC다움에서 남기면 10분 안에 여기에도 보여요.</p>` + n.threads.map(t => {
      const open = FN.open === t.tkey, all = FN.all[t.tkey], msgs = all ? t.msgs : t.msgs.slice(-3);
      return `<div class="fnn-th ${open ? 'open' : ''}"><button type="button" class="fnn-thh" aria-expanded="${open}" onclick="fnTalk('${h(t.tkey)}',1)">
          <span class="m"><span><b>${h(t.store)}</b> <em class="${t.pend ? 'new' : ''}">${t.pend ? '본사 답글 전' : '답글 완료'}</em></span><small>${h(t.preview)}</small></span>
          <span class="d">${h(t.last)}<br>댓글 ${t.msgs.length}</span><span class="ar" aria-hidden="true">▾</span></button>
        ${open ? `<div class="fnn-msgs">${!all && t.msgs.length > 3 ? `<button type="button" class="fnn-old" onclick="fnAll('${h(t.tkey)}')">이전 대화 ${t.msgs.length - 3}개 보기</button>` : ''}
          ${msgs.map(m => `<div class="fnn-msg ${m.side}"><span>${m.side === 'store' ? h(t.store) + ' · ' : '본사 · '}${h(m.who)} · ${h(m.at)}</span><p>${h(m.body)}</p></div>`).join('')}
          <a class="fnn-reply" href="${FC_URL}" target="_blank" rel="noopener">FC다움에서 답글 남기기 ↗</a></div>` : ''}</div>`;
    }).join('');
  }
  window.fnFilt = k => { FN.filt = k; drawPanel(); };
  window.fnTalk = (k, toggle) => { FN.view = 'talk'; FN.open = toggle && FN.open === k ? null : k; drawDetail(); };
  window.fnAll = k => { FN.all[k] = true; drawPanel(); };

  /* ---------- 대시보드: '최근 점주 공지' 칸 바꾸기 ---------- */
  function dashHtml(){
    const D = FN.data;
    if (!D) return '<div class="ns-empty">불러오는 중...</div>';
    const list = (D.list || []).slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3);
    return list.map(n => `<button type="button" class="fnn-drow ${n.status === 'active' ? '' : 'done'}" onclick="fnOpen(${n.id}${n.pend ? ",'talk'" : ''})"><span class="t">${h(n.title)}</span>${n.pend ? `<em class="fnn-dcb">점주 댓글 ${n.pend}</em>` : ''}<small>${dt(n.at)}</small></button>`).join('')
      + `<a class="fnn-dall" onclick="go('${PAGE}')">가맹점 공지 전체 보기 ${ic('arrow')}</a>`;
  }
  const pageDashboardFn = pageDashboard;
  pageDashboard = function(){
    pageDashboardFn.apply(this, arguments);
    if (!can()) return;
    const sec = [...document.querySelectorAll('#main .dash-sec')].find(s => (s.querySelector('.sec-head h2') || {}).textContent === '최근 점주 공지');
    if (!sec) return;
    sec.querySelector('.sec-head h2').textContent = '가맹점 공지';
    const sm = sec.querySelector('.sec-head small'); if (sm) sm.textContent = '최근 3건';
    const strip = sec.querySelector('.notice-strip'); if (!strip) return;
    strip.classList.add('fnn-dash');
    strip.innerHTML = dashHtml();
    load().then(() => { const s = document.querySelector('.fnn-dash'); if (s) s.innerHTML = dashHtml(); }).catch(() => {});
  };

  // 2분마다 새 댓글 확인 (화면이 보일 때만)
  setInterval(() => { if (!document.hidden && can()) load(true).then(() => { if (window.__curPage === PAGE && !FN.cur) drawList(); }).catch(() => {}); }, 120000);
  setTimeout(() => { if (can()) load().catch(() => {}); }, 1500);

  /* ---------- 스타일 ---------- */
  const st = document.createElement('style');
  st.textContent = `
  .fnn-empty{text-align:center;color:#909b84;font-size:13px;padding:36px 10px;list-style:none}
  .fnn-ext{margin-left:auto;min-height:34px;font-size:12px;padding:6px 12px;text-decoration:none}
  .fnn-ext .icon{width:13px;height:13px}
  .fnn-pend{border-color:#f0d6d6}
  .fnn-prow{display:flex;align-items:center;gap:14px;width:100%;border:0;border-top:1px solid #f3f4ef;background:none;padding:11px 4px;text-align:left;font:inherit;color:#232621;cursor:pointer}
  .fnn-prow:hover{background:#fafbf7}
  .fnn-prow b{width:84px;flex:none;font-size:13px}
  .fnn-prow .m{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
  .fnn-prow .t,.fnn-prow small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fnn-prow .t{font-size:13px}.fnn-prow small{font-size:11px;color:#6b6f68}
  .fnn-prow .d{font-size:11px;color:#6b6f68;flex:none}
  .fnn-more{display:block;margin:6px auto 0;border:0;background:none;color:#5f6858;font-size:12px;cursor:pointer;padding:6px 10px}
  .fnn-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:4px}
  .fnn-tabs{display:flex;gap:18px}
  .fnn-tabs button{border:0;border-bottom:2px solid transparent;background:none;padding:8px 0;font-size:13px;color:#5e625b;cursor:pointer;min-height:38px}
  .fnn-tabs button.on{border-bottom-color:#232621;color:#232621;font-weight:700}
  .fnn-q{border:1px solid #e0e4d8;border-radius:8px;min-height:38px;padding:0 12px;font-size:13px;min-width:220px;background:#fff}
  .fnn-row{display:flex;align-items:center;gap:16px;width:100%;border:0;border-top:1px solid #f0f1ec;background:none;padding:15px 2px;text-align:left;font:inherit;color:#232621;cursor:pointer}
  .fnn-row:hover{background:#fafbf7}
  .fnn-l{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
  .fnn-t{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fnn-s{font-size:12px;color:#5e625b}
  .fnn-st.on{color:#1f5fbf;font-weight:700}
  .fnn-pin{font-style:normal;font-size:11px;font-weight:700;background:#fbeeee;color:#a3262c;border-radius:5px;padding:1px 7px;margin-right:7px;vertical-align:1px}
  .fnn-cb{flex:none;font-size:11px;font-weight:600;border-radius:11px;padding:3px 9px;background:#eef0ea;color:#4d524a;border:0;font-family:inherit}
  .fnn-cb.new{background:#c62429;color:#fff;cursor:pointer}
  .fnn-date{flex:none;font-size:12px;color:#5e625b;font-variant-numeric:tabular-nums;min-width:44px;text-align:right}
  .fnn-row.done .fnn-t,.fnn-row.done .fnn-s,.fnn-row.done .fnn-date,.fnn-drow.done .t,.fnn-drow.done small{color:#a3a89c}
  .fnn-row.done .fnn-st{color:#a3a89c}
  .fnn-r{flex:none;width:118px;display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-size:12px;color:#5e625b}
  .fnn-r b{color:#232621;font-size:13px}
  .fnn-bar2{width:118px;height:4px;background:#eceee8;border-radius:2px;display:block}
  .fnn-bar2 i{display:block;height:4px;border-radius:2px;background:#232621}
  .fnn-dtop{display:flex;align-items:center;gap:10px;margin-bottom:12px}
  .fnn-back{border:0;background:none;color:#4d524a;font-size:13px;cursor:pointer;padding:6px 0}
  .fnn-h{margin:0 0 8px;font-size:20px;line-height:1.45;font-weight:800}
  .fnn-meta{font-size:12px;color:#5e625b;margin-bottom:16px;line-height:1.7}
  .fnn-text{font-size:14px;line-height:1.85;white-space:pre-wrap;word-break:break-word;color:#2f332d;border-top:1px solid #f0f1ec;padding-top:16px}
  .fnn-imgs{display:flex;flex-direction:column;gap:10px;margin-top:16px}
  .fnn-img{border:1px solid #eceee7;border-radius:10px;background:#f6f7f3;padding:0;cursor:zoom-in;overflow:hidden;min-height:60px;display:block;width:100%}
  .fnn-img span{display:block;padding:20px;font-size:12px;color:#8b9381}
  .fnn-img img{display:block;max-width:100%;margin:0 auto}
  .fnn-files{display:flex;flex-direction:column;gap:6px;margin-top:14px;padding-top:12px;border-top:1px dashed #e3e6dd}
  .fnn-file{display:flex;align-items:center;gap:9px;border:1px solid #e3e6dd;background:#fff;border-radius:9px;padding:9px 12px;font:inherit;font-size:13px;color:#232621;cursor:pointer;text-align:left}
  .fnn-file:disabled{cursor:default;opacity:.6}
  .fnn-file span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fnn-file small{color:#8b9381;font-size:11px}
  .fnn-file .icon{width:15px;height:15px}
  .fnn-panel{padding:0!important;overflow:hidden}
  .fnn-ptabs{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #e8e9e3}
  .fnn-ptabs button{border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;padding:15px 0;font-size:14px;color:#5e625b;cursor:pointer}
  .fnn-ptabs button.on{border-bottom-color:#232621;color:#232621;font-weight:800}
  .fnn-ptabs i{font-style:normal;font-size:11px;font-weight:700;border-radius:10px;padding:0 7px;background:#eef0ea;color:#4d524a;margin-left:4px}
  .fnn-ptabs i.new{background:#c62429;color:#fff}
  #fnn-pbody{padding:16px 20px 12px}
  .fnn-cnt{display:flex;gap:18px;align-items:baseline;font-size:12px;color:#5e625b}
  .fnn-cnt b{font-size:22px;color:#232621;margin-right:2px}.fnn-cnt b.red{color:#c62429}
  .fnn-sbar{height:6px;background:#f3dcdc;border-radius:3px;display:flex;overflow:hidden;margin:10px 0 12px}
  .fnn-sbar i{display:block;background:#232621}.fnn-sbar i.r{background:#8a9086}
  .fnn-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}
  .fnn-chips button{border:1px solid #e3e6dd;background:#fff;border-radius:16px;padding:5px 12px;font-size:12px;color:#4d524a;cursor:pointer;min-height:32px}
  .fnn-chips button.on{background:#232621;border-color:#232621;color:#fff}
  .fnn-stores{list-style:none;margin:0;padding:0}
  .fnn-stores li{display:flex;align-items:center;gap:10px;padding:11px 2px;border-top:1px solid #f0f1ec;font-size:13px}
  .fnn-stores li b{flex:1;min-width:0}
  .fnn-closed{font-size:10px;font-weight:600;color:#8b9381;background:#f0f1ec;border-radius:4px;padding:1px 5px;margin-left:4px}
  .fnn-ss{font-size:12px;text-align:right;white-space:nowrap}
  .fnn-ss.resp{color:#1f5fbf;font-weight:700}.fnn-ss.read{color:#232621}.fnn-ss.un{color:#a01b21}
  .fnn-note{margin:0 0 10px;font-size:12px;color:#5e625b}
  .fnn-th{border-top:1px solid #f0f1ec}
  .fnn-thh{display:flex;align-items:center;gap:12px;width:100%;border:0;background:none;padding:13px 2px;font:inherit;color:#232621;text-align:left;cursor:pointer;min-height:54px}
  .fnn-th.open .fnn-thh{background:#fafaf7}
  .fnn-thh .m{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
  .fnn-thh .m b{font-size:14px}
  .fnn-thh em{font-style:normal;font-size:11px;font-weight:700;color:#5e625b;margin-left:6px}
  .fnn-thh em.new{color:#a01b21}
  .fnn-thh small{font-size:12px;color:#5e625b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fnn-thh .d{font-size:11px;color:#5e625b;text-align:right;flex:none;line-height:1.5}
  .fnn-thh .ar{color:#8b9381;transition:transform .15s}
  .fnn-th.open .fnn-thh .ar{transform:rotate(180deg)}
  .fnn-msgs{padding:4px 2px 16px;display:flex;flex-direction:column;gap:10px}
  .fnn-old{align-self:center;border:0;background:#f3f4ef;border-radius:14px;padding:0 14px;min-height:30px;font-size:12px;color:#4d524a;cursor:pointer}
  .fnn-msg{max-width:86%;display:flex;flex-direction:column;gap:4px}
  .fnn-msg span{font-size:11px;color:#5e625b}
  .fnn-msg p{margin:0;padding:9px 13px;line-height:1.6;font-size:13px;white-space:pre-wrap;word-break:break-word}
  .fnn-msg.store{align-self:flex-start;align-items:flex-start}.fnn-msg.store p{background:#f3f4ef;border-radius:4px 12px 12px 12px}
  .fnn-msg.hq{align-self:flex-end;align-items:flex-end}.fnn-msg.hq p{background:#232621;color:#fff;border-radius:12px 4px 12px 12px}
  .fnn-reply{align-self:flex-start;font-size:12px;font-weight:700;color:#232621;padding:4px 0}
  .fnn-dash{display:block}
  .fnn-dh{font-size:11px;color:#6b6f68;font-weight:600;margin:6px 0 2px}
  .fnn-dh b{color:#c62429}
  .fnn-drow{display:flex;align-items:center;gap:10px;width:100%;border:0;border-top:1px dashed #eceee6;background:none;padding:8px 0;font:inherit;font-size:12px;color:#2f3a27;text-align:left;cursor:pointer}
  .fnn-drow:hover span,.fnn-drow:hover .t{color:#c62429}
  .fnn-drow b{flex:none;width:72px;font-size:12px}
  .fnn-drow span,.fnn-drow .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fnn-drow small{flex:none;font-size:10px;color:#8b9381}
  .fnn-drow small.red{color:#c62429;font-weight:700}
  .fnn-dcb{flex:none;font-style:normal;font-size:10px;font-weight:700;background:#c62429;color:#fff;border-radius:9px;padding:1px 7px}
  .fnn-dmore{font-size:11px;color:#8b9381;padding:2px 0 4px}
  .fnn-dall{display:inline-flex;align-items:center;gap:4px;margin-top:6px;font-size:11px;color:#6b6f68;cursor:pointer}
  .fnn-dall .icon{width:11px;height:11px}
  @media(max-width:640px){
    .fnn-q{min-width:0;width:100%}
    .fnn-row{flex-wrap:wrap;gap:8px 12px}.fnn-l{flex:1 1 100%}.fnn-r{width:auto;flex-direction:row;align-items:center;gap:8px;margin-left:auto}.fnn-bar2{width:70px}
    .fnn-prow b{width:64px}.fnn-prow .d{display:none}
    #fnn-pbody{padding:14px}
  }`;
  document.head.appendChild(st);
})();
