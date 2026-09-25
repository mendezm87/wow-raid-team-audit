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
    const headers = auditValues[0].map(headerLabel);
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
/**
 * Lowercased names of the main characters on the Config sheet (rows 9-45, column A). Only these
 * raiders' sims are used on the Loot sheet.
 */
function getRosterMainNamesSet(ss) {
  const names = new Set();
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('Config');
  if (configSheet && configSheet.getLastRow() >= 9) {
    const numRows = Math.min(configSheet.getLastRow() - 8, 37);
    configSheet.getRange(9, 1, numRows, 1).getValues().forEach(row => {
      const { name } = parseCharacterAndRealm((row[0] || '').toString().trim(), '');
      if (name && !name.toLowerCase().includes('main character')) names.add(name.toLowerCase());
    });
  }
  return names;
}

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
  const auditRange = auditSheet.getDataRange();
  const auditValues = auditRange.getValues();
  // Gear cells show a short "◆ 334 Myth 6/6"; the full "[Tier] 334 (Myth 6/6) - Item" text is in the cell's note
  const auditNotes = auditRange.getNotes();
  const headers = auditValues[0].map(headerLabel);

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
        const note = AUDIT_GEAR_COLUMNS.includes(h) ? ((auditNotes[r] || [])[colIdx] || '') : '';
        charObj[h] = (note || row[colIdx] || '').toString().trim();
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
 * Creates and formats the Loot & Chase Items reference sheet.
 * Features the current Season 2 raid: The Venomous Abyss (8 Bosses) with distinct boss separator banners.
 * Automatically queries Blizzard Journal API for complete drop tables and calculates upgrade deltas.
 */
function createLootAndChaseItemsSheet(mainCharacterData) {
  return withScriptLock(() => buildLootAndChaseItemsSheet_(mainCharacterData));
}

function buildLootAndChaseItemsSheet_(mainCharacterData) {
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

  // Live Blizzard loot table (cached for a week), falling back to the offline catalog
  const config = getConfigurationFromSheet();
  let chaseItemsCatalog = config ? getRaidLootTable(config, false) : null;

  if (!chaseItemsCatalog || chaseItemsCatalog.length === 0) {
    chaseItemsCatalog = FALLBACK_LOOT_CATALOG.map(row => row.slice());
  }

  const lootDifficulty = getLootDifficulty();
  chaseItemsCatalog = applyLootDifficultyToCatalog(chaseItemsCatalog, lootDifficulty);

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
      const dropIlvl = Number(row[4]) || lootDifficulty.ilvl;
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
  applyTabColor(sheet);

  // Header styling
  const headerRange = sheet.getRange(1, 1, 1, sheet.getMaxColumns());
  headerRange.setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold').setFontSize(10);
  sheet.setRowHeight(1, 40);
  stampHeaderCell(sheet, lootHeaders[0]);

  const isBossBannerRow = row => ['⚔️', '🛡️', '🧭', '🧪', '🐊', '🏛️', '👑', '📦'].some(icon => (row[0] || '').toString().startsWith(icon));

  // Data rows: regular weight with the item name bold; text left, ilvls right, badges centred.
  // Alternating fills restart under each boss banner.
  if (fullData.length > 1) {
    const dataRows = fullData.length - 1;
    const rowAlignments = ['left', 'left', 'center', 'center', 'right', 'left', 'center', 'center', 'right', 'center', 'center', 'center', 'left'];
    const rowWeights = lootHeaders.map((_, c) => (c === 1 ? 'bold' : 'normal'));
    sheet.setRowHeights(2, dataRows, 28);
    sheet.getRange(2, 1, dataRows, sheet.getMaxColumns()).setFontSize(9);
    sheet.getRange(2, 1, dataRows, lootHeaders.length)
      .setHorizontalAlignments(Array.from({ length: dataRows }, () => rowAlignments))
      .setFontWeights(Array.from({ length: dataRows }, () => rowWeights))
      .setBackgrounds(zebraBackgrounds(dataRows, lootHeaders.length, i => isBossBannerRow(chaseItemsCatalog[i])));
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
    if (isBossBannerRow(chaseItemsCatalog[i])) {
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
