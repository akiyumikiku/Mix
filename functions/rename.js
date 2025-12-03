// functions/rename.js
async function renameChannelByCategory(channel, streak = 0) {
  try {
    const CATEGORY_1 = "1411034825699233943"; // Danh mục hoạt động
    const CATEGORY_2 = "1427958263281881088"; // Danh mục ngủ

    if (!channel || !channel.topic) return;

    const [username] = channel.topic.split(" ");
    if (!username) return;

    let newName;
    if (channel.parentId === CATEGORY_1) {
      // Luôn hiển thị streak, kể cả khi = 0
      const streakBadge = `〔${streak}🔥〕`;
      newName = `🛠★】${streakBadge}${username}-macro`;
    } else if (channel.parentId === CATEGORY_2) {
      // Không hiển thị streak trong danh mục ngủ
      newName = `⏰★】${username}-macro`;
    } else return;

    if (channel.name !== newName) {
      await channel.setName(newName).catch(() => {});
      console.log(`✅ Đổi tên: ${channel.name} → ${newName}`);
    } else {
      console.log(`⚙️ Giữ nguyên: ${channel.name}`);
    }
  } catch (err) {
    console.error("❌ Lỗi renameChannelByCategory:", err);
  }
}

const renaming = new Set();
async function safeRename(channel) {
  if (renaming.has(channel.id)) return;
  renaming.add(channel.id);
  try {
    await renameChannelByCategory(channel);
  } finally {
    renaming.delete(channel.id);
  }
}

module.exports = { renameChannelByCategory, safeRename };
