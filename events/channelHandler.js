const { renameChannelByCategory } = require("../functions/rename");

const CATEGORY_1 = "1411034825699233943"; // danh mục hoạt động
const CATEGORY_2 = "1427958263281881088"; // danh mục ngủ
const INACTIVITY_TIME = 1000 * 60 * 60 * 24; // 1 ngày
const AUTO_ROLE_ID = "1411991634194989096"; // role auto add

module.exports = (client) => {
  const inactivityTimers = new Map();
  const renameQueue = new Map();

  async function safeRename(channel, fn) {
    const last = renameQueue.get(channel.id) || Promise.resolve();
    const next = last.then(async () => {
      await fn().catch(() => {});
    });
    renameQueue.set(channel.id, next);
    await next;
  }

  client.once("ready", () => {
    inactivityTimers.clear();
    console.log("🧹 Dọn sạch timer khi bot khởi động!");
  });

  // ===============================
  // 📩 Khi webhook gửi tin
  // ===============================
  client.removeAllListeners("messageCreate");
  client.on("messageCreate", async (msg) => {
    try {
      if (!msg.webhookId) return;
      const channel = msg.channel;
      if (!channel || !channel.parentId) return;

      if (inactivityTimers.has(channel.id)) clearTimeout(inactivityTimers.get(channel.id));

      await safeRename(channel, async () => {
        if (channel.parentId === CATEGORY_2) {
          const perms = channel.permissionOverwrites.cache.map(p => [p.id, p.allow.bitfield, p.deny.bitfield]);
          await channel.setParent(CATEGORY_1, { lockPermissions: false });
          for (const [id, allow, deny] of perms) {
            await channel.permissionOverwrites.edit(id, { allow, deny }).catch(() => {});
          }
          await renameChannelByCategory(channel);
          console.log(`🔄 Webhook mới → ${channel.name} về danh mục hoạt động`);

          // Thêm lại role nếu có topic
          if (channel.topic) {
            const [userId] = channel.topic.split(" ");
            const member = await channel.guild.members.fetch(userId).catch(() => null);
            const role = channel.guild.roles.cache.get(AUTO_ROLE_ID);
            if (member && role && !member.roles.cache.has(role.id)) {
              await member.roles.add(role).catch(() => {});
            }
          }
        }
      });

      const timer = setTimeout(async () => {
        try {
          await safeRename(channel, async () => {
            if (channel.parentId === CATEGORY_1) {
              const perms = channel.permissionOverwrites.cache.map(p => [p.id, p.allow.bitfield, p.deny.bitfield]);
              await channel.setParent(CATEGORY_2, { lockPermissions: false });
              for (const [id, allow, deny] of perms) {
                await channel.permissionOverwrites.edit(id, { allow, deny }).catch(() => {});
              }
              await renameChannelByCategory(channel);
              console.log(`💤 ${channel.name} không hoạt động 24h → chuyển danh mục ngủ`);

              // Xóa role và gửi tin nhắn
              if (channel.topic) {
                const [userId] = channel.topic.split(" ");
                const member = await channel.guild.members.fetch(userId).catch(() => null);
                const role = channel.guild.roles.cache.get(AUTO_ROLE_ID);
                if (member && role && member.roles.cache.has(role.id)) {
                  await member.roles.remove(role).catch(() => {});
                }
                await channel.send({
                  content: `<@${userId}>\nYour macro channel has been moved to the **sleeping** category because it has been inactive for a day.`
                }).catch(() => {});
              }
            }
          });
        } catch (err) {
          console.error("❌ Timer lỗi:", err.message);
        }
      }, INACTIVITY_TIME);

      inactivityTimers.set(channel.id, timer);

    } catch (err) {
      console.error("❌ messageCreate lỗi:", err.message);
    }
  });

  // ===============================
  // 🆕 Khi channel được tạo
  // ===============================
  client.removeAllListeners("channelCreate");
  client.on("channelCreate", async (channel) => {
    try {
      await safeRename(channel, async () => {
        await renameChannelByCategory(channel);
      });

      if (channel.parentId === CATEGORY_1) {
        const timer = setTimeout(async () => {
          try {
            await safeRename(channel, async () => {
              const perms = channel.permissionOverwrites.cache.map(p => [p.id, p.allow.bitfield, p.deny.bitfield]);
              await channel.setParent(CATEGORY_2, { lockPermissions: false });
              for (const [id, allow, deny] of perms) {
                await channel.permissionOverwrites.edit(id, { allow, deny }).catch(() => {});
              }
              await renameChannelByCategory(channel);
              console.log(`💤 ${channel.name} không hoạt động 24h → chuyển danh mục ngủ`);

              if (channel.topic) {
                const [userId] = channel.topic.split(" ");
                const member = await channel.guild.members.fetch(userId).catch(() => null);
                const role = channel.guild.roles.cache.get(AUTO_ROLE_ID);
                if (member && role && member.roles.cache.has(role.id)) {
                  await member.roles.remove(role).catch(() => {});
                }
                await channel.send({
                  content: `<@${userId}>\nYour macro channel has been moved to the **sleeping** category because it has been inactive for a day.`
                }).catch(() => {});
              }
            });
          } catch (err) {
            console.error("❌ Timer channelCreate lỗi:", err.message);
          }
        }, INACTIVITY_TIME);
        inactivityTimers.set(channel.id, timer);
      }

    } catch (err) {
      console.error("❌ channelCreate lỗi:", err.message);
    }
  });

  // ===============================
  // ⚙️ Khi channel đổi danh mục (thủ công hoặc bot)
  // ===============================
  client.removeAllListeners("channelUpdate");
  client.on("channelUpdate", async (oldCh, newCh) => {
    try {
      if (!newCh || newCh.type !== 0) return;
      if (oldCh.parentId === newCh.parentId) return;

      await safeRename(newCh, async () => {
        const perms = newCh.permissionOverwrites.cache.map(p => [p.id, p.allow.bitfield, p.deny.bitfield]);
        await renameChannelByCategory(newCh);

        // Giữ nguyên quyền
        for (const [id, allow, deny] of perms) {
          await newCh.permissionOverwrites.edit(id, { allow, deny }).catch(() => {});
        }

        // Quản lý role và gửi tin nhắn
        if (newCh.topic) {
          const [userId] = newCh.topic.split(" ");
          const member = await newCh.guild.members.fetch(userId).catch(() => null);
          const role = newCh.guild.roles.cache.get(AUTO_ROLE_ID);

          if (newCh.parentId === CATEGORY_2) {
            if (member && role && member.roles.cache.has(role.id)) {
              await member.roles.remove(role).catch(() => {});
            }
            await newCh.send({
              content: `<@${userId}>\nYour macro channel has been moved to the **sleeping** category because it has been inactive for a day.`
            }).catch(() => {});
          } else if (newCh.parentId === CATEGORY_1) {
            if (member && role && !member.roles.cache.has(role.id)) {
              await member.roles.add(role).catch(() => {});
            }
            await newCh.send({
              content: `<@${userId}>\nYour macro channel has been moved back to the **active** category.`
            }).catch(() => {});
          }
        }

        console.log(`🪄 ChannelUpdate: ${newCh.name} đổi danh mục`);
      });
    } catch (err) {
      console.error("❌ channelUpdate lỗi:", err.message);
    }
  });

  // ===============================
  // ❌ Khi channel bị xóa
  // ===============================
  client.removeAllListeners("channelDelete");
  client.on("channelDelete", (channel) => {
    if (inactivityTimers.has(channel.id)) {
      clearTimeout(inactivityTimers.get(channel.id));
      inactivityTimers.delete(channel.id);
    }
    renameQueue.delete(channel.id);
  });
};
