// ===============================
// 🧠 CACHE MANAGER
// ===============================
const { loadCache, saveCache } = require("./utils/cacheManager");

loadCache();

const safeExit = async (code = 0) => {
  try {
    await saveCache();
  } catch (e) {
    console.error("⚠️ Lỗi khi lưu cache:", e);
  }
  process.exit(code);
};

process.on("exit", saveCache);
process.on("SIGINT", () => safeExit(0));
process.on("SIGTERM", () => safeExit(0));


// ===============================
// 🤖 DISCORD CORE
// ===============================
require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
} = require("discord.js");

const express = require("express");
const fs = require("fs");
const path = require("path");

// ===============================
// 🔌 IMPORT MODULES (FILE RIÊNG)
// ===============================
const { initPermissionSystem } = require("./functions/permissionSystem");
const { initRoleUpdater } = require("./functions/updateRoles");


// ===============================
// 🚀 CREATE CLIENT
// ===============================
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
  for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"))) {
    try {
      const command = require(`./commands/${file}`);
      if (command?.data?.name) {
        client.commands.set(command.data.name, command);
      } else {
        console.warn(`⚠️ Command ${file} thiếu data.name`);
      }
    } catch (err) {
      console.error(`❌ Load command ${file} lỗi:`, err);
    }
  }
}


// ===============================
// ⚙️ LOAD EVENTS
// ===============================
const eventsPath = path.join(__dirname, "events");
if (fs.existsSync(eventsPath)) {
  for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith(".js"))) {
    try {
      const event = require(`./events/${file}`);
      if (typeof event === "function") {
        event(client);
      }
    } catch (err) {
      console.error(`❌ Load event ${file} lỗi:`, err);
    }
  }
}


// ===============================
// 🟢 READY – INIT MODULES
// ===============================
client.once("ready", async () => {
  console.log(`✅ Bot đăng nhập: ${client.user.tag}`);

  // 1️⃣ Init permission / counter system
  try {
    if (typeof initPermissionSystem === "function") {
      initPermissionSystem(client);
      console.log("🔐 Permission system initialized");
    } else {
      console.warn("⚠️ initPermissionSystem không phải function");
    }
  } catch (err) {
    console.error("❌ Permission system error:", err.stack || err);
  }

  // 2️⃣ Init auto role updater (nếu có)
  try {
    if (typeof initRoleUpdater === "function") {
      await initRoleUpdater(client);
      console.log("🔄 Role updater initialized");
    }
  } catch (err) {
    console.error("❌ Role updater error:", err.stack || err);
  }

  // 3️⃣ Custom event cho module khác (nếu cần)
  client.emit("systemReady");
});


// ===============================
// 🌐 KEEP ALIVE (CHỈ 1 LẦN DUY NHẤT)
// ===============================
const app = express();
app.get("/", (_, res) => res.send("Bot online ✅"));
app.listen(process.env.PORT || 3000, () =>
  console.log("🌐 Keep-alive server running")
);


// ===============================
// 🩺 HEALTH CHECK
// ===============================
setInterval(() => {
  try {
    if (!client?.uptime) {
      console.warn("⏰ client.uptime missing → restart");
      process.exit(1);
    }

    const ping = client.ws?.ping;
    if (typeof ping === "number" && ping > 10000) {
      console.warn(`⏰ Ping cao (${ping}ms) → restart`);
      process.exit(1);
    }
  } catch (err) {
    console.error("Health check error:", err);
    process.exit(1);
  }
}, 60_000);


// ===============================
// 🚨 GLOBAL ERROR HANDLING
// ===============================
process.on("unhandledRejection", reason => {
  console.error("🚨 UnhandledRejection:", reason);
});

process.on("uncaughtException", err => {
  console.error("🔥 UncaughtException:", err);
  setTimeout(() => process.exit(1), 2000);
});


// ===============================
// 🔑 LOGIN
// ===============================
if (!process.env.TOKEN) {
  console.error("❌ TOKEN không tồn tại trong .env");
  process.exit(1);
}

client.login(process.env.TOKEN).catch(err => {
  console.error("❌ Login failed:", err);
  process.exit(1);
});
