// v3.7 타각(찍은 기록) 상세 + 중복/구분 오류 파악
let PUNCH = []; // [date, time, name, type, auth]
const PMAP = {}; PUNCH.forEach(([d, t, n, ty, au]) => { (PMAP[n + '|' + d] ||= []).push({t, ty, au}); });
Object.values(PMAP).forEach(v => v.sort((a, b) => a.t.localeCompare(b.t)));
let PUNCH_FROM = PUNCH.reduce((m, p) => p[0] < m ? p[0] : m, '9999');
function punchIssues(list){
  if (!list) return [];
  const out = [], by = ty => list.filter(p => p.ty === ty);
  const ins = by('출근'), outs = by('퇴근');
  const firstIn = ins[0] ? toMin(ins[0].t) : null;
  const check = (arr, ty) => {
    if (arr.length < 2) return;
    const mins = arr.map(p => toMin(p.t)), gaps = mins.slice(1).map((m, i) => m - mins[i]);
    if (ty === '출근' && firstIn != null && mins.slice(1).some(m => m - firstIn >= 180 || outs.some(o => Math.abs(toMin(o.t) - m) <= 5))) out.push({lv:'warn', t:'퇴근 때 "출근"을 잘못 찍음'});
    else if (ty === '퇴근' && firstIn != null && mins[0] - firstIn <= 10 && mins[mins.length - 1] - firstIn > 60) out.push({lv:'warn', t:'출근 때 "퇴근"을 잘못 찍음'});
    else if (gaps.every(g => g <= 3)) out.push({lv:'info', t:`${ty} 중복 터치 ${arr.length}회`});
    else out.push({lv:'warn', t:`${ty} ${arr.length}회 (간격 있음)`});
  };
  check(ins, '출근'); check(outs, '퇴근');
  if (list.some(p => p.ty === '외출' || p.ty === '복귀')) out.push({lv:'info', t:'외출/복귀 기록 있음'});
  return out;
}
function realSpan(list){ if (!list || !list.length) return null; const a = toMin(list[0].t), b = toMin(list[list.length - 1].t); return b > a ? {from:list[0].t, to:list[list.length - 1].t, mins:b - a} : null; }
function punchChips(list){ return list.map(p => `<span class="pc ${p.ty==='출근'?'in':p.ty==='퇴근'?'out':'etc'}">${p.t} ${p.ty}</span>`).join(''); }

// 상세 팝업
function showPunch(name, d){
  const list = PMAP[name + '|' + d], iss = punchIssues(list), sp = realSpan(list);
  const box = document.getElementById('p-modal') || document.body.appendChild(Object.assign(document.createElement('div'), {id:'p-modal'}));
  box.innerHTML = `<div class="modal-bg" onclick="if(event.target===this)this.parentNode.innerHTML=''"><div class="modal p-modal" role="dialog" aria-label="타각 상세">
   <div class="section-title"><strong>${ic('clock')}${esc(name)} · ${+d.slice(5,7)}월 ${+d.slice(8)}일 (${DOW[new Date(d).getDay()]})</strong><button class="x" onclick="document.getElementById('p-modal').innerHTML=''" aria-label="닫기">${ic('close')}</button></div>
   ${list ? `<table class="p-t"><thead><tr><th>시간</th><th>구분</th><th>인증</th></tr></thead><tbody>${list.map(p => `<tr><td><b>${p.t}</b></td><td><span class="pc ${p.ty==='출근'?'in':p.ty==='퇴근'?'out':'etc'}">${p.ty}</span></td><td>${esc(p.au)}</td></tr>`).join('')}</tbody></table>
   ${iss.length ? `<div class="p-iss">${iss.map(i => `<span class="iss ${i.lv}">${i.t}</span>`).join('')}</div>` : '<div class="p-ok">정상 (출근 1회 · 퇴근 1회)</div>'}
   ${sp ? `<div class="p-span">처음 찍은 시간 ~ 마지막 찍은 시간: <b>${sp.from} ~ ${sp.to}</b> (${hShort(sp.mins)})</div>` : ''}` : `<div class="empty">상세 타각 기록이 없어요. (상세 기록은 ${PUNCH_FROM}부터)</div>`}
  </div></div>`;
}

// 직원별 달력에 표시 + 클릭 시 상세
const drawAttV37 = drawAtt;
drawAtt = function(){
  drawAttV37();
  const m = document.getElementById('a-month').value;
  if (ATT_STATE.view === 'cal'){
    const name = ATT_STATE.emp;
    const [y, mo] = m.split('-').map(Number), first = new Date(y, mo - 1, 1).getDay();
    const cells = [...document.querySelectorAll('.cal .cal-c')].slice(first);
    cells.forEach((c, i) => {
      const d = `${m}-${String(i + 1).padStart(2, '0')}`, list = PMAP[name + '|' + d];
      if (!list) return;
      c.classList.add('clk'); c.title = '눌러서 찍은 기록 보기'; c.onclick = () => showPunch(name, d);
      const iss = punchIssues(list);
      if (iss.some(x => x.lv === 'warn')) c.insertAdjacentHTML('beforeend', `<span class="cal-flag warn">⚠ ${iss.find(x => x.lv === 'warn').t}</span>`);
      else if (iss.length) c.insertAdjacentHTML('beforeend', `<span class="cal-flag info">중복 터치</span>`);
    });
    // 칩에 이상 타각 수
    document.querySelectorAll('.emp-chips .chip').forEach(ch => {
      const nm = ch.querySelector('b').textContent;
      const n = Object.keys(PMAP).filter(k => k.startsWith(nm + '|' + m)).filter(k => punchIssues(PMAP[k]).some(x => x.lv === 'warn')).length;
      if (n) ch.querySelector('small').insertAdjacentHTML('beforeend', ` · <i>확인 ${n}</i>`);
    });
    const leg = document.querySelector('.cal-legend');
    if (leg) leg.insertAdjacentHTML('beforeend', `<span><i class="fl"></i>⚠ 타각 확인 필요 (날짜를 누르면 찍은 기록 전부 보기)</span>`);
  }
  if (ATT_STATE.view === 'day'){
    const d = ATT_STATE.day;
    document.querySelectorAll('.day-list .day-row').forEach(r => {
      const nm = r.querySelector('b').textContent, list = PMAP[nm + '|' + d];
      if (!list) return;
      r.classList.add('clk'); r.onclick = () => showPunch(nm, d);
      const iss = punchIssues(list);
      r.insertAdjacentHTML('beforeend', `<span class="day-p">${punchChips(list)}${iss.length ? iss.map(i => `<span class="iss ${i.lv}">${i.t}</span>`).join('') : ''}</span>`);
    });
  }
  if (ATT_STATE.view === 'chk') drawPunchCheck();
};
// 새 탭: 타각 확인
const pageAttendanceV37 = pageAttendance;
pageAttendance = function(){
  pageAttendanceV37();
  const tabs = document.querySelector('.att-tabs');
  tabs.insertAdjacentHTML('beforeend', `<button role="tab" data-v="chk" onclick="ATT_STATE.view='chk';drawAtt()">타각 확인</button>`);
  if (ATT_STATE.view === 'chk') drawAtt();
};
function drawPunchCheck(){
  document.querySelectorAll('.att-tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === 'chk'));
  const m = document.getElementById('a-month').value, onlyWarn = document.getElementById('pk-warn')?.checked ?? true;
  const keys = Object.keys(PMAP).filter(k => k.split('|')[1].startsWith(m)).sort((a, b) => b.split('|')[1].localeCompare(a.split('|')[1]) || a.localeCompare(b, 'ko'));
  const rows = keys.map(k => ({k, n:k.split('|')[0], d:k.split('|')[1], list:PMAP[k], iss:punchIssues(PMAP[k])})).filter(r => r.iss.length && (!onlyWarn || r.iss.some(i => i.lv === 'warn')));
  const all = keys.map(k => punchIssues(PMAP[k])).filter(x => x.length);
  const nWarn = all.filter(x => x.some(i => i.lv === 'warn')).length, nInfo = all.length - nWarn;
  LAST = {head:['날짜','이름','찍은 기록','판정','처음~마지막'], body: rows.map(r => { const sp = realSpan(r.list); return [r.d, r.n, r.list.map(p => p.t + ' ' + p.ty).join(' / '), r.iss.map(i => i.t).join(', '), sp ? `${sp.from}~${sp.to}` : '']; })};
  document.getElementById('res').innerHTML = `
   <div class="sum period"><div class="k warn"><div class="l">${ic('info')}확인 필요</div><div class="v">${nWarn}<small>건</small></div></div>
    <div class="k"><div class="l">${ic('clock')}중복 터치 (참고)</div><div class="v">${nInfo}<small>건</small></div></div>
    <div class="k"><div class="l">${ic('cal')}상세 기록 기간</div><div class="v" style="font-size:14px">${PUNCH_FROM} ~</div></div>
    <div class="k"><div class="l">${ic('users')}대상</div><div class="v" style="font-size:14px">재직 직원</div></div></div>
   <section class="card"><div class="emp-head"><div><h3>${m.replace('-','년 ')}월 타각 확인</h3><small>한 날에 출근·퇴근을 여러 번 찍었거나, 구분을 잘못 누른 날이에요.</small></div>
    <label class="mini-chk" style="margin-left:auto"><input type="checkbox" id="pk-warn" ${onlyWarn?'checked':''} onchange="drawPunchCheck()"> 확인 필요만 보기</label>
    <button class="btn ghost" onclick="dlCsv('타각확인_${m}')">${ic('download')}CSV</button></div>
    ${rows.length ? `<div class="chk-list">${rows.map(r => { const sp = realSpan(r.list); return `<div class="chk-row clk" onclick="showPunch('${esc(r.n)}','${r.d}')"><div class="chk-l"><b>${esc(r.n)}</b><small>${+r.d.slice(5,7)}/${+r.d.slice(8)} (${DOW[new Date(r.d).getDay()]})</small></div><div class="chk-m">${punchChips(r.list)}</div><div class="chk-r">${r.iss.map(i => `<span class="iss ${i.lv}">${i.t}</span>`).join('')}${sp ? `<small>처음~마지막 ${sp.from}~${sp.to}</small>` : ''}</div></div>`; }).join('')}</div>` : '<div class="empty">이 달에는 확인할 타각이 없어요.</div>'}
    <p class="dash-hint">판정 기준: 같은 구분을 3분 안에 다시 찍으면 "중복 터치"(참고), 출근 3시간 뒤나 퇴근과 같은 때에 또 "출근"을 찍으면 "퇴근 때 출근을 잘못 찍음", 그 외 여러 번 찍은 경우 "간격 있음"으로 표시해요.</p></section>`;
}
