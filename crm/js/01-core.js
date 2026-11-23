const CFG = window.MM_CONFIG;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tel = s => (window.mmTel ? window.mmTel(s) : (s || ''));

/* 매장관리와 같은 로그인 저장 방식 */
const keepOn = () => { try { return localStorage.getItem('mm-keep') !== '0'; } catch (e) { return false; } };
const authStore = {
  getItem: k => { try { return localStorage.getItem(k) ?? sessionStorage.getItem(k); } catch (e) { return sessionStorage.getItem(k); } },
  setItem: (k, v) => { try { if (keepOn()) { localStorage.setItem(k, v); sessionStorage.removeItem(k); } else { sessionStorage.setItem(k, v); localStorage.removeItem(k); } } catch (e) { sessionStorage.setItem(k, v); } },
  removeItem: k => { try { localStorage.removeItem(k); } catch (e) {} sessionStorage.removeItem(k); }
};
const SB = supabase.createClient(CFG.url, CFG.key, { auth: { storage: authStore, storageKey: 'mm-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });

const STAGES = [['collected','수집'],['contacted','1차 통화'],['interested','관심'],['meeting','미팅'],['trial','시식·실사'],['proposal','제안'],['contract','계약'],['hold','보류'],['rejected','거절']];
const ST = Object.fromEntries(STAGES);
const FLOW = STAGES.slice(0, 7).map(s => s[0]);
const LUNCH = { A: 'A 점심 미영업', B: 'B 점심 부진', C: 'C 점심 양호', U: '미확인' };
const ORG = { menya: '멘야마쯔리', oyumi: '오유미당', joint: '공동' };
const SRC = { public: '공공데이터', license: '인허가', landing: '랜딩 신청', openchat: '오픈톡', cafe: '카페', listing: '양도 매물', referral: '거래처 소개', manual: '직접 입력' };
const RES = { interested: '관심', hold: '보류', rejected: '거절', no_answer: '부재', meeting_set: '미팅 확정', wrong_number: '번호 오류' };
const RES_STAGE = { interested: 'interested', meeting_set: 'meeting', hold: 'hold', rejected: 'rejected' };
const SEG = { izakaya: '이자카야·일식', delivery: '배달' };
const chainTag = r => (r.chain || r.is_chain ? ' <span class="tag t-C">체인</span>' : '') + (r.name_check ? ' <span class="tag t-U">상호 확인 필요</span>' : '');
const KIND = { call: '통화', sms: '문자', meeting: '미팅', memo: '메모', landing: '랜딩 신청', stage: '단계 변경', import: '수집' };

const state = { view: 'db', cats: [], offset: 0, rows: [], users: [], regions: [], cur: null };

function toast(m, err){ const t = $('toast'); t.textContent = m; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, 2600); }
function errMsg(e){ const m = String((e && e.message) || e || ''); return m.replace(/^.*?:\s*/, '') || '처리하지 못했어요. 잠시 후 다시 시도하세요.'; }
async function rpc(fn, args){ const { data, error } = await SB.rpc(fn, args); if (error) throw error; return data; }
function today(){ return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
function addDays(n){ return new Date(Date.now() + 9 * 3600e3 + n * 864e5).toISOString().slice(0, 10); }
function shortDate(d){ if (!d) return ''; const [, m, dd] = d.split('-'); const w = '일월화수목금토'[new Date(d + 'T00:00:00+09:00').getDay()]; return `${+m}/${+dd} (${w})`; }
function naverLink(r){
  const u = r.naver || r.naver_url;
  if (u) return u;
  return 'https://map.naver.com/p/search/' + encodeURIComponent([r.name, r.sigungu, r.dong].filter(Boolean).join(' '));
}
// 평수: 10~20평이면 '평수 맞음', 모르면 '평수 미확인', 기준 밖이면 평수만 표시(기본 목록에선 숨겨짐)
function pyTag(r){ if (r.pyeong == null) return '<span class="muted">평수 미확인</span>'; return r.area_ok ? `<span class="tag t-ok">${r.pyeong}평 맞음</span>` : `${r.pyeong}평`; }
function lunchTag(l){ return `<span class="tag t-${esc(l || 'U')}">${esc(LUNCH[l] || '미확인')}</span>`; }

