// ============================================
// FILE: commands/webhookreport.js - UPDATED
// Sử dụng helper functions
// ============================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fetchAndCalculateTime, formatTime, categorizeByTime } = require('../functions/timeCalculator');
const { getMacroChannels, getCategoryName } = require('../functions/channelUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('webhookreport')
    .setDescription('Gửi báo cáo webhook ngay tại kênh này')
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Số messages fetch (mặc định 100, MAX 100)')
        .setMinValue(10)
        .setMaxValue(100)
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const limit = interaction.options.getInteger('limit') || 100;
      const guild = interaction.guild;

      // Get all macro channels
      const channels = getMacroChannels(guild);
      
      await interaction.editReply(`🔍 Đang quét ${channels.size} channels...`);

      const channelDataMap = new Map();

      // Scan all channels
      for (const [, ch] of channels) {
        console.log(`🔍 Scanning ${ch.name}...`);
        
        const result = await fetchAndCalculateTime(ch, limit);
        
        if (result.error) {
          console.error(`❌ Error scanning ${ch.name}:`, result.error);
          continue;
        }
        
        console.log(`  📊 ${result.webhookCount} webhooks, ${formatTime(result.activeTime)}`);
        
        if (result.activeTime > 0) {
          channelDataMap.set(ch, {
            activeTime: result.activeTime,
            webhookCount: result.webhookCount
          });
        }
      }

      // Categorize results
      const results = categorizeByTime(channelDataMap);
      
      const embeds = [];
      const date = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

      // Create embeds for each tier
      [
        { key: 'above18h', title: '🏆 18+ Hours', color: 0xFFD700 },
        { key: 'above12h', title: '⭐ 12+ Hours', color: 0xC0C0C0 },
        { key: 'above6h', title: '✨ 6+ Hours', color: 0xCD7F32 }
      ].forEach(cfg => {
        if (results[cfg.key].length > 0) {
          const desc = results[cfg.key]
            .map(r => `**${r.channel.name}** - ${getCategoryName(r.channel.parentId)} - ${formatTime(r.activeTime)} (${r.webhookCount} msgs)`)
            .join('\n');
          
          embeds.push(
            new EmbedBuilder()
              .setTitle(cfg.title)
              .setColor(cfg.color)
              .setDescription(desc)
              .setTimestamp()
          );
        }
      });

      // Send result
      if (embeds.length > 0) {
        const summary = `📊 **Webhook Report** - ${date}\n\n**Summary:**\n🏆 18+ hours: ${results.above18h.length}\n⭐ 12+ hours: ${results.above12h.length}\n✨ 6+ hours: ${results.above6h.length}\n\n**Scanned:** ${channels.size} channels`;
        
        await interaction.editReply({ content: summary, embeds });
      } else {
        await interaction.editReply(`📊 **Webhook Report** - ${date}\n\n❌ Không có channel nào đạt 6+ giờ\n\n**Đã quét:** ${channels.size} channels`);
      }

    } catch (error) {
      console.error('❌ Report error:', error);
      const reply = '❌ Lỗi: ' + error.message;
      if (interaction.deferred) {
        await interaction.editReply(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  }
};
