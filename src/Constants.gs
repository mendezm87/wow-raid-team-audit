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
  'Priest': '#DCE3EC', 'Death Knight': '#C41F3B', 'Monk': '#00FF96',
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

// ═════════════════════════════════════════════════════════════════════════════════════
// 🎨 SHARED SHEET STYLING
// ═════════════════════════════════════════════════════════════════════════════════════

// Guild Audit columns (in sheet order within each group). The groups are collapsible on the sheet.
const AUDIT_GEAR_COLUMNS = [
  'Head', 'Shoulders', 'Chest', 'Hands', 'Legs',
  'Main Hand', 'Off Hand', 'Trinket 1', 'Trinket 2',
  'Neck', 'Back', 'Wrist', 'Waist', 'Feet', 'Ring 1', 'Ring 2'
];
const AUDIT_ENCHANT_COLUMNS = [
  'Enchant Main Hand', 'Enchant Off Hand', 'Enchant Head', 'Enchant Shoulder',
  'Enchant Chest', 'Enchant Legs', 'Enchant Feet', 'Enchant Ring 1', 'Enchant Ring 2'
];
const AUDIT_VAULT_COLUMNS = ['GV Raid 1', 'GV Raid 2', 'GV Raid 3', 'GV M+ 1', 'GV M+ 2', 'GV M+ 3'];

// Raid Ready text for a character the Blizzard Armory didn't return (left the guild, renamed, transferred)
const ARMORY_LOOKUP_FAILED = '⚠️ Armory lookup failed';
// Shown on the Guild Audit sheet when a Config roster name is no longer in the Blizzard guild roster
const NOT_IN_GUILD = '⚠️ Not in guild';

// Related tabs share a colour: gear (Audit + Talents), attendance, loot, setup
const TAB_COLORS = {
  [SHEET_NAME]: '#6366f1',
  [TALENTS_SHEET_NAME]: '#6366f1',
  [ATTENDANCE_SHEET_NAME]: '#10b981',
  'Attendance Archive': '#10b981',
  [LOOT_SHEET_NAME]: '#f59e0b',
  'Config': '#64748b'
};

// Alternating data-row fills
const ZEBRA_COLORS = ['#ffffff', '#f8fafc'];

function applyTabColor(sheet) {
  const color = TAB_COLORS[sheet.getName()];
  if (color) sheet.setTabColor(color);
}

/** "Sep 25, 1:36 AM" in the spreadsheet's time zone, for "last refreshed" stamps. */
function formatRefreshedAt(ss) {
  return Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'MMM d, h:mm a');
}

/**
 * Writes the first header cell as its label with a small grey "↻ <time>" refresh stamp on a second line.
 * An optional extra note (e.g. the Loot sheet's difficulty) follows the time on the stamp line.
 * Code that finds columns by header name must read headers through headerLabel() so the stamp is ignored.
 */
function stampHeaderCell(sheet, label, extra) {
  const text = `${label}\n↻ ${formatRefreshedAt(sheet.getParent())}${extra ? ` · ${extra}` : ''}`;
  const stampStyle = SpreadsheetApp.newTextStyle().setFontSize(7).setBold(false).setForegroundColor('#94a3b8').build();
  const richText = SpreadsheetApp.newRichTextValue()
    .setText(text)
    .setTextStyle(label.length + 1, text.length, stampStyle)
    .build();
  sheet.getRange(1, 1).setRichTextValue(richText).setWrap(true);
}

/** A header cell's label without the refresh stamp stampHeaderCell() adds to the first column. */
function headerLabel(value) {
  return (value || '').toString().split('\n')[0].trim();
}

/** Alternating row fills for a block of rows. Rows where isBlankRow(i) is true stay white and restart the pattern. */
function zebraBackgrounds(numRows, numCols, isBlankRow) {
  const out = [];
  let stripe = 0;
  for (let i = 0; i < numRows; i++) {
    if (isBlankRow && isBlankRow(i)) {
      out.push(new Array(numCols).fill(ZEBRA_COLORS[0]));
      stripe = 0;
      continue;
    }
    out.push(new Array(numCols).fill(ZEBRA_COLORS[stripe % 2]));
    stripe++;
  }
  return out;
}

/**
 * Short Guild Audit gear cell: "[Tier] 334 (Myth 6/6) - Item Name" -> "◆ 334 Myth 6/6".
 * ◆ marks current-season tier, ◇ previous-season tier. The full text goes in the cell's note.
 */
function compactGearText(full) {
  const text = (full || '').toString();
  const m = text.match(/^(\[Tier\] |\[Prev Tier\] )?(\d*) \(([^)]*)\)/);
  if (!m) return text;
  const mark = m[1] === '[Tier] ' ? '◆ ' : (m[1] ? '◇ ' : '');
  const track = m[3] && m[3] !== '-' ? ` ${m[3]}` : '';
  return `${mark}${m[2]}${track}`.trim();
}

/** Short Guild Audit enchant cell: "✓ Rank 2" / "✓" / "Missing" / "N/A". The enchant name goes in the note. */
function compactEnchantText(full) {
  const text = (full || '').toString();
  if (!text || text === '-' || text === 'Missing' || text === 'N/A') return text;
  const rank = text.match(/Tier(\d)/);
  return rank ? `✓ Rank ${rank[1]}` : '✓';
}

/** Readable enchant name for a note: drops the "Enchanted: " prefix and the |A:...|a quality-icon markup. */
function enchantNoteText(full) {
  const text = (full || '').toString();
  if (!text || text === '-' || text === 'Missing' || text === 'N/A') return '';
  return text.replace(/^Enchanted:\s*/, '').replace(/\s*\|A:[^|]*\|a/g, '').trim();
}

/** Label for the row that separates mains from alts on Guild Audit and Talents & Builds. */
const ALTS_BAND_LABEL = '─────  ALTS  ─────';

/** True for the labelled band row that separates mains from alts. */
function isAltsBandLabel(value) {
  return (value || '').toString().trim().startsWith('─');
}

/**
 * Makes a sheet exactly keepCols wide: adds columns when the layout grew, and drops the trailing
 * empty ones so header styling can't run past the data. Call it before writing the values.
 */
function fitSheetColumns(sheet, keepCols) {
  if (keepCols < 1) return;
  const diff = sheet.getMaxColumns() - keepCols;
  if (diff > 0) sheet.deleteColumns(keepCols + 1, diff);
  else if (diff < 0) sheet.insertColumnsAfter(sheet.getMaxColumns(), -diff);
}

/** Wowhead class guide URL built from the character's class and spec, e.g. .../death-knight/unholy/overview. */
function wowheadGuideUrl(className, spec) {
  const slug = v => (v || '').toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const classSlug = slug(className);
  const specSlug = slug(spec);
  if (!classSlug || !specSlug) return '';
  return `https://www.wowhead.com/guide/classes/${classSlug}/${specSlug}/overview`;
}

/**
 * Loot priority band for an item, from the slot it drops in. Weapons and trinkets carry the
 * biggest throughput swing, then tier pieces, then the secondary slots.
 */
const TIER_SET_SLOTS = ['Head', 'Shoulders', 'Shoulder', 'Chest', 'Hands', 'Legs'];

const SECONDARY_SLOTS = ['Neck', 'Back', 'Wrist', 'Waist', 'Feet', 'Ring 1', 'Ring 2', 'Ring', 'Finger'];

function lootPriorityTier(slot) {
  const text = (slot || '').toString().trim();
  if (!text) return '';
  if (/trinket/i.test(text)) return '🔥 Trinket';
  if (/hand \(|two-hand|one-hand|weapon|ranged|shield|off hand|main hand/i.test(text)) return '🔥 Weapon';
  if (TIER_SET_SLOTS.some(s => s.toLowerCase() === text.toLowerCase())) return '🎽 Tier Piece';
  if (SECONDARY_SLOTS.some(s => s.toLowerCase() === text.toLowerCase())) return '💠 Secondary';
  return '📦 Raid Drop';
}

/** Short Raid Ready summary, e.g. "Off-Spec → Vengeance · 2/4 Tier · 1 Enchant". */
function formatRaidReadySummary(issues) {
  return issues.length === 0 ? 'READY' : issues.join(' · ');
}

/** Mixes a hex colour toward white: amount 0 keeps it, 1 is white. Used for pale badge fills. */
function tintColor(hex, amount) {
  const m = (hex || '').toString().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = c => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0');
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

/**
 * Class colour rules keyed off the Class column: a solid class fill on the name cells, and class-coloured
 * text with no fill on textRanges (Class, Spec), so each row carries one block of colour instead of three.
 */
function classColorRules(classColumnLetter, nameRanges, textRanges) {
  const darkBgClasses = ['Death Knight', 'Demon Hunter', 'Shaman', 'Warlock'];
  const rules = [];
  Object.keys(CLASS_COLORS).forEach(className => {
    const formula = `=$${classColumnLetter}2="${className}"`;
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(formula)
      .setBackground(CLASS_COLORS[className])
      .setFontColor(darkBgClasses.includes(className) ? '#ffffff' : '#0f172a')
      .setRanges(nameRanges)
      .build());
    if (textRanges && textRanges.length > 0) {
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(formula)
        .setFontColor(CLASS_ACCESSIBLE_COLORS[className] || CLASS_COLORS[className])
        .setRanges(textRanges)
        .build());
    }
  });
  return rules;
}

/**
 * Loot sheet columns that hold one value on every item row (Difficulty, Drop ilvl). They are hidden and
 * the value is shown once in the header stamp instead, e.g. "Mythic · 334 ilvl". rows are the rows under
 * the header; boss banners (a ═══ rule or nothing in the item column) are skipped.
 */
function lootUniformColumns(headers, rows) {
  const items = rows.filter(r => {
    const item = (r[1] || '').toString().trim();
    return item && !item.startsWith('═');
  });
  const hidden = [];
  const labels = [];
  [['Difficulty', v => v], ['Drop ilvl', v => `${v} ilvl`]].forEach(([name, describe]) => {
    const idx = headers.indexOf(name);
    if (idx < 0 || items.length === 0) return;
    const values = new Set(items.map(r => (r[idx] === undefined || r[idx] === null ? '' : r[idx]).toString().trim()));
    const only = values.size === 1 ? Array.from(values)[0] : '';
    if (only) {
      hidden.push(idx);
      labels.push(describe(only));
    }
  });
  return { hidden: hidden, label: labels.join(' · ') };
}
