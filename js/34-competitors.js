
/* ==========================================================
   경쟁사 분석 (2026-11-03) — 네이버 스마트플레이스 기준 출점·폐점 이력
   - 브랜드 등록: 이 화면에서 (관리자·본사)
   - 수집: Apps Script CompetitorScan.gs (10분마다 새 브랜드 확인, 매일 4시 전체 확인)
   - 판정: 처음 보는 매장 = 새로오픈 / 3일 미확인 = 폐점 의심 / 7일 = 폐점
   - 11/04 보완: 비음식점 자동 숨김·숨긴 매장 되돌리기 / 폐점 직접 지정(자동 확인이 안 되돌림) / 리뷰 60일 정체 표시
   ========================================================== */
(function(){
  PATHS.plus = PATHS.plus || 'M12 5v14 M5 12h14';
  PATHS.link = PATHS.link || 'M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6';
  PATHS.edit = PATHS.edit || 'M4 20h4L19 9l-4-4L4 16z M14 6l4 4';
  const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PAGE = 'comp';
  const CP = { data: null, uid: '', tab: 'list', brand: 0, st: 'all', q: '' };
  const CP_GUIDE = [
    ['처음 등록하면', '전국 시·군·구 260곳을 하나씩 검색해 지금 있는 매장을 모두 찾아요. 브랜드 하나에 15분 정도 걸려요.'],
    ['매일 새벽 3시', '찾아 둔 매장이 아직 있는지 하나씩 확인하고, 시·도 단위로 새 매장을 찾아요.'],
    ['일주일에 한 번', '브랜드마다 정해진 요일에 시·군·구까지 다시 훑어 새 출점을 꼼꼼히 찾아요.'],
    ['폐점 판정', '3일 연속 안 보이면 폐점 의심, 7일이면 폐점으로 바뀌어요. 문을 닫았는데 네이버에 남아 있는 곳은 매장을 눌러 <b>폐점 처리</b>로 직접 지정해 주세요. 직접 지정한 폐점은 자동 확인이 되돌리지 않아요.'],
    ['리뷰 정체', '리뷰가 60일 동안 하나도 안 늘면 표시돼요. 네이버에만 남은 폐점 매장일 수 있으니 확인해 보세요.'],
    ['자동 숨김', '업종이 본사·사무실·물류처럼 음식점이 아닌 곳은 자동으로 숨겨요. 목록 필터의 <b>숨긴 매장</b>에서 다시 보이게 할 수 있어요.'],
    ['왜 천천히 하나요?', '네이버가 자동 검색을 막지 않도록 검색 사이사이 쉬어 가며 해요.'],
    ['왜 10개까지인가요?', '브랜드가 늘수록 매일 검색할 양이 늘어나요. 막히지 않고 하루 안에 끝낼 수 있는 양이 브랜드 10개, 매장 700곳 정도예요.'],
    ['빠진 매장이 있다면', "네이버에 다른 이름으로 등록된 매장은 못 찾을 수 있어요. '매장 직접 추가'로 넣어 주세요."]
  ];
  const can = () => !!(SESSION.user && (SESSION.user.role === 'admin' || SESSION.user.role === 'hq'));
  const closeM = () => document.getElementById('inv-modal')?.remove();
  const md = s => { if (!s) return ''; const [y, m, d] = String(s).slice(0, 10).split('-'); return `${+m}/${+d}`; };
  const ymd = s => String(s || '').slice(0, 10).replace(/-/g, '.');
  const area = a => String(a || '').split(/\s+/).slice(0, 2).join(' ');
  const num = n => n == null ? '-' : Number(n).toLocaleString('ko-KR');
  const bName = id => ((CP.data.brands || []).find(b => b.id === id) || {}).name || '';
  const placeUrl = id => `https://m.place.naver.com/restaurant/${id}/home`;

  /* ---------- 스타일 ---------- */
  const st = document.createElement('style');
  st.textContent = `
  .cp-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
  .cp-top strong{font-size:14px;font-weight:600;color:#222b1e}
  .cp-top .cp-r{margin-left:auto;display:flex;gap:6px}
  .cp-run{font-size:12px;color:#5f6858;display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
  .cp-run b{color:#2d3726;font-weight:600}
  .cp-dot{width:8px;height:8px;border-radius:50%;background:#6f8a5a;flex:none}.cp-dot.bad{background:#c62429}
  .cp-brands{display:flex;flex-wrap:wrap;gap:8px}
  .cp-bc{border:1px solid #dcdfd6;background:#fff;border-radius:12px;padding:10px 12px;cursor:pointer;text-align:left;min-width:130px;display:flex;flex-direction:column;gap:4px;font:inherit;color:#2d3726}
  .cp-bc.on{border-color:#22311f;box-shadow:0 0 0 1px #22311f inset}
  .cp-bc.off{opacity:.55}
  .cp-bc b{font-size:13px;font-weight:600;display:flex;align-items:center;flex-wrap:wrap;gap:4px 6px;word-break:keep-all}
  .cp-bc b i{font-style:normal;margin-left:auto;color:#9aa38f;font-size:12px;padding:0 2px}
  .cp-bc b i:hover{color:#c62429}
  .cp-bc small{font-size:11px;color:#7d8574}
  .cp-bc small em{font-style:normal;color:#c62429}
  .cp-bc small u.cp-hid{text-underline-offset:2px;cursor:pointer}.cp-bc small u.cp-hid:hover{color:#2c2f28}
  .cp-tag{display:inline-block;font-size:10px;font-weight:600;border-radius:5px;padding:1px 6px;white-space:nowrap}
  .cp-tag.new{background:#e3f0dc;color:#2f5a24}.cp-tag.sus{background:#fff1d6;color:#9a6a0b}.cp-tag.cls{background:#ececec;color:#666}
  .cp-tag.add{background:#e9f1fa;color:#2c5a8a}.cp-tag.stale{background:#f4ece6;color:#8a5a3c}.cp-tag.hid{background:#f1f1ee;color:#7a7f73}.cp-tag.wait{background:#f1efe7;color:#7a6f52}.cp-tag.ret{background:#e9f1fa;color:#2c5a8a}
  .cp-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
  .cp-tabs button{border:1px solid #dcdfd6;background:#fff;border-radius:999px;padding:8px 16px;color:#5d6656;font-size:13px;cursor:pointer}
  .cp-tabs button.on{background:#22311f;border-color:#22311f;color:#fff}
  .cp-filter{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
  .cp-filter select,.cp-filter input{border:1px solid #dcdfd6;border-radius:8px;padding:7px 10px;font-size:12px;background:#fff;color:#2d3726}
  .cp-filter input{flex:1 1 140px;min-width:0}
  .cp-list{border:1px solid #eceee7;border-radius:10px;overflow:hidden}
  .cp-row{display:grid;grid-template-columns:minmax(0,1fr) 120px 92px 70px;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid #f0f1ec;cursor:pointer;font-size:12px;color:#3f4839;background:#fff}
  .cp-row:last-child{border-bottom:0}
  .cp-row:hover{background:#fafbf7}
  .cp-row.head{background:#f6f7f3;color:#6c7365;font-size:11px;cursor:default;padding:8px 12px}
  .cp-row.cls{color:#a3a89c}
  .cp-row.hd{grid-template-columns:minmax(0,1fr) 90px;cursor:default}
  .cp-row.hd .stc .bi-b{font-size:11px;padding:5px 9px;min-height:0}
  .cp-row .nm b{font-size:13px;font-weight:600;color:#222b1e;margin-right:5px}
  .cp-row.cls .nm b{color:#9aa38f;text-decoration:line-through}
  .cp-row .nm small{display:block;color:#8b9381;font-size:11px;margin-top:2px}
  .cp-row .rv{text-align:right}.cp-row .rv small{display:block;color:#6f8a5a;font-size:10px}
  .cp-row .stc{text-align:right}
  .cp-sum{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px}
  .cp-sum div{background:#f6f7f3;border-radius:10px;padding:10px 12px}
  .cp-sum span{display:block;font-size:11px;color:#7d8574}
  .cp-sum b{font-size:20px;font-weight:600;color:#222b1e}
  .cp-mon{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px}
  .cp-mon th,.cp-mon td{padding:7px 8px;border-bottom:1px solid #f0f1ec;text-align:center;color:#3f4839;font-weight:400}
  .cp-mon th{background:#f6f7f3;color:#6c7365;font-size:11px}
  .cp-mon td:first-child,.cp-mon th:first-child{text-align:left}
  .cp-day{font-size:12px;font-weight:600;color:#6c7365;margin:14px 0 6px}
  .cp-ev{display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid #eceee7;border-radius:9px;margin-bottom:6px;font-size:12px;cursor:pointer;background:#fff}
  .cp-ev b{font-weight:600;color:#222b1e;font-size:13px}
  .cp-ev small{color:#8b9381;margin-left:auto;text-align:right}
  .cp-info{display:grid;grid-template-columns:76px minmax(0,1fr);gap:8px 10px;font-size:13px;color:#2d3726;margin-bottom:14px}
  .cp-info>span:nth-child(odd){color:#8b9381;font-size:12px}
  .cp-box{background:#f6f7f3;border-radius:9px;padding:10px 12px;font-size:12px;color:#4a5244;line-height:1.7;margin-bottom:10px}
  .cp-help{font-size:11px;color:#8b9381;line-height:1.6;margin-top:4px}
  .cp-foot{font-size:11px;color:#8b9381;margin-top:10px;line-height:1.7}
  @media(max-width:640px){.cp-row{grid-template-columns:minmax(0,1fr) 64px 58px;padding:9px 10px}.cp-row .ar{display:none}.cp-bc{min-width:0;flex:1 1 44%}.cp-sum b{font-size:17px}}`;
  document.head.appendChild(st);

  /* ---------- 데이터 ---------- */
  async function load(){
    if (!SESSION.user || SESSION.mustChange || !window.SB || !can()) return null;
    if (CP.uid !== SESSION.user.uid) { CP.uid = SESSION.user.uid; CP.data = null; }
    const { data, error } = await SB.rpc('competitor_data');
    if (error) { console.warn('경쟁사 불러오기 실패', error); return null; }
    CP.data = data; return data;
  }

  /* ---------- 메뉴: 분석 시스템 아래 ---------- */
  const renderSideCp = renderSide;
  renderSide = function(active){
    renderSideCp(active);
    const nav = document.querySelector('#side .nav-items'); if (!nav) return;
    if (!nav.querySelector(':scope > .cat .soon')) nav.querySelector('.nav-soon-label')?.remove();
    if (!can()) return;
    const sub = nav.querySelector('.sub.js-tr-menu'); if (!sub) return;
    sub.querySelectorAll('.js-cp-item').forEach(e => e.remove());
    sub.insertAdjacentHTML('beforeend', `<a role="button" tabindex="0" class="js-cp-item ${active === PAGE ? 'on' : ''}" onclick="go('${PAGE}')">경쟁사 분석</a>`);
    if (active === PAGE) { sub.classList.add('open'); sub.previousElementSibling?.classList.add('open'); }
  };
  const goCp = go;
  go = function(p, t){
    if (p === PAGE) {
      if (!can()) { toast('관리자·본사 계정만 볼 수 있어요.'); return goCp('dash'); }
      document.getElementById('nt-pop')?.remove();
      closeSide(); renderSide(p); window.__curPage = p; pageCp(); window.scrollTo(0, 0); return;
    }
    return goCp(p, t);
  };

  /* ---------- 화면 ---------- */
  function pageCp(){
    document.getElementById('main').innerHTML = simpleHero(['분석 시스템', '경쟁사 분석'], 'COMPETITOR · NAVER PLACE', '경쟁사 분석',
      '경쟁 브랜드를 등록하면 네이버 플레이스 매장을 자동으로 찾고, 매일 새벽 다시 확인해 새로오픈·폐점을 쌓아요.') +
      pageGuide('cp', '처음 등록 15분 정도 소요 · 매일 새벽 3시 업데이트 · 주 1회 새 출점 확인', CP_GUIDE, '수집은 이렇게 해요') +
      `<section class="card" id="cp-brands"><div class="bi-empty">불러오는 중...</div></section>
       <section class="card" id="cp-main" style="display:none"></section>` + pageFoot();
    if (CP.data) draw();
    load().then(d => { if (window.__curPage !== PAGE) return; d ? draw() : (document.getElementById('cp-brands').innerHTML = '<div class="bi-empty">경쟁사 정보를 불러오지 못했어요. 새로고침해 주세요.</div>'); });
  }

  function brandState(b){
    if (!b.active) return '<span class="cp-tag cls">끔</span>';
    if (!b.swept) return b.started ? `<span class="cp-tag wait">매장 찾는 중${b.progress != null ? ' ' + b.progress + '%' : ''}</span>` : '<span class="cp-tag wait">곧 찾기 시작</span>';
    return '';
  }

  function draw(){
    const d = CP.data; if (!d || !document.getElementById('cp-brands')) return;
    const brands = d.brands || [];
    if (CP.brand && !brands.find(b => b.id === CP.brand)) CP.brand = 0;
    const run = d.run;
    const runTxt = !run ? '아직 자동 확인 전이에요'
      : `마지막 자동 확인 <b>${md(run.d)}</b> · 매장 확인 <b>${run.ok}</b>/${run.total}` + (run.closed ? '' : (run.total ? ' · <span style="color:#a3262c">검색 실패가 많아 이날은 폐점 판정을 건너뛰었어요</span>' : ''));
    document.getElementById('cp-brands').innerHTML = `
      <div class="cp-top"><strong>경쟁 브랜드 ${brands.length}</strong><span class="cp-r"><button class="bi-b" onclick="cpBrand(0)">${ic('plus')}브랜드 추가</button></span></div>
      <div class="cp-run"><i class="cp-dot ${run && !run.closed && run.total ? 'bad' : ''}"></i><span>${runTxt}</span></div>
      ${brands.length ? `<div class="cp-brands">${brands.map(b => `<button class="cp-bc ${CP.brand === b.id ? 'on' : ''} ${b.active ? '' : 'off'}" onclick="cpPick(${b.id})">
          <b>${h(b.name)} ${brandState(b)}<i onclick="event.stopPropagation();cpBrand(${b.id})" title="수정">✎</i></b>
          <small>운영 ${b.open}곳${b.closed ? ` · <em>폐점 ${b.closed}곳</em>` : ''}${b.hid ? ` · <u class="cp-hid" onclick="event.stopPropagation();cpHid(${b.id})">숨김 ${b.hid}</u>` : ''}</small></button>`).join('')}</div>`
        : `<div class="bi-empty">아직 등록된 브랜드가 없어요.<br><b>브랜드 추가</b>를 눌러 경쟁 브랜드 이름을 넣어 주세요. 몇 분 안에 매장 찾기가 시작돼요.</div>`}`;
    const main = document.getElementById('cp-main');
    if (!brands.length) { main.style.display = 'none'; return; }
    main.style.display = '';
    const stores = (d.stores || []).filter(s => !CP.brand || s.brand === CP.brand);
    main.innerHTML = `<div class="cp-tabs"><button class="${CP.tab === 'list' ? 'on' : ''}" onclick="cpTab('list')">매장 목록 ${stores.filter(s => s.status !== '폐점').length}</button><button class="${CP.tab === 'hist' ? 'on' : ''}" onclick="cpTab('hist')">출점·폐점 이력</button></div><div id="cp-body"></div>`;
    CP.tab === 'hist' ? drawHist() : drawList();
  }

  function stTag(s){
    if (s.status === '폐점') return `<span class="cp-tag cls">폐점 ${md(s.closed_at)}</span>`;
    if (s.status === '폐점의심') return `<span class="cp-tag sus">폐점 의심</span>`;
    if (s.stale) return `<span class="cp-tag stale">리뷰 정체</span>`;
    if (s.is_new) return `<span class="cp-tag new">새로오픈</span>`;
    return '<span style="color:#9aa38f">운영 중</span>';
  }

  function drawList(){
    const d = CP.data, q = CP.q.replace(/\s/g, '');
    if (CP.st === 'hidden') return drawHidden();
    let list = (d.stores || []).filter(s => !CP.brand || s.brand === CP.brand);
    list = list.filter(s => CP.st === 'all' ? true : CP.st === 'new' ? s.is_new : CP.st === 'open' ? s.status !== '폐점' : CP.st === 'stale' ? s.stale : s.status === CP.st);
    if (q) list = list.filter(s => (s.name + s.addr).replace(/\s/g, '').includes(q));
    const rank = s => s.status === '폐점의심' ? 0 : s.stale ? 1 : s.is_new ? 2 : s.status === '폐점' ? 4 : 3;
    list.sort((a, b) => rank(a) - rank(b) || a.brand - b.brand || a.addr.localeCompare(b.addr, 'ko'));
    const opts = CP_OPTS();
    document.getElementById('cp-body').innerHTML = `
      <div class="cp-filter"><select onchange="cpSt(this.value)">${opts.map(([v, t]) => `<option value="${v}" ${CP.st === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <input type="search" placeholder="매장명·지역 검색" value="${h(CP.q)}" oninput="cpQ(this.value)">
        <button class="bi-b" onclick="cpAdd()">${ic('plus')}매장 직접 추가</button></div>
      ${list.length ? `<div class="cp-list"><div class="cp-row head"><span>매장</span><span class="ar">지역</span><span class="rv">리뷰</span><span class="stc">상태</span></div>
        ${list.map(s => `<div class="cp-row ${s.status === '폐점' ? 'cls' : ''}" onclick="cpStore('${h(s.id)}')">
          <span class="nm"><b>${h(s.name || '(이름 없음)')}</b>${s.manual ? '<span class="cp-tag add">직접 추가</span>' : ''}<small>${CP.brand ? '' : h(bName(s.brand)) + ' · '}${h(area(s.addr)) || '주소 미확인'}</small></span>
          <span class="ar">${h(area(s.addr)) || '-'}</span>
          <span class="rv">${num(s.rev)}${s.rev30 > 0 ? `<small>30일 +${num(s.rev30)}</small>` : ''}</span>
          <span class="stc">${stTag(s)}</span></div>`).join('')}</div>`
        : `<div class="bi-empty">${(d.stores || []).length ? '조건에 맞는 매장이 없어요.' : '아직 찾은 매장이 없어요. 브랜드를 등록하면 몇 분 안에 찾기 시작하고, 1시간 정도면 여기에 다 채워져요.'}</div>`}
      <div class="cp-foot">처음 찾은 매장은 '기존 매장'으로 깔고, 그 뒤 새로 잡히는 매장만 새로오픈으로 기록해요. 리뷰가 50개 넘는 매장이 늦게 잡히면 원래 있던 매장으로 보고 '추가 발견'으로 남겨요. 3일 연속 안 잡히면 폐점 의심, 7일이면 폐점이에요. 네이버에 남아 있는 폐점 매장은 매장을 눌러 직접 폐점 처리해 주세요.</div>`;
  }

  function CP_OPTS(){
    const hid = (CP.data.hidden || []).filter(s => !CP.brand || s.brand === CP.brand).length;
    return [['all', '전체'], ['open', '운영 중'], ['new', '새로오픈'], ['폐점의심', '폐점 의심'], ['stale', '리뷰 정체'], ['폐점', '폐점'], ['hidden', `숨긴 매장 ${hid}`]];
  }

  function drawHidden(){
    const d = CP.data, q = CP.q.replace(/\s/g, '');
    let list = (d.hidden || []).filter(s => !CP.brand || s.brand === CP.brand);
    if (q) list = list.filter(s => (s.name + s.addr).replace(/\s/g, '').includes(q));
    const opts = CP_OPTS();
    document.getElementById('cp-body').innerHTML = `
      <div class="cp-filter"><select onchange="cpSt(this.value)">${opts.map(([v, t]) => `<option value="${v}" ${CP.st === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <input type="search" placeholder="매장명·지역 검색" value="${h(CP.q)}" oninput="cpQ(this.value)"></div>
      ${list.length ? `<div class="cp-list"><div class="cp-row head hd"><span>매장</span><span class="stc"></span></div>
        ${list.map(s => `<div class="cp-row hd">
          <span class="nm"><b>${h(s.name || '(이름 없음)')}</b><span class="cp-tag hid">${s.why === 'auto' ? '자동 숨김' : '직접 뺌'}</span><small>${CP.brand ? '' : h(bName(s.brand)) + ' · '}${h(s.cat) || '업종 미확인'} · ${h(area(s.addr)) || '주소 미확인'}</small></span>
          <span class="stc"><button class="bi-b" onclick="cpUnhide('${h(s.id)}')">다시 보이기</button></span></div>`).join('')}</div>`
        : `<div class="bi-empty">숨긴 매장이 없어요.</div>`}
      <div class="cp-foot">업종이 본사·사무실·물류처럼 음식점이 아닌 곳은 자동으로 숨겨요. 다시 보이게 한 매장은 이후 자동으로 숨기지 않아요.</div>`;
  }

  function drawHist(){
    const d = CP.data, today = d.today;
    const ev = (d.events || []).filter(e => !CP.brand || e.brand === CP.brand);
    const ym = s => String(s).slice(0, 7), thisM = ym(today);
    const cnt = (m, t) => ev.filter(e => ym(e.d) === m && e.type === t).length;
    const months = [...Array(6)].map((_, i) => { const dt = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1 - i, 1)); return dt.toISOString().slice(0, 7); });
    const shown = ev.filter(e => e.type !== '폐점의심' || (d.stores || []).find(s => s.id === e.id && s.status === '폐점의심'));
    const groups = {}; shown.slice(0, 200).forEach(e => (groups[e.d] = groups[e.d] || []).push(e));
    const tag = t => ({ '새로오픈': '<span class="cp-tag new">새로오픈</span>', '추가발견': '<span class="cp-tag add">추가 발견</span>', '폐점의심': '<span class="cp-tag sus">폐점 의심</span>', '폐점': '<span class="cp-tag cls">폐점</span>', '복귀': '<span class="cp-tag ret">다시 확인됨</span>' }[t] || h(t));
    document.getElementById('cp-body').innerHTML = `
      <div class="cp-sum"><div><span>이번 달 새로오픈</span><b>${cnt(thisM, '새로오픈')}</b></div><div><span>이번 달 폐점</span><b>${cnt(thisM, '폐점')}</b></div><div><span>지금 폐점 의심</span><b>${(d.stores || []).filter(s => (!CP.brand || s.brand === CP.brand) && s.status === '폐점의심').length}</b></div></div>
      <table class="cp-mon"><thead><tr><th>월</th><th>새로오픈</th><th>폐점</th><th>순증</th></tr></thead><tbody>
        ${months.map(m => { const o = cnt(m, '새로오픈'), c = cnt(m, '폐점'); return `<tr><td>${+m.slice(5)}월</td><td>${o || '-'}</td><td>${c || '-'}</td><td>${o - c > 0 ? '+' : ''}${o - c || '-'}</td></tr>`; }).join('')}
      </tbody></table>
      ${Object.keys(groups).length ? Object.keys(groups).map(day => `<div class="cp-day">${ymd(day)}</div>${groups[day].map(e => `
        <div class="cp-ev" onclick="cpStore('${h(e.id)}')">${tag(e.type)}<b>${h(e.name)}</b><small>${CP.brand ? '' : h(bName(e.brand)) + '<br>'}${h(area(e.addr))}</small></div>`).join('')}`).join('')
        : `<div class="bi-empty">아직 쌓인 이력이 없어요. 처음 찾은 매장은 기존 매장으로 깔리고, 다음 날부터 변화가 생기면 여기에 쌓여요.</div>`}`;
  }

  window.cpTab = t => { CP.tab = t; draw(); };
  window.cpPick = id => { CP.brand = CP.brand === id ? 0 : id; draw(); };
  window.cpSt = v => { CP.st = v; drawList(); };
  // 11/07: 카드의 '숨김 N'을 누르면 그 브랜드의 숨긴 매장 목록을 바로 엶
  window.cpHid = id => { CP.brand = id; CP.tab = 'list'; CP.st = 'hidden'; draw(); };
  window.cpQ = v => { CP.q = v; clearTimeout(CP.qt); CP.qt = setTimeout(() => { drawList(); const i = document.querySelector('.cp-filter input'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); };

  /* ---------- 매장 상세 ---------- */
  window.cpStore = function(id){
    const s = (CP.data.stores || []).find(x => x.id === id); if (!s) return;
    iModal(s.name || '매장', `
      <div style="margin-bottom:12px"><a class="bi-b" href="${placeUrl(s.id)}" target="_blank" rel="noopener">${ic('link')}네이버 플레이스 열기</a></div>
      <div class="cp-info">
        <span>브랜드</span><span>${h(bName(s.brand))}</span>
        <span>상태</span><span>${stTag(s)}${s.miss && s.status !== '폐점' ? ` <span style="color:#9a6a0b;font-size:12px">${s.miss}일째 안 잡힘</span>` : ''}</span>
        <span>업종</span><span>${h(s.cat) || '-'}</span>
        <span>전화</span><span>${h(mmTel(s.tel)) || '-'}</span>
        <span>주소</span><span>${h(s.addr) || '-'}</span>
        <span>리뷰</span><span>${num(s.rev)}${s.rev30 != null ? ` <span style="color:#6f8a5a;font-size:12px">(30일 ${s.rev30 >= 0 ? '+' : ''}${num(s.rev30)})</span>` : ''}</span>
        <span>처음 확인</span><span>${ymd(s.first)}${s.base ? ' <span style="color:#9aa38f;font-size:12px">(등록 당시 기존 매장)</span>' : ''}</span>
        <span>마지막 확인</span><span>${ymd(s.last) || '-'}</span>
      </div>
      ${s.stale ? '<div class="cp-box">리뷰가 60일 동안 늘지 않았어요. 네이버에만 남아 있는 폐점 매장일 수 있으니 확인해 보세요.</div>' : ''}
      ${s.cm ? '<div class="cp-box">직접 폐점으로 지정한 매장이에요. 네이버에 남아 있어도 자동 확인이 운영 중으로 되돌리지 않아요.</div>' : ''}
      <div class="cp-help">문을 닫았는데 네이버에 남아 있다면 <b>폐점 처리</b>, 다른 가게가 잘못 잡혔다면 <b>목록에서 빼기</b>를 눌러 주세요.</div>`, closeM, '닫기');
    const foot = document.querySelector('#inv-modal .im-foot');
    foot.querySelector('.btn.ghost')?.remove();
    const closeBtn = s.cm ? `<button class="btn ghost" onclick="cpClose('${h(s.id)}', false)">폐점 취소</button>`
      : s.status === '폐점' ? '' : `<button class="btn ghost" style="color:#a3262c" onclick="cpClose('${h(s.id)}', true)">폐점 처리</button>`;
    foot.insertAdjacentHTML('afterbegin', `<div style="margin-right:auto;display:flex;gap:6px;flex-wrap:wrap">${closeBtn}<button class="btn ghost" onclick="cpHide('${h(s.id)}')">목록에서 빼기</button></div>`);
  };
  window.cpClose = async function(id, on){
    if (!confirm(on ? '이 매장을 폐점으로 지정할까요? 네이버에 남아 있어도 자동 확인이 되돌리지 않아요.' : '폐점 지정을 취소하고 운영 중으로 되돌릴까요?')) return;
    const { error } = await SB.rpc('competitor_store_close', { p_id: id, p_close: on });
    if (error) return toast('처리하지 못했어요: ' + error.message);
    closeM(); toast(on ? '폐점으로 지정했어요.' : '운영 중으로 되돌렸어요.'); await load(); draw();
  };
  window.cpUnhide = async function(id){
    const { error } = await SB.rpc('competitor_store_unhide', { p_id: id });
    if (error) return toast('처리하지 못했어요: ' + error.message);
    toast('다시 보이게 했어요.'); await load(); draw();
  };
  window.cpHide = async function(id){
    if (!confirm('이 매장을 목록에서 뺄까요? 이력도 함께 숨겨져요.')) return;
    const { error } = await SB.rpc('competitor_store_hide', { p_id: id });
    if (error) return toast('처리하지 못했어요: ' + error.message);
    closeM(); toast('목록에서 뺐어요.'); await load(); draw();
  };

  /* ---------- 브랜드 추가 · 수정 ---------- */
  window.cpBrand = function(id){
    const b = id ? (CP.data.brands || []).find(x => x.id === id) : null;
    iModal(b ? `브랜드 수정 · ${b.name}` : '경쟁 브랜드 추가', `<div class="im-grid">
      <div class="f wide"><label>브랜드명</label><input id="cp-bn" maxlength="40" value="${h(b ? b.name : '')}" placeholder="예: 멘야산다이메"></div>
      <div class="f wide"><label>검색어 <span>선택</span></label><input id="cp-bk" maxlength="40" value="${h(b && b.keyword !== b.name ? b.keyword : '')}" placeholder="비워 두면 브랜드명으로 찾아요">
        <div class="cp-help">네이버 지도에 뜨는 매장 이름 앞부분과 같아야 해요. 예) 홍콩반점은 '홍콩반점0410'. 이 글자가 들어간 매장만 모아요.</div></div>
      ${b ? `<div class="f"><label>자동 확인</label><select id="cp-ba"><option value="1">켜기</option><option value="0" ${b.active ? '' : 'selected'}>끄기</option></select></div>` : ''}
    </div>${b ? '' : '<div class="cp-box">저장하면 10분 안에 전국 매장 찾기가 시작되고, 20~30분 뒤 매장 목록이 채워져요. 처음 찾은 매장은 기존 매장으로 깔려요.</div>'}`, async () => {
      const p = { id: b ? b.id : null, name: document.getElementById('cp-bn').value.trim(), keyword: document.getElementById('cp-bk').value.trim() };
      if (b) p.active = document.getElementById('cp-ba').value === '1';
      if (!p.name) return toast('브랜드명을 입력해 주세요.');
      if (b && (p.keyword || p.name) !== b.keyword && !confirm('검색어가 바뀌면 매장을 처음부터 다시 찾아요. 진행할까요?')) return;
      const { error } = await SB.rpc('competitor_brand_save', { p });
      if (error) return toast('저장하지 못했어요: ' + error.message);
      closeM(); toast(b ? '저장했어요.' : '등록했어요. 10분 안에 매장 찾기를 시작해요.'); await load(); draw();
    }, b ? '저장' : '등록');
    if (b) {
      const foot = document.querySelector('#inv-modal .im-foot');
      foot.insertAdjacentHTML('afterbegin', `<div style="margin-right:auto"><button class="btn ghost" style="color:#a3262c" onclick="cpBrandDel(${b.id})">삭제</button></div>`);
    }
  };
  window.cpBrandDel = async function(id){
    if (!confirm('이 브랜드를 삭제할까요? 모은 매장과 이력이 모두 지워져요. 잠시 멈추려면 삭제 대신 자동 확인을 끄세요.')) return;
    const { error } = await SB.rpc('competitor_brand_delete', { p_id: id });
    if (error) return toast('삭제하지 못했어요: ' + error.message);
    closeM(); toast('삭제했어요.'); await load(); draw();
  };

  /* ---------- 매장 직접 추가 ---------- */
  window.cpAdd = function(){
    const brands = CP.data.brands || [];
    iModal('매장 직접 추가', `<div class="im-grid">
      <div class="f wide"><label>브랜드</label><select id="cp-ab">${brands.map(b => `<option value="${b.id}" ${CP.brand === b.id ? 'selected' : ''}>${h(b.name)}</option>`).join('')}</select></div>
      <div class="f wide"><label>네이버 플레이스 링크</label><input id="cp-ap" maxlength="400" placeholder="https://map.naver.com/p/entry/place/1234567...">
        <div class="cp-help">네이버 지도에서 매장을 열고 주소창 링크를 복사해 붙여 주세요(숫자가 들어간 주소). naver.me로 시작하는 짧은 주소는 안 돼요.</div></div>
      <div class="f wide"><label>매장 이름</label><input id="cp-an" maxlength="60" placeholder="네이버에 뜨는 이름 그대로 (예: 멘야산다이메 대전점)">
        <div class="cp-help">매일 이 이름으로 검색해서 영업 중인지 확인해요.</div></div>
    </div>`, async () => {
      const p = { brand_id: document.getElementById('cp-ab').value, place: document.getElementById('cp-ap').value.trim(), name: document.getElementById('cp-an').value.trim() };
      const { error } = await SB.rpc('competitor_store_add', { p });
      if (error) return toast(error.message);
      closeM(); toast('추가했어요.'); await load(); draw();
    }, '추가');
  };

  // 2분마다 화면이 열려 있으면 새로고침 (매장 찾는 중일 때 채워지는 걸 보여줌)
  setInterval(() => { if (!document.hidden && window.__curPage === PAGE && !document.getElementById('inv-modal')) load().then(d => d && draw()); }, 120000);
})();
