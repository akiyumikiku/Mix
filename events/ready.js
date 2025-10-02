module.exports = (client, CATEGORY_ID, RULES_CHANNEL_ID, sendMainMessage, renameChannel) => {
  client.once("ready", async () => {
    console.log(`✅ Bot đã đăng nhập: ${client.user.tag}`);

    // Rename tất cả channel trong category
    client.channels.cache
      .filter(ch => ch.parentId === CATEGORY_ID)
      .forEach(ch => renameChannel(ch, CATEGORY_ID));

    // Send main message + menu
    const channel = await client.channels.fetch(RULES_CHANNEL_ID);
    if (!channel) return console.log("❌ Không tìm thấy kênh rules");

    const messages = await channel.messages.fetch({ limit: 50 });
    const alreadySent = messages.find(
      m => m.author.id === client.user.id &&
           m.components.length > 0 &&
           m.components[0].components[0].customId === "rules_menu"
    );

    if (!alreadySent) {
      await sendMainMessage(channel);
      console.log("✅ Đã gửi main embed + menu rules.");
    }
  });
};
