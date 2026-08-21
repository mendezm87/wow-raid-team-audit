# 🤖 WoW Raid Team Audit - Discord Droptimizer Bot

A lightweight Discord Bot that automatically catches Raidbots Droptimizer sim reports shared in your guild Discord (or via `/sim`) and syncs exact mathematical DPS upgrade percentages directly to your **Loot & Chase Items (Loot Council)** Google Sheet in real time.

---

## ⚡ 3-Step Setup Guide

### Step 1: Deploy Google Apps Script Web App (1 minute)
1. Open your Google Spreadsheet.
2. Go to **Extensions > Apps Script**.
3. In the top right, click **Deploy > New deployment**.
4. Click the gear icon ⚙️ next to *Select type* and choose **Web app**.
5. Configure:
   * **Description**: `Discord Sim Webhook`
   * **Execute as**: `Me`
   * **Who has access**: `Anyone` *(Note: This allows the Discord bot to post sims to the sheet)*
6. Click **Deploy**.
7. Copy your **Web App URL** (e.g. `https://script.google.com/macros/s/AKfycb.../exec`).

---

### Step 2: Create Your Discord Bot Token (2 minutes)
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and name it (e.g., `Prey Raid Sim Bot`).
3. In the left sidebar, click **Bot**:
   * Click **Reset Token** and copy the **Bot Token**.
   * Under **Privileged Gateway Intents**, turn **ON** `Message Content Intent`.
4. In the left sidebar, click **OAuth2 > URL Generator**:
   * Scopes: Check `bot` and `applications.commands`.
   * Bot Permissions: Check `Send Messages`, `Embed Links`, `Read Messages/View Channels`, `Add Reactions`.
   * Copy the generated URL at the bottom and open it in your browser to invite the bot to your Discord server!

---

### Step 3: Deploy Free 24/7 Cloud Hosting on Render.com (2 minutes)
1. Go to [Render.com](https://render.com/) and sign up / log in with GitHub (100% Free).
2. Click **New + > Web Service** (or Background Worker).
3. Connect your repository (`wow-raid-team-audit`).
4. Set the following settings:
   * **Root Directory**: `discord-bot`
   * **Build Command**: `npm install`
   * **Start Command**: `node index.js`
5. Scroll down to **Environment Variables** and add:
   * `DISCORD_BOT_TOKEN`: *(Your bot token from Step 2)*
   * `GOOGLE_SHEET_WEBHOOK_URL`: *(Your Web App URL from Step 1)*
   * `SIMS_CHANNEL_ID`: *(Optional: Channel ID of your #raid-sims channel)*
6. Click **Create Web Service**.

🎉 **Your bot is now live in the cloud 24/7!**

---

## 🎮 How Raiders Use It in Discord

### Method 1: Just Paste the Link
Raiders can post either **Raidbots** (DPS/Tanks) or **QE Live** (Healers) links into your `#raid-sims` channel:
* **DPS & Tanks (Raidbots Droptimizer):**
  ```text
  https://www.raidbots.com/simbot/report/aM6qT1dQz2CPxVodxJDy5k
  ```
* **Healers (Questionably Epic Live Upgrade Report):**
  ```text
  https://questionablyepic.com/live/upgradereport/iukuwubrwnfr
  ```
The bot will react with `⏳` $\rightarrow$ `✅` and reply with an embed showing their mapped upgrades! *(Bonus roll personal loot items are automatically excluded)*

### Method 2: Slash Command
Raiders can also type:
```text
/sim report_url:https://www.raidbots.com/simbot/report/aM6qT1dQz2CPxVodxJDy5k
```
or
```text
/sim report_url:https://questionablyepic.com/live/upgradereport/iukuwubrwnfr
```

---

## 🔄 Updating Your Bot on a Local / Dedicated Machine

* **If running with PM2:**
  ```bash
  git pull
  pm2 restart wow-raid-bot
  ```
* **If running directly with Node:**
  1. Press `Ctrl + C` in the running terminal.
  2. Run `git pull`.
  3. Run `npm start` (or `node index.js`).
