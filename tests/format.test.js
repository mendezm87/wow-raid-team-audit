// Guild Audit display helpers: short gear/enchant badges with the full text kept in cell notes.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAppsScript } = require('./helpers/appsScript');

test('gear cells shrink to ilvl + track, marking current and previous tier', () => {
  const { context } = loadAppsScript();
  assert.equal(context.compactGearText("[Tier] 321 (Hero 6/6) - Baleful Grave-Knight's Casque"), '◆ 321 Hero 6/6');
  assert.equal(context.compactGearText('[Prev Tier] 305 (Champion 8/8) - Old Helm'), '◇ 305 Champion 8/8');
  assert.equal(context.compactGearText('334 (Myth 6/6) - Maze-roa, Warlord\'s Fury'), '334 Myth 6/6');
  assert.equal(context.compactGearText('321 (Crafted) - Thornspike Gauntlets'), '321 Crafted');
  assert.equal(context.compactGearText('298 (-) - Quest Ring'), '298');
  assert.equal(context.compactGearText('-'), '-');
  assert.equal(context.compactGearText(''), '');
});

test('enchant cells shrink to a rank badge and the note keeps the readable name', () => {
  const { context } = loadAppsScript();
  const rank2 = "Enchanted: Enchant Ring - Silvermoon's Alacrity |A:Professions-ChatIcon-Quality-12-Tier2:20:20|a";
  assert.equal(context.compactEnchantText(rank2), '✓ Rank 2');
  assert.equal(context.enchantNoteText(rank2), "Enchant Ring - Silvermoon's Alacrity");
  assert.equal(context.compactEnchantText('Enchanted: Enchant Helm - Hex |A:Professions-ChatIcon-Quality-12-Tier1:20:20|a'), '✓ Rank 1');
  assert.equal(context.compactEnchantText('Enchanted: Rune of the Fallen Crusader'), '✓');
  assert.equal(context.enchantNoteText('Enchanted: Rune of the Fallen Crusader'), 'Rune of the Fallen Crusader');
  for (const plain of ['Missing', 'N/A', '-', '']) {
    assert.equal(context.compactEnchantText(plain), plain);
    assert.equal(context.enchantNoteText(plain), '');
  }
});

test('Loot sheet reads full gear text from Guild Audit notes and ignores the refresh stamp in the header', () => {
  const gas = loadAppsScript();
  const audit = gas.spreadsheet.insertSheet('Guild Audit');
  audit.getRange(1, 1, 2, 4).setValues([
    ['Name\n↻ Sep 25, 1:36 AM', 'Class', 'iLvl', 'Head'],
    ['Nimidk', 'Death Knight', 323, '◆ 321 Hero 6/6']
  ]);
  audit.getRange(2, 4, 1, 1).setNotes([["[Tier] 321 (Hero 6/6) - Baleful Grave-Knight's Casque"]]);

  const [nimidk] = gas.context.getGuildAuditCharacterList(gas.spreadsheet);
  assert.equal(nimidk.Name, 'Nimidk');
  assert.equal(nimidk.Class, 'Death Knight');
  assert.equal(nimidk.Head, "[Tier] 321 (Hero 6/6) - Baleful Grave-Knight's Casque");
});

test('zebra fills alternate and restart after a blank row', () => {
  const { context, get } = loadAppsScript();
  const [white, grey] = get('ZEBRA_COLORS');
  const fills = Array.from(context.zebraBackgrounds(6, 1, i => i === 2), r => r[0]);
  assert.deepEqual(fills, [white, grey, white, white, grey, white]);
});

test('Wowhead guide links are built from class and spec', () => {
  const { context } = loadAppsScript();
  assert.equal(
    context.wowheadGuideUrl('Death Knight', 'Unholy'),
    'https://www.wowhead.com/guide/classes/death-knight/unholy/overview'
  );
  assert.equal(
    context.wowheadGuideUrl('Hunter', 'Beast Mastery'),
    'https://www.wowhead.com/guide/classes/hunter/beast-mastery/overview'
  );
  assert.equal(context.wowheadGuideUrl('Druid', ''), '');
  assert.equal(context.wowheadGuideUrl('', 'Balance'), '');
});

test('loot priority bands come from the slot the item drops in', () => {
  const { context } = loadAppsScript();
  assert.equal(context.lootPriorityTier('Trinket 1'), '🔥 Trinket');
  assert.equal(context.lootPriorityTier('Two-Hand (2H)'), '🔥 Weapon');
  assert.equal(context.lootPriorityTier('Off Hand (Shield)'), '🔥 Weapon');
  assert.equal(context.lootPriorityTier('Legs'), '🎽 Tier Piece');
  assert.equal(context.lootPriorityTier('Neck'), '💠 Secondary');
  assert.equal(context.lootPriorityTier('Gear'), '📦 Raid Drop');
  assert.equal(context.lootPriorityTier(''), '');
});

test('Raid Ready summaries stay short and keep the badge keywords', () => {
  const { context } = loadAppsScript();
  assert.equal(context.formatRaidReadySummary([]), 'READY');
  assert.equal(
    context.formatRaidReadySummary(['Off-Spec → Vengeance', 'Tier 2/5', '1 Socket empty', '1 Enchant missing']),
    'Off-Spec → Vengeance · Tier 2/5 · 1 Socket empty · 1 Enchant missing'
  );
});

test('Raid Ready counts tier out of 5 like the Tier Set column, and every issue reads as a phrase', () => {
  const { context } = loadAppsScript();
  const row = { 'Spec': 'Havoc', 'Expected Spec': 'Vengeance', 'Tier Set': '2/5 (+1 Prev)', 'Empty Sockets': 2 };
  ['Enchant Head', 'Enchant Chest'].forEach(col => { row[col] = 'Missing'; });
  assert.equal(context.calculateRaidReadyStatus(row), 'Off-Spec → Vengeance · Tier 2/5 · 2 Sockets empty · 2 Enchants missing');
  assert.equal(context.calculateRaidReadyStatus({ 'Tier Set': '4/5', 'Empty Sockets': 1, 'Enchant Feet': 'Missing' }), '1 Socket empty · 1 Enchant missing');
  assert.equal(context.calculateRaidReadyStatus({ 'Tier Set': '5/5', 'Empty Sockets': 0 }), 'READY');
});

test('M+ rating fills are a pale tint of the rating colour', () => {
  const { context } = loadAppsScript();
  assert.equal(context.tintColor('#ff8000', 0), '#ff8000');
  assert.equal(context.tintColor('#ff8000', 1), '#ffffff');
  assert.equal(context.tintColor('#a335ee', 0.7), '#e3c2fa');
  assert.equal(context.tintColor('not a colour', 0.7), 'not a colour');
});

test('uniform Difficulty and Drop ilvl columns are hidden and summarised once', () => {
  const { context } = loadAppsScript();
  const headers = ['Boss / Source', 'Chase Item / Drop', 'Slot', 'Difficulty', 'Drop ilvl'];
  const rows = [
    ["⚔️ BOSS 1: NEK'ZALI", '═══════', '', '', ''],
    ["Boss 1: Nek'zali", 'Fang of the Coil', 'Trinket', 'Mythic', 334],
    ["Boss 1: Nek'zali", 'Venom Spire', 'Two-Hand (2H)', 'Mythic', 334]
  ];
  const same = context.lootUniformColumns(headers, rows);
  assert.deepEqual(Array.from(same.hidden), [3, 4]);
  assert.equal(same.label, 'Mythic · 334 ilvl');

  rows.push(['Boss 8: Queen', 'Crown of Scales', 'Head', 'Mythic', 337]);
  const mixed = context.lootUniformColumns(headers, rows);
  assert.deepEqual(Array.from(mixed.hidden), [3]);
  assert.equal(mixed.label, 'Mythic');
});

test('a refresh keeps each raider\'s Archon boss pick and drops the old overview label', () => {
  const gas = loadAppsScript();
  const talents = gas.spreadsheet.insertSheet('Talents & Builds');
  const boss = gas.get('ARCHON_BOSS_OPTIONS')[1];
  talents.getRange(1, 1, 4, 6).setValues([
    ['Name\n↻ Sep 25, 3:02 AM', 'Class', 'Active Spec', 'Hero Talents', 'Loadout Code', 'Archon Boss Build (Dropdown)'],
    ['Nimidk', 'Death Knight', 'Unholy', '-', '-', boss],
    ['Rawria', 'Demon Hunter', 'Vengeance', '-', '-', 'All Bosses (Overview)'],
    ['Mnxlol', 'Druid', 'Balance', '-', '-', 'Not A Boss']
  ]);
  const picks = gas.context.readArchonBossPicks_(talents);
  assert.deepEqual(Array.from(Object.keys(picks)), ['nimidk']);
  assert.equal(picks.nimidk, boss);
});

test('the labelled ALTS band starts the alt section on Guild Audit', () => {
  const gas = loadAppsScript();
  const band = gas.get('ALTS_BAND_LABEL');
  assert.ok(gas.context.isAltsBandLabel(band));
  assert.ok(!gas.context.isAltsBandLabel('Nimidk'));

  const audit = gas.spreadsheet.insertSheet('Guild Audit');
  audit.getRange(1, 1, 4, 3).setValues([
    ['Name\n↻ Sep 25, 1:36 AM', 'Class', 'iLvl'],
    ['Nimidk', 'Death Knight', 323],
    [band, '', ''],
    ['Sidekick', 'Mage', 300]
  ]);

  const mains = Array.from(gas.context.getGuildAuditCharacterList(gas.spreadsheet), c => c.Name);
  assert.deepEqual(mains, ['Nimidk']);
});
