/* ---------- 신청함 ---------- */
const INBOUND = ['landing', 'openchat', 'cafe', 'referral'];
async function loadInbox(){
  try {
    const d = await rpc('lead_list', { p: { sources: INBOUND, sort: 'new', limit: 300 } });
    $('inbox-list').innerHTML = d.rows.length ? d.rows.map(r => `<article class="item" data-id="${r.id}">
      <div class="item-top">${r.stage === 'collected' ? '<span class="tag t-late">새 신청</span>' : ''}
        <div class="item-main"><b>${esc(r.name)}</b><small>${esc(SRC[r.source] || r.source)} · ${esc([r.sigungu, r.dong].filter(Boolean).join(' ') || '지역 미상')} · ${esc(r.created)}</small></div>
        <span class="tag t-st">${esc(ST[r.stage])}</span></div>
      <div class="item-bot"><span>${r.next ? `다음 연락 ${esc(shortDate(r.next))}` : '<span class="muted">아직 연락 전</span>'}</span>
        <span class="row-btns">${r.tel ? `<a class="btn sm" href="tel:${esc(r.tel)}">전화</a>` : ''}<button class="btn sm pri" data-open="${r.id}">열기</button></span></div>
    </article>`).join('') : '<div class="empty-box">아직 들어온 신청이 없어요.<br>랜딩페이지 연결 후에는 신청이 여기에 자동으로 쌓여요.</div>';
  } catch (e) { toast(errMsg(e), true); }
}
$('inbox-list').addEventListener('click', e => { if (e.target.closest('a')) return; const it = e.target.closest('[data-open], .item'); if (it) openLead(+(it.dataset.open || it.dataset.id)); });
$('inbox-add').addEventListener('click', () => openAdd('landing'));

/* ---------- 커뮤니티 ---------- */
const CST = { found: '찾음', dm_sent: '쪽지 보냄', applied: '랜딩 신청함', called: '통화함', dropped: '관심 없음' };
state.comm = { status: '', data: null };
async function loadComm(){
  try { state.comm.data = await rpc('lead_comm_data'); renderComm(); } catch (e) { toast(errMsg(e), true); }
}
function renderComm(){
  const d = state.comm.data; if (!d) return;
  $('post-list').innerHTML = d.posts.length ? d.posts.map(p => `<article class="box post">
      <div><b>${esc(p.title || '(제목 없음)')}</b><small class="muted">${esc(p.cafe)}${p.posted_at ? ' · ' + esc(p.posted_at) : ''}</small></div>
      <div class="post-n"><span>댓글·쪽지 <b>${p.n}</b></span><span>신청 <b>${p.applied}</b></span></div>
      <div class="row-btns">${p.url ? `<a class="btn sm" href="${esc(p.url)}" target="_blank" rel="noopener">글 열기</a>` : ''}<button class="btn sm" data-post="${p.id}">수정</button></div>
    </article>`).join('') : '<div class="empty-box">등록한 글이 없어요. 카페에 글을 올리면 링크를 등록해 두세요.</div>';
  const st = state.comm.status;
  const cnt = k => d.people.filter(x => !k || x.status === k).length;
  $('comm-status').innerHTML = `<button data-v="" class="${!st ? 'on' : ''}">전체 <small>${cnt('')}</small></button>` +
    Object.entries(CST).map(([k, v]) => `<button data-v="${k}" class="${st === k ? 'on' : ''}">${v} <small>${cnt(k)}</small></button>`).join('');
  const ppl = d.people.filter(x => !st || x.status === st);
  $('person-list').innerHTML = ppl.length ? ppl.map(x => `<article class="item">
      <div class="item-top"><div class="item-main"><b>${esc(x.nickname)}</b><small>${esc(x.cafe || '')}${x.post_title ? ' · ' + esc(x.post_title) : ''}${x.region ? ' · ' + esc(x.region) : ''} · ${esc(x.at)}</small></div>
        <select data-st="${x.id}" aria-label="상태">${Object.entries(CST).map(([k, v]) => `<option value="${k}"${k === x.status ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
      ${x.content ? `<p class="memo">${esc(x.content)}</p>` : ''}
      <div class="item-bot"><span class="muted">${x.contact_ok ? '연락처 본인 제공' + (x.phone ? ' · ' + esc(tel(x.phone)) : '') : '연락처 없음 (쪽지로 연락)'}</span>
        <span class="row-btns"><button class="btn sm" data-edit="${x.id}">수정</button>${x.lead_id ? `<button class="btn sm pri" data-open="${x.lead_id}">매장 카드</button>` : `<button class="btn sm pri" data-tolead="${x.id}">매장 카드로 등록</button>`}</span></div>
    </article>`).join('') : '<div class="empty-box">기록된 분이 없어요.</div>';
}
$('comm-status').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; state.comm.status = b.dataset.v; renderComm(); });
$('person-list').addEventListener('change', async e => {
  const s = e.target.closest('select[data-st]'); if (!s) return;
  try { await rpc('lead_comm_save', { p: { id: +s.dataset.st, status: s.value } }); toast('상태를 바꿨어요'); loadComm(); refreshStats(); } catch (er) { toast(errMsg(er), true); }
});
$('person-list').addEventListener('click', async e => {
  const o = e.target.closest('[data-open]'); if (o) return openLead(+o.dataset.open);
  const t = e.target.closest('[data-tolead]');
  if (t) { try { await rpc('lead_comm_save', { p: { id: +t.dataset.tolead, to_lead: true } }); toast('매장 카드로 등록했어요'); await loadComm(); const x = state.comm.data.people.find(y => y.id === +t.dataset.tolead); if (x && x.lead_id) openLead(x.lead_id); } catch (er) { toast(errMsg(er), true); } return; }
  const ed = e.target.closest('[data-edit]'); if (ed) openPerson(state.comm.data.people.find(y => y.id === +ed.dataset.edit));
});
$('post-list').addEventListener('click', e => { const b = e.target.closest('[data-post]'); if (b) openPost(state.comm.data.posts.find(p => p.id === +b.dataset.post)); });
$('post-add').addEventListener('click', () => openPost(null));
$('person-add').addEventListener('click', () => openPerson(null));
function modal(html){ $('addbox').innerHTML = html; $('scrim').hidden = false; $('addbox').hidden = false; }
function openPost(p){
  p = p || {};
  modal(`<h3 id="add-title">${p.id ? '글 수정' : '우리 글 등록'}</h3><div class="grid2">
    <div class="fld"><label for="po-cafe">카페 이름</label><input id="po-cafe" value="${esc(p.cafe || '')}" placeholder="예: 창업 준비 카페"></div>
    <div class="fld"><label for="po-date">올린 날짜</label><input id="po-date" type="date" value="${esc(p.posted_at || today())}"></div>
    <div class="fld full"><label for="po-title">글 제목</label><input id="po-title" value="${esc(p.title || '')}"></div>
    <div class="fld full"><label for="po-url">글 링크</label><input id="po-url" type="url" value="${esc(p.url || '')}" placeholder="https://cafe.naver.com/..."></div>
    <div class="fld full"><label for="po-memo">메모</label><input id="po-memo" value="${esc(p.memo || '')}"></div></div>
    <div class="row-end"><button class="btn" type="button" id="m-cancel">취소</button><button class="btn pri" type="button" id="m-save">저장</button></div>`);
  $('m-cancel').onclick = closePanel;
  $('m-save').onclick = async () => {
    try { await rpc('lead_post_save', { p: { id: p.id || '', cafe: $('po-cafe').value, title: $('po-title').value, url: $('po-url').value, posted_at: $('po-date').value, memo: $('po-memo').value } });
      closePanel(); toast('저장했어요'); loadComm(); } catch (e) { toast(errMsg(e), true); }
  };
}
function openPerson(x){
  x = x || {}; const posts = (state.comm.data && state.comm.data.posts) || [];
  modal(`<h3 id="add-title">${x.id ? '정보 수정' : '댓글·쪽지 준 분 추가'}</h3><div class="grid2">
    <div class="fld"><label for="pe-nick">닉네임</label><input id="pe-nick" value="${esc(x.nickname || '')}"></div>
    <div class="fld"><label for="pe-post">어느 글</label><select id="pe-post"><option value="">글 선택 안 함</option>${posts.map(p => `<option value="${p.id}"${p.id === x.post_id ? ' selected' : ''}>${esc(p.cafe)} · ${esc(p.title || '')}</option>`).join('')}</select></div>
    <div class="fld"><label for="pe-cafe">카페 이름</label><input id="pe-cafe" value="${esc(x.cafe || '')}"></div>
    <div class="fld"><label for="pe-status">상태</label><select id="pe-status">${Object.entries(CST).map(([k, v]) => `<option value="${k}"${k === (x.status || 'found') ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="fld"><label for="pe-region">지역</label><input id="pe-region" value="${esc(x.region || '')}" placeholder="예: 천안시 서북구"></div>
    <div class="fld"><label for="pe-cat">업종</label><input id="pe-cat" value="${esc(x.cat || '')}" placeholder="예: 이자카야"></div>
    <div class="fld full"><label for="pe-content">남긴 내용</label><textarea id="pe-content" placeholder="예: 천안에서 이자카야 운영 중, 점심 메뉴 고민">${esc(x.content || '')}</textarea></div>
    <div class="fld full"><label class="chk" style="border:0;padding:0;height:auto"><input type="checkbox" id="pe-ok"${x.contact_ok ? ' checked' : ''}> 본인이 쪽지 등으로 연락처를 직접 알려 줌</label></div>
    <div class="fld full"><label for="pe-phone">연락처 (본인 제공일 때만)</label><input id="pe-phone" type="tel" value="${esc(tel(x.phone || ''))}" ${x.contact_ok ? '' : 'disabled'}></div>
    <div class="fld full"><label for="pe-memo">메모</label><input id="pe-memo" value="${esc(x.memo || '')}"></div></div>
    <div class="row-end"><button class="btn" type="button" id="m-cancel">취소</button><button class="btn pri" type="button" id="m-save">저장</button></div>`);
  $('pe-ok').onchange = () => { $('pe-phone').disabled = !$('pe-ok').checked; if (!$('pe-ok').checked) $('pe-phone').value = ''; };
  $('m-cancel').onclick = closePanel;
  $('m-save').onclick = async () => {
    try { await rpc('lead_comm_save', { p: { id: x.id || '', nickname: $('pe-nick').value, post_id: $('pe-post').value, cafe: $('pe-cafe').value, status: $('pe-status').value,
        region: $('pe-region').value, cat: $('pe-cat').value, content: $('pe-content').value, contact_ok: $('pe-ok').checked, phone: $('pe-phone').value, memo: $('pe-memo').value } });
      closePanel(); toast('저장했어요'); loadComm(); refreshStats(); } catch (e) { toast(errMsg(e), true); }
  };
}

/* ---------- 양도 매물 ---------- */
const man = n => n == null ? '-' : Number(n).toLocaleString() + '만';
async function loadListing(){
  try {
    const rows = await rpc('lead_listing_list');
    $('listing-list').innerHTML = rows.length ? rows.map(l => `<article class="item"${l.lead_id ? ` data-open="${l.lead_id}"` : ''}>
      <div class="item-top"><div class="item-main"><b>${esc(l.name || l.addr || '매물')}</b><small>${esc(l.area || '')} · ${esc(l.cat || '')} · ${esc(l.site || '')}</small></div>
        ${l.stage ? `<span class="tag t-st">${esc(ST[l.stage])}</span>` : ''}</div>
      <div class="item-bot"><span>권리금 <b>${man(l.premium)}</b>${l.premium_prev && l.premium < l.premium_prev ? ` <s class="muted">${man(l.premium_prev)}</s> <span class="late">인하</span>` : ''} · 월세 ${man(l.rent)} · 보증금 ${man(l.deposit)}</span>
        <span class="row-btns">${l.url ? `<a class="btn sm" href="${esc(l.url)}" target="_blank" rel="noopener">매물 보기</a>` : ''}</span></div>
      <small class="muted">처음 확인 ${esc(l.first_seen)} · 마지막 확인 ${esc(l.last_seen)}${l.memo ? ' · ' + esc(l.memo) : ''}</small>
    </article>`).join('') : '<div class="empty-box">아직 들어온 매물이 없어요.<br>어사이드가 자료를 보내면 여기에 자동으로 쌓여요.</div>';
  } catch (e) { toast(errMsg(e), true); }
}
$('listing-list').addEventListener('click', e => { if (e.target.closest('a')) return; const it = e.target.closest('[data-open]'); if (it) openLead(+it.dataset.open); });

async function refreshStats(){ try { const s = await rpc('lead_stats'); applyStats(s); } catch (e) {} }


