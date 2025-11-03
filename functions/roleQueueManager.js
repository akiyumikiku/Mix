// functions/roleQueueManager.js
const { updateMemberRoles } = require("./updateRoles");

const roleQueue = new Map();
let processing = false;

async function processQueue() {
  if (processing) return;
  processing = true;

  while (roleQueue.size > 0) {
    const batch = [...roleQueue.entries()].splice(0, 10); // xử lý 10 user 1 lượt
    for (const [id] of batch) roleQueue.delete(id);

    await Promise.allSettled(batch.map(([id, member]) => updateMemberRoles(member)));
    await new Promise(res => setTimeout(res, 2000)); // nghỉ 2s giữa mỗi batch
  }

  processing = false;
}

function queueMember(member) {
  if (!member || !member.id) return;
  roleQueue.set(member.id, member);
  processQueue();
}

module.exports = { queueMember };
