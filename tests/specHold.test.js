// Off-spec gear hold: carrying the last assigned-spec read forward when a raider logs out in another spec.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAppsScript } = require('./helpers/appsScript');

const DAY = 86400000;

/** A Guild Audit row as processCharacterSet builds it, in the given spec. */
function row(spec, overrides) {
  return Object.assign({
    'Name': 'Rawria',
    'Class': 'Demon Hunter',
    'Spec': spec,
    'Expected Spec': 'Vengeance',
    'iLvl': 321,
    'Tier Set': '4/5',
    'Sockets': '5',
    'Total Sockets': 5,
    'Empty Sockets': 0,
    'Imperfect Gems': 0,
    'Crafted Items': 2,
    'Head': '[Tier] 321 (Hero 6/6) - Fanged Helm',
    'Enchant Head': 'Enchanted: Tier2 Crit',
    'Enchant Off Hand': 'N/A',
    'Talent Code': 'CcPAkK0WoXky',
    'Hero Talents': 'Aldrachi Reaver',
    'M+ Rating': 2800,
    'Sim Status': '✅ Simmed',
    'GV Raid 1': 334
  }, overrides || {});
}

test('a raider seen in their assigned spec is snapshotted; an off-spec read then reuses it', () => {
  const { context, scriptProps } = loadAppsScript();
  const now = Date.UTC(2026, 8, 27, 3, 0, 0);

  // Main-spec audit: snapshot saved, row untouched
  const main = row('Vengeance');
  const saved = context.applySpecHold(main, true, true, now);
  assert.equal(saved.action, 'save');
  assert.equal(main.specHeld, undefined);
  assert.ok(Object.keys(scriptProps._store).some(k => k.startsWith('spec_hold_char_')));

  // Two days later they log out in Havoc with their M+ gear on
  const offSpec = row('Havoc', {
    'iLvl': 308, 'Tier Set': '1/5', 'Head': '308 (Champion 6/6) - Mythic Hood',
    'Enchant Head': 'Missing', 'Talent Code': 'HAVOCCODE', 'Hero Talents': 'Fel-Scarred',
    'M+ Rating': 2950, 'Sim Status': '⚠️ Sim 9d old'
  });
  const held = context.applySpecHold(offSpec, true, true, now + 2 * DAY);

  assert.equal(held.action, 'hold');
  assert.equal(offSpec.specHeld, true);
  assert.equal(offSpec.specHeldAt, now);
  assert.equal(offSpec.specHeldLiveSpec, 'Havoc');

  // Spec-dependent fields come from the snapshot
  assert.equal(offSpec['Spec'], 'Vengeance');
  assert.equal(offSpec['iLvl'], 321);
  assert.equal(offSpec['Tier Set'], '4/5');
  assert.equal(offSpec['Head'], '[Tier] 321 (Hero 6/6) - Fanged Helm');
  assert.equal(offSpec['Enchant Head'], 'Enchanted: Tier2 Crit');
  assert.equal(offSpec['Talent Code'], 'CcPAkK0WoXky');

  // Spec-independent fields stay live
  assert.equal(offSpec['M+ Rating'], 2950);
  assert.equal(offSpec['Sim Status'], '⚠️ Sim 9d old');

  // Links follow the held spec, not the one they logged out in
  assert.match(offSpec['Wowhead Link'], /demon-hunter\/vengeance\/overview$/);
  assert.match(offSpec['Archon Mythic Link'], /vengeance\/demon-hunter\/raid\/overview\/mythic\/all-bosses$/);

  // And the readiness verdict no longer accuses them of being off-spec
  assert.equal(context.calculateRaidReadyStatus(offSpec).includes('Off-Spec'), false);
});

test('a held row is not created when there is nothing trustworthy to hold', () => {
  const { context } = loadAppsScript();
  const now = Date.UTC(2026, 8, 27);
  const base = { expectedSpec: 'Vengeance', activeSpec: 'Havoc', hasProfile: true, enabled: true, nowMs: now };
  const fresh = { spec: 'Vengeance', savedAt: now - DAY, data: { iLvl: 321 } };

  assert.equal(context.decideSpecHold(Object.assign({}, base, { snapshot: fresh })).action, 'hold');
  // Never yet seen in the assigned spec
  assert.equal(context.decideSpecHold(Object.assign({}, base, { snapshot: null })).action, 'none');
  // Their Config assignment changed, so the snapshot is the wrong spec rather than a stale one
  assert.equal(context.decideSpecHold(Object.assign({}, base, {
    snapshot: { spec: 'Havoc', savedAt: now - DAY, data: {} } })).action, 'none');
  // Too old to be worth more than the live read
  assert.equal(context.decideSpecHold(Object.assign({}, base, {
    snapshot: { spec: 'Vengeance', savedAt: now - 60 * DAY, data: {} } })).action, 'none');
  // Turned off from the menu
  assert.equal(context.decideSpecHold(Object.assign({}, base, { enabled: false, snapshot: fresh })).action, 'none');
  // Armory returned nothing: the quiet grey lookup-failed row has to win
  assert.equal(context.decideSpecHold(Object.assign({}, base, { hasProfile: false, snapshot: fresh })).action, 'none');
  // No assigned raid spec in Config, so there is no such thing as off-spec
  assert.equal(context.decideSpecHold(Object.assign({}, base, { expectedSpec: '', snapshot: fresh })).action, 'none');
  // Case and padding in Config must not make a main-spec logout look off-spec
  assert.equal(context.decideSpecHold(Object.assign({}, base, {
    expectedSpec: ' havoc ', snapshot: fresh })).action, 'save');
});

test('the held fields are the spec-dependent ones only', () => {
  const { context, get } = loadAppsScript();
  const fields = context.specHeldFields_();
  get('AUDIT_GEAR_COLUMNS').forEach(c => assert.ok(fields.includes(c), `gear column ${c} is held`));
  get('AUDIT_ENCHANT_COLUMNS').forEach(c => assert.ok(fields.includes(c), `enchant column ${c} is held`));
  ['Spec', 'iLvl', 'Tier Set', 'Talent Code', 'Hero Talents'].forEach(c => assert.ok(fields.includes(c)));
  // These are not spec-dependent and must keep refreshing on an off-spec run
  get('AUDIT_VAULT_COLUMNS').concat(['M+ Rating', 'Sim Status', 'Raid Ready', 'Name', 'Class'])
    .forEach(c => assert.equal(fields.includes(c), false, `${c} is not held`));
});

test('a snapshot written before a Config spec change is dropped rather than carried', () => {
  const { context } = loadAppsScript();
  const now = Date.UTC(2026, 8, 27);
  context.applySpecHold(row('Vengeance'), true, true, now);

  // The officer reassigns them to Havoc; they are now logged out in Vengeance
  const reassigned = row('Vengeance', { 'Expected Spec': 'Havoc', 'iLvl': 300 });
  assert.equal(context.applySpecHold(reassigned, true, true, now + DAY).action, 'none');
  assert.equal(reassigned.specHeld, undefined);
  assert.equal(reassigned['iLvl'], 300, 'the live read is kept');
});

test('the refresh stamp counts held rows and says nothing when there are none', () => {
  const { context } = loadAppsScript();
  assert.equal(context.specHoldStampText([{ specHeld: true }, {}, { specHeld: true }]), '2 rows 📌 held off-spec');
  assert.equal(context.specHoldStampText([{ specHeld: true }]), '1 row 📌 held off-spec');
  assert.equal(context.specHoldStampText([{}, null]), '');
  assert.equal(context.specHoldStampText([]), '');
});

test('the hold note names both specs and when the gear was saved', () => {
  const { context } = loadAppsScript();
  const note = context.specHoldNoteText({
    'Name': 'Rawria', 'Spec': 'Vengeance', specHeld: true,
    specHeldAt: Date.UTC(2026, 8, 27, 3, 12), specHeldLiveSpec: 'Havoc'
  }, 'UTC');
  assert.match(note, /Rawria in Vengeance/);
  // The test mock's Utilities.formatDate ignores the pattern, so assert the date is there, not its shape
  assert.match(note, /\(2026-09-2[67]/);
  assert.match(note, /currently logged out in Havoc/);
  assert.equal(context.specHoldNoteText({ 'Name': 'Rawria' }, 'UTC'), '');
});

test('the hold is on unless it has been turned off', () => {
  assert.equal(loadAppsScript().context.specHoldEnabled(), true);
  assert.equal(loadAppsScript({ scriptProperties: { spec_hold_enabled: 'false' } }).context.specHoldEnabled(), false);
  assert.equal(loadAppsScript({ scriptProperties: { spec_hold_enabled: 'true' } }).context.specHoldEnabled(), true);
});

test('the sheet marker notes the held Spec cell and leaves every other fill alone', () => {
  const { context, spreadsheet } = loadAppsScript();
  const sheet = spreadsheet.insertSheet('Guild Audit');
  const headers = ['Name', 'Class', 'Spec', 'iLvl'];
  sheet.getRange(1, 1, 4, 4).setValues([
    headers,
    ['Rawria', 'Demon Hunter', 'Vengeance', 321],
    ['Saevenar', 'Death Knight', 'Unholy', 318],
    ['Lyci', 'Priest', 'Discipline', 315]
  ]);
  // The zebra fill the audit lays down before the markers run
  sheet.getRange(2, 1, 3, 4).setBackgrounds([
    ['#ffffff', '#ffffff', '#ffffff', '#ffffff'],
    ['#f8fafc', '#f8fafc', '#f8fafc', '#f8fafc'],
    ['#ffffff', '#ffffff', '#ffffff', '#ffffff']
  ]);

  const objects = [
    { 'Name': 'Rawria', 'Spec': 'Vengeance', specHeld: true, specHeldAt: Date.UTC(2026, 8, 27), specHeldLiveSpec: 'Havoc' },
    { 'Name': 'Saevenar', 'Spec': 'Unholy' },
    { 'Name': 'Lyci', 'Spec': 'Discipline' }
  ];
  assert.equal(context.applySpecHoldMarkers(sheet, headers, objects, 'Spec'), 1);

  const notes = sheet.getRange(2, 3, 3, 1).getNotes();
  assert.match(notes[0][0], /Rawria in Vengeance/);
  assert.equal(notes[1][0], '');

  // Only the held row's Spec cell is amber; the zebra stripe on the row below survives
  const fills = sheet.getRange(2, 1, 3, 4).getBackgrounds();
  assert.equal(fills[0][2], '#fef3c7');
  assert.equal(fills[0][1], '#ffffff', 'the rest of the held row is untouched');
  assert.equal(fills[1][2], '#f8fafc', 'the zebra stripe below is not blanked');

  // No cell text changed: the Loot sheet and the sim importers read this column back
  assert.deepEqual(sheet.getRange(2, 3, 3, 1).getValues(), [['Vengeance'], ['Unholy'], ['Discipline']]);

  // Nothing held: no work, and no notes written
  const clean = spreadsheet.insertSheet('Clean');
  clean.getRange(1, 1, 2, 4).setValues([headers, ['Rawria', 'Demon Hunter', 'Vengeance', 321]]);
  assert.equal(context.applySpecHoldMarkers(clean, headers, [{ 'Name': 'Rawria' }], 'Spec'), 0);
  assert.equal(clean.getRange(2, 3).getNotes()[0][0], '');
});
