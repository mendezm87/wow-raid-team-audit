# ⚔️ WoW Raid Team Audit & Loot Council Assistant

A Google Apps Script automation suite designed for World of Warcraft raid teams in **Midnight Season 2 (Patch 12.1)**. 

Integrates live data from the **Blizzard Armory API**, **Raidbots Droptimizer Sims**, **Archon.gg Meta Builds**, and **Wowhead Guides** directly into Google Sheets.

---

## 📖 Officer & User Documentation

👉 **Read the full [Officer & Raid Leader Guide](OFFICER_GUIDE.md)** for detailed instructions on:
- Weekly audit routines
- Interactive spec dropdowns & zero-config auto-population
- Talents, builds & Hero Talent tree tracking
- Loot Council & chase item prioritization
- Importing single or batch Raidbots Droptimizer sims

---

## 🤖 Discord Droptimizer Bot (Real-Time Sim Ingestion)

Raiders can share their Raidbots Droptimizer links directly in your guild Discord (e.g. in `#raidbots`) or use `/sim <url>`, and the bot automatically updates the **Loot & Chase Items** sheet in real time!

### ⚡ 3-Minute Setup on Your 24/7 Machine:

1. **Deploy Google Apps Script Web App**:
   * Open your Google Spreadsheet $\rightarrow$ **Extensions > Apps Script**.
   * Make sure latest `guildAudit.gs` is pasted and saved (💾).
   * Click **Deploy > New deployment** in the top right.
   * Click the ⚙️ gear icon and choose **Web app**.
   * Set:
     * **Description**: `Discord Sim Webhook`
     * **Execute as**: `Me`
     * **Who has access**: `Anyone` *(Crucial so the bot can post sims)*
   * Click **Deploy** and copy your **Web App URL** (`https://script.google.com/macros/s/.../exec`).

2. **Configure `.env` on Your Machine**:
   In `discord-bot/.env`, paste your credentials:
   ```env
   DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
   GOOGLE_SHEET_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   SIMS_CHANNEL_ID=1375347222216052786
   ```

3. **Install & Run**:
   ```bash
   npm install
   npm start
   ```

4. **(Optional) Run in background 24/7 with PM2**:
   ```bash
   npm install -g pm2
   pm2 start discord-bot/index.js --name "wow-raid-bot"
   pm2 save
   pm2 startup
   ```

5. **How to Update Your Bot When New Changes are Pushed**:
   * **If using PM2:**
     ```bash
     git pull
     pm2 restart wow-raid-bot
     ```
   * **If running manually in terminal:**
     1. Stop the bot with `Ctrl + C`.
     2. Pull the update:
        ```bash
        git pull
        ```
     3. Restart:
        ```bash
        npm start
        ```

---

## 🎮 How Raiders Use the Bot in Discord

Raiders can post either **Raidbots** (DPS/Tanks) or **QE Live** (Healers) links in your `#sims` channel or use `/sim`:

* **⚔️ DPS & Tanks (Raidbots Droptimizer):**
  ```text
  https://www.raidbots.com/simbot/report/aM6qT1dQz2CPxVodxJDy5k
  ```
* **🩺 Healers (Questionably Epic Live Upgrade Report):**
  ```text
  https://questionablyepic.com/live/upgradereport/iukuwubrwnfr
  ```
  *(Note: Personal loot / Bonus Roll items are automatically excluded)*

---

## ⚡ Key Features

1. **Live Character Gear & Vault Audit**:
   - Item level, 4pc tier set check, sockets, gems, enchants.
   - Great Vault tracking updated to the official Patch 12.1 reward table.
   - `Raid Ready` badge with automatic **Off-Spec Logout Alerts**.

2. **Talents & Builds Sheet**:
   - Hero Talent Tree & In-game talent loadout codes.
   - 1-Click meta builds for **Archon (Heroic)**, **Archon (Mythic)**, and **Wowhead Guides**.
   - 1-Click preloaded **Raidbots Droptimizer Links** with character-specific realm resolution.

3. **Loot Council Assistant (*The Venomous Abyss*)**:
   - All 8 boss chase items, trinkets, weapons, and tier tokens.
   - **Live Contender Scanner** (computes live ilvl $\Delta$ across all slots including dual trinkets/rings).
   - **Raidbots Droptimizer Sim Importer** with multi-link batching, cumulative non-destructive merging, and Sim Priority protection.
   - **Sim Freshness & Stale Sim Badges** (`✅ Simmed`, `⚠️ Stale`, `⚡ Live Armory ilvl`).
