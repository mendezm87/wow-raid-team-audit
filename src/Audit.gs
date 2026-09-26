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
 * Calculates a summary readiness badge for the character.
 */
function calculateRaidReadyStatus(charRow) {
  const issues = [];

  // Check if character logged out in an unexpected off-spec
  if (charRow['Expected Spec'] && charRow['Spec']) {
    if (charRow['Expected Spec'].toLowerCase() !== charRow['Spec'].toLowerCase()) {
      issues.push(`Off-Spec → ${charRow['Expected Spec']}`);
    }
  }
  
  // Tier set check (warn if less than 4pc of current tier)
  const tierSetText = charRow['Tier Set'] || '';
  const tierMatch = tierSetText.match(/^(\d+)\/5/);
  const currentCount = tierMatch ? parseInt(tierMatch[1], 10) : 0;
  if (currentCount < 4) {
    issues.push(`Tier ${currentCount}/5`);
  }
  
  if (charRow['Empty Sockets'] > 0) {
    issues.push(`${charRow['Empty Sockets']} Socket${charRow['Empty Sockets'] > 1 ? 's' : ''} empty`);
  }
  
  let missingEnchants = 0;
  AUDIT_ENCHANT_COLUMNS.forEach(col => {
    if (charRow[col] === 'Missing') missingEnchants++;
  });
  
  if (missingEnchants > 0) {
    issues.push(`${missingEnchants} Enchant${missingEnchants > 1 ? 's' : ''} missing`);
  }

  return formatRaidReadySummary(issues);
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
        expectedSpec: expectedSpec,
        inGuildRoster: true
      });
    } else {
      // If not found in guild roster directly (e.g. cross-realm alt or trial), add directly
      // A same-realm character missing from the roster has almost certainly left the guild,
      // so flag it rather than letting it sit on the sheet as a silent ghost row.
      filteredRoster.push({
        name: targetName,
        realmSlug: targetRealm || config.GUILD_REALM_SLUG,
        expectedSpec: expectedSpec,
        inGuildRoster: false,
        crossRealm: !!targetRealm && targetRealm !== (config.GUILD_REALM_SLUG || '').toLowerCase()
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
  // Read the sim-freshness data once for the whole batch rather than per character
  const simStamps = getSimTimestamps_();
  const simmedNames = getSimmedNamesFromLootSheet_(SpreadsheetApp.getActiveSpreadsheet());
  const auditNow = Date.now();

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
      'Sim Status': '',
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
      // In Modern WoW (Midnight / The War Within), only dual-wield weapons (1H Swords, Maces, Axes, Daggers, Fist Weapons, Warglaives) in the Off-Hand can be enchanted.
      // Shields (SHIELD), Held in Off-Hand (HOLDABLE), and empty off-hand / 2H weapons CANNOT be enchanted and are marked N/A.
      if (!hasOffHandItem || isTwoHandWeapon) {
        charRow['Enchant Off Hand'] = 'N/A';
      } else if (hasOffHandItem && (offHandInventoryType === 'HOLDABLE' || offHandInventoryType === 'SHIELD' || offHandInventoryType === 'NON_EQUIP' || offHandInventoryType === 'SHIELDOFFHAND')) {
        charRow['Enchant Off Hand'] = 'N/A'; // Held in Off-Hand and Shields cannot be enchanted
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
    if (!profileData) {
      // No Armory profile (left the guild, renamed, transferred): one quiet row instead of nine "Missing" enchants
      charRow['Raid Ready'] = ARMORY_LOOKUP_FAILED;
      charRow['Tier Set'] = '-';
      AUDIT_ENCHANT_COLUMNS.forEach(col => { charRow[col] = '-'; });
      // Nothing was read, so leave the stat columns blank rather than showing a real-looking 0
      ['iLvl', 'M+ Rating', 'Total Sockets', 'Empty Sockets', 'Imperfect Gems', 'Crafted Items', 'GV Slots Unlocked']
        .forEach(col => { charRow[col] = ''; });
    } else {
      charRow['Raid Ready'] = calculateRaidReadyStatus(charRow);
    }

    // Sim freshness, so a raider with no sim isn't silently absent from every contender list.
    // Left blank when the Armory returned nothing, so the quiet grey row stays quiet.
    charRow['Sim Status'] = profileData
      ? simStatusText_(charName, simStamps, simmedNames, auditNow)
      : '';

    // Roster drift: on the sheet but no longer in the Blizzard guild roster
    if (character.inGuildRoster === false && !character.crossRealm) {
      charRow['Raid Ready'] = charRow['Raid Ready'] === ARMORY_LOOKUP_FAILED
        ? charRow['Raid Ready']
        : `${NOT_IN_GUILD} \u00b7 ${charRow['Raid Ready']}`;
    }

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
    notifyUser('Roster Fetch Failed', 'Failed to fetch guild roster. Please check your Realm Slug and Guild Slug.', true);
    return;
  }
  
  // Readiness first (sockets, gems, enchants), then crafted gear, then the per-slot gear and Great Vault detail.
  // Enchants, Gear and Great Vault are collapsible groups, so each needs an ungrouped column between it and the next.
  const outputHeaders = [
    'Name', 'Class', 'Spec', 'iLvl', 'Raid Ready', 'M+ Rating', 'Sim Status',
    'Tier Set', 'Total Sockets', 'Empty Sockets', 'Imperfect Gems',
    ...AUDIT_ENCHANT_COLUMNS,
    'Crafted Items', 'Embellishment 1', 'Embellishment 2',
    ...AUDIT_GEAR_COLUMNS,
    'GV Slots Unlocked',
    ...AUDIT_VAULT_COLUMNS
  ];

  // Gear and enchant cells get a short badge; applyFormatting puts the full text in each cell's note
  const toSheetRow = obj => outputHeaders.map(header => {
    const value = obj[header] !== undefined ? obj[header] : '';
    if (AUDIT_GEAR_COLUMNS.includes(header)) return compactGearText(value);
    if (AUDIT_ENCHANT_COLUMNS.includes(header)) return compactEnchantText(value);
    return value;
  });

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

  finalDataRows.push(...mainCharacterData.map(toSheetRow));
  
  if (altCharacterData.length > 0) {
      const bandRow = Array(outputHeaders.length).fill('');
      bandRow[0] = ALTS_BAND_LABEL;
      finalDataRows.push(bandRow);

      finalDataRows.push(...altCharacterData.map(toSheetRow));
      combinedDataObjects.push({ isAltsBand: true }, ...altCharacterData);
  }
  
  const finalData = [outputHeaders, ...finalDataRows];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  sheet.clear();
  sheet.clearFormats();
  sheet.clearNotes();
  fitSheetColumns(sheet, outputHeaders.length);
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

  notifyUser('Audit Complete!', `Successfully updated ${mainCharacterData.length} mains and ${altCharacterData.length} alts across Audit, Talents, and Loot sheets.`);
}

/**
 * Applies all conditional formatting and cosmetic styling.
 */
function applyFormatting(sheet, headers, characterDataObjects) {
  const lastRow = sheet.getLastRow();
  fitSheetColumns(sheet, headers.length);
  const totalCols = headers.length;
  const colOf = name => headers.indexOf(name) + 1;
  const columnRanges = names => names
    .map(colOf)
    .filter(idx => idx > 0)
    .map(idx => sheet.getRange(2, idx, sheet.getMaxRows(), 1));

  // Clear previous conditional formatting rules
  sheet.clearConditionalFormatRules();

  // Reset all number formats so legacy percentage formatting from older sheets is cleared
  sheet.getDataRange()
    .setNumberFormat('@')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setFontFamily('Roboto');

  // Set integer number format for numeric stat columns in one batch
  const numericCols = ['iLvl', 'M+ Rating', 'Total Sockets', 'Empty Sockets', 'Imperfect Gems', 'Crafted Items', 'GV Slots Unlocked']
    .concat(AUDIT_VAULT_COLUMNS);
  numericCols.forEach(colName => {
    const colIdx = colOf(colName);
    if (colIdx > 0 && sheet.getMaxRows() > 1) {
      sheet.getRange(2, colIdx, sheet.getMaxRows() - 1, 1).setNumberFormat('0');
    }
  });

  sheet.setFrozenColumns(1);
  sheet.setFrozenRows(1);
  applyTabColor(sheet);

  // 1. Header (Tailwind Slate 800), with the Enchants / Gear / Great Vault sections tinted so they read apart
  sheet.getRange(1, 1, 1, totalCols)
    .setBackground('#1e293b')
    .setFontColor('#f8fafc')
    .setFontWeight('bold')
    .setFontSize(10)
    .setHorizontalAlignment('center')
    .setWrap(true);
  [[AUDIT_ENCHANT_COLUMNS, '#134e4a'], [AUDIT_GEAR_COLUMNS, '#312e81'], [AUDIT_VAULT_COLUMNS, '#581c87']].forEach(([group, color]) => {
    const first = colOf(group[0]);
    if (first > 0) sheet.getRange(1, first, 1, group.length).setBackground(color);
  });
  sheet.setRowHeight(1, 40);
  stampHeaderCell(sheet, headers[0]);

  // 2. Body: regular weight with Name and Raid Ready bold; text left, numbers right, badges centred.
  // Alternating row fills, with the blank gap between mains and alts left white.
  let rowBackgrounds = [];
  if (lastRow > 1) {
    const dataRows = lastRow - 1;
    const textCols = ['Name', 'Class', 'Spec', 'Raid Ready', 'Embellishment 1', 'Embellishment 2'];
    const rowAlignments = headers.map(h => (textCols.includes(h) ? 'left' : (numericCols.includes(h) ? 'right' : 'center')));
    const rowWeights = headers.map(h => (h === 'Name' || h === 'Raid Ready' ? 'bold' : 'normal'));
    const isGapRow = i => !(characterDataObjects[i] && characterDataObjects[i]['Name']);
    const altsBandRowIdx = characterDataObjects.findIndex(obj => obj && obj.isAltsBand);
    rowBackgrounds = zebraBackgrounds(dataRows, headers.length, isGapRow);

    sheet.setRowHeights(2, dataRows, 28);
    sheet.getRange(2, 1, dataRows, totalCols).setFontSize(9);
    sheet.getRange(2, 1, dataRows, headers.length)
      .setHorizontalAlignments(Array.from({ length: dataRows }, () => rowAlignments))
      .setFontWeights(Array.from({ length: dataRows }, () => rowWeights))
      .setBackgrounds(rowBackgrounds);

    if (altsBandRowIdx > -1) {
      sheet.getRange(altsBandRowIdx + 2, 1, 1, totalCols)
        .setBackground('#334155')
        .setFontColor('#f8fafc')
        .setFontWeight('bold')
        .setFontSize(9)
        .setHorizontalAlignment('left');
      sheet.setRowHeight(altsBandRowIdx + 2, 24);
    }
  }

  // 3. Full item and enchant names live in hover notes, so the cells can stay short
  if (characterDataObjects && characterDataObjects.length > 0) {
    const gearNote = value => (value && value !== '-' ? value : '');
    [[AUDIT_GEAR_COLUMNS, gearNote], [AUDIT_ENCHANT_COLUMNS, enchantNoteText]].forEach(([group, noteFor]) => {
      const first = colOf(group[0]);
      if (first < 1) return;
      const notes = characterDataObjects.map(obj => group.map(col => noteFor(obj && obj[col])));
      sheet.getRange(2, first, notes.length, group.length).setNotes(notes);
    });
  }

  // 4. Collapsible Enchants / Gear / Great Vault column groups. Groups survive sheet.clear(), so drop the old ones first.
  try {
    sheet.getRange(1, 1, 1, totalCols).shiftColumnGroupDepth(-1);
  } catch (err) {
    Logger.log('No existing column groups to reset: ' + err);
  }
  [AUDIT_ENCHANT_COLUMNS, AUDIT_GEAR_COLUMNS, AUDIT_VAULT_COLUMNS].forEach(group => {
    const first = colOf(group[0]);
    if (first > 0) sheet.getRange(1, first, 1, group.length).shiftColumnGroupDepth(1);
  });

  const rules = [];

  // 5. Armory lookup failed: one quiet grey row instead of a wall of red. First in the list, so it wins over every rule below.
  const raidReadyCol = colOf('Raid Ready');
  if (raidReadyCol > 0) {
    const raidReadyLetter = sheet.getRange(1, raidReadyCol).getA1Notation().replace(/\d+/g, '');
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$${raidReadyLetter}2="${ARMORY_LOOKUP_FAILED}"`)
      .setBackground('#f1f5f9')
      .setFontColor('#94a3b8')
      .setItalic(true)
      .setRanges([sheet.getRange(2, 1, sheet.getMaxRows(), headers.length)])
      .build());
  }

  // 6. Class colour: a solid fill on Name only, class-coloured text on Class and Spec
  const nameRanges = columnRanges(['Name']);
  if (nameRanges.length > 0) {
    rules.push(...classColorRules('B', nameRanges, columnRanges(['Class', 'Spec'])));
  }

  // 7. Raid Ready Column Rules (Soft Modern Pills)
  if (raidReadyCol > 0) {
    const rrRange = columnRanges(['Raid Ready']);
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains(NOT_IN_GUILD).setBackground("#ffe4e6").setFontColor("#9f1239").setRanges(rrRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("READY").setBackground("#d1fae5").setFontColor("#065f46").setRanges(rrRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Enchant").setBackground("#ffe4e6").setFontColor("#9f1239").setRanges(rrRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Socket").setBackground("#ffe4e6").setFontColor("#9f1239").setRanges(rrRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Off-Spec").setBackground("#fef3c7").setFontColor("#92400e").setRanges(rrRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Tier").setBackground("#fef3c7").setFontColor("#92400e").setRanges(rrRange).build());
  }

  // 7b. Sim Status: green when fresh, amber when stale, red when there is no sim at all
  const simStatusRanges = columnRanges(['Sim Status']);
  if (simStatusRanges.length > 0) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains(SIM_STATUS_NONE).setBackground('#ffe4e6').setFontColor('#9f1239').setRanges(simStatusRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('old').setBackground('#fef3c7').setFontColor('#92400e').setRanges(simStatusRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('Sim').setBackground('#d1fae5').setFontColor('#065f46').setRanges(simStatusRanges).build());
  }

  // 8. Upgrade Tracks & Gear Slots (Modern Tailwind Badges)
  const gearRanges = columnRanges(AUDIT_GEAR_COLUMNS);
  if (gearRanges.length > 0) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Myth").setBackground("#ffedd5").setFontColor("#9a3412").setRanges(gearRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Hero").setBackground("#f3e8ff").setFontColor("#6b21a8").setRanges(gearRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Champion").setBackground("#e0f2fe").setFontColor("#075985").setRanges(gearRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Veteran").setBackground("#dcfce7").setFontColor("#166534").setRanges(gearRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Explorer").setBackground("#f1f5f9").setFontColor("#475569").setRanges(gearRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Adventurer").setBackground("#f1f5f9").setFontColor("#475569").setRanges(gearRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("Crafted").setBackground("#fce7f3").setFontColor("#831843").setRanges(gearRanges).build());
  }

  // 9. Tier Set Progress Rules (Soft Badges)
  const tsRange = columnRanges(['Tier Set']);
  if (tsRange.length > 0) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("5/5").setBackground("#d1fae5").setFontColor("#065f46").setRanges(tsRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("4/5").setBackground("#d1fae5").setFontColor("#065f46").setRanges(tsRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("3/5").setBackground("#fef3c7").setFontColor("#92400e").setRanges(tsRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("2/5").setBackground("#fef3c7").setFontColor("#92400e").setRanges(tsRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("1/5").setBackground("#ffe4e6").setFontColor("#9f1239").setRanges(tsRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains("0/5").setBackground("#ffe4e6").setFontColor("#9f1239").setRanges(tsRange).build());
  }

  // 10. Sockets & Imperfect Gems Rules
  const esRange = columnRanges(['Empty Sockets']);
  if (esRange.length > 0) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground("#ffe4e6").setFontColor("#9f1239").setRanges(esRange).build());
  }

  const igRange = columnRanges(['Imperfect Gems']);
  if (igRange.length > 0) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground("#fef3c7").setFontColor("#92400e").setRanges(igRange).build());
  }

  // 11. Enchant badges ("✓ Rank 2" / "✓ Rank 1" / "✓" / "Missing" / "N/A", see compactEnchantText)
  const enchantRanges = columnRanges(AUDIT_ENCHANT_COLUMNS);
  if (enchantRanges.length > 0) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("✓ Rank 1").setBackground("#fef3c7").setFontColor("#92400e").setRanges(enchantRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith("✓").setBackground("#d1fae5").setFontColor("#065f46").setRanges(enchantRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("N/A").setBackground("#f8fafc").setFontColor("#94a3b8").setRanges(enchantRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("Missing").setBackground("#ffe4e6").setFontColor("#9f1239").setRanges(enchantRanges).build());
  }

  // 12. Great Vault Styling & Borders
  const gvRaid1_idx = colOf('GV Raid 1');
  const gvRaid3_idx = colOf('GV Raid 3');
  const gvMplus1_idx = colOf('GV M+ 1');
  const gvMplus3_idx = colOf('GV M+ 3');
  const thin_border = SpreadsheetApp.BorderStyle.SOLID;

  if (gvRaid1_idx > 0 && gvRaid3_idx > 0 && lastRow > 1) {
    sheet.getRange(1, gvRaid1_idx, lastRow, 3).setBorder(true, true, true, true, false, false, '#94a3b8', thin_border);
  }

  if (gvMplus1_idx > 0 && gvMplus3_idx > 0 && lastRow > 1) {
    sheet.getRange(1, gvMplus1_idx, lastRow, 3).setBorder(true, true, true, true, false, false, '#94a3b8', thin_border);
  }

  const gvRaidRanges = columnRanges(['GV Raid 1', 'GV Raid 2', 'GV Raid 3']);
  if (gvRaidRanges.length > 0) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(VAULT_MAPPING.raid.mythic).setBackground("#ffedd5").setFontColor("#9a3412").setRanges(gvRaidRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(VAULT_MAPPING.raid.heroic).setBackground("#f3e8ff").setFontColor("#6b21a8").setRanges(gvRaidRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(VAULT_MAPPING.raid.normal).setBackground("#e0f2fe").setFontColor("#075985").setRanges(gvRaidRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(VAULT_MAPPING.raid.lfr).setBackground("#dcfce7").setFontColor("#166534").setRanges(gvRaidRanges).build());
  }

  const gvMplusRanges = columnRanges(['GV M+ 1', 'GV M+ 2', 'GV M+ 3']);
  if (gvMplusRanges.length > 0) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(331).setBackground("#ffedd5").setFontColor("#9a3412").setRanges(gvMplusRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(312).setBackground("#f3e8ff").setFontColor("#6b21a8").setRanges(gvMplusRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(299).setBackground("#e0f2fe").setFontColor("#075985").setRanges(gvMplusRanges).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(292).setBackground("#dcfce7").setFontColor("#166534").setRanges(gvMplusRanges).build());
  }

  // 13. M+ Rating: a pale tint of the Raider.IO rating colour, so it reads as a badge rather than a solid block.
  // Unrated rows keep their zebra fill.
  const mPlusRatingColIdx = colOf('M+ Rating');
  if (mPlusRatingColIdx > 0 && characterDataObjects && characterDataObjects.length > 0) {
    const backgrounds = characterDataObjects.map((charData, i) => [
      (charData && charData['M+ Rating Color']) ? tintColor(charData['M+ Rating Color'], 0.7) : ((rowBackgrounds[i] || [])[0] || '#ffffff')
    ]);
    const fontColors = characterDataObjects.map(() => ['#0f172a']);
    sheet.getRange(2, mPlusRatingColIdx, backgrounds.length, 1).setBackgrounds(backgrounds).setFontColors(fontColors);
  }

  sheet.setConditionalFormatRules(rules);

  // Column widths: gear and enchant cells hold short badges now (full names are in the notes)
  const columnWidths = {
    'Name': 120, 'Class': 100, 'Spec': 110, 'iLvl': 55,
    'Raid Ready': 260, 'M+ Rating': 75, 'Sim Status': 100, 'Tier Set': 95,
    'Total Sockets': 75, 'Empty Sockets': 75, 'Imperfect Gems': 80, 'Crafted Items': 75,
    'Embellishment 1': 165, 'Embellishment 2': 165,
    'GV Slots Unlocked': 80
  };
  AUDIT_ENCHANT_COLUMNS.forEach(h => { columnWidths[h] = 82; });
  AUDIT_GEAR_COLUMNS.forEach(h => { columnWidths[h] = 118; });
  AUDIT_VAULT_COLUMNS.forEach(h => { columnWidths[h] = 62; });

  headers.forEach((header, idx) => {
    sheet.setColumnWidth(idx + 1, columnWidths[header] || 100);
  });
}
