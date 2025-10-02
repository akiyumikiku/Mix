const { updateMemberRoles } = require("./updateRoles");

module.exports = (client) => {
  client.on("guildMemberAdd", updateMemberRoles);
  client.on("guildMemberUpdate", (_, newMember) => updateMemberRoles(newMember));
};
