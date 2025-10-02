// ====== Discord Bot ======
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

// ==== Khởi tạo client ====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

client.commands = new Collection();

// ==== Load commands từ thư mục /commands ====
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
}

// ==== Khi có interaction ====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: "❌ Đã xảy ra lỗi khi chạy lệnh này.",
      ephemeral: true,
    });
  }
});

// ==== Khi bot online ====
client.once("ready", () => {
  console.log(`✅ Bot đã đăng nhập: ${client.user.tag}`);
});

// ==== Keep Alive (cho hosting free như Railway/Heroku/Replit) ====
const app = express();
app.get("/", (req, res) => res.send("Bot vẫn online! ✅"));
app.listen(process.env.PORT || 3000, () =>
  console.log("🌐 Keep-alive server chạy")
);

// ==== Login ====
client.login(process.env.TOKEN);
