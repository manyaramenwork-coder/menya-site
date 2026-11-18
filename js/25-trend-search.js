
// v5.0: 트렌드 분석 — 검색 트렌드(네이버 데이터랩, Edge Function naver-trend) · 상권 · 원가(준비 중)
// 디자인 분업 규칙: id 와 js- 로 시작하는 class 는 기능용(건드리지 말 것), tr- 로 시작하는 class 는 꾸밈용
PATHS.trend = 'M3 17l6-6 4 4 8-8 M14 7h7v7';
(function(){
  const PRESET = ['라멘', '돈코츠라멘', '마제소바', '메밀소바', '츠케멘', '우동', '멘야마쯔리'];
  const DEFAULT = ['라멘', '마제소바', '츠케멘', '우동', '멘야마쯔리'];
  const COLORS = ['#c62429', '#2f6f4e', '#d08a1e', '#3b5ba5', '#8a4fa0'];
  const AGES = [['10대 이하', ['1', '2']], ['20대', ['3', '4']], ['30대', ['5', '6']], ['40대', ['7', '8']], ['50대', ['9', '10']], ['60대 이상', ['11']]];
  const DAY = 86400000;
  const TR = { kw: DEFAULT.slice(), chart: null, last: null };
  const h = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ymd = d => { const k = new Date(d.getTime() + 9 * 3600000); return k.toISOString().slice(0, 10); };
  const t0 = s => new Date(s + 'T00:00:00+09:00').getTime();

  /* ---------- 스타일 (꾸밈용, ChatGPT가 다듬을 부분) ---------- */
  const st = document.createElement('style');
  st.textContent = `
  .tr-tabs{display:flex;gap:6px;margin:0 0 14px;overflow-x:auto}
  .tr-tabs button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 16px;color:#5d6656;white-space:nowrap}
  .tr-tabs button.on{background:var(--side);border-color:var(--side);color:#fff}
  .tr-tabs button small{margin-left:6px;font-size:10px;opacity:.7}
  .tr-kwbox{display:flex;flex-wrap:wrap;gap:6px;align-items:center;border:1px solid var(--line);border-radius:9px;padding:6px 8px;background:#fff;min-height:42px}
  .tr-kwbox input{border:0;outline:0;flex:1;min-width:120px;padding:6px 4px;background:transparent}
  .tr-kw{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 6px 5px 11px;color:#fff;font-size:12px}
  .tr-kw button{border:0;background:rgba(255,255,255,.25);color:#fff;border-radius:50%;width:18px;height:18px;line-height:16px;padding:0;font-size:12px}
  .tr-preset{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .tr-preset button{border:1px dashed #cfd5c6;background:#fafbf7;border-radius:999px;padding:5px 11px;font-size:12px;color:#5d6656}
  .tr-preset button.on{border-style:solid;border-color:#9aa68c;background:#eef1e8;color:#2d3726}
  .tr-hint{font-size:11px;color:var(--sub);margin-top:6px}
  .tr-more{margin-top:12px;border-top:1px dashed var(--line);padding-top:10px}
  .tr-more summary{cursor:pointer;color:#5d6656;font-size:12px}
  .tr-more .tr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:10px}
  .tr-ages{display:flex;flex-wrap:wrap;gap:6px}
  .tr-ages label{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line);border-radius:999px;padding:5px 10px;font-size:12px;background:#fff}
  .tr-sum{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}
  .tr-sum .k .v{font-size:20px}
  .tr-sum .k .d{font-size:11px;margin-top:4px;color:var(--sub)}
  .tr-up{color:#c62429}.tr-down{color:#3b5ba5}
  .tr-chart{position:relative;height:320px;width:100%}
  .tr-chart canvas{touch-action:pan-y}
  .tr-note{font-size:11px;color:var(--sub);margin-top:10px;line-height:1.7}
  .tr-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:middle}
  .tr-slot{border:1px dashed #d6dccd;border-radius:10px;padding:26px 16px;text-align:center;color:#909b84;font-size:12px;line-height:1.8;margin-bottom:12px}
  .tr-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
  .tr-loading{padding:50px 20px;text-align:center;color:var(--sub)}
  @media(max-width:760px){.tr-sum{grid-template-columns:1fr}.tr-chart{height:260px}}
  `;
  document.head.appendChild(st);

  /* ---------- Chart.js: 트렌드 화면을 열 때만 불러옴 ---------- */
  let chartLoading = null;
  function loadChart(){
    if (window.Chart) return Promise.resolve();
    if (chartLoading) return chartLoading;
    chartLoading = new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js';
      s.onload = ok; s.onerror = () => { chartLoading = null; no(new Error('그래프 도구를 불러오지 못했어요.')); };
      document.head.appendChild(s);
    });
    return chartLoading;
  }

  /* ---------- 메뉴: 분석 시스템 (트렌드 분석 · 상권 분석 · 식자재 분석) ---------- */
  const AN_ITEMS = [['trend', '트렌드 분석'], ['area', '상권 분석'], ['cost', '식자재 분석']];
  const AN_TAB = { trend: 'search', area: 'area', cost: 'cost' };
  const renderSideTr = renderSide;
  renderSide = function(active){
    renderSideTr(active);
    if (AN_TAB[active]) window.__curPage = active;
    const nav = document.querySelector('#side .nav-items'); if (!nav) return;
    nav.querySelectorAll('.js-tr-menu').forEach(e => e.remove());
    const open = !!AN_TAB[active];
    const html = `<button class="cat js-tr-menu ${open ? 'open' : ''}" onclick="const on=this.classList.toggle('open');this.nextElementSibling.classList.toggle('open',on)">${ic('trend')}분석 시스템${ic('chevron').replace('class="icon"', 'class="icon ar"')}</button><div class="sub js-tr-menu ${open ? 'open' : ''}">${AN_ITEMS.map(([k, t]) => `<a role="button" tabindex="0" class="${k === active ? 'on' : ''}" onclick="go('${k}')">${t}</a>`).join('')}</div>`;
    const label = b => [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    const hr = [...nav.querySelectorAll(':scope > .cat')].find(b => label(b) === '인사관리');
    const after = hr ? (hr.nextElementSibling && hr.nextElementSibling.classList.contains('sub') ? hr.nextElementSibling : hr) : null;
    const soon = nav.querySelector('.nav-soon-label');
    if (after) after.insertAdjacentHTML('afterend', html);
    else if (soon) soon.insertAdjacentHTML('beforebegin', html);
    else nav.insertAdjacentHTML('beforeend', html);
  };
  const goTr = go;
  go = function(p, t){
    if (AN_TAB[p]) { closeSide(); renderSide(p); pageTrend(AN_TAB[p]); window.scrollTo(0, 0); return; }
    return goTr(p, t);
  };

  /* ---------- 화면 뼈대 ---------- */
  function pageTrend(tab){
    tab = tab || 'search';
    const PG = { search: { t: '트렌드 분석', e: 'TREND · NAVER SEARCH', p: '네이버 검색 관심도로 메뉴·브랜드 흐름을 확인하세요.' }, area: { t: '상권 분석', e: 'AREA · COMPETITION', p: '매장 주변 경쟁점과 업종 변화를 지도로 확인하세요.' }, cost: { t: '식자재 분석', e: 'COST · MARKET PRICE', p: '주요 식자재 시세 흐름을 확인하세요.' } }[tab] || {};
    document.getElementById('main').innerHTML = `
    <div class="crumb">${ic('home')}<span>워크스페이스</span><span>/</span><span>분석 시스템</span><span>/</span><span>${PG.t}</span></div>
    <header class="page-hero compact"><div class="hero-copy"><div class="eyebrow">${PG.e}</div><h1>${PG.t}</h1><p>${PG.p}</p></div><div class="hero-image"><span>MENYAMATSURI</span></div></header>
    <div id="tr-body"></div>` + pageFoot();
    const hi = document.querySelector('.page-hero .hero-image'); if (hi) hi.style.backgroundImage = 'linear-gradient(90deg,#eaece3,transparent 40%),var(--img1)';
    trTab(tab);
  }
  window.pageTrend = pageTrend;

  window.trTab = function(tab){
    document.querySelectorAll('#tr-tabs button').forEach((b, i) => b.classList.toggle('on', ['search', 'area', 'cost'][i] === tab));
    if (TR.chart) { TR.chart.destroy(); TR.chart = null; }
    const body = document.getElementById('tr-body');
    if (tab === 'area') {
      body.innerHTML = `
      <section class="card"><div class="section-title"><strong>${ic('store')}상권 트렌드</strong></div>
        <div class="tr-slot" id="tr-area-sum">요약 카드 자리 — 매장 반경 500m 안 일식·면 업소 수, 직전 대비 증감</div>
        <div class="tr-slot" id="tr-area-chart">그래프 자리 — 최근 4분기(또는 1년) 반경 500m 업소 수 추이<br><small>상권정보는 현재 영업 업소만 주기 때문에, 수집을 시작한 날부터 쌓여야 채워져요.</small></div>
        <div class="tr-slot" id="tr-area-list">목록 자리 — 신규 개업 · 폐업 업소</div>
      </section>`;
      return;
    }
    if (tab === 'cost') {
      body.innerHTML = `
      <section class="card"><div class="section-title"><strong>${ic('coin')}식자재 시세</strong><small>준비 중</small></div>
        <div class="tr-cards" id="tr-cost-cards">${['대파', '양파', '숙주', '계란', '돼지고기'].map(n => `<div class="tr-slot" style="margin:0">${n}<br><small>시세 · 전주/전월/전년 대비</small></div>`).join('')}</div>
        <div class="tr-slot" id="tr-cost-chart" style="margin-top:12px">그래프 자리 — 품목 카드를 누르면 1년 시세 추이</div>
      </section>`;
      return;
    }
    const end = new Date(Date.now() - DAY), start = new Date(end.getTime() - 364 * DAY);
    body.innerHTML = `
    <section class="card query-card"><div class="section-title"><strong>${ic('search')}검색 조건</strong></div>
      <div class="f"><label for="tr-in">키워드 <span>최대 5개</span></label>
        <div class="tr-kwbox" id="tr-kwbox" onclick="document.getElementById('tr-in').focus()"><span id="tr-kws"></span>
          <input id="tr-in" placeholder="키워드 입력 후 Enter" onkeydown="if(event.key==='Enter'||event.key===','){event.preventDefault();trAdd(this.value)}"></div>
        <div class="tr-preset" id="tr-preset"></div>
        <div class="tr-hint">기본 키워드를 누르면 넣고 빼기가 돼요.</div></div>
      <div class="filters" style="margin-top:14px">
        <div class="f"><label>기간</label><div class="daterow"><input type="date" id="tr-d1" min="2016-01-01" value="${ymd(start)}"><span>~</span><input type="date" id="tr-d2" value="${ymd(end)}"></div>
          <div class="quick"><button onclick="trRange(90)">3개월</button><button onclick="trRange(364)">1년</button><button onclick="trRange(364*3)">3년</button></div></div>
        <div class="f"><label>단위</label>${segHtml('tr-unit', [['week', '주별'], ['date', '일별'], ['month', '월별']])}</div>
        <div class="f"><label>보기</label>${segHtml('tr-mode', [['compare', '비교 보기'], ['single', '개별 추이']])}</div>
      </div>
      <details class="tr-more" id="tr-more"><summary>옵션 더보기 (기기 · 성별 · 연령)</summary>
        <div class="tr-grid">
          <div class="f"><label>기기</label>${segHtml('tr-dev', [['', '전체'], ['pc', 'PC'], ['mo', '모바일']])}</div>
          <div class="f"><label>성별</label>${segHtml('tr-gen', [['', '전체'], ['f', '여성'], ['m', '남성']])}</div>
          <div class="f"><label>연령 <span>선택 안 하면 전체</span></label><div class="tr-ages" id="tr-ages">${AGES.map(([n, v]) => `<label><input type="checkbox" value="${v.join(',')}">${n}</label>`).join('')}</div></div>
        </div></details>
      <div class="actions"><span class="filter-hint">${ic('info')}네이버 검색량을 최댓값 100 기준으로 바꾼 상대값이에요.</span><button class="btn ghost" onclick="trReset()">${ic('reset')}초기화</button><button class="btn primary" onclick="trRun()">${ic('search')}조회</button></div>
    </section>
    <div id="tr-res"></div>`;
    drawKw();
    trRun();
  };

  /* ---------- 키워드 ---------- */
  function drawKw(){
    const box = document.getElementById('tr-kws'); if (!box) return;
    box.innerHTML = TR.kw.map((k, i) => `<span class="tr-kw" style="background:${COLORS[i % 5]}">${h(k)}<button type="button" aria-label="${h(k)} 빼기" onclick="event.stopPropagation();trDel(${i})">×</button></span>`).join('');
    document.getElementById('tr-preset').innerHTML = PRESET.map(k => `<button type="button" class="${TR.kw.includes(k) ? 'on' : ''}" onclick="trToggle('${k}')">${k}</button>`).join('');
  }
  window.trAdd = function(v){
    const add = String(v || '').split(',').map(x => x.trim()).filter(Boolean);
    for (const k of add) {
      if (TR.kw.includes(k)) continue;
      if (TR.kw.length >= 5) { toast('키워드는 5개까지 넣을 수 있어요.'); break; }
      if (k.length > 30) { toast('키워드가 너무 길어요.'); continue; }
      TR.kw.push(k);
    }
    const inp = document.getElementById('tr-in'); if (inp) inp.value = '';
    drawKw();
  };
  window.trDel = function(i){ TR.kw.splice(i, 1); drawKw(); };
  window.trToggle = function(k){ const i = TR.kw.indexOf(k); if (i >= 0) trDel(i); else trAdd(k); };
  window.trRange = function(days){
    const end = new Date(Date.now() - DAY);
    document.getElementById('tr-d1').value = ymd(new Date(end.getTime() - days * DAY));
    document.getElementById('tr-d2').value = ymd(end);
  };
  window.trReset = function(){ TR.kw = DEFAULT.slice(); trTab('search'); };

  /* ---------- 조회 ---------- */
  window.trRun = async function(){
    const pend = document.getElementById('tr-in').value.trim(); if (pend) trAdd(pend);
    const res = document.getElementById('tr-res');
    if (!TR.kw.length) { res.innerHTML = `<div class="card"><div class="empty">${ic('info')}키워드를 하나 이상 넣어주세요.</div></div>`; return; }
    const req = {
      keywords: TR.kw.slice(), startDate: document.getElementById('tr-d1').value, endDate: document.getElementById('tr-d2').value,
      timeUnit: segVal('tr-unit'), mode: segVal('tr-mode'), device: segVal('tr-dev') || undefined, gender: segVal('tr-gen') || undefined,
      ages: [...document.querySelectorAll('#tr-ages input:checked')].flatMap(c => c.value.split(','))
    };
    if (!req.startDate || !req.endDate || req.startDate > req.endDate) { toast('기간을 다시 확인해주세요.'); return; }
    res.innerHTML = `<div class="card"><div class="tr-loading">네이버에서 가져오는 중이에요...</div></div>`;
    try {
      const [, out] = await Promise.all([loadChart(), callTrend(req)]);
      TR.last = { req, out };
      drawResult(req, out);
    } catch (e) {
      res.innerHTML = `<div class="card"><div class="empty">${ic('info')}불러오지 못했어요.<br><small>${h(e.message || e)}</small></div></div>`;
    }
  };
  async function callTrend(req){
    if (!window.SB) throw new Error('서버 연결이 준비되지 않았어요. 새로고침해주세요.');
    const { data, error } = await SB.functions.invoke('naver-trend', { body: req });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (_) {}
      throw new Error(msg);
    }
    if (!data || !data.ok) throw new Error((data && data.error) || '알 수 없는 오류');
    return data;
  }

  /* ---------- 계산 ---------- */
  // 기간 앞뒤로 덜 찬 구간(주·월)은 버림
  function periodEnd(p, unit){
    if (unit === 'date') return t0(p);
    if (unit === 'week') return t0(p) + 6 * DAY;
    const d = new Date(p + 'T00:00:00+09:00'); d.setMonth(d.getMonth() + 1); return d.getTime() - DAY;
  }
  function build(req, out){
    const s = t0(req.startDate), e = t0(req.endDate);
    const all = new Set();
    out.results.forEach(r => r.data.forEach(d => all.add(d.period)));
    const periods = [...all].filter(p => t0(p) >= s && periodEnd(p, req.timeUnit) <= e).sort();
    const series = out.results.map(r => {
      const m = {}; r.data.forEach(d => m[d.period] = d.ratio);
      return { keyword: r.keyword, values: periods.map(p => m[p] == null ? 0 : m[p]), empty: !r.data.some(d => d.ratio > 0) };
    });
    const n = req.timeUnit === 'week' ? 4 : req.timeUnit === 'date' ? 28 : 1;
    const label = req.timeUnit === 'month' ? '최근 1개월' : '최근 4주';
    const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    series.forEach(sr => {
      const v = sr.values, cur = avg(v.slice(-n)), prev = avg(v.slice(-2 * n, -n));
      sr.avg = avg(v);
      sr.change = prev > 0 && v.length >= 2 * n ? (cur - prev) / prev * 100 : null;
      const mx = Math.max(...v, 0); sr.peak = mx > 0 ? periods[v.indexOf(mx)] : null;
    });
    return { periods, series, label, n };
  }
  const pct = c => c == null ? '—' : (c > 0 ? '+' : '') + c.toFixed(1) + '%';
  const cls = c => c == null ? '' : c > 0 ? 'tr-up' : c < 0 ? 'tr-down' : '';
  const plabel = (p, unit) => unit === 'month' ? p.slice(0, 7).replace('-', '.') : p.slice(2).replace(/-/g, '.');

  /* ---------- 결과 그리기: 요약 카드 → 그래프 → 순위 ---------- */
  function drawResult(req, out){
    const B = build(req, out), res = document.getElementById('tr-res');
    if (!B.periods.length) { res.innerHTML = `<div class="card"><div class="empty">${ic('info')}이 기간에는 보여줄 데이터가 없어요. 기간을 늘려보세요.</div></div>`; return; }
    const live = B.series.filter(s => !s.empty), ch = live.filter(s => s.change != null);
    const top = req.mode === 'compare' ? [...live].sort((a, b) => b.avg - a.avg)[0] : null;
    const up = [...ch].sort((a, b) => b.change - a.change)[0], down = [...ch].sort((a, b) => a.change - b.change)[0];
    const empty = B.series.filter(s => s.empty).map(s => s.keyword);
    const unitTxt = { week: '주별', date: '일별', month: '월별' }[req.timeUnit];
    const filt = [req.device === 'pc' ? 'PC' : req.device === 'mo' ? '모바일' : '', req.gender === 'f' ? '여성' : req.gender === 'm' ? '남성' : '', req.ages && req.ages.length ? '연령 선택' : ''].filter(Boolean).join(' · ');
    res.innerHTML = `
    <div class="data-note"><span class="status-dot"></span><span>네이버 데이터랩 · ${req.startDate} ~ ${req.endDate} · ${unitTxt}${filt ? ' · ' + filt : ''}</span><span class="tag">${req.mode === 'compare' ? '비교 보기' : '개별 추이 (각자 100 기준)'}</span></div>
    <div class="tr-sum sum">
      <div class="k hl"><div class="l">${ic('chart')}기간 내 최고 관심</div><div class="v">${top ? h(top.keyword) : '—'}</div><div class="d">${top ? '평균 ' + top.avg.toFixed(1) : '개별 추이에서는 크기 비교가 안 돼요'}</div></div>
      <div class="k"><div class="l">${ic('trend')}${B.label} 급상승</div><div class="v">${up && up.change > 0 ? h(up.keyword) : '—'}</div><div class="d ${up ? cls(up.change) : ''}">${up && up.change > 0 ? pct(up.change) + ' (직전 대비)' : '오른 키워드가 없어요'}</div></div>
      <div class="k"><div class="l">${ic('info')}${B.label} 최대 하락</div><div class="v">${down && down.change < 0 ? h(down.keyword) : '—'}</div><div class="d ${down ? cls(down.change) : ''}">${down && down.change < 0 ? pct(down.change) + ' (직전 대비)' : '내린 키워드가 없어요'}</div></div>
    </div>
    <section class="card"><div class="meta"><div class="left"><strong>검색 추이</strong><span class="count">${B.periods.length}구간</span></div></div>
      <div class="tr-chart"><canvas id="tr-canvas" aria-label="검색 추이 그래프"></canvas></div>
      <div class="tr-note">그래프를 좌우로 밀면(PC는 마우스를 올리면) 날짜별 값이 보여요.${empty.length ? `<br><b>데이터 부족:</b> ${empty.map(h).join(', ')} — 검색량이 너무 적어 네이버가 값을 주지 않았어요.` : ''}${req.mode === 'compare' && live.length > 1 ? '<br>작은 키워드가 바닥에 붙어 보이면 <b>개별 추이</b>로 바꿔보세요.' : ''}</div>
    </section>
    <section class="card"><div class="meta"><div class="left"><strong>${B.label} 상승·하락 순위</strong></div></div>
      <div class="tbl-wrap"><table><thead><tr><th>순위</th><th>키워드</th><th>${B.label} 변화</th><th>기간 평균</th><th>최고 시점</th></tr></thead><tbody>
      ${[...B.series].sort((a, b) => (b.change == null ? -1e9 : b.change) - (a.change == null ? -1e9 : a.change)).map((s, i) => `<tr><td>${i + 1}</td><td><span class="tr-dot" style="background:${COLORS[B.series.indexOf(s) % 5]}"></span>${h(s.keyword)}</td><td class="${cls(s.change)}">${s.empty ? '데이터 부족' : pct(s.change)}</td><td>${s.empty ? '—' : s.avg.toFixed(1)}</td><td>${s.peak ? plabel(s.peak, req.timeUnit) : '—'}</td></tr>`).join('')}
      </tbody></table></div>
      ${req.mode === 'single' ? '<div class="tr-note">개별 추이에서는 키워드마다 기준이 달라 평균값끼리 비교하면 안 돼요. 변화율은 그대로 비교할 수 있어요.</div>' : ''}
    </section>`;
    drawChart(B, req);
  }

  // 세로선: 값 상자를 따라다니는 선
  const vline = {
    id: 'trVline',
    afterDatasetsDraw(c){
      const a = c.tooltip && c.tooltip.getActiveElements(); if (!a || !a.length) return;
      const x = a[0].element.x, y = c.chartArea, g = c.ctx;
      g.save(); g.beginPath(); g.moveTo(x, y.top); g.lineTo(x, y.bottom); g.lineWidth = 1; g.strokeStyle = 'rgba(35,38,33,.35)'; g.setLineDash([4, 3]); g.stroke(); g.restore();
    }
  };
  function drawChart(B, req){
    if (TR.chart) { TR.chart.destroy(); TR.chart = null; }
    const cv = document.getElementById('tr-canvas'); if (!cv || !window.Chart) return;
    const single = req.mode === 'single';
    TR.chart = new Chart(cv, {
      type: 'line',
      data: {
        labels: B.periods.map(p => plabel(p, req.timeUnit)),
        datasets: B.series.map((s, i) => ({
          label: s.keyword, data: s.values, borderColor: COLORS[i % 5], backgroundColor: COLORS[i % 5],
          borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: .25, spanGaps: true
        }))
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false, axis: 'x' },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 11 } } },
          tooltip: {
            backgroundColor: '#fff', titleColor: '#232621', bodyColor: '#232621', borderColor: '#d9ddd2', borderWidth: 1,
            padding: 10, boxPadding: 4, usePointStyle: true, itemSort: (a, b) => b.parsed.y - a.parsed.y,
            callbacks: {
              title: it => B.periods[it[0].dataIndex] + (req.timeUnit === 'week' ? ' 주' : '') + (single ? ' (각자 기준)' : ''),
              label: it => ' ' + it.dataset.label + '  ' + it.parsed.y.toFixed(1)
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 7, maxRotation: 0, font: { size: 10 }, color: '#8a9180' } },
          y: { min: 0, suggestedMax: 100, ticks: { stepSize: 25, font: { size: 10 }, color: '#8a9180' }, grid: { color: '#eef0ea' } }
        }
      },
      plugins: [vline]
    });
  }
})();
