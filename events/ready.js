// events/ready.js
const { ActionRowBuilder, StringSelectMenuBuilder, Events } = require("discord.js");

module.exports = (client, CATEGORY_ID, RULES_CHANNEL_ID, renameChannel) => {
  // Hàm cập nhật presence
  const updatePresence = async () => {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    // Lấy danh sách member trừ bot-role
    await guild.members.fetch(); // fetch để cập nhật đủ
    const memberCount = guild.members.cache.filter(m => 
      !m.roles.cache.has("1411639327909220352") // loại role bot
    ).size;

    client.user.setPresence({
      activities: [
        {
          name: `👥 ${memberCount} members`,
          type: 3, // Watching
        }
      ],
      status: "online"
    });
  };

  // Khi bot ready
  client.once("ready", async () => {
    console.log(`✅ Bot đã đăng nhập: ${client.user.tag}`);
    await updatePresence();

    // ===== Rename tất cả channel trong Category =====
    client.channels.cache
      .filter(ch => ch.parentId === CATEGORY_ID)
      .forEach(ch => renameChannel(ch));

    // ===== Xử lý embed chính =====
    try {
      const channel = await client.channels.fetch(RULES_CHANNEL_ID);
      if (!channel) return console.log("❌ Không tìm thấy kênh rules");

      const MAIN_MESSAGE_ID = "1423173479825543189";
      const mainMessage = await channel.messages.fetch(MAIN_MESSAGE_ID);

      if (!mainMessage) {
        return console.log("❌ Không tìm thấy embed chính trong channel!");
      }

      const hasMenu =
        mainMessage.components.length > 0 &&
        mainMessage.components[0].components[0].customId === "rules_menu";

      if (!hasMenu) {
        console.log("⚡ Tin nhắn chính chưa có menu → thêm menu mới...");

        const menu = new StringSelectMenuBuilder()
          .setCustomId("rules_menu")
          .setPlaceholder("Select rules you would like to see")
          .addOptions([
            { label: "1 Warning Rules", value: "opt1", description: "Rule violations that will get you 1 warn.", emoji: "<:x1Warn:1420078766855819284>" },
            { label: "Channel Misuses", value: "opt2", description: "Channel Misuse rules that will get you 1 warn.", emoji: "<:channelmisuse:1416316766312857610>" },
            { label: "2 Warning Rules", value: "opt3", description: "Rule violations that will get you 2 warns.", emoji: "<:x2Warn:1416316781060161556>" },
            { label: "3 Warning Rules", value: "opt4", description: "Rule violations that will get you 3 warns.", emoji: "<:x3Warn:1416316796029374464>" },
            { label: "Instant Ban Rules", value: "opt5", description: "Rule violations that will get you a ban.", emoji: "<:instantban:1416316818297192510>" }
          ]);

        const row = new ActionRowBuilder().addComponents(menu);

        await mainMessage.edit({
          content: "📜 **Server Rules are pinned here:**",
          embeds: mainMessage.embeds,
          components: [row],
        });

        console.log("✅ Đã thêm menu vào embed chính.");
      } else {
        console.log("📌 Embed chính đã có menu → không cần chỉnh.");
      }
    } catch (err) {
      console.error("❌ Lỗi khi xử lý embed chính:", err);
    }
  });

  // Cập nhật khi có người join/leave
  client.on(Events.GuildMemberAdd, updatePresence);
  client.on(Events.GuildMemberRemove, updatePresence);
};
