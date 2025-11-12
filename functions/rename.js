// functions/rename.js
async function renameChannelByCategory(channel, isNew = false) {
  try {
    const CATEGORY_1 = "1411034825699233943"; // Danh mục hoạt động
    const CATEGORY_2 = "1427958263281881088"; // Danh mục ngủ

    if (!channel || !channel.topic) return;

    // Lấy username từ topic
    const [username] = channel.topic.split(" ");
    if (!username) return;

    // Xác định prefix mới theo danh mục
    let newPrefix;
    if (channel.parentId === CATEGORY_1) {
      newPrefix = "🛠★】";
    } else if (channel.parentId === CATEGORY_2) {
      newPrefix = "⏰★】";
    } else return;

    // Loại bỏ prefix cũ (nếu có)
    const currentBase = channel.name.replace(/^([^\w]*)★】/, "");

    const expectedBase = `${username}-macro`;

    let newName;

    if (isNew || !currentBase.startsWith(expectedBase)) {
      // 🔹 Nếu là kênh mới hoặc tên không khớp username → rename toàn bộ
      newName = `${newPrefix}${expectedBase}`;
    } else {
      // 🔹 Nếu tên đã đúng username → chỉ đổi prefix, giữ phần đuôi
      const rest = currentBase.slice(expectedBase.length).trim(); // phần như "x1 🌸"
      newName = `${newPrefix}${expectedBase}${rest ? " " + rest : ""}`;
    }

    // Đổi tên nếu khác
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

// Tránh rename trùng lặp
const renaming = new Set();
async function safeRename(channel, isNew = false) {
  if (renaming.has(channel.id)) return;
  renaming.add(channel.id);
  try {
    await renameChannelByCategory(channel, isNew);
  } finally {
    renaming.delete(channel.id);
  }
}

module.exports = { renameChannelByCategory, safeRename };
