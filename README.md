# ⚔️ WoW Raid Team Audit & Loot Council Assistant

A Google Apps Script automation suite designed for World of Warcraft raid teams in **Midnight Season 2 (Patch 12.1)**. 

Integrates live data from the **Blizzard Armory API**, **Raidbots Droptimizer Sims**, **Archon.gg Meta Builds**, and **Wowhead Guides** directly into Google Sheets.

---

## 📖 Documentation & User Guides

* 👉 **[Officer & Raid Leader Guide](OFFICER_GUIDE.md)**: Full guide on weekly audit routines, roster config, Loot Council settings, and Discord bot maintenance.
* 👉 **[Raider Guide](RAIDER_GUIDE.md)**: Step-by-step guide for guild members on how to check their gear readiness, copy talent loadout codes, and submit Droptimizer/QE Live sims via Discord!

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
   - **Composite Priority Score Engine** ($\text{Score} = \text{Raw Upgrade} \times \text{Reliability Index} \times \text{Role Multiplier}$).
   - **Roster Roles**: `👑 Veteran` ($1.10\times$), `⚔️ Raider` ($1.00\times$), and `🛡️ Trial` ($0.80\times$).
   - **Raidbots Droptimizer & QE Live Healer Importers** with Discord bot integration and non-destructive merging.
   - **Sim Freshness & Stale Badges** (`✅ Simmed`, `⚠️ Stale`, `⚡ Live Armory ilvl`).

4. **Warcraft Logs Attendance & Season History**:
   - Automated attendance %, on-time punctuality, and boss kills synced via WCL v2 GraphQL API.
   - **Difficulty-Aware Guild Quorums** ($\ge 10$ for Heroic, $\ge 15$ for Mythic) to automatically filter out off-hours PUGs from mandatory attendance.
   - **🪑 Mythic Bench & Standby Credit Manager**: Interactive modal dialog (`Guild Audit > 8. 🪑 Mark Bench & Standby Raiders`) to award standby raiders full 100% attendance and on-time credit with 1 click!
