const { Client, GatewayIntentBits, Partials } = require("discord.js");
require("dotenv").config();
const express = require("express");

// ==== Functions ====
const { renameChannel } = require("./functions/rename");
const { updateMemberRoles } = require("./functions/updateRoles");
const { sendMainMessage } = require("./functions/sendRules");
const rules = require("./rules");

// ==== Events ====
const readyEvent = require("./events/ready");
const guildMemberEvent = require("./events/guildMember");
const channelCreateEvent = require("./events/channelCreate");
const interactionEvent = require("./events/interaction");
const messageDeleteBot = require("./events/messageDeleteBot");

// ==== Config ====
const TOKEN = process.env.TOKEN;
const CATEGORY_ID = process.env.CATEGORY_ID.trim();
const RULES_CHANNEL_ID = process.env.RULES_CHANNEL_ID;
const ROLE_ID = process.env.ROLE_ID;

// ==== Client ====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

// ==== Register Events ====
readyEvent(client, CATEGORY_ID, RULES_CHANNEL_ID, sendMainMessage, renameChannel);
guildMemberEvent(client, updateMemberRoles);
channelCreateEvent(client, CATEGORY_ID, ROLE_ID, renameChannel);
interactionEvent(client, rules);
messageDeleteBot(client);

// ==== Keep Alive ====
const app = express();
app.get("/", (req, res) => res.send("Bot vẫn online! ✅"));
app.listen(process.env.PORT || 3000, () => console.log("🌐 Keep-alive server chạy"));

// ==== Login ====
client.login(TOKEN);
