// events/ready.js
const { ActionRowBuilder, StringSelectMenuBuilder, Events } = require("discord.js");

module.exports = (client, CATEGORY_ID, RULES_CHANNEL_ID, renameChannel) => {
  const BOT_ROLE_ID = "1411639327909220352"; // Role bot
  const MAIN_MESSAGE_ID = "1424089527751807101"; // ID tin nhắn menu
  const TARGET_ROLES = ["1410990099042271352", "1411991634194989096"];

  // =============================
  // 📊 Hàm cập nhật số member online / tổng
  // =============================
  async function updatePresence() {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    // fetch members nếu cache trống
    if (guild.members.cache.size < guild.memberCount) {
      await guild.members.fetch().catch(() => {});
    }

    const members = guild.members.cache.filter(m => !m.user.bot && !m.roles.cache.has(BOT_ROLE_ID));
    const totalMembers = members.size;
    const onlineMembers = members.filter(m => m.presence && m.presence.status !== "offline").size;

    client.user.setPresence({
      activities: [{
        name: `${onlineMembers}/${totalMembers} Members Online 👥`,
        type: 3 // Watching
      }],
      status: "online"
    });
  }

  // =============================
  // ⚙️ Khi bot sẵn sàng
  // =============================
  client.once("ready", async () => {
    console.log(`✅ Bot đã đăng nhập: ${client.user.tag}`);
    await updatePresence();

    // ===== Quét toàn bộ channel trong category 1 lần khi restart =====
    const channels = client.channels.cache.filter(ch => ch.parentId === CATEGORY_ID);
    for (const ch of channels.values()) {
      try {
        await renameChannel(ch);
      } catch (err) {
        console.warn(`⚠️ Không rename được ${ch.name}:`, err.message);
      }
    }
    console.log(`🔁 Đã quét ${channels.size} channel trong category khi restart.`);

    // ===== Xử lý tin nhắn menu trong channel rules =====
    try {
      const channel = await client.channels.fetch(RULES_CHANNEL_ID);
      if (!channel) return console.log("❌ Không tìm thấy channel rules");

      const mainMessage = await channel.messages.fetch(MAIN_MESSAGE_ID);
      if (!mainMessage) return console.log("❌ Không tìm thấy tin nhắn chính!");

      const hasMenu =
        mainMessage.components.length > 0 &&
        mainMessage.components[0].components[0].customId === "rules_menu";

      if (!hasMenu) {
        console.log("⚡ Thêm menu vào tin nhắn chính...");
        const menu = new StringSelectMenuBuilder()
          .setCustomId("rules_menu")
          .setPlaceholder("Select rules you would like to see")
          .addOptions([
            { label: "1 Warning Rules", value: "opt1", emoji: "<:x1Warn:1420078766855819284>" },
            { label: "Channel Misuses", value: "opt2", emoji: "<:channelmisuse:1416316766312857610>" },
            { label: "2 Warning Rules", value: "opt3", emoji: "<:x2Warn:1416316781060161556>" },
            { label: "3 Warning Rules", value: "opt4", emoji: "<:x3Warn:1416316796029374464>" },
            { label: "Instant Ban Rules", value: "opt5", emoji: "<:instantban:1416316818297192510>" }
          ]);

        const row = new ActionRowBuilder().addComponents(menu);
        await mainMessage.edit({
          content: "📜 **Server Rules are pinned here:**",
          embeds: mainMessage.embeds,
          components: [row],
        });

        console.log("✅ Đã thêm menu vào embed chính.");
      } else {
        console.log("📌 Tin nhắn menu đã có sẵn → bỏ qua.");
      }
    } catch (err) {
      console.error("❌ Lỗi khi xử lý embed chính:", err);
    }
  });

  // =============================
  // 🔄 Cập nhật khi có thay đổi thành viên / trạng thái
  // =============================
  client.on(Events.GuildMemberAdd, updatePresence);
  client.on(Events.GuildMemberRemove, updatePresence);
  client.on(Events.PresenceUpdate, updatePresence);
};
