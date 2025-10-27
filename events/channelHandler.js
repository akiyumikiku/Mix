// handlers/channelActivity.js
const { renameChannelByCategory } = require("../functions/rename");
const { setTimeout: wait } = require("node:timers/promises");

const CATEGORY_1 = "1411034825699233943"; // danh mục hoạt động
const CATEGORY_2 = "1427958263281881088"; // danh mục ngủ
const INACTIVITY_TIME = 1000 * 60 * 60 * 24; // 1 ngày

// ===== HÀNG ĐỢI (QUEUE) GIÚP CHỐNG RATE LIMIT =====
const renameQueue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (renameQueue.length > 0) {
    const task = renameQueue.shift();
    try {
      await task();
    } catch (err) {
      console.warn("⚠️ Task lỗi trong queue:", err.message);
    }
    await wait(1200); // mỗi lần cách nhau ~1.2s
  }

  isProcessing = false;
}

// ===== MODULE CHÍNH =====
module.exports = (client) => {
  const inactivityTimers = new Map();

  // === Khi webhook gửi tin ===
  client.on("messageCreate", async (msg) => {
    try {
      if (!msg.webhookId) return;
      const channel = msg.channel;
      if (!channel?.parentId) return;

      // Đưa task rename vào queue
      renameQueue.push(() => renameChannelByCategory(channel));
      processQueue();

      // Reset timer nếu có
      if (inactivityTimers.has(channel.id)) {
        clearTimeout(inactivityTimers.get(channel.id));
        inactivityTimers.delete(channel.id);
      }

      // Nếu trong danh mục ngủ → chuyển về danh mục hoạt động
      if (channel.parentId === CATEGORY_2) {
        renameQueue.push(async () => {
          await channel.setParent(CATEGORY_1, { lockPermissions: false }).catch(() => {});
          await wait(1500); // đợi Discord cập nhật
          await renameChannelByCategory(channel);
          console.log(`🔄 Đưa ${channel.name} → danh mục hoạt động (do có webhook mới)`);
        });
        processQueue();
      }

      // Đặt hẹn giờ tự chuyển về danh mục ngủ
      const timer = setTimeout(async () => {
        try {
          if (channel.parentId === CATEGORY_1) {
            renameQueue.push(async () => {
              await channel.setParent(CATEGORY_2, { lockPermissions: false }).catch(() => {});
              await wait(1500);
              await renameChannelByCategory(channel);
              console.log(`📦 Chuyển ${channel.name} → danh mục ngủ (1 ngày không có webhook)`);
            });
            processQueue();
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

  // === Khi kênh được tạo ===
  client.on("channelCreate", async (channel) => {
    renameQueue.push(() => renameChannelByCategory(channel));
    processQueue();
  });

  // === Khi kênh đổi danh mục ===
  client.on("channelUpdate", async (oldCh, newCh) => {
    try {
      if (!newCh || newCh.type !== 0) return;
      if (oldCh.parentId !== newCh.parentId) {
        renameQueue.push(async () => {
          await wait(1000); // chờ Discord đồng bộ parentId
          await renameChannelByCategory(newCh);
        });
        processQueue();
      }
    } catch (err) {
      console.error("❌ Lỗi channelUpdate:", err);
    }
  });

  // === Khi kênh bị xóa ===
  client.on("channelDelete", (channel) => {
    if (inactivityTimers.has(channel.id)) {
      clearTimeout(inactivityTimers.get(channel.id));
      inactivityTimers.delete(channel.id);
    }
  });
};
