// renameChannel.js
async function renameChannelByCategory(channel) {
  try {
    const CATEGORY_1 = "1411034825699233943"; // thay ID danh mục 1
    const CATEGORY_2 = "1427958263281881088"; // thay ID danh mục 2

    if (!channel || !channel.topic) return; // kênh không có topic thì bỏ qua

    // lấy username từ topic ("username iduser")
    const [username] = channel.topic.split(" ");
    if (!username) return;

    // Danh mục 1 → 🛠★】username-macro
    if (channel.parentId === CATEGORY_1) {
      const newName = `🛠★】${username}-macro`;
      if (channel.name !== newName) {
        await channel.setName(newName);
        console.log(`🛠 Đổi tên trong danh mục 1: ${channel.name} → ${newName}`);
      }
    }

    // Danh mục 2 → ⏰★】username-macro
    else if (channel.parentId === CATEGORY_2) {
      const newName = `⏰★】${username}-macro`;
      if (channel.name !== newName) {
        await channel.setName(newName);
        console.log(`⏰ Đổi tên trong danh mục 2: ${channel.name} → ${newName}`);
      }
    }

  } catch (err) {
    console.error("❌ Lỗi renameChannelByCategory:", err);
  }
}

module.exports = { renameChannelByCategory };
