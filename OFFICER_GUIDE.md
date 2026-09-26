# 🛡️ WoW Raid Team Audit — Officer & Raid Leader Guide

Welcome to the **WoW Raid Team Audit & Loot Council System**! This suite is an all-in-one raid preparation, gear audit, talent tracker, and loot distribution engine built for World of Warcraft: **Midnight Season 2 (*The Venomous Abyss*)**.

---

## 📑 Table of Contents
1. [🔑 API Credentials Setup (Blizzard, WCL, Discord)](#1--api-credentials-setup-blizzard-wcl-discord)
2. [⚡ Quick Start (Weekly Routine)](#2--quick-start-weekly-routine)
3. [⚙️ Config Sheet Setup](#3-️-config-sheet-setup)
4. [🔍 Sheet 1: Guild Audit](#4--sheet-1-guild-audit)
5. [🌲 Sheet 2: Talents & Builds](#5--sheet-2-talents--builds)
6. [👑 Sheet 3: Loot & Chase Items](#6--sheet-3-loot--chase-items)
7. [🚀 Importing Sims: DPS (Raidbots) & Healers (QE Live)](#7--importing-sims-dps-raidbots--healers-qe-live)
8. [🏛️ Warcraft Logs Attendance & Season History](#8-️-warcraft-logs-attendance--season-history)
9. [⏰ Automatic Updates (Triggers)](#9--automatic-updates-triggers)
10. [🤖 Discord Bot & 24/7 PM2 Management](#10--discord-bot--247-pm2-management)
11. [❓ Officer FAQ & Troubleshooting](#11--officer-faq--troubleshooting)

---

## 1. 🔑 API Credentials Setup (Blizzard, WCL, Discord)

The system connects directly to **Blizzard's Game Data & Profile APIs**, **Warcraft Logs v2 API**, and your **Guild Discord Server**.

> **🤝 Credentials are shared.** Whatever one officer enters is saved for the whole spreadsheet (Apps Script *Script Properties*), and is also used by scheduled triggers. **Other officers don't need to set anything up** — they only need edit access to the sheet and to click *Allow* on Google's one-time permission prompt the first time they use the `Guild Audit` menu.
>
> ⚠️ Anyone with **edit access** can open *Extensions → Apps Script → Project Settings* and see these credentials, so only give edit access to trusted officers.

Officers can configure everything in **1 Click** using the built-in guide modal inside Google Sheets:
👉 Click **`Guild Audit` → `📖 Officer Setup & API Credentials Guide`**!

---

### ⚡ A. Blizzard Battle.net Developer Portal (Armory & Raid Drop Tables)
* **What it powers**: Live character item levels, equipped gear, 4pc tier set check, sockets/gems, enchants, active talent loadout codes, and boss drop tables.
* **Setup Steps**:
  1. Visit the [Blizzard Battle.net Developer Portal](https://develop.battle.net/access/clients) and log in with your Battle.net account.
  2. Click **`Create Client`** in the top right.
  3. Fill in the client form:
     * **Client Name**: `WoW Raid Team Audit`
     * **Region**: `United States` (or `Europe` depending on your realm)
     * **Redirect URL**: `https://localhost`
     * **Service URL / Description**: (Optional / leave blank)
  4. Click **Save**.
  5. Copy your **Client ID** and **Client Secret**.
  6. In Google Sheets, click **`Guild Audit` → `1. Set Blizzard API Credentials`** (or paste them in the `📖 Officer Setup Guide` modal).

---

### 📊 B. Warcraft Logs v2 API (Attendance & Raid History)
* **What it powers**: Automated season attendance percentage, on-time punctuality tracking, kill history, and bench credit.
* **⚠️ Use a V2 client, not the V1 key.** The Warcraft Logs *Web API* settings page shows a single **"V1 Client Key"** — that key will **not** work. You need a **V2 Client ID + Client Secret**.
* **Setup Steps**:
  1. Visit the [Warcraft Logs V2 API Clients page](https://www.warcraftlogs.com/api/clients/) (on the Web API settings page, click **"manage your V2 clients here"**).
  2. Click **`Create Client`**.
  3. Fill in the client form:
     * **Name**: `Guild Attendance Audit`
     * **Redirect URL**: `https://localhost`
     * **Public Client**: leave **unchecked**
  4. Click **Create**.
  5. Copy the **Client ID** (a long ID with dashes) and the **Client Secret** (~40 letters and numbers).
  6. In Google Sheets, click **`Guild Audit` → `7. Set Warcraft Logs API Credentials`** (or paste them in the `📖 Officer Setup Guide` modal).

---

### 🤖 C. Discord Bot Token & Sims Channel ID (1-Click Sim Ingestion)
* **What it powers**: Real-time sim ingestion via Discord Bot + the 1-Click **`5b. 🔄 Pull & Sync All Latest Sims from Discord`** button in Google Sheets.
* **Setup Steps**:
  1. Visit the [Discord Developer Portal](https://discord.com/developers/applications) and select/create your application.
  2. Navigate to the **Bot** tab on the left → Click **`Reset Token`** → Copy the **Bot Token**.
  3. In your Discord server:
     * Make sure Developer Mode is enabled: *Discord Settings → Advanced → Developer Mode (ON)*.
     * Right-click your `#sims` channel → Click **`Copy Channel ID`**.
  4. In Google Sheets, enter your **Bot Token** and **Channel ID** into the `📖 Officer Setup Guide` modal (or when clicking `5b. 🔄 Pull & Sync All Latest Sims from Discord`).

---

## 2. ⚡ Quick Start (Weekly Routine)

Every week before raid night (or after weekly reset):
1. Open the Google Spreadsheet.
2. In the toolbar, click **`Guild Audit` → `3. Run Full Audit & Talents`** (skip this if the [hourly trigger](#9--automatic-updates-triggers) is running it for you).
3. All 3 sheets synchronize with Blizzard's live Armory API, refreshing every raider's equipped gear, sockets, enchants, Great Vault unlocks, and talent trees.
4. After raid, click **`6. Sync Warcraft Logs Attendance & History`** (or let a nightly trigger do it) and mark any bench raiders with **`8. 🪑 Mark Bench & Standby Raiders`**.

### 📋 Full Menu Reference
| Menu Item | What it does |
| :--- | :--- |
| `📖 Officer Setup & API Credentials Guide` | One screen to enter all API credentials |
| `1. Set Blizzard API Credentials` | Blizzard Client ID / Secret (shared for all officers) |
| `2. Create Config Sheet` | Builds / repairs the `Config` sheet layout and dropdowns |
| `3. Run Full Audit & Talents` | Refreshes Guild Audit, Talents & Builds, and Loot & Chase Items |
| `4. Create/Refresh Loot & Chase Items Sheet` | Rebuilds only the loot sheet |
| `4b. ⚔️ Toggle Loot Difficulty (Heroic ↔ Mythic)` | Switches the loot table between Heroic (318) and Mythic (334) drops |
| `4c. 🔄 Re-download Loot Table from Blizzard` | Forces a fresh loot table download (normally cached for a week) |
| `5. Import Raidbots / QE Live Sim` | Paste a sim link manually |
| `5b. 🔄 Pull & Sync All Latest Sims from Discord` | Imports recent sim links posted in the `#sims` channel |
| `6. Sync Warcraft Logs Attendance & History` | Updates attendance, on-time %, kills, and the raid night ledger |
| `7. Set Warcraft Logs API Credentials` | WCL **V2** Client ID / Secret (shared for all officers) |
| `8. 🪑 Mark Bench & Standby Raiders` | Awards bench credit for a raid night |
| `9. 📄 Publish Guides to Google Docs` | Replaces the guild's shared Google Docs guides with the latest versions (same links; old versions stay in each Doc's *File → Version history*) |

---

## 3. ⚙️ Config Sheet Setup

The `Config` sheet establishes the roster, official raid specs, alt-to-main assignments, and official raid schedule.

### 📋 Side-by-Side Executive Layout
* **Top Left (Rows 1–7, Columns A–D):** `⚙️ GUILD & RAID CONFIGURATION`
  * `Region`: Interactive dropdown (`us`, `eu`, `kr`, `tw`)
  * `Realm Slug` & `Guild Slug`: Automatic slug sanitization (strips punctuation and formats for API)
  * `Raid Start Time`: 3-part interactive time picker (`Hour ▼` | `Minute ▼` | `AM/PM ▼`)
  * `Raid End Time`: 3-part interactive time picker (`Hour ▼` | `Minute ▼` | `AM/PM ▼`)
  * `Time Zone`: Interactive dropdown with standard IANA time zones (`America/Los_Angeles (Pacific PT)`, `America/Chicago (Central CT)`, `America/New_York (Eastern ET)`, etc.)
* **Top Right (Rows 1–5, Columns F–I):** `⏰ RAID DAYS (TOGGLE ACTIVE NIGHTS)`
  * Interactive **Checkbox Toggles** for all 7 days (`Tue`, `Wed`, `Thu`, `Mon`, `Fri`, `Sat`, `Sun`). Check the active raid nights—no code edits required!
* **Main Characters (Columns A–D, Rows 9–45):**
  * `👑 Main Character Name` (A) | `Assigned Raid Spec ▼` (B) | `Roster Role ▼` (C) | `Realm (If not in guild)` (D)
  * `Roster Role` is the dropdown that marks each raider as `👑 Veteran`, `⚔️ Raider` or `🔰 Trial`. It feeds the Role badge shown beside contenders on the Loot sheet and in the attendance leaderboard.
  * **Roster capacity is 37 mains** (rows 9–45). Names below row 45 are not read by the audit.
* **Divider (Column E):** 30px clean divider spacing
* **Alt Characters (Columns F–I, Row 8+):**
  * `🔄 Alt Character Name` (190px) | `Main Character (Owner ▼)` (240px) | `Assigned Spec ▼` (220px) | `Realm (If not in guild)` (180px)

### 💡 Key Features:
* **Interactive Dropdowns**: Mains and Alts have interactive dropdowns for all WoW specializations. Column G for Alts dynamically populates with active Main Character names! (Dropdowns are refreshed whenever you run `2. Create Config Sheet` or `3. Run Full Audit & Talents`.)
* **Alt-to-Main Credit Consolidation**: When a raider plays an alt on raid night, the Warcraft Logs attendance engine credits their attendance, on-time percentage, and boss kills directly to their main character (strictly capped at 100% attendance per night).
* **Assigned Main Spec Priority**: Loot eligibility is strictly evaluated against the **Assigned Main Spec**. If a raider logs out in an off-spec (e.g. questing in Retribution while assigned Holy Paladin), the audit will flag the logout but **never assign off-spec loot to them**.
* **Zero-Config Auto-Learning**: If you leave spec blank, the script automatically detects each raider's active spec on the first audit run and saves it to the dropdown.
* **Cross-Realm Raiders & Trial Auto-Splitting**: For connected realms or pug trials, simply enter their realm in Column C/I (or paste their name as `Name-Realm`—the script automatically splits and places the realm in the right column!).

---

## 4. 🔍 Sheet 1: Guild Audit

Tracks equipped item levels, tier set bonuses, gems, enchants, and weekly Great Vault unlocks.

### 🏷️ Badge Breakdown (`Raid Ready` Column):
* 🟢 **`READY`**: Fully enchanted, all sockets filled with current gems, and has at least 4pc current season tier.
* 🔴 **`1 Enchant missing` / `2 Sockets empty`**: Counts the missing enchants and un-socketed slots.
* 🟡 **`Tier 0/5` – `Tier 3/5`**: Raider has fewer than 4 of the 5 current-season tier pieces, so no 4pc bonus. Counted out of 5, the same as the `Tier Set` column.
* ⚠️ **`Off-Spec → Protection`**: Warns officers if a raider logged out in a spec other than the one assigned on `Config`. The arrow points at the **assigned** spec.
* Issues are joined with ` · `, e.g. `Off-Spec → Vengeance · Tier 2/5 · 1 Enchant missing`.
* ⚪ **`⚠️ Armory lookup failed`** (whole row greyed out): Blizzard's Armory didn't return the character — usually they left the guild, renamed, or transferred. Check the name on `Config`, or remove them.
* 🔴 **`⚠️ Not in guild`**: the character still exists on the Armory but is no longer in the Blizzard guild roster, so they have almost certainly left. Cross-realm names (`Name-Realm`) are never flagged. Remove them from `Config` once you have confirmed it.

### 🧪 Sim Status column
Sits next to `M+ Rating` and answers "who has actually simmed":
* 🟢 **`✅ Sim today` / `✅ Sim 3d old`**: a Droptimizer or QE Live report was imported for them recently.
* 🟡 **`⚠️ Sim 12d old`**: older than 7 days, so their loot upgrade percentages are stale.
* 🔴 **`❌ No sim`**: nothing has ever been imported for them, which is why they never appear as a contender on `Loot & Chase Items`. Ask them to post a Droptimizer link in Discord.

The age comes from the sim report's own date, recorded per character when it is imported. Raiders simmed before this column existed show `✅ Simmed` with no age until their next import.

### 🧭 Reading the Sheet:
* **Column order**: readiness first (tier, sockets, gems, enchants), then crafted items and embellishments, then per-slot gear, then the Great Vault.
* **Collapsible sections**: Enchants, Gear and Great Vault are column groups — click the **−** / **+** above the header to fold a section away. The next audit refresh opens them all again.
* **Short gear cells**: each gear slot shows `◆ 334 Myth 6/6` (item level + upgrade track). **◆** = current-season tier piece, **◇** = previous-season tier. **Hover the cell** to see the full item name.
* **Short enchant cells**: `✓ Rank 2` (green), `✓ Rank 1` (amber), `✓` for Death Knight runes, `Missing` (red), `N/A` (grey, e.g. shields and off-hands). Hover for the enchant name.
* **Class colours**: the `Name` cell carries the class colour; `Class` and `Spec` use class-coloured text. `M+ Rating` is a pale tint of the Raider.IO rating colour.
* **Last refreshed**: the small `↻` time under the `Name` header shows when the audit last ran (same on `Talents & Builds` and `Loot & Chase Items`).
* **Alts band**: mains and alts are separated by a single dark `───── ALTS ─────` row. Everything below it is an alt and is excluded from loot scoring.
* **Great Vault**: the raid and Mythic+ reward item levels come from the season table in `Season.gs`. Delve tiers 1–11 are in that table too, but the columns stay empty — Blizzard's character API exposes no delve progress, so there is nothing to read.
* **Formatting lives in the code**: every refresh rebuilds colours, widths and layout, so changes made by hand in Sheets are wiped on the next run.

### 🏛️ Upgrade Track & Vault Formatting:
* 🟠 **Myth** (ilvl 321–344)
* 🟣 **Hero** (ilvl 308–318)
* 🔵 **Champion** (ilvl 292–305)
* 🟢 **Veteran** (ilvl 279–289)

---

## 5. 🌲 Sheet 2: Talents & Builds

Provides an instant overview of your raid team's talent selections and quick access to meta guides.

### 🔗 What is on this sheet:
1. **Hero Talent Tree**: Shows active tree choice (*e.g. Rider of the Apocalypse, Spellslinger, Sunfury, Deathbringer*).
2. **Loadout Code**: The exact export string that can be imported directly into the WoW talent UI. The column is narrow and only shows the start of the string; click the cell and copy it to get the whole thing.
3. **Meta Guides**:
   * **Archon (Heroic)**: Live statistical meta builds for Heroic raid bosses.
   * **Archon (Mythic)**: Live statistical meta builds for Mythic progression.
   * **Archon Boss Build dropdown**: pick a boss to point both Archon links at that fight (`⚡ Heroic · <boss>`); `All Bosses` is the overview. Each raider's pick is kept when the sheet refreshes.
   * **Wowhead Guide**: Direct link to the class/spec overview, built automatically from the raider's class and active spec (e.g. `📖 Unholy Guide`).
4. **1-Click Sim Link**: Preloaded Raidbots Droptimizer link with the raider's exact name, region, and realm slug.

---

## 6. 👑 Sheet 3: Loot & Chase Items

An intelligent **Loot Council Assistant** configured with all 8 bosses of **The Venomous Abyss** raid.

### ⚔️ Heroic vs. Mythic Loot
* Click **`Guild Audit` → `4b. ⚔️ Toggle Loot Difficulty (Heroic ↔ Mythic)`** to switch the whole table between **Heroic (318)** and **Mythic (334)** boss drops. The choice is remembered.
* The current difficulty and drop item level are shown under the `Boss / Source` header (e.g. `↻ Sep 25, 3:02 AM · Mythic · 334 ilvl`). The `Difficulty` and `Drop ilvl` columns are hidden while every item shares one value, and come back if they differ.
* Upgrade deltas are recalculated at the new item level. **Sims imported before switching were run at the old difficulty** — ask raiders to re-sim with the matching Droptimizer difficulty (see the [Raider Guide](RAIDER_GUIDE.md)).
* *(344 items are personal loot / bonus rolls, not boss drops, so they are not on this sheet.)*

### 📦 Loot Table Source
* The drop list comes from **Blizzard's Journal API** and is **cached for a week** (it doesn't change mid-season). If Blizzard is unavailable, the last saved copy — or the built-in offline table — is used.
* After a hotfix adds or changes drops, click **`4c. 🔄 Re-download Loot Table from Blizzard`**.

### 🛡️ Strict Class & Spec Equipment Rules:
* **Strict 1H vs 2H Exclusivity**:
  * *Strictly 2H Specs:* Arms Warrior, Ret Paladin, Blood/Unholy DK, Survival Hunter, Feral/Guardian Druid (can **never** receive 1H melee weapons).
  * *Strictly 1H Specs:* Prot Warrior, Prot Paladin, Enhancement Shaman, Rogues, Demon Hunters (can **never** receive 2H melee weapons).
  * *Hunter Weapon Rules:* Survival is **2H Melee Only** (never Ranged). Beast Mastery & Marksmanship are **Ranged Only** (never Melee).
* **Primary Stat Matching**:
  * Items with `(Strength)` or `(Str / Agi)` are completely blocked from Casters & Healers.
  * Items with `(Intellect)` are completely blocked from pure Melee / Tanks.
* **Shields & Caster Off-Hands**:
  * Shields are assigned strictly to Shield specs (Prot Warrior, Prot/Holy Paladin, Ele/Resto Shaman).
  * Holdables are assigned strictly to Intellect casters & healers.

### 🧮 Objective Composite Priority Score Engine:
To eliminate guesswork and reward preparation, contenders are sorted automatically by a mathematically objective **Priority Score**:

$$\text{Priority Score} = \text{Raw Upgrade Gain} \times \text{Reliability Index} \times \text{Role Multiplier} \times \text{Prep Multiplier}$$

* **Role Multipliers**:
  * 👑 **`👑 Veteran` ($1.10\times$)**: $+10\%$ priority bonus for proven multi-season loyalty.
  * ⚔️ **`⚔️ Raider` ($1.00\times$)**: Core standard baseline.
  * 🛡️ **`🛡️ Trial` ($0.80\times$)**: $-20\%$ modifier until trial graduation.
* **Reliability Index**: Scaled from active season attendance and on-time punctuality: $(0.85 \times \text{Att \%}) + (0.15 \times \text{On-Time \%})$.
* **Raid Preparation Factor (Gems & Enchants)**:
  * 🟢 **`READY` ($1.00\times$)**: Fully gemmed and enchanted.
  * ⚠️ **Missing Enchants / Sockets ($0.90\times$)**: $-10\%$ preparation penalty until gear is properly gemmed/enchanted.

### 👑 Contender Display Badges:
* **Prepared Raider (Column G):** `Summzr [Score: 4.62] (+4.20% DPS • 👑 Veteran • 100% Att)`
* **Un-enchanted Raider (Column G):** `Summzr [Score: 4.16] (+4.20% DPS • 👑 Veteran • 100% Att • ⚠️ Missing Enchants)`
* **Loot Council Notes (Column M):** the **top pick only** — `Sim Upgrades: 1. Summzr [Score: 4.62] (+4.20% | 👑 Veteran | 100%)`. The Blizzard item id that sim imports match on is kept in the **cell note** (hover the cell), not in the text.
* **Runners-Up (Column N):** everyone behind them — `2. Unready [Score: 3.60] (+4.00% | ⚔️ Raider | 100% | ⚠️ Unenchanted) | 3. …`
* **Current Equipped Item (Column H):** the short `◆ 321 Hero 6/6` badge, same as Guild Audit. **Hover the cell** for the full item name.

### 🎯 Loot Priority (Column K):
The band an item falls into, taken from the slot it drops in — the slots that move throughput most, first:
* 🔥 **`🔥 Trinket`** / 🔥 **`🔥 Weapon`**: biggest single-item throughput swing.
* 🟣 **`🎽 Tier Piece`**: head, shoulders, chest, hands, legs — counts toward the 4pc set bonus.
* 🔵 **`💠 Secondary`**: neck, back, wrist, waist, feet, rings.
* ⚪ **`📦 Raid Drop`**: anything else.

This is a **slot** ranking, not a per-spec BiS list. For a true BiS ordering, import a sim — the Top Contender and score columns are driven by that.

### 🎨 Top Contender Color-Coding (Column G):
* 🟢 **Mint Green (`#d1fae5`)**: Item is evaluated via an active sim (**Raidbots `% DPS`** or **QE Live `% HPS`**).
* 🟡 **Soft Yellow (`#fef3c7`)**: Item is evaluated via **Live Armory ilvl Delta (`+ilvl`)** fallback.

---

## 7. 🚀 Importing Sims: DPS (Raidbots) & Healers (QE Live)

The sheet natively supports **both DPS/Tank simulations (Raidbots)** and **Healer mathematical models (Questionably Epic Live)**.

### A. DPS & Tanks (Raidbots Droptimizer):
1. Raiders run a Droptimizer sim on [Raidbots](https://www.raidbots.com/simbot/droptimizer) at the difficulty the loot sheet is set to (Heroic or Mythic).
2. Copy the report URL: `https://www.raidbots.com/simbot/report/abc123xyz`
3. Paste into Discord `#sims` channel (or in Google Sheets via `Guild Audit > 5. Import Raidbots / QE Live Sim`).

### B. Healers (QE Live Upgrade Finder):
1. Healers run an Upgrade Finder report on [QE Live](https://questionablyepic.com/live).
2. Copy their upgrade report link: `https://questionablyepic.com/live/upgradereport/abc123xyz`
3. Paste into Discord `#sims` channel (or in Google Sheets via `5. Import Raidbots / QE Live Sim`).
4. **Bonus Roll Exclusion**: The engine **automatically excludes personal loot / bonus roll items**, mapping only genuine raid drops to the Loot Council sheet with `✅ QE Live` status!

> **Roster only:** sims and QE Live reports are accepted only for **main characters on the `Config` sheet**. Alts and anyone not on the roster are rejected with a message telling them to ask an officer. Earlier rankings from characters no longer on the roster are dropped the next time that item's rankings are updated.
>
> Each new import merges with everyone's earlier sims; a raider's newest sim replaces only their own previous one.

> Sim imports and Loot sheet rebuilds take turns: if a sim arrives while the audit or attendance sync is rebuilding the Loot sheet, it waits (up to 3 minutes) instead of failing.

---

## 8. 🏛️ Warcraft Logs Attendance & Season History

The spreadsheet features full **Warcraft Logs v2 GraphQL API integration** to automatically sync attendance, boss kills (and progression wipes), and on-time punctuality for the entire season.

### 🌟 How to Sync:
1. In Google Sheets, click **`Guild Audit` → `6. Sync Warcraft Logs Attendance & History`** (or set up a [nightly trigger](#9--automatic-updates-triggers)).
2. The script reads your guild's most recent Warcraft Logs reports and merges multiple uploaders of the same night into one raid night.
3. It generates/refreshes the **`Attendance & History`** tab with:
   * **Leaderboard:** Raider Attendance %, On-Time %, Raids Attended, Tardies, Boss Kills, and Reliability Tier. Attendance % and On-Time % are coloured 🟢 90%+, 🟡 75–89%, 🔴 under 75%.
   * **Ledger:** Complete historical timeline of every raid night, bosses defeated (or progression wipes), roster present, bench list, and direct Warcraft Logs links.

### 🗄️ Season History is Permanent (Attendance Archive)
* Warcraft Logs only returns the **40 most recent reports**. Every synced raid night is therefore also saved to a hidden **`Attendance Archive`** sheet, and attendance % is always calculated from the full archive — nights never "fall off" as the season goes on.
* The archive stores the **character names from the logs**, so roster, alt, bench, and raid-day changes you make later are applied to past nights on the next sync.
* Don't edit or delete the `Attendance Archive` sheet (it's hidden for that reason).

### 📏 What Counts as an Official Raid Night
* It's on a raid day checked in `Config`, **and**
* enough guild mains were present (including bench): **15 for Mythic**, **10 for Heroic/Normal**.
* Other nights are listed as `📦 [Optional / PUG]`: attendees still get boss kill credit, but nobody is marked absent.
* **On-Time** = present for the **first boss pull of the night** (kill or wipe).

### 🪑 Bench & Standby Credit Manager:
Because Warcraft Logs only records raiders inside the instance, bench raiders standing by in Discord are awarded full credit with a 1-click modal:
1. In Google Sheets, click **`Guild Audit` → `8. 🪑 Mark Bench & Standby Raiders`**.
2. Select the raid date from the dropdown.
3. Check the boxes for the raiders who were on standby in Discord (supports any number of bench players).
4. Click **`💾 Save & Award Bench Credit`**.
5. The system awards them **100% Attendance & On-Time credit** for that night, updates the Ledger column (`🪑 Bench / Standby`), and recalculates all Priority Scores on `Loot & Chase Items`.
* Bench credit applies to **official** raid nights (Heroic or Mythic). If a night is classed as optional/PUG, the ledger shows `No credit (not an official night): …`.
* You can mark bench for any past night in the dropdown — it's re-applied every sync.

---

## 9. ⏰ Automatic Updates (Triggers)

You can have Google run updates on a schedule, so nobody has to click the menu:

1. Open the spreadsheet → **Extensions → Apps Script** → **Triggers** (⏰ clock icon in the left sidebar) → **Add Trigger**.
2. Recommended triggers:

| Function | Event source | Schedule | Purpose |
| :--- | :--- | :--- | :--- |
| `updateAllCharacterDataWithBonuses` | Time-driven | Hour timer / every few hours | Gear audit, talents & loot sheet |
| `syncWarcraftLogsSeasonAttendance` | Time-driven | Day timer, 11 PM–midnight | Attendance after raid |

3. Save and click **Allow** on Google's permission prompt.

* Triggers run as the officer who created them, using the shared credentials.
* If a scheduled run fails, the trigger is marked **Failed** and Google emails the trigger's owner. See [the FAQ](#q-a-scheduled-trigger-failed--how-do-i-see-why) for how to see why.

---

## 10. 🤖 Discord Bot & 24/7 PM2 Management

The bot runs on **Discord.js v14** and allows raiders to paste **Raidbots** (DPS) and **QE Live** (Healers) sim links directly into Discord. Setup details are in the [bot README](discord-bot/README.md).

### 🛠️ Updating the Bot on Your 24/7 PC (PM2):
Whenever new updates are pushed:
```bash
git pull origin main
pm2 restart wow-raid-bot
```

### 🔐 Optional: Webhook Secret
To make sure only your bot can write sims to the sheet, pick any long random string and set it in **both** places:
* Apps Script → **Project Settings → Script Properties** → `WEBHOOK_SECRET`
* The bot's `discord-bot/.env` → `WEBHOOK_SECRET=...` (then restart the bot)

If only one side has it, sims will be rejected with `Unauthorized`.

---

## 11. ❓ Officer FAQ & Troubleshooting

### Q: A scheduled trigger failed — how do I see why?
**A:** Open **Extensions → Apps Script → Executions** (left sidebar). Click the failed run to see the error message and log. Common causes: missing API credentials (set them via menu 1 / 7), or Google timing out on a very large run (it will usually succeed on the next run).

### Q: Warcraft Logs sync says "Authentication Failed".
**A:** The credentials must be a Warcraft Logs **V2 client** (Client ID + Client Secret) from the [V2 clients page](https://www.warcraftlogs.com/api/clients/) — not the "V1 Client Key". Re-enter them with **`7. Set Warcraft Logs API Credentials`**.

### Q: A raider's sim failed in Discord.
**A:** The bot's error now shows the real reason. `Another Guild Audit update is still running` means an audit/sync was rebuilding the Loot sheet for more than 3 minutes — have them re-post the link. For Raidbots, the report must be finished and public.

### Q: Why do M+ Vault slots count runs in the same dungeon now?
**A:** We integrated the **Raider.IO Hybrid Engine** (`mythic_plus_weekly_runs`). Blizzard's API only exposes 1 run per unique dungeon, but Raider.IO tracks every duplicate and untimed run. Raiders who farm the same key 8 times will now accurately receive credit for all 3 Vault slots (`GV M+ 1`, `GV M+ 2`, `GV M+ 3`)!

### Q: How do we live log raid night directly to the guild on Warcraft Logs?
**A:** In the Archon / Warcraft Logs Uploader desktop app, look under *"Choose the guild you want to upload to"*, click the **`[ 🛡️ Personal Logs ▼ ]`** dropdown, and switch it to your Guild name (e.g. `<Prey>`). Make sure **Advanced Combat Logging** is enabled in WoW Options!

### Q: A raider played an off-spec on raid night. Will they get off-spec loot?
**A:** No. The Loot Council sheet uses their **Assigned Main Spec** from the `Config` tab, so they will never be assigned off-spec gear.

### Q: How do we change a raider's official raid spec?
**A:** Go to the `Config` sheet, click the dropdown in Column B for that raider, and select their new spec. Then click `3. Run Full Audit & Talents`.

### Q: A new season started. What needs to change?
**A:** A developer updates `src/Season.gs` (raid name, bosses, item levels, offline loot table) and deploys — see the [README](README.md#️-developing--deploying). Then click `4c. 🔄 Re-download Loot Table from Blizzard`.
