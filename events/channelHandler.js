// events/channelHandler.js
const { renameChannelByCategory } = require(’../functions/rename’);
const { EmbedBuilder } = require(‘discord.js’);
const fs = require(‘fs’);
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

module.exports = (client) => {
const channelData = new Map();

function loadData() {
try {
if (fs.existsSync(STREAK_FILE)) {
const data = JSON.parse(fs.readFileSync(STREAK_FILE, ‘utf8’));
Object.entries(data).forEach(([channelId, channelInfo]) => {
channelData.set(channelId, channelInfo);
});
console.log(‘📂 Loaded ’ + channelData.size + ’ channel records’);
}
} catch (err) {
console.error(‘❌ Error loading data:’, err);
}
}

function saveData() {
try {
const dir = path.dirname(STREAK_FILE);
if (!fs.existsSync(dir)) {
fs.mkdirSync(dir, { recursive: true });
}
const data = {};
channelData.forEach((value, key) => {
data[key] = value;
});
fs.writeFileSync(STREAK_FILE, JSON.stringify(data, null, 2), ‘utf8’);
} catch (err) {
console.error(‘❌ Error saving data:’, err);
}
}

loadData();

let saveTimer = null;
function scheduleSave() {
if (saveTimer) clearTimeout(saveTimer);
saveTimer = setTimeout(saveData, 2000);
}

function parseStreakFromName(channelName) {
const match = channelName.match(/〔(\d+)🔥〕/);
return match ? parseInt(match[1], 10) : 0;
}

function parseSpecialBadgesFromName(channelName) {
const badges = [];

```
const x2Dream = channelName.match(/x(\d+)🌸/);
const x2Cyber = channelName.match(/x(\d+)🌐/);
const x2Glitch = channelName.match(/x(\d+)🧩/);

if (x2Dream) {
  badges.push('x' + x2Dream[1] + '🌸');
} else if (channelName.includes('🌸')) {
  badges.push('🌸');
}

if (x2Cyber) {
  badges.push('x' + x2Cyber[1] + '🌐');
} else if (channelName.includes('🌐')) {
  badges.push('🌐');
}

if (x2Glitch) {
  badges.push('x' + x2Glitch[1] + '🧩');
} else if (channelName.includes('🧩')) {
  badges.push('🧩');
}

return badges;
```

}

function getData(channelId, channel = null) {
if (!channelData.has(channelId)) {
let initialStreak = 0;
let initialBadges = [];

```
  if (channel && channel.name) {
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
  });
}
return channelData.get(channelId);
```

}

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

function detectSpecialBiome(embed) {
if (!embed || !embed.title) return null;

```
const title = embed.title.toUpperCase();

if (title.includes('DREAMSPACE')) return { type: 'DREAMSPACE', badge: '🌸' };
if (title.includes('CYBERSPACE')) return { type: 'CYBERSPACE', badge: '🌐' };
if (title.includes('GLITCH')) return { type: 'GLITCHED', badge: '🧩' };

return null;
```

}

async function updateRoleByCategory(channel, addRole) {
try {
const topic = channel.topic || ‘’;
const userId = topic.match(/\d{17,20}/)?.[0];
if (!userId) return;

```
  const member = await channel.guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  if (addRole) {
    if (!member.roles.cache.has(MACRO_ROLE)) {
      await member.roles.add(MACRO_ROLE).catch(() => {});
      console.log('✅ Added AUTO role to ' + member.user.tag);
    }
  } else {
    if (member.roles.cache.has(MACRO_ROLE)) {
      await member.roles.remove(MACRO_ROLE).catch(() => {});
      console.log('🧹 Removed AUTO role from ' + member.user.tag);
    }
  }
} catch (err) {
  console.error('❌ Role update error:', err);
}
```

}

async function moveToSpecialCategory(channel, biomeType, badge) {
try {
const data = getData(channel.id, channel);
let targetCategory;

```
  if (biomeType === 'DREAMSPACE') {
    targetCategory = CATEGORY_DREAM;
  } else if (biomeType === 'CYBERSPACE') {
    targetCategory = CATEGORY_CYBER;
  } else if (biomeType === 'GLITCHED') {
    targetCategory = CATEGORY_GLITCH;
  } else {
    return;
  }

  const existingBadge = data.specialBadges.find(b => b.includes(badge));
  
  if (existingBadge) {
    const match = existingBadge.match(/x(\d+)/);
    const currentCount = match ? parseInt(match[1], 10) : 1;
    const newCount = currentCount + 1;
    
    data.specialBadges = data.specialBadges.filter(b => !b.includes(badge));
    data.specialBadges.unshift('x' + newCount + badge);
    
    console.log('🔢 Increased ' + badge + ' count to ' + newCount + ': ' + channel.name);
  } else {
    if (data.specialBadges.length > 0 && channel.parentId !== targetCategory) {
      data.specialBadges.push(badge);
      console.log('🎨 Added new badge ' + badge + ' (keeping category): ' + channel.name);
    } else if (channel.parentId !== targetCategory) {
      data.specialBadges = [badge];
      
      data.isAutoMoving = true;
      await channel.setParent(targetCategory, { lockPermissions: false }).catch(() => {});
      await new Promise((r) => setTimeout(r, 500));
      
      console.log('🚀 Moved to ' + biomeType + ': ' + channel.name);
    } else {
      data.specialBadges = [badge];
      console.log('🎨 Added badge ' + badge + ' (already in category): ' + channel.name);
    }
  }

  await updateRoleByCategory(channel, true);
  await renameChannelByCategory(channel, data.streak, data.specialBadges);
  scheduleSave();

  console.log('✅ Special category updated: ' + channel.name + ' | Badges: ' + data.specialBadges.join(''));
} catch (err) {
  console.error('❌ moveToSpecialCategory error:', err);
}
```

}

async function sendNotify(channel, type, extraData = {}) {
try {
const userId = channel.topic?.match(/\d{17,20}/)?.[0];
if (!userId) return;

```
  if (type === 'sleep') {
    await channel.send(
      '<@' + userId + '>\n💤 Your macro channel has been moved to the **DORMANT** category due to 3 consecutive days of inactivity.'
    );
  } else if (type === 'active') {
    await channel.send(
      '<@' + userId + '>\n✨ Your macro channel has been **reactivated** and moved to an active category. Welcome back!'
    );
  } else if (type === 'streak_warning') {
    const { activeTime, streak, daysCount } = extraData;
    await channel.send(
      '<@' + userId + '> ⚠️ **Activity Warning!**\nYou only had **' + activeTime + '** of activity today (need 6h+ to maintain streak).\nCurrent streak: **' + streak + '** 🔥\n\n📉 **Day ' + daysCount + '/3** without 6h+ activity - Get 6+ hours tomorrow or your channel will be moved to dormant!'
    );
  } else if (type === 'streak_lost_final') {
    const { activeTime, oldStreak } = extraData;
    await channel.send(
      '<@' + userId + '> 💔 **Streak Lost!**\nYou only had **' + activeTime + '** of activity today (need 6h+).\nYour streak has been reset: **' + oldStreak + ' → 0** 🔥'
    );
  } else if (type === 'streak_saved') {
    const { streak } = extraData;
    await channel.send(
      '<@' + userId + '> ✅ **Streak Saved!**\nYou reached 6+ hours of activity today!\nCurrent streak: **' + streak + '** 🔥'
    );
  }
} catch (err) {
  console.error('❌ Error sending notify:', err);
}
```

}

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
    (ch) => ch.type === 0 && STREAK_CATEGORIES.includes(ch.parentId)
  );

  const results = {
    above18h: [],
    above12h: [],
    above6h: [],
  };

  for (const [, channel] of channels) {
    const data = getData(channel.id, channel);

    let activeTime = 0;
    if (data.firstWebhook && data.lastWebhook) {
      activeTime = data.lastWebhook - data.firstWebhook;
    }

    const activeHours = activeTime / (1000 * 60 * 60);

    if (activeHours >= 18) {
      results.above18h.push({ channel, activeTime, streak: data.streak });
    }
    if (activeHours >= 12) {
      results.above12h.push({ channel, activeTime, streak: data.streak });
    }
    if (activeHours >= 6) {
      results.above6h.push({ channel, activeTime, streak: data.streak });
    }

    if (activeHours >= 6) {
      data.streak++;
      data.daysWithoutActivity = 0;
      await renameChannelByCategory(channel, data.streak, data.specialBadges);
      console.log('🔥 Streak increased: ' + channel.name + ' = ' + data.streak);

      await sendNotify(channel, 'streak_saved', { streak: data.streak });
    } else {
      const oldStreak = data.streak;
      data.daysWithoutActivity++;

      if (data.daysWithoutActivity >= 3) {
        data.streak = 0;
        data.specialBadges = [];

        data.isAutoMoving = true;
        await channel.setParent(CATEGORY_SLEEP, { lockPermissions: false }).catch(() => {});
        await new Promise((r) => setTimeout(r, 500));
        
        await updateRoleByCategory(channel, false);
        data.daysWithoutActivity = 0;
        await renameChannelByCategory(channel, 0, []);
        
        await sendNotify(channel, 'streak_lost_final', {
          activeTime: formatActiveTime(activeTime),
          oldStreak: oldStreak
        });
        await sendNotify(channel, 'sleep');
        
        console.log('📦 Moved ' + channel.name + ' → DORMANT (3 days inactive, streak ' + oldStreak + ' → 0)');
      } else {
        await sendNotify(channel, 'streak_warning', {
          activeTime: formatActiveTime(activeTime),
          streak: data.streak,
          daysCount: data.daysWithoutActivity
        });
        console.log('⚠️ Warning sent: ' + channel.name + ' - Day ' + data.daysWithoutActivity + '/3');
      }
    }

    data.firstWebhook = null;
    data.lastWebhook = null;
    data.lastCheckDate = getCurrentDate();
  }

  scheduleSave();

  const embeds = [];

  if (results.above18h.length > 0) {
    const description = results.above18h
      .map((r) => {
        const categoryName = getCategoryDisplayName(r.channel.parentId);
        return '**' + r.channel.name + '** - ' + categoryName + ' - ' + formatActiveTime(r.activeTime);
      })
      .join('\n');

    const embed18h = new EmbedBuilder()
      .setTitle('🏆 18+ Hours Channels')
      .setColor(0xFFD700)
      .setDescription(description)
      .setTimestamp();
    embeds.push(embed18h);
  }

  if (results.above12h.length > 0) {
    const description = results.above12h
      .map((r) => {
        const categoryName = getCategoryDisplayName(r.channel.parentId);
        return '**' + r.channel.name + '** - ' + categoryName + ' - ' + formatActiveTime(r.activeTime);
      })
      .join('\n');

    const embed12h = new EmbedBuilder()
      .setTitle('⭐ 12+ Hours Channels')
      .setColor(0xC0C0C0)
      .setDescription(description)
      .setTimestamp();
    embeds.push(embed12h);
  }

  if (results.above6h.length > 0) {
    const description = results.above6h
      .map((r) => {
        const categoryName = getCategoryDisplayName(r.channel.parentId);
        return '**' + r.channel.name + '** - ' + categoryName + ' - ' + formatActiveTime(r.activeTime);
      })
      .join('\n');

    const embed6h = new EmbedBuilder()
      .setTitle('✨ 6+ Hours Channels')
      .setColor(0xCD7F32)
      .setDescription(description)
      .setTimestamp();
    embeds.push(embed6h);
  }

  const dateStr = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  if (embeds.length > 0) {
    await reportChannel.send({
      content: '📊 **Daily Activity Report** - ' + dateStr,
      embeds: embeds,
    });
    console.log('✅ Daily report sent');
  } else {
    await reportChannel.send({
      content: '📊 **Daily Activity Report** - ' + dateStr + '\nNo channels with 6+ hours activity today',
    });
  }
} catch (err) {
  console.error('❌ Daily check error:', err);
} finally {
  scheduleDailyCheck();
}
```

}

function getCategoryDisplayName(categoryId) {
if (categoryId === CATEGORY_ACTIVE) return ‘Active’;
if (categoryId === CATEGORY_CYBER) return ‘Cyberspace’;
if (categoryId === CATEGORY_DREAM) return ‘Dreamspace’;
if (categoryId === CATEGORY_GLITCH) return ‘Glitch’;
if (categoryId === CATEGORY_SLEEP) return ‘Dormant’;
return ‘Unknown’;
}

function scheduleDailyCheck() {
const next13H = getNext13HVietnam();
const timeUntil = next13H - new Date();

```
console.log('⏰ Next daily check scheduled at: ' + next13H.toISOString());

setTimeout(() => {
  dailyCheck();
}, timeUntil);
```

}

client.once(‘ready’, async () => {
try {
const guild = client.guilds.cache.first();
if (!guild) return;

```
  const channels = guild.channels.cache.filter(
    (ch) => ch.type === 0 && (
      STREAK_CATEGORIES.includes(ch.parentId) || 
      ch.parentId === CATEGORY_SLEEP
    )
  );

  const today = getCurrentDate();
  for (const [, channel] of channels) {
    const streakFromName = parseStreakFromName(channel.name);
    const badgesFromName = parseSpecialBadgesFromName(channel.name);
    const data = getData(channel.id, channel);

    if (streakFromName !== data.streak && streakFromName > 0) {
      data.streak = streakFromName;
      console.log('🔄 Synced streak for ' + channel.name + ': ' + streakFromName);
    }

    if (badgesFromName.length > 0) {
      data.specialBadges = badgesFromName;
      console.log('🎨 Synced badges for ' + channel.name + ': ' + badgesFromName.join(''));
    }

    if (data.lastCheckDate !== today) {
      data.firstWebhook = null;
      data.lastWebhook = null;
    }
  }

  scheduleSave();
  console.log('✅ Synced all channels on startup');

  scheduleDailyCheck();
} catch (err) {
  console.error('❌ Error on ready:', err);
}
```

});

client.on(‘messageCreate’, async (msg) => {
try {
if (!msg.webhookId) return;
const channel = msg.channel;
if (!channel || !channel.parentId) return;

```
  const topic = channel.topic || '';
  const userId = topic.match(/\d{17,20}/)?.[0];
  if (!userId || msg.author.id !== userId) return;

  const now = Date.now();
  const data = getData(channel.id, channel);

  if (msg.embeds && msg.embeds.length > 0) {
    for (const embed of msg.embeds) {
      const biome = detectSpecialBiome(embed);
      if (biome) {
        await moveToSpecialCategory(channel, biome.type, biome.badge);
      }
    }
  }

  if (channel.parentId === CATEGORY_SLEEP) {
    const oldStreak = parseStreakFromName(channel.name);
    const data = getData(channel.id, channel);

    data.streak = oldStreak > 0 ? oldStreak : 0;
    data.firstWebhook = now;
    data.lastWebhook = now;
    data.daysWithoutActivity = 0;

    data.isAutoMoving = true;
    await channel.setParent(CATEGORY_ACTIVE, { lockPermissions: false }).catch(() => {});
    await new Promise((r) => setTimeout(r, 500));

    await updateRoleByCategory(channel, true);
    await renameChannelByCategory(channel, data.streak, data.specialBadges);
    await sendNotify(channel, 'active');
    scheduleSave();

    console.log('🔄 Reactivated: ' + channel.name + ' | Streak: ' + data.streak);
    return;
  }

  if (!data.firstWebhook) {
    data.firstWebhook = now;
    console.log('🎯 First webhook: ' + channel.name);
  }

  data.lastWebhook = now;
  scheduleSave();
} catch (err) {
  console.error('❌ messageCreate error:', err);
}
```

});

client.on(‘channelCreate’, async (channel) => {
try {
if (channel.type !== 0) return;

```
  const data = getData(channel.id, channel);

  if (channel.parentId === CATEGORY_SLEEP) {
    await updateRoleByCategory(channel, false);
    data.streak = 0;
    data.specialBadges = [];
    await renameChannelByCategory(channel, 0, []);
  } else if (STREAK_CATEGORIES.includes(channel.parentId)) {
    await updateRoleByCategory(channel, true);
    data.streak = 0;
    data.specialBadges = [];
    await renameChannelByCategory(channel, 0, []);
  }

  scheduleSave();
  console.log('✨ Channel created: ' + channel.name);
} catch (err) {
  console.error('❌ channelCreate error:', err);
}
```

});

client.on(‘channelUpdate’, async (oldCh, newCh) => {
try {
if (!newCh || newCh.type !== 0) return;
if (oldCh.parentId === newCh.parentId) return;

```
  const data = getData(newCh.id, newCh);

  if (data.isAutoMoving) {
    data.isAutoMoving = false;
    scheduleSave();
    return;
  }

  if (STREAK_CATEGORIES.includes(newCh.parentId)) {
    await updateRoleByCategory(newCh, true);
    data.daysWithoutActivity = 0;
    await renameChannelByCategory(newCh, data.streak, data.specialBadges);
    await sendNotify(newCh, 'active');
  } 
  else if (newCh.parentId === CATEGORY_SLEEP) {
    await updateRoleByCategory(newCh, false);
    data.streak = 0;
    data.daysWithoutActivity = 0;
    data.firstWebhook = null;
    data.lastWebhook = null;
    data.specialBadges = [];
    await renameChannelByCategory(newCh, 0, []);
    await sendNotify(newCh, 'sleep');
  }

  scheduleSave();
  console.log('🪄 ChannelUpdate: ' + newCh.name + ' category changed');
} catch (err) {
  console.error('❌ channelUpdate error:', err);
}
```

});

client.on(‘channelDelete’, (channel) => {
if (channelData.has(channel.id)) {
channelData.delete(channel.id);
scheduleSave();
}
console.log(’🗑️ Cleaned up channel: ’ + channel.id);
});
};