module.exports = (client) => {
  client.on("messageCreate", async (message) => {
    try {
      // Chỉ xử lý tin nhắn từ bot có ID kia
      if (message.author.id !== "1335725304697720922") return;

      // Nếu chứa cụm text cần xóa
      if (message.content.includes("✅ Successfully created macro channel")) {
        await message.delete().catch(() => {});
        console.log("🗑️ Đã xoá tin nhắn auto từ bot macro.");
      }
    } catch (err) {
      console.error("❌ Lỗi khi xoá tin nhắn:", err);
    }
  });
};
