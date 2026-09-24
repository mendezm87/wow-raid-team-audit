const ARCHON_BOSS_ENTRIES = SEASON.bosses.concat(SEASON.archonExtraBosses);

const ARCHON_BOSS_OPTIONS = ['All Bosses (Overview)'].concat(ARCHON_BOSS_ENTRIES.map(b => b.short));

/**
 * Creates and formats the Talents & Builds companion sheet.
 */
function updateTalentsSheet(mainCharacterData, altCharacterData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TALENTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TALENTS_SHEET_NAME);
  }

  const talentHeaders = [
    'Name', 'Class', 'Active Spec', 'Hero Talents', 
    'Talent Loadout Code (Import String)', 'Archon Boss Build (Dropdown)',
    'Archon (Heroic Link)', 'Archon (Mythic Link)', 'Wowhead Guide', 
    'Raidbots Droptimizer', 'iLvl', 'Raid Ready'
  ];

  const formatTalentRow = (obj, idx) => {
    const rowNum = idx + 2;
    const specClassSlug = `LOWER(C${rowNum}) & "/" & LOWER(SUBSTITUTE(B${rowNum}, " ", "-"))`;
    // Nested IF mapping the dropdown's boss name to its Archon URL slug (falls back to all-bosses)
    const bossSlugFormula = ARCHON_BOSS_ENTRIES.reduceRight(
      (elseExpr, b) => `IF(F${rowNum}="${b.short}", "${b.archonSlug}", ${elseExpr})`,
      '"all-bosses"'
    );

    const archonHeroicFormula = `=HYPERLINK("https://www.archon.gg/wow/builds/" & ${specClassSlug} & "/raid/overview/heroic/" & ${bossSlugFormula}, "⚡ Heroic (" & F${rowNum} & ")")`;
    const archonMythicFormula = `=HYPERLINK("https://www.archon.gg/wow/builds/" & ${specClassSlug} & "/raid/overview/mythic/" & ${bossSlugFormula}, "⚔️ Mythic (" & F${rowNum} & ")")`;
    const wowheadFormula = (obj['Wowhead Guide Link'] && obj['Wowhead Guide Link'] !== '-') 
      ? `=HYPERLINK("${obj['Wowhead Guide Link']}", "📖 Wowhead Guide")`
      : '-';
    const droptimizerFormula = (obj['Droptimizer Link'] && obj['Droptimizer Link'] !== '-')
      ? `=HYPERLINK("${obj['Droptimizer Link']}", "🎲 1-Click Sim")`
      : '-';

    return [
      obj['Name'] || '',
      obj['Class'] || '',
      obj['Spec'] || '',
      obj['Hero Talents'] || '-',
      obj['Talent Code'] || '-',
      'All Bosses (Overview)',
      archonHeroicFormula,
      archonMythicFormula,
      wowheadFormula,
      droptimizerFormula,
      obj['iLvl'] || 0,
      obj['Raid Ready'] || '-'
    ];
  };

  const finalRows = [];
  finalRows.push(...mainCharacterData.map((c, i) => formatTalentRow(c, i)));

  if (altCharacterData && altCharacterData.length > 0) {
    finalRows.push(Array(talentHeaders.length).fill(''));
    finalRows.push(Array(talentHeaders.length).fill(''));
    const startAltIdx = mainCharacterData.length + 2;
    finalRows.push(...altCharacterData.map((c, i) => formatTalentRow(c, startAltIdx + i)));
  }

  const outputData = [talentHeaders, ...finalRows];
  sheet.clear();
  sheet.clearFormats();
  sheet.clearConditionalFormatRules();
  sheet.getRange(1, 1, outputData.length, outputData[0].length).setValues(outputData);

  // Formatting
  const fullRange = sheet.getDataRange();
  fullRange.setHorizontalAlignment('center');
  fullRange.setVerticalAlignment('middle');
  fullRange.setFontFamily('Roboto');
  fullRange.setNumberFormat('@');
  sheet.setFrozenColumns(1);
  sheet.setFrozenRows(1);

  // Header styling
  const headerRange = sheet.getRange(1, 1, 1, sheet.getMaxColumns());
  headerRange.setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold').setFontSize(10);
  sheet.setRowHeight(1, 34);

  // Row heights & fonts
  if (outputData.length > 1) {
    sheet.setRowHeights(2, outputData.length - 1, 28);
    sheet.getRange(2, 1, outputData.length - 1, sheet.getMaxColumns()).setFontSize(9).setFontWeight('bold');
    // Set monospace styling for Talent String (Column 5)
    sheet.getRange(2, 5, outputData.length - 1, 1).setFontFamily('Consolas').setFontSize(8).setFontWeight('normal');
  }

  // Class colors for Name, Class, Spec
  const classAndSpecRanges = [
    sheet.getRange(2, 1, sheet.getMaxRows(), 1), // Name
    sheet.getRange(2, 2, sheet.getMaxRows(), 1), // Class
    sheet.getRange(2, 3, sheet.getMaxRows(), 1)  // Spec
  ];
  const rules = [];
  const darkBgClasses = ['Death Knight', 'Demon Hunter', 'Shaman', 'Warlock'];
  for (const className in CLASS_COLORS) {
    const fontColor = darkBgClasses.includes(className) ? '#ffffff' : '#0f172a';
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$B2="${className}"`)
      .setBackground(CLASS_COLORS[className])
      .setFontColor(fontColor)
      .setRanges(classAndSpecRanges)
      .build());
  }

  // Raid Ready column formatting (Soft Modern Badges)
  const raidReadyColIdx = talentHeaders.indexOf('Raid Ready') + 1;
  const rrRange = [sheet.getRange(2, raidReadyColIdx, sheet.getMaxRows(), 1)];
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('READY').setBackground('#d1fae5').setFontColor('#065f46').setRanges(rrRange).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('Missing').setBackground('#ffe4e6').setFontColor('#9f1239').setRanges(rrRange).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('Tier').setBackground('#fef3c7').setFontColor('#92400e').setRanges(rrRange).build());

  sheet.setConditionalFormatRules(rules);

  // Add Data Validation Dropdown for Boss Build Selector (Column F) ONLY on populated character rows
  if (outputData.length > 1) {
    const bossRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(ARCHON_BOSS_OPTIONS, true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(2, 6, outputData.length - 1, 1).setDataValidation(bossRule);
  }

  // Set widths
  sheet.setColumnWidth(1, 130); // Name
  sheet.setColumnWidth(2, 110); // Class
  sheet.setColumnWidth(3, 130); // Spec
  sheet.setColumnWidth(4, 210); // Hero Talents
  sheet.setColumnWidth(5, 480); // Talent String
  sheet.setColumnWidth(6, 210); // Archon Boss Dropdown
  sheet.setColumnWidth(7, 165); // Archon Heroic
  sheet.setColumnWidth(8, 165); // Archon Mythic
  sheet.setColumnWidth(9, 150); // Wowhead Guide
  sheet.setColumnWidth(10, 150); // Raidbots Droptimizer
  sheet.setColumnWidth(11, 80); // ilvl
  sheet.setColumnWidth(12, 460);// Raid Ready
}
