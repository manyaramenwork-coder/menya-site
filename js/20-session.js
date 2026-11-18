
let SESSION = {token:'', user:null, mustChange:false};
function greetName(){ var u=SESSION.user||{}; var n=(u.name||'').trim(), t=(u.title||'').trim(); return esc((n+(t?' '+t:'')).trim()||u.id||'') + '님'; }
