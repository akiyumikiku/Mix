// events/interaction.js
const { EmbedBuilder } = require("discord.js");
const rules = require("../rules"); // import file rules.js

module.exports = (client) => {
  client.on("interactionCreate", async (interaction) => {
    try {
      // ===== Slash Commands =====
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        return await command.execute(interaction, client);
      }

      // ===== Select Menu cho rules =====
      if (interaction.isStringSelectMenu() && interaction.customId === "rules_menu") {
        const choice = interaction.values[0];
        const ruleData = rules[choice];

        if (!ruleData) {
          return interaction.reply({
            content: "❌ Không tìm thấy dữ liệu cho mục này.",
            ephemeral: true,
          });
        }

        // Tạo embed từ rules.js
        const embed = new EmbedBuilder()
          .setTitle(ruleData.title)
          .setDescription(ruleData.desc)
          .setColor(ruleData.color || "#ffffff");

        if (ruleData.image) {
          embed.setImage(ruleData.image);
        }

        await interaction.reply({
          embeds: [embed],
          ephemeral: true, // chỉ người chọn mới thấy
        });
      }
    } catch (err) {
      console.error("❌ Lỗi interaction:", err);
      if (interaction.isRepliable()) {
        interaction.reply({
          content: "⚠️ Có lỗi xảy ra khi xử lý lựa chọn!",
          ephemeral: true,
        }).catch(() => {});
      }
    }
  });
};
