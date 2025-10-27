// functions/rename.js
async function renameChannelByCategory(channel) {
  try {
    const CATEGORY_1 = "1411034825699233943";              // 🛠 danh mục hoạt động
    const CATEGORY_2 = "1427958263281881088";       // ⏰ danh mục ngủ

    if (!channel || !channel.topic) return;
    const [username] = channel.topic.split(" ");
    if (!username) return;

    // 🛠 Danh mục 1
    if (channel.parentId === CATEGORY_1) {
      const newName = `🛠★】${username}-macro`;
      if (channel.name !== newName) {
        await channel.setName(newName).catch(() => {});
        console.log(`🟢 Đổi tên: ${channel.name} → ${newName} (vào danh mục 1)`);
      }
    }

    // ⏰ Danh mục 2
    else if (channel.parentId === CATEGORY_2) {
      const newName = `⏰★】${username}-macro`;
      if (channel.name !== newName) {
        await channel.setName(newName).catch(() => {});
        console.log(`🔵 Đổi tên: ${channel.name} → ${newName} (vào danh mục 2)`);
      }
    }

  } catch (err) {
    console.error("❌ Lỗi renameChannelByCategory:", err);
  }
}

module.exports = { renameChannelByCategory };
