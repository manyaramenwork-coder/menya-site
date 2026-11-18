
// 메뉴마다 다른 대표 사진
const HERO_IMG={'dash':'--hp-night'};
const HERO_SOON={};
const HERO_POS={'--hp-night':'center 55%','--hp-night2':'center 60%','--hp-front':'center 45%','--hp-hwasan':'center 55%'};
const goHero=go;
go=function(p,t){ const r=goHero(p,t); const el=document.querySelector('.page-hero .hero-image'); if(el){ const v=HERO_IMG[p]||'--img0'; el.style.backgroundImage='linear-gradient(90deg,#eaece3,transparent 40%),var('+v+')'; el.style.backgroundPosition=HERO_POS[v]||''; } if(p==='soon'){ const c=document.querySelector('.crumb'); if(c) c.innerHTML=ic('home')+'<span>워크스페이스</span><span>/</span><span>'+t+'</span>'; } return r; };
