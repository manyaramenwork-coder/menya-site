
/* ==========================================================
   전화번호 하이픈 (2026-11-08)
   - mmTel(번호): 화면에 보일 때 010-1234-5678 / 02-123-4567 / 1588-1234 형태로 표시
   - 입력 칸(전화 칸 전부)에서 숫자만 쳐도 하이픈 자동으로 붙음
   - 쉼표(,)나 /로 여러 번호를 넣은 칸도 번호마다 따로 맞춰 줌
   ========================================================== */
(function(){
  function one(d){
    if (!d) return '';
    if (d.indexOf('02') === 0) {
      if (d.length <= 2) return d;
      if (d.length <= 5) return d.slice(0,2) + '-' + d.slice(2);
      if (d.length <= 9) return d.slice(0,2) + '-' + d.slice(2, d.length - 4 < 5 ? 5 : d.length - 4) + '-' + d.slice(d.length - 4 < 5 ? 5 : d.length - 4);
      return d.slice(0,2) + '-' + d.slice(2,6) + '-' + d.slice(6,10);
    }
    if (/^1[5-9]/.test(d) && d.length <= 8) {
      return d.length <= 4 ? d : d.slice(0,4) + '-' + d.slice(4);
    }
    if (d.charAt(0) === '0') {
      if (d.length <= 3) return d;
      if (d.length <= 6) return d.slice(0,3) + '-' + d.slice(3);
      if (d.length <= 10) return d.slice(0,3) + '-' + d.slice(3,6) + '-' + d.slice(6);
      return d.slice(0,3) + '-' + d.slice(3,7) + '-' + d.slice(7,11);
    }
    return d;
  }
  function seg(t){
    var lead = t.match(/^\s*/)[0], tail = t.match(/\s*$/)[0], core = t.trim();
    if (!core || !/^[\d\s-]+$/.test(core)) return t;
    return lead + one(core.replace(/\D/g, '')) + tail;
  }
  window.mmTel = function(s){
    if (s === null || s === undefined) return '';
    s = String(s);
    return s.split(/([,\/])/).map(function(p){ return /^[,\/]$/.test(p) ? p : seg(p); }).join('');
  };
  var SEL = 'input[type=tel], #u-phone, #bi-tel, #ii-tel';
  document.addEventListener('input', function(e){
    var el = e.target;
    if (!el || !el.matches || !el.matches(SEL) || e.isComposing) return;
    var v = el.value, pos = el.selectionStart == null ? v.length : el.selectionStart;
    var digitsBefore = v.slice(0, pos).replace(/\D/g, '').length;
    var nv = window.mmTel(v);
    if (nv === v) return;
    el.value = nv;
    var i = 0, n = 0;
    while (i < nv.length && n < digitsBefore) { if (/\d/.test(nv.charAt(i))) n++; i++; }
    try { el.setSelectionRange(i, i); } catch (err) {}
  }, true);
})();
