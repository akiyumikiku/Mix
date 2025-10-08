const { updateMemberRoles } = require("../functions/updateRoles");

module.exports = (client) => {
  // Khi member mới vào → cấp role tự động
  client.on("guildMemberAdd", (member) => {
    updateMemberRoles(member);
  });

  // Khi member thay đổi role → cập nhật ngay
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    try {
      // So sánh roles cũ và mới để tránh spam
      const oldRoles = oldMember.roles.cache.map(r => r.id);
      const newRoles = newMember.roles.cache.map(r => r.id);

      const rolesChanged =
        oldRoles.length !== newRoles.length ||
        oldRoles.some(id => !newRoles.includes(id));

      if (rolesChanged) {
        await updateMemberRoles(newMember);
      }
    } catch (err) {
      console.error("⚠️ guildMemberUpdate error:", err);
    }
  });
};
