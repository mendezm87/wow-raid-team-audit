const SHEET_NAME = 'Guild Audit';

 
const AUDIT_SHEET_NAME = SHEET_NAME;

const TALENTS_SHEET_NAME = 'Talents & Builds';

const LOOT_SHEET_NAME = 'Loot & Chase Items';

// ═════════════════════════════════════════════════════════════════════════════════════
// 🏛️ WARCRAFT LOGS GRAPHQL API & SEASON ATTENDANCE ENGINE
// ═════════════════════════════════════════════════════════════════════════════════════

const ATTENDANCE_SHEET_NAME = 'Attendance & History';

const CLASS_COLORS = {
  'Warrior': '#C79C6E', 'Mage': '#3FC7EB', 'Rogue': '#FFF569', 'Paladin': '#F58CBA',
  'Warlock': '#8787ED', 'Shaman': '#0070DE', 'Hunter': '#ABD473', 'Druid': '#FF7D0A',
  'Priest': '#FFFFFF', 'Death Knight': '#C41F3B', 'Monk': '#00FF96',
  'Demon Hunter': '#A330C9', 'Evoker': '#33937F',
};

// Accessible high-contrast WoW Class Colors for rich text rendering on light Google Sheets backgrounds
const CLASS_ACCESSIBLE_COLORS = {
  'Death Knight': '#c41f3b', // Crimson Red
  'Demon Hunter': '#9333ea', // Purple
  'Druid': '#ea580c',        // Sunset Orange
  'Evoker': '#0d9488',       // Emerald Teal
  'Hunter': '#4d7c0f',       // Forest Olive Green
  'Mage': '#0284c7',         // Sky Blue
  'Monk': '#059669',         // Jade Green
  'Paladin': '#db2777',      // Pink / Rose
  'Priest': '#475569',       // Silver Slate
  'Rogue': '#b45309',        // Amber Gold
  'Shaman': '#0070de',       // Deep Blue
  'Warlock': '#7c3aed',      // Fel Violet
  'Warrior': '#854d0e'       // Deep Bronze
};

const SPEC_TO_CLASS_MAP = {
  'affliction': 'Warlock', 'demonology': 'Warlock', 'destruction': 'Warlock',
  'arcane': 'Mage', 'fire': 'Mage', 'frost': 'Mage',
  'arms': 'Warrior', 'fury': 'Warrior', 'protection': 'Warrior',
  'assassination': 'Rogue', 'outlaw': 'Rogue', 'subtlety': 'Rogue',
  'augmentation': 'Evoker', 'devastation': 'Evoker', 'preservation': 'Evoker',
  'balance': 'Druid', 'feral': 'Druid', 'guardian': 'Druid', 'restoration': 'Druid',
  'beast mastery': 'Hunter', 'marksmanship': 'Hunter', 'survival': 'Hunter',
  'blood': 'Death Knight', 'unholy': 'Death Knight',
  'brewmaster': 'Monk', 'mistweaver': 'Monk', 'windwalker': 'Monk',
  'discipline': 'Priest', 'holy': 'Priest', 'shadow': 'Priest',
  'elemental': 'Shaman', 'enhancement': 'Shaman',
  'havoc': 'Demon Hunter', 'vengeance': 'Demon Hunter', 'devourer': 'Demon Hunter',
  'retribution': 'Paladin'
};

const ALL_WOW_SPECS = [
  'Affliction', 'Arcane', 'Arms', 'Assassination', 'Augmentation',
  'Balance', 'Beast Mastery', 'Blood', 'Brewmaster', 'Demonology',
  'Destruction', 'Devastation', 'Devourer', 'Discipline', 'Elemental', 'Enhancement',
  'Feral', 'Fire', 'Frost', 'Fury', 'Guardian',
  'Havoc', 'Holy', 'Marksmanship', 'Mistweaver', 'Outlaw',
  'Preservation', 'Protection', 'Restoration', 'Retribution', 'Shadow',
  'Subtlety', 'Survival', 'Unholy', 'Vengeance', 'Windwalker'
];

const COMMON_TIME_ZONES = [
  'America/Los_Angeles (Pacific PT)',
  'America/Denver (Mountain MT)',
  'America/Chicago (Central CT)',
  'America/New_York (Eastern ET)',
  'America/Anchorage (Alaska AKT)',
  'Pacific/Honolulu (Hawaii HT)',
  'Europe/London (GMT / BST)',
  'Europe/Paris (CET / CEST)',
  'Australia/Sydney (AEST / AEDT)',
  'UTC'
];

const COMMON_HOURS = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
];

const COMMON_MINUTES = [
  ':00', ':15', ':30', ':45'
];

const COMMON_AM_PM = [
  'PM', 'AM'
];

const SPEC_ALIASES = {
  'ret': 'Retribution', 'prot': 'Protection', 'holy': 'Holy',
  'bm': 'Beast Mastery', 'mm': 'Marksmanship', 'surv': 'Survival',
  'ww': 'Windwalker', 'mw': 'Mistweaver', 'brm': 'Brewmaster',
  'sub': 'Subtlety', 'ass': 'Assassination', 'sin': 'Assassination',
  'destro': 'Destruction', 'demo': 'Demonology', 'aff': 'Affliction',
  'enh': 'Enhancement', 'ele': 'Elemental', 'resto': 'Restoration',
  'blood': 'Blood', 'frost': 'Frost', 'unholy': 'Unholy',
  'balance': 'Balance', 'boomy': 'Balance', 'boomkin': 'Balance', 'feral': 'Feral', 'bear': 'Guardian',
  'havoc': 'Havoc', 'veng': 'Vengeance',
  'dev': 'Devastation', 'aug': 'Augmentation', 'pres': 'Preservation'
};

const ROSTER_ROLES = [
  '👑 Veteran',
  '⚔️ Raider',
  '🛡️ Trial'
];
