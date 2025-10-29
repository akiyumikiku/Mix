// events/channelHandler.js
const { renameChannelByCategory } = require("../functions/rename");

const CATEGORY_1 = "1411034825699233943"; // danh mục hoạt động
const CATEGORY_2 = "1427958263281881088"; // danh mục ngủ
const MACRO_ROLE = "1411991634194989096"; // role auto
const INACTIVITY_TIME = 1000 * 60 * 60 * 24; // 1 ngày không có webhook

module.exports = (client) => {
  const inactivityTimers = new Map();

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
          console.log(`✅ Đã thêm role AUTO cho ${member.user.tag}`);
        }
      } else {
        if (member.roles.cache.has(MACRO_ROLE)) {
          await member.roles.remove(MACRO_ROLE).catch(() => {});
          console.log(`🧹 Đã xóa role AUTO khỏi ${member.user.tag}`);
        }
      }
    } catch (err) {
      console.error("❌ Lỗi khi cập nhật role:", err);
    }
  }

  // ===== Khi webhook gửi tin nhắn =====
  client.on("messageCreate", async (msg) => {
    try {
      if (!msg.webhookId) return;
      const channel = msg.channel;
      if (!channel || !channel.parentId) return;

      if (inactivityTimers.has(channel.id))
        clearTimeout(inactivityTimers.get(channel.id));

      // Nếu webhook hoạt động trong danh mục ngủ → chuyển về danh mục hoạt động
      if (channel.parentId === CATEGORY_2) {
        await channel.setParent(CATEGORY_1, { lockPermissions: false }).catch(() => {});
        await new Promise((r) => setTimeout(r, 500));
        await renameChannelByCategory(channel);
        await updateRoleByCategory(channel, true);
        console.log(`🔄 Webhook mới → ${channel.name} về danh mục hoạt động`);
      }

      // Đặt lại hẹn giờ 1 ngày
      const timer = setTimeout(async () => {
        try {
          if (channel.parentId === CATEGORY_1) {
            await channel.setParent(CATEGORY_2, { lockPermissions: false }).catch(() => {});
            await new Promise((r) => setTimeout(r, 500));
            await renameChannelByCategory(channel);
            await updateRoleByCategory(channel, false);
            console.log(`📦 Chuyển ${channel.name} → danh mục ngủ (1 ngày không có webhook)`);
          }
        } catch (err) {
          console.error("❌ Lỗi khi chuyển danh mục:", err);
        }
      }, INACTIVITY_TIME);

      inactivityTimers.set(channel.id, timer);
    } catch (err) {
      console.error("❌ Lỗi messageCreate:", err);
    }
  });

  // ===== Khi kênh được tạo =====
  client.on("channelCreate", async (channel) => {
    try {
      await renameChannelByCategory(channel);

      if (channel.parentId === CATEGORY_1) {
        await updateRoleByCategory(channel, true);
      } else if (channel.parentId === CATEGORY_2) {
        await updateRoleByCategory(channel, false);
      }

      if (channel.parentId === CATEGORY_1) {
        const timer = setTimeout(async () => {
          try {
            await channel.setParent(CATEGORY_2, { lockPermissions: false }).catch(() => {});
            await new Promise((r) => setTimeout(r, 500));
            await renameChannelByCategory(channel);
            await updateRoleByCategory(channel, false);
            console.log(`📦 Chuyển ${channel.name} → danh mục ngủ (1 ngày không có webhook)`);
          } catch (err) {
            console.error("❌ Lỗi khi chuyển danh mục:", err);
          }
        }, INACTIVITY_TIME);

        inactivityTimers.set(channel.id, timer);
      }
    } catch (err) {
      console.error("❌ Lỗi channelCreate:", err);
    }
  });

  // ===== Khi kênh được chuyển danh mục (thủ công hoặc tự động) =====
  client.on("channelUpdate", async (oldCh, newCh) => {
    try {
      if (!newCh || newCh.type !== 0) return;
      if (oldCh.parentId !== newCh.parentId) {
        await renameChannelByCategory(newCh);
        if (newCh.parentId === CATEGORY_1) {
          await updateRoleByCategory(newCh, true);
        } else if (newCh.parentId === CATEGORY_2) {
          await updateRoleByCategory(newCh, false);
        }
        console.log(`🪄 ChannelUpdate: ${newCh.name} đổi danh mục`);
      }
    } catch (err) {
      console.error("❌ Lỗi channelUpdate:", err);
    }
  });

  // ===== Khi kênh bị xóa =====
  client.on("channelDelete", (channel) => {
    if (inactivityTimers.has(channel.id)) {
      clearTimeout(inactivityTimers.get(channel.id));
      inactivityTimers.delete(channel.id);
    }
  });
};
