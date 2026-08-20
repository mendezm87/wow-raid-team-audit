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
