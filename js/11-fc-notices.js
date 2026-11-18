
// v3.3: 최근 FC다움 스마트공지 (점주 대상) 2줄
let FC_NOTICES = [];
const FC_NOTICE_URL='https://fcdaum.com/comu/snotice/for-store';
function noticeStrip(){
 return '<section class="notice-strip"><div class="ns-h">'+ic('book')+'<b>최근 점주 공지</b><a href="'+FC_NOTICE_URL+'" target="_blank" rel="noopener">FC다움 공지 전체 '+ic('arrow')+'</a></div>'+
  FC_NOTICES.slice(0,2).map(n=>'<div class="ns-row"><span class="ns-date">'+n.at.slice(5)+'</span><span class="ns-title" title="'+n.title+'">'+n.title+'</span><span class="ns-meta">'+n.target+' · 열람 '+n.read+'</span></div>').join('')+'</section>';
}
const pageDashboardV33=pageDashboard;
pageDashboard=function(){ pageDashboardV33(); document.querySelector('.page-hero').insertAdjacentHTML('afterend',noticeStrip()); };
