// Helpers: dates, loot difficulty, season config, loot cache, credentials, webhook secret.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAppsScript } = require('./helpers/appsScript');

test('normalizeRaidDateKey handles every format a raid date can come back as', () => {
  const { context } = loadAppsScript();
  assert.equal(context.normalizeRaidDateKey('Tue, Sep 22, 2026'), '2026-09-22');
  assert.equal(context.normalizeRaidDateKey('Tue Sep 22 2026 00:00:00 GMT-0700 (Pacific Daylight Time)'), '2026-09-22');
  assert.equal(context.normalizeRaidDateKey('2026-09-22'), '2026-09-22');
  assert.equal(context.normalizeRaidDateKey('9/2/2026'), '2026-09-02');
  assert.equal(context.normalizeRaidDateKey('Wed, Sep 2, 2026'), '2026-09-02');
  assert.equal(context.normalizeRaidDateKey('not a date'), null);
});

test('Mythic loot difficulty relabels rows and shifts ilvl by the same offset', () => {
  const { context, get } = loadAppsScript();
  const catalog = [
    ['⚔️ BOSS 1', '═══', '', '', '', '', '', '', '', '', '', '', ''],
    ['Boss 1', 'Item A', 'Head', 'Heroic', 318, 'Plate', '', '', '', '', '', '', ''],
    ['Boss 8', 'Dagger', 'One-Hand', 'Heroic', 321, 'Dagger', '', '', '', '', '', '', '']
  ];
  const mythic = context.applyLootDifficultyToCatalog(catalog, { key: 'mythic', label: 'Mythic', ilvl: 334 });
  assert.deepEqual(Array.from(mythic, r => [r[3], r[4]]), [['', ''], ['Mythic', 334], ['Mythic', 337]]);
  assert.equal(catalog[1][3], 'Heroic', 'original catalog is not mutated');
  assert.equal(get('BASE_CATALOG_ILVL'), 318);
});

test('season config drives the Archon dropdown and fallback catalog', () => {
  const { get } = loadAppsScript();
  const options = get('ARCHON_BOSS_OPTIONS');
  assert.equal(options[0], 'All Bosses');
  assert.equal(options.length, 1 + get('SEASON.bosses.length') + get('SEASON.archonExtraBosses.length'));
  assert.ok(get('FALLBACK_LOOT_CATALOG.length') > 50);
});

test('loot table cache round-trips through chunked Script Properties and expires weekly', () => {
  const { context, scriptProps } = loadAppsScript({ scriptProperties: { CLIENT_ID: 'x', CLIENT_SECRET: 'y' } });
  const catalog = Array.from({ length: 120 }, (_, i) => ['Boss', 'Item ' + i + ' '.repeat(80), 'Head', 'Heroic', 318, 'Plate', '', '', '', '', 'Raid Drop', '', 'Blizzard ID: ' + i]);
  context.writeLootTableCache(catalog);
  const chunkKeys = Object.keys(scriptProps._store).filter(k => /^loot_table_cache_\d+$/.test(k));
  assert.ok(chunkKeys.length > 1, 'large tables are split across properties');
  assert.ok(chunkKeys.every(k => scriptProps._store[k].length <= 8000));
  assert.deepEqual(JSON.parse(JSON.stringify(context.readLootTableCache().catalog)), catalog);

  // Fresh cache: no Blizzard calls at all
  let fetched = false;
  context.fetchLiveBlizzardRaidLootTable = () => { fetched = true; return null; };
  context.getAccessToken = () => 'token';
  assert.equal(context.getRaidLootTable({ REGION: 'us' }, false).length, 120);
  assert.equal(fetched, false);

  // Stale cache + Blizzard down: fall back to the stale copy
  const meta = JSON.parse(scriptProps._store.loot_table_cache_meta);
  meta.savedAt -= 8 * 24 * 3600e3;
  scriptProps.setProperty('loot_table_cache_meta', JSON.stringify(meta));
  assert.equal(context.getRaidLootTable({ REGION: 'us' }, false).length, 120);
  assert.equal(fetched, true);

  // Shorter table replaces a longer one without leaving stale chunks behind
  context.writeLootTableCache(catalog.slice(0, 2));
  const remaining = Object.keys(scriptProps._store).filter(k => /^loot_table_cache_\d+$/.test(k));
  assert.equal(remaining.length, JSON.parse(scriptProps._store.loot_table_cache_meta).chunks);
});

test('a cache from a previous season is ignored', () => {
  const { context, scriptProps } = loadAppsScript();
  context.writeLootTableCache([['a']]);
  const meta = JSON.parse(scriptProps._store.loot_table_cache_meta);
  meta.raidName = 'Some Old Raid';
  scriptProps.setProperty('loot_table_cache_meta', JSON.stringify(meta));
  assert.equal(context.readLootTableCache(), null);
});

test('shared credentials prefer Script Properties and migrate legacy per-user values', () => {
  const { context, scriptProps } = loadAppsScript({
    scriptProperties: { WCL_CLIENT_ID: 'shared-id' },
    userProperties: { WCL_CLIENT_ID: 'old-user-id', CLIENT_ID: 'user-blizzard-id' }
  });
  assert.equal(context.getSharedCredential('WCL_CLIENT_ID'), 'shared-id');
  assert.equal(context.getSharedCredential('CLIENT_ID'), 'user-blizzard-id');
  assert.equal(scriptProps.getProperty('CLIENT_ID'), 'user-blizzard-id', 'legacy value is copied so other officers can use it');
  assert.equal(context.getSharedCredential('WCL_CLIENT_SECRET'), '');
});

test('no Warcraft Logs credentials are hardcoded in the source', () => {
  const { readConcatenatedSource } = require('./helpers/appsScript');
  const src = readConcatenatedSource();
  assert.doesNotMatch(src, /DEFAULT_WCL_CLIENT_(ID|SECRET)/);
});

test('webhook rejects requests without the shared secret once WEBHOOK_SECRET is set', () => {
  const post = (gas, body) => JSON.parse(gas.context.doPost({ postData: { contents: JSON.stringify(body) } }).text);

  const open = loadAppsScript();
  open.context.processUniversalSimOrReport = input => ({ status: 'ok', input });
  assert.equal(post(open, { urls: ['https://www.raidbots.com/simbot/report/abc'] }).status, 'ok', 'no secret configured: open as before');

  const locked = loadAppsScript({ scriptProperties: { WEBHOOK_SECRET: 's3cret' } });
  locked.context.processUniversalSimOrReport = input => ({ status: 'ok', input });
  assert.match(post(locked, { urls: ['x'] }).message, /Unauthorized/);
  assert.match(post(locked, { urls: ['x'], secret: 'wrong' }).message, /Unauthorized/);
  assert.equal(post(locked, { urls: ['x'], secret: 's3cret' }).status, 'ok');
});

test('notifyUser shows a popup with UI, logs without it, and throws for errors in triggers', () => {
  const withUi = loadAppsScript();
  withUi.context.notifyUser('T', 'M', true);
  assert.deepEqual(withUi.alerts, [{ title: 'T', message: 'M' }]);

  const trigger = loadAppsScript({ withUi: false });
  trigger.context.notifyUser('Info', 'fine');
  assert.deepEqual(trigger.logs, ['Info: fine']);
  assert.throws(() => trigger.context.notifyUser('Bad', 'broken', true), /Bad: broken/);
});

test('sim imports and Loot sheet rebuilds share one lock without deadlocking when nested', () => {
  const gas = loadAppsScript();
  let rebuilds = 0;
  gas.context.buildLootAndChaseItemsSheet_ = () => { rebuilds++; assert.equal(gas.lock.held, true); };
  // An import that triggers a rebuild takes the lock once, not twice
  gas.context.ingestRaidbotsSims_ = () => { gas.context.createLootAndChaseItemsSheet(); return { success: true }; };
  assert.equal(gas.context.processAndIngestRaidbotsSims('x').success, true);
  assert.equal(rebuilds, 1);
  assert.equal(gas.lock.acquisitions, 1);
  assert.equal(gas.lock.held, false, 'lock released afterwards');

  gas.lock.busy = true; // another run (e.g. the hourly audit) is rebuilding the sheet
  assert.throws(() => gas.context.createLootAndChaseItemsSheet(), /still running/);
});

test('webhook failures include an `error` field so the Discord bot shows the real reason', () => {
  const gas = loadAppsScript();
  const post = body => JSON.parse(gas.context.doPost({ postData: { contents: JSON.stringify(body) } }).text);

  gas.context.processUniversalSimOrReport = () => { throw new Error('Service Spreadsheets timed out'); };
  assert.match(post({ urls: ['x'] }).error, /Service Spreadsheets timed out/);

  gas.context.processUniversalSimOrReport = () => ({ success: false, message: 'No valid sim or report URLs provided.' });
  assert.equal(post({ urls: ['x'] }).error, 'No valid sim or report URLs provided.');

  gas.context.processUniversalSimOrReport = () => ({ success: true, message: 'ok' });
  assert.equal(post({ urls: ['x'] }).error, undefined);
  assert.match(post({}).error, /No Raidbots or QE Live URL/);
});

test('Great Vault ilvls line up with the season upgrade tracks', () => {
  const { get } = loadAppsScript();

  // The tracks the vault rewards sit on. Every vault ilvl must be a step on one of these,
  // which is what caught keys 7-9 being published as 311 (Hero 3/6) while labelled Hero 4/6.
  const HERO = [305, 308, 311, 315, 318, 321];
  const MYTH = [318, 321, 325, 328, 331, 334];
  const VETERAN = [279, 282, 285, 289, 292, 295];
  const onTrack = ilvl => HERO.includes(ilvl) || MYTH.includes(ilvl) || VETERAN.includes(ilvl) || ilvl === 292 || ilvl === 298 || ilvl === 302;

  // Raid row
  assert.equal(get('VAULT_MAPPING.raid.mythic'), MYTH[5]);
  assert.equal(get('VAULT_MAPPING.raid.heroic'), MYTH[0]);
  assert.equal(get('VAULT_MAPPING.raid.normal'), HERO[0]);
  assert.equal(get('VAULT_MAPPING.raid.lfr'), 292);

  // Dungeon row
  const mplus = get('VAULT_MAPPING.mplus');
  [10, 11, 12, 20].forEach(k => assert.equal(mplus[k], MYTH[0], `keystone ${k} should be Myth 1/6`));
  [9, 8, 7].forEach(k => assert.equal(mplus[k], HERO[3], `keystone ${k} should be Hero 4/6`));
  assert.equal(mplus[6], HERO[2]);
  [5, 4].forEach(k => assert.equal(mplus[k], HERO[1], `keystone ${k} should be Hero 2/6`));
  [3, 2].forEach(k => assert.equal(mplus[k], HERO[0], `keystone ${k} should be Hero 1/6`));
  assert.equal(mplus[0], VETERAN[3], 'Mythic 0 should be Veteran 4/6');

  // Season 2 has no +1 bracket, so nothing should claim a reward for one
  assert.equal(mplus[1], undefined);

  // Every keystone from 2 to 20 resolves, so no slot falls through to a guessed value
  for (let k = 2; k <= 20; k++) assert.equal(typeof mplus[k], 'number', `keystone ${k} missing`);

  // Every value in the whole table is a real step on a real track
  const delve = get('VAULT_MAPPING.delve');
  Object.values(mplus).concat(Object.values(delve)).forEach(ilvl => {
    assert.ok(onTrack(ilvl), `${ilvl} is not a step on any upgrade track`);
  });

  // World row: tiers 1-11, capped at Hero 1/6 because it cannot give Myth-track loot
  assert.equal(delve[1], VETERAN[0]);
  assert.equal(delve[8], HERO[0]);
  assert.equal(delve[11], HERO[0]);
  for (let t = 1; t <= 11; t++) assert.ok(delve[t] <= HERO[0], `delve tier ${t} above Hero 1/6`);
});

test('simStatusText_ reports fresh, stale and missing sims', () => {
  const { context, get } = loadAppsScript();
  const none = get('SIM_STATUS_NONE');
  const now = Date.UTC(2026, 8, 26, 0, 0, 0);
  const day = 86400000;
  const stamps = { fresh: now - 2 * day, stale: now - 12 * day, today: now - 1000 };

  assert.equal(context.simStatusText_('Fresh', stamps, null, now), '\u2705 Sim 2d old');
  assert.equal(context.simStatusText_('Today', stamps, null, now), '\u2705 Sim today');
  assert.equal(context.simStatusText_('Stale', stamps, null, now), '\u26a0\ufe0f Sim 12d old');
  assert.equal(context.simStatusText_('Nobody', stamps, null, now), none);

  // Falls back to the Loot sheet's contender names when no date was ever recorded
  const simmed = new Set(['legacy']);
  assert.equal(context.simStatusText_('Legacy', stamps, simmed, now), '\u2705 Simmed');
  assert.equal(context.simStatusText_('', stamps, simmed, now), '');
});

test('recordSimTimestamps_ keeps the newest time per character', () => {
  const { context } = loadAppsScript();
  const now = Date.now();
  context.recordSimTimestamps_([{ name: 'Ainocee', time: now - 5000 }]);
  context.recordSimTimestamps_([{ name: 'ainocee', time: now - 100000 }]);
  assert.equal(context.getSimTimestamps_()['ainocee'], now - 5000);

  // A missing or future date is treated as "imported now" rather than "unknown"
  context.recordSimTimestamps_([{ name: 'Nodate', time: 0 }, { name: 'Future', time: now + 1e9 }]);
  const stamps = context.getSimTimestamps_();
  assert.ok(stamps['nodate'] > 0 && stamps['nodate'] <= Date.now());
  assert.ok(stamps['future'] <= Date.now());
});

test('a main added low in the Config list stays a main and is not read as an alt', () => {
  const { context, sheets, spreadsheet } = loadAppsScript();
  const sheet = spreadsheet.insertSheet('Config');
  const rows = [
    ['Configuration', 'Hour', 'Minute', 'AM/PM', '', 'Raid Days', '', '', ''],
    ['Region', 'us', '', '', '', 'Tuesday', 'Wednesday', 'Thursday', 'Monday'],
    ['Realm Slug', 'kiljaeden', '', '', '', true, true, false, false],
    ['Guild Slug', 'prey', '', '', '', 'Friday', 'Saturday', 'Sunday', '—'],
    ['Raid Start Time', 7, ':00', 'PM', '', false, false, false, ''],
    ['Raid End Time', 10, ':00', 'PM', '', '', '', '', ''],
    ['Time Zone', 'America/Los_Angeles (Pacific PT)', '', '', '', '', '', '', ''],
    ['Main Character Name', 'Assigned Raid Spec (Dropdown)', 'Roster Role (Dropdown)', 'Realm (If not in guild)', '',
     'Alt Character Name', 'Main Character (Owner - Dropdown)', 'Assigned Spec (Dropdown)', 'Realm (If not in guild)']
  ];
  // 24 mains fills rows 9-32, well past the old row-31 cutoff that swallowed them into the alt table.
  for (let i = 1; i <= 24; i++) rows.push(['Main' + i, 'Fire', '⚔️ Raider', '', '', '', '', '', '']);
  rows[8][5] = 'Alty';      // one real side-by-side alt on the first roster row
  rows[8][6] = 'Main1';
  rows[8][7] = 'Frost';
  sheet.getRange(1, 1, rows.length, 9).setValues(rows);

  const config = context.getConfigurationFromSheet();
  assert.equal(config.MEMBERS_TO_TRACK.length, 24);
  assert.equal(config.MEMBERS_TO_TRACK[23].name, 'Main24');
  assert.deepEqual(Array.from(config.ALTS_TO_TRACK.map(a => a.name)), ['Alty']);
  assert.equal(sheets.Config, sheet);
});

test('findLegacyAltHeaderRow only matches a stacked-alt header, never a character name', () => {
  const { context } = loadAppsScript();
  const mains = [['Main Character Name'], ['Rawria'], ['Nimidk']];
  assert.equal(context.findLegacyAltHeaderRow(new Array(8).fill(['']).concat(mains.slice(1))), -1);
  const withHeader = new Array(8).fill(['']).concat([['Rawria'], ['Alts to Track'], ['Waffleztotem']]);
  assert.equal(context.findLegacyAltHeaderRow(withHeader), 9);
});

test('the Blizzard item id is read from the cell note, and legacy lead-ins still parse', () => {
  const { context } = loadAppsScript();
  // New layout: the note carries the id and the cell text is council notes only
  assert.equal(context.parseLootItemId_('1. Ainocee [Score: 1.43]', 'Blizzard ID: 268230'), 268230);
  // Legacy sheets keep it inside the text
  assert.equal(context.parseLootItemId_('Blizzard ID: 268230 - 1. Ainocee', ''), 268230);
  assert.equal(context.parseLootItemId_('1. Ainocee', ''), null);
  assert.equal(context.stripLootItemId_('Blizzard ID: 268230 - 1. Ainocee'), '1. Ainocee');
  assert.equal(context.stripLootItemId_('1. Ainocee'), '1. Ainocee');
  assert.equal(context.lootItemIdNote_(268230), 'Blizzard ID: 268230');
  assert.equal(context.lootItemIdNote_(null), '');
});

test('percent cells parse whether Sheets hands back text or the number it stores', () => {
  const { context } = loadAppsScript();
  // Sheets coerces the '100%' string the attendance sync writes into the number 1.
  assert.equal(context.parsePercentFraction_(1), 1);
  assert.equal(context.parsePercentFraction_(0.33), 0.33);
  assert.equal(context.parsePercentFraction_('83%'), 0.83);
  assert.equal(context.parsePercentFraction_('83'), 0.83);
  assert.equal(context.parsePercentFraction_(83), 0.83);
  assert.equal(context.parsePercentFraction_('N/A'), null);
  assert.equal(context.parsePercentFraction_(''), null);
  assert.equal(context.parsePercentFraction_(null), null);
  assert.equal(context.formatPercentLabel_(0.33), '33%');
  assert.equal(context.formatPercentLabel_(1), '100%');
  assert.equal(context.formatPercentLabel_('N/A'), null);
});

test('the Reliability Index actually moves with attendance', () => {
  const { context } = loadAppsScript();
  const contextMap = {
    reliable: { role: '⚔️ Raider', attPct: '100%', onTimePct: '100%', isRaidReady: true },
    absent: { role: '🛡️ Trial', attPct: '17%', onTimePct: '17%', isRaidReady: true }
  };
  const good = context.calculatePriorityScore(10, 'Reliable', false, contextMap);
  const bad = context.calculatePriorityScore(10, 'Absent', false, contextMap);
  assert.equal(good.reliabilityFactor, 1);
  assert.equal(bad.reliabilityFactor, 0.4, 'a 17% attendance raider sits on the 0.40 floor');
  assert.ok(bad.score < good.score, 'a 17% Trial cannot outrank a 100% raider on the same upgrade');
});

test('join dates and eligible-night samples parse out of the cells they live in', () => {
  const { context } = loadAppsScript();
  assert.equal(context.parseJoinedDateKey_('2026-09-02'), '2026-09-02');
  assert.equal(context.parseJoinedDateKey_(new Date(2026, 8, 2)), '2026-09-02');
  assert.equal(context.parseJoinedDateKey_('9/2/2026'), '2026-09-02');
  assert.equal(context.parseJoinedDateKey_(''), null);
  assert.equal(context.parseJoinedDateKey_('not a date'), null);
  assert.equal(context.formatJoinedLabel_('2026-08-23'), 'Aug 23');
  assert.equal(context.formatJoinedLabel_(''), '');
  // The denominator is the raider's own eligible nights, not the season total.
  assert.equal(context.parseAttendanceSample_('10 / 12'), 12);
  assert.equal(context.parseAttendanceSample_('3 / 3 \u00b7 since Sep 16'), 3);
  assert.equal(context.parseAttendanceSample_(''), null);
});

test('a raider below the minimum sample gets the neutral baseline, not their measured percentage', () => {
  const { context } = loadAppsScript();
  const contextMap = {
    veteran: { role: '\u2694\ufe0f Raider', attPct: '83%', onTimePct: '83%', attSample: 12, isRaidReady: true },
    // One night, attended: 100% is as meaningless as the 0% of someone who missed their only night.
    newbie: { role: '\u2694\ufe0f Raider', attPct: '100%', onTimePct: '100%', attSample: 1, isRaidReady: true },
    newbieabsent: { role: '\u2694\ufe0f Raider', attPct: '0%', onTimePct: 'N/A', attSample: 1, isRaidReady: true }
  };
  const vet = context.calculatePriorityScore(10, 'Veteran', false, contextMap);
  const fresh = context.calculatePriorityScore(10, 'Newbie', false, contextMap);
  const freshAbsent = context.calculatePriorityScore(10, 'NewbieAbsent', false, contextMap);

  assert.equal(fresh.reliabilityFactor, 0.85, 'a perfect 1/1 is capped at the baseline, not 1.00');
  assert.ok(freshAbsent.reliabilityFactor > 0.4 && freshAbsent.reliabilityFactor < 0.85,
    'a 0/1 is pulled below the baseline but not onto the 0.40 floor');
  assert.equal(fresh.attPct, '1 raid \u00b7 new', 'the badge says new rather than pretending to a season figure');
  assert.ok(fresh.score < context.calculatePriorityScore(10, 'Reliable', false,
    { reliable: { role: '\u2694\ufe0f Raider', attPct: '100%', onTimePct: '100%', attSample: 12, isRaidReady: true } }).score,
    'a one-night newcomer cannot reach a full-attendance raider');
  assert.ok(freshAbsent.score > context.calculatePriorityScore(10, 'Absent', false,
    { absent: { role: '\u2694\ufe0f Raider', attPct: '0%', onTimePct: '0%', attSample: 12, isRaidReady: true } }).score,
    'but a genuine season-long absentee still scores below them');

  // A full sample is still judged on its real numbers.
  assert.equal(vet.reliabilityFactor, 0.83);
  assert.ok(fresh.reliabilityFactor > vet.reliabilityFactor,
    'the baseline sits just above an 83% veteran - a fixed baseline always will, for someone below it');
});

test('attendance is read from the leaderboard only, not the kill counts in the ledger', () => {
  const gas = loadAppsScript();
  const att = gas.spreadsheet.insertSheet('Attendance & History');
  const rows = [
    ['🏛️ GUILD RAID ATTENDANCE', '', '', '', ''],
    ['', '', '', '', ''],
    ['Rank', 'Raider Name', 'Assigned Spec', 'Attendance %', 'On-Time %'],
    // Sheets stores these percent-formatted cells as numbers, which is what broke the old parse.
    [1, 'Ainocee', 'Fury', 1, 1],
    [2, 'Tungris', 'Blood', 0.58, 0.5],
    [3, 'scylus', 'Havoc', 0.08, 'N/A'],
    ['', '', '', '', ''],
    ['📜 HISTORICAL GUILD RAID NIGHT LEDGER', '', '', '', ''],
    ['Raid Date', 'Raid Title', 'Bosses Defeated', 'Kills', 'Guild Raiders'],
    ['Sep 22, 2026', 'The Venomous Abyss', 'Nek\'zali', 8, 'Ainocee, Tungris']
  ];
  att.getRange(1, 1, rows.length, 5).setValues(rows);

  const map = gas.context.getRosterContextMap(gas.spreadsheet);
  assert.equal(map['ainocee'].attPct, '100%');
  assert.equal(map['tungris'].attPct, '58%');
  assert.equal(map['scylus'].attPct, '8%');
  assert.equal(map['scylus'].onTimePct, 'N/A');
  assert.equal(map['raid date'], undefined, 'ledger rows are not read as raiders');
  assert.equal(map['raider name'], undefined, 'the header row is not read as a raider');
});

test('three socket counters collapse into one cell that stays quiet when clean', () => {
  const { context } = loadAppsScript();
  assert.equal(context.formatSocketSummary_(5, 0, 0), '5');
  assert.equal(context.formatSocketSummary_(5, 1, 0), '5 · 1 empty');
  assert.equal(context.formatSocketSummary_(5, 1, 2), '5 · 1 empty · 2 imperfect');
  assert.equal(context.formatSocketSummary_(0, 0, 0), '0');
});

test('installing scheduled refreshes is idempotent and leaves other triggers alone', () => {
  const { context } = loadAppsScript();
  const plan = context.planTriggerInstall_([
    { handlerFunction: 'updateAllCharacterDataWithBonuses' },
    { handlerFunction: 'updateAllCharacterDataWithBonuses' },
    { handlerFunction: 'someoneElsesTrigger' }
  ]);
  assert.deepEqual(Array.from(plan.create), ['syncWarcraftLogsSeasonAttendance']);
  assert.equal(plan.remove.length, 1, 'the duplicate is removed, the original kept');
  assert.equal(plan.remove[0].handlerFunction, 'updateAllCharacterDataWithBonuses');
  assert.deepEqual(context.planTriggerInstall_([]).create.length, 2);
});
