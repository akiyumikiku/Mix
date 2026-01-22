// ============================================
// FILE: events/channelHandler.js - FULL VERSION
// ============================================

const { EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { safeRename, getUsernameFromTopic } = require('../functions/rename');

// ===============================
// ⚙️ CONSTANTS
// ===============================
const CAT = {
  SLEEP: '1427958263281881088',
  ACTIVE: '1411034825699233943',
  CYBER: '1446077580615880735',
  DREAM: '1445997821336748155',
  GLITCH: '1445997659948060712',
  EMPTY: '1463173837389828097'
};

const ROLE_ID = '1411991634194989096';
const REPORT_CHANNEL = '1438039815919632394';
const DATA_FILE = path.join(__dirname, '../data/streaks.json');

const STREAK_CATS = [CAT.ACTIVE, CAT.CYBER, CAT.DREAM, CAT.GLITCH];
const ALL_CATS = Object.values(CAT);

const BIOME_MAP = {
  DREAMSPACE: { badge: '🌸', category: CAT.DREAM },
  CYBERSPACE: { badge: '🌐', category: CAT.CYBER },
  GLITCH: { badge: '🧩', category: CAT.GLITCH }
};

module.exports = (client) => {
  const data = new Map();
  let saveTimer = null;
  let saving = false;
  const processing = new Set();

  // ===============================
  // 💾 DATA PERSISTENCE
  // ===============================
  function load() {
    try {
      if (fsSync.existsSync(DATA_FILE)) {
        const json = JSON.parse(fsSync.readFileSync(DATA_FILE, 'utf8'));
        Object.entries(json).forEach(([id, info]) => data.set(id, info));
        console.log('✅ Loaded', data.size, 'channels');
      }
    } catch (e) {
      console.error('❌ Load error:', e.message);
    }
  }

  async function save() {
    if (saving) return;
    try {
      saving = true;
      const dir = path.dirname(DATA_FILE);
      if (!fsSync.existsSync(dir)) await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(DATA_FILE, JSON.stringify(Object.fromEntries(data), null, 2), 'utf8');
      console.log('💾 Saved');
    } catch (e) {
      console.error('❌ Save error:', e.message);
    } finally {
      saving = false;
    }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 2000);
  }

  load();

  // ===============================
  // 🛠 HELPERS
  // ===============================
  function getData(id) {
    if (!data.has(id)) {
      data.set(id, {
        streak: 0,
        badges: [],
        times: [],
        days: 0,
        date: null,
        firstBiome: null,
        moving: false
      });
    }
    return data.get(id);
  }

  function getDate() {
    return new Date().toISOString().split('T')[0];
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
    return h + 'h ' + m + 'm';
  }

  function getUserId(topic) {
    if (!topic) return null;
    const parts = topic.trim().split(/\s+/);
    return parts.length >= 2 && /^\d{17,20}$/.test(parts[1]) ? parts[1] : null;
  }

  function parseStreak(name) {
    const m = name.match(/〔(\d+)🔥〕/);
    return m ? parseInt(m[1], 10) : 0;
  }

  function parseBadges(name) {
    const badges = [];
    const m = name.match(/^(.+?)★】/);
    if (!m) return badges;
    const prefix = m[1];
    const withCounter = prefix.match(/x\d+(🌸|🌐|🧩)/g);
    if (withCounter) withCounter.forEach(b => badges.push(b));
    ['🌸', '🌐', '🧩'].forEach(e => {
      if (prefix.includes(e) && !badges.some(b => b.includes(e))) badges.push(e);
    });
    return badges;
  }

  function calcActive(times) {
    if (!times || times.length < 2) return 0;
    const sorted = [...times].sort((a, b) => a - b);
    const MAX = 10 * 60 * 1000;
    let total = 0;
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i] - sorted[i - 1];
      if (gap <= MAX) total += gap;
    }
    return total;
  }

  function getCatName(id) {
    return {
      [CAT.SLEEP]: 'Dormant',
      [CAT.ACTIVE]: 'Active',
      [CAT.CYBER]: 'Cyberspace',
      [CAT.DREAM]: 'Dreamspace',
      [CAT.GLITCH]: 'Glitch',
      [CAT.EMPTY]: 'Empty'
    }[id] || 'Unknown';
  }

  // ===============================
  // 🔍 DETECT BIOMES - 2 PHƯƠNG THỨC
  // ===============================
  
  // 🎯 Phương thức 1: Detect REAL-TIME từ webhook message
  function detectBiomeFromMessage(msg) {
    const check = (text) => {
      if (!text) return null;
      const t = text.toUpperCase();
      if (t.includes('DREAMSPACE')) return 'DREAMSPACE';
      if (t.includes('CYBERSPACE')) return 'CYBERSPACE';
      if (t.includes('GLITCH')) return 'GLITCH';
      return null;
    };
    
    // Check embeds
    if (msg.embeds && msg.embeds.length > 0) {
      for (const e of msg.embeds) {
        const result = check(e.title) || check(e.description);
        if (result) return result;
      }
    }
    
    // Check content
    return check(msg.content);
  }

  // 🔎 Phương thức 2: Tìm quanh @everyone trong 30 phút (embeds)
  async function detectBiomesFromEveryone(ch) {
    try {
      console.log('🔍 Searching for @everyone message in', ch.name);
      const messages = await ch.messages.fetch({ limit: 50 });
      const everyoneMsg = messages.find(m => m.content.includes('@everyone'));
      
      if (!everyoneMsg) {
        console.log('⚠️ No @everyone message found');
        return [];
      }

      console.log('✅ Found @everyone at', new Date(everyoneMsg.createdTimestamp).toISOString());

      // Lấy messages trong 30 phút quanh @everyone
      const around = messages.filter(m =>
        Math.abs(m.createdTimestamp - everyoneMsg.createdTimestamp) < 30 * 60 * 1000
      );

      console.log('📊 Found', around.size, 'messages within 30 minutes');

      const found = new Set();

      for (const msg of around.values()) {
        for (const embed of msg.embeds || []) {
          const text = `${embed.title || ''} ${embed.description || ''}`.toUpperCase();
          for (const key of Object.keys(BIOME_MAP)) {
            if (text.includes(key)) {
              found.add(key);
              console.log('🌈 Found biome in embed:', key);
            }
          }
        }
      }

      console.log('✅ Total biomes detected:', [...found]);
      return [...found];
      
    } catch (e) {
      console.error('⚠️ Detect biomes error:', e.message);
      return [];
    }
  }

  // ===============================
  // 👤 ROLE MANAGEMENT
  // ===============================
  async function updateRole(ch, add) {
    try {
      const userId = getUserId(ch.topic);
      if (!userId) return;
      const member = await ch.guild.members.fetch(userId).catch(() => null);
      if (!member) return;
      const has = member.roles.cache.has(ROLE_ID);
      if (add && !has) {
        await member.roles.add(ROLE_ID);
        console.log('✅ Role added:', member.user.tag);
      } else if (!add && has) {
        await member.roles.remove(ROLE_ID);
        console.log('❌ Role removed:', member.user.tag);
      }
    } catch (e) {
      console.error('⚠️ Role error:', e.message);
    }
  }

  // ===============================
  // 🌈 BIOME HANDLING
  // ===============================
  async function handleBiome(ch, biomeKey) {
    try {
      const d = getData(ch.id);
      const biome = BIOME_MAP[biomeKey];
      if (!biome) return;

      const idx = d.badges.findIndex(b => b.includes(biome.badge));
      
      if (idx !== -1) {
        // Upgrade badge
        const m = d.badges[idx].match(/x(\d+)/);
        const count = m ? parseInt(m[1], 10) : 1;
        d.badges[idx] = 'x' + (count + 1) + biome.badge;
        console.log('🔄 Badge++:', d.badges[idx]);
      } else {
        // New badge
        if (!d.firstBiome) {
          // First biome - move channel
          d.firstBiome = biomeKey;
          d.badges = [biome.badge];
          d.moving = true;
          await ch.setParent(biome.category, { lockPermissions: false });
          await new Promise(r => setTimeout(r, 500));
          console.log('🌟 First biome:', biomeKey);
        } else {
          // Additional badge
          d.badges.push(biome.badge);
          console.log('➕ Badge added:', biome.badge);
        }
      }
      
      await safeRename(ch, d.streak, d.badges);
      await updateRole(ch, true);
      scheduleSave();
      
    } catch (e) {
      console.error('❌ Biome error:', e.message);
    }
  }

  // ===============================
  // 📨 WEBHOOK DETECTION - REAL-TIME!
  // ===============================
  client.on('messageCreate', async (msg) => {
    try {
      // ✅ LOG EVERYTHING FOR DEBUG
      if (msg.webhookId) {
        console.log('═══════════════════════════════════');
        console.log('🎯 WEBHOOK DETECTED!');
        console.log('  Channel:', msg.channel.name);
        console.log('  Category:', msg.channel.parentId);
        console.log('  Webhook ID:', msg.webhookId);
        console.log('  Author:', msg.author.tag);
        console.log('  Author ID:', msg.author.id);
        console.log('  Has Embeds:', (msg.embeds?.length || 0));
        console.log('  Content:', msg.content.substring(0, 100));
        console.log('═══════════════════════════════════');
      }

      // ✅ MUST BE WEBHOOK
      if (!msg.webhookId) return;

      const ch = msg.channel;
      
      // ✅ MUST BE IN TRACKED CATEGORY
      if (!ch || !ALL_CATS.includes(ch.parentId)) {
        console.log('❌ Not in tracked category');
        return;
      }

      // ✅ VERIFY USER ID (chỉ check topic có user ID)
      const userId = getUserId(ch.topic);
      if (!userId) {
        console.log('❌ No user ID in topic:', ch.topic);
        return;
      }
      
      // ✅ Với webhook, msg.author.id là webhook ID, KHÔNG PHẢI user ID
      // Nên ta chỉ cần kiểm tra webhook thuộc channel có topic đúng format
      console.log('✅ Webhook belongs to channel with valid topic');
      console.log('✅ PROCESSING WEBHOOK');

      const now = Date.now();
      const d = getData(ch.id);
      const today = getDate();

      // Reset times if new day
      if (d.date !== today) {
        d.times = [];
        d.date = today;
      }

      // 🎯 PHƯƠNG THỨC 1: Detect biome từ message hiện tại
      const biomeKey = detectBiomeFromMessage(msg);
      if (biomeKey) {
        console.log('🌈 Biome detected from message:', biomeKey);
      }

      // Wake up dormant/empty channels
      if (ch.parentId === CAT.SLEEP || ch.parentId === CAT.EMPTY) {
        console.log('⏰ WAKING UP from', getCatName(ch.parentId));
        
        d.streak = parseStreak(ch.name) || 0;
        d.times = [now];
        d.days = 0;

        if (biomeKey) {
          console.log('→ To BIOME (from message):', biomeKey);
          await handleBiome(ch, biomeKey);
        } else {
          // 🔎 PHƯƠNG THỨC 2: Nếu không detect được từ message, tìm quanh @everyone
          console.log('→ Checking for @everyone messages...');
          const biomeKeys = await detectBiomesFromEveryone(ch);
          
          if (biomeKeys.length > 0) {
            console.log('→ To BIOME (from @everyone):', biomeKeys[0]);
            await handleBiome(ch, biomeKeys[0]);
            
            // Thêm các badges còn lại
            for (let i = 1; i < biomeKeys.length; i++) {
              await handleBiome(ch, biomeKeys[i]);
            }
          } else {
            console.log('→ To ACTIVE (no biome found)');
            d.moving = true;
            await ch.setParent(CAT.ACTIVE, { lockPermissions: false });
            await new Promise(r => setTimeout(r, 500));
            await safeRename(ch, d.streak, d.badges);
          }
        }

        await updateRole(ch, true);
        scheduleSave();
        return;
      }

      // Handle biome in active channels
      if (biomeKey) {
        await handleBiome(ch, biomeKey);
      }

      // Record time
      d.times.push(now);
      scheduleSave();
      
      console.log('✅ Webhook processed');

    } catch (e) {
      console.error('❌ messageCreate error:', e.message);
      console.error(e.stack);
    }
  });

  // ===============================
  // ⏰ DAILY CHECK 13:00 VN
  // ===============================
  async function dailyCheck() {
    try {
      console.log('🔔 DAILY CHECK - 13:00 VN');

      const guild = client.guilds.cache.first();
      if (!guild) return;

      const report = await guild.channels.fetch(REPORT_CHANNEL).catch(() => null);
      
      const channels = guild.channels.cache.filter(c => 
        c.type === 0 && STREAK_CATS.includes(c.parentId)
      );

      const results = { above18h: [], above12h: [], above6h: [] };

      for (const [, ch] of channels) {
        const d = getData(ch.id);
        const active = calcActive(d.times);
        const hours = active / 3600000;

        if (hours >= 18) results.above18h.push({ ch, active });
        if (hours >= 12) results.above12h.push({ ch, active });
        if (hours >= 6) results.above6h.push({ ch, active });

        if (hours >= 6) {
          // ✅ SAVE STREAK
          d.streak++;
          d.days = 0;
          await safeRename(ch, d.streak, d.badges);
          console.log('✅ Streak saved:', ch.name, '→', d.streak);
        } else {
          // ⚠️ WARNING DAY
          d.days++;
          if (d.days >= 3) {
            // 😴 MOVE TO DORMANT
            const old = d.streak;
            d.streak = 0;
            d.badges = [];
            d.firstBiome = null;
            d.moving = true;
            await ch.setParent(CAT.SLEEP, { lockPermissions: false });
            await new Promise(r => setTimeout(r, 500));
            await updateRole(ch, false);
            await safeRename(ch, 0, []);
            d.days = 0;
            console.log('😴 To Dormant:', ch.name, '(lost', old, 'streak)');
          } else {
            console.log('⚠️ Day', d.days, '/3:', ch.name);
          }
        }

        // Reset for next day
        d.times = [];
        d.date = getDate();
      }

      scheduleSave();

      // 📊 SEND REPORT
      if (report) {
        const date = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        const embeds = [];

        [
          { key: 'above18h', title: '🏆 18+ Hours', color: 0xFFD700 },
          { key: 'above12h', title: '⭐ 12+ Hours', color: 0xC0C0C0 },
          { key: 'above6h', title: '✨ 6+ Hours', color: 0xCD7F32 }
        ].forEach(cfg => {
          if (results[cfg.key].length > 0) {
            const desc = results[cfg.key]
              .map(r => `**${r.ch.name}** - ${getCatName(r.ch.parentId)} - ${formatTime(r.active)}`)
              .join('\n');
            embeds.push(
              new EmbedBuilder()
                .setTitle(cfg.title)
                .setColor(cfg.color)
                .setDescription(desc)
                .setTimestamp()
            );
          }
        });

        if (embeds.length > 0) {
          await report.send({ content: `📊 **Daily Report** - ${date}`, embeds });
        } else {
          await report.send(`📊 **Daily Report** - ${date}\nNo 6+ hour channels`);
        }
      }

      console.log('✅ Daily check done');

    } catch (e) {
      console.error('❌ Daily check error:', e.message);
    } finally {
      scheduleDailyCheck();
    }
  }

  function scheduleDailyCheck() {
    const next = getNext13H();
    console.log('⏰ Next check:', next.toISOString());
    setTimeout(dailyCheck, next - new Date());
  }

  // ===============================
  // 🎬 OTHER EVENTS
  // ===============================
  client.on('channelCreate', async (ch) => {
    try {
      if (ch.type !== 0 || !ALL_CATS.includes(ch.parentId)) return;
      console.log('🆕 Channel created:', ch.name);
      
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 500));
        await ch.fetch();
        if (ch.topic) break;
      }
      
      if (!ch.topic) return;
      
      const d = getData(ch.id);
      d.streak = 0;
      d.badges = [];
      
      if (ch.parentId === CAT.SLEEP || ch.parentId === CAT.EMPTY) {
        await updateRole(ch, false);
      } else if (STREAK_CATS.includes(ch.parentId)) {
        await updateRole(ch, true);
      }
      
      await safeRename(ch, 0, []);
      scheduleSave();
      
    } catch (e) {
      console.error('❌ channelCreate error:', e.message);
    }
  });

  client.on('channelUpdate', async (old, ch) => {
    try {
      if (!ch || ch.type !== 0) return;
      if (!ALL_CATS.includes(ch.parentId) && !ALL_CATS.includes(old.parentId)) return;
      if (processing.has(ch.id)) return;

      processing.add(ch.id);

      try {
        const d = getData(ch.id);

        if (old.parentId !== ch.parentId) {
          console.log('📦 Category change:', ch.name);

          if (d.moving) {
            d.moving = false;
            scheduleSave();
            return;
          }

          await new Promise(r => setTimeout(r, 500));
          await ch.fetch();

          if (STREAK_CATS.includes(ch.parentId)) {
            await updateRole(ch, true);
            d.days = 0;
            await safeRename(ch, d.streak, d.badges);
          } else if (ch.parentId === CAT.SLEEP || ch.parentId === CAT.EMPTY) {
            await updateRole(ch, false);
            d.streak = 0;
            d.days = 0;
            d.times = [];
            d.badges = [];
            d.firstBiome = null;
            await safeRename(ch, 0, []);
          }

          scheduleSave();
        }

        if (old.name !== ch.name) {
          const streak = parseStreak(ch.name);
          const badges = parseBadges(ch.name);
          if (streak >= 0 && streak !== d.streak) d.streak = streak;
          if (badges.length > 0) d.badges = badges;
          scheduleSave();
        }

      } finally {
        processing.delete(ch.id);
      }

    } catch (e) {
      console.error('❌ channelUpdate error:', e.message);
      processing.delete(ch.id);
    }
  });

  client.on('channelDelete', (ch) => {
    if (data.has(ch.id)) {
      data.delete(ch.id);
      scheduleSave();
      console.log('🗑️ Deleted:', ch.name);
    }
  });

  // ===============================
  // 🚀 INITIALIZATION
  // ===============================
  async function scanAll(guild) {
    try {
      console.log('🔍 Scanning...');
      
      const channels = guild.channels.cache.filter(c => 
        c.type === 0 && ALL_CATS.includes(c.parentId)
      );
      
      const today = getDate();
      
      for (const [, ch] of channels) {
        try {
          const d = getData(ch.id);
          const streak = parseStreak(ch.name);
          const badges = parseBadges(ch.name);
          
          if (streak >= 0 && streak !== d.streak) d.streak = streak;
          if (badges.length > 0) d.badges = badges;
          if (d.date !== today) d.times = [];
          
          if (STREAK_CATS.includes(ch.parentId)) await updateRole(ch, true);
          else if (ch.parentId === CAT.SLEEP) await updateRole(ch, false);
          
          await safeRename(ch, d.streak, d.badges);
          
        } catch (e) {
          console.error('⚠️ Sync error:', ch.name, e.message);
        }
      }
      
      scheduleSave();
      console.log('✅ Synced', channels.size, 'channels');
      
    } catch (e) {
      console.error('❌ Scan error:', e.message);
    }
  }

  client.once('ready', async () => {
    try {
      console.log('🤖 Bot ready!');
      const guild = client.guilds.cache.first();
      if (guild) {
        await scanAll(guild);
        scheduleDailyCheck();
      }
      console.log('🚀 All systems go!');
    } catch (e) {
      console.error('❌ Ready error:', e.message);
    }
  });
};