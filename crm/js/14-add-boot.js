/* ---------- 매장 추가 ---------- */
$('add').addEventListener('click', () => openAdd('manual'));
function openAdd(srcDefault){
  const b = $('addbox');
  b.innerHTML = `<h3 id="add-title">매장 추가</h3>
    <div class="grid2">
      <div class="fld full"><label for="a-name">상호</label><input id="a-name" required></div>
      <div class="fld"><label for="a-sgg">시군구</label><input id="a-sgg" placeholder="예: 마포구"></div>
      <div class="fld"><label for="a-dong">동</label><input id="a-dong" placeholder="예: 서교동"></div>
      <div class="fld full"><label for="a-addr">주소</label><input id="a-addr"></div>
      <div class="fld"><label for="a-tel">전화</label><input id="a-tel" type="tel"></div>
      <div class="fld"><label for="a-src">유입 경로</label><select id="a-src">${opt(SRC, srcDefault || 'manual')}</select></div>
      <div class="fld"><label for="a-cat">업종</label><input id="a-cat" placeholder="예: 요리 주점"></div>
      <div class="fld"><label for="a-org">리드 소유</label><select id="a-org">${opt(ORG, 'menya')}</select></div>
    </div>
    <div class="row-end"><button class="btn" type="button" id="a-cancel">취소</button><button class="btn pri" type="button" id="a-save">매장 추가</button></div>`;
  $('scrim').hidden = false; b.hidden = false; $('a-name').focus();
  $('a-cancel').onclick = closePanel;
  $('a-save').onclick = async () => {
    const name = $('a-name').value.trim(); if (!name) { toast('상호를 입력해 주세요', true); return; }
    try {
      const id = await rpc('lead_save', { p: { name, sigungu: $('a-sgg').value.trim(), dong: $('a-dong').value.trim(), addr_road: $('a-addr').value.trim(),
        tel: $('a-tel').value.replace(/\D/g, ''), source: $('a-src').value, cat_s: $('a-cat').value.trim(), org: $('a-org').value } });
      b.hidden = true; toast('매장을 추가했어요'); load(true); openLead(id);
    } catch (e) { toast(errMsg(e), true); }
  };
}

/* ---------- 상권분석: 나이스비즈맵 유동인구 보기 (본사 내부 참고용) ----------
   주소를 복사해 두고 나이스비즈맵 유동인구 화면을 새 탭으로 엶. 나이스는 주소로 위치를 넘겨받지 않아서 검색은 직접.
   리포트(rp-body, PDF)에는 넣지 않음 — 이 버튼은 '선택 위치 요약' 카드(rp-side)에만 있고, 인쇄 때도 숨김 */
const NICE_FLOWPOP = 'https://m.nicebizmap.co.kr/explorer/flowpop';
document.head.insertAdjacentHTML('beforeend', `<style id="nice-css">
.rs-nice{width:100%;margin-top:8px}.rs-nice-note{margin:6px 0 0;font-size:11.5px;line-height:1.5;color:var(--sub,#8a8e86)}
@media print{#rp-side,.rs-nice,.rs-nice-note{display:none!important}}
</style>`);
/* 복사할 주소: 도로명·지번 주소 → (지도에서 옮긴 경우 덧붙은 표시 제거) → 분석 결과의 시군구+동 */
function niceAddr(){
  const p = RP.place; if (!p) return '';
  const clean = v => String(v || '').replace(/\s*\(위치 조정\)\s*$/, '').trim();
  const a = clean(p.addr);
  if (a) return a;
  const c = RP.data && RP.data.center;
  if (c && (c.sgg || c.dong)) return [c.sgg, c.dong].filter(Boolean).join(' ');
  const l = clean(p.label);
  return /지도에서 고른 위치/.test(l) ? '' : l;
}
function niceCopy(text){
  let ok = false;
  try {   // 같은 클릭 안에서 바로 복사(새 탭이 열리기 전에)
    const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', '');
    t.style.cssText = 'position:fixed;top:-1000px;opacity:0'; document.body.appendChild(t); t.select();
    ok = document.execCommand('copy'); t.remove();
  } catch (e) {}
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
  return ok || !!(navigator.clipboard && navigator.clipboard.writeText);
}
const _rpSideRender = rpSideRender;
rpSideRender = function(){
  _rpSideRender();
  const go = $('rp-side-go'); if (!go || $('rp-side-nice')) return;
  go.insertAdjacentHTML('afterend', `<button type="button" class="btn rs-nice" id="rp-side-nice" ${RP.place ? '' : 'disabled'}>나이스비즈맵 유동인구 보기 ↗</button>
    <p class="rs-nice-note">본사 내부 참고용 · 나이스비즈맵 로그인 필요 · 화면 캡처를 점주용 자료에 쓰지 마세요</p>`);
};
rpSideRender();
document.addEventListener('click', e => {
  if (!e.target.closest('#rp-side-nice')) return;
  const addr = niceAddr();
  const copied = addr ? niceCopy(addr) : false;
  window.open(NICE_FLOWPOP, '_blank', 'noopener');
  if (!addr) toast('주소가 없는 위치라 복사하지 못했어요. 나이스비즈맵 검색창에 동 이름을 직접 넣어 주세요.', true);
  else if (!copied) toast(`복사가 안 됐어요. 나이스비즈맵 검색창에 직접 입력해 주세요: ${addr}`, true);
  else toast(`'${addr}' 주소를 복사했어요. 나이스비즈맵 검색창에 붙여넣기(Ctrl+V) → 첫 번째 결과 → 지도 [+] 두 번 → 분석지점 선택`);
});

/* 앱을 새로 열면 항상 홈 대시보드부터. 새로고침(F5)일 때만 보던 화면을 그대로 둠 */
{
  let reload = false;
  try { reload = (performance.getEntriesByType('navigation')[0] || {}).type === 'reload'; } catch (e) {}
  if (!reload || !VIEWS.includes(location.hash.slice(1))) history.replaceState(null, '', '#home');
}

boot();
