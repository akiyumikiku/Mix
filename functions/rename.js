// Lấy username từ topic hoặc tên kênh
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
  
  // Fallback: parse từ tên kênh
  const match = channel.name.match(/】(.+?)-macro$/);
  if (match) return match[1];
  
  return null;
}

// Hàm tạo tên kênh dự kiến theo category
function buildExpectedName(categoryId, streak, specialBadges, username) {
  const categories = {
    '1427958263281881088': { prefix: '⏰★】', streak: false, sleep: true },  // Dormant
    '1411034825699233943': { prefix: '🛠★】', streak: true, sleep: false },   // Active
    '1446077580615880735': { prefix: '🌐★】', streak: true, sleep: false },   // Cyberspace
    '1445997821336748155': { prefix: '🌸★】', streak: true, sleep: false },   // Dreamspace
    '1445997659948060712': { prefix: '🧩★】', streak: true, sleep: false },   // Glitch
    '1463173837389828097': { prefix: '🤍★】', streak: false, sleep: false }   // Empty
  };
  
  const config = categories[categoryId];
  if (!config) return null;
  
  // Xây dựng các phần của tên kênh
  let prefix = config.prefix;
  let streakBadge = config.streak ? '〔' + streak + '🔥〕' : '';
  let specialPrefix = '';
  
  // Thêm special badges (🌸, 🌐, 🧩)
  if (specialBadges && specialBadges.length > 0) {
    specialPrefix = specialBadges.join('');
    // Nếu là Dormant, thêm 💤 sau badges
    if (config.sleep) {
      specialPrefix += '💤';
    }
  }
  
  // Format cuối cùng: [special badges][prefix][streak][username]-macro
  let name = specialPrefix + prefix + streakBadge + username + '-macro';
  
  // Discord giới hạn tên kênh 100 ký tự
  if (name.length > 100) {
    name = name.substring(0, 100);
  }
  
  return name;
}

// Hàm rename kênh theo category
async function renameChannelByCategory(channel, streak = 0, specialBadges = []) {
  try {
    if (!channel || !channel.topic) return;
    
    const username = await getUsernameFromTopic(channel);
    if (!username) {
      console.log('Cannot get username for: ' + channel.name);
      return;
    }
    
    // Tạo tên kênh dự kiến
    const expectedName = buildExpectedName(channel.parentId, streak, specialBadges, username);
    if (!expectedName) {
      console.log('Cannot build name for: ' + channel.name);
      return;
    }
    
    // Kiểm tra nếu tên kênh hiện tại đã đúng thì bỏ qua
    if (channel.name === expectedName) {
      console.log('Channel name already correct: ' + channel.name);
      return;
    }
    
    // Chỉ rename khi tên khác
    await channel.setName(expectedName).catch((err) => {
      console.error('Failed to rename ' + channel.name + ':', err.message);
    });
    
    console.log('Renamed: ' + channel.name + ' → ' + expectedName);
    
  } catch (err) {
    console.error('Rename error:', err.message);
  }
}

// Set để track các kênh đang rename (tránh race condition)
const renaming = new Set();

// Wrapper function để tránh rename cùng lúc
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

module.exports = { 
  renameChannelByCategory, 
  safeRename,
  getUsernameFromTopic,
  buildExpectedName
};
