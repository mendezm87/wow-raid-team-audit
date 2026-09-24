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
  assert.equal(options[0], 'All Bosses (Overview)');
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
