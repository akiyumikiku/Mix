// ============================================
// FILE 1: commands/checkChannelTime.js
// ============================================

const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('check_channel_time')
    .setDescription('Kiểm tra thời gian macro của một channel')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel cần kiểm tra (chỉ text channel)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Số lượng messages tối đa để fetch (mặc định: 100)')
        .setMinValue(10)
        .setMaxValue(500)
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const channel = interaction.options.getChannel('channel');
      const limit = interaction.options.getInteger('limit') || 100;

      if (!channel.name.endsWith('-macro')) {
        return await interaction.editReply({
          content: '❌ Channel phải có đuôi `-macro`!',
          ephemeral: true
        });
      }

      await interaction.editReply(`🔍 Đang fetch ${limit} messages từ ${channel.name}...`);
      
      const messages = await channel.messages.fetch({ limit });
      const webhookMessages = messages.filter(m => m.webhookId);

      if (webhookMessages.size === 0) {
        return await interaction.editReply({
          content: `❌ Không tìm thấy webhook messages nào trong ${channel.name}`,
          ephemeral: true
        });
      }

      const times = webhookMessages.map(m => m.createdTimestamp).sort((a, b) => a - b);
      const activeTime = calculateActiveTime(times);
      const hours = activeTime / 3600000;
      const minutes = (activeTime % 3600000) / 60000;

      const oldest = times[0];
      const newest = times[times.length - 1];
      const totalSpan = newest - oldest;
      const spanHours = totalSpan / 3600000;

      let sessions = 1;
      let longestSession = 0;
      let currentSession = 0;
      const MAX_GAP = 10 * 60 * 1000;

      for (let i = 1; i < times.length; i++) {
        const gap = times[i] - times[i - 1];
        if (gap > MAX_GAP) {
          sessions++;
          longestSession = Math.max(longestSession, currentSession);
          currentSession = 0;
        } else {
          currentSession += gap;
        }
      }
      longestSession = Math.max(longestSession, currentSession);

      const oldestDate = new Date(oldest).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      const newestDate = new Date(newest).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

      const embed = new EmbedBuilder()
        .setTitle('⏱️ BÁO CÁO THỜI GIAN MACRO')
        .setDescription(`**Channel:** ${channel.name}`)
        .setColor(hours >= 6 ? 0x00FF00 : 0xFF0000)
        .addFields(
          { name: '📨 Webhook Messages', value: `${webhookMessages.size} messages`, inline: true },
          { name: '📊 Messages Fetched', value: `${limit} messages`, inline: true },
          { name: '\u200B', value: '\u200B', inline: true },
          {
            name: '⏰ Thời Gian Macro Thực Tế',
            value: `**${Math.floor(hours)}h ${Math.floor(minutes)}m** (${hours.toFixed(2)}h)`,
            inline: false
          },
          { name: '📏 Khoảng Thời Gian', value: `${spanHours.toFixed(2)}h`, inline: true },
          { name: '🔢 Số Sessions', value: `${sessions} sessions`, inline: true },
          { name: '⚡ Longest Session', value: formatTime(longestSession), inline: true },
          { name: '🕐 Message Đầu', value: oldestDate, inline: false },
          { name: '🕙 Message Cuối', value: newestDate, inline: false },
          {
            name: '✅ Đủ Streak?',
            value: hours >= 6 ? '✅ CÓ (≥6h)' : `❌ KHÔNG (${hours.toFixed(2)}h < 6h)`,
            inline: false
          }
        )
        .setFooter({ text: 'Gap > 10 phút = nghỉ (break)' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error:', error);
      await interaction.editReply({
        content: '❌ Lỗi: ' + error.message,
        ephemeral: true
      });
    }
  }
};

function calculateActiveTime(times, maxGap = 10 * 60 * 1000) {
  if (!times || times.length < 2) return 0;
  const sorted = [...times].sort((a, b) => a - b);
  let total = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap <= maxGap) total += gap;
  }
  return total;
}

function formatTime(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}
