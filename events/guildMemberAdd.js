module.exports = {
  name: "guildMemberAdd",
  async execute(member, client) {
    const rulesChannelId = process.env.RULES_CHANNEL_ID;
    const defaultRoleId = process.env.DEFAULT_ROLE_ID;

    if (rulesChannelId) {
      const channel = member.guild.channels.cache.get(rulesChannelId);
      if (channel) {
        channel.send(`👋 Chào mừng ${member.user}, hãy đọc kỹ luật trước khi tham gia!`);
      }
    }

    if (defaultRoleId) {
      try {
        const role = member.guild.roles.cache.get(defaultRoleId);
        if (role) await member.roles.add(role);
      } catch (err) {
        console.error("❌ Không thể gán role mặc định:", err);
      }
    }
  },
};
