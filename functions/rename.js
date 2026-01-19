// functions/rename.js
const usernameCache = new Map(); // Cache username để tránh fetch nhiều lần

async function getUsernameFromTopic(channel) {
const userId = channel.topic?.match(/\d{17,20}/)?.[0];
if (!userId) return null;

// Check cache
const cached = usernameCache.get(userId);
if (cached && cached.expiry > Date.now()) {
return cached.username;
}

// Fetch nếu không có trong cache
const member = await channel.guild.members.fetch(userId).catch(() => null);
if (!member) return null;

const username = member.user.username;

// Cache trong 1 giờ
usernameCache.set(userId, {
username,
expiry: Date.now() + 3600000
});

return username;
}

async function renameChannelByCategory(channel, streak = 0, specialBadges = []) {
try {
const CATEGORY_SLEEP = “1427958263281881088”; // Ngủ
const CATEGORY_ACTIVE = “1411034825699233943”; // Thức
const CATEGORY_CYBER = “1446077580615880735”; // Cyberspace
const CATEGORY_DREAM = “1445997821336748155”; // Dreamspace
const CATEGORY_GLITCH = “1445997659948060712”; // Glitch

```
if (!channel || !channel.topic) return;

const username = await getUsernameFromTopic(channel);
if (!username) {
  console.log(`⚠️ Không tìm thấy username cho kênh: ${channel.id}`);
  return;
}

let prefix = "🛠★】"; // Default cho active
let suffix = "-macro";
let streakBadge = "";
let specialPrefix = "";

// Xác định prefix dựa trên danh mục
if (channel.parentId === CATEGORY_SLEEP) {
  prefix = "⏰★】";
  // Thêm 💤 nếu có special badges
  if (specialBadges.length > 0) {
    specialPrefix = specialBadges.join("") + "💤";
  }
} else if (channel.parentId === CATEGORY_CYBER) {
  prefix = "🌐★】";
  streakBadge = `〔${streak}🔥〕`;
  if (specialBadges.length > 0) {
    specialPrefix = specialBadges.join("");
  }
} else if (channel.parentId === CATEGORY_DREAM) {
  prefix = "🌸★】";
  streakBadge = `〔${streak}🔥〕`;
  if (specialBadges.length > 0) {
    specialPrefix = specialBadges.join("");
  }
} else if (channel.parentId === CATEGORY_GLITCH) {
  prefix = "🧩★】";
  streakBadge = `〔${streak}🔥〕`;
  if (specialBadges.length > 0) {
    specialPrefix = specialBadges.join("");
  }
} else if (channel.parentId === CATEGORY_ACTIVE) {
  prefix = "🛠★】";
  streakBadge = `〔${streak}🔥〕`;
} else {
  return; // Không thuộc danh mục nào
}

// Build tên mới
let newName;
if (specialPrefix) {
  newName = `${specialPrefix}${prefix}${streakBadge}${username}${suffix}`;
} else {
  newName = `${prefix}${streakBadge}${username}${suffix}`;
}

// Đổi tên nếu khác
if (channel.name !== newName) {
  await channel.setName(newName).catch((err) => {
    console.error(`❌ Không thể đổi tên kênh ${channel.id}:`, err.message);
  });
  console.log(`✅ Đổi tên: ${channel.name} → ${newName}`);
} else {
  console.log(`⚙️ Giữ nguyên: ${channel.name}`);
}
```

} catch (err) {
console.error(“❌ Lỗi renameChannelByCategory:”, err);
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