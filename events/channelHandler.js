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

  async function sendNotify(channel, type) {
    try {
      const userId = channel.topic?.match(/\d{17,20}/)?.[0];
      if (!userId) return;
      if (type === "sleep") {
        await channel.send(
          `<@${userId}>\nYour macro channel has been moved to the **DORMANT** category due to 1 day of inactivity.`
        );
      } else if (type === "active") {
        // === SỬA LỖI CHÍNH TẢ TẠI ĐÂY ===
        await channel.send(
          `<@${userId}>\nYour macro channel has been moved to the **MACRO|OPEN|** category due to reactivation.`
        );
      }
    } catch (err) {
      console.error("❌ Error sending notify:", err);
    }
  }

  // ===== Khi webhook gửi tin nhắn =====
  client.on("messageCreate", async (msg) => {
    try {
      if (!msg.webhookId) return;
      const channel = msg.channel;
      if (!channel || !channel.parentId) return;

      // Xóa timer cũ nếu có
      if (inactivityTimers.has(channel.id))
        clearTimeout(inactivityTimers.get(channel.id));

      // Nếu webhook hoạt động trong danh mục ngủ → chuyển về danh mục hoạt động
      if (channel.parentId === CATEGORY_2) {
        // === SỬA LỖI: CHỈ GỌI setParent ===
        // Event 'channelUpdate' sẽ tự động lo phần còn lại
        await channel.setParent(CATEGORY_1, { lockPermissions: false }).catch(() => {});
        console.log(`🔄 Reactivating: ${channel.name} (moving to CATEGORY_1)`);
        // BỎ HẾT delay, rename, updateRole, sendNotify khỏi đây
      }

      // Đặt lại hẹn giờ 1 ngày
      const timer = setTimeout(async () => {
        try {
          // Luôn fetch channel mới nhất để đảm bảo trạng thái đúng
          const currentChannel = await client.channels.fetch(channel.id).catch(() => null);
          
          // === SỬA LỖI: CHỈ GỌI setParent ===
          if (currentChannel && currentChannel.parentId === CATEGORY_1) {
            await currentChannel.setParent(CATEGORY_2, { lockPermissions: false }).catch(() => {});
            console.log(`📦 Moved ${currentChannel.name} → DORMANT (1 day inactive)`);
            // BỎ HẾT delay, rename, updateRole, sendNotify khỏi đây
          }
        } catch (err) {
          console.error("❌ Error when moving to DORMANT:", err);
        }
      }, INACTIVITY_TIME);

      inactivityTimers.set(channel.id, timer);
    } catch (err) {
      console.error("❌ messageCreate error:", err);
    }
  });

  // ===== Khi kênh được tạo =====
  client.on("channelCreate", async (channel) => {
    try {
      // Các hành động khởi tạo ban đầu này là OK
      await renameChannelByCategory(channel);

      if (channel.parentId === CATEGORY_1) {
        await updateRoleByCategory(channel, true);
      } else if (channel.parentId === CATEGORY_2) {
        await updateRoleByCategory(channel, false);
      }

      // Đặt timer cho kênh mới trong danh mục hoạt động
      if (channel.parentId === CATEGORY_1) {
        const timer = setTimeout(async () => {
          try {
            // Luôn fetch channel mới nhất
            const currentChannel = await client.channels.fetch(channel.id).catch(() => null);

            // === SỬA LỖI: CHỈ GỌI setParent ===
            if (currentChannel && currentChannel.parentId === CATEGORY_1) {
              await currentChannel.setParent(CATEGORY_2, { lockPermissions: false }).catch(() => {});
              console.log(`📦 Moved ${currentChannel.name} → DORMANT (on create)`);
              // BỎ HẾT delay, rename, updateRole, sendNotify khỏi đây
            }
          } catch (err) {
            console.error("❌ Error moving on create:", err);
          }
        }, INACTIVITY_TIME);

        inactivityTimers.set(channel.id, timer);
      }
    } catch (err) {
      console.error("❌ channelCreate error:", err);
    }
  });

  // ===== Khi kênh được chuyển danh mục =====
  // Đây là nơi xử lý logic CHÍNH sau khi một kênh bị di chuyển
  client.on("channelUpdate", async (oldCh, newCh) => {
    try {
      // Thêm kiểm tra type để chắc chắn là text channel
      if (!newCh || newCh.type !== 0) return; // 0 = GUILD_TEXT

      // Chỉ chạy khi parentId (danh mục) thay đổi
      if (oldCh.parentId !== newCh.parentId) {
        // Thêm 1 delay nhỏ để Discord API kịp "thở" và cập nhật parentId
        await new Promise((r) => setTimeout(r, 500)); 
        
        await renameChannelByCategory(newCh);

        if (newCh.parentId === CATEGORY_1) {
          // Kênh được kích hoạt
          await updateRoleByCategory(newCh, true);
          await sendNotify(newCh, "active");
        } else if (newCh.parentId === CATEGORY_2) {
          // Kênh bị đưa đi ngủ
          await updateRoleByCategory(newCh, false);
          await sendNotify(newCh, "sleep");
        }
        console.log(`🪄 ChannelUpdate: ${newCh.name} category changed`);
      }
    } catch (err) {
      console.error("❌ channelUpdate error:", err);
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
