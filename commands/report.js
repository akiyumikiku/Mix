const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "report",
  async execute(interaction, client) {
    const member = interaction.options.getUser("member");
    const reason = interaction.options.getString("reason");

    const reportChannelId = process.env.REPORT_CHANNEL_ID;
    const reportChannel = await client.channels.fetch(reportChannelId).catch(() => null);

    if (!reportChannel) {
      return interaction.reply({
        content: "❌ Không tìm thấy kênh report. Vui lòng cấu hình `REPORT_CHANNEL_ID` trong `.env`.",
        ephemeral: true
      });
    }

    const reportEmbed = new EmbedBuilder()
      .setTitle("🚨 New Report")
      .addFields(
        { name: "👤 Người bị report", value: `${member}`, inline: true },
        { name: "📝 Lý do", value: reason, inline: true },
        { name: "📌 Reported by", value: `${interaction.user}`, inline: false }
      )
      .setColor(0xff0000)
      .setTimestamp();

    const msg = await reportChannel.send({ embeds: [reportEmbed] });

    await interaction.reply({
      content: `✅ Report đã được gửi thành công. [Xem chi tiết tại đây](${msg.url})`,
      ephemeral: true
    });
  }
};
