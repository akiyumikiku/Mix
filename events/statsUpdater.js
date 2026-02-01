// ============================================
// FILE: events/statsUpdater.js
// Auto-update stats display in channels
// ============================================

const { EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const CAT = {
  ACTIVE: '1411034825699233943',
  CYBER: '1446077580615880735',
  DREAM: '1445997821336748155',
  GLITCH: '1445997659948060712'
};

const STREAK_CATS = [CAT.ACTIVE, CAT.CYBER, CAT.DREAM, CAT.GLITCH];
const DATA_FILE = path.join(__dirname, '../data/streaks.json');
const MAX_GAP = 20 * 60 * 1000; // 20 phút
const UPDATE_INTERVAL = 5 * 60 * 1000; // Update mỗi 5 phút

// Stats message IDs storage
const STATS_FILE = path.join(__dirname, '../data/stats_messages.json');
let statsMessages = new Map(); // channelId -> messageId

module.exports = (client) => {
  
  // Load stats message IDs
  function loadStatsMessages() {
    try {
      if (fsSync.existsSync(STATS_FILE)) {
        const json = JSON.parse(fsSync.readFileSync(STATS_FILE, 'utf8'));
        Object.entries(json).forEach(([id, msgId]) => statsMessages.set(id, msgId));
        console.log('✅ Loaded', statsMessages.size, 'stats messages');
      }
    } catch (e) {
      console.error('❌ Load stats messages error:', e.message);
    }
  }

  async function saveStatsMessages() {
    try {
      const dir = path.dirname(STATS_FILE);
      if (!fsSync.existsSync(dir)) await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(STATS_FILE, JSON.stringify(Object.fromEntries(statsMessages), null, 2), 'utf8');
    } catch (e) {
      console.error('❌ Save stats messages error:', e.message);
    }
  }

  // Load streak data
  function loadStreakData() {
    try {
      if (fsSync.existsSync(DATA_FILE)) {
        const json = JSON.parse(fsSync.readFileSync(DATA_FILE, 'utf8'));
        return new Map(Object.entries(json));
      }
    } catch (e) {
      console.error('❌ Load streak data error:', e.message);
    }
    return new Map();
  }

  function formatTime(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}.${Math.floor(m / 6)}h`; // Format: 9.8h
  }

  function calcActive(times, maxGap = MAX_GAP, checkTime = Date.now()) {
    if (!times || times.length === 0) return 0;

    const validTimes = times.filter(t => typeof t === 'number' && !isNaN(t) && t > 0);
    if (validTimes.length === 0) return 0;

    const sorted = [...validTimes].sort((a, b) => a - b);
    const firstTime = sorted[0];
    const totalSpan = checkTime - firstTime;

    let totalBreaks = 0;

    // Tính gaps giữa các webhooks
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i] - sorted[i - 1];
      if (gap > maxGap) totalBreaks += gap;
    }

    // Tính gap từ webhook cuối đến hiện tại
    const lastGap = checkTime - sorted[sorted.length - 1];
    if (lastGap > maxGap) totalBreaks += lastGap;

    return Math.max(0, totalSpan - totalBreaks);
  }

  // Create or update stats embed
  async function updateChannelStats(channel) {
    try {
      const streakData = loadStreakData();
      const data = streakData.get(channel.id);
      
      if (!data) return;

      const now = Date.now();
      const active = calcActive(data.times || [], MAX_GAP, now);
      const hours = active / 3600000;

      // Calculate max gap (time since last webhook)
      let maxGapTime = 0;
      if (data.times && data.times.length > 0) {
        const sorted = [...data.times].sort((a, b) => b - a);
        maxGapTime = now - sorted[0];
      }

      const embed = new EmbedBuilder()
        .setTitle('📊 ACTIVE CHANNELS STATS')
        .setDescription(`⚙️ Max gap: ${formatTime(MAX_GAP)}`)
        .setColor(0x00AE86)
        .addFields({
          name: `${data.badges.join(' ') || '🛠'}★】〔${data.streak}🔥〕${channel.name.split('〕')[1]?.trim() || 'macro'}`,
          value: `Streak: ${data.streak}🔥 | Now: ${formatTime(active)} | Webhooks: ${(data.times || []).length} | Warns: ${data.days || 0}/3 | Badges: ${data.badges.join(' ') || 'none'}`,
          inline: false
        })
        .setFooter({ text: 'Auto-updated every 5 minutes' })
        .setTimestamp();

      // Get or create stats message
      const messageId = statsMessages.get(channel.id);
      let statsMessage = null;

      if (messageId) {
        try {
          statsMessage = await channel.messages.fetch(messageId);
          await statsMessage.edit({ embeds: [embed] });
        } catch (e) {
          // Message deleted or not found, create new one
          statsMessage = null;
        }
      }

      if (!statsMessage) {
        statsMessage = await channel.send({ embeds: [embed] });
        statsMessages.set(channel.id, statsMessage.id);
        await saveStatsMessages();
      }

    } catch (e) {
      console.error('❌ Update channel stats error:', e.message);
    }
  }

  // Update all channels
  async function updateAllStats() {
    try {
      console.log('🔄 Updating all channel stats...');
      
      const guild = client.guilds.cache.first();
      if (!guild) return;

      const channels = guild.channels.cache.filter(c => 
        c.type === 0 && STREAK_CATS.includes(c.parentId)
      );

      for (const [, channel] of channels) {
        await updateChannelStats(channel);
        await new Promise(r => setTimeout(r, 1000)); // Rate limit protection
      }

      console.log('✅ Stats updated for', channels.size, 'channels');

    } catch (e) {
      console.error('❌ Update all stats error:', e.message);
    }
  }

  // Initialize
  client.once('ready', () => {
    loadStatsMessages();
    
    // Initial update
    setTimeout(() => updateAllStats(), 5000);

    // Schedule periodic updates
    setInterval(updateAllStats, UPDATE_INTERVAL);
    
    console.log('✅ Stats updater initialized (update every 5 minutes)');
  });

  // Manual update command
  client.on('messageCreate', async (msg) => {
    if (msg.content === '!updatestats') {
      if (!msg.member.permissions.has('Administrator')) {
        await msg.reply('❌ Admin only!');
        return;
      }

      await msg.reply('🔄 Updating all stats...');
      await updateAllStats();
      await msg.reply('✅ Stats updated!');
    }

    if (msg.content === '!initstats') {
      if (!msg.member.permissions.has('Administrator')) {
        await msg.reply('❌ Admin only!');
        return;
      }

      const ch = msg.channel;
      if (!STREAK_CATS.includes(ch.parentId)) {
        await msg.reply('⚠️ Channel này không được track!');
        return;
      }

      await updateChannelStats(ch);
      await msg.reply('✅ Stats message created/updated!');
    }
  });
};
