'use strict';
/* Registration Panel case pack in the Registration Department format (RDP/YYYY/NN): one block per agenda item with the
   case details, complaint summary, registration officer's comments and the panel decision. Word (.docx) and PDF.
   Colour of each complaint bar: green = lodged, blue = not lodged, orange = returned/deferred, grey = not decided yet. */

const PACK_COLORS = { lodge: '00B050', not_lodge: '0070C0', return_officer: 'C55A11', deferred: 'C55A11', none: '7F7F7F' };
// Dhivehi names of the catalogue's rights categories (the catalogue itself has no Dhivehi labels yet), and of the "not lodged" reasons.
const DV_RIGHTS = { VC01: 'ދިރިހުރުމުގެ ޙައްޤު', VC02: 'މިނިވަންކަމާއި ސަލާމަތީ ޙައްޤު', VC03: 'ޢަދުލުވެރި ޝަރީޢަތާއި ޢަދުލުއިންޞާފު ހޯދުމުގެ ޙައްޤު', VC04: 'ފާޅުކުރުމާއި މަޢުލޫމާތު ހޯދުމުގެ މިނިވަންކަން',
  VC05: 'ޖަމާޢަތްތަކުގައި ބައިވެރިވުމާއި އެއްތަނަކަށް ޖަމާވުމުގެ މިނިވަންކަން', VC06: 'ވަކިވަކި ފަރުދުންގެ ސިއްރާއި އާއިލީ ދިރިއުޅުމުގެ ޙައްޤު', VC07: 'ހަދަރުދޫކޮށް ކުރާ ޢަމަލުތަކާއި އަނިޔާއިން ސަލާމަތްވުމުގެ ޙައްޤު', VC08: 'ހަމަހަމަކަމާއި ތަފާތުކުރުމުން ސަލާމަތްވުމުގެ ޙައްޤު',
  VC09: 'ތަޢުލީމުގެ ޙައްޤު', VC10: 'ޞިއްޙަތުގެ ޙައްޤު', VC11: 'ފުދޭ ގެދޮރުގެ ޙައްޤު', VC12: 'މަސައްކަތާއި ވަޒީފާގެ ޙައްޤުތައް', VC13: 'ކާނާއާއި ފެނާއި ފުދޭ މިންވަރެއްގެ ދިރިއުޅުމުގެ ޙައްޤު',
  VC14: 'އިޖުތިމާޢީ ރައްކާތެރިކަމުގެ ޙައްޤު', VC15: 'ސަޤާފީ ޙައްޤުތައް', VC16: 'ސާފު ތިމާވެށީގެ ޙައްޤު' };
const DV_NL_REASONS = { "Outside the Commission's mandate": 'ކޮމިޝަނުގެ އިޚްތިޞާޞާ ބޭރު', 'Insufficient information after clarification': 'ވުޒާހަތު ހޯދުމަށްފަހުވެސް މަޢުލޫމާތު ފުދިގެން ނުދޭ', 'Complaint withdrawn by the complainant': 'ޝަކުވާ ހުށަހެޅި ފަރާތުން ޝަކުވާ ނަގާލައިފި', 'Matter already before a court': 'މައްސަލަ މިހާރުވެސް ކޯޓެއްގައި ހުރި', 'Resolved between the parties': 'ފަރާތްތަކުގެ މެދުގައި ހައްލުވެއްޖެ', 'Duplicate of another complaint': 'އެހެން ޝަކުވާއެއްގެ ތަކުރާރެއް', 'Other': 'އެހެނިހެން' };
const PACK_TINTS = { '00B050': 'E2F0D9', '0070C0': 'DDEBF7', 'C55A11': 'FBE5D6', '7F7F7F': 'EDEDED' };
const PACK_L = {
  dv: {
    head: (n, N) => `އާރް.ޑީ.ޕީ ${n} ވަނަ ޖަލްސާގެ އެޖެންޑާގައި ${String(N).padStart(2, '0')} ކޭސް`,
    sub: (N, k) => `(އެޖެންޑާ ކުރި ${String(N).padStart(2, '0')} ކޭސްއިން ${k.lodge} ކޭސް ލޮޖް ކުރެވި، ${k.not_lodge} ކޭސް ލޮޖް ނުކުރެވި${k.ret ? `، ${k.ret} ކޭސް އަނބުރާ ފޮނުވިފައި` : ''}${k.none ? `، ${k.none} ކޭސް ނުނިންމާ` : ''})`,
    band: 'ރަޖިސްޓްރޭޝަން ޑިޕާޓްމަންޓް ޕެނަލުން ނިންމާފައިވާ ގޮތް', item: i => `ޝަކުވާ ${i}`,
    rows: ['އިންޓްރީ ނަންބަރު', 'ރަޖިސްޓްރޭޝަން ނަންބަރު', 'ހުށަހެޅުނު ތާރީޚު', 'ޝަކުވާ ހުށަހެޅި ފަރާތް', 'ހައްޤު ގެއްލިފައިވާ ފަރާތް', 'ޝަކުވާ ކުރެވޭ ފަރާތް', 'ގެއްލިފައިވާ ހައްޤު'],
    summary: 'ޝަކުވާގެ ޚުލާޞާ', officer: 'ރަޖިސްޓްރޭޝަން އޮފިސަރުގެ ކޮމެންޓް:', decision: 'ޕެނަލުގެ ނިންމުން:', requested: 'ޕެނަލުން ބޭނުންވާ ނިންމުން:', issues: 'ހައްލުނުވާ ކަންކަން:',
    out: { lodge: 'ލޮޖް ކުރުން (ތަޙުޤީޤަށް ފޮނުވުން)', not_lodge: 'ލޮޖް ނުކުރުން', return_officer: 'ވުޒާހަތަށް އޮފިސަރަށް އަނބުރާ ފޮނުވުން', deferred: 'ފަސްކުރުން', none: 'ނިންމުމެއް ނުނިންމާ' },
    reason: 'ސަބަބު:', clarify: 'ވުޒާހަތު ބޭނުންވާ ކަންތައް:', same: 'ޝަކުވާ ހުށަހެޅި ފަރާތް', conf: 'ސިއްރު', none: '—', noComment: 'ކޮމެންޓެއް ނެތް', month: m => DV_MONTHS[m], dir: 'rtl',
  },
  en: {
    head: (n, N) => `RDP meeting no. ${n}: ${String(N).padStart(2, '0')} case(s) on the agenda`,
    sub: (N, k) => `(Of the ${N} case(s) on the agenda: ${k.lodge} lodged, ${k.not_lodge} not lodged${k.ret ? `, ${k.ret} returned or deferred` : ''}${k.none ? `, ${k.none} not decided` : ''})`,
    band: 'Decisions of the Registration Department Panel', item: i => `Complaint ${i}`,
    rows: ['Entry number (CMS)', 'Registration number', 'Date received', 'Complainant', 'Person whose rights were allegedly violated', 'Respondent', 'Rights concerned'],
    summary: 'Summary of the complaint', officer: "Registration Officer's comments:", decision: 'Panel decision:', requested: 'Decision requested from the panel:', issues: 'Unresolved issues:',
    out: { lodge: 'Lodge (refer to the Investigation Department)', not_lodge: 'Not lodged', return_officer: 'Returned to the officer for clarification', deferred: 'Deferred', none: 'Not decided yet' },
    reason: 'Reason:', clarify: 'Clarification needed:', same: 'The complainant', conf: 'Confidential', none: '—', noComment: 'No comments recorded', month: m => EN_MONTHS[m], dir: 'ltr',
  },
};
function meetingNo(m) {
  if (m.no) return m.no; const y = String(m.date).slice(0, 4);
  return vals(S.meetings).filter(x => x.status !== 'cancelled' && String(x.date).slice(0, 4) === y && (x.date < m.date || (x.date === m.date && String(x.id) <= String(m.id)))).length || 1;
}
function packData(mid, lang) {
  const m = S.meetings[mid]; const L = PACK_L[lang]; const sup = c => (typeof supersededIds === 'function' ? supersededIds(c) : new Set());
  const items = (m.agenda || []).map(id => S.complaints[id]).filter(Boolean);
  const k = { lodge: 0, not_lodge: 0, ret: 0, none: 0 };
  const cases = items.map((c, i) => {
    const show = !c.confidential || canSeeRestricted(c); const cp = cpOf(c); const vs = victimsOf(c);
    const d = entries(c.decisions).filter(x => x.meetingId === m.id).sort(byAt)[0] || null; const oc = d ? d.outcome : 'none'; // byAt sorts newest first
    if (oc === 'lodge') k.lodge++; else if (oc === 'not_lodge') k.not_lodge++; else if (oc === 'none') k.none++; else k.ret++;
    const officer = entries(c.reviews).filter(r => r.kind === 'officer' && !sup(c).has(r.id)).sort((a, b) => byAt(b, a)).map(r => r.text + (r.questions ? `\n${lang === 'dv' ? 'ސުވާލުތައް:' : 'Questions:'}\n${r.questions}` : ''));
    const pr = c.panelRequest || {};
    if (pr.requested) officer.push(`${L.requested}\n${pr.requested}`); if (pr.issues) officer.push(`${L.issues}\n${pr.issues}`);
    const decision = d ? [L.out[oc] || outcomeLabel(oc), d.rationale || '', d.reason ? `${L.reason}\n${lang === 'dv' ? (DV_NL_REASONS[d.reason] || d.reason) : d.reason}` : '', d.clarify ? `${L.clarify}\n${d.clarify}` : ''].filter(Boolean) : [L.out.none];
    return {
      n: i + 1, oc, color: PACK_COLORS[oc] || PACK_COLORS.none, outcome: L.out[oc] || oc,
      fields: [c.cmsRef || L.none, c.regNo, briefDate(String(c.dateReceived || c.createdAt || today()), L),
        show ? (cp.name || L.none) : L.conf,
        !show ? L.conf : vs.length ? vs.map(v => v.name).join('، ') : (c.victimSame ? (cp.name || L.same) : L.none),
        c.respondent?.name || L.none, (lang === 'dv' && (catIndex().byIssue[clsOf(c)?.issueId]?.dv || DV_RIGHTS[clsOf(c)?.catId])) || [c.category, c.subcategory].filter(Boolean).join(' — ') || L.none],
      summary: show || !c.confidential ? (c.summary || L.none) : L.conf,
      officerName: c.assignedTo ? nm(c.assignedTo) : '', officer: officer.length ? officer : [L.noComment], decision,
    };
  });
  return { m, L, no: meetingNo(m), ref: `RDP/${String(m.date).slice(0, 4)}/${String(meetingNo(m)).padStart(2, '0')}`, cases, k, N: items.length };
}

/* ---------- HTML (screen preview and PDF source) ---------- */
function packHeadHTML(P) {
  return `<table class="pk-tbl"><colgroup><col style="width:30%"><col style="width:70%"></colgroup><tbody>
    <tr><td colspan="2" class="pk-title"><div>${esc(P.L.head(P.no, P.N))}</div><div class="pk-sub">${esc(P.L.sub(P.N, P.k))}</div></td></tr>
    <tr><td colspan="2" class="pk-ref">${esc(P.ref)}</td></tr>
    <tr><td colspan="2" class="pk-band">${esc(P.L.band)}</td></tr></tbody></table>`;
}
function packCaseHTML(P, x) {
  const L = P.L; const lines = arr => arr.flatMap(t => String(t).split('\n')).map(t => `<div dir="auto">${esc(t)}</div>`).join('');
  return `<table class="pk-tbl"><colgroup><col style="width:30%"><col style="width:70%"></colgroup><tbody>
    <tr><td colspan="2" class="pk-bar" style="background:#${x.color}">${esc(L.item(x.n))} <span class="pk-oc">· ${esc(x.outcome)}</span></td></tr>
    ${x.fields.map((v, i) => `<tr class="${i % 2 ? '' : 'pk-alt'}"><th>${esc(L.rows[i])}</th><td dir="auto">${esc(v)}</td></tr>`).join('')}
    <tr><td colspan="2" class="pk-sec">${esc(L.summary)}</td></tr><tr><td colspan="2" class="pk-txt">${lines([x.summary])}</td></tr>
    <tr><td colspan="2" class="pk-sec">${esc(L.officer)}${x.officerName ? ` <span class="pk-who">(${esc(x.officerName)})</span>` : ''}</td></tr><tr><td colspan="2" class="pk-txt">${lines(x.officer)}</td></tr>
    <tr><td colspan="2" class="pk-sec">${esc(L.decision)}</td></tr><tr><td colspan="2" class="pk-txt pk-dec" style="background:#${PACK_TINTS[x.color]}">${lines(x.decision)}</td></tr>
  </tbody></table>`;
}
function packHTML(P) { return `<div class="pack" dir="${P.L.dir}">${packHeadHTML(P)}${P.cases.map(x => packCaseHTML(P, x)).join('')}</div>`; }

ACT.packOpen = el => {
  const mid = el.dataset.id; const m = S.meetings[mid]; if (!(m.agenda || []).length) { toast('The agenda is empty.', 'error'); return; }
  const lang = S.packLang || 'dv'; const P = packData(mid, lang);
  modal({ title: `Case pack ${P.ref} — ${fmtD(m.date)}`, wide: true, body: `
    <div class="row" style="justify-content:space-between;margin-bottom:10px"><div class="row"><label for="pk_lang" class="small">Language</label><select id="pk_lang" data-on="change:packLang" data-id="${esc(mid)}"><option value="dv" ${lang === 'dv' ? 'selected' : ''}>ދިވެހި (Dhivehi)</option><option value="en" ${lang === 'en' ? 'selected' : ''}>English</option></select></div>
      <div class="row small"><span style="display:inline-flex;gap:4px;align-items:center"><span style="width:12px;height:12px;background:#00B050;border-radius:2px"></span>Lodged</span><span style="display:inline-flex;gap:4px;align-items:center"><span style="width:12px;height:12px;background:#0070C0;border-radius:2px"></span>Not lodged</span><span style="display:inline-flex;gap:4px;align-items:center"><span style="width:12px;height:12px;background:#C55A11;border-radius:2px"></span>Returned / deferred</span><span style="display:inline-flex;gap:4px;align-items:center"><span style="width:12px;height:12px;background:#7F7F7F;border-radius:2px"></span>Not decided</span></div></div>
    <div class="brief-wrap" id="packPreview" style="max-height:60vh;overflow:auto">${packHTML(P)}</div>
    <p class="small muted" style="margin-bottom:0">Confidential — for authorized panel members. Confidential complainants show as ${esc(PACK_L[lang].conf)} unless your role may see them.</p>`,
    foot: `<button type="button" class="btn primary" data-act="packDocx" data-id="${esc(mid)}">Word</button><button type="button" class="btn primary" data-act="packPdf2" data-id="${esc(mid)}">PDF</button>` });
};
ON.packLang = el => { S.packLang = el.value; const P = packData(el.dataset.id, el.value); const b = $('#packPreview'); if (b) b.innerHTML = packHTML(P); };
const packFile = (P, ext) => `FREMYS-case-pack-${P.ref.replace(/\//g, '-')}-${P.m.date}.${ext}`;

/* ---------- Word ---------- */
ACT.packDocx = async el => {
  const P = packData(el.dataset.id, S.packLang || 'dv'); const L = P.L; const rtl = L.dir === 'rtl';
  const x = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const isTh = s => /[ހ-޿]/.test(s);
  const run = (text, o = {}) => `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Faruma"/>${o.b ? '<w:b/><w:bCs/>' : ''}${o.u ? '<w:u w:val="single"/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}${isTh(text) ? '<w:rtl/>' : ''}<w:sz w:val="${o.sz || 24}"/><w:szCs w:val="${Math.max(o.sz || 24, 24)}"/></w:rPr><w:t xml:space="preserve">${x(text)}</w:t></w:r>`;
  const para = (text, o = {}) => { const th = o.dirOf != null ? isTh(o.dirOf) : isTh(text) || (rtl && !/[A-Za-z]/.test(text)); return `<w:p><w:pPr>${th ? '<w:bidi/>' : '<w:bidi w:val="0"/>'}<w:spacing w:before="0" w:after="${o.after ?? 40}" w:line="${o.line || 276}" w:lineRule="auto"/><w:jc w:val="${o.jc || (th ? 'right' : 'left')}"/></w:pPr>${run(text, o)}</w:p>`; };
  const paras = (arr, o) => arr.flatMap(t => String(t).split('\n')).map(t => para(t, o)).join('');
  const W = [3300, 7700]; const ALL = W[0] + W[1];
  const tc = (inner, o = {}) => `<w:tc><w:tcPr><w:tcW w:w="${o.w}" w:type="dxa"/>${o.span ? `<w:gridSpan w:val="${o.span}"/>` : ''}${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''}${o.bar ? `<w:tcBorders><w:${rtl ? 'right' : 'left'} w:val="single" w:sz="36" w:space="0" w:color="${o.bar}"/></w:tcBorders>` : ''}<w:vAlign w:val="${o.v || 'top'}"/></w:tcPr>${inner || '<w:p/>'}</w:tc>`;
  const tr = (cells, o = {}) => `<w:tr>${o.keep ? '<w:trPr><w:cantSplit/></w:trPr>' : ''}${cells}</w:tr>`;
  const full = (inner, o = {}) => tr(tc(inner, { w: ALL, span: 2, ...o }), o);
  const rows = [
    full(para(L.head(P.no, P.N), { jc: 'center', sz: 30, b: true }) + para(L.sub(P.N, P.k), { jc: 'center', sz: 26, u: true })),
    full(para(P.ref, { jc: 'center', sz: 32, b: true, dirOf: '' })),
    full(para(L.band, { jc: rtl ? 'right' : 'left', sz: 26, b: true, color: 'FFFFFF' }), { fill: '4472C4' }),
  ];
  P.cases.forEach(c => {
    rows.push(full(para(`${L.item(c.n)}  ·  ${c.outcome}`, { b: true, sz: 26, color: 'FFFFFF' }), { fill: c.color, keep: true }));
    c.fields.forEach((v, i) => rows.push(tr(tc(para(L.rows[i], { b: true }), { w: W[0], fill: i % 2 ? undefined : 'D9E2F3' }) + tc(para(v), { w: W[1], fill: i % 2 ? undefined : 'D9E2F3' }), { keep: true })));
    rows.push(full(para(L.summary, { b: true, u: true }), { keep: true }), full(paras([c.summary], { line: 336 }), { fill: 'DEEAF6' }));
    rows.push(full(para(L.officer + (c.officerName ? ` (${c.officerName})` : ''), { b: true, u: true }), { keep: true }), full(paras(c.officer, { line: 336 }), { fill: 'DEEAF6' }));
    rows.push(full(para(L.decision, { b: true, u: true }), { keep: true }), full(paras(c.decision, { line: 336, b: false }), { fill: PACK_TINTS[c.color] }));
  });
  const tbl = `<w:tbl><w:tblPr>${rtl ? '<w:bidiVisual/>' : ''}<w:tblW w:w="${ALL}" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="8EAADB"/>`).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${W.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>`;
  const foot = `<w:p><w:pPr><w:spacing w:before="160"/></w:pPr>${run(`FREMYS · ${P.ref} · ${fmtD(today())} · CONFIDENTIAL`, { sz: 16, color: '808080' })}</w:p>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${tbl}${foot}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="450" w:bottom="720" w:left="450" w:header="360" w:footer="360" w:gutter="0"/>${rtl ? '<w:bidi/>' : ''}</w:sectPr></w:body></w:document>`;
  await saveFile(packFile(P, 'docx'), docxBlob(doc, `Case pack ${P.ref}`));
  logA('casepack.docx', null, P.ref);
};
function docxBlob(documentXml, title) {
  const enc = new TextEncoder(); const x = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const files = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'],
    ['word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'],
    ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(title)}</dc:title><dc:creator>FREMYS</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`],
    ['word/document.xml', documentXml],
  ].map(([name, s]) => ({ name, data: enc.encode(s) }));
  return new Blob([makeZip(files)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

/* ---------- PDF: blocks laid out by the browser (Dhivehi shaped correctly), packed into A4 pages, captured ---------- */
async function pdfFromBlocks(blocksHTML, { dir, footer, filename, btn }) {
  if (!window.jspdf) throw new Error('The PDF library did not load.');
  await needHtml2canvas(); if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const host = document.createElement('div'); host.className = 'brief-print'; document.body.appendChild(host);
  try {
    const PAGE_H = 1123 - 56; const pages = []; let cur = null;
    const newPage = () => { cur = document.createElement('div'); cur.className = 'brief-page'; cur.innerHTML = `<div class="pack" dir="${dir}"></div>`; host.appendChild(cur); pages.push(cur); return cur.firstChild; };
    let box = newPage();
    for (const h of blocksHTML) {
      const t = document.createElement('div'); t.innerHTML = h; const el = t.firstElementChild; box.appendChild(el);
      if (cur.offsetHeight > PAGE_H && box.children.length > 1) { el.remove(); box = newPage(); box.appendChild(el); }
    }
    const { jsPDF } = window.jspdf; const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 21; const usableH = ph - 2 * m - 14; let pageNo = 0; const shots = [];
    for (let i = 0; i < pages.length; i++) { if (btn) btn.textContent = `Building PDF… ${i + 1}/${pages.length}`; shots.push(await html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', logging: false })); }
    const slices = []; // a block taller than a page is split across pages
    shots.forEach(cv => { const w = pw - 2 * m; const scale = w / cv.width; const sliceH = Math.floor(usableH / scale); for (let y = 0; y < cv.height; y += sliceH) slices.push({ cv, y, h: Math.min(sliceH, cv.height - y), scale }); });
    slices.forEach((s, i) => {
      if (i) pdf.addPage(); pageNo++;
      const c = document.createElement('canvas'); c.width = s.cv.width; c.height = s.h; c.getContext('2d').drawImage(s.cv, 0, s.y, s.cv.width, s.h, 0, 0, s.cv.width, s.h);
      pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', m, m, pw - 2 * m, s.h * s.scale);
      pdf.setFontSize(8); pdf.setTextColor(120); pdf.text(`${footer} · page ${pageNo} of ${slices.length}`, pw / 2, ph - 12, { align: 'center' });
    });
    pdf.setProperties({ title: footer, creator: 'FREMYS' });
    await saveFile(filename, pdf.output('blob'));
  } finally { host.remove(); }
}
ACT.packPdf2 = async el => {
  const P = packData(el.dataset.id, S.packLang || 'dv'); const old = el.textContent; el.disabled = true; el.textContent = 'Building PDF…';
  try { await pdfFromBlocks([packHeadHTML(P), ...P.cases.map(x => packCaseHTML(P, x))], { dir: P.L.dir, footer: `FREMYS case pack ${P.ref} · CONFIDENTIAL`, filename: packFile(P, 'pdf'), btn: el }); logA('casepack.pdf', null, P.ref); }
  catch (e) { toast('Could not build the PDF: ' + errText(e), 'error'); }
  finally { el.disabled = false; el.textContent = old; }
};

/* ---------- Reports → Panel Briefing: one panel meeting's agenda and decisions, with the case pack in Word / PDF ---------- */
function panelBriefMeetings() { return vals(S.meetings).filter(m => (m.agenda || []).length && m.status !== 'cancelled').sort((a, b) => String(b.date).localeCompare(String(a.date))); }
VIEWS.panelbrief = () => {
  if (!can('stats')) return noAccess();
  const ms = panelBriefMeetings();
  if (!ms.length) return `<div class="page-head"><div><h1>${esc(t('panelbrief'))}</h1><p>Decisions of a Registration Panel meeting, with the case pack in Word or PDF.</p></div></div><div class="card"><div class="empty">No panel meeting has an agenda yet.</div></div>`;
  let mid = S.pbMeeting; if (!mid || !S.meetings[mid]) { const held = ms.find(m => m.date <= today()); mid = S.pbMeeting = (held || ms[ms.length - 1]).id; }
  const lang = S.packLang || 'dv'; const P = packData(mid, lang); const m = P.m;
  const tile = (k, n, cls, col) => `<div class="tile ${cls}" style="cursor:default${col ? `;border-top:5px solid #${col}` : ''}"><div class="k">${esc(k)}</div><div class="v num">${n}</div><div class="s">${P.N ? pctOf(n, P.N) + '% of the agenda' : ''}</div></div>`;
  const PE = lang === 'en' ? P : packData(mid, 'en'); // the on-screen table is in English, like the rest of the page
  const rows = PE.cases.map(x => `<tr><td>${x.n}</td><td style="white-space:nowrap">${esc(x.fields[1])}</td><td dir="auto">${esc(x.fields[3])}</td><td dir="auto" class="small">${esc(x.fields[6])}</td><td><span class="pill" style="background:#${x.color};color:#fff">${esc({ lodge: 'Lodged', not_lodge: 'Not lodged', return_officer: 'Returned to officer', deferred: 'Deferred', none: 'Not decided' }[x.oc] || x.outcome)}</span></td><td dir="auto" class="small">${esc(x.decision.slice(1).join(' ') || '—')}</td></tr>`).join('');
  return `<div class="page-head"><div><h1>${esc(t('panelbrief'))}</h1><p>The agenda and decisions of a Registration Panel meeting, with the case pack in the RDP format as Word or PDF. Green is lodged, blue is not lodged, orange is returned or deferred, grey is not decided yet.</p></div>
    <div class="row"><button class="btn primary" data-act="packDocx" data-id="${esc(mid)}">Word report</button><button class="btn primary" data-act="packPdf2" data-id="${esc(mid)}">PDF report</button></div></div>
  <div class="card"><div class="filters">
    <div class="f wide"><label for="pb_m">Panel meeting</label><select id="pb_m" data-on="change:pbMeeting">${ms.map(x => `<option value="${esc(x.id)}" ${x.id === mid ? 'selected' : ''}>RDP/${String(x.date).slice(0, 4)}/${String(meetingNo(x)).padStart(2, '0')} · ${fmtD(x.date)} · ${(x.agenda || []).length} case${(x.agenda || []).length === 1 ? '' : 's'}${x.date > today() ? ' (upcoming)' : ''}</option>`).join('')}</select></div>
    <div class="f"><label for="pb_lang">Report language</label><select id="pb_lang" data-on="change:pbLang"><option value="dv" ${lang === 'dv' ? 'selected' : ''}>ދިވެހި (Dhivehi)</option><option value="en" ${lang === 'en' ? 'selected' : ''}>English</option></select></div>
    <div class="f"><label>&nbsp;</label><a class="btn sm" href="#meeting-${esc(mid)}">Open the meeting</a></div></div>
    <p class="small muted" style="margin:6px 0 0">${esc(P.ref)} · ${fmtD(m.date)}${m.time ? ' ' + esc(m.time) : ''}${m.venue ? ' · ' + esc(m.venue) : ''} · status: ${esc(m.status || 'planned')}</p></div>
  <div class="tiles section">
    ${tile('Cases on the agenda', P.N, 'info')}${tile('Lodged', P.k.lodge, 'ok', PACK_COLORS.lodge)}${tile('Not lodged', P.k.not_lodge, '', PACK_COLORS.not_lodge)}${tile('Returned / deferred', P.k.ret, 'warn', PACK_COLORS.deferred)}${P.k.none ? tile('Not decided yet', P.k.none, '', PACK_COLORS.none) : ''}
  </div>
  <div class="card section"><h2>Panel decisions</h2><div class="tbl-wrap"><table><thead><tr><th>#</th><th>${esc(t('reg_no'))}</th><th>${esc(t('complainant'))}</th><th>Rights concerned</th><th>Decision</th><th>Reasons</th></tr></thead><tbody>${rows}</tbody></table></div></div>
  <div class="card section"><div class="card-head"><h2>Case pack preview</h2><span class="muted small">Word and PDF use the same layout.</span></div><div class="brief-wrap">${packHTML(P)}</div></div>`;
};
ON.pbMeeting = el => { S.pbMeeting = el.value; render(); };
ON.pbLang = el => { S.packLang = el.value; render(); };
