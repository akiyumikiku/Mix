// events/channelHandler.js
const { renameChannelByCategory } = require(”../functions/rename”);
const { EmbedBuilder } = require(“discord.js”);
const fs = require(“fs”);
const path = require(“path”);

// ===== CONSTANTS =====
const CATEGORY_SLEEP = “1427958263281881088”; // Ngủ
const CATEGORY_ACTIVE = “1411034825699233943”; // Thức
const CATEGORY_CYBER = “1446077580615880735”; // Cyberspace
const CATEGORY_DREAM = “1445997821336748155”; // Dreamspace
const CATEGORY_GLITCH = “1445997659948060712”; // Glitch
const MACRO_ROLE = “1411991634194989096”; // Role auto
const REPORT_CHANNEL_ID = “1438039815919632394”; // Kênh gửi report
const STREAK_FILE = path.join(__dirname, “../data/streaks.json”);

// Danh sách danh mục có streak
const STREAK_CATEGORIES = [CATEGORY_ACTIVE, CATEGORY_CYBER, CATEGORY_DREAM, CATEGORY_GLITCH];

module.exports = (client) => {
const channelData = new Map(); // {channelId: {streak, firstWebhook, lastWebhook, daysWithoutActivity, lastCheckDate, specialBadges}}

// ===== Load/Save data =====
function loadData() {
try {
if (fs.existsSync(STREAK_FILE)) {
const data = JSON.parse(fs.readFileSync(STREAK_FILE, “utf8”));
Object.entries(data).forEach(([channelId, channelInfo]) => {
channelData.set(channelId, channelInfo);
});
console.log(`📂 Loaded ${channelData.size} channel records`);
}
} catch (err) {
console.error(“❌ Error loading data:”, err);
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
fs.writeFileSync(STREAK_FILE, JSON.stringify(data, null, 2), “utf8”);
} catch (err) {
console.error(“❌ Error saving data:”, err);
}
}

loadData();

// Auto-save với debounce
let saveTimer = null;
function scheduleSave() {
if (saveTimer) clearTimeout(saveTimer);
saveTimer = setTimeout(saveData, 2000);
}

// ===== Helper: Parse streak từ tên kênh =====
function parseStreakFromName(channelName) {
const match = channelName.match(/〔(\d+)🔥〕/);
return match ? parseInt(match[1], 10) : 0;
}

// ===== Helper: Parse special badges từ tên kênh =====
function parseSpecialBadgesFromName(channelName) {
const badges = [];
if (channelName.includes(“🌸”)) badges.push(“🌸”);
if (channelName.includes(“🌐”)) badges.push(“🌐”);
if (channelName.includes(“🧩”)) badges.push(“🧩”);
return badges;
}

// ===== Helper: Lấy hoặc tạo data cho kênh =====
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

// ===== Helper: Ngày hiện tại =====
function getCurrentDate() {
return new Date().toISOString().split(‘T’)[0];
}

// ===== Helper: Tính 13:00 Việt Nam tiếp theo =====
function getNext13HVietnam() {
const now = new Date();
// Việt Nam = UTC+7
// 13:00 VN = 06:00 UTC
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

// ===== Helper: Format thời gian =====
function formatActiveTime(milliseconds) {
const hours = Math.floor(milliseconds / (1000 * 60 * 60));
const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
return `${hours}h ${minutes}m`;
}

// ===== Helper: Detect special biome từ embed =====
function detectSpecialBiome(embed) {
if (!embed || !embed.title) return null;

```
const title = embed.title.toUpperCase();

if (title.includes("DREAMSPACE")) return { type: "DREAMSPACE", badge: "🌸" };
if (title.includes("CYBERSPACE")) return { type: "CYBERSPACE", badge: "🌐" };
if (title.includes("GLITCH")) return { type: "GLITCHED", badge: "🧩" };

return null;
```

}

// ===== Helper: Update role =====
async function updateRoleByCategory(channel, addRole) {
try {
const topic = channel.topic || “”;
const userId = topic.match(/\d{17,20}/)?.[0];
if (!userId) return;

```
  const member = await channel.guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  if (addRole) {
    if (!member.roles.cache.has(MACRO_ROLE)) {
      await member.roles.add(MACRO_ROLE).catch(() => {});
      console.log(`✅ Added AUTO role to ${member.user.tag}`);
    }
  } else {
    if (member.roles.cache.has(MACRO_ROLE)) {
      await member.roles.remove(MACRO_ROLE).catch(() => {});
      console.log(`🧹 Removed AUTO role from ${member.user.tag}`);
    }
  }
} catch (err) {
  console.error("❌ Role update error:", err);
}
```

}

// ===== Helper: Move channel sang danh mục đặc biệt =====
async function moveToSpecialCategory(channel, biomeType, badge) {
try {
const data = getData(channel.id, channel);
let targetCategory;

```
  if (biomeType === "DREAMSPACE") {
    targetCategory = CATEGORY_DREAM;
  } else if (biomeType === "CYBERSPACE") {
    targetCategory = CATEGORY_CYBER;
  } else if (biomeType === "GLITCHED") {
    targetCategory = CATEGORY_GLITCH;
  } else {
    return;
  }

  // Đếm số lượng badge hiện tại
  const badgeCount = data.specialBadges.filter(b => b === badge).length;
  
  // Nếu đã có badge này rồi → tăng số lượng
  if (badgeCount > 0) {
    // Xóa badge cũ
    data.specialBadges = data.specialBadges.filter(b => b !== badge);
    // Thêm lại với prefix số lượng
    const newBadge = `x${badgeCount + 1}${badge}`;
    data.specialBadges = [newBadge];
  } else {
    // Nếu chưa có badge này
    if (data.specialBadges.length > 0) {
      // Đã có badge khác → giữ nguyên danh mục, thêm badge mới
      data.specialBadges.push(badge);
    } else {
      // Chưa có badge nào → chuyển sang danh mục mới
      data.specialBadges = [badge];
      
      // Set flag để tránh duplicate trong channelUpdate event
      data.isAutoMoving = true;
      await channel.setParent(targetCategory, { lockPermissions: false }).catch(() => {});
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  await updateRoleByCategory(channel, true);
  await renameChannelByCategory(channel, data.streak, data.specialBadges);
  scheduleSave();

  console.log(`🎨 Moved to ${biomeType}: ${channel.name} | Badges: ${data.specialBadges.join("")}`);
} catch (err) {
  console.error("❌ moveToSpecialCategory error:", err);
}
```

}

// ===== Helper: Send notification =====
async function sendNotify(channel, type, extraData = {}) {
try {
const userId = channel.topic?.match(/\d{17,20}/)?.[0];
if (!userId) return;

```
  if (type === "sleep") {
    await channel.send(
      `<@${userId}>\nYour macro channel has been moved to the **DORMANT** category due to 3 days of inactivity.`
    );
  } else if (type === "active") {
    await channel.send(
      `<@${userId}>\nYour macro channel has been **reactivated** and moved to an active category.`
    );
  } else if (type === "streak_warning") {
    const { activeTime, streak, daysCount } = extraData;
    await channel.send(
      `<@${userId}> ⚠️ **Warning!**\nYou only had **${activeTime}** of activity today (need 6h+).\nCurrent streak: **${streak}** 🔥\n\n📉 **Day ${daysCount}/3** without 6h+ activity - Keep it up or lose your streak!`
    );
  } else if (type === "streak_lost") {
    const { activeTime, oldStreak, daysCount } = extraData;
    await channel.send(
      `<@${userId}> 💔 **Streak Lost!**\nYou only had **${activeTime}** of activity (need 6h+ to maintain streak).\nStreak reset: **${oldStreak} → 0** 🔥\n\n⚠️ **Day ${daysCount}/3** - ${3 - daysCount} more day(s) without 6h+ activity will move your channel to dormant!`
    );
  } else if (type === "streak_saved") {
    const { streak } = extraData;
    await channel.send(
      `<@${userId}> ✅ **Streak Saved!**\nYou reached 6+ hours of activity today!\nCurrent streak: **${streak}** 🔥`
    );
  }
} catch (err) {
  console.error("❌ Error sending notify:", err);
}
```

}

// ===== Daily check vào 13:00 VN =====
async function dailyCheck() {
try {
console.log(“🕐 Running daily check at 13:00 Vietnam time…”);

```
  const guild = client.guilds.cache.first();
  if (!guild) return;

  const reportChannel = await guild.channels.fetch(REPORT_CHANNEL_ID).catch(() => null);
  if (!reportChannel) {
    console.error("❌ Report channel not found");
    return;
  }

  // Lấy tất cả kênh trong các danh mục có streak
  const channels = guild.channels.cache.filter(
    (ch) => ch.type === 0 && STREAK_CATEGORIES.includes(ch.parentId)
  );

  const results = {
    above18h: [],
    above12h: [],
    above6h: [],
  };

  // Xử lý từng kênh
  for (const [, channel] of channels) {
    const data = getData(channel.id, channel);

    // Tính active time trong ngày
    let activeTime = 0;
    if (data.firstWebhook && data.lastWebhook) {
      activeTime = data.lastWebhook - data.firstWebhook;
    }

    const activeHours = activeTime / (1000 * 60 * 60);

    // Phân loại kênh
    if (activeHours >= 18) {
      results.above18h.push({ channel, activeTime, streak: data.streak });
    }
    if (activeHours >= 12) {
      results.above12h.push({ channel, activeTime, streak: data.streak });
    }
    if (activeHours >= 6) {
      results.above6h.push({ channel, activeTime, streak: data.streak });
    }

    // Cập nhật streak
    if (activeHours >= 6) {
      data.streak++;
      data.daysWithoutActivity = 0;
      await renameChannelByCategory(channel, data.streak, data.specialBadges);
      console.log(`🔥 Streak increased: ${channel.name} = ${data.streak}`);

      await sendNotify(channel, "streak_saved", { streak: data.streak });
    } else {
      // Không đạt 6h
      data.daysWithoutActivity++;

      // Nếu quá 3 ngày → chuyển dormant và reset streak
      if (data.daysWithoutActivity >= 3) {
        const oldStreak = data.streak;
        data.streak = 0;
        data.specialBadges = []; // Reset badges

        // Set flag để tránh duplicate
        data.isAutoMoving = true;
        await channel.setParent(CATEGORY_SLEEP, { lockPermissions: false }).catch(() => {});
        await new Promise((r) => setTimeout(r, 500));
        
        await updateRoleByCategory(channel, false);
        data.daysWithoutActivity = 0;
        await renameChannelByCategory(channel, 0, []);
        await sendNotify(channel, "sleep");
        
        console.log(`📦 Moved ${channel.name} → DORMANT (3 days inactive, streak ${oldStreak} → 0)`);
      } else {
        // Chỉ cảnh báo, giữ streak
        await sendNotify(channel, "streak_warning", {
          activeTime: formatActiveTime(activeTime),
          streak: data.streak,
          daysCount: data.daysWithoutActivity
        });
        console.log(`⚠️ Warning sent: ${channel.name} - Day ${data.daysWithoutActivity}/3`);
      }
    }

    // Reset webhook tracking cho ngày mới
    data.firstWebhook = null;
    data.lastWebhook = null;
    data.lastCheckDate = getCurrentDate();
  }

  scheduleSave();

  // Tạo report embeds theo format yêu cầu
  const embeds = [];

  // Embed 1: 18h+
  if (results.above18h.length > 0) {
    const description = results.above18h
      .map((r) => {
        const categoryName = getCategoryDisplayName(r.channel.parentId);
        return `**${r.channel.name}** - ${categoryName} - ${formatActiveTime(r.activeTime)}`;
      })
      .join("\n");

    const embed18h = new EmbedBuilder()
      .setTitle("🏆 18+ Hours Channels")
      .setColor(0xFFD700)
      .setDescription(description)
      .setTimestamp();
    embeds.push(embed18h);
  }

  // Embed 2: 12h+
  if (results.above12h.length > 0) {
    const description = results.above12h
      .map((r) => {
        const categoryName = getCategoryDisplayName(r.channel.parentId);
        return `**${r.channel.name}** - ${categoryName} - ${formatActiveTime(r.activeTime)}`;
      })
      .join("\n");

    const embed12h = new EmbedBuilder()
      .setTitle("⭐ 12+ Hours Channels")
      .setColor(0xC0C0C0)
      .setDescription(description)
      .setTimestamp();
    embeds.push(embed12h);
  }

  // Embed 3: 6h+
  if (results.above6h.length > 0) {
    const description = results.above6h
      .map((r) => {
        const categoryName = getCategoryDisplayName(r.channel.parentId);
        return `**${r.channel.name}** - ${categoryName} - ${formatActiveTime(r.activeTime)}`;
      })
      .join("\n");

    const embed6h = new EmbedBuilder()
      .setTitle("✨ 6+ Hours Channels")
      .setColor(0xCD7F32)
      .setDescription(description)
      .setTimestamp();
    embeds.push(embed6h);
  }

  // Gửi report
  const dateStr = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  if (embeds.length > 0) {
    await reportChannel.send({
      content: `📊 **Daily Activity Report** - ${dateStr}`,
      embeds: embeds,
    });
    console.log("✅ Daily report sent");
  } else {
    await reportChannel.send({
      content: `📊 **Daily Activity Report** - ${dateStr}\nNo channels with 6+ hours activity today`,
    });
  }
} catch (err) {
  console.error("❌ Daily check error:", err);
}

scheduleDailyCheck();
```

}

// ===== Helper: Lấy tên danh mục để hiển thị =====
function getCategoryDisplayName(categoryId) {
if (categoryId === CATEGORY_ACTIVE) return “Active”;
if (categoryId === CATEGORY_CYBER) return “Cyberspace”;
if (categoryId === CATEGORY_DREAM) return “Dreamspace”;
if (categoryId === CATEGORY_GLITCH) return “Glitch”;
if (categoryId === CATEGORY_SLEEP) return “Dormant”;
return “Unknown”;
}

// ===== Schedule daily check =====
function scheduleDailyCheck() {
const next13H = getNext13HVietnam();
const timeUntil = next13H - new Date();

```
console.log(`⏰ Next daily check scheduled at: ${next13H.toISOString()}`);

setTimeout(() => {
  dailyCheck();
}, timeUntil);
```

}

// ===== Bot ready =====
client.once(“ready”, async () => {
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

    // Sync streak và badges từ tên kênh
    if (streakFromName !== data.streak && streakFromName > 0) {
      data.streak = streakFromName;
      console.log(`🔄 Synced streak for ${channel.name}: ${streakFromName}`);
    }

    if (badgesFromName.length > 0) {
      data.specialBadges = badgesFromName;
      console.log(`🎨 Synced badges for ${channel.name}: ${badgesFromName.join("")}`);
    }

    // Reset webhook tracking nếu qua ngày mới
    if (data.lastCheckDate !== today) {
      data.firstWebhook = null;
      data.lastWebhook = null;
    }
  }

  scheduleSave();
  console.log(`✅ Synced all channels on startup`);

  scheduleDailyCheck();
} catch (err) {
  console.error("❌ Error on ready:", err);
}
```

});

// ===== Khi message được tạo =====
client.on(“messageCreate”, async (msg) => {
try {
// Chỉ xử lý webhook
if (!msg.webhookId) return;
const channel = msg.channel;
if (!channel || !channel.parentId) return;

```
  // Kiểm tra user ID
  const topic = channel.topic || "";
  const userId = topic.match(/\d{17,20}/)?.[0];
  if (!userId || msg.author.id !== userId) return;

  const now = Date.now();
  const data = getData(channel.id, channel);

  // Detect special biome từ embed
  if (msg.embeds && msg.embeds.length > 0) {
    for (const embed of msg.embeds) {
      const biome = detectSpecialBiome(embed);
      if (biome) {
        await moveToSpecialCategory(channel, biome.type, biome.badge);
        // Không return, vẫn track webhook bình thường
      }
    }
  }

  // Nếu kênh đang ở SLEEP → chuyển sang ACTIVE
  if (channel.parentId === CATEGORY_SLEEP) {
    const oldStreak = parseStreakFromName(channel.name);
    const data = getData(channel.id, channel);

    data.streak = oldStreak > 0 ? oldStreak : 0;
    data.firstWebhook = now;
    data.lastWebhook = now;
    data.daysWithoutActivity = 0;

    // Set flag
    data.isAutoMoving = true;
    await channel.setParent(CATEGORY_ACTIVE, { lockPermissions: false }).catch(() => {});
    await new Promise((r) => setTimeout(r, 500));

    await updateRoleByCategory(channel, true);
    await renameChannelByCategory(channel, data.streak, data.specialBadges);
    await sendNotify(channel, "active");
    scheduleSave();

    console.log(`🔄 Reactivated: ${channel.name} | Streak: ${data.streak}`);
    return;
  }

  // Track first webhook
  if (!data.firstWebhook) {
    data.firstWebhook = now;
    console.log(`🎯 First webhook: ${channel.name}`);
  }

  // Update last webhook
  data.lastWebhook = now;
  scheduleSave();
} catch (err) {
  console.error("❌ messageCreate error:", err);
}
```

});

// ===== Khi kênh được tạo =====
client.on(“channelCreate”, async (channel) => {
try {
if (channel.type !== 0) return;

```
  const data = getData(channel.id, channel);

  // Kênh mới luôn được tạo ở SLEEP
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
  console.log(`✨ Channel created: ${channel.name}`);
} catch (err) {
  console.error("❌ channelCreate error:", err);
}
```

});

// ===== Khi kênh được update =====
client.on(“channelUpdate”, async (oldCh, newCh) => {
try {
if (!newCh || newCh.type !== 0) return;
if (oldCh.parentId === newCh.parentId) return;

```
  const data = getData(newCh.id, newCh);

  // Bỏ qua nếu đang auto move
  if (data.isAutoMoving) {
    data.isAutoMoving = false;
    scheduleSave();
    return;
  }

  // Kênh được chuyển sang ACTIVE categories
  if (STREAK_CATEGORIES.includes(newCh.parentId)) {
    await updateRoleByCategory(newCh, true);
    data.daysWithoutActivity = 0;
    await renameChannelByCategory(newCh, data.streak, data.specialBadges);
    await sendNotify(newCh, "active");
  } 
  // Kênh được chuyển sang SLEEP
  else if (newCh.parentId === CATEGORY_SLEEP) {
    await updateRoleByCategory(newCh, false);
    data.streak = 0;
    data.daysWithoutActivity = 0;
    data.firstWebhook = null;
    data.lastWebhook = null;
    data.specialBadges = [];
    await renameChannelByCategory(newCh, 0, []);
    await sendNotify(newCh, "sleep");
  }

  scheduleSave();
  console.log(`🪄 ChannelUpdate: ${newCh.name} category changed`);
} catch (err) {
  console.error("❌ channelUpdate error:", err);
}
```

});

// ===== Khi kênh bị xóa =====
client.on(“channelDelete”, (channel) => {
if (channelData.has(channel.id)) {
channelData.delete(channel.id);
scheduleSave();
}
console.log(`🗑️ Cleaned up channel: ${channel.id}`);
});
};
