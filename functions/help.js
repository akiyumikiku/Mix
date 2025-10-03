// functions/help.js
const { EmbedBuilder } = require("discord.js");

function createHelpEmbed() {
  return new EmbedBuilder()
    .setColor("#0099ff")
    .setTitle("📖 Hướng dẫn sử dụng bot")
    .setDescription("Danh sách các lệnh có sẵn:")
    .addFields(
      { name: "/help", value: "Hiển thị danh sách lệnh", inline: false },
      { name: "/report", value: "Báo cáo vi phạm trong server", inline: false }
      // bạn có thể thêm các lệnh khác ở đây
    )
    .setFooter({ text: "Bot Help Menu" })
    .setTimestamp();
}

module.exports = { createHelpEmbed };
