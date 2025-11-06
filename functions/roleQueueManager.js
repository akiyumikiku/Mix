// functions/roleQueueManager.js
const queue = new Map();
const processing = new Set();
const { updateMemberRoles } = require("./updateRoles");
const COOLDOWN = parseInt(process.env.UPDATE_COOLDOWN_MS || "4000", 10);

function queueMember(member) {
  const userId = member.id;

  // Nếu user đang đổi role liên tục → không xử lý ngay mà xếp hàng
  if (processing.has(userId)) return;

  processing.add(userId);

  const last = queue.get(userId) || Promise.resolve();

  const next = last
    .catch(() => {})
    .then(() => new Promise(r => setTimeout(r, COOLDOWN))) // Chống spam đổi role
    .then(async () => {
      await updateMemberRoles(member).catch(() => {});
      processing.delete(userId);
    });

  queue.set(userId, next);
}

module.exports = { queueMember };
