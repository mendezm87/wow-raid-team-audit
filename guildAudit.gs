const SHEET_NAME = 'Guild Audit'; 
const AUDIT_SHEET_NAME = SHEET_NAME;
const TALENTS_SHEET_NAME = 'Talents & Builds';
const LOOT_SHEET_NAME = 'Loot & Chase Items';

// --- VAULT & SEASON CONFIGURATION (Midnight Season 2 - Patch 12.1 Verified) ---
const VAULT_MAPPING = {
  raid: {
      mythic: 334, // (Most) Mythic is 334; Last 2 Mythic Bosses is 344
      heroic: 318, // Heroic Raid Vault is 318
      normal: 305, // Normal Raid Vault is 305
      lfr: 292     // LFR Raid Vault is 292
  },
  mplus: {
      20: 318, 19: 318, 18: 318, 17: 318, 16: 318, 15: 318, 14: 318,
      13: 318, 12: 318, 11: 318, 10: 318, // Caps at 318 for M+ 10 and above
      9: 315, 8: 315, 7: 315,             // 315 for M+ 7 to 9
      6: 311,                             // 311 for M+ 6
      5: 308, 4: 308,                     // 308 for M+ 4 to 5
      3: 305, 2: 305,                     // 305 for M+ 2 to 3
      0: 302                              // 302 for Mythic 0 / M0
  }
};

const CLASS_COLORS = {
  'Warrior': '#C79C6E', 'Mage': '#3FC7EB', 'Rogue': '#FFF569', 'Paladin': '#F58CBA',
  'Warlock': '#8787ED', 'Shaman': '#0070DE', 'Hunter': '#ABD473', 'Druid': '#FF7D0A',
  'Priest': '#FFFFFF', 'Death Knight': '#C41F3B', 'Monk': '#00FF96',
  'Demon Hunter': '#A330C9', 'Evoker': '#33937F',
};

// Accessible high-contrast WoW Class Colors for rich text rendering on light Google Sheets backgrounds
const CLASS_ACCESSIBLE_COLORS = {
  'Death Knight': '#c41f3b', // Crimson Red
  'Demon Hunter': '#9333ea', // Purple
  'Druid': '#ea580c',        // Sunset Orange
  'Evoker': '#0d9488',       // Emerald Teal
  'Hunter': '#4d7c0f',       // Forest Olive Green
  'Mage': '#0284c7',         // Sky Blue
  'Monk': '#059669',         // Jade Green
  'Paladin': '#db2777',      // Pink / Rose
  'Priest': '#475569',       // Silver Slate
  'Rogue': '#b45309',        // Amber Gold
  'Shaman': '#0070de',       // Deep Blue
  'Warlock': '#7c3aed',      // Fel Violet
  'Warrior': '#854d0e'       // Deep Bronze
};

const SPEC_TO_CLASS_MAP = {
  'affliction': 'Warlock', 'demonology': 'Warlock', 'destruction': 'Warlock',
  'arcane': 'Mage', 'fire': 'Mage', 'frost': 'Mage',
  'arms': 'Warrior', 'fury': 'Warrior', 'protection': 'Warrior',
  'assassination': 'Rogue', 'outlaw': 'Rogue', 'subtlety': 'Rogue',
  'augmentation': 'Evoker', 'devastation': 'Evoker', 'preservation': 'Evoker',
  'balance': 'Druid', 'feral': 'Druid', 'guardian': 'Druid', 'restoration': 'Druid',
  'beast mastery': 'Hunter', 'marksmanship': 'Hunter', 'survival': 'Hunter',
  'blood': 'Death Knight', 'unholy': 'Death Knight',
  'brewmaster': 'Monk', 'mistweaver': 'Monk', 'windwalker': 'Monk',
  'discipline': 'Priest', 'holy': 'Priest', 'shadow': 'Priest',
  'elemental': 'Shaman', 'enhancement': 'Shaman',
  'havoc': 'Demon Hunter', 'vengeance': 'Demon Hunter', 'devourer': 'Demon Hunter',
  'retribution': 'Paladin'
};
// --- END CONFIGURATION ---

function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Guild Audit')
      .addItem('1. Set Blizzard API Credentials', 'promptForCredentials')
      .addItem('2. Create Config Sheet', 'createConfigSheet')
      .addSeparator()
      .addItem('3. Run Full Audit & Talents', 'updateAllCharacterDataWithBonuses')
      .addItem('4. Create/Refresh Loot & Chase Items Sheet', 'createLootAndChaseItemsSheet')
      .addItem('5. Import Raidbots / QE Live Sim', 'promptAndImportRaidbotsDroptimizer')
      .addSeparator()
      .addItem('6. Sync Warcraft Logs Attendance & History', 'syncWarcraftLogsSeasonAttendance')
      .addItem('7. Set Warcraft Logs API Credentials', 'promptForWCLCredentials')
      .addItem('8. 🪑 Mark Bench & Standby Raiders', 'showBenchRaidersDialog')
      .addToUi();
}

const ALL_WOW_SPECS = [
  'Affliction', 'Arcane', 'Arms', 'Assassination', 'Augmentation',
  'Balance', 'Beast Mastery', 'Blood', 'Brewmaster', 'Demonology',
  'Destruction', 'Devastation', 'Devourer', 'Discipline', 'Elemental', 'Enhancement',
  'Feral', 'Fire', 'Frost', 'Fury', 'Guardian',
  'Havoc', 'Holy', 'Marksmanship', 'Mistweaver', 'Outlaw',
  'Preservation', 'Protection', 'Restoration', 'Retribution', 'Shadow',
  'Subtlety', 'Survival', 'Unholy', 'Vengeance', 'Windwalker'
];

const COMMON_TIME_ZONES = [
  'America/Los_Angeles (Pacific PT)',
  'America/Denver (Mountain MT)',
  'America/Chicago (Central CT)',
  'America/New_York (Eastern ET)',
  'America/Anchorage (Alaska AKT)',
  'Pacific/Honolulu (Hawaii HT)',
  'Europe/London (GMT / BST)',
  'Europe/Paris (CET / CEST)',
  'Australia/Sydney (AEST / AEDT)',
  'UTC'
];

const COMMON_HOURS = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
];

const COMMON_MINUTES = [
  ':00', ':15', ':30', ':45'
];

const COMMON_AM_PM = [
  'PM', 'AM'
];

/**
 * Combines hour, minute, and AM/PM dropdown selections into a standard formatted time string (e.g. "7:30 PM").
 */
function formatRaidTime(hourVal, minVal, ampmVal) {
  const h = (hourVal || '7').toString().replace(/[^0-9]/g, '') || '7';
  const m = (minVal || '00').toString().replace(/[^0-9]/g, '').padStart(2, '0');
  const period = (ampmVal || 'PM').toString().trim().toUpperCase().includes('AM') ? 'AM' : 'PM';
  return `${h}:${m} ${period}`;
}

/**
 * Extracts standard IANA time zone identifier (e.g., 'America/Los_Angeles') from user selection or text.
 */
function extractIanaTimeZone(tzStr) {
  if (!tzStr) return 'America/Los_Angeles';
  const match = tzStr.toString().match(/^([A-Za-z_]+\/[A-Za-z_]+|UTC)/);
  if (match) return match[1];
  const lower = tzStr.toString().toLowerCase();
  if (lower.includes('pacific') || lower.includes('pt')) return 'America/Los_Angeles';
  if (lower.includes('mountain') || lower.includes('mt')) return 'America/Denver';
  if (lower.includes('central') || lower.includes('ct')) return 'America/Chicago';
  if (lower.includes('eastern') || lower.includes('et')) return 'America/New_York';
  return 'America/Los_Angeles';
}

const SPEC_ALIASES = {
  'ret': 'Retribution', 'prot': 'Protection', 'holy': 'Holy',
  'bm': 'Beast Mastery', 'mm': 'Marksmanship', 'surv': 'Survival',
  'ww': 'Windwalker', 'mw': 'Mistweaver', 'brm': 'Brewmaster',
  'sub': 'Subtlety', 'ass': 'Assassination', 'sin': 'Assassination',
  'destro': 'Destruction', 'demo': 'Demonology', 'aff': 'Affliction',
  'enh': 'Enhancement', 'ele': 'Elemental', 'resto': 'Restoration',
  'blood': 'Blood', 'frost': 'Frost', 'unholy': 'Unholy',
  'balance': 'Balance', 'boomy': 'Balance', 'boomkin': 'Balance', 'feral': 'Feral', 'bear': 'Guardian',
  'havoc': 'Havoc', 'veng': 'Vengeance',
  'dev': 'Devastation', 'aug': 'Augmentation', 'pres': 'Preservation'
};

/**
 * Normalizes user-typed specs into standard WoW spec names.
 */
function normalizeSpecName(raw) {
  if (!raw) return '';
  const trimmed = raw.toString().trim();
  const lower = trimmed.toLowerCase();
  if (SPEC_ALIASES[lower]) return SPEC_ALIASES[lower];
  const exact = ALL_WOW_SPECS.find(s => s.toLowerCase() === lower);
  return exact || trimmed;
}

/**
 * Sanitizes realm and guild slugs into clean API-compliant slugs (e.g. "Kil'jaeden" -> "kiljaeden").
 */
function sanitizeSlug(raw) {
  if (!raw) return '';
  return raw.toString().toLowerCase()
    .replace(/[<>'"’]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Splits pasted character names with in-game realm tags (e.g. "Rawria-Kil'jaeden").
 */
function parseCharacterAndRealm(nameRaw, realmRaw) {
  let name = (nameRaw || '').toString().trim();
  let realm = (realmRaw || '').toString().trim();
  if (name.includes('-')) {
    const parts = name.split('-');
    name = parts[0].trim();
    if (!realm && parts[1]) {
      realm = parts[1].trim();
    }
  }
  return { name, realm };
}

const ROSTER_ROLES = [
  '👑 Veteran',
  '⚔️ Raider',
  '🛡️ Trial'
];

/**
 * Applies Google Sheets interactive dropdown validation for WoW specs, Roster Roles, Main Character Owners, Times, Time Zones, and Checkboxes on Config.
 * Formats Main Characters (Cols A-D) and Alt Characters (Cols F-I) side-by-side for a clean executive layout.
 */
function applyConfigDropdowns(sheet) {
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const mainCharacterNames = [];

  // Read Main Characters from Columns A (rows 9 to 45)
  for (let r = 8; r < Math.min(data.length, 45); r++) {
    const rawVal = (data[r][0] || '').toString().trim();
    const { name } = parseCharacterAndRealm(rawVal, '');
    const row0Lower = name.toLowerCase();
    if (name && !row0Lower.includes('main character') && !row0Lower.includes('alt character') && !row0Lower.includes('alts to track') && !row0Lower.includes('configuration')) {
      if (!mainCharacterNames.includes(name)) {
        mainCharacterNames.push(name);
      }
    }
  }

  // 1. WoW Specializations Dropdown Rule
  const specRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(ALL_WOW_SPECS, true)
    .setAllowInvalid(true)
    .build();

  // 2. Roster Role Dropdown Rule (Veteran / Raider / Trial)
  const roleRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(ROSTER_ROLES, true)
    .setAllowInvalid(true)
    .build();

  // 3. Main Character Owner Dropdown Rule (Built from active main characters)
  const mainOwnersList = mainCharacterNames.length > 0 ? mainCharacterNames : ['Character1', 'Character2'];
  const mainOwnerRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(mainOwnersList, true)
    .setAllowInvalid(true)
    .build();

  // 4. Time Zone Dropdown Rule
  const tzRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(COMMON_TIME_ZONES, true)
    .setAllowInvalid(true)
    .build();

  // 5. Region Dropdown Rule
  const regionRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['us', 'eu', 'kr', 'tw'], true)
    .setAllowInvalid(true)
    .build();

  // 6. Hour, Minute, and AM/PM Dropdown Rules
  const hourRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(COMMON_HOURS, true)
    .setAllowInvalid(true)
    .build();

  const minuteRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(COMMON_MINUTES, true)
    .setAllowInvalid(true)
    .build();

  const ampmRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(COMMON_AM_PM, true)
    .setAllowInvalid(true)
    .build();

  // Clear any existing validations from header and config rows 1-8 to guarantee NO red error triangles
  sheet.getRange('A1:I8').clearDataValidations();

  // Apply Region Dropdown to B2:D2
  sheet.getRange('B2:D2').merge().setDataValidation(regionRule);

  // 1. Left Block: Guild & Schedule Configuration (Columns A-D, Rows 1-7)
  sheet.getRange('A1:D1').merge().setValue('⚙️ GUILD & RAID CONFIGURATION').setHorizontalAlignment('center').setFontWeight('bold').setBackground('#0f172a').setFontColor('#f8fafc');
  sheet.getRange('A2:A7').setFontWeight('bold');
  sheet.getRange('A2').setValue('Region');
  sheet.getRange('A3').setValue('Realm Slug');
  sheet.getRange('A4').setValue('Guild Slug');
  sheet.getRange('A5').setValue('Raid Start Time');
  sheet.getRange('A6').setValue('Raid End Time');
  sheet.getRange('A7').setValue('Time Zone');

  if (!sheet.getRange('B2').getValue()) sheet.getRange('B2').setValue('us');
  if (!sheet.getRange('B3').getValue()) sheet.getRange('B3:D3').merge().setValue('kiljaeden');
  if (!sheet.getRange('B4').getValue()) sheet.getRange('B4:D4').merge().setValue('prey');
  
  // Start Time: Column B (Hour) + Column C (Minute) + Column D (AM/PM)
  sheet.getRange('B5').setDataValidation(hourRule).setHorizontalAlignment('center');
  sheet.getRange('C5').setDataValidation(minuteRule).setHorizontalAlignment('center');
  sheet.getRange('D5').setDataValidation(ampmRule).setHorizontalAlignment('center');
  if (!sheet.getRange('B5').getValue()) sheet.getRange('B5').setValue('7');
  if (!sheet.getRange('C5').getValue()) sheet.getRange('C5').setValue(':00');
  if (!sheet.getRange('D5').getValue()) sheet.getRange('D5').setValue('PM');

  // End Time: Column B (Hour) + Column C (Minute) + Column D (AM/PM)
  sheet.getRange('B6').setDataValidation(hourRule).setHorizontalAlignment('center');
  sheet.getRange('C6').setDataValidation(minuteRule).setHorizontalAlignment('center');
  sheet.getRange('D6').setDataValidation(ampmRule).setHorizontalAlignment('center');
  if (!sheet.getRange('B6').getValue()) sheet.getRange('B6').setValue('10');
  if (!sheet.getRange('C6').getValue()) sheet.getRange('C6').setValue(':00');
  if (!sheet.getRange('D6').getValue()) sheet.getRange('D6').setValue('PM');
  
  // Time Zone Dropdown (Merged across B7:D7)
  sheet.getRange('B7:D7').merge().setDataValidation(tzRule);
  if (!sheet.getRange('B7').getValue()) sheet.getRange('B7').setValue('America/Los_Angeles (Pacific PT)');

  // 2. Right Block: Interactive Raid Days Checkbox Grid (Columns F-I, Rows 1-5)
  sheet.getRange('F1:I1').merge().setValue('⏰ RAID DAYS (TOGGLE ACTIVE NIGHTS)').setHorizontalAlignment('center').setFontWeight('bold').setBackground('#0f172a').setFontColor('#f8fafc');
  
  // Weekday Days (Row 2 Labels, Row 3 Checkboxes)
  sheet.getRange('F2:I2').setValues([['Tuesday', 'Wednesday', 'Thursday', 'Monday']])
    .setFontWeight('bold').setBackground('#1e293b').setFontColor('#f8fafc').setHorizontalAlignment('center').setFontSize(9);
  sheet.getRange('F3:I3').insertCheckboxes().setHorizontalAlignment('center');
  if (sheet.getRange('F3').getValue() === '') sheet.getRange('F3').setValue(true);  // Tue default ON
  if (sheet.getRange('G3').getValue() === '') sheet.getRange('G3').setValue(true);  // Wed default ON
  if (sheet.getRange('H3').getValue() === '') sheet.getRange('H3').setValue(false); // Thu default OFF
  if (sheet.getRange('I3').getValue() === '') sheet.getRange('I3').setValue(false); // Mon default OFF

  // Weekend & Off Days (Row 4 Labels, Row 5 Checkboxes)
  sheet.getRange('F4:I4').setValues([['Friday', 'Saturday', 'Sunday', '—']])
    .setFontWeight('bold').setBackground('#1e293b').setFontColor('#f8fafc').setHorizontalAlignment('center').setFontSize(9);
  sheet.getRange('F5:H5').insertCheckboxes().setHorizontalAlignment('center');
  if (sheet.getRange('F5').getValue() === '') sheet.getRange('F5').setValue(false); // Fri default OFF
  if (sheet.getRange('G5').getValue() === '') sheet.getRange('G5').setValue(false); // Sat default OFF
  if (sheet.getRange('H5').getValue() === '') sheet.getRange('H5').setValue(false); // Sun default OFF
  sheet.getRange('I5').clearContent().clearFormat().clearDataValidations();

  // 3. Main Character & Alt Roster Table Headers (Row 8)
  sheet.getRange('A8').setValue('Main Character Name').setFontWeight('bold').setBackground('#1e293b').setFontColor('#f8fafc').setHorizontalAlignment('center');
  sheet.getRange('B8').setValue('Assigned Raid Spec (Dropdown)').setFontWeight('bold').setBackground('#1e293b').setFontColor('#f8fafc').setHorizontalAlignment('center');
  sheet.getRange('C8').setValue('Roster Role (Dropdown)').setFontWeight('bold').setBackground('#1e293b').setFontColor('#f8fafc').setHorizontalAlignment('center');
  sheet.getRange('D8').setValue('Realm (If not in guild)').setFontWeight('bold').setBackground('#1e293b').setFontColor('#f8fafc').setHorizontalAlignment('center');

  sheet.getRange('F8:I8').setValues([[
    'Alt Character Name', 'Main Character (Owner - Dropdown)', 'Assigned Spec (Dropdown)', 'Realm (If not in guild)'
  ]]).setFontWeight('bold').setBackground('#1e293b').setFontColor('#f8fafc').setHorizontalAlignment('center');

  // Spec Dropdown for Mains (Column B, rows 9 to 45 ONLY)
  sheet.getRange('B9:B45').setDataValidation(specRule);

  // Roster Role Dropdown for Mains (Column C, rows 9 to 45 ONLY)
  sheet.getRange('C9:C45').setDataValidation(roleRule).setHorizontalAlignment('center');

  // Dropdowns for Alts (Column G = Owner Dropdown, Column H = Spec Dropdown, rows 9 to 45 ONLY)
  sheet.getRange('G9:G45').setDataValidation(mainOwnerRule);
  sheet.getRange('H9:H45').setDataValidation(specRule);

  // Clear any leftover cells beyond Column I
  sheet.getRange('J1:Z45').clearContent().clearFormat().clearDataValidations();

  // Set generous column widths so all headers and tables are 100% spacious
  sheet.setColumnWidth(1, 180); // Main Character Name
  sheet.setColumnWidth(2, 210); // Assigned Spec (Mains) / Hour
  sheet.setColumnWidth(3, 130); // Roster Role (Col C) / Minute
  sheet.setColumnWidth(4, 160); // Realm (Col D) / AM-PM
  sheet.setColumnWidth(5, 30);  // Spacing Divider
  sheet.setColumnWidth(6, 180); // Alt Character Name / Tuesday / Friday
  sheet.setColumnWidth(7, 230); // Main Character (Owner - Dropdown) / Wednesday / Saturday
  sheet.setColumnWidth(8, 210); // Assigned Spec (Alts) / Thursday / Sunday
  sheet.setColumnWidth(9, 170); // Realm (Alts) / Monday

  // Auto-migrate legacy stacked Alts in row 35+ to side-by-side columns F-I if detected
  for (let r = 30; r < data.length; r++) {
    const row0 = (data[r][0] || '').toString().trim();
    if (row0 && !row0.toLowerCase().includes('alt') && !row0.toLowerCase().includes('main')) {
      const { name: altName, realm: parsedRealm } = parseCharacterAndRealm(row0, data[r][3] || data[r][2] || '');
      const colB = (data[r][1] || '').toString().trim();
      const colC = (data[r][2] || '').toString().trim();

      // Find first empty row in F9:F45
      for (let targetR = 9; targetR <= 45; targetR++) {
        if (!sheet.getRange(`F${targetR}`).getValue()) {
          const specVal = normalizeSpecName(ALL_WOW_SPECS.includes(colB) ? colB : (ALL_WOW_SPECS.includes(colC) ? colC : ''));
          const ownerVal = mainCharacterNames.find(m => colB.toLowerCase().includes(m.toLowerCase()) || altName.toLowerCase().startsWith(m.toLowerCase().slice(0, 4))) || (altName.toLowerCase().startsWith('waffle') ? 'Wafflezcalot' : '');
          sheet.getRange(`F${targetR}`).setValue(altName);
          if (ownerVal) sheet.getRange(`G${targetR}`).setValue(ownerVal);
          if (specVal) sheet.getRange(`H${targetR}`).setValue(specVal);
          if (parsedRealm) sheet.getRange(`I${targetR}`).setValue(parsedRealm);
          // Clear legacy stacked row
          sheet.getRange(`A${r + 1}:E${r + 1}`).clearContent().clearDataValidations();
          break;
        }
      }
    } else if (row0.toLowerCase().includes('alt character') || row0.toLowerCase().includes('alts to track')) {
      sheet.getRange(`A${r + 1}:E${r + 1}`).clearContent().clearFormat().clearDataValidations();
    }
  }
}

function createConfigSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Config');
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet('Config', 0);
  }

  const setupData = [
      ['Configuration', 'Hour', 'Minute', 'AM/PM', '', 'Raid Days (Toggle Active Nights)', '', '', ''],
      ['Region', 'us', '', '', '', 'Tuesday', 'Wednesday', 'Thursday', 'Monday'],
      ['Realm Slug', 'your-realm', '', '', '', true, true, false, false],
      ['Guild Slug', 'your-guild', '', '', '', 'Friday', 'Saturday', 'Sunday', '—'],
      ['Raid Start Time', 7, ':00', 'PM', '', false, false, false, ''],
      ['Raid End Time', 10, ':00', 'PM', '', '', '', '', ''],
      ['Time Zone', 'America/Los_Angeles (Pacific PT)', '', '', '', '', '', '', ''],
      ['Main Character Name', 'Assigned Raid Spec (Dropdown)', 'Roster Role (Dropdown)', 'Realm (If not in guild)', '', 'Alt Character Name', 'Main Character (Owner - Dropdown)', 'Assigned Spec (Dropdown)', 'Realm (If not in guild)'],
      ['Character1', 'Retribution', '👑 Veteran', '', '', 'Alt1', 'Character1', 'Protection', ''],
      ['Character2', 'Windwalker', '⚔️ Raider', '', '', '', '', '', '']
  ];
  sheet.getRange(1, 1, setupData.length, 9).setValues(setupData);
  applyConfigDropdowns(sheet);
  SpreadsheetApp.getUi().alert('A clean "Config" sheet template has been created. Fill in your characters, specs, and schedule!');
}

function getConfigurationFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('Config');
  if (!configSheet) {
    SpreadsheetApp.getUi().alert('Configuration sheet not found!', 'Please create a sheet named "Config" using the "Guild Audit > Create Config Sheet" menu.', SpreadsheetApp.getUi().ButtonSet.OK);
    return null;
  }

  // Ensure dropdown rules and side-by-side formatting are active
  applyConfigDropdowns(configSheet);

  const region = configSheet.getRange('B2').getValue().toString().trim().toLowerCase() || 'us';
  const realmSlug = sanitizeSlug(configSheet.getRange('B3').getValue()) || 'kiljaeden';
  const guildSlug = sanitizeSlug(configSheet.getRange('B4').getValue()) || 'prey';

  // Read configurable raid schedule (Hour in B, Minute in C, AM/PM in D) & Day Checkboxes
  const startTime = formatRaidTime(configSheet.getRange('B5').getValue(), configSheet.getRange('C5').getValue(), configSheet.getRange('D5').getValue());
  const endTime = formatRaidTime(configSheet.getRange('B6').getValue(), configSheet.getRange('C6').getValue(), configSheet.getRange('D6').getValue());
  const raidHours = `${startTime} - ${endTime}`;
  const timeZoneRaw = configSheet.getRange('B7').getValue().toString().trim();
  const timeZone = extractIanaTimeZone(timeZoneRaw);

  const dayLabels = ['Tuesday', 'Wednesday', 'Thursday', 'Monday', 'Friday', 'Saturday', 'Sunday'];
  const dayToggles = [
    configSheet.getRange('F3').getValue() === true,
    configSheet.getRange('G3').getValue() === true,
    configSheet.getRange('H3').getValue() === true,
    configSheet.getRange('I3').getValue() === true,
    configSheet.getRange('F5').getValue() === true,
    configSheet.getRange('G5').getValue() === true,
    configSheet.getRange('H5').getValue() === true
  ];

  const activeRaidDays = [];
  dayLabels.forEach((day, i) => {
    if (dayToggles[i]) activeRaidDays.push(day);
  });
  const raidDays = activeRaidDays.length > 0 ? activeRaidDays.join(', ') : 'Tuesday, Wednesday';

  const data = configSheet.getDataRange().getValues();
  const members = [];
  const alts = [];

  // 1. Read Main Characters from Columns A-D (rows 9 to 45)
  for (let r = 8; r < Math.min(data.length, 45); r++) {
    const rawName = (data[r][0] || '').toString().trim();
    const { name, realm: parsedRealm } = parseCharacterAndRealm(rawName, data[r][3] ? data[r][3].toString().trim() : '');
    const row0Lower = name.toLowerCase();
    if (name && !row0Lower.includes('main character') && !row0Lower.includes('alt character') && !row0Lower.includes('configuration')) {
      const roleVal = (data[r][2] || '⚔️ Raider').toString().trim() || '⚔️ Raider';
      members.push({
        name: name,
        expectedSpec: normalizeSpecName(data[r][1] ? data[r][1].toString().trim() : ''),
        role: roleVal,
        realm: parsedRealm || (data[r][3] ? data[r][3].toString().trim() : '')
      });
    }
  }

  // 2. Read Alt Characters from Side-by-Side Columns F-I (rows 9 to 45)
  for (let r = 8; r < Math.min(data.length, 45); r++) {
    const rawAltName = (data[r][5] || '').toString().trim();
    const { name: altName, realm: parsedAltRealm } = parseCharacterAndRealm(rawAltName, data[r][8] ? data[r][8].toString().trim() : '');
    if (altName && !altName.toLowerCase().includes('alt character')) {
      alts.push({
        name: altName,
        mainOwner: data[r][6] ? data[r][6].toString().trim() : '',
        expectedSpec: normalizeSpecName(data[r][7] ? data[r][7].toString().trim() : ''),
        realm: parsedAltRealm || (data[r][8] ? data[r][8].toString().trim() : '')
      });
    }
  }

  // 3. Fallback: Check legacy stacked rows 35+ if present
  for (let r = 35; r < data.length; r++) {
    const altName = (data[r][0] || '').toString().trim();
    if (altName && !altName.toLowerCase().includes('alt') && !altName.toLowerCase().includes('main')) {
      if (!alts.some(a => a.name.toLowerCase() === altName.toLowerCase())) {
        alts.push({
          name: altName,
          mainOwner: data[r][1] ? data[r][1].toString().trim() : '',
          expectedSpec: data[r][2] ? data[r][2].toString().trim() : '',
          realm: data[r][3] ? data[r][3].toString().trim() : ''
        });
      }
    }
  }

  if (!region || !realmSlug || !guildSlug || members.length === 0) {
    SpreadsheetApp.getUi().alert('Configuration Incomplete', 'Please make sure Region, Realm, Guild, and at least one Main Character are filled out in the "Config" sheet.', SpreadsheetApp.getUi().ButtonSet.OK);
    return null;
  }

  const altToMainMap = {};
  alts.forEach(a => {
    if (a.name && a.mainOwner) {
      altToMainMap[a.name.toLowerCase()] = a.mainOwner;
    }
  });

  return {
    REGION: region,
    GUILD_REALM_SLUG: realmSlug,
    GUILD_NAME_SLUG: guildSlug,
    RAID_DAYS: raidDays,
    RAID_HOURS: raidHours,
    TIME_ZONE: timeZone,
    MEMBERS_TO_TRACK: members,
    ALTS_TO_TRACK: alts,
    ALT_TO_MAIN_MAP: altToMainMap
  };
}

function promptForCredentials() {
  const ui = SpreadsheetApp.getUi();
  const userProperties = PropertiesService.getUserProperties();

  const clientIdResponse = ui.prompt('Set Blizzard Client ID', 'Please enter your Client ID:', ui.ButtonSet.OK_CANCEL);
  if (clientIdResponse.getSelectedButton() !== ui.Button.OK) return;
  const clientId = clientIdResponse.getResponseText().trim();

  const clientSecretResponse = ui.prompt('Set Blizzard Client Secret', 'Please enter your Client Secret:', ui.ButtonSet.OK_CANCEL);
  if (clientSecretResponse.getSelectedButton() !== ui.Button.OK) return;
  const clientSecret = clientSecretResponse.getResponseText().trim();

  if (clientId && clientSecret) {
    userProperties.setProperties({
      'CLIENT_ID': clientId,
      'CLIENT_SECRET': clientSecret
    });
    ui.alert('Success!', 'Your API credentials have been saved. You can now run the audit.', ui.ButtonSet.OK);
  } else {
    ui.alert('Error', 'Both Client ID and Client Secret are required. Please try again.', ui.ButtonSet.OK);
  }
}

function getApiHost(config) {
  return `https://${config.REGION}.api.blizzard.com`;
}

function getAccessToken(config) {
  const userProperties = PropertiesService.getUserProperties();
  const CLIENT_ID = userProperties.getProperty('CLIENT_ID');
  const CLIENT_SECRET = userProperties.getProperty('CLIENT_SECRET');

  if (!CLIENT_ID || !CLIENT_SECRET) {
    SpreadsheetApp.getUi().alert('API Credentials Not Found', 'Please set your API credentials using the "Guild Audit" > "1. Set API Credentials" menu first.', SpreadsheetApp.getUi().ButtonSet.OK);
    return null;
  }
  
  const properties = PropertiesService.getScriptProperties();
  let token = properties.getProperty('blizzard_token');
  const tokenExpiry = properties.getProperty('blizzard_token_expiry');

  if (token && new Date().getTime() < Number(tokenExpiry)) {
    return token;
  }
  
  Logger.log('Requesting new access token...');
  const url = `https://${config.REGION}.battle.net/oauth/token`;
  const options = {
    method: 'post',
    payload: { grant_type: 'client_credentials' },
    headers: { 'Authorization': 'Basic ' + Utilities.base64Encode(CLIENT_ID + ':' + CLIENT_SECRET) },
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) {
    SpreadsheetApp.getUi().alert('Authentication Failed', 'Failed to authenticate with Blizzard API. Please verify your Client ID and Client Secret.', SpreadsheetApp.getUi().ButtonSet.OK);
    return null;
  }
  const data = JSON.parse(response.getContentText());
  token = data.access_token;
  const expiryTime = new Date().getTime() + (data.expires_in - 60) * 1000;

  properties.setProperty('blizzard_token', token);
  properties.setProperty('blizzard_token_expiry', expiryTime.toString());
  return token;
}

function fetchBlizzardEndpoint(url, headers) {
  try {
    const response = UrlFetchApp.fetch(url, { headers: headers, 'muteHttpExceptions': true });
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    }
    Logger.log(`Failed to fetch ${url}. Response code: ${response.getResponseCode()}`);
    return null;
  } catch (e) {
    Logger.log(`Exception fetching ${url}. Error: ${e.toString()}`);
    return null;
  }
}

function getBonusData() {
  Logger.log('Fetching bonuses.json from Raidbots...');
  const bonusUrl = 'https://www.raidbots.com/static/data/live/bonuses.json';
  try {
    const response = UrlFetchApp.fetch(bonusUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    }
    return {};
  } catch (e) {
    Logger.log(`Failed to fetch or parse bonuses.json. Error: ${e.toString()}`);
    return {};
  }
}

function getEnchantData() {
  Logger.log('Fetching enchantments.json from Raidbots...');
  const enchantUrl = 'https://www.raidbots.com/static/data/live/enchantments.json';
  try {
    const response = UrlFetchApp.fetch(enchantUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      const enchantArray = JSON.parse(response.getContentText());
      return enchantArray.reduce((map, enchant) => {
        const key = enchant.itemId || enchant.id;
        map[key] = enchant;
        return map;
      }, {});
    }
    return {};
  } catch (e) {
    Logger.log(`Failed to fetch or parse enchantments.json. Error: ${e.toString()}`);
    return {};
  }
}

function rgbToHex(r, g, b) {
  let rHex = r.toString(16);
  let gHex = g.toString(16);
  let bHex = b.toString(16);
  if (rHex.length === 1) rHex = "0" + rHex;
  if (gHex.length === 1) gHex = "0" + gHex;
  if (bHex.length === 1) bHex = "0" + bHex;
  return "#" + rHex + gHex + bHex;
}

/**
 * Fast batch fetching of all character endpoints using UrlFetchApp.fetchAll.
 */
function fetchAllCharacterDataBatched(characterList, config, token) {
  const headers = { 'Authorization': 'Bearer ' + token, 'Battlenet-Namespace': `profile-${config.REGION}` };
  const apiHost = getApiHost(config);
  const results = [];
  const chunkSize = 12; // 12 characters * 6 endpoints = 72 parallel requests

  for (let i = 0; i < characterList.length; i += chunkSize) {
    const chunk = characterList.slice(i, i + chunkSize);
    const requests = [];

    chunk.forEach(char => {
      const charName = encodeURIComponent(char.name.toLowerCase());
      const charRealm = encodeURIComponent(char.realmSlug);
      requests.push({ url: `${apiHost}/profile/wow/character/${charRealm}/${charName}?locale=en_US`, headers: headers, muteHttpExceptions: true });
      requests.push({ url: `${apiHost}/profile/wow/character/${charRealm}/${charName}/equipment?locale=en_US`, headers: headers, muteHttpExceptions: true });
      requests.push({ url: `${apiHost}/profile/wow/character/${charRealm}/${charName}/reputations?locale=en_US`, headers: headers, muteHttpExceptions: true });
      requests.push({ url: `${apiHost}/profile/wow/character/${charRealm}/${charName}/mythic-keystone-profile?locale=en_US`, headers: headers, muteHttpExceptions: true });
      requests.push({ url: `${apiHost}/profile/wow/character/${charRealm}/${charName}/encounters/raids?locale=en_US`, headers: headers, muteHttpExceptions: true });
      requests.push({ url: `${apiHost}/profile/wow/character/${charRealm}/${charName}/specializations?locale=en_US`, headers: headers, muteHttpExceptions: true });
    });

    const responses = UrlFetchApp.fetchAll(requests);

    chunk.forEach((char, idx) => {
      const baseIdx = idx * 6;
      const parseJson = (resp) => {
        try {
          if (resp && resp.getResponseCode() === 200) {
            return JSON.parse(resp.getContentText());
          }
        } catch (e) {
          Logger.log(`Error parsing response for ${char.name}: ${e}`);
        }
        return null;
      };

      results.push({
        character: char,
        profileData: parseJson(responses[baseIdx]),
        equipmentData: parseJson(responses[baseIdx + 1]),
        reputationsData: parseJson(responses[baseIdx + 2]),
        mplusData: parseJson(responses[baseIdx + 3]),
        raidData: parseJson(responses[baseIdx + 4]),
        specializationsData: parseJson(responses[baseIdx + 5])
      });
    });
  }

  return results;
}

/**
 * Calculates a summary readiness badge for the character.
 */
function calculateRaidReadyStatus(charRow) {
  const issues = [];

  // Check if character logged out in an unexpected off-spec
  if (charRow['Expected Spec'] && charRow['Spec']) {
    if (charRow['Expected Spec'].toLowerCase() !== charRow['Spec'].toLowerCase()) {
      issues.push(`⚠️ Off-Spec: ${charRow['Spec']} (Need: ${charRow['Expected Spec']})`);
    }
  }
  
  // Tier set check (warn if less than 4pc of current tier)
  const tierSetText = charRow['Tier Set'] || '';
  const tierMatch = tierSetText.match(/^(\d+)\/5/);
  const currentCount = tierMatch ? parseInt(tierMatch[1], 10) : 0;
  if (currentCount < 4) {
    issues.push(`${currentCount}/4 Tier`);
  }
  
  if (charRow['Empty Sockets'] > 0) {
    issues.push(`${charRow['Empty Sockets']} Empty Socket${charRow['Empty Sockets'] > 1 ? 's' : ''}`);
  }
  
  const enchantCols = [
    'Enchant Main Hand', 'Enchant Off Hand', 'Enchant Head', 'Enchant Shoulder',
    'Enchant Chest', 'Enchant Legs', 'Enchant Feet', 'Enchant Ring 1', 'Enchant Ring 2'
  ];
  let missingEnchants = 0;
  enchantCols.forEach(col => {
    if (charRow[col] === 'Missing') missingEnchants++;
  });
  
  if (missingEnchants > 0) {
    issues.push(`${missingEnchants} Missing Enchant${missingEnchants > 1 ? 's' : ''}`);
  }
  
  return issues.length === 0 ? 'READY' : issues.join(', ');
}

/**
 * Robustly extracts the live Blizzard talent loadout code from specializations API data.
 */
function extractTalentCodeDeep(data, currentSpecName) {
  if (!data) return '-';
  
  if (data.specializations && Array.isArray(data.specializations)) {
    const spec = data.specializations.find(s => s.specialization && s.specialization.name === currentSpecName) || data.specializations[0];
    if (spec && spec.loadouts && Array.isArray(spec.loadouts)) {
      const active = spec.loadouts.find(l => l.is_active) || spec.loadouts[0];
      if (active) {
        const code = active.talent_loadout_code || active.selected_talent_loadout_code || active.selected_class_talents_string;
        if (code) return code;
      }
    }
  }

  // Deep string match for any 30+ character talent string in the response
  const jsonStr = JSON.stringify(data);
  const match = jsonStr.match(/"(?:talent_loadout_code|selected_talent_loadout_code|selected_class_talents_string)":"([^"]+)"/);
  if (match && match[1]) {
    return match[1];
  }

  return '-';
}

/**
 * Robustly extracts the active Hero Talent Tree name from specializations API data.
 */
function extractHeroTalentTree(data, currentSpecName) {
  if (!data) return '-';
  if (data.specializations && Array.isArray(data.specializations)) {
    const spec = data.specializations.find(s => s.specialization && s.specialization.name === currentSpecName) || data.specializations[0];
    if (spec && spec.loadouts && Array.isArray(spec.loadouts)) {
      const active = spec.loadouts.find(l => l.is_active) || spec.loadouts[0];
      if (active && active.selected_hero_talent_tree && active.selected_hero_talent_tree.name) {
        return active.selected_hero_talent_tree.name;
      }
    }
  }
  const jsonStr = JSON.stringify(data);
  const match = jsonStr.match(/"selected_hero_talent_tree":\{"key":\{"href":"[^"]*\/talent-tree\/([0-9]+)\?[^"]*\},"name":"([^"]+)"/);
  if (match && match[2]) return match[2];
  return '-';
}

/**
 * Processes a list of characters and extracts all gear, vault, and audit data.
 */
function processCharacterSet(characterNames, guildRosterMembers, config, token, enchantAndGemData, bonusData) {
  const filteredRoster = [];

  characterNames.forEach(entry => {
    let rawInput = '';
    let expectedSpec = '';
    let targetRealm = '';

    if (typeof entry === 'object' && entry !== null) {
      rawInput = (entry.name || '').toString().trim();
      expectedSpec = (entry.expectedSpec || '').toString().trim();
      targetRealm = (entry.realm || '').toString().trim().toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');
    } else {
      rawInput = (entry || '').toString().trim();
    }
    if (!rawInput) return;

    let targetName = rawInput;

    // Check for Expected Spec (e.g. Jevo:Protection or Jevo-Kiljaeden:Protection)
    if (targetName.includes(':')) {
      const specParts = targetName.split(':');
      targetName = specParts[0].trim();
      if (!expectedSpec) expectedSpec = specParts[1].trim();
    }

    if (targetName.includes('-')) {
      const parts = targetName.split('-');
      targetName = parts[0].trim();
      if (!targetRealm) targetRealm = parts.slice(1).join('-').trim().toLowerCase().replace(/\s+/g, '-').replace(/'/g, '');
    }

    // Match in guild roster
    const match = guildRosterMembers.find(m => {
      const rosterName = m.character.name.toLowerCase();
      const rosterRealm = (m.character.realm && m.character.realm.slug) ? m.character.realm.slug.toLowerCase() : '';
      if (targetRealm) {
        return rosterName === targetName.toLowerCase() && rosterRealm.includes(targetRealm);
      }
      return rosterName === targetName.toLowerCase();
    });

    if (match) {
      filteredRoster.push({
        name: match.character.name,
        realmSlug: match.character.realm.slug,
        expectedSpec: expectedSpec
      });
    } else {
      // If not found in guild roster directly (e.g. cross-realm alt or trial), add directly
      filteredRoster.push({
        name: targetName,
        realmSlug: targetRealm || config.GUILD_REALM_SLUG,
        expectedSpec: expectedSpec
      });
    }
  });

  if (filteredRoster.length === 0) {
    return [];
  }

  // --- PASS 1: Batch fetch all Blizzard API and Raider.IO payloads in parallel ---
  const requests = [];
  filteredRoster.forEach(char => {
    const realm = char.realmSlug || config.GUILD_REALM_SLUG;
    const name = char.name.toLowerCase();
    const region = (config.REGION || 'us').toLowerCase();
    const baseUrl = `https://${region}.api.blizzard.com/profile/wow/character/${realm}/${name}`;

    requests.push({ url: `${baseUrl}?namespace=profile-${region}&locale=en_US`, headers: { 'Authorization': `Bearer ${token}` }, muteHttpExceptions: true });
    requests.push({ url: `${baseUrl}/equipment?namespace=profile-${region}&locale=en_US`, headers: { 'Authorization': `Bearer ${token}` }, muteHttpExceptions: true });
    requests.push({ url: `${baseUrl}/reputations?namespace=profile-${region}&locale=en_US`, headers: { 'Authorization': `Bearer ${token}` }, muteHttpExceptions: true });
    requests.push({ url: `${baseUrl}/mythic-keystone-profile?namespace=profile-${region}&locale=en_US`, headers: { 'Authorization': `Bearer ${token}` }, muteHttpExceptions: true });
    requests.push({ url: `${baseUrl}/encounters/raids?namespace=profile-${region}&locale=en_US`, headers: { 'Authorization': `Bearer ${token}` }, muteHttpExceptions: true });
    requests.push({ url: `${baseUrl}/specializations?namespace=profile-${region}&locale=en_US`, headers: { 'Authorization': `Bearer ${token}` }, muteHttpExceptions: true });
    requests.push({ url: `https://raider.io/api/v1/characters/profile?region=${region}&realm=${realm}&name=${encodeURIComponent(name)}&fields=mythic_plus_weekly_runs`, muteHttpExceptions: true });
  });

  const responses = UrlFetchApp.fetchAll(requests);
  const batchedPayloads = [];

  for (let i = 0; i < filteredRoster.length; i++) {
    const char = filteredRoster[i];
    const offset = i * 7;

    const profileResp = responses[offset];
    const equipResp = responses[offset + 1];
    const repResp = responses[offset + 2];
    const mplusResp = responses[offset + 3];
    const raidResp = responses[offset + 4];
    const specResp = responses[offset + 5];
    const raiderIoResp = responses[offset + 6];

    batchedPayloads.push({
      character: char,
      profileData: (profileResp && profileResp.getResponseCode() === 200) ? JSON.parse(profileResp.getContentText()) : null,
      equipmentData: (equipResp && equipResp.getResponseCode() === 200) ? JSON.parse(equipResp.getContentText()) : null,
      reputationsData: (repResp && repResp.getResponseCode() === 200) ? JSON.parse(repResp.getContentText()) : null,
      mplusData: (mplusResp && mplusResp.getResponseCode() === 200) ? JSON.parse(mplusResp.getContentText()) : null,
      raidData: (raidResp && raidResp.getResponseCode() === 200) ? JSON.parse(raidResp.getContentText()) : null,
      specializationsData: (specResp && specResp.getResponseCode() === 200) ? JSON.parse(specResp.getContentText()) : null,
      raiderIoData: (raiderIoResp && raiderIoResp.getResponseCode() === 200) ? JSON.parse(raiderIoResp.getContentText()) : null
    });
  }

  // Find the current season's maximum tier set ID across all characters
  let globalMaxSetId = 0;
  const classToMaxSetId = {};

  for (const item of batchedPayloads) {
    const eq = item.equipmentData;
    const className = (item.profileData && item.profileData.character_class) ? item.profileData.character_class.name : '';
    if (eq && eq.equipped_items) {
      for (const eqItem of eq.equipped_items) {
        if (['HEAD', 'SHOULDER', 'CHEST', 'HANDS', 'LEGS'].includes(eqItem.slot.type) && eqItem.set && eqItem.set.item_set) {
          const setId = Number(eqItem.set.item_set.id) || 0;
          if (setId > 0) {
            if (setId > globalMaxSetId) globalMaxSetId = setId;
            if (className) {
              if (!classToMaxSetId[className] || setId > classToMaxSetId[className]) {
                classToMaxSetId[className] = setId;
              }
            }
          }
        }
      }
    }
  }

  // Any set ID older than (globalMaxSetId - 15) belongs to a previous season's database block
  const seasonMinSetIdThreshold = globalMaxSetId > 0 ? (globalMaxSetId - 15) : 0;

  // --- PASS 2: Process Character Rows ---
  const characterDataObjects = [];
  for (const item of batchedPayloads) {
    const { character, profileData, equipmentData, reputationsData, mplusData, raidData, specializationsData, raiderIoData } = item;
    const charName = character.name;

    let charRow = {
      'Name': charName,
      'Class': '',
      'Spec': '',
      'Expected Spec': character.expectedSpec || '',
      'iLvl': 0,
      'Raid Ready': 'Checking...',
      'M+ Rating': 0,
      'Tier Set': '0/5',
      'Total Sockets': 0,
      'Empty Sockets': 0,
      'Imperfect Gems': 0,
      'Crafted Items': 0,
      'Embellishment 1': '-',
      'Embellishment 2': '-',
      'Head': '-',
      'Shoulders': '-',
      'Chest': '-',
      'Hands': '-',
      'Legs': '-',
      'Main Hand': '-',
      'Off Hand': '-',
      'Trinket 1': '-',
      'Trinket 2': '-',
      'Neck': '-',
      'Back': '-',
      'Wrist': '-',
      'Waist': '-',
      'Feet': '-',
      'Ring 1': '-',
      'Ring 2': '-',
      'Enchant Main Hand': 'Missing',
      'Enchant Off Hand': 'Missing',
      'Enchant Head': 'Missing',
      'Enchant Shoulder': 'Missing',
      'Enchant Chest': 'Missing',
      'Enchant Legs': 'Missing',
      'Enchant Feet': 'Missing',
      'Enchant Ring 1': 'Missing',
      'Enchant Ring 2': 'Missing',
      'GV Slots Unlocked': 0,
      'GV Raid 1': '-',
      'GV Raid 2': '-',
      'GV Raid 3': '-',
      'GV M+ 1': '-',
      'GV M+ 2': '-',
      'GV M+ 3': '-'
    };

    // --- 1. Process Profile & Specializations ---
    if (profileData) {
      charRow['iLvl'] = profileData.equipped_item_level || 0;
      charRow['Class'] = profileData.character_class ? profileData.character_class.name : '';
      charRow['Spec'] = profileData.active_spec ? profileData.active_spec.name : '';
    }

    if (specializationsData) {
      charRow['Talent Code'] = extractTalentCodeDeep(specializationsData, charRow['Spec']);
      charRow['Hero Talents'] = extractHeroTalentTree(specializationsData, charRow['Spec']);
    } else {
      charRow['Talent Code'] = '-';
      charRow['Hero Talents'] = '-';
    }

    const classSlug = (charRow['Class'] || '').toLowerCase().replace(/\s+/g, '-');
    const specSlug = (charRow['Spec'] || '').toLowerCase().replace(/\s+/g, '-');
    if (classSlug && specSlug) {
      wowheadGuideLink = `https://www.wowhead.com/guide/classes/${classSlug}/${specSlug}/overview`;
      archonHeroicLink = `https://www.archon.gg/wow/builds/${specSlug}/${classSlug}/raid/overview/heroic/all-bosses`;
      archonMythicLink = `https://www.archon.gg/wow/builds/${specSlug}/${classSlug}/raid/overview/mythic/all-bosses`;
    }

    // Use the character's exact realm slug from their Blizzard profile / roster data
    const charRealmSlug = (profileData && profileData.realm && profileData.realm.slug) 
      ? profileData.realm.slug 
      : (character.realmSlug || config.GUILD_REALM_SLUG || 'kiljaeden');
    const charRegion = (config.REGION || 'us').toLowerCase();

    charRow['Wowhead Link'] = wowheadGuideLink;
    charRow['Archon Heroic Link'] = archonHeroicLink;
    charRow['Archon Mythic Link'] = archonMythicLink;
    charRow['Droptimizer Link'] = `https://www.raidbots.com/simbot/droptimizer?region=${charRegion}&realm=${charRealmSlug}&name=${encodeURIComponent(charName)}`;

    // --- 2. Process Great Vault & Raids ---
    if (mplusData) {
      if (mplusData.current_mythic_rating) {
        charRow['M+ Rating'] = Math.round(mplusData.current_mythic_rating.rating || 0);
        const c = mplusData.current_mythic_rating.color;
        if (c) {
          charRow['M+ Rating Color'] = rgbToHex(c.r, c.g, c.b);
        }
      }

      if (mplusData.current_period && mplusData.current_period.period) {
        const weekStartTimestamp = (mplusData.current_period.period.id * 604800000) + 1135699200000;
        const weekEndTimestamp = weekStartTimestamp + 604800000;

        // Robust Raid Kill Tracking: Scan recent expansions for kills in current period
        if (raidData && raidData.expansions) {
          let weeklyMythicKills = 0;
          let weeklyHeroicKills = 0;
          let weeklyNormalKills = 0;
          let weeklyLFRKills = 0;

          // Check the last 3 expansion entries to be immune to expansion index changes
          const expansionsToCheck = raidData.expansions.slice(-3);
          for (const exp of expansionsToCheck) {
            if (exp.instances) {
              for (const raidInstance of exp.instances) {
                if (raidInstance.modes) {
                  for (const mode of raidInstance.modes) {
                    if (mode.progress && mode.progress.encounters) {
                      for (const boss of mode.progress.encounters) {
                        if (boss.last_kill_timestamp >= weekStartTimestamp && boss.last_kill_timestamp < weekEndTimestamp) {
                          if (mode.difficulty.type === 'MYTHIC') weeklyMythicKills++;
                          else if (mode.difficulty.type === 'HEROIC') weeklyHeroicKills++;
                          else if (mode.difficulty.type === 'NORMAL') weeklyNormalKills++;
                          else if (mode.difficulty.type === 'LFR') weeklyLFRKills++;
                        }
                      }
                    }
                  }
                }
              }
            }
          }

          if (weeklyLFRKills >= 6) { charRow['GV Raid 3'] = VAULT_MAPPING.raid.lfr; charRow['GV Raid 2'] = VAULT_MAPPING.raid.lfr; charRow['GV Raid 1'] = VAULT_MAPPING.raid.lfr; }
          else if (weeklyLFRKills >= 4) { charRow['GV Raid 2'] = VAULT_MAPPING.raid.lfr; charRow['GV Raid 1'] = VAULT_MAPPING.raid.lfr; }
          else if (weeklyLFRKills >= 2) { charRow['GV Raid 1'] = VAULT_MAPPING.raid.lfr; }

          if (weeklyNormalKills >= 6) { charRow['GV Raid 3'] = VAULT_MAPPING.raid.normal; charRow['GV Raid 2'] = VAULT_MAPPING.raid.normal; charRow['GV Raid 1'] = VAULT_MAPPING.raid.normal; }
          else if (weeklyNormalKills >= 4) { charRow['GV Raid 2'] = VAULT_MAPPING.raid.normal; charRow['GV Raid 1'] = VAULT_MAPPING.raid.normal; }
          else if (weeklyNormalKills >= 2) { charRow['GV Raid 1'] = VAULT_MAPPING.raid.normal; }
                          
          if (weeklyHeroicKills >= 6) { charRow['GV Raid 3'] = VAULT_MAPPING.raid.heroic; charRow['GV Raid 2'] = VAULT_MAPPING.raid.heroic; charRow['GV Raid 1'] = VAULT_MAPPING.raid.heroic; }
          else if (weeklyHeroicKills >= 4) { charRow['GV Raid 2'] = VAULT_MAPPING.raid.heroic; charRow['GV Raid 1'] = VAULT_MAPPING.raid.heroic; }
          else if (weeklyHeroicKills >= 2) { charRow['GV Raid 1'] = VAULT_MAPPING.raid.heroic; }

          if (weeklyMythicKills >= 6) { charRow['GV Raid 3'] = VAULT_MAPPING.raid.mythic; charRow['GV Raid 2'] = VAULT_MAPPING.raid.mythic; charRow['GV Raid 1'] = VAULT_MAPPING.raid.mythic; }
          else if (weeklyMythicKills >= 4) { charRow['GV Raid 2'] = VAULT_MAPPING.raid.mythic; charRow['GV Raid 1'] = VAULT_MAPPING.raid.mythic; }
          else if (weeklyMythicKills >= 2) { charRow['GV Raid 1'] = VAULT_MAPPING.raid.mythic; }
        }

        // Mythic+ Vault Slots (Hybrid Blizzard API + Raider.IO Engine)
        let allWeeklyMplusRuns = [];

        // Source A: Blizzard API best_runs
        if (mplusData && mplusData.current_period && mplusData.current_period.best_runs && Array.isArray(mplusData.current_period.best_runs)) {
          mplusData.current_period.best_runs.forEach(r => {
            if (r.keystone_level && r.keystone_level > 0) {
              allWeeklyMplusRuns.push({
                level: r.keystone_level,
                dungeon: (r.dungeon && r.dungeon.name) ? r.dungeon.name : ''
              });
            }
          });
        }

        // Source B: Raider.IO mythic_plus_weekly_runs (Includes duplicate dungeons and untimed runs!)
        if (raiderIoData && raiderIoData.mythic_plus_weekly_runs && Array.isArray(raiderIoData.mythic_plus_weekly_runs)) {
          const rioRuns = raiderIoData.mythic_plus_weekly_runs
            .map(r => ({ level: r.mythic_level || 0, dungeon: r.dungeon || '' }))
            .filter(r => r.level > 0);

          // If Raider.IO tracked more completed runs than Blizzard's deduplicated list, use the full list!
          if (rioRuns.length > allWeeklyMplusRuns.length) {
            allWeeklyMplusRuns = rioRuns;
          }
        }

        if (allWeeklyMplusRuns.length > 0) {
          const sortedRuns = allWeeklyMplusRuns.sort((a, b) => b.level - a.level);
          if (sortedRuns.length >= 1) charRow['GV M+ 1'] = VAULT_MAPPING.mplus[sortedRuns[0].level] || (sortedRuns[0].level >= 10 ? 318 : '-');
          if (sortedRuns.length >= 4) charRow['GV M+ 2'] = VAULT_MAPPING.mplus[sortedRuns[3].level] || (sortedRuns[3].level >= 10 ? 318 : '-');
          if (sortedRuns.length >= 8) charRow['GV M+ 3'] = VAULT_MAPPING.mplus[sortedRuns[7].level] || (sortedRuns[7].level >= 10 ? 318 : '-');
        }
      }
    }

    // Count Unlocked Vault Slots
    let unlockedCount = 0;
    ['GV Raid 1', 'GV Raid 2', 'GV Raid 3', 'GV M+ 1', 'GV M+ 2', 'GV M+ 3'].forEach(slot => {
      if (charRow[slot] !== '-') unlockedCount++;
    });
    charRow['GV Slots Unlocked'] = unlockedCount;

    // --- 3. Process Equipment, Sockets, Enchants & Tier ---
    if (equipmentData && equipmentData.equipped_items) {
      const embellishments = [];
      let isTwoHandWeapon = false;
      let hasOffHandItem = false;
      let offHandInventoryType = '';

      // Tier helper: Verifies piece is from the active season tier ID block and matches class max set ID
      const tierSlots = ['HEAD', 'SHOULDER', 'CHEST', 'HANDS', 'LEGS'];
      const isCurrentSeasonPiece = (eqItem) => {
        if (!eqItem.set || !eqItem.set.item_set) return false;
        const setId = Number(eqItem.set.item_set.id) || 0;
        if (setId === 0) return false;
        if (seasonMinSetIdThreshold > 0 && setId < seasonMinSetIdThreshold) return false;
        const charClass = charRow['Class'];
        if (charClass && classToMaxSetId[charClass] && setId < classToMaxSetId[charClass]) return false;
        return true;
      };

      let currentTierCount = 0;
      let prevTierCount = 0;
      for (const eqItem of equipmentData.equipped_items) {
        if (tierSlots.includes(eqItem.slot.type) && eqItem.set && eqItem.set.item_set) {
          if (isCurrentSeasonPiece(eqItem)) {
            currentTierCount++;
          } else {
            prevTierCount++;
          }
        }
      }

      for (const item of equipmentData.equipped_items) {
        // Upgrade Track & Progress extraction
        let upgradeInfo = '-';
        if (item.bonus_list && bonusData) {
          for (const bonusId of item.bonus_list) {
            const bonus = bonusData[bonusId];
            if (bonus && bonus.upgrade) {
              upgradeInfo = `${bonus.upgrade.name} ${bonus.upgrade.level}/${bonus.upgrade.max}`;
              break;
            }
          }
        }
        if (upgradeInfo === '-') {
          if (item.name_description && item.name_description.display_string.includes("Crafted")) {
            upgradeInfo = 'Crafted';
          } else if (item.quality && item.quality.type === 'LEGENDARY') {
            upgradeInfo = 'Legendary';
          }
        }

        // Track weapon types for offhand enchant logic
        if (item.slot.type === 'MAIN_HAND') {
          if (item.inventory_type && (item.inventory_type.type === 'TWOHWEAPON' || item.inventory_type.type === 'RANGED' || item.inventory_type.type === 'RANGEDRIGHT')) {
            isTwoHandWeapon = true;
          }
        }
        if (item.slot.type === 'OFF_HAND') {
          hasOffHandItem = true;
          offHandInventoryType = item.inventory_type ? item.inventory_type.type : '';
        }

        // Sockets & Gems logic (Midnight 2-rank quality: Silver Rank 1, Gold Rank 2)
        if (item.sockets) {
          for (const socket of item.sockets) {
            charRow['Total Sockets']++;
            if (socket.item) {
              const gemId = socket.item.id;
              const gemData = enchantAndGemData ? enchantAndGemData[gemId] : null;
              // In Midnight, gems have 2 ranks (Silver = 1, Gold = 2). Flag Silver (< 2) as Imperfect.
              const quality = gemData ? (gemData.craftingQuality || gemData.quality || 2) : 2;
              if (quality < 2) {
                charRow['Imperfect Gems']++;
              }
            } else {
              charRow['Empty Sockets']++;
            }
          }
        }

        // Crafted Items & Embellishments
        if (item.name_description && item.name_description.display_string.includes("Crafted")) {
          charRow['Crafted Items']++;
          if (item.spells) {
            for (const spell of item.spells) {
              if (spell.spell && spell.spell.name && (!item.bonus_list || !item.bonus_list.includes(11192))) {
                embellishments.push(spell.spell.name);
              }
            }
          }
        }

        // Enchants (Midnight slots: MH, OH, Head, Shoulder, Chest, Legs, Feet, Ring 1, Ring 2)
        if (item.enchantments && item.enchantments.length > 0) {
          const enchantName = item.enchantments[0].display_string;
          if (item.slot.type === 'MAIN_HAND') charRow['Enchant Main Hand'] = enchantName;
          if (item.slot.type === 'OFF_HAND') charRow['Enchant Off Hand'] = enchantName;
          if (item.slot.type === 'HEAD') charRow['Enchant Head'] = enchantName;
          if (item.slot.type === 'SHOULDER') charRow['Enchant Shoulder'] = enchantName;
          if (item.slot.type === 'CHEST') charRow['Enchant Chest'] = enchantName;
          if (item.slot.type === 'LEGS') charRow['Enchant Legs'] = enchantName;
          if (item.slot.type === 'FEET') charRow['Enchant Feet'] = enchantName;
          if (item.slot.type === 'FINGER_1') charRow['Enchant Ring 1'] = enchantName;
          if (item.slot.type === 'FINGER_2') charRow['Enchant Ring 2'] = enchantName;
        }

        // Tier Prefix Resolver: [Tier] for current season, [Prev Tier] for older season
        let tierPrefix = '';
        if (tierSlots.includes(item.slot.type) && item.set && item.set.item_set) {
          tierPrefix = isCurrentSeasonPiece(item) ? '[Tier] ' : '[Prev Tier] ';
        }

        // Slot Gear Display helper: [Tier/Prev Tier] <ilvl> (<track> <level>/<max>) - <Item Name>
        const formatItemDisplay = (equippedItem, prefix = '') => {
          const ilvl = equippedItem.level ? equippedItem.level.value : '';
          const itemName = equippedItem.name ? ` - ${equippedItem.name}` : '';
          return `${prefix}${ilvl} (${upgradeInfo})${itemName}`;
        };

        // Tier Armor Slots
        if (item.slot.type === 'HEAD') charRow['Head'] = formatItemDisplay(item, tierPrefix);
        if (item.slot.type === 'SHOULDER') charRow['Shoulders'] = formatItemDisplay(item, tierPrefix);
        if (item.slot.type === 'CHEST') charRow['Chest'] = formatItemDisplay(item, tierPrefix);
        if (item.slot.type === 'HANDS') charRow['Hands'] = formatItemDisplay(item, tierPrefix);
        if (item.slot.type === 'LEGS') charRow['Legs'] = formatItemDisplay(item, tierPrefix);

        // Other Gear Slots
        if (item.slot.type === 'MAIN_HAND') charRow['Main Hand'] = formatItemDisplay(item);
        if (item.slot.type === 'OFF_HAND') charRow['Off Hand'] = formatItemDisplay(item);
        if (item.slot.type === 'NECK') charRow['Neck'] = formatItemDisplay(item);
        if (item.slot.type === 'BACK') charRow['Back'] = formatItemDisplay(item);
        if (item.slot.type === 'WAIST') charRow['Waist'] = formatItemDisplay(item);
        if (item.slot.type === 'FEET') charRow['Feet'] = formatItemDisplay(item);
        if (item.slot.type === 'WRIST') charRow['Wrist'] = formatItemDisplay(item);
        if (item.slot.type === 'FINGER_1') charRow['Ring 1'] = formatItemDisplay(item);
        if (item.slot.type === 'FINGER_2') charRow['Ring 2'] = formatItemDisplay(item);
        if (item.slot.type === 'TRINKET_1') charRow['Trinket 1'] = formatItemDisplay(item);
        if (item.slot.type === 'TRINKET_2') charRow['Trinket 2'] = formatItemDisplay(item);
      }

      // Off-Hand Enchant Exception Handling
      if (isTwoHandWeapon && !hasOffHandItem) {
        charRow['Enchant Off Hand'] = 'N/A';
      } else if (hasOffHandItem && offHandInventoryType === 'HOLDABLE') {
        charRow['Enchant Off Hand'] = 'N/A'; // Held in Off-Hand cannot be enchanted
      }

      // Dynamic Tier Set Status Formatting
      if (currentTierCount >= 4) {
        charRow['Tier Set'] = `${currentTierCount}/5`;
      } else if (currentTierCount > 0 && prevTierCount > 0) {
        charRow['Tier Set'] = `${currentTierCount}/5 (+${prevTierCount} Prev)`;
      } else if (currentTierCount > 0 && prevTierCount === 0) {
        charRow['Tier Set'] = `${currentTierCount}/5`;
      } else if (currentTierCount === 0 && prevTierCount > 0) {
        charRow['Tier Set'] = `0/5 (${prevTierCount} Prev)`;
      } else {
        charRow['Tier Set'] = `0/5`;
      }

      if (embellishments[0]) charRow['Embellishment 1'] = embellishments[0];
      if (embellishments[1]) charRow['Embellishment 2'] = embellishments[1];
    }

    // --- 4. Calculate Raid Ready Summary ---
    charRow['Raid Ready'] = calculateRaidReadyStatus(charRow);

    characterDataObjects.push(charRow);
    Logger.log(`Processed ${charName}`);
  }

  return characterDataObjects;
}

function updateAllCharacterDataWithBonuses() {
  const config = getConfigurationFromSheet();
  if (!config) return;

  const token = getAccessToken(config);
  if (!token) return;

  const enchantAndGemData = getEnchantData();
  const bonusData = getBonusData();

  const headers = { 'Authorization': 'Bearer ' + token, 'Battlenet-Namespace': `profile-${config.REGION}` };
  const apiHost = getApiHost(config);

  const rosterData = fetchBlizzardEndpoint(`${apiHost}/data/wow/guild/${config.GUILD_REALM_SLUG}/${config.GUILD_NAME_SLUG}/roster?locale=en_US`, headers);
  if (!rosterData || !rosterData.members) {
    SpreadsheetApp.getUi().alert('Roster Fetch Failed', 'Failed to fetch guild roster. Please check your Realm Slug and Guild Slug.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  
  const outputHeaders = [
    'Name', 'Class', 'Spec', 'iLvl', 'Raid Ready', 'M+ Rating', 
    'Tier Set', 'Total Sockets', 'Empty Sockets', 'Imperfect Gems', 'Crafted Items',
    'Embellishment 1', 'Embellishment 2',
    'Head', 'Shoulders', 'Chest', 'Hands', 'Legs',
    'Main Hand', 'Off Hand', 'Trinket 1', 'Trinket 2', 
    'Neck', 'Back', 'Wrist', 'Waist', 'Feet', 'Ring 1', 'Ring 2',
    'Enchant Main Hand', 'Enchant Off Hand', 'Enchant Head', 'Enchant Shoulder', 'Enchant Chest', 'Enchant Legs', 'Enchant Feet', 'Enchant Ring 1', 'Enchant Ring 2',
    'GV Slots Unlocked', 
    'GV Raid 1', 'GV Raid 2', 'GV Raid 3',
    'GV M+ 1', 'GV M+ 2', 'GV M+ 3'
  ];

  // 1. Process Mains
  const mainCharacterData = processCharacterSet(config.MEMBERS_TO_TRACK, rosterData.members, config, token, enchantAndGemData, bonusData);
  mainCharacterData.sort((a, b) => (a['Class'] || '').localeCompare(b['Class'] || ''));

  // 2. Process Alts
  let altCharacterData = [];
  if (config.ALTS_TO_TRACK && config.ALTS_TO_TRACK.length > 0) {
      altCharacterData = processCharacterSet(config.ALTS_TO_TRACK, rosterData.members, config, token, enchantAndGemData, bonusData);
      altCharacterData.sort((a, b) => (a['Class'] || '').localeCompare(b['Class'] || ''));
  }

  // 3. Combine and Output
  const combinedDataObjects = [...mainCharacterData];
  const finalDataRows = [];

  finalDataRows.push(...mainCharacterData.map(obj => outputHeaders.map(header => obj[header] !== undefined ? obj[header] : '')));
  
  if (altCharacterData.length > 0) {
      finalDataRows.push(Array(outputHeaders.length).fill(''));
      finalDataRows.push(Array(outputHeaders.length).fill(''));
      
      finalDataRows.push(...altCharacterData.map(obj => outputHeaders.map(header => obj[header] !== undefined ? obj[header] : '')));
      combinedDataObjects.push({}, {}, ...altCharacterData);
  }
  
  const finalData = [outputHeaders, ...finalDataRows];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  sheet.clear();
  sheet.clearFormats();
  sheet.getRange(1, 1, finalData.length, finalData[0].length).setValues(finalData);
  
  applyFormatting(sheet, outputHeaders, combinedDataObjects);
  
  // 4. Update Talents & Builds Companion Sheet
  updateTalentsSheet(mainCharacterData, altCharacterData);

  // 5. Update Loot & Chase Items Sheet with live equipped gear upgrades
  createLootAndChaseItemsSheet(mainCharacterData);

  // 6. Auto-populate detected specs in Config sheet if empty, and refresh interactive dropdowns
  const configSheet = ss.getSheetByName('Config');
  if (configSheet) {
    const configData = configSheet.getDataRange().getValues();
    let configUpdated = false;
    for (let r = 0; r < configData.length; r++) {
      const rowName = configData[r][0] ? configData[r][0].toString().trim().toLowerCase() : '';
      const currentSpecVal = configData[r][1] ? configData[r][1].toString().trim() : '';
      if (rowName && !currentSpecVal) {
        const found = mainCharacterData.find(c => c['Name'] && c['Name'].toLowerCase() === rowName) || 
                      (altCharacterData && altCharacterData.find(c => c['Name'] && c['Name'].toLowerCase() === rowName));
        if (found && found['Spec']) {
          configData[r][1] = found['Spec'];
          configUpdated = true;
        }
      }
    }
    if (configUpdated) {
      configSheet.getDataRange().setValues(configData);
    }
    applyConfigDropdowns(configSheet);
  }

  SpreadsheetApp.getUi().alert('Audit Complete!', `Successfully updated ${mainCharacterData.length} mains and ${altCharacterData.length} alts across Audit, Talents, and Loot sheets.`, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Applies all conditional formatting and cosmetic styling.
 */
function applyFormatting(sheet, headers, characterDataObjects) {
  const fullRange = sheet.getDataRange();
  fullRange.setHorizontalAlignment('center');
  
  // Reset all number formats so legacy percentage formatting from older sheets is cleared
  fullRange.setNumberFormat('@');
  
  // Set integer number format for numeric stat columns in one batch
  ['iLvl', 'M+ Rating', 'Total Sockets', 'Empty Sockets', 'Imperfect Gems', 'Crafted Items', 'GV Slots Unlocked'].forEach(colName => {
    const colIdx = headers.indexOf(colName) + 1;
    if (colIdx > 0 && sheet.getMaxRows() > 1) {
      sheet.getRange(2, colIdx, sheet.getMaxRows() - 1, 1).setNumberFormat('0');
    }
  });
  
  sheet.setFrozenColumns(1);
  sheet.setFrozenRows(1);

  // Header styling
  const lastRow = sheet.getLastRow();
  const totalCols = sheet.getMaxColumns();

  // Clear previous conditional formatting rules
  sheet.clearConditionalFormatRules();

  // 1. Executive Grid & Row Alignment
  const fullDataRange = sheet.getDataRange();
  fullDataRange.setVerticalAlignment('middle');
  fullDataRange.setFontFamily('Roboto');

  // Header styling (Tailwind Slate 800)
  const headerRange = sheet.getRange(1, 1, 1, totalCols);
  headerRange.setBackground('#1e293b')
    .setFontColor('#f8fafc')
    .setFontWeight('bold')
    .setFontSize(10)
    .setHorizontalAlignment('center');
  sheet.setRowHeight(1, 34);

  if (lastRow > 1) {
    sheet.setRowHeights(2, lastRow - 1, 28);
    sheet.getRange(2, 1, lastRow - 1, totalCols).setFontSize(9).setFontWeight('bold');
  }

  const rules = [];

  // 2. Class Colors with high-contrast text
  const nameColIndex = headers.indexOf('Name') + 1;
  const classColIndex = headers.indexOf('Class') + 1;
  const specColIndex = headers.indexOf('Spec') + 1;
  const classAndSpecRanges = [];
  if (nameColIndex > 0) classAndSpecRanges.push(sheet.getRange(2, nameColIndex, sheet.getMaxRows(), 1));
  if (classColIndex > 0) classAndSpecRanges.push(sheet.getRange(2, classColIndex, sheet.getMaxRows(), 1));
  if (specColIndex > 0) classAndSpecRanges.push(sheet.getRange(2, specColIndex, sheet.getMaxRows(), 1));

  if (classAndSpecRanges.length > 0) {
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
  }

  // 3. Raid Ready Column Rules (Soft Modern Pills)
  const raidReadyColIdx = headers.indexOf('Raid Ready');
  if (raidReadyColIdx > -1) {
    const rrRange = [sheet.getRange(2, raidReadyColIdx + 1, sheet.getMaxRows(), 1)];
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("READY").setBackground("#d1fae5").setFontColor("#065f46").setRanges(rrRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Missing").setBackground("#ffe4e6").setFontColor("#9f1239").setRanges(rrRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Socket").setBackground("#ffe4e6").setFontColor("#9f1239").setRanges(rrRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Off-Spec").setBackground("#fef3c7").setFontColor("#92400e").setRanges(rrRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Tier").setBackground("#fef3c7").setFontColor("#92400e").setRanges(rrRange).build());
  }

  // 4. Upgrade Tracks & Gear Slots (Modern Tailwind Badges)
  const gearCols = [
    'Head', 'Shoulders', 'Chest', 'Hands', 'Legs',
    'Main Hand', 'Off Hand', 'Trinket 1', 'Trinket 2',
    'Neck', 'Back', 'Wrist', 'Waist', 'Feet', 'Ring 1', 'Ring 2'
  ];
  const gearRanges = gearCols
    .map(name => headers.indexOf(name) + 1)
    .filter(idx => idx > 0)
    .map(idx => sheet.getRange(2, idx, sheet.getMaxRows(), 1));

  if (gearRanges.length > 0) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Myth").setBackground("#ffedd5").setFontColor("#9a3412").setRanges(gearRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Hero").setBackground("#f3e8ff").setFontColor("#6b21a8").setRanges(gearRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Champion").setBackground("#e0f2fe").setFontColor("#075985").setRanges(gearRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Veteran").setBackground("#dcfce7").setFontColor("#166534").setRanges(gearRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Explorer").setBackground("#f1f5f9").setFontColor("#475569").setRanges(gearRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Adventurer").setBackground("#f1f5f9").setFontColor("#475569").setRanges(gearRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Crafted").setBackground("#fce7f3").setFontColor("#831843").setRanges(gearRanges).build());
  }

  // 5. Tier Set Progress Rules (Soft Badges)
  const tierSetColIdx = headers.indexOf('Tier Set');
  if (tierSetColIdx > -1) {
    const tsRange = [sheet.getRange(2, tierSetColIdx + 1, sheet.getMaxRows(), 1)];
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("5/5").setBackground("#d1fae5").setFontColor("#065f46").setRanges(tsRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("4/5").setBackground("#d1fae5").setFontColor("#065f46").setRanges(tsRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("3/5").setBackground("#fef3c7").setFontColor("#92400e").setRanges(tsRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("2/5").setBackground("#fef3c7").setFontColor("#92400e").setRanges(tsRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("1/5").setBackground("#ffe4e6").setFontColor("#9f1239").setRanges(tsRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("0/5").setBackground("#ffe4e6").setFontColor("#9f1239").setRanges(tsRange).build());
  }

  // 6. Sockets & Imperfect Gems Rules
  const emptySocketsColIdx = headers.indexOf('Empty Sockets');
  if (emptySocketsColIdx > -1) {
    const esRange = [sheet.getRange(2, emptySocketsColIdx + 1, sheet.getMaxRows(), 1)];
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground("#ffe4e6").setFontColor("#9f1239").setRanges(esRange).build());
  }

  const imperfectGemsColIdx = headers.indexOf('Imperfect Gems');
  if (imperfectGemsColIdx > -1) {
    const igRange = [sheet.getRange(2, imperfectGemsColIdx + 1, sheet.getMaxRows(), 1)];
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground("#fef3c7").setFontColor("#92400e").setRanges(igRange).build());
  }

  // 7. Enchants Rules (Multi-range consolidation)
  const enchantCols = [
    'Enchant Main Hand', 'Enchant Off Hand', 'Enchant Head', 'Enchant Shoulder',
    'Enchant Chest', 'Enchant Legs', 'Enchant Feet', 'Enchant Ring 1', 'Enchant Ring 2'
  ];
  const enchantRanges = enchantCols
    .map(name => headers.indexOf(name) + 1)
    .filter(idx => idx > 0)
    .map(idx => sheet.getRange(2, idx, sheet.getMaxRows(), 1));

  if (enchantRanges.length > 0) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Tier2").setBackground("#d1fae5").setFontColor("#065f46").setRanges(enchantRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Rune of").setBackground("#d1fae5").setFontColor("#065f46").setRanges(enchantRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Tier1").setBackground("#fef3c7").setFontColor("#92400e").setRanges(enchantRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("N/A").setBackground("#f8fafc").setFontColor("#94a3b8").setRanges(enchantRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Missing").setBackground("#ffe4e6").setFontColor("#9f1239").setRanges(enchantRanges).build());
  }
  
  // 8. Great Vault Styling & Borders
  const gvRaid1_idx = headers.indexOf('GV Raid 1') + 1;
  const gvRaid3_idx = headers.indexOf('GV Raid 3') + 1;
  const gvMplus1_idx = headers.indexOf('GV M+ 1') + 1;
  const gvMplus3_idx = headers.indexOf('GV M+ 3') + 1;
  const thin_border = SpreadsheetApp.BorderStyle.SOLID;

  if (gvRaid1_idx > 0 && gvRaid3_idx > 0 && lastRow > 1) {
    sheet.getRange(1, gvRaid1_idx, lastRow, 3).setBorder(true, true, true, true, false, false, '#94a3b8', thin_border);
  }

  if (gvMplus1_idx > 0 && gvMplus3_idx > 0 && lastRow > 1) {
    sheet.getRange(1, gvMplus1_idx, lastRow, 3).setBorder(true, true, true, true, false, false, '#94a3b8', thin_border);
  }

  const gvRaidCols = ['GV Raid 1', 'GV Raid 2', 'GV Raid 3'];
  const gvRaidRanges = gvRaidCols
    .map(name => headers.indexOf(name) + 1)
    .filter(idx => idx > 0)
    .map(idx => sheet.getRange(2, idx, sheet.getMaxRows(), 1));

  if (gvRaidRanges.length > 0) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains(VAULT_MAPPING.raid.mythic.toString()).setBackground("#ffedd5").setFontColor("#9a3412").setRanges(gvRaidRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains(VAULT_MAPPING.raid.heroic.toString()).setBackground("#f3e8ff").setFontColor("#6b21a8").setRanges(gvRaidRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains(VAULT_MAPPING.raid.normal.toString()).setBackground("#e0f2fe").setFontColor("#075985").setRanges(gvRaidRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains(VAULT_MAPPING.raid.lfr.toString()).setBackground("#dcfce7").setFontColor("#166534").setRanges(gvRaidRanges).build());
  }

  const gvMplusCols = ['GV M+ 1', 'GV M+ 2', 'GV M+ 3'];
  const gvMplusRanges = gvMplusCols
    .map(name => headers.indexOf(name) + 1)
    .filter(idx => idx > 0)
    .map(idx => sheet.getRange(2, idx, sheet.getMaxRows(), 1));

  if (gvMplusRanges.length > 0) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(331).setBackground("#ffedd5").setFontColor("#9a3412").setRanges(gvMplusRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(312).setBackground("#f3e8ff").setFontColor("#6b21a8").setRanges(gvMplusRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(299).setBackground("#e0f2fe").setFontColor("#075985").setRanges(gvMplusRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(292).setBackground("#dcfce7").setFontColor("#166534").setRanges(gvMplusRanges).build());
  }

  // 9. M+ Rating Color (Batch updated in 1 single call with high-contrast text)
  const mPlusRatingColIdx = headers.indexOf('M+ Rating') + 1;
  if (mPlusRatingColIdx > 0 && characterDataObjects && characterDataObjects.length > 0) {
    const backgrounds = characterDataObjects.map(charData => [(charData && charData['M+ Rating Color']) ? charData['M+ Rating Color'] : '#ffffff']);
    const fontColors = characterDataObjects.map(charData => {
      const col = (charData && charData['M+ Rating Color']) ? charData['M+ Rating Color'].toLowerCase() : '';
      return [(col.includes('ff8000') || col.includes('a335ee') || col.includes('0070dd')) ? '#ffffff' : '#0f172a'];
    });
    sheet.getRange(2, mPlusRatingColIdx, backgrounds.length, 1).setBackgrounds(backgrounds).setFontColors(fontColors);
  }

  sheet.setConditionalFormatRules(rules);

  // Set column widths directly
  const minWidths = {
    'Name': 130, 'Class': 110, 'Spec': 130, 'iLvl': 70,
    'Raid Ready': 460, 'M+ Rating': 95, 'Tier Set': 140,
    'Total Sockets': 110, 'Empty Sockets': 110, 'Imperfect Gems': 120, 'Crafted Items': 110,
    'Embellishment 1': 240, 'Embellishment 2': 240,
    'Head': 360, 'Shoulders': 360, 'Chest': 360, 'Hands': 360, 'Legs': 360,
    'Main Hand': 360, 'Off Hand': 360, 'Trinket 1': 360, 'Trinket 2': 360,
    'Neck': 360, 'Back': 360, 'Wrist': 360, 'Waist': 360, 'Feet': 360,
    'Ring 1': 360, 'Ring 2': 360,
    'Enchant Main Hand': 220, 'Enchant Off Hand': 220, 'Enchant Head': 220, 'Enchant Shoulder': 220,
    'Enchant Chest': 220, 'Enchant Legs': 220, 'Enchant Feet': 220, 'Enchant Ring 1': 220, 'Enchant Ring 2': 220,
    'GV Slots Unlocked': 130, 'GV Raid 1': 100, 'GV Raid 2': 100, 'GV Raid 3': 100,
    'GV M+ 1': 100, 'GV M+ 2': 100, 'GV M+ 3': 100
  };

  headers.forEach((header, idx) => {
    sheet.setColumnWidth(idx + 1, minWidths[header] || 130);
  });
}

const ARCHON_BOSS_OPTIONS = [
  'All Bosses (Overview)',
  'Nek\'zali',
  'Sentinels',
  'Vashnik',
  'Explorers',
  'Sszorak',
  'The Twin Fangs',
  'The Coiled Altar',
  'Ula\'tek',
  'Nymrissa'
];

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
    const bossSlugFormula = `IF(F${rowNum}="Nek'zali", "nekzali", IF(F${rowNum}="Sentinels", "sentinels", IF(F${rowNum}="Vashnik", "vashnik", IF(F${rowNum}="Explorers", "explorers", IF(F${rowNum}="Sszorak", "sszorak", IF(F${rowNum}="The Twin Fangs", "the-twin-fangs", IF(F${rowNum}="The Coiled Altar", "the-coiled-altar", IF(F${rowNum}="Ula'tek", "ulatek", IF(F${rowNum}="Nymrissa", "nymrissa", "all-bosses")))))))))`;

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

/**
 * Reads all raider rows from the "Guild Audit" tab to extract equipped gear & ilvl.
 */
function getGuildAuditCharacterList(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  const auditSheet = ss.getSheetByName(SHEET_NAME) || ss.getSheetByName('Guild Audit');
  if (!auditSheet || auditSheet.getLastRow() <= 1) return [];

  // Read assigned raid specs from the "Config" sheet to ensure main spec priority
  const assignedSpecs = {};
  const configSheet = ss.getSheetByName('Config');
  if (configSheet && configSheet.getLastRow() > 1) {
    const configData = configSheet.getDataRange().getValues();
    let readingMains = false;
    configData.forEach(row => {
      const header = (row[0] || '').toString().toLowerCase().trim();
      if (header.includes('main character')) {
        readingMains = true;
        return;
      } else if (header.includes('alt character') || header.includes('alts to track')) {
        readingMains = false;
        return;
      }
      if (readingMains && row[0]) {
        const cName = row[0].toString().trim().toLowerCase();
        const cSpec = row[1] ? row[1].toString().trim() : '';
        if (cName && cSpec) {
          assignedSpecs[cName] = cSpec;
        }
      }
    });
  }

  const lastCol = auditSheet.getLastColumn();
  const headers = auditSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const rows = auditSheet.getRange(2, 1, auditSheet.getLastRow() - 1, lastCol).getValues();

  const list = [];
  rows.forEach(r => {
    const charName = (r[0] || '').toString().trim();
    if (!charName) return;
    const charObj = {};
    headers.forEach((h, idx) => {
      charObj[h] = r[idx];
    });

    // Enforce official assigned raid main spec over temporary logged-out off-spec
    const lowerName = charName.toLowerCase();
    charObj['MainSpec'] = assignedSpecs[lowerName] || charObj['Expected Spec'] || charObj['Spec'] || '';

    list.push(charObj);
  });
  return list;
}

/**
 * Maps Blizzard API inventory type enums to spreadsheet slot names.
 */
function mapBlizzardInvTypeToSlot(invType) {
  if (!invType) return 'Gear';
  const type = (typeof invType === 'object' ? (invType.type || invType.name || '') : invType).toString().toUpperCase();
  switch (type) {
    case 'HEAD': return 'Head';
    case 'NECK': return 'Neck';
    case 'SHOULDER': case 'SHOULDERS': return 'Shoulders';
    case 'CLOAK': case 'BACK': return 'Back';
    case 'CHEST': case 'ROBE': return 'Chest';
    case 'WRIST': case 'WRISTS': return 'Wrist';
    case 'HANDS': return 'Hands';
    case 'WAIST': return 'Waist';
    case 'LEGS': return 'Legs';
    case 'FEET': return 'Feet';
    case 'FINGER': case 'FINGER_1': case 'FINGER_2': case 'RING': return 'Ring 1';
    case 'TRINKET': case 'TRINKET_1': case 'TRINKET_2': return 'Trinket 1';
    case 'TWOHWEAPON': return 'Two-Hand (2H)';
    case 'RANGED': case 'RANGEDRIGHT': return 'Ranged (2H)';
    case 'WEAPON': case 'WEAPONMAINHAND': case '1H WEAPON': return 'One-Hand (1H)';
    case 'SHIELD': return 'Off Hand (Shield)';
    case 'HOLDABLE': case 'WEAPONOFFHAND': case 'OFF HAND': return 'Off Hand';
    default: return 'Gear';
  }
}

/**
 * Queries Blizzard's official Game Data Journal API for all 8 raid encounters in The Venomous Abyss.
 * Fetches item metadata, inventory slot, armor subclass, and drop information directly from Blizzard.
 */
function fetchLiveBlizzardRaidLootTable(config, token) {
  if (!config || !token) return null;
  const region = (config.REGION || 'us').toLowerCase();
  const apiHost = getApiHost(config);
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Battlenet-Namespace': `static-${region}`
  };

  const ENCOUNTERS = [
    { id: 2888, name: "Boss 1: Nek'zali the Soulcoiler", banner: "⚔️ BOSS 1: NEK'ZALI THE SOULCOILER" },
    { id: 2874, name: "Boss 2: Entombed Sentinels", banner: "🛡️ BOSS 2: ENTOMBED SENTINELS" },
    { id: 2894, name: "Boss 3: The Lost Explorers", banner: "🧭 BOSS 3: THE LOST EXPLORERS" },
    { id: 2882, name: "Boss 4: Vashnik the Malignant", banner: "🧪 BOSS 4: VASHNIK THE MALIGNANT" },
    { id: 2871, name: "Boss 5: Sszorak", banner: "🐊 BOSS 5: SSZORAK" },
    { id: 2887, name: "Boss 6: The Twin Fangs", banner: "⚔️ BOSS 6: THE TWIN FANGS" },
    { id: 2883, name: "Boss 7: The Coiled Altar", banner: "🏛️ BOSS 7: THE COILED ALTAR" },
    { id: 2895, name: "Boss 8: Ula'tek", banner: "👑 BOSS 8: ULA'TEK (FINAL BOSS)" }
  ];

  try {
    // 1. Fetch encounter drops in parallel
    const encRequests = ENCOUNTERS.map(e => ({
      url: `${apiHost}/data/wow/journal-encounter/${e.id}?locale=en_US`,
      headers: headers,
      muteHttpExceptions: true
    }));

    const encResponses = UrlFetchApp.fetchAll(encRequests);
    const encounterItemMap = [];
    const allItemIds = new Set();

    encResponses.forEach((resp, idx) => {
      const enc = ENCOUNTERS[idx];
      const itemsForThisBoss = [];
      if (resp && resp.getResponseCode() === 200) {
        try {
          const encData = JSON.parse(resp.getContentText());
          if (encData && encData.items) {
            encData.items.forEach(itEntry => {
              const itId = itEntry.item ? itEntry.item.id : itEntry.id;
              const itName = itEntry.item ? itEntry.item.name : (itEntry.name || '');
              if (itId) {
                itemsForThisBoss.push({ id: itId, name: itName });
                allItemIds.add(itId);
              }
            });
          }
        } catch (err) {
          Logger.log(`Error parsing encounter ${enc.id}: ${err}`);
        }
      }
      encounterItemMap.push({ encounter: enc, items: itemsForThisBoss });
    });

    if (allItemIds.size === 0) return null;

    // 2. Fetch all item metadata in parallel
    const itemIdsArray = Array.from(allItemIds);
    const itemRequests = itemIdsArray.map(id => ({
      url: `${apiHost}/data/wow/item/${id}?locale=en_US`,
      headers: headers,
      muteHttpExceptions: true
    }));

    const itemResponses = UrlFetchApp.fetchAll(itemRequests);
    const itemDetailsMap = {};

    itemResponses.forEach((resp, idx) => {
      const itemId = itemIdsArray[idx];
      if (resp && resp.getResponseCode() === 200) {
        try {
          const itemData = JSON.parse(resp.getContentText());
          const itemClassId = (itemData.item_class && itemData.item_class.id) ? itemData.item_class.id : 0;
          const itemClassName = (itemData.item_class && itemData.item_class.name) ? itemData.item_class.name.toLowerCase() : '';
          const subclassName = (itemData.item_subclass && itemData.item_subclass.name) ? itemData.item_subclass.name.toLowerCase() : '';
          const qualityType = (itemData.quality && itemData.quality.type) ? itemData.quality.type.toUpperCase() : '';
          const invType = itemData.inventory_type ? (itemData.inventory_type.type || '').toUpperCase() : 'NON_EQUIP';
          const itemName = itemData.name || '';
          const slot = mapBlizzardInvTypeToSlot(invType);

          // Omit cosmetics, junk, pets, mounts, toys, recipes, reagents, consumables, quest items
          const isExcludedType = ['junk', 'mount', 'companion pets', 'pet', 'toy', 'holiday', 'recipe', 'reagent', 'housing', 'decor', 'consumable', 'currency', 'cosmetic', 'quest', 'profession'].some(ex => subclassName.includes(ex) || itemClassName.includes(ex));
          const isExcludedQuality = qualityType === 'COSMETIC' || qualityType === 'POOR';
          const isNonEquip = invType === 'NON_EQUIP' || slot === 'Gear';

          // Strictly include ONLY valid, equippable raid armor, weapons, and accessories
          if (!isExcludedType && !isExcludedQuality && !isNonEquip && (itemClassId === 2 || itemClassId === 4)) {
            let cleanSubclass = (itemData.item_subclass && itemData.item_subclass.name) ? itemData.item_subclass.name : 'All Specs';
            
            // Extract primary stat from Blizzard item stats array
            let primaryStatLabel = '';
            const stats = (itemData.preview_item && itemData.preview_item.stats) || itemData.stats || [];
            const foundStats = [];
            stats.forEach(st => {
              const type = (st.type && st.type.type) ? st.type.type.toUpperCase() : '';
              if (type === 'STRENGTH') foundStats.push('Str');
              else if (type === 'AGILITY') foundStats.push('Agi');
              else if (type === 'INTELLECT') foundStats.push('Int');
            });
            if (foundStats.includes('Str') && foundStats.includes('Agi') && foundStats.includes('Int')) {
              primaryStatLabel = 'All Stats';
            } else if (foundStats.includes('Str') && foundStats.includes('Agi')) {
              primaryStatLabel = 'Str / Agi';
            } else if (foundStats.includes('Agi') && foundStats.includes('Int')) {
              primaryStatLabel = 'Agi / Int';
            } else if (foundStats.includes('Str')) {
              primaryStatLabel = 'Strength';
            } else if (foundStats.includes('Agi')) {
              primaryStatLabel = 'Agility';
            } else if (foundStats.includes('Int')) {
              primaryStatLabel = 'Intellect';
            }

            // Format Shields, Off-Hands, Weapons, and Accessories with clear role and primary stat
            if (invType === 'SHIELD' || slot === 'Off Hand (Shield)') {
              cleanSubclass = 'Shield';
              if (primaryStatLabel) cleanSubclass += ` (${primaryStatLabel})`;
            } else if (invType === 'HOLDABLE' || slot === 'Off Hand') {
              cleanSubclass = 'Caster / Healer Off-Hand';
              if (primaryStatLabel) cleanSubclass += ` (${primaryStatLabel})`;
            } else if (itemClassId === 2) {
              if (invType === 'TWOHWEAPON' && !cleanSubclass.toLowerCase().includes('2h') && !cleanSubclass.toLowerCase().includes('two-hand')) {
                cleanSubclass = '2H ' + cleanSubclass;
              } else if ((invType === 'WEAPON' || invType === 'WEAPONMAINHAND') && !cleanSubclass.toLowerCase().includes('1h') && !cleanSubclass.toLowerCase().includes('one-hand') && !['Dagger', 'Warglaive', 'Fist Weapon', 'Wand'].includes(cleanSubclass)) {
                cleanSubclass = '1H ' + cleanSubclass;
              } else if (invType === 'RANGED' || invType === 'RANGEDRIGHT') {
                cleanSubclass = 'Ranged (' + cleanSubclass + ')';
              }

              if (primaryStatLabel && !cleanSubclass.includes(primaryStatLabel)) {
                cleanSubclass += ` (${primaryStatLabel})`;
              }
            } else {
              if (['Neck', 'Ring 1', 'Trinket 1'].includes(slot) && cleanSubclass.toLowerCase() === 'miscellaneous') {
                cleanSubclass = primaryStatLabel ? `Trinket (${primaryStatLabel})` : 'All Specs';
              } else if (slot === 'Back') {
                cleanSubclass = 'All Specs';
              } else if (primaryStatLabel && ['Trinket 1', 'Ring 1', 'Neck'].includes(slot)) {
                cleanSubclass += ` (${primaryStatLabel})`;
              }
            }

            itemDetailsMap[itemId] = {
              name: itemName,
              slot: slot,
              subclass: cleanSubclass,
              quality: qualityType,
              level: itemData.level || 318
            };
          }
        } catch (e) {
          Logger.log(`Error parsing item ${itemId}: ${e}`);
        }
      }
    });

    // 3. Construct the official catalog (filtered to equippable raid gear only)
    const catalog = [];
    encounterItemMap.forEach(entry => {
      catalog.push([entry.encounter.banner, '═════════════════════════════════', '', '', '', '', '', '', '', '', '', '', '']);
      entry.items.forEach(it => {
        const details = itemDetailsMap[it.id];
        // Only include verified equippable gear
        if (details) {
          catalog.push([
            entry.encounter.name,
            details.name,
            details.slot,
            'Heroic',
            318,
            details.subclass,
            '', '', '', '',
            'Raid Drop',
            '⚡ Live Armory ilvl',
            `Blizzard ID: ${it.id}`
          ]);
        }
      });
    });

    return catalog.length > ENCOUNTERS.length ? catalog : null;
  } catch (err) {
    Logger.log(`Failed to fetch live loot table from Blizzard API: ${err}`);
    return null;
  }
}

/**
 * Reads Roster Roles (from Config) and Season Attendance % / On-Time % (from Attendance & History)
 * to provide real-time context on the Loot & Chase Items sheet.
 */
function getRosterContextMap(ss) {
  const contextMap = {};
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Read Roster Roles and Specs from Config
  const configSheet = ss.getSheetByName('Config');
  if (configSheet && configSheet.getLastRow() >= 9) {
    const numRows = Math.min(configSheet.getLastRow() - 8, 37);
    const configData = configSheet.getRange(9, 1, numRows, 4).getValues();
    configData.forEach(row => {
      const rawName = (row[0] || '').toString().trim();
      const spec = (row[1] || '').toString().trim().toLowerCase();
      const { name } = parseCharacterAndRealm(rawName, '');
      const role = (row[2] || '⚔️ Raider').toString().trim() || '⚔️ Raider';
      if (name && !name.toLowerCase().includes('main character')) {
        contextMap[name.toLowerCase()] = {
          name: name,
          role: role,
          spec: spec,
          charClass: SPEC_TO_CLASS_MAP[spec] || '',
          attPct: null,
          onTimePct: null,
          isRaidReady: true
        };
      }
    });
  }

  // 2. Read Attendance % from Attendance & History tab if it exists
  const attSheet = ss.getSheetByName('Attendance & History');
  if (attSheet && attSheet.getLastRow() >= 4) {
    const attValues = attSheet.getDataRange().getValues();
    attValues.forEach(row => {
      const name = (row[1] || '').toString().trim();
      const attStr = (row[3] || '').toString().trim(); // Attendance %
      const onTimeStr = (row[4] || '').toString().trim(); // On-Time %
      if (name && attStr.includes('%')) {
        const lower = name.toLowerCase();
        if (!contextMap[lower]) {
          contextMap[lower] = { name: name, role: '⚔️ Raider', attPct: null, onTimePct: null, isRaidReady: true };
        }
        contextMap[lower].attPct = attStr;
        contextMap[lower].onTimePct = onTimeStr;
      }
    });
  }

  // 3. Read Class & Raid Readiness (Gems & Enchants) from Guild Audit tab if available
  const auditSheet = ss.getSheetByName(AUDIT_SHEET_NAME);
  if (auditSheet && auditSheet.getLastRow() >= 2) {
    const auditValues = auditSheet.getDataRange().getValues();
    const headers = auditValues[0].map(h => (h || '').toString().trim());
    const nameCol = headers.indexOf('Name');
    const classCol = headers.indexOf('Class');
    const readyCol = headers.indexOf('Raid Ready');
    if (nameCol > -1 && readyCol > -1) {
      for (let r = 1; r < auditValues.length; r++) {
        const charName = (auditValues[r][nameCol] || '').toString().trim();
        const className = classCol > -1 ? (auditValues[r][classCol] || '').toString().trim() : '';
        const readyStatus = (auditValues[r][readyCol] || '').toString().trim();
        if (charName) {
          const lower = charName.toLowerCase();
          if (!contextMap[lower]) {
            contextMap[lower] = { name: charName, role: '⚔️ Raider', attPct: null, onTimePct: null, isRaidReady: true, charClass: className };
          }
          if (className) contextMap[lower].charClass = className;
          const isMissingEnchantOrGem = readyStatus.toLowerCase().includes('missing') || readyStatus.toLowerCase().includes('empty socket') || readyStatus.toLowerCase().includes('socket');
          contextMap[lower].isRaidReady = !isMissingEnchantOrGem;
          contextMap[lower].readyStatus = readyStatus;
        }
      }
    }
  }

  return contextMap;
}

/**
 * Reads all registered Alt character names from the Config sheet (Columns F-I, rows 9-45).
 */
function getAltNamesSet(ss) {
  const altNames = new Set();
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('Config');
  if (configSheet && configSheet.getLastRow() >= 9) {
    const numRows = Math.min(configSheet.getLastRow() - 8, 37);
    const altData = configSheet.getRange(9, 6, numRows, 1).getValues();
    altData.forEach(row => {
      const rawName = (row[0] || '').toString().trim();
      const { name } = parseCharacterAndRealm(rawName, '');
      if (name && !name.toLowerCase().includes('alt character')) {
        altNames.add(name.toLowerCase());
      }
    });
  }
  return altNames;
}

/**
 * Loads Main character gear and stats from the "Guild Audit" sheet, strictly excluding any Alt characters.
 */
function getGuildAuditCharacterList(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  const auditSheet = ss.getSheetByName(AUDIT_SHEET_NAME);
  if (!auditSheet || auditSheet.getLastRow() < 2) return [];

  const altNamesSet = getAltNamesSet(ss);
  const auditValues = auditSheet.getDataRange().getValues();
  const headers = auditValues[0].map(h => (h || '').toString().trim());

  const nameCol = headers.indexOf('Name');
  const classCol = headers.indexOf('Class');
  const specCol = headers.indexOf('Spec');
  const ilvlCol = headers.indexOf('iLvl');
  const readyCol = headers.indexOf('Raid Ready');

  const mainCharacters = [];
  let reachedAltSection = false;

  for (let r = 1; r < auditValues.length; r++) {
    const row = auditValues[r];
    const name = nameCol > -1 ? (row[nameCol] || '').toString().trim() : '';

    if (!name || name.toLowerCase().includes('alt') || name.startsWith('───') || name.startsWith('═══')) {
      if (!name && r > 2 && auditValues[r + 1] && !auditValues[r + 1][nameCol]) {
        reachedAltSection = true;
      }
      continue;
    }

    if (reachedAltSection || altNamesSet.has(name.toLowerCase())) {
      continue; // Strictly exclude alts
    }

    const charObj = {
      'Name': name,
      'Class': classCol > -1 ? (row[classCol] || '').toString().trim() : '',
      'Spec': specCol > -1 ? (row[specCol] || '').toString().trim() : '',
      'iLvl': ilvlCol > -1 ? (row[ilvlCol] || 0) : 0,
      'Raid Ready': readyCol > -1 ? (row[readyCol] || '') : ''
    };

    headers.forEach((h, colIdx) => {
      if (h && !charObj[h]) {
        charObj[h] = (row[colIdx] || '').toString().trim();
      }
    });

    mainCharacters.push(charObj);
  }

  return mainCharacters;
}

/**
 * Calculates a composite Loot Council Priority Score balancing mathematical upgrade, season attendance, punctuality, roster role, and raid prep.
 * Formula: Score = RawGain * ReliabilityFactor * RoleMultiplier * PrepMultiplier
 * - Role: Veteran (1.10x), Raider (1.00x), Trial (0.80x)
 * - Reliability: (0.85 * Attendance% + 0.15 * OnTime%) with min floor at 0.40
 * - Prep (Gems & Enchants): READY (1.00x), Missing Enchants / Sockets (0.90x)
 */
function calculatePriorityScore(rawGain, charName, isSim, contextMap) {
  const numGain = parseFloat(rawGain) || 0;
  const normalizedGain = isSim ? numGain : (numGain / 10); // Scale +ilvl deltas comparable to % gain

  const lower = (charName || '').toLowerCase().trim();
  const ctx = (contextMap && contextMap[lower]) || { role: '⚔️ Raider', attPct: null, onTimePct: null, isRaidReady: true };
  const role = ctx.role || '⚔️ Raider';

  let roleMult = 1.00;
  if (role.includes('Veteran') || role.includes('👑')) roleMult = 1.10;
  else if (role.includes('Trial') || role.includes('🛡️')) roleMult = 0.80;

  let attVal = 1.00;
  if (ctx.attPct) {
    const parsedAtt = parseFloat(ctx.attPct.replace('%', ''));
    if (!isNaN(parsedAtt)) attVal = parsedAtt / 100;
  }

  let onTimeVal = 1.00;
  if (ctx.onTimePct && ctx.onTimePct !== 'N/A') {
    const parsedOnTime = parseFloat(ctx.onTimePct.replace('%', ''));
    if (!isNaN(parsedOnTime)) onTimeVal = parsedOnTime / 100;
  }

  // Composite Reliability Index: 85% Attendance + 15% On-Time Punctuality
  const reliabilityFactor = Math.min(1.0, Math.max(0.40, (0.85 * attVal) + (0.15 * onTimeVal)));

  // Raid Preparation Factor: 1.00x if READY, 0.90x (-10% penalty) if missing enchants / gems
  const isReady = (ctx.isRaidReady !== false);
  const prepMult = isReady ? 1.00 : 0.90;

  const score = normalizedGain * reliabilityFactor * roleMult * prepMult;
  return {
    score: Number(score.toFixed(2)),
    rawGain: numGain,
    role: role,
    roleMult: roleMult,
    attPct: ctx.attPct || '100%',
    onTimePct: ctx.onTimePct || '100%',
    reliabilityFactor: Number(reliabilityFactor.toFixed(2)),
    isRaidReady: isReady,
    prepMult: prepMult
  };
}

/**
 * Formats a contender string with their Priority Score, Roster Role, Attendance %, and Prep context.
 */
function formatContenderDisplay(name, valueStr, isSim, contextMap, scoreObj) {
  const lower = (name || '').toLowerCase().trim();
  const ctx = (contextMap && contextMap[lower]) || { role: '⚔️ Raider', attPct: null, isRaidReady: true };
  const roleBadge = ctx.role || '⚔️ Raider';
  const attBadge = ctx.attPct ? ` • ${ctx.attPct} Att` : '';

  if (!scoreObj) {
    scoreObj = calculatePriorityScore(valueStr, name, isSim, contextMap);
  }

  const prepBadge = (!scoreObj.isRaidReady) ? ' • ⚠️ Missing Enchants' : '';
  const scoreBadge = `[Score: ${scoreObj.score}]`;

  if (isSim) {
    return `${name} ${scoreBadge} (+${valueStr}% DPS • ${roleBadge}${attBadge}${prepBadge})`;
  } else {
    return `${name} ${scoreBadge} (+${valueStr} • ${roleBadge}${attBadge}${prepBadge})`;
  }
}

/**
 * Constructs a Google Sheets RichTextValue with player names styled in their official high-contrast WoW class colors.
 */
function buildRichTextWithClassColors(fullText, rosterContextMap) {
  const str = (fullText || '').toString();
  if (!str) return SpreadsheetApp.newRichTextValue().setText('').build();

  const builder = SpreadsheetApp.newRichTextValue().setText(str);
  
  if (!rosterContextMap) return builder.build();

  Object.keys(rosterContextMap).forEach(charLower => {
    const ctx = rosterContextMap[charLower];
    const charName = ctx.name || charLower;
    const charClass = ctx.charClass || '';
    const color = CLASS_ACCESSIBLE_COLORS[charClass] || CLASS_COLORS[charClass];

    if (color && charName) {
      const regex = new RegExp(`\\b(${charName})\\b`, 'gi');
      let match;
      while ((match = regex.exec(str)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const nameStyle = SpreadsheetApp.newTextStyle()
          .setForegroundColor(color)
          .setBold(true)
          .build();
        builder.setTextStyle(start, end, nameStyle);
      }
    }
  });

  return builder.build();
}

/**
 * Canonical dictionary mapping all raid weapons in Season 2 to their exact Blizzard weapon subclass and stat profile.
 * Guarantees 100% accurate class proficiency matching regardless of whether the weapon title contains the word "polearm", "dagger", etc.
 */
const RAID_WEAPON_SUBCLASS_MAP = {
  'caustic keeper crusher': { type: 'mace', is2H: true, is1H: false, stat: 'str/agi' },
  'caustic keeper-crusher': { type: 'mace', is2H: true, is1H: false, stat: 'str/agi' },
  'malignant toothed edge': { type: 'axe', is2H: false, is1H: true, stat: 'str/agi' },
  'vashnik\'s sanguine rancor': { type: 'dagger', is2H: false, is1H: true, stat: 'agi' },
  'vashniks sanguine rancor': { type: 'dagger', is2H: false, is1H: true, stat: 'agi' },
  'abyssal broodfiend\'s bardiche': { type: 'polearm', is2H: true, is1H: false, stat: 'agi/str' },
  'abyssal broodfiends bardiche': { type: 'polearm', is2H: true, is1H: false, stat: 'agi/str' },
  'fang carved recurve': { type: 'bow', is2H: true, is1H: false, stat: 'agi', isRanged: true },
  'fang-carved recurve': { type: 'bow', is2H: true, is1H: false, stat: 'agi', isRanged: true },
  'maze roa warlord\'s fury': { type: 'axe', is2H: true, is1H: false, stat: 'str' },
  'maze-roa, warlord\'s fury': { type: 'axe', is2H: true, is1H: false, stat: 'str' },
  'altar keeper\'s censer': { type: 'off-hand', is2H: false, is1H: false, stat: 'int', isOffhand: true },
  'altar-keeper\'s censer': { type: 'off-hand', is2H: false, is1H: false, stat: 'int', isOffhand: true },
  'aman\'muso, warlord\'s vengeance': { type: 'staff', is2H: true, is1H: false, stat: 'agi/int' },
  'amanmuso warlords vengeance': { type: 'staff', is2H: true, is1H: false, stat: 'agi/int' },
  'jan\'thrazet, the soul fang': { type: 'dagger', is2H: false, is1H: true, stat: 'int' },
  'janthrazet the soul fang': { type: 'dagger', is2H: false, is1H: true, stat: 'int' },
  'ravenous feaster\'s fang': { type: 'dagger', is2H: false, is1H: true, stat: 'agi' },
  'ravenous feasters fang': { type: 'dagger', is2H: false, is1H: true, stat: 'agi' },
  'zul\'valok, breath of corruption': { type: 'dagger', is2H: false, is1H: true, stat: 'agi' },
  'zulvalok breath of corruption': { type: 'dagger', is2H: false, is1H: true, stat: 'agi' },
  'jaws of the shackled goddess': { type: 'sword', is2H: false, is1H: true, stat: 'str/agi' }
};

/**
 * Validates whether a character is eligible to equip/loot an item based on:
 * 1. Armor Class (Cloth, Leather, Mail, Plate)
 * 2. Weapon Subclass & 1H vs 2H Spec Constraints (Polearms, Daggers, Bows, Staves, Axes, Shields, etc.)
 * 3. Primary Stat Profile (Intellect vs Strength/Agility)
 */
function isCharacterEligibleForItem(charClass, charSpec, slot, targetSubclass, itemName) {
  charClass = (charClass || '').toLowerCase().trim();
  charSpec = (charSpec || '').toLowerCase().trim();
  targetSubclass = (targetSubclass || '').toLowerCase().trim();
  itemName = (itemName || '').toLowerCase().trim();
  slot = (slot || '').trim();

  // 1. ARMOR SLOTS (Strict Armor Material Match)
  const ARMOR_MAP = {
    'warrior': 'plate', 'paladin': 'plate', 'death knight': 'plate',
    'hunter': 'mail', 'shaman': 'mail', 'evoker': 'mail',
    'rogue': 'leather', 'druid': 'leather', 'monk': 'leather', 'demon hunter': 'leather',
    'priest': 'cloth', 'mage': 'cloth', 'warlock': 'cloth'
  };

  const armorSlots = ['Head', 'Shoulders', 'Chest', 'Hands', 'Legs', 'Feet', 'Wrist', 'Waist'];
  if (armorSlots.includes(slot)) {
    const charArmor = ARMOR_MAP[charClass] || '';
    if (targetSubclass.includes('plate') && charArmor !== 'plate') return false;
    if (targetSubclass.includes('mail') && charArmor !== 'mail') return false;
    if (targetSubclass.includes('leather') && charArmor !== 'leather') return false;
    if (targetSubclass.includes('cloth') && charArmor !== 'cloth') return false;
    if (targetSubclass.includes('cosmetic') || targetSubclass.includes('junk')) return false;
  }

  // 2. WEAPONS & OFF-HANDS (Main Hand, Off Hand, 1H, 2H, Ranged, Shield)
  const isWeaponOrOffhand = slot === 'Main Hand' || slot === 'Off Hand' || slot.includes('Two-Hand') || slot.includes('One-Hand') || slot.includes('Ranged') || slot.includes('Shield');
  if (isWeaponOrOffhand) {
    // Exact baseline Class Weapon Proficiencies in World of Warcraft
    const CLASS_WEAPON_PROFICIENCIES = {
      'mage': ['dagger', 'sword', 'wand', 'staff', 'stave', 'off hand', 'off-hand', 'holdable', 'censer', 'blade'],
      'warlock': ['dagger', 'sword', 'wand', 'staff', 'stave', 'off hand', 'off-hand', 'holdable', 'censer', 'blade'],
      'priest': ['dagger', 'mace', 'wand', 'staff', 'stave', 'off hand', 'off-hand', 'holdable', 'censer'],
      'rogue': ['dagger', 'sword', 'axe', 'mace', 'fist', 'claw', 'fang', 'cleaver', 'edge', 'blade'],
      'demon hunter': ['warglaive', 'sword', 'axe', 'fist', 'dagger', 'claw', 'fang', 'cleaver', 'edge', 'blade'],
      'warrior': ['sword', 'axe', 'mace', 'polearm', 'staff', 'shield', 'fist', 'dagger', 'greatsword', 'greataxe', 'greatmace', "warlord's fury", 'blade'],
      'paladin': ['sword', 'axe', 'mace', 'polearm', 'shield', 'greatsword', 'greataxe', 'greatmace', "warlord's fury", 'blade'],
      'death knight': ['sword', 'axe', 'mace', 'polearm', 'greatsword', 'greataxe', 'greatmace', "warlord's fury", 'blade'],
      'hunter': ['bow', 'gun', 'crossbow', 'polearm', 'staff', 'stave', 'axe', 'sword'],
      'druid': ['dagger', 'mace', 'staff', 'stave', 'polearm', 'fist', 'off hand', 'off-hand', 'holdable'],
      'monk': ['sword', 'axe', 'mace', 'fist', 'staff', 'stave', 'polearm', 'off hand', 'off-hand', 'holdable', 'weapon'],
      'shaman': ['dagger', 'mace', 'axe', 'fist', 'shield', 'staff', 'stave', 'off hand', 'off-hand', 'holdable'],
      'evoker': ['dagger', 'sword', 'axe', 'mace', 'fist', 'staff', 'stave', 'off hand', 'off-hand', 'holdable']
    };

    // Look up canonical weapon subclass mapping first to avoid reliance on item name keywords
    const cleanKey = itemName.replace(/[\u2018\u2019\u0027\u0060]/g, "'");
    const canonicalWeapon = RAID_WEAPON_SUBCLASS_MAP[cleanKey] || Object.values(RAID_WEAPON_SUBCLASS_MAP).find(w => cleanKey.includes(w.type));

    const prof = CLASS_WEAPON_PROFICIENCIES[charClass];
    if (canonicalWeapon) {
      if (prof && !prof.includes(canonicalWeapon.type) && !prof.includes('weapon')) {
        return false;
      }
    } else if (prof && !prof.some(w => targetSubclass.includes(w) || itemName.includes(w))) {
      return false;
    }

    const is2HWeapon = (canonicalWeapon && canonicalWeapon.is2H) || targetSubclass.includes('2h') || targetSubclass.includes('two-hand') || targetSubclass.includes('polearm') || targetSubclass.includes('staff') || targetSubclass.includes('stave') || targetSubclass.includes('bow') || targetSubclass.includes('crossbow') || targetSubclass.includes('gun') || (itemName.includes('2h') || itemName.includes('greatsword') || itemName.includes('greataxe') || itemName.includes('greatmace') || itemName.includes('warlord\'s fury'));

    const is1HWeapon = (canonicalWeapon && canonicalWeapon.is1H) || ((targetSubclass.includes('1h') || targetSubclass.includes('one-hand') || targetSubclass.includes('dagger') || targetSubclass.includes('fist') || targetSubclass.includes('warglaive') || targetSubclass.includes('wand') || targetSubclass.includes('shield') || targetSubclass.includes('off hand') || targetSubclass.includes('off-hand') || targetSubclass.includes('holdable') || itemName.includes('cleaver') || itemName.includes('claw') || itemName.includes('censer')) && !is2HWeapon);

    // Strict 2H Only Melee/Tank specs (Must use 2H, CANNOT use 1H):
    // - Arms Warrior, Retribution Paladin, Blood/Unholy DK, Survival Hunter, Feral/Guardian Druid
    const isStrictly2HSpec = (charClass === 'warrior' && charSpec.includes('arms')) ||
                             (charClass === 'paladin' && charSpec.includes('retribution')) ||
                             (charClass === 'death knight' && (charSpec.includes('blood') || charSpec.includes('unholy'))) ||
                             (charClass === 'hunter' && charSpec.includes('survival')) ||
                             (charClass === 'druid' && (charSpec.includes('feral') || charSpec.includes('guardian')));

    if (isStrictly2HSpec && is1HWeapon) {
      return false;
    }

    // Strict 1H Only Specs (Must use 1H + Shield/Offhand/DW, CANNOT use 2H Weapons):
    // - Protection Warrior, Protection Paladin, Enhancement Shaman, All Rogues, All Demon Hunters
    const isStrictly1HSpec = (charClass === 'warrior' && charSpec.includes('protection')) ||
                             (charClass === 'paladin' && charSpec.includes('protection')) ||
                             (charClass === 'shaman' && charSpec.includes('enhancement')) ||
                             charClass === 'rogue' ||
                             charClass === 'demon hunter';

    if (isStrictly1HSpec && is2HWeapon) {
      return false;
    }

    // Bows, Guns, Crossbows -> Beast Mastery & Marksmanship Hunters ONLY (Survival is strictly 2H Melee)
    if (targetSubclass.includes('gun') || targetSubclass.includes('bow') || targetSubclass.includes('crossbow')) {
      return charClass === 'hunter' && !charSpec.includes('survival');
    }
    // Warglaives -> Demon Hunters ONLY
    if (targetSubclass.includes('warglaive')) {
      return charClass === 'demon hunter';
    }
    // Wands -> Mages, Warlocks, Priests ONLY
    if (targetSubclass.includes('wand')) {
      return ['mage', 'warlock', 'priest'].includes(charClass);
    }
    // Shields -> Prot/Holy Paladin, Prot Warrior, Ele/Resto Shaman ONLY
    if (targetSubclass.includes('shield')) {
      return (charClass === 'paladin' && ['protection', 'holy'].some(s => charSpec.includes(s))) ||
             (charClass === 'warrior' && charSpec.includes('protection')) ||
             (charClass === 'shaman' && ['elemental', 'restoration'].some(s => charSpec.includes(s)));
    }
    // Caster Off-Hands / Holdable -> Intellect Casters & Healers ONLY
    if (targetSubclass.includes('off-hand') || targetSubclass.includes('off hand') || targetSubclass.includes('holdable')) {
      return ['mage', 'warlock', 'priest', 'evoker'].includes(charClass) ||
             (charClass === 'druid' && ['balance', 'restoration'].some(s => charSpec.includes(s))) ||
             (charClass === 'shaman' && ['elemental', 'restoration'].some(s => charSpec.includes(s))) ||
             (charClass === 'monk' && charSpec.includes('mistweaver'));
    }
    // 2H Axes, 2H Swords, 2H Maces -> Str/Agi 2H Melee (Warrior, DK, Ret Paladin, Survival Hunter, Feral/Guardian Druid)
    if (targetSubclass.includes('2h axe') || targetSubclass.includes('2h sword') || targetSubclass.includes('2h mace') || (targetSubclass.includes('axe') && !targetSubclass.includes('1h') && (itemName.includes('2h') || itemName.includes('cleaver') || itemName.includes('fury') || itemName.includes('axe')))) {
      if (['mage', 'warlock', 'priest', 'rogue', 'demon hunter', 'evoker'].includes(charClass)) return false;
      if (charClass === 'hunter' && !charSpec.includes('survival')) return false;
      if (charClass === 'druid' && !['feral', 'guardian'].some(s => charSpec.includes(s))) return false;
      if (charClass === 'paladin' && charSpec.includes('holy')) return false;
      if (charClass === 'shaman') return false;
      if (charClass === 'monk') return false;
    }
    // 1H Axes / Cleavers -> Melee physical classes. NO Pure Casters, NO Ranged Hunters!
    if (targetSubclass.includes('axe') || targetSubclass.includes('cleaver')) {
      if (['mage', 'warlock', 'priest', 'druid'].includes(charClass)) return false;
      if (charClass === 'hunter') return false;
      if (charClass === 'paladin' && charSpec.includes('holy')) return false;
      if (charClass === 'shaman' && !charSpec.includes('enhancement')) return false;
    }
    // Daggers -> Rogue, Mage, Priest, Warlock, Druid, Evoker, Shaman, Devourer DH. NO Plate classes, NO Hunters!
    if (targetSubclass.includes('dagger')) {
      if (['warrior', 'paladin', 'death knight', 'hunter'].includes(charClass)) return false;
      if (charClass === 'demon hunter' && !charSpec.includes('devourer')) return false;
    }
    // Fist Weapons -> Rogue, Monk, DH, Enh Shaman, Druid, Evoker, Warrior. NO Cloth/Paladin/DK/Hunter!
    if (targetSubclass.includes('fist')) {
      if (['mage', 'warlock', 'priest', 'paladin', 'death knight', 'hunter'].includes(charClass)) return false;
    }
    // Polearms -> Str/Agi 2H Melee (Warrior, Ret Paladin, Blood/Unholy DK, Survival Hunter, Feral/Guardian Druid, Brew/WW Monk)
    if (targetSubclass.includes('polearm')) {
      if (['mage', 'warlock', 'priest', 'rogue', 'demon hunter', 'evoker', 'shaman'].includes(charClass)) return false;
      if (charClass === 'hunter' && !charSpec.includes('survival')) return false;
      if (charClass === 'paladin' && charSpec.includes('holy')) return false;
    }
    // Staves -> Casters/Healers + Feral/Guardian Druid, Monk, Survival Hunter. NO DK, Paladin, Rogue, Warrior, BM/MM Hunter!
    if (targetSubclass.includes('staff') || targetSubclass.includes('stave')) {
      if (['paladin', 'death knight', 'rogue', 'warrior', 'demon hunter'].includes(charClass)) return false;
      if (charClass === 'hunter' && !charSpec.includes('survival')) return false;
    }
    // 1H Maces -> Paladin, Warrior, DK, Rogue, Monk, Priest, Shaman, Druid, Evoker. NO Mage/Warlock/Hunter/DH!
    if (targetSubclass.includes('mace') && !targetSubclass.includes('2h')) {
      if (['mage', 'warlock', 'hunter', 'demon hunter'].includes(charClass)) return false;
    }
    // 1H Swords -> Warrior, Paladin, DK, Rogue, Monk, DH, Mage, Warlock. NO Priest/Shaman/Druid/Hunter!
    if (targetSubclass.includes('sword') && !targetSubclass.includes('2h')) {
      if (['priest', 'shaman', 'druid', 'hunter'].includes(charClass)) return false;
    }
  }

  // 3. PRIMARY STAT & ROLE CONSTRAINTS (Weapons, Trinkets, Accessories)
  if (targetSubclass.includes('strength') || targetSubclass.includes('(str') || targetSubclass.includes('str /')) {
    const isStr = ['warrior', 'death knight'].includes(charClass) || (charClass === 'paladin' && !charSpec.includes('holy'));
    if (!isStr && !targetSubclass.includes('agi') && !targetSubclass.includes('all')) return false;
  }
  if (targetSubclass.includes('agility') || targetSubclass.includes('(agi') || targetSubclass.includes('/ agi')) {
    const isAgi = ['rogue', 'demon hunter', 'hunter'].includes(charClass) ||
                  (charClass === 'druid' && (charSpec.includes('feral') || charSpec.includes('guardian'))) ||
                  (charClass === 'monk' && !charSpec.includes('mistweaver')) ||
                  (charClass === 'shaman' && charSpec.includes('enhancement'));
    if (!isAgi && !targetSubclass.includes('str') && !targetSubclass.includes('all')) return false;
  }
  if (targetSubclass.includes('intellect') || targetSubclass.includes('(int') || targetSubclass.includes('/ int') || targetSubclass.includes('caster') || targetSubclass.includes('healer')) {
    const isInt = ['mage', 'warlock', 'priest', 'evoker'].includes(charClass) ||
                  (charClass === 'paladin' && charSpec.includes('holy')) ||
                  (charClass === 'druid' && (charSpec.includes('balance') || charSpec.includes('restoration'))) ||
                  (charClass === 'shaman' && !charSpec.includes('enhancement')) ||
                  (charClass === 'monk' && charSpec.includes('mistweaver'));
    if (!isInt && !targetSubclass.includes('all') && !targetSubclass.includes('str') && !targetSubclass.includes('agi')) return false;
  }
  if (targetSubclass.includes('tank') && !targetSubclass.includes('all')) {
    const isTank = ['protection', 'blood', 'guardian', 'brewmaster', 'vengeance'].some(t => charSpec.includes(t));
    if (!isTank) return false;
  }

  return true;
}

/**
 * Creates and formats the Loot & Chase Items reference sheet.
 * Features the current Season 2 raid: The Venomous Abyss (8 Bosses) with distinct boss separator banners.
 * Automatically queries Blizzard Journal API for complete drop tables and calculates upgrade deltas.
 */
function createLootAndChaseItemsSheet(mainCharacterData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LOOT_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LOOT_SHEET_NAME);
  }

  // Load roster context (Role & Attendance) for live badge overlays
  const rosterContextMap = getRosterContextMap(ss);

  const lootHeaders = [
    'Boss / Source', 'Chase Item / Drop', 'Slot', 'Difficulty', 'Drop ilvl',
    'Target Specs / Roles', 'Top Contender (Assigned)', 'Current Equipped Item',
    'Equipped ilvl', 'Upgrade Delta (+ilvl / %DPS)', 'Priority / BiS Tier', 
    'Sim Status / Last Updated', 'Loot Council Notes'
  ];

  // Try live Blizzard API sync first for 100% complete loot tables!
  const config = getConfigurationFromSheet();
  const token = config ? getAccessToken(config) : null;
  let chaseItemsCatalog = (config && token) ? fetchLiveBlizzardRaidLootTable(config, token) : null;

  if (!chaseItemsCatalog || chaseItemsCatalog.length === 0) {
    chaseItemsCatalog = [
    // ════════════════════════════════════════════════════════════
    // ⚔️ BOSS 1: NEK'ZALI THE SOULCOILER
    // ════════════════════════════════════════════════════════════
    ['⚔️ BOSS 1: NEK\'ZALI THE SOULCOILER', '═════════════════════════════════', '', '', '', '', '', '', '', '', '', '', ''],
    ['Boss 1: Nek\'zali the Soulcoiler', 'Soulcoil Siphon', 'Trinket 1', 'Heroic', 318, 'Intellect / Agility DPS', '', '', '', '', 'BiS S-Tier', '⚡ Live Armory ilvl', 'On-use secondary stat siphon burst'],
    ['Boss 1: Nek\'zali the Soulcoiler', 'Skullguard of the Risen Sacrifice', 'Head', 'Heroic', 318, 'Plate Helm', '', '', '', '', 'Plate Helm', '⚡ Live Armory ilvl', 'Crit/Mastery plate helm (ID: 268229)'],
    ['Boss 1: Nek\'zali the Soulcoiler', 'Entombed Cultist\'s Sabatons', 'Feet', 'Heroic', 318, 'Plate Feet', '', '', '', '', 'Plate Boots', '⚡ Live Armory ilvl', 'Plate boots with mastery (ID: 268245)'],
    ['Boss 1: Nek\'zali the Soulcoiler', 'Amani Summoning Shawl', 'Back', 'Heroic', 318, 'All Specs', '', '', '', '', 'BiS Cloak', '⚡ Live Armory ilvl', 'Mastery cloak with speed bonus (ID: 268248)'],
    ['Boss 1: Nek\'zali the Soulcoiler', 'Unpossessed Skullsash', 'Waist', 'Heroic', 318, 'Cloth Waist', '', '', '', '', 'Cloth Belt', '⚡ Live Armory ilvl', 'Haste/Mastery cloth belt'],

    // ════════════════════════════════════════════════════════════
    // 🛡️ BOSS 2: ENTOMBED SENTINELS
    // ════════════════════════════════════════════════════════════
    ['🛡️ BOSS 2: ENTOMBED SENTINELS', '═════════════════════════════════', '', '', '', '', '', '', '', '', '', '', ''],
    ['Boss 2: Entombed Sentinels', 'Gauntlets of the Consecrated Flame', 'Hands', 'Heroic', 318, 'All Classes (Tier Hands)', '', '', '', '', 'Tier Hands', '⚡ Live Armory ilvl', 'Tier hands token (ID: 271466)'],
    ['Boss 2: Entombed Sentinels', 'Sentinel\'s Petrified Core', 'Trinket 1', 'Heroic', 318, 'Tanks (All)', '', '', '', '', 'Tank BiS', '⚡ Live Armory ilvl', 'Massive passive armor and on-use shield'],
    ['Boss 2: Entombed Sentinels', 'Keeper\'s Seething Core', 'Trinket 1', 'Heroic', 318, 'All DPS / Healers', '', '', '', '', 'BiS Trinket', '⚡ Live Armory ilvl', 'Stacking execute burst trinket (ID: 270165)'],
    ['Boss 2: Entombed Sentinels', 'Sentinel\'s Vitriolic Chain', 'Neck', 'Heroic', 318, 'All Specs', '', '', '', '', 'BiS Neck', '⚡ Live Armory ilvl', 'Haste/Versatility neck with socket (ID: 268250)'],
    ['Boss 2: Entombed Sentinels', 'Caustic Keeper-Crusher', 'Main Hand', 'Heroic', 318, '2H / 1H Weapon', '', '', '', '', 'Major Weapon', '⚡ Live Armory ilvl', 'High DPS weapon (ID: 268198)'],
    ['Boss 2: Entombed Sentinels', 'Venom Warden\'s Greaves', 'Legs', 'Heroic', 318, 'Plate Legs', '', '', '', '', 'Plate Legs', '⚡ Live Armory ilvl', 'Plate legs with custom socket (ID: 268224)'],
    ['Boss 2: Entombed Sentinels', 'Slitherscale Girdle', 'Waist', 'Heroic', 318, 'Mail Waist', '', '', '', '', 'Mail Belt', '⚡ Live Armory ilvl', 'Crit/Versatility mail belt'],

    // ════════════════════════════════════════════════════════════
    // 🧭 BOSS 3: THE LOST EXPLORERS
    // ════════════════════════════════════════════════════════════
    ['🧭 BOSS 3: THE LOST EXPLORERS', '═════════════════════════════════', '', '', '', '', '', '', '', '', '', '', ''],
    ['Boss 3: The Lost Explorers', 'Pauldrons of the Consecrated Flame', 'Shoulders', 'Heroic', 318, 'All Classes (Tier Shoulders)', '', '', '', '', 'Tier Shoulders', '⚡ Live Armory ilvl', 'Tier shoulders token (ID: 271463)'],
    ['Boss 3: The Lost Explorers', 'Gebbo\'s Bottomless Bag', 'Trinket 2', 'Heroic', 318, 'All DPS / Healers', '', '', '', '', 'BiS A-Tier', '⚡ Live Armory ilvl', 'Trinket proc with random utility / stat surge (ID: 270164)'],
    ['Boss 3: The Lost Explorers', 'Shellbound Bracers', 'Wrist', 'Heroic', 318, 'Plate Wrist', '', '', '', '', 'Plate Wrists', '⚡ Live Armory ilvl', 'Plate bracers with custom socket (ID: 268239)'],
    ['Boss 3: The Lost Explorers', 'Battle Gi of the Monkey King', 'Chest', 'Heroic', 318, 'Leather Chest', '', '', '', '', 'Leather Chest', '⚡ Live Armory ilvl', 'Agility/Intellect leather chest'],
    ['Boss 3: The Lost Explorers', 'Restless Spirit Shackles', 'Wrist', 'Heroic', 318, 'Mail Wrist', '', '', '', '', 'Mail Wrists', '⚡ Live Armory ilvl', 'Haste/Crit mail bracers'],

    // ════════════════════════════════════════════════════════════
    // 🧪 BOSS 4: VASHNIK THE MALIGNANT
    // ════════════════════════════════════════════════════════════
    ['🧪 BOSS 4: VASHNIK THE MALIGNANT', '═════════════════════════════════', '', '', '', '', '', '', '', '', '', '', ''],
    ['Boss 4: Vashnik the Malignant', 'Bulwark of the Consecrated Flame', 'Chest', 'Heroic', 318, 'All Classes (Tier Chest)', '', '', '', '', 'Tier Chest', '⚡ Live Armory ilvl', 'Tier chest token (ID: 271468)'],
    ['Boss 4: Vashnik the Malignant', 'Malignant Toothed Edge', 'Main Hand', 'Heroic', 318, '1H Agi / Str (War, Pal, DK, DH, Rogue)', '', '', '', '', 'Major Weapon', '⚡ Live Armory ilvl', 'Fast 1H weapon with shadow damage proc (ID: 268214)'],
    ['Boss 4: Vashnik the Malignant', 'Vashnik\'s Sanguine Rancor', 'Main Hand', 'Heroic', 318, '1H Dagger / Agi', '', '', '', '', 'Heroic Weapon', '⚡ Live Armory ilvl', 'Fast 1H agility dagger with bleed proc'],
    ['Boss 4: Vashnik the Malignant', 'Vile Alchemist\'s Band', 'Ring 1', 'Heroic', 318, 'All Specs', '', '', '', '', 'BiS Ring', '⚡ Live Armory ilvl', 'Haste/Crit ring with cantrip poison proc (ID: 268249)'],
    ['Boss 4: Vashnik the Malignant', 'Scaled Fiend\'s Warboots', 'Feet', 'Heroic', 318, 'Plate Feet', '', '', '', '', 'Plate Boots', '⚡ Live Armory ilvl', 'Plate boots with haste/crit (ID: 268260)'],
    ['Boss 4: Vashnik the Malignant', 'Bespittled Slitherslippers', 'Feet', 'Heroic', 318, 'Leather Feet', '', '', '', '', 'Leather Boots', '⚡ Live Armory ilvl', 'Mastery leather boots'],

    // ════════════════════════════════════════════════════════════
    // 🐊 BOSS 5: SSZORAK
    // ════════════════════════════════════════════════════════════
    ['🐊 BOSS 5: SSZORAK', '═════════════════════════════════', '', '', '', '', '', '', '', '', '', '', ''],
    ['Boss 5: Sszorak', 'Greaves of the Consecrated Flame', 'Legs', 'Heroic', 318, 'All Classes (Tier Legs)', '', '', '', '', 'Tier Legs', '⚡ Live Armory ilvl', 'Tier legs token (ID: 271464)'],
    ['Boss 5: Sszorak', 'Sszorak\'s Ferocity', 'Trinket 2', 'Heroic', 318, 'Strength / Agility DPS', '', '', '', '', 'God-Tier Trinket', '⚡ Live Armory ilvl', 'Primary stat surge and attack speed aura (ID: 270163)'],
    ['Boss 5: Sszorak', 'Apex Brute\'s Claw Ring', 'Ring 2', 'Heroic', 318, 'All Specs', '', '', '', '', 'BiS Ring', '⚡ Live Armory ilvl', 'Mastery/Versatility high stat ring (ID: 268252)'],
    ['Boss 5: Sszorak', 'Abyssal Broodfiend\'s Bardiche', 'Main Hand', 'Heroic', 318, '2H Agi / Str Weapon', '', '', '', '', 'Heroic 2H Weapon', '⚡ Live Armory ilvl', 'High weapon damage 2H polearm'],
    ['Boss 5: Sszorak', 'Brute-Crusher\'s Spaulders', 'Shoulders', 'Heroic', 318, 'Leather Shoulders', '', '', '', '', 'Leather Shoulders', '⚡ Live Armory ilvl', 'Crit/Mastery leather shoulders'],

    // ════════════════════════════════════════════════════════════
    // ⚔️ BOSS 6: THE TWIN FANGS
    // ════════════════════════════════════════════════════════════
    ['⚔️ BOSS 6: THE TWIN FANGS', '═════════════════════════════════', '', '', '', '', '', '', '', '', '', '', ''],
    ['Boss 6: The Twin Fangs', 'Warhelm of the Consecrated Flame', 'Head', 'Heroic', 318, 'All Classes (Tier Helm)', '', '', '', '', 'Tier Helm', '⚡ Live Armory ilvl', 'Tier helm token (ID: 271465)'],
    ['Boss 6: The Twin Fangs', 'Amulet of the Twin Fangs', 'Neck', 'Heroic', 318, 'All Specs', '', '', '', '', 'BiS Neck', '⚡ Live Armory ilvl', 'High crit/haste amulet (ID: 268251)'],
    ['Boss 6: The Twin Fangs', 'Scaleplate Strangulators', 'Hands', 'Heroic', 318, 'Plate Hands', '', '', '', '', 'Plate Gloves', '⚡ Live Armory ilvl', 'Plate gloves with haste/crit (ID: 268220)'],
    ['Boss 6: The Twin Fangs', 'Silken Voodoo Drape', 'Back', 'Heroic', 318, 'All Specs', '', '', '', '', 'BiS Cloak', '⚡ Live Armory ilvl', 'Max item level cloak with avoidance'],
    ['Boss 6: The Twin Fangs', 'Ruthless Slaughtergrips', 'Hands', 'Heroic', 318, 'Mail Hands', '', '', '', '', 'Mail Gloves', '⚡ Live Armory ilvl', 'Haste/Crit mail gloves'],
    ['Boss 6: The Twin Fangs', 'Sash of the Forlorn Vessel', 'Waist', 'Heroic', 318, 'Leather Waist', '', '', '', '', 'Leather Belt', '⚡ Live Armory ilvl', 'Crit/Mastery leather belt'],
    ['Boss 6: The Twin Fangs', 'Fang-Carved Recurve', 'Main Hand', 'Heroic', 318, 'Ranged (Hunter)', '', '', '', '', 'Major Bow', '⚡ Live Armory ilvl', 'Agility Bow with poison arrow proc'],

    // ════════════════════════════════════════════════════════════
    // 🏛️ BOSS 7: THE COILED ALTAR
    // ════════════════════════════════════════════════════════════
    ['🏛️ BOSS 7: THE COILED ALTAR', '═════════════════════════════════', '', '', '', '', '', '', '', '', '', '', ''],
    ['Boss 7: The Coiled Altar', 'Maze-roa, Warlord\'s Fury', 'Main Hand', 'Heroic', 318, '2H Strength (War, Pal, DK)', '', '', '', '', 'Very Rare 2H Axe', '⚡ Live Armory ilvl', 'Top 2H Axe with shadow cleave (ID: 268213)'],
    ['Boss 7: The Coiled Altar', 'Zul\'jin\'s Guillotine Technique', 'Trinket 2', 'Heroic', 318, 'All Roles', '', '', '', '', 'Major Trinket', '⚡ Live Armory ilvl', 'Special execution burst trinket (ID: 270173)'],
    ['Boss 7: The Coiled Altar', 'Altar-Keeper\'s Censer', 'Off Hand', 'Heroic', 318, 'Intellect Casters / Healers', '', '', '', '', 'Caster Off-Hand', '⚡ Live Armory ilvl', 'High intellect off-hand with haste/mastery'],
    ['Boss 7: The Coiled Altar', 'Reckless Spirit Breastplate', 'Chest', 'Heroic', 318, 'Plate Chest', '', '', '', '', 'Plate Chest', '⚡ Live Armory ilvl', 'Plate chest with crit/haste (ID: 268222)'],
    ['Boss 7: The Coiled Altar', 'Girdle of Toxic Regret', 'Waist', 'Heroic', 318, 'Plate Waist', '', '', '', '', 'Plate Belt', '⚡ Live Armory ilvl', 'Plate belt with haste/crit (ID: 268259)'],
    ['Boss 7: The Coiled Altar', 'Coiled Hex Legguards', 'Legs', 'Heroic', 318, 'Mail Legs', '', '', '', '', 'Mail Legs', '⚡ Live Armory ilvl', 'Mastery/Crit mail legs'],

    // ════════════════════════════════════════════════════════════
    // 👑 BOSS 8: ULA'TEK (FINAL BOSS)
    // ════════════════════════════════════════════════════════════
    ['👑 BOSS 8: ULA\'TEK (FINAL BOSS)', '═════════════════════════════════', '', '', '', '', '', '', '', '', '', '', ''],
    ['Boss 8: Ula\'tek', 'Slumbering Coil Curio', 'Chest', 'Heroic', 318, 'All Classes (Universal Tier)', '', '', '', '', 'Universal Tier Curio', '⚡ Live Armory ilvl', 'Universal Tier Token exchangeable for ANY slot'],
    ['Boss 8: Ula\'tek', 'Aman\'muso, Warlord\'s Vengeance', 'Main Hand', 'Heroic', 318, 'Agi / Int Weapon (Staff/Polearm)', '', '', '', '', 'Very Rare Weapon', '⚡ Live Armory ilvl', 'Very rare high-damage staff with void surge proc'],
    ['Boss 8: Ula\'tek', 'Voracious Heart of Ula\'tek', 'Trinket 1', 'Heroic', 318, 'All DPS / Tanks', '', '', '', '', 'God-Tier Trinket', '⚡ Live Armory ilvl', 'Top execute burst trinket in the game (ID: 270175)'],
    ['Boss 8: Ula\'tek', 'Font of Venomous Rage', 'Trinket 2', 'Heroic', 318, 'All Roles', '', '', '', '', 'God-Tier Trinket', '⚡ Live Armory ilvl', 'Primary stat surge and attack speed aura (ID: 270168)'],
    ['Boss 8: Ula\'tek', 'Aqirbane Reliquary', 'Neck', 'Heroic', 318, 'All Roles', '', '', '', '', 'Venomcursed BiS', '⚡ Live Armory ilvl', 'Special void altar proc neck/trinket (ID: 268265)'],
    ['Boss 8: Ula\'tek', 'Venomkeeper\'s Horrific Cowl', 'Head', 'Heroic', 318, 'Cloth / Leather Head', '', '', '', '', 'Venomcursed Helm', '⚡ Live Armory ilvl', 'Venomcursed cantrip helm with periodic shadow damage'],
    ['Boss 8: Ula\'tek', 'Chausses of Unbound Rancor', 'Legs', 'Heroic', 318, 'Plate Legs', '', '', '', '', 'Heroic Legs', '⚡ Live Armory ilvl', 'Plate legs with crit/mastery (ID: 271878)'],
    ['Boss 8: Ula\'tek', 'Jan\'thrazet, the Soul Fang', 'One-Hand (1H)', 'Heroic', 321, 'Dagger (Intellect)', '', '', '', '', 'Heroic Dagger', '⚡ Live Armory ilvl', 'Blizzard ID: 271092 | Dagger with cast speed drain & haste proc'],

    // ════════════════════════════════════════════════════════════
    // 📦 TRASH DROPS & OTHER RAID SOURCES
    // ════════════════════════════════════════════════════════════
    ['📦 TRASH DROPS & OTHER RAID SOURCES', '═════════════════════════════════', '', '', '', '', '', '', '', '', '', '', ''],
    ['Trash Drop', 'Bound Serpent\'s Jade Eye', 'Trinket 1', 'Heroic', 318, 'Melee DPS / Hunters / Casters', '', '', '', '', 'BiS S-Tier', '⚡ Live Armory ilvl', 'Venom stacking DoT (ID: 271638)'],
    ['Trash Drop', 'Pauldrons of the Forgotten Sacrifice', 'Shoulders', 'Heroic', 318, 'Plate Shoulders', '', '', '', '', 'Plate Shoulders', '⚡ Live Armory ilvl', 'High strength plate shoulders (ID: 271444)'],
    ['Trash Drop', 'Fanged Brute\'s Greatbelt', 'Waist', 'Heroic', 318, 'Plate Waist', '', '', '', '', 'Trash Drop', '⚡ Live Armory ilvl', 'BoE plate belt (ID: 271445)'],
    ['Other Raid Drop', 'Swelling Sea Spaulders', 'Shoulders', 'Heroic', 318, 'Mail Shoulders', '', '', '', '', 'Mail Shoulders', '⚡ Live Armory ilvl', 'Haste/Mastery mail shoulders (ID: 268226)'],
    ['Other Raid Drop', 'Forgotten Grotto Girdle', 'Waist', 'Heroic', 318, 'Mail Waist', '', '', '', '', 'Mail Belt', '⚡ Live Armory ilvl', 'Mail belt with crit/haste (ID: 268244)'],
    ['Other Raid Drop', 'Alluring Bubbleband', 'Ring 1', 'Heroic', 318, 'All Specs', '', '', '', '', 'BiS Ring', '⚡ Live Armory ilvl', 'Heroic 318 ring with shield proc (ID: 268266)']
    ];
  }

  // Helper to extract numerical ilvl from formatted gear slot strings e.g. "[Tier] 298 (Hero 4/6) - Item"
  const extractIlvl = (slotText) => {
    if (!slotText || slotText === '-') return 0;
    const match = slotText.match(/(?:\[.*?\]\s*)?(\d{2,3})/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // Helper to lookup equipped item and ilvl for a character and slot
  const resolveEquippedItemForChar = (charObj, slot) => {
    if (!charObj) return { text: '-', ilvl: 0 };
    let currentSlotText = '-';
    if (slot.includes('Trinket')) {
      const t1 = charObj['Trinket 1'] || '-';
      const t2 = charObj['Trinket 2'] || '-';
      const ilvl1 = extractIlvl(t1);
      const ilvl2 = extractIlvl(t2);
      if (ilvl1 <= ilvl2 && ilvl1 > 0) {
        currentSlotText = t1;
      } else if (ilvl2 > 0) {
        currentSlotText = t2;
      } else {
        currentSlotText = t1;
      }
    } else if (slot.includes('Ring')) {
      const r1 = charObj['Ring 1'] || '-';
      const r2 = charObj['Ring 2'] || '-';
      const ilvl1 = extractIlvl(r1);
      const ilvl2 = extractIlvl(r2);
      if (ilvl1 <= ilvl2 && ilvl1 > 0) {
        currentSlotText = r1;
      } else {
        currentSlotText = r2;
      }
    } else if (slot.includes('Two-Hand') || slot.includes('One-Hand') || slot.includes('Main Hand') || slot.includes('Ranged')) {
      currentSlotText = charObj['Main Hand'] || '-';
    } else if (slot.includes('Off Hand') || slot.includes('Shield')) {
      currentSlotText = charObj['Off Hand'] || '-';
    } else {
      currentSlotText = charObj[slot] || '-';
    }
    return { text: currentSlotText, ilvl: extractIlvl(currentSlotText) };
  };

  const altNamesSet = getAltNamesSet(ss);

  // If mainCharacterData wasn't passed directly, load character gear from the "Guild Audit" sheet!
  if (!mainCharacterData || mainCharacterData.length === 0) {
    mainCharacterData = getGuildAuditCharacterList(ss);
  } else {
    // Strictly filter out any alts if mainCharacterData was passed
    mainCharacterData = mainCharacterData.filter(c => !altNamesSet.has((c.Name || c.name || '').toLowerCase().trim()));
  }

  // Helper to normalize item strings for flawless key comparison (handles unicode apostrophes, spaces, punctuation)
  const normalizeItemKey = (s) => (s || '').toString().toLowerCase().replace(/[\u2018\u2019\u0027\u0060]/g, "'").replace(/[^a-z0-9]/g, '');

  // Check if sheet exists and read existing sim data map to prioritize sims over raw ilvl
  const existingSimDataByName = {};
  const existingSimDataById = {};
  if (sheet.getLastRow() > 1) {
    const existingValues = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    existingValues.forEach(row => {
      const rawName = (row[1] || '').toString().trim();
      const normName = normalizeItemKey(rawName);
      const topContender = (row[6] || '').toString();
      const currentEquipped = (row[7] || '').toString();
      const equippedIlvl = row[8];
      const upgradeDelta = (row[9] || '').toString();
      const simStatus = (row[11] || '').toString();
      let notes = (row[12] || '').toString();

      // Clean out any alt names that may have previously leaked into notes or topContenders
      const topContenderNameMatch = topContender.match(/([A-Za-z0-9\u00C0-\u024F]+)/);
      const isAltTopContender = topContenderNameMatch && altNamesSet.has(topContenderNameMatch[1].toLowerCase());

      // If this item was previously simmed with Raidbots or QE Live, protect and preserve it!
      const isSimmed = notes.includes('Sim Upgrades:') || notes.includes('Raidbots') || notes.includes('QE Live') || 
                       upgradeDelta.includes('%') || simStatus.includes('Simmed') || simStatus.includes('QE Live');

      if (isSimmed && normName && !isAltTopContender) {
        const entry = {
          rawName: rawName,
          topContender: topContender,
          currentEquipped: currentEquipped,
          equippedIlvl: equippedIlvl,
          upgradeDelta: upgradeDelta,
          simStatus: simStatus || '✅ Simmed',
          notes: notes
        };
        existingSimDataByName[normName] = entry;

        const idMatch = notes.match(/Blizzard ID:\s*(\d+)/i);
        if (idMatch) {
          existingSimDataById[parseInt(idMatch[1], 10)] = entry;
        }
      }
    });
  }

  // If character audit data is available, auto-calculate live equipped upgrades
  if (mainCharacterData && mainCharacterData.length > 0) {
    chaseItemsCatalog.forEach(row => {
      // Skip separator rows
      if (row[0].startsWith('⚔️') || row[0].startsWith('🛡️') || row[0].startsWith('🧭') || row[0].startsWith('🧪') || row[0].startsWith('🐊') || row[0].startsWith('🏛️') || row[0].startsWith('👑') || row[0].startsWith('📦')) {
        return;
      }

      const rawItemName = (row[1] || '').toString().trim();
      const normItemName = normalizeItemKey(rawItemName);
      const slot = row[2];
      const dropIlvl = Number(row[4]) || 318;
      const targetRole = (row[5] || '').toLowerCase();
      const baseNotes = row[12] || '';
      const idMatch = baseNotes.match(/Blizzard ID:\s*(\d+)/i);
      const blizzardId = idMatch ? parseInt(idMatch[1], 10) : null;

      // 1. PRIORITIZE SIMS: Check by normalized name, Blizzard ID, or fuzzy match
      let preservedSim = existingSimDataByName[normItemName];
      if (!preservedSim && blizzardId && existingSimDataById[blizzardId]) {
        preservedSim = existingSimDataById[blizzardId];
      }
      if (!preservedSim) {
        const matchedKey = Object.keys(existingSimDataByName).find(k => isItemNameMatch(k, normItemName));
        if (matchedKey) preservedSim = existingSimDataByName[matchedKey];
      }

      if (preservedSim) {
        // Parse all contenders from preserved notes to recalculate and re-rank by composite Priority Score
        const simContenders = [];
        if (preservedSim.notes && preservedSim.notes.includes('Sim Upgrades:')) {
          const listStr = preservedSim.notes.replace(/^.*Sim Upgrades:\s*/, '');
          const parts = listStr.split('|');
          parts.forEach(p => {
            const pMatch = p.trim().match(/(?:\d+\.\s*)?([A-Za-z0-9\u00C0-\u024F]+)(?:\s*\[Score:\s*[0-9.]+\])?\s*\(\+?([0-9.]+)%/);
            if (pMatch) {
              const pName = pMatch[1];
              const pPct = parseFloat(pMatch[2]);
              const charInfo = rosterContextMap[pName.toLowerCase()] || {};
              const isEligible = isCharacterEligibleForItem(charInfo.charClass, charInfo.spec, slot, targetRole, rawItemName);
              if (isEligible) {
                const prio = calculatePriorityScore(pPct, pName, true, rosterContextMap);
                simContenders.push({ name: pName, pct: pPct, priority: prio });
              }
            }
          });
        }

        if (simContenders.length > 0) {
          // Re-sort by highest composite Priority Score
          simContenders.sort((a, b) => b.priority.score - a.priority.score || b.pct - a.pct);
          const top = simContenders[0];
          row[6] = formatContenderDisplay(top.name, top.pct, true, rosterContextMap, top.priority);
          row[9] = `+${top.pct}% DPS`;
          row[11] = (preservedSim.simStatus && (preservedSim.simStatus.includes('✅') || preservedSim.simStatus.includes('Simmed') || preservedSim.simStatus.includes('QE Live'))) 
                    ? preservedSim.simStatus 
                    : '✅ Simmed';

          const prefix = preservedSim.notes.includes('Raidbots') ? 'Raidbots Sim Upgrades: ' : 'Sim / QE Live Upgrades: ';
          const topList = simContenders.slice(0, 5).map((c, i) => {
            const pRole = c.priority.role ? ` | ${c.priority.role}` : '';
            const pAtt = c.priority.attPct ? ` | ${c.priority.attPct}` : '';
            const pPrep = (!c.priority.isRaidReady) ? ' | ⚠️ Unenchanted' : '';
            return `${i + 1}. ${c.name} [Score: ${c.priority.score}] (+${c.pct}%${pRole}${pAtt}${pPrep})`;
          });
          row[12] = prefix + topList.join(' | ');

          // Update live equipped item & ilvl for the top contender
          const topNameMatch = (row[6] || '').match(/^([A-Za-z0-9\u00C0-\u024F]+)/);
          if (topNameMatch) {
            const topChar = mainCharacterData.find(c => c['Name'] && c['Name'].toLowerCase() === topNameMatch[1].toLowerCase());
            if (topChar) {
              const eq = resolveEquippedItemForChar(topChar, slot);
              row[7] = eq.text;
              row[8] = eq.ilvl || '-';
            }
          }
          return;
        }
      }

      // 2. FALLBACK: For unsimmed items, calculate Live Equipped ilvl Delta with Priority Score
      const contenders = [];

      mainCharacterData.forEach(char => {
        if (!char['Name']) return;

        // Comprehensive Armor, Weapon, Stat & Role Eligibility Engine using Assigned Main Spec
        const mainRaidSpec = char['MainSpec'] || char['Expected Spec'] || char['Spec'];
        const isEligible = isCharacterEligibleForItem(char['Class'], mainRaidSpec, slot, targetRole, rawItemName);

        if (isEligible) {
          const eq = resolveEquippedItemForChar(char, slot);
          if (eq.ilvl > 0) {
            const delta = dropIlvl - eq.ilvl;
            const prio = calculatePriorityScore(delta, char['Name'], false, rosterContextMap);
            contenders.push({
              name: char['Name'],
              delta: delta,
              priority: prio,
              equippedText: eq.text,
              equippedIlvl: eq.ilvl
            });
          }
        }
      });

      // Sort by highest composite Priority Score
      contenders.sort((a, b) => b.priority.score - a.priority.score || b.delta - a.delta);

      if (contenders.length > 0) {
        const top = contenders[0];
        row[6] = formatContenderDisplay(top.name, top.delta, false, rosterContextMap, top.priority);
        row[7] = top.equippedText;
        row[8] = top.equippedIlvl;
        row[9] = `+${top.delta}`;
        row[11] = '⚡ Live Armory ilvl';

        // Top 3 list in Notes with Priority Score, Role, and Attendance context
        const top3List = contenders.slice(0, 3).map((c, i) => {
          const cRole = c.priority.role ? ` | ${c.priority.role}` : '';
          const cAtt = c.priority.attPct ? ` | ${c.priority.attPct}` : '';
          const cPrep = (!c.priority.isRaidReady) ? ' | ⚠️ Unenchanted' : '';
          return `${i + 1}. ${c.name} [Score: ${c.priority.score}] (+${c.delta}${cRole}${cAtt}${cPrep})`;
        }).join(' | ');
        row[12] = `${baseNotes} (Top Upgrades: ${top3List})`;
      }
    });
  }

  const fullData = [lootHeaders, ...chaseItemsCatalog];

  sheet.clear();
  sheet.clearFormats();
  sheet.clearConditionalFormatRules();
  sheet.getRange(1, 1, fullData.length, fullData[0].length).setValues(fullData);

  // Formatting
  const fullRange = sheet.getDataRange();
  fullRange.setHorizontalAlignment('center');
  fullRange.setVerticalAlignment('middle');
  fullRange.setFontFamily('Roboto');
  fullRange.setNumberFormat('@');
  sheet.setFrozenColumns(2);
  sheet.setFrozenRows(1);

  // Header styling
  const headerRange = sheet.getRange(1, 1, 1, sheet.getMaxColumns());
  headerRange.setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold').setFontSize(10);
  sheet.setRowHeight(1, 34);

  // Data rows
  if (fullData.length > 1) {
    sheet.setRowHeights(2, fullData.length - 1, 28);
    sheet.getRange(2, 1, fullData.length - 1, sheet.getMaxColumns()).setFontSize(9).setFontWeight('bold');
  }

  // Priority Column Conditional Formatting (Soft Badges)
  const rules = [];
  const prioColIdx = lootHeaders.indexOf('Priority / BiS Tier') + 1;
  const prioRange = [sheet.getRange(2, prioColIdx, sheet.getMaxRows(), 1)];
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('God-Tier').setBackground('#ffe4e6').setFontColor('#9f1239').setRanges(prioRange).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('BiS').setBackground('#f3e8ff').setFontColor('#6b21a8').setRanges(prioRange).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('Rare').setBackground('#ffedd5').setFontColor('#9a3412').setRanges(prioRange).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('Tier').setBackground('#d1fae5').setFontColor('#065f46').setRanges(prioRange).build());

  // Top Contender Column (Column G) Conditional Formatting:
  // Green if simmed (% DPS / ✅ Simmed), Yellow if unsimmed / Live Armory ilvl (⚡)
  const topContenderColIdx = lootHeaders.indexOf('Top Contender (Assigned)') + 1;
  const topContenderRange = [sheet.getRange(2, topContenderColIdx, sheet.getMaxRows(), 1)];
  
  // 1. Simmed -> Soft Green
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(`=AND($G2<>"", $G2<>"-", OR(ISNUMBER(SEARCH("%", $J2)), ISNUMBER(SEARCH("Simmed", $L2)), ISNUMBER(SEARCH("✅", $L2))))`)
    .setBackground('#d1fae5')
    .setFontColor('#065f46')
    .setRanges(topContenderRange)
    .build());

  // 2. Unsimmed (⚡ Live Armory / +ilvl) -> Soft Yellow
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(`=AND($G2<>"", $G2<>"-", NOT(ISNUMBER(SEARCH("════", $B2))), OR(ISNUMBER(SEARCH("+", $J2)), ISNUMBER(SEARCH("⚡", $L2)), ISNUMBER(SEARCH("Armory", $L2))))`)
    .setBackground('#fef3c7')
    .setFontColor('#92400e')
    .setRanges(topContenderRange)
    .build());

  // Sim Status Column Conditional Formatting
  const simStatusColIdx = lootHeaders.indexOf('Sim Status / Last Updated') + 1;
  const simStatusRange = [sheet.getRange(2, simStatusColIdx, sheet.getMaxRows(), 1)];
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('✅').setBackground('#d1fae5').setFontColor('#065f46').setRanges(simStatusRange).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('⚠️').setBackground('#fef3c7').setFontColor('#92400e').setRanges(simStatusRange).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('⚡').setBackground('#f1f5f9').setFontColor('#475569').setRanges(simStatusRange).build());

  sheet.setConditionalFormatRules(rules);

  // Style Boss Separator Rows with distinctive Dark Slate / Indigo Banners (Unmerged flat rows)
  for (let i = 0; i < chaseItemsCatalog.length; i++) {
    const rowTitle = (chaseItemsCatalog[i][0] || '').toString();
    if (rowTitle.startsWith('⚔️') || rowTitle.startsWith('🛡️') || rowTitle.startsWith('🧭') || rowTitle.startsWith('🧪') || rowTitle.startsWith('🐊') || rowTitle.startsWith('🏛️') || rowTitle.startsWith('👑') || rowTitle.startsWith('📦')) {
      const rowIdx = i + 2;
      sheet.getRange(rowIdx, 1, 1, sheet.getMaxColumns())
        .setBackground('#0f172a')
        .setFontColor('#f8fafc')
        .setFontWeight('bold')
        .setFontSize(10)
        .setHorizontalAlignment('left');
    }
  }

  // Set clean dynamic column widths (Unmerged flat layout)
  sheet.setColumnWidth(1, 230); // Boss / Source header
  sheet.autoResizeColumns(2, lootHeaders.length - 1);
  for (let c = 2; c <= lootHeaders.length; c++) {
    const calculatedWidth = sheet.getColumnWidth(c);
    sheet.setColumnWidth(c, Math.max(calculatedWidth + 16, 75));
  }

  // Ensure Notes has guaranteed comfortable minimum width
  if (sheet.getColumnWidth(13) < 650) sheet.setColumnWidth(13, 650);

  // Align text: Keep Top Contender & Equipped centered for clean badge symmetry, Notes left-aligned for readability
  if (fullData.length > 1) {
    sheet.getRange(2, 7, fullData.length - 1, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 8, fullData.length - 1, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 13, fullData.length - 1, 1).setHorizontalAlignment('left');

    // Apply Rich Text Class Colors to Top Contender (Col G) and Loot Council Notes (Col M)
    const richTopContenders = [];
    const richNotes = [];
    for (let r = 0; r < chaseItemsCatalog.length; r++) {
      const topText = (chaseItemsCatalog[r][6] || '').toString();
      const noteText = (chaseItemsCatalog[r][12] || '').toString();
      richTopContenders.push([buildRichTextWithClassColors(topText, rosterContextMap)]);
      richNotes.push([buildRichTextWithClassColors(noteText, rosterContextMap)]);
    }
    sheet.getRange(2, 7, richTopContenders.length, 1).setRichTextValues(richTopContenders);
    sheet.getRange(2, 13, richNotes.length, 1).setRichTextValues(richNotes);
  }
}

/**
 * Universal helper to clean item names for fuzzy matching.
 */
function cleanItemNameForMatching(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .replace(/^[0-9]+[\/:]/, '') // strip leading item ID e.g. "228892/"
    .replace(/[0-9]+[\/:]/, '')   // strip secondary difficulty ID e.g. "4/"
    .replace(/[',.\-_\/()]/g, ' ') // replace punctuation with spaces
    .replace(/\b(heroic|mythic|normal|champion|veteran|tier|lfr|socket|hero|myth|slot)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS_SET = ['the', 'and', 'for', 'from', 'with', 'into', 'under', 'over', 'of', 'by', 'in', 'on', 'at', 'to', 'a', 'an'];

/**
 * Checks if a catalog item matches a Raidbots sim item name.
 * Filters out common English stop words (e.g. "the", "of") so two items starting with "Crown of the" are not falsely matched.
 */
function isItemNameMatch(sheetItem, simItem) {
  const cSheet = cleanItemNameForMatching(sheetItem);
  const cSim = cleanItemNameForMatching(simItem);
  if (!cSheet || !cSim) return false;
  if (cSheet === cSim) return true;

  const alphaSheet = cSheet.replace(/[^a-z0-9]/g, '');
  const alphaSim = cSim.replace(/[^a-z0-9]/g, '');
  if (alphaSheet === alphaSim) return true;

  const sheetWords = cSheet.split(' ').filter(w => w.length >= 3 && !STOP_WORDS_SET.includes(w));
  const simWords = cSim.split(' ').filter(w => w.length >= 3 && !STOP_WORDS_SET.includes(w));

  if (sheetWords.length === 0 || simWords.length === 0) return false;

  const commonWords = sheetWords.filter(w => simWords.includes(w));

  if (sheetWords.length > 0 && commonWords.length === sheetWords.length) return true;
  if (simWords.length > 0 && commonWords.length === simWords.length) return true;

  const overlapRatio = commonWords.length / Math.max(sheetWords.length, simWords.length);
  return overlapRatio >= 0.75 || commonWords.length >= 3;
}

/**
 * Imports one or multiple Raidbots Droptimizer Sim Reports (JSON) and merges exact mathematical % DPS upgrades onto the Loot Sheet.
 */
function promptAndImportRaidbotsDroptimizer() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Import Raidbots Droptimizer Sim(s)',
    'Paste one or multiple Raidbots Droptimizer URLs or Report IDs:\n(You can paste multiple links separated by spaces, commas, or new lines)',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const rawInput = response.getResponseText().trim();
  if (!rawInput) {
    ui.alert('Please enter at least one valid Raidbots report URL or ID.');
    return;
  }

  const result = processAndIngestRaidbotsSims(rawInput);
  if (result.success) {
    ui.alert('Droptimizer Sims Merged!', `Successfully processed ${result.reportsProcessed} report(s) (${result.players.join(', ')}) and mapped DPS upgrades across ${result.itemsMapped} raid items.`, ui.ButtonSet.OK);
  } else {
    ui.alert('Import Failed', result.error || 'No valid reports could be processed.', ui.ButtonSet.OK);
  }
}

/**
 * Core engine to ingest Raidbots Droptimizer sims from strings, URLs, or webhooks.
 */
function processAndIngestRaidbotsSims(input) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LOOT_SHEET_NAME);
  if (!sheet) {
    createLootAndChaseItemsSheet();
    sheet = ss.getSheetByName(LOOT_SHEET_NAME);
  }

  // Extract all unique Report IDs from input
  const tokens = (typeof input === 'string' ? input : JSON.stringify(input)).split(/[\s,;\n"']+/);
  const reportIds = [];
  
  tokens.forEach(tok => {
    const clean = tok.replace(/^.*\/report\//, '').replace(/\/.*$/, '').trim();
    if (clean && /^[A-Za-z0-9_-]{10,35}$/.test(clean) && !reportIds.includes(clean)) {
      reportIds.push(clean);
    }
  });

  if (reportIds.length === 0) {
    return { success: false, error: 'No valid Raidbots report IDs found in input.' };
  }

  // Batch fetch all report data.json in parallel
  const requests = reportIds.map(id => ({
    url: `https://www.raidbots.com/reports/${id}/data.json`,
    muteHttpExceptions: true
  }));

  const responses = UrlFetchApp.fetchAll(requests);
  const simDataList = [];
  let successCount = 0;

  responses.forEach((resp, idx) => {
    if (resp && resp.getResponseCode() === 200) {
      try {
        const parsed = JSON.parse(resp.getContentText());
        simDataList.push(parsed);
        successCount++;
      } catch (e) {
        Logger.log(`Failed to parse sim data JSON for report ID: ${reportIds[idx]}`);
      }
    }
  });

  if (simDataList.length === 0) {
    return { success: false, error: 'Failed to fetch sim report JSON from Raidbots. Ensure the report URL is public and finished simming.' };
  }

  // Read existing Loot & Chase Items sheet data
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    createLootAndChaseItemsSheet();
  }
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  // Build itemUpgradeMap
  const itemUpgradeMap = {};
  values.forEach(row => {
    const itemName = (row[1] || '').toString().trim();
    if (!itemName || row[0].toString().startsWith('⚔️') || row[0].toString().startsWith('🛡️') || row[0].toString().startsWith('🧭') || row[0].toString().startsWith('🧪') || row[0].toString().startsWith('🐊') || row[0].toString().startsWith('🏛️') || row[0].toString().startsWith('👑') || row[0].toString().startsWith('📦')) {
      return;
    }
    itemUpgradeMap[itemName] = [];

    const currentNotes = (row[12] || '').toString();
    if (currentNotes.includes('Raidbots Sim Upgrades:')) {
      const parts = currentNotes.replace('Raidbots Sim Upgrades:', '').split('|');
      parts.forEach(p => {
        const m = p.trim().match(/(?:\d+\.\s*)?([A-Za-z0-9\u00C0-\u024F]+)\s*\(\+([0-9.]+)%\)/);
        if (m) {
          itemUpgradeMap[itemName].push({
            name: m[1],
            pct: parseFloat(m[2])
          });
        }
      });
    }
  });

  const now = Date.now();
  let latestSimDate = now;
  simDataList.forEach(s => {
    if (s && s.sim && s.sim.date) {
      const d = new Date(s.sim.date).getTime();
      if (d > 0 && d <= now) latestSimDate = d;
    }
  });

  const formattedDate = Utilities.formatDate(new Date(latestSimDate), Session.getScriptTimeZone() || "GMT", "MMM d, yyyy");
  const daysOld = Math.floor((now - latestSimDate) / (1000 * 60 * 60 * 24));
  const simStatusBadge = daysOld > 7 ? `⚠️ Stale (${daysOld}d ago)` : `✅ Simmed (${formattedDate})`;

  const processedPlayers = [];
  const topUpgradesSummary = [];

  const altNamesSet = getAltNamesSet(ss);

  // 1. Deduplicate by character name: strictly keep only the single most recent sim report per character!
  const latestSimsByPlayer = {};
  simDataList.forEach(simData => {
    if (!simData) return;
    let playerName = 'Unknown';
    if (simData.simbot && simData.simbot.player) {
      playerName = simData.simbot.player;
    } else if (simData.sim && simData.sim.players && simData.sim.players[0] && simData.sim.players[0].name) {
      playerName = simData.sim.players[0].name;
    }
    const lower = playerName.toLowerCase().trim();

    // Strictly skip Alt character sims from updating the Loot & Chase Items sheet
    if (altNamesSet.has(lower)) {
      Logger.log(`Skipping Alt character sim from Loot Sheet: ${playerName}`);
      return;
    }
    
    let simTime = 0;
    if (simData.sim && simData.sim.timestamp) simTime = simData.sim.timestamp * 1000;
    else if (simData.sim && simData.sim.date) simTime = new Date(simData.sim.date).getTime();
    else if (simData.simbot && simData.simbot.date) simTime = new Date(simData.simbot.date).getTime();
    else if (simData.simbot && simData.simbot.jobSubmitted) simTime = new Date(simData.simbot.jobSubmitted).getTime();

    if (!latestSimsByPlayer[lower] || simTime >= latestSimsByPlayer[lower].time) {
      latestSimsByPlayer[lower] = {
        simData: simData,
        time: simTime,
        playerName: playerName
      };
    }
  });

  const dedupedSimDataList = Object.values(latestSimsByPlayer).map(e => e.simData);

  dedupedSimDataList.forEach(simData => {
    if (!simData) return;

    let playerName = 'Unknown';
    if (simData.simbot && simData.simbot.player) {
      playerName = simData.simbot.player;
    } else if (simData.sim && simData.sim.players && simData.sim.players[0] && simData.sim.players[0].name) {
      playerName = simData.sim.players[0].name;
    }
    if (!processedPlayers.includes(playerName)) processedPlayers.push(playerName);

    // Purge previous/stale upgrades for this specific player so their newest sim fully replaces their old profile
    Object.keys(itemUpgradeMap).forEach(k => {
      itemUpgradeMap[k] = itemUpgradeMap[k].filter(e => e.name.toLowerCase() !== playerName.toLowerCase());
    });

    // 2. Build Item ID to Name & Slot dictionary from simbot.meta.itemLibrary & instanceLibrary
    const itemMap = {};
    const slotMap = {};
    const sourceMap = {};
    const encounters = {};

    const rawInstLib = simData.simbot && simData.simbot.meta && simData.simbot.meta.instanceLibrary;
    const instList = Array.isArray(rawInstLib) ? rawInstLib : (rawInstLib ? Object.values(rawInstLib) : []);
    instList.forEach(inst => {
      if (inst && inst.encounters) {
        const encs = Array.isArray(inst.encounters) ? inst.encounters : Object.values(inst.encounters);
        encs.forEach(enc => {
          if (enc && enc.id) encounters[enc.id] = enc.name;
        });
      }
    });

    const rawItemLib = simData.simbot && simData.simbot.meta && simData.simbot.meta.itemLibrary;
    const itemsList = Array.isArray(rawItemLib) ? rawItemLib : (rawItemLib ? Object.values(rawItemLib) : []);
    itemsList.forEach(it => {
      if (it && it.id) {
        itemMap[it.id] = it.name;
        slotMap[it.id] = it.slot;
        if (it.encounter && it.encounter.name) {
          sourceMap[it.id] = it.encounter.name;
        } else if (it.source && it.source.encounter && it.source.encounter.name) {
          sourceMap[it.id] = it.source.encounter.name;
        } else if (it.sources && it.sources[0] && it.sources[0].encounterId && encounters[it.sources[0].encounterId]) {
          sourceMap[it.id] = encounters[it.sources[0].encounterId];
        } else if (it.encounterId && encounters[it.encounterId]) {
          sourceMap[it.id] = encounters[it.encounterId];
        }
      }
    });

    let baseDps = 0;
    if (simData.sim && simData.sim.players && simData.sim.players[0] && simData.sim.players[0].collected_data && simData.sim.players[0].collected_data.dps) {
      baseDps = simData.sim.players[0].collected_data.dps.mean || 0;
    } else if (simData.sim && simData.sim.statistics && simData.sim.statistics.raid_dps) {
      baseDps = simData.sim.statistics.raid_dps.mean || 0;
    }

    const itemsToProcess = [];

    // Path A: Profilesets results
    if (simData.sim && simData.sim.profilesets && Array.isArray(simData.sim.profilesets.results)) {
      simData.sim.profilesets.results.forEach(res => {
        const profileName = (res.name || '').toString();
        const parts = profileName.split('/');
        let resolvedItemName = '';
        let resolvedSlot = '';
        let resolvedSource = '';

        if (parts.length >= 4) {
          const itemId = parseInt(parts[3], 10);
          if (itemId && itemMap[itemId]) {
            resolvedItemName = itemMap[itemId];
            resolvedSlot = slotMap[itemId] || '';
            resolvedSource = sourceMap[itemId] || '';
          }
        }

        if (!resolvedItemName) {
          resolvedItemName = profileName.replace(/^[0-9\/]+/, '').replace(/[\/0-9]+$/, '').trim();
        }

        const simDps = res.mean || res.dps || 0;
        let pct = res.pct || res.pct_gain;
        if (pct === undefined && simDps > baseDps && baseDps > 1) {
          pct = ((simDps - baseDps) / baseDps) * 100;
        }

        if (resolvedItemName && pct > 0) {
          const existing = itemsToProcess.find(it => isItemNameMatch(it.name, resolvedItemName));
          if (!existing || pct > existing.pct) {
            if (existing) {
              existing.pct = parseFloat(pct.toFixed(2));
            } else {
              itemsToProcess.push({
                name: resolvedItemName,
                pct: parseFloat(pct.toFixed(2)),
                slot: resolvedSlot,
                source: resolvedSource
              });
            }
          }
        }
      });
    }

    // Path B: Direct items array fallback
    const droptimizerObj = (simData.simbot && simData.simbot.droptimizer) || (simData.sim && simData.sim.droptimizer);
    if (droptimizerObj && Array.isArray(droptimizerObj.items)) {
      droptimizerObj.items.forEach(it => {
        const rawName = it.name || it.item_name || '';
        const dps = it.dps || it.mean || 0;
        let pct = it.pct || it.pct_gain;
        if (pct === undefined && dps > baseDps && baseDps > 1) {
          pct = ((dps - baseDps) / baseDps) * 100;
        }
        if (rawName && pct > 0) {
          itemsToProcess.push({
            name: rawName,
            pct: parseFloat(pct.toFixed(2)),
            slot: it.slot || '',
            source: 'Raid Drop'
          });
        }
      });
    }

    // Match extracted items into itemUpgradeMap or add as new catalog entries
    itemsToProcess.forEach(simItem => {
      // Find existing match
      let matchedCatalogKey = Object.keys(itemUpgradeMap).find(sheetKey => isItemNameMatch(sheetKey, simItem.name));
      
      if (!matchedCatalogKey) {
        // If not in catalog, register it dynamically so it's not lost
        itemUpgradeMap[simItem.name] = [];
        matchedCatalogKey = simItem.name;
        
        // Add row to values array
        values.push([
          simItem.source || 'The Venomous Abyss',
          simItem.name,
          simItem.slot || 'Gear',
          'Heroic',
          318,
          'All Eligible',
          '', '', '', '',
          'Raid Drop',
          simStatusBadge,
          ''
        ]);
      }

      const existingIdx = itemUpgradeMap[matchedCatalogKey].findIndex(e => e.name.toLowerCase() === playerName.toLowerCase());
      if (existingIdx >= 0) {
        itemUpgradeMap[matchedCatalogKey][existingIdx].pct = simItem.pct;
      } else {
        itemUpgradeMap[matchedCatalogKey].push({
          name: playerName,
          pct: simItem.pct
        });
      }
    });
  });

  // Load existing character gear from "Guild Audit" tab to populate equipped items/ilvl
  const charList = getGuildAuditCharacterList(sheet.getParent());
  const charMap = {};
  charList.forEach(c => { if (c['Name']) charMap[c['Name'].toLowerCase()] = c; });

  // Load roster context (Role & Attendance) for live badge overlays
  const rosterContextMap = getRosterContextMap(sheet.getParent());

  const extractIlvl = (slotText) => {
    if (!slotText || slotText === '-') return 0;
    const match = slotText.match(/(?:\[.*?\]\s*)?(\d{2,3})/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // Re-write merged rankings onto the sheet
  let totalMatches = 0;
  values.forEach(row => {
    const sheetItemName = (row[1] || '').toString().trim();
    if (!sheetItemName) return;

    // Look up upgrades using exact key OR fuzzy isItemNameMatch
    let contenders = itemUpgradeMap[sheetItemName];
    if (!contenders || contenders.length === 0) {
      const matchedKey = Object.keys(itemUpgradeMap).find(k => isItemNameMatch(k, sheetItemName));
      if (matchedKey && itemUpgradeMap[matchedKey]) {
        contenders = itemUpgradeMap[matchedKey];
      }
    }

    if (contenders && contenders.length > 0) {
      const slot = row[2] || '';
      const targetRole = (row[5] || '').toLowerCase();
      const eligibleContenders = contenders.filter(c => {
        const charInfo = rosterContextMap[c.name.toLowerCase()] || {};
        const charClass = charInfo.charClass || (charMap[c.name.toLowerCase()] && charMap[c.name.toLowerCase()]['Class']) || '';
        const charSpec = charInfo.spec || (charMap[c.name.toLowerCase()] && charMap[c.name.toLowerCase()]['Spec']) || '';
        return isCharacterEligibleForItem(charClass, charSpec, slot, targetRole, sheetItemName);
      });

      if (eligibleContenders.length > 0) {
        eligibleContenders.forEach(c => {
          c.priority = calculatePriorityScore(c.pct, c.name, true, rosterContextMap);
        });
        const sorted = eligibleContenders.sort((a, b) => b.priority.score - a.priority.score || b.pct - a.pct);
        const top = sorted[0];
        row[6] = formatContenderDisplay(top.name, top.pct, true, rosterContextMap, top.priority);
        row[9] = `+${top.pct}% DPS`;
        row[11] = simStatusBadge;

        const topList = sorted.slice(0, 5).map((c, i) => {
          const cRole = c.priority.role ? ` | ${c.priority.role}` : '';
          const cAtt = c.priority.attPct ? ` | ${c.priority.attPct}` : '';
          const cPrep = (!c.priority.isRaidReady) ? ' | ⚠️ Unenchanted' : '';
          return `${i + 1}. ${c.name} [Score: ${c.priority.score}] (+${c.pct}%${cRole}${cAtt}${cPrep})`;
        }).join(' | ');
        row[12] = `Raidbots Sim Upgrades: ${topList}`;

        // Populate live equipped item and ilvl for the top contender!
        const topChar = charMap[top.name.toLowerCase()];
        if (topChar) {
          let currentSlotText = '-';
          if (slot.includes('Trinket')) {
            const t1 = topChar['Trinket 1'] || '-';
            const t2 = topChar['Trinket 2'] || '-';
            const ilvl1 = extractIlvl(t1);
            const ilvl2 = extractIlvl(t2);
            currentSlotText = (ilvl1 <= ilvl2 && ilvl1 > 0) ? t1 : (ilvl2 > 0 ? t2 : t1);
          } else if (slot.includes('Ring')) {
            const r1 = topChar['Ring 1'] || '-';
            const r2 = topChar['Ring 2'] || '-';
            const ilvl1 = extractIlvl(r1);
            const ilvl2 = extractIlvl(r2);
            currentSlotText = (ilvl1 <= ilvl2 && ilvl1 > 0) ? r1 : (ilvl2 > 0 ? r2 : r1);
          } else if (slot.includes('Two-Hand') || slot.includes('One-Hand') || slot.includes('Main Hand') || slot.includes('Ranged')) {
            currentSlotText = topChar['Main Hand'] || '-';
          } else if (slot.includes('Off Hand') || slot.includes('Shield')) {
            currentSlotText = topChar['Off Hand'] || '-';
          } else {
            currentSlotText = topChar[slot] || '-';
          }
          row[7] = currentSlotText;
          row[8] = extractIlvl(currentSlotText) || '-';
        }
        totalMatches++;
      }
    }
  });

  // Save back all updated and newly registered items
  sheet.getRange(2, 1, values.length, values[0].length).setValues(values);
  sheet.getRange(2, 7, values.length, 1).setHorizontalAlignment('center');
  sheet.getRange(2, 8, values.length, 1).setHorizontalAlignment('center');
  sheet.getRange(2, 13, values.length, 1).setHorizontalAlignment('left');

  // Apply Rich Text Class Colors to Top Contender and Notes
  const richTopContenders = [];
  const richNotes = [];
  for (let r = 0; r < values.length; r++) {
    const topText = (values[r][6] || '').toString();
    const noteText = (values[r][12] || '').toString();
    richTopContenders.push([buildRichTextWithClassColors(topText, rosterContextMap)]);
    richNotes.push([buildRichTextWithClassColors(noteText, rosterContextMap)]);
  }
  sheet.getRange(2, 7, richTopContenders.length, 1).setRichTextValues(richTopContenders);
  sheet.getRange(2, 13, richNotes.length, 1).setRichTextValues(richNotes);

  // Set clean dynamic column widths (Unmerged flat layout)
  sheet.setColumnWidth(1, 230); // Boss / Source header
  sheet.autoResizeColumns(2, values[0].length - 1);
  for (let c = 2; c <= values[0].length; c++) {
    const calculatedWidth = sheet.getColumnWidth(c);
    sheet.setColumnWidth(c, Math.max(calculatedWidth + 16, 75));
  }
  if (sheet.getColumnWidth(13) < 650) sheet.setColumnWidth(13, 650);

  return {
    success: true,
    reportsProcessed: successCount,
    players: processedPlayers,
    itemsMapped: totalMatches,
    topUpgrades: topUpgradesSummary,
    message: `Successfully mapped DPS upgrades for ${processedPlayers.join(', ')} across ${totalMatches} raid items.`
  };
}

/**
 * Ingests a Questionably Epic Live (QE Live) Upgrade Report for Healers.
 * Excludes Personal Loot / Bonus Roll items ('dropType === bonus').
 * Maps raid item HPS upgrades directly to the Loot & Chase Items sheet.
 */
function processAndIngestQELiveReport(reportUrlOrId) {
  if (!reportUrlOrId) return { success: false, error: 'No QE Live URL provided.' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LOOT_SHEET_NAME);
  if (!sheet) {
    createLootAndChaseItemsSheet();
    sheet = ss.getSheetByName(LOOT_SHEET_NAME);
  }

  // Extract Report ID
  const str = Array.isArray(reportUrlOrId) ? reportUrlOrId.join(' ') : reportUrlOrId.toString().trim();
  const m = str.match(/(?:upgradereport\/|reportID=)([A-Za-z0-9_-]{8,35})/i);
  const reportId = m ? m[1] : (str.match(/\b([a-z0-9_-]{8,35})\b/i) ? str.match(/\b([a-z0-9_-]{8,35})\b/i)[1] : null);
  if (!reportId) {
    return { success: false, error: 'Could not parse a valid QE Live Report ID from input.' };
  }

  const apiUrl = `https://questionablyepic.com/api/getUpgradeReport.php?reportID=${reportId}`;
  let reportData = null;
  try {
    const resp = UrlFetchApp.fetch(apiUrl, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) {
      return { success: false, error: `QE Live API returned status ${resp.getResponseCode()}` };
    }
    const raw = resp.getContentText();
    reportData = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (typeof reportData === 'string') reportData = JSON.parse(reportData);
  } catch (err) {
    return { success: false, error: `Failed to fetch or parse QE Live report: ${err.message}` };
  }

  if (!reportData || !reportData.results) {
    return { success: false, error: 'QE Live report returned no results data.' };
  }

  const playerName = (reportData.playername || reportData.player || 'Healer').toString().trim();
  const altNamesSet = getAltNamesSet(sheet.getParent());
  if (altNamesSet.has(playerName.toLowerCase())) {
    Logger.log(`Skipping Alt character QE Live report from Loot Sheet: ${playerName}`);
    return { success: true, message: `Skipped Alt character report for ${playerName}` };
  }

  const spec = reportData.spec || 'Healer';
  const now = new Date();
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone() || 'GMT', 'MMM d, yyyy');
  const simStatusBadge = `✅ QE Live (${dateStr})`;

  // Read existing sheet rows
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return { success: false, error: 'Loot & Chase Items sheet is empty.' };

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  // Read itemUpgradeMap from existing sheet rows
  const itemUpgradeMap = {};
  values.forEach(row => {
    const itemName = (row[1] || '').toString().trim();
    if (itemName && !itemName.startsWith('═══')) {
      itemUpgradeMap[itemName] = [];
      const notes = (row[12] || '').toString();
      const matchContenders = notes.match(/\d+\.\s+([A-Za-z0-9\u00C0-\u024F]+)\s+\(\+([0-9.]+)%\)/g);
      if (matchContenders) {
        matchContenders.forEach(entry => {
          const m = entry.match(/\d+\.\s+([A-Za-z0-9\u00C0-\u024F]+)\s+\(\+([0-9.]+)%\)/);
          if (m) {
            itemUpgradeMap[itemName].push({ name: m[1], pct: parseFloat(m[2]) });
          }
        });
      }
    }
  });

  const raidUpgrades = [];
  const topUpgradesSummary = [];

  // Filter QE Live items:
  // 1. OMIT Bonus Roll items (personal loot)
  // 2. OMIT Non-raid drops
  // 3. OMIT 0 or negative upgrades
  reportData.results.forEach(r => {
    if (r.dropType === 'bonus') return; // Explicitly exclude bonus roll personal loot
    if (r.dropLoc && r.dropLoc.toLowerCase() !== 'raid') return;
    if (!r.percDiff || r.percDiff <= 0) return;

    const pct = parseFloat(r.percDiff.toFixed(2));
    const itemId = r.item;
    raidUpgrades.push({
      itemId: itemId,
      pct: pct,
      level: r.level
    });
  });

  // Match items to sheet rows by Blizzard ID in Column 13 (Notes)
  let totalMatches = 0;
  raidUpgrades.forEach(up => {
    let matchedRow = values.find(row => {
      const notes = (row[12] || '').toString();
      const idMatch = notes.match(/Blizzard ID:\s*(\d+)/i);
      return idMatch && parseInt(idMatch[1], 10) === up.itemId;
    });

    if (matchedRow) {
      const sheetItemName = matchedRow[1];
      if (!itemUpgradeMap[sheetItemName]) itemUpgradeMap[sheetItemName] = [];
      
      const existingIdx = itemUpgradeMap[sheetItemName].findIndex(e => e.name.toLowerCase() === playerName.toLowerCase());
      if (existingIdx >= 0) {
        if (up.pct > itemUpgradeMap[sheetItemName][existingIdx].pct) {
          itemUpgradeMap[sheetItemName][existingIdx].pct = up.pct;
        }
      } else {
        itemUpgradeMap[sheetItemName].push({ name: playerName, pct: up.pct });
      }

      topUpgradesSummary.push({ item: sheetItemName, pct: up.pct });
      totalMatches++;
    }
  });

  // Load raider equipment from "Guild Audit" tab
  const charList = getGuildAuditCharacterList(sheet.getParent());
  const charMap = {};
  charList.forEach(c => { if (c['Name']) charMap[c['Name'].toLowerCase()] = c; });

  const extractIlvl = (slotText) => {
    if (!slotText || slotText === '-') return 0;
    const match = slotText.match(/(?:\[.*?\]\s*)?(\d{2,3})/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // Load roster context (Role & Attendance) for live badge overlays
  const rosterContextMap = getRosterContextMap(sheet.getParent());

  // Re-write merged rankings onto the sheet
  values.forEach(row => {
    const sheetItemName = (row[1] || '').toString().trim();
    if (!sheetItemName) return;

    // Look up upgrades using exact key OR fuzzy isItemNameMatch
    let contenders = itemUpgradeMap[sheetItemName];
    if (!contenders || contenders.length === 0) {
      const matchedKey = Object.keys(itemUpgradeMap).find(k => isItemNameMatch(k, sheetItemName));
      if (matchedKey && itemUpgradeMap[matchedKey]) {
        contenders = itemUpgradeMap[matchedKey];
      }
    }

    if (contenders && contenders.length > 0) {
      const slot = row[2] || '';
      const targetRole = (row[5] || '').toLowerCase();
      const eligibleContenders = contenders.filter(c => {
        const charInfo = rosterContextMap[c.name.toLowerCase()] || {};
        const charClass = charInfo.charClass || (charMap[c.name.toLowerCase()] && charMap[c.name.toLowerCase()]['Class']) || '';
        const charSpec = charInfo.spec || (charMap[c.name.toLowerCase()] && charMap[c.name.toLowerCase()]['Spec']) || '';
        return isCharacterEligibleForItem(charClass, charSpec, slot, targetRole, sheetItemName);
      });

      if (eligibleContenders.length > 0) {
        eligibleContenders.forEach(c => {
          c.priority = calculatePriorityScore(c.pct, c.name, true, rosterContextMap);
        });
        const sorted = eligibleContenders.sort((a, b) => b.priority.score - a.priority.score || b.pct - a.pct);
        const top = sorted[0];
        row[6] = formatContenderDisplay(top.name, top.pct, true, rosterContextMap, top.priority);
        row[9] = `+${top.pct}% HPS`;
        row[11] = simStatusBadge;

        const topList = sorted.slice(0, 5).map((c, i) => {
          const cRole = c.priority.role ? ` | ${c.priority.role}` : '';
          const cAtt = c.priority.attPct ? ` | ${c.priority.attPct}` : '';
          const cPrep = (!c.priority.isRaidReady) ? ' | ⚠️ Unenchanted' : '';
          return `${i + 1}. ${c.name} [Score: ${c.priority.score}] (+${c.pct}%${cRole}${cAtt}${cPrep})`;
        }).join(' | ');
        row[12] = `Sim / QE Live Upgrades: ${topList}`;

        const topChar = charMap[top.name.toLowerCase()];
        if (topChar) {
          let currentSlotText = '-';
          if (slot.includes('Trinket')) {
            const t1 = topChar['Trinket 1'] || '-';
            const t2 = topChar['Trinket 2'] || '-';
            const ilvl1 = extractIlvl(t1);
            const ilvl2 = extractIlvl(t2);
            currentSlotText = (ilvl1 <= ilvl2 && ilvl1 > 0) ? t1 : (ilvl2 > 0 ? t2 : t1);
          } else if (slot.includes('Ring')) {
            const r1 = topChar['Ring 1'] || '-';
            const r2 = topChar['Ring 2'] || '-';
            const ilvl1 = extractIlvl(r1);
            const ilvl2 = extractIlvl(r2);
            currentSlotText = (ilvl1 <= ilvl2 && ilvl1 > 0) ? r1 : (ilvl2 > 0 ? r2 : r1);
          } else if (slot.includes('Two-Hand') || slot.includes('One-Hand') || slot.includes('Main Hand') || slot.includes('Ranged')) {
            currentSlotText = topChar['Main Hand'] || '-';
          } else if (slot.includes('Off Hand') || slot.includes('Shield')) {
            currentSlotText = topChar['Off Hand'] || '-';
          } else {
            currentSlotText = topChar[slot] || '-';
          }
          row[7] = currentSlotText;
          row[8] = extractIlvl(currentSlotText) || '-';
        }

        totalMatches++;
      }
    }
  });

  // Save back all updated values
  sheet.getRange(2, 1, values.length, values[0].length).setValues(values);
  sheet.getRange(2, 7, values.length, 1).setHorizontalAlignment('center');
  sheet.getRange(2, 8, values.length, 1).setHorizontalAlignment('center');
  sheet.getRange(2, 13, values.length, 1).setHorizontalAlignment('left');

  // Apply Rich Text Class Colors to Top Contender and Notes
  const richTopContenders = [];
  const richNotes = [];
  for (let r = 0; r < values.length; r++) {
    const topText = (values[r][6] || '').toString();
    const noteText = (values[r][12] || '').toString();
    richTopContenders.push([buildRichTextWithClassColors(topText, rosterContextMap)]);
    richNotes.push([buildRichTextWithClassColors(noteText, rosterContextMap)]);
  }
  sheet.getRange(2, 7, richTopContenders.length, 1).setRichTextValues(richTopContenders);
  sheet.getRange(2, 13, richNotes.length, 1).setRichTextValues(richNotes);

  // Set clean dynamic column widths (Unmerged flat layout)
  sheet.setColumnWidth(1, 230); // Boss / Source header
  sheet.autoResizeColumns(2, values[0].length - 1);
  for (let c = 2; c <= values[0].length; c++) {
    const calculatedWidth = sheet.getColumnWidth(c);
    sheet.setColumnWidth(c, Math.max(calculatedWidth + 16, 75));
  }
  if (sheet.getColumnWidth(13) < 650) sheet.setColumnWidth(13, 650);

  return {
    success: true,
    platform: 'QE Live',
    reportsProcessed: 1,
    players: [playerName],
    itemsMapped: totalMatches,
    topUpgrades: topUpgradesSummary.sort((a, b) => b.pct - a.pct).slice(0, 5),
    message: `Successfully mapped QE Live healer upgrades for ${playerName} (${spec}) across ${totalMatches} raid items (Bonus rolls excluded).`
  };
}

/**
 * Universal router for incoming sim/report submissions (Raidbots or QE Live).
 * Seamlessly handles arrays, mixed batches, and single links.
 */
function processUniversalSimOrReport(input) {
  let urls = [];
  if (Array.isArray(input)) {
    urls = input;
  } else {
    urls = (input || '').toString().split(/[\s,;]+/).filter(u => u.trim());
  }

  const qeUrls = urls.filter(u => u.includes('questionablyepic.com') || u.includes('qe-live.com') || u.includes('upgradereport'));
  const rbUrls = urls.filter(u => !qeUrls.includes(u));

  let rbResult = null;
  let qeResult = null;

  if (rbUrls.length > 0) {
    rbResult = processAndIngestRaidbotsSims(rbUrls.join('\n'));
  }
  if (qeUrls.length > 0) {
    qeUrls.forEach(q => {
      qeResult = processAndIngestQELiveReport(q);
    });
  }

  if (rbResult && qeResult) {
    return {
      success: true,
      reportsProcessed: (rbResult.reportsProcessed || 0) + qeUrls.length,
      players: [...(rbResult.players || []), ...(qeResult.players || [])],
      message: `Successfully processed ${rbResult.reportsProcessed || 0} Raidbots sims and ${qeUrls.length} QE Live reports.`
    };
  }
  return rbResult || qeResult || { success: false, message: 'No valid sim or report URLs provided.' };
}

/**
 * Google Apps Script Web App POST Endpoint
 * Receives webhook calls from the Discord Bot when raiders paste Raidbots or QE Live links.
 */
function doPost(e) {
  try {
    let payload = null;
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        payload = e.parameter;
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const simInput = (payload && (payload.url || payload.urls || payload.report_url || payload.content || payload.text)) || '';
    if (!simInput) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'No Raidbots or QE Live URL found in request body.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const result = processUniversalSimOrReport(simInput);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Google Apps Script Web App GET Endpoint (Health Check)
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    service: 'WoW Raid Team Audit Sim & QE Live Webhook',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// ═════════════════════════════════════════════════════════════════════════════════════
// 🏛️ WARCRAFT LOGS GRAPHQL API & SEASON ATTENDANCE ENGINE
// ═════════════════════════════════════════════════════════════════════════════════════

const ATTENDANCE_SHEET_NAME = 'Attendance & History';
const DEFAULT_WCL_CLIENT_ID = '01a02983-f0ef-71cc-9662-fa190b1053fb';
const DEFAULT_WCL_CLIENT_SECRET = 'Rv3GOPvtW59BNGZDdLNaGayXGOMtbD6PXZqjHXFb';

/**
 * Prompts user to set or update their Warcraft Logs v2 API Client credentials.
 */
function promptForWCLCredentials() {
  const ui = SpreadsheetApp.getUi();
  const userProperties = PropertiesService.getUserProperties();

  const clientIdResponse = ui.prompt('Set Warcraft Logs Client ID', 'Enter your Warcraft Logs Client ID:', ui.ButtonSet.OK_CANCEL);
  if (clientIdResponse.getSelectedButton() !== ui.Button.OK) return;
  const clientId = clientIdResponse.getResponseText().trim();

  const clientSecretResponse = ui.prompt('Set Warcraft Logs Client Secret', 'Enter your Warcraft Logs Client Secret:', ui.ButtonSet.OK_CANCEL);
  if (clientSecretResponse.getSelectedButton() !== ui.Button.OK) return;
  const clientSecret = clientSecretResponse.getResponseText().trim();

  if (clientId && clientSecret) {
    userProperties.setProperties({
      'WCL_CLIENT_ID': clientId,
      'WCL_CLIENT_SECRET': clientSecret
    });
    ui.alert('Success!', 'Your Warcraft Logs API credentials have been saved. You can now sync guild attendance.', ui.ButtonSet.OK);
  } else {
    ui.alert('Error', 'Both Client ID and Client Secret are required.', ui.ButtonSet.OK);
  }
}

/**
 * Obtains an OAuth2 Bearer Access Token for the Warcraft Logs v2 API.
 */
function getWCLAccessToken() {
  const userProperties = PropertiesService.getUserProperties();
  const clientId = userProperties.getProperty('WCL_CLIENT_ID') || DEFAULT_WCL_CLIENT_ID;
  const clientSecret = userProperties.getProperty('WCL_CLIENT_SECRET') || DEFAULT_WCL_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  const scriptProperties = PropertiesService.getScriptProperties();
  let token = scriptProperties.getProperty('wcl_token');
  const tokenExpiry = scriptProperties.getProperty('wcl_token_expiry');

  if (token && new Date().getTime() < Number(tokenExpiry)) {
    return token;
  }

  try {
    const tokenResp = UrlFetchApp.fetch('https://www.warcraftlogs.com/oauth/token', {
      method: 'post',
      payload: { grant_type: 'client_credentials' },
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(clientId + ':' + clientSecret)
      },
      muteHttpExceptions: true
    });

    if (tokenResp.getResponseCode() !== 200) {
      Logger.log('WCL Auth error: ' + tokenResp.getContentText());
      return null;
    }

    const tokenData = JSON.parse(tokenResp.getContentText());
    token = tokenData.access_token;
    const expiry = new Date().getTime() + ((tokenData.expires_in || 3600) - 60) * 1000;
    scriptProperties.setProperty('wcl_token', token);
    scriptProperties.setProperty('wcl_token_expiry', expiry.toString());
    return token;
  } catch (err) {
    Logger.log('Error acquiring WCL access token: ' + err);
    return null;
  }
}

/**
 * Synchronizes guild attendance, boss kills, and on-time punctuality directly from Warcraft Logs.
 * Merges multi-uploader reports by Pacific calendar date into official raid nights (Tue/Wed).
 */
function syncWarcraftLogsSeasonAttendance() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const config = getConfigurationFromSheet();
  if (!config) return;

  const wclToken = getWCLAccessToken();
  if (!wclToken) {
    ui.alert('Authentication Failed', 'Could not authenticate with Warcraft Logs. Please check your API credentials under "Guild Audit > 7. Set Warcraft Logs API Credentials".', ui.ButtonSet.OK);
    return;
  }

  const guildName = config.GUILD_NAME_SLUG || 'prey';
  const serverSlug = config.GUILD_REALM_SLUG || 'kiljaeden';
  const serverRegion = (config.REGION || 'us').toLowerCase();
  const timeZone = 'America/Los_Angeles'; // Guild raid time zone (Pacific)

  // Query all recent reports for the guild
  const reportsQuery = `
    query {
      reportData {
        reports(guildName: "${guildName}", guildServerSlug: "${serverSlug}", guildServerRegion: "${serverRegion}", limit: 40) {
          data {
            code
            title
            startTime
            endTime
            fights(killType: Kills) {
              id
              name
              kill
              difficulty
              startTime
              endTime
            }
          }
        }
      }
    }
  `;

  let reports = [];
  try {
    const gqlResp = UrlFetchApp.fetch('https://www.warcraftlogs.com/api/v2/client', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + wclToken
      },
      payload: JSON.stringify({ query: reportsQuery }),
      muteHttpExceptions: true
    });

    if (gqlResp.getResponseCode() !== 200) {
      ui.alert('WCL API Error', `Warcraft Logs API returned status ${gqlResp.getResponseCode()}: ${gqlResp.getContentText()}`, ui.ButtonSet.OK);
      return;
    }

    const json = JSON.parse(gqlResp.getContentText());
    if (json && json.data && json.data.reportData && json.data.reportData.reports) {
      reports = json.data.reportData.reports.data || [];
    }
  } catch (e) {
    ui.alert('Error', `Failed to query Warcraft Logs: ${e.message}`, ui.ButtonSet.OK);
    return;
  }

  if (reports.length === 0) {
    ui.alert('No Logs Found', `No reports found on Warcraft Logs for guild <${guildName}> on ${serverSlug}-${serverRegion}.`, ui.ButtonSet.OK);
    return;
  }

  // Season 2 Raid Boss List
  const raidBossNames = [
    "Nek'zali the Soulcoiler", "Entombed Sentinels", "The Lost Explorers",
    "Vashnik the Malignant", "Sszorak", "The Twin Fangs",
    "The Coiled Altar", "Ula'tek"
  ];

  // 1. Group & Merge Reports by Pacific Calendar Date (Deduplicates Multi-Uploaders)
  const sessionMap = {};

  reports.forEach(r => {
    const bossKills = (r.fights || []).filter(f => f.kill && raidBossNames.some(b => f.name.includes(b)));
    if (bossKills.length === 0) return;

    const dateKey = Utilities.formatDate(new Date(r.startTime), timeZone, 'yyyy-MM-dd');
    const formattedDate = Utilities.formatDate(new Date(r.startTime), timeZone, 'EEE, MMM d, yyyy');
    const dayOfWeek = Utilities.formatDate(new Date(r.startTime), timeZone, 'EEEE');

    if (!sessionMap[dateKey]) {
      sessionMap[dateKey] = {
        dateKey: dateKey,
        formattedDate: formattedDate,
        dayOfWeek: dayOfWeek,
        reports: [],
        allBossKills: [],
        earliestStartTime: Infinity,
        firstReportCode: null,
        firstFightId: null
      };
    }

    sessionMap[dateKey].reports.push({
      code: r.code,
      title: r.title,
      startTime: r.startTime,
      bossKills: bossKills
    });

    bossKills.forEach(b => {
      if (!sessionMap[dateKey].allBossKills.includes(b.name)) {
        sessionMap[dateKey].allBossKills.push(b.name);
      }
    });

    if (r.startTime < sessionMap[dateKey].earliestStartTime) {
      sessionMap[dateKey].earliestStartTime = r.startTime;
      sessionMap[dateKey].firstReportCode = r.code;
      sessionMap[dateKey].firstFightId = bossKills[0].id;
    }
  });

  const raidSessions = Object.values(sessionMap).sort((a, b) => new Date(b.dateKey).getTime() - new Date(a.dateKey).getTime());

  if (raidSessions.length === 0) {
    ui.alert('No Raid Kills Found', 'Found guild reports, but none contained verified Season 2 boss kills yet.', ui.ButtonSet.OK);
    return;
  }

  // Get active roster list from Config sheet
  const rosterMembers = config.MEMBERS_TO_TRACK || [];
  const memberNameMap = {};
  rosterMembers.forEach(m => {
    if (m.name) memberNameMap[m.name.toLowerCase()] = m.name;
  });

  // Track player cumulative statistics
  const playerStats = {};
  rosterMembers.forEach(m => {
    playerStats[m.name] = {
      name: m.name,
      spec: m.expectedSpec || '',
      raidsAttended: 0,
      onTimeCount: 0,
      lateCount: 0,
      totalBossKillsAttended: 0
    };
  });

  // Active Raid Days & Minimum Guild Quorum configuration (Filters out off-hours PUGs & alt runs)
  const activeDaysList = (config.RAID_DAYS || 'Tuesday, Wednesday')
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(Boolean);

  // Guild Quorum: Require at least 5 main guild raiders OR 35% of the active roster for an official mandatory raid night
  const minGuildQuorum = Math.max(5, Math.min(8, Math.ceil(rosterMembers.length * 0.35)));
  let officialRaidCount = 0;
  const raidLedger = [];

  // 2. Query Details and Punctuality for Each Merged Raid Night
  raidSessions.forEach(session => {
    const sessionAttendees = new Set();
    const firstPullAttendees = new Set();
    const reportLinks = session.reports.map(r => `https://www.warcraftlogs.com/reports/${r.code}`);

    // Query participants for each report in this session
    session.reports.forEach(r => {
      const fightIds = r.bossKills.map(b => b.id);
      const detailQuery = `
        query {
          reportData {
            report(code: "${r.code}") {
              playerDetails(fightIDs: [${fightIds.join(',')}])
            }
          }
        }
      `;

      try {
        const dResp = UrlFetchApp.fetch('https://www.warcraftlogs.com/api/v2/client', {
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + wclToken
          },
          payload: JSON.stringify({ query: detailQuery }),
          muteHttpExceptions: true
        });

        if (dResp.getResponseCode() === 200) {
          const dJson = JSON.parse(dResp.getContentText());
          const reportObj = dJson.data && dJson.data.reportData ? dJson.data.reportData.report : null;
          if (reportObj && reportObj.playerDetails && reportObj.playerDetails.data && reportObj.playerDetails.data.playerDetails) {
            const pData = reportObj.playerDetails.data.playerDetails;
            const allPlayers = [...(pData.tanks || []), ...(pData.healers || []), ...(pData.dps || [])];
            allPlayers.forEach(p => sessionAttendees.add(p.name));
          }
        }
      } catch (err) {
        Logger.log(`Error querying report details for ${r.code}: ${err}`);
      }
    });

    // Query the very first pull of the night for On-Time verification
    if (session.firstReportCode && session.firstFightId) {
      const firstFightQuery = `
        query {
          reportData {
            report(code: "${session.firstReportCode}") {
              playerDetails(fightIDs: [${session.firstFightId}])
            }
          }
        }
      `;
      try {
        const fResp = UrlFetchApp.fetch('https://www.warcraftlogs.com/api/v2/client', {
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + wclToken
          },
          payload: JSON.stringify({ query: firstFightQuery }),
          muteHttpExceptions: true
        });
        if (fResp.getResponseCode() === 200) {
          const fJson = JSON.parse(fResp.getContentText());
          const fReport = fJson.data && fJson.data.reportData ? fJson.data.reportData.report : null;
          if (fReport && fReport.playerDetails && fReport.playerDetails.data && fReport.playerDetails.data.playerDetails) {
            const fData = fReport.playerDetails.data.playerDetails;
            const initialPullPlayers = [...(fData.tanks || []), ...(fData.healers || []), ...(fData.dps || [])];
            initialPullPlayers.forEach(p => firstPullAttendees.add(p.name));
          }
        }
      } catch (err) {
        Logger.log(`Error querying first pull for ${session.firstReportCode}: ${err}`);
      }
    }

    // 1. Resolve unique Main Character Attendees for this raid night (Alt-to-Main deduplicated)
    const uniqueSessionMains = new Set();
    const uniqueFirstPullMains = new Set();
    const altToMainMap = config.ALT_TO_MAIN_MAP || {};

    const resolveToMain = (name) => {
      if (!name) return null;
      const lower = name.toLowerCase().trim();
      if (memberNameMap[lower]) return memberNameMap[lower];
      if (altToMainMap[lower]) {
        const ownerLower = altToMainMap[lower].toLowerCase().trim();
        return memberNameMap[ownerLower] || Object.keys(playerStats).find(k => k.toLowerCase() === ownerLower) || altToMainMap[lower];
      }
      return Object.keys(playerStats).find(k => k.toLowerCase() === lower) || null;
    };

    sessionAttendees.forEach(pName => {
      const mainName = resolveToMain(pName);
      if (mainName && playerStats[mainName]) {
        uniqueSessionMains.add(mainName);
      }
    });

    firstPullAttendees.forEach(pName => {
      const mainName = resolveToMain(pName);
      if (mainName && playerStats[mainName]) {
        uniqueFirstPullMains.add(mainName);
      }
    });

    // Determine highest difficulty fought during this raid session (5 = Mythic, 4 = Heroic, 3 = Normal)
    let isMythicSession = false;
    session.reports.forEach(r => {
      if ((r.bossKills || []).some(b => b.difficulty === 5)) {
        isMythicSession = true;
      }
    });

    // Blizzard Guild Group Quorums:
    // - Mythic (20-player locked): Minimum 15 guild members (Cancels if missing >5 raiders)
    // - Heroic / Normal (Flex): Minimum 10 guild members (Minimum flex raid baseline)
    const requiredGuildQuorum = isMythicSession ? 15 : 10;

    // Evaluate if this session meets the Official Guild Raid criteria (Scheduled Day + Difficulty-Aware Guild Quorum)
    // Load saved Bench records from ScriptProperties
    const scriptProperties = PropertiesService.getScriptProperties();
    const benchRecords = JSON.parse(scriptProperties.getProperty('bench_records') || '{}');
    const sessionBench = benchRecords[session.dateKey] || benchRecords[session.formattedDate] || [];
    const presentBench = [];

    const isScheduledDay = activeDaysList.length === 0 || activeDaysList.some(d => session.dayOfWeek.toLowerCase().includes(d));
    const hasGuildQuorum = (uniqueSessionMains.size + sessionBench.length) >= requiredGuildQuorum;
    const isOfficial = hasGuildQuorum && isScheduledDay;

    const presentOnTime = [];
    const presentLate = [];

    if (isOfficial) {
      officialRaidCount++;
      // Increment Attendance exactly ONCE per canonical main for official raid nights
      uniqueSessionMains.forEach(canonical => {
        playerStats[canonical].raidsAttended++;
        playerStats[canonical].totalBossKillsAttended += session.allBossKills.length;

        if (uniqueFirstPullMains.has(canonical)) {
          playerStats[canonical].onTimeCount++;
          presentOnTime.push(canonical);
        } else {
          playerStats[canonical].lateCount++;
          presentLate.push(canonical);
        }
      });

      // Award full 100% Attendance & On-Time credit to Bench / Standby raiders!
      sessionBench.forEach(bName => {
        const canonical = resolveToMain(bName);
        if (canonical && playerStats[canonical] && !uniqueSessionMains.has(canonical)) {
          playerStats[canonical].raidsAttended++;
          playerStats[canonical].onTimeCount++; // Bench raiders were ready on time
          playerStats[canonical].totalBossKillsAttended += session.allBossKills.length;
          presentBench.push(canonical);
        }
      });
    } else {
      // Optional / Alt / PUG Run: Credit boss kills to attendees, but DO NOT penalize absent raiders or increment official raid nights
      uniqueSessionMains.forEach(canonical => {
        playerStats[canonical].totalBossKillsAttended += session.allBossKills.length;
        presentOnTime.push(canonical);
      });
    }

    const titlePrefix = isOfficial ? '' : '📦 [Optional / PUG] ';
    raidLedger.push({
      dateKey: session.dateKey,
      date: session.formattedDate,
      title: titlePrefix + (session.reports[0].title || 'Guild Raid'),
      bossesDefeated: session.allBossKills.join(', '),
      killCount: session.allBossKills.length,
      rosterPresentCount: isOfficial ? (presentOnTime.length + presentLate.length + presentBench.length) : uniqueSessionMains.size,
      benchList: presentBench.length > 0 ? presentBench.join(', ') : (sessionBench.join(', ') || 'None'),
      presentOnTimeList: presentOnTime.join(', ') || 'None',
      presentLateList: isOfficial ? (presentLate.join(', ') || 'None') : 'N/A (Optional Run)',
      reports: session.reports,
      primaryCode: session.reports[0] ? session.reports[0].code : '',
      url: reportLinks.join(' | '),
      isOfficial: isOfficial
    });
  });

  const totalOfficialRaids = officialRaidCount;

  // 3. Build Leaderboard Data
  const leaderboard = Object.values(playerStats).map(p => {
    const attPct = totalOfficialRaids > 0 ? Math.round((p.raidsAttended / totalOfficialRaids) * 100) : 0;
    const onTimePct = p.raidsAttended > 0 ? Math.round((p.onTimeCount / p.raidsAttended) * 100) : 0;
    
    let reliabilityRating = '⭐⭐⭐⭐⭐ Punctual Core';
    if (attPct === 0) reliabilityRating = '⚠️ Inactive / Absent';
    else if (attPct < 60) reliabilityRating = '⚠️ Inconsistent';
    else if (attPct < 80) reliabilityRating = '⭐ Standby / Bench';
    else if (onTimePct < 80) reliabilityRating = '🟡 Frequent Tardy';
    else if (attPct < 90) reliabilityRating = '⭐⭐⭐⭐ Reliable';

    return {
      name: p.name,
      spec: p.spec,
      raidsAttended: p.raidsAttended,
      totalRaids: totalOfficialRaids,
      attendancePct: attPct,
      onTimePct: onTimePct,
      onTimeDisplay: p.raidsAttended > 0 ? `${onTimePct}%` : 'N/A',
      onTimeCount: p.onTimeCount,
      lateCount: p.lateCount,
      bossKills: p.totalBossKillsAttended,
      rating: reliabilityRating
    };
  }).sort((a, b) => b.attendancePct - a.attendancePct || b.onTimePct - a.onTimePct || b.bossKills - a.bossKills);

  // 4. Write onto "Attendance & History" sheet
  createAttendanceAndHistorySheet(leaderboard, raidLedger, totalOfficialRaids);

  // 5. Automatically refresh Loot & Chase Items sheet so all contenders receive live Attendance % badges!
  if (ss.getSheetByName(LOOT_SHEET_NAME)) {
    createLootAndChaseItemsSheet();
  }

  ui.alert(
    'Warcraft Logs Synced!',
    `Successfully merged logs into ${totalOfficialRaids} official raid nights (Tue/Wed Pacific Time).\n\nAll attendance %, on-time punctuality, bench credit, and boss kills have been updated on "Attendance & History" AND all badges refreshed on "Loot & Chase Items"!`,
    ui.ButtonSet.OK
  );
}

/**
 * Creates and formats the "Attendance & History" sheet with dark executive styling.
 */
function createAttendanceAndHistorySheet(leaderboard, raidLedger, totalRaids) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ATTENDANCE_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ATTENDANCE_SHEET_NAME);
  }

  sheet.clear();
  sheet.clearFormats();
  sheet.clearConditionalFormatRules();

  const output = [];

  // 1. Executive Summary Banner
  output.push(['🏛️ GUILD RAID ATTENDANCE, PUNCTUALITY & SEASON 2 HISTORY', '', '', '', '', '', '', '', '', '']);
  output.push([
    `Total Official Guild Raid Nights: ${totalRaids} (Tue & Wed 7:00 - 10:00 PM Pacific)   |   Total Boss Encounters Defeated: ${raidLedger.reduce((sum, r) => sum + r.killCount, 0)}`,
    '', '', '', '', '', '', '', '', ''
  ]);
  output.push(['', '', '', '', '', '', '', '', '', '']);

  // 2. Section 1: Raider Season Attendance Leaderboard
  output.push(['👑 RAIDER ATTENDANCE & PUNCTUALITY LEADERBOARD', '═════════════════════', '', '', '', '', '', '', '', '']);
  output.push(['Rank', 'Raider Name', 'Assigned Spec', 'Attendance %', 'On-Time %', 'Raids Attended', 'Tardies', 'Total Boss Kills', 'Reliability Tier', '']);

  leaderboard.forEach((p, idx) => {
    output.push([
      idx + 1,
      p.name,
      p.spec || 'Main Spec',
      `${p.attendancePct}%`,
      p.onTimeDisplay,
      `${p.raidsAttended} / ${p.totalRaids}`,
      p.lateCount,
      p.bossKills,
      p.rating,
      ''
    ]);
  });

  output.push(['', '', '', '', '', '', '', '', '', '']);
  output.push(['', '', '', '', '', '', '', '', '', '']);

  // 3. Section 2: Historical Guild Raid Night Ledger
  output.push(['📜 HISTORICAL GUILD RAID NIGHT LEDGER', '═════════════════════', '', '', '', '', '', '', '', '']);
  output.push(['Raid Date', 'Raid Title', 'Bosses Defeated', 'Kills', 'Guild Raiders', '🪑 Bench / Standby (Credit Awarded)', 'On-Time Raiders', 'Late Arrivals', 'Warcraft Logs Link', '']);

  raidLedger.forEach(r => {
    // Generate clean, uniform clickable HYPERLINK formula for single or merged reports
    const reportCode = r.reports && r.reports.length > 0 ? r.reports[0].code : '';
    const linkFormula = reportCode ? `=HYPERLINK("https://www.warcraftlogs.com/reports/${reportCode}", "📊 View Log (${reportCode})")` : '-';

    output.push([
      r.date,
      r.title,
      r.bossesDefeated,
      r.killCount,
      r.rosterPresentCount,
      r.benchList || 'None',
      r.presentOnTimeList,
      r.presentLateList,
      linkFormula,
      ''
    ]);
  });

  sheet.getRange(1, 1, output.length, 10).setValues(output);

  // Formatting & Widths
  sheet.getDataRange().setFontFamily('Roboto');
  sheet.setFrozenRows(1);

  // Banner formatting
  sheet.getRange('A1:J1').merge().setBackground('#0f172a').setFontColor('#f8fafc').setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center');
  sheet.getRange('A2:J2').merge().setBackground('#1e293b').setFontColor('#94a3b8').setFontSize(9).setHorizontalAlignment('center');

  // Table Headers
  sheet.getRange('A4:J4').setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold').setFontSize(10);
  sheet.getRange('A5:J5').setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center');

  // Section 2: Historical Ledger Headers
  const ledgerTitleRow = leaderboard.length + 8;
  const ledgerHeaderRow = leaderboard.length + 9;
  sheet.getRange(ledgerTitleRow, 1, 1, 10).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold').setFontSize(10);
  sheet.getRange(ledgerHeaderRow, 1, 1, 10).setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center');

  // Alternating Row Colors for Ledger Data
  for (let rowIdx = 0; rowIdx < raidLedger.length; rowIdx++) {
    const targetRow = ledgerHeaderRow + 1 + rowIdx;
    const bgColor = rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
    sheet.getRange(targetRow, 1, 1, 10).setBackground(bgColor).setFontSize(9).setVerticalAlignment('middle');
    sheet.getRange(targetRow, 1).setHorizontalAlignment('center'); // Date
    sheet.getRange(targetRow, 4, 1, 2).setHorizontalAlignment('center'); // Kills, Guild Raiders
    sheet.getRange(targetRow, 9).setHorizontalAlignment('center'); // Link
  }

  // Column Widths
  sheet.setColumnWidth(1, 130); // Rank / Date
  sheet.setColumnWidth(2, 180); // Name / Title
  sheet.setColumnWidth(3, 260); // Spec / Bosses Defeated
  sheet.setColumnWidth(4, 90);  // Attendance % / Kills
  sheet.setColumnWidth(5, 90);  // On-Time % / Guild Raiders
  sheet.setColumnWidth(6, 220); // Raids Attended / Bench Raiders
  sheet.setColumnWidth(7, 180); // Tardies / On-Time List
  sheet.setColumnWidth(8, 120); // Late Arrivals
  sheet.setColumnWidth(9, 180); // WCL Link
  sheet.setColumnWidth(10, 160); // Reliability Tier

  // Attendance & On-Time Soft Conditional Formatting
  const rules = [];
  const attRange = [sheet.getRange(6, 4, leaderboard.length, 1)];
  const onTimeRange = [sheet.getRange(6, 5, leaderboard.length, 1)];

  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('100%').setBackground('#d1fae5').setFontColor('#065f46').setRanges([...attRange, ...onTimeRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('9').setBackground('#d1fae5').setFontColor('#065f46').setRanges([...attRange, ...onTimeRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('8').setBackground('#fef3c7').setFontColor('#92400e').setRanges([...attRange, ...onTimeRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('7').setBackground('#fef3c7').setFontColor('#92400e').setRanges([...attRange, ...onTimeRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('0%').setBackground('#fee2e2').setFontColor('#991b1b').setRanges([...attRange, ...onTimeRange]).build());
  sheet.setConditionalFormatRules(rules);
}

/**
 * Returns data needed by the Bench & Standby Raiders interactive modal dialog.
 */
function getBenchDialogData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = getConfigurationFromSheet();
  const scriptProperties = PropertiesService.getScriptProperties();
  const benchRecords = JSON.parse(scriptProperties.getProperty('bench_records') || '{}');

  const members = (config.MEMBERS_TO_TRACK || []).map(m => ({
    name: m.name,
    spec: m.expectedSpec || '',
    realm: m.realm || ''
  }));

  // Extract raid dates from Attendance & History sheet ledger if available
  const raidDates = [];
  const attSheet = ss.getSheetByName(ATTENDANCE_SHEET_NAME);
  if (attSheet && attSheet.getLastRow() >= 10) {
    const values = attSheet.getDataRange().getValues();
    let inLedger = false;
    for (let r = 0; r < values.length; r++) {
      const col0 = (values[r][0] || '').toString().trim();
      if (col0.includes('HISTORICAL GUILD RAID NIGHT LEDGER')) {
        inLedger = true;
        r += 1; // Skip header row
        continue;
      }
      if (inLedger && col0 && !col0.includes('Rank') && !col0.includes('═')) {
        const title = (values[r][1] || '').toString().trim();
        raidDates.push({
          dateStr: col0,
          title: title
        });
      }
    }
  }

  // If no dates on sheet yet, provide recent dates
  if (raidDates.length === 0) {
    const today = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date(today.getTime() - i * 86400000 * 3);
      const str = Utilities.formatDate(d, 'America/Los_Angeles', 'EEE, MMM d, yyyy');
      raidDates.push({ dateStr: str, title: 'Official Guild Raid' });
    }
  }

  return {
    raidDates: raidDates,
    members: members,
    benchRecords: benchRecords
  };
}

/**
 * Saves selected bench raiders for a specific raid night and refreshes attendance & loot sheets.
 */
function saveBenchRaiders(dateKey, selectedPlayerNames) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const benchRecords = JSON.parse(scriptProperties.getProperty('bench_records') || '{}');
  
  benchRecords[dateKey] = selectedPlayerNames || [];
  scriptProperties.setProperty('bench_records', JSON.stringify(benchRecords));

  // Automatically trigger WCL sync to recalculate leaderboard and loot scores
  syncWarcraftLogsSeasonAttendance();

  return {
    success: true,
    dateKey: dateKey,
    count: selectedPlayerNames.length
  };
}

/**
 * Displays the modern, interactive Mythic Bench & Standby Raiders checkbox dialog.
 */
function showBenchRaidersDialog() {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Roboto', sans-serif;
            background-color: #0f172a;
            color: #f8fafc;
            margin: 0;
            padding: 16px;
          }
          h3 {
            margin: 0 0 12px 0;
            color: #38bdf8;
            font-size: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .subtitle {
            font-size: 12px;
            color: #94a3b8;
            margin-bottom: 14px;
          }
          label {
            font-size: 12px;
            font-weight: 500;
            color: #cbd5e1;
            display: block;
            margin-bottom: 6px;
          }
          select, input[type="text"] {
            width: 100%;
            padding: 8px 10px;
            background: #1e293b;
            border: 1px solid #334155;
            color: #f8fafc;
            border-radius: 6px;
            font-size: 13px;
            box-sizing: border-box;
            margin-bottom: 12px;
          }
          .grid-container {
            max-height: 240px;
            overflow-y: auto;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 6px;
            padding: 10px;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }
          .member-card {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #0f172a;
            padding: 6px 8px;
            border-radius: 4px;
            border: 1px solid #334155;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .member-card:hover {
            border-color: #38bdf8;
          }
          .member-card input {
            cursor: pointer;
          }
          .member-name {
            font-size: 12px;
            font-weight: 500;
          }
          .member-spec {
            font-size: 10px;
            color: #94a3b8;
          }
          .actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 14px;
          }
          .quick-btn {
            background: none;
            border: 1px solid #475569;
            color: #94a3b8;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
          }
          .quick-btn:hover {
            color: #f8fafc;
            border-color: #94a3b8;
          }
          .btn-save {
            background: #10b981;
            color: #ffffff;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            transition: background 0.2s ease;
          }
          .btn-save:hover {
            background: #059669;
          }
          .btn-save:disabled {
            background: #475569;
            cursor: not-allowed;
          }
          #statusMsg {
            font-size: 11px;
            color: #34d399;
            margin-top: 8px;
            text-align: center;
            min-height: 16px;
          }
        </style>
      </head>
      <body>
        <h3>🪑 Mythic Bench & Standby Credit Manager</h3>
        <div class="subtitle">Select the raid night and check all raiders on standby in Discord to award them 100% attendance & punctuality credit.</div>

        <label for="dateSelect">Select Raid Night:</label>
        <select id="dateSelect" onchange="onDateChange()"></select>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <label style="margin:0;">Select Bench Raiders:</label>
          <div>
            <button class="quick-btn" onclick="toggleAll(true)">Select All</button>
            <button class="quick-btn" onclick="toggleAll(false)">Clear</button>
          </div>
        </div>

        <div class="grid-container" id="rosterContainer">
          <div style="color:#94a3b8; font-size:12px; grid-column:span 2;">Loading guild roster...</div>
        </div>

        <div id="statusMsg"></div>

        <div class="actions">
          <button class="quick-btn" onclick="google.script.host.close()">Cancel</button>
          <button class="btn-save" id="btnSave" onclick="saveBench()">💾 Save & Award Bench Credit</button>
        </div>

        <script>
          let dialogData = null;

          function init() {
            google.script.run
              .withSuccessHandler(function(data) {
                dialogData = data;
                populateDates();
                populateRoster();
              })
              .withFailureHandler(function(err) {
                document.getElementById('statusMsg').innerText = 'Error loading data: ' + err.message;
              })
              .getBenchDialogData();
          }

          function populateDates() {
            const select = document.getElementById('dateSelect');
            select.innerHTML = '';
            dialogData.raidDates.forEach(function(d) {
              const opt = document.createElement('option');
              opt.value = d.dateStr;
              opt.innerText = d.dateStr + ' (' + d.title + ')';
              select.appendChild(opt);
            });
            onDateChange();
          }

          function populateRoster() {
            const container = document.getElementById('rosterContainer');
            container.innerHTML = '';
            const selectedDate = document.getElementById('dateSelect').value;
            const currentBench = (dialogData.benchRecords && dialogData.benchRecords[selectedDate]) || [];

            dialogData.members.forEach(function(m) {
              const isChecked = currentBench.includes(m.name);
              const card = document.createElement('label');
              card.className = 'member-card';
              card.innerHTML = 
                '<input type="checkbox" value="' + m.name + '" ' + (isChecked ? 'checked' : '') + '> ' +
                '<div>' +
                  '<div class="member-name">' + m.name + '</div>' +
                  '<div class="member-spec">' + (m.spec || 'Main Spec') + '</div>' +
                '</div>';
              container.appendChild(card);
            });
          }

          function onDateChange() {
            if (!dialogData) return;
            populateRoster();
          }

          function toggleAll(check) {
            const checkboxes = document.querySelectorAll('#rosterContainer input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = check);
          }

          function saveBench() {
            const btn = document.getElementById('btnSave');
            const status = document.getElementById('statusMsg');
            const dateVal = document.getElementById('dateSelect').value;
            
            const selected = [];
            const checkboxes = document.querySelectorAll('#rosterContainer input[type="checkbox"]:checked');
            checkboxes.forEach(cb => selected.push(cb.value));

            btn.disabled = true;
            btn.innerText = '⏳ Syncing Attendance...';
            status.style.color = '#38bdf8';
            status.innerText = 'Saving bench credit and recalculating attendance scores...';

            google.script.run
              .withSuccessHandler(function(res) {
                status.style.color = '#34d399';
                status.innerText = '✅ Successfully awarded bench credit to ' + res.count + ' raiders!';
                setTimeout(function() {
                  google.script.host.close();
                }, 1500);
              })
              .withFailureHandler(function(err) {
                btn.disabled = false;
                btn.innerText = '💾 Save & Award Bench Credit';
                status.style.color = '#f87171';
                status.innerText = '❌ Error: ' + err.message;
              })
              .saveBenchRaiders(dateVal, selected);
          }

          window.onload = init;
        </script>
      </body>
    </html>
  `;

  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(520)
    .setHeight(480);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '🪑 Mythic Bench & Standby Credit Manager');
}

