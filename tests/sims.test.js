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

// ── Difficulty guard ────────────────────────────────────────────────────────────────
// The sample titles and field shapes below are copied from real reports:
// Raidbots hKLdYXNgXqzVc919eAf2vp and QE Live eytcfyizaxrh.

test('a sim report states its raid difficulty, and Raid Finder is not shadowed by "Raid"', () => {
  const { context } = loadAppsScript();
  assert.equal(
    context.raidbotsReportDifficulty({ simbot: { publicTitle: 'Droptimizer • The Venomous Abyss • Mythic • Myth 6/6' } }),
    'Mythic'
  );
  assert.equal(
    context.raidbotsReportDifficulty({ simbot: { publicTitle: 'Droptimizer • The Venomous Abyss • Raid Finder' } }),
    'Raid Finder',
    '"Raid Finder" wins over a bare "Raid" in the same title'
  );
  assert.equal(context.raidbotsReportDifficulty({ simbot: { simType: 'droptimizer' } }), '', 'no title, no guess');

  // QE Live: ufSettings.raid is an array of indices into RAID_DIFFICULTY_LABELS.
  assert.equal(context.qeReportDifficulty({ ufSettings: { raid: [3], dungeon: 7 }, results: [] }), 'Mythic');
  assert.equal(context.qeReportDifficulty({ ufSettings: { raid: [2] }, results: [] }), 'Heroic');
  // Older reports stored no ufSettings, so the raid rows' dropDifficulty is the fallback.
  assert.equal(
    context.qeReportDifficulty({ results: [{ dropLoc: 'Dungeon', dropDifficulty: 7 }, { dropLoc: 'Raid', dropDifficulty: 2 }] }),
    'Heroic',
    'the dungeon keystone level is not mistaken for a raid difficulty'
  );
  assert.equal(context.qeReportDifficulty({ results: [] }), '');
});

test('an unreadable sim difficulty is allowed through; a wrong one is not', () => {
  const { context } = loadAppsScript();
  const mythic = { key: 'mythic', label: 'Mythic', ilvl: 334 };
  assert.equal(context.checkSimDifficulty('Mythic', mythic).ok, true);
  assert.equal(context.checkSimDifficulty('', mythic).ok, true, 'a missing label must not block an import');

  const bad = context.checkSimDifficulty('Heroic', mythic, 'Ethertide');
  assert.equal(bad.ok, false);
  assert.match(bad.error, /Ethertide's sim was run at Heroic/);
  assert.match(bad.error, /sheet is set to Mythic/);
  assert.match(bad.error, /4b\. Toggle Loot Difficulty/, 'the message says how to fix it either way');
});

test('a Raidbots sim run at the wrong difficulty is skipped, not ranked', () => {
  const gas = setupWideLoot();
  gas.context.PropertiesService.getScriptProperties().setProperty('loot_difficulty', 'mythic');
  gas.context.UrlFetchApp.fetchAll = () => [{
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({
      simbot: { player: 'Summzr', publicTitle: 'Droptimizer • The Venomous Abyss • Heroic • Hero 6/6', droptimizer: { items: [{ name: 'Soulcoil Siphon', pct: 9.9, slot: 'Trinket 1' }] } },
      sim: { players: [{ name: 'Summzr' }] }
    })
  }];
  const result = gas.context.processAndIngestRaidbotsSims('https://www.raidbots.com/simbot/report/hKLdYXNgXqzVc919eAf2vp');
  assert.equal(result.success, false);
  assert.match(result.error, /Summzr \(Heroic\)/);
  assert.match(result.error, /set to Mythic/);
  assert.equal(gas.sheets['Loot & Chase Items'].data[1][12], '', 'nothing was written to the sheet');
});

test('a QE Live report run at the wrong difficulty is refused', () => {
  const gas = setup(() => ({
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({
      playername: 'Summzr', spec: 'Restoration Shaman',
      ufSettings: { raid: [2] },
      results: [{ item: 1, dropLoc: 'Raid', dropType: 'drop', dropDifficulty: 2, level: 318, percDiff: 3.1 }]
    })
  }));
  gas.context.PropertiesService.getScriptProperties().setProperty('loot_difficulty', 'mythic');
  const result = gas.context.processAndIngestQELiveReport('https://questionablyepic.com/live/upgradereport/eytcfyizaxrh');
  assert.equal(result.success, false);
  assert.match(result.error, /run at Heroic difficulty/);
});

test('a QE Live report keeps only the raid rows at the sheet difficulty', () => {
  const gas = setup(() => ({
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({
      playername: 'Summzr', spec: 'Restoration Shaman',
      ufSettings: { raid: [2] },
      results: [
        { item: 12345, dropLoc: 'Raid', dropType: 'drop', dropDifficulty: 2, level: 318, percDiff: 3.1 },
        { item: 12345, dropLoc: 'Raid', dropType: 'drop', dropDifficulty: 3, level: 334, percDiff: 9.9 },
        { item: 12345, dropLoc: 'Raid', dropType: 'bonus', dropDifficulty: 2, level: 318, percDiff: 8.8 }
      ]
    })
  }));
  // Sheet on Heroic, so the Mythic row and the bonus roll are both dropped.
  gas.spreadsheet.getSheetByName('Loot & Chase Items').getRange(3, 13, 1, 1).setNotes([['Blizzard ID: 12345']]);
  const result = gas.context.processAndIngestQELiveReport('https://questionablyepic.com/live/upgradereport/eytcfyizaxrh');
  assert.equal(result.success, true, result && result.error);
  const notes = gas.sheets['Loot & Chase Items'].data[2][12].toString();
  assert.match(notes, /Summzr/);
  assert.match(notes, /3\.1/, 'the Heroic figure was used');
  assert.ok(!/9\.9|8\.8/.test(notes), 'the Mythic row and the bonus roll were both ignored');
});

// ── The Cloudflare 404 that blocked every healer import ─────────────────────────────

test('QE Live fetches send a browser user agent, because Apps Script\'s own gets a 404 page', () => {
  const seen = [];
  const gas = loadAppsScript({
    fetch: (url, options) => {
      seen.push(options);
      // Reproduce the block: the default Apps Script UA is answered with a 404 HTML page.
      if (!options || !options.headers || !options.headers['User-Agent']) {
        return { getResponseCode: () => 404, getContentText: () => '<!DOCTYPE html><html>Page Not Found</html>' };
      }
      // A real response is double-encoded: a JSON string holding the report JSON.
      return {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify(JSON.stringify({
          playername: 'Summzr', spec: 'Restoration Shaman',
          ufSettings: { raid: [2] },
          results: [{ item: 12345, dropLoc: 'Raid', dropType: 'drop', dropDifficulty: 2, level: 318, percDiff: 3.1 }]
        }))
      };
    }
  });
  const config = gas.spreadsheet.insertSheet('Config');
  const rows = Array.from({ length: 8 }, () => new Array(9).fill(''));
  rows.push(['Summzr', 'Fire', '', '', '', '', '', '', '']);
  config.getRange(1, 1, rows.length, 9).setValues(rows);
  const loot = gas.spreadsheet.insertSheet('Loot & Chase Items');
  loot.getRange(1, 1, 3, 13).setValues([
    ['Boss / Source', 'Chase Item / Drop', 'Slot', 'Difficulty', 'Drop ilvl', 'Target', '', '', '', '', '', '', 'Notes'],
    ['⚔️ BOSS 1', '═══', '', '', '', '', '', '', '', '', '', '', ''],
    ['Boss 1', 'Soulcoil Siphon', 'Trinket 1', 'Heroic', 318, 'All', '', '', '', '', '', '', '']
  ]);
  loot.getRange(3, 13, 1, 1).setNotes([['Blizzard ID: 12345']]);

  const result = gas.context.processAndIngestQELiveReport('https://questionablyepic.com/live/upgradereport/eytcfyizaxrh');
  assert.equal(result.success, true, result && result.error);
  assert.ok(seen[0] && seen[0].headers && /Mozilla/.test(seen[0].headers['User-Agent']), 'the first attempt carries a browser UA');
  assert.match(gas.sheets['Loot & Chase Items'].data[2][12].toString(), /Summzr/, 'the double-encoded body was parsed');
});

test('a 404 HTML page is reported as a block, not as a missing report', () => {
  const gas = setup(() => ({ getResponseCode: () => 404, getContentText: () => '<!DOCTYPE html><html>Page Not Found</html>' }));
  const result = gas.context.processAndIngestQELiveReport('https://questionablyepic.com/live/upgradereport/eytcfyizaxrh');
  assert.equal(result.success, false);
  assert.match(result.error, /will not serve this report to Google Apps Script/);

  const missing = setup(() => ({ getResponseCode: () => 404, getContentText: () => '{"error":"Report not found","ErrorCode":"NoSuchKey"}' }));
  const r2 = missing.context.processAndIngestQELiveReport('https://questionablyepic.com/live/upgradereport/eytcfyizaxrh');
  assert.match(r2.error, /has no report with id eytcfyizaxrh/);
});

test('a healer report forwarded by the bot is ingested without any fetch at all', () => {
  let fetches = 0;
  const gas = loadAppsScript({ fetch: () => { fetches++; throw new Error('must not fetch'); } });
  const config = gas.spreadsheet.insertSheet('Config');
  const rows = Array.from({ length: 8 }, () => new Array(9).fill(''));
  rows.push(['Summzr', 'Fire', '', '', '', '', '', '', '']);
  config.getRange(1, 1, rows.length, 9).setValues(rows);
  const loot = gas.spreadsheet.insertSheet('Loot & Chase Items');
  loot.getRange(1, 1, 3, 13).setValues([
    ['Boss / Source', 'Chase Item / Drop', 'Slot', 'Difficulty', 'Drop ilvl', 'Target', '', '', '', '', '', '', 'Notes'],
    ['⚔️ BOSS 1', '═══', '', '', '', '', '', '', '', '', '', '', ''],
    ['Boss 1', 'Soulcoil Siphon', 'Trinket 1', 'Heroic', 318, 'All', '', '', '', '', '', '', '']
  ]);
  loot.getRange(3, 13, 1, 1).setNotes([['Blizzard ID: 12345']]);

  const report = {
    id: 'eytcfyizaxrh', playername: 'Summzr', spec: 'Restoration Shaman',
    ufSettings: { raid: [2] },
    results: [{ item: 12345, dropLoc: 'Raid', dropType: 'drop', dropDifficulty: 2, level: 318, percDiff: 3.1 }]
  };

  // The bot posts both the link and the report it already fetched; the link must not be fetched again.
  const result = gas.context.processUniversalSimOrReport(
    ['https://questionablyepic.com/live/upgradereport/eytcfyizaxrh'],
    [report]
  );
  assert.equal(result.success, true, result && result.error);
  assert.equal(fetches, 0, 'the forwarded id was not re-fetched');
  assert.match(gas.sheets['Loot & Chase Items'].data[2][12].toString(), /Summzr/);
});
