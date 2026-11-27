
/* ==========================================================
   등급·권한 설정 (2026-11-09) — 사용자 관리 > 등급·권한 설정
   - 등급: 관리자(admin) · 본사(hq) · 매장 관리자(store) · 매장 사원(staff)
   - 체크표는 Supabase role_perms (관리자 칸은 항상 전부 허용, 저장 안 함)
   - 지금 적용: 왼쪽 메뉴 숨김 + 주소로 들어오는 화면 막기
   - '곧 적용' 표시 줄: 화면 안 기능(작성·수정 등) — 다음 단계에서 서버 함수까지 맞춤
   ========================================================== */
(function(){
  const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ROLES = [['admin', '관리자'], ['hq', '본사'], ['store', '매장 관리자'], ['staff', '매장 사원']];
  window.MM_ROLE_LABEL = Object.fromEntries(ROLES);
  // [키, 이름, 묶음, 지금 적용 여부]
  const PERMS = [
    ['dash', '대시보드', '운영', 1],
    ['notice_view', '공지 보기', '운영', 1],
    ['notice_write', '공지 작성', '운영', 0],
    ['appr', '상신하기', '운영', 1],
    ['appr_sign', '결재하기 (결재함)', '운영', 1],
    ['org_view', '연락망 보기 (이름·직급)', '운영', 1],
    ['org_tel', '연락망 연락처 보기', '운영', 0],
    ['staff_view', '직원 현황 보기', '운영', 1],
    ['staff_edit', '직원 등록·수정', '운영', 0],
    ['shift_view', '시프트 보기·댓글', '운영', 1],
    ['shift_edit', '시프트 작성·수정·제출', '운영', 0],
    ['att', '출결 관리', '운영', 1],
    ['fran', '가맹점 현황', '운영', 1],
    ['sales', '매출 관리', '매장 데이터', 1],
    ['jette', '제때 관리', '매장 데이터', 1],
    ['inv_view', '본사 발주·재고 보기', '매장 데이터', 1],
    ['inv_edit', '입·출고 등록·재고조사', '매장 데이터', 1],
    ['analysis', '분석 시스템', '분석', 1],
    ['manual_view', '매뉴얼 보기', '관리', 1],
    ['manual_write', '매뉴얼 등록', '관리', 0],
    ['vendor', '거래처 현황', '관리', 1],
    ['acct', '계정 현황', '관리', 1],
    ['org_set', '회사·조직 설정', '관리', 0],
    ['channel', '브랜드 채널', '관리', 1]
  ];
  // 왼쪽 메뉴 묶음(카테고리) 이름 → 권한
  const CAT = { '대시보드': 'dash', '공지사항': 'notice_view', '상신·결재': 'appr', '연락망': 'org_view', '가맹점 현황': 'fran',
    '매출 관리': 'sales', '제때 관리': 'jette', '본사 발주·재고': 'inv_view', '본사 창고 관리': 'inv_view', '분석 시스템': 'analysis',
    '매뉴얼 관리': 'manual_view', '브랜드 채널': 'channel', '회사·조직 설정': 'org_set' };
  // 하위 메뉴 이름 → 권한
  const SUB = { '결재함': 'appr_sign', '직원 현황': 'staff_view', '시프트 관리': 'shift_view', '출결 관리': 'att',
    '입·출고 등록': 'inv_edit', '월말 재고조사': 'inv_edit', '거래처 현황': 'vendor', '계정 현황': 'acct' };
  // 화면 주소 → 권한 (주소로 바로 들어오는 것 막기)
  const PAGE = { notice: 'notice_view', 'ap-mine': 'appr', 'ap-cc': 'appr', 'ap-box': 'appr_sign', org: 'org_view',
    'dm-staff': 'staff_view', 'dm-shift': 'shift_view', 'hr-att': 'att', 'sales-report': 'sales', 'store-orders': 'jette', 'period-sales': 'jette',
    'fc-orders': 'inv_view', 'inv-stock': 'inv_view', 'inv-log': 'inv_view', 'inv-io': 'inv_edit', 'inv-count': 'inv_edit',
    'man-ops': 'manual_view', 'man-cook': 'manual_view', 'man-doc': 'manual_view', 'vendor-list': 'vendor', 'acct-list': 'acct' };

  const PM = { mine: null, loading: null, data: null, edit: null };
  const myRole = () => (typeof SESSION !== 'undefined' && SESSION.user && SESSION.user.role) || '';
  const isAdm = () => myRole() === 'admin';
  window.mmCan = function(perm){
    if (isAdm()) return true;
    if (!PM.mine) return true;           // 아직 못 받았으면 막지 않음 (서버가 최종 판단)
    return !!PM.mine[perm];
  };
  function loadMine(){
    if (PM.loading || !window.SB || typeof SESSION === 'undefined' || !SESSION.user) return PM.loading;
    PM.loading = SB.rpc('perm_mine').then(({ data, error }) => {
      PM.loading = null;
      if (error || !data) return;
      PM.mine = data.perms || {};
      try { renderSide(window.__curPage); } catch (e) {}
    });
    return PM.loading;
  }

  const label = b => [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
  function applyMenu(active){
    const nav = document.querySelector('#side .nav-items') || document.getElementById('side'); if (!nav) return;
    // 사용자 관리 아래 '등급·권한 설정'
    if (isAdm()) {
      const us = [...nav.querySelectorAll('.cat')].find(b => label(b) === '사용자 관리');
      const sub = us && us.nextElementSibling && us.nextElementSibling.classList.contains('sub') ? us.nextElementSibling : null;
      if (sub && !sub.querySelector('.js-perm')) {
        sub.insertAdjacentHTML('beforeend', `<a role="button" tabindex="0" class="js-perm ${active === 'perm-set' ? 'on' : ''}" onclick="go('perm-set')">등급·권한 설정</a>`);
        if (active === 'perm-set') { us.classList.add('open'); sub.classList.add('open'); sub.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.classList.contains('js-perm'))); }
      }
    }
    // 매장 사원: 직영점 관리(시프트 관리·출결 관리)를 연락망 아래에 — 자기 매장만, 보기·댓글 (2026-11-27)
    if (myRole() === 'staff' && !nav.querySelector('.js-dm-staff')) {
      const on = ['dm-shift', 'hr-att'].includes(active);
      const org = [...nav.querySelectorAll(':scope > .cat')].find(b => label(b) === '연락망');
      const html = `<button class="cat js-dm js-dm-staff ${on ? 'open' : ''}" onclick="const o=this.classList.toggle('open');this.nextElementSibling.classList.toggle('open',o)">${ic('store')}직영점 관리${ic('chevron').replace('class="icon"', 'class="icon ar"')}</button>
        <div class="sub js-dm js-dm-staff ${on ? 'open' : ''}">${[['dm-shift', '시프트 관리'], ['hr-att', '출결 관리']].map(([k, t]) => `<a role="button" tabindex="0" class="${active === k ? 'on' : ''}" onclick="go('${k}')">${t}</a>`).join('')}</div>`;
      if (org) org.insertAdjacentHTML('afterend', html); else nav.insertAdjacentHTML('beforeend', html);
    }
    if (isAdm() || !PM.mine) return;
    nav.querySelectorAll('.sub a').forEach(a => { const k = SUB[a.textContent.trim()]; if (k && !mmCan(k)) a.remove(); });
    nav.querySelectorAll('.cat').forEach(b => {
      const k = CAT[label(b)];
      const sub = b.nextElementSibling && b.nextElementSibling.classList.contains('sub') ? b.nextElementSibling : null;
      const empty = sub && !sub.querySelector('a');
      if ((k && !mmCan(k)) || empty) { if (sub) sub.remove(); b.remove(); }
    });
    nav.querySelectorAll(':scope > .mm-nav-grp').forEach(g => { const nx = g.nextElementSibling; g.style.display = (!nx || nx.classList.contains('mm-nav-grp')) ? 'none' : ''; });
  }
  const renderSidePm = renderSide;
  renderSide = function(active){
    const r = renderSidePm.apply(this, arguments);
    const uid = (typeof SESSION !== 'undefined' && SESSION.user && (SESSION.user.uid || SESSION.user.id)) || '';
    if (uid !== PM.uid) { PM.uid = uid; PM.mine = null; }
    if (!PM.mine && !isAdm()) loadMine();
    document.documentElement.classList.toggle('mm-role-staff', myRole() === 'staff');
    try { applyMenu(active); } catch (e) { console.warn('권한 메뉴 실패', e); }
    return r;
  };

  const goPm = go;
  go = function(p, t){
    if (p === 'perm-set') {
      if (!isAdm()) { toast('관리자만 볼 수 있어요.'); return goPm('dash'); }
      closeSide(); window.__curPage = p; renderSide(p); window.scrollTo(0, 0); pagePerm(); return;
    }
    if (PAGE[p] && !mmCan(PAGE[p])) { toast('이 메뉴를 볼 권한이 없어요. 관리자에게 문의해주세요.'); return goPm('dash'); }
    return goPm(p, t);
  };

  /* ---------- 등급·권한 설정 화면 ---------- */
  function pagePerm(){
    document.getElementById('main').innerHTML = simpleHero(['사용자 관리', '등급·권한 설정'], 'USERS · PERMISSIONS', '등급·권한 설정',
      '등급마다 볼 수 있는 메뉴를 체크로 정해요. 저장하면 각 직원이 다음에 화면을 열 때부터 적용돼요.') +
      `<section class="card"><div id="pm-body"><div class="pm-empty">불러오는 중...</div></div></section>` + pageFoot();
    SB.rpc('perm_data').then(({ data, error }) => {
      if (error) { document.getElementById('pm-body').innerHTML = `<div class="pm-empty">불러오지 못했어요: ${h(error.message)}</div>`; return; }
      PM.data = data; PM.edit = {};
      (data.rows || []).forEach(r => { PM.edit[r.role + '|' + r.perm] = !!r.allowed; });
      drawPerm();
    });
  }
  window.pmToggle = function(el){ PM.edit[el.dataset.k] = el.checked; pmDirty(); };
  function pmDirty(){
    const changed = (PM.data.rows || []).filter(r => PM.edit[r.role + '|' + r.perm] !== !!r.allowed).length;
    const b = document.getElementById('pm-save'); if (b) { b.disabled = !changed; b.textContent = changed ? `저장 (${changed}칸 바뀜)` : '저장'; }
  }
  function drawPerm(){
    const D = PM.data, cnt = D.counts || {};
    let grp = '';
    const rows = PERMS.map(([k, name, g, now]) => {
      const head = g !== grp ? `<tr class="pm-g"><td colspan="5">${h(g)}</td></tr>` : ''; grp = g;
      return head + `<tr><td class="pm-n">${h(name)}${now ? '' : '<span class="pm-soon" title="체크는 저장되고, 화면 안 기능 막기는 다음 단계에서 적용돼요">곧 적용</span>'}</td>
        <td class="pm-c"><span class="pm-fix" title="관리자는 항상 허용">✓</span></td>
        ${['hq', 'store', 'staff'].map(r => `<td class="pm-c"><input type="checkbox" data-k="${r}|${k}" ${PM.edit[r + '|' + k] ? 'checked' : ''} onchange="pmToggle(this)" aria-label="${h(window.MM_ROLE_LABEL[r])} ${h(name)}"></td>`).join('')}</tr>`;
    }).join('');
    document.getElementById('pm-body').innerHTML = `
      <div class="pm-top"><p>관리자 칸은 항상 전부 허용이에요. <b>사용자 관리 · 등급·권한 설정 · 입사 서류 개인정보</b>는 관리자만 볼 수 있게 고정돼 있어요.<br>매장 관리자·매장 사원은 체크를 켜도 자기 매장 자료만 보여요.</p>
        <button class="btn primary" id="pm-save" disabled onclick="pmSave()">저장</button></div>
      <div class="pm-wrap"><table class="pm-t"><thead><tr><th>메뉴</th>${ROLES.map(([r, n]) => `<th class="pm-c">${h(n)}<small>${cnt[r] || 0}명</small></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
      <div class="pm-foot">${D.upd ? '마지막 변경 ' + h(D.upd) : ''}</div>`;
  }
  window.pmSave = function(){
    const list = (PM.data.rows || []).filter(r => PM.edit[r.role + '|' + r.perm] !== !!r.allowed).map(r => ({ role: r.role, perm: r.perm, allowed: PM.edit[r.role + '|' + r.perm] }));
    if (!list.length) return;
    const b = document.getElementById('pm-save'); b.disabled = true; b.textContent = '저장 중...';
    SB.rpc('perm_save', { p_rows: list }).then(({ data, error }) => {
      if (error) { toast('저장하지 못했어요: ' + error.message); return pmDirty(); }
      PM.data = data; toast(`권한 ${list.length}칸을 저장했어요.`); drawPerm();
    });
  };

  const st = document.createElement('style');
  st.textContent = `
  .pm-empty{text-align:center;color:#909b84;font-size:12px;padding:40px 10px}
  .pm-top{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;margin-bottom:14px}
  .pm-top p{margin:0;font-size:12px;color:#6c7365;line-height:1.7}
  .pm-top .btn{flex:none;white-space:nowrap}
  .pm-wrap{overflow-x:auto;border:1px solid #eceee7;border-radius:10px}
  .pm-t{width:100%;border-collapse:collapse;font-size:13px;min-width:520px}
  .pm-t th{background:#f6f7f3;color:#5c6653;font-weight:600;font-size:12px;text-align:left;padding:10px 12px;position:sticky;top:0}
  .pm-t th small{display:block;font-weight:400;font-size:10.5px;color:#9aa093;margin-top:2px}
  .pm-t td{border-top:1px solid #f0f1ec;padding:8px 12px}
  .pm-t .pm-c{text-align:center;width:96px}
  .pm-t input[type=checkbox]{width:17px;height:17px;cursor:pointer;accent-color:#22311f}
  .pm-fix{color:#22311f;font-weight:700;font-size:14px;opacity:.55}
  .pm-t tr.pm-g td{background:#fbfbf8;font-size:11px;font-weight:700;color:#7d8574;padding:6px 12px;letter-spacing:.02em}
  .pm-t tbody tr:not(.pm-g):hover td{background:#fafbf7}
  .pm-soon{margin-left:8px;font-size:10.5px;padding:1px 6px;border-radius:5px;background:#f5efe0;color:#8a6d2b;vertical-align:1px}
  .pm-foot{font-size:11px;color:#a0a796;margin-top:10px;text-align:right}
  /* 매장 사원에게는 시프트 화면의 휴무 카운터(슈퍼바이저 포함) 숨김 */
  html.mm-role-staff #sh-body .dm-shlay > div > section:nth-child(2){display:none!important}
  @media(max-width:760px){.pm-top{flex-direction:column}.pm-top .btn{width:100%}.pm-t .pm-c{width:64px;padding:8px 4px}.pm-t th{padding:8px 6px}}`;
  document.head.appendChild(st);

  // 로그인 직후 권한 받아오기
  setTimeout(loadMine, 0);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !isAdm()) { PM.mine = null; loadMine(); } });
})();
