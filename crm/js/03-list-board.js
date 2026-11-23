/* ---------- 목록 ---------- */
const PAGE = 100;
async function load(reset){
  const v = state.view;
  if (v === 'fav') return loadFav();
  if (v === 'log') return loadLog();
  if (v === 'inbox') return loadInbox();
  if (v === 'comm') return loadComm();
  if (v === 'listing') return loadListing();
  if (v === 'target') return loadTarget();
  if (v === 'area') return loadArea();
  if (v === 'ftc') return loadFtc();
  if (v === 'naver') return loadNaver();
  if (v === 'script') return loadScript();
  if (v === 'ingest') return loadIngest();
  if (state.dbMode === 'board') return loadBoard();
  if (reset) { state.offset = 0; state.rows = []; }
  try {
    const d = await rpc('lead_list', { p: { ...filters(), sort: $('f-due').checked ? 'next' : 'score', limit: PAGE, offset: state.offset } });
    renderCats(d.cats);
    state.rows = state.rows.concat(d.rows); state.offset += d.rows.length;
    renderRows(d.total);
  } catch (e) { toast(errMsg(e), true); }
}
function renderRows(total){
  const tb = $('rows');
  if (!state.rows.length) { tb.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center;padding:40px">조건에 맞는 매장이 없어요. 필터를 줄이거나 매장을 추가하세요.</td></tr>`; $('more').hidden = true; return; }
  tb.innerHTML = state.rows.map(r => `<tr data-id="${r.id}">
    <td><div class="nm">${esc(r.name)}${r.branch ? ' ' + esc(r.branch) : ''}${chainTag(r)}<a class="nv" href="${esc(naverLink(r))}" target="_blank" rel="noopener" title="네이버 플레이스">N ${r.naver ? '플레이스' : '검색'}</a></div><div class="sm">${esc(SRC[r.source] || r.source)}${r.tel ? ' · ' + esc(tel(r.tel)) : ''}</div></td>
    <td>${esc(r.cat || '')}${r.segment ? `<div class="sm">${esc(SEG[r.segment] || r.segment)}</div>` : ''}<div class="sm">${pyTag(r)}</div></td>
    <td>${esc([r.sigungu, r.dong].filter(Boolean).join(' '))}</td>
    <td><span class="tag t-st">${esc(ST[r.stage])}</span></td>
    <td>${lunchTag(r.lunch)}</td>
    <td>${esc(r.assignee || '')}${r.org !== 'menya' ? ` <span class="tag t-org">${esc(ORG[r.org])}</span>` : ''}</td>
    <td>${r.next ? (r.overdue ? `<span class="tag t-late">${esc(shortDate(r.next))}</span>` : esc(shortDate(r.next))) : '<span class="muted">-</span>'}</td>
    <td class="num">${r.score}</td></tr>`).join('');
  $('more').hidden = state.rows.length >= total;
  $('more').textContent = `더 보기 (${state.rows.length.toLocaleString()} / ${total.toLocaleString()})`;
}
$('more').addEventListener('click', () => load(false));
$('rows').addEventListener('click', e => { if (e.target.closest('a')) return; const tr = e.target.closest('tr[data-id]'); if (tr) openLead(+tr.dataset.id); });

/* ---------- 보드 ---------- */
async function loadBoard(){
  const f = filters(); const bv = $('board-view');
  bv.innerHTML = '<p class="muted">불러오는 중…</p>';
  try {
    const res = await Promise.all(STAGES.map(([k]) => rpc('lead_list', { p: { ...f, stage: k, limit: 30, nocats: k !== STAGES[0][0] } })));
    renderCats(res[0].cats);
    bv.innerHTML = STAGES.map(([k, v], i) => {
      const d = res[i];
      const cards = d.rows.map(r => `<button class="card" data-id="${r.id}">
        <span class="nm">${esc(r.name)}${r.branch ? ' ' + esc(r.branch) : ''}</span>
        <span class="sm">${esc([r.sigungu, r.dong].filter(Boolean).join(' '))} · ${esc(r.cat || '')}</span>
        <span class="tags">${lunchTag(r.lunch)}${r.org !== 'menya' ? `<span class="tag t-org">${esc(ORG[r.org])}</span>` : ''}${r.overdue ? '<span class="tag t-late">재연락 지남</span>' : ''}</span>
        ${r.next ? `<span class="sm">다음 연락 ${esc(shortDate(r.next))}</span>` : ''}
      </button>`).join('');
      const more = d.total > d.rows.length ? `<p class="sm muted" style="margin:0;text-align:center">외 ${(d.total - d.rows.length).toLocaleString()}곳은 목록에서 보기</p>` : '';
      return `<div class="col"><h3>${v}<span>${d.total.toLocaleString()}</span></h3>${cards || '<div class="empty">아직 없음</div>'}${more}</div>`;
    }).join('');
  } catch (e) { bv.innerHTML = ''; toast(errMsg(e), true); }
}
$('board-view').addEventListener('click', e => { const c = e.target.closest('.card'); if (c) openLead(+c.dataset.id); });
