// functions/rename.js
async function renameChannelByCategory(channel) {
  try {
    const CATEGORY_1 = "1411034825699233943"; // Danh mục hoạt động
    const CATEGORY_2 = "1427958263281881088"; // Danh mục ngủ

    if (!channel || !channel.topic) return;

    const [username] = channel.topic.split(" ");
    if (!username) return;

    let newName;

    if (channel.parentId === CATEGORY_1) {
      newName = `🛠★】${username}-macro`;
    } else if (channel.parentId === CATEGORY_2) {
      newName = `⏰★】${username}-macro`;
    } else {
      return; // Không thuộc 2 danh mục cần rename
    }

    if (channel.name !== newName) {
      await channel.setName(newName).catch(() => {});
      console.log(`✅ Đổi tên: ${channel.name} → ${newName}`);
    }
  } catch (err) {
    console.error("❌ Lỗi renameChannelByCategory:", err);
  }
}

module.exports = { renameChannelByCategory };
