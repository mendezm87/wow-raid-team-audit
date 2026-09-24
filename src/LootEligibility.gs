/**
 * Canonical dictionary mapping all raid weapons in Season 2 to their exact Blizzard API weapon subclass and stat profile.
 * Sourced directly from Blizzard Game Data API (/data/wow/item/{id}).
 */
const RAID_WEAPON_SUBCLASS_MAP = {
  'caustic keeper crusher': { type: 'mace', is2H: true, is1H: false, stat: 'str/agi', blizzardSubclass: 'Two-Handed Maces' },
  'caustic keeper-crusher': { type: 'mace', is2H: true, is1H: false, stat: 'str/agi', blizzardSubclass: 'Two-Handed Maces' },
  'malignant toothed edge': { type: 'axe', is2H: false, is1H: true, stat: 'str/agi', blizzardSubclass: 'One-Handed Axes' },
  'vashnik\'s sanguine rancor': { type: 'dagger', is2H: false, is1H: true, stat: 'agi', blizzardSubclass: 'Daggers' },
  'vashniks sanguine rancor': { type: 'dagger', is2H: false, is1H: true, stat: 'agi', blizzardSubclass: 'Daggers' },
  'abyssal broodfiend\'s bardiche': { type: 'polearm', is2H: true, is1H: false, stat: 'agi/str', blizzardSubclass: 'Polearms' },
  'abyssal broodfiends bardiche': { type: 'polearm', is2H: true, is1H: false, stat: 'agi/str', blizzardSubclass: 'Polearms' },
  'fang carved recurve': { type: 'bow', is2H: true, is1H: false, stat: 'agi', isRanged: true, blizzardSubclass: 'Bows' },
  'fang-carved recurve': { type: 'bow', is2H: true, is1H: false, stat: 'agi', isRanged: true, blizzardSubclass: 'Bows' },
  'maze roa warlord\'s fury': { type: 'axe', is2H: true, is1H: false, stat: 'str', blizzardSubclass: 'Two-Handed Axes' },
  'maze-roa, warlord\'s fury': { type: 'axe', is2H: true, is1H: false, stat: 'str', blizzardSubclass: 'Two-Handed Axes' },
  'altar keeper\'s censer': { type: 'off-hand', is2H: false, is1H: false, stat: 'int', isOffhand: true, blizzardSubclass: 'Miscellaneous (Off-Hand)' },
  'altar-keeper\'s censer': { type: 'off-hand', is2H: false, is1H: false, stat: 'int', isOffhand: true, blizzardSubclass: 'Miscellaneous (Off-Hand)' },
  'aman\'muso, warlord\'s vengeance': { type: 'staff', is2H: true, is1H: false, stat: 'agi/int', blizzardSubclass: 'Staves' },
  'amanmuso warlords vengeance': { type: 'staff', is2H: true, is1H: false, stat: 'agi/int', blizzardSubclass: 'Staves' },
  'jan\'thrazet, the soul fang': { type: 'dagger', is2H: false, is1H: true, stat: 'int', blizzardSubclass: 'Daggers' },
  'janthrazet the soul fang': { type: 'dagger', is2H: false, is1H: true, stat: 'int', blizzardSubclass: 'Daggers' },
  'ravenous feaster\'s fang': { type: 'dagger', is2H: false, is1H: true, stat: 'agi', blizzardSubclass: 'Daggers' },
  'ravenous feasters fang': { type: 'dagger', is2H: false, is1H: true, stat: 'agi', blizzardSubclass: 'Daggers' },
  'zul\'valok, breath of corruption': { type: 'dagger', is2H: false, is1H: true, stat: 'agi', blizzardSubclass: 'Daggers' },
  'zulvalok breath of corruption': { type: 'dagger', is2H: false, is1H: true, stat: 'agi', blizzardSubclass: 'Daggers' },
  'jaws of the shackled goddess': { type: 'sword', is2H: false, is1H: true, stat: 'str/agi', blizzardSubclass: 'One-Handed Swords' }
};

/**
 * Official Blizzard Item Class 2 (Weapon) Subclasses (/data/wow/item-class/2/item-subclass)
 * Subclass IDs 0 through 20 (21 total weapon subclasses).
 */
const BLIZZARD_WEAPON_SUBCLASSES = {
  0:  { id: 0,  name: 'One-Handed Axes',   key: 'axe',      is2H: false, is1H: true },
  1:  { id: 1,  name: 'Two-Handed Axes',   key: '2h axe',   is2H: true,  is1H: false },
  2:  { id: 2,  name: 'Bows',              key: 'bow',      is2H: true,  is1H: false, isRanged: true },
  3:  { id: 3,  name: 'Guns',              key: 'gun',      is2H: true,  is1H: false, isRanged: true },
  4:  { id: 4,  name: 'One-Handed Maces',  key: 'mace',     is2H: false, is1H: true },
  5:  { id: 5,  name: 'Two-Handed Maces',  key: '2h mace',  is2H: true,  is1H: false },
  6:  { id: 6,  name: 'Polearms',          key: 'polearm',  is2H: true,  is1H: false },
  7:  { id: 7,  name: 'One-Handed Swords', key: 'sword',    is2H: false, is1H: true },
  8:  { id: 8,  name: 'Two-Handed Swords', key: '2h sword', is2H: true,  is1H: false },
  9:  { id: 9,  name: 'Warglaives',        key: 'warglaive',is2H: false, is1H: true },
  10: { id: 10, name: 'Staves',            key: 'staff',    is2H: true,  is1H: false },
  11: { id: 11, name: 'Bear Claws',        key: 'fist',     is2H: false, is1H: true },
  12: { id: 12, name: 'Cat Claws',         key: 'fist',     is2H: false, is1H: true },
  13: { id: 13, name: 'Fist Weapons',      key: 'fist',     is2H: false, is1H: true },
  14: { id: 14, name: 'Miscellaneous',     key: 'off-hand', is2H: false, is1H: false, isOffhand: true },
  15: { id: 15, name: 'Daggers',           key: 'dagger',   is2H: false, is1H: true },
  16: { id: 16, name: 'Thrown',            key: 'ranged',   is2H: false, is1H: true, isRanged: true },
  17: { id: 17, name: 'Spears',            key: 'polearm',  is2H: true,  is1H: false },
  18: { id: 18, name: 'Crossbows',         key: 'crossbow', is2H: true,  is1H: false, isRanged: true },
  19: { id: 19, name: 'Wands',             key: 'wand',     is2H: false, is1H: true },
  20: { id: 20, name: 'Fishing Poles',     key: 'fishing',  is2H: true,  is1H: false }
};

/**
 * Official Blizzard Playable Class Weapon Proficiencies Table (/data/wow/playable-class/{id}).
 */
const BLIZZARD_CLASS_WEAPON_PROFICIENCIES = {
  'mage': ['dagger', 'sword', 'wand', 'staff', 'stave', 'off-hand', 'holdable', 'censer'],
  'warlock': ['dagger', 'sword', 'wand', 'staff', 'stave', 'off-hand', 'holdable', 'censer'],
  'priest': ['dagger', 'mace', 'wand', 'staff', 'stave', 'off-hand', 'holdable', 'censer'],
  'rogue': ['dagger', 'sword', 'axe', 'mace', 'fist', 'claw', 'fang', 'cleaver'],
  'demon hunter': ['warglaive', 'sword', 'axe', 'fist', 'dagger', 'claw', 'fang', 'cleaver'],
  'warrior': ['sword', 'axe', 'mace', 'polearm', 'staff', 'shield', 'fist', 'dagger'],
  'paladin': ['sword', 'axe', 'mace', 'polearm', 'shield'],
  'death knight': ['sword', 'axe', 'mace', 'polearm'],
  'hunter': ['bow', 'gun', 'crossbow', 'polearm', 'staff', 'stave', 'axe', 'sword'],
  'druid': ['dagger', 'mace', 'staff', 'stave', 'polearm', 'fist', 'off-hand', 'holdable'],
  'monk': ['sword', 'axe', 'mace', 'fist', 'staff', 'stave', 'polearm', 'off-hand', 'holdable', 'weapon'],
  'shaman': ['dagger', 'mace', 'axe', 'fist', 'shield', 'staff', 'stave', 'off-hand', 'holdable'],
  'evoker': ['dagger', 'sword', 'axe', 'mace', 'fist', 'staff', 'stave', 'off-hand', 'holdable']
};

/**
 * Validates whether a character is eligible to equip/loot an item based on:
 * 1. Armor Class (Cloth, Leather, Mail, Plate)
 * 2. Blizzard Official Weapon Subclasses & Spec Rules (Polearms, Daggers, Bows, Staves, Axes, Shields, etc.)
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
    // Look up canonical weapon subclass mapping first to avoid reliance on item name keywords
    const cleanKey = itemName.replace(/[\u2018\u2019\u0027\u0060]/g, "'");
    const canonicalWeapon = RAID_WEAPON_SUBCLASS_MAP[cleanKey] || Object.values(RAID_WEAPON_SUBCLASS_MAP).find(w => cleanKey.includes(w.type));

    const prof = BLIZZARD_CLASS_WEAPON_PROFICIENCIES[charClass];
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
    if (targetSubclass.includes('gun') || targetSubclass.includes('bow') || targetSubclass.includes('crossbow') || (canonicalWeapon && canonicalWeapon.isRanged)) {
      return charClass === 'hunter' && !charSpec.includes('survival');
    }
    // Warglaives -> Demon Hunters ONLY
    if (targetSubclass.includes('warglaive') || (canonicalWeapon && canonicalWeapon.type === 'warglaive')) {
      return charClass === 'demon hunter';
    }
    // Wands -> Mages, Warlocks, Priests ONLY
    if (targetSubclass.includes('wand') || (canonicalWeapon && canonicalWeapon.type === 'wand')) {
      return ['mage', 'warlock', 'priest'].includes(charClass);
    }
    // Shields -> Prot/Holy Paladin, Prot Warrior, Ele/Resto Shaman ONLY
    if (targetSubclass.includes('shield') || (canonicalWeapon && canonicalWeapon.type === 'shield')) {
      return (charClass === 'paladin' && ['protection', 'holy'].some(s => charSpec.includes(s))) ||
             (charClass === 'warrior' && charSpec.includes('protection')) ||
             (charClass === 'shaman' && ['elemental', 'restoration'].some(s => charSpec.includes(s)));
    }
    // Caster Off-Hands / Holdable -> Intellect Casters & Healers ONLY
    if (targetSubclass.includes('off-hand') || targetSubclass.includes('off hand') || targetSubclass.includes('holdable') || (canonicalWeapon && canonicalWeapon.isOffhand)) {
      return ['mage', 'warlock', 'priest', 'druid', 'monk', 'shaman', 'evoker'].includes(charClass);
    }
    const weaponType = canonicalWeapon ? canonicalWeapon.type : '';

    // 2H Axes, 2H Swords, 2H Maces -> Str/Agi 2H Melee (Warrior, DK, Ret Paladin, Survival Hunter, Feral/Guardian Druid)
    if (weaponType === 'axe' && canonicalWeapon.is2H || targetSubclass.includes('2h axe') || targetSubclass.includes('2h sword') || targetSubclass.includes('2h mace')) {
      if (['mage', 'warlock', 'priest', 'rogue', 'demon hunter', 'evoker'].includes(charClass)) return false;
      if (charClass === 'hunter' && !charSpec.includes('survival')) return false;
      if (charClass === 'druid' && !['feral', 'guardian'].some(s => charSpec.includes(s))) return false;
      if (charClass === 'paladin' && charSpec.includes('holy')) return false;
      if (charClass === 'shaman') return false;
      if (charClass === 'monk') return false;
    }
    // 1H Axes / Cleavers -> Melee physical classes. NO Pure Casters, NO Ranged Hunters!
    if ((weaponType === 'axe' && canonicalWeapon.is1H) || (!canonicalWeapon && (targetSubclass.includes('axe') || targetSubclass.includes('cleaver')))) {
      if (['mage', 'warlock', 'priest', 'druid'].includes(charClass)) return false;
      if (charClass === 'hunter') return false;
      if (charClass === 'paladin' && charSpec.includes('holy')) return false;
      if (charClass === 'shaman' && !charSpec.includes('enhancement')) return false;
    }
    // Daggers -> Rogue, Mage, Priest, Warlock, Druid, Evoker, Shaman, Devourer DH. NO Plate classes, NO Hunters!
    if (weaponType === 'dagger' || (!canonicalWeapon && targetSubclass.includes('dagger'))) {
      if (['warrior', 'paladin', 'death knight', 'hunter'].includes(charClass)) return false;
      if (charClass === 'demon hunter' && !charSpec.includes('devourer')) return false;
    }
    // Fist Weapons -> Rogue, Monk, DH, Enh Shaman, Druid, Evoker, Warrior. NO Cloth/Paladin/DK/Hunter!
    if (weaponType === 'fist' || (!canonicalWeapon && targetSubclass.includes('fist'))) {
      if (['mage', 'warlock', 'priest', 'paladin', 'death knight', 'hunter'].includes(charClass)) return false;
    }
    // Polearms -> Str/Agi 2H Melee (Warrior, Ret Paladin, Blood/Unholy DK, Survival Hunter, Feral/Guardian Druid, Brew/WW Monk)
    if (weaponType === 'polearm' || (!canonicalWeapon && targetSubclass.includes('polearm'))) {
      if (['mage', 'warlock', 'priest', 'rogue', 'demon hunter', 'evoker', 'shaman'].includes(charClass)) return false;
      if (charClass === 'hunter' && !charSpec.includes('survival')) return false;
      if (charClass === 'paladin' && charSpec.includes('holy')) return false;
    }
    // Staves -> Casters/Healers + Feral/Guardian Druid, Monk, Survival Hunter. NO DK, Paladin, Rogue, Warrior, BM/MM Hunter!
    if (weaponType === 'staff' || (!canonicalWeapon && (targetSubclass.includes('staff') || targetSubclass.includes('stave')))) {
      if (['paladin', 'death knight', 'rogue', 'warrior', 'demon hunter'].includes(charClass)) return false;
      if (charClass === 'hunter' && !charSpec.includes('survival')) return false;
    }
    // 1H Maces -> Paladin, Warrior, DK, Rogue, Monk, Priest, Shaman, Druid, Evoker. NO Mage/Warlock/Hunter/DH!
    if ((weaponType === 'mace' && canonicalWeapon.is1H) || (!canonicalWeapon && targetSubclass.includes('mace') && !targetSubclass.includes('2h'))) {
      if (['mage', 'warlock', 'hunter', 'demon hunter'].includes(charClass)) return false;
    }
    // 1H Swords -> Warrior, Paladin, DK, Rogue, Monk, DH, Mage, Warlock. NO Priest/Shaman/Druid/Hunter!
    if ((weaponType === 'sword' && canonicalWeapon.is1H) || (!canonicalWeapon && targetSubclass.includes('sword') && !targetSubclass.includes('2h'))) {
      if (['priest', 'shaman', 'druid', 'hunter'].includes(charClass)) return false;
    }
  }

  // 3. PRIMARY STAT & ROLE CONSTRAINTS (Weapons, Trinkets, Accessories)
  if (targetSubclass.includes('strength') || targetSubclass.includes('(str') || targetSubclass.includes('str /')) {
    const isStr = ['warrior', 'death knight'].includes(charClass) || (charClass === 'paladin' && !charSpec.includes('holy'));
    if (!isStr && !targetSubclass.includes('agi') && !targetSubclass.includes('int') && !targetSubclass.includes('all')) return false;
  }
  if (targetSubclass.includes('agility') || targetSubclass.includes('(agi') || targetSubclass.includes('/ agi') || targetSubclass.includes('agi /')) {
    const isAgi = ['rogue', 'demon hunter', 'hunter'].includes(charClass) ||
                  (charClass === 'druid' && (charSpec.includes('feral') || charSpec.includes('guardian'))) ||
                  (charClass === 'monk' && !charSpec.includes('mistweaver')) ||
                  (charClass === 'shaman' && charSpec.includes('enhancement'));
    if (!isAgi && !targetSubclass.includes('str') && !targetSubclass.includes('int') && !targetSubclass.includes('all')) return false;
  }
  if (targetSubclass.includes('intellect') || targetSubclass.includes('(int') || targetSubclass.includes('/ int') || targetSubclass.includes('int /') || targetSubclass.includes('caster') || targetSubclass.includes('healer')) {
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
