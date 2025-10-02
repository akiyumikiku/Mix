const { renameChannel } = require("../rename");

const CATEGORY_ID = process.env.CATEGORY_ID; 
const ROLE_ID = process.env.AUTO_ROLE_ID;    

module.exports = (client) => {
  client.on("channelCreate", async (channel) => {
    try {
      if (channel.parentId !== CATEGORY_ID) return;

      await renameChannel(channel, CATEGORY_ID);

      if (!channel.topic) return;
      const match = channel.topic.match(/(\d{17,19})$/);
      if (!match) return;

      const userId = match[1];
      const member = await channel.guild.members.fetch(userId).catch(() => null);
      if (!member) return;

      await member.roles.add(ROLE_ID).catch(() => {});
      console.log(`✅ Đã add role ${ROLE_ID} cho ${member.user.tag}`);
    } catch (err) {
      console.error("❌ Lỗi channelCreate event:", err);
    }
  });
};
