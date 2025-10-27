// events/channelHandler.js
const { renameChannelByCategory } = require("../functions/rename");

const CATEGORY_1 = "1411034825699233943";              // danh mục hoạt động
const CATEGORY_2 = "1427958263281881088";       // danh mục ngủ
const INACTIVITY_TIME = 1000 * 60 * 60 * 24;    // 1 ngày không có webhook

module.exports = (client) => {
  const inactivityTimers = new Map(); // Lưu timer từng kênh

  // ===== Khi webhook gửi tin nhắn =====
  client.on("messageCreate", async (msg) => {
    try {
      if (!msg.webhookId) return;
      const channel = msg.channel;
      if (!channel || !channel.parentId) return;

      // Reset lại timer (vì vừa có webhook mới)
      if (inactivityTimers.has(channel.id)) {
        clearTimeout(inactivityTimers.get(channel.id));
      }

      // Nếu webhook hoạt động trong danh mục ngủ → chuyển về danh mục 1
      if (channel.parentId === CATEGORY_2) {
        const [username] = (channel.topic || "").split(" ");
const newName = `🛠★】${username || "unknown"}-macro`;

await channel.setParent(CATEGORY_1, { lockPermissions: false }).catch(() => {});
await channel.setName(newName).catch(() => {});


      // Đặt lại hẹn giờ 1 ngày
      const timer = setTimeout(async () => {
        try {
          if (channel.parentId === CATEGORY_1) {
            const [username] = (channel.topic || "").split(" ");
            const newName = `⏰★】${username || "unknown"}-macro`;

            await channel.setParent(CATEGORY_2, { lockPermissions: false }).catch(() => {});
            await channel.setName(newName).catch(() => {});
            console.log(`📦 Chuyển ${channel.name} → danh mục 2 (1 ngày không có webhook)`);
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

      // Chỉ đặt hẹn giờ nếu ở danh mục 1
      if (channel.parentId === CATEGORY_1) {
        const timer = setTimeout(async () => {
          try {
            const [username] = (channel.topic || "").split(" ");
            const newName = `⏰★】${username || "unknown"}-macro`;

            await channel.setParent(CATEGORY_2, { lockPermissions: false }).catch(() => {});
            await channel.setName(newName).catch(() => {});
            console.log(`📦 Chuyển ${channel.name} → danh mục 2 (1 ngày không có webhook)`);
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

  // ===== Khi kênh được chuyển danh mục hoặc đổi tên =====
  client.on("channelUpdate", async (oldCh, newCh) => {
    try {
      if (!newCh || newCh.type !== 0) return;
      if (oldCh.parentId === newCh.parentId) return;
      await renameChannelByCategory(newCh);
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
