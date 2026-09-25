/**
 * Prompts user to set or update their Warcraft Logs v2 API Client credentials.
 */
function promptForWCLCredentials() {
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();

  const clientIdResponse = ui.prompt(
    'Set Warcraft Logs API Client ID (Step 1/2)', 
    'Step 1: Obtain your credentials from the Warcraft Logs API Portal:\n👉 https://www.warcraftlogs.com/api/clients/\n\n(Create a V2 client: name "Guild Attendance Audit", redirect "https://localhost", Public Client unchecked. The "V1 Client Key" will not work.)\n\nPlease enter your Warcraft Logs Client ID:', 
    ui.ButtonSet.OK_CANCEL
  );
  if (clientIdResponse.getSelectedButton() !== ui.Button.OK) return;
  const clientId = clientIdResponse.getResponseText().trim();

  const clientSecretResponse = ui.prompt(
    'Set Warcraft Logs API Client Secret (Step 2/2)', 
    'Please enter your Warcraft Logs Client Secret:', 
    ui.ButtonSet.OK_CANCEL
  );
  if (clientSecretResponse.getSelectedButton() !== ui.Button.OK) return;
  const clientSecret = clientSecretResponse.getResponseText().trim();

  if (clientId && clientSecret) {
    // Shared Script Properties so scheduled triggers and every officer use the same credentials
    scriptProperties.setProperties({
      'WCL_CLIENT_ID': clientId,
      'WCL_CLIENT_SECRET': clientSecret
    });
    scriptProperties.deleteProperty('wcl_token'); // Force a fresh token with the new credentials
    scriptProperties.deleteProperty('wcl_token_expiry');
    ui.alert('🎉 Success!', 'Your Warcraft Logs API credentials have been saved for all officers and scheduled triggers. You can now sync guild attendance and raid history!', ui.ButtonSet.OK);
  } else {
    ui.alert('❌ Error', 'Both Client ID and Client Secret are required.', ui.ButtonSet.OK);
  }
}

/**
 * Obtains an OAuth2 Bearer Access Token for the Warcraft Logs v2 API.
 */
function getWCLAccessToken() {
  const clientId = getSharedCredential('WCL_CLIENT_ID');
  const clientSecret = getSharedCredential('WCL_CLIENT_SECRET');

  if (!clientId || !clientSecret) return null;

  const scriptProperties = PropertiesService.getScriptProperties();
  let token = scriptProperties.getProperty('wcl_token');
  const tokenExpiry = scriptProperties.getProperty('wcl_token_expiry');

  if (token && new Date().getTime() < Number(tokenExpiry)) {
    return token;
  }

  try {
    const tokenResp = UrlFetchApp.fetch('https://www.warcraftlogs.com/oauth/token', {
      method: 'post',
      payload: { grant_type: 'client_credentials' },
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(clientId + ':' + clientSecret)
      },
      muteHttpExceptions: true
    });

    if (tokenResp.getResponseCode() !== 200) {
      Logger.log('WCL Auth error: ' + tokenResp.getContentText());
      return null;
    }

    const tokenData = JSON.parse(tokenResp.getContentText());
    token = tokenData.access_token;
    const expiry = new Date().getTime() + ((tokenData.expires_in || 3600) - 60) * 1000;
    scriptProperties.setProperty('wcl_token', token);
    scriptProperties.setProperty('wcl_token_expiry', expiry.toString());
    return token;
  } catch (err) {
    Logger.log('Error acquiring WCL access token: ' + err);
    return null;
  }
}

// --- ATTENDANCE ARCHIVE (hidden sheet) ---
// One row per raid night with the RAW logged character names. Leaderboard % is always recomputed
// from this archive, so history survives WCL's 40-report window, re-syncs, and code deploys.
const ATTENDANCE_ARCHIVE_SHEET_NAME = 'Attendance Archive';

const ATTENDANCE_ARCHIVE_HEADERS = [
  'Date Key', 'Date', 'Day', 'Title', 'Report Codes', 'Boss Kills', 'Total Pulls',
  'Mythic', 'Earliest Pull (ms)', 'Attendees', 'First Pull Attendees', 'Last Synced'
];

/**
 * Converts a raid date as text ("Tue, Sep 22, 2026", "9/22/2026", a Date string, or "2026-09-22")
 * to "yyyy-MM-dd". Parses the text directly, so there is no time zone day-shift.
 */
function normalizeRaidDateKey(text) {
  const str = (text || '').toString();
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const textMatch = str.match(/\b([A-Za-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (textMatch && months.indexOf(textMatch[1].toLowerCase()) >= 0) {
    const mm = String(months.indexOf(textMatch[1].toLowerCase()) + 1).padStart(2, '0');
    return `${textMatch[3]}-${mm}-${textMatch[2].padStart(2, '0')}`;
  }
  const usMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) return `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
  return null;
}

/**
 * One-time migration: builds archive records from the existing "Attendance & History" ledger so
 * nights that already scrolled out of WCL's 40-report window keep counting. The ledger only lists
 * resolved mains, so those are stored as the attendee names (on-time raiders = first pull).
 */
function seedAttendanceArchiveFromLedger(ss) {
  const seeded = {};
  const attSheet = ss.getSheetByName(ATTENDANCE_SHEET_NAME);
  if (!attSheet || attSheet.getLastRow() < 2) return seeded;

  const splitNames = (v) => (v || '').split(',').map(n => n.trim()).filter(n => n && n !== 'None' && !n.startsWith('N/A'));
  const pugPrefix = '📦 [Optional / PUG] ';
  let inLedger = false;
  attSheet.getDataRange().getDisplayValues().forEach(row => {
    const col0 = (row[0] || '').trim();
    if (col0.includes('HISTORICAL GUILD RAID NIGHT LEDGER')) { inLedger = true; return; }
    if (!inLedger || col0 === 'Raid Date') return;
    const dateKey = normalizeRaidDateKey(col0);
    if (!dateKey) return;

    const rawTitle = (row[1] || '').trim();
    const wasOptional = rawTitle.startsWith(pugPrefix);
    const bosses = (row[2] || '').startsWith('Progression Wipes') ? [] : splitNames(row[2]);
    const pullsMatch = (row[2] || '').match(/Progression Wipes \((\d+) pull/);
    const onTime = splitNames(row[6]);
    const late = splitNames(row[7]);
    const codeMatch = (row[8] || '').match(/\(([A-Za-z0-9]+)\)/);
    const [y, m, d] = dateKey.split('-').map(Number);
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];

    seeded[dateKey] = {
      dateKey: dateKey,
      formattedDate: col0,
      dayOfWeek: dayOfWeek,
      title: wasOptional ? rawTitle.slice(pugPrefix.length) : rawTitle,
      reportCodes: codeMatch ? [codeMatch[1]] : [],
      allBossKills: bosses,
      totalPulls: pullsMatch ? Number(pullsMatch[1]) : bosses.length,
      // Difficulty isn't on the ledger. An optional night that still had 10+ mains can only have
      // missed the Mythic quorum (15), so mark it Mythic to keep it optional on re-evaluation.
      isMythic: wasOptional && (onTime.length + late.length) >= 10,
      earliestStartTime: 0,
      attendees: onTime.concat(late),
      firstPullAttendees: onTime
    };
  });
  return seeded;
}

function readAttendanceArchive(ss) {
  const archive = {};
  const sheet = ss.getSheetByName(ATTENDANCE_ARCHIVE_SHEET_NAME);
  if (!sheet) return seedAttendanceArchiveFromLedger(ss);
  if (sheet.getLastRow() < 2) return archive;

  const parseList = (v) => {
    try { const arr = JSON.parse(v || '[]'); return Array.isArray(arr) ? arr : []; } catch (e) { return []; }
  };
  sheet.getRange(2, 1, sheet.getLastRow() - 1, ATTENDANCE_ARCHIVE_HEADERS.length).getDisplayValues().forEach(row => {
    const dateKey = (row[0] || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
    archive[dateKey] = {
      dateKey: dateKey,
      formattedDate: row[1],
      dayOfWeek: row[2],
      title: row[3],
      reportCodes: parseList(row[4]),
      allBossKills: parseList(row[5]),
      totalPulls: Number(row[6]) || 0,
      isMythic: row[7] === 'TRUE' || row[7] === 'true',
      earliestStartTime: Number(row[8]) || 0,
      attendees: parseList(row[9]),
      firstPullAttendees: parseList(row[10])
    };
  });
  return archive;
}

function writeAttendanceArchive(ss, archiveByDateKey) {
  let sheet = ss.getSheetByName(ATTENDANCE_ARCHIVE_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ATTENDANCE_ARCHIVE_SHEET_NAME);
    sheet.hideSheet();
  }
  const syncedAt = Utilities.formatDate(new Date(), 'America/Los_Angeles', 'yyyy-MM-dd HH:mm');
  const rows = Object.values(archiveByDateKey)
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1))
    .map(r => [
      r.dateKey, r.formattedDate, r.dayOfWeek, r.title,
      JSON.stringify(r.reportCodes || []), JSON.stringify(r.allBossKills || []), r.totalPulls || 0,
      r.isMythic ? 'TRUE' : 'FALSE', String(r.earliestStartTime || 0),
      JSON.stringify(r.attendees || []), JSON.stringify(r.firstPullAttendees || []), syncedAt
    ]);

  sheet.clearContents();
  const all = [ATTENDANCE_ARCHIVE_HEADERS].concat(rows);
  // Plain-text format so Sheets never auto-converts date keys or large ms timestamps
  sheet.getRange(1, 1, all.length, ATTENDANCE_ARCHIVE_HEADERS.length).setNumberFormat('@').setValues(all);
  sheet.setFrozenRows(1);
}

/**
 * Combines an archived night with freshly fetched WCL data for the same date. Attendee lists,
 * kills and report codes are unioned; first-pull data comes from whichever saw the earlier pull.
 */
function mergeAttendanceRecords(oldRec, newRec) {
  const union = (a, b) => Array.from(new Set([].concat(a || [], b || [])));
  const newIsEarlier = newRec.earliestStartTime && (!oldRec.earliestStartTime || newRec.earliestStartTime <= oldRec.earliestStartTime);
  const extraCodes = (oldRec.reportCodes || []).filter(c => !(newRec.reportCodes || []).includes(c));
  return {
    dateKey: newRec.dateKey,
    formattedDate: newRec.formattedDate || oldRec.formattedDate,
    dayOfWeek: newRec.dayOfWeek || oldRec.dayOfWeek,
    title: newRec.title || oldRec.title,
    reportCodes: union(newRec.reportCodes, oldRec.reportCodes),
    allBossKills: union(newRec.allBossKills, oldRec.allBossKills),
    // Pulls from reports WCL no longer returns are only known from the archive, so keep the larger count
    totalPulls: extraCodes.length > 0 ? Math.max(newRec.totalPulls || 0, oldRec.totalPulls || 0) : (newRec.totalPulls || 0),
    isMythic: !!(newRec.isMythic || oldRec.isMythic),
    earliestStartTime: newIsEarlier ? newRec.earliestStartTime : oldRec.earliestStartTime,
    attendees: union(newRec.attendees, oldRec.attendees),
    firstPullAttendees: newIsEarlier ? newRec.firstPullAttendees : oldRec.firstPullAttendees
  };
}

/**
 * Synchronizes guild attendance, boss kills, and on-time punctuality directly from Warcraft Logs.
 * Merges multi-uploader reports by Pacific calendar date into official raid nights (Tue/Wed).
 */
function syncWarcraftLogsSeasonAttendance() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = getConfigurationFromSheet();
  if (!config) return;

  const wclToken = getWCLAccessToken();
  if (!wclToken) {
    notifyUser('Authentication Failed', 'Could not authenticate with Warcraft Logs. Please check your API credentials under "Guild Audit > 7. Set Warcraft Logs API Credentials".', true);
    return;
  }

  const guildName = config.GUILD_NAME_SLUG || 'prey';
  const serverSlug = config.GUILD_REALM_SLUG || 'kiljaeden';
  const serverRegion = (config.REGION || 'us').toLowerCase();
  const timeZone = 'America/Los_Angeles'; // Guild raid time zone (Pacific)

  // Query all recent reports for the guild
  const reportsQuery = `
    query {
      reportData {
        reports(guildName: "${guildName}", guildServerSlug: "${serverSlug}", guildServerRegion: "${serverRegion}", limit: 40) {
          data {
            code
            title
            startTime
            endTime
            fights(killType: Encounters) {
              id
              name
              kill
              difficulty
              startTime
              endTime
            }
          }
        }
      }
    }
  `;

  let reports = [];
  try {
    const gqlResp = UrlFetchApp.fetch('https://www.warcraftlogs.com/api/v2/client', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + wclToken
      },
      payload: JSON.stringify({ query: reportsQuery }),
      muteHttpExceptions: true
    });

    if (gqlResp.getResponseCode() !== 200) {
      notifyUser('WCL API Error', `Warcraft Logs API returned status ${gqlResp.getResponseCode()}: ${gqlResp.getContentText()}`, true);
      return;
    }

    const json = JSON.parse(gqlResp.getContentText());
    if (json && json.data && json.data.reportData && json.data.reportData.reports) {
      reports = json.data.reportData.reports.data || [];
    }
  } catch (e) {
    notifyUser('Error', `Failed to query Warcraft Logs: ${e.message}`, true);
    return;
  }

  if (reports.length === 0) {
    notifyUser('No Logs Found', `No reports found on Warcraft Logs for guild <${guildName}> on ${serverSlug}-${serverRegion}.`);
    return;
  }

  // Current raid's boss list (Warcraft Logs fight names)
  const raidBossNames = SEASON.bosses.map(b => b.name);

  // 1. Group & Merge Reports by Pacific Calendar Date (Deduplicates Multi-Uploaders)
  const sessionMap = {};

  reports.forEach(r => {
    // Include all boss encounters (both kills and wipes) for attendance and punctuality
    const bossFights = (r.fights || [])
      .filter(f => raidBossNames.some(b => f.name && f.name.includes(b)))
      .sort((a, b) => a.startTime - b.startTime);
    if (bossFights.length === 0) return;

    const bossKills = bossFights.filter(f => f.kill);

    const dateKey = Utilities.formatDate(new Date(r.startTime), timeZone, 'yyyy-MM-dd');
    const formattedDate = Utilities.formatDate(new Date(r.startTime), timeZone, 'EEE, MMM d, yyyy');
    const dayOfWeek = Utilities.formatDate(new Date(r.startTime), timeZone, 'EEEE');

    if (!sessionMap[dateKey]) {
      sessionMap[dateKey] = {
        dateKey: dateKey,
        formattedDate: formattedDate,
        dayOfWeek: dayOfWeek,
        reports: [],
        allBossKills: [],
        earliestStartTime: Infinity,
        firstReportCode: null,
        firstFightId: null
      };
    }

    sessionMap[dateKey].reports.push({
      code: r.code,
      title: r.title,
      startTime: r.startTime,
      bossFights: bossFights,
      bossKills: bossKills
    });

    bossKills.forEach(b => {
      if (!sessionMap[dateKey].allBossKills.includes(b.name)) {
        sessionMap[dateKey].allBossKills.push(b.name);
      }
    });

    // Detect the literal first boss pull of the night (wipe or kill) across all reports for this date
    const firstFight = bossFights[0];
    const fightAbsoluteStart = r.startTime + (firstFight.startTime || 0);
    if (fightAbsoluteStart < sessionMap[dateKey].earliestStartTime) {
      sessionMap[dateKey].earliestStartTime = fightAbsoluteStart;
      sessionMap[dateKey].firstReportCode = r.code;
      sessionMap[dateKey].firstFightId = firstFight.id;
    }
  });

  const raidSessions = Object.values(sessionMap).sort((a, b) => new Date(b.dateKey).getTime() - new Date(a.dateKey).getTime());

  // Get active roster list from Config sheet
  const rosterMembers = config.MEMBERS_TO_TRACK || [];
  const memberNameMap = {};
  rosterMembers.forEach(m => {
    if (m.name) memberNameMap[m.name.toLowerCase()] = m.name;
  });

  // Track player cumulative statistics
  const playerStats = {};
  rosterMembers.forEach(m => {
    playerStats[m.name] = {
      name: m.name,
      spec: m.expectedSpec || '',
      raidsAttended: 0,
      onTimeCount: 0,
      lateCount: 0,
      totalBossKillsAttended: 0
    };
  });

  // Active Raid Days & Minimum Guild Quorum configuration (Filters out off-hours PUGs & alt runs)
  const activeDaysList = (config.RAID_DAYS || 'Tuesday, Wednesday')
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(Boolean);

  // Guild Quorum: Require at least 5 main guild raiders OR 35% of the active roster for an official mandatory raid night
  const minGuildQuorum = Math.max(5, Math.min(8, Math.ceil(rosterMembers.length * 0.35)));
  let officialRaidCount = 0;
  const raidLedger = [];

  // Load saved Bench records once, re-keyed by yyyy-MM-dd. The bench dialog saves whatever text the
  // ledger's date cell reads back as ("Tue, Sep 22, 2026", or a Date string if Sheets auto-converted it),
  // so normalize every key to the same dateKey format the WCL sessions use.
  const rawBenchRecords = JSON.parse(PropertiesService.getScriptProperties().getProperty('bench_records') || '{}');
  const benchByDateKey = {};
  Object.keys(rawBenchRecords).forEach(key => {
    const normalizedKey = normalizeRaidDateKey(key);
    if (!normalizedKey) return;
    benchByDateKey[normalizedKey] = (benchByDateKey[normalizedKey] || []).concat(rawBenchRecords[key] || []);
  });

  // Alt-to-Main resolver (roster + alt mapping from Config)
  const altToMainMap = config.ALT_TO_MAIN_MAP || {};
  const resolveToMain = (name) => {
    if (!name) return null;
    const lower = name.toLowerCase().trim();
    if (memberNameMap[lower]) return memberNameMap[lower];
    if (altToMainMap[lower]) {
      const ownerLower = altToMainMap[lower].toLowerCase().trim();
      return memberNameMap[ownerLower] || Object.keys(playerStats).find(k => k.toLowerCase() === ownerLower) || altToMainMap[lower];
    }
    return Object.keys(playerStats).find(k => k.toLowerCase() === lower) || null;
  };

  // Persistent archive of every raid night ever synced (hidden sheet). WCL only returns the 40 most
  // recent reports, so older nights come from here and are never lost from the season totals.
  const archiveByDateKey = readAttendanceArchive(ss);
  const twoDaysAgoKey = Utilities.formatDate(new Date(Date.now() - 2 * 86400000), timeZone, 'yyyy-MM-dd');
  const freshRecords = [];

  // 2. Query Details and Punctuality for Each Merged Raid Night (raw names only; evaluated below)
  raidSessions.forEach(session => {
    const sessionAttendees = new Set();
    const firstPullAttendees = new Set();
    const sessionReportCodes = session.reports.map(r => r.code);
    const sessionTotalPulls = session.reports.reduce((acc, r) => acc + (r.bossFights ? r.bossFights.length : 0), 0);

    // Skip re-querying settled nights (2+ days old) whose report set hasn't changed since the last archive
    const archived = archiveByDateKey[session.dateKey];
    if (archived && session.dateKey <= twoDaysAgoKey &&
        archived.reportCodes.length === sessionReportCodes.length &&
        sessionReportCodes.every(c => archived.reportCodes.includes(c))) {
      freshRecords.push(archived);
      return;
    }

    // Query participants for each report in this session (across all boss encounters: kills and wipes)
    session.reports.forEach(r => {
      const fightIds = (r.bossFights || r.bossKills || []).map(b => b.id);
      const detailQuery = `
        query {
          reportData {
            report(code: "${r.code}") {
              playerDetails(fightIDs: [${fightIds.join(',')}])
            }
          }
        }
      `;

      try {
        const dResp = UrlFetchApp.fetch('https://www.warcraftlogs.com/api/v2/client', {
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + wclToken
          },
          payload: JSON.stringify({ query: detailQuery }),
          muteHttpExceptions: true
        });

        if (dResp.getResponseCode() === 200) {
          const dJson = JSON.parse(dResp.getContentText());
          const reportObj = dJson.data && dJson.data.reportData ? dJson.data.reportData.report : null;
          if (reportObj && reportObj.playerDetails && reportObj.playerDetails.data && reportObj.playerDetails.data.playerDetails) {
            const pData = reportObj.playerDetails.data.playerDetails;
            const allPlayers = [...(pData.tanks || []), ...(pData.healers || []), ...(pData.dps || [])];
            allPlayers.forEach(p => sessionAttendees.add(p.name));
          }
        }
      } catch (err) {
        Logger.log(`Error querying report details for ${r.code}: ${err}`);
      }
    });

    // Query the very first pull of the night for On-Time verification
    if (session.firstReportCode && session.firstFightId) {
      const firstFightQuery = `
        query {
          reportData {
            report(code: "${session.firstReportCode}") {
              playerDetails(fightIDs: [${session.firstFightId}])
            }
          }
        }
      `;
      try {
        const fResp = UrlFetchApp.fetch('https://www.warcraftlogs.com/api/v2/client', {
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + wclToken
          },
          payload: JSON.stringify({ query: firstFightQuery }),
          muteHttpExceptions: true
        });
        if (fResp.getResponseCode() === 200) {
          const fJson = JSON.parse(fResp.getContentText());
          const fReport = fJson.data && fJson.data.reportData ? fJson.data.reportData.report : null;
          if (fReport && fReport.playerDetails && fReport.playerDetails.data && fReport.playerDetails.data.playerDetails) {
            const fData = fReport.playerDetails.data.playerDetails;
            const initialPullPlayers = [...(fData.tanks || []), ...(fData.healers || []), ...(fData.dps || [])];
            initialPullPlayers.forEach(p => firstPullAttendees.add(p.name));
          }
        }
      } catch (err) {
        Logger.log(`Error querying first pull for ${session.firstReportCode}: ${err}`);
      }
    }

    // Determine highest difficulty fought during this raid session (5 = Mythic, 4 = Heroic, 3 = Normal)
    const isMythic = session.reports.some(r => (r.bossFights || r.bossKills || []).some(b => b.difficulty === 5));

    freshRecords.push({
      dateKey: session.dateKey,
      formattedDate: session.formattedDate,
      dayOfWeek: session.dayOfWeek,
      title: session.reports[0].title || 'Guild Raid',
      reportCodes: sessionReportCodes,
      allBossKills: session.allBossKills,
      totalPulls: sessionTotalPulls,
      isMythic: isMythic,
      earliestStartTime: session.earliestStartTime,
      attendees: Array.from(sessionAttendees),
      firstPullAttendees: Array.from(firstPullAttendees)
    });
  });

  // Merge fresh WCL data into the archive and save it (union with archived data for the same night,
  // in case some of that night's reports have already scrolled out of WCL's 40-report window)
  freshRecords.forEach(rec => {
    const old = archiveByDateKey[rec.dateKey];
    archiveByDateKey[rec.dateKey] = (old && old !== rec) ? mergeAttendanceRecords(old, rec) : rec;
  });
  writeAttendanceArchive(ss, archiveByDateKey);

  const allRecords = Object.values(archiveByDateKey).sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
  if (allRecords.length === 0) {
    notifyUser('No Raid Encounters Found', `Found guild reports, but none contained verified ${SEASON.raidName} boss encounters yet.`);
    return;
  }

  // 3. Evaluate every archived raid night against the CURRENT roster, alts, raid days and bench records
  allRecords.forEach(session => {
    const reportLinks = session.reportCodes.map(code => `https://www.warcraftlogs.com/reports/${code}`);

    // Resolve unique Main Character Attendees for this raid night (Alt-to-Main deduplicated)
    const uniqueSessionMains = new Set();
    const uniqueFirstPullMains = new Set();

    session.attendees.forEach(pName => {
      const mainName = resolveToMain(pName);
      if (mainName && playerStats[mainName]) {
        uniqueSessionMains.add(mainName);
      }
    });

    session.firstPullAttendees.forEach(pName => {
      const mainName = resolveToMain(pName);
      if (mainName && playerStats[mainName]) {
        uniqueFirstPullMains.add(mainName);
      }
    });

    const isMythicSession = session.isMythic;

    // Blizzard Guild Group Quorums:
    // - Mythic (20-player locked): Minimum 15 guild members (Cancels if missing >5 raiders)
    // - Heroic / Normal (Flex): Minimum 10 guild members (Minimum flex raid baseline)
    const requiredGuildQuorum = isMythicSession ? 15 : 10;

    // Evaluate if this session meets the Official Guild Raid criteria (Scheduled Day + Difficulty-Aware Guild Quorum)
    const sessionBench = benchByDateKey[session.dateKey] || [];
    const presentBench = [];

    // Only count bench raiders who resolve to a roster main and were NOT already in the logs (no double-counting)
    const benchMainsForQuorum = new Set();
    sessionBench.forEach(bName => {
      const canonical = resolveToMain(bName);
      if (canonical && playerStats[canonical] && !uniqueSessionMains.has(canonical)) benchMainsForQuorum.add(canonical);
    });

    const isScheduledDay = activeDaysList.length === 0 || activeDaysList.some(d => session.dayOfWeek.toLowerCase().includes(d));
    const hasGuildQuorum = (uniqueSessionMains.size + benchMainsForQuorum.size) >= requiredGuildQuorum;
    const isOfficial = hasGuildQuorum && isScheduledDay;

    const presentOnTime = [];
    const presentLate = [];

    if (isOfficial) {
      officialRaidCount++;
      // Increment Attendance exactly ONCE per canonical main for official raid nights
      uniqueSessionMains.forEach(canonical => {
        playerStats[canonical].raidsAttended++;
        playerStats[canonical].totalBossKillsAttended += session.allBossKills.length;

        if (uniqueFirstPullMains.has(canonical)) {
          playerStats[canonical].onTimeCount++;
          presentOnTime.push(canonical);
        } else {
          playerStats[canonical].lateCount++;
          presentLate.push(canonical);
        }
      });

      // Award full 100% Attendance & On-Time credit to Bench / Standby raiders!
      benchMainsForQuorum.forEach(canonical => {
        playerStats[canonical].raidsAttended++;
        playerStats[canonical].onTimeCount++; // Bench raiders were ready on time
        playerStats[canonical].totalBossKillsAttended += session.allBossKills.length;
        presentBench.push(canonical);
      });
    } else {
      // Optional / Alt / PUG Run: Credit boss kills to attendees, but DO NOT penalize absent raiders or increment official raid nights
      uniqueSessionMains.forEach(canonical => {
        playerStats[canonical].totalBossKillsAttended += session.allBossKills.length;
        presentOnTime.push(canonical);
      });
    }

    const titlePrefix = isOfficial ? '' : '📦 [Optional / PUG] ';
    const totalPulls = session.totalPulls || 0;
    const bossesDefeatedText = session.allBossKills.length > 0
      ? session.allBossKills.join(', ')
      : `Progression Wipes (${totalPulls} pull${totalPulls === 1 ? '' : 's'})`;

    raidLedger.push({
      dateKey: session.dateKey,
      date: session.formattedDate,
      title: titlePrefix + (session.title || 'Guild Raid'),
      bossesDefeated: bossesDefeatedText,
      killCount: session.allBossKills.length,
      rosterPresentCount: isOfficial ? (presentOnTime.length + presentLate.length + presentBench.length) : uniqueSessionMains.size,
      benchList: presentBench.length > 0
        ? presentBench.join(', ')
        : (sessionBench.length > 0 && !isOfficial ? `No credit (not an official night): ${sessionBench.join(', ')}` : 'None'),
      presentOnTimeList: presentOnTime.join(', ') || 'None',
      presentLateList: isOfficial ? (presentLate.join(', ') || 'None') : 'N/A (Optional Run)',
      reports: session.reportCodes.map(code => ({ code: code })),
      primaryCode: session.reportCodes[0] || '',
      url: reportLinks.join(' | '),
      isOfficial: isOfficial
    });
  });

  const totalOfficialRaids = officialRaidCount;

  // 3. Build Leaderboard Data
  const leaderboard = Object.values(playerStats).map(p => {
    const attPct = totalOfficialRaids > 0 ? Math.round((p.raidsAttended / totalOfficialRaids) * 100) : 0;
    const onTimePct = p.raidsAttended > 0 ? Math.round((p.onTimeCount / p.raidsAttended) * 100) : 0;
    
    let reliabilityRating = '⭐⭐⭐⭐⭐ Punctual Core';
    if (attPct === 0) reliabilityRating = '⚠️ Inactive / Absent';
    else if (attPct < 60) reliabilityRating = '⚠️ Inconsistent';
    else if (attPct < 80) reliabilityRating = '⭐ Standby / Bench';
    else if (onTimePct < 80) reliabilityRating = '🟡 Frequent Tardy';
    else if (attPct < 90) reliabilityRating = '⭐⭐⭐⭐ Reliable';

    return {
      name: p.name,
      spec: p.spec,
      raidsAttended: p.raidsAttended,
      totalRaids: totalOfficialRaids,
      attendancePct: attPct,
      onTimePct: onTimePct,
      onTimeDisplay: p.raidsAttended > 0 ? `${onTimePct}%` : 'N/A',
      onTimeCount: p.onTimeCount,
      lateCount: p.lateCount,
      bossKills: p.totalBossKillsAttended,
      rating: reliabilityRating
    };
  }).sort((a, b) => b.attendancePct - a.attendancePct || b.onTimePct - a.onTimePct || b.bossKills - a.bossKills);

  // 4. Write onto "Attendance & History" sheet
  createAttendanceAndHistorySheet(leaderboard, raidLedger, totalOfficialRaids);

  SpreadsheetApp.flush(); // Commit attendance + archive before the (much heavier) loot rebuild

  // 5. Automatically refresh Loot & Chase Items sheet so all contenders receive live Attendance % badges!
  let lootNote = 'All badges refreshed on "Loot & Chase Items"!';
  if (ss.getSheetByName(LOOT_SHEET_NAME)) {
    try {
      createLootAndChaseItemsSheet();
    } catch (err) {
      Logger.log('Loot sheet refresh after WCL sync failed: ' + err);
      lootNote = `Attendance is saved, but refreshing "Loot & Chase Items" failed (${err.message}). Run "4. Create/Refresh Loot & Chase Items Sheet" to update badges.`;
    }
  }

  notifyUser(
    'Warcraft Logs Synced!',
    `Successfully merged logs into ${totalOfficialRaids} official raid nights (Tue/Wed Pacific Time).\n\nAll attendance %, on-time punctuality, bench credit, and boss kills have been updated on "Attendance & History".\n\n${lootNote}`
  );
}

/**
 * Creates and formats the "Attendance & History" sheet with dark executive styling.
 */
function createAttendanceAndHistorySheet(leaderboard, raidLedger, totalRaids) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ATTENDANCE_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ATTENDANCE_SHEET_NAME);
  }

  sheet.clear();
  sheet.clearFormats();
  sheet.clearConditionalFormatRules();

  const output = [];

  // 1. Executive Summary Banner
  output.push(['🏛️ GUILD RAID ATTENDANCE, PUNCTUALITY & SEASON 2 HISTORY', '', '', '', '', '', '', '', '', '']);
  output.push([
    `Total Official Guild Raid Nights: ${totalRaids} (Tue & Wed 7:00 - 10:00 PM Pacific)   |   Total Boss Encounters Defeated: ${raidLedger.reduce((sum, r) => sum + r.killCount, 0)}   |   ↻ Refreshed ${formatRefreshedAt(ss)}`,
    '', '', '', '', '', '', '', '', ''
  ]);
  output.push(['', '', '', '', '', '', '', '', '', '']);

  // 2. Section 1: Raider Season Attendance Leaderboard
  output.push(['👑 RAIDER ATTENDANCE & PUNCTUALITY LEADERBOARD', '═════════════════════', '', '', '', '', '', '', '', '']);
  output.push(['Rank', 'Raider Name', 'Assigned Spec', 'Attendance %', 'On-Time %', 'Raids Attended', 'Tardies', 'Total Boss Kills', 'Reliability Tier', '']);

  leaderboard.forEach((p, idx) => {
    output.push([
      idx + 1,
      p.name,
      p.spec || 'Main Spec',
      `${p.attendancePct}%`,
      p.onTimeDisplay,
      `${p.raidsAttended} / ${p.totalRaids}`,
      p.lateCount,
      p.bossKills,
      p.rating,
      ''
    ]);
  });

  output.push(['', '', '', '', '', '', '', '', '', '']);
  output.push(['', '', '', '', '', '', '', '', '', '']);

  // 3. Section 2: Historical Guild Raid Night Ledger
  output.push(['📜 HISTORICAL GUILD RAID NIGHT LEDGER', '═════════════════════', '', '', '', '', '', '', '', '']);
  output.push(['Raid Date', 'Raid Title', 'Bosses Defeated', 'Kills', 'Guild Raiders', '🪑 Bench / Standby (Credit Awarded)', 'On-Time Raiders', 'Late Arrivals', 'Warcraft Logs Link', '']);

  raidLedger.forEach(r => {
    // Generate clean, uniform clickable HYPERLINK formula for single or merged reports
    const reportCode = r.reports && r.reports.length > 0 ? r.reports[0].code : '';
    const linkFormula = reportCode ? `=HYPERLINK("https://www.warcraftlogs.com/reports/${reportCode}", "📊 View Log (${reportCode})")` : '-';

    output.push([
      r.date,
      r.title,
      r.bossesDefeated,
      r.killCount,
      r.rosterPresentCount,
      r.benchList || 'None',
      r.presentOnTimeList,
      r.presentLateList,
      linkFormula,
      ''
    ]);
  });

  sheet.getRange(1, 1, output.length, 10).setValues(output);

  // Formatting & Widths
  sheet.getDataRange().setFontFamily('Roboto');
  sheet.setFrozenRows(1);
  sheet.setHiddenGridlines(true);
  applyTabColor(sheet);
  const archiveSheet = ss.getSheetByName(ATTENDANCE_ARCHIVE_SHEET_NAME);
  if (archiveSheet) applyTabColor(archiveSheet);

  // Banner formatting
  sheet.getRange('A1:J1').merge().setBackground('#0f172a').setFontColor('#f8fafc').setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center');
  sheet.getRange('A2:J2').merge().setBackground('#1e293b').setFontColor('#94a3b8').setFontSize(9).setHorizontalAlignment('center');

  // Table Headers
  sheet.getRange('A4:J4').setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold').setFontSize(10);
  sheet.getRange('A5:J5').setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center');

  // Leaderboard rows: alternating fills, names bold, figures centred
  if (leaderboard.length > 0) {
    const boardAlignments = leaderboard.map(() => ['center', 'left', 'left', 'center', 'center', 'center', 'center', 'center', 'left', 'left']);
    sheet.getRange(6, 1, leaderboard.length, 10)
      .setBackgrounds(zebraBackgrounds(leaderboard.length, 10))
      .setFontSize(9)
      .setVerticalAlignment('middle')
      .setHorizontalAlignments(boardAlignments);
    sheet.getRange(6, 2, leaderboard.length, 1).setFontWeight('bold');
  }

  // Section 2: Historical Ledger Headers
  const ledgerTitleRow = leaderboard.length + 8;
  const ledgerHeaderRow = leaderboard.length + 9;
  sheet.getRange(ledgerTitleRow, 1, 1, 10).setBackground('#1e293b').setFontColor('#f8fafc').setFontWeight('bold').setFontSize(10);
  sheet.getRange(ledgerHeaderRow, 1, 1, 10).setBackground('#334155').setFontColor('#f8fafc').setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center');

  // Alternating Row Colors for Ledger Data (batched: one call per property instead of several per row)
  if (raidLedger.length > 0) {
    const ledgerRange = sheet.getRange(ledgerHeaderRow + 1, 1, raidLedger.length, 10);
    const rowColors = raidLedger.map((_, rowIdx) => new Array(10).fill(rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc'));
    // Center: Date (1), Kills (4), Guild Raiders (5), Link (9)
    const alignments = raidLedger.map(() => ['center', 'left', 'left', 'center', 'center', 'left', 'left', 'left', 'center', 'left']);
    ledgerRange.setBackgrounds(rowColors).setFontSize(9).setVerticalAlignment('middle').setHorizontalAlignments(alignments);
  }

  // Column Widths
  sheet.setColumnWidth(1, 130); // Rank / Date
  sheet.setColumnWidth(2, 180); // Name / Title
  sheet.setColumnWidth(3, 260); // Spec / Bosses Defeated
  sheet.setColumnWidth(4, 90);  // Attendance % / Kills
  sheet.setColumnWidth(5, 90);  // On-Time % / Guild Raiders
  sheet.setColumnWidth(6, 220); // Raids Attended / Bench Raiders
  sheet.setColumnWidth(7, 180); // Tardies / On-Time List
  sheet.setColumnWidth(8, 120); // Late Arrivals
  sheet.setColumnWidth(9, 180); // WCL Link
  sheet.setColumnWidth(10, 160); // Reliability Tier

  // Attendance % and On-Time % (columns D:E) coloured by value: 90%+ green, 75-89% amber, under 75% red.
  // A cell holds "93%" text or, once Sheets parses it, the number 0.93, so both are turned into 0-100 first.
  const rules = [];
  if (leaderboard.length > 0) {
    const pctRange = [sheet.getRange(6, 4, leaderboard.length, 2)];
    const pct = 'IF(ISNUMBER(D6), D6 * 100, IFERROR(VALUE(SUBSTITUTE(D6, "%", "")), -1))';
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(`=${pct} >= 90`).setBackground('#d1fae5').setFontColor('#065f46').setRanges(pctRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(`=AND(${pct} >= 75, ${pct} < 90)`).setBackground('#fef3c7').setFontColor('#92400e').setRanges(pctRange).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(`=AND(${pct} >= 0, ${pct} < 75)`).setBackground('#fee2e2').setFontColor('#991b1b').setRanges(pctRange).build());
  }
  sheet.setConditionalFormatRules(rules);
}
