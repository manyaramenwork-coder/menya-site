
// v5.0: Supabase 인증 (1회차) — 로그인 · 첫 로그인 비밀번호 변경 · 로그아웃 · 메뉴별 연결 예정 표시
(function(){
  const CFG = window.MM_CONFIG || {};
  const $ = id => document.getElementById(id);
  let SB = null;
  try {
    /* 로그인 유지 (2026-11-04): 'mm-keep'이 켜져 있으면 로그아웃 전까지 유지(localStorage), 꺼져 있으면 창을 닫으면 풀림(sessionStorage) */
    const keepOn = () => { try { return localStorage.getItem('mm-keep') !== '0'; } catch (e) { return false; } };
    const authStore = {
      getItem: k => { try { return localStorage.getItem(k) ?? sessionStorage.getItem(k); } catch (e) { return sessionStorage.getItem(k); } },
      setItem: (k, v) => { try { if (keepOn()) { localStorage.setItem(k, v); sessionStorage.removeItem(k); } else { sessionStorage.setItem(k, v); localStorage.removeItem(k); } } catch (e) { sessionStorage.setItem(k, v); } },
      removeItem: k => { try { localStorage.removeItem(k); } catch (e) {} sessionStorage.removeItem(k); }
    };
    SB = supabase.createClient(CFG.url, CFG.key, { auth: { storage: authStore, storageKey: 'mm-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  } catch (e) { console.error(e); }
  window.SB = SB;
  let LOGIN_PW = '', manualOut = false;

  function showView(v){
    document.body.classList.remove('booting');
    if (v === 'app') { $('login').style.display = 'none'; $('app').style.display = 'block'; return; }
    $('app').style.display = 'none'; $('login').style.display = '';
    $('loginbox').hidden = v !== 'login'; $('pwbox').hidden = v !== 'pw';
  }
  function busy(form, on, text){
    const b = form.querySelector('button[type=submit]'), s = b.querySelector('span');
    if (on) { b.dataset.t = s.textContent; s.textContent = text; b.disabled = true; }
    else { if (b.dataset.t) s.textContent = b.dataset.t; b.disabled = false; }
  }
  function authMsg(e){
    const m = String((e && e.message) || e || '');
    if (/invalid login credentials/i.test(m)) return '아이디 또는 비밀번호가 맞지 않아요.';
    if (/banned/i.test(m)) return '사용이 중지된 계정이에요. 관리자에게 문의하세요.';
    if (/not confirmed/i.test(m)) return '아직 승인되지 않은 계정이에요. 관리자에게 문의하세요.';
    if (/rate limit|too many/i.test(m)) return '시도가 너무 많아요. 잠시 후 다시 시도해주세요.';
    if (/different from the old/i.test(m)) return '지금 쓰는 비밀번호와 다르게 정해주세요.';
    if (/weak|at least|characters/i.test(m)) return '비밀번호가 너무 단순해요. 영문과 숫자를 섞어 8자 이상으로 정해주세요.';
    if (/fetch|network|load failed/i.test(m)) return '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해주세요.';
    return '처리하지 못했어요. (' + m + ')';
  }
  async function stop(msg){
    manualOut = true; try { await SB.auth.signOut({ scope: 'local' }); } catch (e) {}
    SESSION = { token: '', user: null, mustChange: false }; window.CURRENT_USER = null;
    showView('login'); $('lerr').textContent = msg || '';
  }

  async function startSession(session){
    const { data: p, error } = await SB.from('profiles')
      .select('login_id,name,title,dept,role,store_id,active,must_change').eq('id', session.user.id).maybeSingle();
    if (error) throw error;
    if (!p) return stop('계정 정보가 아직 등록되지 않았어요. 관리자에게 문의하세요.');
    if (p.active === false) return stop('사용이 중지된 계정이에요. 관리자에게 문의하세요.');
    if (p.role === 'mst') return stop('가맹점주 계정은 멘야 파트너스 앱(store.menyamatsuri.work)을 이용해 주세요.');
    const id = p.login_id || String(session.user.email || '').replace(CFG.idDomain, '');
    const u = { id: id, name: p.name || id, title: p.title || '', org: p.dept || '', role: p.role, storeId: p.store_id, status: '사용', uid: session.user.id };
    SESSION = { token: session.access_token, user: u, mustChange: !!p.must_change };
    window.CURRENT_USER = u;
    if (p.must_change) { $('pw-who').textContent = u.name; $('pw-uid').value = id; showView('pw'); setTimeout(() => $('npw').focus(), 50); return; }
    enterApp();
  }
  function enterApp(){
    showView('app');
    try { setTopUser(SESSION.user); } catch (e) {}
    go('dash'); window.scrollTo(0, 0);
  }

  doLogin = async function(){
    const form = $('loginbox'), err = $('lerr');
    const id = $('uid').value.trim(), pw = $('upw').value;
    if (!id || !pw) { err.textContent = '아이디와 비밀번호를 입력해주세요.'; return; }
    if (!SB) { err.textContent = '서버 연결 준비가 안 됐어요. 페이지를 새로고침해주세요.'; return; }
    err.textContent = ''; busy(form, true, '확인 중...');
    try {
      const email = (id.indexOf('@') >= 0 ? id : id + CFG.idDomain).toLowerCase();
      const { data, error } = await SB.auth.signInWithPassword({ email: email, password: pw });
      if (error) throw error;
      manualOut = false; LOGIN_PW = pw;
      await startSession(data.session);
    } catch (e) { err.textContent = authMsg(e); }
    finally { busy(form, false); $('upw').value = ''; }
  };

  window.doChangePw = async function(){
    const form = $('pwbox'), err = $('pwerr'), a = $('npw').value, b = $('npw2').value;
    if (a.length < 8) { err.textContent = '비밀번호는 8자 이상으로 정해주세요.'; return; }
    if (a !== b) { err.textContent = '두 칸의 비밀번호가 서로 달라요. 다시 확인해주세요.'; return; }
    if (LOGIN_PW && a === LOGIN_PW) { err.textContent = '지금 쓰는 비밀번호와 다르게 정해주세요.'; return; }
    err.textContent = ''; busy(form, true, '바꾸는 중...');
    try {
      const r1 = await SB.auth.updateUser({ password: a }); if (r1.error) throw r1.error;
      const r2 = await SB.rpc('clear_must_change'); if (r2.error) throw r2.error;
      LOGIN_PW = ''; $('npw').value = $('npw2').value = ''; SESSION.mustChange = false;
      enterApp(); toast('비밀번호를 바꿨어요. 다음 로그인부터 새 비밀번호를 쓰세요.');
    } catch (e) { err.textContent = authMsg(e); }
    finally { busy(form, false); }
  };

  logout = async function(){
    try { closeSide(); } catch (e) {}
    LOGIN_PW = ''; $('upw').value = ''; $('npw').value = $('npw2').value = ''; $('pwerr').textContent = '';
    await stop('');
    window.scrollTo(0, 0);
  };

  if (SB) SB.auth.onAuthStateChange((ev) => {
    if (ev === 'SIGNED_OUT' && !manualOut && SESSION.user) stop('로그인이 만료됐어요. 다시 로그인해주세요.');
    if (ev === 'TOKEN_REFRESHED') SB.auth.getSession().then(r => { if (r.data.session) SESSION.token = r.data.session.access_token; });
  });

  // 메뉴별 연결 예정 (회차가 끝나면 이 표에서 빠짐)
  const PENDING = {
  };
  window.MM_PENDING = PENDING;
  function pendingPage(p){
    const [n, title, path] = PENDING[p];
    const body = n
      ? `${ic('clock')}<h2>${title}</h2>이 화면은 ${n}회차 작업에서 새 데이터베이스와 연결돼요.<p style="font-size:10px">지금은 로그인과 메뉴 이동만 확인할 수 있어요.</p>`
      : `${ic('info')}<h2>${title}</h2>자동 연동 설정은 당분간 기존 Apps Script 사이트에서 관리해요.<p style="font-size:10px">N오더·제때·오션 자동 수집은 그대로 돌아가고, 저장 위치만 새 데이터베이스로 바뀌어요.</p>`;
    document.getElementById('main').innerHTML =
      simpleHero(path.length > 1 ? path : [], 'STORE OPERATIONS', title, '멘야마쯔리의 매장 운영을 한곳에서 관리하세요.') +
      `<div class="card placeholder">${body}</div>` + pageFoot();
    const el = document.querySelector('.page-hero .hero-image');
    if (el) { const v = HERO_IMG[p] || '--img0'; el.style.backgroundImage = 'linear-gradient(90deg,#eaece3,transparent 40%),var(' + v + ')'; el.style.backgroundPosition = HERO_POS[v] || ''; }
  }

  // ===== 메뉴별 데이터 불러오기 (회차마다 여기에 추가) =====
  const LOADERS = {
    dash: async function(){
      const { data, error } = await SB.rpc('dash_data'); if (error) throw error;
      Object.assign(META, data.meta);
      FC_SYNCED = data.meta.fcSynced || '';
      FC_NOTICES = data.notices || [];
      FC = data.fc || [];
      DASH = { jt: data.jt };
    }
  };
  // 3회차 → v6.x: 제때 관리 — 조회할 때 고른 기간만 서버에서 받음 (2020-06부터, 한 번에 최대 3개월)
  //   처음 열 때는 이번 달(1일~오늘 이후 마지막 배송일)을 받고, 30분 지나면 다시 받음
  let JETTE_AT = 0;
  const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  window.JT_HAS = null;
  window.jtFetch = async function(from, to, basis){
    const { data, error } = await SB.rpc('jette_range', { p_from: from, p_to: to, p_basis: basis || 'ship' });
    if (error) throw error;
    jtApply(data);
    window.JT_HAS = [from, to, basis || 'ship'];
  };
  function jtApply(data){
    Object.assign(META, data.meta);
    Object.keys(MASTER).forEach(k => delete MASTER[k]); Object.assign(MASTER, data.master || {});
    RAW = data.jette;
    ROWS = RAW.rows.map(r => { const p = RAW.prods[r[3]]; return {ship:r[0],order:r[1],store:RAW.stores[r[2]],code:p[0],name:p[1],cat:p[2],unit:p[3],tax:p[4],qty:r[4],price:r[5],supply:r[6],vat:r[7],total:r[8],no:r[9]}; });
    ALLROWS = ROWS;
    STORES = (data.allStores && data.allStores.length ? data.allStores : [...new Set(ROWS.map(r=>r.store))]).slice().sort((a,b)=>a.localeCompare(b,'ko'));
    DMIN = RAW.min; DMAX = RAW.max;
    CATS.length = 0; [...new Set(ROWS.map(r=>r.cat).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko')).forEach(c => CATS.push(c));
  }
  async function loadJette(){
    const t = kstToday(), from = t.slice(0, 8) + '01';
    // 다음 날 배송분까지 보이도록 종료일은 넉넉히(+7일), 서버가 3개월 이내인지 확인
    const end = new Date(Date.parse(t) + 7 * 864e5).toISOString().slice(0, 10);
    await jtFetch(from, end, 'ship');
    JETTE_AT = Date.now();
  }
  loadJette.ready = () => JETTE_AT && Date.now() - JETTE_AT < 30 * 60e3;
  LOADERS['store-orders'] = loadJette;
  LOADERS['period-sales'] = loadJette;
  // 4회차: 매출 · 출결 — 전체를 받아 두고 30분 지나면 다시 받음
  let SALES_AT = 0, ATT_AT = 0;
  async function loadSales(){
    const { data, error } = await SB.rpc('sales_data'); if (error) throw error;
    Object.assign(META, data.meta);
    SALES = data.sales || { stores: [], rows: [] };
    S_MIN = SALES.rows.length ? SALES.rows[0][0] : ''; S_MAX = SALES.rows.length ? SALES.rows[SALES.rows.length-1][0] : '';
    SALES_AT = Date.now();
  }
  loadSales.ready = () => SALES_AT && Date.now() - SALES_AT < 30 * 60e3;
  async function loadAtt(){
    const { data, error } = await SB.rpc('att_data'); if (error) throw error;
    Object.assign(META, data.meta); ATT_SRC = META.attSrc;
    ATT = data.att || {};
    PUNCH = data.punch || [];
    Object.keys(PMAP).forEach(k => delete PMAP[k]);
    PUNCH.forEach(([d, t, n, ty, au]) => { (PMAP[n + '|' + d] ||= []).push({t, ty, au}); });
    Object.values(PMAP).forEach(v => v.sort((a, b) => a.t.localeCompare(b.t)));
    PUNCH_FROM = PUNCH.reduce((m, p) => p[0] < m ? p[0] : m, '9999');
    ATT_AT = Date.now();
  }
  loadAtt.ready = () => ATT_AT && Date.now() - ATT_AT < 30 * 60e3;
  LOADERS['sales-report'] = loadSales;
  LOADERS['hr-att'] = loadAtt;
  // 5회차: FC발주 · 본사 창고 — 네 화면이 같이 씀
  let WH_AT = 0;
  async function loadWh(){
    const { data, error } = await SB.rpc('wh_data'); if (error) throw error;
    Object.assign(META, data.meta); FC_SYNCED = META.fcSynced || '';
    FC = data.fc || [];
    INV = data.inv || { items: [], moves: [] };
    Object.keys(MASTER).forEach(k => delete MASTER[k]); Object.assign(MASTER, data.master || {});
    WH_AT = Date.now();
  }
  loadWh.ready = () => WH_AT && Date.now() - WH_AT < 30 * 60e3;
  ['fc-orders', 'inv-stock', 'inv-io', 'inv-log', 'inv-count'].forEach(p => LOADERS[p] = loadWh);
  window.meName = () => (SESSION.user && (SESSION.user.name || SESSION.user.id)) || '';
  const dashLoad = LOADERS.dash;
  LOADERS.dash = async function(){ await dashLoad(); WH_AT = 0; }; // 대시보드는 진행중 발주만 받아 FC를 덮어쓰므로 창고 쪽은 다시 받게 함
  window.invCanEdit = () => !!(SESSION.user && (SESSION.user.role === 'admin' || SESSION.user.role === 'hq'));

  // 입·출고 저장 (서버가 담당자 이름 · 등록 시각을 붙임)
  iSaveMoves = function(list, after){
    const btn = document.getElementById('im-save') || document.getElementById('io-save'); if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
    SB.rpc('inv_save_moves', { p_list: list }).then(({ data: r, error }) => {
      if (error) { if (btn) { btn.disabled = false; btn.textContent = '저장'; } return toast('저장 실패: ' + error.message); }
      list.forEach((m, i) => INV.moves.push([m.date, m.type, m.code, +m.qty, m.party || '', m.memo || '', (m.by || '').trim() || r.by, r.at, r.ids[i], r.by]));
      document.getElementById('inv-modal')?.remove(); toast(list.length + '건 저장했어요.'); after && after();
    });
  };
  // 입·출고 취소 (지우지 않고 취소 표시)
  window.invCancel = function(id){
    const m = INV.moves.find(x => x[8] === id); if (!m) return;
    const it = iItem(m[2]) || {};
    iModal('입·출고 취소', `<p class="im-now">${ih(m[0])} · ${ih(m[1])} · <b>${ih(it.name || m[2])}</b> ${fmt(m[3])}${ih(it.unit || '')}${m[4] ? ' · ' + ih(m[4]) : ''}</p>
      <div class="im-grid"><div class="f wide"><label>취소 사유<span> (선택)</span></label><input id="ic-reason" placeholder="예: 수량 잘못 입력"></div></div>
      <p class="im-warn">취소하면 재고 계산과 목록에서 빠져요. 기록은 지워지지 않고 누가 언제 취소했는지 남아요.</p>`, () => {
      const btn = document.getElementById('im-save'); btn.disabled = true; btn.textContent = '취소 중...';
      SB.rpc('inv_cancel_move', { p_id: id, p_reason: document.getElementById('ic-reason').value }).then(({ error }) => {
        if (error) { btn.disabled = false; btn.textContent = '취소하기'; return toast('취소 실패: ' + error.message); }
        INV.moves = INV.moves.filter(x => x[8] !== id);
        document.getElementById('inv-modal')?.remove(); toast('취소했어요.'); if (document.getElementById('lg-type')) runInvLog();
      });
    }, '취소하기');
  };

  // ===== 월말 재고조사 =====
  const CT_KEY = 'mm-count-draft';
  const ctDraft = () => { try { return JSON.parse(localStorage.getItem(CT_KEY) || '{}'); } catch (e) { return {}; } };
  const ctKeep = d => { try { localStorage.setItem(CT_KEY, JSON.stringify(d)); } catch (e) {} };
  const ctUnit = it => ih(it.unit || '');
  window.pageInvCount = function(){
    const d = ctDraft();
    const anyKnown = invCalc().some(r => r.known);
    document.getElementById('main').innerHTML = simpleHero(['본사 창고 관리','월말 재고조사'], 'WAREHOUSE · MONTHLY COUNT', '월말 재고조사', '창고에서 센 실제 수량을 한 번에 넣고, 장부 수량과의 차이를 확인하세요.') +
    `<section class="card query-card"><div class="section-title"><strong>${ic('check')}조사 정보</strong><small>센 품목만 저장돼요</small></div>
     <div class="filters">
      <div class="f"><label for="ct-date">조사 일자</label><input type="date" id="ct-date" value="${ih(d.date || iToday())}" onchange="ctSaveDraft()"></div>
      <div class="f"><label for="ct-by">조사자</label><input type="text" id="ct-by" value="${ih(d.by || meName())}" oninput="ctSaveDraft()"></div>
      <div class="f"><label>정렬</label>${segHtml('ct-sort', [['cat','분류별'],['loc','창고 위치별']])}</div>
      <div class="f"><label for="ct-q">품목 검색<span>선택</span></label><input type="text" id="ct-q" placeholder="예: 물티슈" oninput="ctFilter()"></div>
     </div>
     <div class="im-warn">${anyKnown ? '비워 둔 품목은 저장되지 않고 장부 수량이 그대로 유지돼요. 다 센 직후 바로 저장해주세요 — 저장한 시각 이후에 완료된 FC다움 발주부터 재고에서 빠져요.' : '<b>처음 하는 재고조사예요.</b> 이번에 센 수량이 기준이 되고, 다음 조사부터 장부 수량과의 차이가 계산돼요.'}<br>입력한 수량은 이 기기에 임시로 남아서, 새로고침하거나 다른 화면에 다녀와도 지워지지 않아요.</div>
    </section>
    <div class="sum period" id="ct-kpi"></div>
    <div class="card"><div class="meta"><div class="left"><strong>품목별 수량</strong><span class="count" id="ct-cnt"></span></div><button class="btn ghost" onclick="ctRender();dlCsv('본사창고_월말재고조사')">${ic('download')}CSV 다운로드</button></div>
     <div class="tbl-wrap"><table class="inv-tbl ct-tbl"><thead><tr><th>품목</th><th class="n">장부 수량</th><th class="n">실제 수량</th><th class="n">차이</th><th class="n">차이 금액</th><th>메모</th></tr></thead><tbody id="ct-body"></tbody></table></div>
     <div class="actions"><span class="filter-hint" id="ct-sum"></span><button class="btn ghost" onclick="ctClear()">${ic('reset')}입력 지우기</button><button class="btn primary" onclick="ctSave()">${ic('check')}재고조사 저장</button></div>
    </div>` + pageFoot();
    document.querySelectorAll('#ct-sort button').forEach(b => b.addEventListener('click', () => setTimeout(ctRender, 0)));
    ctRender();
  };
  function ctRows(){
    const calc = {}; invCalc().forEach(r => calc[r.it.code] = r);
    const sort = document.querySelector('#ct-sort .on')?.dataset.v || 'cat';
    const items = INV.items.filter(x => x.use !== '중지').slice();
    const ci = c => { const i = INV_CATS.indexOf(c); return i < 0 ? 99 : i; };
    items.sort((a, b) => sort === 'loc' ? ((a.loc || '힣').localeCompare(b.loc || '힣', 'ko') || ci(a.cat) - ci(b.cat) || a.name.localeCompare(b.name, 'ko'))
                                         : (ci(a.cat) - ci(b.cat) || (a.loc || '').localeCompare(b.loc || '', 'ko') || a.name.localeCompare(b.name, 'ko')));
    return { items, calc, sort };
  }
  window.ctRender = function(){
    const { items, calc, sort } = ctRows(), d = ctDraft().vals || {};
    let grp = null, html = '';
    items.forEach(it => {
      const g = sort === 'loc' ? (it.loc || '위치 미지정') : it.cat;
      if (g !== grp) { grp = g; html += `<tr class="ct-grp"><td colspan="6">${ih(g)}</td></tr>`; }
      const r = calc[it.code], v = d[it.code] || {};
      html += `<tr data-code="${ih(it.code)}" data-k="${ih((it.name + ' ' + it.spec + ' ' + it.code + ' ' + it.loc).toLowerCase())}">
        <td><b>${ih(it.name)}</b>${it.spec ? `<small>${ih(it.spec)}</small>` : ''}${it.loc ? `<small class="loc">📍 ${ih(it.loc)}</small>` : ''}</td>
        <td class="n">${r && r.known ? `<b>${fmt(r.qty)}</b> ${ctUnit(it)}` : '<span class="ct-unk">모름</span>'}</td>
        <td class="n"><input type="number" class="ct-q" min="0" step="any" inputmode="decimal" value="${v.q ?? ''}" oninput="ctRow(this)"> ${ctUnit(it)}</td>
        <td class="n ct-d">-</td><td class="n ct-a">-</td>
        <td><input class="ct-m" placeholder="선택" value="${ih(v.m || '')}" oninput="ctRow(this)"></td></tr>`;
    });
    document.getElementById('ct-body').innerHTML = html || '<tr><td colspan="6"><div class="empty">사용 중인 품목이 없어요.</div></td></tr>';
    document.querySelectorAll('#ct-body tr[data-code]').forEach(tr => ctCalcRow(tr, calc));
    ctFilter(); ctKpi(calc);
  };
  function ctCalcRow(tr, calc){
    const code = tr.dataset.code, it = iItem(code), r = calc[code], raw = tr.querySelector('.ct-q').value;
    const dEl = tr.querySelector('.ct-d'), aEl = tr.querySelector('.ct-a');
    tr.classList.toggle('ct-on', raw !== '');
    if (raw === '') { dEl.textContent = '-'; aEl.textContent = '-'; return; }
    if (!r || !r.known) { dEl.innerHTML = '<span class="ct-unk">첫 조사</span>'; aEl.textContent = '-'; return; }
    const diff = +raw - r.qty, amt = diff * (it.cost || 0);
    dEl.innerHTML = diff === 0 ? '<span class="ct-ok">일치</span>' : `<b class="${diff > 0 ? 'plus' : 'minus'}">${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))}</b>`;
    aEl.innerHTML = diff === 0 || !it.cost ? '-' : `<span class="${diff > 0 ? 'plus' : 'minus'}">${diff > 0 ? '+' : '−'}${fmt(Math.abs(amt))}</span>`;
  }
  window.ctRow = function(el){
    const calc = {}; invCalc().forEach(r => calc[r.it.code] = r);
    ctCalcRow(el.closest('tr'), calc); ctSaveDraft(); ctKpi(calc);
  };
  window.ctSaveDraft = function(){
    const vals = {};
    document.querySelectorAll('#ct-body tr[data-code]').forEach(tr => { const q = tr.querySelector('.ct-q').value, m = tr.querySelector('.ct-m').value.trim(); if (q !== '' || m) vals[tr.dataset.code] = { q, m }; });
    ctKeep({ date: document.getElementById('ct-date')?.value, by: document.getElementById('ct-by')?.value, vals });
  };
  window.ctFilter = function(){
    const q = (document.getElementById('ct-q')?.value || '').trim().toLowerCase();
    document.querySelectorAll('#ct-body tr[data-code]').forEach(tr => tr.style.display = !q || tr.dataset.k.includes(q) ? '' : 'none');
  };
  function ctCollect(calc){
    const out = [];
    document.querySelectorAll('#ct-body tr[data-code]').forEach(tr => {
      const raw = tr.querySelector('.ct-q').value; if (raw === '' || +raw < 0) return;
      const it = iItem(tr.dataset.code), r = calc[it.code], known = !!(r && r.known), diff = known ? +raw - r.qty : null;
      out.push({ it, qty: +raw, book: known ? r.qty : null, diff, amt: known ? diff * (it.cost || 0) : 0, memo: tr.querySelector('.ct-m').value.trim() });
    });
    return out;
  }
  function ctKpi(calc){
    const list = ctCollect(calc), total = INV.items.filter(x => x.use !== '중지').length;
    const diffN = list.filter(x => x.diff).length, loss = list.reduce((s, x) => s + (x.amt < 0 ? -x.amt : 0), 0), gain = list.reduce((s, x) => s + (x.amt > 0 ? x.amt : 0), 0);
    document.getElementById('ct-kpi').innerHTML = `<div class="k hl"><div class="l">${ic('check')}센 품목</div><div class="v">${list.length}<small>/ ${total}개</small></div></div>
      <div class="k"><div class="l">${ic('info')}차이 있는 품목</div><div class="v">${diffN}<small>개</small></div></div>
      <div class="k"><div class="l">${ic('coin')}부족 금액 (매입가)</div><div class="v minus">${fmt(loss)}<small>원</small></div></div>
      <div class="k"><div class="l">${ic('coin')}초과 금액 (매입가)</div><div class="v plus">${fmt(gain)}<small>원</small></div></div>`;
    document.getElementById('ct-cnt').textContent = total + '개';
    document.getElementById('ct-sum').textContent = list.length ? `${list.length}개 품목 저장 준비` : '';
    LAST = { head: ['코드','분류','품목','규격','위치','장부 수량','실제 수량','차이','차이 금액(매입가)','단위','메모'],
      body: ctRows().items.map(it => { const x = list.find(y => y.it.code === it.code), r = calc[it.code];
        return [it.code, it.cat, it.name, it.spec, it.loc, r && r.known ? r.qty : '', x ? x.qty : '', x && x.diff !== null ? x.diff : '', x && x.diff !== null ? x.amt : '', it.unit, x ? x.memo : '']; }) };
  }
  window.ctClear = function(){
    iModal('입력 지우기', '<p class="im-now">이 화면에 넣은 수량과 메모를 모두 지울까요? 저장된 재고조사 기록은 그대로예요.</p>', () => {
      ctKeep({ date: document.getElementById('ct-date').value, by: document.getElementById('ct-by').value, vals: {} });
      document.getElementById('inv-modal')?.remove(); ctRender(); toast('입력을 지웠어요.');
    }, '지우기');
  };
  window.ctSave = function(){
    const calc = {}; invCalc().forEach(r => calc[r.it.code] = r);
    const list = ctCollect(calc); if (!list.length) return toast('센 수량을 하나 이상 넣어주세요.');
    const date = document.getElementById('ct-date').value || iToday(), by = document.getElementById('ct-by').value.trim();
    const total = INV.items.filter(x => x.use !== '중지').length, diffN = list.filter(x => x.diff).length, loss = list.reduce((s, x) => s + (x.amt < 0 ? -x.amt : 0), 0);
    iModal('재고조사 저장', `<p class="im-now">${ih(date)} · 조사자 <b>${ih(by || meName())}</b></p>
      <p class="im-now">센 품목 <b>${list.length}개</b> / 전체 ${total}개 · 차이 있는 품목 <b>${diffN}개</b>${loss ? ` · 부족 금액 <b class="minus">${fmt(loss)}원</b>` : ''}</p>
      ${list.length < total ? `<p class="im-warn">세지 않은 ${total - list.length}개 품목은 저장되지 않고 장부 수량이 그대로 유지돼요.</p>` : ''}
      <p class="im-warn">저장하면 센 수량이 각 품목의 현재고가 돼요. 잘못 넣은 줄은 입·출고 내역에서 취소할 수 있어요.</p>`, () => {
      const moves = list.map(x => ({ date, type: '재고조사', code: x.it.code, qty: x.qty, party: '',
        memo: '월말 조사 · ' + (x.book === null ? '첫 조사' : `장부 ${fmt(x.book)} → 차이 ${x.diff > 0 ? '+' : x.diff < 0 ? '−' : '±'}${fmt(Math.abs(x.diff))}`) + (x.memo ? ' · ' + x.memo : ''), by }));
      iSaveMoves(moves, () => { ctKeep({}); go('inv-log'); setTimeout(() => { const s = document.getElementById('lg-type'); if (s) { s.value = '재고조사'; runInvLog(); } }, 50); });
    }, '저장');
  };
  const ctst = document.createElement('style');
  ctst.textContent = '.ct-tbl .ct-q{width:84px;text-align:right;border:1px solid #dcdfd6;border-radius:8px;padding:7px 8px;font-size:14px}.ct-tbl .ct-m{width:100%;min-width:120px;box-sizing:border-box;border:1px solid #dcdfd6;border-radius:8px;padding:7px 8px;font-size:12.5px}.ct-tbl tr.ct-grp td{background:#f4f5f0;font-weight:700;font-size:12px;color:#4a5244;padding:8px 12px}.ct-tbl tr.ct-on td{background:#fbfcf8}.ct-unk{color:#8a6d2b;font-size:12px}.ct-ok{color:#4b6b35;font-size:12px}.sum .v.minus{color:#a8261a}.sum .v.plus{color:#245a8f}span.plus{color:#245a8f}span.minus{color:#a8261a}';
  document.head.appendChild(ctst);
  const cst = document.createElement('style');
  cst.textContent = '.inv-x{margin-left:6px;border:1px solid #dcdfd6;background:#fff;border-radius:6px;padding:2px 7px;font-size:11px;color:#7b8174;cursor:pointer}.inv-x:hover{border-color:#c8102e;color:#c8102e}';
  document.head.appendChild(cst);

  const LOAD_TITLE = { 'fc-orders': ['매장 발주 (FC다움)', ['본사 발주·재고', '매장 발주 (FC다움)']], 'inv-stock': ['재고 현황', ['본사 발주·재고', '재고 현황']], 'inv-io': ['입·출고 등록', ['본사 발주·재고', '입·출고 등록']], 'inv-log': ['입·출고 내역', ['본사 발주·재고', '입·출고 내역']], 'inv-count': ['월말 재고조사', ['본사 발주·재고', '월말 재고조사']], 'user-list': ['사용자 관리', ['사용자 관리', '사용자 관리']], 'sales-report': ['가맹점 매출 조회', ['매출 관리', '가맹점 매출 조회']], 'hr-att': ['쌍용본점 출결관리', ['인사관리', '쌍용본점 출결관리']], dash: ['대시보드', []], 'store-orders': ['매장별 주문내역 조회', ['제때 관리', '매장별 주문내역 조회']], 'period-sales': ['기간별 공급가 조회', ['제때 관리', '기간별 공급가 조회']] };
  let loadSeq = 0;
  function loadingPage(p, msg, retry){
    const [title, path] = LOAD_TITLE[p] || [p, []];
    document.getElementById('main').innerHTML = simpleHero(path, 'STORE OPERATIONS', title, '멘야마쯔리의 매장 운영을 한곳에서 관리하세요.') +
      `<div class="card"><div class="empty">${msg}${retry ? `<br><button class="btn ghost" style="margin-top:14px" onclick="go('${p}')">${ic('reset')}다시 불러오기</button>` : ''}</div></div>` + pageFoot();
  }

  // ===== 6회차: 사용자 관리 =====
  const isAdmin = () => !!(SESSION.user && SESSION.user.role === 'admin');
  window.isAdmin = isAdmin;
  const ADMIN_PAGES = ['user-new', 'user-list'];
  let USERS = [], USERS_AT = 0;
  async function loadUsersSB(){
    const { data, error } = await SB.rpc('users_data'); if (error) throw error;
    USERS = data || []; USERS_AT = Date.now();
  }
  loadUsersSB.ready = () => USERS_AT && Date.now() - USERS_AT < 5 * 60e3;
  LOADERS['user-list'] = loadUsersSB;
  loadUsers = () => USERS;
  async function adminCall(body){
    const { data, error } = await SB.functions.invoke('admin-users', { body });
    if (error) { let m = error.message; try { const j = await error.context.json(); m = j.error || m; } catch (e) {} throw new Error(m); }
    if (data && data.ok === false) throw new Error(data.error || '처리하지 못했어요');
    return data;
  }
  const ROLE_LABEL = { admin: '관리자', hq: '본사', store: '매장 관리자', staff: '매장 사원' };
  userForm = function(u, mode){
    const v = k => esc(u?.[k] || '');
    const sel = (id, opts, cur) => `<select id="${id}">${opts.map(o => `<option ${o===cur?'selected':''}>${o}</option>`).join('')}</select>`;
    const curRole = u?.role || 'hq';
    const roleSel = `<select id="u-role" onchange="mmUserRoleChange()">${[['admin','관리자'],['hq','본사'],['store','매장 관리자'],['staff','매장 사원']].map(([k, t]) => `<option value="${k}" ${curRole === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
    const needStore = curRole === 'store' || curRole === 'staff';
    setTimeout(window.mmFillUserStores, 0);
    return `<div class="uf-grid">
      <div class="f"><label for="u-id">아이디 <em>*</em></label><input type="text" id="u-id" value="${v('id')}" ${mode==='edit'?'disabled':''} placeholder="영문 소문자·숫자 4~20자" autocomplete="off" autocapitalize="off"></div>
      <div class="f"><label for="u-name">이름 <em>*</em></label><input type="text" id="u-name" value="${v('name')}" placeholder="예: 홍길동"></div>
      <div class="f"><label for="u-pw">${mode==='edit' ? '비밀번호 초기화 <span>필요할 때만 입력</span>' : '임시 비밀번호 <em>*</em>'}</label><input type="password" id="u-pw" placeholder="8자 이상" autocomplete="new-password"></div>
      <div class="f"><label for="u-pw2">${mode==='edit' ? '초기화 비밀번호 확인' : '임시 비밀번호 확인 <em>*</em>'}</label><input type="password" id="u-pw2" placeholder="한 번 더 입력" autocomplete="new-password"></div>
      <div class="f"><label for="u-title">직책</label><input type="text" id="u-title" value="${v('title')}" placeholder="예: 점장, 매니저"></div>
      <div class="f"><label for="u-phone">연락처</label><input type="text" id="u-phone" value="${mmTel(v('phone'))}" placeholder="010-0000-0000"></div>
      <div class="f"><label for="u-org">소속</label>${sel('u-org', ORGS, u?.org || '본사')}</div>
      <div class="f"><label for="u-role">등급</label>${roleSel}</div>
      <div class="f" id="u-store-wrap" ${needStore ? '' : 'hidden'}><label for="u-store">소속 매장 <em>*</em></label><select id="u-store" data-cur="${esc(u?.store_id || '')}"><option value="">불러오는 중…</option></select></div>
    </div><p class="u-note">${ic('info')}${mode==='edit' ? '비밀번호를 초기화하면 그 사람은 다음 로그인 때 새 비밀번호를 정해야 해요.' : '등록한 사람은 처음 로그인할 때 임시 비밀번호를 자기 비밀번호로 바꾸게 돼요. 임시 비밀번호는 직접 전달해주세요.'}</p><div id="u-err" class="u-err" role="alert"></div>`;
  };
  const pageUserNewBase = pageUserNew;
  pageUserNew = function(){ pageUserNewBase(); const h = document.querySelector('.uf-card .filter-hint'); if (h) h.innerHTML = ic('info') + '관리자만 계정을 만들 수 있어요. 등급별로 보이는 메뉴는 등급·권한 설정에서 정해요.'; };
  createUser = async function(){
    const g = id => document.getElementById(id).value.trim(), err = m => { document.getElementById('u-err').textContent = m; };
    const id = g('u-id').toLowerCase(), name = g('u-name'), pw = document.getElementById('u-pw').value, pw2 = document.getElementById('u-pw2').value;
    if (!/^[a-z0-9._-]{4,20}$/.test(id)) return err('아이디는 영문 소문자·숫자(. _ - 가능) 4~20자로 입력해주세요.');
    if (!name) return err('이름을 입력해주세요.');
    if (pw.length < 8) return err('임시 비밀번호는 8자 이상으로 입력해주세요.');
    if (pw !== pw2) return err('임시 비밀번호 확인이 일치하지 않아요.');
    const btn = document.querySelector('.uf-card .btn.primary'); if (btn) btn.disabled = true;
    try {
      const role = document.getElementById('u-role').value, storeId = window.mmUserStoreVal();
      if ((role === 'store' || role === 'staff') && !storeId) { if (btn) btn.disabled = false; return err('매장 관리자·매장 사원은 소속 매장을 골라주세요.'); }
      const made = await adminCall({ action: 'create', login_id: id, password: pw, name, title: g('u-title'), phone: g('u-phone'), dept: g('u-org'), role, store_id: storeId });
      if (window.mmAvAfterCreate) await window.mmAvAfterCreate(made && made.id);
      USERS_AT = 0; toast(`${name}님 계정을 만들었어요. 아이디 ${id}와 임시 비밀번호를 전달해주세요.`); go('user-list');
    } catch (e) { err(e.message); if (btn) btn.disabled = false; }
  };
  const pageUserListBase = pageUserList;
  pageUserList = function(){
    pageUserListBase();
    const p = document.querySelector('.page-hero p'); if (p) p.textContent = '등록된 계정을 수정하거나 사용을 멈춰요. 계정은 지우지 않고 사용 중지로 관리해요.';
    const th = document.querySelectorAll('#u-body')[0]?.closest('table')?.querySelector('thead tr');
    if (th) th.innerHTML = '<th>아이디</th><th>이름</th><th>직책</th><th>소속</th><th>권한</th><th>상태</th><th>등록일</th><th class="n">관리</th>';
  };
  drawUsers = function(){
    const q = (document.getElementById('u-q')?.value || '').trim().toLowerCase();
    const list = USERS.filter(u => !q || u.id.includes(q) || (u.name || '').toLowerCase().includes(q));
    const me = SESSION.user && SESSION.user.uid;
    document.getElementById('u-count').textContent = `${list.length}명`;
    document.getElementById('u-body').innerHTML = list.map(u => `<tr class="${u.status === '사용' ? '' : 'u-off'}"><td>${esc(u.id)}</td><td><div class="mm-who">${window.mmAv ? mmAv(u.uid, u.name) : ''}<div><b>${esc(u.name)}</b>${u.phone ? `<small>${esc(mmTel(u.phone))}</small>` : ''}</div></div></td><td>${esc(u.title)}</td><td>${esc(u.org)}</td><td>${ROLE_LABEL[u.role] || esc(u.role)}</td>
      <td><span class="ust ${u.status==='사용'?'on':'off'}">${esc(u.status)}</span>${u.status === '사용' && u.mustChange ? '<small class="u-first">첫 로그인 전</small>' : ''}${u.stopped ? `<small>${esc(u.stopped)} 중지</small>` : ''}</td><td>${esc(u.created)}</td>
      <td class="n"><button class="mini" onclick="editUser('${esc(u.uid)}')">${ic('edit')}편집</button>${u.uid === me ? '<span class="lock">본인</span>' : u.status === '사용' ? `<button class="mini del" onclick="setUserActive('${esc(u.uid)}', false)">사용 중지</button>` : `<button class="mini" onclick="setUserActive('${esc(u.uid)}', true)">다시 사용</button>`}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">검색 결과가 없어요.</td></tr>';
  };
  editUser = function(uid){
    const u = USERS.find(x => x.uid === uid); if (!u) return;
    document.getElementById('u-modal').innerHTML = `<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal" role="dialog" aria-label="사용자 편집"><div class="section-title"><strong>${ic('edit')}사용자 편집 · ${esc(u.name)}</strong><button class="x" onclick="closeModal()" aria-label="닫기">${ic('close')}</button></div>${userForm(u,'edit')}
     <div class="actions"><button class="btn ghost" onclick="closeModal()">취소</button><button class="btn primary" id="u-save" onclick="saveEdit('${esc(uid)}')">${ic('check')}저장</button></div></div></div>`;
  };
  saveEdit = async function(uid){
    const u = USERS.find(x => x.uid === uid);
    const g = k => document.getElementById(k).value.trim(), err = m => { document.getElementById('u-err').textContent = m; };
    const pw = document.getElementById('u-pw').value, pw2 = document.getElementById('u-pw2').value;
    if (!g('u-name')) return err('이름을 입력해주세요.');
    if (pw || pw2) { if (pw.length < 8) return err('비밀번호는 8자 이상으로 입력해주세요.'); if (pw !== pw2) return err('비밀번호 확인이 일치하지 않아요.'); }
    const btn = document.getElementById('u-save'); btn.disabled = true;
    try {
      const patch = { action: 'update', id: uid, name: g('u-name'), title: g('u-title'), phone: g('u-phone'), dept: g('u-org') };
      const role = document.getElementById('u-role').value; if (role !== u.role) patch.role = role;
      const storeId = window.mmUserStoreVal();
      if (role === 'store' || role === 'staff') { if (!storeId) { btn.disabled = false; return err('매장 관리자·매장 사원은 소속 매장을 골라주세요.'); } patch.store_id = storeId; }
      await adminCall(patch);
      if (pw) await adminCall({ action: 'reset_password', id: uid, password: pw });
      await loadUsersSB(); closeModal(); drawUsers(); toast(pw ? '저장하고 비밀번호를 초기화했어요. 새 임시 비밀번호를 전달해주세요.' : '사용자 정보를 저장했어요.');
      if (uid === (SESSION.user && SESSION.user.uid)) { const me = USERS.find(x => x.uid === uid); if (me) { Object.assign(SESSION.user, { name: me.name, title: me.title, org: me.org }); try { setTopUser(SESSION.user); } catch (e) {} } }
    } catch (e) { err(e.message); btn.disabled = false; }
  };
  window.setUserActive = function(uid, on){
    const u = USERS.find(x => x.uid === uid); if (!u) return;
    iModal(on ? '다시 사용' : '사용 중지', `<p class="im-now"><b>${esc(u.name)}</b> (${esc(u.id)}) 계정을 ${on ? '다시 사용할 수 있게 할까요?' : '사용 중지할까요?'}</p>${on ? '' : '<p class="im-warn">중지하면 바로 로그인할 수 없게 돼요. 계정과 기록은 지워지지 않고, 언제든 다시 사용으로 바꿀 수 있어요.</p>'}`, async () => {
      const b = document.getElementById('im-save'); b.disabled = true;
      try { await adminCall({ action: 'set_active', id: uid, active: on }); await loadUsersSB(); document.getElementById('inv-modal')?.remove(); drawUsers(); toast(on ? '다시 사용할 수 있게 했어요.' : '사용 중지했어요.'); }
      catch (e) { b.disabled = false; toast(e.message); }
    }, on ? '다시 사용' : '사용 중지');
  };
  deleteUser = uid => setUserActive(uid, false);

  const cs = document.createElement('style');
  cs.textContent = '.data-note .cs-re{margin-left:auto;padding:4px 10px;font-size:12px}.u-note{font-size:12px;color:#6c7365;margin:10px 0 0;display:flex;gap:6px;align-items:flex-start}.u-first{display:block;color:#8a6d2b;font-size:11px;margin-top:3px}tr.u-off td{color:#9aa093}#u-body td small{display:block;font-size:11px;color:#969c8e}';
  document.head.appendChild(cs);

  // 관리자만: 사용자 관리 메뉴 · 바로가기
  function hideAdminUi(){
    if (isAdmin()) return;
    document.querySelectorAll('#side .cat').forEach(b => { if (b.textContent.includes('사용자 관리')) { const s = b.nextElementSibling; if (s && s.classList.contains('sub')) s.remove(); b.remove(); } });
    document.querySelectorAll('[onclick*="go(\'user-"]').forEach(el => el.remove());
  }
  const renderSideV6 = renderSide;
  renderSide = function(a){ renderSideV6(a); hideAdminUi(); };
  const goV50 = go;
  const CUSTOM = {};
  go = function(p, t){
    if (ADMIN_PAGES.indexOf(p) >= 0 && !isAdmin()) p = 'dash';
    if (PENDING[p]) { closeSide(); renderSide(p); pendingPage(p); window.scrollTo(0, 0); return; }
    if (LOADERS[p] && !(LOADERS[p].ready && LOADERS[p].ready())) {
      const my = ++loadSeq;
      closeSide(); renderSide(p); loadingPage(p, '불러오는 중이에요...'); window.scrollTo(0, 0);
      return LOADERS[p]().then(() => { if (my !== loadSeq) return; if (CUSTOM[p]) { closeSide(); renderSide(p); CUSTOM[p](); hideAdminUi(); window.scrollTo(0, 0); return; } const r = goV50(p, t); hideAdminUi(); return r; })
        .catch(e => { if (my === loadSeq) loadingPage(p, '데이터를 불러오지 못했어요. ' + esc(authMsg(e)), true); });
    }
    loadSeq++;
    const r = goV50(p, t); hideAdminUi(); return r;
  };
  window.goNow = goV50;

  // 매장 순위 클릭: 매장별 주문내역이 연결되기 전에는 이동만
  // 매장 순위 클릭: 데이터를 받은 뒤 그 매장 · 제품별 보기로 조회
  openStore = async function(store){
    await go('store-orders');
    const s = document.getElementById('st'); if (!s) return;
    s.value = store;
    const b = document.querySelector('#view button[data-v="product"]'); if (b) b.click();
    runStoreOrders();
    const r = document.getElementById('res'); if (r) r.scrollIntoView({ behavior: 'smooth' });
  };

  // FC다움 새 발주 확인 (1분마다 변경 여부만 확인, 대시보드에서 다시 그림)
  (function(){
    function busyInput(){ const a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }
    function bar(){
      if (document.getElementById('fc-upd-bar')) return;
      const b = document.createElement('button'); b.id = 'fc-upd-bar'; b.type = 'button';
      b.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;border:0;background:#22311f;color:#fff;padding:10px 18px;border-radius:999px;font-size:14px;box-shadow:0 6px 20px rgba(0,0,0,.22);cursor:pointer';
      b.textContent = 'FC다움 발주가 새로 반영됐어요 · 눌러서 다시 보기'; b.onclick = () => { b.remove(); go(window.__curPage || 'dash'); }; document.body.appendChild(b);
    }
    async function check(){
      if (document.hidden || !SESSION.user || SESSION.mustChange || !SB) return;
      const cur = window.__curPage || '';
      if (!(cur === 'dash' || cur === 'fc-orders' || cur.indexOf('inv-') === 0) || !META.fcVer) return;
      if (document.getElementById('inv-modal')) return;
      try {
        const { data, error } = await SB.rpc('app_fc_ver'); if (error || !data || data === META.fcVer) return;
        WH_AT = 0;
        if (!busyInput()) { go(cur); toast('FC다움 발주가 새로 반영됐어요.'); } else bar();
      } catch (e) {}
    }
    setInterval(check, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  })();

  // 시작: 이 창에 로그인이 남아 있으면 바로 들어감
  (async function(){
    if (!SB) { showView('login'); $('lerr').textContent = '서버 연결 준비가 안 됐어요. 페이지를 새로고침해주세요.'; return; }
    try {
      const { data } = await SB.auth.getSession();
      if (data.session) await startSession(data.session); else showView('login');
    } catch (e) { showView('login'); $('lerr').textContent = authMsg(e); }
  })();
})();
