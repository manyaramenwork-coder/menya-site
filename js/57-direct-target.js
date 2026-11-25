/* ==========================================================
   직영점 관리 > 목표매출 (2026-11-25)
   - 엑셀 '월 목표매출 계산시트'(1. 일평균매출 계산기 · 2. 기본정보입력)를 옮긴 화면
   - 탭: 목표 설정 · 월별 실적 · 신장률
   - 월 실적
       ~2025-10 (쌍용점) : 대표님 기입값 (direct_target_months, total 있음) — 고정
       그 뒤            : 자동 집계 = 포스 순매출 + 배달 순매출(인프라D 결제금액 + 배민 포장 − 마일리지 차감 전부)
                          → 직영점 매출 조회와 같은 계산
       영업일수(자동)   : 포스 순매출이 10만 원 이상인 날 수 · 본사가 달마다 고칠 수 있음(direct_target_months.days)
   - 평균 인원: 시프트 관리 기록(출근 1 · 런치/디너/반휴 0.5)으로 계산, 칸에서 직접 고칠 수 있음
   - 목표 산정: 인원 기준(1인당 기준매출 × 인원) / 신장률 기준(기준 일평균 × (1+%)) / 직접 입력
   - 원 미만: 버림 · 반올림 · 올림 (화면 표시만, 계산은 원 미만까지 그대로) — 브라우저에 기억
   - DB 함수: target_data · target_month_set · target_save (본사·관리자만)
   ========================================================== */
(function(){
  const PAGE = 'dm-target';
  const STORES = [['sv', '쌍용점', /쌍용/, 1], ['bd', '불당점', /불당/, 79]];
  const DV_STORE = 1;                 // 배달 자료가 연결된 매장 (쌍용점)
  const DAY_MIN = 100000;             // 이 금액 이상 팔린 날을 영업일로 셈
  const WD = ['월','화','수','목','금','토','일'];
  const pad = n => String(n).padStart(2, '0');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const role = () => { const S = (typeof SESSION !== 'undefined' ? SESSION : null); return (S && S.user && S.user.role) || ''; };
  const isHQ = () => role() === 'admin' || role() === 'hq';
  const canSales = () => !window.mmCan || mmCan('sales');
  const allowed = () => isHQ() && canSales();
  const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const ymAdd = (ym, k) => { let y = +ym.slice(0, 4), m = +ym.slice(5, 7) + k; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return y + '-' + pad(m); };
  const dim = ym => new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
  const ymLab = ym => `${ym.slice(0, 4)}년 ${+ym.slice(5, 7)}월`;
  const mLab = ym => `${+ym.slice(5, 7)}월`;
  // 그 달에 특정 요일(1=월 … 7=일)이 몇 번
  const dowCount = (ym, dow) => { if (!dow) return 0; let n = 0; const y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1; for (let d = 1; d <= dim(ym); d++) { const w = (new Date(y, m, d).getDay() + 6) % 7 + 1; if (w === dow) n++; } return n; };

  // ---------- 원 미만 처리 ----------
  let RM = 'round';
  try { RM = localStorage.getItem('dt-round') || 'round'; } catch (e) {}
  const R = n => RM === 'floor' ? Math.floor(n + 1e-9) : RM === 'ceil' ? Math.ceil(n - 1e-9) : Math.round(n);
  const won = n => (n == null || !isFinite(n)) ? '-' : R(n).toLocaleString('ko-KR');
  const num = s => { const v = String(s ?? '').replace(/[^\d.\-]/g, ''); return v === '' ? null : +v; };
  const pctOf = (a, b) => (a == null || !b || !isFinite(a)) ? null : a / b - 1;
  const fp = x => x == null ? '-' : (x >= 0 ? '▲ ' : '▼ ') + Math.abs(x * 100).toFixed(1) + '%';
  const cl = x => x == null ? '' : x >= 0 ? 'dt-up' : 'dt-dn';
  const pctHtml = x => `<span class="${cl(x)}">${fp(x)}</span>`;

  const DT = { store: 'sv', tab: 'goal', T: '', data: {}, dv: null, inp: {}, base: '', cmp: '', edit: false, view: 'daily', curPpl: {} };

  // ---------- 데이터 ----------
  const rpc = async (fn, args) => { const { data, error } = await window.SB.rpc(fn, args); if (error) throw error; return data; };
  async function loadSales(){
    if (typeof SALES !== 'undefined' && SALES.rows && SALES.rows.length) return;
    const d = await rpc('sales_data');
    if (typeof META !== 'undefined') Object.assign(META, d.meta || {});
    SALES = d.sales || { stores: [], rows: [] };
  }
  async function load(force){
    const st = STORES.find(s => s[0] === DT.store), sid = st[3];
    const jobs = [loadSales()];
    if (force || !DT.data[sid]) jobs.push(rpc('target_data', { p_store: sid }).then(x => { DT.data[sid] = x; }));
    if (sid === DV_STORE && (force || !DT.dv)) jobs.push(rpc('delivery_data', { p_store: DV_STORE, p_from: '2023-01-01', p_to: kst() }).then(x => { DT.dv = x || { days: [] }; }));
    await Promise.all(jobs);
  }

  // 월별 실적 표 만들기 → { 'YYYY-MM': {days, total, src, autoDays, fixDays, last, note} }
  function months(){
    const st = STORES.find(s => s[0] === DT.store), sid = st[3], td = DT.data[sid] || {};
    const idx = (SALES.stores || []).findIndex(n => st[2].test(n));
    const day = {};   // 날짜별 [포스, 배달순]
    if (idx >= 0) SALES.rows.forEach(r => { if (r[1] !== idx) return; (day[r[0]] || (day[r[0]] = [0, 0]))[0] += r[5] || 0; });
    if (sid === DV_STORE && DT.dv) (DT.dv.days || []).forEach(x => { const o = day[x.d] || (day[x.d] = [0, 0]); o[1] += (x.sales || 0) + (x.pick || 0) - (x.usedCall || 0) - (x.usedOther || 0); });
    const M = {};
    Object.keys(day).forEach(d => {
      const ym = d.slice(0, 7), o = M[ym] || (M[ym] = { autoTotal: 0, autoDays: 0, last: '' });
      o.autoTotal += day[d][0] + day[d][1];
      if (day[d][0] >= DAY_MIN) o.autoDays++;
      if (d > o.last) o.last = d;
    });
    const man = {}; (td.months || []).forEach(m => { man[m.ym] = m; });
    const out = {};
    new Set([...Object.keys(M), ...Object.keys(man)]).forEach(ym => {
      const a = M[ym], m = man[ym];
      if (m && m.total != null) out[ym] = { days: m.days, total: +m.total, src: 'manual', note: m.note || '' };
      else if (a) out[ym] = { days: m && m.days != null ? m.days : a.autoDays, total: a.autoTotal, src: 'auto', autoDays: a.autoDays, fixDays: m && m.days != null, last: a.last };
    });
    Object.values(out).forEach(o => { o.daily = o.days ? o.total / o.days : null; });
    return out;
  }
  const shiftAvg = ym => { const sid = STORES.find(s => s[0] === DT.store)[3]; const x = ((DT.data[sid] || {}).shift || []).find(s => s.ym === ym); return x && x.avg != null ? { avg: +x.avg, days: x.days } : null; };
  const targets = () => { const sid = STORES.find(s => s[0] === DT.store)[3]; return (DT.data[sid] || {}).targets || []; };

  // ---------- 목표 계산 ----------
  function defaults(T){
    const ts = targets(), mine = ts.find(t => t.ym === T), last = ts.filter(t => t.ym < T).pop();
    const p = (mine || last || {}).params || {};
    const base = { method: (mine || {}).method || (last || {}).method || 'ppl', per: 400000, ppl: 5, off: 0, extra: 0, gBase: 'ly', gPick: ymAdd(T, -12), rate: 5, mMode: 'daily', mVal: null };
    const o = Object.assign(base, p);
    if (!mine) { o.gPick = ymAdd(T, -12); if (o.mMode === 'total') o.mVal = null; }
    return o;
  }
  function calc(T, inp, M){
    const B = ymAdd(T, -1), days = Math.max(0, dim(T) - dowCount(T, +inp.off) - (+inp.extra || 0));
    const bs = baseStats(B, M, inp);
    let daily = null, total = null, formula = '';
    if (inp.method === 'ppl') { daily = (+inp.per || 0) * (+inp.ppl || 0); formula = `${won(inp.per)}원 × ${inp.ppl}명 × ${days}일`; }
    else if (inp.method === 'growth') {
      const bd = inp.gBase === 'cur' ? bs.daily : inp.gBase === 'pick' ? (M[inp.gPick] || {}).daily : (M[ymAdd(T, -12)] || {}).daily;
      const bl = inp.gBase === 'cur' ? `${mLab(B)} 일평균` : inp.gBase === 'pick' ? `${ymLab(inp.gPick)} 일평균` : `전년 ${mLab(T)} 일평균`;
      if (bd != null) { daily = bd * (1 + (+inp.rate || 0) / 100); formula = `${bl} ${won(bd)}원 × ${(1 + (+inp.rate || 0) / 100).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')} × ${days}일`; }
      else formula = `${bl} 자료가 없어요`;
    } else {
      if (inp.mVal != null) {
        if (inp.mMode === 'total') { total = +inp.mVal; daily = days ? total / days : null; formula = '월 목표 직접 입력'; }
        else { daily = +inp.mVal; formula = `일평균 ${won(daily)}원 × ${days}일`; }
      } else formula = '금액을 입력해 주세요';
    }
    if (total == null && daily != null) total = daily * days;
    return { B, days, daily, total, formula, bs };
  }
  // 기준월(당월) 실적 — 진행 중이면 예상 월매출 = 일평균 × 예상 영업일수
  function baseStats(B, M, inp){
    const m = M[B] || null, sh = shiftAvg(B);
    const ppl = DT.curPpl[B] != null ? DT.curPpl[B] : sh ? sh.avg : null;
    const o = { ym: B, days: m ? m.days : 0, total: m ? m.total : null, daily: m ? m.daily : null, src: m ? m.src : '', ppl, pplSrc: DT.curPpl[B] != null ? 'manual' : sh ? 'shift' : '', partial: false, expDays: m ? m.days : 0 };
    if (m && m.src === 'auto' && m.last && m.last < `${B}-${pad(dim(B))}`) {
      o.partial = true; o.last = m.last;
      let rem = 0; const y = +B.slice(0, 4), mo = +B.slice(5, 7) - 1;
      for (let d = +m.last.slice(8, 10) + 1; d <= dim(B); d++) { const w = (new Date(y, mo, d).getDay() + 6) % 7 + 1; if (w !== +((inp || {}).off || 0)) rem++; }
      o.expDays = m.days + rem;
    }
    o.exp = o.daily != null ? o.daily * o.expDays : null;
    return o;
  }

  // ---------- 화면 ----------
  const seg = (opts, cur, fn, cls = '') => `<div class="seg ${cls}" role="group">${opts.map(([k, t]) => `<button class="${k === cur ? 'on' : ''}" aria-pressed="${k === cur}" onclick="${fn}('${k}')">${t}</button>`).join('')}</div>`;
  function page(){
    const main = document.getElementById('main');
    main.innerHTML = simpleHero(['직영점 관리', '목표매출'], 'TARGET', '목표매출',
      '지난달 실적은 매출 자료에서 자동으로 채워져요. 산정 방식만 고르면 다음 달 목표가 계산돼요.') +
      `<div id="dt-bar"></div><div id="dt-body"><div class="card"><div class="empty">불러오는 중...</div></div></div>` + pageFoot();
    bar();
    const my = (DT.seq = (DT.seq || 0) + 1);
    load().then(() => { if (my === DT.seq && document.getElementById('dt-body')) body(); })
      .catch(e => { if (document.getElementById('dt-body')) document.getElementById('dt-body').innerHTML = `<div class="card"><div class="empty">불러오지 못했어요. ${esc((e && e.message) || '')}</div></div>`; });
  }
  function bar(){
    const b = document.getElementById('dt-bar'); if (!b) return;
    b.className = 'dt-bar';
    b.innerHTML = seg(STORES.map(s => [s[0], s[1]]), DT.store, 'dtStore', 'dt-s1') + seg([['goal', '목표 설정'], ['hist', '월별 실적 · 신장률']], DT.tab, 'dtTab', 'dt-s2') +
      (DT.tab === 'goal' ? `<div class="dt-month"><button onclick="dtMonth(-1)" aria-label="이전 달">‹</button><span>${ymLab(DT.T)} 목표 <i>(${mLab(ymAdd(DT.T, -1))} 실적 기준)</i></span><button onclick="dtMonth(1)" aria-label="다음 달">›</button></div>` : '') +
      `<div class="dt-rnd"><span>원 미만</span>${seg([['floor', '버림'], ['round', '반올림'], ['ceil', '올림']], RM, 'dtRound')}</div>`;
  }
  function body(){
    const el = document.getElementById('dt-body'); if (!el) return;
    const M = months();
    if (!Object.keys(M).length) { el.innerHTML = `<div class="card"><div class="empty">${STORES.find(s => s[0] === DT.store)[1]} 매출 자료가 아직 없어요. 매출이 들어오면 자동으로 채워져요.</div></div>`; return; }
    el.innerHTML = DT.tab === 'goal' ? goalHtml(M) : histHtml(M);
  }

  function goalHtml(M){
    const T = DT.T, key = DT.store + T;
    const inp = DT.inp[key] || (DT.inp[key] = defaults(T));
    const c = calc(T, inp, M), bs = c.bs, B = c.B, ly = M[ymAdd(B, -12)], lyT = M[ymAdd(T, -12)];
    const saved = targets().find(t => t.ym === T);
    const td = (DT.data[STORES.find(s => s[0] === DT.store)[3]] || {});
    const can = !!td.can_edit;
    const fmtv = (k, v) => v == null ? '' : (k === 'per' || k === 'mVal') ? Number(v).toLocaleString('ko-KR') : String(v);
    const fld = (k, v, unit, ph = '') => `<div class="dt-in"><input inputmode="decimal" value="${esc(fmtv(k, v))}" placeholder="${ph}" oninput="dtInp('${k}',this.value)" onchange="dtInp('${k}',this.value,1)"><i>${unit}</i></div>`;
    const offSel = `<div class="dt-in"><select onchange="dtInp('off',this.value,1)">${[[0, '무휴'], ...WD.map((w, i) => [i + 1, w + '요일'])].map(([v, t]) => `<option value="${v}" ${+inp.off === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
    const yms = Object.keys(M).filter(k => M[k].daily != null).sort().reverse();
    let rows = '';
    if (inp.method === 'ppl') rows = `<label>1인당 기준매출</label>${fld('per', inp.per, '원')}<label>고정 인원</label>${fld('ppl', inp.ppl, '명')}`;
    else if (inp.method === 'growth') rows = `<label>기준 일평균</label>${seg([['ly', `전년 ${mLab(T)}`], ['cur', `당월 ${mLab(B)}`], ['pick', '직접 고르기']], inp.gBase, 'dtGBase')}
        ${inp.gBase === 'pick' ? `<label>기준 월</label><div class="dt-in"><select onchange="dtInp('gPick',this.value,1)">${yms.map(k => `<option value="${k}" ${k === inp.gPick ? 'selected' : ''}>${ymLab(k)} · ${won(M[k].daily)}원</option>`).join('')}</select></div>` : ''}
        <label>목표 신장률</label>${fld('rate', inp.rate, '%', '예: 5 또는 -3')}<label>고정 인원</label>${fld('ppl', inp.ppl, '명')}`;
    else rows = `<label>입력 기준</label>${seg([['daily', '일평균'], ['total', '월 목표']], inp.mMode, 'dtMMode')}<label>${inp.mMode === 'total' ? '월 목표 매출' : '목표 일평균'}</label>${fld('mVal', inp.mVal, '원')}<label>고정 인원</label>${fld('ppl', inp.ppl, '명')}`;
    const per1 = c.daily != null && +inp.ppl ? c.daily / +inp.ppl : null;
    const bPer = bs.daily != null && bs.ppl ? bs.daily / bs.ppl : null;
    const lyD = lyT ? lyT.daily : null;
    const conv = [];
    if (c.daily != null) {
      if (lyD != null) conv.push(`전년 ${mLab(T)} 일평균(${won(lyD)}원) 대비 ${pctHtml(pctOf(c.daily, lyD))}`);
      if (bs.daily != null) conv.push(`당월 ${mLab(B)} 일평균(${won(bs.daily)}원) 대비 ${pctHtml(pctOf(c.daily, bs.daily))}`);
      if (per1 != null && inp.method !== 'ppl') conv.push(`인원 ${inp.ppl}명 기준 1인당 ${won(per1)}원`);
    }
    const baseTag = bs.src === 'manual' ? '대표님 기입' : bs.src === 'auto' ? '자동 · 포스+배달+배민포장−마일리지' : '자료 없음';
    const pplTile = `<div class="kp"><div class="l">1인당 기여매출</div><div class="v">${won(bPer)}<small>원</small></div>
        <div class="s dt-ppl">평균 인원 <input inputmode="decimal" value="${bs.ppl != null ? bs.ppl : ''}" placeholder="입력" onchange="dtCurPpl('${B}',this.value)">명 · ${bs.pplSrc === 'shift' ? '시프트 관리 기준' : bs.pplSrc === 'manual' ? '직접 입력' : '시프트 기록 없음'}</div></div>`;
    return `<div class="card"><div class="dt-ct"><h3>당월 분석 · ${ymLab(B)}${bs.partial ? ` <small>진행 중 · ${+bs.last.slice(5, 7)}/${+bs.last.slice(8, 10)}까지</small>` : ''}</h3><span class="dt-tag ${bs.src === 'auto' ? 'auto' : ''}">${baseTag}</span></div>
      <div class="dt-grid">
        <div class="kp"><div class="l">영업일수</div><div class="v">${bs.days}<small>일${bs.partial ? ` / 예상 ${bs.expDays}일` : ''}</small></div><div class="s">${ly ? `전년 ${mLab(B)} ${ly.days}일` : '전년 자료 없음'}</div></div>
        <div class="kp"><div class="l">일평균매출</div><div class="v">${won(bs.daily)}<small>원</small></div><div class="s">전년 동월 대비 ${pctHtml(pctOf(bs.daily, ly && ly.daily))}</div></div>
        <div class="kp"><div class="l">${bs.partial ? '예상 월매출' : '월매출'}</div><div class="v">${won(bs.exp)}<small>원</small></div><div class="s">${bs.partial ? `지금까지 ${won(bs.total)}원 · ` : ''}전년 동월 대비 ${pctHtml(pctOf(bs.exp, ly && ly.total))}</div></div>
        ${pplTile}
      </div></div>
    <div class="card"><div class="dt-ct"><h3>익월 목표 · ${ymLab(T)}</h3><span class="dt-tag">${saved ? `확정됨 · ${esc(saved.by || '')} ${esc(saved.at || '')}` : '노란 칸만 입력'}</span></div>
      <div class="dt-two"><div>
        <div class="dt-fm"><label>산정 방식</label>${seg([['ppl', '인원 기준'], ['growth', '신장률 기준'], ['manual', '직접 입력']], inp.method, 'dtMethod')}
          ${rows}
          <label>휴무요일</label>${offSel}
          <label>추가 휴무</label>${fld('extra', inp.extra, '일', '명절 등')}
          <label>영업일수</label><div class="dt-ro">${c.days}일 <i>${mLab(T)} ${dim(T)}일 − 휴무 ${dim(T) - c.days}일 (자동)</i></div></div>
        ${conv.length ? `<div class="dt-cmp"><b>같은 목표를 다른 기준으로 보면</b><br>${conv.map(x => '· ' + x).join('<br>')}</div>` : ''}
      </div>
      <div class="dt-res"><div class="l">${mLab(T)} 목표 월매출</div><div class="big">${c.total != null ? won(c.total) + '원' : '-'}</div><div class="l" style="margin-bottom:10px">${esc(c.formula)}</div>
        <div class="row"><span>목표 일평균매출</span><b>${won(c.daily)}원</b></div>
        <div class="row"><span>전년 ${mLab(T)} 실적</span><b>${lyT ? `${won(lyT.total)}원 ${pctHtml(pctOf(c.total, lyT.total))}` : '자료 없음'}</b></div>
        <div class="row"><span>당월 ${mLab(B)} ${bs.partial ? '예상' : '실적'}</span><b>${bs.exp != null ? `${won(bs.exp)}원 ${pctHtml(pctOf(c.total, bs.exp))}` : '-'}</b></div>
        ${saved ? `<div class="row"><span>확정된 목표</span><b>${won(+saved.total)}원</b></div>` : ''}
        ${can ? `<button class="btn dt-save" ${c.total == null ? 'disabled' : ''} onclick="dtSave(this)">${saved ? `${mLab(T)} 목표 다시 확정` : `${mLab(T)} 목표 확정`}</button>` : ''}
      </div></div></div>
    <div class="card"><div class="dt-ct"><h3>Summary · 당월 ${bs.partial ? '예상' : '실적'} vs 익월 목표</h3></div>
      <div class="tbl-wrap"><table class="dt-t"><thead><tr><th>항목</th><th>당월 (${mLab(B)} ${bs.partial ? '예상' : '실적'})</th><th>익월 (${mLab(T)} 목표)</th><th>차이</th></tr></thead><tbody>
      <tr><td>영업일수</td><td>${bs.expDays}일</td><td>${c.days}일</td><td>${c.days - bs.expDays > 0 ? '+' : ''}${c.days - bs.expDays}일</td></tr>
      <tr><td>1인당 기여매출</td><td>${won(bPer)}원</td><td>${won(per1)}원</td><td>${pctHtml(pctOf(per1, bPer))}</td></tr>
      <tr class="hl"><td>일평균매출</td><td>${won(bs.daily)}원</td><td>${won(c.daily)}원</td><td>${pctHtml(pctOf(c.daily, bs.daily))}</td></tr>
      <tr class="hl"><td>월매출</td><td>${won(bs.exp)}원</td><td>${won(c.total)}원</td><td>${pctHtml(pctOf(c.total, bs.exp))}</td></tr>
      </tbody></table></div></div>`;
  }

  function histHtml(M){
    const yms = Object.keys(M).sort(), cur = kst().slice(0, 7);
    const valid = yms.filter(k => M[k].daily != null);
    if (!DT.base || !M[DT.base] || M[DT.base].daily == null) { const done = valid.filter(k => k < cur); DT.base = done[done.length - 1] || valid[valid.length - 1]; }
    if (DT.cmp && (!M[DT.cmp] || M[DT.cmp].daily == null)) DT.cmp = '';
    const b = DT.base, Bm = M[b], ly = ymAdd(b, -12), pm = ymAdd(b, -1);
    const ys = k => `${k.slice(2, 4)}.${k.slice(5, 7)}`;
    const opt = (sel, first) => (first ? `<option value="">${first}</option>` : '') + valid.slice().reverse().map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${ymLab(k)}</option>`).join('');
    const tile = (title, k, extra = '') => {
      const o = M[k];
      if (!o || o.daily == null) return `<div class="dt-cp na"><div class="h"><b>${title}</b><span>${ymLab(k)}</span>${extra}</div><div class="none">비교할 자료가 없어요</div></div>`;
      const g = pctOf(Bm.daily, o.daily), gt = pctOf(Bm.total, o.total), dd = Bm.days - o.days;
      return `<div class="dt-cp ${g >= 0 ? 'up' : 'dn'}"><div class="h"><b>${title}</b><span>${ymLab(k)}</span>${extra}</div>
        <div class="big">${fp(g)}</div><div class="cap">일평균매출이 ${Math.abs(g * 100).toFixed(1)}% ${g >= 0 ? '신장' : '하락'}했어요</div>
        <table><thead><tr><th></th><th>${ys(k)}</th><th>${ys(b)}</th><th>차이</th></tr></thead><tbody>
        <tr><td>일평균</td><td>${won(o.daily)}</td><td>${won(Bm.daily)}</td><td>${pctHtml(g)}</td></tr>
        <tr><td>월매출</td><td>${won(o.total)}</td><td>${won(Bm.total)}</td><td>${pctHtml(gt)}</td></tr>
        <tr><td>영업일수</td><td>${o.days}일</td><td>${Bm.days}일</td><td>${dd > 0 ? '+' : ''}${dd}일</td></tr></tbody></table></div>`;
    };
    const pick = DT.cmp ? tile('직접 고른 달', DT.cmp, `<button class="x" onclick="dtCmp('')" aria-label="지우기">×</button>`)
      : `<div class="dt-cp pickbox"><div class="h"><b>다른 달과 비교</b></div><div class="none"><select onchange="dtCmp(this.value)">${opt('', '달 고르기')}</select><small>필요할 때만 골라요</small></div></div>`;
    const cmpHtml = `<div class="card"><div class="dt-ct"><h3>신장률 비교</h3>
        <div class="dt-month"><button onclick="dtBaseMove(-1)" aria-label="이전 달">‹</button><span>기준 월 <select onchange="dtBase(this.value)">${opt(b)}</select></span><button onclick="dtBaseMove(1)" aria-label="다음 달">›</button></div></div>
      <div class="dt-basebar"><b>${ymLab(b)}</b>${Bm.src === 'auto' && b === cur ? '<em>진행 중</em>' : ''}<span>일평균 <b>${won(Bm.daily)}원</b></span><span>월매출 <b>${won(Bm.total)}원</b></span><span>영업일수 <b>${Bm.days}일</b></span></div>
      <div class="dt-cps">${tile('작년 동월', ly)}${tile('전월', pm)}${pick}</div></div>`;
    const y0 = +yms[0].slice(0, 4), y1 = Math.max(+yms[yms.length - 1].slice(0, 4), +cur.slice(0, 4));
    const can = !!(DT.data[STORES.find(s => s[0] === DT.store)[3]] || {}).can_edit;
    const v = DT.view;
    let trs = '';
    for (let y = y0; y <= y1; y++) {
      let s = 0, n = 0, cells = '';
      for (let m = 1; m <= 12; m++) {
        const k = `${y}-${pad(m)}`, o = M[k];
        let cls = [], txt = '–';
        if (o) {
          if (o.src === 'auto') cls.push('auto');
          if (!o.days && o.src === 'manual') { txt = esc(o.note || '휴업'); cls.push('na'); }
          else {
            txt = v === 'days' ? `${o.days}${o.fixDays ? '<sup title="고친 값">✎</sup>' : ''}` : won(v === 'total' ? o.total : o.daily);
            if (o.days) { s += o.total; n += o.days; }
          }
          if (o.src === 'auto' && k === cur) txt += '<small>진행 중</small>';
          if (k === b) cls.push('sel'); else if (k === ly || k === pm || k === DT.cmp) cls.push('ref');
        } else cls.push('na');
        cells += `<td class="${cls.join(' ')}" onclick="dtCell('${k}')">${txt}</td>`;
      }
      const yt = v === 'days' ? n : v === 'total' ? s : (n ? s / n : null);
      trs += `<tr><td><b>${y}</b></td>${cells}<td class="tot"><b>${v === 'days' ? yt : won(yt)}</b></td></tr>`;
    }
    const hint = DT.edit ? (v === 'days' ? '칸을 누르면 영업일수를 고쳐요 (자동 집계 달은 비우면 자동으로 돌아가요)' : v === 'total' ? '대표님 기입 달은 월매출을 고칠 수 있어요 (자동 집계 달은 매출 자료에서 계산)' : '고치려면 월매출 · 영업일수 보기로 바꿔 주세요')
      : '칸을 누르면 그 달이 기준 월이 돼요 · 빨간 칸 = 기준 월, 점선 칸 = 비교하는 달';
    return cmpHtml + `
    <div class="card"><div class="dt-ct"><h3>월별 실적 · ${v === 'days' ? '영업일수' : v === 'total' ? '월매출' : '일평균매출'}</h3>
      <div class="dt-ctr">${can ? `<button class="dmb sm ${DT.edit ? 'pri' : ''}" onclick="dtEdit()">${DT.edit ? '고치기 끝' : '고치기'}</button>` : ''}${seg([['daily', '일평균'], ['total', '월매출'], ['days', '영업일수']], v, 'dtView')}</div></div>
      <div class="tbl-wrap"><table class="dt-t dt-mt ${DT.edit ? 'editing' : ''}"><thead><tr><th>연도</th>${[...Array(12)].map((_, i) => `<th>${i + 1}월</th>`).join('')}<th>${v === 'daily' ? '연 평균' : '연 합계'}</th></tr></thead><tbody>${trs}</tbody></table></div>
      <div class="dt-lg"><span>대표님 기입 (고정)</span><span class="a">자동 집계</span><span>${v === 'days' ? '단위: 일 · 자동 = 포스 매출 10만 원 이상인 날' : '단위: 원 · 일평균 = 월매출 ÷ 영업일수'}</span></div>
      <div class="dt-hint">${hint}</div></div>`;
  }

  // ---------- 동작 ----------
  const redraw = () => { bar(); body(); };
  window.dtStore = k => { if (k === DT.store) return; DT.store = k; DT.base = ''; DT.cmp = ''; page(); };
  window.dtTab = k => { DT.tab = k; redraw(); };
  window.dtMonth = k => { DT.T = ymAdd(DT.T, k); redraw(); };
  window.dtRound = k => { RM = k; try { localStorage.setItem('dt-round', k); } catch (e) {} redraw(); };
  const I = () => DT.inp[DT.store + DT.T];
  window.dtMethod = k => { I().method = k; body(); };
  window.dtGBase = k => { I().gBase = k; body(); };
  window.dtMMode = k => { I().mMode = k; I().mVal = null; body(); };
  window.dtInp = (k, val, commit) => {
    const o = I(); if (!o) return;
    o[k] = (k === 'gPick') ? val : (k === 'off') ? +val : num(val);
    if (commit || k === 'off' || k === 'gPick') { const a = document.activeElement, sel = a && a.tagName === 'INPUT' ? a.getAttribute('oninput') : null; body(); if (sel) { const n = document.querySelector(`[oninput="${sel.replace(/"/g, '\\"')}"]`); n && n.focus(); } }
    else clearTimeout(DT.tm), DT.tm = setTimeout(() => { const a = document.activeElement, sel = a && a.getAttribute && a.getAttribute('oninput'), pos = a && a.selectionStart; body(); if (sel) { const n = document.querySelector(`[oninput="${sel.replace(/"/g, '\\"')}"]`); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } } }, 350);
  };
  window.dtCurPpl = (ym, val) => { const v = num(val); if (v == null) delete DT.curPpl[ym]; else DT.curPpl[ym] = v; body(); };
  window.dtSave = async btn => {
    const T = DT.T, inp = I(), c = calc(T, inp, months()), sid = STORES.find(s => s[0] === DT.store)[3];
    if (c.total == null) return toast('목표를 계산할 수 없어요. 입력값을 확인해 주세요.');
    if (targets().find(t => t.ym === T) && !confirm(`${ymLab(T)} 목표를 ${won(c.total)}원으로 다시 확정할까요?`)) return;
    btn.disabled = true;
    try {
      await rpc('target_save', { p_store: sid, p_ym: T, p: { method: inp.method, params: inp, days: c.days, daily: c.daily, total: R(c.total) } });
      await load(true); toast(`${ymLab(T)} 목표를 확정했어요.`); body();
    } catch (e) { btn.disabled = false; toast('확정하지 못했어요: ' + ((e && e.message) || '')); }
  };
  window.dtView = k => { DT.view = k; body(); };
  window.dtEdit = () => { DT.edit = !DT.edit; body(); };
  window.dtBase = k => { if (k) { DT.base = k; body(); } };
  window.dtBaseMove = k => { const M = months(), v = Object.keys(M).filter(x => M[x].daily != null).sort(), i = v.indexOf(DT.base) + k; if (i >= 0 && i < v.length) { DT.base = v[i]; body(); } };
  window.dtCmp = k => { DT.cmp = k || ''; body(); };
  window.dtCell = async k => {
    const M = months(), o = M[k];
    if (!DT.edit) {
      if (!o || o.daily == null) return;
      DT.base = k; body(); return;
    }
    const sid = STORES.find(s => s[0] === DT.store)[3], v = DT.view;
    try {
      if (v === 'days') {
        const cur = o ? o.days : '';
        const msg = o && o.src === 'auto' ? `${ymLab(k)} 영업일수 (자동 ${o.autoDays}일)\n비우면 자동으로 돌아가요.` : `${ymLab(k)} 영업일수`;
        const r = prompt(msg, cur == null ? '' : cur); if (r === null) return;
        const d = num(r);
        if (o && o.src === 'manual') { if (d == null) return toast('대표님 기입 달은 영업일수를 비울 수 없어요.'); await rpc('target_month_set', { p_store: sid, p_ym: k, p_days: d, p_total: o.total, p_note: o.note || null }); }
        else if (o && o.src === 'auto') await rpc('target_month_set', { p_store: sid, p_ym: k, p_days: d, p_total: null, p_note: null });
        else { const t = num(prompt(`${ymLab(k)} 월매출(원)`, '')); if (d == null || t == null) return; await rpc('target_month_set', { p_store: sid, p_ym: k, p_days: d, p_total: t, p_note: null }); }
      } else if (v === 'total') {
        if (o && o.src === 'auto') return toast('자동 집계 달은 매출 자료에서 계산돼요. 영업일수만 고칠 수 있어요.');
        const r = prompt(`${ymLab(k)} 월매출(원)${o ? '' : ' — 대표님 기입값으로 저장돼요'}`, o ? o.total : ''); if (r === null) return;
        const t = num(r);
        if (t == null) { if (o && confirm(`${ymLab(k)} 대표님 기입값을 지울까요?`)) await rpc('target_month_set', { p_store: sid, p_ym: k, p_days: null, p_total: null, p_note: null }); else return; }
        else { const d = o ? o.days : num(prompt(`${ymLab(k)} 영업일수`, '')); if (d == null) return; await rpc('target_month_set', { p_store: sid, p_ym: k, p_days: d, p_total: t, p_note: o ? o.note || null : null }); }
      } else return toast('월매출 또는 영업일수 보기에서 고칠 수 있어요.');
      await load(true); toast('저장했어요.'); body();
    } catch (e) { toast('저장하지 못했어요: ' + ((e && e.message) || '')); }
  };

  // ---------- 스타일 ----------
  const css = document.createElement('style');
  css.textContent = `
  .dt-bar{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:0 0 16px}
  .dt-bar .seg button{font-size:12px;padding:7px 16px}.dt-s1{min-width:170px}.dt-s2{min-width:300px}
  .dt-month{display:flex;align-items:center;gap:4px;border:1px solid #dfe3da;background:#fff;border-radius:8px;padding:3px;font-weight:600;font-size:12.5px;min-height:40px}
  .dt-month button{border:0;background:transparent;width:30px;height:32px;border-radius:6px;font-size:16px;color:#4d5547}.dt-month button:hover{background:#f3f5ef}
  .dt-month i{color:var(--sub);font-style:normal;font-weight:500}
  .dt-rnd{display:flex;align-items:center;gap:8px;margin-left:auto}.dt-rnd>span{font-size:11.5px;color:var(--sub);font-weight:600}.dt-rnd .seg{min-width:200px}.dt-rnd .seg button{padding:7px 10px}
  .dt-ct{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap}
  .dt-ct h3{margin:0;font-size:15px;letter-spacing:-.5px}.dt-ct h3 small{font-size:11px;color:var(--sub);font-weight:500;margin-left:4px}
  .dt-ctr{display:flex;gap:8px;align-items:center}.dt-ctr .seg{min-width:230px}
  .dt-tag{font-size:10.5px;border-radius:5px;padding:3px 8px;background:#eef1e8;color:#5c6553}.dt-tag.auto{background:#e9f3ec;color:#2d7a46}
  .dt-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .dt-grid .kp{border:1px solid var(--line);border-radius:11px;padding:14px 16px;background:#fbfcf9}
  .dt-grid .l{font-size:11px;color:var(--sub)}.dt-grid .v{font-size:21px;font-weight:700;letter-spacing:-.8px;margin:6px 0 4px;font-variant-numeric:tabular-nums}
  .dt-grid .v small{font-size:12px;font-weight:500;color:var(--sub);margin-left:2px}.dt-grid .s{font-size:11px;color:var(--sub)}
  .dt-ppl input{width:46px;border:1px solid #dfe3da;background:#fffbe6;border-radius:5px;padding:2px 5px;font-weight:600;text-align:right;font-size:11px;margin:0 2px}
  .dt-up{color:#c62429;font-weight:600}.dt-dn{color:#2f62c9;font-weight:600}
  .dt-two{display:grid;grid-template-columns:1.05fr 1fr;gap:18px}
  .dt-fm{display:grid;grid-template-columns:120px 1fr;gap:10px 14px;align-items:center}
  .dt-fm>label{font-size:12px;color:#4d5547;font-weight:600}.dt-fm .seg button{font-size:12px}
  .dt-in{display:flex;align-items:center;border:1px solid #dfe3da;border-radius:8px;background:#fffbe6;padding:0 12px}
  .dt-in input,.dt-in select{flex:1;border:0;background:transparent;padding:9px 0;font-weight:600;outline:none;min-width:0}.dt-in i{font-style:normal;color:var(--sub);font-size:12px}
  .dt-in:focus-within{border-color:var(--brand);box-shadow:0 0 0 3px #c6242910}
  .dt-ro{border:1px dashed #dfe3da;border-radius:8px;padding:9px 12px;color:#4d5547;display:flex;justify-content:space-between;gap:8px}.dt-ro i{font-style:normal;color:var(--sub);font-size:11px}
  .dt-cmp{margin-top:12px;border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:12px;line-height:1.9;color:#4d5547}.dt-cmp b{color:var(--ink)}
  .dt-res{background:#1c211e;color:#fff;border-radius:12px;padding:20px 22px;align-self:start}
  .dt-res .l{font-size:11px;color:#a9b3a6}.dt-res .big{font-size:30px;font-weight:800;letter-spacing:-1.2px;margin:6px 0 2px;font-variant-numeric:tabular-nums}
  .dt-res .row{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid #ffffff1a;font-size:12.5px}.dt-res .row b{font-weight:700;text-align:right}
  .dt-res .dt-up{color:#ff8a80}.dt-res .dt-dn{color:#8fb4ff}.dt-save{width:100%;margin-top:14px}
  .dt-t{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}
  .dt-t th{font-size:11px;color:var(--sub);font-weight:600;text-align:right;padding:9px 10px;border-bottom:1px solid var(--line);background:#fafbf7;white-space:nowrap}
  .dt-t th:first-child,.dt-t td:first-child{text-align:left}.dt-t td{padding:10px;border-bottom:1px solid #f0f1ec;text-align:right;white-space:nowrap}
  .dt-t tr.hl td{background:#fff8f7}
  .dt-mt th,.dt-mt td{padding:9px 5px;font-size:11px;letter-spacing:-.4px}
  .dt-mt td{cursor:pointer}.dt-mt td:first-child,.dt-mt td.tot{cursor:default}
  .dt-mt td.auto{background:#f3f9f4}.dt-mt td.na{color:#b4bba8}.dt-mt td small{display:block;font-size:9.5px;color:#8f9687}
  .dt-mt td.sel{outline:2px solid var(--brand);outline-offset:-2px;font-weight:700}
  .dt-mt td sup{color:#c08a00;font-size:9px;margin-left:1px}
  .dt-mt.editing td:not(:first-child):not(.tot):hover{background:#fffbe6}
  .dt-lg{display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:var(--sub);margin-top:10px}
  .dt-lg span:before{content:'';display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px;background:#fff;border:1px solid #dfe3da}
  .dt-lg .a:before{background:#f3f9f4;border-color:#cfe6d5}.dt-lg span:last-child:before{display:none}
  .dt-hint{font-size:11px;color:var(--sub);margin-top:6px}
  .dt-month select{border:0;background:transparent;font-weight:700;font-size:12.5px;outline:none;margin-left:4px}
  .dt-basebar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 18px;background:#f6f7f2;border-radius:9px;padding:11px 16px;margin-bottom:14px;font-size:12px;color:var(--sub)}
  .dt-basebar>b{font-size:14px;color:var(--ink)}.dt-basebar span b{color:var(--ink);margin-left:3px;font-variant-numeric:tabular-nums}.dt-basebar em{font-style:normal;font-size:10.5px;background:#fff3cd;color:#8a6d00;border-radius:4px;padding:1px 6px}
  .dt-cps{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .dt-cp{border:1px solid var(--line);border-radius:11px;padding:14px 16px;background:#fff}
  .dt-cp.up{background:#fffafa;border-color:#f3d6d6}.dt-cp.dn{background:#f8faff;border-color:#d7e1f4}
  .dt-cp .h{display:flex;align-items:center;gap:8px;font-size:12px}.dt-cp .h span{color:var(--sub);font-size:11.5px}
  .dt-cp .h .x{margin-left:auto;border:0;background:transparent;font-size:16px;color:var(--sub);cursor:pointer;line-height:1}
  .dt-cp .big{font-size:24px;font-weight:800;letter-spacing:-.8px;margin:8px 0 0}.dt-cp.up .big{color:#c62429}.dt-cp.dn .big{color:#2f62c9}
  .dt-cp .cap{font-size:11.5px;color:#4d5547;margin:2px 0 10px}
  .dt-cp table{width:100%;border-collapse:collapse;font-size:11.5px;font-variant-numeric:tabular-nums}
  .dt-cp th{font-weight:600;color:var(--sub);text-align:right;padding:4px 0;font-size:10.5px}.dt-cp td{text-align:right;padding:5px 0;border-top:1px solid #f0f1ec}
  .dt-cp th:first-child,.dt-cp td:first-child{text-align:left;color:var(--sub)}
  .dt-cp .none{color:var(--sub);font-size:12px;padding:22px 0 10px;text-align:center}
  .dt-cp.pickbox{border-style:dashed;background:#fbfcf9}.dt-cp.pickbox select{border:1px solid #dfe3da;border-radius:8px;padding:8px 12px;background:#fff;font-weight:600;min-width:150px}.dt-cp.pickbox small{display:block;margin-top:8px;font-size:11px}
  .dt-mt td.ref{outline:1.5px dashed #9aa58f;outline-offset:-3px}
  .dt-quick{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:11.5px;color:var(--sub);margin-top:12px}.dt-quick span{margin-left:8px}
  @media(max-width:1100px){.dt-cps{grid-template-columns:1fr}.dt-grid{grid-template-columns:repeat(2,1fr)}.dt-two{grid-template-columns:1fr}.dt-rnd{margin-left:0}}
  @media(max-width:600px){.dt-grid{grid-template-columns:1fr}.dt-fm{grid-template-columns:1fr}.dt-s2,.dt-s1,.dt-month{min-width:0;flex:1 1 100%}.dt-month{justify-content:space-between}}
  `;
  document.head.appendChild(css);

  // ---------- 메뉴 (직영점 관리 아래) · 화면 연결 ----------
  function addMenu(active){
    if (!allowed()) return;
    const sub = document.querySelector('#side .nav-items > .sub.js-dm'); if (!sub || sub.querySelector('[data-dt]')) return;
    sub.insertAdjacentHTML('beforeend', `<a role="button" tabindex="0" data-dt="1" class="${active === PAGE ? 'on' : ''}" onclick="go('${PAGE}')">목표매출</a>`);
    if (active === PAGE) { sub.classList.add('open'); sub.previousElementSibling && sub.previousElementSibling.classList.add('open'); }
  }
  const renderSideDt = renderSide;
  renderSide = function(active){
    const r = renderSideDt.apply(this, arguments);
    try { addMenu(active); } catch (e) { console.warn('목표매출 메뉴 실패', e); }
    return r;
  };
  try { addMenu(window.__curPage); } catch (e) {}

  const goDt = go;
  go = function(p, t){
    if (p === PAGE) {
      if (!allowed()) { toast('이 메뉴는 본사·관리자만 볼 수 있어요.'); return goDt('dash'); }
      if (!DT.T) DT.T = ymAdd(kst().slice(0, 7), 1);
      document.getElementById('mm-fly') && (document.getElementById('mm-fly').hidden = true);
      closeSide(); renderSide(p); window.__curPage = p; window.scrollTo(0, 0); page(); return;
    }
    return goDt(p, t);
  };
})();
