
/* ==========================================================
   가맹점 현황 (2026-11-03) — 네이버 검색 결과 기준 자동 확인
   - 수집: Apps Script NaverHoliday.gs (매일 7시·18시) → Supabase store_naver
   - 보기·수정: 관리자·본사만 (점주 연락처는 개인정보)
   - 정기휴무 = 요일, 임시휴무 = 날짜가 붙은 칸(예: 화(11/3))
   ========================================================== */
(function(){
  PATHS.cal = PATHS.cal || 'M3 5h18v16H3z M3 10h18 M8 3v4 M16 3v4';
  PATHS.phone = PATHS.phone || 'M5 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2';
  PATHS.msg = 'M4 5h16v11H9l-5 4z';
  PATHS.link = PATHS.link || 'M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6';
  PATHS.edit = PATHS.edit || 'M4 20h4L19 9l-4-4L4 16z M14 6l4 4';
  PATHS.plus = PATHS.plus || 'M12 5v14 M5 12h14';
  const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PAGE = 'nh-week';
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const NH = { data: null, uid: '', week: 0, q: '' };
  const can = () => !!(SESSION.user && (SESSION.user.role === 'admin' || SESSION.user.role === 'hq'));
  const closeM = () => document.getElementById('inv-modal')?.remove();

  /* ---------- 날짜 도우미 (KST 기준 문자열 YYYY-MM-DD) ---------- */
  const D = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const S = dt => dt.toISOString().slice(0, 10);
  const add = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return S(d); };
  const dow = s => DOW[D(s).getUTCDay()];
  const md = s => { const d = D(s); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate(); };
  const monday = s => { const k = D(s).getUTCDay(); return add(s, k === 0 ? -6 : 1 - k); };
  const kst = iso => { if (!iso) return ''; const d = new Date(new Date(iso).getTime() + 9 * 3600e3); return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
  const hoursAgo = iso => iso ? (Date.now() - new Date(iso).getTime()) / 3600e3 : Infinity;
  const telNo = p => String(p || '').replace(/[^0-9]/g, '');

  /* ---------- 매장 하루 상태 ---------- */
  function closedOn(s, day){
    if (s.skip) return null;
    const dt = (s.days || []).find(x => x.day === day);
    if (dt) return { kind: 'tmp', text: dt.descr || '휴무' };
    if ((s.regular || []).includes(dow(day))) return { kind: 'reg', text: '정기휴무' };
    return null;
  }
  const stale = s => !s.skip && (!!s.err || hoursAgo(s.checked) > 24);
  const changedRecent = s => s.changed && hoursAgo(s.changed) < 72;
  const checkedToday = s => (s.checks || []).find(c => c.day === NH.data.today);

  /* ---------- 스타일 ---------- */
  const st = document.createElement('style');
  st.textContent = `
  .nh-status{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;color:#5f6858}
  .nh-status b{color:#2d3726;font-weight:600}
  .nh-dot{width:8px;height:8px;border-radius:50%;background:#6f8a5a;flex:none}
  .nh-dot.bad{background:#c62429}
  .nh-status .nh-r{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
  .nh-warn{margin-top:10px;background:#fbeeee;color:#8e2226;border-radius:8px;padding:9px 12px;font-size:12px;line-height:1.6}
  .nh-today h3{font-size:13px;font-weight:600;margin:0 0 10px;color:#2d3726;display:flex;align-items:center;gap:8px}
  .nh-today h3 small{font-weight:400;color:#8b9381;font-size:12px}
  .nh-chips{display:flex;flex-wrap:wrap;gap:6px}
  .nh-chip{border:0;border-radius:999px;padding:7px 12px;font-size:12px;cursor:pointer;background:#22311f;color:#fff}
  .nh-chip.tmp{background:#c62429}
  .nh-chip em{font-style:normal;color:inherit;opacity:.75;margin-left:5px;font-size:11px}
  .nh-none{font-size:12px;color:#8b9381}
  .nh-wk{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}
  .nh-wk strong{font-size:14px;font-weight:600;color:#222b1e;min-width:150px}
  .nh-wk .nh-legend{margin-left:auto;display:flex;gap:10px;font-size:11px;color:#7d8574;align-items:center}
  .nh-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}
  .nh-scroll{overflow-x:auto;border:1px solid #eceee7;border-radius:10px}
  .nh-t{width:100%;border-collapse:separate;border-spacing:0;font-size:12px;min-width:560px}
  .nh-t th,.nh-t td{position:static;padding:0;border-bottom:1px solid #f0f1ec;background:#fff;white-space:nowrap;font-weight:400;color:#3f4839}
  .nh-t thead th{background:#f6f7f3;color:#6c7365;font-size:11px;text-align:center;padding:8px 2px;line-height:1.35}
  .nh-t thead th.today{background:#22311f;color:#fff}
  .nh-t thead th:first-child{text-align:left;padding-left:12px}
  .nh-t th.nm,.nh-t td.nm{position:sticky;left:0;z-index:1;text-align:left;border-right:1px solid #f0f1ec}
  .nh-t td.nm{padding:9px 10px 9px 12px;cursor:pointer;min-width:118px}
  .nh-t td.nm b{font-weight:600;color:#222b1e;font-size:13px}
  .nh-t td.nm:hover b{color:#c62429}
  .nh-t td.nm small{display:block;color:#8b9381;font-size:10px;margin-top:2px}
  .nh-t td.nm .nh-badge{display:inline-block;font-size:10px;font-weight:600;border-radius:5px;padding:1px 6px;margin-left:5px;vertical-align:1px}
  .nh-badge.chg{background:#fff1d6;color:#9a6a0b}.nh-badge.dlv{background:#e9f1fa;color:#2c5a8a}.nh-badge.bad{background:#fbeeee;color:#a3262c}.nh-badge.skip{background:#ececec;color:#777}
  .nh-t td.c{text-align:center;padding:4px 2px;width:12%}
  .nh-t td.c span{display:block;border-radius:6px;padding:6px 2px;font-size:11px;font-weight:600}
  .nh-t td.c span.reg{background:#22311f;color:#fff}
  .nh-t td.c span.tmp{background:#c62429;color:#fff}
  .nh-t td.c span.past{opacity:.45}
  .nh-t td.c.today{background:#f7f8f3}
  .nh-t td.c .nh-dash{color:#d4d8cc;font-weight:400}
  .nh-t tr.skip td{color:#a3a89c}
  .nh-t td.span{text-align:center;color:#9aa38f;font-size:11px}
  .nh-t td.span button{border:1px solid #dcdfd6;background:#fff;border-radius:7px;padding:4px 9px;font-size:11px;color:#3f4839;cursor:pointer}
  .nh-t td.span button.on{background:#e8f0df;border-color:#b9cba6;color:#33502a}
  .nh-t .bi-b.on{background:#e8f0df;border-color:#b9cba6;color:#33502a}
  .nh-foot{font-size:11px;color:#8b9381;margin-top:10px;line-height:1.7}
  .nh-info{display:grid;grid-template-columns:76px minmax(0,1fr);gap:8px 10px;font-size:13px;color:#2d3726;margin-bottom:14px}
  .nh-info>span:nth-child(odd){color:#8b9381;font-size:12px}
  .nh-acts{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
  .nh-acts>*{flex:1 1 28%;justify-content:center;padding:10px 6px}
  .nh-box{background:#f6f7f3;border-radius:9px;padding:10px 12px;font-size:12px;color:#4a5244;line-height:1.7;margin-bottom:10px}
  .nh-box b{color:#2d3726}
  .nh-box.chg{background:#fff6e4}
  .nh-hrs{display:grid;grid-template-columns:52px 1fr;gap:3px 8px;font-size:12px}
  .nh-help{font-size:11px;color:#8b9381;line-height:1.6;margin-top:4px}
  .nh-bulk textarea{min-height:180px;font-size:12px;white-space:pre}
  @media(max-width:640px){.nh-wk .nh-legend{margin-left:0;width:100%}.nh-wk strong{min-width:0;font-size:13px}.nh-t{min-width:0;table-layout:fixed}.nh-t th.nm,.nh-t td.nm{width:88px;min-width:0}.nh-t td.nm{padding:8px 4px 8px 8px}.nh-t td.nm b{font-size:12px;display:block;overflow:hidden;text-overflow:ellipsis}.nh-t td.nm .nh-badge{margin:3px 0 0;display:inline-block}.nh-t td.nm small{overflow:hidden;text-overflow:ellipsis}.nh-t td.c{width:auto;padding:3px 1px}.nh-t td.c span{font-size:10px;padding:6px 0}.nh-t thead th{font-size:10px;padding:7px 0}.nh-t thead th.nm{padding-left:8px}.nh-t td.c .bi-b{padding:3px 2px!important;font-size:9px!important;white-space:normal}}`;
  document.head.appendChild(st);

  /* ---------- 데이터 ---------- */
  async function load(){
    if (!SESSION.user || SESSION.mustChange || !window.SB || !can()) return null;
    if (NH.uid !== SESSION.user.uid) { NH.uid = SESSION.user.uid; NH.data = null; }
    const { data, error } = await SB.rpc('naver_hours_data');
    if (error) { console.warn('휴무 불러오기 실패', error); return null; }
    NH.data = data; return data;
  }

  /* ---------- 메뉴: 대시보드 바로 아래 ---------- */
  const renderSideNh = renderSide;
  renderSide = function(active){
    renderSideNh(active);
    const nav = document.querySelector('#side .nav-items'); if (!nav || !can()) return;
    nav.querySelectorAll('.js-nh-menu').forEach(e => e.remove());
    const html = `<button class="cat js-nh-menu ${active === PAGE ? 'open' : ''}" onclick="go('${PAGE}')">${ic('store')}가맹점 현황</button>`;
    const cats = [...nav.querySelectorAll(':scope > .cat')];
    const lab = b => [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    const unitEnd = b => (b.nextElementSibling && b.nextElementSibling.classList.contains('sub')) ? b.nextElementSibling : b;
    const dash = cats.find(b => (b.getAttribute('onclick') || '').includes("go('dash')"));
    // 공지사항: 대시보드 바로 아래 (맨 위)
    const nt = nav.querySelector(':scope > .js-nt-menu');
    if (dash && nt) dash.insertAdjacentElement('afterend', nt);
    // 가맹점 현황: 매출 관리 바로 아래 (없으면 공지사항 아래)
    const sales = cats.find(b => lab(b) === '매출 관리');
    if (sales) unitEnd(sales).insertAdjacentHTML('afterend', html);
    else if (nt) nt.insertAdjacentHTML('afterend', html);
    else if (dash) dash.insertAdjacentHTML('afterend', html); else nav.insertAdjacentHTML('afterbegin', html);
  };
  const goNh = go;
  go = function(p, t){
    if (p === PAGE) {
      if (!can()) { toast('관리자·본사 계정만 볼 수 있어요.'); return goNh('dash'); }
      document.getElementById('nt-pop')?.remove();
      closeSide(); renderSide(p); window.__curPage = p; pageNh(); window.scrollTo(0, 0); return;
    }
    return goNh(p, t);
  };

  /* ---------- 화면 ---------- */
  function pageNh(){
    document.getElementById('main').innerHTML = simpleHero(['가맹점 현황'], 'FRANCHISE STATUS', '가맹점 현황',
      '네이버 스마트플레이스에 등록된 휴무를 하루 두 번(오전 7시·저녁 6시) 자동으로 확인해요. 매장 이름을 누르면 점주 연락처와 플레이스가 열려요.') +
      `<section class="card" id="nh-status"><div class="bi-empty">불러오는 중...</div></section>
       <section class="card nh-today" id="nh-today" style="display:none"></section>
       <section class="card" id="nh-week" style="display:none"></section>` + pageFoot();
    if (NH.data) draw();
    load().then(d => { if (window.__curPage !== PAGE) return; d ? draw() : (document.getElementById('nh-status').innerHTML = '<div class="bi-empty">휴무 정보를 불러오지 못했어요. 새로고침해 주세요.</div>'); });
  }

  function sortStores(list, day){
    const score = s => (s.skip ? 100 : 0) - (changedRecent(s) ? 8 : 0) - (closedOn(s, day) ? 4 : 0) - (stale(s) ? 2 : 0);
    return [...list].sort((a, b) => score(a) - score(b) || a.id - b.id);
  }

  function draw(){
    const d = NH.data; if (!d || !document.getElementById('nh-status')) return;
    const list = d.stores || [], today = d.today;
    const live = list.filter(s => !s.skip);
    const bad = live.filter(stale);
    const lastOld = hoursAgo(d.last) > 24;

    // 상태줄
    document.getElementById('nh-status').innerHTML = `<div class="nh-status"><i class="nh-dot ${lastOld || bad.length ? 'bad' : ''}"></i>
      <span>마지막 수집 <b>${d.last ? kst(d.last) : '아직 없음'}</b></span><span>확인 매장 <b>${live.length - bad.length}</b> / ${live.length}</span>
      <span class="nh-r"><button class="bi-b" onclick="nhBulk()">${ic('plus')}명단 한 번에 넣기</button></span></div>
      ${lastOld ? `<div class="nh-warn">하루 넘게 수집이 안 됐어요. 오늘은 아래 표의 각 매장 줄에서 <b>직접 확인</b>을 눌러 체크해 주세요. Apps Script의 NaverHoliday 자동 실행을 확인해 보세요.</div>`
        : bad.length ? `<div class="nh-warn">수집 안 된 매장 ${bad.length}곳: ${bad.map(s => h(s.name)).join(', ')} — 매장 이름을 눌러 이유를 확인하고, 오늘은 직접 확인으로 체크해 주세요.</div>` : ''}`;

    // 오늘 휴무
    const off = live.map(s => [s, closedOn(s, today)]).filter(x => x[1]);
    const tb = document.getElementById('nh-today'); tb.style.display = '';
    tb.innerHTML = `<h3>오늘 휴무 <small>${md(today)} (${dow(today)}) · ${off.length}곳</small></h3>` + (off.length
      ? `<div class="nh-chips">${off.map(([s, c]) => `<button class="nh-chip ${c.kind}" onclick="nhStore(${s.id})">${h(s.name)}<em>${c.kind === 'tmp' ? '임시' : '정기'}</em></button>`).join('')}</div>`
      : `<div class="nh-none">오늘 쉬는 매장이 없어요.</div>`);

    // 주간 표
    const mon = add(monday(today), NH.week * 7), days = [...Array(7)].map((_, i) => add(mon, i));
    const wb = document.getElementById('nh-week'); wb.style.display = '';
    const rows = sortStores(list, today).map(s => {
      const tags = (s.delivery ? '<span class="nh-badge dlv">딜리버리</span>' : '') + (changedRecent(s) ? '<span class="nh-badge chg">변경됨</span>' : '') + (s.skip ? '<span class="nh-badge skip">확인 제외</span>' : stale(s) ? '<span class="nh-badge bad">수집 안 됨</span>' : '');
      const sub = s.skip ? '네이버 확인 제외' : (s.owner ? h(s.owner) : '점주 미입력');
      const head = `<td class="nm" onclick="nhStore(${s.id})"><b>${h(s.name)}</b>${tags}<small>${sub}</small></td>`;
      if (s.skip) return `<tr class="skip">${head}<td class="span" colspan="7">딜리버리 매장 — 네이버 플레이스 없음</td></tr>`;
      if (stale(s) && NH.week === 0) {
        const ck = checkedToday(s);
        return `<tr>${head}${days.map(day => cell(s, day, today)).join('').replace(/<td class="c today">[\s\S]*?<\/td>/, `<td class="c today"><button class="bi-b ${ck ? 'on' : ''}" style="padding:4px 6px;font-size:10px" onclick="nhCheck(${s.id})" title="${ck ? h(ck.by) + ' 확인' : '오늘 직접 확인하면 눌러 주세요'}">${ck ? '확인함' : '직접 확인'}</button></td>`)}</tr>`;
      }
      return `<tr>${head}${days.map(day => cell(s, day, today)).join('')}</tr>`;
    }).join('');
    wb.innerHTML = `<div class="nh-wk"><button class="bi-b" onclick="nhWeek(-1)" aria-label="지난주">‹</button>
        <strong>${NH.week === 0 ? '이번 주' : NH.week === 1 ? '다음 주' : NH.week === -1 ? '지난주' : (NH.week > 0 ? NH.week + '주 뒤' : -NH.week + '주 전')} · ${md(days[0])}~${md(days[6])}</strong>
        <button class="bi-b" onclick="nhWeek(1)" aria-label="다음 주">›</button>${NH.week ? `<button class="bi-b" onclick="nhWeek(0)">이번 주로</button>` : ''}
        <span class="nh-legend"><span><i style="background:#22311f"></i>정기휴무</span><span><i style="background:#c62429"></i>임시휴무</span></span></div>
      <div class="nh-scroll"><table class="nh-t"><thead><tr><th class="nm">매장</th>${days.map(day => `<th class="${day === today ? 'today' : ''}">${dow(day)}<br>${md(day)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
      <div class="nh-foot">임시휴무는 점주가 네이버에 등록한 날짜만 보여요. 네이버는 앞으로 7일치만 공개하기 때문에, 다음 주 이후 임시휴무는 가까워지면 채워져요.${NH.week < 0 ? ' 지난주는 그때 잡힌 임시휴무와 정기휴무를 함께 보여줘요.' : ''}</div>`;
  }
  function cell(s, day, today){
    const c = closedOn(s, day), cls = 'c' + (day === today ? ' today' : '');
    if (!c) return `<td class="${cls}"><span class="nh-dash">·</span></td>`;
    return `<td class="${cls}"><span class="${c.kind}${day < today ? ' past' : ''}" title="${h(c.text)}">${c.kind === 'tmp' ? '임시' : '정기'}</span></td>`;
  }
  window.nhWeek = n => { NH.week = n === 0 ? 0 : NH.week + n; draw(); };
  window.nhCheck = async function(id){
    const { data, error } = await SB.rpc('naver_check_toggle', { p_store: id, p_day: NH.data.today });
    if (error) return toast(error.message);
    toast(data.checked ? '오늘 직접 확인으로 체크했어요.' : '체크를 풀었어요.');
    await load(); draw();
  };

  /* ---------- 매장 상세 ---------- */
  const placeUrl = s => s.place_url || (s.place_id ? `https://m.place.naver.com/restaurant/${s.place_id}/home` : '');
  window.nhStore = function(id){
    const s = (NH.data.stores || []).find(x => x.id === id); if (!s) return;
    const ph = telNo(s.phone), pu = placeUrl(s);
    const wk = ['월', '화', '수', '목', '금', '토', '일'];
    const hrs = (() => {
      const b = (s.hours || [])[0]; if (!b || !b.businessHours) return '';
      const map = {}; b.businessHours.forEach(x => { map[String(x.day).replace(/\(.*\)/, '')] = x; });
      return `<div class="nh-box"><b>네이버 영업시간</b><div class="nh-hrs" style="margin-top:6px">${wk.map(k => { const x = map[k];
        if (!x) return `<span>${k}</span><span style="color:#9aa38f">-</span>`;
        const t = x.businessHours ? `${x.businessHours.start}~${x.businessHours.end}` + ((x.breakHours || []).length ? ` (브레이크 ${x.breakHours.map(b => b.start + '~' + b.end).join(', ')})` : '') : (x.description || '휴무');
        return `<span>${k}</span><span>${h(t)}</span>`; }).join('')}</div>${s.free ? `<div style="margin-top:6px;color:#7d8574">${h(s.free)}</div>` : ''}</div>`;
    })();
    const future = (s.days || []).filter(x => x.day >= NH.data.today);
    const prev = s.prev && changedRecent(s) ? `<div class="nh-box chg"><b>변경됨 · ${kst(s.changed)}</b><br>이전 정기휴무: ${(s.prev.regular_days || []).join(', ') || '없음'} → 지금: ${(s.regular || []).join(', ') || '없음'}</div>` : '';
    iModal(s.name, `
      <div class="nh-acts">
        ${ph ? `<a class="bi-b" href="tel:${ph}">${ic('phone')}전화</a><a class="bi-b" href="sms:${ph}">${ic('msg')}문자</a>` : `<span class="bi-b" style="opacity:.5">${ic('phone')}연락처 없음</span>`}
        ${pu ? `<a class="bi-b" href="${h(pu)}" target="_blank" rel="noopener">${ic('link')}플레이스 열기</a>` : `<span class="bi-b" style="opacity:.5">플레이스 없음</span>`}
      </div>
      <div class="nh-info">
        <span>점주</span><span>${h(s.owner) || '<span style="color:#9aa38f">미입력</span>'}</span>
        <span>연락처</span><span>${h(mmTel(s.phone)) || '<span style="color:#9aa38f">미입력</span>'}</span>
        <span>매장 전화</span><span>${s.store_phone ? `<a href="tel:${telNo(s.store_phone)}" style="color:inherit">${h(mmTel(s.store_phone))}</a>` : '<span style="color:#9aa38f">-</span>'}</span>
        <span>담당 SV</span><span>${h(s.sv) || '<span style="color:#9aa38f">-</span>'}</span>
        <span>주소</span><span>${h(s.addr) || '<span style="color:#9aa38f">미입력</span>'}</span>
        <span>오픈일</span><span>${h(s.open || '') || '<span style="color:#9aa38f">미입력</span>'}</span>
        <span>네이버 이름</span><span>${h(s.naver_name) || '-'}</span>
        <span>정기휴무</span><span>${s.skip ? '네이버 확인 제외 (' + h(s.skip) + ')' : (s.regular || []).length ? (s.regular || []).map(h).join(', ') + '요일' : '없음'}</span>
        <span>임시휴무</span><span>${future.length ? future.map(x => `${md(x.day)}(${dow(x.day)})`).join(', ') : '등록 없음'}</span>
        ${s.coming ? `<span>예정 휴무</span><span>${h(s.coming)}</span>` : ''}
        ${(s.irregular || []).length ? `<span>기타 휴무</span><span style="white-space:pre-wrap">${h(JSON.stringify(s.irregular))}</span>` : ''}
        <span>FC다움 연동</span><span>${s.fc_at ? kst(s.fc_at) : '<span style="color:#9aa38f">아직 없음</span>'}</span>
        <span>마지막 확인</span><span>${s.checked ? kst(s.checked) : '-'}${s.err ? `<br><span style="color:#a3262c">수집 실패: ${h(s.err)}</span>` : ''}</span>
      </div>${prev}${hrs}`, closeM, '닫기');
    const foot = document.querySelector('#inv-modal .im-foot');
    foot.querySelector('.btn.ghost')?.remove();
    foot.insertAdjacentHTML('afterbegin', `<div class="mn-foot-l" style="margin-right:auto"><button class="btn ghost" onclick="nhEdit(${s.id})">${ic('edit')}정보 수정</button></div>`);
  };

  /* ---------- 정보 수정 ---------- */
  window.nhEdit = function(id){
    const s = (NH.data.stores || []).find(x => x.id === id); if (!s) return;
    iModal(`정보 수정 · ${s.name}`, `<div class="im-grid">
      <div class="f"><label>점주 이름</label><input id="nh-owner" maxlength="30" value="${h(s.owner)}"></div>
      <div class="f"><label>연락처</label><input id="nh-phone" type="tel" maxlength="20" value="${h(mmTel(s.phone))}" placeholder="010-0000-0000"></div>
      <div class="f wide"><label>주소</label><input id="nh-addr" maxlength="200" value="${h(s.addr)}"></div>
      <div class="f"><label>오픈일</label><input id="nh-open" type="date" value="${h(s.open || '')}"></div>
      <div class="f"><label>네이버 확인</label><select id="nh-skip"><option value="">확인함</option><option value="딜리버리 매장" ${s.skip ? 'selected' : ''}>제외 (플레이스 없음)</option></select></div>
      <div class="f wide"><label>플레이스 주소 <span>선택</span></label><input id="nh-url" maxlength="300" value="${h(s.place_url)}" placeholder="https://naver.me/... 또는 map.naver.com/..."><div class="nh-help">비워 두면 자동으로 찾은 플레이스가 열려요.</div></div>
      <div class="f wide"><label>네이버 검색 이름 <span>선택</span></label><input id="nh-search" maxlength="60" value="${h(s.search)}" placeholder="멘야마쯔리 ${h(s.name)}"><div class="nh-help">자동 수집이 매장을 못 찾을 때만 네이버 지도에 뜨는 이름 그대로 넣어 주세요. 바꾸면 다음 수집 때 다시 찾아요.</div></div>
    </div>`, async () => {
      const v = id => document.getElementById(id).value.trim();
      const p = { id: s.id, owner: v('nh-owner'), phone: v('nh-phone'), addr: v('nh-addr'), open: v('nh-open'), place_url: v('nh-url'), search: v('nh-search'), skip: v('nh-skip') };
      const { error } = await SB.rpc('naver_store_save', { p });
      if (error) return toast('저장하지 못했어요: ' + error.message);
      closeM(); toast('저장했어요.'); await load(); draw();
    }, '저장');
  };

  /* ---------- 명단 한 번에 넣기 ---------- */
  const key = n => String(n || '').replace(/멘야마쯔리|\s/g, '').replace(/본점$|점$/, '');
  window.nhBulk = function(){
    iModal('명단 한 번에 넣기', `<div class="nh-bulk">
      <div class="nh-box">한 줄에 매장 하나씩, <b>매장명 · 점주 · 연락처 · 주소 · 오픈일 · 플레이스 주소</b> 순서로 넣어 주세요. 엑셀에서 여섯 칸을 복사해 붙여넣으면 그대로 들어가요. 엑셀이 아니면 쉼표(,)로 나눠도 돼요. 빈칸은 기존 값을 그대로 둬요.</div>
      <div class="im-grid"><div class="f wide"><textarea id="nh-bulk" placeholder="쌍용점	홍길동	010-1234-5678	충남 천안시 서북구 쌍용14길 25	2015-03-01&#10;신부점	김철수	010-2222-3333"></textarea></div></div>
      <div class="nh-help" id="nh-bulk-msg"></div></div>`, async () => {
      const lines = document.getElementById('nh-bulk').value.split('\n').map(x => x.trim()).filter(Boolean);
      if (!lines.length) return toast('넣을 내용이 없어요.');
      const stores = NH.data.stores || [], miss = [];
      let ok = 0;
      for (const ln of lines) {
        const c = (ln.includes('\t') ? ln.split('\t') : ln.split(',')).map(x => x.trim());
        const s = stores.find(x => key(x.name) === key(c[0])) || stores.find(x => key(c[0]) && (key(x.name).includes(key(c[0])) || key(c[0]).includes(key(x.name))));
        if (!s) { miss.push(c[0]); continue; }
        const p = { id: s.id };
        if (c[1]) p.owner = c[1];
        if (c[2]) p.phone = c[2];
        if (c[3]) p.addr = c[3];
        if (c[4]) { const m = c[4].replace(/[./]/g, '-').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if (m) p.open = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; }
        if (c[5]) p.place_url = c[5];
        const { error } = await SB.rpc('naver_store_save', { p });
        if (error) miss.push(c[0] + '(' + error.message + ')'); else ok++;
      }
      await load(); draw();
      if (miss.length) { document.getElementById('nh-bulk-msg').innerHTML = `<span style="color:#a3262c">${ok}곳 저장 · 못 찾은 줄: ${miss.map(h).join(', ')}</span>`; }
      else { closeM(); toast(`${ok}곳 저장했어요.`); }
    }, '넣기');
  };

  // 2분마다 화면이 열려 있으면 새로고침
  setInterval(() => { if (!document.hidden && window.__curPage === PAGE && !document.getElementById('inv-modal')) load().then(d => d && draw()); }, 120000);
})();
