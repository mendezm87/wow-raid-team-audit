function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Guild Audit')
      .addItem('📖 Officer Setup & API Credentials Guide', 'showOfficerApiSetupGuide')
      .addSeparator()
      .addItem('1. Set Blizzard API Credentials', 'promptForCredentials')
      .addItem('2. Create Config Sheet', 'createConfigSheet')
      .addSeparator()
      .addItem('3. Run Full Audit & Talents', 'updateAllCharacterDataWithBonuses')
      .addItem('4. Create/Refresh Loot & Chase Items Sheet', 'createLootAndChaseItemsSheet')
      .addItem('4b. ⚔️ Toggle Loot Difficulty (Heroic ↔ Mythic)', 'toggleLootDifficulty')
      .addItem('4c. 🔄 Re-download Loot Table from Blizzard', 'refreshLootTableFromBlizzard')
      .addItem('5. Import Raidbots / QE Live Sim', 'promptAndImportRaidbotsDroptimizer')
      .addItem('5b. 🔄 Pull & Sync All Latest Sims from Discord', 'syncLatestSimsFromDiscord')
      .addSeparator()
      .addItem('6. Sync Warcraft Logs Attendance & History', 'syncWarcraftLogsSeasonAttendance')
      .addItem('7. Set Warcraft Logs API Credentials', 'promptForWCLCredentials')
      .addItem('8. 🪑 Mark Bench & Standby Raiders', 'showBenchRaidersDialog')
      .addToUi();
}

/**
 * Shows a popup when a person is running the script from the sheet. From a time-driven trigger there is
 * no UI, so the message is logged instead -- and errors are thrown so the trigger is marked Failed and
 * Google emails the trigger owner.
 */
function notifyUser(title, message, isError) {
  let ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) { ui = null; }
  if (ui) {
    ui.alert(title, message, ui.ButtonSet.OK);
    return;
  }
  Logger.log(`${title}: ${message}`);
  if (isError) throw new Error(`${title}: ${message}`);
}

/**
 * Reads an API credential from Script Properties, which every officer and every trigger share.
 * Credentials saved per-user before sharing existed are copied into Script Properties the first time
 * their owner runs anything, so other officers can use them without any setup.
 */
function getSharedCredential(key) {
  const scriptProps = PropertiesService.getScriptProperties();
  const shared = scriptProps.getProperty(key);
  if (shared) return shared;
  const legacy = PropertiesService.getUserProperties().getProperty(key);
  if (legacy) scriptProps.setProperty(key, legacy);
  return legacy || '';
}
