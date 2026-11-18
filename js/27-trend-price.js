
// v5.3: 분석 시스템 — 식자재 분석 (aT 지역별 품목별 도·소매 가격, Edge Function price-lookup, 저장 없이 조회만)
// 디자인 분업 규칙: id 와 js- 로 시작하는 class 는 기능용(건드리지 말 것), tr- 로 시작하는 class 는 꾸밈용
(function(){
  const ITEMS = [["111","쌀",[["01","20kg"],["02","백미"],["03","현미"],["05","20kg(햅쌀)"],["10","10kg"],["11","10kg(햅쌀)"]]],["112","찹쌀",[["01","일반계"]]],["113","혼합곡",[["00","혼합곡"]]],["114","기장",[["01","기장"]]],["121","보리쌀",[["02","과맥"]]],["141","콩",[["01","흰 콩(국산)"],["02","콩나물콩"],["03","흰 콩(수입)"]]],["142","팥",[["00","붉은 팥(국산)"],["01","붉은 팥(수입)"]]],["143","녹두",[["00","국산"],["01","수입"]]],["144","메밀",[["01","메밀(수입)"]]],["151","고구마",[["00","밤"]]],["152","감자",[["00","감자"],["01","수미(노지)"],["02","대지마"],["03","노지"],["04","수미(시설)"],["05","기타(시설)"],["06","기타(노지)"]]],["161","귀리",[["01","귀리"]]],["162","보리",[["01","보리"]]],["163","수수",[["01","수수"]]],["164","율무",[["01","율무"]]],["211","배추",[["01","봄"],["02","여름(고랭지)"],["03","가을"],["06","월동"]]],["212","양배추",[["00","양배추"]]],["213","시금치",[["00","시금치"]]],["214","상추",[["01","적"],["02","청"]]],["215","얼갈이배추",[["00","얼갈이배추"]]],["216","갓",[["00","갓"]]],["217","연근",[["01","연근"]]],["218","우엉",[["01","우엉"]]],["221","수박",[["00","수박"]]],["222","참외",[["00","참외"]]],["223","오이",[["01","가시계통"],["02","다다기계통"],["03","취청"]]],["224","호박",[["01","애호박"],["02","쥬키니"],["03","단호박"]]],["225","토마토",[["00","토마토"]]],["226","딸기",[["00","딸기"]]],["231","무",[["01","봄"],["02","고랭지"],["03","가을"],["06","월동"]]],["232","당근",[["00","당근"],["01","무세척"],["02","세척"],["10","세척(수입)"]]],["233","열무",[["00","열무"]]],["241","건고추",[["00","화건"],["01","햇산화건"],["02","양건(~23.5)"],["03","햇산양건(~23.5)"],["10","수입"]]],["242","풋고추",[["00","풋고추(녹광 등)"],["02","꽈리고추"],["03","청양고추"],["04","오이맛고추"]]],["243","붉은고추",[["00","붉은고추"]]],["244","피마늘",[["01","한지1접"],["02","난지1접"],["03","한지"],["04","난지"],["06","햇한지1접"],["07","햇난지1접"],["08","쪽마늘"],["11","햇한지"],["12","햇난지"],["21","햇난지(대서)"],["22","난지(대서)"],["23","햇난지(남도)"],["24","난지(남도)"]]],["245","양파",[["00","양파"],["02","햇양파"],["10","수입"]]],["246","파",[["00","대파"],["02","쪽파"]]],["247","생강",[["00","국산"],["01","수입"]]],["248","고춧가루",[["00","국산"],["01","중국"]]],["251","가지",[["00","가지"]]],["252","미나리",[["00","미나리"]]],["253","깻잎",[["00","깻잎"]]],["254","부추",[["00","부추"]]],["255","피망",[["00","청"]]],["256","파프리카",[["00","파프리카"]]],["257","멜론",[["00","멜론"]]],["258","깐마늘(국산)",[["01","깐마늘(국산)"],["03","깐마늘(대서)"],["04","햇깐마늘(대서)"],["05","깐마늘(남도)"],["06","햇깐마늘(남도)"]]],["259","깐마늘(수입)",[["01","깐마늘(수입)"],["03","깐마늘(수입산)"]]],["261","브로콜리",[["01","브로콜리"]]],["262","양상추",[["01","양상추"]]],["263","청경채",[["01","청경채"]]],["264","케일",[["01","케일"]]],["265","콩나물",[["01","콩나물"]]],["266","절임배추",[["01","봄"],["02","여름(고랭지)"],["03","가을"],["04","월동"]]],["279","알배기배추",[["00","알배기배추"]]],["280","브로콜리",[["00","브로콜리(국산)"]]],["422","방울토마토",[["01","방울토마토"],["02","대추방울토마토"]]],["312","참깨",[["01","백색(국산)"],["02","중국"],["03","인도"]]],["313","들깨",[["01","국산"],["02","수입"]]],["314","땅콩",[["01","국산"],["02","수입"]]],["315","느타리버섯",[["00","느타리버섯"],["01","애느타리버섯"]]],["316","팽이버섯",[["00","팽이버섯"]]],["317","새송이버섯",[["00","새송이버섯"]]],["318","호두",[["00","수입"]]],["319","아몬드",[["00","수입"]]],["321","양송이버섯",[["01","양송이버섯"]]],["322","표고버섯",[["01","표고버섯"]]],["411","사과",[["01","홍옥"],["05","후지"],["06","쓰가루(아오리)"],["07","홍로"]]],["412","배",[["01","신고"],["02","만삼길"],["03","장십랑"],["04","원황"]]],["413","복숭아",[["01","백도"],["04","창방조생"],["05","유명"]]],["414","포도",[["01","캠벨얼리"],["02","거봉"],["03","델라웨어"],["06","MBA"],["07","수입"],["08","레드글로브 칠레(~23.5)"],["09","레드글로브 페루(~23.5)"],["10","톰슨 미국(~23.5)"],["11","톰슨 호주(~23.5)"],["12","샤인머스켓"]]],["415","감귤",[["00","감귤"],["01","노지"],["02","시설"]]],["416","단감",[["00","단감"]]],["418","바나나",[["02","수입"]]],["419","참다래",[["01","국산"],["02","그린 뉴질랜드"]]],["420","파인애플",[["02","수입"]]],["421","오렌지",[["02","수입"],["03","네이블 미국"],["04","발렌시아 미국"],["05","네이블 EU"],["06","네이블 호주"]]],["423","자몽",[["00","수입"]]],["424","레몬",[["00","수입"]]],["425","체리",[["00","수입"]]],["426","건포도",[["00","수입"]]],["427","건블루베리",[["00","수입"]]],["428","망고",[["00","수입"]]],["429","블루베리",[["01","블루베리"]]],["430","아보카도",[["00","수입"]]],["4301","소",[["21","안심"],["22","등심"],["36","설도"],["40","양지"],["50","갈비"]]],["4304","돼지",[["25","앞다리"],["27","삼겹살"],["28","갈비"],["68","목심"]]],["4401","수입 소고기",[["31","갈비"],["37","갈비살"]]],["4402","수입 돼지고기",[["27","삼겹살"]]],["520","오리고기",[["01","통오리"],["02","훈제육"]]],["9901","닭",[["01","토종닭17호"],["02","육계9호"],["03","육계10호"],["04","육계11호"],["05","육계12호"],["24","절단육"],["99","육계(kg)"]]],["9903","계란",[["21","특란10구"],["23","특란30구"]]],["9908","우유",[["01","흰우유"]]],["611","고등어",[["01","생선"],["02","냉동"],["03","국산(염장)"],["04","냉동(수입)"],["05","국산(신선 냉장)"],["06","국산(냉동)"],["07","수입산(냉동)"],["08","수입산(염장)"]]],["612","꽁치",[["01","냉동(수입)"]]],["613","갈치",[["01","생선"],["02","냉동"],["03","국산(냉장)"],["04","국산(냉동)"],["05","수입산(냉동)"]]],["614","조기",[["01","생선"],["04","참조기(냉동)"],["05","참조기(신선 냉장)"],["06","참조기(냉동)"],["07","굴비"]]],["615","명태",[["01","생선"],["02","냉동"],["03","원양산(냉동)"],["04","냉동(원양수입통합)"],["05","냉동가공"]]],["616","삼치",[["01","냉장"],["02","냉동"],["03","생물"]]],["619","물오징어",[["01","생선"],["02","냉동"],["03","연근해(신선 냉장)"],["04","연근해(냉동)"],["05","원양(냉동)"]]],["638","마른멸치",[["00","마른멸치"]]],["639","북어",[["01","황태"],["02","먹태"]]],["640","마른오징어",[["00","마른오징어"]]],["641","김",[["00","마른김"],["01","얼구운김"]]],["642","마른미역",[["00","마른미역"]]],["643","염장미역",[["00","염장미역"]]],["644","굴",[["00","굴"]]],["647","넙치",[["00","넙치활어"]]],["648","우럭",[["00","우럭"]]],["649","수입조기",[["01","부세수입(생선)"],["04","부세수입(냉동)"]]],["650","새우젓",[["00","새우젓"]]],["651","멸치액젓",[["00","멸치액젓"]]],["652","천일염",[["00","천일염"]]],["653","전복",[["00","전복"]]],["654","새우",[["01","흰다리(수입)"]]],["656","꽃게",[["00","냉동"],["01","냉장"],["02","암꽃게(냉동)"],["03","수꽃게(냉동)"],["04","암꽃게(냉장)"],["05","수꽃게(냉장)"]]],["658","홍합",[["01","깐홍합(냉장)"],["02","안깐홍합(냉장)"]]],["659","가리비",[["01","해만가리비(홍가리비)"]]],["660","건다시마",[["01","완도산"]]],["661","바지락",[["00","바지락"]]],["662","고등어필렛",[["00","수입"],["01","국산"]]],["663","전어",[["01","냉장"]]]];   // [품목코드, 품목명, [[품종코드, 품종명], ...]]
  const SGG = [['1101','서울'],['2100','부산'],['2200','대구'],['2300','인천'],['2401','광주'],['2501','대전'],['2601','울산'],['2701','세종'],['3100','경기'],['3111','수원'],['3112','성남'],['3113','의정부'],['3138','고양'],['3145','용인'],['3201','강원'],['3211','춘천'],['3214','강릉'],['3300','충북'],['3311','청주'],['3312','충주'],['3400','충남'],['3411','천안'],['3500','전북'],['3511','전주'],['3512','군산'],['3600','전남'],['3611','목포'],['3613','순천'],['3700','경북'],['3711','포항'],['3714','안동'],['3800','경남'],['3811','마산'],['3814','창원'],['3818','김해'],['3911','제주']];
  const C1 = '#c62429', C2 = '#3b5ba5';
  const PC = { sel: null, sgg: '1101', days: 90, data: null, key: '', chart: null, busy: 0 };
  const h = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const won = v => v == null ? '-' : Math.round(v).toLocaleString('ko-KR') + '원';
  const ymd8 = d => new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10).replace(/-/g, '');
  const md = s => s ? (+s.slice(4, 6)) + '/' + (+s.slice(6, 8)) : '';
  const full = s => s ? s.slice(0, 4) + '.' + s.slice(4, 6) + '.' + s.slice(6, 8) : '';
  const norm = s => String(s || '').replace(/\s/g, '');

  /* ---------- 스타일 (꾸밈용) ---------- */
  const st = document.createElement('style');
  st.textContent = `
  .tr-pq{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
  .tr-pq button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 14px;font-size:12px;color:#5d6656}
  .tr-pq button.on{background:var(--side);border-color:var(--side);color:#fff}
  .tr-prow{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,.8fr) minmax(0,1fr);gap:12px;align-items:end}
  .tr-psearch{position:relative}
  .tr-pdrop{position:absolute;left:0;right:0;top:100%;margin-top:4px;background:#fff;border:1px solid var(--line);border-radius:9px;box-shadow:0 6px 18px #0002;max-height:260px;overflow:auto;z-index:20}
  .tr-pdrop button{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #f0f2eb;background:#fff;padding:9px 12px;font-size:13px}
  .tr-pdrop button small{color:var(--sub);margin-left:6px;font-size:11px}
  .tr-pdrop button:hover{background:#f6f7f2}
  .tr-pnone{padding:12px;font-size:12px;color:#8a5a14;background:#fff8ea;border-radius:8px;margin-top:10px}
  .tr-psel{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin-bottom:14px}
  .tr-psel .f{min-width:160px}
  .tr-psum{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
  .tr-psum .k .v{font-size:19px}
  .tr-psum .k .d{font-size:11px;color:var(--sub);margin-top:4px}
  .tr-ptable td.n,.tr-ptable th.n{text-align:right;white-space:nowrap}
  .tr-ptag{display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;color:#fff}
  @media(max-width:760px){.tr-prow{grid-template-columns:1fr}.tr-psum{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(st);

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

  /* ---------- 탭 연결 ---------- */
  const trTabPrev = window.trTab;
  window.trTab = function(tab){
    if (PC.chart) { PC.chart.destroy(); PC.chart = null; }
    trTabPrev(tab);
    if (tab === 'cost') costPage();
  };

  /* ---------- 화면 뼈대 ---------- */
  function costPage(){
    const body = document.getElementById('tr-body');
    body.innerHTML = `
    <section class="card query-card"><div class="section-title"><strong>${ic('coin')}품목 조회</strong><small>aT 도·소매 가격 · 평일 조사</small></div>
      <div class="tr-prow">
        <div class="f tr-psearch"><label for="pc-q">품목 검색</label>
          <input id="pc-q" placeholder="예: 배추, 마늘, 닭, 고등어" autocomplete="off" oninput="pcSuggest(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();pcEnter(this.value)}" onfocus="pcSuggest(this.value)">
          <div class="tr-pdrop" id="pc-drop" hidden></div></div>
        <div class="f"><label for="pc-sgg">지역</label><select id="pc-sgg" onchange="pcSet('sgg',this.value)">${SGG.map(([c, n]) => `<option value="${c}" ${c === PC.sgg ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="f"><label>기간</label><div class="seg" id="pc-days">${[[30, '1개월'], [90, '3개월'], [365, '1년']].map(([d, t]) => `<button class="${d === PC.days ? 'on' : ''}" onclick="pcSet('days',${d})">${t}</button>`).join('')}</div></div>
      </div>
      <div id="pc-msg"></div>
      <div class="tr-hint" style="margin-top:10px">도매(중도매) 가격은 서울·부산·대구·광주·대전 위주로 나오고, 그 밖의 지역은 소매 가격만 있을 수 있어요.</div>
    </section>
    <div id="pc-res"></div>`;
    document.removeEventListener('click', pcOutside);
    document.addEventListener('click', pcOutside);
    if (PC.sel) { document.getElementById('pc-q').value = PC.sel.name; run(); }
    else document.getElementById('pc-res').innerHTML = `<section class="card"><div class="tr-loading">조회할 품목을 검색해 주세요.<br><small>예: 대파, 양파, 계란, 삼겹살, 배추</small></div></section>`;
  }
  function pcOutside(e){
    const d = document.getElementById('pc-drop');
    if (!d) { document.removeEventListener('click', pcOutside); return; }
    if (!e.target.closest('.tr-psearch')) d.hidden = true;
  }

  /* ---------- 검색 ---------- */
  function find(q){
    q = norm(q); if (!q) return [];
    const out = [];
    for (const [c, n, vs] of ITEMS) {
      if (norm(n).includes(q)) { out.push({ c, n, v: '', sub: vs.map(v => v[1]).join(' · ') }); continue; }
      vs.filter(v => norm(v[1]).includes(q)).forEach(v => out.push({ c, n, v: v[0], vn: v[1], sub: n }));
    }
    return out.slice(0, 30);
  }
  window.pcSuggest = function(q){
    const d = document.getElementById('pc-drop'); if (!d) return;
    const r = find(q);
    if (!norm(q)) { d.hidden = true; return; }
    if (!r.length) { d.hidden = true; return; }
    d.innerHTML = r.map((x, i) => `<button onclick="pcPick('${x.c}','${x.v}')">${h(x.vn || x.n)}<small>${h(x.sub)}</small></button>`).join('');
    d.hidden = false;
  };
  window.pcEnter = function(q){
    const r = find(q);
    if (r.length) return pcPick(r[0].c, r[0].v);
    document.getElementById('pc-drop').hidden = true;
    document.getElementById('pc-msg').innerHTML = `<div class="tr-pnone">‘${h(q.trim())}’은(는) aT 가격 자료에 없는 품목이에요.</div>`;
  };
  window.pcPick = function(c, v){
    const it = ITEMS.find(x => x[0] === c); if (!it) return;
    const vn = v ? (it[2].find(x => x[0] === v) || [])[1] : '';
    PC.sel = { c, v: v || '', name: vn || it[1], item: it[1] };
    const q = document.getElementById('pc-q'); if (q) q.value = PC.sel.name;
    const d = document.getElementById('pc-drop'); if (d) d.hidden = true;
    run();
  };
  window.pcSet = function(k, v){
    PC[k] = v;
    if (k === 'days') document.querySelectorAll('#pc-days button').forEach(b => b.classList.toggle('on', b.textContent === { 30: '1개월', 90: '3개월', 365: '1년' }[v]));
    if (PC.sel) run();
  };

  /* ---------- 조회 ---------- */
  async function run(){
    const res = document.getElementById('pc-res'); if (!res) return;
    document.getElementById('pc-msg').innerHTML = '';
    const my = ++PC.busy;
    res.innerHTML = `<section class="card"><div class="tr-loading">${h(PC.sel.name)} 가격을 불러오는 중…</div></section>`;
    const to = new Date(Date.now() - 86400000), from = new Date(to.getTime() - PC.days * 86400000);
    try {
      const { data, error } = await SB.functions.invoke('price-lookup', { body: { item_cd: PC.sel.c, vrty_cd: PC.sel.v, sgg_cd: PC.sgg, from: ymd8(from), to: ymd8(to) } });
      if (my !== PC.busy) return;
      if (error) throw error;
      if (!data || !data.ok) throw new Error((data && data.error) || '조회 실패');
      PC.data = data.rows || []; PC.key = '';
      draw();
    } catch (e) {
      if (my !== PC.busy) return;
      res.innerHTML = `<section class="card"><div class="tr-loading">가격을 불러오지 못했어요.<br><small>${h(e.message || e)}</small></div></section>`;
    }
  }

  /* ---------- 결과 ---------- */
  const keyOf = r => r.se + '|' + r.vrty_cd + '|' + r.grd;
  const sgName = () => (SGG.find(s => s[0] === PC.sgg) || [])[1] || '';
  function draw(){
    const res = document.getElementById('pc-res');
    const rows = PC.data;
    if (!rows.length) {
      res.innerHTML = `<section class="card"><div class="tr-loading"><b>${h(PC.sel.name)}</b> · ${h(sgName())}<br>이 기간·지역에는 조사된 가격이 없어요.<br><small>다른 지역(서울 등)이나 기간을 바꿔 보세요.</small></div></section>`;
      return;
    }
    // 시리즈 목록 (구분·품종·등급)
    const S = {};
    rows.forEach(r => { const k = keyOf(r); (S[k] = S[k] || { k, se: r.se, se_nm: r.se_nm, vrty: r.vrty, grd: r.grd, unit: r.unit, sz: r.sz, pts: [] }).pts.push(r); });
    const list = Object.values(S).sort((a, b) => (b.se.localeCompare(a.se)) || a.vrty.localeCompare(b.vrty) || (a.grd === '상품' ? -1 : b.grd === '상품' ? 1 : a.grd.localeCompare(b.grd)));
    if (!S[PC.key]) PC.key = (list.find(s => s.grd === '상품') || list[0]).k;
    const cur = S[PC.key];
    const lab = s => `${s.se_nm} · ${s.vrty}${s.grd && s.grd !== s.vrty ? ' · ' + s.grd : ''} (${s.sz}${s.unit})`;

    const p = cur.pts, last = p[p.length - 1];
    const ago = days => { const t = new Date(+last.d.slice(0, 4), +last.d.slice(4, 6) - 1, +last.d.slice(6, 8) - days); const k = String(t.getFullYear()) + String(t.getMonth() + 1).padStart(2, '0') + String(t.getDate()).padStart(2, '0'); let f = null; for (const x of p) { if (x.d <= k) f = x; else break; } return f; };
    const diff = (o) => { if (!o || o.d === last.d) return '<div class="d">비교 자료 없음</div>'; const r = (last.avg - o.avg) / o.avg * 100; const c = r > 0 ? 'tr-up' : r < 0 ? 'tr-down' : ''; return `<div class="v ${c}">${r > 0 ? '▲' : r < 0 ? '▼' : ''} ${Math.abs(r).toFixed(1)}%</div><div class="d">${md(o.d)} ${won(o.avg)}</div>`; };
    const lo = p.reduce((a, x) => x.avg < a.avg ? x : a, p[0]), hi = p.reduce((a, x) => x.avg > a.avg ? x : a, p[0]);
    const twin = Object.values(S).find(s => s.se !== cur.se && s.vrty === cur.vrty && s.grd === cur.grd);

    // 최근 조사일 전체 표
    const lastD = rows[rows.length - 1].d;
    const latest = list.map(s => s.pts[s.pts.length - 1]).filter(Boolean);

    res.innerHTML = `
    <section class="card"><div class="section-title"><strong>${ic('coin')}${h(PC.sel.name)} · ${h(sgName())}</strong><small>최근 조사일 ${full(last.d)}</small></div>
      <div class="tr-psel"><div class="f"><label for="pc-ser">품종 · 등급</label><select id="pc-ser" onchange="pcSer(this.value)">${list.map(s => `<option value="${h(s.k)}" ${s.k === PC.key ? 'selected' : ''}>${h(lab(s))}</option>`).join('')}</select></div>
        ${twin ? `<div class="f"><label>&nbsp;</label><button class="btn ghost" onclick="pcSer('${h(twin.k)}')">${twin.se_nm} 가격 보기</button></div>` : ''}</div>
      <div class="tr-psum">
        <div class="k"><div class="l">최근 가격</div><div class="v">${won(last.avg)}</div><div class="d">${h(cur.sz + cur.unit)} 기준${last.min !== last.max ? ` · ${won(last.min)}~${won(last.max)}` : ''}</div></div>
        <div class="k"><div class="l">1주 전 대비</div>${diff(ago(7))}</div>
        <div class="k"><div class="l">1개월 전 대비</div>${diff(ago(30))}</div>
        <div class="k"><div class="l">기간 최저 · 최고</div><div class="v" style="font-size:15px">${won(lo.avg)} ~ ${won(hi.avg)}</div><div class="d">${md(lo.d)} 최저 · ${md(hi.d)} 최고</div></div>
      </div>
      <div class="tr-chart"><canvas id="pc-cv"></canvas></div>
      <div class="tr-note">평균가는 그날 조사한 여러 시장 가격의 평균이에요. 주말·공휴일은 조사하지 않아 비어 있어요.</div>
    </section>
    <section class="card"><div class="section-title"><strong>${ic('chart')}최근 가격 한눈에</strong><small>품종·등급별 마지막 조사값</small></div>
      <div class="tbl-wrap"><table class="tr-ptable"><thead><tr><th>구분</th><th>품종</th><th>등급</th><th>단위</th><th class="n">평균</th><th class="n">최저~최고</th><th>조사일</th></tr></thead><tbody>
      ${latest.map(r => `<tr${keyOf(r) === PC.key ? ' style="background:#f6f7f2"' : ''}><td><span class="tr-ptag" style="background:${r.se === '02' ? C2 : C1}">${h(r.se_nm)}</span></td><td>${h(r.vrty)}</td><td>${h(r.grd)}</td><td>${h(r.sz + r.unit)}</td><td class="n"><b>${won(r.avg)}</b></td><td class="n">${r.min !== r.max ? won(r.min) + '~' + won(r.max) : '-'}</td><td>${r.d === lastD ? md(r.d) : `<span style="color:var(--sub)">${md(r.d)}</span>`}</td></tr>`).join('')}
      </tbody></table></div>
    </section>`;
    chart(cur);
  }
  window.pcSer = function(k){ PC.key = k; draw(); };

  async function chart(s){
    try { await loadChart(); } catch (e) { return; }
    const cv = document.getElementById('pc-cv'); if (!cv) return;
    if (PC.chart) PC.chart.destroy();
    const col = s.se === '02' ? C2 : C1;
    PC.chart = new Chart(cv, {
      type: 'line',
      data: { labels: s.pts.map(x => md(x.d)), datasets: [
        { label: '평균', data: s.pts.map(x => x.avg), borderColor: col, backgroundColor: col + '22', fill: true, tension: .25, pointRadius: s.pts.length > 60 ? 0 : 2, borderWidth: 2 },
        ...(s.pts.some(x => x.min !== x.max) ? [{ label: '최저', data: s.pts.map(x => x.min), borderColor: '#b9c0ae', borderDash: [4, 4], pointRadius: 0, borderWidth: 1, fill: false }, { label: '최고', data: s.pts.map(x => x.max), borderColor: '#b9c0ae', borderDash: [4, 4], pointRadius: 0, borderWidth: 1, fill: false }] : [])
      ] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: it => full(s.pts[it[0].dataIndex].d), label: c => c.dataset.label + ' ' + won(c.parsed.y) } } },
        scales: { x: { ticks: { maxTicksLimit: 8, autoSkip: true }, grid: { display: false } }, y: { ticks: { callback: v => Number(v).toLocaleString('ko-KR') } } } }
    });
  }
})();
