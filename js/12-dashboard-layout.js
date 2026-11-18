// v3.4: 대시보드 배치 정리 - 할 일 → FC다움 발주 → 제때 공급 → 바로가기
function secHead(n, title, chip, sub){
  return `<div class="sec-head"><span class="sec-n">${n}</span><h2>${title}</h2>${chip?`<span class="src ${chip.cls}">${chip.t}</span>`:''}${sub?`<small>${sub}</small>`:''}</div>`;
}
const pageDashboardV34 = pageDashboard;
pageDashboard = function(){
  pageDashboardV34();
  const main = document.getElementById('main');
  const q = s => main.querySelector(s);
  const hero = q('.page-hero'), notice = q('.notice-strip'), fc = q('.fc-card'), note = q('.data-note'),
        sum = q('.dash-sum'), grid = q('.dash-grid'), short = q('.shortcuts')?.closest('.card'), foot = q('.page-footer');
  hero.classList.add('compact');
  hero.querySelector('p').textContent = '오늘 처리할 일부터 확인하세요. 아래로 갈수록 상세 현황이에요.';
  // FC 카드에서 '처리 대기' 부분 분리
  const fcKpis = [...fc.querySelectorAll('.fc-kpi')];
  const nNew = fcKpis[0].querySelector('b').textContent, nIng = fcKpis[1].querySelector('b').textContent;
  const pendList = fc.querySelector('.fc-list'), pendSub = fc.querySelector('.fc-sub');
  fcKpis[0].remove(); fcKpis[1].remove(); pendSub.remove();
  fc.querySelector('.section-title strong').innerHTML = `${ic('coin')}발주 금액 · 품목 현황`;
  fc.querySelector('.fc-top').classList.add('two');
  const hint = fc.querySelector('.dash-hint'); if (hint) hint.remove();
  // 섹션 1: 오늘 확인할 것
  const s1 = document.createElement('section'); s1.className = 'dash-sec';
  s1.innerHTML = secHead('1', '오늘 확인할 것', {cls:'fc', t:'FC다움'}, '새 발주와 최근 공지') +
    `<div class="today-grid"><div class="card todo-card"><div class="todo-top">
       <div class="todo-k alert"><span>새 발주 (미확인)</span><b>${nNew}</b></div>
       <div class="todo-k"><span>진행중</span><b>${nIng}</b></div>
       <a class="btn" href="${FC_URL}" target="_blank" rel="noopener">${ic('arrow')}FC다움에서 처리하기</a></div>
       <div class="todo-list"></div><p class="dash-hint">이 화면은 확인용이에요. 확인·완료 처리는 FC다움에서만 해요.</p></div>
     <div class="todo-notice"></div></div>`;
  s1.querySelector('.todo-list').append(pendList);
  s1.querySelector('.todo-notice').append(notice);
  // 섹션 2: 본사 택배 발주
  const s2 = document.createElement('section'); s2.className = 'dash-sec';
  s2.innerHTML = secHead('2', '본사 택배 발주', {cls:'fc', t:'FC다움'}, `최근 12개월 · ${FC_SYNCED} 기준`);
  s2.append(fc);
  // 섹션 3: 제때 공급 현황
  const s3 = document.createElement('section'); s3.className = 'dash-sec';
  s3.innerHTML = secHead('3', '제때 공급 현황', {cls:'jt', t:'제때'}, META.dashLabel + ' · 배송일 기준');
  s3.append(note, sum, grid);
  // 섹션 4: 바로가기
  const s4 = document.createElement('section'); s4.className = 'dash-sec';
  s4.innerHTML = secHead('4', '바로가기', null, '');
  s4.append(short);
  hero.after(s1); s1.after(s2); s2.after(s3); s3.after(s4);
};
