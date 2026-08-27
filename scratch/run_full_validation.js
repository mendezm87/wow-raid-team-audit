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
const webhookUrl = env.GOOGLE_SHEET_WEBHOOK_URL;

async function validateAndForward() {
  console.log('📡 Step 1: Connecting to Discord to retrieve all raider sims...');
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=100`, {
    headers: {
      'Authorization': `Bot ${token}`,
      'User-Agent': 'DiscordBot (https://github.com/mendezm87/wow-raid-team-audit, 1.0.0)'
    }
  });

  if (!res.ok) {
    console.error('Failed to reach Discord API:', res.status, res.statusText);
    return;
  }

  const messages = await res.json();
  const rbRegex = /https?:\/\/(?:www\.)?raidbots\.com\/(?:simbot\/)?report\/([A-Za-z0-9_-]{10,35})/gi;
  const qeRegex = /https?:\/\/(?:www\.)?(?:questionablyepic\.com|qe-live\.com)\/(?:live|ptr)\/upgradereport\/([A-Za-z0-9_-]{8,35})/gi;

  const rawSims = [];
  messages.forEach(msg => {
    const content = msg.content || '';
    let match;
    while ((match = rbRegex.exec(content)) !== null) {
      rawSims.push({ type: 'Raidbots', id: match[1], url: `https://www.raidbots.com/simbot/report/${match[1]}`, date: msg.timestamp });
    }
    while ((match = qeRegex.exec(content)) !== null) {
      rawSims.push({ type: 'QE Live', id: match[1], url: `https://questionablyepic.com/live/upgradereport/${match[1]}`, date: msg.timestamp });
    }
  });

  console.log(`✅ Found ${rawSims.length} total sim messages in Discord.\n`);
  console.log('📥 Step 2: Parsing each report to identify player names & timestamps...');

  const latestSimsByPlayer = {};

  for (let i = 0; i < rawSims.length; i++) {
    const sim = rawSims[i];
    if (sim.type === 'Raidbots') {
      try {
        const resp = await fetch(`https://www.raidbots.com/reports/${sim.id}/data.json`);
        if (!resp.ok) continue;
        const json = await resp.json();

        const player = (json.sim && json.sim.players && json.sim.players[0]) || {};
        const playerName = player.name || (json.simbot && json.simbot.player) || 'Unknown';
        const spec = player.specialization || (json.simbot && json.simbot.spec) || '';
        const charClass = (json.simbot && json.simbot.charClass) || (player.type ? player.type.replace(/_/g, ' ') : '');
        
        let simTime = (json.sim && json.sim.timestamp) ? (json.sim.timestamp * 1000) : 
                      (json.sim && json.sim.date) ? new Date(json.sim.date).getTime() :
                      (json.simbot && json.simbot.date) ? new Date(json.simbot.date).getTime() :
                      (json.simbot && json.simbot.jobSubmitted) ? new Date(json.simbot.jobSubmitted).getTime() :
                      new Date(sim.date).getTime();

        const lower = playerName.toLowerCase().trim();
        if (!latestSimsByPlayer[lower] || simTime > latestSimsByPlayer[lower].timestamp) {
          latestSimsByPlayer[lower] = {
            player: playerName,
            spec,
            class: charClass,
            type: 'Raidbots',
            id: sim.id,
            url: sim.url,
            timestamp: simTime,
            dateStr: new Date(simTime).toISOString().slice(0, 10)
          };
        }
        process.stdout.write(`Scanning sim ${i + 1}/${rawSims.length}: ${playerName} (${spec} ${charClass})\r`);
      } catch (e) {}
    } else if (sim.type === 'QE Live') {
      const lower = 'healer_' + sim.id.slice(0, 5);
      latestSimsByPlayer[lower] = {
        player: 'Healer Report',
        spec: 'Healer',
        class: 'Healer',
        type: 'QE Live',
        id: sim.id,
        url: sim.url,
        timestamp: new Date(sim.date).getTime(),
        dateStr: sim.date ? sim.date.slice(0, 10) : ''
      };
    }
  }

  const verifiedRaiders = Object.values(latestSimsByPlayer);
  console.log(`\n\n🎯 Step 3: Verified Active Raiders (Deduplicated to Latest Sim Only):`);
  console.table(verifiedRaiders.map(r => ({
    Player: r.player,
    Spec: r.spec,
    Class: r.class,
    'Latest Sim Date': r.dateStr,
    'Sim ID': r.id
  })));

  const latestUrls = verifiedRaiders.map(r => r.url);

  console.log(`\n🚀 Step 4: Forwarding all ${latestUrls.length} latest verified sim URLs to Google Sheet Webhook...`);
  try {
    const hookResp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: latestUrls }),
      redirect: 'follow'
    });

    const hookText = await hookResp.text();
    console.log(`📬 Google Sheet Webhook Response (${hookResp.status}):`, hookText);
  } catch (err) {
    console.error('Webhook error:', err);
  }
}

validateAndForward();
