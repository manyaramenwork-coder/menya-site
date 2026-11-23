/* ---------- 관심 매장 (지역별 묶음) ---------- */
state.fav = { scope: 'mine', sort: 'next', region: '', closed: {}, rows: [] };
async function loadFav(){
  try {
    state.fav.rows = await rpc('lead_fav_list', { p: { scope: state.fav.scope, sort: state.fav.sort } });
    renderFav();
  } catch (e) { toast(errMsg(e), true); }
}
function renderFav(){
  const F = state.fav, all = F.rows || [];
  const sgg = r => [r.sido && r.sido.replace(/(특별자치|특별|광역)?(시|도)$/, ''), r.sigungu].filter(Boolean).join(' ') || '지역 미상';
  const names = [...new Set(all.map(sgg))];
  if (F.region && !names.includes(F.region)) F.region = '';
  $('fav-region').innerHTML = `<button data-v="" class="${!F.region ? 'on' : ''}">전체 <small>${all.length}</small></button>` +
    names.map(n => `<button data-v="${esc(n)}" class="${F.region === n ? 'on' : ''}">${esc(n)} <small>${all.filter(r => sgg(r) === n).length}</small></button>`).join('');
  const list = all.filter(r => !F.region || sgg(r) === F.region);
  $('fav-count').textContent = list.length + '곳';
  if (!all.length) { $('fav-list').innerHTML = `<div class="empty-box">아직 관심 매장이 없어요.<br>지도나 목록에서 매장을 열고 <b>☆ 관심</b>을 눌러 담아 보세요.</div>`; return; }
  const groups = [];
  list.forEach(r => { const g = sgg(r) + ' · ' + (r.dong || '동 미상'); let x = groups.find(y => y.k === g); if (!x) groups.push(x = { k: g, rows: [] }); x.rows.push(r); });
  $('fav-list').innerHTML = groups.map(g => {
    const open = !F.closed[g.k], late = g.rows.filter(r => r.overdue).length;
    return `<section class="grp"><button class="grp-hd" data-g="${esc(g.k)}" aria-expanded="${open}">
      <span class="car">${open ? '▾' : '▸'}</span><b>${esc(g.k)}</b><small>${g.rows.length}곳</small>${late ? `<em>지남 ${late}</em>` : ''}</button>
      ${open ? g.rows.map(favCard).join('') : ''}</section>`;
  }).join('');
}
function favCard(r){
  return `<article class="item" data-id="${r.id}">
    <div class="item-top"><span class="star on" aria-hidden="true">★</span>
      <div class="item-main"><b>${esc(r.name)}${r.branch ? ' ' + esc(r.branch) : ''}</b>
      <small>${esc(r.cat || '')}${state.fav.scope === 'team' && r.by ? ' · 담은 사람 ' + esc(r.by) : ''}</small>
      <span class="tags">${lunchTag(r.lunch)}${r.listing ? '<span class="tag t-B">양도 매물</span>' : ''}</span></div>
      <span class="tag t-st">${esc(ST[r.stage])}</span></div>
    <div class="item-bot">${r.next ? `<span class="${r.overdue ? 'late' : ''}">다음 연락 ${esc(shortDate(r.next))}${r.overdue ? ' · 지남' : ''}</span>` : '<span class="muted">다음 연락일 없음</span>'}
      <span class="row-btns">${r.tel ? `<a class="btn sm" href="tel:${esc(r.tel)}">전화</a>` : ''}<button class="btn sm pri" data-open="${r.id}">기록</button></span></div>
  </article>`;
}
$('fav-scope').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; state.fav.scope = b.dataset.v; [...$('fav-scope').children].forEach(x => x.classList.toggle('on', x === b)); state.fav.region = ''; loadFav(); });
$('fav-sort').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; state.fav.sort = b.dataset.v; [...$('fav-sort').children].forEach(x => x.classList.toggle('on', x === b)); loadFav(); });
$('fav-region').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; state.fav.region = b.dataset.v; renderFav(); });
$('fav-list').addEventListener('click', e => {
  const h = e.target.closest('.grp-hd'); if (h) { const k = h.dataset.g; state.fav.closed[k] = !state.fav.closed[k]; renderFav(); return; }
  if (e.target.closest('a')) return;
  const it = e.target.closest('[data-open], .item'); if (it) openLead(+(it.dataset.open || it.dataset.id));
});

/* ---------- 연락 기록 ---------- */
function logRange(){
  const v = $('log-range').value, t = today();
  if (v === 'week') { const d = new Date(t + 'T00:00:00+09:00'); const wd = (d.getDay() + 6) % 7; return [addDays(-wd), t]; }
  if (v === 'month') return [t.slice(0, 8) + '01', t];
  return [addDays(-(+v)), t];
}
async function loadLog(){
  const [from, to] = logRange();
  try {
    const d = await rpc('lead_feed', { p: { from, to, by: $('log-by').value, result: $('log-res').value, kind: $('log-kind').value } });
    state.log = d; renderLog();
  } catch (e) { toast(errMsg(e), true); }
}
function actLine(a){
  const s = a.summary || {};
  if (a.kind === 'stage') return `단계 변경: ${ST[a.from] || a.from || ''} → ${ST[a.to] || a.to || ''}`;
  return [s.reaction, s.next_action && '다음: ' + s.next_action, s.note, s.concern && '우려: ' + s.concern].filter(Boolean).join(' / ') || '';
}
function renderLog(){
  const d = state.log, s = d.sum;
  $('log-sum').innerHTML = [['통화', s.calls], ['연결', s.connected], ['관심', s.interested], ['미팅', s.meetings]].map(([l, v]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
  if (!d.rows.length) { $('log-list').innerHTML = '<div class="empty-box">이 기간에 남긴 기록이 없어요.</div>'; return; }
  const days = [];
  d.rows.forEach(r => { let x = days.find(y => y.day === r.day); if (!x) days.push(x = { day: r.day, rows: [] }); x.rows.push(r); });
  $('log-list').innerHTML = days.map(x => `<section class="grp"><h3 class="day">${esc(shortDate(x.day))}</h3>` + x.rows.map(r => `
    <article class="item act-${esc(r.kind)}" data-open="${r.lead_id}">
      <div class="item-top"><span class="time">${esc(r.time)}</span><div class="item-main"><b>${esc(r.name)}${r.branch ? ' ' + esc(r.branch) : ''}</b><small>${esc(r.area)}</small></div>
      ${r.result ? `<span class="tag t-st">${esc(RES[r.result] || r.result)}</span>` : `<span class="tag t-C">${esc(KIND[r.kind] || r.kind)}</span>`}</div>
      ${actLine(r) ? `<p class="memo">${esc(actLine(r))}</p>` : ''}
      <small class="muted">${esc(r.by || '')}${r.duration ? ' · ' + Math.round(r.duration / 60) + '분' : ''}${r.ai ? ' · Claude 요약' : ''}</small>
    </article>`).join('') + '</section>').join('');
}
['log-range', 'log-by', 'log-res', 'log-kind'].forEach(id => $(id).addEventListener('change', loadLog));
$('log-list').addEventListener('click', e => { const it = e.target.closest('[data-open]'); if (it) openLead(+it.dataset.open); });
$('log-copy').addEventListener('click', async () => {
  const d = state.log; if (!d) return;
  const [from, to] = logRange();
  const lines = [`[샵인샵 영업 기록] ${from} ~ ${to}`, `통화 ${d.sum.calls}건 · 연결 ${d.sum.connected}건 · 관심 ${d.sum.interested}곳 · 미팅 ${d.sum.meetings}건`, ''];
  let day = '';
  d.rows.slice().reverse().forEach(r => {
    if (r.day !== day) { day = r.day; lines.push('■ ' + shortDate(day)); }
    lines.push(`- ${r.time} ${r.name} (${r.area}) ${r.result ? '[' + (RES[r.result] || r.result) + ']' : '[' + (KIND[r.kind] || r.kind) + ']'} ${actLine(r)} - ${r.by || ''}`);
  });
  try { await navigator.clipboard.writeText(lines.join('\n')); toast('보고용 텍스트를 복사했어요. 카톡·메일에 붙여 넣으세요'); }
  catch (e) { toast('복사하지 못했어요. 브라우저 권한을 확인하세요', true); }
});
$('log-res').innerHTML = '<option value="">결과 전체</option>' + Object.entries(RES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

