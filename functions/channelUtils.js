// ============================================
// FILE: functions/channelUtils.js
// Helper functions cho channel operations
// ============================================

const STREAK_CATEGORIES = [
  '1411034825699233943', // Active
  '1446077580615880735', // Cyberspace
  '1445997821336748155', // Dreamspace
  '1445997659948060712'  // Glitch
];

const ALL_CATEGORIES = [
  '1427958263281881088', // Dormant
  '1411034825699233943', // Active
  '1446077580615880735', // Cyberspace
  '1445997821336748155', // Dreamspace
  '1445997659948060712', // Glitch
  '1463173837389828097'  // Empty
];

/**
 * Get category name from ID
 */
function getCategoryName(categoryId) {
  const names = {
    '1427958263281881088': 'Dormant',
    '1411034825699233943': 'Active',
    '1446077580615880735': 'Cyberspace',
    '1445997821336748155': 'Dreamspace',
    '1445997659948060712': 'Glitch',
    '1463173837389828097': 'Empty'
  };
  return names[categoryId] || 'Unknown';
}

/**
 * Check if channel is in tracked category
 */
function isTrackedChannel(channel) {
  return channel.type === 0 && STREAK_CATEGORIES.includes(channel.parentId);
}

/**
 * Get all macro channels from guild
 */
function getMacroChannels(guild) {
  return guild.channels.cache.filter(ch => 
    ch.type === 0 && 
    STREAK_CATEGORIES.includes(ch.parentId) &&
    ch.name.endsWith('-macro')
  );
}

/**
 * Parse streak from channel name
 */
function parseStreak(channelName) {
  const match = channelName.match(/〔(\d+)🔥〕/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Parse badges from channel name
 */
function parseBadges(channelName) {
  const badges = [];
  const match = channelName.match(/^(.+?)★】/);
  
  if (!match) return badges;
  
  const prefix = match[1];
  
  // Find badges with counter (x2🌸, x3🌐, etc.)
  const withCounter = prefix.match(/x\d+(🌸|🌐|🧩)/g);
  if (withCounter) {
    withCounter.forEach(badge => badges.push(badge));
  }
  
  // Find single badges
  const singleEmojis = ['🌸', '🌐', '🧩'];
  singleEmojis.forEach(emoji => {
    if (prefix.includes(emoji) && !badges.some(b => b.includes(emoji))) {
      badges.push(emoji);
    }
  });
  
  return badges;
}

/**
 * Get user ID from channel topic
 */
function getUserIdFromTopic(topic) {
  if (!topic) return null;
  const parts = topic.trim().split(/\s+/);
  return parts.length >= 2 && /^\d{17,20}$/.test(parts[1]) ? parts[1] : null;
}

module.exports = {
  STREAK_CATEGORIES,
  ALL_CATEGORIES,
  getCategoryName,
  isTrackedChannel,
  getMacroChannels,
  parseStreak,
  parseBadges,
  getUserIdFromTopic
};
