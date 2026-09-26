// --- VAULT & SEASON CONFIGURATION (Midnight Season 2 - Patch 12.1) ---
// Great Vault reward ilvls, cross-checked against wowaudit's live season table
// (https://wowaudit.com/, `page_info.currentSeason.great_vault`) on 2026-09-26.
// These are the VAULT reward ilvls, not the end-of-dungeon / end-of-boss drop ilvls,
// which are lower. Verify this block against wowaudit at the start of every season.
const VAULT_MAPPING = {
  raid: {
      mythic: 334, // Mythic raid vault (344 is personal loot only, not boss/raid loot)
      heroic: 318, // Heroic raid vault
      normal: 305, // Normal raid vault
      lfr: 292     // LFR raid vault
  },
  mplus: {
      20: 318, 19: 318, 18: 318, 17: 318, 16: 318, 15: 318, 14: 318,
      13: 318, 12: 318, 11: 318, 10: 318, // Caps at 318 for keystone 10 and above
      9: 311, 8: 311, 7: 311, 6: 311,     // 311 for keystones 6-9
      5: 308, 4: 308,                     // 308 for keystones 4-5
      3: 305, 2: 305,                     // 305 for keystones 2-3
      1: 302,                             // 302 for keystone 1
      0: 289                              // 289 for Mythic 0
  },
  // Delve vault slots (tiers 1-11). Not populated today: the Blizzard character API
  // exposes no delve progress, so nothing fills these. Kept here so the reward ilvls
  // are recorded in one place if a source ever appears.
  delve: {
      11: 305, 10: 305, 9: 305, 8: 305,
      7: 302, 6: 298, 5: 292,
      4: 289, 3: 285, 2: 282, 1: 272
  }
};

// --- CURRENT RAID SEASON (update this block when a new season starts) ---
// Boss order = journal order. `name` must match the Warcraft Logs fight name (used for attendance),
// `encounterId` is the Blizzard Journal encounter ID (used for the live loot table),
// `short`/`archonSlug` drive the Talents sheet boss dropdown and Archon build links.
const SEASON = {
  name: 'Midnight Season 2',
  raidName: 'The Venomous Abyss',
  tierTokenKeywords: ['consecrated flame', 'curio'], // Name fragments that identify this season's tier tokens
  bosses: [
    { encounterId: 2888, name: "Nek'zali the Soulcoiler", short: "Nek'zali", archonSlug: 'nekzali', banner: "⚔️ BOSS 1: NEK'ZALI THE SOULCOILER" },
    { encounterId: 2874, name: 'Entombed Sentinels', short: 'Sentinels', archonSlug: 'sentinels', banner: '🛡️ BOSS 2: ENTOMBED SENTINELS' },
    { encounterId: 2894, name: 'The Lost Explorers', short: 'Explorers', archonSlug: 'explorers', banner: '🧭 BOSS 3: THE LOST EXPLORERS' },
    { encounterId: 2882, name: 'Vashnik the Malignant', short: 'Vashnik', archonSlug: 'vashnik', banner: '🧪 BOSS 4: VASHNIK THE MALIGNANT' },
    { encounterId: 2871, name: 'Sszorak', short: 'Sszorak', archonSlug: 'sszorak', banner: '🐊 BOSS 5: SSZORAK' },
    { encounterId: 2887, name: 'The Twin Fangs', short: 'The Twin Fangs', archonSlug: 'the-twin-fangs', banner: '⚔️ BOSS 6: THE TWIN FANGS' },
    { encounterId: 2883, name: 'The Coiled Altar', short: 'The Coiled Altar', archonSlug: 'the-coiled-altar', banner: '🏛️ BOSS 7: THE COILED ALTAR' },
    { encounterId: 2895, name: "Ula'tek", short: "Ula'tek", archonSlug: 'ulatek', banner: "👑 BOSS 8: ULA'TEK (FINAL BOSS)" }
  ],
  // Extra Archon build pages that aren't bosses in the raid above (dropdown only)
  archonExtraBosses: [
    { short: 'Nymrissa', archonSlug: 'nymrissa' }
  ]
};

// Offline fallback loot table for the current raid (used when the Blizzard Journal API is unavailable).
// Columns match the Loot & Chase Items sheet; rows are authored at Heroic ilvl.
const FALLBACK_LOOT_CATALOG = [
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
