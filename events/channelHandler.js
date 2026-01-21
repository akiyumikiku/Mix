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
if (withCounter) withCounter.forEach(b => badges.push(b));
const singleBadges = [‘🌸’, ‘🌐’, ‘🧩’];
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
webhookTimes: [],
days: 0,
date: null,
badges: ch ? parseBadges(ch.name) : [],
moving: false,
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
const checkText = (text) => {
if (!text) return null;
const t = text.toUpperCase();
if (t.includes(‘DREAMSPACE’)) return { type: ‘DREAMSPACE’, badge: ‘🌸’ };
if (t.includes(‘CYBERSPACE’)) return { type: ‘CYBERSPACE’, badge: ‘🌐’ };
if (t.includes(‘GLITCH’)) return { type: ‘GLITCHED’, badge: ‘🧩’ };
return null;
};
return checkText(embed.title) || checkText(embed.description);
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

function calculateActiveTime(times) {
if (!times || times.length < 2) return 0;
const sorted = […times].sort((a, b) => a - b);
const MAX_GAP = 10 * 60 * 1000;
let total = 0;
for (let i = 1; i < sorted.length; i++) {
const gap = sorted[i] - sorted[i - 1];
if (gap <= MAX_GAP) total += gap;
}
return total;
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
const target = map[type];
if (!target) return;
const idx = d.badges.findIndex(b => b.includes(badge));
if (idx !== -1) {
const m = d.badges[idx].match(/x(\d+)/);
const count = m ? parseInt(m[1], 10) : 1;
d.badges[idx] = ‘x’ + (count + 1) + badge;
console.log(‘Badge++: x’ + (count + 1) + badge);
} else {
if (!d.firstBiome) {
d.firstBiome = type;
d.badges = [badge];
d.moving = true;
await ch.setParent(target, { lockPermissions: false });
await new Promise(r => setTimeout(r, 500));
console.log(’First biome: ’ + type);
} else {
d.badges.push(badge);
console.log(’Added badge: ’ + badge);
}
}
await renameChannelByCategory(ch, d.streak, d.badges);
await updateRole(ch, true);
scheduleSave();
} catch (e) {
console.error(‘Biome error:’, e.message);
}
}

async function dailyCheck() {
try {
console.log(‘Daily Check 13:00 VN’);
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
if (hours >= 18) results.above18h.push({ ch, active });
if (hours >= 12) results.above12h.push({ ch, active });
if (hours >= 6) results.above6h.push({ ch, active });
if (hours >= 6) {
d.streak++;
d.days = 0;
await renameChannelByCategory(ch, d.streak, d.badges);
console.log(‘Streak saved: ’ + ch.name + ’ = ’ + d.streak);
} else {
d.days++;
if (d.days >= 3) {
const old = d.streak;
d.streak = 0;
d.badges = [];
d.firstBiome = null;
d.moving = true;
await ch.setParent(CAT.SLEEP, { lockPermissions: false });
await new Promise(r => setTimeout(r, 500));
await updateRole(ch, false);
d.days = 0;
await renameChannelByCategory(ch, 0, []);
console.log(‘To Dormant: ’ + ch.name + ’ (lost ’ + old + ’ streak)’);
} else {
console.log(‘Warning: ’ + ch.name + ’ day ’ + d.days + ‘/3’);
}
}
d.webhookTimes = [];
d.date = getDate();
}
scheduleSave();
const embeds = [];
const date = new Date().toLocaleDateString(‘vi-VN’, { timeZone: ‘Asia/Ho_Chi_Minh’ });
[
{ key: ‘above18h’, title: ‘🏆 18+ Hours’, color: 0xFFD700 },
{ key: ‘above12h’, title: ‘⭐ 12+ Hours’, color: 0xC0C0C0 },
{ key: ‘above6h’, title: ‘✨ 6+ Hours’, color: 0xCD7F32 }
].forEach(cfg => {
if (results[cfg.key].length > 0) {
const desc = results[cfg.key].map(r => ‘**’ + r.ch.name + ’** - ’ + getCatName(r.ch.parentId) + ’ - ’ + formatTime(r.active)).join(’\n’);
embeds.push(new EmbedBuilder().setTitle(cfg.title).setColor(cfg.color).setDescription(desc).setTimestamp());
}
});
if (embeds.length > 0) {
await report.send({ content: ’📊 **Daily Report** - ’ + date, embeds });
} else {
await report.send({ content: ’📊 **Daily Report** - ’ + date + ‘\nNo 6+ hour channels’ });
}
} catch (e) {
console.error(‘Daily error:’, e.message);
} finally {
scheduleDailyCheck();
}
}

function scheduleDailyCheck() {
const next = getNext13H();
console.log(’Next check: ’ + next.toISOString());
setTimeout(dailyCheck, next - new Date());
}

async function scanAll(guild) {
try {
console.log(‘Scanning all channels’);
const channels = guild.channels.cache.filter(c => c.type === 0 && ALL_CATS.includes(c.parentId));
const today = getDate();
for (const [, ch] of channels) {
try {
const d = getData(ch.id, ch);
const streak = parseStreak(ch.name);
const badges = parseBadges(ch.name);
if (streak !== d.streak && streak >= 0) d.streak = streak;
if (badges.length > 0) d.badges = badges;
if (d.date !== today) d.webhookTimes = [];
if (STREAK_CATS.includes(ch.parentId)) await updateRole(ch, true);
else if (ch.parentId === CAT.SLEEP) await updateRole(ch, false);
await renameChannelByCategory(ch, d.streak, d.badges);
} catch (e) {
console.error(‘Sync error:’, e.message);
}
}
scheduleSave();
console.log(‘Synced ’ + channels.size + ’ channels’);
} catch (e) {
console.error(‘Scan error:’, e.message);
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
if (!ch || !ALL_CATS.includes(ch.parentId)) return;
const userId = getUserId(ch.topic);
if (!userId || msg.author.id !== userId) return;
const now = Date.now();
const d = getData(ch.id, ch);
console.log(’Webhook in ’ + ch.name);
let biome = null;
if (msg.embeds && msg.embeds.length > 0) {
for (const embed of msg.embeds) {
biome = detectBiome(embed);
if (biome) break;
}
}
if (!biome && msg.content) {
const t = msg.content.toUpperCase();
if (t.includes(‘DREAMSPACE’)) biome = { type: ‘DREAMSPACE’, badge: ‘🌸’ };
else if (t.includes(‘CYBERSPACE’)) biome = { type: ‘CYBERSPACE’, badge: ‘🌐’ };
else if (t.includes(‘GLITCH’)) biome = { type: ‘GLITCHED’, badge: ‘🧩’ };
}
if (ch.parentId === CAT.SLEEP || ch.parentId === CAT.EMPTY) {
d.streak = parseStreak(ch.name) || 0;
d.webhookTimes = [now];
d.days = 0;
if (biome) {
console.log(’Wake to BIOME: ’ + biome.type);
await handleBiome(ch, biome.type, biome.badge);
} else {
console.log(‘Wake to ACTIVE’);
d.moving = true;
await ch.setParent(CAT.ACTIVE, { lockPermissions: false });
await new Promise(r => setTimeout(r, 500));
await renameChannelByCategory(ch, d.streak, d.badges);
}
await updateRole(ch, true);
scheduleSave();
return;
}
if (biome) await handleBiome(ch, biome.type, biome.badge);
if (!d.webhookTimes) d.webhookTimes = [];
d.webhookTimes.push(now);
scheduleSave();
} catch (e) {
console.error(‘Message error:’, e.message);
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
if (!ch.topic) return;
const d = getData(ch.id, ch);
d.streak = 0;
d.badges = [];
if (ch.parentId === CAT.SLEEP || ch.parentId === CAT.EMPTY) await updateRole(ch, false);
else if (STREAK_CATS.includes(ch.parentId)) await updateRole(ch, true);
await renameChannelByCategory(ch, 0, []);
scheduleSave();
} catch (e) {
console.error(‘Create error:’, e.message);
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
console.log(’Category change: ’ + ch.name);
const d = getData(ch.id, ch);
if (d.moving) {
d.moving = false;
scheduleSave();
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
d.badges = [];
d.firstBiome = null;
await renameChannelByCategory(ch, 0, []);
}
scheduleSave();
}
if (old.name !== ch.name) {
const d = getData(ch.id, ch);
const streak = parseStreak(ch.name);
const badges = parseBadges(ch.name);
if (streak !== d.streak && streak >= 0) d.streak = streak;
if (badges.length > 0) d.badges = badges;
scheduleSave();
}
} finally {
processing.delete(ch.id);
}
} catch (e) {
console.error(‘Update error:’, e.message);
processing.delete(ch.id);
}
});

client.on(‘channelDelete’, (ch) => {
if (data.has(ch.id)) {
data.delete(ch.id);
scheduleSave();
}
});
};
