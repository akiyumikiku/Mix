// events/channelHandler.js
const { renameChannelByCategory } = require("../functions/rename");
const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

const CATEGORY_1 = "1411034825699233943"; // danh mục hoạt động
const CATEGORY_2 = "1427958263281881088"; // danh mục ngủ
const MACRO_ROLE = "1411991634194989096"; // role auto
const REPORT_CHANNEL_ID = "1438039815919632394"; // kênh gửi report
const STREAK_FILE = path.join(__dirname, "../data/streaks.json");

module.exports = (client) => {
  const channelData = new Map(); // {channelId: {streak, firstWebhook, lastWebhook, daysWithoutActivity, lastCheckDate}}

  // ===== Load data từ JSON =====
  function loadData() {
    try {
      if (fs.existsSync(STREAK_FILE)) {
        const data = JSON.parse(fs.readFileSync(STREAK_FILE, "utf8"));
        Object.entries(data).forEach(([channelId, channelInfo]) => {
          channelData.set(channelId, channelInfo);
        });
        console.log(`📂 Loaded ${channelData.size} channel records`);
      }
    } catch (err) {
      console.error("❌ Error loading data:", err);
    }
  }

  // ===== Save data vào JSON =====
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

      fs.writeFileSync(STREAK_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.error("❌ Error saving data:", err);
    }
  }

  // Load data khi bot khởi động
  loadData();

  // Auto-save mỗi 5 phút
  setInterval(saveData, 5 * 60 * 1000);

  // ===== Helper: Parse streak từ tên kênh =====
  function parseStreakFromName(channelName) {
    const match = channelName.match(/〔(\d+)🔥〕/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // ===== Helper: Lấy hoặc tạo data cho kênh =====
  function getData(channelId, channel = null) {
    if (!channelData.has(channelId)) {
      let initialStreak = 0;
      if (channel && channel.name) {
        initialStreak = parseStreakFromName(channel.name);
      }

      channelData.set(channelId, {
        streak: initialStreak,
        firstWebhook: null,
        lastWebhook: null,
        daysWithoutActivity: 0,
        lastCheckDate: null,
      });
    }
    return channelData.get(channelId);
  }

  // ===== Helper: Lấy ngày hiện tại (format YYYY-MM-DD) =====
  function getCurrentDate() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  // ===== Helper: Tính thời gian 13:00 UTC+7 tiếp theo =====
  function getNext13HMUTC7() {
    const now = new Date();
    // UTC+7 = UTC + 7 hours
    // 13:00 UTC+7 = 06:00 UTC
    const next13H = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      6, 0, 0, 0
    ));

    // Nếu đã qua 06:00 UTC hôm nay, chuyển sang ngày mai
    if (now >= next13H) {
      next13H.setUTCDate(next13H.getUTCDate() + 1);
    }

    return next13H;
  }

  // ===== Helper: Format thời gian hoạt động =====
  function formatActiveTime(milliseconds) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  // ===== Daily check vào 13:00 UTC+7 =====
  async function dailyCheck() {
    try {
      console.log("🕐 Running daily check at 13:00 UTC+7...");

      const guild = client.guilds.cache.first();
      if (!guild) return;

      const reportChannel = await guild.channels.fetch(REPORT_CHANNEL_ID).catch(() => null);
      if (!reportChannel) {
        console.error("❌ Report channel not found");
        return;
      }

      // Lấy tất cả kênh trong danh mục hoạt động
      const channels = guild.channels.cache.filter(
        (ch) => ch.type === 0 && ch.parentId === CATEGORY_1
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
          results.above18h.push({ channel, activeTime });
        }
        if (activeHours >= 12) {
          results.above12h.push({ channel, activeTime });
        }
        if (activeHours >= 6) {
          results.above6h.push({ channel, activeTime });
        }

        // Cập nhật streak
        if (activeHours >= 6) {
          data.streak++;
          data.daysWithoutActivity = 0;
          await renameChannelByCategory(channel, data.streak);
          console.log(`🔥 Streak increased: ${channel.name} = ${data.streak}`);

          // Thông báo streak saved
          await sendNotify(channel, "streak_saved", { streak: data.streak });
        } else {
          // Mất chuỗi ngay sau 24h không đạt 6h
          const oldStreak = data.streak;
          data.streak = 0;
          data.daysWithoutActivity++;

          await renameChannelByCategory(channel, 0);
          console.log(`💔 Streak lost: ${channel.name} (${oldStreak} → 0) - Day ${data.daysWithoutActivity}/3`);

          // Thông báo mất chuỗi
          await sendNotify(channel, "streak_lost", {
            activeTime: formatActiveTime(activeTime),
            oldStreak: oldStreak,
            daysCount: data.daysWithoutActivity
          });

          // Nếu quá 3 ngày không hoạt động → chuyển dormant
          if (data.daysWithoutActivity >= 3) {
            await channel.setParent(CATEGORY_2, { lockPermissions: false }).catch(() => {});
            await new Promise((r) => setTimeout(r, 500));
            await updateRoleByCategory(channel, false);
            data.daysWithoutActivity = 0;
            await renameChannelByCategory(channel, 0);
            await sendNotify(channel, "sleep");
            console.log(`📦 Moved ${channel.name} → DORMANT (3 days inactive)`);
          }
        }

        // Reset webhook tracking cho ngày mới
        data.firstWebhook = null;
        data.lastWebhook = null;
        data.lastCheckDate = getCurrentDate();
      }

      saveData();

      // Tạo report embeds
      const embeds = [];

      // Embed 1: 18h+
      if (results.above18h.length > 0) {
        const embed18h = new EmbedBuilder()
          .setTitle("🏆 18+ Hours Activity")
          .setColor(0xFFD700) // Gold
          .setDescription(
            results.above18h
              .map((r) => `**${r.channel.name}** - ${formatActiveTime(r.activeTime)}`)
              .join("\n")
          )
          .setTimestamp();
        embeds.push(embed18h);
      }

      // Embed 2: 12h+
      if (results.above12h.length > 0) {
        const embed12h = new EmbedBuilder()
          .setTitle("⭐ 12+ Hours Activity")
          .setColor(0xC0C0C0) // Silver
          .setDescription(
            results.above12h
              .map((r) => `**${r.channel.name}** - ${formatActiveTime(r.activeTime)}`)
              .join("\n")
          )
          .setTimestamp();
        embeds.push(embed12h);
      }

      // Embed 3: 6h+
      if (results.above6h.length > 0) {
        const embed6h = new EmbedBuilder()
          .setTitle("✨ 6+ Hours Activity")
          .setColor(0xCD7F32) // Bronze
          .setDescription(
            results.above6h
              .map((r) => `**${r.channel.name}** - ${formatActiveTime(r.activeTime)}`)
              .join("\n")
          )
          .setTimestamp();
        embeds.push(embed6h);
      }

      // Gửi report
      if (embeds.length > 0) {
        await reportChannel.send({
          content: "📊 **Daily Activity Report** - " + new Date().toLocaleDateString("vi-VN"),
          embeds: embeds,
        });
        console.log("✅ Daily report sent");
      } else {
        await reportChannel.send({
          content: "📊 **Daily Activity Report** - No channels with 6+ hours activity today",
        });
      }
    } catch (err) {
      console.error("❌ Daily check error:", err);
    }

    // Schedule lại cho ngày mai
    scheduleDailyCheck();
  }

  // ===== Schedule daily check =====
  function scheduleDailyCheck() {
    const next13H = getNext13HMUTC7();
    const timeUntil = next13H - new Date();

    console.log(`⏰ Next daily check scheduled at: ${next13H.toISOString()}`);

    setTimeout(() => {
      dailyCheck();
    }, timeUntil);
  }

  // ===== Helper: Update role =====
  async function updateRoleByCategory(channel, addRole) {
    try {
      const topic = channel.topic || "";
      const userId = topic.match(/\d{17,20}/)?.[0];
      if (!userId) return;
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
  }

  // ===== Helper: Send notification =====
  async function sendNotify(channel, type, extraData = {}) {
    try {
      const userId = channel.topic?.match(/\d{17,20}/)?.[0];
      if (!userId) return;

      if (type === "sleep") {
        await channel.send(
          `<@${userId}>\nYour macro channel has been moved to the **DORMANT** category due to 3 days of inactivity.`
        );
      } else if (type === "active") {
        await channel.send(
          `<@${userId}>\nYour macro channel has been **reactivated** and moved to the MACRO|OPEN| category.`
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
  }

  // ===== Bot ready =====
  client.once("ready", async () => {
    try {
      const guild = client.guilds.cache.first();
      if (!guild) return;

      // Sync streak từ tên kênh
      const channels = guild.channels.cache.filter(
        (ch) =>
          ch.type === 0 &&
          (ch.parentId === CATEGORY_1 || ch.parentId === CATEGORY_2)
      );

      const today = getCurrentDate();
      for (const [, channel] of channels) {
        const streakFromName = parseStreakFromName(channel.name);
        const data = getData(channel.id, channel);

        // Sync streak từ tên kênh
        if (streakFromName !== data.streak && streakFromName > 0) {
          data.streak = streakFromName;
          console.log(`🔄 Synced streak for ${channel.name}: ${streakFromName}`);
        }

        // Reset webhook tracking nếu qua ngày mới
        if (data.lastCheckDate !== today) {
          if (data.firstWebhook || data.lastWebhook) {
            console.log(`🔄 Reset webhook tracking for ${channel.name} (new day)`);
          }
          data.firstWebhook = null;
          data.lastWebhook = null;
        }
      }

      saveData();
      console.log(`✅ Synced all channels on startup`);

      // Schedule daily check
      scheduleDailyCheck();
    } catch (err) {
      console.error("❌ Error on ready:", err);
    }
  });

  // ===== Khi webhook gửi tin nhắn =====
  client.on("messageCreate", async (msg) => {
    try {
      // Chỉ xử lý message từ webhook
      if (!msg.webhookId) return;
      const channel = msg.channel;
      if (!channel || !channel.parentId) return;

      // Kiểm tra ID người dùng trong topic có khớp với author không
      const topic = channel.topic || "";
      const userId = topic.match(/\d{17,20}/)?.[0];
      if (!userId || msg.author.id !== userId) return;

      const now = Date.now();
      const data = getData(channel.id, channel);

      // Nếu webhook hoạt động trong danh mục ngủ → chuyển về danh mục hoạt động
      if (channel.parentId === CATEGORY_2) {
        await channel.setParent(CATEGORY_1, { lockPermissions: false }).catch(() => {});
        await new Promise((r) => setTimeout(r, 500));

        // Parse streak từ tên kênh trước khi reactive
        const oldStreak = parseStreakFromName(channel.name);
        const data = getData(channel.id, channel);

        // Giữ streak cũ nếu có, nếu không thì = 0
        data.streak = oldStreak > 0 ? oldStreak : 0;
        data.firstWebhook = now;
        data.lastWebhook = now;
        data.daysWithoutActivity = 0;

        await updateRoleByCategory(channel, true);
        await renameChannelByCategory(channel, data.streak);
        await sendNotify(channel, "active");
        saveData();

        console.log(`🔄 Reactivated: ${channel.name} | Streak: ${data.streak}`);
        return;
      }

      // Track first webhook trong ngày
      if (!data.firstWebhook) {
        data.firstWebhook = now;
        console.log(`🎯 First webhook: ${channel.name}`);
      }

      // Update last webhook
      data.lastWebhook = now;
      saveData();
    } catch (err) {
      console.error("❌ messageCreate error:", err);
    }
  });

  // ===== Khi kênh được tạo =====
  client.on("channelCreate", async (channel) => {
    try {
      if (channel.type !== 0) return;

      const data = getData(channel.id, channel);

      if (channel.parentId === CATEGORY_1) {
        await updateRoleByCategory(channel, true);
        data.streak = 0;
        await renameChannelByCategory(channel, 0);
      } else if (channel.parentId === CATEGORY_2) {
        await updateRoleByCategory(channel, false);
        data.streak = 0;
        await renameChannelByCategory(channel, 0);
      }

      saveData();
      console.log(`✨ Channel created: ${channel.name}`);
    } catch (err) {
      console.error("❌ channelCreate error:", err);
    }
  });

  // ===== Khi kênh được chuyển danh mục =====
  client.on("channelUpdate", async (oldCh, newCh) => {
    try {
      if (!newCh || newCh.type !== 0) return;
      if (oldCh.parentId === newCh.parentId) return;

      const data = getData(newCh.id, newCh);

      if (newCh.parentId === CATEGORY_1) {
        await updateRoleByCategory(newCh, true);
        data.daysWithoutActivity = 0;
        await renameChannelByCategory(newCh, data.streak);
        await sendNotify(newCh, "active");
      } else if (newCh.parentId === CATEGORY_2) {
        await updateRoleByCategory(newCh, false);
        data.streak = 0;
        data.daysWithoutActivity = 0;
        data.firstWebhook = null;
        data.lastWebhook = null;
        await renameChannelByCategory(newCh, 0);
        await sendNotify(newCh, "sleep");
      }

      saveData();
      console.log(`🪄 ChannelUpdate: ${newCh.name} category changed`);
    } catch (err) {
      console.error("❌ channelUpdate error:", err);
    }
  });

  // ===== Khi kênh bị xóa =====
  client.on("channelDelete", (channel) => {
    if (channelData.has(channel.id)) {
      channelData.delete(channel.id);
      saveData();
    }
    console.log(`🗑️ Cleaned up channel: ${channel.id}`);
  });
};
