/* ---------- 영업 스크립트 (CRM에서 보고 바로 수정, 저장마다 버전) ---------- */
const SC = { list: [], slug: null, doc: null, editing: false, showVers: false, dirty: false };
function mdHtml(src){
  if (!window.marked || !window.DOMPurify) return `<pre style="white-space:pre-wrap">${esc(src)}</pre>`;
  // 5~10분처럼 물결 하나는 취소선이 되지 않게 (취소선은 ~~두 개~~)
  let h = marked.parse(String(src || '').replace(/(^|[^~\\])~(?!~)/g, '$1\\~'), { gfm: true, breaks: false });
  h = h.replace(/<em>\[([^\]<]{1,40})\]<\/em>/g, '<mark class="fill">[$1]</mark>');
  return DOMPurify.sanitize(h);
}
// ## 제목 단위로 접고 펼치기
function mdSections(src){
  const parts = []; let cur = null;
  (src || '').split('\n').forEach(line => {
    const m = /^##\s+(.+)$/.exec(line);
    if (m) { cur = { t: m[1].trim(), lines: [] }; parts.push(cur); }
    else { if (!cur) { cur = { t: null, lines: [] }; parts.push(cur); } cur.lines.push(line); }
  });
  return parts.map(p => p.t === null
    ? (p.lines.join('\n').trim() ? `<div class="md" style="padding-top:12px">${mdHtml(p.lines.join('\n'))}</div>` : '')
    : `<details open><summary>${mdHtml(p.t).replace(/^<p>|<\/p>\s*$/g, '')}</summary><div class="sc-body md">${mdHtml(p.lines.join('\n'))}</div></details>`).join('');
}
const fmtDT = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
async function loadScript(slug, version){
  if (SC.editing && SC.dirty && !confirm('저장하지 않은 수정 내용이 있어요. 나갈까요?')) return;
  SC.editing = false; SC.dirty = false;
  try {
    SC.list = await rpc('sp_script_list', {}) || [];
    SC.slug = slug || SC.slug || (SC.list[0] && SC.list[0].slug) || null;
    if (SC.slug && !SC.list.some(x => x.slug === SC.slug)) SC.slug = SC.list[0] ? SC.list[0].slug : null;
    SC.doc = SC.slug ? await rpc('sp_script_get', { p_slug: SC.slug, p_version: version || null }) : null;
    renderScript();
  } catch (e) { toast(errMsg(e), true); }
}
function renderScript(){
  const d = SC.doc, old = d && d.version !== d.latest;
  $('sc-tabs').innerHTML = SC.list.map(x => `<button data-s="${esc(x.slug)}" class="${x.slug === SC.slug ? 'on' : ''}">${esc(x.title)}</button>`).join('');
  $('sc-acts').innerHTML = SC.editing
    ? `<button class="btn sm" id="sc-cancel">취소</button><button class="btn sm pri" id="sc-save">저장</button>`
    : (d ? (old
        ? `<button class="btn sm" id="sc-latest">최신으로</button><button class="btn sm pri" id="sc-restore">이 버전으로 되돌리기</button>`
        : `<button class="btn sm" id="sc-fold">모두 접기</button><button class="btn sm" id="sc-hist">이전 버전 (${d.versions.length})</button><button class="btn sm pri" id="sc-edit">수정</button>`)
      : '') + (SC.editing ? '' : `<button class="btn sm" id="sc-new">+ 새 스크립트</button>`);
  $('sc-meta').innerHTML = d && !SC.editing
    ? (old ? `<b>v${d.version} (이전 버전 보는 중)</b> · ` : `v${d.version} · `) + `${esc(d.saved_by || '')} ${esc(fmtDT(d.saved_at))} 저장${d.note ? ' · ' + esc(d.note) : ''}`
    : '';
  $('sc-vers').hidden = !(SC.showVers && d && !SC.editing);
  if (!$('sc-vers').hidden) $('sc-vers').innerHTML = d.versions.map(v =>
    `<button data-v="${v.version}" class="${v.version === d.version ? 'on' : ''}"><span class="v">v${v.version}</span><span>${esc(fmtDT(v.saved_at))} · ${esc(v.saved_by || '')}</span><span class="muted">${esc(v.note || '')}</span></button>`).join('');
  $('sc-view').hidden = SC.editing; $('sc-editor').hidden = !SC.editing;
  if (!SC.editing) $('sc-view').innerHTML = d ? `<div class="sc-doc">${mdSections(d.body)}</div>`
    : `<div class="box"><h4>아직 스크립트가 없어요</h4><p class="muted" style="margin:0">오른쪽 위 <b>+ 새 스크립트</b>로 만들어 주세요.</p></div>`;
}
function openEditor(isNew){
  SC.editing = true; SC.dirty = false; SC.showVers = false; SC.isNew = !!isNew;
  const d = SC.doc;
  $('sc-title').value = isNew ? '' : d.title;
  $('sc-body').value = isNew ? '## 1단계. \n\n> "멘트"\n\n- 메모\n' : d.body;
  $('sc-note').value = isNew ? '처음 작성' : '';
  renderScript(); scPreview(); (isNew ? $('sc-title') : $('sc-body')).focus();
}
let scT; function scPreview(){ clearTimeout(scT); scT = setTimeout(() => { $('sc-prev').innerHTML = mdSections($('sc-body').value); $('sc-prev').querySelectorAll('details').forEach(x => x.open = true); }, 150); }
['sc-body', 'sc-title', 'sc-note'].forEach(id => $(id).addEventListener('input', () => { SC.dirty = true; if (id === 'sc-body') scPreview(); }));
/* 형광펜: 선택한 글자를 <mark>로 감싸기 / 풀기 */
function scHighlight(off){
  const ta = $('sc-body'); let a = ta.selectionStart, b = ta.selectionEnd; const v = ta.value;
  if (a === b) { toast('칠할 글자를 먼저 드래그하세요', true); ta.focus(); return; }
  // 선택이 <mark> 안쪽만 잡혔으면 태그까지 넓히기
  if (v.slice(a - 6, a) === '<mark>' && v.slice(b, b + 7) === '</mark>') { a -= 6; b += 7; }
  const sel = v.slice(a, b);
  const unmark = t => t.replace(/<mark>([\s\S]*?)<\/mark>/g, '$1');
  const wrap = t => { const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(t); return m[2] ? m[1] + '<mark>' + unmark(m[2]) + '</mark>' + m[3] : t; };
  const pre = /^(\s*(?:#{1,6}\s+|>\s*|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)*)([\s\S]*)$/;
  let out;
  if (off || /^\s*<mark>[\s\S]*<\/mark>\s*$/.test(sel) && !/<\/mark>[\s\S]*<mark>/.test(sel)) {
    out = unmark(sel);
  } else {
    out = sel.split('\n').map(line => {
      if (!line.trim()) return line;
      if (line.includes('|')) { // 표 줄: 칸마다 감싸기 (구분선 줄은 그대로)
        if (/^[\s:|-]+$/.test(line)) return line;
        return line.split('|').map(wrap).join('|');
      }
      const m = pre.exec(line); return m[1] + wrap(m[2]);
    }).join('\n');
  }
  ta.focus(); ta.setSelectionRange(a, b);
  if (!document.execCommand || !document.execCommand('insertText', false, out)) ta.setRangeText(out, a, b, 'end');
  ta.setSelectionRange(a, a + out.length);
  SC.dirty = true; scPreview();
}
$('sc-hl').addEventListener('click', () => scHighlight(false));
$('sc-hl-off').addEventListener('click', () => scHighlight(true));
$('sc-body').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'y') { e.preventDefault(); scHighlight(false); } });
async function saveScript(){
  const title = $('sc-title').value.trim(); if (!title) { toast('제목을 입력하세요', true); $('sc-title').focus(); return; }
  const b = $('sc-save'); if (b) b.disabled = true;
  try {
    const r = await rpc('sp_script_save', { p: { slug: SC.isNew ? null : SC.slug, title, body: $('sc-body').value, note: $('sc-note').value, base_version: SC.isNew ? null : SC.doc.latest } });
    SC.dirty = false; SC.editing = false; toast(`저장했어요 (v${r.version})`); loadScript(r.slug);
  } catch (e) { toast(errMsg(e), true); if (b) b.disabled = false; }
}
async function restoreScript(){
  const d = SC.doc; if (!confirm(`v${d.version} 내용으로 되돌릴까요? 새 버전(v${d.latest + 1})으로 저장돼요.`)) return;
  try {
    const r = await rpc('sp_script_save', { p: { slug: d.slug, title: d.title, body: d.body, note: `v${d.version}으로 되돌림`, base_version: d.latest } });
    SC.showVers = false; toast(`되돌렸어요 (v${r.version})`); loadScript(d.slug);
  } catch (e) { toast(errMsg(e), true); }
}
$('sc-tabs').addEventListener('click', e => { const b = e.target.closest('button[data-s]'); if (b && b.dataset.s !== SC.slug) { SC.showVers = false; loadScript(b.dataset.s); } });
$('sc-vers').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) loadScript(SC.slug, +b.dataset.v); });
$('sc-acts').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'sc-edit') openEditor(false);
  else if (b.id === 'sc-new') openEditor(true);
  else if (b.id === 'sc-save') saveScript();
  else if (b.id === 'sc-cancel') { if (SC.dirty && !confirm('수정한 내용을 버릴까요?')) return; SC.dirty = false; SC.editing = false; if (!SC.doc) $('sc-editor').hidden = true; renderScript(); }
  else if (b.id === 'sc-hist') { SC.showVers = !SC.showVers; renderScript(); }
  else if (b.id === 'sc-latest') { SC.showVers = false; loadScript(SC.slug); }
  else if (b.id === 'sc-restore') restoreScript();
  else if (b.id === 'sc-fold') { const ds = $('sc-view').querySelectorAll('details'), anyOpen = [...ds].some(x => x.open); ds.forEach(x => x.open = !anyOpen); b.textContent = anyOpen ? '모두 펼치기' : '모두 접기'; }
});
document.addEventListener('keydown', e => { if (SC.editing && state.view === 'script' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveScript(); } });
window.addEventListener('beforeunload', e => { if (SC.editing && SC.dirty) { e.preventDefault(); e.returnValue = ''; } });


