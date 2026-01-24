// ============================================
// FILE: commands/checkChannelTime.js - UPDATED
// Sử dụng helper functions
// ============================================

const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { fetchAndCalculateTime, formatTime, msToHours } = require('../functions/timeCalculator');

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
        .setMaxValue(100)
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
      
      // Use helper function
      const result = await fetchAndCalculateTime(channel, limit);

      if (result.error) {
        return await interaction.editReply({
          content: `❌ Lỗi: ${result.error}`,
          ephemeral: true
        });
      }

      if (result.webhookCount === 0) {
        return await interaction.editReply({
          content: `❌ Không tìm thấy webhook messages nào trong ${channel.name}`,
          ephemeral: true
        });
      }

      const hours = msToHours(result.activeTime);
      const minutes = (result.activeTime % 3600000) / 60000;

      // Calculate additional stats
      const times = result.messages.map(m => m.createdTimestamp).sort((a, b) => a - b);
      const oldest = times[0];
      const newest = times[times.length - 1];
      const totalSpan = newest - oldest;
      const spanHours = totalSpan / 3600000;

      // Calculate sessions
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
          { name: '📨 Webhook Messages', value: `${result.webhookCount} messages`, inline: true },
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
