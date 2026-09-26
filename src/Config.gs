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

/**
 * Index (0-based) of a legacy stacked-alt header in column A, or -1 when the sheet uses the
 * current side-by-side layout. Rows 9-45 of column A are the mains table, so a stacked alt
 * block can only be identified by its own header row.
 */
function findLegacyAltHeaderRow(data) {
  for (let r = 8; r < data.length; r++) {
    const label = (data[r][0] || '').toString().trim().toLowerCase();
    if (label.includes('alt character') || label.includes('alts to track')) return r;
  }
  return -1;
}

/**
 * Applies Google Sheets interactive dropdown validation for WoW specs, Roster Roles, Main Character Owners, Times, Time Zones, and Checkboxes on Config.
 * Formats Main Characters (Cols A-D) and Alt Characters (Cols F-I) side-by-side for a clean executive layout.
 */
function applyConfigDropdowns(sheet) {
  if (!sheet) return;

  sheet.setHiddenGridlines(true);
  applyTabColor(sheet);

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
  // Optional per-raider eligibility date. Left blank, attendance infers it from the raider's first
  // night in the Attendance Archive; filled in, this wins.
  sheet.getRange('E8').setValue('Joined (optional)').setFontWeight('bold').setBackground('#1e293b').setFontColor('#f8fafc').setHorizontalAlignment('center');
  sheet.getRange('E9:E45').setHorizontalAlignment('center').setFontSize(9).setFontColor('#475569');

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
  sheet.setColumnWidth(5, 120); // Joined (optional, mains) / Spacing Divider
  sheet.setColumnWidth(6, 180); // Alt Character Name / Tuesday / Friday
  sheet.setColumnWidth(7, 230); // Main Character (Owner - Dropdown) / Wednesday / Saturday
  sheet.setColumnWidth(8, 210); // Assigned Spec (Alts) / Thursday / Sunday
  sheet.setColumnWidth(9, 170); // Realm (Alts) / Monday

  // Auto-migrate legacy stacked Alts to side-by-side columns F-I if detected.
  // Only rows BELOW a legacy 'Alt Character'/'Alts to Track' header in column A are alts. Column A rows
  // 9-45 are the mains table, so without this guard a main added low in the list gets moved to the alts.
  const legacyAltHeaderRow = findLegacyAltHeaderRow(data);
  for (let r = legacyAltHeaderRow + 1; legacyAltHeaderRow >= 0 && r < data.length; r++) {
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
    notifyUser('Configuration sheet not found!', 'Please create a sheet named "Config" using the "Guild Audit > Create Config Sheet" menu.', true);
    return null;
  }

  // Dropdown/format refresh (applyConfigDropdowns) runs from Create Config Sheet and the Full Audit, not on
  // every config read: its interleaved cell writes/reads were slow enough to time out the WCL sync.

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
        realm: parsedRealm || (data[r][3] ? data[r][3].toString().trim() : ''),
        joined: data[r][4] === undefined ? '' : data[r][4]
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

  // 3. Fallback: legacy stacked alt rows, only below their own header (column A rows 9-45 are mains)
  const legacyAltHeaderRow = findLegacyAltHeaderRow(data);
  for (let r = legacyAltHeaderRow + 1; legacyAltHeaderRow >= 0 && r < data.length; r++) {
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
    notifyUser('Configuration Incomplete', 'Please make sure Region, Realm, Guild, and at least one Main Character are filled out in the "Config" sheet.', true);
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
