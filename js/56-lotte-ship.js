
/* ==========================================================
   앱 발주 > ② 명세서 · 발송: 롯데 택배정보 (2026-11-19)
   - 롯데택배 ALPS 건별주문의 수하인 필수(빨간색) 칸 순서대로 복사 버튼
     전화번호 · 고객성명 · 주소 검색어 · 상세주소 · 상품명(품목 분류)
   - 롯데 주소 검색은 '도로명 + 건물번호'만 넣어야 잘 잡혀서, 층·호수는 상세주소로 따로
   - 매장별로 고친 값은 mst_store_ship에 저장 → 다음 발주에도 그대로 (비우면 자동값으로)
   - 데이터: mst_hq_ship_list() · mst_hq_ship_save(p) — 관리자·본사만
   - 52-partners.js는 건드리지 않고, 발주 화면이 그려질 때 '발송 처리' 칸 위에 끼워 넣음
   2026-11-19 추가
   - 입금자: 기본은 점주 이름(본사 대리 발주여도 넣은 사람 이름이 아님), 가족 등이 입금할 땐 발주별로 바꾸기
   - 거래명세서: 새 창 대신 화면 위에 띄우고 '발주로 돌아가기' 버튼 (앱에서 뒤로가기가 없던 문제)
   ========================================================== */
(function(){
  const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = { map: {}, at: 0, busy: null, edit: new Set(), pedit: new Set() };

  async function load(force){
    if (!window.SB) return;
    if (!force && Date.now() - S.at < 60000) return;
    if (S.busy) return S.busy;
    S.busy = (async () => {
      try { const { data, error } = await SB.rpc('mst_hq_ship_list'); if (error) throw error;
        const m = {}; (data || []).forEach(x => { m[x.order_id] = x; }); S.map = m; S.at = Date.now(); }
      catch (e) { console.warn('택배정보 불러오기 실패', e); S.at = Date.now(); }
      finally { S.busy = null; }
    })();
    return S.busy;
  }

  const telFmt = v => { const d = String(v || '').replace(/\D/g, ''); if (!d) return '';
    if (/^02/.test(d)) return d.replace(/^(02)(\d{3,4})(\d{4})$/, '$1-$2-$3');
    if (/^050/.test(d)) return d.replace(/^(\d{4})(\d{3,4})(\d{4})$/, '$1-$2-$3');
    return d.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3'); };
  function parseAddr(a){
    a = String(a || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    let base = a, det = ''; const ci = a.indexOf(', ');
    if (ci >= 0) { base = a.slice(0, ci).trim(); det = a.slice(ci + 2).trim(); }
    const t = base.split(' '); let i = -1;
    for (let k = t.length - 2; k >= 0; k--) if (/(로|길)$/.test(t[k]) && /^\d/.test(t[k + 1])) { i = k; break; }
    if (i < 0) return { search: base, detail: det };
    return { search: t[i] + ' ' + t[i + 1], detail: [t.slice(i + 2).join(' '), det].filter(Boolean).join(' ') };
  }
  function info(s){
    const p = parseAddr(s.address), cats = (s.cats || []).filter(Boolean);
    return { tel: telFmt(s.tel || s.store_phone || s.owner_phone), name: '멘야마쯔리 ' + s.name,
      search: s.search || p.search, detail: s.detail || p.detail, prod: cats.length ? cats.join(', ') : (s.first || ''), p };
  }

  function box(id){
    const s = S.map[id];
    if (!s) return `<div class="mp-lotte" data-o="${id}"><div class="mp-lh"><b>롯데 택배정보</b></div><p class="mp-lnone">매장 주소·전화를 불러오지 못했어요. 새로고침해 보세요.</p></div>`;
    const x = info(s);
    if (S.edit.has(id)) return `<div class="mp-lotte" data-o="${id}"><div class="mp-lh"><b>${h(s.name)} 택배정보 고치기</b></div>
      <p class="mp-lnone">이 매장 다음 발주에도 그대로 쓰여요. 비우면 매장 정보(네이버 주소·매장 전화)로 돌아가요.</p>
      <div class="mp-ship">
        <div class="mp-lr"><label class="k" for="mpe-t-${id}">전화번호</label><input id="mpe-t-${id}" inputmode="tel" value="${h(s.tel || '')}" placeholder="${h(telFmt(s.store_phone || s.owner_phone))}"></div>
        <div class="mp-lr"><label class="k" for="mpe-s-${id}">주소 검색어</label><input id="mpe-s-${id}" value="${h(s.search || '')}" placeholder="${h(x.p.search || '예: 쌍용14길 25')}"></div>
        <div class="mp-lr"><label class="k" for="mpe-d-${id}">상세주소</label><input id="mpe-d-${id}" value="${h(s.detail || '')}" placeholder="${h(x.p.detail || '예: 1층')}"></div>
      </div>
      <div class="mp-act"><button type="button" class="btn primary" onclick="lsSave(${id})">저장</button><button type="button" class="btn ghost" onclick="lsEdit(${id})">취소</button></div></div>`;
    const row = (k, v, req) => `<div class="mp-lr"><span class="k">${req ? '<i>•</i>' : ''}${k}</span><span class="v">${v ? h(v) : '<em>없음 · 고치기에서 넣어 주세요</em>'}</span>${v ? `<button type="button" class="mp-cp" data-v="${h(v)}" onclick="lsCopy(this)">복사</button>` : ''}</div>`;
    return `<div class="mp-lotte" data-o="${id}"><div class="mp-lh"><b>롯데 택배정보</b><small><i>•</i> 필수 칸</small><button type="button" class="mp-le" onclick="lsEdit(${id})">고치기</button></div>
      ${row('전화번호', x.tel, 1)}${row('고객성명', x.name, 1)}${row('주소 검색어', x.search, 1)}${row('상세주소', x.detail, 0)}${row('상품명', x.prod, 1)}</div>`;
  }

  /* 입금자 (거래명세서에 찍힘) */
  function payerBox(id){
    const s = S.map[id]; if (!s) return '';
    const cur = s.payer || s.owner || '';
    if (S.pedit.has(id)) return `<div class="ls-payer" data-o="${id}"><div class="mp-lr mp-ship"><label class="k" for="lsp-${id}">입금자</label><input id="lsp-${id}" maxlength="40" value="${h(s.payer || '')}" placeholder="${h(s.owner ? s.owner + ' (점주)' : '입금자 이름')}"></div>
      <p class="mp-lnone">점주님 가족 등 다른 사람이 입금할 때만 넣어 주세요. 비우면 점주 이름으로 돌아가요.</p>
      <div class="mp-act"><button type="button" class="btn primary" onclick="lsPayerSave(${id})">저장</button><button type="button" class="btn ghost" onclick="lsPayer(${id})">취소</button></div></div>`;
    return `<div class="ls-payer" data-o="${id}"><div class="mp-lr"><span class="k">입금자</span><span class="v">${cur ? h(cur) : '<em>점주 이름 없음 · 바꾸기에서 넣어 주세요</em>'}${cur ? `<small>${s.payer ? '직접 입력' : '점주'}</small>` : ''}</span><button type="button" class="mp-le" onclick="lsPayer(${id})">바꾸기</button></div></div>`;
  }
  window.lsPayer = id => { S.pedit.has(id) ? S.pedit.delete(id) : S.pedit.add(id); const el = document.querySelector(`.ls-payer[data-o="${id}"]`); if (el) el.outerHTML = payerBox(id); };
  window.lsPayerSave = async id => {
    const v = (document.getElementById('lsp-' + id).value || '').trim();
    const { error } = await SB.rpc('mst_hq_order_set', { p: { id, payer: v } });
    if (error) return toast(error.message);
    S.pedit.delete(id); await load(true);
    const el = document.querySelector(`.ls-payer[data-o="${id}"]`); if (el) el.outerHTML = payerBox(id);
    toast(v ? `입금자를 ${v}(으)로 바꿨어요` : '입금자를 점주 이름으로 되돌렸어요');
  };

  /* 발송 대기(접수 완료) 발주의 '발송 처리' 칸 바로 위에 끼워 넣기 */
  let busy = false;
  async function inject(){
    if (busy) return; busy = true;
    try {
      const need = a => (a.classList.contains('confirmed') && !a.querySelector('.mp-lotte')) || !a.querySelector('.ls-payer');
      const arts = [...document.querySelectorAll('article.mp-o.confirmed, article.mp-o.shipped')].filter(a => a.querySelector('.mp-next') && need(a));
      if (!arts.length) return;
      const ids = arts.map(a => +a.id.replace('mp-o-', ''));
      await load(ids.some(id => !S.map[id]) && Date.now() - S.at > 5000);
      arts.forEach((a, i) => {
        const sb = a.querySelector('.mp-next [onclick^="mpStmt"]');
        if (sb && S.map[ids[i]] && !a.querySelector('.ls-payer')) sb.closest('.mp-act').insertAdjacentHTML('afterend', payerBox(ids[i]));
        const ship = a.querySelector('.mp-next > .mp-act.mp-ship');
        if (a.classList.contains('confirmed') && ship && !a.querySelector('.mp-lotte')) ship.insertAdjacentHTML('beforebegin', box(ids[i])); });
    } finally { busy = false; }
  }
  const redraw = id => { const el = document.querySelector(`.mp-lotte[data-o="${id}"]`); if (el) el.outerHTML = box(id); };

  window.lsCopy = async b => {
    const v = b.dataset.v || ''; let ok = false;
    try { await navigator.clipboard.writeText(v); ok = true; }
    catch (e) { const t = document.createElement('textarea'); t.value = v; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(t); t.select(); try { ok = document.execCommand('copy'); } catch (_) {} t.remove(); }
    b.textContent = ok ? '복사됨' : '복사 실패'; b.classList.toggle('ok', ok);
    clearTimeout(b._t); b._t = setTimeout(() => { b.textContent = '복사'; b.classList.remove('ok'); }, 1500);
  };
  window.lsEdit = id => { S.edit.has(id) ? S.edit.delete(id) : S.edit.add(id); redraw(id); };
  window.lsSave = async id => {
    const s = S.map[id]; if (!s) return toast('매장 정보를 찾을 수 없어요');
    const v = k => (document.getElementById(`mpe-${k}-${id}`).value || '').trim();
    const { error } = await SB.rpc('mst_hq_ship_save', { p: { store_id: s.store_id, tel: v('t'), search: v('s'), detail: v('d') } });
    if (error) return toast(error.message);
    S.edit.delete(id); await load(true);
    document.querySelectorAll('.mp-lotte').forEach(el => { el.outerHTML = box(+el.dataset.o); });
    toast(`${s.name} 택배정보를 저장했어요`);
  };

  /* 거래명세서: 새 창(앱에선 뒤로가기 없음) 대신 화면 위에 띄움. 52-partners.js의 mpStmt를 그대로 쓰고 창만 바꿔 줌 */
  const origStmt = window.mpStmt;
  if (origStmt) window.mpStmt = id => {
    document.getElementById('ls-stmt')?.remove();
    const ov = document.createElement('div'); ov.id = 'ls-stmt'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', '거래명세서');
    ov.innerHTML = `<div class="ls-sh"><button type="button" onclick="lsStmtClose()">← 발주로 돌아가기</button><b>거래명세서</b></div><iframe title="거래명세서"></iframe>`;
    document.body.appendChild(ov); document.documentElement.classList.add('ls-noscroll');
    const fr = ov.querySelector('iframe'), ow = window.open;
    window.open = () => fr.contentWindow;
    try { return origStmt(id); } finally { window.open = ow; }
  };
  window.lsStmtClose = () => { document.getElementById('ls-stmt')?.remove(); document.documentElement.classList.remove('ls-noscroll'); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('ls-stmt')) lsStmtClose(); });

  let raf = 0;
  const watch = () => { const m = document.getElementById('main'); if (!m) return setTimeout(watch, 500);
    new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => inject().catch(() => {})); }).observe(m, { childList: true, subtree: true }); };
  watch();

  const st = document.createElement('style');
  st.textContent = `
  .mp-lotte{margin-top:12px;border:1px solid #e6e8e0;border-radius:10px;background:#fff;padding:2px 12px 8px}
  .mp-lh{display:flex;align-items:center;gap:8px;padding:9px 0 5px}.mp-lh b{font-size:13px;color:#232621}.mp-lh small{font-size:11.5px;color:#909b84}.mp-lh i{font-style:normal;color:#c62429}
  .mp-le{margin-left:auto;border:0;background:none;color:#5f6858;font:inherit;font-size:12px;text-decoration:underline;cursor:pointer;padding:4px 0}
  :is(.mp-lotte,.ls-payer) .mp-lr{display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid #f0f2ec}
  :is(.mp-lotte,.ls-payer) .mp-lr .k{width:76px;flex:none;font-size:12px;color:#7a8273}:is(.mp-lotte,.ls-payer) .mp-lr .k i{font-style:normal;color:#c62429;margin-right:3px}
  :is(.mp-lotte,.ls-payer) .mp-lr .v{flex:1;min-width:0;font-size:13.5px;color:#232621;word-break:keep-all;overflow-wrap:anywhere}:is(.mp-lotte,.ls-payer) .mp-lr .v em{font-style:normal;color:#b3261e;font-size:12px}
  :is(.mp-lotte,.ls-payer) .mp-lr input{flex:1;min-width:0;height:36px;border:1px solid #d9ded2;border-radius:8px;padding:0 10px;font:inherit;font-size:13px;background:#fff}
  .mp-cp{flex:none;height:32px;min-width:62px;border:1px solid #d9ded2;border-radius:8px;background:#fff;font:inherit;font-size:12px;font-weight:600;color:#4a5244;cursor:pointer}
  .mp-cp:active{transform:scale(.97)}.mp-cp.ok{border-color:#2e7a4c;color:#2e7a4c;background:#eef7f1}
  .mp-lnone{font-size:12.5px;color:#7a8273;margin:2px 0 6px}
  .ls-payer{margin-top:8px}.ls-payer .mp-lr{border-top:0;padding:4px 0}.ls-payer .mp-lr .v small{margin-left:6px;font-size:11px;color:#909b84}
  .ls-payer .mp-ship input{flex:1;min-width:0;height:36px}
  #ls-stmt{position:fixed;inset:0;z-index:400;display:flex;flex-direction:column;background:#eef0ea;padding-top:env(safe-area-inset-top,0px)}
  #ls-stmt .ls-sh{display:flex;align-items:center;gap:12px;padding:10px 14px;background:#fff;border-bottom:1px solid #dcdfd5}
  #ls-stmt .ls-sh button{border:1px solid #d9ded2;border-radius:8px;background:#fff;font:inherit;font-size:13px;font-weight:600;color:#232621;padding:8px 12px;cursor:pointer}
  #ls-stmt .ls-sh b{font-size:14px;color:#4a5244}
  #ls-stmt iframe{flex:1;width:100%;border:0;background:#eef0ea}
  html.ls-noscroll,html.ls-noscroll body{overflow:hidden}`;
  document.head.appendChild(st);
})();
