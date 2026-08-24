# ⚔️ Raider Guide — How to Use the Raid Team Audit & Loot System

Welcome raiders! Our guild uses an automated Google Spreadsheet and Discord bot to make raid preparation easy, track your character progression, and distribute loot fairly and transparently.

---

## 📑 Quick Navigation
1. [The 4 Tabs in Your Spreadsheet](#1--the-4-tabs-in-your-spreadsheet)
2. [Tab 1: Guild Audit (Gems, Enchants, Tier & Vault)](#2--tab-1-guild-audit-gems-enchants-tier--vault)
3. [Tab 2: Attendance & History (Season Leaderboard & Logs)](#3--tab-2-attendance--history-season-leaderboard--logs)
4. [Tab 3: Talents & Builds (1-Click Meta Guides)](#4--tab-3-talents--builds-1-click-meta-guides)
5. [Tab 4: Submitting Your Sims for Loot Council](#5--tab-4-submitting-your-sims-for-loot-council)
   * [⚔️ DPS & Tanks (Raidbots Droptimizer)](#a-dps--tanks-raidbots-droptimizer)
   * [🩺 Healers (Questionably Epic Live)](#b-healers-questionably-epic-live)
6. [How Loot Priority is Decided](#6--how-loot-priority-is-decided)

---

## 1. 📊 The 4 Tabs in Your Spreadsheet

When you open the guild spreadsheet, you will see 4 main tabs:

| Tab Name | Purpose | What You Should Check |
| :--- | :--- | :--- |
| **`Guild Audit`** | Live Gear & Readiness | Are you enchanted? Are your gems slotted? Are your Vault slots unlocked? |
| **`Attendance & History`** | Season Attendance & Logs | Check your Season Attendance %, On-Time %, Boss Kills, and past raid night logs. |
| **`Talents & Builds`** | Talent Codes & Guides | Hero talent trees, 1-click in-game talent loadout strings, and meta guides. |
| **`Loot & Chase Items`** | Loot Council Rankings | See the top upgrades per boss and check where you rank for drops! |

---

## 2. 🔍 Tab 1: Guild Audit (Gems, Enchants, Tier & Vault)

This tab automatically synchronizes with Blizzard's live Armory to check your character's raid readiness.

### 🏷️ What to Look For:
* 🟢 **`READY`**: You are 100% prepared! All enchants and gems are active, and you have your 4-piece tier set.
* 🔴 **`Missing Enchant` / `Empty Socket`**: Shows the exact gear slot missing an enchant or gem. Please enchant/gem these before raid time!
* 🟡 **`0/4`, `1/4`, `2/4`, `3/4 Tier`**: Tracks your active current-season tier set pieces.
* 🏛️ **Weekly Great Vault Progress**: Columns on the far right track how many raid and Mythic+ vault slots you have unlocked for the week.

---

## 3. 📜 Tab 2: Attendance & History (Season Leaderboard & Logs)

Tracks official guild raid attendance and boss progression across the entire season using live **Warcraft Logs** data.

### 🌟 Key Highlights:
* 📈 **Attendance %**: Percentage of official guild raid nights you were present for.
* ⏰ **On-Time %**: Percentage of raid nights you were ready and present for the **first pull of the night** (within the first 15 minutes of scheduled start time).
* ⚔️ **Season Boss Kills**: Total number of unique raid boss encounters defeated across all difficulties.
* 🔄 **Playing an Alt?**: If an officer has your alt linked to your main character on the `Config` tab, **all attendance, on-time percentage, and boss kill credits automatically combine onto your main character!**
* 📜 **Historical Raid Night Ledger**: Section 2 at the bottom contains a permanent timeline of every raid night with direct clickable links to Warcraft Logs reports.

---

## 4. 🌲 Tab 3: Talents & Builds (1-Click Meta Guides)

Looking for optimal talent builds for heroic progression or mythic boss encounters?

### 💡 Features on this Tab:
* **Talent Loadout Code**: Copy the string in Column E and paste it directly into WoW's in-game talent loadout UI.
* **Archon.gg Meta Builds**: 1-click direct links to top-performing statistical builds for both **Heroic** and **Mythic** raid encounters.
* **Wowhead Class Guides**: Direct link to your spec's full rotation, stat priority, and boss tips.
* **1-Click Sim Link**: Preloaded link for your character on Raidbots.

---

## 5. 🚀 Tab 4: Submitting Your Sims for Loot Council

To make sure the Loot Council knows which boss drops are your biggest upgrades, **submit your sim or healer report once a week** (or after getting new gear).

---

### A. ⚔️ DPS & Tanks (Raidbots Droptimizer)

To ensure everyone is compared fairly on the exact same baseline, please use the following **standardized guild sim settings**:

#### ⚙️ Standard Guild Settings Checklist:
1. Open [Raidbots Droptimizer](https://www.raidbots.com/simbot/droptimizer) (or click your 1-Click link on the *Talents & Builds* sheet).
2. **Raid Difficulty:**
   * Select **`Heroic (Hero)`**.
3. **Items to Sim:**
   * **Group By:** Select **`Boss`**.
   * **Upgrade up to:** Select **`321 Hero 6/6`**.
   * **`☑ Upgrade All Equipped Gear to the Same Level`** *(CRITICAL: Check this box so all drops and equipped slots are compared at equal max upgrade track!)*
4. **Simulation Options:**
   * **Fight Style:** `Patchwerk` (1 Boss, 5 minutes).
   * **Consumables:** `SimC Default` (Food, Flask, Potion, Weapon Rune).
   * **Raid Buffs:** Click **`Optimal Raid Buffs`** (All standard buffs enabled: Bloodlust, Battle Shout, Arcane Intellect, Mark of the Wild, Fortitude, Chaos Brand, Mystic Touch, Skyfury, Hunter's Mark, Bleeding).
5. Click **Run Droptimizer**.
6. When finished, copy your report link:
   ```text
   https://www.raidbots.com/simbot/report/aM6qT1dQz2CPxVodxJDy5k
   ```
7. **Paste the link directly into the `#sims` Discord channel** (or type `/sim report_url:<link>`).
8. The bot will react with `✅` and confirm your DPS upgrades!

---

### B. 🩺 Healers (Questionably Epic Live)

Because Raidbots does not model healing throughput, healers use **Questionably Epic Live (QE Live)**:

#### ⚙️ Standard Healer Settings Checklist:
1. Open [QE Live (questionablyepic.com/live)](https://questionablyepic.com/live).
2. Import your character using your in-game `/simc` string.
3. **`☑ Upgrade ALL to Max Level`** *(CRITICAL: Check this box when importing your gear so all calculations reflect max-upgraded gear tracks!)*
4. In the top navigation, click **Upgrade Finder** $\rightarrow$ **Raid** (*The Venomous Abyss*).
5. Click **Run Upgrade Finder**.
6. Once complete, copy the report URL from your browser address bar:
   ```text
   https://questionablyepic.com/live/upgradereport/vuakucejkfyc
   ```
7. **Paste the link into the `#sims` Discord channel** (or type `/sim report_url:<link>`).
8. The bot will react with `✅` and confirm:
   > `🩺 QE Live Healer Report Imported for CharacterName (Spec)`  
   *(Personal loot / bonus roll items are automatically excluded)*

---

## 6. 👑 How Loot Priority is Decided

On the **`Loot & Chase Items`** sheet, you can see all 8 raid bosses and every piece of gear that drops.

### 🧮 Objective Priority Score Engine:
To keep loot distribution 100% fair, transparent, and free of officer bias, the spreadsheet automatically calculates an objective **Priority Score** for every contender:

$$\text{Priority Score} = \text{Raw Upgrade Gain} \times \text{Reliability Index} \times \text{Role Multiplier}$$

1. **Role Multipliers**:
   * 👑 **`👑 Veteran` ($1.10\times$)**: $+10\%$ priority bonus for proven multi-season loyalty.
   * ⚔️ **`⚔️ Raider` ($1.00\times$)**: Core standard baseline.
   * 🛡️ **`🛡️ Trial` ($0.80\times$)**: $-20\%$ modifier until trial graduation.
2. **Reliability Index**:
   * Combines **$85\%$ Season Attendance** $+ \mathbf{15\%}$ **On-Time Punctuality** (being ready for the first pull).
3. **🪑 Mythic Bench / Standby Credit**:
   * If you are sitting on the bench / standby in Discord on a Mythic raid night, officers award you **full 100% Attendance & On-Time credit** so you are never penalized in loot priority for taking one for the team!

### 🎨 How Contenders are Displayed:
* 🟢 **Mint Green (`Top Contender`)**: Evaluated via an active sim (**`+% DPS`** or **`+% HPS`**).
* 🟡 **Soft Yellow (`Top Contender`)**: Evaluated via **item level increase (`+ilvl`)** from the live Armory.
* **Badge Format:** `CharacterName [Score: 4.53] (+4.12% DPS • 👑 Veteran • 100% Att)`

---

*Good luck in raid, and let's get that loot!* 🏆
