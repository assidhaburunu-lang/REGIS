'use strict';
/* Daily Briefing: complaints received since the last Commission update (or any period), with a Word and PDF report
   in the Registration Department's briefing format (Dhivehi, right-to-left; English also available). */

const DV_MONTHS = ['ޖަނަވަރީ', 'ފެބުރުއަރީ', 'މާރިޗު', 'އޭޕްރީލް', 'މޭ', 'ޖޫން', 'ޖުލައި', 'އޯގަސްޓު', 'ސެޕްޓެމްބަރު', 'އޮކްޓޫބަރު', 'ނޮވެމްބަރު', 'ޑިސެމްބަރު'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DV_ONES = ['ސުމެއް', 'އެކެއް', 'ދޭއް', 'ތިނެއް', 'ހަތަރެއް', 'ފަހެއް', 'ހައެއް', 'ހަތެއް', 'އަށެއް', 'ނުވައެއް', 'ދިހައެއް', 'އެގާރަ', 'ބާރަ', 'ތޭރަ', 'ސާދަ', 'ފަނަރަ', 'ސޯޅަ', 'ސަތާރަ', 'އަށާރަ', 'ނަވާރަ', 'ވިހި', 'އެކާވީސް', 'ބާވީސް', 'ތޭވީސް', 'ސައުވީސް', 'ފަންސަވީސް', 'ސައްބީސް', 'ހަތާވީސް', 'އަށާވީސް', 'ނަވާވީސް'];
const DV_TENS = { 3: 'ތިރީސް', 4: 'ސާޅީސް', 5: 'ފަންސާސް', 6: 'ފަސްދޮޅަސް', 7: 'ހަތްދިހަ', 8: 'އަށްޑިހަ', 9: 'ނުވަދިހަ' };
function dvNum(n) {
  n = Math.floor(n); if (n < 30) return DV_ONES[n];
  if (n < 100) { const t = Math.floor(n / 10), o = n % 10; return DV_TENS[t] + (o ? ' ' + DV_ONES[o] : ''); }
  if (n < 1000) { const h = Math.floor(n / 100), r = n % 100; return (h === 1 ? 'ސަތޭކަ' : DV_ONES[h] + ' ސަތޭކަ') + (r ? ' ' + dvNum(r) : ''); }
  return String(n);
}
const EN_NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
function enNum(n) { if (n < 20) return EN_NUM[n]; if (n < 100) { const T = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']; return T[Math.floor(n / 10)] + (n % 10 ? '-' + EN_NUM[n % 10] : ''); } return String(n); }

const BRIEF_L = {
  dv: { title: (a, b) => `ޑެއިލީ ބްރީފިންގ  ${a} ން ${b} އަށް`, band: 'ރަޖިސްޓްރޭޝަން ޑިޕާޓްމަންޓަށް ލިބިފައިވާ ޝަކުވާތަކުގެ މަޢުލޫމާތު', date: 'ތާރީޚު:', count: 'ޑިޕާޓްމަންޓަށް ލިބުނު ޝަކުވާގެ ޢަދަދު:',
    cols: ['#', 'ރަޖިސްޓްރޭޝަން ނަންބަރު', 'ޝަކުވާ ހުށަހެޅި ފަރާތް', 'ހައްޤު ގެއްލިފައިވާކަމަށް ބުނާ ފަރާތް', 'ޝަކުވާގެ ޚުލާޞާ', 'ޝަކުވާގެ ސްޓޭޓަސް'],
    same: 'ޝަކުވާ ހުށަހެޅި ފަރާތް', none: '—', conf: 'ސިއްރު', cms: 'ސީ.އެމް.އެސް', officer: 'އޮފިސަރ', empty: 'މި މުއްދަތުގައި ލިބިފައިވާ ޝަކުވާއެއް ނެތް.', month: m => DV_MONTHS[m], num: dvNum, dir: 'rtl' },
  en: { title: (a, b) => `Daily Briefing: ${a} to ${b}`, band: 'Complaints received by the Registration Department', date: 'Date:', count: 'Number of complaints received by the department:',
    cols: ['#', 'Registration number', 'Complainant', 'Person whose rights were allegedly violated', 'Summary of the complaint', 'Status of the complaint'],
    same: 'The complainant', none: '—', conf: 'Confidential', cms: 'CMS', officer: 'Officer', empty: 'No complaints were received in this period.', month: m => EN_MONTHS[m], num: enNum, dir: 'ltr' },
};
const briefDate = (iso, L) => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${d} ${L.month(+m - 1)} ${y}`; };
const dotDate = iso => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}.${m}.${y}`; };

function lastCommissionUpdate() {
  let last = null; vals(S.complaints).forEach(c => vals(c.decisions).forEach(d => { const x = d.commission && (d.commission.meetingDate || String(d.commission.at || '').slice(0, 10)); if (x && x <= today() && (!last || x > last)) last = x; }));
  return last;
}
function briefRange() {
  const f = S.brief || (S.brief = {}); const last = lastCommissionUpdate();
  if (!f.from) { f.from = last ? addDays(last, 1) : addDays(today(), -7); f.to = today(); f.auto = true; }
  if (!f.lang) f.lang = 'dv';
  return { from: f.from, to: f.to, last, lang: f.lang };
}
function briefCases(from, to) {
  return visibleCases().filter(c => c.dateReceived && c.dateReceived >= from && c.dateReceived <= to).sort((a, b) => String(a.dateReceived).localeCompare(String(b.dateReceived)) || String(a.regNo).localeCompare(String(b.regNo)));
}
function stageLabelIn(k, lang) { const s = STAGE[k]; return s ? (lang === 'dv' ? s.dv : s.en) : (k || '—'); }
// One report row, as plain text pieces used by the screen, Word and PDF.
function briefRow(c, L, lang) {
  const show = !c.confidential || canSeeRestricted(c); const cp = cpOf(c);
  const place = p => [p.atoll, p.island].filter(Boolean).join('. ');
  const complainant = show ? [cp.name || L.none, place(cp)].filter(Boolean) : [L.conf];
  const vs = victimsOf(c);
  const victim = !show ? [L.conf] : vs.length ? vs.map(v => v.name + (place(v) ? ', ' + place(v) : '')) : [c.victimSame ? L.same : L.none];
  const status = [stageLabelIn(c.stage, lang)];
  if (c.cmsRef) status.push(`${L.cms}: ${c.cmsRef}`);
  if (c.assignedTo) status.push(`${L.officer}: ${nm(c.assignedTo)}`);
  return { reg: c.regNo, complainant, victim, heading: c.respondent?.name || c.category || '', summary: show || !c.confidential ? (c.summary || '') : L.conf, status };
}

VIEWS.briefing = () => {
  if (!can('stats')) return noAccess();
  const r = briefRange(); const L = BRIEF_L[r.lang]; const cs = briefCases(r.from, r.to);
  const rows = cs.map(c => ({ c, x: briefRow(c, L, r.lang) }));
  const byStage = {}; cs.forEach(c => { byStage[c.stage] = (byStage[c.stage] || 0) + 1; });
  return `<div class="page-head"><div><h1>${esc(t('briefing'))}</h1><p>Complaints received from the last Commission update to today, or any period you choose, with a Word or PDF briefing report in the Registration Department's format.</p></div>
    <div class="row"><button class="btn primary" data-act="briefDocx" ${cs.length ? '' : 'disabled'}>Word report</button><button class="btn primary" data-act="briefPdf" ${cs.length ? '' : 'disabled'}>PDF report</button></div></div>
  <div class="card">
    <div class="filters">
      <div class="f"><label for="b_from">From</label><input id="b_from" type="date" value="${r.from}" max="${today()}" data-on="change:briefFrom"></div>
      <div class="f"><label for="b_to">To</label><input id="b_to" type="date" value="${r.to}" max="${today()}" data-on="change:briefTo"></div>
      <div class="f"><label for="b_lang">Report language</label><select id="b_lang" data-on="change:briefLang"><option value="dv" ${r.lang === 'dv' ? 'selected' : ''}>ދިވެހި (Dhivehi)</option><option value="en" ${r.lang === 'en' ? 'selected' : ''}>English</option></select></div>
      <div class="f"><label>&nbsp;</label><div class="row" style="gap:6px">
        <button class="btn sm" data-act="briefPreset" data-p="commission" ${r.last ? '' : 'disabled title="No Commission decision has been recorded yet"'}>Since last Commission update</button>
        <button class="btn sm" data-act="briefPreset" data-p="today">Today</button><button class="btn sm" data-act="briefPreset" data-p="week">Last 7 days</button><button class="btn sm" data-act="briefPreset" data-p="month">This month</button></div></div>
    </div>
    <p class="small muted" style="margin:6px 0 0">${r.last ? `Last Commission update: <b>${fmtD(r.last)}</b> (the latest Commission meeting date recorded on a panel decision). “Since last Commission update” starts the day after.` : 'No Commission decision has been recorded yet, so the default period is the last 7 days.'}</p>
  </div>
  <div class="tiles section">
    <div class="tile info" style="cursor:default"><div class="k">Complaints received</div><div class="v num">${cs.length}</div><div class="s">${fmtD(r.from)} – ${fmtD(r.to)}</div></div>
    ${Object.entries(byStage).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `<div class="tile" style="cursor:default"><div class="k">${esc(stageLabel(k))}</div><div class="v num">${n}</div><div class="s">${pctOf(n, cs.length)}% of the period</div></div>`).join('')}
  </div>
  <div class="card section"><div class="card-head"><h2>Report preview</h2><span class="muted small">This is how the report reads. Word and PDF use the same layout.</span></div>
    <div class="brief-wrap">${briefHTML(r, rows.map(x => x.x))}</div></div>`;
};
function briefHTML(r, rows) {
  const L = BRIEF_L[r.lang]; const n = rows.length;
  const cell = arr => arr.map(x => `<div dir="auto">${esc(x)}</div>`).join('');
  return `<div class="brief" dir="${L.dir}" lang="${r.lang}">
    <div class="brief-title">${esc(L.title(briefDate(r.from, L), briefDate(r.to, L)))}</div>
    <table class="brief-tbl"><colgroup><col style="width:4%"><col style="width:14%"><col style="width:14%"><col style="width:14%"><col style="width:36%"><col style="width:18%"></colgroup>
      <thead>
        <tr><th colspan="6" class="bt-band">${esc(L.band)}</th></tr>
        <tr><th colspan="3" class="bt-lab">${esc(L.date)}</th><td colspan="3" class="bt-val">${dotDate(today())}</td></tr>
        <tr><th colspan="3" class="bt-lab">${esc(L.count)}</th><td colspan="3" class="bt-val bt-white">${String(n).padStart(2, '0')} (${esc(L.num(n))})</td></tr>
        <tr class="bt-cols">${L.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>
      </thead>
      <tbody>${n ? rows.map((x, i) => `<tr><td class="bt-c">${i + 1}</td><td class="bt-c bt-reg">${esc(x.reg)}</td><td>${cell(x.complainant)}</td><td>${cell(x.victim)}</td><td>${x.heading ? `<div class="bt-h" dir="auto">${esc(x.heading)}</div>` : ''}<div dir="auto">${esc(x.summary)}</div></td><td>${cell(x.status)}</td></tr>`).join('')
        : `<tr><td colspan="6" class="bt-c">${esc(L.empty)}</td></tr>`}</tbody>
    </table></div>`;
}
ON.briefFrom = el => { S.brief.from = el.value || S.brief.from; if (S.brief.to < S.brief.from) S.brief.to = S.brief.from; render(); };
ON.briefTo = el => { S.brief.to = el.value || S.brief.to; if (S.brief.to < S.brief.from) S.brief.from = S.brief.to; render(); };
ON.briefLang = el => { S.brief.lang = el.value; render(); };
ACT.briefPreset = el => {
  const p = el.dataset.p; const td = today(); const f = S.brief;
  if (p === 'commission') { const last = lastCommissionUpdate(); f.from = last ? addDays(last, 1) : addDays(td, -7); if (f.from > td) f.from = td; }
  else if (p === 'today') f.from = td; else if (p === 'week') f.from = addDays(td, -6); else if (p === 'month') f.from = td.slice(0, 8) + '01';
  f.to = td; render();
};
function briefData() { const r = briefRange(); const L = BRIEF_L[r.lang]; return { r, L, rows: briefCases(r.from, r.to).map(c => briefRow(c, L, r.lang)) }; }
const briefFile = (r, ext) => `FREMYS-daily-briefing-${r.from}${r.to !== r.from ? '_to_' + r.to : ''}.${ext}`;

/* ---------- Word (.docx), written directly as Office Open XML ---------- */
ACT.briefDocx = async () => {
  const { r, L, rows } = briefData(); const rtl = r.lang === 'dv';
  const x = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const isThaana = s => /[ހ-޿]/.test(s);
  const run = (text, o = {}) => String(text ?? '').split('\n').map((line, i) => `<w:r><w:rPr><w:rFonts w:ascii="${o.latin || 'Times New Roman'}" w:hAnsi="${o.latin || 'Times New Roman'}" w:cs="Faruma"/>${o.b ? '<w:b/><w:bCs/>' : ''}${o.u ? '<w:u w:val="single"/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}${isThaana(line) ? '<w:rtl/>' : ''}<w:sz w:val="${o.sz || 22}"/><w:szCs w:val="${o.sz || 22}"/></w:rPr>${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${x(line)}</w:t></w:r>`).join('');
  // Paragraph direction follows its own text (Dhivehi right-to-left, English left-to-right), like dir="auto" on screen.
  const para = (inner, o = {}) => { const th = o.text != null ? isThaana(o.text) : rtl; return `<w:p><w:pPr>${th ? '<w:bidi/>' : '<w:bidi w:val="0"/>'}<w:spacing w:before="${o.before || 0}" w:after="${o.after ?? 40}"/><w:jc w:val="${o.jc || (th ? 'right' : 'left')}"/></w:pPr>${inner}</w:p>`; };
  const tp = (text, ro = {}, po = {}) => String(text ?? '').split('\n').map(line => para(run(line, ro), { ...po, text: line })).join('');
  const W = [430, 1540, 1540, 1540, 3960, 1990]; // twips, ~11 000 total
  const tc = (content, o = {}) => `<w:tc><w:tcPr><w:tcW w:w="${o.w}" w:type="dxa"/>${o.span > 1 ? `<w:gridSpan w:val="${o.span}"/>` : ''}${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''}<w:vAlign w:val="${o.v || 'top'}"/></w:tcPr>${content}</w:tc>`;
  const sumW = (a, b) => W.slice(a, b).reduce((s, v) => s + v, 0);
  const hdrRow = cells => `<w:tr><w:trPr><w:tblHeader/></w:trPr>${cells}</w:tr>`;
  const body = [
    para(run(L.title(briefDate(r.from, L), briefDate(r.to, L)), { sz: 30, color: '2E74B5', latin: 'Times New Roman' }), { after: 120, jc: 'center' }),
    `<w:tbl><w:tblPr>${rtl ? '<w:bidiVisual/>' : ''}<w:tblW w:w="${sumW(0, 6)}" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="8EAADB"/>`).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr>`,
    `<w:tblGrid>${W.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`,
    hdrRow(tc(para(run(L.band, { b: true, sz: 26, color: 'FFFFFF' }), { jc: 'center' }), { w: sumW(0, 6), span: 6, fill: '4472C4', v: 'center' })),
    hdrRow(tc(para(run(L.date, { b: true, color: 'FFFFFF' })), { w: sumW(0, 3), span: 3, fill: '1F3864', v: 'center' }) + tc(para(run(dotDate(today()), { sz: 24 })), { w: sumW(3, 6), span: 3, fill: 'D9E2F3', v: 'center' })),
    hdrRow(tc(para(run(L.count, { b: true, color: 'FFFFFF' })), { w: sumW(0, 3), span: 3, fill: '1F3864', v: 'center' }) + tc(para(run(`${String(rows.length).padStart(2, '0')} (${L.num(rows.length)})`, { sz: 24 })), { w: sumW(3, 6), span: 3, v: 'center' })),
    hdrRow(L.cols.map((c, i) => tc(para(run(c, { b: true, sz: 20 }), { jc: 'center' }), { w: W[i], fill: 'D9E2F3', v: 'center' })).join('')),
    ...(rows.length ? rows.map((row, i) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${[
      tc(para(run(String(i + 1)), { jc: 'center' }), { w: W[0] }),
      tc(para(run(row.reg, { color: '0563C1', sz: 20 }), { jc: 'center' }), { w: W[1] }),
      tc(tp(row.complainant.join('\n')), { w: W[2] }),
      tc(tp(row.victim.join('\n')), { w: W[3] }),
      tc((row.heading ? tp(row.heading, { b: true, u: true }) : '') + tp(row.summary), { w: W[4] }),
      tc(tp(row.status.join('\n'), { sz: 20 }), { w: W[5] }),
    ].join('')}</w:tr>`) : [`<w:tr>${tc(para(run(L.empty), { jc: 'center' }), { w: sumW(0, 6), span: 6 })}</w:tr>`]),
    `</w:tbl>`,
    para(run(`FREMYS · ${fmtD(today())} · ${S.me.name || ''}`, { sz: 16, color: '808080' }), { before: 160 }),
  ].join('');
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="450" w:bottom="720" w:left="450" w:header="360" w:footer="360" w:gutter="0"/>${rtl ? '<w:bidi/>' : ''}</w:sectPr></w:body></w:document>`;
  const enc = new TextEncoder();
  const files = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'],
    ['word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'],
    ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x('Daily Briefing ' + r.from + ' to ' + r.to)}</dc:title><dc:creator>FREMYS</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`],
    ['word/document.xml', doc],
  ].map(([name, s]) => ({ name, data: enc.encode(s) }));
  await saveFile(briefFile(r, 'docx'), new Blob([makeZip(files)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
};

/* ---------- PDF: the report is laid out in the page (so Dhivehi is shaped by the browser), then captured page by page ---------- */
function loadScriptOnce(src) {
  return new Promise((res, rej) => { if ([...document.scripts].some(s => s.src.endsWith(src.split('/').pop()) && s.dataset.ok)) return res(); const s = document.createElement('script'); s.src = src; s.onload = () => { s.dataset.ok = '1'; res(); }; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
}
async function needHtml2canvas() {
  if (window.html2canvas) return;
  const local = [...document.scripts].some(s => /js\/vendor\//.test(s.getAttribute('src') || ''));
  await loadScriptOnce(local ? 'js/vendor/html2canvas.min.js' : 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
}
ACT.briefPdf = async el => {
  const btn = el; const old = btn.textContent; btn.disabled = true; btn.textContent = 'Building PDF…';
  const host = document.createElement('div'); host.className = 'brief-print';
  try {
    if (!window.jspdf) throw new Error('The PDF library did not load.');
    await needHtml2canvas(); if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const { r, L, rows } = briefData();
    document.body.appendChild(host);
    // A4 portrait at 96 dpi: 794 × 1123 px, 28 px margins.
    const PAGE_H = 1123 - 56; const pages = [];
    const newPage = first => { const p = document.createElement('div'); p.className = 'brief-page'; p.innerHTML = briefHTML(r, rows).replace(/<tbody>[\s\S]*<\/tbody>/, '<tbody></tbody>'); if (!first) { p.querySelector('.brief-title').remove(); [...p.querySelectorAll('thead tr')].slice(0, 3).forEach(tr => tr.remove()); } host.appendChild(p); pages.push(p); return p.querySelector('tbody'); };
    const tmp = document.createElement('div'); tmp.innerHTML = briefHTML(r, rows); const rowEls = [...tmp.querySelectorAll('tbody tr')];
    let tb = newPage(true);
    rowEls.forEach(tr => { tb.appendChild(tr); if (tb.closest('.brief-page').offsetHeight > PAGE_H && tb.children.length > 1) { tr.remove(); tb = newPage(false); tb.appendChild(tr); } });
    const { jsPDF } = window.jspdf; const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 21;
    for (let i = 0; i < pages.length; i++) {
      btn.textContent = `Building PDF… ${i + 1}/${pages.length}`;
      const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', logging: false });
      if (i) pdf.addPage();
      const w = pw - 2 * m; const h = Math.min(ph - 2 * m - 14, canvas.height * w / canvas.width);
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', m, m, w, h);
      pdf.setFontSize(8); pdf.setTextColor(120); pdf.text(`FREMYS Daily Briefing ${r.from} to ${r.to} · page ${i + 1} of ${pages.length}`, pw / 2, ph - 12, { align: 'center' });
    }
    pdf.setProperties({ title: `Daily Briefing ${r.from} to ${r.to}`, creator: 'FREMYS' });
    await saveFile(briefFile(r, 'pdf'), pdf.output('blob'));
  } catch (e) { toast('Could not build the PDF: ' + errText(e), 'error'); }
  finally { host.remove(); btn.disabled = false; btn.textContent = old; }
};
