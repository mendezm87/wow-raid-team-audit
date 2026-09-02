const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config(); // fallback to cwd
const http = require('http');
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');

// Simple HTTP health check server for Render.com / cloud port binding
if (process.env.PORT) {
  const PORT = process.env.PORT;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('🤖 WoW Raid Sim Discord Bot is Online & Listening!\n');
  });
  server.on('error', (e) => console.warn('HTTP server notice:', e.message));
  server.listen(PORT, () => {
    console.log(`🌐 HTTP health server listening on port ${PORT}`);
  });
}

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GOOGLE_SHEET_WEBHOOK_URL = process.env.GOOGLE_SHEET_WEBHOOK_URL;
const SIMS_CHANNEL_ID = process.env.SIMS_CHANNEL_ID; // Optional: Restrict auto-listening to a specific channel

if (!DISCORD_BOT_TOKEN || !GOOGLE_SHEET_WEBHOOK_URL) {
  console.error('❌ Missing environment variables! Please configure DISCORD_BOT_TOKEN and GOOGLE_SHEET_WEBHOOK_URL in your .env or host dashboard.');
  process.exit(1);
}

const USER_AGENT = 'DiscordBot (https://github.com/mendezm87/wow-raid-team-audit, 1.0.0)';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  rest: {
    userAgentAppendix: 'WoWRaidTeamAuditBot/1.0'
  }
});

client.on('debug', info => {
  console.log(`[Discord WS] ${info}`);
});

client.on('shardError', error => {
  console.error('[Discord WS Shard Error]:', error);
});

client.on('shardDisconnect', (event, id) => {
  console.warn(`[Discord WS Shard ${id} Disconnected]:`, event);
});

// Direct REST Token verification
async function verifyDiscordToken() {
  try {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN.trim()}`,
        'User-Agent': USER_AGENT
      }
    });
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      if (res.status === 200) {
        console.log(`✅ Token verified successfully! Bot username: ${data.username}#${data.discriminator || '0'} (ID: ${data.id})`);
      } else {
        console.error(`❌ Token verification failed (${res.status}):`, data);
      }
    } catch (e) {
      console.error(`❌ Discord API returned non-JSON (${res.status}): ${text.slice(0, 150)}`);
    }
  } catch (err) {
    console.error('❌ Network error testing Discord API:', err);
  }
}
verifyDiscordToken();

// Helper to extract Raidbots and QE Live URLs from any message string
function extractSimUrls(text) {
  if (!text) return [];
  const urls = [];

  // 1. Raidbots Droptimizer Links
  const rbRegex = /https?:\/\/(?:www\.)?raidbots\.com\/(?:simbot\/)?report\/([A-Za-z0-9_-]{10,35})/gi;
  let rbMatch;
  while ((rbMatch = rbRegex.exec(text)) !== null) {
    const fullUrl = `https://www.raidbots.com/simbot/report/${rbMatch[1]}`;
    if (!urls.includes(fullUrl)) urls.push(fullUrl);
  }

  // 2. QE Live Upgrade Report Links (Healers)
  const qeRegex = /https?:\/\/(?:www\.)?(?:questionablyepic\.com|qe-live\.com)\/(?:live|ptr)\/upgradereport\/([A-Za-z0-9_-]{8,35})/gi;
  let qeMatch;
  while ((qeMatch = qeRegex.exec(text)) !== null) {
    const fullUrl = `https://questionablyepic.com/live/upgradereport/${qeMatch[1]}`;
    if (!urls.includes(fullUrl)) urls.push(fullUrl);
  }

  return urls;
}

// Forward sim URLs to Google Sheets Web App
async function sendToGoogleSheets(urls) {
  try {
    const response = await fetch(GOOGLE_SHEET_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: urls }),
      redirect: 'follow'
    });

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (parseErr) {
      if (response.status === 404) {
        return {
          success: false,
          error: `Google Web App URL returned 404 Not Found. Please deploy a new Web App in Google Sheets (Deploy > New deployment > Web app > Access: Anyone) and update GOOGLE_SHEET_WEBHOOK_URL in .env.`
        };
      }
      return {
        success: false,
        error: `Google Sheets returned non-JSON response (${response.status}). Please ensure your Web App is deployed with 'Who has access: Anyone'.`
      };
    }
  } catch (error) {
    console.error('❌ Failed to forward to Google Sheets:', error);
    return { success: false, error: error.message };
  }
}

// Format Discord Embed confirmation reply
function createSimConfirmationEmbed(result, authorName) {
  if (!result || !result.success) {
    return new EmbedBuilder()
      .setColor(0xE11D48) // Crimson red
      .setTitle('❌ Sim / Report Import Failed')
      .setDescription(result?.error || 'Could not process the provided report. Please ensure the link is public and valid.')
      .setFooter({ text: 'WoW Raid Team Audit' })
      .setTimestamp();
  }

  const isQELive = result.platform === 'QE Live';
  const embedTitle = isQELive ? '🩺 QE Live Healer Report Imported' : '✅ Droptimizer Sim Imported to Loot Council';
  const roleType = isQELive ? 'HPS' : 'DPS';
  const note = isQELive ? '\n*(Bonus roll personal loot items were automatically excluded)*' : '';

  const embed = new EmbedBuilder()
    .setColor(0x10B981) // Emerald green
    .setTitle(embedTitle)
    .setDescription(`Successfully mapped upgrades for **${result.players?.join(', ') || authorName}** to the guild spreadsheet!${note}`)
    .addFields(
      { name: '📊 Total Raid Drops Mapped', value: `${result.itemsMapped || 0} items`, inline: true },
      { name: '⚡ Source', value: isQELive ? 'QE Live (Healer Math)' : 'Raidbots Droptimizer', inline: true }
    )
    .setFooter({ text: 'Prey Guild Audit • Loot Council Synced' })
    .setTimestamp();

  if (result.topUpgrades && result.topUpgrades.length > 0) {
    const topList = result.topUpgrades.slice(0, 3).map((up, i) => `${i + 1}. **${up.item}** (+${up.pct}% ${roleType})`).join('\n');
    embed.addFields({ name: '🌟 Top Simulated Upgrades', value: topList, inline: false });
  }

  return embed;
}

// Helper to parse SimC string and generate 1-Click Droptimizer link
function parseSimcAndGenerateLink(text) {
  if (!text) return null;

  // Match class/character name: e.g. hunter="Ainocee" or paladin="Wafflezealot"
  const charMatch = text.match(/(?:death_knight|demon_hunter|druid|evoker|hunter|mage|monk|paladin|priest|rogue|shaman|warlock|warrior)\s*=\s*["']?([^"'\n\r]+)["']?/i);
  // Match armory line: armory=us,kiljaeden,Ainocee or server=kiljaeden
  const armoryMatch = text.match(/armory\s*=\s*([a-z]{2})\s*,\s*([^,\n\r]+)\s*,\s*([^,\n\r]+)/i);
  const serverMatch = text.match(/server\s*=\s*["']?([^"'\n\r]+)["']?/i);
  const regionMatch = text.match(/region\s*=\s*["']?([^"'\n\r]+)["']?/i);
  const specMatch = text.match(/spec\s*=\s*["']?([^"'\n\r]+)["']?/i);

  let charName = '';
  let realm = 'kiljaeden';
  let region = 'us';
  let spec = '';

  if (armoryMatch) {
    region = armoryMatch[1].toLowerCase().trim();
    realm = armoryMatch[2].toLowerCase().trim().replace(/['\s]/g, '-');
    charName = armoryMatch[3].trim();
  } else if (charMatch) {
    charName = charMatch[1].trim();
    if (serverMatch) realm = serverMatch[1].toLowerCase().trim().replace(/['\s]/g, '-');
    if (regionMatch) region = regionMatch[1].toLowerCase().trim();
  }

  if (specMatch) spec = specMatch[1].replace(/_/g, ' ').trim();

  if (!charName) return null;

  const droptimizerUrl = `https://www.raidbots.com/simbot/droptimizer?region=${encodeURIComponent(region)}&realm=${encodeURIComponent(realm)}&name=${encodeURIComponent(charName)}&instances=1320&difficulties=heroic`;

  return {
    charName,
    realm,
    region,
    spec,
    droptimizerUrl
  };
}

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}! Ready to ingest Raidbots & QE Live reports.`);

  // Register Slash Commands /sim and /simc
  const commands = [
    new SlashCommandBuilder()
      .setName('sim')
      .setDescription('Submit your Raidbots Droptimizer (DPS/Tank) or QE Live (Healer) report link')
      .addStringOption(option =>
        option.setName('report_url')
          .setDescription('Raidbots link (raidbots.com/...) or QE Live report link (questionablyepic.com/...)')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('simc')
      .setDescription('Generate an instant 1-Click Raidbots Droptimizer link with pre-selected raid presets')
      .addStringOption(option =>
        option.setName('character_or_string')
          .setDescription('Your character name (e.g. Ainocee) or paste your /simc string')
          .setRequired(true)
      )
  ];

  const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);
  try {
    console.log('Registering /sim and /simc slash commands...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Slash commands registered globally!');
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }
});

// 1. Auto-listen in channel for pasted Raidbots or QE Live links
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Flexible channel filter: matches Channel ID, Channel Name (e.g. "raidbots"), or Channel with "#" (e.g. "#raidbots")
  if (SIMS_CHANNEL_ID) {
    const cleanTarget = SIMS_CHANNEL_ID.toString().trim().replace(/^#/, '').toLowerCase();
    const isIdMatch = message.channel.id === SIMS_CHANNEL_ID.trim();
    const isNameMatch = message.channel.name && message.channel.name.toLowerCase() === cleanTarget;
    if (!isIdMatch && !isNameMatch) {
      return;
    }
  }

  const urls = extractSimUrls(message.content);
  if (urls.length > 0) {
    console.log(`📥 Detected ${urls.length} sim/report link(s) from ${message.author.username} in #${message.channel.name}`);
    
    // React with hourglass while processing
    try { await message.react('⏳'); } catch (e) {}

    const result = await sendToGoogleSheets(urls);

    try {
      if (result.success) {
        await message.reactions.removeAll();
        await message.react('✅');
      } else {
        await message.reactions.removeAll();
        await message.react('⚠️');
      }
    } catch (e) {}

    const embed = createSimConfirmationEmbed(result, message.author.username);
    await message.reply({ embeds: [embed] });
    return;
  }

  // 2. Check if message is a pasted SimC addon export string
  const simcData = parseSimcAndGenerateLink(message.content);
  if (simcData) {
    console.log(`⚡ Detected /simc string for ${simcData.charName} (${simcData.realm}) from ${message.author.username}`);
    const embed = new EmbedBuilder()
      .setColor(0x38BDF8) // Sky blue
      .setTitle(`⚡ 1-Click Droptimizer Link Generated for ${simcData.charName}`)
      .setDescription(`[👉 **Click Here to Run Droptimizer on Raidbots**](${simcData.droptimizerUrl})\n\nAll raid drop presets (*The Venomous Abyss • Heroic • Hero Track*) have been pre-selected for you!`)
      .addFields(
        { name: '👤 Character', value: simcData.charName, inline: true },
        { name: '🌐 Realm', value: simcData.realm.toUpperCase(), inline: true },
        { name: '🌲 Spec', value: simcData.spec || 'Assigned Spec', inline: true }
      )
      .setFooter({ text: 'Once the sim finishes, paste your report URL here to update the Loot Council sheet!' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }
});

// 2. Slash command handlers (/sim and /simc)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'sim') {
    const inputUrl = interaction.options.getString('report_url');
    const urls = extractSimUrls(inputUrl);

    if (urls.length === 0) {
      await interaction.reply({
        content: '⚠️ Please provide a valid Raidbots link (`https://www.raidbots.com/simbot/report/...`) or QE Live Upgrade Report link (`https://questionablyepic.com/live/upgradereport/...`).',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();
    const result = await sendToGoogleSheets(urls);
    const embed = createSimConfirmationEmbed(result, interaction.user.username);
    await interaction.editReply({ embeds: [embed] });
  } else if (interaction.commandName === 'simc') {
    const input = interaction.options.getString('character_or_string');
    let simcData = parseSimcAndGenerateLink(input);

    if (!simcData && input && input.trim().length > 0) {
      // If user passed just a character name like "Ainocee" or "Ainocee-Kil'jaeden"
      const parts = input.trim().split(/[-,\s]+/);
      const charName = parts[0];
      const realm = parts[1] ? parts[1].toLowerCase().replace(/['\s]/g, '-') : 'kiljaeden';
      const droptimizerUrl = `https://www.raidbots.com/simbot/droptimizer?region=us&realm=${encodeURIComponent(realm)}&name=${encodeURIComponent(charName)}&instances=1320&difficulties=heroic`;
      simcData = {
        charName,
        realm,
        region: 'us',
        spec: 'Assigned Spec',
        droptimizerUrl
      };
    }

    if (!simcData) {
      await interaction.reply({
        content: '⚠️ Could not parse character name or SimC string. Please provide your character name (e.g. `/simc Ainocee`) or paste your `/simc` string.',
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x38BDF8)
      .setTitle(`⚡ 1-Click Droptimizer Link for ${simcData.charName}`)
      .setDescription(`[👉 **Click Here to Run Droptimizer on Raidbots**](${simcData.droptimizerUrl})\n\nAll raid drop presets (*The Venomous Abyss • Heroic • Hero Track*) have been pre-selected for you!`)
      .addFields(
        { name: '👤 Character', value: simcData.charName, inline: true },
        { name: '🌐 Realm', value: simcData.realm.toUpperCase(), inline: true }
      )
      .setFooter({ text: 'Once the sim finishes, paste your report URL here to update the Loot Council sheet!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
});

client.on('error', (err) => {
  console.error('❌ Discord client encountered an error:', err);
});

console.log(`🔑 Attempting Discord login with token (length: ${DISCORD_BOT_TOKEN ? DISCORD_BOT_TOKEN.trim().length : 0})...`);
client.login(DISCORD_BOT_TOKEN.trim())
  .then(() => {
    console.log('🔗 Discord login initiated successfully...');
  })
  .catch((err) => {
    console.error('❌ CRITICAL: Failed to login to Discord! Please check your DISCORD_BOT_TOKEN in Render environment variables:', err);
  });
