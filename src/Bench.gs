/**
 * Returns data needed by the Bench & Standby Raiders interactive modal dialog.
 */
function getBenchDialogData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = getConfigurationFromSheet();
  const scriptProperties = PropertiesService.getScriptProperties();
  const benchRecords = JSON.parse(scriptProperties.getProperty('bench_records') || '{}');

  const members = (config.MEMBERS_TO_TRACK || []).map(m => ({
    name: m.name,
    spec: m.expectedSpec || '',
    realm: m.realm || ''
  }));

  // Extract raid dates from Attendance & History sheet ledger if available
  const raidDates = [];
  const attSheet = ss.getSheetByName(ATTENDANCE_SHEET_NAME);
  if (attSheet && attSheet.getLastRow() >= 10) {
    const values = attSheet.getDataRange().getValues();
    let inLedger = false;
    for (let r = 0; r < values.length; r++) {
      const col0 = (values[r][0] || '').toString().trim();
      if (col0.includes('HISTORICAL GUILD RAID NIGHT LEDGER')) {
        inLedger = true;
        r += 1; // Skip header row
        continue;
      }
      if (inLedger && col0 && !col0.includes('Rank') && !col0.includes('═')) {
        const title = (values[r][1] || '').toString().trim();
        raidDates.push({
          dateStr: col0,
          title: title
        });
      }
    }
  }

  // If no dates on sheet yet, provide recent dates
  if (raidDates.length === 0) {
    const today = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date(today.getTime() - i * 86400000 * 3);
      const str = Utilities.formatDate(d, 'America/Los_Angeles', 'EEE, MMM d, yyyy');
      raidDates.push({ dateStr: str, title: 'Official Guild Raid' });
    }
  }

  return {
    raidDates: raidDates,
    members: members,
    benchRecords: benchRecords
  };
}

/**
 * Saves selected bench raiders for a specific raid night and refreshes attendance & loot sheets.
 */
function saveBenchRaiders(dateKey, selectedPlayerNames) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const benchRecords = JSON.parse(scriptProperties.getProperty('bench_records') || '{}');
  
  benchRecords[dateKey] = selectedPlayerNames || [];
  scriptProperties.setProperty('bench_records', JSON.stringify(benchRecords));

  // Automatically trigger WCL sync to recalculate leaderboard and loot scores
  syncWarcraftLogsSeasonAttendance();

  return {
    success: true,
    dateKey: dateKey,
    count: selectedPlayerNames.length
  };
}

/**
 * Displays the modern, interactive Mythic Bench & Standby Raiders checkbox dialog.
 */
function showBenchRaidersDialog() {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Roboto', sans-serif;
            background-color: #0f172a;
            color: #f8fafc;
            margin: 0;
            padding: 16px;
          }
          h3 {
            margin: 0 0 12px 0;
            color: #38bdf8;
            font-size: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .subtitle {
            font-size: 12px;
            color: #94a3b8;
            margin-bottom: 14px;
          }
          label {
            font-size: 12px;
            font-weight: 500;
            color: #cbd5e1;
            display: block;
            margin-bottom: 6px;
          }
          select, input[type="text"] {
            width: 100%;
            padding: 8px 10px;
            background: #1e293b;
            border: 1px solid #334155;
            color: #f8fafc;
            border-radius: 6px;
            font-size: 13px;
            box-sizing: border-box;
            margin-bottom: 12px;
          }
          .grid-container {
            max-height: 240px;
            overflow-y: auto;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 6px;
            padding: 10px;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }
          .member-card {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #0f172a;
            padding: 6px 8px;
            border-radius: 4px;
            border: 1px solid #334155;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .member-card:hover {
            border-color: #38bdf8;
          }
          .member-card input {
            cursor: pointer;
          }
          .member-name {
            font-size: 12px;
            font-weight: 500;
          }
          .member-spec {
            font-size: 10px;
            color: #94a3b8;
          }
          .actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 14px;
          }
          .quick-btn {
            background: none;
            border: 1px solid #475569;
            color: #94a3b8;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
          }
          .quick-btn:hover {
            color: #f8fafc;
            border-color: #94a3b8;
          }
          .btn-save {
            background: #10b981;
            color: #ffffff;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            transition: background 0.2s ease;
          }
          .btn-save:hover {
            background: #059669;
          }
          .btn-save:disabled {
            background: #475569;
            cursor: not-allowed;
          }
          #statusMsg {
            font-size: 11px;
            color: #34d399;
            margin-top: 8px;
            text-align: center;
            min-height: 16px;
          }
        </style>
      </head>
      <body>
        <h3>🪑 Mythic Bench & Standby Credit Manager</h3>
        <div class="subtitle">Select the raid night and check all raiders on standby in Discord to award them 100% attendance & punctuality credit.</div>

        <label for="dateSelect">Select Raid Night:</label>
        <select id="dateSelect" onchange="onDateChange()"></select>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <label style="margin:0;">Select Bench Raiders:</label>
          <div>
            <button class="quick-btn" onclick="toggleAll(true)">Select All</button>
            <button class="quick-btn" onclick="toggleAll(false)">Clear</button>
          </div>
        </div>

        <div class="grid-container" id="rosterContainer">
          <div style="color:#94a3b8; font-size:12px; grid-column:span 2;">Loading guild roster...</div>
        </div>

        <div id="statusMsg"></div>

        <div class="actions">
          <button class="quick-btn" onclick="google.script.host.close()">Cancel</button>
          <button class="btn-save" id="btnSave" onclick="saveBench()">💾 Save & Award Bench Credit</button>
        </div>

        <script>
          let dialogData = null;

          function init() {
            google.script.run
              .withSuccessHandler(function(data) {
                dialogData = data;
                populateDates();
                populateRoster();
              })
              .withFailureHandler(function(err) {
                document.getElementById('statusMsg').innerText = 'Error loading data: ' + err.message;
              })
              .getBenchDialogData();
          }

          function populateDates() {
            const select = document.getElementById('dateSelect');
            select.innerHTML = '';
            dialogData.raidDates.forEach(function(d) {
              const opt = document.createElement('option');
              opt.value = d.dateStr;
              opt.innerText = d.dateStr + ' (' + d.title + ')';
              select.appendChild(opt);
            });
            onDateChange();
          }

          function populateRoster() {
            const container = document.getElementById('rosterContainer');
            container.innerHTML = '';
            const selectedDate = document.getElementById('dateSelect').value;
            const currentBench = (dialogData.benchRecords && dialogData.benchRecords[selectedDate]) || [];

            dialogData.members.forEach(function(m) {
              const isChecked = currentBench.includes(m.name);
              const card = document.createElement('label');
              card.className = 'member-card';
              card.innerHTML = 
                '<input type="checkbox" value="' + m.name + '" ' + (isChecked ? 'checked' : '') + '> ' +
                '<div>' +
                  '<div class="member-name">' + m.name + '</div>' +
                  '<div class="member-spec">' + (m.spec || 'Main Spec') + '</div>' +
                '</div>';
              container.appendChild(card);
            });
          }

          function onDateChange() {
            if (!dialogData) return;
            populateRoster();
          }

          function toggleAll(check) {
            const checkboxes = document.querySelectorAll('#rosterContainer input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = check);
          }

          function saveBench() {
            const btn = document.getElementById('btnSave');
            const status = document.getElementById('statusMsg');
            const dateVal = document.getElementById('dateSelect').value;
            
            const selected = [];
            const checkboxes = document.querySelectorAll('#rosterContainer input[type="checkbox"]:checked');
            checkboxes.forEach(cb => selected.push(cb.value));

            btn.disabled = true;
            btn.innerText = '⏳ Syncing Attendance...';
            status.style.color = '#38bdf8';
            status.innerText = 'Saving bench credit and recalculating attendance scores...';

            google.script.run
              .withSuccessHandler(function(res) {
                status.style.color = '#34d399';
                status.innerText = '✅ Successfully awarded bench credit to ' + res.count + ' raiders!';
                setTimeout(function() {
                  google.script.host.close();
                }, 1500);
              })
              .withFailureHandler(function(err) {
                btn.disabled = false;
                btn.innerText = '💾 Save & Award Bench Credit';
                status.style.color = '#f87171';
                status.innerText = '❌ Error: ' + err.message;
              })
              .saveBenchRaiders(dateVal, selected);
          }

          window.onload = init;
        </script>
      </body>
    </html>
  `;

  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(520)
    .setHeight(480);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '🪑 Mythic Bench & Standby Credit Manager');
}
