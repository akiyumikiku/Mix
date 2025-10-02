async function renameChannel(channel, CATEGORY_ID) {
  if (channel.parentId !== CATEGORY_ID) return;
  if (!channel.name.endsWith("-webhook")) return;
  const username = channel.name.replace("-webhook", "");
  const newName = `🛠★】${username}-macro`;
  if (channel.name !== newName) {
    await channel.setName(newName).catch(console.error);
    console.log(`✅ Đã đổi tên: ${channel.name} → ${newName}`);
  }
}

module.exports = { renameChannel };
