module.exports = (client, CATEGORY_ID, ROLE_ID, renameChannel) => {
  client.on("channelCreate", async (channel) => {
    if (channel.parentId !== CATEGORY_ID) return;
    await renameChannel(channel, CATEGORY_ID);

    if (!channel.topic) return;
    const match = channel.topic.match(/(\d{17,19})$/);
    if (!match) return;

    const userId = match[1];
    try {
      const member = await channel.guild.members.fetch(userId);
      if (member) {
        await member.roles.add(ROLE_ID).catch(() => {});
        console.log(`✅ Đã add role ${ROLE_ID} cho ${member.user.tag}`);
      }
    } catch (err) {
      console.error("❌ Lỗi khi add role:", err);
    }
  });
};
