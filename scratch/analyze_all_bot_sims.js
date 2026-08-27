const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', 'discord-bot', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const token = env.DISCORD_BOT_TOKEN;
const channelId = env.SIMS_CHANNEL_ID;

// WoW Armor & Spec Rules
const ARMOR_MAP = {
  'warrior': 'plate', 'paladin': 'plate', 'death knight': 'plate',
  'hunter': 'mail', 'shaman': 'mail', 'evoker': 'mail',
  'rogue': 'leather', 'druid': 'leather', 'monk': 'leather', 'demon hunter': 'leather',
  'priest': 'cloth', 'mage': 'cloth', 'warlock': 'cloth'
};

function isCharacterEligibleForItem(charClass, charSpec, slot, targetSubclass, itemName) {
  charClass = (charClass || '').toLowerCase().trim();
  charSpec = (charSpec || '').toLowerCase().trim();
  targetSubclass = (targetSubclass || '').toLowerCase().trim();
  itemName = (itemName || '').toLowerCase().trim();
  slot = (slot || '').trim();

  // 1. ARMOR SLOTS
  const armorSlots = ['Head', 'Shoulders', 'Chest', 'Hands', 'Legs', 'Feet', 'Wrist', 'Waist'];
  if (armorSlots.includes(slot)) {
    const charArmor = ARMOR_MAP[charClass] || '';
    if (targetSubclass.includes('plate') && charArmor !== 'plate') return false;
    if (targetSubclass.includes('mail') && charArmor !== 'mail') return false;
    if (targetSubclass.includes('leather') && charArmor !== 'leather') return false;
    if (targetSubclass.includes('cloth') && charArmor !== 'cloth') return false;
  }

  // 2. WEAPON & SHIELD SLOTS
  if (targetSubclass.includes('shield')) {
    return (charClass === 'paladin' && ['protection', 'holy'].some(s => charSpec.includes(s))) ||
           (charClass === 'warrior' && charSpec.includes('protection')) ||
           (charClass === 'shaman' && ['elemental', 'restoration'].some(s => charSpec.includes(s)));
  }

  // 3. STATS
  if (targetSubclass.includes('intellect') || targetSubclass.includes('(int') || targetSubclass.includes('/ int') || targetSubclass.includes('caster') || targetSubclass.includes('healer')) {
    const isInt = ['mage', 'warlock', 'priest', 'evoker'].includes(charClass) ||
                  (charClass === 'paladin' && charSpec.includes('holy')) ||
                  (charClass === 'druid' && (charSpec.includes('balance') || charSpec.includes('restoration'))) ||
                  (charClass === 'shaman' && !charSpec.includes('enhancement')) ||
                  (charClass === 'monk' && charSpec.includes('mistweaver'));
    if (!isInt && !targetSubclass.includes('all') && !targetSubclass.includes('str') && !targetSubclass.includes('agi')) return false;
  }

  return true;
}

async function runAnalysis() {
  console.log('📡 Step 1: Extracting all sim links from Discord...');
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=100`, {
    headers: {
      'Authorization': `Bot ${token}`,
      'User-Agent': 'DiscordBot (https://github.com/mendezm87/wow-raid-team-audit, 1.0.0)'
    }
  });

  const messages = await res.json();
  const rbRegex = /https?:\/\/(?:www\.)?raidbots\.com\/(?:simbot\/)?report\/([A-Za-z0-9_-]{10,35})/gi;
  const qeRegex = /https?:\/\/(?:www\.)?(?:questionablyepic\.com|qe-live\.com)\/(?:live|ptr)\/upgradereport\/([A-Za-z0-9_-]{8,35})/gi;

  const simLinks = [];
  messages.forEach(msg => {
    const content = msg.content || '';
    let match;
    while ((match = rbRegex.exec(content)) !== null) {
      const id = match[1];
      if (!simLinks.find(s => s.id === id)) {
        simLinks.push({ type: 'Raidbots', id, url: `https://www.raidbots.com/simbot/report/${id}`, date: msg.timestamp ? msg.timestamp.slice(0, 10) : '' });
      }
    }
    while ((match = qeRegex.exec(content)) !== null) {
      const id = match[1];
      if (!simLinks.find(s => s.id === id)) {
        simLinks.push({ type: 'QE Live', id, url: `https://questionablyepic.com/live/upgradereport/${id}`, date: msg.timestamp ? msg.timestamp.slice(0, 10) : '' });
      }
    }
  });

  console.log(`✅ Extracted ${simLinks.length} unique sim links from Discord history.\n`);
  console.log('📥 Step 2: Downloading and parsing player sim data...');

  const playerSims = {};
  const allParsedReports = [];

  for (let i = 0; i < simLinks.length; i++) {
    const sim = simLinks[i];
    if (sim.type === 'Raidbots') {
      try {
        const dataUrl = `https://www.raidbots.com/reports/${sim.id}/data.json`;
        const resp = await fetch(dataUrl);
        if (!resp.ok) continue;
        const json = await resp.json();

        const player = (json.sim && json.sim.players && json.sim.players[0]) || {};
        const playerName = player.name || (json.simbot && json.simbot.player) || 'Unknown';
        const rawSpec = player.specialization || (json.simbot && json.simbot.spec) || '';
        const rawClass = (json.simbot && json.simbot.charClass) || (player.type ? player.type.replace(/_/g, ' ') : '');
        
        let baseDps = 0;
        if (player.collected_data && player.collected_data.dps) {
          baseDps = player.collected_data.dps.mean || 0;
        } else if (json.sim && json.sim.statistics && json.sim.statistics.raid_dps) {
          baseDps = json.sim.statistics.raid_dps.mean || 0;
        }

        const itemLib = (json.simbot && json.simbot.meta && json.simbot.meta.itemLibrary) || {};
        const items = [];

        const results = (json.sim && json.sim.profilesets && json.sim.profilesets.results) || [];
        results.forEach(res => {
          const parts = (res.name || '').split('/');
          let itemName = '';
          let slot = '';
          let bossSource = '';
          let itemSubclass = '';

          if (parts.length >= 4) {
            const itemId = parseInt(parts[3], 10);
            const found = Object.values(itemLib).find(it => it.id === itemId);
            if (found) {
              itemName = found.name;
              slot = found.slot || '';
              bossSource = found.encounter ? found.encounter.name : '';
            }
          }
          if (!itemName) {
            itemName = (res.name || '').replace(/^[0-9\/]+/, '').replace(/[\/0-9]+$/, '').trim();
          }

          const simDps = res.mean || res.dps || 0;
          let pct = res.pct || res.pct_gain;
          if (pct === undefined && simDps > baseDps && baseDps > 1) {
            pct = ((simDps - baseDps) / baseDps) * 100;
          }

          if (itemName && pct > 0) {
            items.push({
              name: itemName,
              pct: parseFloat(pct.toFixed(2)),
              slot,
              bossSource
            });
          }
        });

        let simTime = (json.sim && json.sim.timestamp) ? (json.sim.timestamp * 1000) : 
                      (json.sim && json.sim.date) ? new Date(json.sim.date).getTime() :
                      (json.simbot && json.simbot.date) ? new Date(json.simbot.date).getTime() :
                      (json.simbot && json.simbot.jobSubmitted) ? new Date(json.simbot.jobSubmitted).getTime() :
                      new Date(sim.date).getTime();

        const formattedDate = (json.sim && json.sim.date) ? json.sim.date.slice(0, 10) :
                              (json.simbot && json.simbot.date) ? json.simbot.date.slice(0, 10) : sim.date;

        const reportData = {
          id: sim.id,
          date: formattedDate,
          timestamp: simTime,
          player: playerName,
          class: rawClass,
          spec: rawSpec,
          upgradesCount: items.length,
          topUpgrades: items.sort((a, b) => b.pct - a.pct).slice(0, 3)
        };

        allParsedReports.push(reportData);

        // Strictly keep only the single most recent sim report per player
        if (!playerSims[playerName.toLowerCase()] || simTime >= playerSims[playerName.toLowerCase()].timestamp) {
          playerSims[playerName.toLowerCase()] = reportData;
        }

        process.stdout.write(`Processed ${i + 1}/${simLinks.length}: ${playerName} (${rawSpec} ${rawClass})\r`);
      } catch (err) {
        // skip invalid
      }
    }
  }

  console.log('\n\n📊 ==================== DISCORD SIM AUDIT SUMMARY ====================');
  console.log(`Total Unique Raiders with Active Sims: ${Object.keys(playerSims).length}\n`);

  Object.values(playerSims).forEach((p, idx) => {
    console.log(`${idx + 1}. 🛡️ Raider: ${p.player} | Class/Spec: ${p.spec} ${p.class} | Date: ${p.date}`);
    console.log(`   Sim ID: ${p.id}`);
    console.log(`   Total Simmed Upgrades: ${p.upgradesCount}`);
    console.log(`   Top 3 Sim Upgrades:`);
    p.topUpgrades.forEach(u => {
      console.log(`     • ${u.name}: +${u.pct}% DPS`);
    });
    console.log('----------------------------------------------------------------------');
  });

  return { playerSims, allParsedReports };
}

runAnalysis();
