/* ---------- 샵인샵 타겟 ---------- */
state.tg = { zone: '', d: null };
const ZONE_LBL = { '기준점+밀집': '기준점+밀집', '기준점': '기준점만', '밀집': '밀집만' };
async function loadTarget(){
  const [sido, sigungu] = ($('tg-region').value || '|').split('|');
  try {
    const d = await rpc('lead_target_list', { p: { sido, sigungu, zone: state.tg.zone,
      ex_own: $('tg-own').checked, ex_chain: $('tg-chain').checked, area_only: $('tg-area').checked, sort: $('tg-sort').value } });
    state.tg.d = d; renderTarget();
  } catch (e) { toast(errMsg(e), true); }
}
function renderTarget(){
  const d = state.tg.d || {}, rows = d.rows || [], regs = d.regions || [];
  const sel = $('tg-region'), cur = sel.value;
  const all = regs.reduce((a, r) => a + r.n, 0);
  sel.innerHTML = `<option value="">전체 지역 (${all.toLocaleString()})</option>` +
    regs.map(r => `<option value="${esc(r.sido + '|' + r.sigungu)}">${esc((r.sido + ' ' + r.sigungu).trim())} (${r.n.toLocaleString()})</option>`).join('');
  sel.value = cur;
  const z = d.zones || {};
  $('tg-zone').innerHTML = `<button data-v="" class="${!state.tg.zone ? 'on' : ''}">상권 전체 <small>${(d.base || 0).toLocaleString()}</small></button>` +
    Object.keys(ZONE_LBL).map(k => `<button data-v="${esc(k)}" class="${state.tg.zone === k ? 'on' : ''}">${ZONE_LBL[k]} <small>${(z[k] || 0).toLocaleString()}</small></button>`).join('');
  $('tg-stats').innerHTML = [
    ['대상 매장', (d.base || 0) + '곳'], ['지금 보이는', (d.total || 0) + '곳'], ['우리 매장', (d.own || 0) + '곳'],
    ['체인', (d.chain || 0) + '곳'], ['평수 확인', (d.area_known || 0) + '곳'], ['10~20평', (d.area_ok || 0) + '곳']
  ].map(([l, v]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
  $('tg-count').textContent = (d.total || 0).toLocaleString() + '곳';
  $('tg-rows').innerHTML = rows.length ? rows.map(r => `<tr data-id="${r.id}">
    <td><div class="nm">${esc(r.name)}${r.branch ? ' ' + esc(r.branch) : ''}${r.is_own ? ' <span class="tag t-B">우리 매장</span>' : ''}${!r.is_own && r.is_chain ? ' <span class="tag t-C">체인</span>' : ''}<a class="nv" href="${esc(naverLink(r))}" target="_blank" rel="noopener" title="네이버 플레이스">N ${r.naver_url ? '플레이스' : '검색'}</a></div><div class="sm">${esc(r.cat || '')}${r.tel ? ' · ' + esc(tel(r.tel)) : ''}</div></td>
    <td>${esc([r.sigungu, r.dong].filter(Boolean).join(' '))}<div class="sm">${esc(r.addr_road || '')}</div></td>
    <td>${r.hub_name ? esc(r.hub_name) + `<div class="sm">${esc(r.hub_kind || '')} · ${Number(r.dist_m || 0).toLocaleString()}m</div>` : '<span class="muted">기준점 밖</span>'}</td>
    <td class="num">${r.density == null ? '-' : r.density}</td>
    <td class="num">${r.pyeong == null ? '<span class="muted">미확인</span>' : (r.area_ok ? `<b>${r.pyeong}평</b>` : r.pyeong + '평')}</td>
    <td><span class="tag t-st">${esc(ST[r.stage] || r.stage || '')}</span></td>
    <td class="num">${r.mail_cnt ? r.mail_cnt + '회' : '-'}</td></tr>`).join('')
    : `<tr><td colspan="7" class="muted" style="text-align:center;padding:40px">조건에 맞는 매장이 없어요.</td></tr>`;
}
['tg-region', 'tg-sort', 'tg-own', 'tg-chain', 'tg-area'].forEach(id => $(id).addEventListener('change', loadTarget));
$('tg-zone').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; state.tg.zone = b.dataset.v; loadTarget(); });
$('tg-rows').addEventListener('click', e => { if (e.target.closest('a')) return; const tr = e.target.closest('tr[data-id]'); if (tr) openLead(+tr.dataset.id); });
$('tg-copy').addEventListener('click', async () => {
  const rows = (state.tg.d && state.tg.d.rows) || [];
  if (!rows.length) { toast('복사할 매장이 없어요', true); return; }
  const lines = ['상호\t주소\t전화'].concat(rows.map(r => [r.name + (r.branch ? ' ' + r.branch : ''), r.addr_road || '', r.tel ? tel(r.tel) : ''].join('\t')));
  try { await navigator.clipboard.writeText(lines.join('\n')); toast(`${rows.length}곳 주소를 복사했어요. 엑셀에 붙여 넣으세요`); }
  catch (e) { toast('복사하지 못했어요. 브라우저 권한을 확인하세요', true); }
});

