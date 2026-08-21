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
// --- END CONFIGURATION ---

function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Guild Audit')
      .addItem('1. Set API Credentials', 'promptForCredentials')
      .addItem('2. Create Config Sheet', 'createConfigSheet')
      .addSeparator()
      .addItem('3. Run Full Audit & Talents', 'updateAllCharacterDataWithBonuses')
      .addItem('4. Create/Refresh Loot & Chase Items Sheet', 'createLootAndChaseItemsSheet')
      .addItem('5. Import Raidbots Droptimizer Sim', 'promptAndImportRaidbotsDroptimizer')
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

/**
 * Applies Google Sheets interactive dropdown validation for WoW specs on the Config sheet.
 */
function applyConfigDropdowns(sheet) {
  if (!sheet) return;
  const specRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(ALL_WOW_SPECS, true)
    .setAllowInvalid(true)
    .build();

  // Apply dropdown to Column B for character rows
  sheet.getRange('B7:B50').setDataValidation(specRule);
  sheet.getRange('B52:B100').setDataValidation(specRule);

  // Set generous column widths
  sheet.setColumnWidth(1, 190); // Main Character Name
  sheet.setColumnWidth(2, 240); // Assigned Raid Spec (Dropdown)
  sheet.setColumnWidth(3, 160); // Realm
  sheet.setColumnWidth(4, 280); // Vault Reference
  sheet.setColumnWidth(5, 90);  // Vault ilvl
  sheet.setColumnWidth(6, 110); // Track
}

function createConfigSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Config');
  if (sheet) {
    applyConfigDropdowns(sheet);
    SpreadsheetApp.getUi().alert('The "Config" sheet already exists. Interactive spec dropdowns have been refreshed!');
    return;
  }
  sheet = ss.insertSheet('Config', 0);
  const setupData = [
      ['Configuration', 'Value', '', 'Midnight S2 Great Vault Reference (12.1)', 'Vault ilvl', 'Track'],
      ['Region', 'us', '', 'Raid Mythic (Most)', 334, 'Myth'],
      ['Realm Slug', 'kiljaeden', '', 'Raid Heroic', 318, 'Hero'],
      ['Guild Slug', 'prey', '', 'Raid Normal', 305, 'Hero'],
      ['', '', '', 'Raid LFR', 292, 'Champion'],
      ['Main Character Name', 'Assigned Raid Spec (Dropdown)', 'Realm (If different)', 'Mythic+ 10+', 318, 'Hero'],
      ['Jevo', 'Protection', '', 'Mythic+ 7-9', 315, 'Hero'],
      ['Lyci', 'Balance', '', 'Mythic+ 6', 311, 'Hero'],
      ['Aemonnd', 'Unholy', '', 'Mythic+ 4-5', 308, 'Hero'],
      ['', '', '', 'Mythic+ 2-3 / Delves T8-11', 305, 'Hero'],
      ['Alt Character Name', 'Assigned Raid Spec (Dropdown)', 'Realm (If different)', 'Mythic 0 / M0', 302, 'Champion'],
      ['Altcharone', '', '', '', '', ''],
      ['Altchartwo', '', '', '', '', '']
  ];
  sheet.getRange(1, 1, setupData.length, 6).setValues(setupData);
  sheet.getRange("A1:B1").merge().setHorizontalAlignment('center').setFontWeight('bold').setBackground('#202124').setFontColor('#ffffff');
  sheet.getRange("A2:A4").setFontWeight('bold');
  sheet.getRange("A6:C6").setFontWeight('bold').setBackground('#e8eaed').setHorizontalAlignment('center');
  sheet.getRange("A11:C11").setFontWeight('bold').setBackground('#e8eaed').setHorizontalAlignment('center');
  
  // Reference Table Header Formatting
  sheet.getRange("D1:F1").setFontWeight('bold').setBackground('#202124').setFontColor('#ffffff').setHorizontalAlignment('center');
  sheet.getRange("D2:F11").setHorizontalAlignment('center');
  sheet.autoResizeColumns(1, 6);
  
  applyConfigDropdowns(sheet);
  SpreadsheetApp.getUi().alert('"Config" sheet created with Midnight Season 2 (Patch 12.1) Great Vault reference.');
}

function getConfigurationFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('Config');
  if (!configSheet) {
    SpreadsheetApp.getUi().alert('Configuration sheet not found!', 'Please create a sheet named "Config" using the "Guild Audit > Create Config Sheet" menu.', SpreadsheetApp.getUi().ButtonSet.OK);
    return null;
  }

  // Ensure dropdown rules are always present
  applyConfigDropdowns(configSheet);

  const region = configSheet.getRange('B2').getValue().toString().trim().toLowerCase();
  const realmSlug = configSheet.getRange('B3').getValue().toString().trim().toLowerCase();
  const guildSlug = configSheet.getRange('B4').getValue().toString().trim().toLowerCase();

  const data = configSheet.getDataRange().getValues();
  const members = [];
  const alts = [];
  let readingMains = false;
  let readingAlts = false;

  for (const row of data) {
      const header = row[0].toString().toLowerCase().trim();
      if (header.includes('main character')) {
          readingMains = true;
          readingAlts = false;
          continue;
      } else if (header.includes('alt character') || header.includes('alts to track')) {
          readingMains = false;
          readingAlts = true;
          continue;
      }

      if (readingMains && row[0]) {
          members.push({
            name: row[0].toString().trim(),
            expectedSpec: row[1] ? row[1].toString().trim() : '',
            realm: row[2] ? row[2].toString().trim() : ''
          });
      } else if (readingAlts && row[0]) {
          alts.push({
            name: row[0].toString().trim(),
            expectedSpec: row[1] ? row[1].toString().trim() : '',
            realm: row[2] ? row[2].toString().trim() : ''
          });
      }

      if ((readingMains || readingAlts) && !row[0]) {
          readingMains = false;
          readingAlts = false;
      }
  }

  if (!region || !realmSlug || !guildSlug || members.length === 0) {
    SpreadsheetApp.getUi().alert('Configuration Incomplete', 'Please make sure Region, Realm, Guild, and at least one Main Character are filled out in the "Config" sheet.', SpreadsheetApp.getUi().ButtonSet.OK);
    return null;
  }

  return {
    REGION: region,
    GUILD_REALM_SLUG: realmSlug,
    GUILD_NAME_SLUG: guildSlug,
    MEMBERS_TO_TRACK: members,
    ALTS_TO_TRACK: alts
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

  // --- PASS 1: Batch fetch all Blizzard API payloads in parallel ---
  const requests = [];
  filteredRoster.forEach(char => {
    const realm = char.realmSlug || config.GUILD_REALM_SLUG;
    const name = char.name.toLowerCase();
    const region = config.REGION || 'us';
    const baseUrl = `https://${region}.api.blizzard.com/profile/wow/character/${realm}/${name}`;

    requests.push({ url: `${baseUrl}?namespace=profile-${region}&locale=en_US`, headers: { 'Authorization': `Bearer ${token}` }, muteHttpExceptions: true });
    requests.push({ url: `${baseUrl}/equipment?namespace=profile-${region}&locale=en_US`, headers: { 'Authorization': `Bearer ${token}` }, muteHttpExceptions: true });
    requests.push({ url: `${baseUrl}/reputations?namespace=profile-${region}&locale=en_US`, headers: { 'Authorization': `Bearer ${token}` }, muteHttpExceptions: true });
    requests.push({ url: `${baseUrl}/mythic-keystone-profile?namespace=profile-${region}&locale=en_US`, headers: { 'Authorization': `Bearer ${token}` }, muteHttpExceptions: true });
    requests.push({ url: `${baseUrl}/encounters/raids?namespace=profile-${region}&locale=en_US`, headers: { 'Authorization': `Bearer ${token}` }, muteHttpExceptions: true });
    requests.push({ url: `${baseUrl}/specializations?namespace=profile-${region}&locale=en_US`, headers: { 'Authorization': `Bearer ${token}` }, muteHttpExceptions: true });
  });

  const responses = UrlFetchApp.fetchAll(requests);
  const batchedPayloads = [];

  for (let i = 0; i < filteredRoster.length; i++) {
    const char = filteredRoster[i];
    const offset = i * 6;

    const profileResp = responses[offset];
    const equipResp = responses[offset + 1];
    const repResp = responses[offset + 2];
    const mplusResp = responses[offset + 3];
    const raidResp = responses[offset + 4];
    const specResp = responses[offset + 5];

    batchedPayloads.push({
      character: char,
      profileData: (profileResp && profileResp.getResponseCode() === 200) ? JSON.parse(profileResp.getContentText()) : null,
      equipmentData: (equipResp && equipResp.getResponseCode() === 200) ? JSON.parse(equipResp.getContentText()) : null,
      reputationsData: (repResp && repResp.getResponseCode() === 200) ? JSON.parse(repResp.getContentText()) : null,
      mplusData: (mplusResp && mplusResp.getResponseCode() === 200) ? JSON.parse(mplusResp.getContentText()) : null,
      raidData: (raidResp && raidResp.getResponseCode() === 200) ? JSON.parse(raidResp.getContentText()) : null,
      specializationsData: (specResp && specResp.getResponseCode() === 200) ? JSON.parse(specResp.getContentText()) : null
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
    const { character, profileData, equipmentData, reputationsData, mplusData, raidData, specializationsData } = item;
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

        // Mythic+ Vault Slots
        if (mplusData.current_period.best_runs) {
          const sortedRuns = mplusData.current_period.best_runs.sort((a, b) => b.keystone_level - a.keystone_level);
          if (sortedRuns.length >= 1) charRow['GV M+ 1'] = VAULT_MAPPING.mplus[sortedRuns[0].keystone_level] || '-';
          if (sortedRuns.length >= 4) charRow['GV M+ 2'] = VAULT_MAPPING.mplus[sortedRuns[3].keystone_level] || '-';
          if (sortedRuns.length >= 8) charRow['GV M+ 3'] = VAULT_MAPPING.mplus[sortedRuns[7].keystone_level] || '-';
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
    list.push(charObj);
  });
  return list;
}

/**
 * Creates and formats the Loot & Chase Items reference sheet.
 * Features the current Season 2 raid: The Venomous Abyss (8 Bosses) with distinct boss separator banners.
 * Automatically calculates upgrade deltas against live equipped gear if character data is provided.
 */
function createLootAndChaseItemsSheet(mainCharacterData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LOOT_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LOOT_SHEET_NAME);
  }

  const lootHeaders = [
    'Boss / Source', 'Chase Item / Drop', 'Slot', 'Difficulty', 'Drop ilvl',
    'Target Specs / Roles', 'Top Contender (Assigned)', 'Current Equipped Item',
    'Equipped ilvl', 'Upgrade Delta (+ilvl / %DPS)', 'Priority / BiS Tier', 
    'Sim Status / Last Updated', 'Loot Council Notes'
  ];

  const chaseItemsCatalog = [
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

    // ════════════════════════════════════════════════════════════
    // 🏛️ BOSS 7: THE COILED ALTAR
    // ════════════════════════════════════════════════════════════
    ['🏛️ BOSS 7: THE COILED ALTAR', '═════════════════════════════════', '', '', '', '', '', '', '', '', '', '', ''],
    ['Boss 7: The Coiled Altar', 'Maze-roa, Warlord\'s Fury', 'Main Hand', 'Heroic', 318, '2H Strength (War, Pal, DK)', '', '', '', '', 'Heroic 2H Axe', '⚡ Live Armory ilvl', 'Top 2H Axe with shadow cleave (ID: 268213)'],
    ['Boss 7: The Coiled Altar', 'Zul\'jin\'s Guillotine Technique', 'Trinket 2', 'Heroic', 318, 'All Roles', '', '', '', '', 'Major Trinket', '⚡ Live Armory ilvl', 'Special execution burst trinket (ID: 270173)'],
    ['Boss 7: The Coiled Altar', 'Reckless Spirit Breastplate', 'Chest', 'Heroic', 318, 'Plate Chest', '', '', '', '', 'Plate Chest', '⚡ Live Armory ilvl', 'Plate chest with crit/haste (ID: 268222)'],
    ['Boss 7: The Coiled Altar', 'Girdle of Toxic Regret', 'Waist', 'Heroic', 318, 'Plate Waist', '', '', '', '', 'Plate Belt', '⚡ Live Armory ilvl', 'Plate belt with haste/crit (ID: 268259)'],
    ['Boss 7: The Coiled Altar', 'Coiled Hex Legguards', 'Legs', 'Heroic', 318, 'Mail Legs', '', '', '', '', 'Mail Legs', '⚡ Live Armory ilvl', 'Mastery/Crit mail legs'],

    // ════════════════════════════════════════════════════════════
    // 👑 BOSS 8: ULA'TEK (FINAL BOSS)
    // ════════════════════════════════════════════════════════════
    ['👑 BOSS 8: ULA\'TEK (FINAL BOSS)', '═════════════════════════════════', '', '', '', '', '', '', '', '', '', '', ''],
    ['Boss 8: Ula\'tek', 'Slumbering Coil Curio', 'Chest', 'Heroic', 318, 'All Classes (Universal Tier)', '', '', '', '', 'Universal Tier Curio', '⚡ Live Armory ilvl', 'Universal Tier Token exchangeable for ANY slot'],
    ['Boss 8: Ula\'tek', 'Voracious Heart of Ula\'tek', 'Trinket 1', 'Heroic', 318, 'All DPS / Tanks', '', '', '', '', 'God-Tier Trinket', '⚡ Live Armory ilvl', 'Top execute burst trinket in the game (ID: 270175)'],
    ['Boss 8: Ula\'tek', 'Font of Venomous Rage', 'Trinket 2', 'Heroic', 318, 'All Roles', '', '', '', '', 'God-Tier Trinket', '⚡ Live Armory ilvl', 'Primary stat surge and attack speed aura (ID: 270168)'],
    ['Boss 8: Ula\'tek', 'Aqirbane Reliquary', 'Neck', 'Heroic', 318, 'All Roles', '', '', '', '', 'Very Rare BiS', '⚡ Live Armory ilvl', 'Special void altar proc neck/trinket (ID: 268265)'],
    ['Boss 8: Ula\'tek', 'Chausses of Unbound Rancor', 'Legs', 'Heroic', 318, 'Plate Legs', '', '', '', '', 'Heroic Legs', '⚡ Live Armory ilvl', 'Plate legs with crit/mastery (ID: 271878)'],

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
    } else {
      currentSlotText = charObj[slot] || '-';
    }
    return { text: currentSlotText, ilvl: extractIlvl(currentSlotText) };
  };

  // If mainCharacterData wasn't passed directly, load character gear from the "Guild Audit" sheet!
  if (!mainCharacterData || mainCharacterData.length === 0) {
    mainCharacterData = getGuildAuditCharacterList(ss);
  }

  // Check if sheet exists and read existing sim data map to prioritize sims over raw ilvl
  const existingSimData = {};
  if (sheet.getLastRow() > 1) {
    const existingValues = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    existingValues.forEach(row => {
      const itemName = (row[1] || '').toString().toLowerCase().trim();
      const topContender = (row[6] || '').toString();
      const currentEquipped = (row[7] || '').toString();
      const equippedIlvl = row[8];
      const upgradeDelta = (row[9] || '').toString();
      const simStatus = (row[11] || '').toString();
      const notes = (row[12] || '').toString();

      // If this item was previously simmed with Raidbots
      if (notes.includes('Raidbots Sim Upgrades:') || upgradeDelta.includes('% DPS') || simStatus.includes('Simmed')) {
        existingSimData[itemName] = {
          topContender: topContender,
          currentEquipped: currentEquipped,
          equippedIlvl: equippedIlvl,
          upgradeDelta: upgradeDelta,
          simStatus: simStatus || '✅ Simmed',
          notes: notes
        };
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

      const cleanItemName = (row[1] || '').toString().toLowerCase().trim();
      const slot = row[2];
      const dropIlvl = Number(row[4]) || 318;
      const targetRole = (row[5] || '').toLowerCase();
      const baseNotes = row[12];

      // 1. PRIORITIZE SIMS: If item already has Raidbots Sim data, preserve the % DPS sim priority!
      if (existingSimData[cleanItemName]) {
        row[6] = existingSimData[cleanItemName].topContender;
        row[9] = existingSimData[cleanItemName].upgradeDelta;
        row[11] = existingSimData[cleanItemName].simStatus;
        row[12] = existingSimData[cleanItemName].notes;

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

      // 2. FALLBACK: For unsimmed items, calculate Live Equipped ilvl Delta
      const contenders = [];

      mainCharacterData.forEach(char => {
        if (!char['Name']) return;
        const charSpec = (char['Spec'] || '').toLowerCase();

        // Check if character matches item targeting
        let isEligible = true;
        if (targetRole.includes('tank') && !targetRole.includes('all')) {
          const isTank = ['protection', 'blood', 'guardian', 'brewmaster', 'vengeance'].some(t => charSpec.includes(t));
          if (!isTank) isEligible = false;
        } else if (targetRole.includes('healer') && !targetRole.includes('dps') && !targetRole.includes('all')) {
          const isHealer = ['restoration', 'holy', 'discipline', 'mistweaver', 'preservation'].some(h => charSpec.includes(h));
          if (!isHealer) isEligible = false;
        }

        if (isEligible) {
          const eq = resolveEquippedItemForChar(char, slot);
          if (eq.ilvl > 0) {
            const delta = dropIlvl - eq.ilvl;
            contenders.push({
              name: char['Name'],
              delta: delta,
              equippedText: eq.text,
              equippedIlvl: eq.ilvl
            });
          }
        }
      });

      // Sort by largest upgrade delta
      contenders.sort((a, b) => b.delta - a.delta);

      if (contenders.length > 0) {
        const top = contenders[0];
        row[6] = `${top.name} (+${top.delta})`;
        row[7] = top.equippedText;
        row[8] = top.equippedIlvl;
        row[9] = `+${top.delta}`;
        row[11] = '⚡ Live Armory ilvl';

        // Top 3 list in Notes
        const top3List = contenders.slice(0, 3).map((c, i) => `${i + 1}. ${c.name} (+${c.delta})`).join(' | ');
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

  // Sim Status Column Conditional Formatting
  const simStatusColIdx = lootHeaders.indexOf('Sim Status / Last Updated') + 1;
  const simStatusRange = [sheet.getRange(2, simStatusColIdx, sheet.getMaxRows(), 1)];
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('✅').setBackground('#d1fae5').setFontColor('#065f46').setRanges(simStatusRange).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('⚠️').setBackground('#fef3c7').setFontColor('#92400e').setRanges(simStatusRange).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('⚡').setBackground('#f1f5f9').setFontColor('#475569').setRanges(simStatusRange).build());

  sheet.setConditionalFormatRules(rules);

  // Style Boss Separator Rows with distinctive Dark Slate / Indigo Banners
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

  // Set widths
  sheet.setColumnWidth(1, 240); // Boss
  sheet.setColumnWidth(2, 260); // Item Name
  sheet.setColumnWidth(3, 110); // Slot
  sheet.setColumnWidth(4, 100); // Difficulty
  sheet.setColumnWidth(5, 85);  // Drop ilvl
  sheet.setColumnWidth(6, 280); // Target Specs
  sheet.setColumnWidth(7, 190); // Top Contender
  sheet.setColumnWidth(8, 320); // Equipped Item
  sheet.setColumnWidth(9, 100); // Equipped ilvl
  sheet.setColumnWidth(10, 150);// Upgrade Delta
  sheet.setColumnWidth(11, 180);// Priority / BiS Tier
  sheet.setColumnWidth(12, 200);// Sim Status / Last Updated
  sheet.setColumnWidth(13, 550);// Notes
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

/**
 * Checks if a catalog item matches a Raidbots sim item name.
 */
function isItemNameMatch(sheetItem, simItem) {
  const cSheet = cleanItemNameForMatching(sheetItem);
  const cSim = cleanItemNameForMatching(simItem);
  if (!cSheet || !cSim) return false;
  if (cSheet === cSim) return true;
  if (cSheet.includes(cSim) || cSim.includes(cSheet)) return true;

  const sheetWords = cSheet.split(' ').filter(w => w.length >= 3);
  const simWords = cSim.split(' ').filter(w => w.length >= 3);
  const commonWords = sheetWords.filter(w => simWords.includes(w));
  return commonWords.length >= 2 || (sheetWords.length === 1 && commonWords.length === 1);
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

  simDataList.forEach(simData => {
    if (!simData) return;

    // 1. Build Item ID to Name & Slot dictionary from simbot.meta.itemLibrary
    const itemMap = {};
    const slotMap = {};
    const sourceMap = {};
    const encounters = {};

    if (simData.simbot && simData.simbot.meta && simData.simbot.meta.instanceLibrary) {
      simData.simbot.meta.instanceLibrary.forEach(inst => {
        if (inst.encounters) {
          inst.encounters.forEach(enc => {
            encounters[enc.id] = enc.name;
          });
        }
      });
    }

    if (simData.simbot && simData.simbot.meta && simData.simbot.meta.itemLibrary) {
      simData.simbot.meta.itemLibrary.forEach(it => {
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
      });
    }

    let playerName = 'Unknown';
    if (simData.simbot && simData.simbot.player) {
      playerName = simData.simbot.player;
    } else if (simData.sim && simData.sim.players && simData.sim.players[0] && simData.sim.players[0].name) {
      playerName = simData.sim.players[0].name;
    }
    if (!processedPlayers.includes(playerName)) processedPlayers.push(playerName);

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

  const extractIlvl = (slotText) => {
    if (!slotText || slotText === '-') return 0;
    const match = slotText.match(/(?:\[.*?\]\s*)?(\d{2,3})/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // Re-write merged rankings onto the sheet
  let totalMatches = 0;
  values.forEach(row => {
    const sheetItemName = (row[1] || '').toString().trim();
    if (itemUpgradeMap[sheetItemName] && itemUpgradeMap[sheetItemName].length > 0) {
      const contenders = itemUpgradeMap[sheetItemName].sort((a, b) => b.pct - a.pct);
      const top = contenders[0];
      row[6] = `${top.name} (+${top.pct}%)`;
      row[9] = `+${top.pct}% DPS`;
      row[11] = simStatusBadge;

      const topList = contenders.slice(0, 5).map((c, i) => `${i + 1}. ${c.name} (+${c.pct}%)`).join(' | ');
      row[12] = `Raidbots Sim Upgrades: ${topList}`;

      // Populate live equipped item and ilvl for the top contender!
      const topChar = charMap[top.name.toLowerCase()];
      if (topChar) {
        const slot = row[2] || '';
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
        } else {
          currentSlotText = topChar[slot] || '-';
        }
        row[7] = currentSlotText;
        row[8] = extractIlvl(currentSlotText) || '-';
      }

      totalMatches++;
    }
  });

  // Save back all updated and newly registered items
  sheet.getRange(2, 1, values.length, sheet.getLastColumn()).setValues(values);

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
 * Google Apps Script Web App POST Endpoint
 * Receives webhook calls from the Discord Bot when raiders paste sim links.
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
        message: 'No Raidbots URL or report ID found in request body.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const result = processAndIngestRaidbotsSims(simInput);
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
    service: 'WoW Raid Team Audit Sim Webhook',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
