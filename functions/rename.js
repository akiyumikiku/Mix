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
  // Fallback: extract từ channel name
  const match = channel.name.match(/】(.+?)-macro$/);
  if (match) return match[1];
  return null;
}

async function renameChannelByCategory(channel, streak = 0, specialBadges = []) {
  try {
    const categories = {
      '1427958263281881088': { prefix: '⏰★】', streak: false, sleep: true },
      '1411034825699233943': { prefix: '🛠★】', streak: true, sleep: false },
      '1446077580615880735': { prefix: '🌐★】', streak: true, sleep: false },
      '1445997821336748155': { prefix: '🌸★】', streak: true, sleep: false },
      '1445997659948060712': { prefix: '🧩★】', streak: true, sleep: false },
      '1463173837389828097': { prefix: '🤍★】', streak: false, sleep: false }
    };

    if (!channel || !channel.topic) return;

    const username = await getUsernameFromTopic(channel);
    if (!username) return;

    const config = categories[channel.parentId];
    if (!config) return;

    // FIX: Tạo tên channel từ đầu để tránh đè chồng
    let name = '';
    
    // Thêm special badges
    if (specialBadges.length > 0) {
      name += specialBadges.join('');
    }
    
    // Thêm prefix theo category
    name += config.prefix;
    
    // Thêm streak badge nếu category cho phép
    if (config.streak && streak > 0) {
      name += '〔' + streak + '🔥〕';
    }
    
    // Thêm sleep emoji cho dormant channels
    if (config.sleep && specialBadges.length > 0) {
      // Chỉ thêm 💤 nếu chưa có trong special badges
      if (!name.includes('💤')) {
        name += '💤';
      }
    }
    
    // Thêm username và suffix
    name += username + '-macro';

    // Giới hạn độ dài
    if (name.length > 100) {
      name = name.substring(0, 100);
    }

    // Chỉ rename nếu tên khác
    if (channel.name !== name) {
      await channel.setName(name).catch((err) => {
        console.error('Rename failed:', err.message);
      });
      console.log('Renamed: ' + name);
    }
  } catch (err) {
    console.error('Rename error:', err.message);
  }
}

const renaming = new Set();

async function safeRename(channel, streak, specialBadges) {
  if (renaming.has(channel.id)) return;
  renaming.add(channel.id);
  try {
    await renameChannelByCategory(channel, streak, specialBadges);
  } finally {
    renaming.delete(channel.id);
  }
}

module.exports = { renameChannelByCategory, safeRename };
