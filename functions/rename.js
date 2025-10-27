// renameChannel.js
async function renameChannel(channel, CATEGORY_ID) {
  try {
    // --- 1️⃣ Nếu kênh KHÔNG nằm trong danh mục được chỉ định -> bỏ qua ---
    if (channel.parentId !== CATEGORY_ID) return;

    // --- 2️⃣ Nếu kênh có hậu tố -webhook -> đổi sang 🛠★】<username>-macro ---
    if (channel.name.endsWith("-webhook")) {
      const username = channel.name.replace("-webhook", "");
      const newName = `🛠★】${username}-macro`;

      if (channel.name !== newName) {
        await channel.setName(newName);
        console.log(`✅ Đổi tên kênh: ${channel.name} → ${newName}`);
      }
      return;
    }

    // --- 3️⃣ Nếu kênh nằm trong danh mục đặc biệt (1427958263281881088) ---
    //     và có tên dạng 🛠★】<username>-macro thì đổi thành ⏰★】<username>-macro
    //     hoặc ngược lại nếu chuyển ra khỏi danh mục đó.
    const SPECIAL_CATEGORY = "1427958263281881088";

    if (channel.parentId === SPECIAL_CATEGORY && channel.name.startsWith("🛠★】")) {
      const username = channel.name.replace("🛠★】", "").replace("-macro", "");
      const newName = `⏰★】${username}-macro`;
      if (channel.name !== newName) {
        await channel.setName(newName);
        console.log(`🔁 Đổi tên khi vào danh mục đặc biệt: ${channel.name} → ${newName}`);
      }
    } else if (channel.name.startsWith("⏰★】") && channel.parentId !== SPECIAL_CATEGORY) {
      const username = channel.name.replace("⏰★】", "").replace("-macro", "");
      const newName = `🛠★】${username}-macro`;
      if (channel.name !== newName) {
        await channel.setName(newName);
        console.log(`🔁 Đổi tên khi ra khỏi danh mục đặc biệt: ${channel.name} → ${newName}`);
      }
    }
  } catch (err) {
    console.error("❌ Lỗi renameChannel:", err);
  }
}

module.exports = { renameChannel };
