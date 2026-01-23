// ============================================
// FILE 2: commands/streak.js
// ============================================

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/streaks.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('streak')
    .setDescription('Tăng/giảm/reset/set streak cho kênh hiện tại (nếu kênh dưới 5 kí tự)')
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Hành động (increase/decrease/reset/set)')
        .setRequired(true)
        .addChoices(
          { name: 'Tăng streak (+1)', value: 'increase' },
          { name: 'Giảm streak (-1)', value: 'decrease' },
          { name: 'Reset streak (về 0)', value: 'reset' },
          { name: 'Set streak (số tùy chỉnh)', value: 'set' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('value')
        .setDescription('Giá trị streak (chỉ dùng khi action = set)')
        .setMinValue(0)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    try {
      const channel = interaction.channel;
      const action = interaction.options.getString('action');
      const value = interaction.options.getInteger('value');

      // Check if channel name ends with -macro
      if (!channel.name.endsWith('-macro')) {
        return await interaction.reply({
          content: '❌ Lệnh này chỉ dùng trong channel `-macro`!',
          ephemeral: true
        });
      }

      // Load data
      let data = {};
      if (fs.existsSync(DATA_FILE)) {
        data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      }

      if (!data[channel.id]) {
        data[channel.id] = { streak: 0, badges: [], times: [], days: 0 };
      }

      const oldStreak = data[channel.id].streak;
      let newStreak = oldStreak;

      switch (action) {
        case 'increase':
          newStreak = oldStreak + 1;
          break;
        case 'decrease':
          newStreak = Math.max(0, oldStreak - 1);
          break;
        case 'reset':
          newStreak = 0;
          break;
        case 'set':
          if (value === null) {
            return await interaction.reply({
              content: '❌ Bạn phải chỉ định `value` khi dùng action `set`!',
              ephemeral: true
            });
          }
          newStreak = value;
          break;
      }

      data[channel.id].streak = newStreak;

      // Save
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

      // Rename channel (optional - requires rename function)
      // await safeRename(channel, newStreak, data[channel.id].badges);

      const embed = new EmbedBuilder()
        .setTitle('✅ Streak Updated')
        .setDescription(`**Channel:** ${channel.name}`)
        .addFields(
          { name: 'Old Streak', value: `${oldStreak}🔥`, inline: true },
          { name: 'New Streak', value: `${newStreak}🔥`, inline: true },
          { name: 'Action', value: action, inline: true }
        )
        .setColor(0x00FF00)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Streak error:', error);
      await interaction.reply({
        content: '❌ Lỗi: ' + error.message,
        ephemeral: true
      });
    }
  }
};
