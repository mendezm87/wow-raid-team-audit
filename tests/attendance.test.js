// Attendance sync: archive persistence, bench credit, alt resolution, ledger migration, trigger safety.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAppsScript } = require('./helpers/appsScript');

const ROSTER = Array.from({ length: 14 }, (_, i) => ({ name: 'Raider' + i, expectedSpec: 'Fire' }))
  .concat([{ name: 'Benchy', expectedSpec: 'Holy' }]);
const TWELVE = ROSTER.slice(0, 12).map(r => r.name);

const pacific7pm = day => new Date(day + 'T19:00:00-07:00').getTime();
function makeReport(code, day, kills) {
  return {
    code, title: 'Venomous Abyss', startTime: pacific7pm(day), endTime: pacific7pm(day) + 3 * 3600e3,
    fights: [
      { id: 1, name: "Nek'zali the Soulcoiler", kill: kills > 0, difficulty: 4, startTime: 60000, endTime: 400000 },
      { id: 2, name: 'Entombed Sentinels', kill: kills > 1, difficulty: 4, startTime: 900000, endTime: 1300000 }
    ]
  };
}

/** Fake Warcraft Logs GraphQL API. `wcl.reports` = report list; attendees/firstPull keyed by report code. */
function createWcl() {
  const wcl = { reports: [], attendees: {}, firstPull: {}, detailQueries: 0 };
  wcl.fetch = (url, options) => {
    const query = JSON.parse(options.payload).query;
    let body;
    if (query.includes('reports(')) {
      body = { data: { reportData: { reports: { data: wcl.reports } } } };
    } else {
      wcl.detailQueries++;
      const code = query.match(/code: "(\w+)"/)[1];
      const names = query.includes('fightIDs: [1]') && wcl.firstPull[code] ? wcl.firstPull[code] : wcl.attendees[code];
      body = { data: { reportData: { report: { playerDetails: { data: { playerDetails: { dps: names.map(name => ({ name })) } } } } } } };
    }
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify(body) };
  };
  return wcl;
}

function setup(opts = {}) {
  const wcl = createWcl();
  const gas = loadAppsScript({
    withUi: opts.withUi !== false,
    fetch: wcl.fetch,
    scriptProperties: { wcl_token: 'token', wcl_token_expiry: String(Date.now() + 1e7), WCL_CLIENT_ID: 'id', WCL_CLIENT_SECRET: 'secret' }
  });
  let captured = null;
  gas.context.getConfigurationFromSheet = () => ({
    REGION: 'us', GUILD_NAME_SLUG: 'prey', GUILD_REALM_SLUG: 'kiljaeden', RAID_DAYS: 'Tuesday, Wednesday',
    MEMBERS_TO_TRACK: ROSTER, ALT_TO_MAIN_MAP: { raiderzeroalt: 'Raider0' }
  });
  gas.context.createAttendanceAndHistorySheet = (leaderboard, ledger, total) => { captured = { leaderboard, ledger, total }; };
  const sync = () => { gas.context.syncWarcraftLogsSeasonAttendance(); return captured; };
  const player = name => captured.leaderboard.find(p => p.name === name);
  return { gas, wcl, sync, player };
}

test('bench credit, alts, lateness, and history beyond the WCL report window', () => {
  const { gas, wcl, sync, player } = setup();
  wcl.attendees.AAA = [...TWELVE.slice(1), 'RaiderZeroAlt'];
  wcl.firstPull.AAA = TWELVE.slice(1, 10);
  wcl.attendees.BBB = TWELVE;
  wcl.firstPull.BBB = TWELVE;
  wcl.reports = [makeReport('AAA', '2026-09-15', 2), makeReport('BBB', '2026-09-16', 1)];
  // Bench saved with the ledger's display-date text, as the bench dialog does
  gas.scriptProps.setProperty('bench_records', JSON.stringify({ 'Tue, Sep 15, 2026': ['Benchy'] }));

  let result = sync();
  assert.equal(result.total, 2);
  assert.equal(player('Benchy').raidsAttended, 1, 'benched raider gets attendance credit');
  assert.equal(player('Raider0').raidsAttended, 2, 'alt attendance counts for the main');
  assert.equal(player('Raider11').lateCount, 1, 'missing the first pull counts as late');
  const archive = gas.sheets['Attendance Archive'];
  assert.ok(archive.isHidden(), 'archive sheet is hidden');
  assert.equal(archive.data.length - 1, 2);

  // Sep 15 scrolls out of WCL's window; Sep 16 unchanged; new night Sep 22
  wcl.detailQueries = 0;
  wcl.attendees.CCC = TWELVE;
  wcl.firstPull.CCC = TWELVE;
  wcl.reports = [makeReport('BBB', '2026-09-16', 1), makeReport('CCC', '2026-09-22', 2)];
  result = sync();
  assert.equal(result.total, 3, 'archived night still counts');
  assert.deepEqual(Array.from(result.ledger, l => l.dateKey), ['2026-09-22', '2026-09-16', '2026-09-15']);
  assert.equal(player('Benchy').raidsAttended, 1);
  assert.equal(wcl.detailQueries, 2, 'settled, unchanged nights are not re-queried');

  // Benching after the fact still applies to an archived-only night
  gas.scriptProps.setProperty('bench_records', JSON.stringify({ 'Tue, Sep 15, 2026': ['Benchy'], 'Tue, Sep 22, 2026': ['Benchy'] }));
  wcl.reports = [makeReport('CCC', '2026-09-22', 2)];
  sync();
  assert.equal(player('Benchy').raidsAttended, 2);
  assert.equal(player('Benchy').attendancePct, 67);
});

test('first sync migrates the existing Attendance & History ledger into the archive', () => {
  const { gas, wcl, sync, player } = setup();
  const ledger = gas.spreadsheet.insertSheet('Attendance & History');
  const ten = ROSTER.slice(0, 10).map(r => r.name).join(', ');
  ledger.getRange(1, 1, 5, 10).setValues([
    ['📜 HISTORICAL GUILD RAID NIGHT LEDGER', '', '', '', '', '', '', '', '', ''],
    ['Raid Date', 'Raid Title', 'Bosses Defeated', 'Kills', 'Guild Raiders', 'Bench', 'On-Time Raiders', 'Late Arrivals', 'Warcraft Logs Link', ''],
    ['Wed, Sep 9, 2026', '📦 [Optional / PUG] Venomous Abyss', "Nek'zali the Soulcoiler", 1, 10, 'None', ten, 'None', '📊 View Log (OLD2)', ''],
    ['Tue, Sep 8, 2026', 'Venomous Abyss', "Nek'zali the Soulcoiler, Entombed Sentinels", 2, 12, 'None', TWELVE.slice(0, 11).join(', '), 'Raider11', '📊 View Log (OLD1)', ''],
    ['9/1/2026', 'Venomous Abyss', 'Progression Wipes (7 pulls)', 0, 12, 'None', TWELVE.join(', '), 'None', '📊 View Log (OLD0)', '']
  ]);
  wcl.attendees.BBB = TWELVE;
  wcl.firstPull.BBB = TWELVE;
  wcl.reports = [makeReport('BBB', '2026-09-16', 1)];
  gas.scriptProps.setProperty('bench_records', JSON.stringify({ 'Tue, Sep 8, 2026': ['Benchy'] }));

  const result = sync();
  assert.equal(result.total, 3, 'Sep 16 + Sep 8 + Sep 1 official; Sep 9 stays optional');
  const sep9 = result.ledger.find(l => l.dateKey === '2026-09-09');
  assert.equal(sep9.isOfficial, false);
  const sep1 = result.ledger.find(l => l.dateKey === '2026-09-01');
  assert.equal(sep1.isOfficial, true, 'M/D/YYYY dates keep their real weekday');
  assert.match(sep1.bossesDefeated, /Progression Wipes \(7 pulls\)/);
  assert.equal(player('Raider11').raidsAttended, 3);
  assert.equal(player('Raider11').lateCount, 1);
  assert.equal(player('Benchy').raidsAttended, 1);
});

test('runs from a time-driven trigger (no UI) without calling getUi', () => {
  const { gas, wcl, sync } = setup({ withUi: false });
  wcl.attendees.BBB = TWELVE;
  wcl.firstPull.BBB = TWELVE;
  wcl.reports = [makeReport('BBB', '2026-09-16', 1)];
  const result = sync();
  assert.equal(result.total, 1);
  assert.equal(gas.alerts.length, 0);
  assert.ok(gas.logs.some(l => l.startsWith('Warcraft Logs Synced!')), 'completion message is logged instead');
});

test('trigger run fails loudly (throws) on WCL errors so Google emails the owner', () => {
  const { gas, sync } = setup({ withUi: false });
  gas.scriptProps.deleteProperty('wcl_token');
  gas.scriptProps.deleteProperty('WCL_CLIENT_SECRET');
  assert.throws(() => sync(), /Authentication Failed/);
});

test('full audit reports problems without calling getUi when run from a trigger', () => {
  const { loadAppsScript: load } = require('./helpers/appsScript');
  const gas = load({ withUi: false, scriptProperties: { CLIENT_ID: 'id', CLIENT_SECRET: 'secret', blizzard_token: 't', blizzard_token_expiry: String(Date.now() + 1e7) } });
  gas.context.getConfigurationFromSheet = () => ({ REGION: 'us', GUILD_REALM_SLUG: 'kiljaeden', GUILD_NAME_SLUG: 'prey', MEMBERS_TO_TRACK: [], ALTS_TO_TRACK: [] });
  gas.context.fetchBlizzardEndpoint = () => null; // roster fetch fails
  assert.throws(() => gas.context.updateAllCharacterDataWithBonuses(), /Roster Fetch Failed/);
});
