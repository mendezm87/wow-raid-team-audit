/**
 * Returns currently saved credentials for the Officer API Setup Guide modal.
 */
function getOfficerCredentialsData() {
  const scriptProps = PropertiesService.getScriptProperties();

  return {
    blizzardClientId: getSharedCredential('CLIENT_ID'),
    blizzardClientSecret: getSharedCredential('CLIENT_SECRET'),
    wclClientId: getSharedCredential('WCL_CLIENT_ID'),
    wclClientSecret: getSharedCredential('WCL_CLIENT_SECRET'),
    discordBotToken: scriptProps.getProperty('DISCORD_BOT_TOKEN') || '',
    discordChannelId: scriptProps.getProperty('SIMS_CHANNEL_ID') || ''
  };
}

/**
 * Saves all officer API credentials in one batch from the Officer Setup Guide modal.
 */
function saveOfficerCredentials(creds) {
  if (!creds) throw new Error('No credentials provided.');

  const scriptProps = PropertiesService.getScriptProperties();

  // Save Blizzard credentials
  if (creds.blizzardClientId && creds.blizzardClientSecret) {
    scriptProps.setProperties({
      'CLIENT_ID': creds.blizzardClientId.trim(),
      'CLIENT_SECRET': creds.blizzardClientSecret.trim()
    });
  }

  // Save Warcraft Logs credentials
  if (creds.wclClientId && creds.wclClientSecret) {
    scriptProps.setProperties({
      'WCL_CLIENT_ID': creds.wclClientId.trim(),
      'WCL_CLIENT_SECRET': creds.wclClientSecret.trim()
    });
    scriptProps.deleteProperty('wcl_token');
    scriptProps.deleteProperty('wcl_token_expiry');
  }

  // Save Discord credentials
  if (creds.discordBotToken) scriptProps.setProperty('DISCORD_BOT_TOKEN', creds.discordBotToken.trim());
  if (creds.discordChannelId) scriptProps.setProperty('SIMS_CHANNEL_ID', creds.discordChannelId.trim());

  // Also sync to Config sheet if present
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('Config') || ss.getSheetByName('config');
  if (configSheet && (creds.discordBotToken || creds.discordChannelId)) {
    const data = configSheet.getDataRange().getValues();
    data.forEach((r, idx) => {
      const k = (r[0] || '').toString().trim().toUpperCase();
      if (k === 'DISCORD_BOT_TOKEN' && creds.discordBotToken) configSheet.getRange(idx + 1, 2).setValue(creds.discordBotToken.trim());
      if (k === 'SIMS_CHANNEL_ID' && creds.discordChannelId) configSheet.getRange(idx + 1, 2).setValue(creds.discordChannelId.trim());
    });
  }

  return { success: true };
}

/**
 * Displays an interactive, rich Officer Setup Guide modal with step-by-step instructions
 * and live input fields for Blizzard, Warcraft Logs, and Discord Bot credentials.
 */
function showOfficerApiSetupGuide() {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_blank">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
          body { background: #0f172a; color: #f8fafc; padding: 20px; font-size: 13px; line-height: 1.5; }
          
          .header { text-align: center; margin-bottom: 20px; }
          .header h2 { font-size: 18px; color: #38bdf8; font-weight: 700; margin-bottom: 4px; }
          .header p { font-size: 12px; color: #94a3b8; }
          
          .tabs { display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid #334155; padding-bottom: 8px; }
          .tab-btn { background: #1e293b; color: #94a3b8; border: 1px solid #334155; border-radius: 6px; padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
          .tab-btn.active { background: #0284c7; color: #ffffff; border-color: #38bdf8; }
          
          .tab-content { display: none; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
          .tab-content.active { display: block; }
          
          .step-list { margin-bottom: 14px; }
          .step-item { display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-start; }
          .step-num { background: #38bdf8; color: #0f172a; font-weight: 800; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; margin-top: 2px; }
          .step-text { color: #cbd5e1; font-size: 12px; }
          .step-text a { color: #38bdf8; text-decoration: underline; font-weight: 600; }
          .step-text code { background: #0f172a; padding: 2px 6px; border-radius: 4px; color: #facc15; font-family: monospace; font-size: 11px; }

          .input-group { margin-top: 12px; }
          .input-label { display: block; font-size: 11px; font-weight: 600; color: #94a3b8; margin-bottom: 4px; }
          .input-field { width: 100%; background: #0f172a; border: 1px solid #475569; border-radius: 6px; padding: 8px 10px; color: #f8fafc; font-size: 12px; font-family: monospace; }
          .input-field:focus { outline: none; border-color: #38bdf8; }

          .footer { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid #334155; }
          .status-msg { font-size: 12px; font-weight: 600; color: #94a3b8; }
          .btn-save { background: #10b981; color: #ffffff; border: none; border-radius: 6px; padding: 10px 18px; font-size: 13px; font-weight: 700; cursor: pointer; transition: background 0.2s; }
          .btn-save:hover { background: #059669; }
          .btn-save:disabled { background: #475569; cursor: not-allowed; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>🛡️ Officer Setup & API Credentials Guide</h2>
          <p>Configure your automated Blizzard Armory, Warcraft Logs, and Discord integrations.</p>
        </div>

        <div class="tabs">
          <button class="tab-btn active" onclick="showTab('blizzard')">⚡ 1. Blizzard API</button>
          <button class="tab-btn" onclick="showTab('wcl')">📊 2. Warcraft Logs API</button>
          <button class="tab-btn" onclick="showTab('discord')">🤖 3. Discord Bot Sync</button>
        </div>

        <!-- TAB 1: BLIZZARD API -->
        <div id="tab-blizzard" class="tab-content active">
          <div class="step-list">
            <div class="step-item">
              <div class="step-num">1</div>
              <div class="step-text">Visit the <a href="https://develop.battle.net/access/clients" target="_blank">Blizzard Battle.net Developer Portal</a> and log in with your Battle.net account.</div>
            </div>
            <div class="step-item">
              <div class="step-num">2</div>
              <div class="step-text">Click <b>Create Client</b> in the top right.</div>
            </div>
            <div class="step-item">
              <div class="step-num">3</div>
              <div class="step-text">Set <b>Client Name</b> to <code>WoW Raid Audit</code>, choose region (e.g. <code>United States</code>), and set <b>Redirect URL</b> to <code>https://localhost</code>.</div>
            </div>
            <div class="step-item">
              <div class="step-num">4</div>
              <div class="step-text">Copy your generated <b>Client ID</b> and <b>Client Secret</b> into the boxes below:</div>
            </div>
          </div>

          <div class="input-group">
            <label class="input-label">BLIZZARD CLIENT ID</label>
            <input type="text" id="blzId" class="input-field" placeholder="e.g. 9b8c7d6e5f4a3b2c1d0e...">
          </div>
          <div class="input-group">
            <label class="input-label">BLIZZARD CLIENT SECRET</label>
            <input type="password" id="blzSecret" class="input-field" placeholder="e.g. XyZ123abc456...">
          </div>
        </div>

        <!-- TAB 2: WARCRAFT LOGS API -->
        <div id="tab-wcl" class="tab-content">
          <div class="step-list">
            <div class="step-item">
              <div class="step-num">1</div>
              <div class="step-text">Visit the <a href="https://www.warcraftlogs.com/api/clients/" target="_blank">Warcraft Logs API Clients Portal</a> and log into your account.</div>
            </div>
            <div class="step-item">
              <div class="step-num">2</div>
              <div class="step-text">Click <b>Create Client</b>.</div>
            </div>
            <div class="step-item">
              <div class="step-num">3</div>
              <div class="step-text">Set <b>Client Name</b> to <code>Guild Attendance Audit</code>, set <b>Redirect URL</b> to <code>https://localhost</code>, and leave <b>Public Client</b> unchecked. <i>(This must be a <b>V2 client</b> — the single "V1 Client Key" on the Web API settings page will not work.)</i></div>
            </div>
            <div class="step-item">
              <div class="step-num">4</div>
              <div class="step-text">Copy your <b>Client ID</b> and <b>Client Secret</b> into the boxes below. They are shared with every officer and scheduled trigger, so this only needs to be done once for the whole guild.</div>
            </div>
          </div>

          <div class="input-group">
            <label class="input-label">WARCRAFT LOGS CLIENT ID</label>
            <input type="text" id="wclId" class="input-field" placeholder="Paste your Warcraft Logs client ID">
          </div>
          <div class="input-group">
            <label class="input-label">WARCRAFT LOGS CLIENT SECRET</label>
            <input type="password" id="wclSecret" class="input-field" placeholder="Paste your Warcraft Logs client secret">
          </div>
        </div>

        <!-- TAB 3: DISCORD BOT SYNC -->
        <div id="tab-discord" class="tab-content">
          <div class="step-list">
            <div class="step-item">
              <div class="step-num">1</div>
              <div class="step-text">Visit the <a href="https://discord.com/developers/applications" target="_blank">Discord Developer Portal</a> to view or create your Guild Bot.</div>
            </div>
            <div class="step-item">
              <div class="step-num">2</div>
              <div class="step-text">Go to <b>Bot</b> $\rightarrow$ Click <b>Reset Token</b> $\rightarrow$ Copy the <b>Bot Token</b>.</div>
            </div>
            <div class="step-item">
              <div class="step-num">3</div>
              <div class="step-text">In Discord, right-click your <code>#sims</code> channel $\rightarrow$ Click <b>Copy Channel ID</b> <i>(Enable Developer Mode in Discord Settings > Advanced if needed)</i>.</div>
            </div>
            <div class="step-item">
              <div class="step-num">4</div>
              <div class="step-text">Paste your <b>Bot Token</b> and <b>Channel ID</b> below for 1-Click Sim Syncing directly in Google Sheets:</div>
            </div>
          </div>

          <div class="input-group">
            <label class="input-label">DISCORD BOT TOKEN</label>
            <input type="password" id="discToken" class="input-field" placeholder="e.g. MTM3NTM0NzIy... (Bot Token)">
          </div>
          <div class="input-group">
            <label class="input-label">DISCORD SIMS CHANNEL ID</label>
            <input type="text" id="discChannel" class="input-field" placeholder="e.g. 1375347222216052786">
          </div>
        </div>

        <div class="footer">
          <div id="statusMsg" class="status-msg">Click Save to store credentials.</div>
          <button id="btnSave" class="btn-save" onclick="saveCredentials()">💾 Save All Credentials</button>
        </div>

        <script>
          function showTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(function(el) { el.classList.remove('active'); });
            document.querySelectorAll('.tab-btn').forEach(function(el) { el.classList.remove('active'); });
            
            document.getElementById('tab-' + tabId).classList.add('active');
            event.target.classList.add('active');
          }

          function init() {
            google.script.run
              .withSuccessHandler(function(data) {
                if (data.blizzardClientId) document.getElementById('blzId').value = data.blizzardClientId;
                if (data.blizzardClientSecret) document.getElementById('blzSecret').value = data.blizzardClientSecret;
                if (data.wclClientId) document.getElementById('wclId').value = data.wclClientId;
                if (data.wclClientSecret) document.getElementById('wclSecret').value = data.wclClientSecret;
                if (data.discordBotToken) document.getElementById('discToken').value = data.discordBotToken;
                if (data.discordChannelId) document.getElementById('discChannel').value = data.discordChannelId;
              })
              .getOfficerCredentialsData();
          }

          function saveCredentials() {
            const btn = document.getElementById('btnSave');
            const status = document.getElementById('statusMsg');

            const payload = {
              blizzardClientId: document.getElementById('blzId').value.trim(),
              blizzardClientSecret: document.getElementById('blzSecret').value.trim(),
              wclClientId: document.getElementById('wclId').value.trim(),
              wclClientSecret: document.getElementById('wclSecret').value.trim(),
              discordBotToken: document.getElementById('discToken').value.trim(),
              discordChannelId: document.getElementById('discChannel').value.trim()
            };

            btn.disabled = true;
            btn.innerText = '⏳ Saving...';
            status.style.color = '#38bdf8';
            status.innerText = 'Saving credentials to secure script storage...';

            google.script.run
              .withSuccessHandler(function() {
                status.style.color = '#34d399';
                status.innerText = '✅ All credentials saved successfully!';
                btn.innerText = 'Saved!';
                setTimeout(function() {
                  google.script.host.close();
                }, 1500);
              })
              .withFailureHandler(function(err) {
                btn.disabled = false;
                btn.innerText = '💾 Save All Credentials';
                status.style.color = '#f87171';
                status.innerText = '❌ Error: ' + err.message;
              })
              .saveOfficerCredentials(payload);
          }

          window.onload = init;
        </script>
      </body>
    </html>
  `;

  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(620)
    .setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '📖 Officer API Credentials & Setup Guide');
}
