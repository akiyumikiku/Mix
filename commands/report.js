const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("report")
    .setDescription("Báo cáo một người dùng vi phạm")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("Người bạn muốn báo cáo")
        .setRequired(true))
    .addStringOption(option =>
      option.setName("reason")
        .setDescription("Lý do báo cáo")
        .setRequired(true)),

  async execute(interaction) {
    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");

    // Lấy kênh báo cáo từ env (nếu có)
    const reportChannelId = process.env.REPORT_CHANNEL_ID;
    const reportChannel = interaction.guild.channels.cache.get(reportChannelId);

    if (reportChannel) {
      reportChannel.send(`🚨 **Báo cáo vi phạm**\n👤 Người bị báo cáo: ${user}\n📄 Lý do: ${reason}\n📢 Người báo cáo: ${interaction.user}`);
    }

    await interaction.reply({
      content: `✅ Đã gửi báo cáo về ${user} với lý do: ${reason}`,
      ephemeral: true,
    });
  },
};
