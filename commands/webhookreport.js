// ============================================
// FILE 3: commands/webhookreport.js
// ============================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const REPORT_CHANNEL = '1438039815919632394';
const STREAK_CATS = [
  '1411034825699233943', // Active
  '1446077580615880735', // Cyberspace
  '1445997821336748155', // Dreamspace
  '1445997659948060712'  // Glitch
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('webhookreport')
    .setDescription('Gửi báo cáo webhook ngay tại kênh này')
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Số messages fetch (mặc định 100)')
        .setMinValue(10)
        .setMaxValue(500)
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const limit = interaction.options.getInteger('limit') || 100;
      const guild = interaction.guild;

      const channels = guild.channels.cache.filter(c =>
        c.type === 0 && STREAK_CATS.includes(c.parentId)
      );

      const results = { above18h: [], above12h: [], above6h: [] };

      await interaction.editReply(`🔍 Đang quét ${channels.size} channels...`);

      for (const [, ch] of channels) {
        try {
          const messages = await ch.messages.fetch({ limit });
          const webhookMessages = messages.filter(m => m.webhookId);
          
          if (webhookMessages.size === 0) continue;

          const times = webhookMessages.map(m => m.createdTimestamp).sort((a, b) => a - b);
          const active = calcActive(times);
          const hours = active / 3600000;

          if (hours >= 18) results.above18h.push({ ch, active });
          if (hours >= 12) results.above12h.push({ ch, active });
          if (hours >= 6) results.above6h.push({ ch, active });

        } catch (err) {
          console.error('Error scanning', ch.name, err.message);
        }
      }

      const embeds = [];
      const date = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

      [
        { key: 'above18h', title: '🏆 18+ Hours', color: 0xFFD700 },
        { key: 'above12h', title: '⭐ 12+ Hours', color: 0xC0C0C0 },
        { key: 'above6h', title: '✨ 6+ Hours', color: 0xCD7F32 }
      ].forEach(cfg => {
        if (results[cfg.key].length > 0) {
          const desc = results[cfg.key]
            .map(r => `**${r.ch.name}** - ${formatTime(r.active)}`)
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

      if (embeds.length > 0) {
        await interaction.editReply({ 
          content: `📊 **Webhook Report** - ${date}`, 
          embeds 
        });
      } else {
        await interaction.editReply(`📊 **Webhook Report** - ${date}\nKhông có channel nào đạt 6+ giờ`);
      }

    } catch (error) {
      console.error('Report error:', error);
      await interaction.editReply('❌ Lỗi: ' + error.message);
    }
  }
};

function calcActive(times, maxGap = 10 * 60 * 1000) {
  if (!times || times.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    if (gap <= maxGap) total += gap;
  }
  return total;
}

function formatTime(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}
