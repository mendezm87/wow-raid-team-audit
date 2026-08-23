# 🛡️ WoW Raid Team Audit — Officer & Raid Leader Guide

Welcome to the **WoW Raid Team Audit & Loot Council System**! This suite is an all-in-one raid preparation, gear audit, talent tracker, and loot distribution engine built for World of Warcraft: **Midnight Season 2 (*The Venomous Abyss*)**.

---

## 📑 Table of Contents
1. [Quick Start (Weekly Routine)](#1--quick-start-weekly-routine)
2. [Config Sheet Setup](#2-️-config-sheet-setup)
3. [Sheet 1: Guild Audit (Gear, Enchants, Vault)](#3--sheet-1-guild-audit)
4. [Sheet 2: Talents & Builds (Meta Builds & Hero Trees)](#4--sheet-2-talents--builds)
5. [Sheet 3: Loot & Chase Items (Loot Council Assistant)](#5--sheet-3-loot--chase-items)
6. [Importing Sims: DPS (Raidbots) & Healers (QE Live)](#6--importing-sims-dps-raidbots--healers-qe-live)
7. [Discord Bot & 24/7 PM2 Management](#7--discord-bot--247-pm2-management)
8. [Officer FAQ & Troubleshooting](#8--officer-faq--troubleshooting)

---

## 1. ⚡ Quick Start (Weekly Routine)

Every week before raid night (or after weekly reset):
1. Open the Google Spreadsheet.
2. In the toolbar, click **`Guild Audit` $\rightarrow$ `3. Run Full Audit & Talents`**.
3. In ~5 seconds, all 3 sheets will automatically synchronize with Blizzard's live Armory API, refreshing every raider's equipped gear, sockets, enchants, Great Vault unlocks, and talent trees.

---

## 2. ⚙️ Config Sheet Setup

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
* **Main Characters (Columns A–D, Row 8+):**
  * `👑 Main Character Name` (190px) | `Assigned Raid Spec ▼` (220px) | `Realm (If not in guild)` (190px merged across `C:D`)
* **Divider (Column E):** 30px clean divider spacing
* **Alt Characters (Columns F–I, Row 8+):**
  * `🔄 Alt Character Name` (190px) | `Main Character (Owner ▼)` (240px) | `Assigned Spec ▼` (220px) | `Realm (If not in guild)` (180px)

### 💡 Key Features:
* **Interactive Dropdowns**: Mains and Alts have interactive dropdowns for all 36 WoW specializations. Column G for Alts dynamically populates with active Main Character names!
* **Alt-to-Main Credit Consolidation**: When a raider plays an alt on raid night, the Warcraft Logs attendance engine credits their attendance, on-time percentage, and boss kills directly to their main character (strictly capped at 100% attendance per night).
* **Assigned Main Spec Priority**: Loot eligibility is strictly evaluated against the **Assigned Main Spec**. If a raider logs out in an off-spec (e.g. questing in Retribution while assigned Holy Paladin), the audit will flag the logout but **never assign off-spec loot to them**.
* **Zero-Config Auto-Learning**: If you leave spec blank, the script automatically detects each raider's active spec on the first audit run and saves it to the dropdown.
* **Cross-Realm Raiders & Trial Auto-Splitting**: For connected realms or pug trials, simply enter their realm in Column C/I (or paste their name as `Name-Realm`—the script automatically splits and places the realm in the right column!).

---

## 3. 🔍 Sheet 1: Guild Audit

Tracks equipped item levels, tier set bonuses, gems, enchants, and weekly Great Vault unlocks.

### 🏷️ Badge Breakdown (`Raid Ready` Column):
* 🟢 **`READY`**: Fully enchanted, all sockets filled with current gems, and has at least 4pc current season tier.
* 🔴 **`Missing Enchant` / `Empty Socket`**: Identifies specific missing items and un-socketed slots.
* 🟡 **`0-3/4 Tier`**: Raider is missing their 4pc active tier set bonus.
* ⚠️ **`Off-Spec Logout: Holy (Assigned: Protection)`**: Warns officers if a raider logged out in an off-spec or PvP gear.

### 🏛️ Upgrade Track & Vault Formatting:
* 🟠 **Myth** (ilvl 321–344)
* 🟣 **Hero** (ilvl 308–318)
* 🔵 **Champion** (ilvl 292–305)
* 🟢 **Veteran** (ilvl 279–289)

---

## 4. 🌲 Sheet 2: Talents & Builds

Provides an instant overview of your raid team's talent selections and quick access to meta guides.

### 🔗 What is on this sheet:
1. **Hero Talent Tree**: Shows active tree choice (*e.g. Rider of the Apocalypse, Spellslinger, Sunfury, Deathbringer*).
2. **Talent Code**: The exact export string that can be imported directly into the WoW talent UI.
3. **Meta Guides**:
   * **Archon (Heroic)**: Live statistical meta builds for Heroic raid bosses.
   * **Archon (Mythic)**: Live statistical meta builds for Mythic progression.
   * **Wowhead Guide**: Direct link to the class/spec comprehensive overview.
4. **1-Click Sim Link**: Preloaded Raidbots Droptimizer link with the raider's exact name, region, and realm slug.

---

## 5. 👑 Sheet 3: Loot & Chase Items

An intelligent **Loot Council Assistant** configured with all 8 bosses of **The Venomous Abyss** raid.

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

### 🎨 Top Contender Color-Coding (Column G):
* 🟢 **Mint Green (`#d1fae5`)**: Item is evaluated via an active sim (**Raidbots `% DPS`** or **QE Live `% HPS`**).
* 🟡 **Soft Yellow (`#fef3c7`)**: Item is evaluated via **Live Armory ilvl Delta (`+ilvl`)** fallback.

---

## 6. 🚀 Importing Sims: DPS (Raidbots) & Healers (QE Live)

The sheet natively supports **both DPS/Tank simulations (Raidbots)** and **Healer mathematical models (Questionably Epic Live)**.

### A. DPS & Tanks (Raidbots Droptimizer):
1. Raiders run a Droptimizer sim on [Raidbots](https://www.raidbots.com/simbot/droptimizer).
2. Copy the report URL: `https://www.raidbots.com/simbot/report/abc123xyz`
3. Paste into Discord `#sims` channel (or in Google Sheets via `Guild Audit > Ingest Sim URL`).

### B. Healers (QE Live Upgrade Finder):
1. Healers run an Upgrade Finder report on [QE Live](https://questionablyepic.com/live).
2. Copy their upgrade report link: `https://questionablyepic.com/live/upgradereport/abc123xyz`
3. Paste into Discord `#sims` channel (or in Google Sheets).
4. **Bonus Roll Exclusion**: The engine **automatically excludes personal loot / bonus roll items**, mapping only genuine raid drops to the Loot Council sheet with `✅ QE Live` status!

---

## 7. 🏛️ Warcraft Logs Attendance & Season History

The spreadsheet features full **Warcraft Logs v2 GraphQL API integration** to automatically sync attendance, boss kills, and retroactive gear readiness for the entire season.

### 🌟 How to Sync:
1. In Google Sheets, click **`Guild Audit` $\rightarrow$ `6. Sync Warcraft Logs Attendance & History`**.
2. The script queries all official Season 2 raid reports for your guild from Warcraft Logs.
3. In ~4 seconds, it generates/refreshes the **`Attendance & History`** tab with:
   * **Leaderboard:** Raider Attendance %, Total Raids Attended, Preparation %, and Boss Kills.
   * **Ledger:** Complete historical timeline of every raid night, bosses defeated, roster present, and direct Warcraft Logs links.

---

## 8. 🤖 Discord Bot & 24/7 PM2 Management

The bot runs on **Discord.js v14** and allows raiders to paste **Raidbots** (DPS) and **QE Live** (Healers) sim links directly into Discord:

### 🛠️ Updating the Bot on Your 24/7 PC (PM2):
Whenever new updates are pushed:
```bash
git pull origin main
pm2 restart wow-raid-bot
```

---

## 9. ❓ Officer FAQ & Troubleshooting

### Q: Why do M+ Vault slots count runs in the same dungeon now?
**A:** We integrated the **Raider.IO Hybrid Engine** (`mythic_plus_weekly_runs`). Blizzard's API only exposes 1 run per unique dungeon, but Raider.IO tracks every duplicate and untimed run. Raiders who farm the same key 8 times will now accurately receive credit for all 3 Vault slots (`GV M+ 1`, `GV M+ 2`, `GV M+ 3`)!

### Q: How do we live log raid night directly to the guild on Warcraft Logs?
**A:** In the Archon / Warcraft Logs Uploader desktop app, look under *"Choose the guild you want to upload to"*, click the **`[ 🛡️ Personal Logs ▼ ]`** dropdown, and switch it to your Guild name (e.g. `<Prey>`). Make sure **Advanced Combat Logging** is enabled in WoW Options! However, the Loot Council sheet uses their **Assigned Main Spec** from the `Config` tab, so they will never be assigned off-spec gear.

#### Q: How do we change a raider's official raid spec?
Go to the `Config` sheet, click the dropdown in Column B for that raider, and select their new spec. Then click `3. Run Full Audit & Talents`.
