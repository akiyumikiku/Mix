// events/channelHandler.js
const { renameChannelByCategory } = require(’../functions/rename’);
const { EmbedBuilder } = require(‘discord.js’);
const fs = require(‘fs’).promises;
const fsSync = require(‘fs’);
const path = require(‘path’);

// Categories
const CATEGORY_SLEEP = ‘1427958263281881088’;
const CATEGORY_ACTIVE = ‘1411034825699233943’;
const CATEGORY_CYBER = ‘1446077580615880735’;
const CATEGORY_DREAM = ‘1445997821336748155’;
const CATEGORY_GLITCH = ‘1445997659948060712’;
const CATEGORY_EMPTY = ‘1463173837389828097’;

const MACRO_ROLE = ‘1411991634194989096’;
const REPORT_CHANNEL_ID = ‘1438039815919632394’;
const STREAK_FILE = path.join(__dirname, ‘../data/streaks.json’);

const STREAK_CATEGORIES = [CATEGORY_ACTIVE, CATEGORY_CYBER, CATEGORY_DREAM, CATEGORY_GLITCH];
const ALL_CATEGORIES = […STREAK_CATEGORIES, CATEGORY_SLEEP, CATEGORY_EMPTY];

module.exports = (client) => {
const channelData = new Map();
let saveTimer = null;
let isSaving = false;
const processingChannels = new Set();

function loadData() {
try {
if (fsSync.existsSync(STREAK_FILE)) {
const data = JSON.parse(fsSync.readFileSync(STREAK_FILE, ‘utf8’));
Object.entries(data).forEach(([channelId, channelInfo]) => {
channelData.set(channelId, channelInfo);
});
console.log(‘Loaded ’ + channelData.size + ’ channels’);
}
} catch (err) {
console.error(‘Load error:’, err.message);
}
}

async function saveData() {
if (isSaving) return;
try {
isSaving = true;
const dir = path.dirname(STREAK_FILE);
if (!fsSync.existsSync(dir)) {
await fs.mkdir(dir, { recursive: true });
}
const data = Object.fromEntries(channelData);
await fs.writeFile(STREAK_FILE, JSON.stringify(data, null, 2), ‘utf8’);
} catch (err) {
console.error(‘Save error:’, err.message);
} finally {
isSaving = false;
}
}

function scheduleSave() {
if (saveTimer) clearTimeout(saveTimer);
saveTimer = setTimeout(() => saveData(), 2000);
}

loadData();

function parseStreakFromName(name) {
const match = name.match(/〔(\d+)🔥〕/);
return match ? parseInt(match[1], 10) : 0;
}

function parseSpecialBadges(name) {
const badges = [];
const patterns = [
{ regex: /x(\d+)🌸/, single: ‘🌸’ },
{ regex: /x(\d+)🌐/, single: ‘🌐’ },
{ regex: /x(\d+)🧩/, single: ‘🧩’ }
];
patterns.forEach(({ regex, single }) => {
const match = name.match(regex);
if (match) {
badges.push(‘x’ + match[1] + single);
} else if (name.includes(single) && !badges.some(b => b.includes(single))) {
badges.push(single);
}
});
return badges;
}

function extractUserId(topic) {
if (!topic) return null;
const parts = topic.trim().split(/\s+/);
if (parts.length < 2) return null;
const userId = parts[1];
return /^\d{17,20}$/.test(userId) ? userId : null;
}

function getData(channelId, channel = null) {
if (!channelData.has(channelId)) {
channelData.set(channelId, {
streak: channel ? parseStreakFromName(channel.name) : 0,
firstWebhook: null,
lastWebhook: null,
daysWithoutActivity: 0,
lastCheckDate: null,
specialBadges: channel ? parseSpecialBadges(channel.name) : [],
isAutoMoving: false
});
}
return channelData.get(channelId);
}

function getCurrentDate() {
return new Date().toISOString().split(‘T’)[0];
}

function getNext13H() {
const now = new Date();
const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 6, 0, 0, 0));
if (now >= next) next.setUTCDate(next.getUTCDate() + 1);
return next;
}

function formatTime(ms) {
const h = Math.floor(ms / 3600000);
const m = Math.floor((ms % 3600000) / 60000);
return h + ’h ’ + m + ‘m’;
}

function detectBiome(embed) {
if (!embed?.title) return null;
const title = embed.title.toUpperCase();
if (title.includes(‘DREAMSPACE’)) return { type: ‘DREAMSPACE’, badge: ‘🌸’ };
if (title.includes(‘CYBERSPACE’)) return { type: ‘CYBERSPACE’, badge: ‘🌐’ };
if (title.includes(‘GLITCH’)) return { type: ‘GLITCHED’, badge: ‘🧩’ };
return null;
}

function getCategoryName(id) {
const names = {
[CATEGORY_ACTIVE]: ‘Active’,
[CATEGORY_CYBER]: ‘Cyberspace’,
[CATEGORY_DREAM]: ‘Dreamspace’,
[CATEGORY_GLITCH]: ‘Glitch’,
[CATEGORY_SLEEP]: ‘Dormant’,
[CATEGORY_EMPTY]: ‘Empty’
};
return names[id] || ‘Unknown’;
}

async function updateRole(channel, add) {
try {
const userId = extractUserId(channel.topic);
if (!userId) return;
const member = await channel.guild.members.fetch(userId).catch(() => null);
if (!member) return;
const has = member.roles.cache.has(MACRO_ROLE);
if (add && !has) {
await member.roles.add(MACRO_ROLE);
console.log(’Added role: ’ + member.user.tag);
} else if (!add && has) {
await member.roles.remove(MACRO_ROLE);
console.log(’Removed role: ’ + member.user.tag);
}
} catch (err) {
console.error(‘Role error:’, err.message);
}
}

async function moveToSpecial(channel, type, badge) {
try {
const data = getData(channel.id, channel);
const map = { DREAMSPACE: CATEGORY_DREAM, CYBERSPACE: CATEGORY_CYBER, GLITCHED: CATEGORY_GLITCH };
const target = map[type];
if (!target) return;


  const existing = data.specialBadges.find(b => b.includes(badge));
  if (existing) {
    const match = existing.match(/x(\d+)/);
    const count = match ? parseInt(match[1], 10) : 1;
    data.specialBadges = data.specialBadges.filter(b => !b.includes(badge));
    data.specialBadges.unshift('x' + (count + 1) + badge);
    console.log('Badge++ x' + (count + 1) + badge + ': ' + channel.name);
  } else {
    if (data.specialBadges.length > 0 && channel.parentId !== target) {
      data.specialBadges.push(badge);
      console.log('Badge+ ' + badge + ': ' + channel.name);
    } else if (channel.parentId !== target) {
      data.specialBadges = [badge];
      data.isAutoMoving = true;
      await channel.setParent(target, { lockPermissions: false });
      await new Promise(r => setTimeout(r, 500));
      console.log('Moved to ' + type + ': ' + channel.name);
    } else {
      data.specialBadges = [badge];
    }
  }
  await updateRole(channel, true);
  await renameChannelByCategory(channel, data.streak, data.specialBadges);
  scheduleSave();
} catch (err) {
  console.error('Special move error:', err.message);
}

}

async function notify(channel, type, data = {}) {
try {
const userId = extractUserId(channel.topic);
if (!userId) return;
const msg = {
sleep: ‘<@’ + userId + ‘>\n💤 Moved to DORMANT (3 days inactive)’,
active: ‘<@’ + userId + ‘>\n✨ Reactivated!’,
warning: ‘<@’ + userId + ‘> ⚠️ **Warning!**\n’ + data.time + ’ today (need 6h+)\nStreak: **’ + data.streak + ’** 🔥\nDay ’ + data.days + ‘/3’,
lost: ‘<@’ + userId + ‘> 💔 **Streak Lost!**\n’ + data.time + ’ today\n**’ + data.old + ’ → 0** 🔥’,
saved: ‘<@’ + userId + ‘> ✅ **Streak Saved!**\n6+ hours today\nStreak: **’ + data.streak + ’** 🔥’
};
if (msg[type]) await channel.send(msg[type]);
} catch (err) {}
}

async function dailyCheck() {
try {
console.log(‘Daily check 13:00 VN’);
const guild = client.guilds.cache.first();
if (!guild) return;
const report = await guild.channels.fetch(REPORT_CHANNEL_ID).catch(() => null);
if (!report) return;


  const channels = guild.channels.cache.filter(ch => ch.type === 0 && STREAK_CATEGORIES.includes(ch.parentId));
  const results = { above18h: [], above12h: [], above6h: [] };

  for (const [, ch] of channels) {
    const data = getData(ch.id, ch);
    let active = 0;
    if (data.firstWebhook && data.lastWebhook) {
      active = data.lastWebhook - data.firstWebhook;
    }
    const hours = active / 3600000;

    if (hours >= 18) results.above18h.push({ ch, active, streak: data.streak });
    if (hours >= 12) results.above12h.push({ ch, active, streak: data.streak });
    if (hours >= 6) results.above6h.push({ ch, active, streak: data.streak });

    if (hours >= 6) {
      data.streak++;
      data.daysWithoutActivity = 0;
      await renameChannelByCategory(ch, data.streak, data.specialBadges);
      console.log('Streak++ ' + ch.name + ' = ' + data.streak);
      await notify(ch, 'saved', { streak: data.streak });
    } else {
      const old = data.streak;
      data.daysWithoutActivity++;
      if (data.daysWithoutActivity >= 3) {
        data.streak = 0;
        data.specialBadges = [];
        data.isAutoMoving = true;
        await ch.setParent(CATEGORY_SLEEP, { lockPermissions: false });
        await new Promise(r => setTimeout(r, 500));
        await updateRole(ch, false);
        data.daysWithoutActivity = 0;
        await renameChannelByCategory(ch, 0, []);
        await notify(ch, 'lost', { time: formatTime(active), old: old });
        await notify(ch, 'sleep');
        console.log('To DORMANT: ' + ch.name);
      } else {
        await notify(ch, 'warning', { time: formatTime(active), streak: data.streak, days: data.daysWithoutActivity });
        console.log('Warning ' + ch.name + ' day ' + data.daysWithoutActivity + '/3');
      }
    }
    data.firstWebhook = null;
    data.lastWebhook = null;
    data.lastCheckDate = getCurrentDate();
  }

  scheduleSave();

  const embeds = [];
  const date = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const configs = [
    { key: 'above18h', title: '🏆 18+ Hours', color: 0xFFD700 },
    { key: 'above12h', title: '⭐ 12+ Hours', color: 0xC0C0C0 },
    { key: 'above6h', title: '✨ 6+ Hours', color: 0xCD7F32 }
  ];

  configs.forEach(cfg => {
    if (results[cfg.key].length > 0) {
      const desc = results[cfg.key].map(r => '**' + r.ch.name + '** - ' + getCategoryName(r.ch.parentId) + ' - ' + formatTime(r.active)).join('\n');
      embeds.push(new EmbedBuilder().setTitle(cfg.title).setColor(cfg.color).setDescription(desc).setTimestamp());
    }
  });

  if (embeds.length > 0) {
    await report.send({ content: '📊 **Daily Report** - ' + date, embeds });
    console.log('Report sent');
  } else {
    await report.send({ content: '📊 **Daily Report** - ' + date + '\nNo 6+ hour channels' });
  }
} catch (err) {
  console.error('Daily check error:', err.message);
} finally {
  scheduleDailyCheck();
}


}

function scheduleDailyCheck() {
const next = getNext13H();
const wait = next - new Date();
console.log(’Next check: ’ + next.toISOString());
setTimeout(() => dailyCheck(), wait);
}

async function scanAll(guild) {
try {
console.log(‘Scanning all channels…’);
const channels = guild.channels.cache.filter(ch => ch.type === 0 && ALL_CATEGORIES.includes(ch.parentId));
const today = getCurrentDate();
let count = 0;


  for (const [, ch] of channels) {
    try {
      const streak = parseStreakFromName(ch.name);
      const badges = parseSpecialBadges(ch.name);
      const data = getData(ch.id, ch);

      if (streak !== data.streak && streak >= 0) {
        data.streak = streak;
        console.log('Synced streak: ' + ch.name + ' = ' + streak);
      }
      if (badges.length > 0) {
        data.specialBadges = badges;
        console.log('Synced badges: ' + ch.name);
      }
      if (data.lastCheckDate !== today) {
        data.firstWebhook = null;
        data.lastWebhook = null;
      }

      if (STREAK_CATEGORIES.includes(ch.parentId)) {
        await updateRole(ch, true);
      } else if (ch.parentId === CATEGORY_SLEEP) {
        await updateRole(ch, false);
      }

      await renameChannelByCategory(ch, data.streak, data.specialBadges);
      count++;
    } catch (err) {
      console.error('Sync error ' + ch.name + ':', err.message);
    }
  }

  scheduleSave();
  console.log('Synced ' + count + ' channels');
} catch (err) {
  console.error('Scan error:', err.message);
}


}

async function scanEmbeds(channel) {
try {
console.log(’Scanning embeds in: ’ + channel.name);
const messages = await channel.messages.fetch({ limit: 50 });
for (const [, msg] of messages) {
if (msg.webhookId && msg.embeds?.length > 0) {
const userId = extractUserId(channel.topic);
if (userId && msg.author.id === userId) {
for (const embed of msg.embeds) {
const biome = detectBiome(embed);
if (biome) {
console.log(’Found biome: ’ + biome.type);
await moveToSpecial(channel, biome.type, biome.badge);
return true;
}
}
}
}
}
return false;
} catch (err) {
console.error(‘Embed scan error:’, err.message);
return false;
}
}

client.once(‘ready’, async () => {
try {
const guild = client.guilds.cache.first();
if (!guild) return;
console.log(‘Bot ready’);
await scanAll(guild);
scheduleDailyCheck();
} catch (err) {
console.error(‘Ready error:’, err.message);
}
});

client.on(‘messageCreate’, async (msg) => {
try {
if (!msg.webhookId) return;
const ch = msg.channel;
if (!ch?.parentId || !ALL_CATEGORIES.includes(ch.parentId)) return;
const userId = extractUserId(ch.topic);
if (!userId || msg.author.id !== userId) return;


  const now = Date.now();
  const data = getData(ch.id, ch);

  if (msg.embeds?.length > 0) {
    for (const embed of msg.embeds) {
      const biome = detectBiome(embed);
      if (biome) await moveToSpecial(ch, biome.type, biome.badge);
    }
  }

  if (ch.parentId === CATEGORY_SLEEP || ch.parentId === CATEGORY_EMPTY) {
    const oldStreak = parseStreakFromName(ch.name);
    data.streak = oldStreak > 0 ? oldStreak : 0;
    data.firstWebhook = now;
    data.lastWebhook = now;
    data.daysWithoutActivity = 0;
    data.isAutoMoving = true;
    await ch.setParent(CATEGORY_ACTIVE, { lockPermissions: false });
    await new Promise(r => setTimeout(r, 500));
    await updateRole(ch, true);
    await renameChannelByCategory(ch, data.streak, data.specialBadges);
    await notify(ch, 'active');
    scheduleSave();
    console.log('Reactivated: ' + ch.name);
    return;
  }

  if (!data.firstWebhook) {
    data.firstWebhook = now;
    console.log('First webhook: ' + ch.name);
  }
  data.lastWebhook = now;
  scheduleSave();
} catch (err) {
  console.error('Message error:', err.message);
}


});

client.on(‘channelCreate’, async (ch) => {
try {
if (ch.type !== 0 || !ALL_CATEGORIES.includes(ch.parentId)) return;
console.log(’Channel created: ’ + ch.name);


  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 500));
    await ch.fetch();
    if (ch.topic) break;
  }

  if (!ch.topic) {
    console.log('No topic yet: ' + ch.name);
    return;
  }

  const data = getData(ch.id, ch);
  data.streak = 0;
  data.specialBadges = [];

  await scanEmbeds(ch);

  if (ch.parentId === CATEGORY_SLEEP || ch.parentId === CATEGORY_EMPTY) {
    await updateRole(ch, false);
  } else if (STREAK_CATEGORIES.includes(ch.parentId)) {
    await updateRole(ch, true);
  }

  await renameChannelByCategory(ch, data.streak, data.specialBadges);
  scheduleSave();
} catch (err) {
  console.error('Create error:', err.message);
}


});

client.on(‘channelUpdate’, async (old, ch) => {
try {
if (!ch || ch.type !== 0) return;
if (!ALL_CATEGORIES.includes(ch.parentId) && !ALL_CATEGORIES.includes(old.parentId)) return;


  if (processingChannels.has(ch.id)) return;
  processingChannels.add(ch.id);

  try {
    if (old.parentId !== ch.parentId) {
      console.log('Category change: ' + ch.name);
      const data = getData(ch.id, ch);

      if (data.isAutoMoving) {
        data.isAutoMoving = false;
        scheduleSave();
        console.log('Skip auto-move');
        return;
      }

      await new Promise(r => setTimeout(r, 500));
      await ch.fetch();

      if (!ch.topic) return;

      if (STREAK_CATEGORIES.includes(ch.parentId)) {
        await updateRole(ch, true);
        data.daysWithoutActivity = 0;
        await renameChannelByCategory(ch, data.streak, data.specialBadges);
        await notify(ch, 'active');
      } else if (ch.parentId === CATEGORY_SLEEP || ch.parentId === CATEGORY_EMPTY) {
        await updateRole(ch, false);
        data.streak = 0;
        data.daysWithoutActivity = 0;
        data.firstWebhook = null;
        data.lastWebhook = null;
        data.specialBadges = [];
        await renameChannelByCategory(ch, 0, []);
        if (ch.parentId === CATEGORY_SLEEP) await notify(ch, 'sleep');
      }

      await scanEmbeds(ch);
      scheduleSave();
    }

    if (old.name !== ch.name) {
      const newStreak = parseStreakFromName(ch.name);
      const newBadges = parseSpecialBadges(ch.name);
      const data = getData(ch.id, ch);

      if (newStreak !== data.streak && newStreak >= 0) {
        data.streak = newStreak;
        console.log('Name sync streak: ' + newStreak);
      }
      if (newBadges.length > 0 && JSON.stringify(newBadges) !== JSON.stringify(data.specialBadges)) {
        data.specialBadges = newBadges;
        console.log('Name sync badges');
      }
      scheduleSave();
    }
  } finally {
    processingChannels.delete(ch.id);
  }
} catch (err) {
  console.error('Update error:', err.message);
  processingChannels.delete(ch.id);
}


});

client.on(‘channelDelete’, (ch) => {
if (channelData.has(ch.id)) {
channelData.delete(ch.id);
scheduleSave();
console.log(’Deleted: ’ + ch.name);
}
});
};
