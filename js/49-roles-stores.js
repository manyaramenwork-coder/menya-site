
/* ==========================================================
   계정 등급 4단계 + 소속 매장 (2026-11-09)
   - 매장 관리자·매장 사원을 고르면 소속 매장 칸이 나타남
   - 매장 목록은 직영점(폐점 제외)만
   ========================================================== */
(function(){
  var cache = null;
  window.mmUserRoleChange = function(){
    var r = document.getElementById('u-role'), w = document.getElementById('u-store-wrap');
    if (!r || !w) return;
    w.hidden = !(r.value === 'store' || r.value === 'staff');
    if (!w.hidden) window.mmFillUserStores();
  };
  window.mmUserStoreVal = function(){
    var w = document.getElementById('u-store-wrap'), s = document.getElementById('u-store');
    if (!w || w.hidden || !s) return null;
    return Number(s.value) || null;
  };
  window.mmFillUserStores = async function(){
    var s = document.getElementById('u-store');
    if (!s || s.dataset.filled) return;
    try {
      if (!cache) {
        var res = await SB.rpc('org_data');
        if (res.error) throw res.error;
        cache = ((res.data && res.data.stores) || []).filter(function(x){ return x.direct; });
      }
      var cur = String(s.dataset.cur || '');
      s.innerHTML = '<option value="">매장 선택</option>' + cache.map(function(x){
        var nm = String(x.name).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; });
        return '<option value="' + x.id + '"' + (String(x.id) === cur ? ' selected' : '') + '>' + nm + (x.status && x.status !== '영업중' ? ' (' + x.status + ')' : '') + '</option>';
      }).join('');
      s.dataset.filled = '1';
    } catch (e) {
      s.innerHTML = '<option value="">매장을 불러오지 못했어요</option>';
    }
  };
})();
