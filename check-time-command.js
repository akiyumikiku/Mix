// ============================================
// FILE: commands/checkChannelTime.js
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

      // Kiểm tra tên channel
      if (!channel.name.endsWith('-macro')) {
        return await interaction.editReply({
          content: '❌ Channel phải có đuôi `-macro`!',
          ephemeral: true
        });
      }

      // Fetch webhook messages
      await interaction.editReply(`🔍 Đang fetch ${limit} messages từ ${channel.name}...`);
      
      const messages = await channel.messages.fetch({ limit });
      const webhookMessages = messages.filter(m => m.webhookId);

      if (webhookMessages.size === 0) {
        return await interaction.editReply({
          content: `❌ Không tìm thấy webhook messages nào trong ${channel.name}`,
          ephemeral: true
        });
      }

      // Tính thời gian
      const times = webhookMessages.map(m => m.createdTimestamp).sort((a, b) => a - b);
      const activeTime = calculateActiveTime(times);
      const hours = activeTime / 3600000;
      const minutes = (activeTime % 3600000) / 60000;

      // Tính thời gian từ message đầu → cuối
      const oldest = times[0];
      const newest = times[times.length - 1];
      const totalSpan = newest - oldest;
      const spanHours = totalSpan / 3600000;

      // Tính số sessions (dựa trên gap > 10 phút)
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

      // Format times
      const oldestDate = new Date(oldest).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      const newestDate = new Date(newest).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

      // Tạo embed báo cáo
      const embed = new EmbedBuilder()
        .setTitle('⏱️ BÁO CÁO THỜI GIAN MACRO')
        .setDescription(`**Channel:** ${channel.name}`)
        .setColor(hours >= 6 ? 0x00FF00 : 0xFF0000)
        .addFields(
          { 
            name: '📨 Webhook Messages', 
            value: `${webhookMessages.size} messages`, 
            inline: true 
          },
          { 
            name: '📊 Messages Fetched', 
            value: `${limit} messages`, 
            inline: true 
          },
          { 
            name: '\u200B', 
            value: '\u200B', 
            inline: true 
          },
          {
            name: '⏰ Thời Gian Macro Thực Tế',
            value: `**${Math.floor(hours)}h ${Math.floor(minutes)}m** (${hours.toFixed(2)}h)`,
            inline: false
          },
          {
            name: '📏 Khoảng Thời Gian',
            value: `${spanHours.toFixed(2)}h (từ message đầu → cuối)`,
            inline: true
          },
          {
            name: '🔢 Số Sessions',
            value: `${sessions} sessions`,
            inline: true
          },
          {
            name: '⚡ Longest Session',
            value: formatTime(longestSession),
            inline: true
          },
          {
            name: '🕐 Message Đầu Tiên',
            value: oldestDate,
            inline: false
          },
          {
            name: '🕙 Message Cuối Cùng',
            value: newestDate,
            inline: false
          },
          {
            name: '✅ Đủ Điều Kiện Streak?',
            value: hours >= 6 ? '✅ CÓ (≥6h)' : `❌ KHÔNG (${hours.toFixed(2)}h < 6h)`,
            inline: false
          }
        )
        .setFooter({ text: 'Gap > 10 phút được tính là nghỉ (break)' })
        .setTimestamp();

      // Thêm breakdown sessions nếu có nhiều hơn 1 session
      if (sessions > 1 && sessions <= 10) {
        let sessionBreakdown = '';
        let sessionStart = times[0];
        let sessionTime = 0;
        let sessionNum = 1;

        for (let i = 1; i < times.length; i++) {
          const gap = times[i] - times[i - 1];
          if (gap > MAX_GAP) {
            sessionBreakdown += `**Session ${sessionNum}:** ${formatTime(sessionTime)}\n`;
            sessionNum++;
            sessionStart = times[i];
            sessionTime = 0;
          } else {
            sessionTime += gap;
          }
        }
        sessionBreakdown += `**Session ${sessionNum}:** ${formatTime(sessionTime)}`;

        embed.addFields({
          name: '📋 Chi Tiết Sessions',
          value: sessionBreakdown,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in check_channel_time:', error);
      await interaction.editReply({
        content: '❌ Có lỗi xảy ra: ' + error.message,
        ephemeral: true
      });
    }
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateActiveTime(times, maxGap = 10 * 60 * 1000) {
  if (!times || times.length === 0) return 0;
  if (times.length === 1) return 0;

  const sorted = [...times].sort((a, b) => a - b);
  let totalActive = 0;

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap <= maxGap) {
      totalActive += gap;
    }
  }

  return totalActive;
}

function formatTime(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}