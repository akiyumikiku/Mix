// ===== Discord Bot Full =====
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  Partials,
} = require("discord.js");
require("dotenv").config();

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const CATEGORY_ID = process.env.CATEGORY_ID?.trim();
const RULES_CHANNEL_ID = process.env.RULES_CHANNEL_ID?.trim();
const ROLE_ID = process.env.ROLE_ID?.trim();

// ===== Hệ thống Role =====
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

// ===== Rules embed + menu =====
async function sendRulesMenu() {
  const channel = await client.channels.fetch(RULES_CHANNEL_ID).catch(() => null);
  if (!channel) return console.log("❌ Không tìm thấy kênh rules");

  const messages = await channel.messages.fetch({ limit: 50 });
  const alreadySent = messages.find(
    (m) =>
      m.author.id === client.user.id &&
      m.components.length > 0 &&
      m.components[0].components[0].customId === "rules_menu"
  );
  if (alreadySent) return;

  const mainEmbed = new EmbedBuilder()
    .setTitle("📜 Welcome to the Sol's RNG Community rules channel!")
    .setDescription(
      `**This is where all the rules enforced on our Discord server are listed. Please read and follow them to ensure a pleasant experience for everyone!**

If there is anything confusing, you can go to the channel <#1411590263033561128> to contact the server administrators and ask questions.

⚠️ Warning Point & Punishment System:
\`\`\`
 • 1 Warning Point  = no punishment  
 • 2 Warning Points = 1h Mute 
 • 3 Warning Points = 12h Mute 
 • 4 warning Points = 1d Mute 
 • 5 warning Points = A ban 
 • Warning Points expire after 30 days
\`\`\`

-# Thank you for reading and following! We always strive to develop the most civilized and prosperous Sol's RNG community in Southeast Asia!`
    )
    .setColor(0x2f3136)
    .setFooter({ text: "Sol's RNG Community" })
    .setTimestamp();

  const menu = new StringSelectMenuBuilder()
    .setCustomId("rules_menu")
    .setPlaceholder("Select rules you want to see")
    .addOptions([
      { label: "1 Warning Rules", value: "opt1", description: "1 warn violations" },
      { label: "Channel Misuses", value: "opt2", description: "Channel misuse violations" },
      { label: "2 Warning Rules", value: "opt3", description: "2 warn violations" },
      { label: "3 Warning Rules", value: "opt4", description: "3 warn violations" },
      { label: "Instant Ban Rules", value: "opt5", description: "Instant ban violations" },
    ]);

  const row = new ActionRowBuilder().addComponents(menu);

  await channel.send({ embeds: [mainEmbed], components: [row] });
  console.log("✅ Rules menu đã gửi.");
}

// ===== Update roles hệ thống =====
async function updateMemberRoles(member) {
  if (member.user.bot) return;

  const hasBase = member.roles.cache.has(BASE_ROLE_ID);
  const hasBlock = member.roles.cache.some((r) => BLOCK_ROLE_IDS.includes(r.id));
  if (!hasBase && !hasBlock) await member.roles.add(BASE_ROLE_ID).catch(() => {});
  if (hasBase && hasBlock) await member.roles.remove(BASE_ROLE_ID).catch(() => {});

  const hasAuto = member.roles.cache.has(AUTO_ROLE_ID);
  const hasRemove = member.roles.cache.has(REMOVE_IF_HAS_ROLE_ID);
  if (!hasAuto && !hasRemove) await member.roles.add(AUTO_ROLE_ID).catch(() => {});
  if (hasAuto && hasRemove) await member.roles.remove(AUTO_ROLE_ID).catch(() => {});
}

// ===== Ẩn/hiện channel =====
async function checkChannelInactivity(channel) {
  if (channel.parentId !== CATEGORY_ID) return;
  const fetched = await channel.messages.fetch({ limit: 50 });
  const webhookMsgs = fetched.filter((m) => m.webhookId);
  const lastWebhook = webhookMsgs.first();
  const threeDays = 3 * 24 * 60 * 60 * 1000;

  if (!lastWebhook || Date.now() - lastWebhook.createdTimestamp > threeDays) {
    await channel.permissionOverwrites.set([{ id: channel.guild.id, deny: ["ViewChannel"] }]);
    console.log(`🔒 Channel ${channel.name} đã ẩn (3 ngày không có tin nhắn webhook)`);
  } else {
    await channel.permissionOverwrites.set([{ id: channel.guild.id, allow: ["ViewChannel"] }]);
    console.log(`🔓 Channel ${channel.name} đã hiển thị (có tin nhắn webhook)`);
  }
}

// ===== EVENT =====
client.once("ready", async () => {
  console.log(`✅ Bot đã login: ${client.user.tag}`);
  await sendRulesMenu();
});

// Khi channel tạo mới
client.on("channelCreate", async (channel) => {
  await renameChannel(channel);

  // Add ROLE_ID tự động
  if (ROLE_ID && channel.guild) {
    const role = channel.guild.roles.cache.get(ROLE_ID);
    if (role) {
      channel.guild.members.fetch().then((members) => {
        members.forEach((m) => {
          if (!m.user.bot) m.roles.add(role).catch(() => {});
        });
      });
      console.log(`✅ Đã add role ${ROLE_ID} cho tất cả members`);
    }
  }

  // Set timeout 3 ngày kiểm tra inactivity
  setTimeout(() => checkChannelInactivity(channel), 3 * 24 * 60 * 60 * 1000);
});

// Khi có tin nhắn webhook
client.on("messageCreate", async (message) => {
  if (message.webhookId) await checkChannelInactivity(message.channel);
});

// Guild member add/update roles
client.on("guildMemberAdd", updateMemberRoles);
client.on("guildMemberUpdate", (_, newMember) => updateMemberRoles(newMember));

// Interaction rules menu
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== "rules_menu") return;

  const value = interaction.values[0];
  await interaction.reply({ content: `Bạn chọn: ${value}`, ephemeral: true });
});

// ===== LOGIN =====
client.login(TOKEN);
