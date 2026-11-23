/* ---------- 수집 현황 (관리자) ---------- */
state.ig = { filter: '', jobs: [], d: null, timer: null };
const IG_ST = { '대기': 'st-wait', '진행중': 'st-run', '완료': 'st-done', '실패': 'st-fail' };
const kstTime = t => t ? new Date(t).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-';
async function loadIngest(){
  clearTimeout(state.ig.timer);
  try {
    const d = await rpc('lead_ingest_status');
    state.ig.d = d; state.ig.jobs = d.jobs || [];
    renderIngest();
    // 돌고 있는 지역이 있으면 8초마다 새로고침
    if (state.view === 'ingest' && state.ig.jobs.some(j => j.running)) state.ig.timer = setTimeout(loadIngest, 8000);
  } catch (e) { toast(errMsg(e), true); }
}
function renderIngest(){
  const d = state.ig.d || {}; const s = d.summary || {}; const f = state.ig.filter;
  $('ig-now').textContent = d.now_kst ? d.now_kst + ' 기준' : '';
  $('ig-stats').innerHTML = [
    ['대기', (s['대기'] || 0) + '곳'], ['진행중', (s['진행중'] || 0) + '곳'], ['완료', (s['완료'] || 0) + '곳'],
    ['실패', (s['실패'] || 0) + '곳', (s['실패'] || 0) > 0], ['임시 적재', (d.stage_rows || 0).toLocaleString() + '건'],
    ['자동 실행', d.in_window ? '도는 중' : '쉬는 시간']
  ].map(([l, v, a]) => `<div class="stat${a ? ' alert' : ''}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
  const c = d.chain || {};
  const segTxt = Object.entries(c.segment || {}).map(([k, n]) => `${SEG[k] || k} ${Number(n).toLocaleString()}`).join(' · ');
  $('ig-chain').innerHTML = `<h4>체인 판정 기준<small class="muted">지점명이 있거나, 같은 상호가 전국에 기준 수 이상이면 체인</small></h4>
    <div class="ig-run-row"><label class="chk" style="flex:none">같은 상호 전국 <input id="ig-thr" type="number" min="2" step="1" value="${esc(c.threshold ?? 10)}" style="width:70px;border:1px solid var(--line);border-radius:6px;padding:4px 6px"> 곳 이상</label>
      <button class="btn" id="ig-thr-save">기준 저장 후 다시 판정</button></div>
    <div class="ig-run-row">
      <select id="ig-rule" aria-label="같은 상호 기준 적용 방식" style="flex:1;min-width:260px">
        <option value="any"${c.rule !== 'branch_required' ? ' selected' : ''}>같은 상호 기준을 항상 적용</option>
        <option value="branch_required"${c.rule === 'branch_required' ? ' selected' : ''}>그 상호에 지점명 있는 매장이 1곳 이상일 때만 적용</option>
      </select>
      <label class="chk" style="flex:none"><input type="checkbox" id="ig-gon"${c.generic_on ? ' checked' : ''}>일반 상호 목록은 같은 상호 기준에서 빼기</label>
    </div>
    <div style="margin-bottom:8px"><span class="muted">일반 상호 목록 (${(c.generic_names || []).length}개${c.generic_on ? '' : ', 지금은 꺼져 있음'})</span>
      <div class="chips" id="ig-gen" style="flex-wrap:wrap;margin-top:6px">${(c.generic_names || []).map(nm => `<button type="button" data-del="${esc(nm)}" title="목록에서 빼기">${esc(nm)} ✕</button>`).join('')}</div>
      <div class="ig-run-row"><input id="ig-gen-add" placeholder="추가할 상호 (쉼표로 여러 개)" style="flex:1;min-width:220px;height:38px;border:1px solid var(--line);border-radius:10px;padding:0 10px"><button class="btn" id="ig-gen-save">목록에 추가</button></div>
    </div>
    <p class="muted" style="margin:0">체인 ${(c.chain || 0).toLocaleString()}곳 / 전체 ${(c.total || 0).toLocaleString()}곳 (지점명 기준 ${(c.by_branch || 0).toLocaleString()}곳 포함, 직원 수동 지정 ${(c.by_override || 0).toLocaleString()}곳) · 상호 확인 필요 ${(c.name_check || 0).toLocaleString()}곳${segTxt ? ' · 구분: ' + esc(segTxt) : ''}<br>
    ${c.all_done ? '전 지역 수집이 끝난 기준이에요.' : '<b style="color:var(--warn)">아직 전 지역 수집이 끝나지 않았어요.</b> 지역이 들어올 때마다 전국 기준으로 다시 세기 때문에 체인 숫자가 계속 바뀔 수 있어요.'}</p>`;
  $('ig-thr-save').onclick = async () => {
    const v = parseInt($('ig-thr').value, 10);
    if (!(v >= 2)) { toast('2 이상의 숫자를 넣어 주세요', true); return; }
    if (!confirm(`기준을 '같은 상호 전국 ${v}곳 이상'으로 바꾸고 전체 매장을 다시 판정할까요?`)) return;
    try { const r = await rpc('lead_setting_set', { p_key: 'chain_min_same_name', p_value: v }); toast(`기준을 바꿨어요 (다시 판정된 매장 ${(r.changed || 0).toLocaleString()}곳)`); loadIngest(); }
    catch (e) { toast(errMsg(e), true); }
  };
  const setS = async (key, value, ok) => {
    try { const r = await rpc('lead_setting_set', { p_key: key, p_value: value }); toast(`${ok} (다시 판정된 매장 ${(r.changed || 0).toLocaleString()}곳)`); loadIngest(); }
    catch (e) { toast(errMsg(e), true); }
  };
  $('ig-rule').onchange = e => { if (confirm('같은 상호 기준 적용 방식을 바꾸고 전체 매장을 다시 판정할까요?')) setS('chain_name_rule', e.target.value, '적용 방식을 바꿨어요'); else renderIngest(); };
  $('ig-gon').onchange = e => { if (confirm(e.target.checked ? '일반 상호 목록을 같은 상호 기준에서 빼고 다시 판정할까요?' : '일반 상호 목록 제외를 끄고 다시 판정할까요?')) setS('chain_generic_on', e.target.checked, '설정을 바꿨어요'); else renderIngest(); };
  $('ig-gen').onclick = e => {
    const b = e.target.closest('button[data-del]'); if (!b) return;
    if (!confirm(`'${b.dataset.del}'을(를) 일반 상호 목록에서 뺄까요?`)) return;
    setS('chain_generic_names', (c.generic_names || []).filter(x => x !== b.dataset.del), '목록에서 뺐어요');
  };
  $('ig-gen-save').onclick = () => {
    const add = $('ig-gen-add').value.split(',').map(x => x.trim()).filter(Boolean);
    if (!add.length) { toast('추가할 상호를 넣어 주세요', true); return; }
    setS('chain_generic_names', (c.generic_names || []).concat(add), '목록에 추가했어요');
  };
  $('ig-filter').innerHTML = [['', '전체'], ['진행중', '진행중'], ['실패', '실패'], ['대기', '대기'], ['완료', '완료']]
    .map(([k, l]) => `<button data-f="${k}" class="${f === k ? 'on' : ''}">${l}${k ? ` <small>${s[k] || 0}</small>` : ''}</button>`).join('');
  const sel = $('ig-code'), cur = sel.value;
  const opts = state.ig.jobs.slice().sort((a, b) => (a.sido + ' ' + a.sigungu).localeCompare(b.sido + ' ' + b.sigungu, 'ko'));
  sel.innerHTML = '<option value="">시군구 선택</option>' + opts.map(j => `<option value="${esc(j.code)}">${esc(j.sido)} ${esc(j.sigungu)} · ${esc(j.status)}</option>`).join('');
  if (cur) sel.value = cur;
  const rows = state.ig.jobs.filter(j => !f || j.status === f);
  $('ig-rows').innerHTML = rows.length ? rows.map(j => {
    const prog = j.status === '진행중' && j.total_pages ? ` <span class="ig-sm">${Math.min(j.next_page - 1, j.total_pages)}/${j.total_pages}쪽</span>` : '';
    const res = j.status === '완료' && j.inserted != null ? `신규 ${j.inserted} · 갱신 ${j.updated ?? 0} · 폐업 의심 ${j.closed ?? 0}` : '';
    const label = j.status === '완료' ? '다시 수집' : j.status === '실패' ? '다시 시도' : '지금 실행';
    return `<tr>
      <td><b>${esc(j.sigungu)}</b><div class="ig-sm">${esc(j.sido)} · ${esc(j.code)}</div></td>
      <td><span class="ig-st ${IG_ST[j.status] || ''}">${esc(j.status)}</span>${j.manual ? ' <span class="ig-sm">수동</span>' : ''}${prog}</td>
      <td class="num">${(j.processed || 0).toLocaleString()}</td>
      <td class="num">${(j.fetched || 0).toLocaleString()}</td>
      <td class="ig-sm">${esc(res)}</td>
      <td class="ig-sm">${esc(kstTime(j.last_at))}</td>
      <td class="ig-err">${esc(j.error || '')}</td>
      <td>${j.running ? '' : `<button class="btn sm" data-run="${esc(j.code)}">${label}</button>`}</td></tr>`;
  }).join('') : '<tr><td colspan="8" class="muted" style="text-align:center;padding:30px">해당하는 지역이 없어요.</td></tr>';
}
async function runIngest(code){
  if (!code) { toast('시군구를 골라 주세요', true); return; }
  const j = state.ig.jobs.find(x => x.code === code);
  if (!confirm(`${j ? j.sido + ' ' + j.sigungu : code} 수집을 지금 실행할까요?\n영업 기록은 건드리지 않고 공공데이터 칸만 갱신해요.`)) return;
  try {
    await rpc('lead_ingest_run', { p_code: code });
    toast('실행을 시작했어요. 잠시 후 상태가 바뀌어요.');
    setTimeout(loadIngest, 3000);
  } catch (e) { toast(errMsg(e), true); }
}
$('ig-go').addEventListener('click', () => runIngest($('ig-code').value));
$('ig-rows').addEventListener('click', e => { const b = e.target.closest('button[data-run]'); if (b) runIngest(b.dataset.run); });
$('ig-filter').addEventListener('click', e => { const b = e.target.closest('button[data-f]'); if (!b) return; state.ig.filter = b.dataset.f; renderIngest(); });
$('ig-refresh').addEventListener('click', loadIngest);

