
/* ==========================================================
   화면 스타일 2버전 '심플' (리니어 느낌) (2026-11-08)
   - 오른쪽 위 이름 사각형 → 메뉴: 화면 스타일 [1 기본] [2 심플] · 내 사진 바꾸기 · 로그아웃
   - 기기(브라우저)마다 저장: localStorage 'mm_skin' = '1' | '2' (처음엔 1 기본)
   - 주소 끝에 ?skin=1 을 붙이면 무조건 1 기본으로 돌아감
   - 기능 코드는 그대로, <html class="mm-skin2"> 아래에서 모양만 덮어씀
   ========================================================== */
(function(){
  const KEY = 'mm_skin';
  const getSkin = () => { try { return localStorage.getItem(KEY) === '2' ? '2' : '1'; } catch (e) { return '1'; } };
  function setSkin(s){
    try { localStorage.setItem(KEY, s); } catch (e) {}
    document.documentElement.classList.toggle('mm-skin2', s === '2');
    drawPop();
  }
  window.mmSetSkin = setSkin;

  /* ---------- 이름 사각형 메뉴 ---------- */
  let photoFn = null;
  function pop(){ return document.getElementById('mm-skin-pop'); }
  function drawPop(){
    const p = pop(); if (!p) return;
    const s = getSkin();
    p.querySelectorAll('[data-skin]').forEach(b => { const on = b.dataset.skin === s; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  }
  function closePop(){ const p = pop(); if (p) p.hidden = true; const a = document.querySelector('.top .av'); a && a.setAttribute('aria-expanded', 'false'); }
  function openPop(a){
    let p = pop();
    if (!p) {
      document.body.insertAdjacentHTML('beforeend', `<div id="mm-skin-pop" role="menu" hidden>
        <div class="msp-who"></div>
        <div class="msp-sec"><span>화면 스타일</span><div class="msp-seg" role="group" aria-label="화면 스타일"><button type="button" data-skin="1" onclick="mmSetSkin('1')">1 기본</button><button type="button" data-skin="2" onclick="mmSetSkin('2')">2 심플</button></div></div>
        <button type="button" class="msp-item" data-act="photo">내 사진 바꾸기</button>
        <button type="button" class="msp-item" data-act="out">로그아웃</button></div>`);
      p = pop();
      p.addEventListener('click', e => {
        e.stopPropagation();
        const act = e.target.closest('[data-act]'); if (!act) return;
        closePop();
        if (act.dataset.act === 'photo' && photoFn) photoFn();
        if (act.dataset.act === 'out' && typeof logout === 'function') logout();
      });
    }
    const u = (typeof SESSION !== 'undefined' && SESSION && SESSION.user) || window.CURRENT_USER || {};
    const nm = a.dataset.n || u.name || '';
    p.querySelector('.msp-who').innerHTML = `<b></b><small></small>`;
    p.querySelector('.msp-who b').textContent = nm || '내 계정';
    p.querySelector('.msp-who small').textContent = [u.org, u.role].filter(Boolean).join(' · ');
    p.querySelector('[data-act="photo"]').hidden = !photoFn;
    drawPop();
    const r = a.getBoundingClientRect();
    p.style.top = Math.round(r.bottom + 8) + 'px';
    p.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px';
    p.hidden = false;
    a.setAttribute('aria-expanded', 'true');
    const first = p.querySelector('[data-skin].on') || p.querySelector('button'); first && first.focus();
  }
  function hook(){
    const a = document.querySelector('.top .av'); if (!a) return;
    if (a.onclick && a.onclick.__skin) return;
    if (a.onclick) photoFn = a.onclick;
    const f = function(e){ e && e.stopPropagation && e.stopPropagation(); const p = pop(); (p && !p.hidden) ? closePop() : openPop(a); };
    f.__skin = true;
    a.onclick = f;
    a.classList.add('mm-av-top'); a.setAttribute('role', 'button'); a.tabIndex = 0;
    a.setAttribute('aria-haspopup', 'menu'); a.setAttribute('aria-expanded', 'false');
    a.title = '내 메뉴 · 화면 스타일'; a.setAttribute('aria-label', '내 메뉴 열기 (화면 스타일 · 사진 · 로그아웃)');
    if (!a.onkeydown) a.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); a.onclick(); } };
  }
  if (typeof setTopUser === 'function') {
    const base = setTopUser;
    setTopUser = function(){ const r = base.apply(this, arguments); try { hook(); } catch (e) {} return r; };
  }
  try { hook(); } catch (e) {}
  document.addEventListener('click', e => { const p = pop(); if (p && !p.hidden && !p.contains(e.target)) closePop(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
  window.addEventListener('resize', closePop);

  /* ---------- 스타일 ---------- */
  const st = document.createElement('style');
  st.id = 'mm-skin2-css';
  st.textContent = `
  /* 메뉴 팝업 (두 버전 공통) */
  #mm-skin-pop{position:fixed;z-index:8000;width:236px;background:#fff;border:1px solid #e6e6e9;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.14);padding:5px;font-size:13px;color:#1b1c1f}
  #mm-skin-pop[hidden]{display:none}
  .msp-who{padding:9px 10px 10px;border-bottom:1px solid #ededef;display:flex;flex-direction:column;gap:2px}
  .msp-who b{font-weight:600}.msp-who small{font-size:12px;color:#6b6f76}
  .msp-sec{padding:10px;border-bottom:1px solid #ededef;display:flex;flex-direction:column;gap:7px}
  .msp-sec>span{font-size:12px;color:#6b6f76}
  .msp-seg{display:flex;gap:2px;background:#f4f4f5;border:1px solid #e6e6e9;border-radius:7px;padding:2px}
  .msp-seg button{flex:1;height:28px;border:1px solid transparent;background:none;border-radius:5px;font-size:12px;color:#6b6f76;cursor:pointer}
  .msp-seg button.on{background:#fff;border-color:#e2e2e6;color:#1b1c1f;font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.05)}
  .msp-item{display:block;width:100%;text-align:left;border:0;background:none;padding:9px 10px;border-radius:6px;font-size:13px;color:#1b1c1f;cursor:pointer}
  .msp-item:hover,.msp-seg button:hover:not(.on){background:#f1f1f3}
  .msp-item[hidden]{display:none}

  /* ===== 2 심플 ===== */
  html.mm-skin2{--brand:#5e6ad2;--brand-d:#4f5bc4;--ink:#1b1c1f;--sub:#6b6f76;--line:#e6e6e9;--bg:#fff;--card:#fff;--radius:10px;--s2-side:#f7f7f8;--s2-sel:#ebebee;--s2-soft:#f1f1f3;--s2-head:#f7f8f9}
  html.mm-skin2 body{background:#fff;color:var(--ink);font-family:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;letter-spacing:-.1px}
  html.mm-skin2 button:focus-visible,html.mm-skin2 a:focus-visible{outline:2px solid #5e6ad2;outline-offset:2px}

  /* 왼쪽 메뉴 */
  html.mm-skin2 .side{background:var(--s2-side);color:var(--ink);border-right:1px solid var(--line);padding:0 10px}
  html.mm-skin2 .side-brand{padding:18px 8px 14px}
  html.mm-skin2 .side-brand img{display:none}
  html.mm-skin2 .side-home{display:flex;flex-direction:column;line-height:1.25;text-decoration:none;color:var(--ink)}
  html.mm-skin2 .side-home::before{content:"멘야마쯔리";font-size:15px;font-weight:700;letter-spacing:-.2px}
  html.mm-skin2 .side-home::after{content:"WORKSPACE";font-size:10px;color:var(--sub);letter-spacing:1.5px}
  html.mm-skin2 .side-close{color:var(--sub)}
  html.mm-skin2 .side .workspace,html.mm-skin2 .side .nav-label,html.mm-skin2 .side .side-bottom{display:none}
  html.mm-skin2 .mm-nav-grp{margin:16px 0 3px 10px;font-size:11px;letter-spacing:0;font-weight:500;color:var(--sub)}
  html.mm-skin2 .nav-items>.mm-nav-grp:first-child{margin-top:2px}
  html.mm-skin2 .cat{min-height:30px;padding:5px 10px;margin:1px 0;border-radius:6px;gap:10px;font-size:13px;font-weight:400;color:#3c3f44}
  html.mm-skin2 .cat .icon{width:16px;height:16px;color:var(--sub)}
  html.mm-skin2 .cat:hover{background:var(--s2-soft);color:var(--ink)}
  html.mm-skin2 .cat.open{background:transparent;color:var(--ink);font-weight:500}
  html.mm-skin2 .cat.open>.icon{color:var(--sub)}
  html.mm-skin2 .cat.on-dash{background:var(--s2-sel)!important;color:var(--ink)!important;font-weight:500}
  html.mm-skin2 .cat.on-dash .icon{color:var(--ink)!important}
  html.mm-skin2 .cat .ar{width:12px;height:12px;color:var(--sub)}
  html.mm-skin2 .soon{background:none;color:var(--sub);font-size:10px;padding:0}
  html.mm-skin2 .sub{padding:1px 0 6px}
  html.mm-skin2 .sub a{margin:1px 0;padding:6px 10px 6px 36px;border-radius:6px;font-size:13px;color:#505359}
  html.mm-skin2 .sub a:hover:not(.on){background:var(--s2-soft);color:var(--ink)}
  html.mm-skin2 .sub a.on{background:var(--s2-sel);color:var(--ink);font-weight:500}
  html.mm-skin2 .nt-badge{background:none;color:var(--sub);font-weight:500;font-size:11px}
  html.mm-skin2 body.mm-col .side .cat:has(+ .sub a.on),html.mm-skin2 body.mm-col .side .cat.on-dash{background:var(--s2-sel)!important;color:var(--ink)!important}
  html.mm-skin2 body.mm-col .side .cat:has(+ .sub a.on) .icon{color:var(--ink)}
  html.mm-skin2 body.mm-col .side .mm-nav-grp,html.mm-skin2 body.mm-col .side .nav-soon-label{background:var(--line)}
  html.mm-skin2 #mm-fly{background:#fff;color:var(--ink);border:1px solid var(--line);box-shadow:0 10px 30px rgba(0,0,0,.14)}
  html.mm-skin2 .mm-fly-t{color:var(--ink)}
  html.mm-skin2 .mm-fly-t small{background:var(--s2-soft);color:var(--sub)}
  html.mm-skin2 #mm-fly.has .mm-fly-t{border-bottom-color:var(--line)}
  html.mm-skin2 .mm-fly-l a{color:#505359}
  html.mm-skin2 .mm-fly-l a:hover{background:var(--s2-soft);color:var(--ink)}
  html.mm-skin2 .mm-fly-l a.on{background:var(--s2-sel);color:var(--ink)}

  /* 위쪽 바 */
  html.mm-skin2 .top{height:52px;background:rgba(255,255,255,.86);-webkit-backdrop-filter:blur(16px) saturate(180%);backdrop-filter:blur(16px) saturate(180%);border-bottom:1px solid var(--line)}
  html.mm-skin2 .top-title{color:var(--sub);font-size:12px}
  html.mm-skin2 .top-title strong{color:var(--ink);font-weight:500;font-size:13px}
  html.mm-skin2 .top-title .divide{background:var(--line)}
  html.mm-skin2 .demo-chip{background:none;border:1px dashed #c9cacf;color:var(--sub)}
  html.mm-skin2 .user-text{color:var(--ink)}
  html.mm-skin2 .user-text small{color:var(--sub)}
  html.mm-skin2 .top .av{background:#fff;color:var(--ink)}
  html.mm-skin2 .top .av::after{animation:none;background:#5e6ad2;padding:1px}
  html.mm-skin2 .mm-av-top:hover{box-shadow:0 0 0 3px #e3e5fa}
  html.mm-skin2 .nt-bell,html.mm-skin2 .top .logout-btn,html.mm-skin2 .mm-sidetog,html.mm-skin2 .ham{color:var(--sub)}
  html.mm-skin2 .nt-bell i{background:#5e6ad2}
  html.mm-skin2 .mm-sidetog:hover{background:var(--s2-soft);color:var(--ink)}
  html.mm-skin2 .app-install{background:#fff;border-color:var(--line);color:var(--ink)}
  html.mm-skin2 .app-install:hover{background:var(--s2-soft)}
  html.mm-skin2 .wrap{padding-top:52px}

  /* 본문 머리 */
  html.mm-skin2 .main{background:#fff}
  html.mm-skin2 .crumb{font-size:12px;color:var(--sub);margin-bottom:10px}
  html.mm-skin2 .crumb .icon{display:none}
  html.mm-skin2 .page-hero,html.mm-skin2 .page-hero.compact{background:none;border-radius:0;min-height:0;padding:0 0 18px;margin-bottom:22px;border-bottom:1px solid var(--line);overflow:visible}
  html.mm-skin2 .hero-image,html.mm-skin2 .hero-copy .eyebrow{display:none}
  html.mm-skin2 .page-hero h1{font-size:22px;font-weight:600;letter-spacing:-.4px;color:var(--ink);margin:0 0 4px}
  html.mm-skin2 .page-hero p{font-size:13px;color:var(--sub)}

  /* 카드 · 제목 */
  html.mm-skin2 .card{border:1px solid var(--line);border-radius:10px;box-shadow:none;padding:18px 20px}
  html.mm-skin2 .section-title strong{font-size:14px;font-weight:600;color:var(--ink)}
  html.mm-skin2 .section-title small{font-size:12px;color:var(--sub)}

  /* 버튼 */
  html.mm-skin2 .btn{border-radius:6px;min-height:32px;padding:6px 14px;font-size:13px;font-weight:500;background:#5e6ad2;box-shadow:none}
  html.mm-skin2 .btn:hover{background:#4f5bc4}
  html.mm-skin2 .btn.ghost{background:#fff;color:var(--ink);border:1px solid var(--line)}
  html.mm-skin2 .btn.ghost:hover{background:var(--s2-soft)}
  html.mm-skin2 .dmb{border-radius:6px;border-color:var(--line);color:var(--ink);font-size:13px;min-height:32px}
  html.mm-skin2 .dmb:hover{background:var(--s2-soft)}
  html.mm-skin2 .dmb.pri{background:#5e6ad2;border-color:#5e6ad2;color:#fff}
  html.mm-skin2 .dmb.pri:hover{background:#4f5bc4}
  html.mm-skin2 .dmb.dark{background:var(--ink);border-color:var(--ink);color:#fff}
  html.mm-skin2 .dmb.sm{min-height:26px;font-size:12px}

  /* 입력칸 */
  html.mm-skin2 .main input[type=text],html.mm-skin2 .main input[type=date],html.mm-skin2 .main input[type=number],html.mm-skin2 .main input[type=search],html.mm-skin2 .main input[type=tel],html.mm-skin2 .main input[type=month],html.mm-skin2 .main select,html.mm-skin2 .main textarea{border:1px solid var(--line);border-radius:6px;font-size:13px;color:var(--ink);background-color:#fff}
  html.mm-skin2 .main input:focus,html.mm-skin2 .main select:focus,html.mm-skin2 .main textarea:focus{border-color:#5e6ad2;box-shadow:0 0 0 3px #e3e5fa;outline:none}
  html.mm-skin2 .f label,html.mm-skin2 .f>span{color:var(--sub)}
  html.mm-skin2 input[type=checkbox],html.mm-skin2 input[type=radio]{accent-color:#5e6ad2}

  /* 탭 · 세그먼트 */
  html.mm-skin2 .seg,html.mm-skin2 .dm-tabs{background:#f4f4f5;border:1px solid var(--line);border-radius:7px;padding:2px;min-height:34px}
  html.mm-skin2 .seg button,html.mm-skin2 .dm-tabs button{border-radius:5px;font-size:12px;color:var(--sub)}
  html.mm-skin2 .seg button.on,html.mm-skin2 .dm-tabs button.on{background:#fff;color:var(--ink);font-weight:600;box-shadow:0 0 0 1px #e2e2e6,0 1px 2px rgba(0,0,0,.05)}
  html.mm-skin2 .dm-stabs{background:#f4f4f5;border:1px solid var(--line);border-radius:8px;padding:2px}
  html.mm-skin2 .dm-stabs button{font-size:13px;font-weight:500;color:var(--sub);border-radius:6px}
  html.mm-skin2 .dm-stabs button.on{background:#fff;color:var(--ink);box-shadow:0 0 0 1px #e2e2e6,0 1px 2px rgba(0,0,0,.05)}
  html.mm-skin2 .dm-stabs button.on small{color:#b07a00}
  html.mm-skin2 .tr-tabs button{border-radius:6px;padding:6px 12px;font-size:13px;color:var(--sub);border-color:var(--line)}
  html.mm-skin2 .tr-tabs button.on{background:var(--s2-sel);border-color:#dcdce0;color:var(--ink);font-weight:500}
  html.mm-skin2 .chip{border-color:var(--line);border-radius:8px}
  html.mm-skin2 .chip.on{border-color:#5e6ad2;background:#f3f4fd;box-shadow:0 0 0 2px #e3e5fa}

  /* 표 */
  html.mm-skin2 table{font-size:12px}
  :where(html.mm-skin2) th{background:var(--s2-head);color:var(--sub);font-weight:500;font-size:12px;border-color:var(--line)}
  :where(html.mm-skin2) td{border-color:var(--s2-soft);color:var(--ink);font-size:13px}
  :where(html.mm-skin2) tbody tr:nth-child(even){background:transparent}
  :where(html.mm-skin2) tbody tr:hover{background:#fafafb}
  html.mm-skin2 .table-foot{font-size:12px;color:var(--sub)}

  /* 안내 */
  html.mm-skin2 .pg-guide-sub{color:var(--sub)}
  html.mm-skin2 .pg-guide summary{color:var(--sub)}`;
  document.head.appendChild(st);
})();
