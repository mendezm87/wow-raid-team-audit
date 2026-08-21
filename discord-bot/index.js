require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GOOGLE_SHEET_WEBHOOK_URL = process.env.GOOGLE_SHEET_WEBHOOK_URL;
const SIMS_CHANNEL_ID = process.env.SIMS_CHANNEL_ID; // Optional: Restrict auto-listening to a specific channel

if (!DISCORD_BOT_TOKEN || !GOOGLE_SHEET_WEBHOOK_URL) {
  console.error('❌ Missing environment variables! Please configure DISCORD_BOT_TOKEN and GOOGLE_SHEET_WEBHOOK_URL in your .env or host dashboard.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Helper to extract Raidbots URLs from any message string
function extractRaidbotsUrls(text) {
  if (!text) return [];
  const regex = /https?:\/\/(?:www\.)?raidbots\.com\/(?:simbot\/)?report\/([A-Za-z0-9_-]{10,35})/gi;
  const urls = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const reportId = match[1];
    const fullUrl = `https://www.raidbots.com/simbot/report/${reportId}`;
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
      body: JSON.stringify({ urls: urls })
    });
    return await response.json();
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
      .setTitle('❌ Droptimizer Import Failed')
      .setDescription(result?.error || 'Could not process the provided Raidbots sim. Please make sure the sim has finished and is set to public.')
      .setFooter({ text: 'WoW Raid Team Audit' })
      .setTimestamp();
  }

  const embed = new EmbedBuilder()
    .setColor(0x10B981) // Emerald green
    .setTitle('✅ Droptimizer Sim Imported to Loot Council')
    .setDescription(`Successfully mapped upgrades for **${result.players?.join(', ') || authorName}** to the guild spreadsheet!`)
    .addFields(
      { name: '📊 Total Raid Drops Mapped', value: `${result.itemsMapped || 0} items`, inline: true },
      { name: '⚡ Sim Reports Merged', value: `${result.reportsProcessed || 1} report(s)`, inline: true }
    )
    .setFooter({ text: 'Prey Guild Audit • Loot Council Synced' })
    .setTimestamp();

  if (result.topUpgrades && result.topUpgrades.length > 0) {
    const topList = result.topUpgrades.slice(0, 3).map((up, i) => `${i + 1}. **${up.item}** (+${up.pct}% DPS)`).join('\n');
    embed.addFields({ name: '🌟 Top Simulated Upgrades', value: topList, inline: false });
  }

  return embed;
}

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}! Ready to ingest Raidbots sims.`);

  // Register Slash Command /sim
  const commands = [
    new SlashCommandBuilder()
      .setName('sim')
      .setDescription('Submit your Raidbots Droptimizer link to the Guild Loot Council spreadsheet')
      .addStringOption(option =>
        option.setName('report_url')
          .setDescription('Your Raidbots Droptimizer report link (e.g. https://www.raidbots.com/simbot/report/...)')
          .setRequired(true)
      )
  ];

  const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);
  try {
    console.log('Registering /sim slash command...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Slash command /sim registered globally!');
  } catch (err) {
    console.error('Failed to register slash command:', err);
  }
});

// 1. Auto-listen in channel for pasted Raidbots links
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // If a specific SIMS_CHANNEL_ID is configured, only listen there
  if (SIMS_CHANNEL_ID && message.channel.id !== SIMS_CHANNEL_ID) return;

  const urls = extractRaidbotsUrls(message.content);
  if (urls.length === 0) return;

  console.log(`📥 Detected ${urls.length} Raidbots link(s) from ${message.author.username}`);
  
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
});

// 2. Slash command /sim handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'sim') {
    const inputUrl = interaction.options.getString('report_url');
    const urls = extractRaidbotsUrls(inputUrl);

    if (urls.length === 0) {
      await interaction.reply({
        content: '⚠️ Please provide a valid Raidbots Droptimizer report link (e.g. `https://www.raidbots.com/simbot/report/aM6qT1dQz2CPxVodxJDy5k`).',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();
    const result = await sendToGoogleSheets(urls);
    const embed = createSimConfirmationEmbed(result, interaction.user.username);
    await interaction.editReply({ embeds: [embed] });
  }
});

client.login(DISCORD_BOT_TOKEN);
