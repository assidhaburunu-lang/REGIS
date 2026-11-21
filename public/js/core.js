'use strict';
/* FREMYS core: state, constants, i18n, helpers, data access, permissions, audit, notifications, UI primitives. */

const S = {
  db: null, user: null, dl: null, assets: null,
  me: { id: null, name: '', avatarUrl: '', isOwner: false, canEdit: false },
  staff: {}, accessReq: {}, complaints: {}, complainants: {}, victims: {}, meetings: {}, cfg: null, notif: {}, prefs: {},
  names: {}, namesPending: new Set(),
  loaded: { complaints: false, staff: false, meetings: false, cfg: false },
  status: 'loading', readOnly: false,
  route: { view: 'dashboard', arg: null },
  lang: 'en', filter: {}, caseTab: 'overview', formLock: false,
};

/* ---------- Constants ---------- */
const ROLES = {
  admin_officer: 'Administrative Officer',
  reg_officer: 'Registration Officer',
  director: 'Director',
  dg: 'Director General',
  panel: 'Registration Panel member',
  support: 'Administrative/support officer',
  investigation: 'Investigation Department user',
  sysadmin: 'System Administrator',
  management: 'Management/reporting user',
};
const PERMS = {
  register: ['admin_officer', 'sysadmin'],
  editCore: ['admin_officer', 'sysadmin', 'dg', 'director'],
  viewAll: ['admin_officer', 'director', 'dg', 'support', 'sysadmin', 'panel'],
  viewAssigned: ['reg_officer'],
  assign: ['dg', 'director', 'sysadmin', 'admin_officer'],
  holidays: ['sysadmin'],
  dutySchedule: ['dg', 'director', 'sysadmin'],
  mgmtComment: ['dg', 'director'],
  review: ['reg_officer', 'dg', 'director'],
  infoReq: ['reg_officer', 'dg', 'director', 'admin_officer'],
  legal: ['reg_officer', 'dg', 'director'],
  legalComment: ['reg_officer', 'dg', 'director', 'panel'],
  panelManage: ['support', 'dg', 'director', 'sysadmin'],
  approveAgenda: ['dg', 'director'],
  decide: ['panel', 'dg', 'director', 'support'],
  approveDecision: ['dg', 'director'],
  commission: ['dg', 'director'],
  referralManage: ['support', 'dg', 'director'],
  investigation: ['investigation'],
  docs: ['admin_officer', 'reg_officer', 'dg', 'director', 'support'],
  restrictedDocs: ['dg', 'director', 'panel'],
  setStage: ['dg', 'director', 'sysadmin'],
  stats: ['management', 'dg', 'director', 'sysadmin', 'admin_officer', 'support', 'reg_officer', 'panel'],
  admin: ['sysadmin'],
  supervise: ['dg', 'director'],
};
const STAGES = [
  { k: 'registered', en: 'Awaiting assignment', dv: 'ހަވާލުކުރަން ބާކީ', tone: 'info' },
  { k: 'prelim_review', en: 'Preliminary review', dv: 'ފުރަތަމަ މުރާޖަޢާ', tone: '' },
  { k: 'further_work', en: 'Returned for clarification', dv: 'ވުޒާހަތަށް އަނބުރާ ފޮނުވިފައި', tone: 'warn' },
  { k: 'ready_panel', en: 'Ready for panel', dv: 'ޕެނަލަށް ތައްޔާރު', tone: 'ok' },
  { k: 'on_agenda', en: 'On panel agenda', dv: 'ޕެނަލް އެޖެންޑާގައި', tone: '' },
  { k: 'commission', en: 'Awaiting Commission decision', dv: 'ކޮމިޝަނުގެ ނިންމުމަށް', tone: 'info' },
  { k: 'further_investigation', en: 'Further investigation (earlier procedure)', dv: 'އިތުރު ތަޙުޤީޤު', tone: 'warn' },
  { k: 'referred', en: 'Lodged — with Investigation', dv: 'ބަލައިގަނެ ތަޙުޤީޤަށް ފޮނުވިފައި', tone: 'info' },
  { k: 'next_step', en: 'Ready for next step (earlier procedure)', dv: 'ދެން އޮތް ފިޔަވަޅަށް', tone: 'ok' },
  { k: 'closed', en: 'Not lodged', dv: 'ބަލައި ނުގަނެވޭ', tone: 'muted' },
];
const STAGE = Object.fromEntries(STAGES.map(s => [s.k, s]));
const DONE_STAGES = ['referred', 'next_step', 'closed'];
const NOT_LODGED_REASONS = ['Outside the Commission\'s mandate', 'Insufficient information after clarification', 'Complaint withdrawn by the complainant', 'Matter already before a court', 'Resolved between the parties', 'Duplicate of another complaint', 'Other'];
const LEGACY_OUTCOMES = { further_info: 'Further information required', refer_investigation: 'Refer to Investigation Department', further_investigation: 'Further investigation required', next_step: 'Ready for the next authorized step', other: 'Other outcome' };
const ATOLLS = [['HA', 'Haa Alif'], ['HDh', 'Haa Dhaalu'], ['Sh', 'Shaviyani'], ['N', 'Noonu'], ['R', 'Raa'], ['B', 'Baa'], ['Lh', 'Lhaviyani'], ['K', 'Kaafu'], ['MLE', 'Malé City'], ['AA', 'Alif Alif'], ['ADh', 'Alif Dhaal'], ['V', 'Vaavu'], ['M', 'Meemu'], ['F', 'Faafu'], ['Dh', 'Dhaalu'], ['Th', 'Thaa'], ['L', 'Laamu'], ['GA', 'Gaafu Alif'], ['GDh', 'Gaafu Dhaalu'], ['Gn', 'Gnaviyani (Fuvahmulah)'], ['S', 'Seenu (Addu City)'], ['ABR', 'Abroad / not applicable']];
const ATOLL = Object.fromEntries(ATOLLS);
const REF_PENDING = ['pending_commission', 'withdrawn', 'draft'];
const REQ_STATUS = { pending: ['Pending', 'warn'], partial: ['Partially received', 'info'], received: ['Received', 'ok'], closed: ['Closed', 'muted'] };
const REF_STATUS = { pending_commission: ['Awaiting Commission approval', 'muted'], withdrawn: ['Withdrawn — Commission decision', 'muted'], draft: ['Draft — not sent', 'muted'], sent: ['Pending acknowledgement', 'warn'], acknowledged: ['Acknowledged', 'info'], in_progress: ['In progress', 'info'], responded: ['Responded', 'ok'] };
const MEET_STATUS = { planned: ['Planned', 'info'], held: ['Held', 'ok'], postponed: ['Postponed', 'warn'], cancelled: ['Cancelled', 'muted'] };
const DOC_TYPES = ['Original complaint form', 'Supporting evidence', 'Management comments', 'Request for additional information', 'Response from relevant party', 'Legal and procedural review notes', 'Panel agenda and case pack', 'Panel decision record', 'Investigation referral / response', 'Outgoing correspondence', 'Other'];
const OK_UPLOAD = /^(image\/|application\/pdf|text\/plain|text\/csv|text\/markdown|application\/json)/;

const DEFAULT_CFG = {
  regPrefix: 'REG',
  panelIntervalDays: 14,
  categories: ['Treatment in detention', 'Right to a fair trial and due process', 'Labour rights', 'Migrant workers', 'Rights of the child', 'Rights of persons with disabilities', 'Right to health', 'Right to education', 'Social protection and housing', 'Discrimination', 'Freedom of expression and assembly', 'Gender-based violence', 'Property and land', 'Other'],
  channels: ['Walk-in', 'Letter', 'Email', 'Phone', 'Online form', 'Referral from another agency', 'Monitoring visit'],
  outcomes: [
    { k: 'lodge', label: 'Lodge the complaint — forward to the Investigation Department once the Commission approves', short: 'Lodged', stage: 'commission', finalStage: 'referred', referral: true, commission: true },
    { k: 'not_lodge', label: 'Do not lodge the complaint — final once the Commission approves', short: 'Not lodged', stage: 'commission', finalStage: 'closed', commission: true },
    { k: 'return_officer', label: 'Return to the Registration Officer for clarification, then agenda again', short: 'Returned for clarification', stage: 'further_work', action: true },
    { k: 'deferred', label: 'Not considered — defer to the next meeting', short: 'Deferred', stage: 'ready_panel' },
  ],
  readiness: { officerReview: true, noOpenRequests: true },
  dupRules: { nid: true, phone: true, cmsRef: true, nameRespondent: true, fuzzyName: true },
  sla: { assignDays: 3, reviewDays: 21, requestDays: 14, actionDays: 14, interimDays: 7, inactiveDays: 30 },
  idleMinutes: 20,
  laws: [
    { id: 'constitution', title: 'Constitution of the Republic of Maldives', ref: '2008', type: 'Law', version: 'As amended' },
    { id: 'hrc-act', title: 'Human Rights Commission Act', ref: 'Law No. 6/2006', type: 'Law', version: 'As amended' },
    { id: 'employment', title: 'Employment Act', ref: 'Law No. 2/2008', type: 'Law', version: 'As amended' },
    { id: 'child-rights', title: 'Child Rights Protection Act', ref: 'Law No. 19/2019', type: 'Law', version: '' },
    { id: 'disability', title: 'Disability Act', ref: 'Law No. 8/2010', type: 'Law', version: '' },
    { id: 'anti-torture', title: 'Anti-Torture Act', ref: 'Law No. 13/2013', type: 'Law', version: '' },
    { id: 'prison-parole', title: 'Prison and Parole Act', ref: 'Law No. 14/2013', type: 'Law', version: '' },
    { id: 'domestic-violence', title: 'Domestic Violence Prevention Act', ref: 'Law No. 3/2012', type: 'Law', version: '' },
    { id: 'gender-equality', title: 'Gender Equality Act', ref: 'Law No. 18/2016', type: 'Law', version: '' },
    { id: 'assembly', title: 'Freedom of Peaceful Assembly Act', ref: 'Law No. 1/2013', type: 'Law', version: '' },
    { id: 'proc-registration', title: 'Internal procedure: Registration Process', ref: 'Registration Department', type: 'Internal procedure', version: '' },
  ],
};
function cfg() { const c = S.cfg || {}; const o = { ...DEFAULT_CFG, ...c }; o.readiness = { ...DEFAULT_CFG.readiness, ...(c.readiness || {}) }; o.dupRules = { ...DEFAULT_CFG.dupRules, ...(c.dupRules || {}) }; o.sla = { ...DEFAULT_CFG.sla, ...(c.sla || {}) }; o.outcomes = DEFAULT_CFG.outcomes; o.categories = catIndex().cats.map(x => x.name); return o; }

/* ---------- i18n (Dhivehi strings are a working draft for staff review) ---------- */
const T = {
  tagline: ['Complaint Registration Application', 'ޝަކުވާ ރަޖިސްޓްރީކުރާ ނިޒާމު'],
  nav_work: ['Work', 'މަސައްކަތް'], nav_panel: ['Panel', 'ޕެނަލް'], nav_ref: ['Reference', 'ރިފަރެންސް'], briefing: ['Daily Briefing', 'ޑެއިލީ ބްރީފިންގ'], assignation: ['Case Assignation', 'ކޭސް ހަވާލުކުރުން'], leave: ['Staff leave calendar', 'މުވައްޒަފުންގެ ޗުއްޓީގެ ކަލަންޑަރު'], panelbrief: ['Panel Briefing', 'ޕެނަލް ބްރީފިންގ'], catref: ['Classification Catalogue', 'ގިންތިކުރުމުގެ ކެޓަލޮގު'], catalogue: ['Classification Catalogue', 'ގިންތިކުރުމުގެ ކެޓަލޮގު'], nav_reports: ['Reports', 'ރިޕޯޓް'], nav_system: ['System', 'ސިސްޓަމް'],
  dashboard: ['Overview', 'ޖުމްލަ ޚުލާޞާ'], register: ['Complaint register', 'ޝަކުވާތަކުގެ ރަޖިސްޓަރީ'], new: ['New registration', 'އާ ރަޖިސްޓްރޭޝަން'],
  assign: ['Assignment & workload', 'ހަވާލުކުރުމާއި މަސައްކަތު ބުރަ'], requests: ['Information requests', 'މަޢުލޫމާތަށް އެދުންތައް'], actions: ['Follow-up actions', 'ފޮލޯއަޕް ފިޔަވަޅުތައް'],
  interim: ['Interim phase', 'ދެމެދު މަރުޙަލާ'],
  duty: ['1424 duty', '1424 ޑިއުޓީ'],
  commission: ['Commission decisions', 'ކޮމިޝަނުގެ ނިންމުންތައް'],
  panel: ['Panel meetings', 'ޕެނަލް ބައްދަލުވުންތައް'], referrals: ['Investigation referrals', 'ތަޙުޤީޤަށް ފޮނުވުންތައް'], laws: ['Legal library', 'ޤާނޫނީ ލައިބްރަރީ'],
  users: ['Users', 'ބޭނުންކުރާ ފަރާތްތައް'], people: ['Complainants & victims', 'ޝަކުވާ ހުށަހެޅި ފަރާތްތަކާއި ގެއްލުން ލިބުނު ފަރާތްތައް'],
  performance: ['Staff performance', 'މުވައްޒަފުންގެ މަސައްކަތު ފެންވަރު'],
  stats: ['Statistics & reports', 'ތަފާސް ހިސާބާއި ރިޕޯޓް'], admin: ['Administration', 'އިދާރީ'], notifications: ['Notifications', 'ނޯޓިފިކޭޝަން'],
  search: ['Search', 'ހޯދާ'], save: ['Save', 'ރައްކާކުރޭ'], cancel: ['Cancel', 'ކެންސަލް'], export: ['Export', 'އެކްސްޕޯޓް'],
  reg_no: ['Registration no.', 'ރަޖިސްޓްރީ ނަންބަރު'], date_received: ['Date received', 'ލިބުނު ތާރީޚް'], complainant: ['Complainant', 'ޝަކުވާ ހުށަހެޅި ފަރާތް'],
  victim: ['Victim / affected person', 'ގެއްލުން ލިބުނު ފަރާތް'], respondent: ['Respondent / relevant party', 'ޝަކުވާ ހުށަހެޅުނު ފަރާތް'], summary: ['Complaint summary', 'ޝަކުވާގެ ޚުލާޞާ'],
  category: ['Category', 'ބާވަތް'], atoll: ['Atoll', 'އަތޮޅު'], island: ['Island', 'ރަށް'], officer: ['Registration Officer', 'ރަޖިސްޓްރޭޝަން އޮފިސަރ'],
  stage: ['Stage', 'މަރުޙަލާ'], last_action: ['Last action', 'ފަހު ފިޔަވަޅު'], next_action: ['Next action', 'ދެން އޮތް ފިޔަވަޅު'], due: ['Due', 'މުއްދަތު'],
  meeting: ['Panel meeting', 'ޕެނަލް ބައްދަލުވުން'], total: ['Total complaints', 'ޖުމްލަ ޝަކުވާ'], overdue: ['Overdue', 'މުއްދަތު ހަމަވެފައި'],
  my_tasks: ['My pending tasks', 'އަހަރެންގެ ބާކީ މަސައްކަތް'], recent: ['Recent updates', 'ފަހުގެ ބަދަލުތައް'], documents: ['Documents', 'ލިޔެކިޔުން'],
  all: ['All', 'ހުރިހާ'], from: ['From', 'ފެށޭ'], to: ['To', 'ނިމޭ'], status: ['Status', 'ހާލަތު'], language: ['ދިވެހި', 'English'],
};
function t(k) { const e = T[k]; if (!e) return k; return S.lang === 'dv' ? (e[1] || e[0]) : e[0]; }
function stageLabel(k) { const s = STAGE[k]; if (!s) return k || '—'; return S.lang === 'dv' ? s.dv : s.en; }

/* ---------- Helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const nowISO = () => new Date().toISOString();
const pad2 = n => String(n).padStart(2, '0');
const localDate = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const today = () => localDate(new Date());
const addDays = (iso, n) => { const d = new Date((iso || today()).slice(0, 10) + 'T12:00:00'); d.setDate(d.getDate() + n); return localDate(d); };
const dayDiff = (a, b) => (new Date(String(b).slice(0, 10) + 'T12:00:00') - new Date(String(a).slice(0, 10) + 'T12:00:00')) / 864e5;
/* Working days: Friday and Saturday (the Maldivian weekend) and public holidays (Administration → Public holidays) are not counted. */
const WEEKEND = [5, 6];
const wday = d => new Date(String(d).slice(0, 10) + 'T12:00:00').getDay();
const holidayOf = d => (S.holidays || {})[String(d).slice(0, 10)] || null;
const isWorkDay = d => !WEEKEND.includes(wday(d)) && !holidayOf(d);
// The date n working days after iso (n = 0 gives the same date).
function addWorkDays(iso, n) { let d = String(iso || today()).slice(0, 10); let k = 0; n = Math.max(0, Math.round(Number(n) || 0)); while (k < n) { d = addDays(d, 1); if (isWorkDay(d)) k++; } return d; }
// Working days elapsed from a to b: counts the days after a up to and including b.
function workDays(a, b) {
  a = String(a).slice(0, 10); b = String(b).slice(0, 10); if (b < a) return -workDays(b, a);
  const n = dayDiff(a, b); const full = Math.floor(n / 7); let w = full * (7 - WEEKEND.length); const s = wday(a);
  for (let i = 1; i <= n % 7; i++) if (!WEEKEND.includes((s + i) % 7)) w++;
  for (const h of Object.keys(S.holidays || {})) if (h > a && h <= b && !WEEKEND.includes(wday(h))) w--;
  return w;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// In the Dhivehi (right-to-left) layout a date such as "20 Nov 2026" is wrapped in invisible Unicode isolate marks so it
// keeps its left-to-right order ("Nov 2026 20" otherwise). The marks are removed again from Excel, PDF and Word output.
const ltrIso = s => S.lang === 'dv' ? '\u2066' + s + '\u2069' : s;
const stripBidi = s => typeof s === 'string' ? s.replace(/[\u2066-\u2069]/g, '') : Array.isArray(s) ? s.map(stripBidi) : s;
function fmtD(iso) { if (!iso) return '—'; const s = String(iso); const [y, m, d] = s.slice(0, 10).split('-'); if (!d) return esc(s); return ltrIso(`${d} ${MONTHS[+m - 1]} ${y}`); }
function fmtDT(iso) { if (!iso) return '—'; const d = new Date(iso); if (isNaN(d)) return esc(iso); return ltrIso(`${pad2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`); }
function patchPdfLib() { const j = window.jspdf; if (!j || j._fremysBidi) return; const API = j.jsPDF.API; for (const f of ['text', 'splitTextToSize', 'getTextWidth']) { const o = API[f]; if (o) API[f] = function (t, ...a) { return o.call(this, stripBidi(t), ...a); }; } j._fremysBidi = true; }
window.addEventListener('load', patchPdfLib);
const vals = o => Object.values(o || {});
const entries = o => Object.entries(o || {}).map(([id, v]) => ({ id, ...v }));
const byAt = (a, b) => String(b.at || '').localeCompare(String(a.at || ''));
const pill = (txt, tone = '') => `<span class="pill ${tone}">${esc(txt)}</span>`;
const stagePill = k => pill(stageLabel(k), STAGE[k]?.tone || '');
const median = arr => { if (!arr.length) return null; const a = [...arr].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const mean = arr => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
const fmtN = (n, dp = 0) => n == null || isNaN(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: dp });
const normName = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
const digits = s => String(s || '').replace(/\D/g, '');
function lev(a, b) { if (a === b) return 0; const m = a.length, n = b.length; if (!m || !n) return m || n; let prev = Array.from({ length: n + 1 }, (_, i) => i); for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return prev[n]; }

/* ---------- Identity / names ---------- */
function myRoles() { const s = S.staff[S.me.id]; return s && s.active !== false ? (s.roles || []) : []; }
function can(p) { const r = myRoles(); return (PERMS[p] || []).some(x => r.includes(x)); }
function hasRole(r) { return myRoles().includes(r); }
function nm(id) {
  if (!id) return '—';
  if (S.staff[id]?.fullName) return S.staff[id].fullName;
  if (id === S.me.id) return S.me.name || 'You';
  const n = S.names[id];
  if (n) return n;
  if (!S.namesPending.has(id)) resolveNames([id]);
  return S.staff[id]?.label || 'Unnamed user';
}
let nameTimer = null; const nameQueue = new Set();
function resolveNames(ids) {
  ids.forEach(i => { if (i && !S.names[i] && !S.namesPending.has(i)) { nameQueue.add(i); S.namesPending.add(i); } });
  if (!S.user || !nameQueue.size || nameTimer) return;
  nameTimer = setTimeout(async () => {
    const batch = [...nameQueue]; nameQueue.clear(); nameTimer = null;
    try {
      const ps = await S.user.profiles(batch); let changed = false;
      for (const id of batch) { const n = ps[id]?.name || ''; if (n) { S.names[id] = n; changed = true; } }
      if (changed) scheduleRender();
    } catch (e) { /* profiles never rejects by contract */ }
  }, 30);
}
function staffIds(role, activeOnly = true) { return Object.entries(S.staff).filter(([id, s]) => (!activeOnly || s.active !== false) && (!role || (s.roles || []).includes(role))).map(([id]) => id); }
function staffOptions(role, sel, blank = 'Select…') { const ids = staffIds(role); return `<option value="">${esc(blank)}</option>` + ids.map(id => `<option value="${esc(id)}" ${id === sel ? 'selected' : ''}>${esc(nm(id))}</option>`).join(''); }

/* ---------- Complaint derived info ---------- */
const isDone = c => DONE_STAGES.includes(c.stage);
const openReqs = c => entries(c.requests).filter(r => r.status === 'pending' || r.status === 'partial');
const openActions = c => entries(c.actions).filter(a => a.status !== 'done');
const liveReviews = (c, kind) => entries(c.reviews).filter(r => r.kind === kind && !supersededIds(c).has(r.id));
function supersededIds(c) { return new Set(vals(c.reviews).map(r => r.supersedes).filter(Boolean)); }
const hasMgmt = c => liveReviews(c, 'mgmt').length > 0;
const hasOfficerReview = c => liveReviews(c, 'officer').length > 0;
function overdueItems(c) {
  const td = today(); const out = [];
  if (!isDone(c) && c.nextActionDue && c.nextActionDue < td) out.push({ kind: 'next', text: c.nextAction || 'Next action', due: c.nextActionDue });
  openReqs(c).forEach(r => { if (r.due && r.due < td) out.push({ kind: 'request', text: 'Information request to ' + (r.to || '—'), due: r.due, id: r.id }); });
  openActions(c).forEach(a => { if (a.due && a.due < td) out.push({ kind: 'action', text: a.text, due: a.due, id: a.id }); });
  if (c.interim && c.interim.status === 'pending' && c.interim.due < td) out.push({ kind: 'interim', text: 'Response letter to the complainant', due: c.interim.due });
  return out;
}
const isOverdue = c => overdueItems(c).length > 0;
/* A panel decision that needs the Commission takes effect only once the Commission decides; if it rejects, its preferred decision applies. */
const effOutcome = d => d.commission && d.commission.status === 'rejected' ? d.commission.preferred : d.outcome;
const isDecided = d => !d.needsCommission || !!d.commission;
const decidedAt = d => (d.commission && d.commission.at) || d.at;
function finalDecision(c) { const d = entries(c.decisions).filter(x => isDecided(x) && ['lodge', 'not_lodge', 'refer_investigation'].includes(effOutcome(x))).sort((a, b) => String(decidedAt(b)).localeCompare(String(decidedAt(a))))[0]; return d ? { ...d, outcome: effOutcome(d), panelOutcome: d.outcome, at: decidedAt(d) } : null; }
const pendingCommission = c => entries(c.decisions).filter(d => d.needsCommission && !d.commission);
const isLodged = c => { const d = finalDecision(c); return !!d && d.outcome !== 'not_lodge'; };
const isNotLodged = c => finalDecision(c)?.outcome === 'not_lodge';
const returnCount = c => vals(c.decisions).filter(d => d.outcome === 'return_officer').length;
const pctOf = (a, b) => b ? Math.round(a / b * 100) : null;
function isInactive(c) { return !isDone(c) && c.lastActionAt && workDays(c.lastActionAt, today()) > cfg().sla.inactiveDays; }
function displayName(c) { if (c.confidential) return 'Confidential'; return cpOf(c).name || '—'; }
function readiness(c) {
  const r = cfg().readiness; const items = [];
  items.push({ ok: !!c.assignedTo, text: 'Registration Officer assigned' });
  if (r.officerReview) items.push({ ok: hasOfficerReview(c), text: "Officer's preliminary review recorded" });
  if (r.noOpenRequests) items.push({ ok: openReqs(c).length === 0, text: 'No outstanding information requests' });
  return { items, ok: items.every(i => i.ok) };
}
function canSeeCase(c) {
  if (!c) return false;
  if (can('viewAll')) return true;
  if (can('viewAssigned') && (c.assignedTo === S.me.id || vals(c.actions).some(a => a.owner === S.me.id && a.status !== 'done'))) return true;
  return false;
}
function visibleCases() { return vals(S.complaints).filter(canSeeCase); }
function stageEnteredAt(c, stages) { const h = entries(c.history).filter(x => stages.includes(x.stage)).sort((a, b) => String(a.at).localeCompare(String(b.at))); return h[0]?.at || null; }
function firstDecisionAt(c) { const d = vals(c.decisions).map(x => x.at).sort(); return d[0] || null; }
function completedAt(c) { if (!isDone(c)) return null; const h = entries(c.history).filter(x => DONE_STAGES.includes(x.stage)).sort((a, b) => String(b.at).localeCompare(String(a.at))); return h[0]?.at || c.lastActionAt || null; }

/* ---------- Errors / toasts ---------- */
function errText(e) {
  const code = e && e.code;
  if (code === 'invalid_argument') return 'This change was refused. You may not have permission for it, or the data was invalid.';
  if (code === 'quota_exceeded') return 'Storage is full: ' + (e.message || '') + ' Ask the System Administrator to archive old records.';
  if (code === 'resource_exhausted') return 'Too many requests at once. Wait a moment and try again.';
  if (code === 'revoked') return 'Your access to FREMYS changed while the page was open.';
  if (code === 'unavailable') return 'FREMYS could not reach the database. Check your connection and try again.';
  return (e && e.message) || String(e);
}
function toast(msg, kind = '') {
  const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg;
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), kind === 'error' ? 7000 : 3500);
}

/* ---------- Data writes ---------- */
const queues = {};
function q(path, fn) { const p = (queues[path] || Promise.resolve()).catch(() => {}).then(fn); queues[path] = p; return p; }
async function retryOnce(fn) { try { return await fn(); } catch (e) { if (e && e.code === 'unavailable') { await new Promise(r => setTimeout(r, 400 + Math.random() * 600)); return fn(); } throw e; } }
function guardWrite() { if (!S.db) throw new Error('The database is not available in this view.'); if (S.readOnly) throw new Error('You have read-only access to FREMYS.'); }

/** Merge-update a complaint. Maps merge recursively, so concurrent additions of sub-records do not overwrite each other. */
async function updC(cid, patch, hist) {
  guardWrite();
  const body = { ...patch, lastActionAt: nowISO(), lastActionBy: S.me.id };
  if (hist) { const hid = nid('h'); body.history = { ...(patch.history || {}), [hid]: { at: nowISO(), by: S.me.id, stage: hist.stage || null, note: hist.note || '' } }; }
  await q('complaints/' + cid, () => retryOnce(() => S.db.doc('complaints/' + cid).update(body)));
  if (hist) logA(hist.action || 'case.update', cid, hist.note);
}
async function setDoc(path, data) { guardWrite(); return q(path, () => retryOnce(() => S.db.doc(path).set(data))); }
async function updDoc(path, data) { guardWrite(); return q(path, () => retryOnce(() => S.db.doc(path).update(data))); }
async function delDoc(path) { guardWrite(); return q(path, () => retryOnce(() => S.db.doc(path).delete())); }

/* Audit trail: audit/<uid>/log/<YYYY-MM>. Each person writes only their own subtree and nobody else can alter it. */
const auditKnown = {};
let auditChain = Promise.resolve();
function logA(action, cid, detail) {
  if (!S.db || !S.me.cid || S.readOnly) return;
  const month = nowISO().slice(0, 7); const path = `audit/${S.me.cid}/log/${month}`; const id = nid('a');
  const entry = { at: nowISO(), acct: S.me.id || null, action, cid: cid || null, reg: cid && S.complaints[cid]?.regNo || null, detail: String(detail || '').slice(0, 400) };
  auditChain = auditChain.then(async () => {
    try {
      const ref = S.db.doc(path);
      if (!auditKnown[path]) { const snap = await ref.get(); auditKnown[path] = snap.exists; }
      if (auditKnown[path]) await ref.update({ entries: { [id]: entry } });
      else { await ref.set({ uid: S.me.cid, month, entries: { [id]: entry } }); auditKnown[path] = true; }
    } catch (e) { console.warn('audit write failed', e); }
  });
}

/* Notifications: notif/<uid> { items: {id: {...}} }. */
async function notify(toIds, text, cid) {
  if (!S.db) return;
  const uniq = [...new Set((Array.isArray(toIds) ? toIds : [toIds]).filter(x => x && x !== S.me.id))];
  for (const to of uniq) {
    const id = nid('n');
    q('notif/' + to, () => S.db.doc('notif/' + to).update({ items: { [id]: { at: nowISO(), by: S.me.id, text, cid: cid || null, read: false } } })).catch(() => {});
  }
}
function supervisors() { return [...new Set([...staffIds('dg'), ...staffIds('director')])]; }

/* Registration numbers: REG-YYYY-NNNN using a short lease on the yearly counter so two officers never get the same number. */
async function nextRegNo() {
  guardWrite();
  const year = new Date().getFullYear(); const prefix = (cfg().regPrefix || 'REG').replace(/[^A-Za-z0-9-]/g, '');
  const ref = S.db.doc(`counters/reg-${year}`);
  for (let attempt = 0; attempt < 12; attempt++) {
    const lease = await ref.acquire({ holder: S.me.id + ':' + nid(), ttlMs: 8000 });
    if (lease.acquired) {
      const snap = await ref.get(); let n = (snap.exists && snap.data().next) || 1;
      const taken = new Set(vals(S.complaints).map(c => c.regNo));
      let no; do { no = `${prefix}-${year}-${String(n).padStart(4, '0')}`; n++; } while (taken.has(no));
      await ref.set({ next: n, year, updatedAt: nowISO() });
      return no;
    }
    await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
  }
  throw new Error('Could not reserve a registration number. Another officer is registering at the same moment; try again.');
}

/* Files */
async function uploadFiles(files) {
  const list = Array.from(files || []); if (!list.length) return [];
  if (!S.assets) throw new Error('File upload is not available for your access level in this view.');
  const out = [];
  for (const f of list) {
    if (!OK_UPLOAD.test(f.type || '')) throw new Error(`"${f.name}" is not a supported type. Upload PDF, image or text files (scan Word documents to PDF first).`);
    if (f.size > 20 * 1024 * 1024) throw new Error(`"${f.name}" is larger than 20 MB.`);
    const r = await S.assets.upload(f);
    out.push({ assetId: r.id, url: r.url || ('/_blob/' + r.id), contentType: r.contentType || f.type, size: r.sizeBytes || f.size, title: f.name });
  }
  return out;
}

/* ---------- Exports ---------- */
async function saveFile(filename, data) {
  if (!S.dl) { toast('Downloads are not available in this view.', 'error'); return; }
  try { await S.dl.save({ filename, data }); logA('export', null, filename); }
  catch (e) { if (e && e.code === 'declined') return; toast(e.code === 'rate_limited' ? 'A download prompt is already open.' : 'Download failed: ' + errText(e), 'error'); }
}
function csvCell(v) { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function toCSV(rows) { return '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'); }
function exportCSV(filename, rows) { saveFile(filename, toCSV(rows)); }
function exportXLSX(filename, sheets) {
  if (!window.XLSX) { toast('The Excel library did not load. Use CSV instead.', 'error'); return; }
  const wb = XLSX.utils.book_new();
  sheets.forEach(s => { const ws = XLSX.utils.aoa_to_sheet(s.rows.map(r => r.map(stripBidi))); ws['!cols'] = (s.rows[0] || []).map((_, i) => ({ wch: Math.min(60, Math.max(10, ...s.rows.slice(0, 200).map(r => String(r[i] ?? '').length))) })); XLSX.utils.book_append_sheet(wb, ws, s.name.replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31)); });
  saveFile(filename, XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
}
function pdfDoc(title, subtitle, landscape = false) {
  if (!window.jspdf) { toast('The PDF library did not load.', 'error'); return null; }
  patchPdfLib(); const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(title, 40, 48);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(90);
  doc.text(subtitle || '', 40, 64); doc.text(`FREMYS — Complaint Registration Application · Generated ${fmtDT(nowISO())} by ${S.me.name || 'staff'}`, 40, 78);
  doc.setTextColor(20); doc._y = 96; return doc;
}
function pdfTable(doc, heading, head, body) {
  if (heading) { if (doc._y > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); doc._y = 48; } doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.text(heading, 40, doc._y); doc._y += 8; }
  doc.autoTable({ head: [head], body: body.length ? body : [head.map((_, i) => i ? '' : 'No records')], startY: doc._y, margin: { left: 40, right: 40 }, styles: { fontSize: 8.5, cellPadding: 4, overflow: 'linebreak' }, headStyles: { fillColor: [11, 100, 118] } });
  doc._y = doc.lastAutoTable.finalY + 22;
}
function pdfText(doc, heading, text) {
  const w = doc.internal.pageSize.getWidth() - 80; const ph = doc.internal.pageSize.getHeight();
  if (heading) { if (doc._y > ph - 80) { doc.addPage(); doc._y = 48; } doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.text(heading, 40, doc._y); doc._y += 15; }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
  doc.splitTextToSize(String(text || '—'), w).forEach(line => { if (doc._y > ph - 50) { doc.addPage(); doc._y = 48; } doc.text(line, 40, doc._y); doc._y += 12.5; });
  doc._y += 10;
}
function pdfSave(doc, filename) { saveFile(filename, doc.output('blob')); }

/* ---------- Modal ---------- */
let modalState = null;
function modal({ title, body, submit = 'Save', onSubmit, wide = false, danger = false, foot = '' }) {
  closeModal();
  const root = $('#modalRoot');
  root.innerHTML = `<div class="ov" data-act="ovClick"><form class="dlg ${wide ? 'wide' : ''}" id="dlgForm" novalidate>
    <div class="dlg-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-act="closeModal" aria-label="Close">✕</button></div>
    <div class="dlg-body">${body}</div>
    <div class="dlg-foot"><span class="err" id="dlgErr"></span>${foot}<button type="button" class="btn" data-act="closeModal">${esc(t('cancel'))}</button>${onSubmit ? `<button type="submit" class="btn ${danger ? 'danger' : 'primary'}" id="dlgOk">${esc(submit)}</button>` : ''}</div>
  </form></div>`;
  const form = $('#dlgForm');
  modalState = { onSubmit };
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (!onSubmit) return;
    const err = $('#dlgErr'); err.textContent = '';
    const missing = $$('[data-required]', form).find(el => !String(el.value || '').trim());
    if (missing) { err.textContent = 'Fill in ' + (missing.dataset.required || 'the required fields') + '.'; missing.focus(); return; }
    const btn = $('#dlgOk'); btn.disabled = true; const old = btn.textContent; btn.textContent = 'Saving…';
    try { const r = await onSubmit(formObj(form), form); if (r !== false) closeModal(); }
    catch (ex) { console.error(ex); err.textContent = errText(ex); }
    finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = old; } }
  });
  setTimeout(() => { const f = form.querySelector('input:not([type=hidden]):not([type=checkbox]),select,textarea'); f && f.focus(); }, 20);
  return form;
}
function closeModal() { $('#modalRoot').innerHTML = ''; modalState = null; }
function formObj(form) {
  const o = {};
  $$('[name]', form).forEach(el => {
    if (el.type === 'file') return;
    if (el.type === 'checkbox') { if (el.dataset.multi) { o[el.name] = o[el.name] || []; if (el.checked) o[el.name].push(el.value); } else o[el.name] = el.checked; }
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value.trim();
  });
  return o;
}
function confirmBox(title, text, okLabel, fn, danger = false) { modal({ title, body: `<p>${esc(text)}</p>`, submit: okLabel, danger, onSubmit: fn }); }

/* ---------- Form field builders ---------- */
function fld(label, inner, opts = {}) { return `<div class="f ${opts.full ? 'full' : ''}"><label for="${opts.id || ''}" class="${opts.req ? 'req' : ''}">${esc(label)}</label>${inner}${opts.hint ? `<span class="muted small">${esc(opts.hint)}</span>` : ''}</div>`; }
function inp(name, val = '', o = {}) { return `<input id="f_${name}" name="${name}" type="${o.type || 'text'}" value="${esc(val)}" ${o.req ? `data-required="${esc(o.req)}"` : ''} ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.attrs || ''}>`; }
function txt(name, val = '', o = {}) { return `<textarea id="f_${name}" name="${name}" ${o.req ? `data-required="${esc(o.req)}"` : ''} ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} rows="${o.rows || 3}">${esc(val)}</textarea>`; }
function sel(name, options, val = '', o = {}) { const opts = options.map(x => Array.isArray(x) ? x : [x, x]); return `<select id="f_${name}" name="${name}" ${o.req ? `data-required="${esc(o.req)}"` : ''}>${o.blank !== false ? `<option value="">${esc(o.blank || 'Select…')}</option>` : ''}${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`; }
function fileInp(name = 'files', multiple = true) { return `<input id="f_${name}" type="file" name="${name}" ${multiple ? 'multiple' : ''} accept="application/pdf,image/*,text/plain,text/csv,text/markdown,application/json">`; }

/* ---------- Render scheduling ---------- */
let renderQueued = false;
function scheduleRender() { if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; render(true); if (typeof maybeMigrate === 'function') maybeMigrate(); }); }
