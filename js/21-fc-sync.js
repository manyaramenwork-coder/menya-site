
// v4.0: FC다움 자동 동기화 반영 (1분마다 확인) — 5회차에서 Supabase fc_state로 다시 연결
(function(){ if (!(window.google && google.script && google.script.run)) return;
  var CUR = ['dash'];
  var goPrev = go;
  go = function(p, t){ CUR = [p, t]; return goPrev(p, t); };
  var ver = META.fcVer || '';
  function busy(){ var a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }
  function redraw(){ var b = document.getElementById('fc-upd-bar'); if (b) b.remove(); go(CUR[0], CUR[1]); }
  function bar(){
    if (document.getElementById('fc-upd-bar')) return;
    var b = document.createElement('button'); b.id = 'fc-upd-bar'; b.type = 'button';
    b.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;border:0;background:#22311f;color:#fff;padding:10px 18px;border-radius:999px;font-size:14px;box-shadow:0 6px 20px rgba(0,0,0,.22);cursor:pointer';
    b.textContent = 'FC다움 발주가 새로 반영됐어요 · 눌러서 다시 보기'; b.onclick = redraw; document.body.appendChild(b);
  }
  function check(){
    if (document.hidden) return;
    google.script.run.withSuccessHandler(function(r){
      if (!r) return;
      if (r.fcSynced) { FC_SYNCED = r.fcSynced; META.fcSynced = r.fcSynced; }
      if (!r.fc || r.ver === ver) return;
      ver = r.ver;
      FC.splice.apply(FC, [0, FC.length].concat(r.fc));
      if (CUR[0] === 'dash' && !busy()) { redraw(); try{ toast('FC다움 발주가 새로 반영됐어요.'); }catch(e){} }
      else bar();
    }).withFailureHandler(function(){}).fcState(SESSION.token, ver);
  }
  setInterval(check, 60000);
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) check(); });
})();
