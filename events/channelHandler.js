const { renameChannel } = require("../functions/rename");

const CATEGORY_ID = process.env.CATEGORY_ID;   // ID category chứa channel
const ROLE_ID = process.env.AUTO_ROLE_ID;      // Role auto add khi tạo channel

// Map lưu timer cho từng channel
const channelTimers = new Map();

module.exports = (client) => {
  // ====== Khi channel mới được tạo ======
  client.on("channelCreate", async (channel) => {
    try {
      if (channel.parentId !== CATEGORY_ID) return;

      await renameChannel(channel, CATEGORY_ID);

      if (!channel.topic) return;
      const match = channel.topic.match(/(\d{17,19})$/);
      if (!match) return;

      const userId = match[1];
      const member = await channel.guild.members.fetch(userId).catch(() => null);
      if (!member) return;

      await member.roles.add(ROLE_ID).catch(() => {});
      console.log(`✅ Đã add role ${ROLE_ID} cho ${member.user.tag} khi tạo channel`);
    } catch (err) {
      console.error("❌ Lỗi channelCreate:", err);
    }
  });

  // ====== Khi có tin nhắn mới trong channel ======
  client.on("messageCreate", async (message) => {
    try {
      const channel = message.channel;
      if (channel.parentId !== CATEGORY_ID) return;

      if (!channel.topic) return;
      const match = channel.topic.match(/(\d{17,19})$/);
      if (!match) return;

      const userId = match[1];
      const member = await channel.guild.members.fetch(userId).catch(() => null);
      if (!member) return;

      const isWebhookMsg = !!message.webhookId;

      // Check xem channel hiện đang ẩn hay mở
      const isHidden = channel.permissionOverwrites.cache.some(
        ow => ow.deny.has("ViewChannel") && ow.id === channel.guild.roles.everyone.id
      );

      // Nếu là webhook → luôn mở lại và reset 3 ngày
      if (isWebhookMsg) {
        for (const role of channel.guild.roles.cache.values()) {
          if (role.managed || role.id === channel.guild.roles.everyone.id) continue;
          await channel.permissionOverwrites.edit(role, { ViewChannel: true }).catch(() => {});
        }

        // Reset timer 3 ngày
        if (channelTimers.has(channel.id)) clearTimeout(channelTimers.get(channel.id));
        const timer = setTimeout(async () => {
          try {
            for (const role of channel.guild.roles.cache.values()) {
              if (role.managed || role.id === channel.guild.roles.everyone.id) continue;
              await channel.permissionOverwrites.edit(role, { ViewChannel: false }).catch(() => {});
            }
            if (member.roles.cache.has(ROLE_ID)) {
              await member.roles.remove(ROLE_ID).catch(() => {});
            }
            console.log(`⏳ Channel ${channel.name} bị ẩn sau 3 ngày không có webhook`);
          } catch (err) {
            console.error("❌ Lỗi khi ẩn channel:", err);
          }
        }, 3 * 24 * 60 * 60 * 1000);

        channelTimers.set(channel.id, timer);
        console.log(`✅ Channel ${channel.name} mở lại do có webhook mới (everyone vẫn bị ẩn)`);
      }

      // Nếu là user → chỉ xử lý khi channel đang ẩn
      else if (!isWebhookMsg && isHidden) {
        for (const role of channel.guild.roles.cache.values()) {
          if (role.managed || role.id === channel.guild.roles.everyone.id) continue;
          await channel.permissionOverwrites.edit(role, { ViewChannel: true }).catch(() => {});
        }

        if (channelTimers.has(channel.id)) clearTimeout(channelTimers.get(channel.id));
        const timer = setTimeout(async () => {
          try {
            for (const role of channel.guild.roles.cache.values()) {
              if (role.managed || role.id === channel.guild.roles.everyone.id) continue;
              await channel.permissionOverwrites.edit(role, { ViewChannel: false }).catch(() => {});
            }
            if (member.roles.cache.has(ROLE_ID)) {
              await member.roles.remove(ROLE_ID).catch(() => {});
            }
            console.log(`⏳ Channel ${channel.name} bị ẩn sau 8 giờ không hoạt động`);
          } catch (err) {
            console.error("❌ Lỗi khi ẩn channel:", err);
          }
        }, 8 * 60 * 60 * 1000);

        channelTimers.set(channel.id, timer);
        console.log(`✅ Channel ${channel.name} mở lại do user nhắn (everyone vẫn bị ẩn)`);
      }

    } catch (err) {
      console.error("❌ Lỗi messageCreate:", err);
    }
  });

  // ====== Khi channel bị xóa ======
  client.on("channelDelete", async (channel) => {
    try {
      if (channel.parentId !== CATEGORY_ID) return;
      if (!channel.topic) return;

      const match = channel.topic.match(/(\d{17,19})$/);
      if (!match) return;

      const userId = match[1];
      const member = await channel.guild.members.fetch(userId).catch(() => null);
      if (!member) return;

      if (member.roles.cache.has(ROLE_ID)) {
        await member.roles.remove(ROLE_ID).catch(() => {});
        console.log(`🗑️ Channel ${channel.name} bị xóa → đã gỡ role ${ROLE_ID} khỏi ${member.user.tag}`);
      }
    } catch (err) {
      console.error("❌ Lỗi channelDelete:", err);
    }
  });
};
