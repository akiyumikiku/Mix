// ============================================
// FILE: events/channelHandler.js - FULLY FIXED VERSION
// Fixed: Badge logic, duplicate prevention, proper parsing
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

// ⚙️ CẤU HÌNH THỜI GIAN
const MAX_GAP = 20 * 60 * 1000; // 20 phút - cân bằng giữa chính xác và linh hoạt

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

  /**
   * ✅ FIXED: Parse badges đúng cách, tránh duplicate
   */
  function parseBadges(name) {
    const badges = [];
    const m = name.match(/^#\s*(.+?)★】/);
    if (!m) return badges;
    
    const prefix = m[1].trim();
    console.log('  🔍 Parsing badges from prefix:', prefix);
    
    // Parse badges có counter (x2🌸, x3🌐, etc.)
    const withCounter = prefix.match(/x\d+[🌸🌐🧩]/g);
    if (withCounter) {
      withCounter.forEach(b => {
        badges.push(b);
        console.log('  ✅ Found counter badge:', b);
      });
    }
    
    // Parse badges đơn (🌸, 🌐, 🧩) - chỉ thêm nếu chưa có trong list
    ['🌸', '🌐', '🧩'].forEach(emoji => {
      // Chỉ thêm nếu:
      // 1. Prefix có emoji này
      // 2. Chưa có badge nào chứa emoji này (tránh duplicate với counter badges)
      if (prefix.includes(emoji) && !badges.some(b => b.includes(emoji))) {
        badges.push(emoji);
        console.log('  ✅ Found single badge:', emoji);
      }
    });
    
    console.log('  📋 Final parsed badges:', badges);
    return badges;
  }

  /**
   * ✅ FIXED: Normalize badges - loại bỏ duplicate và format đúng
   */
  function normalizeBadges(badges) {
    const normalized = [];
    const counts = { '🌸': 0, '🌐': 0, '🧩': 0 };
    
    // Đếm số lượng mỗi loại badge
    for (const badge of badges) {
      for (const emoji of ['🌸', '🌐', '🧩']) {
        if (badge.includes(emoji)) {
          const match = badge.match(/x(\d+)/);
          counts[emoji] += match ? parseInt(match[1], 10) : 1;
        }
      }
    }
    
    // Tạo badges mới với format đúng
    for (const [emoji, count] of Object.entries(counts)) {
      if (count > 0) {
        if (count === 1) {
          normalized.push(emoji);
        } else {
          normalized.push(`x${count}${emoji}`);
        }
      }
    }
    
    console.log('  🔄 Normalized badges:', badges, '→', normalized);
    return normalized;
  }

  // ===============================
  // ⏱️ TÍNH THỜI GIAN MACRO - FIXED VERSION
  // ===============================
  
  function calcActive(times, maxGap = MAX_GAP, checkTime = Date.now()) {
    console.log('🔍 calcActive called');
    console.log('  Timestamps:', times?.length || 0);
    console.log('  Max gap:', formatTime(maxGap));
    console.log('  Check time:', new Date(checkTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
    
    if (!times || times.length === 0) {
      console.log('  ❌ No times provided');
      return 0;
    }
    
    const validTimes = times.filter(t => typeof t === 'number' && !isNaN(t) && t > 0);
    if (validTimes.length === 0) {
      console.log('  ❌ No valid timestamps');
      return 0;
    }
    
    const sorted = [...validTimes].sort((a, b) => a - b);
    
    const firstTime = sorted[0];
    const lastTime = sorted[sorted.length - 1];
    
    console.log('  📊 First webhook:', new Date(firstTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
    console.log('  📊 Last webhook:', new Date(lastTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
    
    const totalSpan = checkTime - firstTime;
    console.log('  📏 Total span:', formatTime(totalSpan));
    
    let totalBreaks = 0;
    let breakCount = 0;
    
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i] - sorted[i - 1];
      if (gap > maxGap) {
        totalBreaks += gap;
        breakCount++;
        const breakStart = new Date(sorted[i - 1]).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        const breakEnd = new Date(sorted[i]).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        console.log(`  ⏸️ Break ${breakCount}: ${formatTime(gap)} (${breakStart} → ${breakEnd})`);
      }
    }
    
    const lastGap = checkTime - lastTime;
    if (lastGap > maxGap) {
      totalBreaks += lastGap;
      breakCount++;
      const stoppedAt = new Date(lastTime).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      console.log(`  ⏸️ Break ${breakCount}: ${formatTime(lastGap)} (stopped at ${stoppedAt})`);
    }
    
    const activeTime = totalSpan - totalBreaks;
    
    console.log('  📊 Total breaks:', formatTime(totalBreaks));
    console.log('  ✅ Active time:', formatTime(activeTime), `(${(activeTime / 3600000).toFixed(2)}h)`);
    
    return Math.max(0, activeTime);
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
  // 🔍 DETECT BIOMES
  // ===============================
  
  function detectBiomeFromMessage(msg) {
    const check = (text) => {
      if (!text) return null;
      const t = text.toUpperCase();
      if (t.includes('DREAMSPACE')) return 'DREAMSPACE';
      if (t.includes('CYBERSPACE')) return 'CYBERSPACE';
      if (t.includes('GLITCH')) return 'GLITCH';
      return null;
    };
    
    if (msg.embeds && msg.embeds.length > 0) {
      for (const e of msg.embeds) {
        const result = check(e.title) || check(e.description);
        if (result) return result;
      }
    }
    
    return check(msg.content);
  }

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
  // 🌈 BIOME HANDLING - FIXED!
  // ===============================
  async function handleBiome(ch, biomeKey) {
    try {
      const d = getData(ch.id);
      const biome = BIOME_MAP[biomeKey];
      if (!biome) return;

      console.log('🌈 handleBiome:', biomeKey);
      console.log('  Current badges:', d.badges);

      // Tìm badge hiện tại của biome này
      const idx = d.badges.findIndex(b => b.includes(biome.badge));
      
      if (idx !== -1) {
        // ✅ FIXED: Đã có badge này, tăng counter
        const currentBadge = d.badges[idx];
        const match = currentBadge.match(/x(\d+)/);
        const currentCount = match ? parseInt(match[1], 10) : 1;
        const newCount = currentCount + 1;
        
        console.log(`  🔄 Badge exists: ${currentBadge} (count: ${currentCount})`);
        console.log(`  ➕ Incrementing to: x${newCount}${biome.badge}`);
        
        d.badges[idx] = `x${newCount}${biome.badge}`;
        
      } else {
        // ✅ FIXED: Chưa có badge này
        if (!d.firstBiome) {
          // Lần đầu tiên vào biome
          console.log('  🌟 First biome ever');
          d.firstBiome = biomeKey;
          d.badges = [biome.badge];
          d.moving = true;
          await ch.setParent(biome.category, { lockPermissions: false });
          await new Promise(r => setTimeout(r, 500));
        } else {
          // Đã có biome khác, thêm badge mới
          console.log('  ➕ Adding new biome badge');
          d.badges.push(biome.badge);
        }
      }
      
      // ✅ Normalize để tránh duplicate
      d.badges = normalizeBadges(d.badges);
      
      console.log('  ✅ Final badges:', d.badges);
      
      await safeRename(ch, d.streak, d.badges);
      await updateRole(ch, true);
      scheduleSave();
      
    } catch (e) {
      console.error('❌ Biome error:', e.message);
      console.error(e.stack);
    }
  }

  // ===============================
  // 📨 WEBHOOK DETECTION
  // ===============================
  client.on('messageCreate', async (msg) => {
    try {
      if (msg.webhookId) {
        console.log('═══════════════════════════════════');
        console.log('🎯 WEBHOOK DETECTED!');
        console.log('  Channel:', msg.channel.name);
        console.log('  Category:', msg.channel.parentId);
        console.log('  Time:', new Date(msg.createdTimestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
        console.log('═══════════════════════════════════');
      }

      if (!msg.webhookId) return;

      const ch = msg.channel;
      
      if (!ch || !ALL_CATS.includes(ch.parentId)) {
        console.log('❌ Not in tracked category');
        return;
      }

      const userId = getUserId(ch.topic);
      if (!userId) {
        console.log('❌ No user ID in topic:', ch.topic);
        return;
      }
      
      console.log('✅ PROCESSING WEBHOOK');

      const now = Date.now();
      const d = getData(ch.id);
      const today = getDate();

      if (d.date !== today) {
        d.times = [];
        d.date = today;
        console.log('  📅 New day detected, reset times');
      }

      const biomeKey = detectBiomeFromMessage(msg);
      if (biomeKey) {
        console.log('🌈 Biome detected from message:', biomeKey);
      }

      if (ch.parentId === CAT.SLEEP || ch.parentId === CAT.EMPTY) {
        console.log('⏰ WAKING UP from', getCatName(ch.parentId));
        
        d.streak = parseStreak(ch.name) || 0;
        d.times = [now];
        d.days = 0;

        if (biomeKey) {
          console.log('→ To BIOME (from message):', biomeKey);
          await handleBiome(ch, biomeKey);
        } else {
          console.log('→ Checking for @everyone messages...');
          const biomeKeys = await detectBiomesFromEveryone(ch);
          
          if (biomeKeys.length > 0) {
            console.log('→ To BIOME (from @everyone):', biomeKeys[0]);
            
            // ✅ FIXED: Xử lý biome đầu tiên
            await handleBiome(ch, biomeKeys[0]);
            
            // ✅ FIXED: Xử lý các biomes còn lại (nếu có)
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

      // ✅ Channel đã active, check biome mới
      if (biomeKey) {
        await handleBiome(ch, biomeKey);
      }

      d.times.push(now);
      console.log('  ⏱️ Timestamp saved. Total times:', d.times.length);
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
      console.log('═══════════════════════════════════');
      console.log('🔔 DAILY CHECK - 13:00 VN');
      const checkTime = Date.now();
      console.log('⏰ Check time:', new Date(checkTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
      console.log('⚙️ Max gap setting:', formatTime(MAX_GAP));
      console.log('═══════════════════════════════════');

      const guild = client.guilds.cache.first();
      if (!guild) return;

      const report = await guild.channels.fetch(REPORT_CHANNEL).catch(() => null);
      
      const channels = guild.channels.cache.filter(c => 
        c.type === 0 && STREAK_CATS.includes(c.parentId)
      );

      console.log(`📊 Scanning ${channels.size} channels...`);

      const results = { above18h: [], above12h: [], above6h: [] };

      for (const [, ch] of channels) {
        try {
          const d = getData(ch.id);
          
          console.log(`\n🔍 Processing: ${ch.name}`);
          console.log(`  📊 Saved timestamps: ${d.times?.length || 0}`);
          console.log(`  🎨 Current badges:`, d.badges);
          
          if (!d.times || !Array.isArray(d.times) || d.times.length === 0) {
            console.log(`  ⚠️ No timestamps saved today → 0 hours`);
            
            d.days++;
            console.log(`  ⚠️ WARNING: Day ${d.days}/3 (0h < 6h)`);
            
            if (d.days >= 3) {
              const old = d.streak;
              d.streak = 0;
              d.badges = [];
              d.firstBiome = null;
              d.moving = true;
              console.log(`  😴 MOVING TO DORMANT (lost ${old}🔥)`);
              await ch.setParent(CAT.SLEEP, { lockPermissions: false });
              await new Promise(r => setTimeout(r, 500));
              await updateRole(ch, false);
              await safeRename(ch, 0, []);
              d.days = 0;
            }
            
            d.times = [];
            d.date = getDate();
            continue;
          }
          
          const active = calcActive(d.times, MAX_GAP, checkTime);
          const hours = active / 3600000;
          
          console.log(`  ⏱️ Active time: ${formatTime(active)} (${hours.toFixed(2)}h)`);
          console.log(`  📊 Current streak: ${d.streak}🔥`);
          console.log(`  ⚠️ Warning days: ${d.days}/3`);

          if (hours >= 18) results.above18h.push({ ch, active });
          if (hours >= 12) results.above12h.push({ ch, active });
          if (hours >= 6) results.above6h.push({ ch, active });

          if (hours >= 6) {
            d.streak++;
            d.days = 0;
            console.log(`  ✅ STREAK SAVED: ${d.streak - 1}🔥 → ${d.streak}🔥`);
            
            // ✅ Normalize badges trước khi rename
            d.badges = normalizeBadges(d.badges);
            await safeRename(ch, d.streak, d.badges);
          } else {
            d.days++;
            console.log(`  ⚠️ WARNING: Day ${d.days}/3 (${hours.toFixed(2)}h < 6h)`);
            
            if (d.days >= 3) {
              const old = d.streak;
              d.streak = 0;
              d.badges = [];
              d.firstBiome = null;
              d.moving = true;
              console.log(`  😴 MOVING TO DORMANT (lost ${old}🔥)`);
              await ch.setParent(CAT.SLEEP, { lockPermissions: false });
              await new Promise(r => setTimeout(r, 500));
              await updateRole(ch, false);
              await safeRename(ch, 0, []);
              d.days = 0;
            }
          }

          d.times = [];
          d.date = getDate();
          
        } catch (err) {
          console.error(`  ❌ Error processing ${ch.name}:`, err.message);
          console.error(err.stack);
        }
      }

      scheduleSave();

      console.log('\n═══════════════════════════════════');
      console.log('📊 DAILY CHECK SUMMARY:');
      console.log(`  🏆 18+ hours: ${results.above18h.length} channels`);
      console.log(`  ⭐ 12+ hours: ${results.above12h.length} channels`);
      console.log(`  ✨ 6+ hours: ${results.above6h.length} channels`);
      console.log('═══════════════════════════════════');

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
          console.log('✅ Report sent to channel');
        } else {
          await report.send(`📊 **Daily Report** - ${date}\n⚠️ No channels reached 6+ hours`);
          console.log('⚠️ No channels reached 6+ hours');
        }
      }

      console.log('✅ Daily check completed\n');

    } catch (e) {
      console.error('❌ Daily check error:', e.message);
      console.error(e.stack);
    } finally {
      scheduleDailyCheck();
    }
  }

  function scheduleDailyCheck() {
    const next = getNext13H();
    const timeUntil = next - new Date();
    console.log('⏰ Next check scheduled:');
    console.log('  Time:', next.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
    console.log('  In:', formatTime(timeUntil));
    setTimeout(dailyCheck, timeUntil);
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
            
            // ✅ Parse và normalize badges từ tên
            const parsedBadges = parseBadges(ch.name);
            if (parsedBadges.length > 0) {
              d.badges = normalizeBadges(parsedBadges);
            }
            
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
          
          if (streak >= 0 && streak !== d.streak) {
            d.streak = streak;
          }
          
          if (badges.length > 0) {
            d.badges = normalizeBadges(badges);
          }
          
          console.log('  📝 Name changed:', old.name, '→', ch.name);
          console.log('  📊 Parsed - Streak:', d.streak, 'Badges:', d.badges);
          
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
      console.log('🔍 Scanning all channels...');
      
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
          
          if (badges.length > 0) {
            d.badges = normalizeBadges(badges);
          }
          
          if (d.date !== today) d.times = [];
          
          if (STREAK_CATS.includes(ch.parentId)) await updateRole(ch, true);
          else if (ch.parentId === CAT.SLEEP) await updateRole(ch, false);
          
          // ✅ Sync lại tên với data đã normalize
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
      console.log('═══════════════════════════════════');
      console.log('🤖 BOT READY!');
      console.log('⚙️ Configuration:');
      console.log('  Max gap:', formatTime(MAX_GAP), '(20 minutes)');
      console.log('  Timezone: Asia/Ho_Chi_Minh (UTC+7)');
      console.log('  Daily check: 13:00 VN time');
      console.log('═══════════════════════════════════');
      
      const guild = client.guilds.cache.first();
      if (guild) {
        await scanAll(guild);
        scheduleDailyCheck();
      }
      console.log('🚀 All systems operational!\n');
    } catch (e) {
      console.error('❌ Ready error:', e.message);
    }
  });

  // ===============================
  // 🧪 COMMANDS
  // ===============================
  client.on('messageCreate', async (msg) => {
    if (msg.content === '!testdaily') {
      if (!msg.member.permissions.has('Administrator')) {
        await msg.reply('❌ Admin only!');
        return;
      }
      await msg.reply('🔄 Running daily check manually...');
      await dailyCheck();
      return;
    }

    if (msg.content === '!info') {
      try {
        const ch = msg.channel;
        if (!ALL_CATS.includes(ch.parentId)) {
          await msg.reply('⚠️ Channel này không được track!');
          return;
        }

        const d = getData(ch.id);
        const now = Date.now();

        const active = calcActive(d.times || [], MAX_GAP, now);
        const hours = active / 3600000;

        const embed = new EmbedBuilder()
          .setTitle(`📊 Channel Info: ${ch.name}`)
          .setColor(0x00AE86)
          .addFields(
            { name: '🔥 Current Streak', value: `${d.streak}`, inline: true },
            { name: '📅 Date', value: d.date || 'N/A', inline: true },
            { name: '⚠️ Warning Days', value: `${d.days}/3`, inline: true },
            { name: '📍 Category', value: getCatName(ch.parentId), inline: true },
            { name: '🎨 Badges', value: d.badges.length > 0 ? d.badges.join(' ') : 'None', inline: true },
            { name: '🌟 First Biome', value: d.firstBiome || 'None', inline: true },
            { name: '📊 Today\'s Data', value: '───────────────', inline: false },
            { name: '⏱️ Webhooks Received', value: `${(d.times || []).length} messages`, inline: true },
            { name: '⏰ Active Time (Current)', value: `${formatTime(active)} (${hours.toFixed(2)}h)`, inline: true },
            { name: '✅ Streak Status', value: hours >= 6 ? '✅ Will save' : `⚠️ Need ${(6 - hours).toFixed(1)}h more`, inline: true },
            { name: '⚙️ Settings', value: `Max gap: ${formatTime(MAX_GAP)}`, inline: false }
          )
          .setFooter({ text: 'Thời gian tính từ webhook đầu tiên đến hiện tại (trừ breaks)' })
          .setTimestamp();

        if (d.times && d.times.length > 0) {
          const sorted = [...d.times].sort((a, b) => a - b);
          const first = new Date(sorted[0]).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
          const last = new Date(sorted[sorted.length - 1]).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
          const current = new Date(now).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
          
          embed.addFields({
            name: '📋 Timeline',
            value: `First webhook: ${first}\nLast webhook: ${last}\nCurrent time: ${current}\nTotal span: ${formatTime(now - sorted[0])}`,
            inline: false
          });
        }

        await msg.reply({ embeds: [embed] });

      } catch (e) {
        console.error('❌ !info error:', e);
        await msg.reply('❌ Error: ' + e.message);
      }
      return;
    }

    if (msg.content === '!stats') {
      try {
        const guild = msg.guild;
        const channels = guild.channels.cache.filter(c => 
          c.type === 0 && STREAK_CATS.includes(c.parentId)
        );

        const now = Date.now();
        let text = '```\n📊 ACTIVE CHANNELS STATS\n';
        text += `⚙️ Max gap: ${formatTime(MAX_GAP)}\n\n`;
        
        for (const [, ch] of channels) {
          const d = getData(ch.id);
          const active = calcActive(d.times || [], MAX_GAP, now);
          const hours = active / 3600000;
          
          text += `${ch.name}\n`;
          text += `  Streak: ${d.streak}🔥 | Now: ${hours.toFixed(1)}h`;
          text += ` | Webhooks: ${(d.times || []).length}`;
          text += ` | Warns: ${d.days}/3`;
          text += ` | Badges: ${d.badges.join(' ') || 'none'}\n\n`;
        }

        text += '```';
        
        await msg.reply(text);

      } catch (e) {
        await msg.reply('❌ Error: ' + e.message);
      }
      return;
    }

    if (msg.content.startsWith('!reset')) {
      if (!msg.member.permissions.has('Administrator')) {
        await msg.reply('❌ Admin only!');
        return;
      }

      const ch = msg.channel;
      if (!ALL_CATS.includes(ch.parentId)) {
        await msg.reply('⚠️ Channel này không được track!');
        return;
      }

      const d = getData(ch.id);
      d.times = [];
      d.days = 0;
      d.date = getDate();
      scheduleSave();

      await msg.reply('✅ Reset timestamps và warning days!');
      return;
    }

    // ✅ NEW: Fix badges command
    if (msg.content === '!fixbadges') {
      if (!msg.member.permissions.has('Administrator')) {
        await msg.reply('❌ Admin only!');
        return;
      }

      const ch = msg.channel;
      if (!ALL_CATS.includes(ch.parentId)) {
        await msg.reply('⚠️ Channel này không được track!');
        return;
      }

      const d = getData(ch.id);
      const oldBadges = [...d.badges];
      d.badges = normalizeBadges(d.badges);
      
      await safeRename(ch, d.streak, d.badges);
      scheduleSave();

      await msg.reply(`✅ Fixed badges!\nOld: ${oldBadges.join(' ') || 'none'}\nNew: ${d.badges.join(' ') || 'none'}`);
      return;
    }

    if (msg.content === '!help') {
      const helpEmbed = new EmbedBuilder()
        .setTitle('📚 Bot Commands')
        .setColor(0x00AE86)
        .addFields(
          { name: '!info', value: 'Xem thông tin chi tiết channel hiện tại', inline: false },
          { name: '!stats', value: 'Xem tổng quan tất cả channels đang active', inline: false },
          { name: '!reset', value: '⚠️ [Admin] Reset timestamps và warnings của channel', inline: false },
          { name: '!fixbadges', value: '⚠️ [Admin] Fix duplicate badges của channel', inline: false },
          { name: '!testdaily', value: '⚠️ [Admin] Chạy daily check thủ công', inline: false },
          { name: '!help', value: 'Hiển thị hướng dẫn này', inline: false }
        )
        .addFields({
          name: '⚙️ Cấu hình hiện tại',
          value: `• Max gap: ${formatTime(MAX_GAP)}\n• Daily check: 13:00 VN\n• Minimum: 6h để save streak`,
          inline: false
        })
        .setFooter({ text: 'Macro Tracker Bot v2.1 - Fixed Badges' })
        .setTimestamp();
      
      await msg.reply({ embeds: [helpEmbed] });
      return;
    }
  });
};
