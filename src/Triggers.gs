/**
 * Scheduled refreshes.
 *
 * The triggers used to be added by hand in the Apps Script UI, which meant they lived nowhere in the
 * repo: redeploy the project, or copy the spreadsheet, and the automation silently didn't exist.
 * These are declared here and installed from the Guild Audit menu instead.
 */

/** How long after the raid's configured start time the raid-night attendance sync should run. */
const RAID_NIGHT_SYNC_OFFSET_MINUTES = 10;

/** Where the installer remembers which trigger id belongs to which schedule. */
const TRIGGER_ID_PROPERTY = 'scheduled_trigger_ids';

const WEEK_DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/** "7:00 PM - 10:00 PM" -> { hour: 19, minute: 0 }. Null when the text isn't a time. */
function parseRaidStartTime_(raidHours) {
  const m = String(raidHours || '').match(/(\d{1,2})\s*:\s*(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === 'PM') hour += 12;
  const minute = parseInt(m[2], 10);
  if (isNaN(hour) || isNaN(minute) || minute > 59) return null;
  return { hour: hour, minute: minute };
}

/** "Tuesday, Wednesday" -> ['TUESDAY','WEDNESDAY'], ignoring anything that isn't a weekday. */
function parseRaidDays_(raidDays) {
  return String(raidDays || '')
    .split(',')
    .map(d => d.trim().toUpperCase())
    .filter(d => WEEK_DAY_NAMES.indexOf(d) > -1);
}

/**
 * Adds minutes to a weekday clock time, rolling into the following day when it crosses midnight, so a
 * late-night raid start doesn't schedule its sync onto the wrong day.
 */
function shiftRaidClock_(day, start, offsetMinutes) {
  const total = start.hour * 60 + start.minute + offsetMinutes;
  const dayShift = Math.floor(total / (24 * 60));
  const inDay = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const dayIndex = (WEEK_DAY_NAMES.indexOf(day) + dayShift + 7) % 7;
  return { day: WEEK_DAY_NAMES[dayIndex], hour: Math.floor(inDay / 60), minute: inDay % 60 };
}

/** 19, 10 -> "7:10 PM" */
function formatClockLabel_(hour, minute) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, '0')} ${period}`;
}

/**
 * Every schedule this project owns, including one raid-night sync per configured raid day. Pure, so the
 * whole schedule can be asserted in tests; pass null for config to get just the two fixed refreshes.
 */
function scheduledRefreshSpecs_(config) {
  const specs = [
    {
      key: 'audit-6h',
      handler: 'updateAllCharacterDataWithBonuses',
      everyHours: 6,
      label: 'Gear audit, talents & loot sheet — every 6 hours'
    },
    {
      key: 'wcl-nightly',
      handler: 'syncWarcraftLogsSeasonAttendance',
      atHour: 23,
      label: 'Warcraft Logs attendance — nightly at 11 PM'
    }
  ];

  const start = parseRaidStartTime_(config && config.RAID_HOURS);
  const days = parseRaidDays_(config && config.RAID_DAYS);
  if (start) {
    days.forEach(day => {
      const at = shiftRaidClock_(day, start, RAID_NIGHT_SYNC_OFFSET_MINUTES);
      const dayLabel = at.day.charAt(0) + at.day.slice(1).toLowerCase();
      specs.push({
        key: `raid-night-${day}`,
        handler: 'syncRaidNightAttendance',
        weekDay: at.day,
        atHour: at.hour,
        nearMinute: at.minute,
        label: `Warcraft Logs attendance — ${dayLabel} ~${formatClockLabel_(at.hour, at.minute)}, ` +
          `${RAID_NIGHT_SYNC_OFFSET_MINUTES} min into the raid`
      });
    });
  }
  return specs;
}

/** The handler names this project schedules, so an unrelated trigger is never touched. */
function scheduledHandlerNames_() {
  const seen = {};
  return scheduledRefreshSpecs_(null)
    .concat([{ handler: 'syncRaidNightAttendance' }])
    .map(s => s.handler)
    .filter(h => (seen[h] ? false : (seen[h] = true)));
}

/**
 * Flattens a ScriptApp Trigger (or a plain object in tests) to the two things the plan needs. Trigger
 * exposes getters, not fields, so reading t.handlerFunction directly matches nothing in production.
 */
function describeTrigger_(t) {
  if (!t) return { id: '', handler: '' };
  return {
    id: String(typeof t.getUniqueId === 'function' ? t.getUniqueId() : (t.id || '')),
    handler: typeof t.getHandlerFunction === 'function' ? t.getHandlerFunction() : (t.handlerFunction || ''),
    trigger: t
  };
}

/**
 * Which of the project's own schedules already exist, and which triggers are stale or duplicated.
 *
 * Several schedules share one handler (both raid nights call syncRaidNightAttendance), and the trigger
 * API can't report a trigger's schedule, so each install records the trigger id it created against its
 * schedule key. A trigger of ours with an id we don't recognise can't be identified and is rebuilt.
 *
 * Pure so it can be tested without the ScriptApp service.
 */
function planTriggerInstall_(existing, specs, savedIds) {
  const desired = specs || scheduledRefreshSpecs_(null);
  const ours = scheduledHandlerNames_();
  const idToKey = {};
  Object.keys(savedIds || {}).forEach(key => { idToKey[String(savedIds[key])] = key; });

  const keptByKey = {};
  const remove = [];
  (existing || []).map(describeTrigger_).forEach(d => {
    if (ours.indexOf(d.handler) === -1) return; // someone else's trigger, leave it alone
    const key = idToKey[d.id];
    const spec = desired.filter(s => s.key === key)[0];
    if (!spec || keptByKey[key] || spec.handler !== d.handler) { remove.push(d.trigger); return; }
    keptByKey[key] = d.id;
  });

  return {
    create: desired.filter(s => !keptByKey[s.key]),
    remove: remove,
    kept: Object.keys(keptByKey),
    keptIds: keptByKey
  };
}

/**
 * True when a failure is Apps Script refusing the trigger API because the sheet still holds an
 * older authorization that predates the script.scriptapp scope in appsscript.json.
 */
function isTriggerScopeError_(err) {
  const msg = String((err && err.message) || err || '');
  return msg.indexOf('script.scriptapp') > -1 ||
    (msg.indexOf('permissions are not sufficient') > -1 && msg.indexOf('Trigger') > -1) ||
    msg.indexOf('getProjectTriggers') > -1;
}

/**
 * Raid-night attendance sync. A thin wrapper so the mid-raid triggers are distinguishable from the
 * nightly one in the Apps Script trigger list and in the execution log.
 */
function syncRaidNightAttendance() {
  syncWarcraftLogsSeasonAttendance();
}

/** Installs any missing scheduled refresh and clears duplicates. Safe to run repeatedly. */
function installGuildAuditTriggers() {
  let existing;
  try {
    existing = ScriptApp.getProjectTriggers();
  } catch (err) {
    if (!isTriggerScopeError_(err)) throw err;
    notifyUser('⏰ One more approval needed', [
      'This sheet is still running under an authorization granted before the script could manage',
      'scheduled refreshes, so Google is blocking the trigger API.',
      '',
      'To clear it:',
      '  1. Reload the spreadsheet (⌘R).',
      '  2. Run Guild Audit → 10 again.',
      '  3. Google will show an authorization screen — approve it.',
      '',
      'If no authorization screen appears, run Extensions → Apps Script → Run (installGuildAuditTriggers)',
      'once in the editor; that always prompts.'
    ].join('\n'), false);
    return;
  }

  const props = PropertiesService.getScriptProperties();
  let savedIds = {};
  try { savedIds = JSON.parse(props.getProperty(TRIGGER_ID_PROPERTY) || '{}'); } catch (e) { savedIds = {}; }

  const config = getConfigurationFromSheet();
  const specs = scheduledRefreshSpecs_(config);
  const plan = planTriggerInstall_(existing, specs, savedIds);

  plan.remove.forEach(t => ScriptApp.deleteTrigger(t));

  const ids = {};
  Object.keys(plan.keptIds).forEach(key => { ids[key] = plan.keptIds[key]; });

  plan.create.forEach(spec => {
    const builder = ScriptApp.newTrigger(spec.handler).timeBased();
    if (spec.everyHours) {
      builder.everyHours(spec.everyHours);
    } else if (spec.weekDay) {
      builder.onWeekDay(ScriptApp.WeekDay[spec.weekDay]).atHour(spec.atHour).nearMinute(spec.nearMinute);
    } else {
      builder.atHour(spec.atHour).everyDays(1);
    }
    ids[spec.key] = builder.create().getUniqueId();
  });

  props.setProperty(TRIGGER_ID_PROPERTY, JSON.stringify(ids));

  const createdKeys = plan.create.map(s => s.key);
  const lines = specs.map(s => `${createdKeys.indexOf(s.key) > -1 ? '✅ installed' : '✅ already running'} — ${s.label}`);
  if (plan.remove.length > 0) lines.push(`🧹 Removed ${plan.remove.length} untracked or duplicate trigger(s).`);
  if (!specs.some(s => s.weekDay)) {
    lines.push('', '⚠️ No raid-night sync: the Config sheet has no raid days or no readable start time.');
  } else {
    lines.push('', 'Google runs a timed trigger within about 15 minutes of its slot, so the raid-night sync can');
    lines.push('land anywhere from raid start to ~25 minutes in. The 11 PM sync is the backstop either way.');
  }
  lines.push('', 'Triggers belong to the Google account that installs them, and their failures are emailed to that account.');

  notifyUser('⏰ Scheduled Refreshes', lines.join('\n'), false);
}
