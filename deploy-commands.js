// ============================================
// FILE: deploy-commands.js - AUTO LOAD TẤT CẢ COMMANDS
// ============================================

const { REST, Routes, SlashCommandBuilder } = require(“discord.js”);
const fs = require(“fs”);
const path = require(“path”);
require(“dotenv”).config();

// ============================================
// 1. LOAD COMMANDS TỪ THỦ MỤC /commands
// ============================================
const commands = [];
const commandsPath = path.join(__dirname, “commands”);

// Kiểm tra thư mục commands có tồn tại
if (fs.existsSync(commandsPath)) {
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(”.js”));

console.log(“📂 Loading commands from /commands folder:”);
for (const file of commandFiles) {
try {
const filePath = path.join(commandsPath, file);
const command = require(filePath);

```
  if (command.data && command.execute) {
    commands.push(command.data.toJSON());
    console.log(`  ✅ ${file} - /${command.data.name}`);
  } else {
    console.log(`  ⚠️ ${file} - Missing "data" or "execute"`);
  }
} catch (error) {
  console.error(`  ❌ ${file} - Error:`, error.message);
}
```

}
} else {
console.warn(“⚠️ Không tìm thấy thư mục /commands”);
}

// ============================================
// 2. THÊM BUILT-IN COMMANDS (nếu cần)
// ============================================
const builtInCommands = [
new SlashCommandBuilder()
.setName(“help”)
.setDescription(“Hiện hướng dẫn sử dụng bot”),

new SlashCommandBuilder()
.setName(“report”)
.setDescription(“Báo cáo một người dùng”)
.addUserOption(option =>
option.setName(“member”)
.setDescription(“Chọn người cần report”)
.setRequired(true))
.addStringOption(option =>
option.setName(“reason”)
.setDescription(“Lý do report”)
.setRequired(true)),
].map(cmd => cmd.toJSON());

// Gộp commands
commands.push(…builtInCommands);

console.log(`\n📊 Total commands: ${commands.length}\n`);

// ============================================
// 3. DEPLOY TO DISCORD
// ============================================
const rest = new REST({ version: “10” }).setToken(process.env.TOKEN);

(async () => {
try {
console.log(“🚀 Bắt đầu deploy slash commands…”);

```
let route;
if (process.env.GUILD_ID) {
  // Deploy to specific guild (instant)
  console.log("📍 Deploying to GUILD:", process.env.GUILD_ID);
  route = Routes.applicationGuildCommands(
    process.env.CLIENT_ID, 
    process.env.GUILD_ID
  );
} else {
  // Deploy globally (takes ~1 hour)
  console.log("🌐 Deploying globally");
  route = Routes.applicationCommands(process.env.CLIENT_ID);
}

const data = await rest.put(route, { body: commands });

console.log(`\n✅ Deploy thành công ${data.length} commands!`);
console.log("\n📋 Danh sách:");
data.forEach(cmd => {
  console.log(`  • /${cmd.name} - ${cmd.description}`);
});

if (!process.env.GUILD_ID) {
  console.log("\n⚠️ Global deploy có thể mất tới 1 giờ!");
  console.log("💡 Thêm GUILD_ID vào .env để deploy ngay lập tức");
}
```

} catch (error) {
console.error(”\n❌ Lỗi deploy:”, error);

```
if (error.code === 50001) {
  console.log("\n💡 Bot thiếu quyền!");
  console.log("  → Invite bot với scope 'applications.commands'");
} else if (error.rawError?.message) {
  console.log("\n💡 Chi tiết lỗi:", error.rawError.message);
}
```

}
})();
