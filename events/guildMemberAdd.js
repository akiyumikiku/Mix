const { updateMemberRoles } = require("../functions/updateRoles");

module.exports = (client) => {
  client.on("guildMemberAdd", async (member) => {
    await updateMemberRoles(member);
  });

  client.on("guildMemberUpdate", async (_, newMember) => {
    await updateMemberRoles(newMember);
  });
};
