const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes,
} = require("discord.js");
require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");

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
const commandsArray = [];

// ==== Load commands ====
const commandsPath = path.join(__dirname, "commands");
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));
  for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
      commandsArray.push(command.data.toJSON());
    } else {
      console.warn(`⚠️ Command ${file} thiếu "data" hoặc "execute"`);
    }
  }
}

// ==== Load events ====
const eventsPath = path.join(__dirname, "events");
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith(".js"));
  for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }
}

// ==== Ready ====
client.once("ready", async () => {
  console.log(`✅ Bot đã đăng nhập: ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    console.log("🔄 Đang đăng ký slash commands...");
    await rest.put(Routes.applicationCommands(client.user.id), { body: commandsArray });
    console.log("✅ Slash commands đã được đăng ký!");
  } catch (error) {
    console.error("❌ Lỗi khi deploy commands:", error);
  }
});

// ==== Keep alive ====
const app = express();
app.get("/", (req, res) => res.send("Bot vẫn online ✅"));
app.listen(process.env.PORT || 3000, () => console.log("🌐 Keep-alive server chạy"));

client.login(process.env.TOKEN);
