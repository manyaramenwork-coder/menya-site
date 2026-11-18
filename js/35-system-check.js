
/* ==========================================================
   시스템 점검 (2026-11-03) — 관리자 전용, 자동 수집이 제대로 돌고 있는지 매일 확인
   - 데이터: Supabase sys_health() (update_log · store_naver · pg_cron · competitor_runs)
   - 검색 트렌드: 화면을 열 때 naver-trend를 한 번 시험 호출
   - 메일: Apps Script HealthCheck.gs가 매일 8시 같은 점검을 돌려 이상 있을 때만 메일
   ========================================================== */
(function(){
  PATHS.pulse = PATHS.pulse || 'M3 12h4l3-8 4 16 3-8h4';
  const PAGE = 'sys-check';
  const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const adm = () => !!(SESSION.user && SESSION.user.role === 'admin');
  const SC = { data: null, trend: null, busy: false };
  const LV = { ok: ['정상', 'ok'], warn: ['확인 필요', 'warn'], bad: ['문제', 'bad'], none: ['기록 없음', 'none'], wait: ['확인 중', 'none'] };
  const ago = m => m == null ? '' : m < 60 ? `${m}분 전` : m < 48 * 60 ? `${Math.floor(m / 60)}시간 전` : `${Math.floor(m / 1440)}일 전`;
  const kst = s => { if (!s) return '-'; const d = new Date(s); const p = n => String(n).padStart(2, '0'); return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`; };

  const st = document.createElement('style');
  st.textContent = `
  .sc-sum{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0}
  .sc-sum div{background:#fff;border:1px solid #e3e5dd;border-radius:12px;padding:12px 14px}
  .sc-sum span{display:block;font-size:12px;color:#7b8174}
  .sc-sum b{font-size:22px;font-weight:600;color:#222b1e}
  .sc-sum .w b{color:#9a6a0b}.sc-sum .x b{color:#c8102e}
  .sc-list{display:grid;gap:10px}
  .sc-row{background:#fff;border:1px solid #e3e5dd;border-radius:12px;padding:12px 16px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;align-items:center}
  .sc-row.warn{border-color:#ecd9a8;background:#fffbf0}.sc-row.bad{border-color:#efc3bd;background:#fff8f7}
  .sc-row b{font-size:14px;font-weight:600;color:#222b1e}
  .sc-row .how{font-size:11.5px;color:#8c9186;margin-left:6px;font-weight:400}
  .sc-row .at{text-align:right;font-size:12px;color:#5f6858;white-space:nowrap}
  .sc-row .at small{display:block;font-size:11px;color:#969c8e}
  .sc-row .msg{grid-column:1/-1;font-size:12px;color:#5f6858;line-height:1.6;word-break:keep-all}
  .sc-pill{display:inline-block;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:700;margin-right:8px;vertical-align:1px}
  .sc-pill.ok{background:#eaf1e4;color:#4b6b35}.sc-pill.warn{background:#fff1d6;color:#9a6a0b}.sc-pill.bad{background:#c8102e;color:#fff}.sc-pill.none{background:#eceee8;color:#6c7365}
  .sc-foot{font-size:11.5px;color:#8b9381;line-height:1.7;margin-top:12px}
  @media(max-width:640px){.sc-sum b{font-size:18px}.sc-row{padding:11px 12px}.sc-row .how{display:block;margin:2px 0 0}}`;
  document.head.appendChild(st);

  async function load(){
    const { data, error } = await SB.rpc('sys_health');
    if (error) throw error;
    SC.data = data;
  }
  async function testTrend(){
    SC.trend = { level: 'wait', msg: '시험 호출 중...' };
    const end = new Date(Date.now() - 86400000), start = new Date(end.getTime() - 7 * 86400000);
    const ymd = d => d.toISOString().slice(0, 10);
    try {
      const { data, error } = await SB.functions.invoke('naver-trend', { body: { keywords: ['라멘'], startDate: ymd(start), endDate: ymd(end), timeUnit: 'date', mode: 'compare' } });
      if (error) { let msg = error.message; try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (_) {} throw new Error(msg); }
      if (!data || !data.ok) throw new Error((data && data.error) || '응답 이상');
      SC.trend = { level: 'ok', msg: '네이버 데이터랩 응답 정상', at: new Date().toISOString(), mins: 0 };
    } catch (e) {
      SC.trend = { level: 'bad', msg: '호출 실패: ' + (e.message || e), at: new Date().toISOString(), mins: 0 };
    }
  }

  function row(it){
    const [txt, cls] = LV[it.level] || LV.none;
    return `<div class="sc-row ${cls}">
      <span><span class="sc-pill ${cls}">${txt}</span><b>${h(it.label)}</b><span class="how">${h(it.how)}</span></span>
      <span class="at">${it.at ? kst(it.at) : '-'}<small>${ago(it.mins)}</small></span>
      ${it.msg ? `<span class="msg">${h(it.msg)}${it.count != null && !/곳/.test(it.msg) ? ` · ${Number(it.count).toLocaleString('ko-KR')}건` : ''}</span>` : ''}
    </div>`;
  }

  function draw(){
    const box = document.getElementById('sc-body'); if (!box) return;
    if (!SC.data) { box.innerHTML = '<div class="card"><div class="empty">불러오는 중...</div></div>'; return; }
    const items = (SC.data.items || []).slice();
    items.push(Object.assign({ key: 'trend', label: '검색 트렌드', how: '화면 열 때 시험 호출 (Edge Function)' }, SC.trend || { level: 'wait' }));
    const rank = { bad: 0, warn: 1, none: 2, wait: 3, ok: 4 };
    items.sort((a, b) => (rank[a.level] ?? 5) - (rank[b.level] ?? 5));
    const cnt = k => items.filter(i => i.level === k).length;
    const bad = cnt('bad'), warn = cnt('warn') + cnt('none');
    box.innerHTML = `
      <div class="data-note"><span class="status-dot" style="${bad ? 'background:#c8102e' : warn ? 'background:#d9a21b' : ''}"></span>
        <span>${kst(SC.data.now)} 기준 · ${bad ? '문제가 있는 항목이 있어요' : warn ? '확인할 항목이 있어요' : '모든 수집이 정상이에요'}</span>
        <button class="btn ghost cs-re" onclick="scReload()">${ic('reset')}새로고침</button></div>
      <div class="sc-sum"><div><span>정상</span><b>${cnt('ok')}</b></div><div class="w"><span>확인 필요</span><b>${warn}</b></div><div class="x"><span>문제</span><b>${bad}</b></div></div>
      <div class="sc-list">${items.map(row).join('')}</div>
      <p class="sc-foot">정해진 수집 간격보다 늦어지면 '확인 필요', 기준 시간을 넘겨 멈추면 '문제'로 표시해요. 매일 아침 8시에 같은 점검을 돌려서 확인 필요·문제가 있을 때만 관리자 메일로 알려 드려요. 검색 트렌드는 화면을 열 때만 시험해요.</p>`;
  }

  window.scReload = async function(){
    if (SC.busy) return; SC.busy = true;
    SC.trend = null; draw();
    try { await Promise.all([load(), testTrend()]); }
    catch (e) { const b = document.getElementById('sc-body'); if (b) b.innerHTML = `<div class="card"><div class="empty">불러오지 못했어요: ${h(e.message || e)}</div></div>`; SC.busy = false; return; }
    SC.busy = false;
    if (window.__curPage === PAGE) draw();
  };

  function pageSc(){
    document.getElementById('main').innerHTML = simpleHero(['사용자 관리', '시스템 점검'], 'SYSTEM · HEALTH CHECK', '시스템 점검',
      '자동 수집과 연결이 제대로 돌고 있는지 한 화면에서 확인해요.') + `<div id="sc-body"></div>` + pageFoot();
    draw(); scReload();
  }

  /* ---------- 메뉴: 사용자 관리 아래 (관리자만) ---------- */
  const renderSideSc = renderSide;
  renderSide = function(active){
    renderSideSc(active);
    if (!adm()) return;
    const nav = document.querySelector('#side .nav-items'); if (!nav) return;
    const btn = [...nav.querySelectorAll(':scope > .cat')].find(b => [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() === '사용자 관리');
    const sub = btn && btn.nextElementSibling && btn.nextElementSibling.classList.contains('sub') ? btn.nextElementSibling : null;
    if (!sub) return;
    sub.querySelectorAll('.js-sc-item').forEach(e => e.remove());
    sub.insertAdjacentHTML('beforeend', `<a role="button" tabindex="0" class="js-sc-item ${active === PAGE ? 'on' : ''}" onclick="go('${PAGE}')">시스템 점검</a>`);
    if (active === PAGE) { btn.classList.add('open'); sub.classList.add('open'); }
  };
  const goSc = go;
  go = function(p, t){
    if (p === PAGE) {
      if (!adm()) { toast('관리자만 볼 수 있어요.'); return goSc('dash'); }
      document.getElementById('nt-pop')?.remove();
      closeSide(); renderSide(p); window.__curPage = p; pageSc(); window.scrollTo(0, 0); return;
    }
    return goSc(p, t);
  };
  try { renderSide(window.__curPage || 'dash'); } catch (e) {}
})();
