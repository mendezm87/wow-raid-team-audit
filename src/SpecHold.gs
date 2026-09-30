// ═════════════════════════════════════════════════════════════════════════════════════
// 📌 OFF-SPEC GEAR HOLD
// ═════════════════════════════════════════════════════════════════════════════════════
//
// The Blizzard Profile API only ever reports the spec and gear a character logged out in. A raider who
// last logged out in their M+ or PvP spec therefore audits as "Off-Spec" with the wrong gear, wrong
// enchants and a wrong item level -- none of which says anything about their raid readiness.
//
// So: every time a character IS seen in their assigned raid spec, that part of the row is snapshotted.
// When they are next seen in a different spec, the snapshot is used instead of the live read, and the row
// is marked as held. The vault, M+ rating, sim freshness and attendance columns are NOT spec-dependent and
// always stay live.

const SPEC_HOLD_ENABLED_PROPERTY = 'spec_hold_enabled';
const SPEC_HOLD_PROPERTY_PREFIX = 'spec_hold_char_';

// A snapshot older than this is not used: gear that far behind is more misleading than the off-spec read.
const SPEC_HOLD_MAX_AGE_DAYS = 45;

/** The row fields that describe the spec a character logged out in, and are therefore worth holding. */
function specHeldFields_() {
  return [
    'Spec', 'iLvl', 'Tier Set', 'Sockets',
    'Total Sockets', 'Empty Sockets', 'Imperfect Gems',
    'Crafted Items', 'Embellishment 1', 'Embellishment 2',
    'Talent Code', 'Hero Talents'
  ].concat(AUDIT_GEAR_COLUMNS, AUDIT_ENCHANT_COLUMNS);
}

/** True when the audit should fall back to the last main-spec snapshot. Default on. */
function specHoldEnabled() {
  const raw = PropertiesService.getScriptProperties().getProperty(SPEC_HOLD_ENABLED_PROPERTY);
  return raw === null || raw === undefined || raw === '' ? true : raw === 'true';
}

function specHoldPropertyKey_(charName) {
  return SPEC_HOLD_PROPERTY_PREFIX + (charName || '').toString().trim().toLowerCase();
}

/** The stored main-spec snapshot for a character, or null when there isn't a usable one. */
function readSpecSnapshot(charName) {
  if (!charName) return null;
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(specHoldPropertyKey_(charName));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.data ? parsed : null;
  } catch (err) {
    Logger.log(`Discarding unreadable spec snapshot for ${charName}: ${err}`);
    return null;
  }
}

function writeSpecSnapshot(charName, snapshot) {
  PropertiesService.getScriptProperties()
    .setProperty(specHoldPropertyKey_(charName), JSON.stringify(snapshot));
}

function deleteSpecSnapshot(charName) {
  PropertiesService.getScriptProperties().deleteProperty(specHoldPropertyKey_(charName));
}

/** The snapshot to store for a character currently seen in their assigned raid spec. */
function buildSpecSnapshot(charRow, nowMs) {
  const data = {};
  specHeldFields_().forEach(field => {
    if (charRow[field] !== undefined) data[field] = charRow[field];
  });
  return { spec: (charRow['Spec'] || '').toString().trim(), savedAt: nowMs, data: data };
}

function sameSpec_(a, b) {
  return (a || '').toString().trim().toLowerCase() === (b || '').toString().trim().toLowerCase();
}

/**
 * Decides what the audit should do with one character's live read, without touching storage.
 *
 *  'save' - seen in their assigned spec, so refresh the snapshot from this read
 *  'hold' - seen in another spec and a usable snapshot exists, so carry the snapshot forward
 *  'none' - nothing to do (no assigned spec, no profile, hold turned off, or no usable snapshot)
 *
 * `reason` is only for the log and the officer-facing note; the caller keys off `action`.
 */
function decideSpecHold(opts) {
  const expected = (opts.expectedSpec || '').toString().trim();
  const active = (opts.activeSpec || '').toString().trim();

  if (!opts.hasProfile) return { action: 'none', reason: 'no armory profile' };
  if (!expected) return { action: 'none', reason: 'no assigned raid spec in Config' };
  if (!active) return { action: 'none', reason: 'armory returned no active spec' };
  if (sameSpec_(expected, active)) return { action: 'save', reason: 'logged out in assigned spec' };
  if (!opts.enabled) return { action: 'none', reason: 'off-spec gear hold is turned off' };

  const snapshot = opts.snapshot;
  if (!snapshot) return { action: 'none', reason: 'never yet seen in the assigned spec' };

  // An assignment change in Config makes an older snapshot the wrong spec, not a stale one.
  if (!sameSpec_(snapshot.spec, expected)) {
    return { action: 'none', reason: `snapshot is ${snapshot.spec}, assigned spec is now ${expected}` };
  }

  const ageDays = (opts.nowMs - (snapshot.savedAt || 0)) / 86400000;
  if (!(snapshot.savedAt > 0) || ageDays > SPEC_HOLD_MAX_AGE_DAYS) {
    return { action: 'none', reason: `snapshot is older than ${SPEC_HOLD_MAX_AGE_DAYS} days` };
  }

  return { action: 'hold', reason: `held from ${expected}`, snapshot: snapshot, liveSpec: active };
}

/**
 * Applies decideSpecHold() to a character row, reading and writing the snapshot store.
 * On a hold the row's spec-dependent fields are replaced and `specHeld` is set, which is what
 * puts the 📌 note and the amber Spec cell on the sheet. Returns the decision.
 */
function applySpecHold(charRow, hasProfile, enabled, nowMs) {
  const charName = charRow['Name'];
  const decision = decideSpecHold({
    expectedSpec: charRow['Expected Spec'],
    activeSpec: charRow['Spec'],
    hasProfile: hasProfile,
    enabled: enabled,
    snapshot: enabled ? readSpecSnapshot(charName) : null,
    nowMs: nowMs
  });

  if (decision.action === 'save') {
    writeSpecSnapshot(charName, buildSpecSnapshot(charRow, nowMs));
    return decision;
  }

  if (decision.action === 'hold') {
    const data = decision.snapshot.data;
    specHeldFields_().forEach(field => {
      if (data[field] !== undefined) charRow[field] = data[field];
    });
    charRow.specHeld = true;
    charRow.specHeldAt = decision.snapshot.savedAt;
    charRow.specHeldLiveSpec = decision.liveSpec;
    // Wowhead and Archon links are built from class + spec, so they have to follow the held spec.
    charRow['Wowhead Link'] = wowheadGuideUrl(charRow['Class'], charRow['Spec']);
    charRow['Archon Heroic Link'] = archonBuildUrl(charRow['Class'], charRow['Spec'], 'heroic');
    charRow['Archon Mythic Link'] = archonBuildUrl(charRow['Class'], charRow['Spec'], 'mythic');
    Logger.log(`${charName}: holding ${decision.snapshot.spec} gear, currently logged out in ${decision.liveSpec}`);
  }

  return decision;
}

/** Hover text for a held row's Spec cell, written so an officer can read it without the guide. */
function specHoldNoteText(charRow, timeZone) {
  if (!charRow || !charRow.specHeld) return '';
  const when = charRow.specHeldAt
    ? Utilities.formatDate(new Date(charRow.specHeldAt), timeZone || 'UTC', 'MMM d, h:mm a')
    : 'an earlier audit';
  return `📌 Held from the last audit that saw ${charRow['Name']} in ${charRow['Spec']} (${when}).\n\n`
    + `They are currently logged out in ${charRow.specHeldLiveSpec || 'another spec'}, so the gear, `
    + `enchants, item level and talents on this row are the saved ${charRow['Spec']} ones rather than a live read. `
    + `Great Vault, M+ rating, sim freshness and attendance are still live.\n\n`
    + `The row updates itself the next time they log out in ${charRow['Spec']}.`;
}

/** "2 rows 📌 held" for the refresh stamp, or '' when nothing is held. */
function specHoldStampText(dataObjects) {
  const held = (dataObjects || []).filter(o => o && o.specHeld).length;
  return held > 0 ? `${held} row${held > 1 ? 's' : ''} 📌 held off-spec` : '';
}

/**
 * Puts the 📌 note and a pale amber fill on the Spec cell of every held row. Deliberately changes no
 * cell text: the Spec column is read back by the Loot sheet and the sim importers, and a marker in it
 * would leak into their spec matching.
 */
function applySpecHoldMarkers(sheet, headers, dataObjects, specHeaderName) {
  if (!dataObjects || dataObjects.length === 0) return 0;
  const specCol = headers.indexOf(specHeaderName) + 1;
  if (specCol < 1) return 0;
  if (!dataObjects.some(o => o && o.specHeld)) return 0;

  const timeZone = sheet.getParent().getSpreadsheetTimeZone();
  const notes = dataObjects.map(o => [specHoldNoteText(o, timeZone)]);
  const range = sheet.getRange(2, specCol, dataObjects.length, 1);
  range.setNotes(notes);
  // Keep the zebra fill on every other row rather than blanking the column.
  const backgrounds = range.getBackgrounds();
  dataObjects.forEach((o, i) => {
    if (o && o.specHeld) backgrounds[i][0] = SPEC_HOLD_BACKGROUND;
  });
  range.setBackgrounds(backgrounds);
  return dataObjects.filter(o => o && o.specHeld).length;
}

/** Menu 3b: turns the hold on or off. Off makes the audit always show the live logged-out spec. */
function toggleOffSpecGearHold() {
  const ui = SpreadsheetApp.getUi();
  const on = specHoldEnabled();
  const next = !on;
  const response = ui.alert(
    next ? 'Turn ON off-spec gear hold?' : 'Turn OFF off-spec gear hold?',
    next
      ? 'Raiders who logged out in a different spec than their assigned raid spec will keep the gear, '
        + 'enchants, item level and talents from the last audit that saw them in their raid spec. Their '
        + 'Spec cell is tinted amber with a note saying when it was saved.\n\n'
        + 'Great Vault, M+ rating, sim freshness and attendance stay live either way.\n\n'
        + 'Run the Full Audit afterwards to apply it.'
      : 'Every raider will audit against whatever spec and gear they last logged out in, so someone who '
        + 'logged out in their M+ spec will read as Off-Spec with the wrong gear.\n\n'
        + 'Saved snapshots are kept, so turning the hold back on restores them.\n\n'
        + 'Run the Full Audit afterwards to apply it.',
    ui.ButtonSet.OK_CANCEL);
  if (response !== ui.Button.OK) return;

  PropertiesService.getScriptProperties().setProperty(SPEC_HOLD_ENABLED_PROPERTY, next ? 'true' : 'false');
  ui.alert('Off-Spec Gear Hold', `Off-spec gear hold is now ${next ? 'ON' : 'OFF'}.`, ui.ButtonSet.OK);
}

/** Menu 3c: drops every saved snapshot, so the next audit starts from live reads again. */
function clearOffSpecGearHoldSnapshots() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const keys = props.getKeys().filter(k => k.indexOf(SPEC_HOLD_PROPERTY_PREFIX) === 0);
  if (keys.length === 0) {
    ui.alert('Off-Spec Gear Hold', 'There are no saved main-spec snapshots to clear.', ui.ButtonSet.OK);
    return;
  }
  const response = ui.alert(
    'Clear saved main-spec snapshots?',
    `This deletes the saved main-spec gear for ${keys.length} character${keys.length > 1 ? 's' : ''}. `
      + 'Until each of them next logs out in their assigned raid spec, the audit will show whatever '
      + 'spec they are currently in.',
    ui.ButtonSet.OK_CANCEL);
  if (response !== ui.Button.OK) return;

  keys.forEach(k => props.deleteProperty(k));
  ui.alert('Off-Spec Gear Hold', `Cleared ${keys.length} saved snapshot${keys.length > 1 ? 's' : ''}.`, ui.ButtonSet.OK);
}
