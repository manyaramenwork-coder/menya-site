
/* ==========================================================
   휴대폰 알림 (2026-11-04) — 웹 푸시
   - 보내는 일: 결재 차례 · 결재 재알림(24시간 지나면 다음 날 9시 한 번) · 내 상신 결과 · 필독 공지 · 수집 이상(관리자)
   - 밤 10시~아침 7시 알림은 7시에 모아서 (수집 이상은 7~22시 매시 점검)
   - Supabase: push_subs(기기) · push_prefs(종류별 켜기) · push_queue → Edge Function push-send (매분)
   - 알림을 누르면 /?go=페이지&id=번호 로 열려 해당 상신·공지로 이동
   - 로그아웃하면 이 기기 알림 연결을 끊고, 다시 로그인하면 자동으로 다시 연결
   ========================================================== */
(function(){
  const VAPID = 'BMyjGCMhmrVOC5aEb0uKdqRAXcnffTLJ8FYow7hyKjYMEpHaBJzubuX3pMm84FK-BPYfVEKuVOZAkZB9ajjwTV8';
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const inApp = /KAKAOTALK|NAVER\(|Instagram|FBAN|FBAV|Line\/|DaumApps/i.test(ua);
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const user = () => (typeof SESSION !== 'undefined' && SESSION && SESSION.user) ? SESSION.user : null;
  const b64 = s => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
  const PS = { data: null };

  const st = document.createElement('style');
  st.textContent = `
  .ps-dev{display:flex;align-items:center;gap:10px;background:#f6f7f3;border-radius:10px;padding:12px 14px;margin-bottom:12px}
  .ps-dev span{flex:1;font-size:13px;color:#2d3726;line-height:1.5}.ps-dev small{display:block;color:#8b9381;font-size:12px}
  .ps-warn{background:#fbf3e2;color:#6b4e12;border-radius:10px;padding:10px 12px;font-size:12.5px;line-height:1.6;margin-bottom:12px}
  .ps-list{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:10px;margin-bottom:10px}
  .ps-list label{display:flex;align-items:center;gap:10px;padding:11px 14px;border-top:1px solid var(--line);font-size:13px;color:#2d3726;cursor:pointer}
  .ps-list label:first-child{border-top:0}.ps-list label span{flex:1}.ps-list small{display:block;color:#8b9381;font-size:11.5px}
  .ps-list input{width:18px;height:18px;accent-color:#c62429}
  .ps-note{font-size:12px;color:#8b9381;line-height:1.6}`;
  document.head.appendChild(st);

  async function curSub(){
    if (!supported()) return null;
    const reg = await navigator.serviceWorker.getRegistration(); if (!reg) return null;
    return reg.pushManager.getSubscription();
  }
  async function link(sub){
    const j = sub.toJSON();
    const { error } = await SB.rpc('push_subscribe', { p: { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, ua: ua.slice(0, 200) } });
    if (error) throw error;
  }
  function envWarn(){
    if (inApp) return '카카오톡·네이버 앱 안에서는 알림을 받을 수 없어요. 사파리·크롬에서 열어 앱으로 설치해 주세요.';
    if (isIOS && !standalone()) return '아이폰은 <b>홈 화면에 추가</b>로 설치한 앱에서만 알림을 받을 수 있어요. 상단 <b>앱 설치</b>를 눌러 설치한 뒤, 설치한 앱에서 다시 켜 주세요.';
    if (!supported()) return '이 브라우저는 알림을 지원하지 않아요. 크롬·사파리 최신 버전에서 열어 주세요.';
    if (Notification.permission === 'denied') return '이 기기에서 알림이 차단돼 있어요. 휴대폰 설정 → 알림(또는 브라우저 사이트 설정)에서 멘야마쯔리 알림을 허용해 주세요.';
    return '';
  }
  window.pushOn = async function(){
    const w = envWarn(); if (w) return toast(w.replace(/<[^>]+>/g, ''));
    const btn = document.getElementById('ps-btn'); if (btn) { btn.disabled = true; btn.textContent = '켜는 중...'; }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('알림 허용을 눌러야 받을 수 있어요');
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID) });
      await link(sub);
      toast('이 기기에서 알림을 받아요.');
    } catch (e) { toast('알림을 켜지 못했어요: ' + (e.message || e)); }
    pushSettings();
  };
  window.pushOff = async function(){
    try { const sub = await curSub(); if (sub) { await SB.rpc('push_unsubscribe', { p_endpoint: sub.endpoint }); await sub.unsubscribe(); } toast('이 기기 알림을 껐어요.'); }
    catch (e) { toast('끄지 못했어요: ' + (e.message || e)); }
    pushSettings();
  };
  window.pushPref = async function(k, v){
    if (!PS.data) return; PS.data[k] = v;
    const { error } = await SB.rpc('push_prefs_save', { p: { approve: PS.data.approve, result: PS.data.result, notice: PS.data.notice, health: PS.data.health } });
    if (error) toast('저장 실패: ' + error.message);
  };
  window.pushTest = async function(){
    const { error } = await SB.rpc('push_test');
    toast(error ? error.message : '1분 안에 시험 알림이 와요.');
  };
  window.pushSettings = async function(){
    if (!user() || !window.SB) return toast('로그인 후 설정할 수 있어요.');
    const [{ data, error }, sub] = await Promise.all([SB.rpc('push_settings'), curSub().catch(() => null)]);
    if (error) return toast('불러오지 못했어요: ' + error.message);
    PS.data = data;
    const on = !!sub && Notification.permission === 'granted', w = envWarn();
    const row = (k, t, d) => `<label><span>${t}<small>${d}</small></span><input type="checkbox" ${data[k] ? 'checked' : ''} onchange="pushPref('${k}',this.checked)"></label>`;
    iModal('휴대폰 알림', `
      ${w ? `<div class="ps-warn">${w}</div>` : ''}
      <div class="ps-dev"><span>이 기기 알림 <b>${on ? '켜짐' : '꺼짐'}</b><small>내 계정에 연결된 기기 ${data.devices}대</small></span>
        ${w ? '' : on ? `<button class="btn ghost" id="ps-btn" onclick="pushOff()">끄기</button>` : `<button class="btn primary" id="ps-btn" onclick="pushOn()">알림 켜기</button>`}</div>
      <div class="ps-list">
        ${row('approve', '결재 차례', '내가 결재할 차례 · 24시간 지나면 다음 날 9시에 한 번 더')}
        ${row('result', '내 상신 결과', '승인 또는 반려')}
        ${row('notice', '필독 공지', '필독으로 올라온 공지만')}
        ${data.admin ? row('health', '수집 이상', '매출·발주·출결 수집이 멈췄을 때 (관리자)') : ''}
      </div>
      <p class="ps-note">밤 10시~아침 7시에 생긴 알림은 아침 7시에 모아서 보내요. 참조와 일반 공지는 사이트 안 🔔에서 확인해 주세요.</p>`, closeM, '닫기');
    const foot = document.querySelector('#inv-modal .im-foot');
    foot.querySelector('.btn.ghost')?.remove();
    if (data.devices) foot.insertAdjacentHTML('afterbegin', `<button class="btn ghost" style="margin-right:auto" onclick="pushTest()">시험 알림 보내기</button>`);
  };
  const closeM = () => document.getElementById('inv-modal')?.remove();

  /* ---------- 알림 눌러서 들어왔을 때 이동 ---------- */
  function route(url){
    let q; try { q = new URL(url, location.origin).searchParams; } catch (e) { return; }
    const p = q.get('go'), id = +q.get('id') || 0; if (!p) return;
    try { go(p); } catch (e) { return; }
    if (!id) return;
    setTimeout(() => {
      if (/^ap-/.test(p) && window.apOpen) apOpen(id);
      else if (p === 'notice' && window.ntOpen) ntOpen(id);
      else if (p === 'fn-notice' && window.fnOpen) fnOpen(id, 'talk');
      else if (p === 'mp-notices' && window.npOpen) npOpen(id);
      else if (p === 'mp-orders' && window.mpOpen) mpOpen(id);
    }, 600);
  }
  let pending = new URLSearchParams(location.search).get('go') ? location.href : null;
  if (pending) history.replaceState(null, '', location.pathname);
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.type === 'mm-go') { if (user()) route(e.data.url); else pending = e.data.url; }
  });

  /* ---------- 로그인하면 기기 다시 연결 · 대기 중인 이동 처리 ---------- */
  let lastUid = '';
  setInterval(async () => {
    const u = user(); const app = document.getElementById('app');
    if (!u || !window.SB || !app || app.style.display === 'none') { lastUid = ''; return; }
    if (pending) { const url = pending; pending = null; route(url); }
    if (u.uid === lastUid) return; lastUid = u.uid;
    try { if (Notification.permission === 'granted') { const sub = await curSub(); if (sub) await link(sub); } } catch (e) {}
  }, 1000);

  /* ---------- 로그아웃하면 이 기기 연결 끊기 ---------- */
  if (typeof logout === 'function') {
    const logoutPush = logout;
    logout = async function(){
      try { const sub = await curSub(); if (sub && window.SB && user()) await SB.rpc('push_unsubscribe', { p_endpoint: sub.endpoint }); } catch (e) {}
      return logoutPush.apply(this, arguments);
    };
  }
})();
