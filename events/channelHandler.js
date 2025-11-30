// events/channelHandler.js
const { updateWebhookActivity, checkWebhookWarnings } = require("../functions/webhookTracker");
const { renameChannelByCategory } = require("../functions/rename");

// ====== CẤU HÌNH: thay bằng ID thật ======
const ACTIVE_CATEGORY_ID = "1411034825699233943"; // ví dụ: "1411034825699233943"
const SLEEP_CATEGORY_ID = "1427958263281881088";       // ví dụ: "1427958263281881088"
const WARN_LOG_CHANNEL = "1426909142458564779";
const MACRO_ROLE = "1411991634194989096";                // role auto (nếu có)
const CHECK_WARN_INTERVAL_MS = 60 * 60 * 1000;       // 1 giờ

module.exports = (client) => {
  console.log("[ChannelHandler] webhook-first handler loaded");

  // ----- Helper: thêm/xóa role cho owner (owner id lưu trong channel.topic) -----
  async function updateRoleByCategory(channel, addRole) {
    try {
      const topic = channel.topic || "";
      const userId = topic.match(/\d{17,20}/)?.[0];
      if (!userId || !MACRO_ROLE) return;

      const member = await channel.guild.members.fetch(userId).catch(() => null);
      if (!member) return;

      if (addRole) {
        if (!member.roles.cache.has(MACRO_ROLE)) {
          await member.roles.add(MACRO_ROLE).catch(err => console.error("❌ addRole err:", err));
          console.log(`✅ Added AUTO role to ${member.user.tag}`);
        }
      } else {
        if (member.roles.cache.has(MACRO_ROLE)) {
          await member.roles.remove(MACRO_ROLE).catch(err => console.error("❌ removeRole err:", err));
          console.log(`🧹 Removed AUTO role from ${member.user.tag}`);
        }
      }
    } catch (err) {
      console.error("❌ Role update error:", err);
    }
  }

  // ----- Helper: gửi thông báo cho owner (nếu có) -----
  async function sendNotify(channel, type) {
    try {
      const userId = channel.topic?.match(/\d{17,20}/)?.[0];
      if (!userId) return;
      if (type === "sleep") {
        await channel.send(
          `<@${userId}>\nKênh macro của bạn đã bị **chuyển về danh mục NGỦ** do webhook chưa đạt yêu cầu hoạt động.`
        ).catch(() => {});
      } else if (type === "active") {
        await channel.send(
          `<@${userId}>\nKênh macro của bạn đã được **mở lại** do webhook vừa hoạt động.`
        ).catch(() => {});
      }
    } catch (err) {
      console.error("❌ Error sending notify:", err);
    }
  }

  // ----- Khi bot sẵn sàng: bật hệ thống cảnh báo webhook (dùng webhookTracker.checkWebhookWarnings) -----
  client.on("ready", () => {
    console.log("Webhook warning system active (hourly).");
    // Chạy ngay 1 lần và sau đó mỗi giờ
    (async () => {
      try {
        await checkWebhookWarnings(client, WARN_LOG_CHANNEL, SLEEP_CATEGORY_ID);
      } catch (e) {
        console.error("❌ Initial checkWebhookWarnings error:", e);
      }
    })();

    setInterval(() => {
      checkWebhookWarnings(client, WARN_LOG_CHANNEL, SLEEP_CATEGORY_ID).catch(err =>
        console.error("❌ checkWebhookWarnings err:", err)
      );
    }, CHECK_WARN_INTERVAL_MS);
  });

  // ===== Khi có message mới =====
  client.on("messageCreate", async (message) => {
    try {
      // Chỉ xử lý message từ webhook (webhook-first)
      if (!message.webhookId) return;
      const webhookId = message.webhookId;
      const channel = message.channel;
      if (!channel || channel.type !== 0) return;

      // Cập nhật activity (ghi vào file webhookActivity.json)
      try {
        updateWebhookActivity(webhookId);
      } catch (e) {
        console.error("❌ updateWebhookActivity error:", e);
      }

      // Gán tag tạm lên channel để checkWebhookWarnings có thể tìm kênh theo webhookId
      try {
        // lưu tạm; không tồn tại persistent field chính thức nhưng đủ để tìm bằng `.find`
        channel.lastWebhookId = webhookId;
      } catch (e) {
        // ignore
      }

      console.log(`[webhook] detected in ${channel.guild?.name || "guild"} / ${channel.name} (webhook=${webhookId})`);

      // Nếu channel đang ở SLEEP_CATEGORY, đưa về ACTIVE ngay
      if (channel.parentId === SLEEP_CATEGORY_ID) {
        try {
          await channel.setParent(ACTIVE_CATEGORY_ID, { lockPermissions: false }).catch(err => {
            console.error("❌ setParent error (to ACTIVE):", err, "channelId:", channel.id);
          });
          // chờ nhẹ để Discord apply parent trước khi rename
          await new Promise(r => setTimeout(r, 400));
          await renameChannelByCategory(channel);
          await updateRoleByCategory(channel, true);
          await sendNotify(channel, "active");
          console.log(`🔄 Reactivated (webhook): ${channel.name}`);
        } catch (e) {
          console.error("❌ Error reactivating channel on webhook:", e);
        }
      } else {
        // nếu đã ở ACTIVE_CATEGORY thì đảm bảo tên và role OK
        try {
          if (channel.parentId === ACTIVE_CATEGORY_ID) {
            await renameChannelByCategory(channel).catch(() => {});
            await updateRoleByCategory(channel, true);
          }
        } catch (e) {
          console.error("❌ post-webhook housekeeping err:", e);
        }
      }
    } catch (err) {
      console.error("❌ messageCreate (webhook) error:", err);
    }
  });

  // ===== Khi kênh được tạo =====
  client.on("channelCreate", async (channel) => {
    try {
      await renameChannelByCategory(channel);
      if (channel.parentId === ACTIVE_CATEGORY_ID) {
        await updateRoleByCategory(channel, true);
      } else if (channel.parentId === SLEEP_CATEGORY_ID) {
        await updateRoleByCategory(channel, false);
      }
    } catch (err) {
      console.error("❌ channelCreate error:", err);
    }
  });

  // ===== Khi kênh chuyển danh mục (rename theo category) =====
  client.on("channelUpdate", async (oldCh, newCh) => {
    try {
      if (!newCh || newCh.type !== 0) return;

      // Nếu đổi parent thì xử lý rename + role + notify
      if (oldCh.parentId !== newCh.parentId) {
        await renameChannelByCategory(newCh).catch(() => {});
        if (newCh.parentId === ACTIVE_CATEGORY_ID) {
          await updateRoleByCategory(newCh, true).catch(() => {});
          await sendNotify(newCh, "active").catch(() => {});
        } else if (newCh.parentId === SLEEP_CATEGORY_ID) {
          await updateRoleByCategory(newCh, false).catch(() => {});
          await sendNotify(newCh, "sleep").catch(() => {});
        }
        console.log(`🪄 ChannelUpdate: ${newCh.name} category changed`);
      } else {
        // nếu chỉ đổi tên topic/permission, vẫn đảm bảo prefix nếu cần
        try {
          if (newCh.parentId === ACTIVE_CATEGORY_ID) {
            if (!newCh.name.startsWith("🛠★】")) {
              await newCh.setName("🛠★】" + newCh.name.replace(/^.*?】/, "")).catch(() => {});
            }
          } else if (newCh.parentId === SLEEP_CATEGORY_ID) {
            if (!newCh.name.startsWith("⏰★】")) {
              await newCh.setName("⏰★】" + newCh.name.replace(/^.*?】/, "")).catch(() => {});
            }
          }
        } catch (e) {
          // ignore small rename errors
        }
      }
    } catch (err) {
      console.error("❌ channelUpdate error:", err);
    }
  });

  // ===== Khi kênh bị xóa: (cleanup bất kỳ property tạm) =====
  client.on("channelDelete", (channel) => {
    try {
      if (channel && channel.id && channel.lastWebhookId) {
        // nothing persistent to clean but log
        console.log(`🗑️ Channel deleted ${channel.name || channel.id} (had lastWebhookId)`);
      }
    } catch (e) {}
  });
};
