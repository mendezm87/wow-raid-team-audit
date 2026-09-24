// --- END CONFIGURATION ---

// --- LOOT TABLE DIFFICULTY (Heroic / Mythic) ---
// Stored in Script Properties so the choice persists between runs. Toggle via the Guild Audit menu.
const LOOT_DIFFICULTY_PROPERTY = 'loot_difficulty';

const BASE_CATALOG_ILVL = VAULT_MAPPING.raid.heroic;

 // Catalog rows are authored at Heroic ilvl

function getLootDifficulty() {
  const stored = (PropertiesService.getScriptProperties().getProperty(LOOT_DIFFICULTY_PROPERTY) || 'heroic').toLowerCase();
  return stored === 'mythic'
    ? { key: 'mythic', label: 'Mythic', ilvl: VAULT_MAPPING.raid.mythic }
    : { key: 'heroic', label: 'Heroic', ilvl: VAULT_MAPPING.raid.heroic };
}

/**
 * Re-labels Heroic catalog rows to the active loot difficulty, shifting drop ilvl by the
 * same offset (e.g. a Heroic 321 end-boss item becomes 321 + (Mythic - Heroic)).
 */
function applyLootDifficultyToCatalog(catalog, difficulty) {
  if (!catalog || difficulty.key === 'heroic') return catalog;
  return catalog.map(row => {
    if (row[3] !== 'Heroic') return row;
    const updated = row.slice();
    const baseIlvl = Number(row[4]) || BASE_CATALOG_ILVL;
    updated[3] = difficulty.label;
    updated[4] = difficulty.ilvl + (baseIlvl - BASE_CATALOG_ILVL);
    return updated;
  });
}

/**
 * Flips the Loot & Chase Items table between Heroic and Mythic drops and rebuilds the sheet.
 */
function toggleLootDifficulty() {
  const ui = SpreadsheetApp.getUi();
  const current = getLootDifficulty();
  const next = current.key === 'mythic' ? 'heroic' : 'mythic';
  const response = ui.alert(
    'Switch Loot Difficulty?',
    `Loot table is currently set to ${current.label}.

Switch to ${next === 'mythic' ? 'Mythic' : 'Heroic'} and rebuild the "${LOOT_SHEET_NAME}" sheet?

Note: previously imported sims were run at ${current.label} ilvl. Re-sim with the matching Droptimizer preset for accurate % upgrades.`,
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) return;

  PropertiesService.getScriptProperties().setProperty(LOOT_DIFFICULTY_PROPERTY, next);
  createLootAndChaseItemsSheet();
  ui.alert('Loot Difficulty Updated', `Loot & Chase Items now shows ${getLootDifficulty().label} drops (${getLootDifficulty().ilvl} ilvl).`, ui.ButtonSet.OK);
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

  const ENCOUNTERS = SEASON.bosses.map((b, i) => ({ id: b.encounterId, name: `Boss ${i + 1}: ${b.name}`, banner: b.banner }));

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
          let slot = mapBlizzardInvTypeToSlot(invType);

          // Detect this season's Tier Set Tokens (see SEASON.tierTokenKeywords)
          const isTierToken = SEASON.tierTokenKeywords.some(k => itemName.toLowerCase().includes(k)) || itemName.toLowerCase().includes('tier');
          if (isTierToken) {
            if (itemName.toLowerCase().includes('helm') || itemName.toLowerCase().includes('warhelm') || itemName.toLowerCase().includes('head')) slot = 'Head';
            else if (itemName.toLowerCase().includes('shoulder') || itemName.toLowerCase().includes('pauldrons')) slot = 'Shoulders';
            else if (itemName.toLowerCase().includes('chest') || itemName.toLowerCase().includes('bulwark') || itemName.toLowerCase().includes('curio')) slot = 'Chest';
            else if (itemName.toLowerCase().includes('hands') || itemName.toLowerCase().includes('gauntlets')) slot = 'Hands';
            else if (itemName.toLowerCase().includes('legs') || itemName.toLowerCase().includes('greaves')) slot = 'Legs';
          }

          // Omit cosmetics, junk, pets, mounts, toys, recipes, reagents, consumables, quest items
          const isExcludedType = !isTierToken && ['junk', 'mount', 'companion pets', 'pet', 'toy', 'holiday', 'recipe', 'reagent', 'housing', 'decor', 'consumable', 'currency', 'cosmetic', 'quest', 'profession'].some(ex => subclassName.includes(ex) || itemClassName.includes(ex));
          const isExcludedQuality = qualityType === 'COSMETIC' || qualityType === 'POOR';
          const isNonEquip = !isTierToken && (invType === 'NON_EQUIP' || slot === 'Gear');

          // Strictly include ONLY valid, equippable raid armor, weapons, tier tokens, and accessories
          if ((isTierToken || (!isExcludedType && !isExcludedQuality && !isNonEquip)) && (itemClassId === 2 || itemClassId === 4 || isTierToken)) {
            let cleanSubclass = isTierToken ? `All Classes (Tier ${slot})` : ((itemData.item_subclass && itemData.item_subclass.name) ? itemData.item_subclass.name : 'All Specs');
            
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

// --- LOOT TABLE CACHE ---
// The Blizzard Journal fetch is ~100 HTTP calls and the raid's loot doesn't change mid-season, so the result
// is kept in Script Properties (chunked: each property value is limited to ~9 KB) and refreshed weekly.
const LOOT_CACHE_META_KEY = 'loot_table_cache_meta';

const LOOT_CACHE_CHUNK_PREFIX = 'loot_table_cache_';

const LOOT_CACHE_CHUNK_SIZE = 8000;

const LOOT_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function readLootTableCache() {
  const props = PropertiesService.getScriptProperties();
  try {
    const meta = JSON.parse(props.getProperty(LOOT_CACHE_META_KEY) || 'null');
    if (!meta || meta.raidName !== SEASON.raidName) return null; // New season: ignore old cache
    let json = '';
    for (let i = 0; i < meta.chunks; i++) {
      const part = props.getProperty(LOOT_CACHE_CHUNK_PREFIX + i);
      if (part === null) return null;
      json += part;
    }
    return { savedAt: meta.savedAt, catalog: JSON.parse(json) };
  } catch (e) {
    Logger.log('Loot table cache unreadable, ignoring: ' + e);
    return null;
  }
}

function writeLootTableCache(catalog) {
  const props = PropertiesService.getScriptProperties();
  const json = JSON.stringify(catalog);
  const oldMeta = JSON.parse(props.getProperty(LOOT_CACHE_META_KEY) || 'null');
  const chunks = {};
  let count = 0;
  for (let i = 0; i < json.length; i += LOOT_CACHE_CHUNK_SIZE) {
    chunks[LOOT_CACHE_CHUNK_PREFIX + count++] = json.slice(i, i + LOOT_CACHE_CHUNK_SIZE);
  }
  chunks[LOOT_CACHE_META_KEY] = JSON.stringify({ savedAt: Date.now(), chunks: count, raidName: SEASON.raidName });
  props.setProperties(chunks);
  // Remove leftover chunks if the previous cache was longer
  for (let i = count; oldMeta && i < oldMeta.chunks; i++) props.deleteProperty(LOOT_CACHE_CHUNK_PREFIX + i);
}

/**
 * Returns the raid loot catalog: the weekly cache when fresh, otherwise a live Blizzard fetch (saved to the
 * cache). If Blizzard is unreachable, a stale cache is better than nothing; null means use the offline catalog.
 */
function getRaidLootTable(config, forceRefresh) {
  const cached = readLootTableCache();
  if (!forceRefresh && cached && Date.now() - cached.savedAt < LOOT_CACHE_MAX_AGE_MS) {
    return cached.catalog;
  }

  let live = null;
  try {
    const token = getAccessToken(config);
    live = token ? fetchLiveBlizzardRaidLootTable(config, token) : null;
  } catch (e) {
    Logger.log('Live loot table fetch failed: ' + e);
  }
  if (live && live.length > 0) {
    writeLootTableCache(live);
    return live;
  }
  return cached ? cached.catalog : null;
}

/**
 * Menu action: re-downloads the loot table from Blizzard now (e.g. after a hotfix adds items) and rebuilds the sheet.
 */
function refreshLootTableFromBlizzard() {
  const config = getConfigurationFromSheet();
  if (!config) return;
  const live = getRaidLootTable(config, true);
  const cached = readLootTableCache();
  const fresh = cached && Date.now() - cached.savedAt < 60 * 1000;
  createLootAndChaseItemsSheet();
  notifyUser(
    fresh ? 'Loot Table Refreshed' : 'Blizzard Unavailable',
    fresh ? `Downloaded ${live.length} loot rows from Blizzard and rebuilt "${LOOT_SHEET_NAME}".`
          : `Could not reach the Blizzard API, so "${LOOT_SHEET_NAME}" was rebuilt from the ${cached ? 'last saved' : 'offline'} loot table.`
  );
}
