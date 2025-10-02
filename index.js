// ===== Discord Bot Full Version =====
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
const rules = require("./rules");

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const CATEGORY_ID = process.env.CATEGORY_ID.trim();
const RULES_CHANNEL_ID = process.env.RULES_CHANNEL_ID;
const ROLE_ID = process.env.ROLE_ID; // role tự động add khi channel tạo

// Role hệ thống
const BASE_ROLE_ID = "1415319898468651008";
const AUTO_ROLE_ID = "1411240101832298569";
const REMOVE_IF_HAS_ROLE_ID = "1410990099042271352";
const BLOCK_ROLE_IDS = [
  "1411639327909220352","1411085492631506996","1418990676749848576","1410988790444458015",
  "1415322209320435732","1415351613534503022","1415350650165924002","1415320304569290862",
  "1415351362866380881","1415351226366689460","1415322385095332021","1415351029305704498",
  "1415350143800049736","1415350765291307028","1418990664762523718","1417802085378031689",
  "1417097393752506398","1420270612785401988","1420276021009322064","1415350457706217563",
  "1415320854014984342","1414165862205751326"
];

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

// ===== Rename channel =====
async function renameChannel(channel) {
  if (channel.parentId !== CATEGORY_ID) return;
  if (!channel.name.endsWith("-webhook")) return;
  const username = channel.name.replace("-webhook", "");
  const newName = `🛠★】${username}-macro`;
  if (channel.name !== newName) {
    await channel.setName(newName).catch(console.error);
    console.log(`✅ Đã đổi tên: ${channel.name} → ${newName}`);
  }
}

// ===== Update Role =====
async function updateMemberRoles(member) {
  if (member.user.bot) return;

  const hasBaseRole = member.roles.cache.has(BASE_ROLE_ID);
  const hasAnyBlockRole = member.roles.cache.some(r => BLOCK_ROLE_IDS.includes(r.id));

  if (!hasBaseRole && !hasAnyBlockRole) await member.roles.add(BASE_ROLE_ID).catch(() => {});
  if (hasBaseRole && hasAnyBlockRole) await member.roles.remove(BASE_ROLE_ID).catch(() => {});

  const hasAutoRole = member.roles.cache.has(AUTO_ROLE_ID);
  const hasRemoveRole = member.roles.cache.has(REMOVE_IF_HAS_ROLE_ID);

  if (!hasAutoRole && !hasRemoveRole) await member.roles.add(AUTO_ROLE_ID).catch(() => {});
  if (hasAutoRole && hasRemoveRole) await member.roles.remove(AUTO_ROLE_ID).catch(() => {});
}

// ===== Ready Event =====
client.once("ready", async () => {
  console.log(`✅ Bot đã đăng nhập: ${client.user.tag}`);

  // Rename tất cả channel trong category
  client.channels.cache
    .filter(ch => ch.parentId === CATEGORY_ID)
    .forEach(ch => renameChannel(ch));
  
// ===== Send Main Embed + Menu =====
async function sendMainMessage(channel) {
  if (!channel) return;

  const mainEmbed = new EmbedBuilder()
    .setTitle("📜 Welcome to the Sol's RNG Community rules channel!")
    .setDescription(`
**This is where all the rules enforced on our Discord server are listed. Please read and follow them to ensure a pleasant experience for everyone!**

If there is anything confusing, you can go to the channel <#1411590263033561128> to contact the server administrators and ask questions.

⚠️ Warning Point & Punishment System:
\`\`\`
 • 1 Warning Point  = no punishment
 • 2 Warning Points = 1h Mute
 • 3 Warning Points = 12h Mute
 • 4 Warning Points = 1d Mute
 • 5 Warning Points = A ban
 • Warning Points expire after 30 days
\`\`\`

-# Thank you for reading and following! We always strive to develop the most civilized and prosperous Sol's RNG community in Southeast Asia!
    `)
    .setColor(3092790)
    .setImage('https://media.discordapp.net/attachments/1411987904980586576/1412916875163209901/SOLS_RNG_COUMUNICATION.png');

  // Menu select
  const menu = new StringSelectMenuBuilder()
    .setCustomId("rules_menu")
    .setPlaceholder("Select rules you would like to see")
    .addOptions([
      { label: "1 Warning Rules", value: "opt1", description: "Rule violations that will get you 1 warn.", emoji: "<:x1Warn:1420078766855819284>" },
      { label: "Channel Misuses", value: "opt2", description: "Channel Misuse rules that will get you 1 warn.", emoji: "<:channelmisuse:1416316766312857610>" },
      { label: "2 Warning Rules", value: "opt3", description: "Rule violations that will get you 2 warns.", emoji: "<:x2Warn:1416316781060161556>" },
      { label: "3 Warning Rules", value: "opt4", description: "Rule violations that will get you 3 warns.", emoji: "<:x3Warn:1416316796029374464>" },
      { label: "Instant Ban Rules", value: "opt5", description: "Rule violations that will get you a ban.", emoji: "<:instantban:1416316818297192510>" },
    ]);

  const row = new ActionRowBuilder().addComponents(menu);

  await channel.send({ embeds: [mainEmbed], components: [row] }).catch(console.error);
}

// ===== Channel Create + Auto Role + Rename =====
client.on("channelCreate", async (channel) => {
  if (channel.parentId !== CATEGORY_ID) return;

  await renameChannel(channel);

  if (!channel.topic) return;

  const match = channel.topic.match(/(\d{17,19})$/);
  if (!match) return;

  const userId = match[1];

  try {
    const member = await channel.guild.members.fetch(userId);
    if (member) {
      await member.roles.add(ROLE_ID).catch(() => {});
      console.log(`✅ Đã add role ${ROLE_ID} cho ${member.user.tag}`);
    }
  } catch (err) {
    console.error("❌ Lỗi khi add role:", err);
  }
});

// ===== Guild Member Role Update =====
client.on("guildMemberAdd", updateMemberRoles);
client.on("guildMemberUpdate", (_, newMember) => updateMemberRoles(newMember));

// ===== Interaction Menu =====
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
