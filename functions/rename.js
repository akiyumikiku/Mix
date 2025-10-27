// ===============================
// ⚡ renameChannelByCategory
// ===============================
async function renameChannelByCategory(channel) {
  try {
    const CATEGORY_ACTIVE = "1411034825699233943"; // danh mục hoạt động
    const CATEGORY_SLEEP = "1427958263281881088";  // danh mục ngủ

    if (!channel || !channel.topic) return;
    const [username] = channel.topic.split(" ");
    if (!username) return;

    let expectedName = null;
    let categoryLabel = "";

    if (channel.parentId === CATEGORY_ACTIVE) {
      expectedName = `🛠★】${username}-macro`;
      categoryLabel = "hoạt động";
    } else if (channel.parentId === CATEGORY_SLEEP) {
      expectedName = `⏰★】${username}-macro`;
      categoryLabel = "ngủ";
    }

    if (!expectedName) return;

    // Chỉ rename khi khác
    if (channel.name !== expectedName) {
      const old = channel.name;
      await channel.setName(expectedName);
      console.log(`✅ Rename: ${old} → ${expectedName} (${categoryLabel})`);
    }
  } catch (err) {
    console.error("❌ renameChannelByCategory lỗi:", err.message);
  }
}

module.exports = { renameChannelByCategory };
