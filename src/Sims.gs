/**
 * Reads the contender rankings an earlier import wrote into a Loot sheet notes cell, e.g.
 * "Raidbots Sim Upgrades: 1. Name [Score: 4.62] (+4.20% [Tier Catalyzed] | 👑 Veteran | 100%) | 2. ..."
 * (also the "Sim / QE Live Upgrades:" form), so a new import merges with everyone's earlier sims
 * instead of replacing them. Only raiders in rosterNames (lowercase) are kept.
 */
function parseSimUpgradeNotes_(notes, rosterNames) {
  const text = (notes || '').toString();
  const prefixMatch = text.match(/(Raidbots Sim Upgrades:|Sim \/ QE Live Upgrades:)([\s\S]*)/);
  if (!prefixMatch) return [];
  const entries = [];
  const re = /(?:^|\|)\s*\d+\.\s*([A-Za-z0-9\u00C0-\u024F]+)(?:\s*\[Score:[^\]]*\])?\s*\(\+([0-9.]+)%([^)]*)\)/g;
  let m;
  while ((m = re.exec(prefixMatch[2])) !== null) {
    if (rosterNames && !rosterNames.has(m[1].toLowerCase())) continue;
    entries.push({ name: m[1], pct: parseFloat(m[2]), isCatalyzed: m[3].includes('Tier Catalyzed') });
  }
  return entries;
}

function notOnRosterMessage_(names) {
  const list = names.join(', ');
  return `${list} ${names.length === 1 ? 'is' : 'are'} not a main character on the Config sheet, so the sim was not added. Ask an officer to add ${names.length === 1 ? 'them' : 'these raiders'} to the Config roster, then re-post the link.`;
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
  return withScriptLock(() => ingestRaidbotsSims_(input));
}

function ingestRaidbotsSims_(input) {
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
  const hasRunnersColumn = lootRowHasRunnersColumn_(values);
  const equippedNotes = new Array(values.length).fill('');

  // Only raiders listed as mains on the Config sheet count for loot
  const rosterNames = getRosterMainNamesSet(ss);

  // Build itemUpgradeMap
  const itemUpgradeMap = {};
  values.forEach(row => {
    const itemName = (row[1] || '').toString().trim();
    if (!itemName || row[0].toString().startsWith('⚔️') || row[0].toString().startsWith('🛡️') || row[0].toString().startsWith('🧭') || row[0].toString().startsWith('🧪') || row[0].toString().startsWith('🐊') || row[0].toString().startsWith('🏛️') || row[0].toString().startsWith('👑') || row[0].toString().startsWith('📦')) {
      return;
    }
    // Keep everyone's earlier sims (roster mains only) so this import merges instead of replacing them
    itemUpgradeMap[itemName] = parseSimUpgradeNotes_(lootRowContenderText_(row), rosterNames);
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
  const lootDifficulty = getLootDifficulty();

  const processedPlayers = [];
  const topUpgradesSummary = [];

  const altNamesSet = getAltNamesSet(ss);

  // 1. Deduplicate by character name: strictly keep only the single most recent sim report per character!
  const latestSimsByPlayer = {};
  const skippedNotOnRoster = [];
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
      if (!skippedNotOnRoster.includes(playerName)) skippedNotOnRoster.push(playerName);
      return;
    }
    // Only raiders on the Config roster count
    if (!rosterNames.has(lower)) {
      Logger.log(`Skipping sim from ${playerName}: not a main character on the Config sheet`);
      if (!skippedNotOnRoster.includes(playerName)) skippedNotOnRoster.push(playerName);
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
  if (dedupedSimDataList.length === 0) {
    return {
      success: false,
      error: skippedNotOnRoster.length > 0 ? notOnRosterMessage_(skippedNotOnRoster) : 'No usable sims found in the report.'
    };
  }

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
        if (it.sourceItem && it.sourceItem.id && it.sourceItem.name) {
          itemMap[it.sourceItem.id] = it.sourceItem.name;
        }
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

    // Path A: Profilesets results (with automatic Revival Catalyst tier resolution)
    if (simData.sim && simData.sim.profilesets && Array.isArray(simData.sim.profilesets.results)) {
      simData.sim.profilesets.results.forEach(res => {
        const profileName = (res.name || '').toString();
        const parts = profileName.split('/');
        let mainItemId = null;
        let sourceItemId = null;
        let resolvedItemName = '';
        let resolvedSlot = '';
        let resolvedSource = '';
        let isCatalyzed = false;

        if (parts.length >= 4) {
          mainItemId = parseInt(parts[3], 10);
          if (parts.length > 7) {
            for (let i = 7; i < parts.length; i++) {
              const sid = parseInt(parts[i], 10);
              if (sid && itemMap[sid]) {
                sourceItemId = sid;
                break;
              }
            }
          }
        }

        // If this was a catalyzed raid drop, map the upgrade to the actual drop that falls in the raid!
        const dropItemId = sourceItemId || mainItemId;
        if (dropItemId && itemMap[dropItemId]) {
          resolvedItemName = itemMap[dropItemId];
          resolvedSlot = slotMap[dropItemId] || slotMap[mainItemId] || '';
          resolvedSource = sourceMap[dropItemId] || sourceMap[mainItemId] || '';
          isCatalyzed = !!sourceItemId;
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
              existing.isCatalyzed = isCatalyzed;
            } else {
              itemsToProcess.push({
                name: resolvedItemName,
                pct: parseFloat(pct.toFixed(2)),
                slot: resolvedSlot,
                source: resolvedSource,
                isCatalyzed: isCatalyzed
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
          simItem.source || SEASON.raidName,
          simItem.name,
          simItem.slot || 'Gear',
          lootDifficulty.label,
          lootDifficulty.ilvl,
          'All Eligible',
          '', '', '', '',
          'Raid Drop',
          simStatusBadge,
          ''
        ]);
      }

      const existingIdx = itemUpgradeMap[matchedCatalogKey].findIndex(e => e.name.toLowerCase() === playerName.toLowerCase());
      if (existingIdx >= 0) {
        if (simItem.pct > itemUpgradeMap[matchedCatalogKey][existingIdx].pct) {
          itemUpgradeMap[matchedCatalogKey][existingIdx].pct = simItem.pct;
          itemUpgradeMap[matchedCatalogKey][existingIdx].isCatalyzed = simItem.isCatalyzed;
        }
      } else {
        itemUpgradeMap[matchedCatalogKey].push({
          name: playerName,
          pct: simItem.pct,
          isCatalyzed: simItem.isCatalyzed
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
  values.forEach((row, rowIndex) => {
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
          const cCat = c.isCatalyzed ? ' [Tier Catalyzed]' : '';
          const cRole = c.priority.role ? ` | ${c.priority.role}` : '';
          const cAtt = c.priority.attPct ? ` | ${c.priority.attPct}` : '';
          const cPrep = (!c.priority.isRaidReady) ? ' | ⚠️ Unenchanted' : '';
          return `${i + 1}. ${c.name} [Score: ${c.priority.score}] (+${c.pct}%${cCat}${cRole}${cAtt}${cPrep})`;
        });
        writeLootContenderColumns_(row, hasRunnersColumn, 'Raidbots Sim Upgrades:', topList);

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
          row[7] = compactGearText(currentSlotText);
          row[8] = extractIlvl(currentSlotText) || '-';
          equippedNotes[rowIndex] = currentSlotText && currentSlotText !== '-' ? currentSlotText : '';
        }
        totalMatches++;
      }
    }
  });

  // Save back all updated and newly registered items
  sheet.getRange(2, 1, values.length, values[0].length).setValues(values);
  sheet.getRange(2, 7, values.length, 2).setHorizontalAlignment('left');
  sheet.getRange(2, 13, values.length, hasRunnersColumn ? 2 : 1).setHorizontalAlignment('left');
  sheet.getRange(2, 8, values.length, 1).setNotes(equippedNotes.map(text => [text || '']));

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
  if (hasRunnersColumn) {
    const richRunnersUp = values.map(row => [buildRichTextWithClassColors((row[13] || '').toString(), rosterContextMap)]);
    sheet.getRange(2, 14, richRunnersUp.length, 1).setRichTextValues(richRunnersUp);
  }

  applyLootColumnLayout_(sheet);

  return {
    success: true,
    reportsProcessed: successCount,
    players: processedPlayers,
    itemsMapped: totalMatches,
    topUpgrades: topUpgradesSummary,
    skippedNotOnRoster: skippedNotOnRoster,
    message: `Successfully mapped DPS upgrades for ${processedPlayers.join(', ')} across ${totalMatches} raid items.` +
      (skippedNotOnRoster.length > 0 ? ` Skipped (not on the Config roster): ${skippedNotOnRoster.join(', ')}.` : '')
  };
}

/**
 * Ingests a Questionably Epic Live (QE Live) Upgrade Report for Healers.
 * Excludes Personal Loot / Bonus Roll items ('dropType === bonus').
 * Maps raid item HPS upgrades directly to the Loot & Chase Items sheet.
 */
function processAndIngestQELiveReport(reportUrlOrId) {
  return withScriptLock(() => ingestQELiveReport_(reportUrlOrId));
}

function ingestQELiveReport_(reportUrlOrId) {
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
    return { success: false, error: `${playerName} is listed as an alt on the Config sheet, so the report was not added. Sims only count for main characters.` };
  }
  const rosterNames = getRosterMainNamesSet(sheet.getParent());
  if (!rosterNames.has(playerName.toLowerCase())) {
    Logger.log(`Skipping QE Live report from ${playerName}: not a main character on the Config sheet`);
    return { success: false, error: notOnRosterMessage_([playerName]) };
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
  const hasRunnersColumn = lootRowHasRunnersColumn_(values);
  const equippedNotes = new Array(values.length).fill('');

  // Read itemUpgradeMap from existing sheet rows
  const itemUpgradeMap = {};
  values.forEach((row, rowIndex) => {
    const itemName = (row[1] || '').toString().trim();
    if (itemName && !itemName.startsWith('═══')) {
      // Keep everyone else's earlier sims (roster mains only); this healer's newest report replaces their old one
      itemUpgradeMap[itemName] = parseSimUpgradeNotes_(lootRowContenderText_(row), rosterNames)
        .filter(e => e.name.toLowerCase() !== playerName.toLowerCase());
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
  values.forEach((row, rowIndex) => {
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
        });
        writeLootContenderColumns_(row, hasRunnersColumn, 'Sim / QE Live Upgrades:', topList);

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
          row[7] = compactGearText(currentSlotText);
          row[8] = extractIlvl(currentSlotText) || '-';
          equippedNotes[rowIndex] = currentSlotText && currentSlotText !== '-' ? currentSlotText : '';
        }

        totalMatches++;
      }
    }
  });

  // Save back all updated values
  sheet.getRange(2, 1, values.length, values[0].length).setValues(values);
  sheet.getRange(2, 7, values.length, 2).setHorizontalAlignment('left');
  sheet.getRange(2, 13, values.length, hasRunnersColumn ? 2 : 1).setHorizontalAlignment('left');
  sheet.getRange(2, 8, values.length, 1).setNotes(equippedNotes.map(text => [text || '']));

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
  if (hasRunnersColumn) {
    const richRunnersUp = values.map(row => [buildRichTextWithClassColors((row[13] || '').toString(), rosterContextMap)]);
    sheet.getRange(2, 14, richRunnersUp.length, 1).setRichTextValues(richRunnersUp);
  }

  applyLootColumnLayout_(sheet);

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
 * Connects directly to Discord REST API using the Bot Token, fetches the latest messages
 * from the Sims channel, extracts all Raidbots / QE Live reports, deduplicates to the latest per player,
 * and updates the Loot & Chase Items sheet in one single click without having to resend them!
 */
function syncLatestSimsFromDiscord() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  let token = props.getProperty('DISCORD_BOT_TOKEN');
  let channelId = props.getProperty('SIMS_CHANNEL_ID');

  // Check Config sheet if not in script properties
  const configSheet = ss.getSheetByName('Config') || ss.getSheetByName('config');
  if (configSheet) {
    const data = configSheet.getDataRange().getValues();
    data.forEach(r => {
      const k = (r[0] || '').toString().trim().toUpperCase();
      const v = (r[1] || '').toString().trim();
      if (k === 'DISCORD_BOT_TOKEN' && v) token = v;
      if (k === 'SIMS_CHANNEL_ID' && v) channelId = v;
    });
  }

  if (!token || !channelId) {
    const promptRes = ui.prompt(
      'Discord Bot Configuration',
      'Enter your Discord Bot Token & Sims Channel ID (separated by a comma or newline):\nFormat: <BOT_TOKEN>, <CHANNEL_ID>',
      ui.ButtonSet.OK_CANCEL
    );
    if (promptRes.getSelectedButton() !== ui.Button.OK) return;
    const input = promptRes.getResponseText().trim();
    const parts = input.split(/[\s,;\n]+/);
    if (parts.length >= 2) {
      token = parts[0];
      channelId = parts[1];
      props.setProperty('DISCORD_BOT_TOKEN', token);
      props.setProperty('SIMS_CHANNEL_ID', channelId);
    } else {
      ui.alert('❌ Error', 'Please provide both the Discord Bot Token and Channel ID.', ui.ButtonSet.OK);
      return;
    }
  }

  ss.toast('Connecting to Discord and retrieving channel sim history...', '📡 Discord Sync', 5);

  try {
    const res = UrlFetchApp.fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=100`, {
      headers: {
        'Authorization': `Bot ${token}`,
        'User-Agent': 'DiscordBot (https://github.com/mendezm87/wow-raid-team-audit, 1.0.0)'
      },
      muteHttpExceptions: true
    });

    if (res.getResponseCode() !== 200) {
      ui.alert('❌ Discord API Error', `Failed to connect to Discord (HTTP ${res.getResponseCode()}):\n${res.getContentText()}`, ui.ButtonSet.OK);
      return;
    }

    const messages = JSON.parse(res.getContentText());
    const rbRegex = /https?:\/\/(?:www\.)?raidbots\.com\/(?:simbot\/)?report\/([A-Za-z0-9_-]{10,35})/gi;
    const qeRegex = /https?:\/\/(?:www\.)?(?:questionablyepic\.com|qe-live\.com)\/(?:live|ptr)\/upgradereport\/([A-Za-z0-9_-]{8,35})/gi;

    const simUrls = [];
    messages.forEach(msg => {
      const content = msg.content || '';
      let match;
      while ((match = rbRegex.exec(content)) !== null) {
        const id = match[1];
        const url = `https://www.raidbots.com/simbot/report/${id}`;
        if (!simUrls.includes(url)) simUrls.push(url);
      }
      while ((match = qeRegex.exec(content)) !== null) {
        const id = match[1];
        const url = `https://questionablyepic.com/live/upgradereport/${id}`;
        if (!simUrls.includes(url)) simUrls.push(url);
      }
    });

    if (simUrls.length === 0) {
      ui.alert('⚠️ No Sims Found', 'No Raidbots or QE Live sim links were found in the recent messages of that channel.', ui.ButtonSet.OK);
      return;
    }

    ss.toast(`Found ${simUrls.length} sim links. Ingesting and recalculating rankings...`, '📥 Processing Sims', 10);
    const result = processUniversalSimOrReport(simUrls.join('\n'));

    if (result && result.success) {
      ui.alert('🎉 Discord Sync Complete!', `Successfully retrieved ${simUrls.length} sim reports from Discord and updated the Loot & Chase Items sheet!\n\n${result.message || ''}`, ui.ButtonSet.OK);
    } else {
      ui.alert('⚠️ Partial Sync', `Retrieved sim links but encountered an issue during ingestion:\n${result ? result.error : 'Unknown error'}`, ui.ButtonSet.OK);
    }
  } catch (err) {
    ui.alert('❌ Sync Error', `Failed to sync sims from Discord: ${err.message}`, ui.ButtonSet.OK);
  }
}

/**
 * The Loot sheet keeps the top pick in "Loot Council Notes" and the rest in "Runners-Up".
 * Older sheets have no Runners-Up column, so the whole list stays in the notes column there.
 */
function lootRowHasRunnersColumn_(values) {
  return values.length > 0 && values[0].length > 13;
}

/** Full ranked contender list for a row, however it is split across the two columns. */
function lootRowContenderText_(row) {
  return [(row[12] || '').toString(), (row[13] || '').toString()].filter(Boolean).join(' | ');
}

/** Writes a ranked list back across Notes / Runners-Up, keeping any "Blizzard ID:" lead-in. */
function writeLootContenderColumns_(row, hasRunners, prefix, entries) {
  const idMatch = (row[12] || '').toString().match(/Blizzard ID:\s*\d+/i);
  const leadIn = [idMatch ? idMatch[0] : '', prefix].filter(Boolean).join(' \u00b7 ');
  if (hasRunners) {
    row[12] = [leadIn, entries[0] || ''].filter(Boolean).join(' ').trim();
    row[13] = entries.slice(1).join(' | ');
  } else {
    row[12] = [leadIn, entries.join(' | ')].filter(Boolean).join(' ').trim();
  }
}
