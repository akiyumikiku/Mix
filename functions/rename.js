async function getUsernameFromTopic(channel) {
  if (!channel.topic) return null;
  const parts = channel.topic.trim().split(/\s+/);
  if (parts.length >= 2) {
    const username = parts[0];
    const userId = parts[1];
    if (/^\d{17,20}$/.test(userId)) {
      return username;
    }
  }
  const match = channel.name.match(/】(.+?)-macro$/);
  if (match) return match[1];
  return null;
}

// Hàm tạo tên kênh dự kiến
function buildExpectedName(categoryId, streak, specialBadges, username) {
  const categories = {
    '1427958263281881088': { prefix: '⏰★】', streak: false, sleep: true },
    '1411034825699233943': { prefix: '🛠★】', streak: true, sleep: false },
    '1446077580615880735': { prefix: '🌐★】', streak: true, sleep: false },
    '1445997821336748155': { prefix: '🌸★】', streak: true, sleep: false },
    '1445997659948060712': { prefix: '🧩★】', streak: true, sleep: false },
    '1463173837389828097': { prefix: '🤍★】', streak: false, sleep: false }
  };

  const config = categories[categoryId];
  if (!config) return null;

  let prefix = config.prefix;
  let streakBadge = config.streak ? '〔' + streak + '🔥〕' : '';
  let specialPrefix = '';
  
  if (specialBadges.length > 0) {
    specialPrefix = specialBadges.join('');
    if (config.sleep) specialPrefix += '💤';
  }

  let name = specialPrefix + prefix + streakBadge + username + '-macro';
  if (name.length > 100) name = name.substring(0, 100);
  
  return name;
}

async function renameChannelByCategory(channel, streak = 0, specialBadges = []) {
  try {
    if (!channel || !channel.topic) return;
    
    const username = await getUsernameFromTopic(channel);
    if (!username) return;

    // Tạo tên kênh dự kiến
    const expectedName = buildExpectedName(channel.parentId, streak, specialBadges, username);
    if (!expectedName) return;

    // Kiểm tra nếu tên kênh hiện tại đã đúng thì bỏ qua
    if (channel.name === expectedName) {
      console.log('Channel name already correct: ' + channel.name);
      return;
    }

    // Chỉ rename khi tên khác
    await channel.setName(expectedName).catch((err) => {
      console.error('Failed to rename:', err.message);
    });
    console.log('Renamed: ' + channel.name + ' → ' + expectedName);
    
  } catch (err) {
    console.error('Rename error:', err.message);
  }
}

const renaming = new Set();

async function safeRename(channel, streak, specialBadges) {
  if (renaming.has(channel.id)) {
    console.log('Already renaming: ' + channel.id);
    return;
  }
  
  renaming.add(channel.id);
  try {
    await renameChannelByCategory(channel, streak, specialBadges);
  } finally {
    renaming.delete(channel.id);
  }
}

module.exports = { renameChannelByCategory, safeRename };
