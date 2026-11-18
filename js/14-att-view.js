// v3.6 출결관리 보기 개선: 직원별 달력(기본) · 날짜별 · 월 요약
let ATT_STATE = {view:'cal', emp:null, day:null};
const DOW = ['일','월','화','수','목','금','토'];
function attMonths(){ return Object.keys(ATT).sort().reverse(); }
function attEmps(m){ const ret = document.getElementById('a-ret')?.checked; return ATT[m].filter(e => Object.keys(e.days).length && (ret || e.status !== '퇴사')); }
function dayInfo(r){
  if (!r) return null;
  const a = toMin(r[0]), b = toMin(r[1]);
  if (a == null) return {cls:'miss', label:'출근 기록 없음', mins:null};
  if (b == null) return {cls:'miss', label:'퇴근 기록 없음', mins:null};
  if (b <= a) return {cls:'miss', label:'시간 확인 필요', mins:null};
  return {cls:'ok', label:'', mins:b - a};
}
const hShort = m => m == null ? '' : `${Math.floor(m/60)}시간${m%60?` ${m%60}분`:''}`;
pageAttendance = function(){
  const months = attMonths();
  document.getElementById('main').innerHTML = simpleHero(['인사관리','쌍용본점 출결관리'], 'HR · ATTENDANCE', '쌍용본점 출결관리', '직원을 누르면 그 달 출퇴근을 달력으로 보여줘요.') +
  `<div class="data-note"><span class="status-dot"></span><span>${ATT_SRC}</span></div>
   <section class="card att-bar">
    <div class="att-bar-l"><select id="a-month" aria-label="조회 월">${months.map(m => `<option value="${m}">${m.replace('-','년 ')}월${m===months[0]?' (집계 중)':''}</option>`).join('')}</select>
     <label class="mini-chk"><input type="checkbox" id="a-ret"> 퇴사자 포함</label></div>
    <div class="att-tabs" role="tablist">${[['cal','직원별 달력'],['day','날짜별'],['sum','월 요약']].map(([k,t]) => `<button role="tab" data-v="${k}" class="${ATT_STATE.view===k?'on':''}" onclick="ATT_STATE.view='${k}';drawAtt()">${t}</button>`).join('')}</div>
   </section><div id="res"></div>` + pageFoot();
  document.getElementById('a-month').onchange = () => { ATT_STATE.emp = null; ATT_STATE.day = null; drawAtt(); };
  document.getElementById('a-ret').onchange = () => drawAtt();
  drawAtt();
};
function drawAtt(){
  document.querySelectorAll('.att-tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === ATT_STATE.view));
  const m = document.getElementById('a-month').value, emps = attEmps(m);
  const [y, mo] = m.split('-').map(Number), nd = new Date(y, mo, 0).getDate();
  const dates = Array.from({length: nd}, (_, i) => `${m}-${String(i+1).padStart(2,'0')}`);
  const res = document.getElementById('res');
  if (!emps.length){ res.innerHTML = '<div class="card empty">이 달에는 기록이 없어요.</div>'; return; }
  const stats = e => { let d = 0, mins = 0, miss = 0; Object.values(e.days).forEach(r => { d++; const i = dayInfo(r); if (i.mins != null) mins += i.mins; else miss++; }); return {d, mins, miss}; };

  if (ATT_STATE.view === 'cal'){
    if (!ATT_STATE.emp || !emps.find(e => e.name === ATT_STATE.emp)) ATT_STATE.emp = emps[0].name;
    const e = emps.find(x => x.name === ATT_STATE.emp), s = stats(e);
    const first = new Date(y, mo - 1, 1).getDay();
    const cells = Array(first).fill('<div class="cal-c blank"></div>').concat(dates.map(d => {
      const r = e.days[d], i = dayInfo(r), w = new Date(d).getDay();
      return `<div class="cal-c ${w===0?'sun':w===6?'sat':''} ${r?i.cls:'off'}"><span class="cal-d">${+d.slice(8)}</span>${r?`<span class="cal-t">${r[0]==='!'?'<b>--:--</b>':r[0]} → ${r[1]==='!'?'<b>--:--</b>':r[1]}</span><span class="cal-h">${i.mins!=null?hShort(i.mins):i.label}</span>`:''}</div>`;
    }));
    LAST = {head:['날짜','출근','퇴근','근무시간','비고'], body: dates.filter(d => e.days[d]).map(d => { const i = dayInfo(e.days[d]); return [d, e.days[d][0], e.days[d][1], i.mins!=null?hShort(i.mins):'', i.label]; })};
    res.innerHTML = `<div class="emp-chips">${emps.map(x => { const t = stats(x); return `<button class="chip ${x.name===e.name?'on':''}" onclick="ATT_STATE.emp='${esc(x.name)}';drawAtt()"><b>${esc(x.name)}</b><small>${t.d}일${t.miss?` · <i>누락 ${t.miss}</i>`:''}</small>${x.status==='퇴사'?'<span class="ret">퇴사</span>':''}</button>`; }).join('')}</div>
     <section class="card"><div class="emp-head"><div><h3>${esc(e.name)}</h3><small>${m.replace('-','년 ')}월 출퇴근</small></div>
       <div class="emp-k"><span>근무일<b>${s.d}일</b></span><span>총 근무<b>${Math.round(s.mins/60)}시간</b></span><span>하루 평균<b>${s.d-s.miss?hShort(Math.round(s.mins/(s.d-s.miss))):'-'}</b></span><span class="${s.miss?'warn':''}">기록 누락<b>${s.miss}건</b></span></div>
       <button class="btn ghost" onclick="dlCsv('출결_${esc(e.name)}_${m}')">${ic('download')}CSV</button></div>
      <div class="cal-w">${DOW.map((d,i) => `<span class="${i===0?'sun':i===6?'sat':''}">${d}</span>`).join('')}</div>
      <div class="cal">${cells.join('')}</div>
      <div class="cal-legend"><span><i class="ok"></i>정상</span><span><i class="miss"></i>출근·퇴근 기록 누락</span><span><i class="off"></i>근무 없음</span></div></section>`;
  }
  else if (ATT_STATE.view === 'day'){
    const worked = dates.filter(d => emps.some(e => e.days[d]));
    if (!ATT_STATE.day || !worked.includes(ATT_STATE.day)) ATT_STATE.day = worked[worked.length - 1];
    const d = ATT_STATE.day, list = emps.filter(e => e.days[d]);
    LAST = {head:['이름','출근','퇴근','근무시간','상태'], body: list.map(e => { const i = dayInfo(e.days[d]); return [e.name, e.days[d][0], e.days[d][1], i.mins!=null?hShort(i.mins):'', i.label||'정상']; })};
    res.innerHTML = `<section class="card"><div class="day-strip">${dates.map(x => { const n = emps.filter(e => e.days[x]).length, w = new Date(x).getDay(); return `<button class="${x===d?'on':''} ${w===0?'sun':w===6?'sat':''}" ${n?'':'disabled'} onclick="ATT_STATE.day='${x}';drawAtt()"><small>${DOW[w]}</small><b>${+x.slice(8)}</b><i>${n||''}</i></button>`; }).join('')}</div>
      <div class="emp-head"><div><h3>${+d.slice(5,7)}월 ${+d.slice(8)}일 (${DOW[new Date(d).getDay()]})</h3><small>출근 ${list.length}명</small></div><button class="btn ghost" onclick="dlCsv('출결_${d}')">${ic('download')}CSV</button></div>
      <div class="day-list">${list.map(e => { const r = e.days[d], i = dayInfo(r); return `<div class="day-row ${i.cls}"><b>${esc(e.name)}</b><span>출근 <em>${r[0]==='!'?'--:--':r[0]}</em></span><span>퇴근 <em>${r[1]==='!'?'--:--':r[1]}</em></span><span>${i.mins!=null?hShort(i.mins):`<strong>${i.label}</strong>`}</span></div>`; }).join('')}</div></section>`;
  }
  else {
    const st = emps.map(e => ({e, ...stats(e)}));
    LAST = {head:['이름','근무일','총 근무시간','하루 평균','기록 누락'], body: st.map(s => [s.e.name, s.d, hShort(s.mins), s.d-s.miss?hShort(Math.round(s.mins/(s.d-s.miss))):'-', s.miss])};
    res.innerHTML = `<section class="card"><div class="emp-head"><div><h3>${m.replace('-','년 ')}월 요약</h3><small>이름을 누르면 달력으로 볼 수 있어요</small></div><button class="btn ghost" onclick="dlCsv('출결요약_${m}')">${ic('download')}CSV</button></div>
      <table class="sum-t"><thead><tr><th>이름</th><th class="n">근무일</th><th class="n">총 근무시간</th><th class="n">하루 평균</th><th class="n">기록 누락</th></tr></thead><tbody>
      ${st.map(s => `<tr onclick="ATT_STATE.emp='${esc(s.e.name)}';ATT_STATE.view='cal';drawAtt()"><td><b>${esc(s.e.name)}</b>${s.e.status==='퇴사'?'<span class="ret">퇴사</span>':''}</td><td class="n">${s.d}일</td><td class="n">${hShort(s.mins)}</td><td class="n">${s.d-s.miss?hShort(Math.round(s.mins/(s.d-s.miss))):'-'}</td><td class="n ${s.miss?'miss':''}">${s.miss}건</td></tr>`).join('')}
      </tbody></table></section>`;
  }
}
