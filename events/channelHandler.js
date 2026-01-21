const { renameChannelByCategory } = require(’../functions/rename’);
const { EmbedBuilder } = require(‘discord.js’);
const fs = require(‘fs’).promises;
const fsSync = require(‘fs’);
const path = require(‘path’);

const CAT = {
SLEEP: ‘1427958263281881088’,
ACTIVE: ‘1411034825699233943’,
CYBER: ‘1446077580615880735’,
DREAM: ‘1445997821336748155’,
GLITCH: ‘1445997659948060712’,
EMPTY: ‘1463173837389828097’
};

const ROLE = ‘1411991634194989096’;
const REPORT = ‘1438039815919632394’;
const FILE = path.join(__dirname, ‘../data/streaks.json’);
const STREAK_CATS = [CAT.ACTIVE, CAT.CYBER, CAT.DREAM, CAT.GLITCH];
const BIOME_CATS = [CAT.CYBER, CAT.DREAM, CAT.GLITCH];
const ALL_CATS = Object.values(CAT);

module.exports = (client) => {
const data = new Map();
let saveTimer = null;
let saving = false;
const processing = new Set();

function load() {
try {
if (fsSync.existsSync(FILE)) {
const json = JSON.parse(fsSync.readFileSync(FILE, ‘utf8’));
Object.entries(json).forEach(([id, info]) => data.set(id, info));
console.log(‘Loaded ’ + data.size + ’ channels’);
}
} catch (e) {
console.error(‘Load error:’, e.message);
}
}

async function save() {
if (saving) return;
try {
saving = true;
const dir = path.dirname(FILE);
if (!fsSync.existsSync(dir)) await fs.mkdir(dir, { recursive: true });
await fs.writeFile(FILE, JSON.stringify(Object.fromEntries(data), null, 2), ‘utf8’);
} catch (e) {
console.error(‘Save error:’, e.message);
} finally {
saving = false;
}
}

function scheduleSave() {
if (saveTimer) clearTimeout(saveTimer);
saveTimer = setTimeout(save, 2000);
}

load();

function parseStreak(name) {
const m = name.match(/〔(\d+)🔥〕/);
return m ? parseInt(m[1], 10) : 0;
}

function parseBadges(name) {
const badges = [];
const match = name.match(/^(.+?)★】/);
if (!match) return badges;

const prefix = match[1];
const withCounter = prefix.match(/x\d+(🌸|🌐|🧩)/g);
if (withCounter) {
  withCounter.forEach(b => badges.push(b));
}

const singleBadges = ['🌸', '🌐', '🧩'];
singleBadges.forEach(emoji => {
  if (prefix.includes(emoji) && !badges.some(b => b.includes(emoji))) {
    badges.push(emoji);
  }
});

return badges;

}

function getUserId(topic) {
if (!topic) return null;
const parts = topic.trim().split(/\s+/);
return parts.length >= 2 && /^\d{17,20}$/.test(parts[1]) ? parts[1] : null;
}

function getData(id, ch = null) {
if (!data.has(id)) {
data.set(id, {
streak: ch ? parseStreak(ch.name) : 0,
first: null,
last: null,
days: 0,
date: null,
badges: ch ? parseBadges(ch.name) : [],
moving: false,
webhookTimes: [],
firstBiome: null
});
}
return data.get(id);
}

function getDate() {
return new Date().toISOString().split(‘T’)[0];
}

function getNext13H() {
const now = new Date();
const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 6, 0, 0));
if (now >= next) next.setUTCDate(next.getUTCDate() + 1);
return next;
}

function formatTime(ms) {
const h = Math.floor(ms / 3600000);
const m = Math.floor((ms % 3600000) / 60000);
return h + ’h ’ + m + ‘m’;
}

function detectBiome(embed) {
if (!embed) return null;
if (embed.title) {
const t = embed.title.toUpperCase();
if (t.includes(‘DREAMSPACE’)) return { type: ‘DREAMSPACE’, badge: ‘🌸’ };
if (t.includes(‘CYBERSPACE’)) return { type: ‘CYBERSPACE’, badge: ‘🌐’ };
if (t.includes(‘GLITCH’)) return { type: ‘GLITCHED’, badge: ‘🧩’ };
}
if (embed.description) {
const d = embed.description.toUpperCase();
if (d.includes(‘DREAMSPACE’)) return { type: ‘DREAMSPACE’, badge: ‘🌸’ };
if (d.includes(‘CYBERSPACE’)) return { type: ‘CYBERSPACE’, badge: ‘🌐’ };
if (d.includes(‘GLITCH’)) return { type: ‘GLITCHED’, badge: ‘🧩’ };
}
return null;
}

function getCatName(id) {
const names = {
[CAT.SLEEP]: ‘Dormant’,
[CAT.ACTIVE]: ‘Active’,
[CAT.CYBER]: ‘Cyberspace’,
[CAT.DREAM]: ‘Dreamspace’,
[CAT.GLITCH]: ‘Glitch’,
[CAT.EMPTY]: ‘Empty’
};
return names[id] || ‘Unknown’;
}

function calculateActiveTime(webhookTimes) {
if (!webhookTimes || webhookTimes.length === 0) return 0;
if (webhookTimes.length === 1) return 0;
const sorted = […webhookTimes].sort((a, b) => a - b);
const MAX_GAP = 10 * 60 * 1000;
let totalTime = 0;
for (let i = 1; i < sorted.length; i++) {
const gap = sorted[i] - sorted[i - 1];
if (gap <= MAX_GAP) totalTime += gap;
}
return totalTime;
}

async function updateRole(ch, add) {
try {
const userId = getUserId(ch.topic);
if (!userId) return;
const member = await ch.guild.members.fetch(userId).catch(() => null);
if (!member) return;
const has = member.roles.cache.has(ROLE);
if (add && !has) {
await member.roles.add(ROLE);
console.log(’Added role: ’ + member.user.tag);
} else if (!add && has) {
await member.roles.remove(ROLE);
console.log(’Removed role: ’ + member.user.tag);
}
} catch (e) {
console.error(‘Role error:’, e.message);
}
}

async function handleBiome(ch, type, badge) {
try {
const d = getData(ch.id, ch);
const map = { DREAMSPACE: CAT.DREAM, CYBERSPACE: CAT.CYBER, GLITCHED: CAT.GLITCH };
const targetCat = map[type];
if (!targetCat) return;

  const existingIndex = d.badges.findIndex(b => b.includes(badge));
  
  if (existingIndex !== -1) {
    const existing = d.badges[existingIndex];
    const m = existing.match(/x(\d+)/);
    const count = m ? parseInt(m[1], 10) : 1;
    d.badges[existingIndex] = 'x' + (count + 1) + badge;
    console.log('Badge++: ' + existing + ' → x' + (count + 1) + badge);
  } else {
    if (!d.firstBiome) {
      d.firstBiome = type;
      d.badges = [badge];
      d.moving = true;
      await ch.setParent(targetCat, { lockPermissions: false });
      await new Promise(r => setTimeout(r, 500));
      console.log('First biome: ' + type + ', moved to ' + getCatName(targetCat));
    } else {
      d.badges.push(badge);
      console.log('Added badge: ' + badge + ' (staying in ' + getCatName(ch.parentId) + ')');
    }
  }
  
  await renameChannelByCategory(ch, d.streak, d.badges);
  await updateRole(ch, true);
  scheduleSave();
} catch (e) {
  console.error('Biome error:', e.message);
}

}

async function dailyCheck() {
try {
console.log(’=== Daily Check 13:00 VN ===’);
const guild = client.guilds.cache.first();
if (!guild) return;
const report = await guild.channels.fetch(REPORT).catch(() => null);
if (!report) return;

  const channels = guild.channels.cache.filter(c => c.type === 0 && STREAK_CATS.includes(c.parentId));
  const results = { above18h: [], above12h: [], above6h: [] };

  for (const [, ch] of channels) {
    const d = getData(ch.id, ch);
    const active = calculateActiveTime(d.webhookTimes);
    const hours = active / 3600000;

    if (hours >= 18) results.above18h.push({ ch, active, streak: d.streak });
    if (hours >= 12) results.above12h.push({ ch, active, streak: d.streak });
    if (hours >= 6) results.above6h.push({ ch, active, streak: d.streak });

    if (hours >= 6) {
      d.streak++;
      d.days = 0;
      await renameChannelByCategory(ch, d.streak, d.badges);
      console.log('Streak saved: ' + ch.name + ' → ' + d.streak);
    } else {
      const old = d.streak;
      d.days++;
      if (d.days >= 3) {
        d.streak = 0;
        d.badges = [];
        d.firstBiome = null;
        d.moving = true;
        await ch.setParent(CAT.SLEEP, { lockPermissions: false });
        await new Promise(r => setTimeout(r, 500));
        await updateRole(ch, false);
        d.days = 0;
        await renameChannelByCategory(ch, 0, []);
        console.log('To Dormant: ' + ch.name + ' (' + formatTime(active) + ')');
      } else {
        console.log('Warning: ' + ch.name + ' day ' + d.days + '/3');
      }
    }
    
    d.webhookTimes = [];
    d.first = null;
    d.last = null;
    d.date = getDate();
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
      const desc = results[cfg.key].map(r => '**' + r.ch.name + '** - ' + getCatName(r.ch.parentId) + ' - ' + formatTime(r.active)).join('\n');
      embeds.push(new EmbedBuilder().setTitle(cfg.title).setColor(cfg.color).setDescription(desc).setTimestamp());
    }
  });

  if (embeds.length > 0) {
    await report.send({ content: '📊 **Daily Report** - ' + date, embeds });
    console.log('Report sent');
  } else {
    await report.send({ content: '📊 **Daily Report** - ' + date + '\nNo 6+ hour channels' });
  }
} catch (e) {
  console.error('Daily error:', e.message);
} finally {
  scheduleDailyCheck();
}
  
}

function scheduleDailyCheck() {
const next = getNext13H();
const wait = next - new Date();
console.log(’Next check: ’ + next.toISOString());
setTimeout(dailyCheck, wait);
}

async function scanEmbeds(ch) {
try {
const messages = await ch.messages.fetch({ limit: 50 });
const userId = getUserId(ch.topic);
if (!userId) return false;

  for (const [, msg] of messages) {
    if (!msg.webhookId || msg.author.id !== userId) continue;
    if (!msg.embeds || msg.embeds.length === 0) continue;
    
    for (const embed of msg.embeds) {
      const biome = detectBiome(embed);
      if (biome) {
        console.log('Found biome: ' + biome.type + ' in ' + ch.name);
        await handleBiome(ch, biome.type, biome.badge);
        return true;
      }
    }
  }
  return false;
} catch (e) {
  console.error('Scan embed error:', e.message);
  return false;
}

}

async function scanAll(guild) {
try {
console.log(’=== Scanning All Channels ===’);
const channels = guild.channels.cache.filter(c => c.type === 0 && ALL_CATS.includes(c.parentId));
const today = getDate();
let count = 0;

  for (const [, ch] of channels) {
    try {
      const streak = parseStreak(ch.name);
      const badges = parseBadges(ch.name);
      const d = getData(ch.id, ch);

      if (streak !== d.streak && streak >= 0) {
        d.streak = streak;
        console.log('Synced streak: ' + ch.name + ' = ' + streak);
      }
      
      if (badges.length > 0) {
        d.badges = badges;
        console.log('Synced badges: ' + ch.name + ' = ' + JSON.stringify(badges));
      }
      
      if (d.date !== today) {
        d.webhookTimes = [];
        d.first = null;
        d.last = null;
      }

      if (STREAK_CATS.includes(ch.parentId)) {
        await updateRole(ch, true);
      } else if (ch.parentId === CAT.SLEEP) {
        await updateRole(ch, false);
      }

      await scanEmbeds(ch);
      await renameChannelByCategory(ch, d.streak, d.badges);
      count++;
    } catch (e) {
      console.error('Sync error ' + ch.name + ':', e.message);
    }
  }

  scheduleSave();
  console.log('Synced ' + count + ' channels');
} catch (e) {
  console.error('Scan error:', e.message);
}

}

client.once(‘ready’, async () => {
try {
const guild = client.guilds.cache.first();
if (!guild) return;
console.log(‘Bot ready - scanning’);
await scanAll(guild);
scheduleDailyCheck();
} catch (e) {
console.error(‘Ready error:’, e.message);
}
});

client.on(‘messageCreate’, async (msg) => {
try {
if (!msg.webhookId) return;
const ch = msg.channel;
if (!ch || !ch.parentId || !ALL_CATS.includes(ch.parentId)) return;
const userId = getUserId(ch.topic);
if (!userId || msg.author.id !== userId) return;

  const now = Date.now();
  const d = getData(ch.id, ch);
  const currentParent = ch.parentId;

  console.log('Webhook in ' + ch.name + ' (cat: ' + getCatName(currentParent) + ')');

  let biomeDetected = null;
  
  if (msg.embeds && msg.embeds.length > 0) {
    for (const embed of msg.embeds) {
      const biome = detectBiome(embed);
      if (biome) {
        console.log('Biome from EMBED: ' + biome.type);
        biomeDetected = biome;
        break;
      }
    }
  }
  
  if (!biomeDetected && msg.content) {
    const contentUpper = msg.content.toUpperCase();
    if (contentUpper.includes('DREAMSPACE')) {
      biomeDetected = { type: 'DREAMSPACE', badge: '🌸' };
    } else if (contentUpper.includes('CYBERSPACE')) {
      biomeDetected = { type: 'CYBERSPACE', badge: '🌐' };
    } else if (contentUpper.includes('GLITCH')) {
      biomeDetected = { type: 'GLITCHED', badge: '🧩' };
    }
    if (biomeDetected) {
      console.log('Biome from TEXT: ' + biomeDetected.type);
    }
  }

  if (currentParent === CAT.SLEEP || currentParent === CAT.EMPTY) {
    const oldStreak = parseStreak(ch.name);
    d.streak = oldStreak > 0 ? oldStreak : 0;
    d.webhookTimes = [now];
    d.first = now;
    d.last = now;
    d.days = 0;

    if (biomeDetected) {
      console.log('Waking up to BIOME category');
      await handleBiome(ch, biomeDetected.type, biomeDetected.badge);
    } else {
      console.log('Waking up to ACTIVE');
      d.moving = true;
      await ch.setParent(CAT.ACTIVE, { lockPermissions: false });
      await new Promise(r => setTimeout(r, 500));
      await renameChannelByCategory(ch, d.streak, d.badges);
    }

    await updateRole(ch, true);
    scheduleSave();
    return;
  }

  if (biomeDetected) {
    await handleBiome(ch, biomeDetected.type, biomeDetected.badge);
  }

  if (!d.webhookTimes) d.webhookTimes = [];
  d.webhookTimes.push(now);
  if (!d.first) d.first = now;
  d.last = now;
  scheduleSave();

} catch (e) {
  console.error('Message error:', e.message);
}

});

client.on(‘channelCreate’, async (ch) => {
try {
if (ch.type !== 0 || !ALL_CATS.includes(ch.parentId)) return;
console.log(’Channel created: ’ + ch.name);

  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 500));
    await ch.fetch();
    if (ch.topic) break;
  }

  if (!ch.topic) {
    console.log('No topic yet');
    return;
  }

  const d = getData(ch.id, ch);
  d.streak = 0;
  d.badges = [];
  d.webhookTimes = [];
  d.firstBiome = null;

  await scanEmbeds(ch);

  if (ch.parentId === CAT.SLEEP || ch.parentId === CAT.EMPTY) {
    await updateRole(ch, false);
  } else if (STREAK_CATS.includes(ch.parentId)) {
    await updateRole(ch, true);
  }

  await renameChannelByCategory(ch, d.streak, d.badges);
  scheduleSave();
} catch (e) {
  console.error('Create error:', e.message);
}

});

client.on(‘channelUpdate’, async (old, ch) => {
try {
if (!ch || ch.type !== 0) return;
if (!ALL_CATS.includes(ch.parentId) && !ALL_CATS.includes(old.parentId)) return;

  if (processing.has(ch.id)) return;
  processing.add(ch.id);

  try {
    if (old.parentId !== ch.parentId) {
      console.log('Category change: ' + ch.name);
      const d = getData(ch.id, ch);

      if (d.moving) {
        d.moving = false;
        scheduleSave();
        console.log('Skip auto-move');
        return;
      }

      await new Promise(r => setTimeout(r, 500));
      await ch.fetch();

      if (!ch.topic) return;

      if (STREAK_CATS.includes(ch.parentId)) {
        await updateRole(ch, true);
        d.days = 0;
        await renameChannelByCategory(ch, d.streak, d.badges);
      } else if (ch.parentId === CAT.SLEEP || ch.parentId === CAT.EMPTY) {
        await updateRole(ch, false);
        d.streak = 0;
        d.days = 0;
        d.webhookTimes = [];
        d.first = null;
        d.last = null;
        d.badges = [];
        d.firstBiome = null;
        await renameChannelByCategory(ch, 0, []);
      }

      await scanEmbeds(ch);
      scheduleSave();
    }

    if (old.name !== ch.name) {
      const newStreak = parseStreak(ch.name);
      const newBadges = parseBadges(ch.name);
      const d = getData(ch.id, ch);

      if (newStreak !== d.streak && newStreak >= 0) {
        d.streak = newStreak;
        console.log('Name sync streak: ' + newStreak);
      }
      if (newBadges.length > 0 && JSON.stringify(newBadges) !== JSON.stringify(d.badges)) {
        d.badges = newBadges;
        console.log('Name sync badges: ' + JSON.stringify(newBadges));
      }
      scheduleSave();
    }
  } finally {
    processing.delete(ch.id);
  }
} catch (e) {
  console.error('Update error:', e.message);
  processing.delete(ch.id);
}

});

client.on(‘channelDelete’, (ch) => {
if (data.has(ch.id)) {
data.delete(ch.id);
scheduleSave();
console.log(’Deleted: ’ + ch.name);
}
});
};
