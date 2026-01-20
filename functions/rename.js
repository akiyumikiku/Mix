// functions/rename.js
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

async function renameChannelByCategory(channel, streak = 0, specialBadges = []) {
try {
const CATEGORY_SLEEP = ‘1427958263281881088’;
const CATEGORY_ACTIVE = ‘1411034825699233943’;
const CATEGORY_CYBER = ‘1446077580615880735’;
const CATEGORY_DREAM = ‘1445997821336748155’;
const CATEGORY_GLITCH = ‘1445997659948060712’;
const CATEGORY_EMPTY = ‘1463173837389828097’;

```
if (!channel) return;
if (!channel.topic) {
  console.log('No topic: ' + channel.name);
  return;
}

const username = await getUsernameFromTopic(channel);
if (!username) {
  console.log('No username from topic: ' + channel.topic);
  return;
}

const categoryMap = {
  [CATEGORY_SLEEP]: { prefix: '⏰★】', streak: false, sleep: true },
  [CATEGORY_ACTIVE]: { prefix: '🛠★】', streak: true, sleep: false },
  [CATEGORY_CYBER]: { prefix: '🌐★】', streak: true, sleep: false },
  [CATEGORY_DREAM]: { prefix: '🌸★】', streak: true, sleep: false },
  [CATEGORY_GLITCH]: { prefix: '🧩★】', streak: true, sleep: false },
  [CATEGORY_EMPTY]: { prefix: '🤍★】', streak: false, sleep: false }
};

const config = categoryMap[channel.parentId];
if (!config) {
  console.log('Unknown category: ' + channel.parentId);
  return;
}

let prefix = config.prefix;
let streakBadge = '';
let specialPrefix = '';

if (config.streak) {
  streakBadge = '〔' + streak + '🔥〕';
}

if (specialBadges.length > 0) {
  if (config.sleep) {
    specialPrefix = specialBadges.join('') + '💤';
  } else {
    specialPrefix = specialBadges.join('');
  }
}

let newName;
if (specialPrefix) {
  newName = specialPrefix + prefix + streakBadge + username + '-macro';
} else {
  newName = prefix + streakBadge + username + '-macro';
}

if (newName.length > 100) {
  newName = newName.substring(0, 100);
  console.log('Name truncated to 100 chars');
}

if (channel.name !== newName) {
  await channel.setName(newName).catch((err) => {
    console.error('Rename failed ' + channel.id + ': ' + err.message);
  });
  console.log('Renamed: ' + channel.name + ' → ' + newName);
}
```

} catch (err) {
console.error(‘Rename error:’, err);
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
