'use strict';
/* Demo data: 100 fictional complaints over the last 12 months. Fictional people and generic respondents only; every record carries demo:true. */

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const DEMO_SCEN = [
  // [issue, secondary, summary, respondent, respondent type, groups, topics, victim {rel, kind}, migrant complainant]
  ['SI007', ['SI013'], 'Alleges he was arrested at night without being told the reason and held for 48 hours before being allowed to call his family or a lawyer.', 'A police station', 'Government institution', ['VG06-06'], ['CT08', 'CT05']],
  ['SI009', ['SI014'], 'Reports that her son has been held in pretrial detention for over 14 months while the trial has been postponed six times.', 'A remand centre', 'Government institution', ['VG06-01'], ['CT05', 'CT08'], { rel: 'son', kind: 'adult' }],
  ['SI048', ['SI065'], 'Says detainees in his cell block share one toilet among 20 people and are not given drinking water at night; requests a visit.', 'A detention facility', 'Government institution', ['VG06-02'], ['CT08']],
  ['SI043', ['SI047'], 'Alleges a detainee was beaten by officers during a cell search and was refused a medical examination afterwards.', 'A detention facility', 'Government institution', ['VG06-02'], ['CT08'], { rel: 'brother', kind: 'adult' }],
  ['SI065', ['SI048'], 'A detainee with diabetes says his insulin has been withheld for several days and requests to see a doctor.', 'A detention facility', 'Government institution', ['VG06-02', 'VG09-01'], ['CT08']],
  ['SI082', ['SI090'], 'Construction worker reports wages unpaid for three months and that the employer is keeping his passport.', 'A construction company', 'Private company', ['VG05-03', 'VG05-05'], ['CT04', 'CT07'], null, true],
  ['SI090', ['SI091'], 'Resort worker says the employer refuses to return his passport so he cannot change jobs or travel home for his mother’s funeral.', 'A resort operator', 'Private company', ['VG05-04'], ['CT04', 'CT07'], null, true],
  ['SI086', ['SI097'], 'Migrant workers report 14 people sleeping in one room with no ventilation, a broken toilet and no safe drinking water.', 'A construction company', 'Private company', ['VG05-03'], ['CT04'], null, true],
  ['SI083', ['SI082', 'SI090'], 'Domestic worker reports working 16 hours a day with no day off, wages withheld and not allowed to leave the house.', 'A private household', 'Individual', ['VG05-02', 'VG13-03'], ['CT07', 'CT02'], null, true],
  ['SI081', ['SI085'], 'Says she was dismissed from her job two weeks after informing her employer that she was pregnant.', 'A retail company', 'Private company', ['VG02-01', 'VG02-05'], ['CT01', 'CT04']],
  ['SI081', ['SI027'], 'Reports being dismissed after taking part in a peaceful protest outside the workplace about unpaid overtime.', 'A fishing company', 'Private company', [], ['CT04']],
  ['SI087', ['SI085'], 'Alleges repeated sexual harassment by a supervisor; her complaint to management was ignored and she was moved to night shifts.', 'A resort operator', 'Private company', ['VG02-05'], ['CT02', 'CT04']],
  ['SI089', ['SI082'], 'Security guards report 12-hour shifts seven days a week without overtime pay for the last year.', 'A security services company', 'Private company', [], ['CT04']],
  ['SI057', ['SI064'], 'Parent reports that a child with autism was refused admission to grade 1 because the school says it has no support staff.', 'A primary school', 'Government institution', ['VG01-07', 'VG03-07'], ['CT01'], { rel: 'son', kind: 'child' }],
  ['SI060', ['SI058'], 'Parent reports that her daughter has been bullied for months and the school has taken no action despite three written complaints.', 'A secondary school', 'Government institution', ['VG01-03', 'VG08-06'], ['CT03'], { rel: 'daughter', kind: 'child' }],
  ['SI061', [], 'Alleges a teacher hit several students with a ruler as punishment; one child has visible bruises.', 'A primary school', 'Government institution', ['VG01-03'], ['CT03'], { rel: 'son', kind: 'child' }],
  ['SI063', ['SI059'], 'Island council member complains that the island school has had no science teacher for a full academic year.', 'A school on the island', 'Government institution', ['VG14-03'], []],
  ['SI066', ['SI052'], 'Alleges a migrant worker was refused treatment at a health centre until his employer paid a deposit.', 'A regional health centre', 'Government institution', ['VG05-03'], ['CT01'], null, true],
  ['SI067', [], 'Family alleges that a misdiagnosis at the hospital delayed surgery and caused permanent harm to their father.', 'A regional hospital', 'Government institution', ['VG04-03'], [], { rel: 'father', kind: 'older' }],
  ['SI070', ['SI065'], 'Mother reports that no psychiatric care is available on the island and her son’s condition is worsening.', 'An island health centre', 'Government institution', ['VG09-02', 'VG14-02'], [], { rel: 'son', kind: 'adult' }],
  ['SI071', [], 'Reports that an emergency medical evacuation took nine hours to arrive for a pregnant woman with complications.', 'A health authority', 'Government institution', ['VG02-01', 'VG14-02'], [], { rel: 'wife', kind: 'adult' }],
  ['SI072', ['SI036'], 'Says his HIV status was disclosed by a health worker to his employer and he lost his job.', 'A health centre', 'Government institution', ['VG09-03'], ['CT01']],
  ['SI073', ['SI077'], 'Family of six says they were evicted by the council without notice and their belongings were removed.', 'A city council', 'Government institution', ['VG15-03', 'VG12-04'], [], null],
  ['SI076', [], 'Complains that a housing application was rejected without reasons after four years on the waiting list.', 'A housing authority', 'Government institution', ['VG15-01'], ['CT01']],
  ['SI078', ['SI075'], 'Reports that eleven family members live in a two-room flat with mould and leaking ceilings.', 'A housing authority', 'Government institution', ['VG07-01', 'VG15-03'], []],
  ['SI099', ['SI103'], 'Person with a visual disability says his disability allowance stopped five months ago without notice.', 'A social protection agency', 'Government institution', ['VG03-02', 'VG07-05'], []],
  ['SI102', [], 'Retired fisherman says his pension is too low to buy food and medicine and asks for a review.', 'A pension administration', 'Government institution', ['VG04-01', 'VG07-01'], []],
  ['SI105', ['SI096'], 'Single mother of three reports being refused assistance because she has no tenancy agreement.', 'A social protection agency', 'Government institution', ['VG15-01', 'VG02-02'], []],
  ['SI020', ['SI026'], 'Teacher reports being summoned and warned by his employer over a social media post criticising a policy.', 'A government ministry', 'Government institution', [], ['CT06']],
  ['SI023', [], 'Journalist reports receiving threats by phone after publishing an article about land allocation.', 'Unknown persons', 'Individual', [], ['CT06']],
  ['SI028', ['SI029'], 'Alleges that police used pepper spray to disperse a peaceful gathering of parents outside a school.', 'Police', 'Government institution', [], ['CT05']],
  ['SI036', ['SI039'], 'Reports that her personal medical details were shared in a public messaging group by a council employee.', 'A city council', 'Government institution', ['VG08-07'], ['CT06']],
  ['SI038', ['SI037'], 'Father says he has not been allowed to see his children for eight months despite a court order granting access.', 'A family protection authority', 'Government institution', ['VG15-03'], ['CT05'], { rel: 'children', kind: 'child' }],
  ['SI050', ['SI103'], 'Wheelchair user says the island council office and the court building have no ramp or accessible entrance.', 'An island council', 'Government institution', ['VG03-01'], ['CT01']],
  ['SI052', [], 'Alleges a Bangladeshi worker was refused service at a government counter and told to come with a local sponsor.', 'A government office', 'Government institution', ['VG05-05'], ['CT01'], null, true],
  ['SI012', ['SI019'], 'Says she has been trying for two years to file a case about her late husband’s land and keeps being sent between offices.', 'A land registry office', 'Government institution', ['VG02-07'], ['CT05']],
  ['SI093', ['SI079'], 'Residents report the island desalination plant has not worked for three weeks and households are buying bottled water.', 'A utility company', 'State-owned enterprise', ['VG14-04'], ['CT09']],
  ['SI112', ['SI115'], 'Residents complain of smoke from open waste burning near homes causing breathing problems for children.', 'An island council', 'Government institution', ['VG14-01', 'VG01-02'], ['CT09']],
  ['SI118', ['SI080'], 'Families relocated after coastal erosion say the promised replacement housing has not been provided after a year.', 'A housing authority', 'Government institution', ['VG12-02'], ['CT09']],
  ['SI084', ['SI057'], 'Reports a 13-year-old boy working on a fishing vessel during school hours.', 'A fishing vessel owner', 'Individual', ['VG01-08'], ['CT03', 'CT07'], { rel: 'neighbour', kind: 'child' }],
  ['SI043', ['SI042'], 'Alleges he was slapped and kicked by officers while being taken into police custody and has bruises on his back.', 'A police custodial facility', 'Government institution', ['VG06-06'], ['CT08'], null, false, ['mps_dhoonidhoo', 'mps_male', 'mps_station'], ['force', 'health']],
  ['SI048', ['SI065'], 'Detainee says the cell holds twice its capacity, there is no fan and drinking water is given only twice a day.', 'A police custodial facility', 'Government institution', ['VG06-01'], ['CT08'], null, false, ['mps_dhoonidhoo', 'mps_male'], ['conditions']],
  ['SI007', ['SI013'], 'Migrant worker says he has been held at the immigration detention centre for five months without being told when he will be deported.', 'An immigration detention centre', 'Government institution', ['VG06-05', 'VG05-01'], ['CT08'], null, true, ['imm_hulhumale'], ['duration', 'procedure']],
  ['SI065', ['SI048'], 'Prisoner reports that he has waited four months for a specialist referral for chest pains despite repeated requests.', 'A prison', 'Government institution', ['VG06-02', 'VG09-01'], ['CT08'], null, false, ['mcs_maafushi', 'mcs_asseyri', 'mcs_hulhumale'], ['health']],
  ['SI044', ['SI048'], 'Family says their son has been kept in a segregation cell for over 30 days and is not allowed family visits.', 'A prison', 'Government institution', ['VG06-02'], ['CT08'], { rel: 'son', kind: 'other' }, false, ['mcs_maafushi', 'mcs_asseyri'], ['discipline', 'contact']],
  ['SI013', ['SI009'], 'Remand detainee says he has not been allowed to meet his lawyer in private since being transferred.', 'A prison', 'Government institution', ['VG06-01'], ['CT05', 'CT08'], null, false, ['mcs_male', 'mcs_hulhumale', 'mps_dhoonidhoo'], ['contact', 'procedure']],
  ['SI043', ['SI060'], 'A 16-year-old held at the juvenile centre reports being assaulted by older detainees and says staff did not intervene.', 'A juvenile detention centre', 'Government institution', ['VG06-03', 'VG01-06'], ['CT03', 'CT08'], { rel: 'son', kind: 'child' }, false, ['juv_asseyri', 'juv_hoarafushi'], ['safety', 'force']],
  ['SI042', ['SI065'], 'Resident at the drug rehabilitation centre alleges he was restrained and locked in a room for two days as punishment.', 'A drug rehabilitation centre', 'Government institution', ['VG09-04'], ['CT08'], null, false, ['nda_himmafushi', 'nda_remand', 'nda_halfway'], ['discipline', 'force']],
  ['SI044', ['SI070'], 'Relative of a resident at the special needs home says he is kept sedated and has no structured activities or therapy.', 'A State care home', 'Government institution', ['VG09-02', 'VG03-07'], ['CT08'], { rel: 'brother', kind: 'other' }, false, ['care_hpsn'], ['health', 'conditions']],
  ['SI060', ['SI057'], 'Girl living in a State children\'s home says she is not being sent to school and older residents bully her.', 'A State care home', 'Government institution', ['VG01-05'], ['CT03'], { rel: 'daughter', kind: 'child' }, false, ['care_hiyaa', 'care_fiyavathi', 'care_aman'], ['safety', 'procedure']],
  ['SI003', ['SI065'], 'Family requests an inquiry into the death of their father in custody, saying he had asked for his heart medication.', 'A police custodial facility', 'Government institution', ['VG06-06'], ['CT08'], { rel: 'father', kind: 'other' }, false, ['mps_male', 'mps_dhoonidhoo'], ['health']],
  ['SI048', ['SI046'], 'Female detainee says the women\'s section has no female officer on night shift and there is no privacy when showering.', 'A prison', 'Government institution', ['VG06-04'], ['CT02', 'CT08'], null, false, ['mcs_maafushi'], ['conditions', 'safety']]
];
const DEMO_MALE = ['Mohamed Rasheed', 'Ahmed Shareef', 'Ibrahim Naseem', 'Hussain Afeef', 'Ali Waheed', 'Abdulla Faisal', 'Hassan Zahir', 'Ismail Shiham', 'Moosa Nizar', 'Yoosuf Riyaz', 'Adam Shafeeu', 'Ibrahim Faisal', 'Mohamed Ziyad', 'Ahmed Nashid', 'Hussain Rasheed', 'Ali Shareef', 'Abdul Latheef', 'Hassan Mausoom', 'Mohamed Ihsan', 'Ahmed Rizwan'];
const DEMO_FEMALE = ['Aishath Shifa', 'Fathimath Nuha', 'Mariyam Zeena', 'Hawwa Lubna', 'Aminath Rifa', 'Khadeeja Ahmed', 'Aishath Shaheema', 'Fathimath Shiuna', 'Mariyam Visam', 'Hawwa Nazima', 'Aminath Shiyama', 'Zulaikha Moosa', 'Shaufa Ibrahim', 'Raheema Ali', 'Nashida Hassan', 'Fathimath Raufa', 'Aishath Nisha', 'Mariyam Saleem', 'Hafsa Rasheed', 'Asma Adam'];
const DEMO_MIGRANT = [['Mohammad Rafiqul Islam', 'Bangladeshi', 'BD'], ['Md. Shahidul Alam', 'Bangladeshi', 'BD'], ['Ramesh Kumar', 'Indian', 'IN'], ['Suresh Babu', 'Indian', 'IN'], ['Bikash Tamang', 'Nepali', 'NP'], ['Nuwan Perera', 'Sri Lankan', 'LK'], ['Abdul Karim', 'Bangladeshi', 'BD'], ['Ganesh Rai', 'Nepali', 'NP'], ['Mohammed Rubel', 'Bangladeshi', 'BD'], ['Josephine Reyes', 'Filipino', 'PH']];
const DEMO_PLACES = [['MLE', 'Malé'], ['MLE', 'Hulhumalé'], ['MLE', 'Vilimalé'], ['K', 'Maafushi'], ['K', 'Thulusdhoo'], ['S', 'Hithadhoo'], ['S', 'Feydhoo'], ['GDh', 'Thinadhoo'], ['Gn', 'Fuvahmulah'], ['HDh', 'Kulhudhuffushi'], ['L', 'Fonadhoo'], ['Lh', 'Naifaru'], ['R', 'Ungoofaaru'], ['B', 'Eydhafushi'], ['N', 'Velidhoo'], ['AA', 'Rasdhoo'], ['Th', 'Veymandoo'], ['Dh', 'Kudahuvadhoo'], ['GA', 'Villingili'], ['HA', 'Dhidhdhoo'], ['F', 'Nilandhoo'], ['Sh', 'Funadhoo'], ['ADh', 'Mahibadhoo'], ['M', 'Muli']];
const DEMO_CHILD = ['Ahmed Ayaan', 'Aisha Zara', 'Mohamed Ilham', 'Fathimath Inaya', 'Ibrahim Aiman', 'Mariyam Alya'];

async function demoWrite(path, data) {
  for (let i = 0; i < 4; i++) {
    try { return await setDoc(path, data); } catch (e) { if (e && e.code === 'resource_exhausted' && i < 3) { await new Promise(r => setTimeout(r, 1500 * (i + 1))); continue; } throw e; }
  }
}

function buildDemo(N = 100) {
  const R = rng(20261112); const pick = a => a[Math.floor(R() * a.length)]; const chance = p => R() < p; const between = (a, b) => a + Math.floor(R() * (b - a + 1));
  const X = catIndex(); const me = S.me.id; const td = today(); const year = td.slice(0, 4);
  const officers = staffIds('reg_officer').length ? staffIds('reg_officer') : [me];
  const sups = supervisors().length ? supervisors() : [me];
  const panelists = [...new Set([...sups, ...staffIds('panel'), me])];
  const support = staffIds('support')[0] || me;
  const at = (date, hh = 10) => new Date(`${date}T${pad2(hh)}:${pad2(between(0, 59))}:00`).toISOString();

  // Panel meetings every 14 days for the past year, plus the next one
  const meetings = []; let md = addDays(td, -357); let k = 1;
  while (md <= addDays(td, 14)) { let d = md; const wd = new Date(d + 'T12:00:00').getDay(); if (wd === 5) d = addDays(d, 2); if (wd === 6) d = addDays(d, 1); meetings.push({ id: 'mdemo' + pad2(k++), date: d, past: d < td }); md = addDays(md, 14); }
  const nextMeet = meetings.find(m => !m.past);
  const agenda = Object.fromEntries(meetings.map(m => [m.id, []]));

  // People
  const complainants = {}; const victims = {}; const repeat = [];
  const newPerson = (opt) => {
    const migrant = opt.migrant; const female = opt.female ?? chance(0.5);
    const [mn, nat, cc] = migrant ? pick(DEMO_MIGRANT) : [pick(female ? DEMO_FEMALE : DEMO_MALE), 'Maldivian', ''];
    const [atoll, island] = pick(DEMO_PLACES); const age = opt.age ?? between(22, 68);
    const id = 'pdemo' + Object.keys(complainants).length.toString().padStart(3, '0');
    complainants[id] = { demo: true, name: mn, nid: migrant ? cc + between(1000000, 9999999) : 'A' + between(100000, 399999), sex: migrant ? (mn === 'Josephine Reyes' ? 'Female' : 'Male') : (female ? 'Female' : 'Male'), dob: `${+year - age}-${pad2(between(1, 12))}-${pad2(between(1, 28))}`, nationality: nat, phone: (migrant ? '9' : pick(['7', '9'])) + between(100000, 999999), email: chance(0.3) ? mn.toLowerCase().replace(/[^a-z]+/g, '.') + '@example.mv' : '', address: migrant ? 'Workers’ accommodation' : `H. ${pick(['Rose', 'Coral', 'Sunrise', 'Sea Breeze', 'Blue Lagoon', 'Palm', 'Lily'])}villa`, atoll: migrant ? 'MLE' : atoll, island: migrant ? pick(['Malé', 'Hulhumalé']) : island, notes: '', createdAt: nowISO(), createdBy: me, updatedAt: nowISO(), history: { h0: { at: nowISO(), by: me, note: 'Demo record created' } } };
    return id;
  };
  const newVictim = (v, migrantCase) => {
    const id = 'vdemo' + Object.keys(victims).length.toString().padStart(3, '0'); const child = v.kind === 'child'; const older = v.kind === 'older'; const female = ['daughter', 'wife', 'mother'].includes(v.rel) || (!['son', 'brother', 'father'].includes(v.rel) && chance(0.5));
    const age = child ? between(6, 15) : older ? between(68, 84) : between(19, 50); const [atoll, island] = pick(DEMO_PLACES);
    victims[id] = { demo: true, name: child ? pick(DEMO_CHILD) : pick(female ? DEMO_FEMALE : DEMO_MALE), nid: child ? '' : 'A' + between(100000, 399999), sex: female ? 'Female' : 'Male', dob: `${+year - age}-${pad2(between(1, 12))}-${pad2(between(1, 28))}`, age: '', nationality: migrantCase ? 'Bangladeshi' : 'Maldivian', phone: '', email: '', address: '', atoll, island, vulnerable: [...(child ? ['Child (under 18)'] : []), ...(older ? ['Older person'] : [])], notes: '', createdAt: nowISO(), createdBy: me, updatedAt: nowISO(), history: { h0: { at: nowISO(), by: me, note: 'Demo record created' } } };
    return id;
  };

  const complaints = [];
  for (let i = 0; i < N; i++) {
    const sc = DEMO_SCEN[i % DEMO_SCEN.length]; const [issueId, sec, summary, resp, rtype, groups, topics, vic, migrant, facs, detIss] = sc;
    const iss = X.byIssue[issueId]; if (!iss) continue;
    // Received date: skewed towards recent months
    const ageDays = Math.floor(Math.pow(R(), 1.35) * 360); const rec = addDays(td, -ageDays);
    let cpId; if (i > 20 && chance(0.12) && repeat.length) cpId = pick(repeat); else { cpId = newPerson({ migrant, female: /\bher\b|she|mother|pregnant|single mother/i.test(summary) ? true : undefined }); repeat.push(cpId); }
    const victimLinks = {}; let victimSame = true;
    if (vic) { victimSame = false; victimLinks[newVictim(vic, migrant)] = { rel: vic.rel, addedAt: at(rec), addedBy: me }; }
    const cid = 'cdemo' + String(i + 1).padStart(3, '0'); const H = {}; let hn = 0; const h = (date, stage, note, by = me, hh = 10) => { H['h' + (hn++)] = { at: at(date, hh), by, stage, note }; };
    const reg = addDays(rec, between(0, 2)); const regNo = `DEMO-${rec.slice(0, 4)}-${String(i + 1).padStart(4, '0')}`;
    h(rec, null, `Complaint received (${pick(['Walk-in', 'Letter', 'Email', 'Phone', 'Online form'])})`, me, 9); h(reg, 'registered', `Registered as ${regNo}`, me, 11);
    const c = { demo: true, regNo, cmsRef: chance(0.35) ? `CMS/${rec.slice(0, 4)}/${between(100, 999)}` : '', dateReceived: rec, channel: pick(['Walk-in', 'Letter', 'Email', 'Phone', 'Online form', 'Referral from another agency']), receivedBy: me, createdAt: at(reg, 11), createdBy: me,
      complainantId: cpId, confidential: chance(0.07), victimSame, victimLinks, summary, incidentDate: addDays(rec, -between(3, 40)), atoll: complainants[cpId].atoll, island: complainants[cpId].island, respondent: { name: resp, type: rtype },
      missing: chance(0.08) ? ['respondent'] : chance(0.06) ? ['form'] : [], dupWarnings: [], docs: {}, assignments: {}, reviews: {}, requests: {}, legal: {}, decisions: {}, actions: {}, referrals: {}, corr: {} };
    const d = { catId: iss.c, subId: iss.s, issueId: iss.i, secondary: sec.filter(x => X.byIssue[x]), groups: groups.filter(g => X.groupBy[g]), topics: topics.filter(t => X.topicBy[t]), source: chance(0.3) ? 'ai-assisted' : 'manual' };
    c.classification = { ...cleanCls(d), at: at(reg, 12) }; Object.assign(c, clsFields(d));
    { const auto = { 'A detention facility': [['mcs_maafushi', 'mcs_asseyri', 'mcs_male', 'mcs_hulhumale'], ['conditions', 'force']], 'A remand centre': [['mps_dhoonidhoo', 'mcs_male'], ['duration']], 'A police station': [['mps_station', 'mps_male'], ['force', 'procedure']], 'Police': [['mps_vehicle', 'mps_station'], ['force']] }[resp];
      const fl = facs || auto?.[0]; if (fl) { const fac = pick(fl); c.detention = { facility: fac, type: facility(fac)?.[2] || 'other', place: /station|other|vehicle/.test(fac) ? pick(['Hithadhoo', 'Kulhudhuffushi', 'Fuvahmulah', 'Thinadhoo', 'Naifaru', 'Eydhafushi']) : '', status: vic && vic.rel ? (chance(0.75) ? 'relative' : 'past') : pick(['current', 'current', 'current', 'past', 'released_recent']), since: addDays(rec, -between(5, 400)), who: vic ? 'victim' : 'complainant', issues: (detIss || auto?.[1] || []).filter(() => chance(0.85)) }; const dd = c.detention; if (dd.status === 'past') dd.until = addDays(dd.since, between(3, Math.max(4, dayDiff(dd.since, rec)))); else if (dd.status === 'released_recent') dd.until = addDays(rec, -between(1, 29)); if (dd.until && dd.until < dd.since) dd.until = dd.since; } }

    // Decide how far the case has progressed, by age
    const r = R(); let stage;
    if (ageDays < 4) stage = 'registered';
    else if (ageDays < 18) stage = r < 0.25 ? 'registered' : 'prelim_review';
    else if (ageDays < 40) stage = r < 0.45 ? 'prelim_review' : r < 0.6 ? 'further_work' : r < 0.8 ? 'ready_panel' : 'on_agenda';
    else stage = r < 0.06 ? 'prelim_review' : r < 0.1 ? 'ready_panel' : r < 0.58 ? 'referred' : r < 0.84 ? 'closed' : 'further_work';
    const off = pick(officers); const sup = pick(sups);
    c.stage = 'registered'; c.assignedTo = null; c.nextAction = 'Assign to a Registration Officer'; c.nextActionDue = addDays(reg, 3);
    if (stage !== 'registered') {
      const ad = addDays(reg, between(1, 5)); c.assignedTo = off; c.assignedAt = at(ad); c.assignments.a1 = { to: off, by: sup, at: at(ad), instructions: pick(['Check documents and contact the complainant.', 'Priority case; establish dates and the institution involved.', 'Obtain the respondent’s version.']), reason: '', prev: null };
      h(ad, 'prelim_review', `Assigned to ${nm(off)}`, sup); c.stage = 'prelim_review'; c.nextAction = 'Preliminary review and preparation for the panel'; c.nextActionDue = addDays(ad, 21);
      if (chance(stage === 'prelim_review' ? 0.6 : 0.95)) { const md2 = addDays(ad, between(1, 6)); c.reviews.r1 = { kind: 'mgmt', by: sup, role: hasRoleOf(sup, 'dg') ? 'dg' : 'director', at: at(md2, 14), text: pick(['Please prioritise; the allegations are serious.', 'Establish whether the matter is already before a court.', 'Contact the respondent institution for its records before the panel.', 'Check whether there are other complaints against the same respondent.']), requiredActions: pick(['Obtain records from the respondent.', 'Interview the complainant in person.', '', 'Request the relevant policy document.']) }; h(md2, null, 'Management comments added', sup, 14); }
    }
    const reqOpen = stage === 'prelim_review' || stage === 'further_work' ? chance(0.45) : false;
    if (stage !== 'registered' && (reqOpen || chance(0.3))) {
      const rqd = addDays(c.assignedAt.slice(0, 10), between(3, 9)); const due = addDays(rqd, 14);
      const rq = { to: resp, toType: 'Respondent', details: pick(['Copies of the relevant records and a written explanation.', 'Confirmation of the dates and the decision taken, with reasons.', 'The policy or procedure applied in this case.']), requestedAt: rqd, due, by: off, at: at(rqd), attempts: {}, responses: {} };
      if (chance(0.6)) rq.attempts.t1 = { at: at(addDays(rqd, 5)), by: off, method: pick(['Phone call', 'Email', 'Letter']), note: pick(['No answer; will follow up.', 'Spoke to the focal point; reply promised this week.', 'Reminder sent.']) };
      if (reqOpen) { rq.status = chance(0.3) ? 'partial' : 'pending'; c.nextAction = `Awaiting information from ${resp}`; c.nextActionDue = due; }
      else { rq.status = 'received'; rq.responses.s1 = { at: at(addDays(rqd, between(5, 16))), by: off, note: pick(['Records received; they confirm the dates.', 'Written explanation received; disputes part of the complaint.', 'Policy document received.']), docIds: [] }; }
      c.requests.q1 = rq; h(rqd, null, `Information requested from ${resp}`, off);
    }
    const postReview = ['ready_panel', 'on_agenda', 'next_step', 'referred', 'further_work', 'further_investigation', 'closed'].includes(stage) && !(stage === 'further_work' && ageDays < 40);
    if (postReview) {
      const rv = addDays(c.assignedAt.slice(0, 10), between(10, 20)); const fw = (iss.f || '').split(';')[0].trim();
      c.reviews.r2 = { kind: 'officer', by: off, role: 'reg_officer', at: at(rv, 15), docCheck: 'Complaint form and ID copy checked.', contacts: 'Complainant contacted by phone; respondent contacted in writing.', laws: `Constitution; ${fw || 'relevant Act'}.`, questions: chance(0.3) ? 'Exact date of the incident to be confirmed.' : '', text: pick(['The complaint falls within the mandate and should be considered by the panel.', 'Facts are partly disputed by the respondent; recommend the panel considers further inquiry.', 'Supporting documents are consistent with the complaint.']) };
      c.legal.l1 = { lawId: 'constitution', lawTitle: 'Constitution of the Republic of Maldives', lawRef: '2008', lawVersion: 'As amended', provision: pick(['Article 41', 'Article 45', 'Article 48', 'Article 54', 'Article 23', 'Article 37']), issue: iss.in, assessment: 'Facts as alleged may engage this provision; to be assessed by the panel.', reasons: '', by: off, at: at(rv, 15), comments: {} };
      h(rv, null, 'Officer recorded preliminary review', off, 15);
      const ready = addDays(rv, between(1, 4)); c.readyAt = at(ready, 16); c.panelRequest = { requested: pick(['Decide whether to proceed and how.', 'Decide whether to refer to the Investigation Department.', 'Decide whether further information is needed.']), issues: chance(0.4) ? 'Respondent has not yet replied in full.' : '', by: off, at: at(ready, 16) };
      h(ready, 'ready_panel', 'Review complete — ready for panel', off, 16); c.stage = 'ready_panel'; c.nextAction = 'Await scheduling on a Registration Panel agenda'; c.nextActionDue = null;
      if (stage === 'on_agenda' && nextMeet) { c.stage = 'on_agenda'; c.panelMeetingId = nextMeet.id; agenda[nextMeet.id].push(cid); c.nextAction = `Registration Panel on ${fmtD(nextMeet.date)}`; c.nextActionDue = nextMeet.date; h(addDays(ready, 1), 'on_agenda', 'Added to panel agenda', support); }
      if (!['ready_panel', 'on_agenda'].includes(stage)) {
        let m = meetings.find(x => x.past && x.date > addDays(ready, 1)) || meetings.filter(x => x.past).pop();
        // Some lodged / not-lodged cases were first returned for clarification and put on a later agenda
        const later = meetings.filter(x => x.past && x.date > addDays(m.date, 13));
        if (stage !== 'further_work' && later.length && chance(0.25)) {
          agenda[m.id].push(cid); const q = pick(['Confirm the exact dates of the incident.', 'Obtain the respondent’s written response.', 'Clarify whether the matter is before a court.']);
          c.decisions.d0 = { meetingId: m.id, ref: `PNL-${m.date.replace(/-/g, '')}-${pad2(agenda[m.id].length)}`, outcome: 'return_officer', clarify: q, rationale: 'More information is needed before deciding whether to lodge.', by: pick(panelists), at: at(m.date, 12), status: 'approved', approvedBy: sup, approvedAt: at(addDays(m.date, 1)) };
          c.actions.x0 = { text: 'Clarify for the panel: ' + q, owner: off, ownerDept: '', due: addDays(m.date, 14), status: 'done', at: at(m.date, 12), by: me, decisionId: 'd0', meetingId: m.id, completedAt: at(addDays(m.date, 8)), completedBy: off, note: 'Clarification obtained.' };
          H['h' + (hn++)] = { at: at(m.date, 12), by: me, stage: 'further_work', note: 'Panel decision: Returned for clarification: ' + q };
          H['h' + (hn++)] = { at: at(addDays(m.date, 9), 16), by: off, stage: 'ready_panel', note: 'Clarification provided — resubmitted to the panel' };
          c.panelRequest = { ...c.panelRequest, clarification: 'Clarification obtained and attached to the review notes.', resubmission: true, at: at(addDays(m.date, 9), 16) };
          m = later[0];
        }
        agenda[m.id].push(cid);
        h(addDays(m.date, -2), 'on_agenda', `Added to panel agenda for ${fmtD(m.date)}`, support);
        const oc = { referred: 'lodge', closed: 'not_lodge', further_work: 'return_officer' }[stage];
        const did = 'd1'; const dat = at(m.date, 12); const nlr = pick(NOT_LODGED_REASONS.slice(0, 6)); const clq = pick(['Obtain a written statement from the complainant.', 'Obtain the respondent’s records.', 'Clarify the dates of the incident.', 'Confirm whether the complainant consents to the complaint being lodged.']);
        const final = oc !== 'return_officer'; const pendingComm = final && m.date >= addDays(td, -28); const rej = final && !pendingComm && chance(0.12);
        const panelOc = rej ? (oc === 'lodge' ? 'not_lodge' : 'lodge') : oc; const cdate = addDays(m.date, between(5, 9));
        const rat = { lodge: 'The complaint falls within the mandate and the facts warrant investigation.', not_lodge: nlr + '. The complainant is to be informed in writing.', return_officer: 'The panel needs clarification before deciding whether to lodge.' };
        c.decisions[did] = { meetingId: m.id, ref: `PNL-${m.date.replace(/-/g, '')}-${pad2(agenda[m.id].length)}`, outcome: panelOc, reason: panelOc === 'not_lodge' ? nlr : '', clarify: panelOc === 'return_officer' ? clq : '', rationale: rat[panelOc], by: pick(panelists), at: dat, status: final && !pendingComm ? (rej ? 'changed' : 'approved') : 'recorded', needsCommission: final,
          ...(final && !pendingComm ? { commission: { status: rej ? 'rejected' : 'approved', reason: rej ? (oc === 'lodge' ? pick(['The facts disclose a possible violation that the Commission wishes to investigate.', 'The matter raises a systemic issue the Commission wants investigated.']) : pick(['The complaint falls outside the Commission’s mandate.', 'Insufficient grounds to investigate at this stage.'])) : '', preferred: oc, clarify: '', meetingDate: cdate, ref: `HRCM/COM/${cdate.slice(0, 4)}/${between(10, 99)}`, by: sup, at: at(cdate, 15) } } : {}) };
        H['h' + (hn++)] = { at: dat, by: me, stage: final ? 'commission' : stage, note: 'Panel decision: ' + outcomeLabel(panelOc) + (panelOc === 'not_lodge' ? ` (${nlr})` : panelOc === 'return_officer' ? ': ' + clq : '') + (final ? ' — awaiting Commission decision' : '') };
        c.panelMeetingId = m.id; c.stage = stage;
        if (final && !pendingComm) { const sentD = addDays(cdate, between(2, 12)); c.interim = sentD < td && chance(0.9) ? { status: 'sent', outcome: oc, commissionDate: cdate, createdAt: at(cdate, 15), due: addDays(cdate, 7), sentAt: sentD, method: pick(LETTER_METHODS.slice(0, 3)), ref: `HRCM/REG/${sentD.slice(0, 4)}/${between(100, 999)}`, by: off, at: at(sentD, 11) } : { status: 'pending', outcome: oc, commissionDate: cdate, createdAt: at(cdate, 15), due: addDays(cdate, 7) }; if (c.interim.status === 'sent') H['h' + (hn++)] = { at: at(sentD, 11), by: off, stage: null, note: 'Interim letter sent to the complainant' }; }
        if (final && !pendingComm) H['h' + (hn++)] = { at: at(cdate, 15), by: sup, stage, note: rej ? `Commission did not approve the panel decision “${outcomeLabel(panelOc)}”; Commission decision: ${outcomeLabel(oc)}` : `Commission approved the panel decision “${outcomeLabel(oc)}”` };
        if (pendingComm) {
          c.stage = 'commission'; c.nextAction = 'Await the Commission decision'; c.nextActionDue = null;
          if (panelOc === 'lodge') c.referrals.f1 = { decisionId: did, issues: `${iss.in}: verify the facts and identify those responsible.`, dept: 'Investigation Department', recipient: null, materials: [], status: 'pending_commission', by: me, at: dat };
          c.history = H; c.lastActionAt = Object.values(H).map(x => x.at).sort().pop(); c.lastActionBy = me; complaints.push([cid, c]); continue;
        }
        if (stage === 'further_work') {
          const due = addDays(m.date, 14);
          c.actions.x1 = { text: 'Clarify for the panel: ' + clq, owner: off, ownerDept: '', due, status: 'open', at: dat, by: me, decisionId: did, meetingId: m.id };
          c.clarification = { text: clq, due, meetingId: m.id, at: dat }; c.nextAction = 'Clarify and resubmit to the panel'; c.nextActionDue = due;
        } else if (stage === 'referred') {
          const sent = cdate; c.lodgedAt = at(cdate, 15); const rs = sent < addDays(td, -40) ? pick(['responded', 'responded', 'in_progress', 'acknowledged']) : sent < addDays(td, -10) ? pick(['acknowledged', 'in_progress', 'sent']) : 'sent';
          c.referrals.f1 = { decisionId: did, issues: `${iss.in}: ${pick(['verify the facts and identify those responsible', 'establish whether the conduct occurred and recommend remedial action', 'inspect the premises and interview the persons concerned'])}.`, dept: 'Investigation Department', recipient: null, materials: [], status: rs, by: me, at: dat, sentAt: sent, ...(rs !== 'sent' ? { ackAt: addDays(sent, between(2, 6)) } : {}), ...(rs === 'responded' ? { respondedAt: addDays(sent, between(20, 45)), response: pick(['Investigation opened under file INV/' + sent.slice(0, 4) + '/' + between(10, 99) + '.', 'Findings shared; recommendations sent to the respondent institution.', 'Investigation completed; report attached to the investigation file.']) } : {}) };
          c.nextAction = rs === 'responded' ? 'Review the Investigation Department response' : rs === 'sent' ? 'Await acknowledgement from the Investigation Department' : 'Investigation Department working on the lodged complaint'; c.nextActionDue = rs === 'sent' ? addDays(sent, 7) : null;
        } else { c.nextAction = 'Complainant informed'; c.nextActionDue = null; }
        if (c.interim && c.interim.status === 'pending') { c.nextAction = 'Send the interim letter to the complainant'; c.nextActionDue = c.interim.due; }
      }
    }
    if (chance(0.25) && c.assignedTo) { const cd = addDays(rec, between(3, Math.max(4, Math.min(ageDays, 60)))); if (cd <= td) c.corr.o1 = { dir: pick(['out', 'in']), date: cd, party: pick([displayName(c) === 'Confidential' ? 'Complainant' : complainants[cpId].name, resp]), method: pick(['Letter', 'Email', 'Phone call']), subject: pick(['Acknowledgement of complaint', 'Request for documents', 'Update on progress', 'Reply from respondent']), notes: '', by: c.assignedTo, at: at(cd) }; }
    c.history = H; c.lastActionAt = Object.values(H).map(x => x.at).sort().pop(); c.lastActionBy = me;
    complaints.push([cid, c]);
  }
  const part = Object.fromEntries(panelists.concat([support]).map(x => [x, true]));
  const mdocs = meetings.map(m => [m.id, { demo: true, date: m.date, time: '10:00', venue: 'Commission meeting room (demo)', participants: part, status: m.past ? (agenda[m.id].length || chance(0.7) ? 'held' : 'cancelled') : 'planned', agenda: agenda[m.id], agendaNotes: {}, agendaStatus: m.past ? 'approved' : 'draft', agendaApprovedBy: m.past ? sups[0] : null, createdBy: support, createdAt: nowISO() }]);
  // Recommendations after the Commission's decision: case recommendations and systemic recommendations
  const recs = []; const decidedC = complaints.filter(([, c]) => c.stage === 'referred' || c.stage === 'closed').filter(([, c]) => c.interim);
  const caseRecText = { 'Private company': ['Pay the outstanding wages to the complainant within 30 days.', 'Return the complainant’s passport immediately.', 'Reinstate the complainant or pay compensation as required by the Employment Act.'], 'Government institution': ['Review the complainant’s application and give written reasons for the decision.', 'Provide the complainant with access to the required medical treatment.', 'Apologise to the complainant and correct the record.'], 'Individual': ['Ensure the child attends school and is not employed during school hours.'], 'State-owned enterprise': ['Restore the water supply and inform residents of the timeline.'] };
  const sysText = [['A detention facility', 'Adopt a written procedure ensuring every detainee can contact family and a lawyer within 24 hours of arrest.'], ['A construction company', 'Stop holding workers’ passports and introduce a policy that workers keep their own documents.'], ['A housing authority', 'Publish the criteria and waiting list for social housing and give written reasons for every rejection.'], ['A secondary school', 'Introduce an anti-bullying policy with a clear reporting and response procedure.'], ['A regional health centre', 'Stop requiring deposits from migrant workers before emergency treatment.'], ['An island council', 'Prepare a waste management plan that ends open burning near homes.']];
  const recState = (letter) => { const age = dayDiff(letter, td); const r2 = R(); if (age < 30) return r2 < 0.6 ? 'issued' : 'acknowledged'; if (age < 90) return r2 < 0.2 ? 'issued' : r2 < 0.45 ? 'acknowledged' : r2 < 0.75 ? 'in_progress' : r2 < 0.9 ? 'partial' : 'implemented'; return r2 < 0.1 ? 'in_progress' : r2 < 0.25 ? 'partial' : r2 < 0.7 ? 'implemented' : r2 < 0.85 ? 'not_implemented' : 'closed'; };
  const mkUpdates = (letter, inst, status, owner) => { const u = { u0: { at: at(letter, 10), by: owner, status: 'issued', note: `Recommendation letter sent to ${inst}` } }; const steps = { issued: [], acknowledged: ['acknowledged'], in_progress: ['acknowledged', 'in_progress'], partial: ['acknowledged', 'in_progress', 'partial'], implemented: ['acknowledged', 'in_progress', 'implemented'], not_implemented: ['acknowledged', 'not_implemented'], closed: ['acknowledged', 'closed'] }[status]; let d = letter;
    const notes = { acknowledged: 'Institution acknowledged the recommendation in writing.', in_progress: 'Institution reports that implementation has started.', partial: 'Part of the recommendation has been implemented; follow-up continues.', implemented: 'Institution confirmed implementation; evidence received.', not_implemented: 'Institution did not respond after two reminders.', closed: 'Closed by the Commission; matter overtaken by events.' };
    steps.forEach((st2, k) => { d = addDays(d, between(10, 30)); if (d > td) return; u['u' + (k + 1)] = { at: at(d, 11), by: owner, status: st2, method: pick(['Letter', 'Phone call', 'Email', 'Meeting', 'Response received from institution']), note: notes[st2] }; }); return u; };
  decidedC.filter(() => chance(0.3)).slice(0, 18).forEach(([cid, c], k) => {
    const letter = addDays(c.interim.commissionDate, between(10, 25)); if (letter > td) return; const status = recState(letter); const owner = c.assignedTo || me; const inst = c.respondent.name;
    const open = REC_STATUS[status][2];
    recs.push(['recdemo' + pad2(k), { demo: true, type: 'case', ref: `CR-${letter.slice(0, 4)}-${String(k + 1).padStart(3, '0')}`, text: pick(caseRecText[c.respondent.type] || caseRecText['Government institution']), institution: inst, owner, letterDate: letter, letterRef: `HRCM/REC/${letter.slice(0, 4)}/${between(10, 99)}`, due: open ? addDays(letter, between(30, 75)) : null, status, complaintIds: [cid], updates: mkUpdates(letter, inst, status, owner), createdAt: at(letter, 10), createdBy: owner, ...(open ? {} : { concludedAt: at(addDays(letter, 60), 12) }) }]);
  });
  sysText.forEach(([inst, text], k) => {
    const related = complaints.filter(([, c]) => c.respondent.name === inst && (c.stage === 'referred' || c.stage === 'closed')).map(([id]) => id).slice(0, 4);
    const letter = addDays(td, -between(20, 240)); const status = recState(letter); const open = REC_STATUS[status][2]; const owner = pick(sups);
    recs.push(['recsys' + pad2(k), { demo: true, type: 'systemic', ref: `SR-${letter.slice(0, 4)}-${String(k + 1).padStart(3, '0')}`, text, institution: inst, owner, letterDate: letter, letterRef: `HRCM/REC/${letter.slice(0, 4)}/${between(10, 99)}`, due: open ? addDays(letter, between(45, 120)) : null, status, complaintIds: related, updates: mkUpdates(letter, inst, status, owner), createdAt: at(letter, 10), createdBy: owner, ...(open ? {} : { concludedAt: at(addDays(letter, 90), 12) }) }]);
  });
  // 1424 duty rota: 3-day blocks rotating through the officers, 75 days back and 35 days ahead, with call logs on past days
  const duty = []; const dStart = addDays(td, -75); const ctypes = ['complaint', 'enquiry', 'followup', 'referral', 'other'];
  for (let i = 0; i <= 110; i++) {
    const d = addDays(dStart, i); const officer = officers[Math.floor(i / 3) % officers.length]; const wkend = [5, 6].includes(new Date(d + 'T12:00:00').getDay());
    const doc = { demo: true, date: d, officer, holiday: false, note: '', logs: {}, by: sups[0], at: at(dStart, 9) };
    if (d < td || (d === td && chance(0.5))) { if (d === td || chance(0.95)) { const n = Math.max(0, Math.round((wkend ? 5 : 9) * (0.4 + R() * 1.3))); const types = {}; let left = n; ctypes.forEach((k, j) => { const v = j === ctypes.length - 1 ? left : Math.min(left, Math.round(n * [0.25, 0.4, 0.2, 0.1][j] * (0.6 + R() * 0.8))); if (v > 0) types[k] = v; left -= v; }); doc.logs.l1 = { at: at(d, 23), by: officer, count: n, types, note: '' }; } }
    duty.push([d, doc]);
  }
  return { complainants, victims, complaints, meetings: mdocs, recs, duty };
}
function hasRoleOf(id, r) { return (S.staff[id]?.roles || []).includes(r); }

ACT.loadDemo = () => modal({ title: 'Load 100 demo cases', body: `<p style="margin-top:0">Create 100 fictional, classified complaints over the last 12 months with their complainants, victims, panel meetings, decisions, information requests, referrals and the 1424 duty rota. All are marked DEMO and can be deleted in one step. This takes about a minute.</p>
  <div class="form"><div class="f full"><label>Language of the demo content</label>
    <label class="na"><input type="radio" name="lang" value="en" checked> English</label>
    <label class="na"><input type="radio" name="lang" value="dv"> ދިވެހި (Dhivehi): Maldivian names, islands, complaint summaries, respondents, officer notes, panel reasons and recommendations in Dhivehi</label></div></div>`,
  submit: 'Load demo data', onSubmit: async o => { setTimeout(() => loadDemo(o.lang === 'dv' ? 'dv' : 'en'), 0); } });
async function loadDemo(lang = 'en') {
  if (vals(S.complaints).some(c => c.demo)) { toast('Demo data is already loaded. Delete it first to load a fresh set.', 'error'); return; }
  let data = buildDemo(100); if (lang === 'dv') data = dvifyDemo(data);
  const jobs = [...Object.entries(data.complainants).map(([id, d]) => ['complainants/' + id, d]), ...Object.entries(data.victims).map(([id, d]) => ['victims/' + id, d]), ...data.meetings.map(([id, d]) => ['meetings/' + id, d]), ...data.complaints.map(([id, d]) => ['complaints/' + id, d]), ...data.recs.map(([id, d]) => ['recs/' + id, d]), ...data.duty.filter(([id]) => !(S.duty || {})[id]).map(([id, d]) => ['duty/' + id, d])];
  { // planned leave for the Registration Officers: one past, one current or coming up
    const td = today(); const types = ['annual', 'annual', 'training', 'family', 'sick'];
    staffIds('reg_officer').forEach((id, k) => {
      const past = addWorkDays(addDays(td, -60 - k * 9), 0); jobs.push([`leave/demo_${id}_a`, { demo: true, staffId: id, type: types[k % types.length], from: past, to: addWorkDays(past, 2 + (k % 3)), note: '', status: 'planned', by: id, at: nowISO() }]);
      const next = k === 1 ? td : addWorkDays(td, 3 + k * 4); jobs.push([`leave/demo_${id}_b`, { demo: true, staffId: id, type: k === 1 ? 'training' : 'annual', from: next, to: addWorkDays(next, 2 + (k % 4)), note: k === 1 ? 'Workshop abroad' : '', status: 'planned', by: id, at: nowISO() }]);
    });
  }
  const note = document.createElement('div'); note.className = 'toast'; $('#toasts').appendChild(note);
  try {
    let n = 0; for (const [p, d] of jobs) { await demoWrite(p, d); n++; if (n % 5 === 0 || n === jobs.length) note.textContent = `Loading demo data… ${n} of ${jobs.length} records`; }
    logA('demo.load', null, `${data.complaints.length} complaints${lang === 'dv' ? ' (Dhivehi)' : ''}`); toast(`Loaded ${data.complaints.length} demo complaints${lang === 'dv' ? ' in Dhivehi' : ''}`);
  } catch (e) { toast('Demo loading stopped: ' + errText(e) + ' Delete the partial demo data and try again.', 'error'); }
  finally { note.remove(); }
}
ACT.clearDemo = () => confirmBox('Delete demo data', 'Delete every complaint, person and meeting marked DEMO? Real records are not affected.', 'Delete demo data', async () => {
  closeModal();
  const jobs = [...vals(S.complaints).filter(x => x.demo).map(c => 'complaints/' + c.id), ...Object.entries(S.complainants).filter(([, p]) => p.demo).map(([id]) => 'complainants/' + id), ...Object.entries(S.victims).filter(([, p]) => p.demo).map(([id]) => 'victims/' + id), ...vals(S.meetings).filter(x => x.demo).map(m => 'meetings/' + m.id), ...Object.entries(S.recs || {}).filter(([, r]) => r.demo).map(([id]) => 'recs/' + id), ...Object.entries(S.duty || {}).filter(([, r]) => r.demo).map(([id]) => 'duty/' + id), ...Object.entries(S.leave || {}).filter(([, r]) => r.demo).map(([id]) => 'leave/' + id)];
  const note = document.createElement('div'); note.className = 'toast'; $('#toasts').appendChild(note);
  try { let n = 0; for (const p of jobs) { await delDoc(p); n++; if (n % 5 === 0) note.textContent = `Deleting demo data… ${n} of ${jobs.length}`; } logA('demo.clear', null, `${jobs.length} records`); toast('Demo data deleted'); }
  catch (e) { toast(errText(e), 'error'); } finally { note.remove(); }
  return false;
}, true);
