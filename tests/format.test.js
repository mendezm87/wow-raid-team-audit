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
