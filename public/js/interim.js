'use strict';
/* Interim phase: after the Commission decides to lodge or not lodge, the Registration Officer sends an interim letter informing the complainant. */

const interimPending = c => c.interim && c.interim.status === 'pending';
const interimSent = c => c.interim && c.interim.status === 'sent';
const LETTER_METHODS = ['Letter (post)', 'Letter (hand delivered)', 'Email', 'Collected in person', 'Viber / WhatsApp message', 'Phone call (followed by letter)'];
function canSendInterim(c) { return c.assignedTo === S.me.id || hasRole('admin_officer') || can('supervise'); }
function startInterim(outcome, commissionDate) { const due = addWorkDays(today(), cfg().sla.interimDays || 7); return { status: 'pending', outcome, commissionDate: commissionDate || today(), createdAt: nowISO(), due }; }

VIEWS.interim = () => {
  if (!can('viewAll') && !can('viewAssigned')) return noAccess();
  const all = can('assign') || hasRole('admin_officer') ? visibleCases() : vals(S.complaints).filter(c => c.assignedTo === S.me.id);
  const pend = all.filter(interimPending).sort((a, b) => String(a.interim.due).localeCompare(String(b.interim.due)));
  const sent = all.filter(interimSent).sort((a, b) => String(b.interim.sentAt).localeCompare(String(a.interim.sentAt)));
  const td = today(); const over = pend.filter(c => c.interim.due < td); const ids = l => l.map(c => c.id).join(',');
  const days = sent.map(c => workDays(c.interim.commissionDate, c.interim.sentAt)).filter(x => x >= 0);
  const tab = S.interimTab || 'pending';
  const al = alAll(all); const alOpen = al.filter(x => ['draft', 'sent'].includes(x.l.status)); const alDraft = al.filter(x => x.l.status === 'draft');
  const alLate = al.filter(x => (x.l.status === 'draft' && x.l.due < td) || (alReplyDue(x.l) && alReplyDue(x.l) < td));
  const alBtn = c => { const n = alettersOf(c).length; return `<button class="btn sm" data-act="aletterMenu" data-id="${esc(c.id)}" title="Letters for attention (ސަމާލު ސިޓީ) and letters of concern (ކަންބޮޑުވުން) to authorities">Authority letters${n ? ` <span class="cnt">${n}</span>` : ''}</button>`; };
  const row = c => { const i = c.interim; const od = i.status === 'pending' && i.due < td; const cp = cpOf(c);
    return `<tr class="${od ? 'overdue' : ''}"><td>${caseLink(c)}<div class="muted small">${esc(c.subcategory || c.category || '')}</div></td><td>${esc(c.confidential && !canSeeRestricted(c) ? 'Confidential' : cp.name || '—')}<div class="muted small">${esc([cp.phone, cp.email].filter(Boolean).join(' · '))}</div></td>
      <td>${i.outcome === 'lodge' ? pill('Lodged', 'ok') : pill('Not lodged', 'muted')}</td><td>${fmtD(i.commissionDate)}</td><td>${esc(nm(c.assignedTo))}</td>
      ${i.status === 'pending' ? `<td>${od ? pill('Overdue ' + fmtD(i.due), 'bad') : 'Due ' + fmtD(i.due)}</td><td class="r" style="white-space:nowrap">${alBtn(c)} ${canSendInterim(c) ? `<button class="btn sm" data-act="interimLetter" data-id="${esc(c.id)}">Prepare letter</button> <button class="btn sm primary" data-act="interimSent" data-id="${esc(c.id)}">Record as sent</button>` : ''}</td>`
      : `<td>${fmtD(i.sentAt)}<div class="muted small">${esc(i.method || '')}${i.ref ? ' · ' + esc(i.ref) : ''}</div></td><td>${esc(nm(i.by))}</td><td class="r">${alBtn(c)}</td>`}</tr>`; };
  const alSorted = (S.alFilter === 'all' ? al : alOpen).slice().sort((a, b) => { const k = x => x.l.status === 'draft' ? '0' + x.l.due : x.l.status === 'sent' ? '1' + (alReplyDue(x.l) || '9') : '2' + (9e15 - Date.parse(x.l.at || 0)); return k(a).localeCompare(k(b)); });
  return `<div class="page-head"><div><h1>${esc(t('interim'))}</h1><p>After the Commission decides, the complaint returns to its Registration Officer, who sends an interim letter telling the complainant whether the complaint was lodged or not lodged.</p></div></div>
  <div class="tiles">
    <button class="tile warn" data-act="drill" data-ids="${ids(pend)}" data-label="Interim letter to send" ${pend.length ? '' : 'disabled'}><div class="k">Letters to send</div><div class="v num">${pend.length}</div><div class="s">${pend.filter(c => c.interim.outcome === 'lodge').length} lodged · ${pend.filter(c => c.interim.outcome !== 'lodge').length} not lodged</div></button>
    <button class="tile bad" data-act="drill" data-ids="${ids(over)}" data-label="Interim letter overdue" ${over.length ? '' : 'disabled'}><div class="k">Overdue</div><div class="v num">${over.length}</div><div class="s">Target: ${cfg().sla.interimDays || 7} days after the Commission</div></button>
    <button class="tile ok" data-act="drill" data-ids="${ids(sent)}" data-label="Interim letter sent" ${sent.length ? '' : 'disabled'}><div class="k">Letters sent</div><div class="v num">${sent.length}</div><div class="s">All time</div></button>
    <button class="tile ${alLate.length ? 'bad' : 'info'}" data-act="interimTab" data-tab="letters"><div class="k">Letters to authorities</div><div class="v num">${alOpen.length}</div><div class="s">${alDraft.length} to send · ${alOpen.length - alDraft.length} awaiting reply${alLate.length ? ` · <b>${alLate.length} overdue</b>` : ''}</div></button>
    <div class="tile" style="cursor:default"><div class="k">Median working days to send</div><div class="v num">${fmtN(median(days), 1)}</div><div class="s">From the Commission decision</div></div>
  </div>
  <div class="tabs"><button class="${tab === 'pending' ? 'on' : ''}" data-act="interimTab" data-tab="pending">To send<span class="cnt">${pend.length}</span></button><button class="${tab === 'sent' ? 'on' : ''}" data-act="interimTab" data-tab="sent">Sent<span class="cnt">${sent.length}</span></button><button class="${tab === 'letters' ? 'on' : ''}" data-act="interimTab" data-tab="letters">Letters to authorities<span class="cnt">${alOpen.length}</span></button></div>
  ${tab === 'letters' ? `<div class="row" style="justify-content:space-between;margin-bottom:8px"><p class="small muted" style="margin:0;max-width:820px">Letters about a case to other authorities: <b>letters for attention</b> (ސަމާލު ސިޓީ) and <b>letters of concern</b> (ކަންބޮޑުވުން). A case can have several, one for each authority. Add them with <b>Authority letters</b> on a case in the To send or Sent tab.</p>
      <select aria-label="Letters shown" data-on="change:alFilter"><option value="open" ${S.alFilter !== 'all' ? 'selected' : ''}>To send or awaiting reply</option><option value="all" ${S.alFilter === 'all' ? 'selected' : ''}>All letters</option></select></div>
      ${alSorted.length ? aletterTable(alSorted) : '<div class="card empty">No letters to authorities here.</div>'}`
  : tab === 'pending' ? (pend.length ? `<div class="tbl-wrap"><table><thead><tr><th>Complaint</th><th>${esc(t('complainant'))}</th><th>Commission decision</th><th>Decided</th><th>${esc(t('officer'))}</th><th>${esc(t('due'))}</th><th></th></tr></thead><tbody>${pend.map(row).join('')}</tbody></table></div>` : '<div class="card empty">No interim letters waiting to be sent.</div>')
  : (sent.length ? `<div class="tbl-wrap"><table><thead><tr><th>Complaint</th><th>${esc(t('complainant'))}</th><th>Commission decision</th><th>Decided</th><th>${esc(t('officer'))}</th><th>Sent</th><th>Recorded by</th><th></th></tr></thead><tbody>${sent.slice(0, 200).map(row).join('')}</tbody></table></div>` : '<div class="card empty">No interim letters sent yet.</div>')}`;
};
ACT.interimTab = el => { S.interimTab = el.dataset.tab; render(); };
ON.alFilter = el => { S.alFilter = el.value; render(); };

function interimLetterText(c) {
  const cp = cpOf(c); const i = c.interim; const fd = finalDecision(c) || {}; const lodged = i.outcome === 'lodge';
  const addr = [cp.address, [cp.island, ATOLL[cp.atoll]].filter(Boolean).join(', ')].filter(Boolean).join('\n');
  return `${fmtD(today())}

${cp.name || 'Complainant'}
${addr}

Dear ${cp.name || 'Sir/Madam'},

Subject: Your complaint ${c.regNo}${c.cmsRef ? ' (' + c.cmsRef + ')' : ''}

Thank you for the complaint you submitted to the Human Rights Commission of the Maldives on ${fmtD(c.dateReceived)}.

${lodged
    ? `We wish to inform you that, following review by the Registration Panel, the Commission decided on ${fmtD(i.commissionDate)} to lodge your complaint. Your complaint has been forwarded to the Commission's Investigation Department, which will contact you about the next steps. Please keep your complaint reference number ${c.regNo} for any correspondence.`
    : `We wish to inform you that, following review by the Registration Panel, the Commission decided on ${fmtD(i.commissionDate)} not to lodge your complaint.${fd.reason ? `\n\nReason: ${fd.reason}.` : ''}${fd.commission && fd.commission.status === 'rejected' && fd.commission.reason ? `\n\n${fd.commission.reason}` : ''}\n\nIf you have new information about this matter, or if you would like advice on other bodies that may be able to assist you, please contact the Commission quoting your reference number ${c.regNo}.`}

If you have any questions, please contact the Registration Department of the Commission.

Yours sincerely,


${nm(c.assignedTo)}
Registration Officer
Registration Department
Human Rights Commission of the Maldives`;
}
ACT.interimLetter = el => {
  const c = S.complaints[el.dataset.id];
  modal({ title: `Interim letter — ${c.regNo}`, wide: true, body: `<p class="small muted" style="margin-top:0">A draft from the complaint record. Edit it as needed, then download it as a PDF or copy it into the Commission's letterhead.</p>
    <textarea id="letterText" rows="22" style="font-family:var(--font-body);line-height:1.55">${esc(interimLetterText(c))}</textarea>`,
    foot: `<button type="button" class="btn" data-act="copyLetter">Copy text</button><button type="button" class="btn primary" data-act="letterPdf" data-id="${esc(c.id)}">Download PDF</button>` });
};
ACT.copyLetter = async () => { try { await navigator.clipboard.writeText($('#letterText').value); toast('Letter copied'); } catch (e) { toast('Copy was blocked; select the text instead.', 'error'); } };
ACT.letterPdf = el => {
  const c = S.complaints[el.dataset.id]; if (!window.jspdf) { toast('The PDF library did not load.', 'error'); return; }
  patchPdfLib(); const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' }); const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('Human Rights Commission of the Maldives', W / 2, 56, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(90); doc.text('Registration Department', W / 2, 71, { align: 'center' }); doc.setTextColor(20);
  doc.setDrawColor(150); doc.line(56, 82, W - 56, 82); doc.setFontSize(10.5);
  let y = 110; doc.splitTextToSize($('#letterText').value, W - 112).forEach(line => { if (y > H - 60) { doc.addPage(); y = 60; } doc.text(line, 56, y); y += 15; });
  saveFile(`Interim-letter-${c.regNo}.pdf`, doc.output('blob')); logA('interim.letter_pdf', c.id, c.regNo);
};
ACT.interimSent = el => {
  const c = S.complaints[el.dataset.id];
  modal({ title: `Record interim letter sent — ${c.regNo}`, body: `<div class="form">
    ${fld('Date sent', inp('sentAt', today(), { type: 'date', req: 'the date', attrs: `max="${today()}"` }), { req: true, id: 'f_sentAt' })}
    ${fld('How it was sent', sel('method', LETTER_METHODS, 'Letter (post)', { blank: false }), { id: 'f_method' })}
    ${fld('Letter reference no.', inp('ref', '', { ph: 'e.g. HRCM/REG/2026/112' }), { id: 'f_ref' })}
    ${fld('Copy of the letter (optional)', fileInp('files', false), { full: true, id: 'f_files' })}
    ${fld('Note', txt('note', '', { rows: 2 }), { full: true, id: 'f_note' })}</div>`, submit: 'Record as sent', onSubmit: async (o, form) => {
    const up = await uploadFiles(form.querySelector('#f_files').files); const docs = {}; const at = nowISO();
    up.forEach(f => { docs[nid('d')] = { ...f, title: `Interim letter — ${c.regNo}`, type: 'Outgoing correspondence', version: 1, author: S.me.id, source: 'HRCM', date: o.sentAt, restricted: false, at }; });
    const lodged = c.interim.outcome === 'lodge';
    await updC(c.id, { interim: { status: 'sent', sentAt: o.sentAt, method: o.method, ref: o.ref || '', note: o.note || '', by: S.me.id, at }, docs,
      corr: { [nid('co')]: { dir: 'out', date: o.sentAt, party: cpOf(c).name || 'Complainant', method: o.method, subject: `Interim letter: complaint ${lodged ? 'lodged' : 'not lodged'}`, notes: [o.ref, o.note].filter(Boolean).join(' · '), by: S.me.id, at } },
      nextAction: lodged ? 'Investigation Department is handling the complaint' : 'Complainant informed — complaint not lodged', nextActionDue: null },
      { note: `Interim letter sent to the complainant (${o.method}${o.ref ? ', ' + o.ref : ''})`, action: 'interim.sent' });
    toast('Interim letter recorded');
  } });
};
