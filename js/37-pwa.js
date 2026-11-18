
/* ── 앱 설치(PWA) ── */
(function(){
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function(){ navigator.serviceWorker.register('/sw.js').catch(function(){}); });
  }
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var ua = navigator.userAgent;
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var inApp = /KAKAOTALK|NAVER\(|Instagram|FBAN|FBAV|Line\/|DaumApps|Whale\/.*Mobile.*NAVER/i.test(ua);
  var isSamsung = /SamsungBrowser/i.test(ua);
  var btn = document.getElementById('app-install');
  var deferred = null;
  if (standalone || !btn) return;
  btn.hidden = false;                                   /* 설치 전이면 항상 표시 */
  window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', function(){ btn.hidden = true; deferred = null; try{ toast('앱이 설치되었어요.'); }catch(err){} });

  function guide(title, steps){
    var d = document.createElement('div');
    d.className = 'ios-guide';
    d.innerHTML = '<div class="ios-guide-box" role="dialog" aria-label="' + title + '"><b>' + title + '</b><ol>' +
      steps.map(function(t){ return '<li>' + t + '</li>'; }).join('') + '</ol><button type="button">확인</button></div>';
    d.addEventListener('click', function(ev){ if (ev.target === d || ev.target.tagName === 'BUTTON') d.remove(); });
    document.body.appendChild(d);
  }

  window.mmInstall = function(){
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.finally(function(){ deferred = null; });
      return;
    }
    if (inApp) return guide('브라우저에서 열어 주세요', [
      '카카오톡·네이버 앱 안에서는 설치가 안 돼요.',
      '화면의 <strong>⋯</strong> 또는 <strong>⋮</strong> 메뉴에서 <strong>다른 브라우저로 열기</strong>를 누르세요.',
      (isIOS ? '사파리' : '크롬') + '에서 다시 <strong>앱 설치</strong>를 누르면 돼요.']);
    if (isIOS) return guide('아이폰에 앱 설치하기', [
      '하단(또는 상단)의 <strong>공유</strong> 버튼을 누르세요.',
      '<strong>홈 화면에 추가</strong>를 고르세요.',
      '오른쪽 위 <strong>추가</strong>를 누르면 완료돼요.',
      '아이폰은 이렇게 설치한 앱에서만 <strong>휴대폰 알림</strong>을 받을 수 있어요. 앱에서 🔔 → 휴대폰 알림 설정으로 켜 주세요.']);
    if (isSamsung) return guide('삼성 인터넷에서 설치하기', [
      '하단 <strong>≡</strong> 메뉴를 누르세요.',
      '<strong>현재 페이지 추가</strong> → <strong>홈 화면</strong>을 고르세요.']);
    if (isAndroid) return guide('안드로이드에 앱 설치하기', [
      '크롬 오른쪽 위 <strong>⋮</strong> 메뉴를 누르세요.',
      '<strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를 고르세요.',
      '이미 설치했다면 홈 화면의 멘야마쯔리 아이콘으로 여시면 돼요.']);
    return guide('PC에 앱 설치하기', [
      '크롬·엣지 주소창 오른쪽의 <strong>설치</strong> 아이콘을 누르세요.',
      '안 보이면 <strong>⋮</strong> 메뉴 → <strong>저장 및 공유</strong> → <strong>페이지를 앱으로 설치</strong>를 고르세요.',
      '이미 설치했다면 바탕화면·시작 메뉴의 멘야마쯔리로 여시면 돼요.']);
  };
})();
