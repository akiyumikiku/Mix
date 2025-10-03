const { SlashCommandBuilder } = require("discord.js");
const { createReportEmbed } = require("../functions/report.js");

const REPORT_CHANNEL_ID = process.env.REPORT_CHANNEL_ID;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("report")
    .setDescription("Báo cáo vi phạm trong server")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Người bạn muốn báo cáo")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("Lý do báo cáo")
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName("proof")
        .setDescription("Bằng chứng (link hình/clip)")
        .setRequired(false)
    ),

  async execute(interaction, client) {
    try {
      const reported = interaction.options.getUser("user");
      const reason = interaction.options.getString("reason") || "Không có";
      const proof = interaction.options.getString("proof"); // ❌ không còn ép = "Không có"

      const reportChannel = interaction.guild.channels.cache.get(REPORT_CHANNEL_ID);

      const embed = createReportEmbed({
        reporter: interaction.user.tag,
        reported: reported.tag,
        reason,
        proof,
        channel: interaction.channel.toString()
      });

      if (reportChannel) {
        await reportChannel.send({ embeds: [embed] });
      }

      await interaction.reply({
        content: "✅ Báo cáo của bạn đã được gửi thành công!",
        ephemeral: true
      });
    } catch (err) {
      console.error("Report command error:", err);
      await interaction.reply({
        content: "⚠️ Có lỗi xảy ra khi xử lý báo cáo!",
        ephemeral: true
      });
    }
  }
};
