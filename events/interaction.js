module.exports = (client) => {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "❌ Đã xảy ra lỗi khi chạy lệnh này.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ Đã xảy ra lỗi khi chạy lệnh này.",
          ephemeral: true,
        });
      }
    }
  });
};
