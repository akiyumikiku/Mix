// functions/rename.js
const usernameCache = new Map();

async function getUsernameFromTopic(channel) {
const userId = channel.topic?.match(/\d{17,20}/)?.[0];
if (!userId) return null;

const cached = usernameCache.get(userId);
if (cached && cached.expiry > Date.now()) {
return cached.username;
}

const member = await channel.guild.members.fetch(userId).catch(() => null);
if (!member) return null;

const username = member.user.username;

usernameCache.set(userId, {
username,
expiry: Date.now() + 3600000
});

return username;
}

async function renameChannelByCategory(channel, streak = 0, specialBadges = []) {
try {
const CATEGORY_SLEEP = ‘1427958263281881088’;
const CATEGORY_ACTIVE = ‘1411034825699233943’;
const CATEGORY_CYBER = ‘1446077580615880735’;
const CATEGORY_DREAM = ‘1445997821336748155’;
const CATEGORY_GLITCH = ‘1445997659948060712’;

```
if (!channel || !channel.topic) return;

const username = await getUsernameFromTopic(channel);
if (!username) {
  console.log('⚠️ Không tìm thấy username cho kênh: ' + channel.id);
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
  return;
}

let newName;
if (specialPrefix) {
  newName = specialPrefix + prefix + streakBadge + username + suffix;
} else {
  newName = prefix + streakBadge + username + suffix;
}

if (channel.name !== newName) {
  await channel.setName(newName).catch((err) => {
    console.error('❌ Không thể đổi tên kênh ' + channel.id + ': ' + err.message);
  });
  console.log('✅ Đổi tên: ' + channel.name + ' → ' + newName);
} else {
  console.log('⚙️ Giữ nguyên: ' + channel.name);
}
```

} catch (err) {
console.error(‘❌ Lỗi renameChannelByCategory:’, err);
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
