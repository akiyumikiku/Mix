module.exports = (client, CATEGORY_ID, RULES_CHANNEL_ID, sendMainMessage, renameChannel) => {
  client.once("ready", async () => {
    console.log(`✅ Bot đã đăng nhập: ${client.user.tag}`);

    // Đổi tên tất cả channel trong Category
    client.channels.cache
      .filter(ch => ch.parentId === CATEGORY_ID)
      .forEach(ch => renameChannel(ch));

    // Gửi rules main embed
    const channel = await client.channels.fetch(RULES_CHANNEL_ID).catch(() => null);
    if (!channel) return console.log("❌ Không tìm thấy kênh rules");

    await sendMainMessage(channel);
  });
};
