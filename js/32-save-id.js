
// 아이디 저장 (2026-11-02) — 체크 시 아이디만 이 브라우저에 저장, 비밀번호는 저장하지 않음
(function(){
  var K='mm_saved_uid', cb=document.getElementById('mlg-remember'), uid=document.getElementById('uid'), box=document.getElementById('loginbox');
  if(!cb||!uid||!box) return;
  try{ var v=localStorage.getItem(K); if(v){ uid.value=v; cb.checked=true; } }catch(e){}
  box.addEventListener('submit',function(){ try{ if(cb.checked) localStorage.setItem(K,uid.value.trim()); else localStorage.removeItem(K); }catch(e){} });
  cb.addEventListener('change',function(){ if(!cb.checked){ try{ localStorage.removeItem(K); }catch(e){} } });
  // 로그인 유지 (기본 켜짐) — 개인 휴대폰은 켜 두고, 같이 쓰는 기기는 끄기
  var kp=document.getElementById('mlg-keep');
  if(kp){
    try{ kp.checked = localStorage.getItem('mm-keep') !== '0'; }catch(e){}
    var setKeep=function(){ try{ localStorage.setItem('mm-keep', kp.checked ? '1' : '0'); }catch(e){} };
    kp.addEventListener('change', setKeep); box.addEventListener('submit', setKeep);
  }
})();
