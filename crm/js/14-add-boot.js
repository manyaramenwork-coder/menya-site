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

boot();
