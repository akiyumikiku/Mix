module.exports = (client, updateMemberRoles) => {
  client.on("guildMemberAdd", updateMemberRoles);
  client.on("guildMemberUpdate", (_, newMember) => updateMemberRoles(newMember));
};
