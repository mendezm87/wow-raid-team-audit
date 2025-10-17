const SHEET_NAME = 'Guild Audit'; 
const VAULT_MAPPING = {
  raid: {
      mythic: 710 ,
      heroic: 704 ,
      normal: 694 ,
      lfr: 678
  },
  mplus: {
      20: 707, 19: 707, 18: 707, 17: 707, 16: 707, 15: 707, 14: 707,
      13: 707, 12: 707, 11: 707, 10: 707, 9: 704, 8: 704, 7: 704, 6: 701,
      5: 697, 4: 697, 3: 694, 2: 694
  }
};

CLASS_COLORS = {
        'Warrior': '#C79C6E', 'Mage': '#3FC7EB', 'Rogue': '#FFF569', 'Paladin': '#F58CBA',
        'Warlock': '#8787ED', 'Shaman': '#0070DE', 'Hunter': '#ABD473', 'Druid': '#FF7D0A',
        'Priest': '#FFFFFF', 'Death Knight': '#C41F3B', 'Monk': '#00FF96',
        'Demon Hunter': '#A330C9', 'Evoker': '#33937F',
}
// --- END CONFIGURATION ---

function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Guild Audit')
      .addItem('1. Set API Credentials', 'promptForCredentials')
      .addItem('2. Create Config Sheet', 'createConfigSheet')
      .addSeparator()
      .addItem('3. Run Audit and format', 'updateAllCharacterDataWithBonuses')
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
      ['Configuration', 'Value'],
      ['Region', 'us'],
      ['Realm Slug', 'kiljaeden'],
      ['Guild Slug', 'prey'],
      ['', ''], // Empty row for spacing
      ['Main Characters to Track', ''], // Header for the list
      ['Jevo', ''],
      ['Lyci', ''],
      ['Aemonnd', ''],
      ['', ''], // Empty row for spacing
      ['Alts to Track', ''], // NEW: Header for alts
      ['Altcharone', ''],   // Example alt
      ['Altchartwo', '']    // Example alt
  ];
  sheet.getRange(1, 1, setupData.length, 2).setValues(setupData);
  sheet.getRange("A1:B1").merge().setHorizontalAlignment('center').setFontWeight('bold');
  sheet.getRange("A2:A4").setFontWeight('bold');
  sheet.getRange("A6").merge().setHorizontalAlignment('center').setFontWeight('bold');
  // NEW: Formatting for the new Alts header
  sheet.getRange("A11").merge().setHorizontalAlignment('center').setFontWeight('bold');
  sheet.autoResizeColumns(1, 2);
  SpreadsheetApp.getUi().alert('"Config" sheet created. Please update it with your guild\'s information.');
}

function getConfigurationFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('Config');
  if (!configSheet) {
    SpreadsheetApp.getUi().alert('Configuration sheet not found!', 'Please create a sheet named "Config" using the "Guild Audit > Create Config Sheet" menu.', SpreadsheetApp.getUi().ButtonSet.OK);
    return null;
  }

  const region = configSheet.getRange('B2').getValue();
  const realmSlug = configSheet.getRange('B3').getValue();
  const guildSlug = configSheet.getRange('B4').getValue();

  // Dynamically find and read character lists
  const data = configSheet.getDataRange().getValues();
  const members = [];
  const alts = [];
  let readingMains = false;
  let readingAlts = false;

  for (const row of data) {
      const header = row[0].toString().toLowerCase();
      if (header.includes('main characters')) {
          readingMains = true;
          readingAlts = false;
          continue; // Skip the header row itself
      } else if (header.includes('alts to track')) {
          readingMains = false;
          readingAlts = true;
          continue; // Skip the header row
      }

      if (readingMains && row[0]) {
          members.push(row[0]);
      } else if (readingAlts && row[0]) {
          alts.push(row[0]);
      }

      // Stop reading if we hit an empty row after starting
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
    ALTS_TO_TRACK: alts // NEW: Add alts to the config object
  };
}

/**
 * Prompts the user to enter their Blizzard API credentials and saves them to User Properties.
 */
function promptForCredentials() {
  const ui = SpreadsheetApp.getUi();
  const userProperties = PropertiesService.getUserProperties();

  const clientIdResponse = ui.prompt('Set Blizzard Client ID', 'Please enter your Client ID:', ui.ButtonSet.OK_CANCEL);
  if (clientIdResponse.getSelectedButton() !== ui.Button.OK) return;
  const clientId = clientIdResponse.getResponseText();

  const clientSecretResponse = ui.prompt('Set Blizzard Client Secret', 'Please enter your Client Secret:', ui.ButtonSet.OK_CANCEL);
  if (clientSecretResponse.getSelectedButton() !== ui.Button.OK) return;
  const clientSecret = clientSecretResponse.getResponseText();

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
    headers: { 'Authorization': 'Basic ' + Utilities.base64Encode(CLIENT_ID + ':' + CLIENT_SECRET) }
  };
  
  const response = UrlFetchApp.fetch(url, options);
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
    if (response.getResponseCode() == 200) {
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
    const response = UrlFetchApp.fetch(bonusUrl);
    const bonusText = response.getContentText();
    return JSON.parse(bonusText);
  } catch (e) {
    Logger.log(`Failed to fetch or parse bonuses.json. Error: ${e.toString()}`);
    return null;
  }
}

function getEnchantData() {
  Logger.log('Fetching enchantments.json from Raidbots...');
  const enchantUrl = 'https://www.raidbots.com/static/data/live/enchantments.json';
  try {
    const response = UrlFetchApp.fetch(enchantUrl);
    const enchantText = response.getContentText();
    const enchantArray = JSON.parse(enchantText);
    
    // Convert array to a map for efficient lookups { id: {enchant_data} }
    const enchantMap = enchantArray.reduce((map, enchant) => {
      // Use the item ID for gems, or the enchant ID for enchants
      const key = enchant.itemId || enchant.id;
      map[key] = enchant;
      return map;
    }, {});
    
    return enchantMap;
  } catch (e) {
    Logger.log(`Failed to fetch or parse enchantments.json. Error: ${e.toString()}`);
    return null;
  }
}

function rgbToHex(r, g, b) {
  // Convert each component to its hexadecimal string representation
  let rHex = r.toString(16);
  let gHex = g.toString(16);
  let bHex = b.toString(16);

  // Pad single-digit hex values with a leading zero
  if (rHex.length === 1) rHex = "0" + rHex;
  if (gHex.length === 1) gHex = "0" + gHex;
  if (bHex.length === 1) bHex = "0" + bHex;

  // Concatenate and return with the '#' prefix
  return "#" + rHex + gHex + bHex;
}

/**
 * Helper function to fetch and process data for a list of character names.
 * @param {Array<string>} characterNames - The list of character names to process.
 * @param {Array<Object>} guildRosterMembers - The full guild roster from the API.
 * @param {Object} config - The script's configuration object.
 * @param {string} token - The Blizzard API access token.
 * @param {Object} enchantAndGemData - The enchant and gem data from Raidbots.
 * @param {Object} bonusData - The bonus ID data from Raidbots.
 * @param {Array<string>} outputHeaders - The headers for the output sheet.
 * @returns {Array<Object>} An array of character data objects.
 */
function processCharacterSet(characterNames, guildRosterMembers, config, token, enchantAndGemData, bonusData, outputHeaders) {
    const characterDataObjects = [];
    const headers = { 'Authorization': 'Bearer ' + token, 'Battlenet-Namespace': `profile-${config.REGION}` };
    const apiHost = getApiHost(config);

    const membersToTrackLower = characterNames.map(name => name.toLowerCase());
    const filteredRoster = guildRosterMembers.filter(member =>
        membersToTrackLower.includes(member.character.name.toLowerCase())
    );

    for (const member of filteredRoster) {
        const charName = member.character.name.toLowerCase();
        const charRealm = member.character.realm.slug;
        
        let charRow = {
      'Name': member.character.name, 'Class': '', 'Spec': '', 'iLvl': 0,  'M+ Rating': 0, 
      'Total Sockets': 0, 'Crafted Items': 0, 'Raid Buff (%)': 0, 'Imperfect Gems': 0,
      'Embellishment 1': '-', 'Embellishment 2': '-',
      'Reshii Wraps Rank': '-', 'Reshii Boots': '-',
      'Tier Set': '0/5', 'Tier Helm': '-', 'Tier Shoulder': '-', 'Tier Chest': '-', 'Tier Gloves': '-', 'Tier Legs': '-', 'Main Hand': '-', 'Off Hand': '-',  'Trinket 1': '-', 'Trinket 2': '-',
       'Neck': '-', 'Back': '-', 'Wrists': '-', 'Wasit': '-', 'Ring 1': '-', 'Ring 2': '-',
      'Enchant Main Hand': 'Missing', 'Enchant Off Hand': 'Missing', 'Enchant Cloak': 'Missing', 'Enchant Chest': 'Missing', 'Enchant Wrists': 'Missing', 'Enchant Legs': 'Missing', 'Enchant Feet': 'Missing', 'Enchant Ring 1': 'Missing', 'Enchant Ring 2': 'Missing',
      'K\'aresh Trust Renown': 0, 'Manaforge Vandals Renown': 0, 
      'GV Slots Unlocked': 0,
      'GV Raid 1': '-', 'GV Raid 2': '-', 'GV Raid 3': '-',
      'GV M+ 1': '-', 'GV M+ 2': '-', 'GV M+ 3': '-'
    };

    // --- Fetch all character data ---
    const profileData = fetchBlizzardEndpoint(`${apiHost}/profile/wow/character/${charRealm}/${charName}?locale=en_US`, headers);
    const equipmentData = fetchBlizzardEndpoint(`${apiHost}/profile/wow/character/${charRealm}/${charName}/equipment?locale=en_US`, headers);
    const reputationsData = fetchBlizzardEndpoint(`${apiHost}/profile/wow/character/${charRealm}/${charName}/reputations?locale=en_US`, headers);
    const mplusData = fetchBlizzardEndpoint(`${apiHost}/profile/wow/character/${charRealm}/${charName}/mythic-keystone-profile?locale=en_US`, headers);
    const raidData = fetchBlizzardEndpoint(`${apiHost}/profile/wow/character/${charRealm}/${charName}/encounters/raids?locale=en_US`, headers);

    
    // --- Process Profile ---
    if (profileData) {
      charRow['iLvl'] = profileData.equipped_item_level;
      charRow['Class'] = profileData.character_class.name;
      charRow['Spec'] = profileData.active_spec.name;
    }

    // --- Process Great Vault Data ---
    if (mplusData) {
      if (mplusData.current_mythic_rating) {
          charRow['M+ Rating'] = mplusData.current_mythic_rating.rating;
          const c = mplusData.current_mythic_rating.color;
          charRow['M+ Rating Color'] = rgbToHex(c.r, c.g, c.b);
      }

      if (mplusData.current_period){
        // timestamp logic
        const weekStartTimestamp = (mplusData.current_period.period.id * 604800000) + 1135699200000;
        const weekEndTimestamp = weekStartTimestamp + 604800000;

        // Raid Slots (using the calculated timestamps)
        if (raidData) {
            const latestRaid = raidData.expansions?.slice(-1)[0]?.instances?.slice(-1)[0];
            if (latestRaid) {
                let weeklyMythicKills = 0;
                let weeklyHeroicKills = 0;
                let weeklyNormalKills = 0;
                let weeklyLFRKills = 0;

                for (const mode of latestRaid.modes) {
                    for (const boss of mode.progress.encounters) {
                        if (boss.last_kill_timestamp >= weekStartTimestamp && boss.last_kill_timestamp < weekEndTimestamp) {
                            if (mode.difficulty.type === 'MYTHIC') weeklyMythicKills++;
                            if (mode.difficulty.type === 'HEROIC') weeklyHeroicKills++;
                            if (mode.difficulty.type === 'NORMAL') weeklyNormalKills++;
                            if (mode.difficulty.type === 'LFR') weeklyLFRKills++;
                        }
                    }
                }
                Logger.log(`Generating data for ${charName}`)

                if (weeklyLFRKills >= 6) charRow['GV Raid 3'] = VAULT_MAPPING.raid.lfr, charRow['GV Raid 2'] = VAULT_MAPPING.raid.lfr, charRow['GV Raid 1'] = VAULT_MAPPING.raid.lfr;
                else if (weeklyLFRKills >= 4) charRow['GV Raid 2'] = VAULT_MAPPING.raid.lfr, charRow['GV Raid 1'] = VAULT_MAPPING.raid.lfr;
                else if (weeklyLFRKills >= 2) charRow['GV Raid 1'] = VAULT_MAPPING.raid.lfr;

                if (weeklyNormalKills >= 6) charRow['GV Raid 3'] = VAULT_MAPPING.raid.normal, charRow['GV Raid 2'] = VAULT_MAPPING.raid.normal, charRow['GV Raid 1'] = VAULT_MAPPING.raid.normal;
                else if (weeklyNormalKills >= 4) charRow['GV Raid 2'] = VAULT_MAPPING.raid.normal, charRow['GV Raid 1'] = VAULT_MAPPING.raid.normal;
                else if (weeklyNormalKills >= 2) charRow['GV Raid 1'] = VAULT_MAPPING.raid.normal;
                                
                if (weeklyHeroicKills >= 6) charRow['GV Raid 3'] = VAULT_MAPPING.raid.heroic, charRow['GV Raid 2'] = VAULT_MAPPING.raid.heroic, charRow['GV Raid 1'] = VAULT_MAPPING.raid.heroic;
                else if (weeklyHeroicKills >= 4) charRow['GV Raid 2'] = VAULT_MAPPING.raid.heroic, charRow['GV Raid 1'] = VAULT_MAPPING.raid.heroic;
                else if (weeklyHeroicKills >= 2) charRow['GV Raid 1'] = VAULT_MAPPING.raid.heroic;

                if (weeklyMythicKills >= 6) charRow['GV Raid 3'] = VAULT_MAPPING.raid.mythic, charRow['GV Raid 2'] = VAULT_MAPPING.raid.mythic, charRow['GV Raid 1'] = VAULT_MAPPING.raid.mythic;
                else if (weeklyMythicKills >= 4) charRow['GV Raid 2'] = VAULT_MAPPING.raid.mythic, charRow['GV Raid 1'] = VAULT_MAPPING.raid.mythic;
                else if (weeklyMythicKills >= 2) charRow['GV Raid 1'] = VAULT_MAPPING.raid.mythic;
            }
        }
    
        // Mythic+ Slots (this part is already weekly)
        if (mplusData.current_period.best_runs) {
            const sortedRuns = mplusData.current_period.best_runs.sort((a, b) => b.keystone_level - a.keystone_level);
            if (sortedRuns.length >= 1) charRow['GV M+ 1'] = VAULT_MAPPING.mplus[sortedRuns[0].keystone_level] || '-';
            if (sortedRuns.length >= 4) charRow['GV M+ 2'] = VAULT_MAPPING.mplus[sortedRuns[3].keystone_level] || '-';
            if (sortedRuns.length >= 8) charRow['GV M+ 3'] = VAULT_MAPPING.mplus[sortedRuns[7].keystone_level] || '-';
        }

        }
    }
    
    // Count unlocked slots
    let unlockedCount = 0;
    ['GV Raid 1', 'GV Raid 2', 'GV Raid 3', 'GV M+ 1', 'GV M+ 2', 'GV M+ 3'].forEach(slot => {
        if (charRow[slot] !== '-') unlockedCount++;
    });
    charRow['GV Slots Unlocked'] = unlockedCount;


    // --- Process Reputations ---
    if (reputationsData) {
      for (const rep of reputationsData.reputations) {
        if (rep.faction.name === "The K'aresh Trust") {
          charRow['K\'aresh Trust Renown'] = rep.standing.renown_level || 0;
        }
        if (rep.faction.name === "Manaforge Vandals") {
          const renown = rep.standing.renown_level || 0;
          charRow['Manaforge Vandals Renown'] = renown;
          // Calculate Raid Buff
          if (renown >= 15) charRow['Raid Buff (%)'] = '15%';
          else if (renown >= 13) charRow['Raid Buff (%)'] = '12%';
          else if (renown >= 10) charRow['Raid Buff (%)'] = '9%';
          else if (renown >= 7) charRow['Raid Buff (%)'] = '6%';
          else if (renown >= 4) charRow['Raid Buff (%)'] = '3%';
        }
      }
    }

  
    
    // --- Process Equipment ---
    if (equipmentData) {
      let tierCount = 0;
      const embellishments = [];
      for (const item of equipmentData.equipped_items) {
        // UPDATED: Sockets & Gems logic
        if (item.sockets) {
          charRow['Total Sockets'] += item.sockets.length;
          for (const socket of item.sockets) {
            if (socket.item) {
              const gemId = socket.item.id;
              const gemData = enchantAndGemData[gemId];
              // If the gem is found and its craftingQuality is NOT 3, increment the counter.
              if (gemData && gemData.craftingQuality < 3) {
                charRow['Imperfect Gems']++;
              }
            }
          }
        }
        // Count Crafted Items
        if(item.name_description){
          if (item.name_description.display_string.includes("Crafted")) {
            charRow['Crafted Items']++;
        
          // Find Embellishments
            if (item.spells) {
                for(const spell of item.spells) {
                    if(spell.spell.name && !item.bonus_list.includes(11192) ) embellishments.push(spell.spell.name);

                }
            }
          }
        }


        // Find Enchants
        if(item.enchantments) {
            const enchantName = item.enchantments[0].display_string;
            if (item.slot.type === 'MAIN_HAND') charRow['Enchant Main Hand'] = enchantName;
            if (item.slot.type === 'OFF_HAND') charRow['Enchant Off Hand'] = enchantName;
            //todo: add exceptions for offhand types of HOLDABLE and SHIELD and Hunters using mainhand RANGEDRIGHT
            //if (item.inventory_type.type === 'TWOHWEAPON' && item.slot.type !== 'OFF_HAND') charRow['Enchant Off Hand'] = 'N/A';
            if (item.slot.type === 'BACK') charRow['Enchant Cloak'] = enchantName;
            if (item.slot.type === 'CHEST') charRow['Enchant Chest'] = enchantName;
            if (item.slot.type === 'WRIST') charRow['Enchant Wrists'] = enchantName;
            if (item.slot.type === 'LEGS') charRow['Enchant Legs'] = enchantName;
            if (item.slot.type === 'FEET') charRow['Enchant Feet'] = enchantName;
            if (item.slot.type === 'FINGER_1') charRow['Enchant Ring 1'] = enchantName;
            if (item.slot.type === 'FINGER_2') charRow['Enchant Ring 2'] = enchantName;
        }
        // Find Tier Pieces and their upgrade tracks
        let upgradeInfo = '-';
        if (item.bonus_list) {
          for (const bonusId of item.bonus_list) {
            const bonus = bonusData[bonusId];
            if (bonus && bonus.upgrade) {
              upgradeInfo = `${bonus.upgrade.name} ${bonus.upgrade.level}/${bonus.upgrade.max}`;
              break;
            }
          }
        }
        
        // Track Reshii Wraps specifically
        if (item.item.id === 235499) { // Item ID for Reshii Wraps
          if (item.bonus_list) {
            for (const bonusId of item.bonus_list) {
              const bonus = bonusData[bonusId];
              if(bonus && bonus.tag && bonus.tag.includes("Rank")){
                charRow['Reshii Wraps Rank'] = bonus.tag;
              }
            }
         }
        }

        //Find weapons
        if (item.slot.type === 'MAIN_HAND') charRow['Main Hand'] = `${item.name} ${item.level.value} (${upgradeInfo})`;
        if (item.slot.type === 'OFF_HAND') charRow['Off Hand'] = `${item.name} ${item.level.value} (${upgradeInfo})`;
        //Find Minor Gear
        if(item.slot.type === 'NECK') charRow['Neck'] = `${item.name} ${item.level.value} (${upgradeInfo})`
        if(item.slot.type === 'WAIST') charRow['Waist'] = `${item.name} ${item.level.value} (${upgradeInfo})`
        if(item.slot.type === 'FEET') charRow['Feet'] = `${item.name} ${item.level.value} (${upgradeInfo})`
        if(item.slot.type === 'WRIST') charRow['Wrist'] = `${item.name} ${item.level.value} (${upgradeInfo})`
        if(item.slot.type === 'FINGER_1') charRow['Ring 1'] = `${item.name} ${item.level.value} (${upgradeInfo})`
        if(item.slot.type === 'FINGER_2') charRow['Ring 2'] = `${item.name} ${item.level.value} (${upgradeInfo})`

        // Find Trinkets
        if(item.slot.type === 'TRINKET_1') charRow['Trinket 1'] = `${item.name} ${item.level.value} (${upgradeInfo})`
        if(item.slot.type === 'TRINKET_2') charRow['Trinket 2'] = `${item.name} ${item.level.value} (${upgradeInfo})`

        if (item.slot.type === 'FEET' && item.name.includes('Interloper')){
          charRow['Reshii Boots'] = `${item.level.value} (${upgradeInfo})`;
        }
        if (item.set) { 
          if (item.slot.type === 'HEAD') charRow['Tier Helm'] = `${item.level.value} (${upgradeInfo})`, tierCount++;
          if (item.slot.type === 'SHOULDER') charRow['Tier Shoulder'] = `${item.level.value} (${upgradeInfo})`, tierCount++;
          if (item.slot.type === 'CHEST') charRow['Tier Chest'] = `${item.level.value} (${upgradeInfo})`, tierCount++;
          if (item.slot.type === 'HANDS') charRow['Tier Gloves'] = `${item.level.value} (${upgradeInfo})`, tierCount++;
          if (item.slot.type === 'LEGS') charRow['Tier Legs'] = `${item.level.value} (${upgradeInfo})`,tierCount++;
        }
      }
      charRow['Tier Set'] = `${tierCount}/5`;
      if(embellishments[0]) charRow['Embellishment 1'] = embellishments[0];
      if(embellishments[1]) charRow['Embellishment 2'] = embellishments[1];
    }
        characterDataObjects.push(charRow);
        Logger.log(`Successfully processed data for ${member.character.name}`);
        Utilities.sleep(300);
    }
    // --- End of the main loop ---

    return characterDataObjects;
}


function updateAllCharacterDataWithBonuses() {
  const config = getConfigurationFromSheet();
  if (!config) return;

  const token = getAccessToken(config);
  if (!token) { return; }

  const enchantAndGemData = getEnchantData();
  if (!enchantAndGemData) { return; }

  const bonusData = getBonusData();
  if (!bonusData) { return; }

  const headers = { 'Authorization': 'Bearer ' + token, 'Battlenet-Namespace': `profile-${config.REGION}` };
  const apiHost = getApiHost(config);

  const rosterData = fetchBlizzardEndpoint(`${apiHost}/data/wow/guild/${config.GUILD_REALM_SLUG}/${config.GUILD_NAME_SLUG}/roster?locale=en_US`, headers);
  if (!rosterData || !rosterData.members) {
    Logger.log("Failed to fetch guild roster.");
    return;
  }
  
  const characterDataObjects = [];
  const outputHeaders = [
    'Name', 'Class', 'Spec', 'iLvl', 'M+ Rating', 
    'Total Sockets', 'Crafted Items', 'Raid Buff (%)', 'Imperfect Gems',
    'Embellishment 1', 'Embellishment 2',
    'Reshii Wraps Rank', 'Reshii Boots',
    'Tier Set', 'Tier Helm', 'Tier Shoulder', 'Tier Chest', 'Tier Gloves', 'Tier Legs', 'Main Hand', 'Off Hand', 'Trinket 1', 'Trinket 2', 
    'Neck', 'Back', 'Wrist', 'Waist', 'Ring 1', 'Ring 2',
    'Enchant Main Hand', 'Enchant Off Hand', 'Enchant Cloak', 'Enchant Chest', 'Enchant Wrists', 'Enchant Legs', 'Enchant Feet', 'Enchant Ring 1', 'Enchant Ring 2',
    'K\'aresh Trust Renown', 'Manaforge Vandals Renown', 
    'GV Slots Unlocked', 
    'GV Raid 1', 'GV Raid 2', 'GV Raid 3',
    'GV M+ 1', 'GV M+ 2', 'GV M+ 3'
  ];

  // 1. Process Mains
  const mainCharacterData = processCharacterSet(config.MEMBERS_TO_TRACK, rosterData.members, config, token, enchantAndGemData, bonusData, outputHeaders);
  mainCharacterData.sort((a, b) => a['Class'].localeCompare(b['Class']));

  // 2. Process Alts
  let altCharacterData = [];
  if (config.ALTS_TO_TRACK && config.ALTS_TO_TRACK.length > 0) {
      altCharacterData = processCharacterSet(config.ALTS_TO_TRACK, rosterData.members, config, token, enchantAndGemData, bonusData, outputHeaders);
      altCharacterData.sort((a, b) => a['Class'].localeCompare(b['Class']));
  }

  // 3. Combine and Prepare for Sheet
  const combinedDataObjects = [...mainCharacterData];
  const finalDataRows = [];

  // Add main character data rows
  finalDataRows.push(...mainCharacterData.map(obj => outputHeaders.map(header => obj[header] || '')));
  
  // Add separator and alt data rows if alts exist
  if (altCharacterData.length > 0) {
      // Add two empty rows for spacing
      finalDataRows.push(Array(outputHeaders.length).fill(''));
      finalDataRows.push(Array(outputHeaders.length).fill(''));
      
      finalDataRows.push(...altCharacterData.map(obj => outputHeaders.map(header => obj[header] || '')));
      combinedDataObjects.push({}, {}, ...altCharacterData); // Add placeholders for formatting
  }
  
  const finalData = [outputHeaders, ...finalDataRows];

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (sheet) {
    sheet.clear();
    sheet.clearFormats();
    sheet.getRange(1, 1, finalData.length, finalData[0].length).setValues(finalData);
    
    // Pass the combined object list to formatting
    applyFormatting(sheet, outputHeaders, combinedDataObjects);
    Logger.log('Update complete!');
  } else {
    Logger.log(`Error: Could not find a sheet named '${SHEET_NAME}'. Please check the name.`);
  }
}

/**
 * Applies all conditional formatting and cosmetic changes to the sheet.
 * @param {Sheet} sheet The Google Sheet object to format.
 * @param {Array<string>} headers The array of headers to find column indexes.
 */
//function applyFormatting(sheet, headers, dataRows) {
function applyFormatting(sheet, headers, characterDataObjects) {
  const fullRange = sheet.getDataRange();
  
  // --- Center all text in the sheet ---
  fullRange.setHorizontalAlignment('center');
  // --- END ---
  // Freeze the first column
  sheet.setFrozenColumns(1);
  sheet.setFrozenRows(1);

  // --- Bolding and Resizing ---
  const headerRange = sheet.getRange(1, 1, 1, sheet.getMaxColumns());
  headerRange.setBackground('#bbbbbb').setFontWeight('bold');
  
  const dataRangeToBold = sheet.getRange(2, 4, sheet.getMaxRows() -1, sheet.getMaxColumns() - 3);
  dataRangeToBold.setFontWeight("bold");

  sheet.autoResizeColumns(1, sheet.getMaxColumns());
  // --- END Bolding and Resizing ---

  // --- Build Conditional Formatting Rules ---
  const rules = [];

  // Rule for Class Colors
  const nameColIndex = headers.indexOf('Name') + 1;
  const classColIndex = headers.indexOf('Class') + 1;
  const specColIndex = headers.indexOf('Spec') + 1;
  const classAndSpecRanges = [];
  if (nameColIndex > 0) classAndSpecRanges.push(sheet.getRange(2, nameColIndex, sheet.getMaxRows(), 1));
  if (classColIndex > 0) classAndSpecRanges.push(sheet.getRange(2, classColIndex, sheet.getMaxRows(), 1));
  if (specColIndex > 0) classAndSpecRanges.push(sheet.getRange(2, specColIndex, sheet.getMaxRows(), 1));

  if (classAndSpecRanges.length > 0) {
    for (const className in CLASS_COLORS) {
      const rule = SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(`=$B2="${className}"`) // Formula still checks the Class column (B)
        .setBackground(CLASS_COLORS[className])
        .setRanges(classAndSpecRanges)
        .build();
      rules.push(rule);
    }
  }

  // Helper function for track/enchant/vault rules
  const addRule = (columnIndex, textCondition, color) => {
    if (columnIndex > -1) {
      const range = sheet.getRange(2, columnIndex + 1, sheet.getMaxRows());
      const rule = SpreadsheetApp.newConditionalFormatRule()
        .whenTextContains(textCondition)
        .setBackground(color)
        .setRanges([range])
        .build();
      rules.push(rule);
    }
  };
  
  const addNumericRule = (columnIndex, condition, color) => {
      // FIX: Add a check to ensure the condition is a valid number.
      if (columnIndex > -1 && typeof condition === 'number') {
          const range = sheet.getRange(2, columnIndex + 1, sheet.getMaxRows());
          const rule = SpreadsheetApp.newConditionalFormatRule()
              .whenNumberGreaterThanOrEqualTo(condition)
              .setBackground(color)
              .setRanges([range])
              .build();
          rules.push(rule);
      }
  };

  // Rules for Upgrade Tracks
  const tierCols = ['Tier Helm', 'Tier Shoulder', 'Tier Chest', 'Tier Gloves', 'Tier Legs', 'Main Hand', 'Off Hand', 'Trinket 1', 'Trinket 2', 'Reshii Boots', 'Neck', 'Back', 'Wrist', 'Waist', 'Ring 1', 'Ring 2',];
  tierCols.forEach(colName => {
    const colIdx = headers.indexOf(colName);
    addRule(colIdx, "Myth", "#ff8000"); // Orange
    addRule(colIdx, "Hero", "#a335ee");   // Purple
    addRule(colIdx, "Champion", "#0070dd"); // Blue
    addRule(colIdx, "Veteran", "#1eff00"); // Green
    addRule(colIdx, "720 (-)", "#ff8000"); // Orange crafted
    addRule(colIdx, "704 (-)", "#a335ee");   // Purple crafted
    addRule(colIdx, "691 (-)", "#0070dd"); // Blue crafted
    addRule(colIdx, "675 (-)", "#1eff00"); // Green crafted
    addRule(colIdx, "-", "#bbbbbb"); //Gray for blanks
  });

    // Rules for Tier Set Count
  const tierSetColIdx = headers.indexOf('Tier Set');
  addRule(tierSetColIdx, "5/5", "#1eff00"); // Green
  addRule(tierSetColIdx, "4/5", "#1eff00"); // Green
  addRule(tierSetColIdx, "3/5", "#ffff00"); // Yellow
  addRule(tierSetColIdx, "2/5", "#ffff00"); // Yellow
  addRule(tierSetColIdx, "1/5", "#ff0000"); // Red
  addRule(tierSetColIdx, "0/5", "#ff0000"); // Red

  // Rules for Enchants
  const enchantCols = ['Enchant Main Hand', 'Enchant Off Hand', 'Enchant Cloak', 'Enchant Chest', 'Enchant Wrists', 'Enchant Legs', 'Enchant Feet', 'Enchant Ring 1', 'Enchant Ring 2'];
  enchantCols.forEach(colName => {
      const colIdx = headers.indexOf(colName);
      addRule(colIdx, "Tier3", "#34a853"); // Green for Rank 3
      addRule(colIdx, "Tier2", "#fff200"); // Yellow for Rank 2
      addRule(colIdx, "Tier1", "#ff0000"); // Red for Rank 1
      addRule(colIdx, "Rune of", "#34a853"); //Green for DK
      if(colName !== 'Enchant Off Hand'){
        addRule(colIdx, "Missing", "#ff0000"); //Red for missing
      }
      if(colName == 'Enchant Off Hand'){
        addRule(colIdx, "Missing", "#bbbbbb"); //Gray
      }
  });
  
  const gvRaid1_idx = headers.indexOf('GV Raid 1') + 1;
  const gvRaid3_idx = headers.indexOf('GV Raid 3') + 1;
  const gvMplus1_idx = headers.indexOf('GV M+ 1') + 1;
  const gvMplus3_idx = headers.indexOf('GV M+ 3') + 1;
  const lastDataRow = sheet.getLastRow();
  const medium_border = SpreadsheetApp.BorderStyle.SOLID_MEDIUM;

  if (gvRaid1_idx > 0 && gvRaid3_idx > 0 && lastDataRow > 1) {
      const raidRange = sheet.getRange(1, gvRaid1_idx, lastDataRow, 3);
      raidRange.setBorder(true, true, true, true, false, false, '#000000', medium_border);
  }

  if (gvMplus1_idx > 0 && gvMplus3_idx > 0 && lastDataRow > 1) {
      const mplusRange = sheet.getRange(1, gvMplus1_idx, lastDataRow, 3);
      mplusRange.setBorder(true, true, true, true, false, false, '#000000', medium_border);
  }

  const gvRaidCols = ['GV Raid 1', 'GV Raid 2', 'GV Raid 3'];
  gvRaidCols.forEach(colName => {
      const colIdx = headers.indexOf(colName);
      // Apply from lowest to highest, so the highest match wins
      addRule(colIdx, VAULT_MAPPING.raid.lfr, "#1eff00");
      addRule(colIdx, VAULT_MAPPING.raid.normal, "#0070dd");
      addRule(colIdx, VAULT_MAPPING.raid.heroic, "#a335ee");
      addRule(colIdx, VAULT_MAPPING.raid.mythic, "#ff8000");
  });
  
  const gvMplusCols = ['GV M+ 1', 'GV M+ 2', 'GV M+ 3'];
  gvMplusCols.forEach(colName => {
      const colIdx = headers.indexOf(colName);
      addNumericRule(colIdx, VAULT_MAPPING.mplus[10], "#ff8000");
      addNumericRule(colIdx, VAULT_MAPPING.mplus[2], "#a335ee");
      Logger.log(colIdx)
  });

  const mPlusRatingColIdx = headers.indexOf('M+ Rating') + 1;
  if (mPlusRatingColIdx > 0 && characterDataObjects) {
      characterDataObjects.forEach((charData, index) => {
          if (charData['M+ Rating Color']) {
              // index + 2 because sheet is 1-based and we skip the header row
              sheet.getRange(index + 2, mPlusRatingColIdx).setBackground(charData['M+ Rating Color']);
          }
      });
  }

  // Apply all rules to the sheet
  sheet.setConditionalFormatRules(rules);
}
