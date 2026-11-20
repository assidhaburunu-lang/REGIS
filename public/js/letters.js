'use strict';
/* Interim phase → letters to authorities about a case: letters for attention (ސަމާލު ސިޓީ) and letters of concern
   (ކަންބޮޑުވުން). A case can have any number of them, each to a different authority, each tracked from draft to sent to reply.
   Stored on the complaint as c.aletters = { id: {...} }. */

const ALETTER_KINDS = {
  attention: { en: 'Letter for attention', dv: 'ސަމާލު ސިޓީ', color: '#0369a1' },
  concern: { en: 'Letter of concern', dv: 'ކަންބޮޑުވުން', color: '#b45309' },
};
const ALETTER_STATUS = { draft: ['To send', 'warn'], sent: ['Sent — awaiting reply', 'info'], replied: ['Reply received', 'ok'], closed: ['Closed — no reply needed', 'muted'] };
// Suggestions only; staff can type any authority.
const AUTHORITIES = ['Maldives Police Service', 'Maldives Correctional Service', 'Prosecutor General\'s Office', 'Ministry of Homeland Security and Technology', 'Ministry of Health', 'Ministry of Education',
  'Ministry of Social and Family Development', 'Family Protection Authority', 'Juvenile Justice Unit', 'Ministry of Islamic Affairs', 'Maldives Immigration', 'Labour Relations Authority', 'Local Government Authority',
  'Housing Development Corporation (HDC)', 'Maldives National Defence Force', 'Civil Service Commission', 'Judicial Service Commission', 'Anti-Corruption Commission', 'National Disaster Management Authority', 'Island council'];
const alettersOf = c => entries(c.aletters).filter(l => !l.deleted);
const alAll = cases => cases.flatMap(c => alettersOf(c).map(l => ({ c, l })));
const alKind = (k, lang) => (ALETTER_KINDS[k] || {})[lang === 'dv' ? 'dv' : 'en'] || k;
const alReplyDue = l => l.status === 'sent' && l.replyDays ? addWorkDays(l.sentAt, +l.replyDays) : null;

function aletterSuggestAuthorities(c) {
  const det = typeof detOf === 'function' ? detOf(c) : null;
  return [...new Set([c.respondent?.name, det ? detName(det) : null, ...AUTHORITIES].filter(Boolean))];
}

// Draft text — the officer edits it before sending. Dhivehi wording should be checked against the Commission's letter style.
function aletterText(c, l) {
  const dv = l.lang === 'dv'; const pts = String(l.points || '').trim(); const days = +l.replyDays || 0;
  const dateTxt = dv ? briefDate(today(), BRIEF_L.dv) : stripBidi(fmtD(today()));
  if (dv) {
    const open = l.kind === 'concern'
      ? `މި ކޮމިޝަނަށް ލިބިފައިވާ ޝަކުވާއެއް (${c.regNo}) ގައި ބަޔާންކޮށްފައިވާ ތިރީގައިވާ ކަންކަމާ ގުޅިގެން، މި ކޮމިޝަނުގެ ކަންބޮޑުވުން ފާޅުކުރަމެވެ.`
      : `މި ކޮމިޝަނަށް ލިބިފައިވާ ޝަކުވާއެއް (${c.regNo}) ގައި ބަޔާންކޮށްފައިވާ ތިރީގައިވާ ކަންކަމަށް ތިޔަ އިދާރާގެ ސަމާލުކަން ހޯދުމަށް އެދެމެވެ.`;
    const ask = l.kind === 'concern'
      ? `މި ކަންކަމާ ގުޅިގެން ތިޔަ އިދާރާއިން އަޅާފައިވާ، ނުވަތަ އަޅަން ރާވާފައިވާ ފިޔަވަޅުތައް${days ? ` ${days} ދުވަހުގެ ތެރޭގައި` : ''} މި ކޮމިޝަނަށް އަންގައިދެއްވުން އެދެމެވެ.`
      : `މި ކަމުގައި ޤާނޫނާއި ޤަވާޢިދާ އެއްގޮތަށް ބެލުން އެދެމެވެ.${days ? ` އަދި މި ކަމާ ގުޅިގެން އަޅާފައިވާ ފިޔަވަޅުތައް ${days} ދުވަހުގެ ތެރޭގައި މި ކޮމިޝަނަށް އަންގައިދެއްވުން އެދެމެވެ.` : ''}`;
    return `${dateTxt}

${l.authority}${l.attn ? '\n' + l.attn : ''}

މައުޟޫޢު: ${l.subject}

${open}

${pts}

${ask}

މި ސިޓީއާ ގުޅޭ ގޮތުން ސުވާލެއް އެބައޮތްނަމަ ރަޖިސްޓްރޭޝަން ޑިޕާޓްމަންޓާ ގުޅުއްވުން އެދެމެވެ.

ވަސްސަލާމް

${nm(c.assignedTo || S.me.id)}
ރަޖިސްޓްރޭޝަން އޮފިސަރ
ހިއުމަން ރައިޓްސް ކޮމިޝަން އޮފް ދަ މޯލްޑިވްސް`;
  }
  const open = l.kind === 'concern'
    ? `The Human Rights Commission of the Maldives wishes to express its concern regarding the following matters raised in a complaint received by the Commission (reference ${c.regNo}).`
    : `The Human Rights Commission of the Maldives wishes to bring to your attention the following matters raised in a complaint received by the Commission (reference ${c.regNo}).`;
  const ask = l.kind === 'concern'
    ? `We request that you inform the Commission of the action taken, or planned, to address these concerns${days ? ` within ${days} working days of receiving this letter` : ''}.`
    : `We request that this matter be looked into in accordance with the applicable laws and regulations${days ? `, and that the Commission be informed of any action taken within ${days} working days of receiving this letter` : ''}.`;
  return `${dateTxt}

${l.authority}${l.attn ? '\n' + l.attn : ''}

Subject: ${l.subject}

${open}

${pts}

${ask}

If you have any questions about this letter, please contact the Registration Department of the Commission, quoting reference ${c.regNo}.

Yours sincerely,


${nm(c.assignedTo || S.me.id)}
Registration Officer
Registration Department
Human Rights Commission of the Maldives`;
}

/* Add or edit a letter (the details; the text is drafted from them) */
ACT.aletterAdd = el => aletterForm(S.complaints[el.dataset.id], null, el.dataset.kind);
ACT.aletterEdit = el => aletterForm(S.complaints[el.dataset.id], el.dataset.l);
function aletterForm(c, lid, kind) {
  if (!c || !canSendInterim(c)) return toast('Only the assigned officer, an Administrative Officer or a supervisor can prepare letters for this case.', 'error');
  const l = lid ? c.aletters[lid] : { kind: kind || 'attention', lang: S.lang === 'dv' ? 'dv' : 'en', replyDays: 10 };
  const subj = k => alDefSubj(k, l.lang, c.regNo);
  modal({ title: `${lid ? 'Edit' : 'New'} letter to an authority — ${c.regNo}`, wide: true, body: `<div class="form">
    <div class="f full"><span class="lbl">Type of letter</span><div class="row" style="gap:16px">${Object.entries(ALETTER_KINDS).map(([k, x]) => `<label class="row" style="gap:6px"><input type="radio" name="kind" value="${k}" ${l.kind === k ? 'checked' : ''} data-on="change:alKindSubj"> <b>${esc(x.en)}</b> <span dir="rtl" class="dv">${esc(x.dv)}</span></label>`).join('')}</div></div>
    ${fld('Authority', `<input id="f_authority" name="authority" list="al_auth" value="${esc(l.authority || '')}" data-required="the authority" placeholder="e.g. Maldives Correctional Service"><datalist id="al_auth">${aletterSuggestAuthorities(c).map(a => `<option value="${esc(a)}">`).join('')}</datalist>`, { req: true, id: 'f_authority' })}
    ${fld('For the attention of (optional)', inp('attn', l.attn || '', { ph: 'e.g. Commissioner of Prisons' }), { id: 'f_attn' })}
    ${fld('Letter language', sel('lang', [['en', 'English'], ['dv', 'Dhivehi ދިވެހި']], l.lang || 'en', { blank: false }).replace('<select', '<select data-on="change:alKindSubj"'), { id: 'f_lang' })}
    ${fld('Reply requested within (working days)', inp('replyDays', l.replyDays ?? 10, { type: 'number', attrs: 'min="0" max="90"' }), { id: 'f_replyDays', hint: '0 = no reply needed' })}
    ${fld('Subject', inp('subject', l.subject || subj(l.kind), { req: 'a subject' }), { req: true, full: true, id: 'f_subject' })}
    ${fld(l.kind === 'concern' ? 'Concerns to raise' : 'Matters for their attention', txt('points', l.points || '', { rows: 6, req: 'the points to raise', ph: 'One point per line, e.g.\n1. The complainant has not been allowed family visits since …\n2. …' }), { req: true, full: true, id: 'f_points' })}
    <div class="f full small muted">The letter text is drafted from these details; you can edit the wording before downloading it. A case can have several letters, one for each authority.</div></div>`,
    submit: lid ? 'Save' : 'Create letter', onSubmit: async o => {
      const id = lid || nid('al'); const at = nowISO();
      const rec = { kind: o.kind, lang: o.lang, authority: o.authority.trim(), attn: o.attn || '', subject: o.subject, points: o.points, replyDays: Math.max(0, +o.replyDays || 0) };
      if (!lid) Object.assign(rec, { status: 'draft', by: S.me.id, at, due: addWorkDays(today(), cfg().sla.interimDays || 7) }); else rec.text = null; // details changed → redraft the text
      await updC(c.id, { aletters: { [id]: rec } }, { note: `${lid ? 'Updated' : 'Prepared'} ${alKind(o.kind).toLowerCase()} to ${rec.authority}`, action: lid ? 'aletter.edit' : 'aletter.add' });
      toast(lid ? 'Letter updated' : 'Letter created — open “Draft” to prepare the text');
    } });
}
function alDefSubj(kind, lang, reg) { return lang === 'dv' ? (kind === 'concern' ? `ކަންބޮޑުވުން ފާޅުކުރުން: ޝަކުވާ ${reg}` : `ސަމާލުކަމަށް: ޝަކުވާ ${reg}`) : (kind === 'concern' ? `Concern regarding complaint ${reg}` : `For your attention: complaint ${reg}`); }
// When the type or language changes, update the subject if it is still one of the standard subjects.
ON.alKindSubj = el => {
  const form = el.closest('form') || document; const kind = form.querySelector('input[name=kind]:checked')?.value || 'attention'; const lang = $('#f_lang')?.value || 'en'; const f = $('#f_subject');
  const reg = (f?.value.match(/(\S+)\s*$/) || [])[1] || '';
  if (f && ['attention', 'concern'].some(k => ['en', 'dv'].some(lg => f.value === alDefSubj(k, lg, reg)))) { f.value = alDefSubj(kind, lang, reg); f.dir = lang === 'dv' ? 'rtl' : 'ltr'; }
  const lab = $('#f_points')?.closest('.f')?.querySelector('label'); if (lab) lab.firstChild.textContent = kind === 'concern' ? 'Concerns to raise' : 'Matters for their attention';
};

/* Draft text → Word / PDF */
ACT.aletterDraft = el => {
  const c = S.complaints[el.dataset.id]; const lid = el.dataset.l; const l = c.aletters[lid]; const dv = l.lang === 'dv';
  modal({ title: `${alKind(l.kind)} — ${l.authority} — ${c.regNo}`, wide: true, body: `<p class="small muted" style="margin-top:0">Draft from the letter details. Edit it as needed and save; then download it as Word (to put on the Commission's letterhead) or as a PDF.${dv ? ' Please check the Dhivehi wording before sending.' : ''}</p>
    <textarea id="letterText" rows="24" dir="${dv ? 'rtl' : 'ltr'}" class="${dv ? 'dv' : ''}" style="font-family:${dv ? 'RegisThaana, Faruma' : 'var(--font-body)'};line-height:1.7">${esc(l.text || aletterText(c, l))}</textarea>`,
    foot: `<button type="button" class="btn" data-act="aletterRedraft" data-id="${esc(c.id)}" data-l="${esc(lid)}" title="Replace the text with a fresh draft from the details">Redraft</button><button type="button" class="btn" data-act="aletterSaveText" data-id="${esc(c.id)}" data-l="${esc(lid)}">Save text</button><button type="button" class="btn" data-act="aletterDocx" data-id="${esc(c.id)}" data-l="${esc(lid)}">Word</button><button type="button" class="btn primary" data-act="aletterPdf" data-id="${esc(c.id)}" data-l="${esc(lid)}">PDF</button>` });
};
ACT.aletterRedraft = el => { const c = S.complaints[el.dataset.id]; $('#letterText').value = aletterText(c, c.aletters[el.dataset.l]); };
ACT.aletterSaveText = async el => { await updC(el.dataset.id, { aletters: { [el.dataset.l]: { text: $('#letterText').value } } }); toast('Letter text saved'); };
const alFile = (c, l, ext) => `${l.kind === 'concern' ? 'Concern' : 'Attention'}-letter-${c.regNo}-${String(l.authority).replace(/[^\wހ-޿]+/g, '-').slice(0, 40)}.${ext}`;
ACT.aletterDocx = async el => {
  const c = S.complaints[el.dataset.id]; const l = c.aletters[el.dataset.l]; const text = stripBidi($('#letterText').value); const dv = l.lang === 'dv';
  const xe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const p = (line, o = {}) => { const th = /[ހ-޿]/.test(line); return `<w:p><w:pPr>${th ? '<w:bidi/>' : '<w:bidi w:val="0"/>'}<w:spacing w:after="${line ? 60 : 0}" w:line="${dv ? 360 : 300}" w:lineRule="auto"/>${o.center ? '<w:jc w:val="center"/>' : ''}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Faruma"/>${o.b ? '<w:b/><w:bCs/>' : ''}${th ? '<w:rtl/>' : ''}<w:sz w:val="${o.sz || 24}"/><w:szCs w:val="${o.sz || 26}"/></w:rPr><w:t xml:space="preserve">${xe(line)}</w:t></w:r></w:p>`; };
  const body = text.split('\n').map(line => p(line, { b: /^(Subject:|މައުޟޫޢު:)/.test(line) })).join('');
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="2268" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  await saveFile(alFile(c, l, 'docx'), docxBlob(doc, `${alKind(l.kind)} ${c.regNo}`)); logA('aletter.docx', c.id, l.authority);
};
ACT.aletterPdf = async el => {
  const c = S.complaints[el.dataset.id]; const l = c.aletters[el.dataset.l]; const dv = l.lang === 'dv'; const text = $('#letterText').value; const old = el.textContent; el.disabled = true;
  try {
    const head = `<div style="text-align:center;margin-bottom:18px;border-bottom:1px solid #999;padding-bottom:8px"><div style="font-weight:700;font-size:17px">${dv ? 'ހިއުމަން ރައިޓްސް ކޮމިޝަން އޮފް ދަ މޯލްޑިވްސް' : 'Human Rights Commission of the Maldives'}</div><div style="font-size:12px;color:#555">${dv ? 'ރަޖިސްޓްރޭޝަން ޑިޕާޓްމަންޓް' : 'Registration Department'}</div></div>`;
    const blocks = [head, ...text.split(/\n{2,}/).map(par => `<div dir="auto" style="white-space:pre-wrap;margin:0 0 12px;font-size:${dv ? 15 : 14}px;line-height:1.75;text-align:${dv ? 'right' : 'left'}">${esc(par)}</div>`)];
    await pdfFromBlocks(blocks, { dir: dv ? 'rtl' : 'ltr', footer: `${c.regNo} · ${l.authority}`, filename: alFile(c, l, 'pdf'), btn: el }); logA('aletter.pdf', c.id, l.authority);
  } catch (e) { toast(e.message || 'Could not build the PDF', 'error'); } finally { el.disabled = false; el.textContent = old; }
};

/* Sent, reply, close, delete */
ACT.aletterSent = el => {
  const c = S.complaints[el.dataset.id]; const lid = el.dataset.l; const l = c.aletters[lid];
  modal({ title: `Record letter sent — ${l.authority}`, body: `<div class="form">
    ${fld('Date sent', inp('sentAt', today(), { type: 'date', req: 'the date', attrs: `max="${today()}"` }), { req: true, id: 'f_sentAt' })}
    ${fld('How it was sent', sel('method', LETTER_METHODS, 'Letter (hand delivered)', { blank: false }), { id: 'f_method' })}
    ${fld('Letter reference no.', inp('ref', '', { ph: 'e.g. HRCM/REG/2026/115' }), { id: 'f_ref' })}
    ${fld('Signed copy (optional)', fileInp('files', false), { full: true, id: 'f_files' })}
    ${fld('Note', txt('note', '', { rows: 2 }), { full: true, id: 'f_note' })}</div>`, submit: 'Record as sent', onSubmit: async (o, form) => {
    const up = await uploadFiles(form.querySelector('#f_files').files); const docs = {}; const at = nowISO();
    up.forEach(f => { docs[nid('d')] = { ...f, title: `${alKind(l.kind)} — ${l.authority}`, type: 'Outgoing correspondence', version: 1, author: S.me.id, source: 'HRCM', date: o.sentAt, restricted: false, at }; });
    await updC(c.id, { aletters: { [lid]: { status: l.replyDays ? 'sent' : 'closed', sentAt: o.sentAt, method: o.method, ref: o.ref || '', note: o.note || '', sentBy: S.me.id, sentRecordedAt: at } }, docs,
      corr: { [nid('co')]: { dir: 'out', date: o.sentAt, party: l.authority, method: o.method, subject: `${alKind(l.kind)}: ${l.subject}`, notes: [o.ref, o.note].filter(Boolean).join(' · '), by: S.me.id, at } } },
      { note: `${alKind(l.kind)} sent to ${l.authority}${o.ref ? ' (' + o.ref + ')' : ''}`, action: 'aletter.sent' });
    toast('Letter recorded as sent');
  } });
};
ACT.aletterReply = el => {
  const c = S.complaints[el.dataset.id]; const lid = el.dataset.l; const l = c.aletters[lid];
  modal({ title: `Reply from ${l.authority}`, body: `<div class="form">
    ${fld('Date received', inp('date', today(), { type: 'date', req: 'the date', attrs: `max="${today()}"` }), { req: true, id: 'f_date' })}
    ${fld('Their reference (optional)', inp('ref', ''), { id: 'f_ref' })}
    ${fld('Summary of the reply', txt('summary', '', { rows: 4, req: 'a summary' }), { req: true, full: true, id: 'f_summary' })}
    ${fld('Copy of the reply (optional)', fileInp('files', false), { full: true, id: 'f_files' })}</div>`, submit: 'Record reply', onSubmit: async (o, form) => {
    const up = await uploadFiles(form.querySelector('#f_files').files); const docs = {}; const at = nowISO();
    up.forEach(f => { docs[nid('d')] = { ...f, title: `Reply from ${l.authority}`, type: 'Incoming correspondence', version: 1, author: S.me.id, source: l.authority, date: o.date, restricted: false, at }; });
    await updC(c.id, { aletters: { [lid]: { status: 'replied', reply: { date: o.date, ref: o.ref || '', summary: o.summary, by: S.me.id, at } } }, docs,
      corr: { [nid('co')]: { dir: 'in', date: o.date, party: l.authority, method: 'Letter', subject: `Reply to ${alKind(l.kind).toLowerCase()}: ${l.subject}`, notes: o.summary, by: S.me.id, at } } },
      { note: `Reply received from ${l.authority}`, action: 'aletter.reply' });
    toast('Reply recorded');
  } });
};
ACT.aletterClose = el => confirmBox('Close without a reply?', 'Mark this letter as closed. Use this when no reply is expected any more.', 'Close letter', async () => { await updC(el.dataset.id, { aletters: { [el.dataset.l]: { status: 'closed', closedBy: S.me.id, closedAt: nowISO() } } }, { note: 'Authority letter closed without a reply', action: 'aletter.close' }); });
ACT.aletterDel = el => { const c = S.complaints[el.dataset.id]; const l = c.aletters[el.dataset.l]; confirmBox('Delete this draft?', `Delete the unsent ${alKind(l.kind).toLowerCase()} to ${l.authority}?`, 'Delete', async () => { await updC(c.id, { aletters: { [el.dataset.l]: { deleted: true, deletedBy: S.me.id, deletedAt: nowISO() } } }, { note: `Deleted draft letter to ${l.authority}`, action: 'aletter.delete' }); }, true); };

/* The list shown on the Interim phase page */
function aletterRows(list, { showCase = true } = {}) {
  const td = today();
  return list.map(({ c, l }) => {
    const st = ALETTER_STATUS[l.status] || [l.status, 'muted']; const rd = alReplyDue(l); const late = (l.status === 'draft' && l.due && l.due < td) || (rd && rd < td); const may = canSendInterim(c);
    const btn = (act, lab, cls = '') => `<button class="btn sm ${cls}" data-act="${act}" data-id="${esc(c.id)}" data-l="${esc(l.id)}">${lab}</button>`;
    return `<tr class="${late ? 'overdue' : ''}">${showCase ? `<td style="white-space:nowrap">${caseLink(c)}<div class="muted small">${esc(nm(c.assignedTo))}</div></td>` : ''}
      <td><span class="pill" style="background:${ALETTER_KINDS[l.kind]?.color};color:#fff">${esc(alKind(l.kind))}</span><div class="small dv" dir="rtl">${esc(ALETTER_KINDS[l.kind]?.dv || '')}</div></td>
      <td dir="auto"><b>${esc(l.authority)}</b>${l.attn ? `<div class="small muted">${esc(l.attn)}</div>` : ''}<div class="small" dir="auto">${esc(l.subject)}</div></td>
      <td>${pill(st[0], st[1])}${l.status === 'draft' && l.due ? `<div class="small ${l.due < td ? '' : 'muted'}" style="${l.due < td ? 'color:#b91c1c;font-weight:700' : ''}">send by ${fmtD(l.due)}</div>` : ''}${l.sentAt ? `<div class="small muted">sent ${fmtD(l.sentAt)}${l.ref ? ' · ' + esc(l.ref) : ''}</div>` : ''}${rd ? `<div class="small" style="${rd < td ? 'color:#b91c1c;font-weight:700' : ''}">reply due ${fmtD(rd)}</div>` : ''}${l.reply ? `<div class="small" dir="auto" title="${esc(l.reply.summary)}">${fmtD(l.reply.date)}: ${esc(String(l.reply.summary).slice(0, 90))}${String(l.reply.summary).length > 90 ? '…' : ''}</div>` : ''}</td>
      <td class="r" style="white-space:nowrap">${may ? `${btn('aletterDraft', 'Draft')}${l.status === 'draft' ? ` ${btn('aletterEdit', 'Edit')} ${btn('aletterSent', 'Record as sent', 'primary')} ${btn('aletterDel', 'Delete', 'danger')}` : ''}${l.status === 'sent' ? ` ${btn('aletterReply', 'Reply received', 'primary')} ${btn('aletterClose', 'Close')}` : ''}` : ''}</td></tr>`;
  }).join('');
}
function aletterTable(list, opts) {
  return `<div class="tbl-wrap"><table><thead><tr>${opts?.showCase === false ? '' : '<th>Complaint</th>'}<th>Type</th><th>Authority and subject</th><th>Status</th><th></th></tr></thead><tbody>${aletterRows(list, opts)}</tbody></table></div>`;
}
// Add-letter menu for a case
ACT.aletterMenu = el => {
  const c = S.complaints[el.dataset.id]; const list = alettersOf(c).map(l => ({ c, l }));
  modal({ title: `Letters to authorities — ${c.regNo}`, wide: true, body: `<p class="small muted" style="margin-top:0">Send letters about this case to as many authorities as needed: a <b>letter for attention</b> (ސަމާލު ސިޓީ) asks them to look into the matter; a <b>letter of concern</b> (ކަންބޮޑުވުން) records the Commission's concern and asks what they will do.</p>
    ${list.length ? aletterTable(list, { showCase: false }) : '<div class="empty">No letters to authorities for this case yet.</div>'}`,
    foot: canSendInterim(c) ? `<button type="button" class="btn" data-act="aletterAdd" data-id="${esc(c.id)}" data-kind="attention">+ Letter for attention</button><button type="button" class="btn primary" data-act="aletterAdd" data-id="${esc(c.id)}" data-kind="concern">+ Letter of concern</button>` : '' });
};
