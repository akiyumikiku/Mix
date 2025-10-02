module.exports = {
  name: "help",
  async execute(interaction) {
    await interaction.reply({
      content: "ℹ️ Lệnh này tạm thời chưa dùng được, vui lòng chờ cập nhật sau.",
      ephemeral: true
    });
  }
};
