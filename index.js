// ===============================
// 🧠 CACHE MANAGER TÍCH HỢP
// ===============================
const { loadCache, saveCache } = require('./utils/cacheManager');

// ✅ Khi bot khởi động → tải lại cache
loadCache();

// ✅ Khi bot tắt → tự động lưu cache
process.on('exit', saveCache);
process.on('SIGINT', () => { saveCache(); process.exit(); });
process.on('SIGTERM', () => { saveCache(); process.exit(); });


// ===============================
// 🤖 DISCORD BOT CHÍNH
// ===============================
const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
} = require("discord.js");
require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");

// === Import auto role updater (tùy chọn) ===
const { initRoleUpdater } = require("./functions/updateRoles");

// ==== Tạo Discord client ====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.GuildMember,
    Partials.Reaction,
  ],
});

client.commands = new Collection();


// ===============================
// 📦 LOAD COMMANDS
// ===============================
const commandsPath = path.join(__dirname, "commands");
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));
  for (const file of commandFiles) {
    try {
      const command = require(`./commands/${file}`);
      if (command.data && command.data.name) {
        client.commands.set(command.data.name, command);
      } else {
        console.warn(`⚠️ Command ${file} thiếu "data.name"`);
      }
    } catch (err) {
      console.error(`❌ Lỗi khi load command ${file}:`, err);
    }
  }
} else {
  console.warn("⚠️ Không tìm thấy thư mục 'commands'");
}


// ===============================
// ⚙️ LOAD EVENTS
// ===============================
const eventsPath = path.join(__dirname, "events");
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith(".js"));
  for (const file of eventFiles) {
    try {
      const event = require(`./events/${file}`);
      if (typeof event === "function") {
        event(client);
        console.log(`✅ Loaded event: ${file}`);
      } else {
        console.warn(`⚠️ Event ${file} không export function`);
      }
    } catch (err) {
      console.error(`❌ Lỗi khi load event ${file}:`, err);
    }
  }
} else {
  console.warn("⚠️ Không tìm thấy thư mục 'events'");
}


// ===============================
// 🟢 BOT READY
// ===============================
client.once("ready", async () => {
  console.log(`✅ Bot đã đăng nhập: ${client.user.tag}`);
  
  // Chạy auto role updater (nếu có)
  if (typeof initRoleUpdater === 'function') {
    await initRoleUpdater(client);
  }

  // ✅ Quét 1 lần khi restart (ví dụ cập nhật dữ liệu)
  client.emit("cacheReload");
});


// ===============================
// 🌐 KEEP ALIVE SERVER
// ===============================
const app = express();
app.get("/", (req, res) => res.send("Bot vẫn online! ✅"));
app.listen(process.env.PORT || 3000, () => console.log("🌐 Keep-alive server chạy"));


// ===============================
// ⚠️ GIỮ BOT KHỎE VÀ ỔN ĐỊNH
// ===============================
client.on("reconnecting", () => console.warn("🔁 Discord reconnecting..."));
client.on("resume", (replayed) => console.log(`🔄 Reconnected, replayed ${replayed} events.`));
client.on("error", (err) => console.error("❌ Discord client error:", err));
client.on("disconnect", (event) => console.warn("⚠️ Discord disconnected:", event));
client.on("shardError", (error) => console.error("💥 Websocket shard error:", error));
client.on("shardDisconnect", (event, shardId) => console.warn(`⚠️ Shard ${shardId} disconnected:`, event));

process.on("unhandledRejection", (reason) => {
  console.error("🚨 Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("🔥 Uncaught Exception:", err);
  setTimeout(() => process.exit(1), 2000);
});

// Auto-check health mỗi 60s
setInterval(() => {
  try {
    if (!client || !client.uptime) {
      console.warn("⏰ client.uptime missing — forcing restart");
      return process.exit(1);
    }

    const ping = client.ws?.ping;
    if (typeof ping === "number" && ping > 10000) {
      console.warn(`⏰ High gateway ping (${ping} ms). Restarting...`);
      return process.exit(1);
    }
  } catch (err) {
    console.error("Lỗi trong health-check interval:", err);
    process.exit(1);
  }
}, 60_000);

// ===============================
// ♻️ AUTO RESTART + CACHE SAVE
// ===============================

// 🕒 Thời gian bot tự restart (tính theo giờ)
const RESTART_INTERVAL_HOURS = 168; // 1 tuần = 168 giờ
const RESTART_INTERVAL_MS = RESTART_INTERVAL_HOURS * 60 * 60 * 1000;
console.log(`🕒 Bot sẽ tự restart sau ${RESTART_INTERVAL_HOURS} tiếng (~1 tuần).`);

// 👉 Hàm restart an toàn (lưu cache trước khi thoát)
async function safeRestart() {
  console.log(`🕒 Đã đủ ${RESTART_INTERVAL_HOURS} tiếng — chuẩn bị restart bot...`);
  console.log("💾 Đang lưu cache trước khi restart...");

  try {
    await saveCache(); // gọi hàm từ cacheManager
    console.log("✅ Cache đã lưu xong!");
  } catch (err) {
    console.error("⚠️ Lỗi khi lưu cache:", err);
  }

  console.log("♻️ Đang khởi động lại tiến trình...");
  process.exit(0); // Render sẽ tự khởi động lại container
}

// ⏰ Bộ hẹn giờ restart tự động
setInterval(safeRestart, RESTART_INTERVAL_MS);

// ===============================
// 🚦 XỬ LÝ TẮT AN TOÀN (KHI NHẬN TÍN HIỆU)
// ===============================
process.on('SIGINT', async () => {
  console.log("⚠️ Nhận tín hiệu SIGINT → Lưu cache & thoát an toàn.");
  await saveCache();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log("⚠️ Nhận tín hiệu SIGTERM → Lưu cache & thoát an toàn.");
  await saveCache();
  process.exit(0);
});

// ===============================
// 🔑 LOGIN DISCORD
// ===============================
client.login(process.env.TOKEN);
