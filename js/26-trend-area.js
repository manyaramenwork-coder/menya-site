
// v5.2: 트렌드 분석 — 상권 탭 (공공데이터 상가정보 + 네이버 지도 + 기준 업종 선택)
// 조회: Edge Function sbiz-radius (실시간) / 기록: area_daily(수집일)·area_shops(업소별 처음·마지막 본 날) — 매일 새벽 3시 sbiz-collect
// 디자인 분업 규칙: id 와 js- 로 시작하는 class 는 기능용(건드리지 말 것), tr- 로 시작하는 class 는 꾸밈용
(function(){
  const NAVER_ID = 'timg82m9f5';
  const OWN = /멘야\s*마쯔리|menya\s*matsuri/i;
  const RAMEN = 'ramen';                       // 기본 기준 업종: 라멘·우동·소바(일식 면 요리)
  const C_HIT = '#c62429', C_NEAR = '#d08a1e', C_OTHER = '#9aa68c';
  const AR = { stores: [], sel: null, radius: 500, mode: 'store', live: null, hist: null, cat: { m: RAMEN, s: '', q: '' },
    map: null, marks: [], circle: null, info: null, showAll: false, chart: null, allBiz: false, qt: null };
  const h = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n = v => Number(v || 0).toLocaleString('ko-KR');
  const md = s => s ? s.slice(5).replace('-', '/') : '';
  const nvUrl = it => 'https://map.naver.com/p/search/' + encodeURIComponent(((it.area ? it.area + ' ' : '') + (it.name || '')).trim());

  /* ---------- 스타일 (꾸밈용) ---------- */
  const st = document.createElement('style');
  st.textContent = `
  .tr-amode{display:flex;gap:6px;margin-bottom:12px}
  .tr-amode button{border:1px solid var(--line);background:#fff;border-radius:7px;padding:8px 14px;font-size:12px;color:#5d6656}
  .tr-amode button.on{background:#eef1e8;border-color:#9aa68c;color:#2d3726;font-weight:600}
  .tr-arow{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:12px;align-items:end}
  .tr-arow .tr-addr{display:flex;gap:6px}
  .tr-arow .tr-addr input{flex:1}
  .tr-acat{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) auto;gap:12px;align-items:end;margin-top:14px;padding-top:14px;border-top:1px dashed var(--line)}
  .tr-acat .btn{min-height:40px;font-size:11px;white-space:nowrap}
  .tr-asum{display:grid;gap:12px;margin:16px 0}
  .tr-asum .k .d{font-size:10px;color:var(--sub);margin-top:6px}
  .tr-map{width:100%;height:420px;border-radius:10px;border:1px solid var(--line);overflow:hidden;background:#f3f5ef}
  .tr-maptool{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin:10px 0 0;font-size:11px;color:#5d6656}
  .tr-legend{display:flex;gap:12px;flex-wrap:wrap}
  .tr-pin{width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px #0005;cursor:pointer}
  .tr-pin.sm{width:8px;height:8px;border-width:1px;opacity:.75}
  .tr-pin.own{width:18px;height:18px;background:#25301f;border:3px solid #fff}
  .tr-iw{padding:8px 11px;font-size:12px;line-height:1.6;min-width:140px}
  .tr-iw small{color:#7a836f}
  .tr-nv{display:inline-flex;align-items:center;gap:3px;border-radius:5px;background:#03c75a;color:#fff!important;font-size:10px;font-weight:700;padding:3px 8px;text-decoration:none;white-space:nowrap}
  .tr-iw .tr-nv{margin-top:6px}
  .tr-list td.tr-gtag span{display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;color:#fff}
  .tr-chg{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .tr-chg h4{margin:0 0 8px;font-size:12px}
  .tr-chg ul{list-style:none;margin:0;padding:0;font-size:12px}
  .tr-chg li{padding:7px 0;border-bottom:1px solid #f0f2eb;display:flex;justify-content:space-between;gap:8px}
  .tr-chg li small{color:var(--sub);white-space:nowrap}
  .tr-chg .tr-none{color:#909b84;font-size:11px;padding:10px 0}
  @media(max-width:760px){.tr-arow,.tr-acat{grid-template-columns:1fr}.tr-asum{grid-template-columns:1fr 1fr!important}.tr-asum .k.hl{grid-column:1/-1}.tr-map{height:340px}.tr-chg{grid-template-columns:1fr}}
  `;
  document.head.appendChild(st);

  /* ---------- 외부 도구 불러오기 ---------- */
  let naverLoading = null, chartLoading = null;
  function loadNaver(){
    if (window.naver && naver.maps && naver.maps.Service) return Promise.resolve();
    if (naverLoading) return naverLoading;
    naverLoading = new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=' + NAVER_ID + '&submodules=geocoder';
      s.onload = () => { const t = Date.now(); (function wait(){ if (naver.maps && naver.maps.Service) ok(); else if (Date.now() - t > 8000) ok(); else setTimeout(wait, 100); })(); };
      s.onerror = () => { naverLoading = null; no(new Error('네이버 지도를 불러오지 못했어요.')); };
      document.head.appendChild(s);
    });
    return naverLoading;
  }
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

  /* ---------- 기준 업종 ---------- */
  const isRamen = () => AR.cat.m === RAMEN;
  function grpOf(m, s){
    if (m === '일식' && (s || '').includes('면')) return 'direct';
    if (m === '일식') return 'japanese';
    if (['국수/칼국수', '냉면/밀면'].includes(s)) return 'noodle';
    return 'other';
  }
  // hit: 기준 업종 / near: 같은 분류(라멘 기준이면 일식·면) / other
  function tier(it){
    const c = AR.cat, q = c.q.trim(), qok = !q || (it.name || '').includes(q);
    if (c.m === RAMEN) {
      const g = grpOf(it.mcls, it.scls);
      if (g === 'direct' && qok) return 'hit';
      return g !== 'other' ? 'near' : 'other';
    }
    if ((!c.m || it.mcls === c.m) && (!c.s || it.scls === c.s) && qok) return 'hit';
    return c.m && it.mcls === c.m ? 'near' : 'other';
  }
  function catLabel(){
    const c = AR.cat, q = c.q.trim();
    const base = c.m === RAMEN ? '라멘·우동·소바' : (c.s || c.m || '전체 업종');
    return q ? `${base} · '${q}' 포함` : base;
  }
  function metrics(){
    if (isRamen()) return [
      { label: '직접 경쟁 · ' + catLabel(), fn: it => tier(it) === 'hit', col: C_HIT },
      { label: '일식 전체', fn: it => it.mcls === '일식', col: C_NEAR },
      { label: '면 식사', fn: it => ['direct', 'noodle'].includes(grpOf(it.mcls, it.scls)), col: '#3b5ba5' },
      { label: '음식점 전체', fn: () => true, total: true }];
    const a = [{ label: '선택 업종 · ' + catLabel(), fn: it => tier(it) === 'hit', col: C_HIT }];
    if (AR.cat.m && (AR.cat.s || AR.cat.q.trim())) a.push({ label: AR.cat.m + ' 전체', fn: it => it.mcls === AR.cat.m, col: C_NEAR });
    a.push({ label: '음식점 전체', fn: () => true, total: true });
    return a;
  }
  function tagOf(it, t){
    if (t === 'hit') return isRamen() ? '직접 경쟁' : '선택';
    if (isRamen()) return grpOf(it.mcls, it.scls) === 'noodle' ? '면 식사' : '일식';
    return '같은 분류';
  }

  /* ---------- 탭 연결 ---------- */
  const trTabOrig = window.trTab;
  window.trTab = function(tab){
    if (AR.chart) { AR.chart.destroy(); AR.chart = null; }
    AR.map = null; AR.marks = []; AR.circle = null;
    trTabOrig(tab);
    const b = document.querySelectorAll('#tr-tabs button')[1];
    if (b) b.innerHTML = '상권';
    if (tab === 'area') { AR.cat = { m: RAMEN, s: '', q: '' }; areaPage(); }
  };

  /* ---------- 화면 뼈대 ---------- */
  async function areaPage(){
    const body = document.getElementById('tr-body');
    body.innerHTML = `
    <section class="card query-card"><div class="section-title"><strong>${ic('store')}조회 대상</strong><small>반경 안 업소 · 공공데이터 상가정보</small></div>
      <div class="tr-amode" id="ar-mode">
        <button class="${AR.mode === 'store' ? 'on' : ''}" onclick="arMode('store')">우리 매장</button>
        <button class="${AR.mode === 'addr' ? 'on' : ''}" onclick="arMode('addr')">후보지 주소</button>
      </div>
      <div class="tr-arow">
        <div class="f" id="ar-pick"></div>
        <div class="f"><label>반경</label>${segHtml('ar-rad', [['300', '300m'], ['500', '500m'], ['1000', '1km']])}</div>
      </div>
      <div class="tr-acat" id="ar-cat"></div>
    </section>
    <div id="ar-out"></div>`;
    document.querySelectorAll('#ar-rad button').forEach(b => {
      b.classList.toggle('on', Number(b.dataset.v) === AR.radius);
      b.addEventListener('click', () => { AR.radius = Number(b.dataset.v); arRun(); });
    });
    await loadStores();
    drawPick();
    drawCat();
    if (AR.mode === 'store' && AR.sel) arRun();
  }

  async function loadStores(){
    if (AR.stores.length) return;
    try {
      const { data: a, error } = await SB.from('area_stores').select('store_id,lat,lng,addr');
      if (error) throw error;
      const ids = (a || []).map(r => r.store_id);
      const { data: s } = ids.length ? await SB.from('stores').select('id,name').in('id', ids) : { data: [] };
      const nm = new Map((s || []).map(r => [r.id, r.name]));
      AR.stores = (a || []).map(r => ({ id: r.store_id, name: nm.get(r.store_id) || ('매장 ' + r.store_id), lat: r.lat, lng: r.lng, addr: r.addr }))
        .sort((x, y) => x.id === 1 ? -1 : y.id === 1 ? 1 : x.name.localeCompare(y.name, 'ko'));
      if (!AR.sel && AR.stores.length) AR.sel = AR.stores[0];
    } catch (e) { AR.stores = []; }
  }

  function drawPick(){
    const box = document.getElementById('ar-pick'); if (!box) return;
    if (AR.mode === 'store') {
      if (!AR.stores.length) { box.innerHTML = `<label>매장</label><div class="tr-hint">조회할 수 있는 매장이 없어요.</div>`; return; }
      box.innerHTML = `<label for="ar-store">매장</label><select id="ar-store" onchange="arPick(this.value)">${AR.stores.map(s => `<option value="${s.id}" ${AR.sel && AR.sel.id === s.id ? 'selected' : ''}>${h(s.name)}</option>`).join('')}</select>`;
    } else {
      box.innerHTML = `<label for="ar-addr">후보지 주소</label><div class="tr-addr"><input type="text" id="ar-addr" placeholder="예) 천안시 서북구 불당동 1234" onkeydown="if(event.key==='Enter'){event.preventDefault();arFind()}"><button class="btn primary" onclick="arFind()">${ic('search')}찾기</button></div><div class="tr-hint">도로명·지번 주소 모두 돼요. 후보지는 기록 없이 오늘 기준으로만 보여줘요.</div>`;
    }
  }

  // 기준 업종 선택칸 — 선택지는 지금 조회한 반경 안 실제 업종에서 뽑음
  function drawCat(){
    const box = document.getElementById('ar-cat'); if (!box) return;
    const items = AR.live ? AR.live.items.filter(it => !it.own) : [];
    const cm = new Map(); items.forEach(it => cm.set(it.mcls, (cm.get(it.mcls) || 0) + 1));
    const mOpts = [...cm.entries()].sort((a, b) => b[1] - a[1]);
    if (AR.cat.m && AR.cat.m !== RAMEN && !cm.has(AR.cat.m)) mOpts.push([AR.cat.m, 0]);
    const c = AR.cat;
    let sub = '';
    if (c.m && c.m !== RAMEN) {
      const sm = new Map(); items.filter(it => it.mcls === c.m).forEach(it => sm.set(it.scls, (sm.get(it.scls) || 0) + 1));
      const sOpts = [...sm.entries()].sort((a, b) => b[1] - a[1]);
      if (c.s && !sm.has(c.s)) sOpts.push([c.s, 0]);
      sub = `<select id="ar-cat-s" onchange="arCatS(this.value)"><option value="">${h(c.m)} 전체</option>${sOpts.map(([k, v]) => `<option value="${h(k)}" ${c.s === k ? 'selected' : ''}>${h(k)} (${v})</option>`).join('')}</select>`;
    } else sub = `<select disabled><option>${c.m === RAMEN ? '일식 면 요리' : '전체'}</option></select>`;
    box.innerHTML = `
      <div class="f"><label for="ar-cat-m">기준 업종</label><select id="ar-cat-m" onchange="arCatM(this.value)">
        <option value="${RAMEN}" ${c.m === RAMEN ? 'selected' : ''}>라멘·우동·소바 (기본)</option>
        <option value="" ${c.m === '' ? 'selected' : ''}>전체 업종</option>
        ${mOpts.map(([k, v]) => `<option value="${h(k)}" ${c.m === k ? 'selected' : ''}>${h(k)} (${v})</option>`).join('')}
      </select></div>
      <div class="f"><label for="ar-cat-s">세부 업종</label>${sub}</div>
      <div class="f"><label for="ar-q">상호 검색 <span>선택</span></label><input type="text" id="ar-q" value="${h(c.q)}" placeholder="예) 마라, 돈카츠" oninput="arQ(this.value)"></div>
      <div class="f"><button class="btn" onclick="arCatReset()" ${c.m === RAMEN && !c.q ? 'disabled' : ''}>라멘 기준으로</button></div>`;
  }
  window.arCatM = function(v){ AR.cat.m = v; AR.cat.s = ''; drawCat(); if (AR.live) drawOut(); };
  window.arCatS = function(v){ AR.cat.s = v; if (AR.live) drawOut(); };
  window.arQ = function(v){
    clearTimeout(AR.qt);
    AR.qt = setTimeout(() => { AR.cat.q = v; if (AR.live) drawOut(); const b = document.querySelector('#ar-cat .btn'); if (b) b.disabled = AR.cat.m === RAMEN && !AR.cat.q; }, 300);
  };
  window.arCatReset = function(){ AR.cat = { m: RAMEN, s: '', q: '' }; drawCat(); if (AR.live) drawOut(); };

  window.arMode = function(m){
    AR.mode = m;
    document.querySelectorAll('#ar-mode button').forEach((b, i) => b.classList.toggle('on', ['store', 'addr'][i] === m));
    drawPick();
    if (m === 'store') { if (AR.mode === 'store' && AR.stores.length) { AR.sel = AR.stores.find(s => s.id === (AR.sel && AR.sel.id)) || AR.stores[0]; } arRun(); }
    else { AR.live = null; document.getElementById('ar-out').innerHTML = ''; drawCat(); }
  };
  window.arPick = function(id){
    AR.sel = AR.stores.find(s => String(s.id) === String(id)) || null;
    AR.cat = { m: RAMEN, s: '', q: '' };
    arRun();
  };
  window.arFind = async function(){
    const q = (document.getElementById('ar-addr')?.value || '').trim();
    if (!q) { toast('주소를 입력해주세요.'); return; }
    try {
      await loadNaver();
      if (!naver.maps.Service) throw new Error('주소 검색 도구를 불러오지 못했어요.');
      const r = await new Promise((ok, no) => naver.maps.Service.geocode({ query: q }, (st, res) => {
        if (st !== naver.maps.Service.Status.OK) return no(new Error('주소를 찾지 못했어요.'));
        const a = res.v2 && res.v2.addresses && res.v2.addresses[0];
        if (!a) return no(new Error('주소를 찾지 못했어요. 시·구부터 다시 적어주세요.'));
        ok({ id: 0, name: '후보지', addr: a.roadAddress || a.jibunAddress || q, lat: Number(a.y), lng: Number(a.x) });
      }));
      AR.sel = r; arRun();
    } catch (e) { toast(e.message || String(e)); }
  };

  /* ---------- 조회 ---------- */
  async function callRadius(lat, lng, radius){
    const { data, error } = await SB.functions.invoke('sbiz-radius', { body: { lat, lng, radius } });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (_) {}
      throw new Error(msg);
    }
    if (!data || !data.ok) throw new Error((data && data.error) || '알 수 없는 오류');
    return data;
  }
  // 기록: 수집한 날짜 목록 + 매장 주변 업소 전체(처음·마지막으로 본 날) → 어떤 업종이든 날짜별로 다시 셀 수 있음
  async function loadHist(storeId){
    const { data: d } = await SB.from('area_daily').select('d').eq('store_id', storeId).order('d');
    const days = (d || []).map(r => r.d);
    if (!days.length) return { days, shops: [] };
    let shops = [];
    for (let from = 0; from < 10000; from += 1000) {
      const { data, error } = await SB.from('area_shops').select('name,mcls,scls,dist,first_seen,last_seen')
        .eq('store_id', storeId).range(from, from + 999);
      if (error || !data) break;
      shops = shops.concat(data);
      if (data.length < 1000) break;
    }
    shops = shops.filter(r => !OWN.test(r.name || ''));
    return { days, shops, base: days[0], last: days[days.length - 1] };
  }

  async function arRun(){
    const out = document.getElementById('ar-out'); if (!out || !AR.sel) return;
    if (AR.chart) { AR.chart.destroy(); AR.chart = null; }
    const s = AR.sel;
    out.innerHTML = `<div class="card"><div class="tr-loading">상권 정보를 가져오는 중이에요...</div></div>`;
    try {
      const [live, hist] = await Promise.all([
        callRadius(s.lat, s.lng, AR.radius),
        s.id ? loadHist(s.id) : Promise.resolve(null),
        loadNaver().catch(() => null)
      ]);
      live.items.forEach(it => { it.own = OWN.test(it.name || ''); });
      AR.live = live; AR.hist = hist;
      drawCat();
      drawOut();
    } catch (e) {
      out.innerHTML = `<div class="card"><div class="empty">${ic('info')}불러오지 못했어요.<br><small>${h(e.message || e)}</small></div></div>`;
    }
  }

  /* ---------- 기록으로 날짜별 숫자 다시 세기 ---------- */
  function histCounts(fn){
    const hs = AR.hist; if (!hs || !hs.days.length) return [];
    const rows = hs.shops.filter(fn);
    return hs.days.map(d => rows.reduce((a, r) => a + (r.first_seen <= d && r.last_seen >= d ? 1 : 0), 0));
  }

  /* ---------- 결과 그리기 ---------- */
  function drawOut(){
    const out = document.getElementById('ar-out'); if (!out) return;
    if (AR.chart) { AR.chart.destroy(); AR.chart = null; }
    const s = AR.sel, L = AR.live, rad = AR.radius >= 1000 ? (AR.radius / 1000) + 'km' : AR.radius + 'm';
    const items = L.items.filter(it => !it.own);
    items.forEach(it => { it.t = tier(it); });
    const M = metrics();
    const hasHist = AR.hist && AR.hist.days.length >= 2 && AR.radius === 500;
    const cards = M.map((m, i) => {
      const v = items.filter(m.fn).length;
      let d = '';
      if (hasHist) {
        const hc = histCounts(m.fn), dv = hc[hc.length - 1] - hc[0];
        d = `<div class="d">${md(AR.hist.base)} 대비 <b class="${dv > 0 ? 'tr-up' : dv < 0 ? 'tr-down' : ''}">${dv > 0 ? '+' : ''}${dv}</b></div>`;
      }
      return `<div class="k ${i === 0 ? 'hl' : ''}"><div class="l">${i === 0 ? ic('store') : ''}${h(m.label)}</div><div class="v">${n(v)}<small>곳</small></div>${d}</div>`;
    }).join('');
    const rel = items.filter(it => it.t !== 'other').sort((a, b) => (a.t === 'hit' ? 0 : 1) - (b.t === 'hit' ? 0 : 1) || a.dist - b.dist);
    const hitN = rel.filter(it => it.t === 'hit').length;
    const nearName = isRamen() ? '일식·면' : (AR.cat.m ? '같은 분류' : '');
    out.innerHTML = `
    <div class="sum tr-asum" style="grid-template-columns:1.4fr repeat(${M.length - 1},1fr)">${cards}</div>
    <section class="card"><div class="section-title"><strong>${ic('search')}${h(s.name)} 반경 ${rad}</strong><small>${h(s.addr || '')}</small></div>
      <div class="tr-map" id="ar-map"></div>
      <div class="tr-maptool">
        <div class="tr-legend"><span><span class="tr-dot" style="background:${C_HIT}"></span>${h(catLabel())}</span>${nearName ? `<span><span class="tr-dot" style="background:${C_NEAR}"></span>${nearName}</span>` : ''}<span><span class="tr-dot" style="background:#25301f"></span>${s.id ? '우리 매장' : '후보지'}</span></div>
        <label><input type="checkbox" id="ar-all" ${AR.showAll ? 'checked' : ''} onchange="arShowAll(this.checked)"> 나머지 음식점도 보기 (${n(items.length - rel.length)}곳)</label>
      </div>
    </section>
    <section class="card"><div class="section-title"><strong>${ic('store')}${h(catLabel())} 업소</strong><small>${n(hitN)}곳${rel.length > hitN ? ` · ${nearName} ${n(rel.length - hitN)}곳` : ''} · 가까운 순</small></div>
      ${rel.length ? `<div class="tbl-wrap tr-list"><table><thead><tr><th>구분</th><th>상호</th><th>업종</th><th class="n">거리</th><th>플레이스</th></tr></thead><tbody>
        ${rel.map(it => `<tr onclick="arFocus('${h(it.id)}')" style="cursor:pointer"><td class="tr-gtag"><span style="background:${it.t === 'hit' ? C_HIT : C_NEAR}">${tagOf(it, it.t)}</span></td><td>${h(it.name)}</td><td>${h(it.scls)}</td><td class="n">${n(it.dist)}m</td><td><a class="tr-nv" href="${nvUrl(it)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">N 보기</a></td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty">${ic('info')}반경 안에 해당 업소가 없어요.</div>`}
    </section>
    ${s.id ? histHtml(M) : ''}`;
    drawMap(items);
    if (s.id) drawHist(M);
  }

  function histHtml(M){
    const hs = AR.hist, days = hs ? hs.days.length : 0;
    const pick = r => AR.allBiz || tier(r) !== 'other';
    const li = (arr, key) => {
      const a = arr.filter(pick).slice(0, 40);
      return a.length ? `<ul>${a.map(r => `<li><span>${h(r.name)} <small>${h(r.scls)} · ${n(r.dist)}m</small></span><small>${md(r[key])}</small></li>`).join('')}</ul>` : `<div class="tr-none">아직 없어요.</div>`;
    };
    const opened = hs && hs.days.length ? hs.shops.filter(r => r.first_seen > hs.base).sort((a, b) => b.first_seen.localeCompare(a.first_seen)) : [];
    const closed = hs && hs.days.length ? hs.shops.filter(r => r.last_seen < hs.last).sort((a, b) => b.last_seen.localeCompare(a.last_seen)) : [];
    return `
    <section class="card"><div class="section-title"><strong>${ic('clock')}업소 수 추이</strong><small>반경 500m · ${h(catLabel())} 기준</small></div>
      ${days >= 2 ? `<div class="tr-chart"><canvas id="ar-chart"></canvas></div>` : `<div class="tr-slot">기록이 쌓이는 중이에요. 이틀째부터 그래프가 그려져요.</div>`}
      <div class="tr-note">추이와 개업·폐업은 반경 500m 기준으로 매일 새벽 3시에 기록해요.${hs && hs.base ? ` 기록 시작일: ${hs.base}` : ''}</div>
    </section>
    <section class="card"><div class="section-title"><strong>${ic('info')}개업 · 폐업</strong>
      <label style="font-size:11px;color:#5d6656"><input type="checkbox" ${AR.allBiz ? 'checked' : ''} onchange="arAllBiz(this.checked)"> 전체 업종</label></div>
      <div class="tr-chg">
        <div><h4 class="tr-up">새로 생긴 곳</h4>${li(opened, 'first_seen')}</div>
        <div><h4 class="tr-down">사라진 곳</h4>${li(closed, 'last_seen')}</div>
      </div>
      <div class="tr-note">기록 시작일 이후에 처음 잡힌 곳을 '새로 생긴 곳', 최근 기록에서 빠진 곳을 '사라진 곳'으로 봐요. 공공데이터 반영이 실제보다 늦을 수 있어요.</div>
    </section>`;
  }
  window.arAllBiz = function(v){ AR.allBiz = v; drawOut(); };

  function drawMap(items){
    const el = document.getElementById('ar-map'); if (!el) return;
    if (!(window.naver && naver.maps)) { el.innerHTML = `<div class="empty">${ic('info')}지도를 불러오지 못했어요.<br><small>등록한 사이트 주소에서만 지도가 열려요.</small></div>`; return; }
    const s = AR.sel;
    const center = new naver.maps.LatLng(s.lat, s.lng);
    const zoom = AR.radius >= 1000 ? 15 : AR.radius >= 500 ? 16 : 17;
    AR.map = new naver.maps.Map(el, { center, zoom, scaleControl: true, mapDataControl: false, zoomControl: true, zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT } });
    AR.circle = new naver.maps.Circle({ map: AR.map, center, radius: AR.radius, strokeColor: '#c62429', strokeOpacity: .6, strokeWeight: 1.5, fillColor: '#c62429', fillOpacity: .05 });
    AR.info = new naver.maps.InfoWindow({ content: '', borderWidth: 0, backgroundColor: '#fff' });
    new naver.maps.Marker({ map: AR.map, position: center, zIndex: 300, icon: { content: '<div class="tr-pin own"></div>', anchor: new naver.maps.Point(9, 9) } });
    AR.marks = [];
    items.forEach(it => {
      const big = it.t !== 'other', col = it.t === 'hit' ? C_HIT : it.t === 'near' ? C_NEAR : C_OTHER;
      const m = new naver.maps.Marker({
        map: big || AR.showAll ? AR.map : null,
        position: new naver.maps.LatLng(it.lat, it.lng),
        zIndex: it.t === 'hit' ? 200 : big ? 100 : 1,
        icon: { content: `<div class="tr-pin ${big ? '' : 'sm'}" style="background:${col}"></div>`, anchor: new naver.maps.Point(big ? 6 : 4, big ? 6 : 4) }
      });
      naver.maps.Event.addListener(m, 'click', () => openInfo(it, m));
      AR.marks.push({ it, m, big });
    });
  }
  function openInfo(it, m){
    AR.info.setContent(`<div class="tr-iw"><b>${h(it.name)}</b><br><small>${h(it.mcls)} · ${h(it.scls)} · ${n(it.dist)}m</small><br><a class="tr-nv" href="${nvUrl(it)}" target="_blank" rel="noopener">N 네이버 플레이스</a></div>`);
    AR.info.open(AR.map, m);
  }
  window.arShowAll = function(v){
    AR.showAll = v;
    AR.marks.forEach(x => { if (!x.big) x.m.setMap(v ? AR.map : null); });
  };
  window.arFocus = function(id){
    const x = AR.marks.find(k => k.it.id === id); if (!x || !AR.map) return;
    AR.map.panTo(x.m.getPosition());
    openInfo(x.it, x.m);
    document.getElementById('ar-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  async function drawHist(M){
    const hs = AR.hist; if (!hs || hs.days.length < 2) return;
    try { await loadChart(); } catch (e) { return; }
    const cv = document.getElementById('ar-chart'); if (!cv) return;
    const ds = M.filter(m => !m.total).map(m => ({ label: m.label, data: histCounts(m.fn), borderColor: m.col, backgroundColor: m.col,
      borderWidth: 2, pointRadius: hs.days.length > 40 ? 0 : 2, tension: .2 }));
    AR.chart = new Chart(cv, {
      type: 'line', data: { labels: hs.days.map(md), datasets: ds },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
        scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 7, maxRotation: 0, font: { size: 10 }, color: '#8a9180' } },
          y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 }, color: '#8a9180' }, grid: { color: '#eef0ea' } } } }
    });
  }
})();
