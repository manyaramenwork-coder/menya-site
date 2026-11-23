/* ---------- 상세 ---------- */
function closePanel(){ $('panel').hidden = true; $('scrim').hidden = true; $('addbox').hidden = true; $('more-sheet').hidden = true; state.cur = null; }
$('scrim').addEventListener('click', closePanel);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('scrim').hidden) closePanel(); });

async function openLead(id){
  try {
    const d = await rpc('lead_get', { p_id: id });
    state.cur = d; renderPanel(d);
    $('scrim').hidden = false; $('panel').hidden = false;
  } catch (e) { toast(errMsg(e), true); }
}

function opt(map, v){ return Object.entries(map).map(([k, l]) => `<option value="${k}"${k === v ? ' selected' : ''}>${esc(l)}</option>`).join(''); }
function renderPanel(d){
  const addr = d.addr_road || d.addr_jibun || '';
  const mapUrl = naverLink(d);
  const users = `<option value="">미지정</option>` + state.users.map(u => `<option value="${esc(u.id)}"${u.id === d.assignee ? ' selected' : ''}>${esc(u.name)}</option>`).join('');
  const idx = FLOW.indexOf(d.stage);
  const steps = STAGES.map(([k, v], i) => {
    const cls = k === d.stage ? 'on' : (i < 7 && idx >= 0 && i < idx ? 'done' : '');
    return (i === 7 ? '<span class="gap"></span>' : '') + `<button data-stage="${k}" class="${cls}">${v}</button>`;
  }).join('');
  $('panel').innerHTML = `
  <div class="panel-hd">
    <div>
      <h2 id="p-name">${esc(d.name)}${d.branch ? ' ' + esc(d.branch) : ''}</h2>
      <div class="sm">${esc(d.cat_s || '')}${d.segment ? ' · ' + esc(SEG[d.segment] || d.segment) : ''}${addr ? ' · ' + esc(addr) : ''}${chainTag(d)}</div>
      ${d.fav_by ? `<div class="sm">관심 담은 사람: ${esc(d.fav_by)}</div>` : ''}
      <div class="links"><a href="${esc(mapUrl)}" target="_blank" rel="noopener">${d.naver_url ? '네이버 플레이스 열기' : '네이버에서 찾기'}</a>${d.tel ? `<a href="tel:${esc(d.tel)}">${esc(tel(d.tel))} 전화</a>` : ''}${d.owner_tel ? `<a href="tel:${esc(d.owner_tel)}">점주 ${esc(tel(d.owner_tel))} 전화</a>` : ''}</div>
    </div>
    <button class="favbtn ${d.fav ? 'on' : ''}" id="p-fav" aria-pressed="${d.fav ? 'true' : 'false'}">${d.fav ? '★ 관심' : '☆ 관심 담기'}</button>
    <button class="x" id="p-close" aria-label="닫기" style="margin-left:4px">×</button>
  </div>
  <div class="panel-bd">
    <div class="box"><h4>영업 단계</h4><div class="steps" id="p-steps">${steps}</div></div>

    <div class="box">
      <h4>체인 판정 <span class="tag ${d.is_chain ? 't-A' : 't-C'}" style="margin-left:4px">${d.is_chain ? '체인' : '체인 아님'}</span></h4>
      <p class="muted" style="margin:0 0 10px">${esc(d.chain_reason || '판정 근거 없음 (지점명 없음, 같은 상호 1곳)')}${d.chain_threshold ? ` · 기준: 같은 상호 전국 ${esc(d.chain_threshold)}곳 이상 또는 지점명 있음` : ''}</p>
      <div class="pick" id="p-chain">
        <button type="button" data-v="auto" class="${d.chain_override == null ? 'on' : ''}">자동 판정</button>
        <button type="button" data-v="chain" class="${d.chain_override === true ? 'on' : ''}">체인 맞음</button>
        <button type="button" data-v="not" class="${d.chain_override === false ? 'on' : ''}">체인 아님</button>
      </div>
    </div>

    <div class="box">
      <h4>통화 결과 남기기</h4>
      <div class="fld" style="margin-bottom:10px"><label>결과</label><div class="pick" id="c-res">${Object.entries(RES).map(([k, v]) => `<button type="button" data-v="${k}">${v}</button>`).join('')}</div></div>
      <div class="fld" style="margin-bottom:10px"><label>점심 장사 유형</label><div class="pick red" id="c-lunch">${Object.entries(LUNCH).map(([k, v]) => `<button type="button" data-v="${k}" class="${k === d.lunch_type ? 'on' : ''}">${v}</button>`).join('')}</div></div>
      <div class="grid2">
        <div class="fld"><label for="c-feel">매출 체감</label><input id="c-feel" placeholder="예: 평일 저녁이 특히 약함"></div>
        <div class="fld"><label for="c-dur">통화 시간(분)</label><input id="c-dur" type="number" min="0" inputmode="numeric"></div>
        <div class="fld full"><label for="c-react">핵심 반응</label><textarea id="c-react" placeholder="예: 낮 임대료 부담 언급, 돈카츠 같이 하는 구성에 관심"></textarea></div>
        <div class="fld full"><label for="c-concern">우려 사항</label><input id="c-concern" placeholder="예: 점심 인력 추가 채용 부담"></div>
        <div class="fld"><label for="c-next">다음 연락일</label><input id="c-next" type="date" value="${esc(d.next_contact || '')}"></div>
        <div class="fld"><label for="c-action">다음 액션</label><input id="c-action" value="${esc(d.next_action || '')}" placeholder="예: 수익 시뮬레이션 문자 발송"></div>
        <div class="fld full"><label for="c-rec">녹음 파일 링크 (선택)</label><input id="c-rec" placeholder="드라이브 등 링크"></div>
      </div>
      <div class="row-end"><span class="msg" id="c-msg"></span><button class="btn" type="button" id="c-memo">메모로 저장</button><button class="btn pri" type="button" id="c-save">통화 결과 저장</button></div>
    </div>

    <div class="box">
      <h4>매장 정보</h4>
      <div class="grid2">
        <div class="fld"><label for="e-tel">매장 전화</label><input id="e-tel" type="tel" value="${esc(tel(d.tel || ''))}"></div>
        <div class="fld full"><label for="e-naver">네이버 플레이스 주소</label><input id="e-naver" type="url" value="${esc(d.naver_url || '')}" placeholder="네이버에서 찾은 매장 페이지 주소를 붙여 넣으세요 (naver.me 공유 링크도 가능)"></div>
        <div class="fld"><label for="e-hours">영업시간</label><input id="e-hours" value="${esc(d.hours || '')}" placeholder="예: 17:00–01:00"></div>
        <div class="fld"><label for="e-oname">점주</label><input id="e-oname" value="${esc(d.owner_name || '')}"></div>
        <div class="fld"><label for="e-otel">점주 연락처</label><input id="e-otel" type="tel" value="${esc(tel(d.owner_tel || ''))}"></div>
        <div class="fld"><label for="e-asg">담당자</label><select id="e-asg">${users}</select></div>
        <div class="fld"><label for="e-org">리드 소유</label><select id="e-org">${opt(ORG, d.owner_org)}</select></div>
        <div class="fld"><label for="e-src">유입 경로</label><select id="e-src">${opt(SRC, d.source)}</select></div>
        <div class="fld"><label>수집 정보</label><div class="muted" style="padding-top:8px">${d.first_seen ? '처음 확인 ' + esc(d.first_seen) : '직접 등록'}${d.closed_at ? ' · <b style="color:var(--brand)">폐업 의심 ' + esc(d.closed_at) + '</b>' : ''}</div></div>
      </div>
      <h4 style="margin-top:16px">매출 정보 (월, 원)</h4>
      <div class="grid2">
        <div class="fld"><label for="e-rown">점주 신고</label><input id="e-rown" type="number" min="0" value="${d.rev_owner ?? ''}"></div>
        <div class="fld"><label for="e-ropen">오픈업 조회</label><input id="e-ropen" type="number" min="0" value="${d.rev_openup ?? ''}"></div>
        <div class="fld"><label for="e-rarea">상권 평균</label><input id="e-rarea" type="number" min="0" value="${d.rev_area ?? ''}"></div>
        <div class="fld"><label for="e-rnote">매출 메모</label><input id="e-rnote" value="${esc(d.rev_note || '')}"></div>
      </div>
      <h4 style="margin-top:16px">동의</h4>
      <div class="toggles">
        <label class="chk"><input type="checkbox" id="e-cc"${d.consent_collect ? ' checked' : ''}>개인정보 수집</label>
        <label class="chk"><input type="checkbox" id="e-cs"${d.consent_share ? ' checked' : ''}>오유미당 제공</label>
        <label class="chk"><input type="checkbox" id="e-cm"${d.consent_marketing ? ' checked' : ''}>마케팅 수신</label>
      </div>
      <div class="fld full" style="margin-top:12px"><label for="e-memo">메모</label><textarea id="e-memo">${esc(d.memo || '')}</textarea></div>
      <div class="row-end"><span class="msg" id="e-msg"></span><button class="btn pri" type="button" id="e-save">매장 정보 저장</button></div>
    </div>

    <div class="box"><h4>활동 기록</h4><div class="tl">${renderActs(d.activities)}</div></div>
  </div>`;

  $('p-close').onclick = closePanel;
  $('p-fav').onclick = async () => {
    try { const on = await rpc('lead_fav_toggle', { p_id: d.id }); d.fav = on; toast(on ? '관심 매장에 담았어요' : '관심 매장에서 뺐어요'); renderPanel(d); refreshStats(); if (state.view === 'fav') loadFav(); }
    catch (e) { toast(errMsg(e), true); }
  };
  $('p-chain').onclick = async e => {
    const b = e.target.closest('button[data-v]'); if (!b || b.classList.contains('on')) return;
    try { await rpc('lead_chain_set', { p_id: d.id, p_value: b.dataset.v }); toast(b.dataset.v === 'auto' ? '자동 판정으로 돌렸어요' : '체인 표시를 바꿨어요'); await refreshAfter(d.id); }
    catch (er) { toast(errMsg(er), true); }
  };
  $('p-steps').onclick = async e => {
    const b = e.target.closest('button[data-stage]'); if (!b || b.dataset.stage === d.stage) return;
    await save({ id: d.id, stage: b.dataset.stage }, `${ST[b.dataset.stage]} 단계로 옮겼어요`);
  };
  ['c-res', 'c-lunch'].forEach(id => $(id).onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const was = b.classList.contains('on');
    [...$(id).children].forEach(x => x.classList.remove('on'));
    if (!was) b.classList.add('on');
    if (id === 'c-res' && !was && !$('c-next').value && ['interested', 'hold', 'no_answer'].includes(b.dataset.v)) $('c-next').value = addDays(b.dataset.v === 'no_answer' ? 1 : 3);
  });
  $('c-save').onclick = () => logCall('call');
  $('c-memo').onclick = () => logCall('memo');
  $('e-save').onclick = () => save({
    id: d.id, tel: $('e-tel').value.replace(/\D/g, ''), hours: $('e-hours').value, naver_url: $('e-naver').value.trim(), owner_name: $('e-oname').value,
    owner_tel: $('e-otel').value.replace(/\D/g, ''), assignee: $('e-asg').value, org: $('e-org').value, source: $('e-src').value,
    rev_owner: $('e-rown').value, rev_openup: $('e-ropen').value, rev_area: $('e-rarea').value, rev_note: $('e-rnote').value,
    consent_collect: $('e-cc').checked, consent_share: $('e-cs').checked, consent_marketing: $('e-cm').checked, memo: $('e-memo').value
  }, '매장 정보를 저장했어요');
}

function renderActs(list){
  if (!list || !list.length) return '<p class="muted" style="margin:0">아직 기록이 없어요. 첫 통화 결과를 남겨 보세요.</p>';
  return list.map(a => {
    const s = a.summary || {};
    const rows = [['점심', s.lunch], ['매출 체감', s.revenue_feel], ['핵심 반응', s.reaction], ['우려', s.concern], ['다음 액션', s.next_action], ['메모', s.note]].filter(r => r[1]);
    const title = a.kind === 'stage' ? `단계 변경: ${esc(ST[a.from] || a.from || '')} → ${esc(ST[a.to] || a.to || '')}` : esc(KIND[a.kind] || a.kind);
    return `<div class="act ${a.kind === 'call' ? 'call' : ''}">
      <div class="hd"><b>${title}</b>${a.result ? `<span class="tag t-st">${esc(RES[a.result] || a.result)}</span>` : ''}${a.ai ? '<span class="tag t-C">Claude 요약</span>' : ''}${a.duration ? `<span class="muted">${Math.round(a.duration / 60)}분</span>` : ''}<span class="when">${esc(a.at)}${a.by ? ' · ' + esc(a.by) : ''}</span></div>
      ${rows.length ? `<dl>${rows.map(r => `<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join('')}</dl>` : ''}
      ${a.rec ? `<div class="links"><a href="${esc(a.rec)}" target="_blank" rel="noopener">녹음 듣기</a></div>` : ''}
    </div>`;
  }).join('');
}

async function save(p, okMsg){
  try {
    await rpc('lead_save', { p });
    toast(okMsg); await refreshAfter(p.id);
  } catch (e) { toast(errMsg(e), true); }
}
async function logCall(kind){
  const d = state.cur; if (!d) return;
  const res = ($('c-res').querySelector('.on') || {}).dataset?.v || '';
  const lunch = ($('c-lunch').querySelector('.on') || {}).dataset?.v || '';
  const summary = {
    lunch: lunch ? LUNCH[lunch] : '', revenue_feel: $('c-feel').value.trim(), reaction: $('c-react').value.trim(),
    concern: $('c-concern').value.trim(), next_action: $('c-action').value.trim()
  };
  Object.keys(summary).forEach(k => { if (!summary[k]) delete summary[k]; });
  if (kind === 'call' && !res) { toast('통화 결과를 골라 주세요', true); return; }
  if (kind === 'memo' && !Object.keys(summary).length) { toast('남길 내용을 입력해 주세요', true); return; }
  let stage = '';
  if (kind === 'call' && RES_STAGE[res]) {
    const to = RES_STAGE[res], fi = FLOW.indexOf(d.stage), ti = FLOW.indexOf(to);
    if (to === 'hold' || to === 'rejected' || ti > fi || fi < 0) stage = to;
  }
  const btn = kind === 'call' ? $('c-save') : $('c-memo'); btn.disabled = true;
  try {
    await rpc('lead_log', { p: { lead_id: d.id, kind, result: kind === 'call' ? res : '', duration: $('c-dur').value ? Math.round(+$('c-dur').value * 60) : '',
      summary, rec: $('c-rec').value.trim(), stage, lunch, next: $('c-next').value, next_action: $('c-action').value.trim() } });
    toast(kind === 'call' ? '통화 결과를 저장했어요' : '메모를 저장했어요');
    await refreshAfter(d.id);
  } catch (e) { toast(errMsg(e), true); }
  finally { btn.disabled = false; }
}
async function refreshAfter(id){
  const [d, s] = await Promise.all([rpc('lead_get', { p_id: id }), rpc('lead_stats')]);
  state.cur = d; renderPanel(d); applyStats(s); load(true);
}

