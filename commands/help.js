const { SlashCommandBuilder } = require("discord.js");
const { createHelpEmbed } = require("../functions/help.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Hiển thị danh sách lệnh của bot"),

  async execute(interaction, client) {
    try {
      const embed = createHelpEmbed();

      await interaction.reply({
        embeds: [embed],
        ephemeral: true // chỉ hiện cho người dùng (có thể bỏ nếu muốn public)
      });
    } catch (err) {
      console.error("Help command error:", err);
      await interaction.reply({
        content: "⚠️ Không thể hiển thị hướng dẫn!",
        ephemeral: true
      });
    }
  }
};
