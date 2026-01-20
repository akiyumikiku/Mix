// events/channelHandler.js
const { renameChannelByCategory } = require(’../functions/rename’);
const { EmbedBuilder } = require(‘discord.js’);
const fs = require(‘fs’).promises;
const fsSync = require(‘fs’);
const path = require(‘path’);

const CATEGORY_SLEEP = ‘1427958263281881088’;
const CATEGORY_ACTIVE = ‘1411034825699233943’;
const CATEGORY_CYBER = ‘1446077580615880735’;
const CATEGORY_DREAM = ‘1445997821336748155’;
const CATEGORY_GLITCH = ‘1445997659948060712’;
const MACRO_ROLE = ‘1411991634194989096’;
const REPORT_CHANNEL_ID = ‘1438039815919632394’;
const STREAK_FILE = path.join(__dirname, ‘../data/streaks.json’);

const STREAK_CATEGORIES = [CATEGORY_ACTIVE, CATEGORY_CYBER, CATEGORY_DREAM, CATEGORY_GLITCH];
const ALL_TRACKED_CATEGORIES = […STREAK_CATEGORIES, CATEGORY_SLEEP];

module.exports = (client) => {
const channelData = new Map();
let saveTimer = null;
let isSaving = false;

// === DATA PERSISTENCE ===
function loadData() {
try {
if (fsSync.existsSync(STREAK_FILE)) {
const data = JSON.parse(fsSync.readFileSync(STREAK_FILE, ‘utf8’));
Object.entries(data).forEach(([channelId, channelInfo]) => {
channelData.set(channelId, channelInfo);
});
console.log(‘📂 Loaded ’ + channelData.size + ’ channel records’);
}
} catch (err) {
console.error(‘❌ Error loading data:’, err.message);
}
}

async function saveData() {
if (isSaving) return;

```
try {
  isSaving = true;
  const dir = path.dirname(STREAK_FILE);
  
  if (!fsSync.existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
  
  const data = Object.fromEntries(channelData);
  await fs.writeFile(STREAK_FILE, JSON.stringify(data, null, 2), 'utf8');
} catch (err) {
  console.error('❌ Error saving data:', err.message);
} finally {
  isSaving = false;
}
```

}

function scheduleSave() {
if (saveTimer) clearTimeout(saveTimer);
saveTimer = setTimeout(() => saveData(), 2000);
}

loadData();

// === PARSING HELPERS ===
function parseStreakFromName(channelName) {
const match = channelName.match(/〔(\d+)🔥〕/);
return match ? parseInt(match[1], 10) : 0;
}

function parseSpecialBadgesFromName(channelName) {
const badges = [];
const patterns = [
{ regex: /x(\d+)🌸/, single: ‘🌸’ },
{ regex: /x(\d+)🌐/, single: ‘🌐’ },
{ regex: /x(\d+)🧩/, single: ‘🧩’ }
];

```
patterns.forEach(({ regex, single }) => {
  const match = channelName.match(regex);
  if (match) {
    badges.push('x' + match[1] + single);
  } else if (channelName.includes(single) && !badges.some(b => b.includes(single))) {
    badges.push(single);
  }
});

return badges;
```

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
let initialStreak = 0;
let initialBadges = [];

```
  if (channel?.name) {
    initialStreak = parseStreakFromName(channel.name);
    initialBadges = parseSpecialBadgesFromName(channel.name);
  }

  channelData.set(channelId, {
    streak: initialStreak,
    firstWebhook: null,
    lastWebhook: null,
    daysWithoutActivity: 0,
    lastCheckDate: null,
    specialBadges: initialBadges,
    isAutoMoving: false
  });
}
return channelData.get(channelId);
```

}

// === TIME HELPERS ===
function getCurrentDate() {
return new Date().toISOString().split(‘T’)[0];
}

function getNext13HVietnam() {
const now = new Date();
const next13H = new Date(Date.UTC(
now.getUTCFullYear(),
now.getUTCMonth(),
now.getUTCDate(),
6, 0, 0, 0
));

```
if (now >= next13H) {
  next13H.setUTCDate(next13H.getUTCDate() + 1);
}

return next13H;
```

}

function formatActiveTime(milliseconds) {
const hours = Math.floor(milliseconds / (1000 * 60 * 60));
const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
return hours + ’h ’ + minutes + ‘m’;
}

// === BIOME DETECTION ===
function detectSpecialBiome(embed) {
if (!embed?.title) return null;
const title = embed.title.toUpperCase();

```
if (title.includes('DREAMSPACE')) return { type: 'DREAMSPACE', badge: '🌸' };
if (title.includes('CYBERSPACE')) return { type: 'CYBERSPACE', badge: '🌐' };
if (title.includes('GLITCH')) return { type: 'GLITCHED', badge: '🧩' };

return null;
```

}

function getCategoryDisplayName(categoryId) {
const names = {
[CATEGORY_ACTIVE]: ‘Active’,
[CATEGORY_CYBER]: ‘Cyberspace’,
[CATEGORY_DREAM]: ‘Dreamspace’,
[CATEGORY_GLITCH]: ‘Glitch’,
[CATEGORY_SLEEP]: ‘Dormant’
};
return names[categoryId] || ‘Unknown’;
}

// === ROLE MANAGEMENT ===
async function updateRoleByCategory(channel, addRole) {
try {
const userId = extractUserId(channel.topic);
if (!userId) {
console.log(’⚠️ Invalid topic format: ’ + (channel.topic || ‘empty’));
return;
}

```
  const member = await channel.guild.members.fetch(userId).catch(() => null);
  if (!member) {
    console.log('⚠️ Member not found: ' + userId);
    return;
  }

  const hasRole = member.roles.cache.has(MACRO_ROLE);

  if (addRole && !hasRole) {
    await member.roles.add(MACRO_ROLE);
    console.log('✅ Added AUTO role to ' + member.user.tag);
  } else if (!addRole && hasRole) {
    await member.roles.remove(MACRO_ROLE);
    console.log('🧹 Removed AUTO role from ' + member.user.tag);
  }
} catch (err) {
  console.error('❌ Role update error for ' + channel.name + ':', err.message);
}
```

}

// === SPECIAL CATEGORY LOGIC ===
async function moveToSpecialCategory(channel, biomeType, badge) {
try {
const data = getData(channel.id, channel);

```
  const categoryMap = {
    'DREAMSPACE': CATEGORY_DREAM,
    'CYBERSPACE': CATEGORY_CYBER,
    'GLITCHED': CATEGORY_GLITCH
  };

  const targetCategory = categoryMap[biomeType];
  if (!targetCategory) return;

  const existingBadge = data.specialBadges.find(b => b.includes(badge));
  
  if (existingBadge) {
    const match = existingBadge.match(/x(\d+)/);
    const currentCount = match ? parseInt(match[1], 10) : 1;
    const newCount = currentCount + 1;
    
    data.specialBadges = data.specialBadges.filter(b => !b.includes(badge));
    data.specialBadges.unshift('x' + newCount + badge);
    
    console.log('🔢 Increased ' + badge + ' to x' + newCount + ': ' + channel.name);
  } else {
    if (data.specialBadges.length > 0 && channel.parentId !== targetCategory) {
      data.specialBadges.push(badge);
      console.log('🎨 Added badge ' + badge + ' (keeping category): ' + channel.name);
    } else if (channel.parentId !== targetCategory) {
      data.specialBadges = [badge];
      
      data.isAutoMoving = true;
      await channel.setParent(targetCategory, { lockPermissions: false });
      await new Promise(r => setTimeout(r, 500));
      
      console.log('🚀 Moved to ' + biomeType + ': ' + channel.name);
    } else {
      data.specialBadges = [badge];
      console.log('🎨 Added badge ' + badge + ' (already in category): ' + channel.name);
    }
  }

  await updateRoleByCategory(channel, true);
  await renameChannelByCategory(channel, data.streak, data.specialBadges);
  scheduleSave();

  console.log('✅ Special category: ' + channel.name + ' | Badges: ' + data.specialBadges.join(''));
} catch (err) {
  console.error('❌ moveToSpecialCategory error:', err.message);
}
```

}

// === NOTIFICATIONS ===
async function sendNotify(channel, type, extraData = {}) {
try {
const userId = extractUserId(channel.topic);
if (!userId) return;

```
  const messages = {
    sleep: '<@' + userId + '>\n💤 Your macro channel has been moved to the **DORMANT** category due to 3 consecutive days of inactivity.',
    active: '<@' + userId + '>\n✨ Your macro channel has been **reactivated** and moved to an active category. Welcome back!',
    streak_warning: '<@' + userId + '> ⚠️ **Activity Warning!**\nYou only had **' + extraData.activeTime + '** of activity today (need 6h+ to maintain streak).\nCurrent streak: **' + extraData.streak + '** 🔥\n\n📉 **Day ' + extraData.daysCount + '/3** without 6h+ activity',
    streak_lost_final: '<@' + userId + '> 💔 **Streak Lost!**\nYou only had **' + extraData.activeTime + '** of activity today (need 6h+).\nYour streak has been reset: **' + extraData.oldStreak + ' → 0** 🔥',
    streak_saved: '<@' + userId + '> ✅ **Streak Saved!**\nYou reached 6+ hours of activity today!\nCurrent streak: **' + extraData.streak + '** 🔥'
  };

  const message = messages[type];
  if (message) {
    await channel.send(message);
  }
} catch (err) {
  console.error('❌ Error sending notify:', err.message);
}
```

}

// === DAILY CHECK ===
async function dailyCheck() {
try {
console.log(‘🕐 Running daily check at 13:00 Vietnam time…’);

```
  const guild = client.guilds.cache.first();
  if (!guild) return;

  const reportChannel = await guild.channels.fetch(REPORT_CHANNEL_ID).catch(() => null);
  if (!reportChannel) {
    console.error('❌ Report channel not found');
    return;
  }

  const channels = guild.channels.cache.filter(
    ch => ch.type === 0 && STREAK_CATEGORIES.includes(ch.parentId)
  );

  const results = {
    above18h: [],
    above12h: [],
    above6h: []
  };

  for (const [, channel] of channels) {
    const data = getData(channel.id, channel);

    let activeTime = 0;
    if (data.firstWebhook && data.lastWebhook) {
      activeTime = data.lastWebhook - data.firstWebhook;
    }

    const activeHours = activeTime / (1000 * 60 * 60);

    if (activeHours >= 18) results.above18h.push({ channel, activeTime, streak: data.streak });
    if (activeHours >= 12) results.above12h.push({ channel, activeTime, streak: data.streak });
    if (activeHours >= 6) results.above6h.push({ channel, activeTime, streak: data.streak });

    if (activeHours >= 6) {
      data.streak++;
      data.daysWithoutActivity = 0;
      await renameChannelByCategory(channel, data.streak, data.specialBadges);
      console.log('🔥 Streak++: ' + channel.name + ' = ' + data.streak);
      await sendNotify(channel, 'streak_saved', { streak: data.streak });
    } else {
      const oldStreak = data.streak;
      data.daysWithoutActivity++;

      if (data.daysWithoutActivity >= 3) {
        data.streak = 0;
        data.specialBadges = [];
        data.isAutoMoving = true;
        
        await channel.setParent(CATEGORY_SLEEP, { lockPermissions: false });
        await new Promise(r => setTimeout(r, 500));
        
        await updateRoleByCategory(channel, false);
        data.daysWithoutActivity = 0;
        await renameChannelByCategory(channel, 0, []);
        
        await sendNotify(channel, 'streak_lost_final', {
          activeTime: formatActiveTime(activeTime),
          oldStreak: oldStreak
        });
        await sendNotify(channel, 'sleep');
        
        console.log('📦 → DORMANT: ' + channel.name + ' (streak ' + oldStreak + ' → 0)');
      } else {
        await sendNotify(channel, 'streak_warning', {
          activeTime: formatActiveTime(activeTime),
          streak: data.streak,
          daysCount: data.daysWithoutActivity
        });
        console.log('⚠️ Warning: ' + channel.name + ' - Day ' + data.daysWithoutActivity + '/3');
      }
    }

    data.firstWebhook = null;
    data.lastWebhook = null;
    data.lastCheckDate = getCurrentDate();
  }

  scheduleSave();

  // Build report
  const embeds = [];
  const dateStr = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  const embedConfigs = [
    { key: 'above18h', title: '🏆 18+ Hours Channels', color: 0xFFD700 },
    { key: 'above12h', title: '⭐ 12+ Hours Channels', color: 0xC0C0C0 },
    { key: 'above6h', title: '✨ 6+ Hours Channels', color: 0xCD7F32 }
  ];

  embedConfigs.forEach(config => {
    if (results[config.key].length > 0) {
      const description = results[config.key]
        .map(r => '**' + r.channel.name + '** - ' + getCategoryDisplayName(r.channel.parentId) + ' - ' + formatActiveTime(r.activeTime))
        .join('\n');

      embeds.push(new EmbedBuilder()
        .setTitle(config.title)
        .setColor(config.color)
        .setDescription(description)
        .setTimestamp()
      );
    }
  });

  if (embeds.length > 0) {
    await reportChannel.send({
      content: '📊 **Daily Activity Report** - ' + dateStr,
      embeds: embeds
    });
    console.log('✅ Daily report sent');
  } else {
    await reportChannel.send({
      content: '📊 **Daily Activity Report** - ' + dateStr + '\nNo channels with 6+ hours activity today'
    });
  }
} catch (err) {
  console.error('❌ Daily check error:', err.message);
} finally {
  scheduleDailyCheck();
}
```

}

function scheduleDailyCheck() {
const next13H = getNext13HVietnam();
const timeUntil = next13H - new Date();
console.log(’⏰ Next daily check: ’ + next13H.toISOString());
setTimeout(() => dailyCheck(), timeUntil);
}

// === STARTUP SCAN ===
async function scanAllChannelsOnStartup(guild) {
try {
console.log(‘🔍 Scanning all tracked channels on startup…’);

```
  const channels = guild.channels.cache.filter(
    ch => ch.type === 0 && ALL_TRACKED_CATEGORIES.includes(ch.parentId)
  );

  const today = getCurrentDate();
  let syncedCount = 0;

  for (const [, channel] of channels) {
    try {
      const streakFromName = parseStreakFromName(channel.name);
      const badgesFromName = parseSpecialBadgesFromName(channel.name);
      const data = getData(channel.id, channel);

      // Sync streak
      if (streakFromName !== data.streak && streakFromName >= 0) {
        data.streak = streakFromName;
        console.log('🔄 Synced streak: ' + channel.name + ' = ' + streakFromName);
      }

      // Sync badges
      if (badgesFromName.length > 0) {
        data.specialBadges = badgesFromName;
        console.log('🎨 Synced badges: ' + channel.name + ' = ' + badgesFromName.join(''));
      }

      // Reset daily data
      if (data.lastCheckDate !== today) {
        data.firstWebhook = null;
        data.lastWebhook = null;
      }

      // Sync role based on category
      if (STREAK_CATEGORIES.includes(channel.parentId)) {
        await updateRoleByCategory(channel, true);
      } else if (channel.parentId === CATEGORY_SLEEP) {
        await updateRoleByCategory(channel, false);
      }

      // Rename to match current category
      await renameChannelByCategory(channel, data.streak, data.specialBadges);
      syncedCount++;

    } catch (err) {
      console.error('❌ Error syncing channel ' + channel.name + ':', err.message);
    }
  }

  scheduleSave();
  console.log('✅ Scanned and synced ' + syncedCount + ' channels');

} catch (err) {
  console.error('❌ Startup scan error:', err.message);
}
```

}

// === EVENT HANDLERS ===

client.once(‘ready’, async () => {
try {
const guild = client.guilds.cache.first();
if (!guild) {
console.error(‘❌ No guild found’);
return;
}

```
  console.log('🚀 Bot ready! Starting channel scan...');
  
  await scanAllChannelsOnStartup(guild);
  scheduleDailyCheck();

} catch (err) {
  console.error('❌ Error on ready:', err.message);
}
```

});

client.on(‘messageCreate’, async (msg) => {
try {
if (!msg.webhookId) return;

```
  const channel = msg.channel;
  if (!channel?.parentId) return;
  if (!ALL_TRACKED_CATEGORIES.includes(channel.parentId)) return;

  const userId = extractUserId(channel.topic);
  if (!userId || msg.author.id !== userId) return;

  const now = Date.now();
  const data = getData(channel.id, channel);

  // Check for special biomes
  if (msg.embeds?.length > 0) {
    for (const embed of msg.embeds) {
      const biome = detectSpecialBiome(embed);
      if (biome) {
        await moveToSpecialCategory(channel, biome.type, biome.badge);
      }
    }
  }

  // Handle reactivation from sleep
  if (channel.parentId === CATEGORY_SLEEP) {
    const oldStreak = parseStreakFromName(channel.name);

    data.streak = oldStreak > 0 ? oldStreak : 0;
    data.firstWebhook = now;
    data.lastWebhook = now;
    data.daysWithoutActivity = 0;
    data.isAutoMoving = true;

    await channel.setParent(CATEGORY_ACTIVE, { lockPermissions: false });
    await new Promise(r => setTimeout(r, 500));

    await updateRoleByCategory(channel, true);
    await renameChannelByCategory(channel, data.streak, data.specialBadges);
    await sendNotify(channel, 'active');
    scheduleSave();

    console.log('🔄 Reactivated: ' + channel.name + ' | Streak: ' + data.streak);
    return;
  }

  // Track activity time
  if (!data.firstWebhook) {
    data.firstWebhook = now;
    console.log('🎯 First webhook: ' + channel.name);
  }

  data.lastWebhook = now;
  scheduleSave();

} catch (err) {
  console.error('❌ messageCreate error:', err.message);
}
```

});

client.on(‘channelCreate’, async (channel) => {
try {
if (channel.type !== 0) return;
if (!ALL_TRACKED_CATEGORIES.includes(channel.parentId)) return;

```
  console.log('🆕 Channel created: ' + channel.name + ' in ' + getCategoryDisplayName(channel.parentId));

  // Wait for topic to be set
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 500));
    await channel.fetch();
    if (channel.topic) break;
  }

  if (!channel.topic) {
    console.log('⚠️ Topic not set yet: ' + channel.name);
    return;
  }

  console.log('✅ Topic: ' + channel.topic);

  const data = getData(channel.id, channel);
  data.streak = 0;
  data.specialBadges = [];

  if (channel.parentId === CATEGORY_SLEEP) {
    await updateRoleByCategory(channel, false);
    await renameChannelByCategory(channel, 0, []);
    console.log('💤 Created in DORMANT');
  } else if (STREAK_CATEGORIES.includes(channel.parentId)) {
    await updateRoleByCategory(channel, true);
    await renameChannelByCategory(channel, 0, []);
    console.log('✨ Created in ' + getCategoryDisplayName(channel.parentId));
  }

  scheduleSave();
} catch (err) {
  console.error('❌ channelCreate error:', err.message);
}
```

});

client.on(‘channelUpdate’, async (oldCh, newCh) => {
try {
if (!newCh || newCh.type !== 0) return;
if (!ALL_TRACKED_CATEGORIES.includes(newCh.parentId) &&
!ALL_TRACKED_CATEGORIES.includes(oldCh.parentId)) return;

```
  // Category changed
  if (oldCh.parentId !== newCh.parentId) {
    console.log('🔄 Category change: ' + newCh.name);
    console.log('   ' + getCategoryDisplayName(oldCh.parentId) + ' → ' + getCategoryDisplayName(newCh.parentId));

    const data = getData(newCh.id, newCh);

    // Skip auto-moves
    if (data.isAutoMoving) {
      data.isAutoMoving = false;
      scheduleSave();
      console.log('⏭️ Skipped (auto-move)');
      return;
    }

    // Wait for any updates
    await new Promise(r => setTimeout(r, 500));
    await newCh.fetch();

    if (!newCh.topic) {
      console.log('⚠️ No topic, skipping rename');
      return;
    }

    if (STREAK_CATEGORIES.includes(newCh.parentId)) {
      await updateRoleByCategory(newCh, true);
      data.daysWithoutActivity = 0;
      await renameChannelByCategory(newCh, data.streak, data.specialBadges);
      await sendNotify(newCh, 'active');
      console.log('✅ → Active category');
    } else if (newCh.parentId === CATEGORY_SLEEP) {
      await updateRoleByCategory(newCh, false);
      data.streak = 0;
      data.daysWithoutActivity = 0;
      data.firstWebhook = null;
      data.lastWebhook = null;
      data.specialBadges = [];
      await renameChannelByCategory(newCh, 0, []);
      await sendNotify(newCh, 'sleep');
      console.log('✅ → Dormant');
    }

    scheduleSave();
  }

  // Name changed - sync data
  if (oldCh.name !== newCh.name) {
    const newStreak = parseStreakFromName(newCh.name);
    const newBadges = parseSpecialBadgesFromName(newCh.name);
    const data = getData(newCh.id, newCh);

    if (newStreak !== data.streak && newStreak >= 0) {
      data.streak = newStreak;
      console.log('🔄 Name changed, synced streak: ' + newCh.name + ' = ' + newStreak);
    }

    if (newBadges.length > 0 && JSON.stringify(newBadges) !== JSON.stringify(data.specialBadges)) {
      data.specialBadges = newBadges;
      console.log('🎨 Name changed, synced badges: ' + newBadges.join(''));
    }

    scheduleSave();
  }

} catch (err) {
  console.error('❌ channelUpdate error:', err.message);
}
```

});

client.on(‘channelDelete’, (channel) => {
if (channelData.has(channel.id)) {
channelData.delete(channel.id);
scheduleSave();
console.log(’🗑️ Cleaned up: ’ + channel.name);
}
});
};
