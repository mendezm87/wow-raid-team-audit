# 🛡️ WoW Raid Team Audit — Officer & Raid Leader Guide

Welcome to the **WoW Raid Team Audit & Loot Council System**! This spreadsheet is an all-in-one raid preparation, gear audit, talent tracker, and loot distribution assistant built for Midnight Season 2 (*The Venomous Abyss*).

---

## 📑 Table of Contents
1. [Quick Start (Weekly Routine)](#1--quick-start-weekly-routine)
2. [Config Sheet Setup](#2-️-config-sheet-setup)
3. [Sheet 1: Guild Audit (Gear, Enchants, Vault)](#3--sheet-1-guild-audit)
4. [Sheet 2: Talents & Builds (Meta Builds & Hero Trees)](#4--sheet-2-talents--builds)
5. [Sheet 3: Loot & Chase Items (Loot Council Assistant)](#5--sheet-3-loot--chase-items)
6. [Importing Raidbots Droptimizer Sims](#6--importing-raidbots-droptimizer-sims)
7. [Officer FAQ & Troubleshooting](#7--officer-faq--troubleshooting)

---

## 1. ⚡ Quick Start (Weekly Routine)

Every week (or before raid night):
1. Click the **`Guild Audit`** custom menu in the top toolbar.
2. Click **`3. Run Full Audit & Talents`**.
3. In ~5 seconds, all 3 sheets will automatically synchronize with Blizzard's live Armory API.

---

## 2. ⚙️ Config Sheet Setup

The `Config` sheet tells the script which guild and characters to track.

### 📋 Setup Layout
| Column A (`Main Character Name`) | Column B (`Assigned Raid Spec`) | Column C (`Realm (If different)`) |
| :--- | :--- | :--- |
| `Jevo` | `▼ Protection` *(Dropdown)* | *(blank = Guild Realm)* |
| `Lyci` | `▼ Balance` *(Dropdown)* | *(blank)* |
| `Aemonnd` | `▼ Unholy` *(Dropdown)* | `illidan` *(cross-realm)* |

### 💡 Key Features:
* **Interactive Spec Dropdowns**: Column B contains a clickable dropdown of all 36 WoW specializations.
* **Zero-Config Auto-Learning**: If you leave Column B blank, the script **automatically detects each raider's active spec** on the first audit run and saves it to the dropdown.
* **Cross-Realm Raiders**: If a raider or trial is from a connected/different realm, simply enter their realm in Column C (or format their name as `CharacterName-Realm`).

---

## 3. 🔍 Sheet 1: Guild Audit

Tracks equipped item levels, tier set bonuses, gems, enchants, and weekly Great Vault unlocks.

### 🏷️ Badge Breakdown (`Raid Ready` Column):
* 🟢 **`READY`**: Fully enchanted, all sockets filled with epic/quality gems, and has at least 4pc current season tier.
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

### 🌟 How Contenders are Ranked:
1. **Live Contender Scanner (ilvl $\Delta$)**:
   * Automatically compares raid drops against the team's equipped gear across all slots (including dual trinkets and dual rings).
   * Ranks the Top 3 raiders who gain the largest numerical item level increase.
2. **Raidbots Sim Priority (% DPS Gain)**:
   * When Droptimizer sims are imported, exact **mathematical % DPS gains** take priority over raw item levels.
   * Contenders are ranked by greatest damage increase (e.g. `1. Aemonnd (+11.2%) | 2. Jevo (+8.4%)`).

### 🕒 Sim Freshness Badges (`Sim Status / Last Updated` Column):
| Badge | Meaning | Status |
| :--- | :--- | :---: |
| **`✅ Simmed (Date)`** | Fresh sim active ($< 7$ days old) | 🟢 Current |
| **`⚠️ Stale (>7d ago)`** | Sim is older than 7 days — re-sim recommended! | 🟡 Re-sim |
| **`⚡ Live Armory ilvl`** | Unsimmed drop — using live Blizzard Armory item level scanner | ⚪ Baseline |

---

## 6. 🚀 Importing Raidbots Droptimizer Sims

### Step-by-Step Workflow:
1. Go to the `Talents & Builds` sheet.
2. Click the **1-Click Sim Link** for any raiders you want to sim.
3. In Raidbots, click **Run Droptimizer**.
4. Once completed, copy the report link(s) (e.g. `https://www.raidbots.com/simbot/report/abc123xyz`).
5. In the spreadsheet, click **`Guild Audit` $\rightarrow$ `5. Import Raidbots Droptimizer Sim`**.
6. **Paste your link(s)** into the box and click **OK**.

> **Tip**: You can paste **multiple sim links at once** separated by spaces, commas, or new lines. The script will fetch all reports in parallel and merge them into the ranking in ~1 second!

> **Note**: Importing a new raider merges them into the existing ranking. Re-simming a previously simmed raider simply updates their percentage to the newest sim.

---

## 7. ❓ Officer FAQ & Troubleshooting

#### Q: Will running a Full Audit wipe out our Droptimizer sims?
**No.** Sim results always have **Sim Priority Protection**. Running `3. Run Full Audit & Talents` preserves all `% DPS` rankings while quietly refreshing the raider's currently equipped gear in columns H & I.

#### Q: A raider logged out in PvP / Mythic+ spec. What should we do?
The audit will display an `⚠️ Off-Spec Logout` warning so you are aware. If you have already imported their Droptimizer sim, their raid upgrade numbers remain 100% accurate because Raidbots simulates their assigned raid spec.

#### Q: How do we change a raider's official raid spec?
Go to the `Config` sheet, click the dropdown in Column B for that raider, and select their new spec. Then click `3. Run Full Audit & Talents`.

#### Q: How do we add a new raider or trial?
1. Open the `Config` sheet.
2. Add their name to the bottom of the *Main Characters* list.
3. Select their spec from the dropdown (or leave it blank to auto-detect).
4. If they are from another realm, enter their realm slug in Column C (e.g. `area-52`, `illidan`).
5. Run `3. Run Full Audit & Talents`.
