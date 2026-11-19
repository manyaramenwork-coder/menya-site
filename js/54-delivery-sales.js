
/* ==========================================================
   배달 매출 (2026-11-18) — 매출 관리 > 배달 매출 (관리자·본사)
   - 인프라D(배달대행) 가맹점 PC 프로그램의 엑셀 2개를 올림: 매출통계 > 배달접수통계, 적립금내역
   - 배달접수통계 xls는 프로그램이 열기 암호(RC4)를 걸어 내보냄 → 브라우저 안에서 풀어서 읽음 (암호·개인정보는 서버로 안 보냄)
   - 암호는 출력할 때마다 바뀜 → 화면 위 암호 칸에 적음 (저장 안 함, 적으면 바로 다시 읽음)
   - 2026-11-19: 오류 파일이 하나라도 있으면 저장 잠금(전엔 빼고 저장돼서 주문 0건이 들어감), 파일별 '빼기'. 엑셀로 다시 저장한 암호 파일(RC4 CryptoAPI)은 원본을 올리라고 안내
   - 순 배달매출 = 결제금액 합계 − 적립금 차감 전부 (배달료·부가세·월 관리비·입금 수수료 등, 출금 요청은 제외)
   - 영업일: 새벽 5시 기준 (프로그램 주문조회 기준시간과 같음). 적립금 줄은 메모 속 (날짜/콜번호)로 주문 날짜에 붙임
   - 서버: delivery_upload(관리자·본사) / delivery_data(로그인 직원), 테이블 delivery_orders · delivery_ledger
   - 2026-11-19 배민 포장(픽업): 앱 카드결제라 포스·인프라D 어디에도 안 잡힘 → 날짜별 건수·금액(delivery_pickup).
     어사이드(브라우저 AI)가 매일 주소를 열어 넣음: functions/v1/baemin-pickup?key=...&d=11-13:1:11000,...
     이 화면에서 직접 고칠 수도 있고, 어사이드 키를 새로 만들 수 있음(키는 해시만 저장, 만들 때 한 번만 보여 줌)
     배달 매출 = 인프라D 결제금액 + 배민 포장 (메모장 정산과 같은 기준)
   ========================================================== */
/* ---- 엑셀(xls) 열기 암호(RC4) 풀기: 브라우저 안에서만 ---- */
const DV_CRYPT = (function(){
  // MD5 (RFC 1321)
  function md5(bytes){
    const K = new Uint32Array(64), S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
    for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
    const n = bytes.length, total = ((n + 8) >>> 6) * 64 + 64, m = new Uint8Array(total);
    m.set(bytes); m[n] = 0x80;
    const bits = n * 8; m[total - 8] = bits & 255; m[total - 7] = (bits >>> 8) & 255; m[total - 6] = (bits >>> 16) & 255; m[total - 5] = (bits >>> 24) & 255;
    m[total - 4] = Math.floor(n / 536870912) & 255;
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    const W = new Uint32Array(16);
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = m[off + i * 4] | (m[off + i * 4 + 1] << 8) | (m[off + i * 4 + 2] << 16) | (m[off + i * 4 + 3] << 24);
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + W[g]) >>> 0; A = D; D = C; C = B;
        B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    const out = new Uint8Array(16);
    [a0, b0, c0, d0].forEach((v, i) => { out[i * 4] = v & 255; out[i * 4 + 1] = (v >>> 8) & 255; out[i * 4 + 2] = (v >>> 16) & 255; out[i * 4 + 3] = (v >>> 24) & 255; });
    return out;
  }
  function rc4(key, len){
    const s = new Uint8Array(256); for (let i = 0; i < 256; i++) s[i] = i;
    for (let i = 0, j = 0; i < 256; i++) { j = (j + s[i] + key[i % key.length]) & 255; const t = s[i]; s[i] = s[j]; s[j] = t; }
    const out = new Uint8Array(len);
    for (let k = 0, i = 0, j = 0; k < len; k++) { i = (i + 1) & 255; j = (j + s[i]) & 255; const t = s[i]; s[i] = s[j]; s[j] = t; out[k] = s[(s[i] + s[j]) & 255]; }
    return out;
  }
  const cat = (...a) => { const o = new Uint8Array(a.reduce((x, y) => x + y.length, 0)); let p = 0; a.forEach(x => { o.set(x, p); p += x.length; }); return o; };
  function utf16(pw){ const o = new Uint8Array(pw.length * 2); for (let i = 0; i < pw.length; i++) { const c = pw.charCodeAt(i); o[i * 2] = c & 255; o[i * 2 + 1] = c >>> 8; } return o; }
  function baseKey(pw, salt){ const h0 = md5(utf16(pw)).slice(0, 5); let buf = new Uint8Array(0); for (let i = 0; i < 16; i++) buf = cat(buf, h0, salt); return md5(buf).slice(0, 5); }
  function blockKey(h1, b){ return md5(cat(h1, new Uint8Array([b & 255, (b >>> 8) & 255, (b >>> 16) & 255, (b >>> 24) & 255]))); }
  const PLAIN = new Set([0x0809, 0x002F, 0x0194, 0x0195, 0x00E1, 0x0196, 0x0138]);
  const u16 = (d, p) => d[p] | (d[p + 1] << 8);

  // 반환: null(암호 없음) | { type: 'rc4' | 'other', salt, ver, vhash }
  function info(stream){
    for (let p = 0; p + 4 <= stream.length;) {
      const t = u16(stream, p), n = u16(stream, p + 2);
      if (t === 0x002F) {
        const d = stream.subarray(p + 4, p + 4 + n);
        if (u16(d, 0) !== 1 || u16(d, 2) !== 1 || u16(d, 4) !== 1) return { type: 'other' };
        return { type: 'rc4', salt: d.slice(6, 22), ver: d.slice(22, 38), vhash: d.slice(38, 54) };
      }
      if (t === 0x000A) return null;   // 첫 묶음 끝(EOF)까지 FilePass가 없으면 암호 없음
      p += 4 + n;
    }
    return null;
  }
  function check(inf, pw){
    const h1 = baseKey(pw, inf.salt), ks = rc4(blockKey(h1, 0), 32);
    const v = inf.ver.map((x, i) => x ^ ks[i]), vh = inf.vhash.map((x, i) => x ^ ks[16 + i]);
    const m = md5(v); return m.every((x, i) => x === vh[i]);
  }
  // 암호가 걸린 Workbook 스트림을 풀어 새 배열로 돌려줌 (FilePass 자리는 0으로 채움)
  function decrypt(stream, pw){
    const inf = info(stream); if (!inf) return stream;
    if (inf.type !== 'rc4') throw new Error('엑셀에서 다시 저장하면서 바뀐 암호라 열 수 없어요. 프로그램에서 받은 원본 파일을 손대지 말고 그대로 올려 주세요.');
    if (!check(inf, pw)) throw new Error('PASSWORD');
    const h1 = baseKey(pw, inf.salt), out = new Uint8Array(stream), nb = Math.ceil(stream.length / 1024);
    const ks = new Uint8Array(nb * 1024);
    for (let b = 0; b < nb; b++) ks.set(rc4(blockKey(h1, b), 1024), b * 1024);
    for (let p = 0; p + 4 <= stream.length;) {
      const t = u16(stream, p), n = u16(stream, p + 2), s = p + 4, e = Math.min(s + n, stream.length);
      if (t === 0x002F) out.fill(0, p, p + 2), out.fill(0, s, e);
      else if (!PLAIN.has(t)) for (let i = (t === 0x0085 ? s + 4 : s); i < e; i++) out[i] = stream[i] ^ ks[i];
      p = s + n;
    }
    return out;
  }
  // 테스트용: 같은 규칙으로 암호 걸기 (FilePass 자리는 이미 들어 있어야 함)
  function encrypt(stream, pw, salt, verifier){
    const h1 = baseKey(pw, salt), k0 = rc4(blockKey(h1, 0), 32);
    const vh = md5(verifier), ev = verifier.map((x, i) => x ^ k0[i]), evh = vh.map((x, i) => x ^ k0[16 + i]);
    const out = new Uint8Array(stream), nb = Math.ceil(stream.length / 1024), ks = new Uint8Array(nb * 1024);
    for (let b = 0; b < nb; b++) ks.set(rc4(blockKey(h1, b), 1024), b * 1024);
    for (let p = 0; p + 4 <= stream.length;) {
      const t = u16(stream, p), n = u16(stream, p + 2), s = p + 4, e = s + n;
      if (t === 0x002F) { out.set([1, 0, 1, 0, 1, 0], s); out.set(salt, s + 6); out.set(ev, s + 22); out.set(evh, s + 38); }
      else if (!PLAIN.has(t)) for (let i = (t === 0x0085 ? s + 4 : s); i < e; i++) out[i] = stream[i] ^ ks[i];
      p = e;
    }
    return out;
  }
  return { md5, info, check, decrypt, encrypt };
})();

/* ---- 인프라D 엑셀 읽기: 필요한 칸만 꺼냄 (주소·전화·메모·기사 정보는 버림) ---- */
const DV_PARSE = (function(){
  const num = v => { if (typeof v === 'number') return Math.round(v); const s = String(v ?? '').replace(/[^0-9.-]/g, ''); return s ? Math.round(+s) : 0; };
  const p2 = n => String(n).padStart(2, '0');
  // 'YYYY-MM-DD HH:MM' 로 맞춤 (문자·날짜·엑셀 숫자 모두)
  function ts(v){
    if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${p2(v.getMonth() + 1)}-${p2(v.getDate())} ${p2(v.getHours())}:${p2(v.getMinutes())}`;
    if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 864e5)); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`; }
    const m = String(v ?? '').trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})[ T]+(\d{1,2}):(\d{2})/);
    return m ? `${m[1]}-${p2(m[2])}-${p2(m[3])} ${p2(m[4])}:${m[5]}` : '';
  }
  // 영업일: 새벽 5시 전 주문은 전날 (프로그램 '주문조회 기준시간 05시'와 같음)
  function bizDate(t){ const d = new Date(t.slice(0, 10) + 'T00:00:00Z'); if (+t.slice(11, 13) < 5) d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }
  function findHead(rows, need){ for (let i = 0; i < Math.min(rows.length, 15); i++) { const r = rows[i].map(x => String(x ?? '').trim()); if (need.every(k => r.includes(k))) return i; } return -1; }

  function read(rows){
    let h = findHead(rows, ['콜번호', '결제금액']);
    if (h >= 0) {
      const H = rows[h].map(x => String(x ?? '').trim()), c = k => H.indexOf(k), out = [], stores = new Set();
      for (const r of rows.slice(h + 1)) {
        const call = String(r[c('콜번호')] ?? '').trim(); if (!/^\d+-\d+$/.test(call)) continue;
        const at = ts(r[c('등록시간')]); if (!at) continue;
        if (c('상점명') >= 0 && r[c('상점명')]) stores.add(String(r[c('상점명')]).trim());
        out.push({ call, at, date: bizDate(at), status: String(r[c('콜상태')] ?? '').trim() || '완료', pay: String(r[c('결제방법')] ?? '').trim(),
          amount: num(r[c('결제금액')]), fee: c('배달요금') >= 0 ? num(r[c('배달요금')]) : 0, vat: c('부가세') >= 0 ? num(r[c('부가세')]) : 0 });
      }
      return { kind: 'orders', rows: out, stores: [...stores] };
    }
    h = findHead(rows, ['타입', '금액', '잔액(카드포함)']);
    if (h >= 0) {
      const H = rows[h].map(x => String(x ?? '').trim()), c = k => H.indexOf(k), out = [], stores = new Set();
      for (const r of rows.slice(h + 1)) {
        const at = ts(r[c('등록일시')]), kind = String(r[c('타입')] ?? '').trim(); if (!at || !kind) continue;
        if (c('상점명') >= 0 && r[c('상점명')]) stores.add(String(r[c('상점명')]).trim());
        const memo = String(r[c('메모')] ?? '').trim(), m = memo.match(/\((\d{4})(\d{2})(\d{2})\/(\d+-\d+)\)/);
        out.push({ at, kind, amount: num(r[c('금액')]), balance: num(r[c('잔액(카드포함)')]), memo: memo.slice(0, 200),
          call: m ? m[4] : '', date: m ? `${m[1]}-${m[2]}-${m[3]}` : at.slice(0, 10) });
      }
      return { kind: 'ledger', rows: out, stores: [...stores] };
    }
    return { kind: 'unknown', rows: [] };
  }
  return { read, ts, bizDate, num };
})();

/* ---------- 화면: 매출 관리 > 배달 매출 (관리자·본사) ---------- */
(function(){
  const PAGE = 'delivery-sales', STORE = 1, STORE_NAME = '쌍용점', PW_KEY = 'mm_dv_pw';
  const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const won = n => Math.round(n || 0).toLocaleString('ko-KR');
  const can = () => !!(SESSION.user && ['admin', 'hq'].includes(SESSION.user.role));
  const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const dow = d => '일월화수목금토'[new Date(d + 'T00:00:00').getDay()];
  const md = d => `${+d.slice(5, 7)}/${+d.slice(8)}(${dow(d)})`;
  const ymAddL = (ym, k) => { let y = +ym.slice(0, 4), m = +ym.slice(5, 7) + k; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return y + '-' + String(m).padStart(2, '0'); };
  const lastDay = ym => ym + '-' + String(new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate()).padStart(2, '0');
  const DV = { ym: kst().slice(0, 7), files: [], data: null, busy: false };

  const st = document.createElement('style');
  st.textContent = `
  .dv-drop{border:1.5px dashed var(--line);border-radius:12px;padding:22px;text-align:center;color:var(--sub);font-size:13px;cursor:pointer;background:var(--card,#fff)}
  .dv-drop.on{border-color:var(--brand);background:#fef6f6}
  .dv-drop b{color:var(--ink)}
  .dv-files{display:grid;gap:8px;margin-top:12px}
  .dv-file{display:flex;gap:10px;align-items:center;flex-wrap:wrap;border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:12px;background:var(--card,#fff)}
  .dv-file b{font-size:13px}.dv-file .ok{color:#2f7d32}.dv-file .bad{color:#c62429}.dv-file .sub{color:var(--sub)}
  .dv-pw{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 12px;font-size:12px;color:var(--sub)}
  .dv-pw > span:first-child{font-weight:600;color:var(--ink)}
  .dv-pw input[type=password]{min-height:38px;border:1px solid var(--line);border-radius:7px;padding:6px 10px;width:220px;font-size:14px}
  .dv-pw input.need{border-color:var(--brand);box-shadow:0 0 0 3px rgba(198,36,41,.12)}
  .dv-pwhelp{font-size:11px;color:var(--sub)}
  .dv-act{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:14px}
  .dv-sum{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:0 0 14px}
  .dv-pk{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
  .dv-pk th{text-align:left;font-weight:500;color:var(--sub);font-size:12px;padding:6px 8px;border-bottom:1px solid var(--line)}
  .dv-pk td{padding:5px 8px;border-bottom:1px solid var(--line)}.dv-pk .n{text-align:right}
  .dv-pk input{width:110px;min-height:34px;border:1px solid var(--line);border-radius:7px;padding:4px 8px;text-align:right;font-size:13px}
  .dv-pk .src{font-size:11px;color:var(--sub)}
  .dv-key{margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:12px;color:var(--sub);display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .dv-keybox{margin-top:10px;padding:12px;border:1px solid #eed8d5;background:#faf0ee;border-radius:10px;font-size:12px;color:var(--ink);word-break:break-all;line-height:1.7}
  .dv-keybox code{font-size:12px;background:var(--card,#fff);padding:2px 6px;border-radius:5px;border:1px solid var(--line)}
  .dv-sum div{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--card,#fff)}
  .dv-sum span{display:block;font-size:12px;color:var(--sub)}.dv-sum b{font-size:20px;font-variant-numeric:tabular-nums}
  .dv-sum .hl{background:#faf0ee;border-color:#eed8d5}.dv-sum .hl b{color:var(--brand)}
  .dv-mon{display:flex;align-items:center;gap:8px}.dv-mon b{font-size:14px;min-width:88px;text-align:center}
  .dv-t td.ck-ok{color:#2f7d32}.dv-t td.ck-bad{color:#c62429;font-weight:600}.dv-t td.ck-no{color:var(--sub)}
  .dv-note{font-size:11px;color:var(--sub);line-height:1.8;margin-top:10px}
  @media(max-width:900px){.dv-sum{grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media(max-width:600px){.dv-sum{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.appendChild(st);

  let xlP = null;
  function loadXlsx(){
    if (window.XLSX && window.XLSX.CFB) return Promise.resolve();
    return xlP || (xlP = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload = ok; s.onerror = () => { xlP = null; no(new Error('엑셀 도구를 불러오지 못했어요')); }; document.head.appendChild(s); }));
  }
  // 파일 → 표 (암호가 걸린 xls는 브라우저 안에서 풀기)
  function sheetRows(buf, pw){
    const u8 = new Uint8Array(buf);
    let wb;
    if (u8[0] === 0xD0 && u8[1] === 0xCF) {
      const cfb = XLSX.CFB.read(u8, { type: 'array' }), e = XLSX.CFB.find(cfb, 'Workbook') || XLSX.CFB.find(cfb, 'Book');
      const stream = e && Uint8Array.from(e.content), inf = stream && DV_CRYPT.info(stream);
      if (inf) {
        if (!pw) throw new Error('NEED_PW');
        e.content = DV_CRYPT.decrypt(stream, pw);
        wb = XLSX.read(XLSX.CFB.write(cfb, { type: 'array' }), { type: 'array', cellDates: true });
      }
    }
    wb = wb || XLSX.read(u8, { type: 'array', cellDates: true });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
  }
  const pwNow = () => (document.getElementById('dv-pw') || {}).value || '';
  async function readAll(){
    await loadXlsx();
    for (const f of DV.files) {
      if (f.res && f.res.kind !== 'error') continue;
      try {
        const r = DV_PARSE.read(sheetRows(f.buf, pwNow()));
        f.res = r.kind === 'unknown' ? { kind: 'error', msg: '배달접수통계나 적립금내역 파일이 아니에요' } : r;
      } catch (e) {
        f.res = { kind: 'error', need: e.message === 'NEED_PW' || e.message === 'PASSWORD',
          msg: e.message === 'NEED_PW' ? '암호가 걸린 파일이에요. 위 암호 칸에 이번 출력 암호를 적어 주세요' : e.message === 'PASSWORD' ? '파일 암호가 맞지 않아요' : (e.message || '파일을 읽지 못했어요') };
      }
    }
    drawFiles();
  }
  function addFiles(list){
    [...list].forEach(file => {
      if (!/\.xlsx?$/i.test(file.name)) return;
      const f = { name: file.name, buf: null, res: null }; DV.files.push(f);
      file.arrayBuffer().then(b => { f.buf = b; if (DV.files.every(x => x.buf)) readAll(); });
    });
  }
  function fileLine(f, i){
    const r = f.res;
    if (!r) return `<div class="dv-file"><b>${h(f.name)}</b><span class="sub">읽는 중...</span></div>`;
    const drop = `<button class="btn ghost" style="margin-left:auto" onclick="dvDrop(${i})">빼기</button>`;
    if (r.kind === 'error') return `<div class="dv-file"><b>${h(f.name)}</b><span class="bad">${h(r.msg)}</span><button class="btn ghost" style="margin-left:auto" onclick="dvDrop(${i})">빼기</button></div>`;
    const ds = r.rows.map(x => x.date).sort(), range = ds.length ? `${md(ds[0])} ~ ${md(ds[ds.length - 1])}` : '';
    const wrong = r.stores && r.stores.length && !r.stores.some(s => s.includes('쌍용'));
    const body = r.kind === 'orders'
      ? `배달접수통계 · 완료 ${r.rows.filter(x => x.status === '완료').length}건 · 결제금액 ${won(r.rows.filter(x => x.status === '완료').reduce((s, x) => s + x.amount, 0))}원`
      : `적립금내역 · ${r.rows.length}줄 · 차감 ${won(-r.rows.filter(x => x.amount < 0 && !/출금/.test(x.kind)).reduce((s, x) => s + x.amount, 0))}원`;
    const none = r.rows.length ? '' : `<span class="bad">읽은 줄이 없어요. 프로그램에서 받은 원본을 그대로 올려 주세요</span>`;
    return `<div class="dv-file"><b>${h(f.name)}</b><span class="${r.rows.length ? 'ok' : 'bad'}">${r.rows.length ? '✓' : '!'} ${body}</span><span class="sub">${range}</span>${none}${wrong ? `<span class="bad">상점명이 ${STORE_NAME}이 아니에요: ${h(r.stores[0])}</span>` : ''}${drop}</div>`;
  }
  function drawFiles(){
    const box = document.getElementById('dv-files'); if (!box) return;
    box.innerHTML = DV.files.map((f, i) => fileLine(f, i)).join('');
    const ready = DV.files.filter(f => f.res && (f.res.kind === 'orders' || f.res.kind === 'ledger') && f.res.rows.length);
    const bad = DV.files.some(f => f.res && (f.res.kind === 'error' || !f.res.rows.length)), wait = DV.files.some(f => !f.res);
    const wrongStore = ready.some(f => f.res.stores && f.res.stores.length && !f.res.stores.some(s => s.includes('쌍용')));
    const btn = document.getElementById('dv-save');
    const needPw = DV.files.some(f => f.res && f.res.need);
    if (btn) { btn.disabled = !ready.length || wait || bad || wrongStore || needPw || DV.busy; btn.textContent = ready.length ? `${ready.length}개 파일 저장` : '저장'; }
    const pwi = document.getElementById('dv-pw'); if (pwi) pwi.classList.toggle('need', DV.files.some(f => f.res && f.res.need));
    const hint = document.getElementById('dv-hint');
    if (hint) hint.textContent = needPw ? '암호를 적으면 저장할 수 있어요.' : bad ? '빨간 글씨 파일을 빼거나 원본으로 다시 올리면 저장할 수 있어요.' : (ready.length === 1 ? '두 파일을 같은 기간으로 같이 올리면 검산까지 맞춰 볼 수 있어요.' : '');
  }
  async function save(){
    const ready = DV.files.filter(f => f.res && (f.res.kind === 'orders' || f.res.kind === 'ledger') && f.res.rows.length);
    if (!ready.length || DV.busy || DV.files.some(f => !f.res || f.res.kind === 'error' || !f.res.rows.length)) return;
    const orders = [].concat(...ready.filter(f => f.res.kind === 'orders').map(f => f.res.rows));
    const ledger = [].concat(...ready.filter(f => f.res.kind === 'ledger').map(f => f.res.rows));
    DV.busy = true; drawFiles();
    try {
      const { data, error } = await window.SB.rpc('delivery_upload', { p_store: STORE, p_orders: orders, p_ledger: ledger });
      if (error) throw error;
      toast(`저장했어요 · 주문 ${data.orders}건 · 적립금 ${data.ledger}줄`);
      const ds = orders.concat(ledger).map(x => x.date).sort(); if (ds.length) DV.ym = ds[ds.length - 1].slice(0, 7);
      DV.files = []; const pwi = document.getElementById('dv-pw'); if (pwi) pwi.value = '';
      drawFiles(); window.DV_DASH_AT = 0; await Promise.all([loadMonth(), loadPick()]);
    } catch (e) { toast('저장하지 못했어요: ' + (e.message || e)); }
    DV.busy = false; drawFiles();
  }
  async function loadMonth(){
    const box = document.getElementById('dv-month'); if (box) box.innerHTML = '<div class="empty">불러오는 중...</div>';
    try {
      const { data, error } = await window.SB.rpc('delivery_data', { p_store: STORE, p_from: DV.ym + '-01', p_to: lastDay(DV.ym) });
      if (error) throw error;
      DV.data = data; drawMonth();
    } catch (e) { if (box) box.innerHTML = `<div class="empty">불러오지 못했어요. ${h(e.message || '')}</div>`; }
  }
  function drawMonth(){
    const box = document.getElementById('dv-month'), D = DV.data; if (!box || !D) return;
    const days = D.days || [];
    const sales = days.reduce((s, d) => s + d.sales, 0), used = days.reduce((s, d) => s + d.usedCall + d.usedOther, 0);
    const pick = days.reduce((s, d) => s + (d.pick || 0), 0), pickN = days.reduce((s, d) => s + (d.pickN || 0), 0);
    const other = days.reduce((s, d) => s + d.usedOther, 0), charge = days.reduce((s, d) => s + d.charge, 0);
    const bal = [...days].reverse().find(d => d.balance != null);
    const nav = `<div class="dv-mon"><button class="btn ghost" onclick="dvMonth(-1)" aria-label="이전 달">‹</button><b>${+DV.ym.slice(0, 4)}년 ${+DV.ym.slice(5)}월</b><button class="btn ghost" onclick="dvMonth(1)" aria-label="다음 달">›</button></div>`;
    const rows = days.slice().reverse().map(d => {
      const fv = d.fee + d.vat, net = d.sales + (d.pick || 0) - d.usedCall;
      const ck = !d.hasOrders && !d.hasLedger ? ['ck-no', '-'] : !d.hasOrders ? ['ck-no', '주문 파일 없음'] : !d.hasLedger ? ['ck-no', '적립금 파일 없음'] : fv === d.usedCall ? ['ck-ok', '✓'] : ['ck-bad', `${won(fv - d.usedCall)} 차이`];
      return `<tr><td>${md(d.d)}</td><td class="n">${d.n || '-'}</td><td class="n">${d.hasOrders ? won(d.sales) : '-'}</td>
        <td class="n">${d.hasPickup ? (d.pickN ? `${d.pickN}건 ${won(d.pick)}` : '0') : '-'}</td>
        <td class="n">${d.cardN ? `${d.cardN}건 ${won(d.card)}` : '-'}</td><td class="n">${d.cashN ? `${d.cashN}건 ${won(d.cash)}` : '-'}</td>
        <td class="n">${d.hasOrders ? won(fv) : '-'}</td><td class="n">${d.hasLedger ? won(d.usedCall) : '-'}</td>
        <td class="n">${d.hasLedger && d.charge ? won(d.charge) : '-'}</td><td class="n">${d.balance != null ? won(d.balance) : '-'}</td>
        <td class="n"><b>${d.hasOrders && d.hasLedger ? won(net) : (!d.hasOrders && !d.hasLedger && d.pick ? won(d.pick) : '-')}</b></td><td class="${ck[0]}">${ck[1]}</td></tr>`;
    }).join('');
    box.innerHTML = `<section class="card">
      <div class="meta"><div class="left"><strong>${STORE_NAME} 배달 매출</strong><span class="count">${D.uploadedAt ? D.uploadedAt + ' 올림' : '올린 기록 없음'}</span>
        <div class="result-sub">주문 ${D.lastOrder ? md(D.lastOrder) : '-'}까지 · 적립금 ${D.lastLedger ? md(D.lastLedger) : '-'}까지 반영</div></div>${nav}</div>
      <div class="dv-sum"><div><span>배달 (인프라D)</span><b>${won(sales)}</b></div><div><span>배민 포장${pickN ? ` · ${pickN}건` : ''}</span><b>${won(pick)}</b></div><div><span>마일리지 사용</span><b>−${won(used)}</b></div>
        <div class="hl"><span>순 배달매출</span><b>${won(sales + pick - used)}</b></div><div><span>마일리지 잔액</span><b>${bal ? won(bal.balance) : '-'}</b></div></div>
      ${days.length ? `<div class="tbl-wrap"><table class="dv-t"><thead><tr><th>날짜</th><th class="n">건수</th><th class="n">매출</th><th class="n">배민 포장</th><th class="n">만나서 카드</th><th class="n">만나서 현금</th><th class="n">배달요금(VAT)</th><th class="n">마일리지 차감</th><th class="n">충전</th><th class="n">잔액</th><th class="n">순 배달</th><th>검산</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">이 달에 올린 배달 자료가 없어요.</div>'}
      <div class="dv-note">순 배달매출 = 인프라D 결제금액 + 배민 포장 − 적립금 차감 전부. 월 관리비·입금 수수료 등 주문과 상관없는 차감 ${won(other)}원은 날짜별 칸이 아니라 위 합계에서만 빠져요.${charge ? ` 이 달 충전(입금) ${won(charge)}원은 매출·차감과 상관없어요.` : ''}<br>검산: 그날 배달요금+부가세가 적립금에서 빠진 금액과 같으면 ✓예요.</div>
    </section>`;
  }

  /* ---------- 배민 포장(픽업): 최근 7일 직접 입력 + 어사이드 키 ---------- */
  const addDays = (d, k) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };
  const PK = { days: [], at: '', key: null, info: null };
  async function loadPick(){
    const box = document.getElementById('dv-pick'); if (!box) return;
    const to = addDays(kst(), -1), from = addDays(to, -6);
    try {
      const [{ data, error }, ki] = await Promise.all([
        window.SB.rpc('delivery_data', { p_store: STORE, p_from: from, p_to: to }),
        window.SB.rpc('pickup_key_info')]);
      if (error) throw error;
      const by = {}; (data.days || []).forEach(d => { by[d.d] = d; });
      PK.days = []; for (let d = to; d >= from; d = addDays(d, -1)) PK.days.push({ d, x: by[d] || null });
      PK.at = data.pickupAt || ''; PK.info = ki && ki.data || null;
      drawPick();
    } catch (e) { box.innerHTML = `<div class="empty">불러오지 못했어요. ${h(e.message || '')}</div>`; }
  }
  function drawPick(){
    const box = document.getElementById('dv-pick'); if (!box) return;
    const rows = PK.days.map(({ d, x }) => {
      const has = x && x.hasPickup, id = d.slice(5).replace('-', '');
      return `<tr><td>${md(d)}</td>
        <td class="n"><input id="pk-c-${id}" data-d="${d}" data-k="c" inputmode="numeric" value="${has ? x.pickN : ''}" aria-label="${md(d)} 배민 포장 건수"></td>
        <td class="n"><input id="pk-a-${id}" data-d="${d}" data-k="a" inputmode="numeric" value="${has ? won(x.pick) : ''}" aria-label="${md(d)} 배민 포장 금액"></td>
        <td class="src">${has ? h(x.pickSrc || '') : '비어 있음'}</td></tr>`;
    }).join('');
    const ki = PK.info;
    box.innerHTML = `<section class="card"><div class="section-title"><strong>${ic('box')}배민 포장 (픽업) · ${STORE_NAME}</strong><small>${PK.at ? '마지막 입력 ' + h(PK.at) : '아직 입력 없음'}</small></div>
      <div class="dv-note" style="margin:0 0 10px">배민 앱에서 카드결제한 픽업 주문이에요. 포스·인프라D 어디에도 안 잡혀서 따로 넣어요. 어사이드가 매일 넣고, 여기서 직접 고칠 수도 있어요.</div>
      <div class="tbl-wrap"><table class="dv-pk"><thead><tr><th>날짜</th><th class="n">건수</th><th class="n">금액(원)</th><th>입력</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="dv-act"><span class="filter-hint" id="pk-hint" style="margin-right:auto"></span><button class="btn primary" id="pk-save" onclick="dvPickSave()">배민 포장 저장</button></div>
      <div class="dv-key"><b style="color:var(--ink)">어사이드 키</b><span>${ki ? `만든 날 ${h(ki.created || '-')} · 마지막 사용 ${h(ki.used || '아직 없음')}` : '아직 없음'}</span>
        <button class="btn ghost" onclick="dvKeyNew()">${ki ? '키 새로 만들기' : '키 만들기'}</button></div>
      <div id="pk-keybox"></div></section>`;
  }
  window.dvPickSave = async () => {
    const hint = document.getElementById('pk-hint'), rows = [];
    for (const { d } of PK.days) {
      const id = d.slice(5).replace('-', ''), c = document.getElementById('pk-c-' + id).value.trim(), a = document.getElementById('pk-a-' + id).value.trim();
      if (!c && !a) continue;
      const cn = DV_PARSE.num(c), am = DV_PARSE.num(a);
      if ((cn === 0) !== (am === 0)) { hint.textContent = `${md(d)}: 건수와 금액이 맞지 않아요 (둘 다 0이거나 둘 다 0보다 커야 해요)`; return; }
      rows.push({ date: d, cnt: cn, amount: am });
    }
    if (!rows.length) { hint.textContent = '적은 칸이 없어요.'; return; }
    const btn = document.getElementById('pk-save'); btn.disabled = true;
    try {
      const { error } = await window.SB.rpc('delivery_pickup_save', { p_store: STORE, p_rows: rows }); if (error) throw error;
      toast(`배민 포장 저장했어요 · ${rows.length}일`); window.DV_DASH_AT = 0; await Promise.all([loadPick(), loadMonth()]);
    } catch (e) { toast('저장하지 못했어요: ' + (e.message || e)); btn.disabled = false; }
  };
  window.dvKeyNew = async () => {
    if (PK.info && !confirm('키를 새로 만들면 지금 어사이드에 넣어 둔 키는 바로 못 쓰게 돼요. 새로 만들까요?')) return;
    try {
      const { data, error } = await window.SB.rpc('pickup_key_rotate'); if (error) throw error;
      const base = (window.MM_CONFIG && MM_CONFIG.url ? MM_CONFIG.url : '') + '/functions/v1/baemin-pickup';
      const url = `${base}?key=${data}&d=`;
      document.getElementById('pk-keybox').innerHTML = `<div class="dv-keybox"><b>새 키가 만들어졌어요. 이 화면을 벗어나면 다시 볼 수 없으니 지금 어사이드 프롬프트에 넣어 두세요.</b><br>
        주소: <code id="pk-url">${h(url)}</code> <button class="btn ghost" onclick="navigator.clipboard.writeText(document.getElementById('pk-url').textContent).then(()=>toast('복사했어요'))">복사</button><br>
        d= 뒤에 <code>날짜:건수:금액</code>을 쉼표로 이어 붙여요. 예: <code>11-13:1:11000,11-14:0:0</code></div>`;
      const ki = await window.SB.rpc('pickup_key_info'); PK.info = ki.data || PK.info;
      const keyRow = document.querySelector('#dv-pick .dv-key span'); if (keyRow && PK.info) keyRow.textContent = `만든 날 ${PK.info.created || '-'} · 마지막 사용 아직 없음`;
    } catch (e) { toast('키를 만들지 못했어요: ' + (e.message || e)); }
  };
  window.dvMonth = k => { DV.ym = ymAddL(DV.ym, k); loadMonth(); };
  window.dvClear = () => { DV.files = []; drawFiles(); };
  window.dvDrop = i => { DV.files.splice(i, 1); drawFiles(); };
  window.dvPick = () => document.getElementById('dv-input').click();

  function pageDv(){
    try { localStorage.removeItem(PW_KEY); } catch (e) {}   // 예전에 기억해 둔 암호가 있으면 지움 (암호가 매번 바뀜)
    document.getElementById('main').innerHTML = simpleHero(['매출 관리', '배달 매출'], 'DELIVERY · INFRA D', '배달 매출',
      '인프라D 엑셀(배달접수통계·적립금내역)을 끌어다 놓으면 날짜별 배달 매출과 마일리지 차감이 쌓여요.') +
      `<section class="card"><div class="section-title"><strong>${ic('download')}엑셀 올리기 · ${STORE_NAME}</strong><small>기간이 겹쳐도 콜번호로 걸러서 두 번 들어가지 않아요</small></div>
        <div class="dv-pw"><span>배달접수통계 암호</span><input type="password" id="dv-pw" autocomplete="off" placeholder="엑셀 출력할 때 나온 암호" aria-label="배달접수통계 엑셀 암호">
          <span class="dv-pwhelp">암호는 출력할 때마다 바뀌어요. 먼저 적고 파일을 놓아도 되고, 파일을 놓은 뒤 적어도 바로 다시 읽어요.</span></div>
        <div class="dv-drop" id="dv-drop" role="button" tabindex="0" onclick="dvPick()"><b>파일을 여기에 끌어다 놓거나 눌러서 고르세요</b><br>매출통계 &gt; 배달접수통계, 적립금내역에서 엑셀 출력한 파일 그대로 (.xls · .xlsx)</div>
        <input type="file" id="dv-input" accept=".xls,.xlsx" multiple style="display:none">
        <div class="dv-files" id="dv-files"></div>
        <div class="dv-act"><span class="filter-hint" id="dv-hint" style="margin-right:auto"></span><button class="btn ghost" onclick="dvClear()">비우기</button><button class="btn primary" id="dv-save" onclick="dvSave()" disabled>저장</button></div>
        <div class="dv-note">암호는 이 브라우저 안에서만 파일을 여는 데 쓰고 저장하거나 서버로 보내지 않아요. 고객 주소·전화·메모와 기사 정보도 서버로 보내지 않아요.</div>
      </section><div id="dv-pick"></div><div id="dv-month"></div>` + pageFoot();
    const drop = document.getElementById('dv-drop'), inp = document.getElementById('dv-input');
    inp.onchange = () => { addFiles(inp.files); inp.value = ''; drawFiles(); };
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('on'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('on'); }));
    drop.addEventListener('drop', e => { addFiles(e.dataTransfer.files); drawFiles(); });
    drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dvPick(); } });
    let pwT = 0; const pwi = document.getElementById('dv-pw');
    pwi.addEventListener('input', () => { clearTimeout(pwT); pwT = setTimeout(() => { if (DV.files.some(f => f.res && f.res.need)) dvRetry(); }, 400); });
    pwi.addEventListener('keydown', e => { if (e.key === 'Enter') dvRetry(); });
    drawFiles(); loadPick(); loadMonth(); loadXlsx().catch(() => {});
  }
  window.dvSave = save;
  window.dvRetry = () => { DV.files.forEach(f => { if (f.res && f.res.kind === 'error') f.res = null; }); drawFiles(); readAll(); };

  /* ---------- 메뉴: 매출 관리 아래 (관리자·본사) ---------- */
  const renderSideDv = renderSide;
  renderSide = function(active){
    renderSideDv(active);
    if (!can()) return;
    const nav = document.querySelector('#side .nav-items') || document.getElementById('side'); if (!nav) return;
    const btn = [...nav.querySelectorAll('.cat')].find(b => [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() === '매출 관리');
    const sub = btn && btn.nextElementSibling && btn.nextElementSibling.classList.contains('sub') ? btn.nextElementSibling : null;
    if (!sub) return;
    sub.querySelectorAll('.js-dv-item').forEach(e => e.remove());
    sub.insertAdjacentHTML('beforeend', `<a role="button" tabindex="0" class="js-dv-item ${active === PAGE ? 'on' : ''}" onclick="go('${PAGE}')">배달 매출</a>`);
    if (active === PAGE) { sub.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.classList.contains('js-dv-item'))); btn.classList.add('open'); sub.classList.add('open'); }
  };
  const goDv = go;
  go = function(p, t){
    if (p === PAGE) {
      if (!can()) { toast('관리자·본사 계정만 볼 수 있어요.'); return goDv('dash'); }
      closeSide(); renderSide(p); window.__curPage = p; pageDv(); window.scrollTo(0, 0); return;
    }
    return goDv(p, t);
  };
  try { renderSide(window.__curPage || 'dash'); } catch (e) {}
})();
