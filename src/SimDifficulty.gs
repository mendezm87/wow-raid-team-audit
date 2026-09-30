// ═════════════════════════════════════════════════════════════════════════════════════
// ⚔️ SIM DIFFICULTY GUARD
// ═════════════════════════════════════════════════════════════════════════════════════
//
// The Loot & Chase Items catalog is built for ONE raid difficulty at a time (Guild Audit menu 4b).
// A sim run at a different difficulty produces upgrade percentages against the wrong drop item level,
// so importing it silently corrupts the contender ranking. Every import path therefore has to agree
// with getLootDifficulty() before its numbers are written.
//
// Raidbots states the difficulty in simbot.publicTitle, e.g.
//   "Droptimizer • The Venomous Abyss • Mythic • Myth 6/6"
// QE Live states it as an index into RAID_DIFFICULTY_LABELS, both in ufSettings.raid and per result
// row as dropDifficulty.

// Index order is QE Live's own: ufSettings.raid holds indices into this list.
const RAID_DIFFICULTY_LABELS = ['Raid Finder', 'Normal', 'Heroic', 'Mythic'];

/** 'Mythic' -> 3. Returns -1 for anything unrecognised. */
function raidDifficultyIndex(label) {
  const wanted = (label || '').toString().trim().toLowerCase();
  if (!wanted) return -1;
  return RAID_DIFFICULTY_LABELS.findIndex(l => l.toLowerCase() === wanted);
}

/** 3 -> 'Mythic'. Returns '' for anything outside the list. */
function raidDifficultyLabel(index) {
  const i = Number(index);
  return RAID_DIFFICULTY_LABELS[i] || '';
}

/**
 * The raid difficulty a Raidbots droptimizer was run at, read from the report title.
 * Returns '' when the title does not name one (a non-droptimizer sim, or a title we cannot parse).
 */
function raidbotsReportDifficulty(simData) {
  const sb = (simData && simData.simbot) || {};
  const title = [sb.publicTitle, sb.title, sb.meta && sb.meta.title].filter(Boolean).join(' • ');
  if (!title) return '';
  // Longest label first so "Raid Finder" is not shadowed by a bare "Raid".
  const found = RAID_DIFFICULTY_LABELS.slice()
    .sort((a, b) => b.length - a.length)
    .find(label => new RegExp(`(^|[^a-z])${label}([^a-z]|$)`, 'i').test(title));
  return found || '';
}

/**
 * The raid difficulty a QE Live upgrade report was run at.
 * ufSettings.raid is an array of indices; the report's raid result rows carry the same index as
 * dropDifficulty, which is the fallback for older reports that stored no ufSettings.
 */
function qeReportDifficulty(reportData) {
  const settings = (reportData && reportData.ufSettings) || {};
  const raid = settings.raid;
  const indices = Array.isArray(raid) ? raid : (raid === undefined || raid === null ? [] : [raid]);
  const fromSettings = indices
    .map(i => raidDifficultyLabel(i))
    .filter(Boolean);
  if (fromSettings.length > 0) return fromSettings[fromSettings.length - 1];

  const rows = (reportData && reportData.results) || [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r && r.dropLoc && r.dropLoc.toString().toLowerCase() === 'raid') {
      const label = raidDifficultyLabel(r.dropDifficulty);
      if (label) return label;
    }
  }
  return '';
}

/**
 * Compares a sim's difficulty against the sheet's configured one.
 * An unreadable sim difficulty is allowed through rather than blocking an import on a parse failure --
 * a wrong difficulty is the thing worth stopping, not a missing label.
 */
function checkSimDifficulty(simDifficultyLabel, lootDifficulty, playerName) {
  const expected = (lootDifficulty && lootDifficulty.label) || '';
  const actual = (simDifficultyLabel || '').toString().trim();
  if (!actual || !expected) return { ok: true, unknown: !actual };
  if (actual.toLowerCase() === expected.toLowerCase()) return { ok: true, unknown: false };

  const who = playerName ? `${playerName}'s` : 'That';
  return {
    ok: false,
    unknown: false,
    expected: expected,
    actual: actual,
    error: `${who} sim was run at ${actual} difficulty, but the Loot & Chase Items sheet is set to ${expected}. `
      + `The upgrade percentages would be measured against the wrong drop item level, so it was not imported. `
      + `Re-run the sim with the ${expected} raid preset, or switch the sheet with Guild Audit menu `
      + `"4b. Toggle Loot Difficulty".`
  };
}
