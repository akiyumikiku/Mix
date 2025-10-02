const { EmbedBuilder } = require("discord.js");

module.exports = (client, rules) => {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "rules_menu") return;

    const data = rules[interaction.values[0]];
    if (!data) return;

    const embed = new EmbedBuilder()
      .setTitle(data.title)
      .setDescription(data.desc)
      .setColor(data.color)
      .setImage(data.image || null);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  });
};
