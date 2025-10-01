// ===== Discord Bot Full (Rename + Rules + Hide After 3 Days) =====
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  Partials,
} = require("discord.js");
require("dotenv").config();
const express = require("express");
const rules = require("./rules"); // file rules.js của bạn

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const CATEGORY_ID = process.env.CATEGORY_ID.trim();
const RULES_CHANNEL_ID = process.env.RULES_CHANNEL_ID;

const BASE_ROLE_ID = "1415319898468651008"; // base role
const AUTO_ROLE_ID = process.env.AUTO_ROLE_ID; // role thêm khi channel được tạo

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

// ===== Channel rename =====
async function renameChannel(channel) {
  if (channel.parentId !== CATEGORY_ID) return;
  if (!channel.name.endsWith("-webhook")) return;

  const username = channel.name.replace("-webhook", "");
  const newName = `🛠★】${username}-macro`;

  if (channel.name !== newName) {
    try {
      await channel.setName(newName);
      console.log(`✅ Đã đổi tên: ${channel.name} → ${newName}`);
    } catch (err) {
      console.error(`❌ Lỗi đổi tên ${channel.id}:`, err);
    }
  }
}

// ===== Timer cho hide channel =====
const channelTimers = new Map();
function startHideTimer(channel) {
  if (channelTimers.has(channel.id)) {
    clearTimeout(channelTimers.get(channel.id));
  }

  const timer = setTimeout(async () => {
    // Ẩn channel toàn bộ mọi role
    try {
      await channel.permissionOverwrites.set([
        { id: channel.guild.roles.everyone.id, deny: ["ViewChannel"] },
      ]);
      console.log(`🚫 Đã ẩn channel ${channel.name} sau 3 ngày không có tin nhắn`);
    } catch (err) {
      console.error(`❌ Lỗi ẩn channel ${channel.name}:`, err);
    }

    // Xóa role nếu có
    const userId = channel.topic?.match(/(\d{17,19})$/)?.[1];
    if (userId) {
      try {
        const member = await channel.guild.members.fetch(userId);
        const role = channel.guild.roles.cache.get(AUTO_ROLE_ID);
        if (member && role) await member.roles.remove(role);
      } catch (err) {
        console.error(`❌ Lỗi xóa role cho ${channel.name}:`, err);
      }
    }
  }, 1000 * 60 * 60 * 24 * 3); // 3 ngày

  channelTimers.set(channel.id, timer);
}

// ===== EVENTS =====
client.once("ready", async () => {
  console.log(`✅ Bot đã đăng nhập: ${client.user.tag}`);

  // Quét toàn bộ channel trong category để rename
  client.channels.cache
    .filter((ch) => ch.parentId === CATEGORY_ID)
    .forEach((ch) => renameChannel(ch));

  // Gửi menu rules nếu chưa có
  const channel = await client.channels.fetch(RULES_CHANNEL_ID);
  if (!channel) return console.log("❌ Không tìm thấy kênh rules");

  const messages = await channel.messages.fetch({ limit: 50 });
  const alreadySent = messages.find(
    (m) =>
      m.author.id === client.user.id &&
      m.components.length > 0 &&
      m.components[0].components[0].customId === "rules_menu"
  );

  if (!alreadySent) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("rules_menu")
      .setPlaceholder("Select rules you would like to see")
      .addOptions([
        { label: "1 Warning Rules", value: "opt1", description: "Rule violations that will get you 1 warn.", emoji: "⚠️" },
        { label: "Channel Misuses", value: "opt2", description: "Channel Misuse rules that will get you 1 warn.", emoji: "📢" },
        { label: "2 Warning Rules", value: "opt3", description: "Rule violations that will get you 2 warns.", emoji: "❌" },
        { label: "3 Warning Rules", value: "opt4", description: "Rule violations that will get you 3 warns.", emoji: "⚡" },
        { label: "Instant Ban Rules", value: "opt5", description: "Rule violations that will get you a ban.", emoji: "⛔" },
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    const mainEmbed = new EmbedBuilder()
      .setTitle("📜 Welcome to the Sol's RNG Communication rules channel!")
      .setDescription(
        "**This is where all the rules enforced on our Discord server are listed. Please read and follow them to ensure a pleasant experience for everyone!**\n\n" +
        "If there is anything confusing, you can go to the channel <#1411590263033561128> to contact the server administrators and ask questions.\n\n" +
        "⚠️ Warning Point & Punishment System:\n```\n" +
        " • 1 Warning Point  = no punishment  \n" +
        " • 2 Warning Points = 1h Mute \n" +
        " • 3 Warning Points = 12h Mute \n" +
        " • 4 warning Points = 1d Mute \n" +
        " • 5 warning Points = A ban \n" +
        " • Warning Points expire after 30 days\n" +
        "```\n\n" +
        "Thank you for reading and following! We always strive to develop the most civilized and prosperous Sol's RNG community in Southeast Asia!"
      )
      .setColor(0x2f3136)
      .setImage("https://media.discordapp.net/attachments/1411987904980586576/1412916875163209901/SOLS_RNG_COUMUNICATION.png")
      .setFooter({ text: "Sol's RNG Community" })
      .setTimestamp();

    await channel.send({ embeds: [mainEmbed], components: [row] });
    console.log("✅ Đã gửi menu rules mới.");
  }
});

// Khi channel mới được tạo
client.on("channelCreate", async (channel) => {
  if (channel.parentId !== CATEGORY_ID) return;

  await renameChannel(channel);

  // Add base role
  const userId = channel.topic?.match(/(\d{17,19})$/)?.[1];
  if (userId) {
    try {
      const member = await channel.guild.members.fetch(userId);
      const role = channel.guild.roles.cache.get(AUTO_ROLE_ID);
      if (member && role) await member.roles.add(role);
    } catch {}
  }

  startHideTimer(channel); // Bắt đầu timer 3 ngày
});

// Khi có tin nhắn mới
client.on("messageCreate", (message) => {
  if (message.channel.parentId === CATEGORY_ID && message.author.bot) {
    startHideTimer(message.channel); // Reset timer nếu có tin nhắn mới
  }
});

// ===== Interaction chọn menu =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== "rules_menu") return;

  const data = rules[interaction.values[0]];
  if (!data) return;

  const embed = new EmbedBuilder()
    .setTitle(data.title)
    .setDescription(data.desc)
    .setColor(data.color)
    .setImage(data.image);

  await interaction.reply({ embeds: [embed], ephemeral: true });
});

// ===== Keep Alive =====
const app = express();
app.get("/", (req, res) => res.send("Bot vẫn online! ✅"));
app.listen(process.env.PORT || 3000, () => console.log("🌐 Keep-alive server chạy"));

// ===== LOGIN =====
client.login(TOKEN);
