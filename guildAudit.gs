const SHEET_NAME = 'Guild Audit'; 
const TALENTS_SHEET_NAME = 'Talents & Builds';
const LOOT_SHEET_NAME = 'Loot & Chase Items';

// --- VAULT & SEASON CONFIGURATION (Midnight Season 2 - Verified) ---
const VAULT_MAPPING = {
  raid: {
      mythic: 331,
      heroic: 318,
      normal: 305,
      lfr: 292
  },
  mplus: {
      20: 318, 19: 318, 18: 318, 17: 318, 16: 318, 15: 318, 14: 318,
      13: 318, 12: 318, 11: 318, 10: 318, // Caps at 318 (Myth 1/6) for +10 and above
      9: 315, 8: 315,                     // 315 (Hero 4/6)
      7: 312, 6: 312,                     // 312 (Hero 3/6)
      5: 308, 4: 308,                     // 308 (Hero 2/6)
      3: 305, 2: 305                      // 305 (Hero 1/6)
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
      .addToUi();
}

function createConfigSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName('Config')) {
    SpreadsheetApp.getUi().alert('The "Config" sheet already exists.');
    return;
  }
  const sheet = ss.insertSheet('Config', 0);
  const setupData = [
      ['Configuration', 'Value', '', 'Midnight S2 Great Vault Reference', 'Vault ilvl', 'Track'],
      ['Region', 'us', '', 'Raid Mythic (6/6)', 331, 'Mythic'],
      ['Realm Slug', 'kiljaeden', '', 'Raid Heroic (4/6)', 318, 'Hero'],
      ['Guild Slug', 'prey', '', 'Raid Normal (2/6)', 305, 'Champion'],
      ['', '', '', 'Raid LFR (2/4/6)', 292, 'Veteran'],
      ['Main Characters to Track', '', '', 'Mythic+ 10+', 318, 'Myth 1/6'],
      ['Jevo', '', '', 'Mythic+ 8-9', 315, 'Hero 4/6'],
      ['Lyci', '', '', 'Mythic+ 6-7', 312, 'Hero 3/6'],
      ['Aemonnd', '', '', 'Mythic+ 4-5', 308, 'Hero 2/6'],
      ['', '', '', 'Mythic+ 2-3', 305, 'Hero 1/6'],
      ['Alts to Track', '', '', 'World / Delves Tier 8', 305, 'Champion/Hero'],
      ['Altcharone', '', '', '', '', ''],
      ['Altchartwo', '', '', '', '', '']
  ];
  sheet.getRange(1, 1, setupData.length, 6).setValues(setupData);
  sheet.getRange("A1:B1").merge().setHorizontalAlignment('center').setFontWeight('bold').setBackground('#202124').setFontColor('#ffffff');
  sheet.getRange("A2:A4").setFontWeight('bold');
  sheet.getRange("A6").merge().setHorizontalAlignment('center').setFontWeight('bold').setBackground('#e8eaed');
  sheet.getRange("A11").merge().setHorizontalAlignment('center').setFontWeight('bold').setBackground('#e8eaed');
  
  // Reference Table Header Formatting
  sheet.getRange("D1:F1").setFontWeight('bold').setBackground('#202124').setFontColor('#ffffff').setHorizontalAlignment('center');
  sheet.getRange("D2:F10").setHorizontalAlignment('center');
  sheet.autoResizeColumns(1, 6);
  SpreadsheetApp.getUi().alert('"Config" sheet created with Midnight Season 2 Great Vault reference.');
}

function getConfigurationFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('Config');
  if (!configSheet) {
    SpreadsheetApp.getUi().alert('Configuration sheet not found!', 'Please create a sheet named "Config" using the "Guild Audit > Create Config Sheet" menu.', SpreadsheetApp.getUi().ButtonSet.OK);
    return null;
  }

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
      if (header.includes('main characters')) {
          readingMains = true;
          readingAlts = false;
          continue;
      } else if (header.includes('alts to track')) {
          readingMains = false;
          readingAlts = true;
          continue;
      }

      if (readingMains && row[0]) {
          members.push(row[0].toString().trim());
      } else if (readingAlts && row[0]) {
          alts.push(row[0].toString().trim());
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
 * Processes a list of characters and extracts all gear, vault, and audit data.
 */
function processCharacterSet(characterNames, guildRosterMembers, config, token, enchantAndGemData, bonusData) {
  const membersToTrackLower = characterNames.map(name => name.toLowerCase());
  const filteredRoster = guildRosterMembers
    .filter(m => membersToTrackLower.includes(m.character.name.toLowerCase()))
    .map(m => ({ name: m.character.name, realmSlug: m.character.realm.slug }));

  if (filteredRoster.length === 0) {
    return [];
  }

  Logger.log(`Batch fetching data for ${filteredRoster.length} characters...`);
  const batchedPayloads = fetchAllCharacterDataBatched(filteredRoster, config, token);
  const characterDataObjects = [];

  // --- PASS 1: Roster-Wide Discovery of Active Season Tier Set IDs ---
  // In WoW, all tier sets in a new season share a higher numerical ID range (within 15 of each other).
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
  for (const item of batchedPayloads) {
    const { character, profileData, equipmentData, reputationsData, mplusData, raidData, specializationsData } = item;
    const charName = character.name;

    let charRow = {
      'Name': charName,
      'Class': '',
      'Spec': '',
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

    let heroTreeName = '-';
    let talentCode = '-';
    let wowheadGuideLink = '-';

    if (specializationsData) {
      let activeSpecObj = null;
      if (specializationsData.specializations) {
        activeSpecObj = specializationsData.specializations.find(s => s.specialization && s.specialization.name === charRow['Spec']) || specializationsData.specializations[0];
      }
      if (activeSpecObj) {
        if (activeSpecObj.loadouts && activeSpecObj.loadouts.length > 0) {
          const activeLoadout = activeSpecObj.loadouts.find(l => l.is_active) || activeSpecObj.loadouts[0];
          if (activeLoadout) {
            talentCode = activeLoadout.selected_talent_loadout_code || '-';
            if (activeLoadout.selected_hero_talent_tree) {
              heroTreeName = activeLoadout.selected_hero_talent_tree.name || '-';
            }
          }
        }
      }
    }

    const classSlug = (charRow['Class'] || '').toLowerCase().replace(/\s+/g, '-');
    const specSlug = (charRow['Spec'] || '').toLowerCase().replace(/\s+/g, '-');
    if (classSlug && specSlug) {
      wowheadGuideLink = `https://www.wowhead.com/guide/classes/${classSlug}/${specSlug}/overview`;
    }

    charRow['Hero Talents'] = heroTreeName;
    charRow['Talent Code'] = talentCode;
    charRow['Guide Link'] = wowheadGuideLink;

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

  SpreadsheetApp.getUi().alert('Audit Complete!', `Successfully updated ${mainCharacterData.length} mains and ${altCharacterData.length} alts across Audit and Talents sheets.`, SpreadsheetApp.getUi().ButtonSet.OK);
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
  const headerRange = sheet.getRange(1, 1, 1, sheet.getMaxColumns());
  headerRange.setBackground('#202124').setFontColor('#ffffff').setFontWeight('bold');
  
  if (sheet.getMaxRows() > 1 && sheet.getMaxColumns() > 3) {
    sheet.getRange(2, 4, sheet.getMaxRows() - 1, sheet.getMaxColumns() - 3).setFontWeight("bold");
  }

  const rules = [];

  // 1. Class Colors for Name, Class, Spec (Consolidated multi-range rule)
  const nameColIndex = headers.indexOf('Name') + 1;
  const classColIndex = headers.indexOf('Class') + 1;
  const specColIndex = headers.indexOf('Spec') + 1;
  const classAndSpecRanges = [];
  if (nameColIndex > 0) classAndSpecRanges.push(sheet.getRange(2, nameColIndex, sheet.getMaxRows(), 1));
  if (classColIndex > 0) classAndSpecRanges.push(sheet.getRange(2, classColIndex, sheet.getMaxRows(), 1));
  if (specColIndex > 0) classAndSpecRanges.push(sheet.getRange(2, specColIndex, sheet.getMaxRows(), 1));

  if (classAndSpecRanges.length > 0) {
    for (const className in CLASS_COLORS) {
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(`=$B2="${className}"`)
        .setBackground(CLASS_COLORS[className])
        .setFontColor('#000000')
        .setRanges(classAndSpecRanges)
        .build());
    }
  }

  // 2. Raid Ready Column Rules
  const raidReadyColIdx = headers.indexOf('Raid Ready');
  if (raidReadyColIdx > -1) {
    const rrRange = [sheet.getRange(2, raidReadyColIdx + 1, sheet.getMaxRows(), 1)];
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("READY").setBackground("#34a853").setFontColor("#ffffff").setRanges(rrRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Missing").setBackground("#ea4335").setFontColor("#ffffff").setRanges(rrRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Socket").setBackground("#ea4335").setFontColor("#ffffff").setRanges(rrRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Tier").setBackground("#fbbc04").setFontColor("#000000").setRanges(rrRange).build());
  }

  // 3. Upgrade Tracks & Gear Slots (Multi-range consolidation: 7 rules instead of 112)
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
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Myth").setBackground("#ff8000").setFontColor("#000000").setRanges(gearRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Hero").setBackground("#a335ee").setFontColor("#ffffff").setRanges(gearRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Champion").setBackground("#0070dd").setFontColor("#ffffff").setRanges(gearRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Veteran").setBackground("#1eff00").setFontColor("#000000").setRanges(gearRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Explorer").setBackground("#9e9e9e").setFontColor("#ffffff").setRanges(gearRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Adventurer").setBackground("#9e9e9e").setFontColor("#ffffff").setRanges(gearRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Crafted").setBackground("#f28b82").setFontColor("#000000").setRanges(gearRanges).build());
  }

  // 4. Tier Set Progress Rules
  const tierSetColIdx = headers.indexOf('Tier Set');
  if (tierSetColIdx > -1) {
    const tsRange = [sheet.getRange(2, tierSetColIdx + 1, sheet.getMaxRows(), 1)];
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("5/5").setBackground("#34a853").setFontColor("#ffffff").setRanges(tsRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("4/5").setBackground("#34a853").setFontColor("#ffffff").setRanges(tsRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("3/5").setBackground("#fbbc04").setFontColor("#000000").setRanges(tsRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("2/5").setBackground("#fbbc04").setFontColor("#000000").setRanges(tsRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("1/5").setBackground("#ea4335").setFontColor("#ffffff").setRanges(tsRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("0/5").setBackground("#ea4335").setFontColor("#ffffff").setRanges(tsRange).build());
  }

  // 5. Empty Sockets & Imperfect Gems Rules
  const emptySocketsColIdx = headers.indexOf('Empty Sockets');
  if (emptySocketsColIdx > -1) {
    const esRange = [sheet.getRange(2, emptySocketsColIdx + 1, sheet.getMaxRows(), 1)];
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground("#ea4335").setFontColor("#ffffff").setRanges(esRange).build());
  }

  const imperfectGemsColIdx = headers.indexOf('Imperfect Gems');
  if (imperfectGemsColIdx > -1) {
    const igRange = [sheet.getRange(2, imperfectGemsColIdx + 1, sheet.getMaxRows(), 1)];
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground("#fbbc04").setFontColor("#000000").setRanges(igRange).build());
  }

  // 6. Enchants Rules (Multi-range consolidation: 5 rules instead of 45)
  const enchantCols = [
    'Enchant Main Hand', 'Enchant Off Hand', 'Enchant Head', 'Enchant Shoulder',
    'Enchant Chest', 'Enchant Legs', 'Enchant Feet', 'Enchant Ring 1', 'Enchant Ring 2'
  ];
  const enchantRanges = enchantCols
    .map(name => headers.indexOf(name) + 1)
    .filter(idx => idx > 0)
    .map(idx => sheet.getRange(2, idx, sheet.getMaxRows(), 1));

  if (enchantRanges.length > 0) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Tier2").setBackground("#34a853").setFontColor("#ffffff").setRanges(enchantRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Tier1").setBackground("#fbbc04").setFontColor("#000000").setRanges(enchantRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Rune of").setBackground("#34a853").setFontColor("#ffffff").setRanges(enchantRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("N/A").setBackground("#e0e0e0").setFontColor("#555555").setRanges(enchantRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Missing").setBackground("#ea4335").setFontColor("#ffffff").setRanges(enchantRanges).build());
  }
  
  // 7. Great Vault Styling & Borders
  const gvRaid1_idx = headers.indexOf('GV Raid 1') + 1;
  const gvRaid3_idx = headers.indexOf('GV Raid 3') + 1;
  const gvMplus1_idx = headers.indexOf('GV M+ 1') + 1;
  const gvMplus3_idx = headers.indexOf('GV M+ 3') + 1;
  const lastDataRow = sheet.getLastRow();
  const medium_border = SpreadsheetApp.BorderStyle.SOLID_MEDIUM;

  if (gvRaid1_idx > 0 && gvRaid3_idx > 0 && lastDataRow > 1) {
    sheet.getRange(1, gvRaid1_idx, lastDataRow, 3).setBorder(true, true, true, true, false, false, '#000000', medium_border);
  }

  if (gvMplus1_idx > 0 && gvMplus3_idx > 0 && lastDataRow > 1) {
    sheet.getRange(1, gvMplus1_idx, lastDataRow, 3).setBorder(true, true, true, true, false, false, '#000000', medium_border);
  }

  const gvRaidCols = ['GV Raid 1', 'GV Raid 2', 'GV Raid 3'];
  const gvRaidRanges = gvRaidCols
    .map(name => headers.indexOf(name) + 1)
    .filter(idx => idx > 0)
    .map(idx => sheet.getRange(2, idx, sheet.getMaxRows(), 1));

  if (gvRaidRanges.length > 0) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains(VAULT_MAPPING.raid.lfr.toString()).setBackground("#1eff00").setFontColor("#000000").setRanges(gvRaidRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains(VAULT_MAPPING.raid.normal.toString()).setBackground("#0070dd").setFontColor("#ffffff").setRanges(gvRaidRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains(VAULT_MAPPING.raid.heroic.toString()).setBackground("#a335ee").setFontColor("#ffffff").setRanges(gvRaidRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains(VAULT_MAPPING.raid.mythic.toString()).setBackground("#ff8000").setFontColor("#000000").setRanges(gvRaidRanges).build());
  }

  const gvMplusCols = ['GV M+ 1', 'GV M+ 2', 'GV M+ 3'];
  const gvMplusRanges = gvMplusCols
    .map(name => headers.indexOf(name) + 1)
    .filter(idx => idx > 0)
    .map(idx => sheet.getRange(2, idx, sheet.getMaxRows(), 1));

  if (gvMplusRanges.length > 0) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(331).setBackground("#ff8000").setFontColor("#000000").setRanges(gvMplusRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(312).setBackground("#a335ee").setFontColor("#ffffff").setRanges(gvMplusRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(299).setBackground("#0070dd").setFontColor("#ffffff").setRanges(gvMplusRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(292).setBackground("#1eff00").setFontColor("#000000").setRanges(gvMplusRanges).build());
  }

  // M+ Rating Color (Batch updated in 1 single call)
  const mPlusRatingColIdx = headers.indexOf('M+ Rating') + 1;
  if (mPlusRatingColIdx > 0 && characterDataObjects && characterDataObjects.length > 0) {
    const backgrounds = characterDataObjects.map(charData => [(charData && charData['M+ Rating Color']) ? charData['M+ Rating Color'] : '#ffffff']);
    const fontColors = characterDataObjects.map(() => ['#000000']);
    sheet.getRange(2, mPlusRatingColIdx, backgrounds.length, 1).setBackgrounds(backgrounds).setFontColors(fontColors);
  }

  sheet.setConditionalFormatRules(rules);

  // Set column widths directly (Fast 1-pass execution without getColumnWidth overhead)
  const minWidths = {
    'Name': 120, 'Class': 110, 'Spec': 120, 'iLvl': 65,
    'Raid Ready': 300, 'M+ Rating': 90, 'Tier Set': 120,
    'Total Sockets': 105, 'Empty Sockets': 105, 'Imperfect Gems': 115, 'Crafted Items': 105,
    'Embellishment 1': 170, 'Embellishment 2': 170,
    'Head': 290, 'Shoulders': 290, 'Chest': 290, 'Hands': 290, 'Legs': 290,
    'Main Hand': 290, 'Off Hand': 290, 'Trinket 1': 290, 'Trinket 2': 290,
    'Neck': 290, 'Back': 290, 'Wrist': 290, 'Waist': 290, 'Feet': 290,
    'Ring 1': 290, 'Ring 2': 290,
    'Enchant Main Hand': 170, 'Enchant Off Hand': 170, 'Enchant Head': 170, 'Enchant Shoulder': 170,
    'Enchant Chest': 170, 'Enchant Legs': 170, 'Enchant Feet': 170, 'Enchant Ring 1': 170, 'Enchant Ring 2': 170,
    'GV Slots Unlocked': 125, 'GV Raid 1': 95, 'GV Raid 2': 95, 'GV Raid 3': 95,
    'GV M+ 1': 95, 'GV M+ 2': 95, 'GV M+ 3': 95
  };

  headers.forEach((header, idx) => {
    sheet.setColumnWidth(idx + 1, minWidths[header] || 110);
  });
}

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
    'Talent Loadout Code (Import String)', 'Wowhead Raid Guide Link', 
    'iLvl', 'Raid Ready'
  ];

  const formatTalentRow = (obj) => {
    const guideFormula = (obj['Guide Link'] && obj['Guide Link'] !== '-') 
      ? `=HYPERLINK("${obj['Guide Link']}", "View ${obj['Spec'] || 'Spec'} Guide")`
      : '-';
    return [
      obj['Name'] || '',
      obj['Class'] || '',
      obj['Spec'] || '',
      obj['Hero Talents'] || '-',
      obj['Talent Code'] || '-',
      guideFormula,
      obj['iLvl'] || 0,
      obj['Raid Ready'] || '-'
    ];
  };

  const finalRows = [];
  finalRows.push(...mainCharacterData.map(formatTalentRow));

  if (altCharacterData && altCharacterData.length > 0) {
    finalRows.push(Array(talentHeaders.length).fill(''));
    finalRows.push(Array(talentHeaders.length).fill(''));
    finalRows.push(...altCharacterData.map(formatTalentRow));
  }

  const outputData = [talentHeaders, ...finalRows];
  sheet.clear();
  sheet.clearFormats();
  sheet.getRange(1, 1, outputData.length, outputData[0].length).setValues(outputData);

  // Formatting
  const fullRange = sheet.getDataRange();
  fullRange.setHorizontalAlignment('center');
  fullRange.setNumberFormat('@');
  sheet.setFrozenColumns(1);
  sheet.setFrozenRows(1);

  // Header styling
  const headerRange = sheet.getRange(1, 1, 1, sheet.getMaxColumns());
  headerRange.setBackground('#202124').setFontColor('#ffffff').setFontWeight('bold');

  // Bold data
  if (sheet.getMaxRows() > 1) {
    sheet.getRange(2, 1, sheet.getMaxRows() - 1, sheet.getMaxColumns()).setFontWeight('bold');
  }

  // Class colors for Name, Class, Spec
  const classAndSpecRanges = [
    sheet.getRange(2, 1, sheet.getMaxRows(), 1), // Name
    sheet.getRange(2, 2, sheet.getMaxRows(), 1), // Class
    sheet.getRange(2, 3, sheet.getMaxRows(), 1)  // Spec
  ];
  const rules = [];
  for (const className in CLASS_COLORS) {
    const rule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$B2="${className}"`)
      .setBackground(CLASS_COLORS[className])
      .setFontColor('#000000')
      .setRanges(classAndSpecRanges)
      .build();
    rules.push(rule);
  }

  // Raid Ready column formatting
  const raidReadyColIdx = talentHeaders.indexOf('Raid Ready') + 1;
  const rrRange = sheet.getRange(2, raidReadyColIdx, sheet.getMaxRows(), 1);
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('READY').setBackground('#34a853').setFontColor('#ffffff').setRanges([rrRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('Missing').setBackground('#ea4335').setFontColor('#ffffff').setRanges([rrRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('Tier').setBackground('#fbbc04').setFontColor('#000000').setRanges([rrRange]).build());

  sheet.setConditionalFormatRules(rules);

  // Set widths
  sheet.setColumnWidth(1, 130); // Name
  sheet.setColumnWidth(2, 110); // Class
  sheet.setColumnWidth(3, 130); // Spec
  sheet.setColumnWidth(4, 200); // Hero Talents
  sheet.setColumnWidth(5, 380); // Talent String
  sheet.setColumnWidth(6, 200); // Guide Link
  sheet.setColumnWidth(7, 80);  // ilvl
  sheet.setColumnWidth(8, 280); // Raid Ready
}

/**
 * Creates and formats the Loot & Chase Items reference sheet.
 */
function createLootAndChaseItemsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LOOT_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LOOT_SHEET_NAME);
  }

  const lootHeaders = [
    'Boss / Source', 'Chase Item / Drop', 'Slot', 'Difficulty', 'Drop ilvl',
    'Target Specs / Roles', 'Top Contender (Assigned)', 'Current Equipped Item',
    'Equipped ilvl', 'Upgrade Delta (+ilvl)', 'Priority / BiS Tier', 'Loot Council Notes'
  ];

  const chaseItemsCatalog = [
    // Boss 1
    ['Boss 1: Void Terror', 'Abyssal Swarmcaller', 'Trinket 1', 'Heroic', 318, 'Agility / Strength DPS', '', '', '', '', 'BiS S-Tier', 'Huge burst stat proc on pull'],
    ['Boss 1: Void Terror', 'Terror-Forged Greatsword', 'Main Hand', 'Heroic', 318, '2H Strength (DK, War, Pal)', '', '', '', '', 'Major Upgrade', 'High base weapon DPS'],
    ['Boss 1: Void Terror', 'Helm of Shattered Shadows', 'Head', 'Heroic', 318, 'All Classes (Tier Token)', '', '', '', '', 'Tier Helm', 'Unlocks tier 2pc/4pc'],
    
    // Boss 2
    ['Boss 2: Void Inquisitor', 'Gaze of the Dark Star', 'Trinket 1', 'Heroic', 318, 'Intellect DPS / Healers', '', '', '', '', 'BiS S-Tier', 'On-use spell power amp'],
    ['Boss 2: Void Inquisitor', 'Whispering Spire Staff', 'Main Hand', 'Heroic', 318, 'Intellect Casters', '', '', '', '', 'Major Upgrade', 'High Intellect stat stick'],
    ['Boss 2: Void Inquisitor', 'Pauldrons of the Accuser', 'Shoulders', 'Heroic', 318, 'All Classes (Tier Token)', '', '', '', '', 'Tier Shoulders', 'Unlocks tier 2pc/4pc'],

    // Boss 3
    ['Boss 3: Shadow Behemoth', 'Behemoth\'s Resilient Core', 'Trinket 1', 'Heroic', 318, 'Tanks (All)', '', '', '', '', 'Tank BiS', 'Cheat death / mega shield proc'],
    ['Boss 3: Shadow Behemoth', 'Chestguard of the Titan', 'Chest', 'Heroic', 318, 'All Classes (Tier Token)', '', '', '', '', 'Tier Chest', 'Major stat & tier chest slot'],
    
    // Boss 4
    ['Boss 4: Thalassian Council', 'Council\'s Signet of Command', 'Ring 1', 'Heroic', 318, 'All Specs (Rare Cantrip)', '', '', '', '', 'Rare Ring Proc', 'Cantrip secondary stat burst proc'],
    ['Boss 4: Thalassian Council', 'Gauntlets of Ancient Duty', 'Hands', 'Heroic', 318, 'All Classes (Tier Token)', '', '', '', '', 'Tier Gloves', 'Tier slot token'],

    // Boss 5
    ['Boss 5: Sunwell Abomination', 'Solar-Corrupted Core', 'Trinket 2', 'Heroic', 318, 'All DPS / Healers', '', '', '', '', 'BiS A-Tier', 'Stacking haste / mastery aura'],
    ['Boss 5: Sunwell Abomination', 'Leggings of Sundered Light', 'Legs', 'Heroic', 318, 'All Classes (Tier Token)', '', '', '', '', 'Tier Legs', 'Tier slot token'],

    // Boss 6
    ['Boss 6: Midnight Vanguard', 'Vanguard\'s Bulwark', 'Off Hand', 'Heroic', 318, 'Prot Pal, Prot War, Resto/Ele Sham', '', '', '', '', 'Shield BiS', 'Block rating & mastery proc'],
    ['Boss 6: Midnight Vanguard', 'Shadow-Etched Dagger', 'Main Hand', 'Heroic', 318, 'Rogues, DH, Agi Casters', '', '', '', '', 'Major Weapon', 'Fast attack speed stat dagger'],

    // Boss 7
    ['Boss 7: Void Ascendant', 'Heart of the Ascendant', 'Trinket 1', 'Heroic', 318, 'All Specs (Rare Proc)', '', '', '', '', 'Very Rare BiS', 'Huge primary stat proc on execute'],
    ['Boss 7: Void Ascendant', 'Void-Infused Cloak', 'Back', 'Heroic', 318, 'All Specs', '', '', '', '', 'BiS Back', 'Max item level cloak'],

    // Boss 8
    ['Boss 8: Final Boss (Mythic/Heroic)', 'Crown of the End Times', 'Head', 'Heroic', 318, 'All Specs (Omni-Token)', '', '', '', '', 'Omni-Token (Any Slot)', 'Can be turned in for any tier piece'],
    ['Boss 8: Final Boss (Mythic/Heroic)', 'Cosmic Annihilator', 'Main Hand', 'Heroic', 318, 'All Weapon Wielders', '', '', '', '', 'Mythic Weapon', 'Top weapon DPS in the game'],
    ['Boss 8: Final Boss (Mythic/Heroic)', 'Echo of the Void Harbinger', 'Trinket 2', 'Heroic', 318, 'All DPS (Very Rare)', '', '', '', '', 'God-Tier Trinket', 'Best in slot for 90% of specs']
  ];

  const fullData = [lootHeaders, ...chaseItemsCatalog];

  sheet.clear();
  sheet.clearFormats();
  sheet.getRange(1, 1, fullData.length, fullData[0].length).setValues(fullData);

  // Formatting
  const fullRange = sheet.getDataRange();
  fullRange.setHorizontalAlignment('center');
  fullRange.setNumberFormat('@');
  sheet.setFrozenColumns(2);
  sheet.setFrozenRows(1);

  // Header styling
  const headerRange = sheet.getRange(1, 1, 1, sheet.getMaxColumns());
  headerRange.setBackground('#202124').setFontColor('#ffffff').setFontWeight('bold');

  // Bold data
  sheet.getRange(2, 1, sheet.getMaxRows() - 1, sheet.getMaxColumns()).setFontWeight('bold');

  // Priority Column Conditional Formatting
  const rules = [];
  const prioColIdx = lootHeaders.indexOf('Priority / BiS Tier') + 1;
  const prioRange = sheet.getRange(2, prioColIdx, sheet.getMaxRows(), 1);
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('BiS').setBackground('#a335ee').setFontColor('#ffffff').setRanges([prioRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('Rare').setBackground('#ff8000').setFontColor('#000000').setRanges([prioRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('Tier').setBackground('#34a853').setFontColor('#ffffff').setRanges([prioRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('God-Tier').setBackground('#ff0055').setFontColor('#ffffff').setRanges([prioRange]).build());

  sheet.setConditionalFormatRules(rules);

  // Set widths
  sheet.setColumnWidth(1, 180); // Boss
  sheet.setColumnWidth(2, 240); // Item Name
  sheet.setColumnWidth(3, 110); // Slot
  sheet.setColumnWidth(4, 100); // Difficulty
  sheet.setColumnWidth(5, 85);  // Drop ilvl
  sheet.setColumnWidth(6, 220); // Target Specs
  sheet.setColumnWidth(7, 180); // Top Contender
  sheet.setColumnWidth(8, 220); // Equipped Item
  sheet.setColumnWidth(9, 100); // Equipped ilvl
  sheet.setColumnWidth(10, 140);// Upgrade Delta
  sheet.setColumnWidth(11, 180);// Priority / BiS Tier
  sheet.setColumnWidth(12, 280);// Notes

  SpreadsheetApp.getUi().alert('Loot & Chase Items Sheet Created!', 'Created the loot distribution and chase items reference sheet with Season 2 boss loot tables.', SpreadsheetApp.getUi().ButtonSet.OK);
}
