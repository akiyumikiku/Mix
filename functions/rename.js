// functions/rename.js
const usernameCache = new Map();

async function getUsernameFromTopic(channel) {
  if (!channel.topic) return null;
  
  // Topic format: "username userid"
  // Ví dụ: "sergeenva.x.y.z 1363025491765891335"
  const parts = channel.topic.trim().split(/\s+/);
  
  if (parts.length >= 2) {
    const username = parts[0];
    const userId = parts[1];
    
    // Kiểm tra userId có đúng format không (17-20 chữ số)
    if (/^\d{17,20}$/.test(userId)) {
      console.log('✅ Parsed from topic: ' + username + ' | UserID: ' + userId);
      return username;
    }
  }
  
  // Fallback: parse từ tên channel nếu có format chuẩn
  const nameMatch = channel.name.match(/】(.+?)-macro$/);
  if (nameMatch) {
    console.log('ℹ️ Fallback - username từ tên channel: ' + nameMatch[1]);
    return nameMatch[1];
  }
  
  return null;
}

async function renameChannelByCategory(channel, streak = 0, specialBadges = []) {
  try {
    const CATEGORY_SLEEP = '1427958263281881088';
    const CATEGORY_ACTIVE = '1411034825699233943';
    const CATEGORY_CYBER = '1446077580615880735';
    const CATEGORY_DREAM = '1445997821336748155';
    const CATEGORY_GLITCH = '1445997659948060712';

    if (!channel) {
      console.log('⚠️ Channel không tồn tại');
      return;
    }

    if (!channel.topic) {
      console.log('⚠️ Channel không có topic: ' + channel.id + ' | Name: ' + channel.name);
      return;
    }

    const username = await getUsernameFromTopic(channel);
    if (!username) {
      console.log('⚠️ Không parse được username từ topic: ' + channel.topic);
      return;
    }

    let prefix = '🛠★】';
    let suffix = '-macro';
    let streakBadge = '';
    let specialPrefix = '';

    if (channel.parentId === CATEGORY_SLEEP) {
      prefix = '⏰★】';
      if (specialBadges.length > 0) {
        specialPrefix = specialBadges.join('') + '💤';
      }
    } else if (channel.parentId === CATEGORY_CYBER) {
      prefix = '🌐★】';
      streakBadge = '〔' + streak + '🔥〕';
      if (specialBadges.length > 0) {
        specialPrefix = specialBadges.join('');
      }
    } else if (channel.parentId === CATEGORY_DREAM) {
      prefix = '🌸★】';
      streakBadge = '〔' + streak + '🔥〕';
      if (specialBadges.length > 0) {
        specialPrefix = specialBadges.join('');
      }
    } else if (channel.parentId === CATEGORY_GLITCH) {
      prefix = '🧩★】';
      streakBadge = '〔' + streak + '🔥〕';
      if (specialBadges.length > 0) {
        specialPrefix = specialBadges.join('');
      }
    } else if (channel.parentId === CATEGORY_ACTIVE) {
      prefix = '🛠★】';
      streakBadge = '〔' + streak + '🔥〕';
    } else {
      console.log('⚠️ Channel không thuộc category nào được quản lý: ' + channel.parentId);
      return;
    }

    let newName;
    if (specialPrefix) {
      newName = specialPrefix + prefix + streakBadge + username + suffix;
    } else {
      newName = prefix + streakBadge + username + suffix;
    }

    // Discord giới hạn tên channel 100 ký tự
    if (newName.length > 100) {
      newName = newName.substring(0, 100);
      console.log('⚠️ Tên channel bị cắt ngắn xuống 100 ký tự');
    }

    if (channel.name !== newName) {
      await channel.setName(newName).catch((err) => {
        console.error('❌ Không thể đổi tên kênh ' + channel.id + ': ' + err.message);
      });
      console.log('✅ Đổi tên: ' + channel.name + ' → ' + newName);
    } else {
      console.log('⚙️ Giữ nguyên: ' + channel.name);
    }

  } catch (err) {
    console.error('❌ Lỗi renameChannelByCategory:', err);
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
