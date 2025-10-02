const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const rules = require("../rules");

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    console.log(`✅ Bot đã sẵn sàng: ${client.user.tag}`);

    const CHANNEL_ID = process.env.RULES_CHANNEL_ID;
    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!channel) return console.error("❌ Không tìm thấy channel để gửi embed main");

    // Xóa tin nhắn cũ
    try {
      const messages = await channel.messages.fetch({ limit: 20 });
      const botMessages = messages.filter(m => m.author.id === client.user.id);
      if (botMessages.size > 0) {
        await channel.bulkDelete(botMessages, true);
        console.log(`🗑️ Đã xóa ${botMessages.size} embed cũ`);
      }
    } catch (err) {
      console.error("⚠️ Không thể xóa message cũ:", err);
    }

    // Embed main
    const mainEmbed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle("📜 Server Rules")
      .setDescription("Chọn mục bên dưới để xem chi tiết các rules!");

    // Menu
    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("rules_menu")
        .setPlaceholder("📌 Chọn một mục để xem chi tiết")
        .addOptions(
          Object.keys(rules).map((key) => ({
            label: rules[key].label,
            value: key,
            description: rules[key].description,
          }))
        )
    );

    await channel.send({ embeds: [mainEmbed], components: [menu] });
    console.log("✅ Đã gửi embed main");
  },
};
