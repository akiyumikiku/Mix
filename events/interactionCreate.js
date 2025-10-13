const { Events, EmbedBuilder } = require("discord.js");
const rulesConfig = require("../rules.js"); // Đường dẫn đúng đến file rules

module.exports = (client) => {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "rules_menu") return;

    const value = interaction.values[0];
    const rule = rulesConfig[value];
    if (!rule) return;

    try {
      // 🧱 Tạo embed hiển thị rule
      const embed = new EmbedBuilder()
        .setTitle(rule.title)
        .setDescription(rule.desc)
        .setColor(rule.color)
        .setImage(rule.image)
        .setFooter({ text: "📜 Server Rules • Please follow all rules strictly." });

      // 📨 Gửi embed riêng cho user
      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });

      // ✅ Reset lại menu (xóa tick)
      const newComponents = interaction.message.components.map(row => {
        return {
          ...row.toJSON(),
          components: row.components.map(c => {
            if (c.custom_id === "rules_menu") {
              return {
                ...c,
                options: c.options.map(o => ({ ...o, default: false })), // Xóa chọn
              };
            }
            return c;
          }),
        };
      });

      await interaction.message.edit({
        components: newComponents,
      });

    } catch (err) {
      console.error("❌ Lỗi khi xử lý rules menu:", err);
      if (!interaction.replied) {
        await interaction.reply({
          content: "⚠️ Đã có lỗi xảy ra khi hiển thị nội dung luật.",
          ephemeral: true,
        });
      }
    }
  });
};
