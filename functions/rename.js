const renameQueue = new Map();

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
    if (channel.name === expectedName) return;

    // Nếu đã có queue rename cho channel này → nối vào sau
    const current = renameQueue.get(channel.id) || Promise.resolve();

    const next = current
      .then(async () => {
        await channel.setName(expectedName);
        console.log(`✅ Đổi tên: ${channel.name} → ${expectedName} (${categoryLabel})`);
      })
      .catch((err) => {
        if (err.code === 50013) console.warn(`⚠️ Thiếu quyền rename kênh ${channel.name}`);
        else console.error("❌ Lỗi renameChannelByCategory:", err);
      })
      .finally(() => {
        renameQueue.delete(channel.id);
      });

    renameQueue.set(channel.id, next);
  } catch (err) {
    console.error("❌ Lỗi renameChannelByCategory:", err);
  }
}

module.exports = { renameChannelByCategory };
