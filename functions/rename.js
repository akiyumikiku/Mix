// functions/rename.js
async function renameChannelByCategory(channel) {
  try {
    const CATEGORY_1 = "1411034825699233943"; // Danh mục hoạt động
    const CATEGORY_2 = "1427958263281881088"; // Danh mục ngủ

    if (!channel) return;

    // Lấy username từ topic (như trước). Nếu topic rỗng, cố tìm userId trong topic.
    const topic = channel.topic || "";
    const username = topic.split(" ")[0] || null;
    if (!username) {
      // nếu không lấy được username thì không đổi tên (an toàn)
      console.log(`⚠️ rename: no username in topic for channel ${channel.id}`);
      return;
    }

    let prefix = null;
    if (channel.parentId === CATEGORY_1) prefix = "🛠★】";
    else if (channel.parentId === CATEGORY_2) prefix = "⏰★】";
    else return;

    // Lấy suffix: mọi thứ sau '】' nếu có, giữ nguyên (loại bỏ khoảng trắng thừa)
    let suffix = "";
    if (channel.name && channel.name.includes("】")) {
      // Lấy phần sau dấu '】' đầu tiên
      const parts = channel.name.split("】");
      parts.shift(); // bỏ phần trước '】'
      suffix = parts.join("】").trim();
      // Nếu suffix không chứa username thì thêm username vào đầu suffix (như cũ)
      if (!suffix.includes(username)) {
        suffix = `${username}-${suffix}`;
      }
    } else {
      // fallback: tạo suffix mặc định
      suffix = `${username}-macro`;
    }

    const newName = `${prefix}${suffix}`;

    if (channel.name !== newName) {
      try {
        await channel.setName(newName);
        console.log(`✅ Đổi tên: ${channel.name} → ${newName}`);
      } catch (err) {
        console.error("❌ setName error:", err, "channelId:", channel.id);
      }
    } else {
      console.log(`⚙️ Giữ nguyên: ${channel.name}`);
    }
  } catch (err) {
    console.error("❌ Lỗi renameChannelByCategory:", err);
  }
}

module.exports = { renameChannelByCategory };
