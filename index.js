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
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  }
}

// ==== Load events từ thư mục /events ====
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs.readdirSync(eventsPath).filter((f) => f.endsWith(".js"));

const { renameChannel } = require("./functions/rename");
const { updateMemberRoles } = require("./functions/updateRoles");
const rules = require("./rules");

for (const file of eventFiles) {
  const event = require(`./events/${file}`);

  // tuỳ theo event export function gì thì truyền tham số
  if (file === "channelCreate.js") {
    event(client, process.env.CATEGORY_ID, process.env.ROLE_ID, renameChannel);
  } else if (file === "guildMemberAdd.js") {
    event(client, updateMemberRoles);
  } else if (file === "interaction.js") {
    event(client, rules);
  } else if (file === "messageDeleteBot.js") {
    event(client);
  } else if (file === "ready.js") {
    const { StringSelectMenuBuilder, ActionRowBuilder } = require("discord.js");
    event(client, process.env.CATEGORY_ID, process.env.RULES_CHANNEL_ID, renameChannel);
  }
}

// ==== Khi có interaction command ====
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
// ==== Load events roles ====
require("./events/guildMemberAdd")(client);

// ==== Keep Alive ====
const app = express();
app.get("/", (req, res) => res.send("Bot vẫn online! ✅"));
app.listen(process.env.PORT || 3000, () => console.log("🌐 Keep-alive server chạy"));

// ==== Login ====
client.login(process.env.TOKEN);
