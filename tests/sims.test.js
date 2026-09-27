// Sim imports: only Config roster mains count, and earlier raiders' rankings are preserved.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAppsScript } = require('./helpers/appsScript');

/** Sandbox with a Config roster (mains in column A, alts in column F) and a small Loot sheet. */
function setup(fetchImpl) {
  const gas = loadAppsScript({ fetch: fetchImpl });
  const config = gas.spreadsheet.insertSheet('Config');
  const configRows = Array.from({ length: 8 }, () => new Array(9).fill(''));
  configRows.push(['Summzr', 'Fire', '', '', '', 'Summzralt', 'Summzr', 'Frost', '']);
  configRows.push(['Wafflezealot', 'Retribution', '', '', '', '', '', '', '']);
  config.getRange(1, 1, configRows.length, 9).setValues(configRows);

  const loot = gas.spreadsheet.insertSheet('Loot & Chase Items');
  loot.getRange(1, 1, 3, 13).setValues([
    ['Boss / Source', 'Chase Item / Drop', 'Slot', 'Difficulty', 'Drop ilvl', 'Target', '', '', '', '', '', '', 'Notes'],
    ['⚔️ BOSS 1', '═══', '', '', '', '', '', '', '', '', '', '', ''],
    ['Boss 1', 'Soulcoil Siphon', 'Trinket 1', 'Heroic', 318, 'All', '', '', '', '', '', '', '']
  ]);
  return gas;
}

test('earlier rankings are read back in both note formats (the old parser dropped them)', () => {
  const { context } = loadAppsScript();
  const roster = new Set(['summzr', 'wafflezealot', 'healbot']);
  const raidbots = 'Raidbots Sim Upgrades: 1. Summzr [Score: 4.62] (+4.2% [Tier Catalyzed] | 👑 Veteran | 100%) | 2. Wafflezealot [Score: 3.1] (+3.5% | ⚔️ Raider | 90% | ⚠️ Unenchanted) | 3. Randompug [Score: 9] (+9.9%)';
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.parseSimUpgradeNotes_(raidbots, roster))),
    [{ name: 'Summzr', pct: 4.2, isCatalyzed: true }, { name: 'Wafflezealot', pct: 3.5, isCatalyzed: false }],
    'non-roster Randompug is dropped'
  );
  const qe = 'Sim / QE Live Upgrades: 1. Healbot [Score: 2.5] (+2.5% | ⚔️ Raider | 100%)';
  assert.equal(context.parseSimUpgradeNotes_(qe, roster)[0].name, 'Healbot');
  assert.equal(context.parseSimUpgradeNotes_('Blizzard ID: 12345', roster).length, 0);
});

test('Config roster = mains only (alts and header excluded)', () => {
  const gas = setup();
  assert.deepEqual([...gas.context.getRosterMainNamesSet(gas.spreadsheet)].sort(), ['summzr', 'wafflezealot']);
});

function raidbotsFetchAll(player) {
  return () => [{ getResponseCode: () => 200, getContentText: () => JSON.stringify({ simbot: { player }, sim: { players: [{ name: player }] } }) }];
}

test('Raidbots sim from someone not on the Config roster is rejected with a clear error', () => {
  const gas = setup();
  gas.context.UrlFetchApp.fetchAll = raidbotsFetchAll('Randompug');
  const result = gas.context.processAndIngestRaidbotsSims('https://www.raidbots.com/simbot/report/hKLdYXNgXqzVc919eAf2vp');
  assert.equal(result.success, false);
  assert.match(result.error, /Randompug is not a main character on the Config sheet/);
  assert.equal(gas.sheets['Loot & Chase Items'].data[2][12], '', 'sheet untouched');
});

test('Raidbots sim from an alt is rejected too', () => {
  const gas = setup();
  gas.context.UrlFetchApp.fetchAll = raidbotsFetchAll('Summzralt');
  const result = gas.context.processAndIngestRaidbotsSims('https://www.raidbots.com/simbot/report/hKLdYXNgXqzVc919eAf2vp');
  assert.equal(result.success, false);
  assert.match(result.error, /Summzralt/);
});

test('QE Live report from someone not on the Config roster is rejected', () => {
  const gas = setup(() => ({
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({ playername: 'Randomhealer', spec: 'Holy Priest', results: [] })
  }));
  const result = gas.context.processAndIngestQELiveReport('https://questionablyepic.com/live/upgradereport/abcdefghijkl');
  assert.equal(result.success, false);
  assert.match(result.error, /Randomhealer is not a main character on the Config sheet/);
});

/** Sandbox whose Loot sheet has the current 14-column layout (Runners-Up in N). */
function setupWideLoot() {
  const gas = loadAppsScript();
  const config = gas.spreadsheet.insertSheet('Config');
  const configRows = Array.from({ length: 8 }, () => new Array(9).fill(''));
  configRows.push(['Summzr', 'Fire', '', '', '', '', '', '', '']);
  config.getRange(1, 1, configRows.length, 9).setValues(configRows);

  const loot = gas.spreadsheet.insertSheet('Loot & Chase Items');
  const blank = new Array(14).fill('');
  const header = ['Boss / Source', 'Chase Item / Drop', 'Slot', 'Difficulty', 'Drop ilvl',
    'Target Specs / Roles', 'Top Contender (Assigned)', 'Current Equipped Item', 'Equipped ilvl',
    'Upgrade Delta (+ilvl / %DPS)', 'Loot Priority', 'Sim Status / Last Updated',
    'Loot Council Notes', 'Runners-Up'];
  const item = blank.slice();
  ['Boss 1', 'Soulcoil Siphon', 'Trinket 1', 'Heroic', 318, 'All'].forEach((v, i) => { item[i] = v; });
  loot.getRange(1, 1, 2, 14).setValues([header, item]);
  return gas;
}

function droptimizerFetchAll(player, items) {
  return () => [{
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({
      simbot: { player, droptimizer: { items } },
      sim: { players: [{ name: player }] }
    })
  }];
}

test('a sim item missing from the catalog is added without breaking the 14-column write', () => {
  const gas = setupWideLoot();
  gas.context.UrlFetchApp.fetchAll = droptimizerFetchAll('Summzr', [
    { name: 'Unlisted Band of Tides', pct: 3.2, slot: 'Ring 1' }
  ]);
  const result = gas.context.processAndIngestRaidbotsSims('https://www.raidbots.com/simbot/report/hKLdYXNgXqzVc919eAf2vp');
  assert.equal(result.success, true, result && result.error);

  const data = gas.sheets['Loot & Chase Items'].data;
  data.forEach((row, i) => assert.equal(row.length, 14, `row ${i + 1} is ${row.length} wide`));

  const added = data.find(row => row[1] === 'Unlisted Band of Tides');
  assert.ok(added, 'the new item was registered on the sheet');
  assert.equal(added[10], '💠 Secondary', 'Loot Priority is derived from the slot, not left as raw text');
});

test('short rows and their note arrays are squared to the sheet width before writing', () => {
  const { context } = loadAppsScript();
  const rows = [new Array(14).fill('x'), ['a', 'b'], new Array(16).fill('y')];
  context.padLootRows_(rows, 14);
  assert.deepEqual(rows.map(r => r.length), [14, 14, 14]);
  assert.equal(rows[1][13], '', 'padding is blank, not undefined');

  const notes = ['keep'];
  notes[3] = 'late';
  assert.deepEqual(context.padRowArray_(notes, 4, ''), ['keep', '', '', 'late']);
});
