// handlers/channelActivity.js
const { renameChannelByCategory } = require("../functions/rename");

const CATEGORY_1 = "1411034825699233943"; // hoạt động
const CATEGORY_2 = "1427958263281881088"; // ngủ
const INACTIVITY_TIME = 1000 * 60 * 60 * 24; // 1 ngày

module.exports = (client) => {
  const inactivityTimers = new Map();

  client.on("messageCreate", async (msg) => {
    try {
      if (!msg.webhookId) return;
      const channel = msg.channel;
      if (!channel || !channel.parentId) return;

      // ✅ Rename nhanh khi có webhook (nếu kênh chưa đúng)
      await renameChannelByCategory(channel);

      // Reset timer cũ nếu có
      if (inactivityTimers.has(channel.id)) {
        clearTimeout(inactivityTimers.get(channel.id));
        inactivityTimers.delete(channel.id);
      }

      // Nếu webhook gửi trong danh mục ngủ → chuyển về danh mục hoạt động
      if (channel.parentId === CATEGORY_2) {
        await channel.setParent(CATEGORY_1, { lockPermissions: false }).catch(() => {});
        console.log(`🔄 Đưa ${channel.name} → danh mục hoạt động (do có webhook mới)`);

        // 💡 Đợi Discord sync rồi rename lại
        setTimeout(async () => {
          await renameChannelByCategory(channel);
        }, 1500); // 1.5s là điểm "vàng"
      }

      // Đặt lại hẹn giờ tự move sau 1 ngày không có webhook
      const timer = setTimeout(async () => {
        try {
          if (channel.parentId === CATEGORY_1) {
            await channel.setParent(CATEGORY_2, { lockPermissions: false }).catch(() => {});
            console.log(`📦 Chuyển ${channel.name} → danh mục ngủ (1 ngày không có webhook)`);

            // 💡 Lại đợi chút cho Discord sync rồi rename
            setTimeout(async () => {
              await renameChannelByCategory(channel);
            }, 1500);
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

  client.on("channelCreate", async (channel) => {
    await renameChannelByCategory(channel);
  });

  client.on("channelUpdate", async (oldCh, newCh) => {
    try {
      if (!newCh || newCh.type !== 0) return;
      if (oldCh.parentId !== newCh.parentId) {
        setTimeout(async () => {
          await renameChannelByCategory(newCh);
        }, 1500); // 1.5s delay giúp rename chính xác
      }
    } catch (err) {
      console.error("❌ Lỗi channelUpdate:", err);
    }
  });

  client.on("channelDelete", (channel) => {
    if (inactivityTimers.has(channel.id)) {
      clearTimeout(inactivityTimers.get(channel.id));
      inactivityTimers.delete(channel.id);
    }
  });
};
