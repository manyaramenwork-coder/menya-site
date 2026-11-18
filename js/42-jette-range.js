
// v6.x: 제때 조회 — 고른 기간을 서버에서 받아 조회 (달력 기준 3개월: 시작일 3개월 뒤 같은 날의 전날까지)
(function(){
  const addM = (d, n) => { const [y, m, dd] = d.split('-').map(Number); const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate(); return new Date(Date.UTC(y, m - 1 + n, Math.min(dd, last))).toISOString().slice(0, 10); };
  window.jtMaxTo = from => { const x = addM(from, 3); return new Date(Date.parse(x) - 864e5).toISOString().slice(0, 10); };
  const setRangeBase = setRange;
  setRange = function(k){
    if (k === 'ly') {
      const t = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
      const y = Number(t.slice(0, 4)) - 1, m = Number(t.slice(5, 7));
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      d1.value = `${y}-${String(m).padStart(2, '0')}-01`; d2.value = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
      return;
    }
    setRangeBase(k);
  };
  const basisNow = () => document.getElementById('adv-order')?.checked ? 'order' : (document.querySelector('#basis .on')?.dataset.v || 'ship');
  function checkRange(){
    const a = document.getElementById('d1'), b = document.getElementById('d2'), err = document.getElementById('filter-error');
    if (!a || !b) return null;
    const say = m => { if (err) err.textContent = m; return null; };
    if (!a.value || !b.value || a.value > b.value) return say('시작일과 종료일을 확인해주세요. 시작일은 종료일보다 늦을 수 없어요.');
    if (META.jetteFrom && b.value < META.jetteFrom) return say(`제때 자료는 ${META.jetteFrom} 부터 있어요.`);
    const mx = jtMaxTo(a.value);
    if (b.value > mx) return say(`한 번에 최대 3개월까지 조회할 수 있어요. 시작일이 ${a.value}이면 종료일은 ${mx}까지예요.`);
    if (err) err.textContent = '';
    return [a.value, b.value, basisNow()];
  }
  function refreshCats(){
    const sel = document.getElementById('adv-cat'); if (!sel) return;
    const v = sel.value;
    sel.innerHTML = '<option value="">전체 품목</option>' + CATS.map(c => `<option>${c}</option>`).join('');
    if (v && CATS.indexOf(v) < 0) sel.insertAdjacentHTML('beforeend', `<option>${v}</option>`);
    sel.value = v;
  }
  // 매장 선택: 영업 중 → 본사 → (체크 시) 폐점 순으로 묶어서 표시. 폐점은 '폐점 매장 포함'을 켰을 때만 보임
  //   값은 매장 이름 그대로라 조회에는 영향 없음. '전체 매장'은 체크와 상관없이 그 기간 모든 매장 포함
  window.JT_SHOW_CLOSED = window.JT_SHOW_CLOSED || false;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function buildStores(fromToggle){
    const sel = document.getElementById('st'); if (!sel) return;
    let cur = sel.value;
    const st = n => (MASTER[n] || {}).status || '';
    const sorted = STORES.slice().sort((a, b) => a.localeCompare(b, 'ko'));
    const open = sorted.filter(n => st(n) !== '폐점' && st(n) !== '본사');
    const hq = sorted.filter(n => st(n) === '본사');
    const closed = sorted.filter(n => st(n) === '폐점');
    if (!fromToggle && cur && closed.indexOf(cur) >= 0) window.JT_SHOW_CLOSED = true;   // 대시보드 등에서 폐점 매장으로 들어온 경우
    const opt = (n, lab) => `<option value="${esc(n)}">${esc(lab || n)}</option>`;
    sel.innerHTML = '<option value="">전체 매장</option>' +
      `<optgroup label="영업 중 (${open.length}곳)">${open.map(n => opt(n)).join('')}</optgroup>` +
      (hq.length ? `<optgroup label="본사">${hq.map(n => opt(n)).join('')}</optgroup>` : '') +
      (window.JT_SHOW_CLOSED && closed.length ? `<optgroup label="폐점 (${closed.length}곳)">${closed.map(n => opt(n, n + ' (폐점)')).join('')}</optgroup>` : '');
    sel.value = [...sel.options].some(o => o.value === cur) ? cur : '';
    if (!document.getElementById('st-closed')) {
      sel.insertAdjacentHTML('afterend', `<label class="st-closed" style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;color:#5b6253;cursor:pointer"><input type="checkbox" id="st-closed" ${window.JT_SHOW_CLOSED ? 'checked' : ''} style="margin:0"> 폐점 매장 포함 <small style="color:#8a9083">(${closed.length}곳)</small></label>`);
      document.getElementById('st-closed').addEventListener('change', e => { window.JT_SHOW_CLOSED = e.target.checked; buildStores(true); });
    } else {
      document.getElementById('st-closed').checked = window.JT_SHOW_CLOSED;
    }
    sel.dataset.built = '1';
  }
  function markClosed(){
    const sel = document.getElementById('st'); if (!sel) return;
    if (!sel.dataset.built) buildStores();
    else if (sel.value && ((MASTER[sel.value] || {}).status === '폐점') && !window.JT_SHOW_CLOSED) buildStores();
  }
  function wrap(base){
    let seq = 0;
    return async function(){
      markClosed();
      const r = checkRange(); if (!r) return;
      const h = window.JT_HAS;
      if (!(h && h[2] === r[2] && h[0] <= r[0] && r[1] <= h[1])) {
        const my = ++seq, res = document.getElementById('res');
        if (res) res.innerHTML = '<div class="card"><div class="empty">선택한 기간의 제때 자료를 불러오는 중이에요…</div></div>';
        try { await jtFetch(r[0], r[1], r[2]); }
        catch (e) {
          if (my !== seq) return;
          const m = (e && e.message) || '';
          if (res) res.innerHTML = `<div class="card"><div class="empty">자료를 불러오지 못했어요.<br><small>${m.replace(/[<>&]/g, '')}</small></div></div>`;
          return;
        }
        if (my !== seq) return;
        refreshCats();
      }
      base();
    };
  }
  runStoreOrders = wrap(runStoreOrders);
  runPeriod = wrap(runPeriod);
})();
