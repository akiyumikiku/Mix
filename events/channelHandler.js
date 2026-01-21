// events/channelHandler.js

const { safeRename } = require("../functions/rename");
const { getCache, setCache } = require("../utils/cacheManager");
const { EmbedBuilder } = require("discord.js");

// ===============================
// ⏰ CONSTANTS
// ===============================
const VN_OFFSET = 7 * 60 * 60 * 1000;
const CHECK_HOUR_VN = 13;
const WEBHOOK_MIN_HOURS = 6;
const REPORT_CHANNEL_ID = "1438039815919632394";

// Biome keywords → badge + category
const BIOMES = {
  DREAM: { badge: "🌸", category: "1445997821336748155" },
  CYBER: { badge: "🌐", category: "1446077580615880735" },
  GLITCH:{ badge: "🧩", category: "1445997659948060712" },
};

// ===============================
// 🧠 TIME UTILS
// ===============================
function getToday13VN() {
  const now = new Date(Date.now() + VN_OFFSET);
  now.setHours(CHECK_HOUR_VN, 0, 0, 0);
  return now.getTime();
}

function getYesterday13VN() {
  return getToday13VN() - 24 * 60 * 60 * 1000;
}

// ===============================
// 🔎 FIND BIOMES FROM @everyone
// ===============================
async function detectBiomes(channel) {
  const messages = await channel.messages.fetch({ limit: 50 });
  const everyoneMsg = messages.find(m => m.content.includes("@everyone"));
  if (!everyoneMsg) return [];

  const around = messages.filter(m =>
    Math.abs(m.createdTimestamp - everyoneMsg.createdTimestamp) < 30 * 60 * 1000
  );

  const found = new Set();

  for (const msg of around.values()) {
    for (const embed of msg.embeds ?? []) {
      const text = `${embed.title || ""} ${embed.description || ""}`.toUpperCase();
      for (const key of Object.keys(BIOMES)) {
        if (text.includes(key)) found.add(key);
      }
    }
  }

  return [...found];
}

// ===============================
// 🔁 DAILY CHECK CORE
// ===============================
async function dailyCheck(client) {
  const now = Date.now();
  const today13 = getToday13VN();
  const lastRun = getCache("lastDailyCheck") || 0;

  if (lastRun >= today13) return; // đã chạy hôm nay

  console.log("⏰ Running 13:00 VN daily check...");
  setCache("lastDailyCheck", today13);

  for (const guild of client.guilds.cache.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (!channel.isTextBased()) continue;

      // ===== WEBHOOK ACTIVITY =====
      const msgs = await channel.messages.fetch({ limit: 100 });
      const webhooks = msgs.filter(m => m.webhookId);

      if (webhooks.size > 0) {
        const oldest = Math.min(...webhooks.map(m => m.createdTimestamp));
        const activeHours = (today13 - oldest) / 36e5;

        if (activeHours >= WEBHOOK_MIN_HOURS) {
          const streakKey = `streak_${channel.id}`;
          const streak = (getCache(streakKey) || 0) + 1;
          setCache(streakKey, streak);
          await safeRename(channel, streak, []);
        }
      }

      // ===== BIOME DETECTION =====
      const biomeKeys = await detectBiomes(channel);
      if (biomeKeys.length > 0) {
        const badges = biomeKeys.map(k => BIOMES[k].badge);

        // move theo biome đầu tiên
        const main = BIOMES[biomeKeys[0]];
        if (channel.parentId !== main.category) {
          await channel.setParent(main.category).catch(() => {});
        }

        await safeRename(channel, getCache(`streak_${channel.id}`) || 0, badges);
      }
    }
  }

  await sendReport(client);
}

// ===============================
// 📊 REPORT EMBED
// ===============================
async function sendReport(client) {
  const channel = await client.channels.fetch(REPORT_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("📊 DAILY WEBHOOK REPORT")
    .setColor(0x2f3136)
    .setDescription("Báo cáo hoạt động webhook & biome")
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

// ===============================
// 🧩 EXPORT EVENT
// ===============================
module.exports = (client) => {
  client.on("ready", async () => {
    await dailyCheck(client);
    setInterval(() => dailyCheck(client), 60 * 1000);
  });
};
