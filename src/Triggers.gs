/**
 * Scheduled refreshes.
 *
 * The triggers used to be added by hand in the Apps Script UI, which meant they lived nowhere in the
 * repo: redeploy the project, or copy the spreadsheet, and the automation silently didn't exist.
 * These are declared here and installed from the Guild Audit menu instead.
 */
const SCHEDULED_REFRESHES = [
  {
    handler: 'updateAllCharacterDataWithBonuses',
    everyHours: 6,
    label: 'Gear audit, talents & loot sheet — every 6 hours'
  },
  {
    handler: 'syncWarcraftLogsSeasonAttendance',
    atHour: 23,
    label: 'Warcraft Logs attendance — nightly at 11 PM'
  }
];

/** The handler names this project schedules, so an unrelated trigger is never touched. */
function scheduledHandlerNames_() {
  return SCHEDULED_REFRESHES.map(r => r.handler);
}

/**
 * Which of the project's own triggers already exist, and which are duplicates to be removed.
 * Pure so it can be tested without the ScriptApp service.
 */
function planTriggerInstall_(existing) {
  const ours = scheduledHandlerNames_();
  const keep = {};
  const remove = [];
  (existing || []).forEach(t => {
    const fn = t.handlerFunction;
    if (ours.indexOf(fn) === -1) return; // someone else's trigger, leave it alone
    if (keep[fn]) { remove.push(t); return; } // duplicate from an earlier install
    keep[fn] = t;
  });
  const create = ours.filter(fn => !keep[fn]);
  return { create: create, remove: remove, kept: Object.keys(keep) };
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

  const plan = planTriggerInstall_(existing);

  plan.remove.forEach(t => ScriptApp.deleteTrigger(t));

  plan.create.forEach(handler => {
    const spec = SCHEDULED_REFRESHES.filter(r => r.handler === handler)[0];
    const builder = ScriptApp.newTrigger(handler).timeBased();
    if (spec.everyHours) builder.everyHours(spec.everyHours);
    else builder.atHour(spec.atHour).everyDays(1);
    builder.create();
  });

  const lines = SCHEDULED_REFRESHES.map(r => {
    const state = plan.create.indexOf(r.handler) > -1 ? '✅ installed' : '✅ already running';
    return `${state} — ${r.label}`;
  });
  if (plan.remove.length > 0) lines.push(`🧹 Removed ${plan.remove.length} duplicate trigger(s).`);
  lines.push('', 'Triggers belong to the Google account that installs them, and their failures are emailed to that account.');

  notifyUser('⏰ Scheduled Refreshes', lines.join('\n'), false);
}
