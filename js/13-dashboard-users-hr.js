// v3.5: 대시보드 순서 확정 + 사용자 관리 + 인사관리(쌍용본점 출결)
PATHS.user = 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M4 21c0-4 4-6 8-6s8 2 8 6';
PATHS.users = 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21c0-4 3-6 7-6s7 2 7 6 M16 3a4 4 0 0 1 0 8 M18 15c2 .5 4 2 4 6';
PATHS.cal = 'M3 5h18v16H3z M3 10h18 M8 3v4 M16 3v4';
PATHS.edit = 'M4 20h4L19 9l-4-4L4 16z M14 6l4 4';
PATHS.trash = 'M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3';

/* ---------- 1. 대시보드: 공지 → 본사 택배 발주 → 제때 → 바로가기 ---------- */
const pageDashboardV35 = pageDashboard;
pageDashboard = function(){
  pageDashboardV35();
  const main = document.getElementById('main');
  const secs = [...main.querySelectorAll('.dash-sec')];
  const [sToday, sFc, sJt, sShort] = secs;
  const notice = sToday.querySelector('.notice-strip');
  const todo = sToday.querySelector('.todo-card');
  // 1. 최근 점주 공지
  const n1 = document.createElement('section'); n1.className = 'dash-sec';
  n1.innerHTML = secHead('1', '최근 점주 공지', {cls:'fc', t:'FC다움'}, '스마트공지 최근 2건');
  notice.classList.add('wide'); n1.append(notice);
  // 2. 본사 택배 발주 (새 발주 · 진행중만)
  const n2 = document.createElement('section'); n2.className = 'dash-sec';
  n2.innerHTML = secHead('2', '본사 택배 발주', {cls:'fc', t:'FC다움'}, '새 발주 · 진행중');
  todo.querySelector('.todo-top .btn').insertAdjacentHTML('beforebegin', `<button class="btn ghost" onclick="go('fc-orders')">${ic('file')}전체 발주 보기</button>`);
  n2.append(todo);
  sToday.replaceWith(n1); n1.after(n2); sFc.remove();
  sJt.querySelector('.sec-n').textContent = '3';
  sShort.querySelector('.sec-n').textContent = '4';
  // 바로가기: 새 메뉴 반영
  const sc = sShort.querySelector('.shortcuts');
  sc.innerHTML = [
    ['truck','매장별 주문내역 조회','제때 관리',"go('store-orders')"],
    ['coin','기간별 공급가 조회','제때 관리',"go('period-sales')"],
    ['box','매장 발주 (FC다움)','본사 발주·재고',"go('fc-orders')"],
    ['cal','쌍용본점 출결관리','인사관리',"go('hr-att')"],
    ['users','사용자 관리','사용자 관리',"go('user-list')"]
  ].map(([i,t,s,f]) => `<button onclick="${f}">${ic(i)}<b>${t}</b><small>${s}</small></button>`).join('');
};

/* ---------- 2. 메뉴: 인사관리, 사용자 관리 추가 ---------- */
const renderSideV35 = renderSide;
renderSide = function(active){
  renderSideV35(active);
  const nav = document.querySelector('#side .nav-items');
  const group = (id, icon, title, items) => {
    const open = items.some(i => i[0] === active);
    return `<button class="cat ${open?'open':''}" onclick="const on=this.classList.toggle('open');this.nextElementSibling.classList.toggle('open',on)">${ic(icon)}${title}${ic('chevron').replace('class="icon"','class="icon ar"')}</button><div class="sub ${open?'open':''}">${items.map(([k,t]) => `<a role="button" tabindex="0" class="${k===active?'on':''}" onclick="go('${k}')">${t}</a>`).join('')}</div>`;
  };
  nav.insertAdjacentHTML('beforeend',
    group('hr', 'cal', '인사관리', [['hr-att','쌍용본점 출결관리']]) +
    group('user', 'users', '사용자 관리', [['user-new','사용자 등록'],['user-list','사용자 관리']]));
};
const goV35 = go;
go = function(p, t){
  const pages = {'user-new': pageUserNew, 'user-list': pageUserList, 'hr-att': pageAttendance};
  if (pages[p]) { closeSide(); renderSide(p); pages[p](); window.scrollTo(0,0); return; }
  return goV35(p, t);
};
function simpleHero(path2, eyebrow, title, desc){
  return `<div class="crumb">${ic('home')}<span>워크스페이스</span>${path2.map(x=>`<span>/</span><span>${x}</span>`).join('')}</div>
  <header class="page-hero compact"><div class="hero-copy"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p></div><div class="hero-image"><span>MENYAMATSURI</span></div></header>`;
}

/* 화면 안내: pageGuide('키', '요약 한 줄', [['제목','내용'], ...], '펼침 버튼 문구')
   simpleHero(...) 바로 뒤에 붙여 쓰기. 펼침 상태는 화면이 다시 그려져도 유지 */
const PG_OPEN = {};
function pageGuide(key, sub, items, label){
  return `<div class="pg-guide">${sub ? `<div class="pg-guide-sub">${sub}</div>` : ''}<details ${PG_OPEN[key] ? 'open' : ''} ontoggle="PG_OPEN['${key}']=this.open"><summary>${label || '이렇게 돌아가요'}</summary><dl>${items.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')}</dl></details></div>`;
}

/* ---------- 3. 사용자 저장소 (시안: 브라우저 저장) ---------- */
const USER_KEY = 'mm_users_v1';
let MEM_USERS = null;
async function hashPw(pw){
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('mm::' + pw)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join(''); }
  catch(e){ let h = 0; for (const c of 'mm::' + pw) h = (h * 31 + c.charCodeAt(0)) | 0; return 'fb' + (h >>> 0).toString(16); }
}
function loadUsers(){
  try { const s = localStorage.getItem(USER_KEY); if (s) return JSON.parse(s); } catch(e){}
  if (MEM_USERS) return MEM_USERS;
  return [{id:'admin', name:'김영환', title:'브랜드 관리 팀장', org:'본사', role:'관리자', phone:'', status:'사용', pw:null, created:'2026-10-25', seed:true}];
}
function saveUsers(list){ MEM_USERS = list; try { localStorage.setItem(USER_KEY, JSON.stringify(list)); } catch(e){} }
const ORGS = ['본사', '쌍용본점', '금목돈', '가맹점'];
const ROLES = ['관리자', '일반', '매장'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// 로그인: admin/1234 + 등록 사용자
const doLoginV35 = doLogin;
doLogin = async function(){
  const id = document.getElementById('uid').value.trim(), pw = document.getElementById('upw').value;
  const u = loadUsers().find(x => x.id === id && !x.seed);
  if (u){
    if (u.status !== '사용'){ document.getElementById('lerr').textContent = '사용이 중지된 계정이에요. 관리자에게 문의하세요.'; return; }
    if (u.pw === await hashPw(pw)){ window.CURRENT_USER = u; document.getElementById('login').style.display='none'; document.getElementById('app').style.display='block'; document.getElementById('lerr').textContent=''; setTopUser(u); go('dash'); return; }
    document.getElementById('lerr').textContent = '아이디 또는 비밀번호가 맞지 않아요.'; return;
  }
  window.CURRENT_USER = loadUsers()[0]; setTopUser(window.CURRENT_USER);
  return doLoginV35();
};
function setTopUser(u){ const t = document.querySelector('.user-text'); if (t) t.innerHTML = `${esc(u.name)} ${u.title?esc(u.title.replace(/^.* /,'')):''}<small>${esc(u.org)}</small>`; const a = document.querySelector('.av'); if (a) a.textContent = (u.name||'?')[0]; }

/* 사용자 등록 */
function userForm(u, mode){
  const v = k => esc(u?.[k] || '');
  const sel = (id, opts, cur) => `<select id="${id}">${opts.map(o => `<option ${o===cur?'selected':''}>${o}</option>`).join('')}</select>`;
  return `<div class="uf-grid">
    <div class="f"><label for="u-id">아이디 <em>*</em></label><input type="text" id="u-id" value="${v('id')}" ${mode==='edit'?'disabled':''} placeholder="영문·숫자 4자 이상" autocomplete="off"></div>
    <div class="f"><label for="u-name">이름 <em>*</em></label><input type="text" id="u-name" value="${v('name')}" placeholder="예: 홍길동"></div>
    <div class="f"><label for="u-pw">비밀번호 ${mode==='edit'?'<span>바꿀 때만 입력</span>':'<em>*</em>'}</label><input type="password" id="u-pw" placeholder="8자 이상" autocomplete="new-password"></div>
    <div class="f"><label for="u-pw2">비밀번호 확인 ${mode==='edit'?'':'<em>*</em>'}</label><input type="password" id="u-pw2" placeholder="한 번 더 입력" autocomplete="new-password"></div>
    <div class="f"><label for="u-title">직책</label><input type="text" id="u-title" value="${v('title')}" placeholder="예: 점장, 매니저"></div>
    <div class="f"><label for="u-phone">연락처</label><input type="text" id="u-phone" value="${mmTel(v('phone'))}" placeholder="010-0000-0000"></div>
    <div class="f"><label for="u-org">소속</label>${sel('u-org', ORGS, u?.org || '본사')}</div>
    
    ${mode==='edit'?`<div class="f"><label for="u-status">상태</label>${sel('u-status', ['사용','중지'], u?.status || '사용')}</div>`:''}
  </div><div id="u-err" class="u-err" role="alert"></div>`;
}
function pageUserNew(){
  document.getElementById('main').innerHTML = simpleHero(['사용자 관리','사용자 등록'], 'USERS · NEW ACCOUNT', '사용자 등록', '매장관리 홈페이지에 로그인할 직원 계정을 만들어요.') +
  `<section class="card uf-card"><div class="section-title"><strong>${ic('user')}계정 정보</strong><small><em>*</em> 표시는 필수 항목</small></div>${userForm(null,'new')}
   <div class="actions"><span class="filter-hint">${ic('info')}등급에 따라 보이는 메뉴가 달라요. 등급별 메뉴는 등급·권한 설정에서 바꿀 수 있어요.</span><button class="btn ghost" onclick="pageUserNew()">${ic('reset')}다시 쓰기</button><button class="btn primary" onclick="createUser()">${ic('check')}등록하기</button></div></section>` + pageFoot();
}
async function createUser(){
  const g = id => document.getElementById(id).value.trim();
  const err = m => { document.getElementById('u-err').textContent = m; };
  const id = g('u-id'), name = g('u-name'), pw = document.getElementById('u-pw').value, pw2 = document.getElementById('u-pw2').value;
  const list = loadUsers();
  if (!/^[A-Za-z0-9_.-]{4,20}$/.test(id)) return err('아이디는 영문·숫자 4~20자로 입력해주세요.');
  if (list.some(u => u.id === id)) return err('이미 있는 아이디예요.');
  if (!name) return err('이름을 입력해주세요.');
  if (pw.length < 8) return err('비밀번호는 8자 이상으로 입력해주세요.');
  if (pw !== pw2) return err('비밀번호 확인이 일치하지 않아요.');
  list.push({id, name, title:g('u-title'), phone:g('u-phone'), org:g('u-org'), status:'사용', pw: await hashPw(pw), created: new Date().toISOString().slice(0,10)});
  saveUsers(list); toast(`${name}님 계정을 등록했어요.`); go('user-list');
}
/* 사용자 관리 */
function pageUserList(){
  document.getElementById('main').innerHTML = simpleHero(['사용자 관리','사용자 관리'], 'USERS · MANAGE', '사용자 관리', '등록된 계정을 수정하거나 삭제해요.') +
  `<section class="card"><div class="meta"><div class="left"><strong>사용자 목록</strong><span class="count" id="u-count"></span></div>
    <div class="u-tools"><input type="text" id="u-q" placeholder="이름·아이디 검색" oninput="drawUsers()"><button class="btn primary" onclick="go('user-new')">${ic('user')}사용자 등록</button></div></div>
    <div class="tbl-wrap"><table><thead><tr><th>아이디</th><th>이름</th><th>직책</th><th>소속</th><th>연락처</th><th>상태</th><th>등록일</th><th class="n">관리</th></tr></thead><tbody id="u-body"></tbody></table></div></section>
   <div id="u-modal"></div>` + pageFoot();
  drawUsers();
}
function drawUsers(){
  const q = (document.getElementById('u-q')?.value || '').trim();
  const list = loadUsers().filter(u => !q || u.id.includes(q) || (u.name||'').includes(q));
  document.getElementById('u-count').textContent = `${list.length}명`;
  document.getElementById('u-body').innerHTML = list.map(u => `<tr><td>${esc(u.id)}</td><td><b>${esc(u.name)}</b></td><td>${esc(u.title)}</td><td>${esc(u.org)}</td><td>${esc(mmTel(u.phone))}</td><td><span class="ust ${u.status==='사용'?'on':'off'}">${esc(u.status)}</span></td><td>${esc(u.created)}</td>
    <td class="n"><button class="mini" onclick="editUser('${esc(u.id)}')">${ic('edit')}편집</button>${u.seed?'<span class="lock">기본 관리자</span>':`<button class="mini del" onclick="deleteUser('${esc(u.id)}')">${ic('trash')}삭제</button>`}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">검색 결과가 없어요.</td></tr>';
}
function editUser(id){
  const u = loadUsers().find(x => x.id === id);
  document.getElementById('u-modal').innerHTML = `<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal" role="dialog" aria-label="사용자 편집"><div class="section-title"><strong>${ic('edit')}사용자 편집 · ${esc(u.name)}</strong><button class="x" onclick="closeModal()" aria-label="닫기">${ic('close')}</button></div>${userForm(u,'edit')}
   <div class="actions"><button class="btn ghost" onclick="closeModal()">취소</button><button class="btn primary" onclick="saveEdit('${esc(id)}')">${ic('check')}저장</button></div></div></div>`;
}
function closeModal(){ document.getElementById('u-modal').innerHTML = ''; }
async function saveEdit(id){
  const list = loadUsers(); const u = list.find(x => x.id === id);
  const g = k => document.getElementById(k).value.trim(), err = m => { document.getElementById('u-err').textContent = m; };
  const pw = document.getElementById('u-pw').value, pw2 = document.getElementById('u-pw2').value;
  if (!g('u-name')) return err('이름을 입력해주세요.');
  if (pw || pw2){ if (pw.length < 8) return err('비밀번호는 8자 이상으로 입력해주세요.'); if (pw !== pw2) return err('비밀번호 확인이 일치하지 않아요.'); u.pw = await hashPw(pw); u.seed = false; }
  if (u.seed && g('u-status') !== '사용') return err('기본 관리자 계정은 중지할 수 없어요.');
  Object.assign(u, {name:g('u-name'), title:g('u-title'), phone:g('u-phone'), org:g('u-org'), status:g('u-status')});
  saveUsers(list); closeModal(); drawUsers(); toast('사용자 정보를 저장했어요.');
}
function deleteUser(id){
  const list = loadUsers(), u = list.find(x => x.id === id);
  if (!confirm(`${u.name}(${u.id}) 계정을 삭제할까요?\n삭제하면 되돌릴 수 없어요.`)) return;
  saveUsers(list.filter(x => x.id !== id)); drawUsers(); toast('계정을 삭제했어요.');
}

/* ---------- 4. 인사관리: 쌍용본점 출결관리 ---------- */
let ATT = {};   // {"2026-09": [{name,id,days:{date:[in,out]}}]}
let ATT_SRC = META.attSrc;
const toMin = t => /^\d{1,2}:\d{2}$/.test(t||'') ? (+t.split(':')[0]) * 60 + (+t.split(':')[1]) : null;
const hm = m => `${Math.floor(m/60)}시간 ${String(m%60).padStart(2,'0')}분`;
function pageAttendance(){
  const months = Object.keys(ATT).sort().reverse();
  document.getElementById('main').innerHTML = simpleHero(['인사관리','쌍용본점 출결관리'], 'HR · ATTENDANCE', '쌍용본점 출결관리', '월을 선택하면 직원별 출근·퇴근 기록과 근무시간을 보여줘요.') +
  `<div class="data-note"><span class="status-dot"></span><span>${ATT_SRC}</span><span class="tag">자동 갱신</span></div>
  <section class="card query-card"><div class="section-title"><strong>${ic('filter')}조회 조건</strong></div>
   <div class="filters att-f">
    <div class="f"><label for="a-month">조회 월</label><select id="a-month">${months.map(m => `<option value="${m}">${m.replace('-','년 ')}월</option>`).join('')}</select></div>
    <div class="f"><label for="a-emp">직원</label><select id="a-emp"><option value="">전체 직원</option></select></div>
    <div class="f"><label>보기 방식</label>${segHtml('aview',[['sum','직원별 요약'],['grid','월간 출결표']])}</div>
   </div>
   <label class="adv-chk inline"><input type="checkbox" id="a-ret"><span><b>퇴사자 포함</b><small>기본은 오션 '승인'(재직) 직원만 보여요.</small></span></label> <label class="adv-chk inline"><input type="checkbox" id="a-empty"><span><b>기록 없는 직원도 보기</b></span></label>
   <div class="actions"><span class="filter-hint">${ic('info')}"!" 는 출근 또는 퇴근 기록이 빠진 날이에요.</span><button class="btn ghost" onclick="pageAttendance()">${ic('reset')}초기화</button><button class="btn primary" onclick="runAtt()">${ic('search')}조회</button></div>
  </section><div id="res"></div>` + pageFoot();
  fillEmp(); document.getElementById('a-month').onchange = fillEmp; document.getElementById('a-ret').onchange = fillEmp; runAtt();
}
function fillEmp(){
  const m = document.getElementById('a-month').value;
  document.getElementById('a-emp').innerHTML = '<option value="">전체 직원</option>' + ATT[m].filter(e => Object.keys(e.days).length && (document.getElementById('a-ret')?.checked || e.status !== '퇴사')).map(e => `<option>${esc(e.name)}</option>`).join('');
}
function attStats(e){
  let days = 0, mins = 0, miss = 0;
  Object.values(e.days).forEach(([i, o]) => { days++; const a = toMin(i), b = toMin(o); if (a != null && b != null && b > a) mins += b - a; else miss++; });
  return {days, mins, miss};
}
function runAtt(){
  const m = document.getElementById('a-month').value, who = document.getElementById('a-emp').value, view = segVal('aview'), withEmpty = document.getElementById('a-empty').checked;
  let emps = ATT[m].filter(e => (withEmpty || Object.keys(e.days).length) && (!who || e.name === who) && e.name !== '멘야마쯔리 관리자' && (document.getElementById('a-ret').checked || e.status !== '퇴사'));
  const [y, mo] = m.split('-').map(Number), nd = new Date(y, mo, 0).getDate();
  const dates = Array.from({length: nd}, (_, i) => `${m}-${String(i+1).padStart(2,'0')}`);
  const st = emps.map(e => ({e, ...attStats(e)}));
  const tot = st.reduce((a, s) => ({days: a.days + s.days, mins: a.mins + s.mins, miss: a.miss + s.miss}), {days:0, mins:0, miss:0});
  const wk = d => { const w = new Date(d).getDay(); return w === 0 ? 'sun' : w === 6 ? 'sat' : ''; };
  let body;
  if (view === 'sum'){
    LAST = {head:['이름','근무일','총 근무시간','하루 평균','기록 누락'], body: st.map(s => [s.e.name, s.days, hm(s.mins), s.days - s.miss ? hm(Math.round(s.mins / (s.days - s.miss))) : '-', s.miss])};
    body = `<div class="tbl-wrap"><table><thead><tr><th>이름</th><th class="n">근무일</th><th class="n">총 근무시간</th><th class="n">하루 평균</th><th class="n">기록 누락</th><th>근무 일자</th></tr></thead><tbody>${st.map(s => `<tr><td><b>${esc(s.e.name)}</b>${s.e.status==='퇴사'?'<span class="ret">퇴사</span>':''}</td><td class="n">${s.days}일</td><td class="n">${hm(s.mins)}</td><td class="n">${s.days - s.miss ? hm(Math.round(s.mins / (s.days - s.miss))) : '-'}</td><td class="n ${s.miss?'miss':''}">${s.miss}건</td><td><div class="dots">${dates.map(d => { const r = s.e.days[d]; return `<i class="${!r?'':(r.includes('!')?'x':'o')} ${wk(d)}" title="${d.slice(5)} ${r?r.join(' ~ '):'기록 없음'}"></i>`; }).join('')}</div></td></tr>`).join('')}</tbody></table></div>`;
  } else {
    LAST = {head:['이름', ...dates.map(d => d.slice(5))], body: st.map(s => [s.e.name, ...dates.map(d => (s.e.days[d] || []).join('~'))])};
    body = `<div class="tbl-wrap att-grid"><table><thead><tr><th class="sticky">이름</th>${dates.map(d => `<th class="${wk(d)}">${+d.slice(8)}<small>${'일월화수목금토'[new Date(d).getDay()]}</small></th>`).join('')}</tr></thead><tbody>${st.map(s => `<tr><td class="sticky"><b>${esc(s.e.name)}</b><small>${s.days}일 · ${Math.round(s.mins/60)}h</small></td>${dates.map(d => { const r = s.e.days[d]; return `<td class="${wk(d)} ${r && r.includes('!') ? 'miss' : ''}">${r ? r.map(t => t === '!' ? '<b>!</b>' : t).join('<br>') : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  document.getElementById('res').innerHTML = `
   <div class="sum period"><div class="k hl"><div class="l">${ic('users')}근무 직원</div><div class="v">${st.filter(s => s.days).length}<small>명</small></div></div>
   <div class="k"><div class="l">${ic('cal')}총 근무일</div><div class="v">${tot.days}<small>일</small></div></div>
   <div class="k"><div class="l">${ic('clock')}총 근무시간</div><div class="v">${Math.round(tot.mins/60).toLocaleString()}<small>시간</small></div></div>
   <div class="k ${tot.miss?'warn':''}"><div class="l">${ic('info')}기록 누락</div><div class="v">${tot.miss}<small>건</small></div></div></div>
   <div class="card"><div class="meta"><div class="left"><strong>${m.replace('-','년 ')}월 출결</strong>${m===Object.keys(ATT).sort().pop()?'<span class="count live">집계 중</span>':''}<span class="count">${st.length}명</span><div class="result-sub">근무시간은 출근~퇴근 기록이 모두 있는 날만 계산해요 (휴게시간 미차감).</div></div><button class="btn ghost" onclick="dlCsv('쌍용본점_출결_${m}')">${ic('download')}CSV 다운로드</button></div>${body}</div>`;
}

dlCsv=function(name){ if(!LAST) return; const q=v=>'"'+String(v).replace(/"/g,'""')+'"'; const csv='\ufeff'+[LAST.head,...LAST.body].map(r=>r.map(q).join(',')).join('\r\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); const d1e=document.getElementById('d1'),d2e=document.getElementById('d2'); a.download=name+(d1e&&d2e?'_'+d1e.value+'_'+d2e.value:'')+'.csv'; a.click(); toast('CSV 파일로 다운로드했어요.'); };
