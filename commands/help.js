const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Hiển thị danh sách lệnh của bot"),
    
  async execute(interaction) {
    await interaction.reply({
      content: "ℹ️ Các lệnh hiện có:\n`/help` - Xem danh sách lệnh\n`/report` - Báo cáo vi phạm",
      ephemeral: true
    });
  },
};
