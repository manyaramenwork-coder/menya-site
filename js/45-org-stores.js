
/* ==========================================================
   조직도 · 회사·조직 설정 · 직영점 관리(직원 현황 · 시프트 관리) (2026-11-07)
   - 메뉴: 운영 > 조직도 / 운영 > 직영점 관리(직원 현황·시프트 관리·출결 관리) / 관리 > 회사·조직 설정(관리자, 본사 인원 포함)
   - 데이터: Supabase 함수(dm_boot, org_*, staff_*, shift_*) — 표는 직접 못 읽고 함수로만 읽고 씀
   - 기존 코드는 고치지 않고, 마지막 renderSide · go 뒤에 붙임
   ========================================================== */
(function(){
  const WD = ['월','화','수','목','금','토','일'];
  const SLOT = {L:'런치', D:'디너', F:'풀타임'};
  const CODE = {F:'출근', L:'런치만', D:'디너만', LW:'런치', DW:'디너', H:'반휴무', O:'휴무', V:'월차', N:'—'};
  const CODES = ['F','L','D','LW','DW','H','O','V','N'];
  const CODE_ST = {F:'출근', LW:'런치', DW:'디너', L:'런치만(반휴)', D:'디너만(반휴)', O:'휴무', V:'월차'};
  const CODE_PT = {F:'풀타임', L:'런치', D:'디너', O:'휴무', N:'—'};
  const isPt = p => p && (p.kind === 'pt' || p.kind === 'tmp');
  const cOf = c => c === 'H' ? 'L' : c;
  const codesOf = (p, cur) => { const m = isPt(p) ? CODE_PT : CODE_ST, ks = Object.keys(m); if (p && p.kind === 'sup' && !ks.includes('N')) ks.push('N'); const c = cOf(cur); if (c && !ks.includes(c)) ks.push(c); return ks.map(k => [k, m[k] || CODE[k]]); };
  const labOf = (p, c) => { c = cOf(c); return (isPt(p) ? CODE_PT : CODE_ST)[c] || CODE[c] || ''; };
  const COLORS = ['#5b6b4e','#c62429','#2a6fb0','#c08a00','#7a4fa0','#c25a8a','#46708f','#2b8a6e','#8a8476','#b5562b','#3f8f8f','#9a4f6a'];
  const BCOLS = ['#c62429','#8a5a2b','#2a6fb0','#2b8a6e','#7a4fa0','#c08a00'];
  const REGIONS = ['수도권','강원','충청','경상','전라','제주'];
  const DUTY = ['홀','주방'];
  const BANKS = ['국민','신한','우리','하나','농협','기업','카카오뱅크','토스뱅크','케이뱅크','새마을금고','우체국','수협','신협','SC제일','iM뱅크(대구)','부산','경남','광주','전북','제주','씨티','산업'];
  const DOCS = [['rrn','주민번호'],['bank','급여 계좌'],['idc','신분증 사본'],['ctr','근로계약서']];
  const PAGES = { org:'연락망', 'bs-set':'회사·조직 설정', 'dm-staff':'직원 현황', 'dm-shift':'시프트 관리' };
  const DM = { boot:null, store:null };
  try { DM.store = +localStorage.getItem('dm-store') || null; } catch(e) {}

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const SESS = () => (typeof SESSION !== 'undefined' ? SESSION : null);
  const role = () => { const S = SESS(); return (S && S.user && S.user.role) || ''; };
  const isAdmin = () => role() === 'admin';
  const isHQ = () => role() === 'admin' || role() === 'hq';
  const ready = () => { const S = SESS(); return !!(S && S.user && !S.mustChange && window.SB); };
  const colorOf = id => COLORS[Math.abs(+id || 0) % COLORS.length];
  const fmtD = d => d ? String(d).slice(2,10).replace(/-/g,'.') : '';
  const daysTxt = ds => !ds || !ds.length ? '' : ds.length === 7 ? '매일' : ds.slice().sort().map(i => WD[i]).join('·');
  const pad = n => String(n).padStart(2,'0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
  const miss = '<span class="dm-miss">미입력</span>';
  const errMsg = e => (e && (e.message || e.details)) ? String(e.message || e.details).replace(/^.*?:\s*/, '') : '다시 시도해 주세요';
  async function rpc(fn, args){
    const { data, error } = await window.SB.rpc(fn, args || {});
    if (error) throw error;
    return data;
  }
  async function boot(force){
    if (DM.boot && !force) return DM.boot;
    DM.boot = await rpc('dm_boot');
    const ids = DM.boot.direct.map(s => s.id);
    if (!ids.includes(DM.store)) DM.store = DM.boot.my_store && ids.includes(DM.boot.my_store) ? DM.boot.my_store : (ids[0] || null);
    return DM.boot;
  }
  function setStore(id){ DM.store = id; try { localStorage.setItem('dm-store', id); } catch(e) {} }
  const main = () => document.getElementById('main');
  const loading = t => `<section class="card"><div class="dm-empty">${t || '불러오는 중...'}</div></section>`;

  /* ---------- 공통 창 ---------- */
  function modal(title, sub, body, foot, wide){
    closeModal();
    const m = document.createElement('div'); m.id = 'dm-modal';
    m.innerHTML = `<div class="dm-mbg" onclick="dmClose()"></div><div class="dm-mbox ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="dm-mh"><strong>${esc(title)}</strong><button class="dm-x" onclick="dmClose()" aria-label="닫기">✕</button></div>
      ${sub ? `<div class="dm-msub">${sub}</div>` : ''}<div class="dm-mbody">${body}</div><div class="dm-mfoot">${foot || ''}</div></div>`;
    document.body.appendChild(m);
    setTimeout(() => m.querySelector('input:not([type=checkbox]):not([disabled]),select')?.focus(), 40);
  }
  function closeModal(){ document.getElementById('dm-modal')?.remove(); }
  window.dmClose = closeModal;
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  const foot = (save, extra) => `${extra || ''}<span style="flex:1"></span><button class="dmb" onclick="dmClose()">취소</button><button class="dmb pri" onclick="${save}">저장</button>`;
  async function run(btn, fn, okMsg){
    if (btn) { btn.disabled = true; }
    try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
    catch (e) { console.warn(e); toast('저장하지 못했어요: ' + errMsg(e)); throw e; }
    finally { if (btn) btn.disabled = false; }
  }

  function storeTabs(withHQ, onPick){
    const b = DM.boot; if (!b) return '';
    const hq = withHQ && isHQ();
    const tabs = (hq ? [{id:'hq', name:'본사'}] : []).concat(b.direct);
    if (tabs.length <= 1) return '';
    return `<div class="dm-stabs" role="tablist">${tabs.map(s => `<button class="${String(DM.cur) === String(s.id) ? 'on' : ''}" onclick="${onPick}('${s.id}')">${esc(s.name)}${s.status === '오픈준비' ? ' <small>오픈 준비</small>' : ''}</button>`).join('')}</div>`;
  }

  /* ==========================================================
     조직도
     ========================================================== */
  const ORG = { data:null, open:new Set(['corp','hq']), sel:null, q:'' };
  async function pageOrg(){
    main().innerHTML = simpleHero(['연락망'], 'DIRECTORY', '연락망', '묶음을 누르면 선을 따라 아래로 펼쳐지고, 이름을 누르면 옆에 입사년도·직급·연락처가 나와요.')
      + `<div class="dm-orgbar"><input class="dm-search" id="org-q" placeholder="이름·매장명 검색" oninput="dmOrgQ(this.value)" aria-label="이름·매장명 검색"></div>
         <div class="dm-dir"><section class="dm-tree" id="org-tree">${'<div class="dm-empty">불러오는 중...</div>'}</section><aside class="dm-pcard" id="org-card"></aside></div>` + pageFoot();
    try { ORG.data = await rpc('org_data'); } catch (e) { document.getElementById('org-tree').innerHTML = `<div class="dm-empty">연락망을 불러오지 못했어요. (${esc(errMsg(e))})</div>`; return; }
    const d = ORG.data;
    if (!ORG.inited) { ORG.inited = true; d.brands.filter(b => b.status !== '폐점').forEach(b => ORG.open.add('b' + b.id)); d.stores.filter(s => s.direct).forEach(s => { if (s.id === d.my_store || ORG.open.size < 6) ORG.open.add('s' + s.id); }); }
    orgDraw();
  }
  function orgTree(){
    const d = ORG.data, hq = d.role === 'admin' || d.role === 'hq';
    const person = p => ({ ...p, org: p.store_id ? (d.stores.find(s => s.id === p.store_id)?.name || '') : '본사' });
    const ceo = { k:'ceo', t:'대표', ppl:[{ id:'ceo', ceo:true, name: d.company?.ceo_name || '대표님', rank: d.company?.ceo_title || '대표이사', tel: d.company?.ceo_tel, org:'대표', noname: !d.company?.ceo_name }] };
    const hqN = { k:'hq', t:'본사', ppl: d.people.filter(p => p.kind === 'hq').map(person) };
    const brands = d.brands.map(b => {
      const direct = d.stores.filter(s => s.brand_id === b.id && s.direct).map(s => ({ k:'s'+s.id, t:s.name, badge:'직영', soon: s.status === '오픈준비',
        ppl: d.people.filter(p => p.store_id === s.id).map(person) }));
      const fr = d.stores.filter(s => s.brand_id === b.id && !s.direct);
      const regions = [...new Set(fr.map(s => s.region || '지역 미지정'))].sort((a,b2) => (a === '지역 미지정') - (b2 === '지역 미지정') || a.localeCompare(b2,'ko'));
      const kids = direct.slice();
      if (hq && fr.length) kids.push({ k:'f'+b.id, t:'가맹점', lock:true, kids: regions.map(r => ({ k:'f'+b.id+r, t:r,
        ppl: fr.filter(s => (s.region || '지역 미지정') === r).map(s => ({ id:'st'+s.id, store:true, name:s.name, owner:s.owner, sv:s.sv, tel:s.owner_tel, org:`${b.name} · 가맹점 · ${r}` })) })) });
      return { k:'b'+b.id, t:b.name, brand:true, closed: b.status === '폐점', soon: b.status === '오픈준비', kids };
    });
    return { k:'corp', t: d.company?.name || '멘야마쯔리(주)', root:true, kids:[ceo, hqN, ...brands] };
  }
  const cnt = n => n.kids ? n.kids.reduce((a,k) => a + cnt(k), 0) : (n.ppl || []).length;
  const match = p => ORG.q && (String(p.name).includes(ORG.q) || String(p.owner || '').includes(ORG.q));
  const hasMatch = n => n.kids ? n.kids.some(hasMatch) : (n.ppl || []).some(match);
  function orgNode(n){
    const open = ORG.q ? hasMatch(n) : ORG.open.has(n.k);
    const head = `<button class="dm-nh ${n.root ? 'root' : ''} ${n.brand ? 'brand' : ''}" onclick="dmOrgTog('${esc(n.k)}')" aria-expanded="${open}"><span class="ar">▶</span>${esc(n.t)} <span class="c">${n.soon && !cnt(n) ? '' : cnt(n)}</span>${n.badge ? `<span class="bdg">${n.badge}</span>` : ''}${n.soon ? '<span class="tag">오픈 준비</span>' : ''}${n.closed ? '<span class="tag off">현재 폐점</span>' : ''}${n.lock ? '<span class="lk">🔒 본사·관리자만</span>' : ''}</button>`;
    let body;
    if (n.kids) body = n.kids.map(orgNode).join('') || `<div class="dm-ek">${n.closed ? '현재 운영 중인 매장이 없어요.' : '아직 매장이 없어요.'}</div>`;
    else if (n.ppl.length) body = n.ppl.map(p => `<div class="dm-pp ${ORG.sel && ORG.sel.id === p.id ? 'on' : ''} ${match(p) ? 'hit' : ''}" onclick="dmOrgSel('${esc(p.id)}')"><b>${esc(p.name)}</b>${!p.store && p.rank ? `<span class="dm-rk">${esc(p.rank)}</span>` : ''}${p.store && p.owner ? `<span class="dm-rk dm-ow">${esc(p.owner)}</span>` : ''}<span class="r">${p.store ? (p.sv ? '담당 S.V ' + esc(p.sv) : '') : esc(personRole(p))}</span>${p.locked ? '<span class="lk2">🔒</span>' : `<span class="tel2">${p.tel ? esc(mmTel(p.tel)) : (p.store ? '연락처 미입력' : '')}</span>`}</div>`).join('');
    else body = `<div class="dm-ek">${n.soon ? '직원 현황에 등록하면 자동으로 나와요.' : '없음'}</div>`;
    return `<div class="dm-node ${open ? 'open' : ''}">${head}<div class="dm-kids">${body}</div></div>`;
  }
  function personRole(p){
    if (p.kind === 'hq' || p.ceo) return [p.rank, p.duty].filter(Boolean).join(' · ');
    if (p.kind === 'staff') return `${p.rank || '직원'} · 주${p.wk || 6}일`;
    if (p.kind === 'pt') return `${p.rank || 'PT'} · ${daysTxt(p.days)} ${SLOT[p.slot] || ''}`;
    return p.rank || '';
  }
  function allPeople(n, out){ out = out || []; if (n.kids) n.kids.forEach(k => allPeople(k, out)); else (n.ppl || []).forEach(p => out.push(p)); return out; }
  function orgDraw(){
    const t = orgTree();
    document.getElementById('org-tree').innerHTML = `<div class="dm-th"><b>전체</b><small>${cnt(t)}</small><button class="dm-all" onclick="dmOrgAll()">${ORG.open.size > 4 ? '모두 접기' : '+ 모두 펼치기'}</button></div>` + orgNode(t);
    const p = ORG.sel, C = document.getElementById('org-card');
    C.classList.toggle('on', !!p);
    if (!p) { C.innerHTML = '<div class="dm-none">왼쪽에서 이름을 누르면<br>여기에 연락처가 나와요.</div>'; return; }
    const telRow = p.locked ? '🔒 매장 관리자 이상' : (p.tel ? esc(mmTel(p.tel)) : miss);
    C.innerHTML = `<button class="dm-x cx" onclick="dmOrgSel(null)" aria-label="닫기">✕</button>
      <div class="pc-top"><div class="av4 ${p.store ? 'store' : ''}" style="${p.store || p.ceo ? '' : `background:${colorOf(p.id)}`}">${p.ceo ? '대표' : esc(String(p.name).slice(-2))}</div><div><h3>${esc(p.name)}</h3><p>${esc(p.org || '')}</p></div></div>
      <div class="pc-rows">${p.store
        ? `<div><span>점주</span><b>${p.owner ? esc(p.owner) : miss}</b></div><div><span>담당 S.V</span><b>${p.sv ? esc(p.sv) : miss}</b></div><div><span>연락처</span><b>${telRow}</b></div>`
        : `${p.ceo ? '' : `<div><span>입사년도</span><b>${p.start ? String(p.start).slice(0,4) + '년' : miss}</b></div>`}<div><span>이름</span><b>${esc(p.name)}${p.noname ? ' <span class="dm-miss">이름 미입력</span>' : ''}</b></div><div><span>직급</span><b>${esc(personRole(p)) || miss}</b></div><div><span>연락처</span><b>${telRow}</b></div>`}</div>
      ${!p.locked && p.tel ? `<div class="pc-act"><a class="dmb pri" href="tel:${esc(p.tel)}">📞 전화</a><a class="dmb" href="sms:${esc(p.tel)}">💬 문자</a></div>`
        : p.locked ? '<div class="pc-lock">같은 매장 동료 번호는 매장 관리자에게 물어봐 주세요.</div>'
        : `<div class="pc-lock">${p.ceo ? '대표 정보는 회사·조직 설정에서 넣어요.' : p.store ? '점주명·연락처는 회사·조직 설정에서 넣어요.' : '연락처는 직원 현황에서 넣어요.'}</div>`}`;
  }
  window.dmOrgTog = k => { if (ORG.q) return; ORG.open.has(k) ? ORG.open.delete(k) : ORG.open.add(k); orgDraw(); };
  window.dmOrgAll = () => { const t = orgTree(); if (ORG.open.size > 4) ORG.open = new Set(['corp']); else { const walk = n => { ORG.open.add(n.k); (n.kids || []).forEach(walk); }; walk(t); } orgDraw(); };
  window.dmOrgSel = id => { ORG.sel = id == null ? null : allPeople(orgTree()).find(p => String(p.id) === String(id)) || null; orgDraw(); };
  window.dmOrgQ = v => { ORG.q = v.trim(); orgDraw(); };

  /* ==========================================================
     회사·조직 설정 (관리자)
     ========================================================== */
  const BS = { d:null, fb:'', ft:'', fs:'live', q:'' };
  const STL = { '운영':'run', '영업중':'run', '오픈준비':'soon', '폐점':'off' };
  async function pageBS(){
    if (!isAdmin()) { main().innerHTML = simpleHero(['관리','회사·조직 설정'], 'SETTINGS', '회사·조직 설정', '관리자만 볼 수 있어요.') + pageFoot(); return; }
    main().innerHTML = simpleHero(['관리','회사·조직 설정'], 'SETTINGS', '회사·조직 설정', '회사 · 본사 인원 · 브랜드 · 매장을 한곳에서 정해요. 여기서 정한 내용이 연락망, 직원 현황, 시프트·출결, 가맹점 현황에 쓰여요. (관리자만 보여요)')
      + `<div id="bs-co"></div><section class="card" id="bs-hq"><div class="dm-sh"><strong>본사 인원</strong><small>연락망의 본사 칸이 이 명단으로 채워져요 · 매장 지원은 직원 현황 &gt; 매장 탭 &gt; 본사에서 불러오기</small></div><div id="st-body">${loading()}</div></section><div id="bs-body">${loading()}</div>` + pageFoot();
    DM.cur = 'hq'; ST.view = 'on';
    try { BS.d = await rpc('org_settings'); } catch (e) { document.getElementById('bs-body').innerHTML = loading('불러오지 못했어요: ' + esc(errMsg(e))); return; }
    bsDraw(); stLoad();
  }
  function bsDraw(){
    const d = BS.d, c = d.company || {};
    const bOf = id => d.brands.find(b => b.id === id);
    const list = d.stores.filter(s => (!BS.fb || String(s.brand_id) === BS.fb) && (!BS.ft || (BS.ft === 'dm') === !!s.direct)
      && (BS.fs === 'all' || (BS.fs === 'live' ? s.status !== '폐점' : s.status === BS.fs)) && (!BS.q || s.name.includes(BS.q) || (s.owner || '').includes(BS.q)));
    document.getElementById('bs-co').innerHTML = `
      <section class="card"><div class="dm-sh"><strong>회사</strong><small>연락망 맨 위에 나와요</small><button class="dmb sm" style="margin-left:auto" onclick="dmBsCompany()">수정</button></div>
        <div class="dm-kv3"><div><span>회사명</span><b>${esc(c.name) || miss}</b></div><div><span>대표</span><b>${c.ceo_name ? esc(c.ceo_name) + ' <small>' + esc(c.ceo_title || '') + '</small>' : miss}</b></div><div><span>대표 연락처</span><b>${c.ceo_tel ? esc(mmTel(c.ceo_tel)) : miss}</b></div></div></section>`;
    document.getElementById('bs-body').innerHTML = `
      <section class="card"><div class="dm-sh"><strong>브랜드</strong><small>${d.brands.length}개 · 연락망에서 회사 아래 갈래가 돼요</small></div>
        <div class="dm-brands">${d.brands.map(b => { const ss = d.stores.filter(s => s.brand_id === b.id && s.status !== '폐점');
          return `<div class="dm-bc" style="--bcol:${esc(b.color)}"><h3>${esc(b.name)} <span class="dm-st ${STL[b.status]}">${b.status === '운영' ? '운영 중' : b.status === '오픈준비' ? '오픈 준비' : '폐점'}</span></h3>
            <div class="meta">직영점 ${ss.filter(s => s.direct).length}곳 · 가맹점 ${ss.filter(s => !s.direct).length}곳</div>
            <div class="links">${Object.keys(b.links || {}).filter(k => b.links[k]).map(k => `<span>${esc(k)}</span>`).join('') || '<span class="na">채널 링크 없음</span>'}</div>
            <button class="dmb sm" style="margin-top:10px" onclick="dmBsBrand(${b.id})">수정</button></div>`; }).join('')}
          <button class="dm-bc add" onclick="dmBsBrand()"><b>＋</b><br>브랜드 추가</button></div></section>
      <section class="card"><div class="dm-sh"><strong>매장</strong><small>직영점·가맹점을 모두 여기서 관리해요</small><button class="dmb pri" style="margin-left:auto" onclick="dmBsStore()">+ 매장 추가</button></div>
        <div class="dm-note">FC다움을 그만 쓰게 되면 가맹점도 여기서 직접 등록해요. 나중에 가맹점용 홈페이지를 만들 때도 이 매장 목록을 그대로 써요.</div>
        <div class="dm-flt">
          <select onchange="dmBsF('fb',this.value)" aria-label="브랜드"><option value="">브랜드 전체</option>${d.brands.map(b => `<option value="${b.id}" ${BS.fb === String(b.id) ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
          <select onchange="dmBsF('ft',this.value)" aria-label="구분"><option value="">직영·가맹 전체</option><option value="dm" ${BS.ft === 'dm' ? 'selected' : ''}>직영점</option><option value="fr" ${BS.ft === 'fr' ? 'selected' : ''}>가맹점</option></select>
          <select onchange="dmBsF('fs',this.value)" aria-label="상태"><option value="live" ${BS.fs === 'live' ? 'selected' : ''}>폐점 빼고</option><option value="영업중" ${BS.fs === '영업중' ? 'selected' : ''}>영업 중</option><option value="오픈준비" ${BS.fs === '오픈준비' ? 'selected' : ''}>오픈 준비</option><option value="폐점" ${BS.fs === '폐점' ? 'selected' : ''}>폐점</option><option value="all" ${BS.fs === 'all' ? 'selected' : ''}>전체</option></select>
          <input class="dm-search sm" placeholder="매장·점주 검색" value="${esc(BS.q)}" oninput="dmBsF('q',this.value,1)" aria-label="매장·점주 검색">
          <span class="dm-cnt">${list.length}곳</span></div>
        <div class="dm-tw"><table class="dm-t"><thead><tr><th>매장명</th><th>브랜드</th><th>구분</th><th>지역</th><th>상태</th><th>점주</th><th>담당 S.V</th><th></th></tr></thead><tbody id="bs-rows">${bsRows(list, bOf)}</tbody></table></div></section>`;
  }
  function bsRows(list, bOf){
    return list.length ? list.map(s => { const b = bOf(s.brand_id); return `<tr>
      <td><b>${esc(s.name)}</b></td><td>${b ? `<span class="dm-bt"><i style="background:${esc(b.color)}"></i>${esc(b.name)}</span>` : '<span class="na">미지정</span>'}</td>
      <td><span class="dm-ty ${s.direct ? 'dm' : 'fr'}">${s.direct ? '직영' : '가맹'}</span></td><td>${esc(s.region) || '<span class="na">미지정</span>'}</td>
      <td><span class="dm-st ${STL[s.status] || 'off'}">${s.status === '오픈준비' ? '오픈 준비' : esc(s.status || '-')}</span></td>
      <td>${s.direct ? '<span class="na">직영</span>' : (s.owner ? esc(s.owner) : miss)}</td><td>${s.sv ? esc(s.sv) : '<span class="na">미지정</span>'}</td>
      <td><button class="dmb sm" onclick="dmBsStore(${s.id})">수정</button></td></tr>`; }).join('') : '<tr><td colspan="8" class="dm-empty">조건에 맞는 매장이 없어요.</td></tr>';
  }
  window.dmBsF = (k, v, keep) => { BS[k] = v; if (keep) { const d = BS.d; const bOf = id => d.brands.find(b => b.id === id);
      const list = d.stores.filter(s => (!BS.fb || String(s.brand_id) === BS.fb) && (!BS.ft || (BS.ft === 'dm') === !!s.direct) && (BS.fs === 'all' || (BS.fs === 'live' ? s.status !== '폐점' : s.status === BS.fs)) && (!BS.q || s.name.includes(BS.q) || (s.owner || '').includes(BS.q)));
      document.getElementById('bs-rows').innerHTML = bsRows(list, bOf); document.querySelector('.dm-cnt').textContent = list.length + '곳'; } else bsDraw(); };
  window.dmBsCompany = () => { const c = BS.d.company || {};
    modal('회사 정보', '연락망 맨 위 대표 칸에 나와요.', `<div class="dm-fg">
      <label class="f2 wide"><span>회사명</span><input id="c-n" value="${esc(c.name)}"></label>
      <label class="f2"><span>대표 이름</span><input id="c-ceo" value="${esc(c.ceo_name)}"></label>
      <label class="f2"><span>직함</span><input id="c-t" value="${esc(c.ceo_title || '대표이사')}"></label>
      <label class="f2 wide"><span>대표 연락처 <em>(연락망에서 전 직원에게 보여요)</em></span><input id="c-tel" type="tel" value="${esc(mmTel(c.ceo_tel))}" placeholder="010-0000-0000"></label></div>`, foot('dmBsCompanySave(this)'));
  };
  window.dmBsCompanySave = async btn => { const v = id => document.getElementById(id).value;
    await run(btn, () => rpc('org_company_save', { p:{ name:v('c-n'), ceo_name:v('c-ceo'), ceo_title:v('c-t'), ceo_tel:v('c-tel') } }), '저장했어요.');
    closeModal(); pageBS(); };
  let BF = null;
  window.dmBsBrand = id => { const b = id ? BS.d.brands.find(x => x.id === id) : null;
    BF = b ? JSON.parse(JSON.stringify(b)) : { name:'', status:'오픈준비', color: BCOLS[BS.d.brands.length % BCOLS.length], links:{} };
    const draw = () => modal(b ? `${b.name} · 브랜드 수정` : '브랜드 추가', '연락망·직원 현황·시프트·브랜드 채널에서 이 브랜드 기준으로 나눠 보여요.', `<div class="dm-fg">
      <label class="f2"><span>브랜드명</span><input id="b-n" value="${esc(BF.name)}" oninput="dmBF.name=this.value"></label>
      <div class="f2"><span>표시 색</span><div class="dm-cols">${BCOLS.map(c => `<button type="button" class="${BF.color === c ? 'on' : ''}" style="background:${c}" onclick="dmBF.color='${c}';dmBF._d()" aria-label="색"></button>`).join('')}</div></div>
      <div class="f2 wide"><span>상태</span><div class="dm-seg">${[['운영','운영 중'],['오픈준비','오픈 준비'],['폐점','폐점']].map(([k,t]) => `<button type="button" class="${BF.status === k ? 'on' : ''}" onclick="dmBF.status='${k}';dmBF._d()">${t}</button>`).join('')}</div></div>
      <div class="f2 wide"><span>브랜드 채널 링크</span>${['홈페이지','블로그','인스타그램','유튜브'].map(l => `<div class="dm-lrow"><b>${l}</b><input placeholder="https://" value="${esc(BF.links[l] || '')}" oninput="dmBF.links['${l}']=this.value"></div>`).join('')}</div></div>`,
      foot(`dmBsBrandSave(this,${b ? b.id : 'null'})`));
    BF._d = () => { const n = document.getElementById('b-n')?.value; if (n != null) BF.name = n; draw(); };
    window.dmBF = BF; draw(); };
  window.dmBsBrandSave = async (btn, id) => { const p = { id, name:BF.name, status:BF.status, color:BF.color, links:Object.fromEntries(Object.entries(BF.links).filter(([,v]) => v && v.trim())) };
    await run(btn, () => rpc('org_brand_save', { p }), '저장했어요.'); closeModal(); DM.boot = null; pageBS(); };
  let SF = null;
  window.dmBsStore = id => { const s = id ? BS.d.stores.find(x => x.id === id) : null;
    SF = s ? { ...s } : { name:'', brand_id:(BS.d.brands[0] || {}).id, direct:false, region:'', status:'영업중', sv:'', owner:'', owner_tel:'', open:'', close:'' };
    const draw = () => modal(s ? `${s.name} · 매장 수정` : '매장 추가', '직영점은 직원 현황·시프트·출결에, 가맹점은 연락망에 나와요.', `<div class="dm-fg">
      <label class="f2"><span>매장명</span><input id="s-n" value="${esc(SF.name)}" oninput="dmSF.name=this.value"></label>
      <label class="f2"><span>브랜드</span><select onchange="dmSF.brand_id=+this.value">${BS.d.brands.map(b => `<option value="${b.id}" ${SF.brand_id === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>
      <div class="f2"><span>구분</span><div class="dm-seg">${[[true,'직영점'],[false,'가맹점']].map(([k,t]) => `<button type="button" class="${!!SF.direct === k ? 'on' : ''}" onclick="dmSF.direct=${k};dmSF._d()">${t}</button>`).join('')}</div></div>
      <label class="f2"><span>지역</span><select onchange="dmSF.region=this.value"><option value="">미지정</option>${REGIONS.map(r => `<option ${SF.region === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      <div class="f2 wide"><span>상태</span><div class="dm-seg">${[['영업중','영업 중'],['오픈준비','오픈 준비'],['폐점','폐점']].map(([k,t]) => `<button type="button" class="${SF.status === k ? 'on' : ''}" onclick="dmSF.status='${k}';dmSF._d()">${t}</button>`).join('')}</div></div>
      <label class="f2"><span>오픈일</span><input type="date" value="${esc(SF.open || '')}" onchange="dmSF.open=this.value"></label>
      <label class="f2"><span>폐점일</span><input type="date" value="${esc(SF.close || '')}" onchange="dmSF.close=this.value"></label>
      <label class="f2"><span>담당 S.V <em>(본사 명단에서)</em></span><select onchange="dmSF.sv=this.value"><option value="">미지정</option>${(BS.d.svs || []).map(v => `<option ${SF.sv === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label><div></div>
      ${SF.direct ? '' : `<div class="dm-frsec"><div class="h">🔒 가맹점 정보 · 본사·관리자만</div>
        <label class="f2"><span>점주명</span><input value="${esc(SF.owner || '')}" oninput="dmSF.owner=this.value"></label>
        <label class="f2"><span>점주 연락처</span><input type="tel" placeholder="010-0000-0000" value="${esc(mmTel(SF.owner_tel || ''))}" oninput="dmSF.owner_tel=this.value"></label></div>`}</div>`,
      foot(`dmBsStoreSave(this)`));
    SF._d = () => { const n = document.getElementById('s-n')?.value; if (n != null) SF.name = n; draw(); };
    window.dmSF = SF; draw(); };
  window.dmBsStoreSave = async btn => { const p = { ...SF }; delete p._d;
    await run(btn, () => rpc('org_store_save', { p }), '저장했어요.'); closeModal(); DM.boot = null; pageBS(); };

  /* ==========================================================
     직원 현황
     ========================================================== */
  const ST = { d:null, view:'on', sel:new Set() };
  async function pageStaff(){
    main().innerHTML = simpleHero(['직영점 관리','직원 현황'], 'STAFF', '직원 현황', '여기서 정한 구분·근무 형태·출근 요일·입사일·퇴사일로 시프트가 자동으로 채워져요.') + `<div id="st-body">${loading()}</div>` + pageFoot();
    try { await boot(); } catch (e) { document.getElementById('st-body').innerHTML = loading('불러오지 못했어요: ' + esc(errMsg(e))); return; }
    if (!isHQ() && role() !== 'store') { document.getElementById('st-body').innerHTML = loading('직원 현황은 관리자·본사·매장 관리자만 볼 수 있어요.'); return; }
    if (DM.cur == null || DM.cur === 'hq') DM.cur = DM.store;
    if (DM.cur == null) { document.getElementById('st-body').innerHTML = loading('직영점이 없어요. 회사·조직 설정에서 직영점을 먼저 추가해 주세요.'); return; }
    await stLoad();
  }
  async function stLoad(){
    const B = document.getElementById('st-body'); if (!B) return;
    ST.sel.clear();
    try { ST.d = await rpc('staff_data', { p_store: DM.cur === 'hq' ? null : +DM.cur }); }
    catch (e) { B.innerHTML = storeTabs(false, 'dmStPick') + loading('불러오지 못했어요: ' + esc(errMsg(e))); return; }
    stDraw();
    if (ST.d.admin) piSweep();
  }
  let piSwept = false;
  async function piSweep(){
    if (piSwept) return; piSwept = true;
    try {
      const due = await rpc('staff_pii_due');
      for (const d of due || []) {
        const { error } = await window.SB.storage.from('staff-idcards').remove([d.path]);
        if (!error) await rpc('staff_pii_idcard_set', { p_staff: d.staff_id, p_path: null });
      }
    } catch (e) { console.warn('신분증 사본 정리 실패', e); }
  }
  window.dmStPick = id => { DM.cur = id === 'hq' ? 'hq' : +id; if (id !== 'hq') setStore(+id); ST.view = 'on'; stLoad(); };
  const isOut = p => p.out && p.out < today();
  const offOf = p => p.off != null ? p.off : ({6:5, 5:9, 4:13}[p.wk || 6]);
  function stDraw(){
    const d = ST.d, B = document.getElementById('st-body'), adm = d.admin;
    const tabs = storeTabs(false, 'dmStPick');
    if (DM.cur === 'hq') {
      const on = d.list.filter(p => !isOut(p)), off = d.list.filter(isOut);
      B.innerHTML = `<div class="dm-bar">${vtabs(on.length, off.length)}<span class="dm-hint">${ST.view === 'on' ? '순서(▲▼)는 연락망 본사 칸 순서예요 · 이름을 누르면 상세·수정 · 대표님은 위 \'회사\'에서' : '재입사를 누르면 재직 중으로 돌아와요'}</span><button class="dmb pri" onclick="dmStEdit()">+ 본사 인원 추가</button></div>
        <div class="dm-tw"><table class="dm-t"><thead><tr>${ST.view === 'on' ? '<th class="dm-ord">순서</th>' : ''}<th>이름</th><th>직급</th><th>담당</th><th>입사일</th><th>연락처</th><th>지원 나가는 매장</th>${adm ? '<th>입사 서류</th>' : ''}<th></th></tr></thead><tbody>${
          (ST.view === 'on' ? on : off).map((p, i, a) => `<tr class="${isOut(p) ? 'out' : ''}">${ordCell(p, i, a)}<td>${nameBtn(p)}</td><td>${esc(p.rank) || miss}</td><td>${esc(p.duty) || '<span class="na">-</span>'}</td>
            <td>${p.start ? fmtD(p.start) : miss}</td><td>${telCell(p)}</td><td>${(p.stores || []).map(s => `<span class="dm-chip sup">${esc(s)}</span>`).join(' ') || '<span class="na">없음</span>'}</td>${adm ? `<td>${docCnt(p)}</td>` : ''}<td>${isOut(p) ? `<button class="dmb sm" onclick="dmStRehire(${p.id})">재입사</button>` : `<button class="dmb sm" onclick="dmStEdit(${p.id})">수정</button>`}</td></tr>`).join('') || `<tr><td colspan="9" class="dm-empty">${ST.view === 'on' ? '본사 인원이 없어요.' : '퇴사자가 없어요.'}</td></tr>`
        }</tbody></table></div>`;
      return;
    }
    const mine = d.list.filter(p => p.kind !== 'sup'), sup = d.list.filter(p => p.kind === 'sup');
    const on = mine.filter(p => !isOut(p)), off = mine.filter(isOut);
    const stf = on.filter(p => p.kind === 'staff'), pts = on.filter(p => p.kind === 'pt');
    const sName = id => (d.stores.find(s => s.id === +id) || {}).name || '';
    const mvChip = (p, from) => { const m = p.mv; if (!m) return '';
      return m.type === 'sup' ? `<span class="dm-chip sup">${from ? esc(from) + ' 소속 · ' : ''}${fmtD(m.date)}~${fmtD(m.end)} ${from ? '지원' : esc(sName(m.to)) + ' 지원'}</span>`
                              : `<span class="dm-chip mv">${from ? esc(from) + '에서 · ' : ''}${fmtD(m.date)}부터 ${from ? '이동' : '→ ' + esc(sName(m.to))}</span>`; };
    const head = col => `<thead><tr><th class="dm-ord">순서</th><th>이름</th><th>직급</th><th>${col}</th><th>입사일</th><th>변동 예정</th><th class="n">휴무 기준</th><th>연락처</th>${adm ? '<th>입사 서류</th>' : ''}</tr></thead>`;
    const row = (p, i, a) => `<tr>${ordCell(p, i, a)}<td>${isHQ() ? `<input type="checkbox" class="dm-pick" ${ST.sel.has(p.id) ? 'checked' : ''} onchange="dmStSel(${p.id},this.checked)" aria-label="${esc(p.name)} 선택">` : ''}${nameBtn(p)}${p.memo ? `<small class="dm-memo">${esc(p.memo)}</small>` : ''}</td>
      <td>${esc(p.rank) || '<span class="na">-</span>'}</td>
      <td>${p.kind === 'staff' ? `<span class="dm-wk">주${p.wk || 6}일</span> <small class="na">요일 변동</small>` : `${daysChips(p.days)} <span class="dm-slot s${p.slot || 'F'}">${SLOT[p.slot] || '풀타임'}</span>`}</td>
      <td>${p.start ? fmtD(p.start) : miss}</td><td>${p.mv ? mvChip(p) : p.out ? `<span class="dm-chip warn">${fmtD(p.out)} 퇴사</span>` : ''}</td>
      <td class="n">${p.kind === 'staff' ? `${offOf(p)}일${p.off == null ? ' <small class="na">자동</small>' : ''}` : '<span class="na">-</span>'}</td><td>${telCell(p)}</td>${adm ? `<td>${docCnt(p)}</td>` : ''}</tr>`;
    const tbl = (title, sub, list, col) => `<div class="dm-gh">${title} <small>${sub}</small></div>` + (list.length ? `<div class="dm-tw"><table class="dm-t">${head(col)}<tbody>${list.map(row).join('')}</tbody></table></div>` : '<div class="dm-ek2">없음</div>');
    const incHtml = d.incoming.length ? `<div class="dm-gh">다른 매장에서 오는 사람 <small>이동일부터 이 매장 시프트에 자동으로 나와요</small></div><div class="dm-inc">${d.incoming.map(p => `<div class="r"><i style="background:${colorOf(p.id)}"></i><b>${esc(p.name)}</b><span>${p.kind === 'staff' ? '직원' : '파트타이머'}</span>${mvChip(p, p.from)}${isHQ() ? `<button class="dmb sm" onclick="dmStMvCancel(${p.id})">이동 취소</button>` : ''}</div>`).join('')}</div>` : '';
    const supHtml = `<div class="dm-gh">지원 인력 <small>본사 소속 · 재직 인원·휴무 기준에서 빠져요</small>${isHQ() ? '<button class="dmb sm" style="margin-left:auto" onclick="dmStLink()">+ 본사에서 불러오기</button>' : ''}</div>`
      + (sup.length ? `<div class="dm-tw"><table class="dm-t"><thead><tr><th>이름</th><th>소속 · 직급</th><th>기본 지원</th><th>메모</th><th></th></tr></thead><tbody>${sup.map(s => `<tr><td><span class="dm-nm2"><i style="background:${colorOf(s.link_id)}"></i>${esc(s.name)}</span></td>
          <td><span class="dm-chip hqc">본사</span> ${esc([s.rank, s.duty].filter(Boolean).join(' · '))}</td>
          <td>${s.days && s.days.length ? daysChips(s.days) + ` <span class="dm-slot s${s.slot || 'F'}">${SLOT[s.slot] || '풀타임'}</span>` : '<span class="na">필요한 날만 시프트에서 넣기</span>'}</td><td>${esc(s.memo)}</td>
          <td>${isHQ() || role() === 'store' ? `<button class="dmb sm" onclick="dmStSup(${s.id})">지원 요일</button>` : ''} ${isHQ() ? `<button class="dmb sm" onclick="dmStUnlink(${s.id})">연결 해제</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="dm-ek2">연결된 지원 인력이 없어요.</div>');
    const storeName = (DM.boot.direct.find(s => s.id === +DM.cur) || {}).name || '';
    B.innerHTML = tabs + `<div class="dm-sum">
        <div><span>재직 인원</span><b>${on.length}<small>명</small></b><em>직원 ${stf.length} · 파트타이머 ${pts.length}</em></div>
        <div><span>지원 인력 (본사 소속)</span><b>${sup.length}<small>명</small></b></div>
        <div><span>입력이 덜 된 사람</span><b>${on.filter(p => !p.start || !p.tel).length}<small>명</small></b><em>입사일·연락처</em></div></div>
      <section class="card"><div class="dm-bar">${vtabs(on.length, off.length)}<span class="dm-hint">${ST.view === 'on' ? '순서(▲▼)는 시프트에 이름이 나오는 순서예요 · 이름을 누르면 상세·수정' : '퇴사자 기록은 지난 시프트·출결에 그대로 남아요'}</span><button class="dmb pri" onclick="dmStEdit()">+ ${esc(storeName)} 직원 추가</button></div>
      ${ST.view === 'on'
        ? incHtml + tbl('직원', `${stf.length}명 · 출근 요일 없이 주6일·주5일·주4일 · 시프트에서 쉬는 날만 골라요`, stf, '근무 형태') + tbl('파트타이머', `${pts.length}명 · 정해진 요일·시간대로 시프트가 채워져요`, pts, '출근 요일 · 시간대') + supHtml
        : (off.length ? `<div class="dm-tw"><table class="dm-t"><thead><tr><th>이름</th><th>직급</th><th>구분</th><th>입사일</th><th>퇴사일</th><th></th></tr></thead><tbody>${off.sort((a,b) => String(b.out).localeCompare(String(a.out))).map(p => `<tr class="out"><td>${nameBtn(p)}</td><td>${esc(p.rank)}</td><td>${p.kind === 'staff' ? '직원' : '파트타이머 · ' + (SLOT[p.slot] || '')}</td><td>${p.start ? fmtD(p.start) : miss}</td><td>${fmtD(p.out)}</td><td><button class="dmb sm" onclick="dmStRehire(${p.id})">재입사</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="dm-empty">퇴사자가 없어요.</div>')}
      </section>`;
    stBar();
  }
  const vtabs = (a, b) => `<div class="dm-tabs"><button class="${ST.view === 'on' ? 'on' : ''}" onclick="dmStView('on')">재직 중 ${a}</button><button class="${ST.view === 'off' ? 'on' : ''}" onclick="dmStView('off')">퇴사자 ${b}</button></div>`;
  const nameBtn = p => `<button class="dm-nm" onclick="dmStEdit(${p.id})"><i style="background:${colorOf(p.id)}"></i>${esc(p.name)}</button>`;
  const telCell = p => p.tel ? `<a class="dm-tel" href="tel:${esc(p.tel)}">${esc(mmTel(p.tel))}</a>` : miss;
  const daysChips = ds => `<span class="dm-days">${WD.map((w, i) => `<span class="${(ds || []).includes(i) ? 'on' : ''}">${w}</span>`).join('')}</span>`;
  const docCnt = p => { const d = (p.hire && p.hire.docs) || {}, x = p.pii || {}; const n = [x.rrn, x.acct, x.idc, d.ctr].filter(Boolean).length; return n === 4 ? '<span class="dm-chip ok">4/4 완료</span>' : `<span class="dm-miss">${n}/4</span>`; };
  const ordCell = (p, i, a) => ST.view === 'on' && !isOut(p) ? `<td class="dm-ord"><button onclick="dmStOrd(${p.id},-1)" ${i === 0 ? 'disabled' : ''} aria-label="위로">▲</button><button onclick="dmStOrd(${p.id},1)" ${i === a.length - 1 ? 'disabled' : ''} aria-label="아래로">▼</button></td>` : (ST.view === 'on' ? '<td></td>' : '');
  window.dmStView = v => { ST.view = v; stDraw(); };
  window.dmStSel = (id, on) => { on ? ST.sel.add(id) : ST.sel.delete(id); stBar(); };
  function stBar(){
    let b = document.getElementById('dm-selbar'); if (!b) { b = document.createElement('div'); b.id = 'dm-selbar'; document.body.appendChild(b); }
    const ok = ST.sel.size && document.getElementById('st-body');
    b.className = ok ? 'on' : '';
    const names = ok ? ST.d.list.filter(p => ST.sel.has(p.id)).map(p => p.name).join(', ') : '';
    b.innerHTML = ok ? `<b>${ST.sel.size}명 선택</b><span>${esc(names)}</span><button class="dmb pri" onclick="dmStMove()">🔁 매장 이동·지원</button><button class="dmb" onclick="dmStSelClear()">선택 해제</button>` : '';
  }
  window.dmStSelClear = () => { ST.sel.clear(); stDraw(); };
  window.dmStOrd = async (id, dir) => {
    const list = ST.d.list, p = list.find(x => x.id === id);
    const same = list.filter(x => (DM.cur === 'hq' || x.kind === p.kind) && !isOut(x));
    const i = same.indexOf(p), j = i + dir; if (j < 0 || j >= same.length) return;
    [same[i], same[j]] = [same[j], same[i]];
    try { await rpc('staff_order', { p_ids: same.map(x => x.id) }); toast('순서를 바꿨어요. 시프트에도 이 순서로 나와요.'); stLoad(); } catch (e) { toast('바꾸지 못했어요: ' + errMsg(e)); }
  };
  let F = null;
  window.dmStEdit = async id => {
    const hq = DM.cur === 'hq', p = id ? ST.d.list.find(x => x.id === id) : null;
    F = p ? JSON.parse(JSON.stringify(p)) : (hq ? { kind:'hq', name:'', rank:'', duty:'' } : { kind:'pt', name:'', rank:'PT', wk:6, days:[0,1,2,3,4], slot:'L' });
    F.hire = F.hire || { cond:'', hours:'', pay_type: F.kind === 'staff' || hq ? '월급' : '시급', pay:'', duty:[], docs:{} };
    F.hire.duty = (F.hire.duty || []).filter(x => DUTY.includes(x)); F.hire.docs = F.hire.docs || {};
    F.pii = {}; F.idFile = null; F.idDel = false;
    if (ST.d.admin && p) { try { F.pii = await rpc('staff_pii_get', { p_staff: p.id }) || {}; } catch (e) { console.warn(e); toast('개인정보를 불러오지 못했어요: ' + errMsg(e)); } }
    F.pin = { rrn:'', acct:'', bank: F.pii.bank || '', holder: F.pii.holder || '' };
    window.dmF = F; stForm(p);
  };
  function stForm(p){
    const hq = DM.cur === 'hq', adm = ST.d.admin;
    const ranks = hq ? ['팀장','S.V','과장','대리','주임','사원'] : ['점장','부점장','주임','사원','PT'];
    const work = hq ? `<label class="f2 wide"><span>담당</span><input value="${esc(F.duty)}" placeholder="예: 브랜드 관리, 직영점 지원" oninput="dmF.duty=this.value"></label>` : `
      <div class="f2 wide"><span>구분</span><div class="dm-seg">${[['staff','직원'],['pt','파트타이머']].map(([k,t]) => `<button type="button" class="${F.kind === k ? 'on' : ''}" onclick="dmStF('kind','${k}')">${t}</button>`).join('')}</div></div>
      ${F.kind === 'staff'
        ? `<div class="f2 wide"><span>근무 형태</span><div class="dm-seg">${[6,5,4].map(w => `<button type="button" class="${(F.wk || 6) === w ? 'on' : ''}" onclick="dmStF('wk',${w})">주${w}일</button>`).join('')}</div><em class="dm-note2">직원은 출근 요일을 정하지 않아요. 시프트에서 매일 출근으로 채워지고, 쉬는 날만 화살표로 골라요.</em></div>
           <label class="f2"><span>월 휴무 기준 <em>(비우면 자동)</em></span><input type="number" min="0" max="20" placeholder="자동 (${({6:5,5:9,4:13})[F.wk || 6]}일 안팎)" value="${F.off ?? ''}" oninput="dmF.off=this.value===''?null:+this.value"></label><div></div>`
        : `<div class="f2 wide"><span>출근 요일</span><div class="dm-dsel">${WD.map((w, i) => `<button type="button" class="${(F.days || []).includes(i) ? 'on' : ''}" onclick="dmStDay(${i})">${w}</button>`).join('')}</div></div>
           <div class="f2 wide"><span>시간대</span><div class="dm-seg">${Object.entries(SLOT).map(([k,t]) => `<button type="button" class="${F.slot === k ? 'on' : ''}" onclick="dmStF('slot','${k}')">${t}</button>`).join('')}</div><em class="dm-note2">고른 요일에 이 시간대로 시프트가 채워져요. 그날만 바꾸는 건 시프트에서 해요.</em></div>`}`;
    const H = F.hire, PI = F.pii || {}, PN = F.pin || {}, autoCond = hq ? (F.duty || '본사 근무') : F.kind === 'staff' ? `주${F.wk || 6}일 (요일 변동)` : `${daysTxt(F.days)} ${SLOT[F.slot] || ''}`;
    const hire = adm ? `<div class="dm-hire"><div class="hh">🔒 입사 정보 <small>홈페이지 관리자만 볼 수 있어요</small></div><div class="dm-fg">
      <label class="f2"><span>근무조건</span><input value="${esc(H.cond || '')}" placeholder="${esc(autoCond)}" oninput="dmF.hire.cond=this.value"></label>
      <label class="f2"><span>근무시간 <em>(하루)</em></span><div class="dm-unit"><input type="number" min="1" max="14" step="0.5" value="${esc(H.hours ?? '')}" oninput="dmF.hire.hours=this.value"><b>시간</b></div></label>
      <label class="f2"><span>급여</span><div class="dm-unit"><select onchange="dmF.hire.pay_type=this.value">${['시급','월급'].map(x => `<option ${H.pay_type === x ? 'selected' : ''}>${x}</option>`).join('')}</select><input inputmode="numeric" value="${esc(H.pay || '')}" oninput="this.value=this.value.replace(/[^0-9]/g,'').replace(/\\B(?=(\\d{3})+(?!\\d))/g,',');dmF.hire.pay=this.value"><b>원</b></div></label>
      ${hq ? '<div></div>' : `<div class="f2"><span>담당</span><div class="dm-chk">${DUTY.map(x => `<label><input type="checkbox" ${H.duty.includes(x) ? 'checked' : ''} onchange="dmStDuty('${x}',this.checked)">${x}</label>`).join('')}</div></div>`}
      <div class="f2 wide dm-pii-h"><span>🔐 개인정보 <em>— 암호화해서 저장해요. 저장된 번호는 가려서 보이고, 바꿀 때만 새로 입력해요. ‘보기’를 누르면 열람 기록이 남아요</em></span></div>
      <label class="f2"><span>주민등록번호</span><div class="dm-unit"><input id="pi-rrn" inputmode="numeric" maxlength="14" autocomplete="off" placeholder="${PI.rrn ? esc(PI.rrn) : '000000-0000000'}" value="${esc(PN.rrn)}" oninput="dmPiRrn(this)">${PI.has_rrn ? `<button type="button" class="dmb sm" onclick="dmPiView('rrn',this)">보기</button>` : ''}</div></label>
      <div class="f2"><span>신분증 사본</span><div class="dm-unit dm-idc">${PI.has_idcard && !F.idDel ? `<button type="button" class="dmb sm" onclick="dmPiView('idcard',this)">보기</button><button type="button" class="dmb sm" onclick="dmPiDel()">삭제</button>` : ''}<label class="dmb sm">${PI.has_idcard && !F.idDel ? '바꾸기' : '파일 첨부'}<input type="file" accept="image/*,application/pdf" hidden onchange="dmPiFile(this)"></label><span class="dm-note2" id="pi-fn">${F.idFile ? esc(F.idFile.name) : F.idDel ? '저장하면 삭제돼요' : PI.has_idcard ? '등록됨' : ''}</span></div></div>
      <div class="f2"><span>급여 계좌</span><div class="dm-unit"><select onchange="dmF.pin.bank=this.value"><option value="">은행</option>${[...BANKS, ...(PN.bank && !BANKS.includes(PN.bank) ? [PN.bank] : [])].map(b => `<option ${PN.bank === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select><input inputmode="numeric" autocomplete="off" placeholder="${PI.acct ? esc(PI.acct) : '계좌번호'}" value="${esc(PN.acct)}" oninput="this.value=this.value.replace(/[^0-9-]/g,'');dmF.pin.acct=this.value">${PI.has_acct ? `<button type="button" class="dmb sm" onclick="dmPiView('acct',this)">보기</button>` : ''}</div></div>
      <label class="f2"><span>예금주 <em>(본인이면 비워 두세요)</em></span><input value="${esc(PN.holder)}" placeholder="${esc(F.name || '본인')}" maxlength="20" oninput="dmF.pin.holder=this.value"></label>
      <div class="f2 wide"><span>입사 서류</span><div class="dm-chk"><label><input type="checkbox" ${H.docs.ctr ? 'checked' : ''} onchange="dmF.hire.docs.ctr=this.checked">근로계약서 받음</label></div></div>
      ${PI.purge_at ? `<div class="f2 wide dm-note2">퇴사 후 보관 중이에요. ${esc(PI.purge_at)}에 주민번호·계좌가 자동으로 삭제돼요.</div>` : ''}</div></div>` : '';
    const body = `<div class="dm-fg">
      <label class="f2"><span>이름</span><input id="st-n" value="${esc(F.name)}" maxlength="12" oninput="dmF.name=this.value"></label>
      ${hq ? `<label class="f2"><span>직급 <em>(직접 입력)</em></span><input id="st-rank" list="st-rank-list" value="${esc(F.rank || '')}" maxlength="12" placeholder="예: 팀장, 실장, 부장" oninput="dmF.rank=this.value.trim()"><datalist id="st-rank-list">${ranks.map(r => `<option value="${r}"></option>`).join('')}</datalist></label>` : `<label class="f2"><span>직급</span><select onchange="dmF.rank=this.value"><option value="">선택</option>${ranks.map(r => `<option ${F.rank === r ? 'selected' : ''}>${r}</option>`).join('')}${F.rank && !ranks.includes(F.rank) ? `<option selected>${esc(F.rank)}</option>` : ''}</select></label>`}
      ${work}
      <label class="f2"><span>입사일</span><input type="date" value="${esc(F.start || '')}" onchange="dmF.start=this.value"></label>
      <label class="f2"><span>퇴사일 <em>(정해지면)</em></span><input type="date" value="${esc(F.out || '')}" onchange="dmF.out=this.value"></label>
      <label class="f2"><span>연락처 <em>🔒 ${hq ? '연락망에서 전 직원에게 보여요' : '본사·매장 관리자만'}</em></span><input type="tel" placeholder="010-0000-0000" value="${esc(mmTel(F.tel || ''))}" oninput="dmF.tel=this.value"></label>
      <label class="f2"><span>메모</span><input value="${esc(F.memo || '')}" maxlength="60" oninput="dmF.memo=this.value"></label>
      ${hire}</div>`;
    const extra = p && !isOut(p) ? `<button class="dmb" style="color:#a3262c" onclick="dmStQuit()">퇴사 처리</button>${!hq && isHQ() ? `<button class="dmb" onclick="dmStMove([${p.id}])">🔁 매장 이동·지원</button>` : ''}` : '';
    modal(p ? `${p.name} · ${hq ? '본사 인원' : '직원'} 정보` : (hq ? '본사 인원 추가' : '직원 추가'), hq ? '연락망의 본사 칸에 나오고, 매장 지원 인력으로 불러갈 수 있어요.' : '입사일부터 시프트에 나오고, 퇴사일 다음 날부터 빠져요.', body, foot('dmStSave(this)', extra), true);
  }
  const keepName = () => { const n = document.getElementById('st-n'); if (n) F.name = n.value; };
  window.dmStF = (k, v) => { keepName(); F[k] = v; if (k === 'kind' && v === 'staff') { F.wk = F.wk || 6; F.rank = F.rank === 'PT' ? '사원' : F.rank; } if (k === 'kind' && v === 'pt') { F.days = F.days && F.days.length ? F.days : [0,1,2,3,4]; F.slot = F.slot || 'L'; F.rank = F.rank || 'PT'; } stForm(ST.d.list.find(x => x.id === F.id)); };
  window.dmStDay = i => { keepName(); F.days = (F.days || []).includes(i) ? F.days.filter(x => x !== i) : [...(F.days || []), i].sort(); stForm(ST.d.list.find(x => x.id === F.id)); };
  window.dmPiRrn = el => { const d = el.value.replace(/\D/g, '').slice(0, 13); el.value = d.length > 6 ? d.slice(0, 6) + '-' + d.slice(6) : d; F.pin.rrn = el.value; };
  window.dmPiFile = el => {
    const f = el.files && el.files[0]; if (!f) return;
    if (f.size > 10 * 1024 * 1024) { el.value = ''; return toast('10MB 이하 파일만 올릴 수 있어요.'); }
    F.idFile = f; F.idDel = false; const t = document.getElementById('pi-fn'); if (t) t.textContent = f.name + ' (저장하면 올라가요)';
  };
  window.dmPiDel = () => { if (!confirm('신분증 사본을 삭제할까요? 저장을 눌러야 지워져요.')) return; keepName(); F.idDel = true; F.idFile = null; stForm(ST.d.list.find(x => x.id === F.id)); };
  window.dmPiView = async (what, btn) => {
    const w = what === 'idcard' ? window.open('', '_blank') : null;
    try {
      const v = await rpc('staff_pii_reveal', { p_staff: F.id, p_what: what });
      if (!v) { if (w) w.close(); return toast('저장된 내용이 없어요.'); }
      if (what === 'idcard') {
        const { data, error } = await window.SB.storage.from('staff-idcards').createSignedUrl(v, 120);
        if (error) throw error; w.location = data.signedUrl; return;
      }
      btn.textContent = v; btn.classList.add('dm-rv'); btn.disabled = true;
      setTimeout(() => { btn.textContent = '보기'; btn.classList.remove('dm-rv'); btn.disabled = false; }, 30000);
    } catch (e) { if (w) w.close(); toast('열지 못했어요: ' + errMsg(e)); }
  };
  window.dmStDuty = (x, on) => { F.hire.duty = on ? [...new Set([...F.hire.duty, x])] : F.hire.duty.filter(y => y !== x); };
  window.dmStSave = async btn => {
    keepName(); if (!F.name || !F.name.trim()) return toast('이름을 입력해 주세요.');
    const hq = DM.cur === 'hq';
    const p = { id:F.id || null, store_id: hq ? null : +DM.cur, kind: hq ? 'hq' : F.kind, name:F.name, rank:F.rank || '', duty:F.duty || '', wk: F.kind === 'staff' ? (F.wk || 6) : null,
      off: F.kind === 'staff' && F.off != null && F.off !== '' ? F.off : null, days: F.kind === 'pt' ? (F.days || []) : [], slot: F.kind === 'pt' ? F.slot : null,
      start:F.start || '', out:F.out || '', memo:F.memo || '', tel:F.tel || '' };
    if (ST.d.admin) p.hire = { ...F.hire, hours: F.hire.hours === '' ? null : F.hire.hours };
    const PN = F.pin || {}, PI = F.pii || {}, pin = {};
    if (ST.d.admin) {
      if (PN.rrn) { if (PN.rrn.replace(/\D/g, '').length !== 13) return toast('주민등록번호 13자리를 확인해 주세요.'); pin.rrn = PN.rrn; }
      if (PN.acct) { if (PN.acct.replace(/\D/g, '').length < 8) return toast('계좌번호를 확인해 주세요.'); pin.acct = PN.acct; }
      if ((PN.bank || '') !== (PI.bank || '')) pin.bank = PN.bank || '';
      if ((PN.holder || '').trim() !== (PI.holder || '')) pin.holder = (PN.holder || '').trim();
    }
    await run(btn, async () => {
      const sid = await rpc('staff_save', { p });
      if (!ST.d.admin || !sid) return;
      if (Object.keys(pin).length) await rpc('staff_pii_save', { p_staff: sid, p: pin });
      const bk = window.SB.storage.from('staff-idcards');
      if (F.idFile) {
        const f = F.idFile, ext = ((f.name.split('.').pop() || 'jpg').toLowerCase()).replace(/[^a-z0-9]/g, '') || 'jpg';
        const path = `${sid}/${Date.now()}.${ext}`;
        const { error } = await bk.upload(path, f, { contentType: f.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'), upsert: false });
        if (error) throw error;
        const old = await rpc('staff_pii_idcard_set', { p_staff: sid, p_path: path });
        if (old) await bk.remove([old]);
      } else if (F.idDel) {
        const old = await rpc('staff_pii_idcard_set', { p_staff: sid, p_path: null });
        if (old) await bk.remove([old]);
      }
    }, '저장했어요. 시프트에도 반영돼요.');
    closeModal(); stLoad();
  };
  window.dmStQuit = () => {
    const d = prompt('퇴사일을 입력해 주세요 (예: 2026-11-30)', F.out || today()); if (!d) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return toast('날짜는 2026-11-30처럼 입력해 주세요.');
    F.out = d; window.dmStSave(null);
  };
  window.dmStRehire = async id => {
    const p = ST.d.list.find(x => x.id === id); if (!p) return;
    if (!confirm(`${p.name}님을 재입사 처리할까요? 입사일은 오늘로, 퇴사일은 비워져요.`)) return;
    try { await rpc('staff_save', { p:{ ...p, start: today(), out:'', tel: p.tel || '' } }); toast('재입사 처리했어요.'); ST.view = 'on'; stLoad(); } catch (e) { toast('처리하지 못했어요: ' + errMsg(e)); }
  };
  let MV = null;
  window.dmStMove = ids => {
    ids = ids || [...ST.sel]; if (!ids.length) return;
    const others = ST.d.stores.filter(s => s.id !== +DM.cur);
    if (!others.length) return toast('옮길 다른 직영점이 없어요. 회사·조직 설정에서 직영점을 추가해 주세요.');
    MV = { ids, to: others[0].id, type:'move', date:'', end:'' }; window.dmMV = MV; mvForm();
  };
  function mvForm(){
    const names = ST.d.list.filter(p => MV.ids.includes(p.id)).map(p => p.name);
    const others = ST.d.stores.filter(s => s.id !== +DM.cur);
    const cur = (ST.d.stores.find(s => s.id === +DM.cur) || {}).name, to = (others.find(s => s.id === MV.to) || {}).name;
    modal(names.length > 1 ? `${names.length}명 매장 이동·지원` : `${names[0]} · 매장 이동·지원`, '입사 정보·연락처·근무 이력은 그대로 따라가요.', `<div class="dm-fg">
      <div class="f2 wide"><span>대상</span><div>${names.map(n => `<span class="dm-chip">${esc(n)}</span>`).join(' ')}</div></div>
      <div class="f2 wide"><span>방식</span><div class="dm-seg2">
        <button type="button" class="${MV.type === 'move' ? 'on' : ''}" onclick="dmMV.type='move';dmMvF()"><b>완전 이동</b><small>소속이 바뀌어요 · 이동일부터 새 매장 시프트에 나와요</small></button>
        <button type="button" class="${MV.type === 'sup' ? 'on' : ''}" onclick="dmMV.type='sup';dmMvF()"><b>기간 지원</b><small>소속은 그대로 · 정한 기간만 새 매장 시프트에 나와요</small></button></div></div>
      <label class="f2"><span>보낼 매장</span><select onchange="dmMV.to=+this.value;dmMvF()">${others.map(s => `<option value="${s.id}" ${MV.to === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="f2"><span>${MV.type === 'move' ? '이동일' : '지원 시작일'}</span><input type="date" value="${MV.date}" onchange="dmMV.date=this.value;dmMvF()"></label>
      ${MV.type === 'sup' ? `<label class="f2"><span>지원 종료일</span><input type="date" value="${MV.end}" onchange="dmMV.end=this.value;dmMvF()"></label>` : ''}
      <div class="f2 wide dm-warn">${MV.type === 'move' ? `<b>${esc(cur)}</b> 시프트에는 이동일 전날까지, <b>${esc(to)}</b> 시프트에는 이동일부터 나와요. 지난 기록은 그대로 남아요.` : `정한 기간 동안 ${esc(cur)} 시프트에서 빠지고 ${esc(to)} 시프트에 나와요. 끝나면 자동으로 돌아와요.`}</div></div>`,
      `<span style="flex:1"></span><button class="dmb" onclick="dmClose()">취소</button><button class="dmb pri" onclick="dmMvSave(this)">${MV.type === 'move' ? '이동 예약' : '지원 예약'}</button>`);
  }
  window.dmMvF = mvForm;
  window.dmMvSave = async btn => {
    if (!MV.date) return toast('날짜를 골라 주세요.');
    if (MV.type === 'sup' && (!MV.end || MV.end < MV.date)) return toast('지원 종료일을 확인해 주세요.');
    await run(btn, () => rpc('staff_move', { p_ids: MV.ids, p_to: MV.to, p_type: MV.type, p_date: MV.date, p_end: MV.type === 'sup' ? MV.end : null }), '예약했어요.');
    closeModal(); stLoad();
  };
  window.dmStMvCancel = async id => { if (!confirm('이동·지원 예약을 취소할까요?')) return; try { await rpc('staff_move_cancel', { p_id:id }); toast('취소했어요.'); stLoad(); } catch (e) { toast('취소하지 못했어요: ' + errMsg(e)); } };
  window.dmStLink = () => {
    const linked = ST.d.list.filter(p => p.kind === 'sup').map(p => p.link_id);
    const avail = (ST.d.hq_list || []).filter(h => !linked.includes(h.id));
    modal('본사에서 지원 인력 불러오기', '본사 명단에서 고르면 이 매장 시프트에 지원 인력으로 나와요. 소속은 본사 그대로예요.',
      `<div class="dm-chk col">${avail.length ? avail.map(h => `<label><input type="checkbox" value="${h.id}" class="dm-lk"><b>${esc(h.name)}</b> <span class="na">${esc([h.rank, h.duty].filter(Boolean).join(' · '))}</span></label>`).join('') : '<span class="na">불러올 본사 인원이 없어요. 관리 > 회사·조직 설정의 본사 인원에서 먼저 추가해 주세요.</span>'}</div>`,
      `<span style="flex:1"></span><button class="dmb" onclick="dmClose()">취소</button><button class="dmb pri" onclick="dmStLinkSave(this)">불러오기</button>`);
  };
  window.dmStLinkSave = async btn => { const ids = [...document.querySelectorAll('.dm-lk:checked')].map(x => +x.value); if (!ids.length) return closeModal();
    await run(btn, () => rpc('staff_link', { p_store:+DM.cur, p_ids:ids }), '연결했어요.'); closeModal(); stLoad(); };
  window.dmStUnlink = async id => { if (!confirm('이 매장에서 연결을 풀까요? 본사 명단과 지난 시프트 기록은 그대로 남아요.')) return;
    try { await rpc('staff_unlink', { p_id:id }); toast('연결을 풀었어요.'); stLoad(); } catch (e) { toast('처리하지 못했어요: ' + errMsg(e)); } };
  window.dmStSup = id => {
    const s = ST.d.list.find(x => x.id === id); F = { ...s, days:[...(s.days || [])] }; window.dmF = F;
    const draw = () => modal(`${s.name} · 기본 지원`, '정해 두면 그 요일에 시프트가 자동으로 채워져요. 비워 두면 필요한 날만 시프트에서 넣어요.', `<div class="dm-fg">
      <div class="f2 wide"><span>지원 요일</span><div class="dm-dsel">${WD.map((w, i) => `<button type="button" class="${F.days.includes(i) ? 'on' : ''}" onclick="dmF.days=dmF.days.includes(${i})?dmF.days.filter(x=>x!==${i}):[...dmF.days,${i}].sort();dmF._d()">${w}</button>`).join('')}</div></div>
      <div class="f2 wide"><span>시간대</span><div class="dm-seg">${Object.entries(SLOT).map(([k,t]) => `<button type="button" class="${F.slot === k ? 'on' : ''}" onclick="dmF.slot='${k}';dmF._d()">${t}</button>`).join('')}</div></div>
      <label class="f2 wide"><span>메모</span><input value="${esc(F.memo || '')}" oninput="dmF.memo=this.value"></label></div>`, foot('dmStSupSave(this)'));
    F._d = draw; draw();
  };
  window.dmStSupSave = async btn => { await run(btn, () => rpc('staff_save', { p:{ id:F.id, kind:'sup', name:'-', days:F.days, slot:F.slot, memo:F.memo || '', start:F.start || '', out:F.out || '' } }), '저장했어요.'); closeModal(); stLoad(); };

  /* ==========================================================
     시프트 관리
     ========================================================== */
  const SH = { d:null, ym:null, view:'week', week:0, cw:0, sel:null, focus:null, reply:null };
  try { SH.view = localStorage.getItem('dm-shift-view') || 'week'; } catch(e) {}
  const ymNow = () => today().slice(0,7);
  const ymAdd = (ym, n) => { const [y,m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; };
  const dim = ym => { const [y,m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
  const firstIdx = ym => { const [y,m] = ym.split('-').map(Number); return (new Date(y, m-1, 1).getDay() + 6) % 7; };
  const wdi = d => (firstIdx(SH.ym) + d - 1) % 7;
  const weeks = () => { const f = firstIdx(SH.ym), n = dim(SH.ym), out = []; for (let w = 0; w * 7 - f + 1 <= n; w++) out.push(Array.from({length:7}, (_, i) => w * 7 + i - f + 1)); return out; };
  const weekOf = d => Math.floor((d - 1 + firstIdx(SH.ym)) / 7);
  const inM = d => d >= 1 && d <= dim(SH.ym);
  const dstr = d => `${SH.ym}-${pad(d)}`;
  const isWe = d => wdi(d) >= 5;
  async function pageShift(){
    main().innerHTML = simpleHero(['직영점 관리','시프트 관리'], 'SHIFT', '시프트 관리', '직원 현황 기준으로 한 달이 기본 출근으로 채워져요. 쉬는 사람만 이름 옆 화살표로 바꾸면 돼요.') + `<div id="sh-body">${loading()}</div>` + pageFoot();
    try { await boot(); } catch (e) { document.getElementById('sh-body').innerHTML = loading('불러오지 못했어요: ' + esc(errMsg(e))); return; }
    if (DM.store == null) { document.getElementById('sh-body').innerHTML = loading('직영점이 없어요. 회사·조직 설정에서 직영점을 먼저 추가해 주세요.'); return; }
    if (!SH.ym) SH.ym = ymNow();
    DM.cur = DM.store;
    await shLoad(true);
  }
  async function shLoad(resetWeek){
    const B = document.getElementById('sh-body'); if (!B) return;
    try { SH.d = await rpc('shift_data', { p_store:+DM.cur, p_ym:SH.ym }); }
    catch (e) { B.innerHTML = storeTabs(false, 'dmShPick') + loading('불러오지 못했어요: ' + esc(errMsg(e))); return; }
    SH.map = {}; SH.d.cells.forEach(([d, s, c]) => { (SH.map[d] = SH.map[d] || {})[s] = c; });
    // 첫 주에 걸친 지난달 날짜(예: 12월 1주차의 11/30 월)도 흐리게 보여주려고 지난달 시프트를 같이 읽어 옴 (보기 전용)
    SH.prev = null;
    if (firstIdx(SH.ym) > 0) {
      try { const pym = ymAdd(SH.ym, -1), pd = await rpc('shift_data', { p_store:+DM.cur, p_ym:pym }), pm = {};
        (pd.cells || []).forEach(([d, s, c]) => { (pm[d] = pm[d] || {})[s] = c; });
        SH.prev = { ym:pym, n:dim(pym), roster:pd.roster || [], map:pm };
      } catch (e) { SH.prev = null; }
    }
    if (resetWeek) { const t = today(); SH.week = t.slice(0,7) === SH.ym ? weekOf(+t.slice(8,10)) : 0; SH.cw = SH.week; SH.sel = null; }
    shDraw(); shSeen();
  }
  window.dmShPick = id => { DM.cur = +id; setStore(+id); shLoad(true); };
  window.dmShMonth = n => { SH.ym = ymAdd(SH.ym, n); shLoad(true); };
  const v = (d, sid) => (SH.map[d] || {})[sid] || 'N';
  const active = (p, d) => (p.active || []).includes(d);
  function cnt2(d){ let l = 0, dn = 0; SH.d.roster.forEach(p => { if (!active(p, d)) return; const x = v(d, p.id); if (x === 'F') { l++; dn++; } else if (x === 'L' || x === 'H' || x === 'LW') l++; else if (x === 'D' || x === 'DW') dn++; }); return [l, dn]; }
  function shDraw(){
    const d = SH.d, B = document.getElementById('sh-body'); if (!B) return;
    const st = ['임시 · 매장 작성 중','제출됨 · 본사 확인 대기','확정'][d.status] || '';
    const [y, m] = SH.ym.split('-');
    let tl = 0, td = 0; const n = dim(SH.ym); for (let i = 1; i <= n; i++) { const [a, b] = cnt2(i); tl += a; td += b; }
    B.innerHTML = storeTabs(false, 'dmShPick') + `
      <div class="dm-shtop"><div class="dm-mnav"><button onclick="dmShMonth(-1)" aria-label="이전 달">‹</button><b>${y}년 ${+m}월</b><button onclick="dmShMonth(1)" aria-label="다음 달">›</button></div>
        <span class="dm-chip ${['tmp','sub','ok'][d.status]}">${st}</span>
        <div class="dm-bep"><span>예상 매출(BEP)</span><input id="sh-bep" inputmode="numeric" value="${d.bep ? Number(d.bep).toLocaleString('ko-KR') : ''}" placeholder="입력" ${d.can_edit ? '' : 'disabled'} oninput="this.value=this.value.replace(/[^0-9]/g,'').replace(/\\B(?=(\\d{3})+(?!\\d))/g,',')" onchange="dmShBep(this.value)"><em>적정 인건비 <b id="sh-labor">${d.bep ? Math.round(d.bep * .3).toLocaleString('ko-KR') + '원' : '-'}</b> (30%)</em></div>
        <div class="dm-avg">하루 평균 런치 <b>${(tl / n).toFixed(1)}</b> · 디너 <b>${(td / n).toFixed(1)}</b>명</div>
        ${d.can_edit && !d.practice ? `<button class="dmb pr-btn" onclick="dmShPrac('start')" title="지금 상태를 보관해 두고 마음껏 고쳐 봐요">🧪 연습 모드</button>` : ''}</div>
      ${pracHtml()}
      <div class="dm-shlay"><div>
        <section class="card" id="sh-sched"><div class="dm-bar">
          <div class="dm-tabs"><button class="${SH.view === 'week' ? 'on' : ''}" onclick="dmShView('week')">주간 보기</button><button class="${SH.view === 'month' ? 'on' : ''}" onclick="dmShView('month')">월간 요약</button></div>
          ${SH.view === 'week' ? `<div class="dm-wnav"><button onclick="dmShWk(-1)" ${SH.week === 0 ? 'disabled' : ''} aria-label="이전 주">‹</button><b>${SH.week + 1}주차 · ${wkRange(SH.week)}</b><button onclick="dmShWk(1)" ${SH.week >= weeks().length - 1 ? 'disabled' : ''} aria-label="다음 주">›</button></div><button class="dmb sm" onclick="dmShShot(this)" title="이번 주 시프트를 이미지로 만들어 카톡 등으로 보내요">📷 이미지로 공유</button>` : ''}
          <span class="dm-hint">${SH.view === 'week' ? (d.can_edit ? '기본은 출근 · 이름 옆 화살표로 휴무·월차·런치·디너·반휴를 골라요 · 런치·디너는 근무 0.5일, 런치만·디너만(반휴)은 근무 0.5일·휴무 0.5일 · 날짜를 누르면 그날 전체' : '보기 전용이에요') : '표시 없음 = 풀타임 · 런 = 런치만 · 디 = 디너만 · 취소선 = 휴무 · 날짜를 누르면 그날 근무를 고칠 수 있어요'}</span></div>
          ${SH.view === 'week' ? `<div class="dm-who"><span>직원 강조</span>${['전체', ...d.roster.map(p => p.id)].map(id => { const p = d.roster.find(x => x.id === id); return `<button class="${(SH.focus || '전체') === id ? 'on' : ''}" onclick="dmShFocus(${id === '전체' ? 'null' : id})">${p ? `<i style="background:${colorOf(p.id)}"></i>${esc(p.name)}` : '전체'}</button>`; }).join('')}</div>` : ''}
          <div id="sh-view">${SH.view === 'week' ? weekHtml() : monthHtml()}</div>
          <div class="dm-tools">${d.can_edit ? `${SH.view === 'week' ? `<button class="dmb" onclick="dmShCopy()" ${SH.week >= weeks().length - 1 ? 'disabled' : ''}>이번 주 → 다음 주에 복사</button>` : ''}<button class="dmb" onclick="dmShRefill()">직원 현황 기준으로 다시 채우기</button>` : ''}
            <span style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">${flowBtns()}</span></div>
        </section>
        <section class="card"><div class="dm-sh"><strong>${+m}월 휴무 카운터</strong><small>어느 주를 보고 있어도 한 달 기준 · 기준 근무일: 주6일 = 월요일 휴무, 주5일 = 토·일 휴무 · 런치·디너는 근무 0.5일 · 반휴는 근무 0.5일·휴무 0.5일 · 월차는 근무일로 셈</small></div>${counterHtml()}</section>
      </div>
      <aside class="dm-side">
        <section class="card"><div class="dm-sh"><strong>비고 (공유 사항)</strong><small>한 달 공통 · 결정된 내용만</small></div>
          <ol class="dm-memo-l">${(d.memo || []).map((t, i) => `<li>${esc(t)}${d.can_edit ? ` <button class="dm-xs" onclick="dmShMemoDel(${i})" aria-label="지우기">✕</button>` : ''}</li>`).join('') || '<li class="na" style="list-style:none;margin-left:-18px">아직 없어요.</li>'}</ol>
          ${d.can_edit ? '<div class="dm-memo-add"><input id="sh-memo" placeholder="공유 사항 추가" maxlength="120" onkeydown="if(event.key===\'Enter\')dmShMemoAdd()"><button class="dmb sm" onclick="dmShMemoAdd()">추가</button></div>' : ''}</section>
        <section class="card" id="sh-cmt">${cmtHtml()}</section>
      </aside></div>`;
  }
  function wkRange(w){ const all = weeks()[w], ds = all.filter(inM); const [, m] = SH.ym.split('-'); const s0 = all[0] < 1 && SH.prev ? `${+SH.prev.ym.slice(5)}/${SH.prev.n + all[0]}` : `${+m}/${ds[0]}`; return `${s0} ~ ${+m}/${ds[ds.length - 1]}`; }
  function flowBtns(){
    const d = SH.d;
    if (d.practice) return '<span class="dm-hint">연습 중에는 제출·확정할 수 없어요</span>';
    if (d.status === 0) return d.can_edit ? `<button class="dmb dark" onclick="dmShStatus(1)">한 달 제출</button>` : '';
    if (d.status === 1) return d.can_confirm ? `<button class="dmb" onclick="dmShStatus(0)">수정 요청</button><button class="dmb pri" onclick="dmShStatus(2)">확정</button>` : '<span class="dm-hint">본사 확인을 기다리는 중이에요</span>';
    return d.can_confirm ? `<button class="dmb" onclick="dmShStatus(0)">확정 해제</button>` : '';
  }
  function optHtml(cur, p){ const c = cOf(cur); return codesOf(p, cur).map(([k, t]) => `<option value="${k}" ${c === k ? 'selected' : ''}>${t}</option>`).join(''); }
  function weekHtml(){
    const d = SH.d, days = weeks()[SH.week];
    return `<div class="dm-week">${days.map((x, i) => {
      if (!inM(x) && x < 1 && SH.prev) return prevCol(x, i);
      if (!inM(x)) return `<div class="dm-col out"><div class="ch"><div class="dd"><span>${WD[i]} · 다른 달</span></div></div></div>`;
      const [l, dn] = cnt2(x), hasC = d.comments.some(c => c.day === x && !c.parent && !c.deleted);
      const ppl = d.roster.filter(p => active(p, x));
      return `<div class="dm-col ${isWe(x) ? 'we' : ''} ${SH.sel === x ? 'sel' : ''}" id="shc${x}">
        <div class="ch ${i === 5 ? 'sat' : i === 6 ? 'sun' : ''}" onclick="dmShDay(${x})" title="${x}일 전체 수정 · 이 날짜에 댓글"><div class="dd"><b>${x}</b><span>${WD[i]}</span>${hasC ? '<i>💬</i>' : ''}</div>
          <div class="n"><span>런치 <b>${l}</b></span><span>디너 <b>${dn}</b></span></div></div>
        <div class="sls">${ppl.map(p => { const c = v(x, p.id); return `<div class="sl ${cOf(c)} ${SH.focus === p.id ? 'hl' : ''} ${SH.focus && SH.focus !== p.id ? 'dim' : ''}" style="--pc:${colorOf(p.id)}"><b title="${esc(p.name)}${p.from ? ' (' + esc(p.from) + ')' : ''}">${esc(p.name)}</b>${d.can_edit ? `<select aria-label="${esc(p.name)} ${x}일 근무" onchange="dmShSet(${x},${p.id},this.value)">${optHtml(c, p)}</select>` : `<span class="ro">${labOf(p, c)}</span>`}</div>`; }).join('') || '<div class="dm-ek">근무자 없음</div>'}</div></div>`;
    }).join('')}</div>`;
  }
  // 지난달 날짜 칸 (흐리게 · 보기 전용)
  function prevCol(x, i){
    const P = SH.prev, pd = P.n + x, pmn = +P.ym.slice(5), pv = sid => (P.map[pd] || {})[sid] || 'N';
    const ppl = P.roster.filter(p => (p.active || []).includes(pd));
    let l = 0, dn = 0; ppl.forEach(p => { const c = pv(p.id); if (c === 'F') { l++; dn++; } else if (c === 'L' || c === 'H' || c === 'LW') l++; else if (c === 'D' || c === 'DW') dn++; });
    return `<div class="dm-col prevm ${i >= 5 ? 'we' : ''}" title="${pmn}월 ${pd}일 · 지난달 시프트 (보기 전용 · 고치려면 ${pmn}월로 이동)">
      <div class="ch ${i === 5 ? 'sat' : i === 6 ? 'sun' : ''}" onclick="dmShMonth(-1)"><div class="dd"><b>${pmn}/${pd}</b><span>${WD[i]} · 지난달</span></div>
        <div class="n"><span>런치 <b>${l}</b></span><span>디너 <b>${dn}</b></span></div></div>
      <div class="sls">${ppl.map(p => { const c = pv(p.id); return `<div class="sl ${cOf(c)} ${SH.focus === p.id ? 'hl' : ''} ${SH.focus && SH.focus !== p.id ? 'dim' : ''}" style="--pc:${colorOf(p.id)}"><b title="${esc(p.name)}">${esc(p.name)}</b><span class="ro">${labOf(p, c)}</span></div>`; }).join('') || '<div class="dm-ek">근무자 없음</div>'}</div></div>`;
  }
  function monthHtml(){
    const d = SH.d, cls = i => i === 5 ? 'sat' : i === 6 ? 'sun' : '';
    const head = `<div class="mh">${WD.map((w, i) => `<div class="${cls(i)}">${w}</div>`).join('')}</div>`;
    const cell = x => {
      if (!inM(x)) return '<div class="md2 empty"></div>';
      const [l, dn] = cnt2(x), i = wdi(x), hasC = d.comments.some(c => c.day === x && !c.parent && !c.deleted), off = [];
      const rows = d.roster.filter(p => active(p, x)).map(p => {
        const c = cOf(v(x, p.id)), nm = esc(p.name);
        if (c === 'O' || c === 'V') { off.push(nm + (c === 'V' ? '<small>(월차)</small>' : '')); return `<div class="r x" style="--pc:${colorOf(p.id)}"><b>${nm}</b></div>`; }
        if (c === 'N') return `<div class="r na"><b>${nm}</b><span>-</span></div>`;
        if ((c === 'L' || c === 'D') && !isPt(p)) off.push(nm + '<small>(반휴)</small>');
        return `<div class="r" style="--pc:${colorOf(p.id)}"><b>${nm}</b>${c === 'L' || c === 'LW' ? '<i class="L">런</i>' : c === 'D' || c === 'DW' ? '<i class="D">디</i>' : ''}</div>`;
      }).join('');
      return `<div class="md2 ${isWe(x) ? 'we' : ''} ${SH.sel === x ? 'sel' : ''}" id="shm${x}" onclick="dmShDay(${x})">
        <div class="mc"><div class="dd"><b class="${cls(i)}">${x}</b><span class="${cls(i)}">${WD[i]}</span>${hasC ? '<i>💬</i>' : ''}</div><div class="n"><span>런치<b>${l}</b></span><span>디너<b>${dn}</b></span></div></div>
        <div class="rs">${rows || '<div class="r na"><b>근무자 없음</b></div>'}</div>
        <div class="of ${off.length ? '' : 'none'}"><em>휴무</em>${off.join(', ') || '없음'}</div></div>`;
    };
    return `<div class="dm-mon2">${head}${weeks().map((w, k) => { const ds = w.filter(inM); return `<div class="mwk"><div class="mwh">${k + 1}주차 · ${ds[0]}일~${ds[ds.length - 1]}일</div><div class="mg">${w.map(cell).join('')}</div></div>`; }).join('')}</div>`;
  }
  function counterHtml(){
    const d = SH.d, n = dim(SH.ym);
    const rows = d.roster.filter(p => p.kind !== 'sup').map(p => {
      let w = 0, o = 0, h = 0, vc = 0; const act = p.active || [];
      act.forEach(x => { const c = cOf(v(x, p.id)); if (c === 'F') w++; else if (c === 'LW' || c === 'DW') w += .5; else if (c === 'L' || c === 'D') { w += .5; if (!isPt(p)) h++; } else if (c === 'V') { w++; vc++; } else if (c === 'O') o++; });
      // 기준 근무일: 주6일 = 매주 월요일 휴무, 주5일 = 매주 토·일 휴무 (소속 기간 안의 요일로 셈). 직원 현황의 기준 휴무가 있으면 그 값이 우선
      const wk = p.wk || 6;
      const base = p.kind !== 'staff' ? null : p.off != null ? act.length - p.off
        : wk === 6 ? act.filter(x => wdi(x) !== 0).length
        : wk === 5 ? act.filter(x => wdi(x) < 5).length
        : wk >= 7 ? act.length
        : act.length - Math.round(act.length * (7 - wk) / 7);
      // 상태는 휴무 기준: 실 휴무(정규 휴무 + 반휴 × 0.5)를 기준 휴무와 비교
      const offB = base == null ? null : act.length - base, offR = o + h / 2;
      const df = offB == null ? 0 : Math.round((offR - offB) * 10) / 10;
      const b = offB == null ? '<span class="na">기준 없음</span>' : df === 0 ? '<span class="dm-chip ok">맞음</span>' : df > 0 ? `<span class="dm-chip warn">휴무 ${df}일 초과</span>` : `<span class="dm-chip lack">휴무 ${-df}일 부족</span>`;
      return `<tr><td><span class="dm-nm2"><i style="background:${colorOf(p.id)}"></i>${esc(p.name)}</span>${p.from ? ` <small class="na">${esc(p.from)}</small>` : ''}</td><td>${p.kind === 'staff' ? `주${wk}일` : `${daysTxt(p.days)} ${SLOT[p.slot] || ''}`}</td><td class="n">${base ?? '-'}</td><td class="n">${w}${vc ? ` <small class="na">(월차 ${vc})</small>` : ''}</td><td class="n">${offB ?? '-'}</td><td class="n">${offR}${h ? ` <small class="na">(반휴 ${h})</small>` : ''}</td><td>${b}</td></tr>`;
    }).join('');
    return `<div class="dm-tw"><table class="dm-t"><thead><tr><th>이름</th><th>근무 형태</th><th class="n">기준 근무일</th><th class="n">실 근무일</th><th class="n">기준 휴무</th><th class="n">실 휴무</th><th>상태</th></tr></thead><tbody>${rows || `<tr><td colspan="7" class="dm-empty">직원 현황에 직원을 먼저 등록해 주세요.</td></tr>`}</tbody></table></div>` + svHtml();
  }
  // 슈퍼바이저(직급 S.V) 휴무·월차 — 모든 매장 시프트 합산, 같은 날은 하루로 셈 (휴무 > 월차 > 반휴 순)
  function svHtml(){
    const list = (SH.d && SH.d.svs) || []; if (!list.length) return '';
    const rk = { O:3, V:2, L:1, D:1, H:1 };
    const rows = list.map(sp => {
      const m = {}, put = (x, c) => { if (rk[c] && (!m[x] || rk[c] > rk[m[x]])) m[x] = c; };
      (sp.marks || []).forEach(([x, c]) => put(x, c)); // 다른 매장 기록
      if (sp.sup_id) for (let x = 1; x <= dim(SH.ym); x++) put(x, v(x, sp.sup_id)); // 이 매장은 화면 값으로 바로 반영
      let o = 0, vc = 0, h = 0; Object.values(m).forEach(c => { if (c === 'O') o++; else if (c === 'V') vc++; else h++; });
      return `<tr><td><span class="dm-nm2"><i style="background:#8a8476"></i>${esc(sp.name)}</span>${sp.rank ? ` <small class="na">${esc(sp.rank)}</small>` : ''}</td><td class="n">${o + h / 2}${h ? ` <small class="na">(반휴 ${h})</small>` : ''}</td><td class="n">${vc}</td></tr>`;
    }).join('');
    return `<div class="dm-sh" style="margin-top:16px"><strong>슈퍼바이저</strong><small>모든 매장 시프트를 합쳐서 셈 · 같은 날 여러 매장에 찍혀 있으면 하루로 셈</small></div><div class="dm-tw"><table class="dm-t"><thead><tr><th>이름</th><th class="n">휴무</th><th class="n">월차</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function cmtHtml(){
    const d = SH.d, W = weeks();
    const unreadW = w => d.comments.filter(c => c.week === w && c.unread).length, countW = w => d.comments.filter(c => c.week === w && !c.parent && !c.deleted).length;
    const totalUnread = d.comments.filter(c => c.unread).length;
    const one = (c, rep) => `<div class="dm-cm ${rep ? 'rep' : ''} ${c.unread ? 'new' : ''}"><span class="av" style="background:${colorOf(c.who && c.who.length)}">${esc(String(c.who || '?').slice(-2))}</span><div class="bd">
      <div class="meta"><b>${esc(c.who)}</b><span>${esc(c.at)}</span>${c.day ? `<button class="dt" onclick="dmShGo(${c.day})">${+SH.ym.slice(5)}/${c.day}</button>` : ''}</div>
      <div class="tx">${c.deleted ? '<i class="na">삭제된 댓글입니다.</i>' : esc(c.body)}</div>
      ${c.deleted ? '' : `<div class="acts">${rep ? '' : `<button onclick="dmShReply(${c.id})">답글</button>`}${d.can_edit ? `<button onclick="dmShPin(${c.id})">비고에 고정</button>` : ''}${c.mine || role() === 'admin' ? `<button onclick="dmShCmtDel(${c.id})">삭제</button>` : ''}</div>`}</div></div>`;
    const list = d.comments.filter(c => c.week === SH.cw && !c.parent);
    return `<div class="dm-sh"><strong>주차별 댓글</strong>${totalUnread ? `<span class="dm-unread">${totalUnread}</span>` : ''}</div>
      <div class="dm-wt">${W.map((_, w) => `<button class="${SH.cw === w ? 'on' : ''}" onclick="dmShCw(${w})">${w + 1}주차${unreadW(w) ? `<i>${unreadW(w)}</i>` : countW(w) ? ` · ${countW(w)}` : ''}</button>`).join('')}</div>
      <div class="dm-cweek">${SH.cw + 1}주차 (${wkRange(SH.cw)}) 댓글</div>
      <div class="dm-cms" id="sh-cms">${list.length ? list.map(c => one(c) + d.comments.filter(r => r.parent === c.id).map(r => one(r, true)).join('')).join('') : '<div class="dm-empty sm">이 주차에는 아직 댓글이 없어요.</div>'}</div>
      <div class="dm-compose">${SH.sel ? `<div class="tag"><span class="dt">${+SH.ym.slice(5)}/${SH.sel}</span>날짜에 남기는 댓글<button onclick="dmShSel(null)" aria-label="날짜 지정 해제">✕</button></div>` : ''}${SH.reply ? `<div class="tag">${esc((d.comments.find(c => c.id === SH.reply) || {}).who || '')}님 댓글에 답글<button onclick="dmShReply(null)" aria-label="답글 취소">✕</button></div>` : ''}
        <textarea id="sh-cin" placeholder="${SH.cw + 1}주차에 남길 댓글을 써 주세요. 날짜 머리를 먼저 누르면 그 날짜가 붙어요."></textarea>
        <div class="row"><button class="dmb pri sm" onclick="dmShPost(this)">등록</button></div></div>`;
  }
  async function shSeen(){ const d = SH.d; if (!d || !d.comments.some(c => c.week === SH.cw && c.unread)) return;
    setTimeout(async () => { try { await rpc('shift_seen', { p_store:+DM.cur, p_ym:SH.ym, p_week:SH.cw }); d.comments.forEach(c => { if (c.week === SH.cw) c.unread = false; }); const el = document.getElementById('sh-cmt'); if (el && el.querySelector('textarea') !== document.activeElement) el.innerHTML = cmtHtml(); } catch(e) {} }, 2500); }
  function redraw(){ const vw = document.getElementById('sh-view'); if (vw) vw.innerHTML = SH.view === 'week' ? weekHtml() : monthHtml(); }
  window.dmShView = x => { SH.view = x; try { localStorage.setItem('dm-shift-view', x); } catch(e) {} shDraw(); };
  window.dmShWk = n => { SH.week = Math.max(0, Math.min(weeks().length - 1, SH.week + n)); SH.cw = SH.week; SH.sel = null; shDraw(); shSeen(); };
  window.dmShCw = w => { SH.cw = w; if (SH.view === 'week') SH.week = w; SH.sel = null; shDraw(); shSeen(); };
  window.dmShFocus = id => { SH.focus = id; shDraw(); };

  // 주간 보기 → 이미지 (휴대폰: 공유 창 / PC: 클립보드 복사 / 그 외: PNG 저장). 직원 강조 상태 그대로 찍힘
  let SHOT = null;
  function loadH2C(){
    if (window.html2canvas) return Promise.resolve();
    return new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'; sc.onload = ok; sc.onerror = () => no(new Error('이미지 도구를 불러오지 못했어요')); document.head.append(sc); });
  }
  window.dmShShot = async btn => {
    const src = document.querySelector('#sh-view .dm-week'); if (!src) return;
    if (btn) btn.disabled = true;
    const box = document.createElement('div');
    try {
      await loadH2C();
      const st = ((DM.boot && DM.boot.direct) || []).find(x => String(x.id) === String(DM.cur));
      const [y, m] = SH.ym.split('-'); const fp = SH.focus ? SH.d.roster.find(x => x.id === SH.focus) : null;
      box.style.cssText = 'position:fixed;left:-10000px;top:0;width:1120px;background:#fff;padding:22px;font-family:inherit;color:#2f372a';
      box.innerHTML = `<div style="font-size:19px;font-weight:700;margin-bottom:4px">${esc(st ? st.name : '')} 시프트</div><div style="font-size:13px;color:#6b7364;margin-bottom:14px">${y}년 ${+m}월 ${SH.week + 1}주차 · ${wkRange(SH.week)}${fp ? ` · ${esc(fp.name)} 강조` : ''}</div>`;
      const cl = src.cloneNode(true);
      cl.style.gridTemplateColumns = 'repeat(7,minmax(0,1fr))'; cl.style.gap = '6px';
      cl.querySelectorAll('.dm-col').forEach(c => { c.classList.remove('sel', 'flash'); c.style.display = 'block'; });
      // 선택창은 글자 배지로 바꿈 (색은 화면 그대로)
      const os = src.querySelectorAll('select'), cs = cl.querySelectorAll('select');
      cs.forEach((el, i) => { const o = os[i], g = getComputedStyle(o), sp = document.createElement('span');
        sp.textContent = o.options[o.selectedIndex] ? o.options[o.selectedIndex].text : '';
        sp.style.cssText = `margin-left:auto;font-size:11px;font-weight:600;padding:3px 7px;border-radius:5px;color:${g.color};background:${g.backgroundColor}`;
        el.replaceWith(sp); });
      // 강조 테두리는 이미지에서도 보이게 실제 테두리로
      const ol = src.querySelectorAll('.sl'), cll = cl.querySelectorAll('.sl');
      cll.forEach((el, i) => { if (el.classList.contains('hl')) { el.style.boxShadow = 'none'; el.style.border = `2px solid ${getComputedStyle(ol[i]).getPropertyValue('--pc').trim() || '#2d3726'}`; } });
      box.append(cl); document.body.append(box);
      const cv = await window.html2canvas(box, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      if (!blob) throw new Error('이미지를 만들지 못했어요');
      if (SHOT && SHOT.url) URL.revokeObjectURL(SHOT.url);
      const name = `시프트_${st ? st.name : ''}_${+m}월${SH.week + 1}주차.png`.replace(/\s+/g, '');
      SHOT = { blob, url: URL.createObjectURL(blob), file: new File([blob], name, { type: 'image/png' }), name };
      const canShare = !!(navigator.canShare && navigator.canShare({ files: [SHOT.file] })), canCopy = !!(navigator.clipboard && window.ClipboardItem);
      const mobile = matchMedia('(pointer:coarse)').matches;
      modal('이미지로 공유', mobile ? '공유를 누르고 카카오톡을 고르면 단톡방에 바로 보낼 수 있어요.' : '복사한 뒤 카톡 단톡방에서 Ctrl+V로 붙여넣으면 돼요.',
        `<img src="${SHOT.url}" alt="주간 시프트 이미지" style="width:100%;border:1px solid #dfe3d9;border-radius:8px;display:block">`,
        `<span style="flex:1"></span>${canShare ? `<button class="dmb ${mobile ? 'pri' : ''}" onclick="dmShShotGo('share')">공유</button>` : ''}${canCopy ? `<button class="dmb ${mobile ? '' : 'pri'}" onclick="dmShShotGo('copy')">이미지 복사</button>` : ''}<button class="dmb" onclick="dmShShotGo('save')">저장</button>`, true);
    } catch (e) { toast('이미지를 만들지 못했어요: ' + errMsg(e)); }
    finally { box.remove(); if (btn) btn.disabled = false; }
  };
  window.dmShShotGo = async how => {
    if (!SHOT) return;
    try {
      if (how === 'share') { await navigator.share({ files: [SHOT.file], title: SHOT.name.replace('.png', '') }); return; }
      if (how === 'copy') { await navigator.clipboard.write([new ClipboardItem({ 'image/png': SHOT.blob })]); toast('이미지를 복사했어요. 카톡에 붙여넣으세요.'); return; }
      const a = document.createElement('a'); a.href = SHOT.url; a.download = SHOT.name; document.body.append(a); a.click(); a.remove();
    } catch (e) { if (e && e.name === 'AbortError') return; toast(how === 'copy' ? '이 브라우저에선 복사가 안 돼요. 저장을 눌러 주세요.' : '처리하지 못했어요: ' + errMsg(e)); }
  };
  window.dmShSel = x => { SH.sel = x; document.getElementById('sh-cmt').innerHTML = cmtHtml(); redraw(); };
  window.dmShReply = id => { SH.reply = id; document.getElementById('sh-cmt').innerHTML = cmtHtml(); document.getElementById('sh-cin')?.focus(); };
  window.dmShGo = x => { SH.view = 'week'; SH.week = weekOf(x); SH.cw = SH.week; SH.sel = x; shDraw(); document.getElementById('sh-sched')?.scrollIntoView({ behavior:'smooth', block:'start' }); setTimeout(() => flash(x), 300); };
  function flash(x){ const e = document.getElementById((SH.view === 'week' ? 'shc' : 'shm') + x); if (e) { e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); } }
  window.dmShSet = async (x, sid, code) => {
    const prev = v(x, sid); (SH.map[x] = SH.map[x] || {})[sid] = code; redraw(); refreshCounts();
    try { await rpc('shift_set', { p_store:+DM.cur, p_day:dstr(x), p_staff:sid, p_code:code }); }
    catch (e) { SH.map[x][sid] = prev; redraw(); refreshCounts(); toast('저장하지 못했어요: ' + errMsg(e)); }
  };
  function refreshCounts(){ const c = document.querySelector('#sh-body .dm-shlay > div > section:nth-child(2)'); if (c) c.innerHTML = `<div class="dm-sh"><strong>${+SH.ym.slice(5)}월 휴무 카운터</strong><small>어느 주를 보고 있어도 한 달 기준 · 기준 근무일: 주6일 = 월요일 휴무, 주5일 = 토·일 휴무 · 런치·디너는 근무 0.5일 · 반휴는 근무 0.5일·휴무 0.5일 · 월차는 근무일로 셈</small></div>` + counterHtml(); }
  let DAY = null;
  window.dmShDay = x => {
    SH.sel = x; SH.cw = weekOf(x); document.getElementById('sh-cmt').innerHTML = cmtHtml(); redraw();
    if (!SH.d.can_edit) return;
    DAY = { x, map:{} }; SH.d.roster.filter(p => active(p, x)).forEach(p => DAY.map[p.id] = v(x, p.id));
    const draw = () => modal(`${+SH.ym.slice(5)}월 ${x}일 (${WD[wdi(x)]})`, '여기서 고치면 주간 보기와 월간 요약에 같이 반영돼요.',
      `<div class="dm-day">${SH.d.roster.filter(p => active(p, x)).map(p => `<div class="er"><div class="nm"><i style="background:${colorOf(p.id)}"></i>${esc(p.name)}</div><div class="dm-seg sm">${codesOf(p, DAY.map[p.id]).map(([k, t]) => `<button type="button" class="${cOf(DAY.map[p.id]) === k ? 'on ' + k : ''}" onclick="dmDAY.map[${p.id}]='${k}';dmDAY._d()">${t}</button>`).join('')}</div></div>`).join('') || '<div class="dm-empty">이날 근무할 수 있는 사람이 없어요.</div>'}</div>`,
      `<button class="dmb" onclick="dmClose();document.getElementById('sh-cin')?.focus()">💬 이 날짜에 댓글</button>${SH.view === 'month' ? `<button class="dmb" onclick="dmClose();dmShGo(${x})">이 주 보기</button>` : ''}<span style="flex:1"></span><button class="dmb" onclick="dmClose()">취소</button><button class="dmb pri" onclick="dmShDaySave(this)">적용</button>`, true);
    DAY._d = draw; window.dmDAY = DAY; draw();
  };
  window.dmShDaySave = async btn => {
    await run(btn, () => rpc('shift_day_set', { p_store:+DM.cur, p_day:dstr(DAY.x), p_map:DAY.map }), `${DAY.x}일 근무를 바꿨어요.`);
    Object.entries(DAY.map).forEach(([sid, c]) => { (SH.map[DAY.x] = SH.map[DAY.x] || {})[sid] = c; });
    closeModal(); shDraw(); setTimeout(() => flash(DAY.x), 50);
  };
  window.dmShCopy = async () => {
    const W = weeks(), a = W[SH.week], b = W[SH.week + 1]; if (!b) return;
    if (!confirm(`${SH.week + 1}주차를 ${SH.week + 2}주차에 그대로 복사할까요? ${SH.week + 2}주차에 넣어 둔 내용은 바뀌어요.`)) return;
    const from = a[0] >= 1 ? dstr(a[0]) : null;
    try {
      const mon = d => { const [y, m] = SH.ym.split('-').map(Number); const dt = new Date(y, m - 1, d); return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`; };
      await rpc('shift_copy_week', { p_store:+DM.cur, p_from:mon(a[0]), p_to:mon(b[0]), p_ym:SH.ym });
      SH.week++; SH.cw = SH.week; toast(`${SH.week}주차를 ${SH.week + 1}주차에 복사했어요.`); await shLoad(false);
    } catch (e) { toast('복사하지 못했어요: ' + errMsg(e)); }
  };
  window.dmShRefill = async () => {
    if (!confirm('직원 현황 기준으로 이번 달을 다시 채울까요? 휴무·반휴무·월차로 바꿔 둔 칸도 모두 기본값으로 돌아가요.')) return;
    try { await rpc('shift_refill', { p_store:+DM.cur, p_ym:SH.ym }); toast('다시 채웠어요.'); await shLoad(false); } catch (e) { toast('처리하지 못했어요: ' + errMsg(e)); }
  };
  // ---------- 연습 모드 (2026-11-27) ----------
  //  켜면 그 순간 상태를 서버에 보관 → 마음껏 고침 → [원래대로] 보관본으로 복구 / [이대로 적용] 확정 (+ [적용 취소] 한 번)
  //  연습 중 직원(고칠 수 없는 사람)에게는 서버가 연습 전 시프트를 보냄 (shift_data)
  function pracHtml(){
    const d = SH.d;
    document.getElementById('sh-body')?.classList.toggle('sh-prac', !!(d.practice && d.can_edit));
    if (d.practice && d.can_edit) return `<div class="pr-bar"><span class="ic">🧪</span><div><b>연습 중이에요 · ${esc(d.practice.at || '')} 시작${d.practice.by ? ` (${esc(d.practice.by)})` : ''}</b>
      <p>마음껏 고쳐 보세요. 직원들에게는 연습 전 시프트가 그대로 보여요. 연습 중에는 '한 달 제출'을 할 수 없어요.</p></div>
      <div class="acts"><button class="dmb" onclick="dmShPrac('revert')">↩ 원래대로</button><button class="dmb pri" onclick="dmShPrac('apply')">✓ 이대로 적용</button></div></div>`;
    if (d.practice) return `<div class="pr-info">ℹ️ 시프트를 고치는 중이에요. 확정되면 바뀐 시프트가 보여요. (지금은 이전 시프트)</div>`;
    if (d.undo && d.can_edit) return `<div class="pr-undo">✓ 연습한 내용을 적용했어요${d.undo.at ? ` (${esc(d.undo.at)})` : ''}. 마음이 바뀌면 연습 전으로 되돌릴 수 있어요. <button class="dmb" onclick="dmShPrac('undo')">적용 취소</button></div>`;
    return '';
  }
  window.dmShPrac = async act => {
    const msg = { start: '연습 모드를 켤까요?\n지금 상태를 보관해 두고, 끝날 때 [원래대로]를 누르면 이 상태로 돌아와요.',
      revert: '연습 전 상태로 되돌릴까요?\n연습하며 고친 내용은 모두 사라져요.',
      apply: '연습한 내용을 이대로 적용할까요?\n직원들에게도 바뀐 시프트가 보여요.',
      undo: '적용을 취소하고 연습 전 상태로 되돌릴까요?' }[act];
    if (!confirm(msg)) return;
    try {
      await rpc('shift_practice', { p_store:+DM.cur, p_ym:SH.ym, p_act:act });
      toast({ start:'연습 모드를 켰어요. 마음껏 고쳐 보세요.', revert:'연습 전 상태로 되돌렸어요.', apply:'연습한 내용을 적용했어요.', undo:'적용을 취소했어요.' }[act]);
      await shLoad(false);
    } catch (e) { toast('처리하지 못했어요: ' + errMsg(e)); }
  };
  { const st = document.createElement('style'); st.textContent = `
  .pr-btn{margin-left:auto}
  .pr-bar{display:flex;align-items:center;gap:12px;background:#fff8e1;border:2px solid #f2c14e;border-radius:12px;padding:12px 16px;margin:-4px 0 14px}
  .pr-bar .ic{font-size:20px}.pr-bar b{font-size:14px}.pr-bar p{margin:2px 0 0;font-size:12px;color:#6b5a1e}
  .pr-bar .acts{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}
  .pr-undo{display:flex;align-items:center;gap:10px;background:#eef5ef;border:1px solid #cfe6d5;border-radius:12px;padding:10px 16px;margin:-4px 0 14px;font-size:12.5px;color:#2d5a3a}
  .pr-undo .dmb{margin-left:auto}
  .pr-info{background:#f6f7f2;border-radius:10px;padding:10px 14px;margin:-4px 0 14px;font-size:12px;color:#6b7364}
  .sh-prac .dm-shtop{border-color:#f2c14e}
  .sh-prac #sh-sched{outline:3px dashed #f2c14e;outline-offset:-3px;background:#fff8dc}
  .sh-prac .dm-col,.sh-prac .md2{background:#fff3c4;border-color:#f0cf6a}
  .sh-prac .dm-col .ch{background:#ffe38f;border-bottom-color:#f0cf6a}.sh-prac .dm-col .ch:hover{background:#ffdb70}
  .sh-prac .sl{background:#fffaf0}.sh-prac .sl.N{background:none}
  .sh-prac .dm-shtop{background:#fff8dc}
  @media(max-width:760px){.pr-bar{flex-wrap:wrap}.pr-bar .acts{margin-left:0;width:100%}.pr-bar .acts .dmb{flex:1}.pr-btn{margin-left:0}}`; document.head.appendChild(st); }
  window.dmShStatus = async s => {
    const msg = { 1:'본사에 제출할까요?', 2:'이번 달 시프트를 확정할까요? 확정하면 매장에서는 고칠 수 없어요.', 0: SH.d.status === 2 ? '확정을 풀까요?' : '수정 요청을 보낼까요? 사유는 댓글로 남겨 주세요.' }[s];
    if (!confirm(msg)) return;
    try { await rpc('shift_month_save', { p_store:+DM.cur, p_ym:SH.ym, p:{ status:s } }); toast({ 1:'제출했어요.', 2:'확정했어요.', 0:'처리했어요.' }[s]); await shLoad(false); } catch (e) { toast('처리하지 못했어요: ' + errMsg(e)); }
  };
  window.dmShBep = async val => {
    const n = String(val).replace(/[^0-9]/g, '');
    try { await rpc('shift_month_save', { p_store:+DM.cur, p_ym:SH.ym, p:{ bep:n } }); SH.d.bep = n ? +n : null; document.getElementById('sh-labor').textContent = n ? Math.round(n * .3).toLocaleString('ko-KR') + '원' : '-'; toast('예상 매출을 저장했어요.'); }
    catch (e) { toast('저장하지 못했어요: ' + errMsg(e)); }
  };
  async function memoSave(list, msg){ try { await rpc('shift_month_save', { p_store:+DM.cur, p_ym:SH.ym, p:{ memo:list } }); SH.d.memo = list; shDraw(); if (msg) toast(msg); } catch (e) { toast('저장하지 못했어요: ' + errMsg(e)); } }
  window.dmShMemoAdd = () => { const i = document.getElementById('sh-memo'); const t = (i.value || '').trim(); if (!t) return; memoSave([...(SH.d.memo || []), t], '비고에 추가했어요.'); };
  window.dmShMemoDel = i => { if (!confirm('이 공유 사항을 지울까요?')) return; memoSave((SH.d.memo || []).filter((_, j) => j !== i), '지웠어요.'); };
  window.dmShPin = id => { const c = SH.d.comments.find(x => x.id === id); if (c && c.body) memoSave([...(SH.d.memo || []), c.body], '비고에 고정했어요.'); };
  window.dmShPost = async btn => {
    const t = document.getElementById('sh-cin'), body = (t.value || '').trim(); if (!body) return toast('내용을 입력해 주세요.');
    await run(btn, () => rpc('shift_comment_add', { p:{ store_id:+DM.cur, ym:SH.ym, week:SH.cw, day: SH.reply ? null : SH.sel, parent: SH.reply, body } }), '댓글을 남겼어요.');
    SH.reply = null; await shLoad(false); const box = document.getElementById('sh-cms'); if (box) box.scrollTop = box.scrollHeight;
  };
  window.dmShCmtDel = async id => { if (!confirm('이 댓글을 지울까요?')) return; try { await rpc('shift_comment_del', { p_id:id }); await shLoad(false); } catch (e) { toast('지우지 못했어요: ' + errMsg(e)); } };

  /* ==========================================================
     메뉴 · 화면 연결
     ========================================================== */
  const label = b => [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
  const unitEnd = b => (b.nextElementSibling && b.nextElementSibling.classList.contains('sub')) ? b.nextElementSibling : b;
  function fixMenu(active){
    const nav = document.querySelector('#side .nav-items'); if (!nav || !ready()) return;
    nav.querySelectorAll('.js-dm').forEach(e => e.remove());
    const cats = () => [...nav.querySelectorAll(':scope > .cat')];
    // 인사관리 → 직영점 관리
    const hr = cats().find(b => label(b) === '인사관리');
    if (hr) { const s = hr.nextElementSibling; if (s && s.classList.contains('sub')) s.remove(); hr.remove(); }
    const grp = t => [...nav.querySelectorAll(':scope > .mm-nav-grp')].find(e => e.textContent.trim() === t);
    const opsEnd = () => { const g = grp('매장 데이터'); return g ? g.previousElementSibling : null; };
    // 조직도: 상신·결재 아래 (없으면 운영 끝)
    const orgHtml = `<button class="cat js-dm ${active === 'org' ? 'open' : ''}" onclick="go('org')">${ic('users')}연락망<span style="margin-left:6px;font-size:11px;font-weight:500;opacity:.55">· Directory</span></button>`;
    const appr = cats().find(b => label(b) === '상신·결재');
    if (appr) unitEnd(appr).insertAdjacentHTML('afterend', orgHtml);
    else { const e = opsEnd(); e ? e.insertAdjacentHTML('afterend', orgHtml) : nav.insertAdjacentHTML('afterbegin', orgHtml); }
    // 직영점 관리: 운영 맨 끝
    if (isHQ() || role() === 'store') {
      const on = ['dm-staff','dm-shift','hr-att'].includes(active);
      const dmHtml = `<button class="cat js-dm ${on ? 'open' : ''}" onclick="const o=this.classList.toggle('open');this.nextElementSibling.classList.toggle('open',o)">${ic('store')}직영점 관리${ic('chevron').replace('class="icon"', 'class="icon ar"')}</button>
        <div class="sub js-dm ${on ? 'open' : ''}">${[['dm-staff','직원 현황'],['dm-shift','시프트 관리'],['hr-att','출결 관리']].map(([k,t]) => `<a role="button" tabindex="0" class="${active === k ? 'on' : ''}" onclick="go('${k}')">${t}</a>`).join('')}</div>`;
      // 연락망 바로 아래 (가맹점 현황보다 위)
      const orgBtn = nav.querySelector(':scope > .cat.js-dm[onclick="go(\'org\')"]');
      if (orgBtn) orgBtn.insertAdjacentHTML('afterend', dmHtml);
      else { const e = opsEnd(); e ? e.insertAdjacentHTML('afterend', dmHtml) : nav.insertAdjacentHTML('beforeend', dmHtml); }
    }
    // 회사·조직 설정: 관리 묶음 (관리자)
    if (isAdmin()) {
      const html = `<button class="cat js-dm ${active === 'bs-set' ? 'open' : ''}" onclick="go('bs-set')">${ic('partner')}회사·조직 설정</button>`;
      const us = cats().find(b => label(b) === '사용자 관리');
      if (us) us.insertAdjacentHTML('beforebegin', html);
      else { const bc = cats().find(b => label(b) === '브랜드 채널');
        if (bc) bc.insertAdjacentHTML('beforebegin', html);
        else { const g = grp('관리'); g ? g.insertAdjacentHTML('afterend', html) : nav.insertAdjacentHTML('beforeend', html); } }
    }
    // 브랜드 채널(외부 바로가기): 관리 묶음 맨 끝
    { const bc = cats().find(b => label(b) === '브랜드 채널'), us = cats().find(b => label(b) === '사용자 관리');
      if (bc && us) { const bs = unitEnd(bc) !== bc ? unitEnd(bc) : null; unitEnd(us).after(bc); if (bs) bc.after(bs); } }
    // 비어 버린 묶음 제목 숨기기
    nav.querySelectorAll(':scope > .mm-nav-grp').forEach(g => { const nx = g.nextElementSibling; g.style.display = (!nx || nx.classList.contains('mm-nav-grp')) ? 'none' : ''; });
  }
  const renderSideDm = renderSide;
  renderSide = function(active){
    const r = renderSideDm.apply(this, arguments);
    try { fixMenu(active); } catch (e) { console.warn('직영점 메뉴 실패', e); }
    return r;
  };
  try { fixMenu(window.__curPage); } catch (e) {}

  // 출결 화면 위 경로: 인사관리 → 직영점 관리
  if (typeof simpleHero === 'function') {
    const heroDm = simpleHero;
    simpleHero = function(path2){
      if (Array.isArray(path2) && path2[0] === '인사관리') arguments[0] = ['직영점 관리', '출결 관리'];
      return heroDm.apply(this, arguments);
    };
  }

  const goDm = go;
  go = function(p, t){
    const page = { org: pageOrg, 'bs-set': pageBS, 'dm-staff': pageStaff, 'dm-shift': pageShift }[p];
    if (page) {
      if (!ready()) return goDm('dash');
      document.getElementById('mm-fly') && (document.getElementById('mm-fly').hidden = true);
      closeSide(); renderSide(p); window.__curPage = p; ST.sel.clear(); stBar(); window.scrollTo(0, 0);
      page(); return;
    }
    ST.sel.clear(); stBar();
    return goDm(p, t);
  };

  /* ---------- 스타일 ---------- */
  const css = document.createElement('style');
  css.textContent = `
  .dmb{border:1px solid #dfe3d9;background:#fff;border-radius:8px;min-height:36px;padding:0 13px;font-size:12px;display:inline-flex;align-items:center;justify-content:center;gap:6px;color:#3c4537;white-space:nowrap;cursor:pointer;text-decoration:none;font-weight:500}
  .dmb:hover{background:#f6f7f2}.dmb:disabled{opacity:.45;cursor:default}
  .dmb.pri{background:#c62429;border-color:#c62429;color:#fff;font-weight:600}.dmb.pri:hover{background:#a01b21}
  .dmb.dark{background:#2d3726;border-color:#2d3726;color:#fff}
  .dmb.sm{min-height:28px;padding:0 10px;font-size:11px}
  .dm-empty{text-align:center;color:#8a9181;font-size:13px;line-height:1.8;padding:36px 10px}.dm-empty.sm{padding:16px 6px;font-size:12px}
  .dm-miss{font-size:10.5px;color:#b0861f;background:#fff6e2;border-radius:4px;padding:1px 6px;white-space:nowrap}
  .na{color:#a7ad9e}
  .dm-chip{display:inline-block;font-size:11px;border-radius:999px;padding:2px 9px;font-weight:600;background:#f0f1ec;color:#4a5244;white-space:nowrap}
  .dm-chip.ok{background:#e3f3e5;color:#2b7a3a}.dm-chip.warn{background:#fdecec;color:#a3262c}.dm-chip.lack{background:#fff1e0;color:#b35c00}.dm-chip.mv{background:#e6eefc;color:#2a56a8}.dm-chip.sup{background:#f3eafa;color:#6b3f93}.dm-chip.hqc{background:#2d3726;color:#fff}
  .dm-chip.tmp{background:#fff4dc;color:#946200}.dm-chip.sub{background:#e6eefc;color:#2a56a8}
  .dm-stabs{display:inline-flex;gap:4px;background:#f1f2ec;border-radius:10px;padding:4px;margin:0 0 14px;flex-wrap:wrap}
  .dm-stabs button{border:0;background:none;border-radius:7px;padding:7px 16px;font-size:13px;font-weight:600;color:#6b7364;cursor:pointer}
  .dm-stabs button.on{background:#c62429;color:#fff;box-shadow:0 1px 3px #0002}.dm-stabs small{font-size:10px;font-weight:500;color:#b07a00}.dm-stabs button.on small{color:#ffe1a8}
  .dm-tabs{display:inline-flex;background:#f1f2ec;border-radius:8px;padding:3px}
  .dm-tabs button{border:0;background:none;border-radius:6px;padding:6px 13px;font-size:12px;color:#6b7364;cursor:pointer}.dm-tabs button.on{background:#fff;color:#232621;font-weight:600;box-shadow:0 1px 2px #0001}
  .dm-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:14px}.dm-bar>.dmb{margin-left:auto}
  .dm-hint{font-size:11px;color:#8a9181}
  .dm-sh{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}.dm-sh strong{font-size:14px}.dm-sh small{color:#8a9181;font-size:11px}
  .dm-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px}
  .dm-sum>div{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 16px}.dm-sum span{display:block;font-size:11px;color:#797d76}.dm-sum b{display:block;font-size:20px;margin-top:4px}.dm-sum small{font-size:11px;color:#8a9181;font-weight:500;margin-left:3px}.dm-sum em{display:block;font-style:normal;font-size:11px;color:#8a9181;margin-top:2px}
  .dm-tw{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
  .dm-t{width:100%;border-collapse:collapse;font-size:12px}.dm-t th{font-size:11px;color:#6b7364;font-weight:600;text-align:left;padding:8px;border-bottom:1px solid var(--line);background:#fafaf7;white-space:nowrap}
  .dm-t td{padding:8px;border-bottom:1px solid #f0f1ec;vertical-align:middle;white-space:nowrap}.dm-t td.n,.dm-t th.n{text-align:right}.dm-t tr.out td{color:#8a9181}
  .dm-ord{width:62px}.dm-ord button{border:1px solid var(--line);background:#fff;border-radius:4px;width:22px;height:22px;font-size:9px;color:#6b7364;padding:0;margin-right:2px;cursor:pointer}.dm-ord button:disabled{opacity:.3}
  .dm-nm{border:0;background:none;padding:0;font-weight:700;font-size:13px;display:inline-flex;align-items:center;gap:7px;color:#232621;cursor:pointer}.dm-nm:hover{color:#c62429;text-decoration:underline}
  .dm-nm i,.dm-nm2 i{width:4px;height:14px;border-radius:2px;display:inline-block}.dm-nm2{display:inline-flex;align-items:center;gap:7px;font-weight:700}
  .dm-memo{display:block;font-size:10.5px;color:#8a9181;margin:2px 0 0 11px}
  .dm-pick{width:15px;height:15px;margin:0 8px 0 0;vertical-align:-3px;accent-color:#c62429}
  .dm-days{display:inline-flex;gap:2px}.dm-days span{width:19px;height:19px;border-radius:4px;display:inline-grid;place-items:center;font-size:10px;color:#c4c8bd;background:#f6f7f2}.dm-days span.on{background:#2d3726;color:#fff;font-weight:600}
  .dm-slot{display:inline-block;border-radius:5px;padding:2px 7px;font-size:11px;font-weight:700;margin-left:4px}.dm-slot.sL{background:#ffefcc;color:#8a5a00}.dm-slot.sD{background:#e1eafb;color:#284f99}.dm-slot.sF{background:#e3f3e5;color:#2b7a3a}
  .dm-wk{display:inline-block;background:#2d3726;color:#fff;border-radius:5px;padding:2px 8px;font-size:12px;font-weight:600}
  .dm-tel{color:#2a56a8;text-decoration:none}
  .dm-gh{font-size:13px;font-weight:700;margin:16px 0 8px;color:#2f372a;display:flex;align-items:center;gap:6px;flex-wrap:wrap}.dm-gh small{font-weight:500;color:#8a9181;font-size:11px}
  .dm-ek,.dm-ek2{font-size:12px;color:#a0a797;padding:6px 8px}
  .dm-inc{border:1px dashed #b9c9ea;background:#f6f9ff;border-radius:10px;padding:4px 10px}.dm-inc .r{display:flex;align-items:center;gap:10px;padding:7px 2px;flex-wrap:wrap;font-size:13px}.dm-inc .r+.r{border-top:1px solid #e3eaf7}.dm-inc i{width:4px;height:14px;border-radius:2px}.dm-inc span{color:#6b7364;font-size:12px}.dm-inc .dmb{margin-left:auto}
  #dm-selbar{position:fixed;left:50%;bottom:20px;transform:translate(-50%,140px);background:#22311f;color:#fff;border-radius:14px;padding:10px 12px 10px 18px;display:flex;align-items:center;gap:12px;box-shadow:0 10px 30px #0004;transition:transform .2s;z-index:60;max-width:calc(100% - 32px)}
  #dm-selbar.on{transform:translate(-50%,0)}#dm-selbar span{font-size:12px;color:#c9d2c3;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#dm-selbar .dmb:not(.pri){background:transparent;color:#e3e8de;border-color:#ffffff40}
  @media(min-width:861px){#dm-selbar{left:calc(50% + 122px)}}
  #dm-modal{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:14px}
  .dm-mbg{position:absolute;inset:0;background:#1119}
  .dm-mbox{position:relative;background:#fff;border-radius:14px;width:520px;max-width:100%;max-height:92vh;overflow:auto;padding:18px 20px;box-shadow:0 20px 50px #0004}.dm-mbox.wide{width:620px}
  .dm-mh{display:flex;align-items:center;gap:8px}.dm-mh strong{font-size:16px}
  .dm-x{margin-left:auto;border:0;background:none;font-size:16px;color:#8a9181;cursor:pointer;padding:4px 6px}
  .dm-msub{font-size:11.5px;color:#797d76;margin:4px 0 12px;line-height:1.6}
  .dm-mfoot{display:flex;gap:8px;align-items:center;margin-top:16px;flex-wrap:wrap}
  .dm-fg{display:grid;grid-template-columns:1fr 1fr;gap:12px 14px}
  .f2{display:flex;flex-direction:column;gap:5px;font-size:11px;color:#6b7364}.f2.wide{grid-column:1/-1}.f2 em{font-style:normal;color:#a0a797}
  .f2 input,.f2 select{border:1px solid #dfe3d9;border-radius:8px;min-height:38px;padding:0 10px;font-size:13px;color:#232621;background:#fff;width:100%}
  .dm-seg{display:flex;gap:6px;flex-wrap:wrap}.dm-seg button{border:1px solid #dfe3d9;background:#fff;border-radius:8px;padding:8px 14px;font-size:12.5px;color:#4a5244;cursor:pointer}.dm-seg button.on{background:#2d3726;border-color:#2d3726;color:#fff;font-weight:600}
  .dm-seg.sm button{padding:6px 8px;font-size:11.5px}.dm-seg button.on.O,.dm-seg button.on.H{background:#c62429;border-color:#c62429}.dm-seg button.on.V{background:#7a4fa0;border-color:#7a4fa0}
  .dm-seg2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dm-seg2 button{border:1px solid #dfe3d9;background:#fff;border-radius:10px;padding:10px 12px;text-align:left;display:flex;flex-direction:column;gap:3px;cursor:pointer}.dm-seg2 b{font-size:13px;color:#232621}.dm-seg2 small{font-size:11px;color:#8a9181;line-height:1.5}.dm-seg2 button.on{border-color:#c62429;box-shadow:0 0 0 1px #c62429;background:#fffafa}
  .dm-dsel{display:flex;gap:4px}.dm-dsel button{flex:1;max-width:44px;height:34px;border:1px solid #dfe3d9;background:#fff;border-radius:7px;font-size:12px;color:#8a9181;cursor:pointer}.dm-dsel button.on{background:#2d3726;border-color:#2d3726;color:#fff;font-weight:600}
  .dm-note2{font-style:normal;font-size:11px;color:#8a9181;line-height:1.5}
  .dm-hire{grid-column:1/-1;border:1px solid #e3d9f0;background:#faf7fd;border-radius:12px;padding:12px 14px}.dm-hire .hh{font-size:13px;font-weight:700;color:#4b2f73;margin-bottom:10px}.dm-hire .hh small{font-weight:500;font-size:11px;color:#8a7aa3;margin-left:6px}
  .dm-unit{display:flex;align-items:center;gap:6px}.dm-unit input{flex:1;min-width:0}.dm-unit select{width:78px;flex:none}.dm-unit b{font-weight:500;color:#6b7364;font-size:12px}
  .dm-chk{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:12.5px;color:#2f372a;min-height:34px;align-items:center}.dm-chk label{display:inline-flex;align-items:center;gap:5px;cursor:pointer}.dm-chk input{width:16px;height:16px;accent-color:#2d3726}.dm-chk.col{flex-direction:column;align-items:flex-start;gap:10px}
  .dm-unit .dmb{flex:none}.dm-idc{flex-wrap:wrap}label.dmb{cursor:pointer;display:inline-flex;align-items:center}.dm-rv{font-variant-numeric:tabular-nums;color:#4b2f73;background:#f1eafa}.dm-pii-h{border-top:1px dashed #d9c9ee;padding-top:10px;margin-top:2px}
  .dm-warn{background:#fff;border:1px dashed #d9c9ee;border-radius:8px;padding:10px 12px;font-size:12px;color:#4a5244;line-height:1.7;display:block}
  .dm-frsec{grid-column:1/-1;border:1px solid #e3d9f0;background:#faf7fd;border-radius:10px;padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px}.dm-frsec .h{grid-column:1/-1;font-size:12px;font-weight:700;color:#4b2f73}
  .dm-cols{display:flex;gap:6px}.dm-cols button{width:28px;height:28px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #dfe3d9;cursor:pointer}.dm-cols button.on{box-shadow:0 0 0 2px #232621}
  .dm-lrow{display:grid;grid-template-columns:84px 1fr;gap:8px;align-items:center;margin-top:4px}.dm-lrow b{font-size:12px;font-weight:500;color:#4a5244}
  .dm-kv3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.dm-kv3>div{border:1px solid #eef0e9;border-radius:10px;padding:12px 14px}.dm-kv3 span{display:block;font-size:11px;color:#8a9181}.dm-kv3 b{display:block;font-size:14px;margin-top:4px}.dm-kv3 small{font-weight:500;color:#8a9181}
  .dm-brands{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
  .dm-bc{border:1px solid var(--line);border-radius:12px;padding:14px 14px 14px 18px;position:relative;overflow:hidden;background:#fff;text-align:left}.dm-bc:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--bcol)}
  .dm-bc h3{margin:0;font-size:15px;display:flex;align-items:center;gap:8px}.dm-bc .meta{font-size:12px;color:#6b7364;margin:8px 0}.dm-bc .links{display:flex;flex-wrap:wrap;gap:4px}.dm-bc .links span{font-size:10.5px;background:#f4f5f0;border-radius:4px;padding:2px 6px;color:#4a5244}
  .dm-bc.add{border-style:dashed;color:#8a9181;cursor:pointer;min-height:120px;background:#fcfcf9;text-align:center;font-size:12px}.dm-bc.add:before{display:none}.dm-bc.add b{font-size:22px}.dm-bc.add:hover{color:#c62429;border-color:#c62429}
  .dm-st{display:inline-block;font-size:10.5px;border-radius:999px;padding:2px 8px;font-weight:600}.dm-st.run{background:#e3f3e5;color:#2b7a3a}.dm-st.soon{background:#fff4dc;color:#946200}.dm-st.off{background:#f0f1ec;color:#8a9181}
  .dm-note{font-size:12px;color:#4a5244;background:#f6f9ff;border:1px dashed #b9c9ea;border-radius:10px;padding:10px 14px;margin-bottom:12px;line-height:1.7}
  .dm-flt{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;align-items:center}.dm-flt select{border:1px solid #dfe3d9;border-radius:8px;min-height:34px;font-size:12px;padding:0 8px;background:#fff}.dm-cnt{margin-left:auto;font-size:12px;color:#8a9181}
  .dm-bt{display:inline-flex;align-items:center;gap:5px;font-weight:600}.dm-bt i{width:8px;height:8px;border-radius:50%}
  .dm-ty{font-size:11px;border-radius:4px;padding:2px 7px;font-weight:600}.dm-ty.dm{background:#e6eefc;color:#2a56a8}.dm-ty.fr{background:#f3eafa;color:#6b3f93}
  .dm-search{border:1px solid #dfe3d9;border-radius:8px;min-height:38px;padding:0 12px;width:260px;font-size:13px;background:#fff}.dm-search.sm{min-height:34px;width:170px;font-size:12px}
  .dm-orgbar{display:flex;justify-content:flex-end;margin:-8px 0 12px}
  .dm-dir{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:14px;align-items:start}
  .dm-tree{background:#fff;border:1px solid var(--line);border-radius:14px;padding:6px 16px 12px}
  .dm-th{display:flex;align-items:center;gap:10px;padding:12px 0 8px;border-bottom:1px solid var(--line)}.dm-th b{font-size:15px}.dm-th small{color:#8a9181;font-size:12px}.dm-all{margin-left:auto;border:0;background:none;color:#c62429;font-size:12px;font-weight:600;cursor:pointer}
  .dm-node{border-bottom:1px solid #f0f1ec}.dm-kids .dm-node{border-bottom:0}
  .dm-nh{width:100%;border:0;background:none;display:flex;align-items:center;gap:8px;padding:11px 2px;font-size:14px;font-weight:600;color:#2f372a;text-align:left;cursor:pointer;flex-wrap:wrap}
  .dm-nh:hover{background:#fafbf7}.dm-nh .ar{width:14px;color:#9aa190;font-size:10px;transition:transform .15s}.dm-node.open>.dm-nh .ar{transform:rotate(90deg)}
  .dm-nh.root{font-size:16px;font-weight:800}.dm-nh .c{font-weight:400;font-size:12px;color:#9aa190}
  .dm-nh .bdg{font-size:10px;color:#2a56a8;background:#e6eefc;border-radius:4px;padding:1px 6px}.dm-nh .tag{font-size:10px;color:#b07a00;background:#fff4dc;border-radius:4px;padding:1px 6px;font-weight:500}.dm-nh .tag.off{color:#8a9181;background:#f0f1ec}.dm-nh .lk{font-size:11px;font-weight:400;color:#a0a797}
  .dm-kids{display:none;padding:2px 0 8px 0;margin-left:7px}.dm-node.open>.dm-kids{display:block}
  .dm-kids>.dm-pp,.dm-kids>.dm-node,.dm-kids>.dm-ek{position:relative;margin-left:20px}
  .dm-kids>*::before{content:'';position:absolute;left:-20px;top:-2px;bottom:0;border-left:1.5px solid #cdd2c4}
  .dm-kids>*:last-child::before{bottom:auto;height:19px}
  .dm-kids>*::after{content:'';position:absolute;left:-20px;top:17px;width:15px;border-top:1.5px solid #cdd2c4}
  .dm-kids>.dm-node::after{top:19px}.dm-kids>.dm-node:last-child::before{height:21px}
  .dm-kids .dm-nh{font-size:13px;padding:9px 2px}
  .dm-pp{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:8px;cursor:pointer;font-size:13px}
  .dm-pp:hover{background:#f4f5f0}.dm-pp.on{background:#2d3726;color:#fff}.dm-pp.on .r{color:#c9d2c3}.dm-pp.on .tel2{color:#cfe0ff}.dm-pp.hit{background:#fff3cc}
  .dm-pp b{font-weight:600;min-width:52px}.dm-pp .r{color:#8a9181;font-size:12px}.dm-pp .dm-rk{display:none}.dm-pp .dm-rk.dm-ow{display:inline;white-space:nowrap;flex-shrink:0;color:#8a9181;font-size:12px;font-weight:400;margin-left:-4px}.dm-pp.on .dm-rk.dm-ow{color:#c9d2c3}.dm-pp .tel2{margin-left:auto;font-size:12px;color:#2a56a8}.dm-pp .lk2{margin-left:auto;font-size:11px;color:#a0a797}
  .dm-pcard{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px;position:sticky;top:84px;min-height:220px}
  .dm-none{color:#a0a797;font-size:13px;text-align:center;padding:56px 10px;line-height:1.8}
  .pc-top{display:flex;align-items:center;gap:14px}.av4{width:54px;height:54px;border-radius:14px;background:#2d3726;color:#fff;display:grid;place-items:center;font-size:15px;font-weight:700;flex:none}.av4.store{background:#fff1d6;color:#8a5a00;font-size:12px}
  .pc-top h3{margin:0;font-size:19px}.pc-top p{margin:3px 0 0;font-size:12.5px;color:#6b7364}
  .pc-rows{margin-top:16px;border-top:1px solid var(--line)}.pc-rows div{display:grid;grid-template-columns:72px 1fr;padding:10px 0;border-bottom:1px solid #f0f1ec;font-size:13px}.pc-rows span{color:#8a9181;font-size:12px}
  .pc-act{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}.pc-act .dmb{min-height:42px;font-size:13px}
  .pc-lock{margin-top:16px;font-size:12px;color:#8a9181;background:#f6f7f2;border-radius:8px;padding:12px;line-height:1.6}
  .dm-pcard .cx{display:none;position:absolute;right:12px;top:10px}
  .dm-shtop{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 16px;margin-bottom:14px}
  .dm-mnav{display:inline-flex;align-items:center;border:1px solid #dfe3d9;border-radius:8px;padding:2px}.dm-mnav button{border:0;background:none;padding:6px 10px;border-radius:6px;color:#6b7364;cursor:pointer;font-size:14px}.dm-mnav b{font-size:14px;min-width:96px;text-align:center}
  .dm-bep{display:flex;align-items:center;gap:8px;font-size:12px;color:#6b7364;flex-wrap:wrap}.dm-bep input{border:0;border-bottom:1px dashed #c9cdc2;width:120px;font-size:14px;font-weight:700;padding:2px;background:none}.dm-bep em{font-style:normal;color:#6b7364}.dm-bep em b{color:#2f372a}
  .dm-avg{margin-left:auto;font-size:12px;color:#6b7364}
  .dm-shlay{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;align-items:start}
  .dm-side{position:sticky;top:84px}
  .dm-wnav{display:inline-flex;align-items:center;gap:2px;border:1px solid #dfe3d9;border-radius:8px;padding:2px}.dm-wnav button{border:0;background:none;padding:5px 10px;border-radius:6px;color:#6b7364;cursor:pointer}.dm-wnav button:disabled{opacity:.3;cursor:default}.dm-wnav b{font-size:13px;min-width:140px;text-align:center}
  .dm-who{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 12px;align-items:center}.dm-who>span{font-size:11px;color:#8a9181;margin-right:2px}
  .dm-who button{border:1px solid #dfe3d9;background:#fff;border-radius:999px;padding:4px 11px;font-size:12px;color:#4a5244;cursor:pointer;white-space:nowrap}.dm-who button.on{background:#2d3726;border-color:#2d3726;color:#fff}.dm-who i{display:inline-block;width:4px;height:11px;border-radius:2px;margin-right:5px;vertical-align:-1px}
  .dm-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
  .dm-col{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}.dm-col.we{background:#fcfcf9}.dm-col.out{opacity:.35}.dm-col.prevm{opacity:.5}.dm-col.prevm .ch{cursor:pointer}.dm-col.sel{box-shadow:0 0 0 2px #c62429}
  .dm-col.flash,.md.flash{animation:dmfl 1.6s}@keyframes dmfl{0%,40%{box-shadow:0 0 0 3px #f2c14e}100%{box-shadow:none}}
  .dm-col .ch{padding:9px 9px 8px;border-bottom:1px solid var(--line);cursor:pointer;background:#fafaf7}.dm-col .ch:hover{background:#f3f4ee}
  .dm-col .dd{display:flex;align-items:baseline;gap:5px}.dm-col .dd b{font-size:17px;line-height:1}.dm-col .dd span{font-size:12px;color:#6b7364}.dm-col .dd i{margin-left:auto;font-style:normal;font-size:11px}
  .dm-col .ch.sat .dd b,.dm-col .ch.sat .dd span{color:#2a56a8}.dm-col .ch.sun .dd b,.dm-col .ch.sun .dd span{color:#c62429}
  .dm-col .n{margin-top:6px;font-size:11px;color:#6b7364;display:flex;gap:6px}.dm-col .n b{font-size:13px;color:#2f372a}.dm-col .n .lo,.dm-col .n .lo b{color:#c62429}
  .sls{padding:6px;display:flex;flex-direction:column;gap:4px}
  .sl{height:30px;display:flex;align-items:center;gap:4px;border-radius:6px;background:#f4f5f0;font-size:12.5px;padding-right:3px;overflow:hidden;white-space:nowrap;transition:opacity .15s}
  .sl:before{content:'';width:4px;align-self:stretch;background:var(--pc);flex:none}
  .sl b{font-weight:600;overflow:hidden;text-overflow:ellipsis;min-width:0}
  .sl select{margin-left:auto;border:1px solid transparent;min-width:0;-webkit-appearance:none;appearance:none;border-radius:5px;font-size:11px;font-weight:600;padding:3px 16px 3px 6px;cursor:pointer;color:#2f372a;flex:none;max-width:92px;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6'%3E%3Cpath d='M1 1l3.5 3.5L8 1' fill='none' stroke='%23777' stroke-width='1.4'/%3E%3C/svg%3E") no-repeat right 5px center}
  .sl select:hover{border-color:#c9cdc2}
  .sl.F select{color:#2b7a3a;background-color:#eef7ef}.sl.L select,.sl.LW select{color:#8a5a00;background-color:#ffefcc}.sl.D select,.sl.DW select{color:#284f99;background-color:#e1eafb}
  .sl.O select,.sl.H select{color:#fff;background-color:#c62429}.sl.V select{color:#fff;background-color:#7a4fa0}.sl.N select{color:#b5bbad;background-color:transparent;font-weight:400}
  .sl.O,.sl.V{background:#fdecec;color:#a3262c}.sl.O b,.sl.V b{text-decoration:line-through;font-weight:500}.sl.H{background:#fff3e6}.sl.N{background:none;color:#b5bbad}.sl.N:before{background:#e3e5de}
  .sl .ro{margin-left:auto;font-size:11px;font-weight:600;color:#4a5244;padding-right:4px}.sl.O .ro,.sl.H .ro{color:#c62429}.sl.V .ro{color:#7a4fa0}.sl.N .ro{color:#c4c8bd;font-weight:400}
  .sl.dim{opacity:.22}.sl.hl{box-shadow:0 0 0 2px var(--pc)}
  .dm-mon{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.dm-mon .h{font-size:11px;text-align:center;color:#6b7364;font-weight:600;padding:2px 0}.dm-mon .h.sat{color:#2a56a8}.dm-mon .h.sun{color:#c62429}
  .dm-mon2 .mh{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;font-size:11px;text-align:center;color:#6b7364;font-weight:600;padding:2px 0 6px}.dm-mon2 .mh .sat{color:#2a56a8}.dm-mon2 .mh .sun{color:#c62429}
  .dm-mon2 .mwk+.mwk{margin-top:6px}.dm-mon2 .mwh{display:none}.dm-mon2 .mg{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
  .md2{border:1px solid var(--line);border-radius:10px;background:#fff;overflow:hidden;display:flex;flex-direction:column;cursor:pointer;min-width:0}.md2:hover{border-color:#c4c8bd}.md2.we{background:#fcfcf9}.md2.sel{box-shadow:0 0 0 2px #c62429}.md2.empty{border:0;background:none;cursor:default}
  .md2 .mc{padding:7px 8px 6px;background:#fafaf7;border-bottom:1px solid var(--line)}.md2 .dd{display:flex;align-items:baseline;gap:4px}.md2 .dd b{font-size:15px}.md2 .dd span{font-size:11px;color:#6b7364}.md2 .dd .sat{color:#2a56a8}.md2 .dd .sun{color:#c62429}.md2 .dd i{margin-left:auto;font-style:normal;font-size:10px}
  .md2 .n{display:flex;gap:4px;margin-top:4px}.md2 .n span{flex:1;text-align:center;background:#fff;border:1px solid #eceee7;border-radius:6px;font-size:10.5px;color:#6b7364;padding:1px 0;white-space:nowrap}.md2 .n b{font-size:12px;color:#2f372a;margin-left:2px}
  .md2 .rs{padding:5px;display:flex;flex-direction:column;gap:2px;flex:1}
  .md2 .r{height:21px;display:flex;align-items:center;gap:5px;border-radius:5px;background:#f4f5f0;font-size:11.5px;padding-right:5px;overflow:hidden;white-space:nowrap}.md2 .r:before{content:'';width:3px;align-self:stretch;background:var(--pc,#e3e5de);flex:none}
  .md2 .r b{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}.md2 .r i{font-style:normal;font-size:10.5px;font-weight:700;border-radius:4px;padding:0 4px;line-height:15px}.md2 .r i.L{background:#ffefcc;color:#8a5a00}.md2 .r i.D{background:#e1eafb;color:#284f99}
  .md2 .r.x{background:none}.md2 .r.x:before{background:#d9dcd3}.md2 .r.x b{color:#b3b7ad;font-weight:400;text-decoration:line-through}
  .md2 .r.na{background:none}.md2 .r.na:before{background:transparent}.md2 .r.na b{color:#cfd2c9;font-weight:400}.md2 .r.na span{color:#cfd2c9;font-size:10px}
  .md2 .of{margin:0 5px 5px;border-radius:6px;background:#fdf3f3;border:1px dashed #efc9cb;padding:4px 6px;font-size:11px;color:#a3262c;line-height:1.45}.md2 .of em{font-style:normal;font-weight:700;font-size:10.5px;color:#c06d71;margin-right:3px}.md2 .of small{font-size:10px;color:#c06d71;margin-left:1px}.md2 .of.none{background:#fafaf7;border-color:#e3e5de;color:#b3b7ad}.md2 .of.none em{color:#b3b7ad}
  .md{border:1px solid var(--line);border-radius:10px;padding:8px 9px;height:100px;cursor:pointer;background:#fff;overflow:hidden}.md:hover{border-color:#c4c8bd}.md.we{background:#fcfcf9}.md.empty{border:0;background:none;cursor:default}
  .md .mtop{display:flex;align-items:baseline}.md .mtop b{font-size:15px}.md .mtop b.sat{color:#2a56a8}.md .mtop b.sun{color:#c62429}.md .mtop i{font-style:normal;font-size:10px;margin-left:auto}
  .md .n{font-size:11px;color:#6b7364;margin-top:5px}.md .n b{color:#2f372a}.md .n .lo,.md .n .lo b{color:#c62429}.md .off{font-size:11px;color:#a3262c;margin-top:4px;line-height:1.45}
  .dm-tools{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;align-items:center}
  .dm-memo-l{margin:0 0 10px;padding-left:18px;font-size:12px;line-height:1.75;color:#3d4537}.dm-memo-l li+li{margin-top:3px}
  .dm-xs{border:0;background:none;color:#b5bbad;font-size:11px;cursor:pointer;padding:0 3px}.dm-xs:hover{color:#c62429}
  .dm-memo-add{display:flex;gap:6px}.dm-memo-add input{flex:1;min-width:0;border:1px solid #dfe3d9;border-radius:8px;min-height:32px;padding:0 10px;font-size:12px}
  .dm-unread{background:#c62429;color:#fff;border-radius:999px;font-size:10px;padding:1px 7px;font-weight:700}
  .dm-wt{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px}.dm-wt button{border:1px solid #dfe3d9;background:#fff;border-radius:999px;font-size:11px;padding:4px 9px;color:#6b7364;cursor:pointer}.dm-wt button.on{background:#2d3726;border-color:#2d3726;color:#fff}.dm-wt i{font-style:normal;background:#c62429;color:#fff;border-radius:999px;font-size:9px;padding:0 5px;margin-left:4px}
  .dm-cweek{font-size:11px;color:#6b7364;margin-bottom:8px}
  .dm-cms{display:flex;flex-direction:column;gap:12px;max-height:440px;overflow-y:auto;margin-bottom:10px;padding-right:4px}
  .dm-cm{display:flex;gap:9px}.dm-cm.rep{margin-left:34px}.dm-cm .av{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-size:9.5px;font-weight:700;color:#fff;flex:none}
  .dm-cm .bd{flex:1;min-width:0}.dm-cm .meta{justify-content:flex-start;font-size:11px;color:#8a9181;display:flex;gap:6px;align-items:center;flex-wrap:wrap}.dm-cm .meta b{color:#2f372a;font-size:12px}
  .dm-cm .tx{font-size:12px;line-height:1.6;margin-top:2px;color:#363e31;white-space:pre-wrap;word-break:break-word}.dm-cm.new .tx{background:#fff8e8;border-radius:6px;padding:4px 7px;margin-left:-7px}
  .dm-cm .acts{display:flex;gap:10px;margin-top:2px}.dm-cm .acts button{border:0;background:none;padding:0;font-size:10.5px;color:#8a9181;cursor:pointer}.dm-cm .acts button:hover{color:#c62429}
  .dt{border:0;background:#e6eefc;color:#2a56a8;font-size:10px;border-radius:4px;padding:1px 6px;font-weight:600;cursor:pointer}
  .dm-compose{border:1px solid #dfe3d9;border-radius:10px;padding:8px}.dm-compose .tag{display:flex;align-items:center;gap:5px;margin-bottom:6px;font-size:11px;color:#8a9181}.dm-compose .tag button{border:0;background:none;color:#8a9181;cursor:pointer}
  .dm-compose textarea{width:100%;border:0;resize:none;min-height:52px;outline:none;font-size:12px;font-family:inherit}.dm-compose .row{display:flex;justify-content:flex-end}
  .dm-day .er{display:grid;grid-template-columns:76px 1fr;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #f0f1ec}.dm-day .nm{font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:6px}.dm-day .nm i{width:4px;height:13px;border-radius:2px}
  @media(max-width:1599px){.dm-shlay{grid-template-columns:minmax(0,1fr)}.dm-side{position:static;display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}.dm-side>.card{margin:0}}
  @media(max-width:1100px){.dm-side{grid-template-columns:1fr}}
  @media(max-width:1100px){.dm-dir{grid-template-columns:1fr}.dm-pcard{position:fixed;left:0;right:0;bottom:0;top:auto;border-radius:16px 16px 0 0;box-shadow:0 -8px 30px #0003;z-index:70;transform:translateY(110%);transition:transform .2s;min-height:0}.dm-pcard.on{transform:none}.dm-pcard .cx{display:block}}
  @media(max-width:860px){
    .dm-sum{grid-template-columns:1fr 1fr}.dm-kv3{grid-template-columns:1fr}.dm-fg,.dm-frsec{grid-template-columns:1fr}.dm-seg2{grid-template-columns:1fr}
    .dm-orgbar{margin-top:0}.dm-search{width:100%}.dm-pp .r{display:none}.dm-pp .dm-rk{display:inline;white-space:nowrap;flex-shrink:0;color:#8a9181;font-size:12px;font-weight:400;margin-left:-4px}.dm-pp.on .dm-rk{color:#c9d2c3}
    .dm-week{grid-template-columns:1fr;gap:10px}.dm-col.out{display:none}.sls{display:grid;grid-template-columns:1fr 1fr}.sl select{max-width:none}
    .dm-mon{grid-template-columns:1fr}.dm-mon .h,.md.empty{display:none}
    .dm-mon2 .mh{display:none}.dm-mon2 .mwh{display:block;font-size:11.5px;color:#6b7364;font-weight:600;margin:4px 0 5px}.dm-mon2 .mwk+.mwk{margin-top:12px}.dm-mon2 .mg{grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.md2.empty{display:none}.md{height:auto;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}.md .n,.md .off{margin-top:0}
    .dm-who{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px}.dm-avg{margin-left:0}
    .dm-day .er{grid-template-columns:1fr}.dm-day .dm-seg.sm{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}.dm-day .dm-seg.sm button{padding:7px 2px}
  }`;
  document.head.appendChild(css);
})();

