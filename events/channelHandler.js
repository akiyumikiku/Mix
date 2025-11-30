// events/channelHandler.js
const fs = require("fs");
const path = require("path");
const { updateWebhookActivity, checkWebhookWarnings, resetStreak } = require("../functions/webhookTracker");
const { renameChannelByCategory } = require("../functions/rename");

// ====== Cấu hình ======
const ACTIVE_CATEGORY_ID = "1411034825699233943"; // danh mục hoạt động
const SLEEP_CATEGORY_ID = "1427958263281881088";  // danh mục ngủ
const WARN_LOG_CHANNEL = "ID_KENH_LOG_CANH_CAO";  // nếu có
const AUTO_ROLE = "1411991634194989096";         // role auto
const CHECK_WARN_INTERVAL_MS = 60 * 60 * 1000;   // 1 giờ
const PROCESS_COOLDOWN_MS = 2500; // 2.5s: chặn xử lý lặp trên cùng 1 channel

const DATA_FILE = path.join(__dirname, "..", "data", "webhookActivity.json");

// ----- runtime cooldown map: channelId -> lastProcessedTs
const channelCooldown = new Map();

function shouldSkipChannel(channelId) {
  const last = channelCooldown.get(channelId) || 0;
  const now = Date.now();
  if (now - last < PROCESS_COOLDOWN_MS) return true;
  channelCooldown.set(channelId, now);
  return false;
}

function loadWebhookData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw || "{}");
  } catch (e) {
    console.error("❌ loadWebhookData error:", e);
    return {};
  }
}

async function findMemberByChannel(channel, usernameGuess) {
  if (!channel || !channel.guild) return null;
  const topic = channel.topic || "";
  const topicUserId = topic.match(/\d{17,20}/)?.[0];
  if (topicUserId) {
    const m = await channel.guild.members.fetch(topicUserId).catch(() => null);
    if (m) return m;
  }
  if (usernameGuess) {
    const found = channel.guild.members.cache.find(m => {
      return (m.user.username && m.user.username.toLowerCase() === usernameGuess.toLowerCase())
        || (m.nickname && m.nickname.toLowerCase() === usernameGuess.toLowerCase());
    });
    if (found) return found;
  }
  return null;
}

async function updateRoleByCategory(channel, addRole) {
  try {
    const username = channel.name.replace(/.*】/g, "").replace(/〔\d+🔥〕/g, "").replace("-macro", "");
    const member = await findMemberByChannel(channel, username);
    if (!member) return false;
    if (addRole) {
      if (!member.roles.cache.has(AUTO_ROLE)) {
        await member.roles.add(AUTO_ROLE).catch(err => console.error("❌ addRole err:", err));
        console.log(`✅ Added AUTO role to ${member.user.tag}`);
      }
    } else {
      if (member.roles.cache.has(AUTO_ROLE)) {
        await member.roles.remove(AUTO_ROLE).catch(err => console.error("❌ removeRole err:", err));
        console.log(`🧹 Removed AUTO role from ${member.user.tag}`);
      }
    }
    return true;
  } catch (err) {
    console.error("❌ Role update error:", err);
    return false;
  }
}

async function sendNotify(channel, type) {
  try {
    const username = channel.name.replace(/.*】/g, "").replace(/〔\d+🔥〕/g, "").replace("-macro", "");
    const member = await findMemberByChannel(channel, username);
    if (!member) return;
    if (type === "sleep") {
      await channel.send(`<@${member.id}>\nKênh macro của bạn đã được chuyển về **NGỦ** (do inactivity).`).catch(() => {});
    } else if (type === "active") {
      await channel.send(`<@${member.id}>\nKênh macro của bạn đã được **mở lại** do webhook hoạt động.`).catch(() => {});
    } else if (type === "reset") {
      await channel.send(`<@${member.id}>\nChuỗi hoạt động của bạn đã bị **reset** do lâu không hoạt động.`).catch(() => {});
    }
  } catch (e) {
    console.error("❌ sendNotify err:", e);
  }
}

// READY: start hourly warnings (keeps existing behavior)
module.exports = (client) => {
  console.log("[ChannelHandler] loaded (webhook-first, streak-enabled, debounce)");

  client.on("ready", () => {
    console.log("Webhook warning system active (hourly).");
    checkWebhookWarnings(client, WARN_LOG_CHANNEL, SLEEP_CATEGORY_ID).catch(() => {});
    setInterval(() => {
      checkWebhookWarnings(client, WARN_LOG_CHANNEL, SLEEP_CATEGORY_ID).catch(err => console.error("❌ checkWebhookWarnings err:", err));
    }, CHECK_WARN_INTERVAL_MS);
  });

  // MESSAGE CREATE: webhook embed only
  client.on("messageCreate", async (message) => {
    try {
      if (!message.webhookId) return;
      if (!message.channel || message.channel.type !== 0) return;
      if (!message.embeds || message.embeds.length === 0) return;

      const channel = message.channel;
      const webhookId = message.webhookId;
      const name = channel.name || "";

      // chỉ kênh macro và thuộc 2 category macro
      if (!name.includes("-macro")) return;
      if (![ACTIVE_CATEGORY_ID, SLEEP_CATEGORY_ID].includes(channel.parentId)) return;

      // debounce
      if (shouldSkipChannel(channel.id)) {
        // tránh xử lý lặp do setName/setParent trigger
        return;
      }

      // cập nhật activity (persist mapping channelId bên trong)
      const { added, streak, wasReset } = updateWebhookActivity(webhookId, channel.id);

      // runtime tag (không persist trên disk)
      try { channel.lastWebhookId = webhookId; } catch (e) {}

      // Nếu đã reset do inactivity
      if (wasReset) {
        const username = name.replace(/.*】/g, "").replace(/〔\d+🔥〕/g, "").replace("-macro", "").trim();
        const baseName = `🛠★】${username}-macro`;
        if (channel.name !== baseName) {
          await channel.setName(baseName).catch(err => console.error("❌ setName reset err:", err));
        }
        await updateRoleByCategory(channel, false);
        await sendNotify(channel, "reset");
        console.log(`🔁 Reset streak for webhook ${webhookId} (channel ${channel.name})`);
      }

      // Nếu tăng streak
      if (added) {
        const username = name.replace(/.*】/g, "").replace(/〔\d+🔥〕/g, "").replace("-macro", "").trim();
        const newName = `🛠★】〔${streak}🔥〕${username}-macro`;
        if (channel.name !== newName) {
          await channel.setName(newName).catch(err => console.error("❌ setName streak err:", err));
          console.log(`+1 streak -> ${newName}`);
        }
      } else {
        // đảm bảo prefix phù hợp
        try {
          if (channel.parentId === ACTIVE_CATEGORY_ID && !channel.name.startsWith("🛠★】")) {
            await channel.setName("🛠★】" + name.replace(/^.*?】/, "")).catch(() => {});
          } else if (channel.parentId === SLEEP_CATEGORY_ID && !channel.name.startsWith("⏰★】")) {
            await channel.setName("⏰★】" + name.replace(/^.*?】/, "")).catch(() => {});
          }
        } catch (e) {}
      }

      // Luôn re-activate (nếu đang ngủ)
      if (channel.parentId === SLEEP_CATEGORY_ID) {
        // setParent only if different
        try {
          await channel.setParent(ACTIVE_CATEGORY_ID, { lockPermissions: false }).catch(err => console.error("❌ setParent to ACTIVE err:", err));
          await new Promise(r => setTimeout(r, 400));
          await renameChannelByCategory(channel).catch(() => {});
          await updateRoleByCategory(channel, true);
          await sendNotify(channel, "active").catch(() => {});
          console.log(`🔄 Reactivated (webhook): ${channel.name}`);
        } catch (e) {
          console.error("❌ reactivate err:", e);
        }
      } else {
        // ensure role present
        await updateRoleByCategory(channel, true);
      }

    } catch (err) {
      console.error("❌ messageCreate handler err:", err);
    }
  });

  // CHANNEL CREATE: init name + role
  client.on("channelCreate", async (channel) => {
    try {
      await renameChannelByCategory(channel).catch(() => {});
      if (![ACTIVE_CATEGORY_ID, SLEEP_CATEGORY_ID].includes(channel.parentId)) return;
      if (channel.parentId === ACTIVE_CATEGORY_ID) await updateRoleByCategory(channel, true);
      else if (channel.parentId === SLEEP_CATEGORY_ID) await updateRoleByCategory(channel, false);
    } catch (err) {
      console.error("❌ channelCreate err:", err);
    }
  });

  // CHANNEL UPDATE: xử lý khi parent đổi — debounce + check before act
  client.on("channelUpdate", async (oldCh, newCh) => {
    try {
      if (!oldCh || !newCh) return;
      // nếu không đổi parent & không đổi name thì skip
      if (oldCh.parentId === newCh.parentId && oldCh.name === newCh.name) return;

      // debounce
      if (shouldSkipChannel(newCh.id)) return;

      // chỉ xử lý khi parent thay đổi
      if (oldCh.parentId !== newCh.parentId) {
        // chuyển vào danh mục NGỦ => reset streak + remove role + reset tên
        if (newCh.parentId === SLEEP_CATEGORY_ID) {
          // tìm webhookId bằng channelId (đọc file tươi)
          const data = loadWebhookData();
          const entry = Object.entries(data).find(([k, v]) => v && v.channelId === newCh.id);
          if (entry) {
            const webhookId = entry[0];
            resetStreak(webhookId);
            console.log(`🔁 resetStreak for webhook ${webhookId} because channel moved to SLEEP`);
          } else {
            console.log(`⚠️ no webhook mapping found for channel ${newCh.id} when moved to SLEEP`);
          }

          // reset tên (nếu cần)
          const username = newCh.name.replace(/.*】/g, "").replace(/〔\d+🔥〕/g, "").replace("-macro", "").trim();
          const baseName = `⏰★】${username}-macro`;
          if (newCh.name !== baseName) {
            await newCh.setName(baseName).catch(() => {});
          }

          await updateRoleByCategory(newCh, false);
          await sendNotify(newCh, "sleep");
          console.log(`📦 Moved ${newCh.name} → DORMANT (manual move)`);
        } else if (newCh.parentId === ACTIVE_CATEGORY_ID) {
          // moved to active: ensure role and name prefix
          if (!newCh.name.startsWith("🛠★】")) {
            await newCh.setName("🛠★】" + newCh.name.replace(/^.*?】/, "")).catch(() => {});
          }
          await updateRoleByCategory(newCh, true);
          await sendNotify(newCh, "active");
          console.log(`🔛 Moved ${newCh.name} → ACTIVE (manual move)`);
        }
      } else {
        // parent same, but name changed — ignore unless needed
      }
    } catch (err) {
      console.error("❌ channelUpdate err:", err);
    }
  });

  // MESSAGE UPDATE: nếu message update có embed thì tương tự messageCreate
  client.on("messageUpdate", async (oldMsg, newMsg) => {
    try {
      if (!newMsg || !newMsg.webhookId) return;
      if (!newMsg.embeds || newMsg.embeds.length === 0) return;
      const channel = newMsg.channel;
      if (!channel || !channel.name || !channel.name.includes("-macro")) return;

      if (shouldSkipChannel(channel.id)) return;

      const { added, streak, wasReset } = updateWebhookActivity(newMsg.webhookId, channel.id);
      if (wasReset) {
        const username = channel.name.replace(/.*】/g, "").replace(/〔\d+🔥〕/g, "").replace("-macro", "").trim();
        await channel.setName(`🛠★】${username}-macro`).catch(() => {});
        await updateRoleByCategory(channel, false);
        await sendNotify(channel, "reset");
      }
      if (added) {
        const username = channel.name.replace(/.*】/g, "").replace(/〔\d+🔥〕/g, "").replace("-macro", "").trim();
        await channel.setName(`🛠★】〔${streak}🔥〕${username}-macro`).catch(() => {});
      }
      if (channel.parentId === SLEEP_CATEGORY_ID) {
        await channel.setParent(ACTIVE_CATEGORY_ID, { lockPermissions: false }).catch(() => {});
        await renameChannelByCategory(channel).catch(()=>{});
        await updateRoleByCategory(channel, true);
        await sendNotify(channel, "active");
      } else {
        await updateRoleByCategory(channel, true);
      }
    } catch (e) {
      console.error("❌ messageUpdate handler err:", e);
    }
  });

  client.on("channelDelete", (channel) => {
    try { console.log(`🗑️ Channel deleted: ${channel?.name || channel?.id}`); } catch(e){}
  });
};
