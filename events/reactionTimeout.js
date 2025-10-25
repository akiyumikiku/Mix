// === events/reactionTimeout.js ===
const TARGET_MESSAGE_ID = "1431700852263096490";
const REACTION_TIMEOUT = 20 * 1000; // 20 giây

module.exports = (client) => {
  client.on("messageReactionAdd", async (reaction, user) => {
    try {
      if (user.bot) return;

      // Nếu reaction không đầy đủ dữ liệu, hãy fetch
      if (reaction.partial) {
        try {
          await reaction.fetch();
        } catch (err) {
          console.error("❌ Không thể fetch reaction:", err);
          return;
        }
      }

      // Chỉ xử lý nếu là tin nhắn mục tiêu
      if (reaction.message.id !== TARGET_MESSAGE_ID) return;

      console.log(`🕒 ${user.tag} vừa thả reaction ${reaction.emoji.name}, đếm 20s...`);

      setTimeout(async () => {
        try {
          // Xóa reaction của riêng người đó
          await reaction.users.remove(user.id);
          console.log(`🧹 Đã xóa reaction của ${user.tag} sau 20s`);
        } catch (err) {
          console.warn(`⚠️ Không thể xóa reaction của ${user.tag}:`, err.message);
        }
      }, REACTION_TIMEOUT);

    } catch (err) {
      console.error("❌ Lỗi trong messageReactionAdd:", err);
    }
  });
};
