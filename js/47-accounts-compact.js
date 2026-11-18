
/* ==========================================================
   계정 현황 — 간단히 보기 (2026-11-09)
   - 계정 1개를 한 줄로: 사이트명 | 아이디·비밀번호 | 메모 | 열기·수정
   - [간단히 / 자세히] 전환, 고른 보기는 이 기기에 기억 (기본: 간단히)
   - 수정일·수정자는 사이트명에 마우스를 올리면 보임
   - 기존 계정 코드는 건드리지 않고 화면 배치만 바꿈 (거래처 현황은 그대로)
   ========================================================== */
(function(){
  const KEY = 'acctView';
  let mode = 'compact';
  try { mode = localStorage.getItem(KEY) || 'compact'; } catch (e) {}

  const st = document.createElement('style');
  st.textContent = `
  .bi-row > .bi-vt, .bi-vt{display:inline-flex !important;height:auto !important;font-size:12px !important;color:inherit !important;flex-direction:row !important;flex:none !important;width:auto !important;border:1px solid #dcdfd6;border-radius:8px;overflow:hidden;margin-left:auto}
  .bi-vt button{display:inline-block !important;flex:none !important;width:auto !important;min-width:0 !important;height:auto !important;writing-mode:horizontal-tb !important;white-space:nowrap !important;word-break:keep-all !important;line-height:1.3 !important;border:0 !important;border-radius:0 !important;margin:0 !important;background:#fff !important;color:#5c6653 !important;font-size:12px !important;padding:6px 12px !important;cursor:pointer}
  .bi-vt button + button{border-left:1px solid #dcdfd6 !important}
  .bi-vt button.on{background:#22311f !important;color:#fff !important}
  .bi-vt + .bi-off{margin-left:12px}
  .acct-cx .bi-it[id^="bi-a"]{grid-template-columns:minmax(170px,1.1fr) minmax(0,2.4fr) minmax(0,1.2fr) auto;align-items:center;gap:4px 16px;padding:9px 2px}
  .acct-cx .bi-it[id^="bi-a"].hl{padding-left:10px;padding-right:10px}
  .acct-cx .bi-it[id^="bi-a"] > .bi-name{grid-column:1;grid-row:1;font-size:14px;flex-wrap:nowrap;overflow:hidden;white-space:nowrap;min-width:0}
  .acct-cx .bi-it[id^="bi-a"] > .bi-name .bi-tag{padding:1px 6px;font-size:10.5px;flex:none}
  .acct-cx .bi-it[id^="bi-a"] > .bi-cred{grid-column:2;grid-row:1;display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,.8fr) auto;gap:4px 8px;font-size:12.5px}
  .acct-cx .bi-it[id^="bi-a"] > .bi-cred .k{display:none}
  .acct-cx .bi-it[id^="bi-a"] > .bi-cred .v{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;word-break:normal}
  .acct-cx .bi-it[id^="bi-a"] > .bi-cred .bi-b{font-size:0;gap:0;padding:5px 7px}
  .acct-cx .bi-it[id^="bi-a"] > .bi-cred .bi-acts{flex-wrap:nowrap;gap:4px}
  .acct-cx .bi-it[id^="bi-a"] > .bi-sub.cx-memo{grid-column:3;grid-row:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.4}
  .acct-cx .bi-it[id^="bi-a"] > .bi-sub.cx-upd{display:none}
  .acct-cx .bi-it[id^="bi-a"] > .bi-acts{grid-column:4;grid-row:1;flex-wrap:nowrap;gap:4px}
  .acct-cx .bi-it[id^="bi-a"] > .bi-acts .bi-b{padding:5px 9px}
  @media(max-width:760px){
    .acct-cx .bi-it[id^="bi-a"]{grid-template-columns:minmax(0,1fr) auto;gap:6px 10px;padding:10px 2px}
    .acct-cx .bi-it[id^="bi-a"] > .bi-name{grid-column:1;grid-row:1}
    .acct-cx .bi-it[id^="bi-a"] > .bi-acts{grid-column:2;grid-row:1;justify-content:flex-end}
    .acct-cx .bi-it[id^="bi-a"] > .bi-cred{grid-column:1/-1;grid-row:2;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr) auto}
    .acct-cx .bi-it[id^="bi-a"] > .bi-sub.cx-memo{display:none}
    .bi-vt{margin-left:0}
  }`;
  document.head.appendChild(st);

  window.biAcctView = function(m){
    mode = m;
    try { localStorage.setItem(KEY, m); } catch (e) {}
    apply();
  };

  function apply(){
    const bar = document.getElementById('bi-bar');
    const isAcct = !!document.getElementById('bi-aq');
    const body = document.getElementById('bi-body');
    if (!bar || !body || !isAcct) return;
    const card = body.closest('.card') || body.parentNode;
    card.classList.toggle('acct-cx', mode === 'compact');

    // 보기 전환 버튼
    const off = bar.querySelector('.bi-off');
    if (off && !bar.querySelector('.bi-vt')) {
      off.insertAdjacentHTML('beforebegin', `<div class="bi-vt"><button type="button" data-m="compact" onclick="biAcctView('compact')">간단히</button><button type="button" data-m="full" onclick="biAcctView('full')">자세히</button></div>`);
    }
    bar.querySelectorAll('.bi-vt button').forEach(b => b.classList.toggle('on', b.dataset.m === mode));

    // 줄마다 메모·수정일 구분, 마우스 올리면 전체 내용
    body.querySelectorAll('.bi-it[id^="bi-a"]:not([data-cx])').forEach(it => {
      it.dataset.cx = '1';
      const subs = it.querySelectorAll(':scope > .bi-sub');
      const upd = subs[subs.length - 1];
      if (upd) upd.classList.add('cx-upd');
      if (subs.length > 1) { subs[0].classList.add('cx-memo'); subs[0].title = subs[0].textContent.trim(); }
      const nm = it.querySelector(':scope > .bi-name');
      if (nm && upd) nm.title = upd.textContent.trim();
      it.querySelectorAll('.bi-cred .v').forEach(v => { if (!v.classList.contains('mask')) v.title = v.textContent.trim(); });
      it.querySelectorAll('.bi-cred .bi-b').forEach(b => { if (!b.title) b.title = b.textContent.trim(); });
    });
  }

  let raf = 0;
  new MutationObserver(() => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; apply(); });
  }).observe(document.body, { childList: true, subtree: true });
})();
