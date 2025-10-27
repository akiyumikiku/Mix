// functions/rename.js
async function renameChannelByCategory(channel) {
  try {
    const CATEGORY_1 = "1411034825699233943"; // danh mục hoạt động
    const CATEGORY_2 = "1427958263281881088"; // danh mục ngủ

    if (!channel || !channel.topic) return;
    const [username] = channel.topic.split(" ");
    if (!username) return;

    let expectedName = null;
    let categoryLabel = "";

    if (channel.parentId === CATEGORY_1) {
      expectedName = `🛠★】${username}-macro`;
      categoryLabel = "danh mục 1 (hoạt động)";
    } else if (channel.parentId === CATEGORY_2) {
      expectedName = `⏰★】${username}-macro`;
      categoryLabel = "danh mục 2 (ngủ)";
    }

    if (!expectedName) return;

    if (channel.name !== expectedName) {
      const oldName = channel.name;
      await channel.setName(expectedName).catch(() => {});
      console.log(`✅ Đổi tên: ${oldName} → ${expectedName} (${categoryLabel})`);
    }

  } catch (err) {
    console.error("❌ Lỗi renameChannelByCategory:", err);
  }
}

module.exports = { renameChannelByCategory };
