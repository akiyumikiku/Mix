// ============================================
// FILE: functions/timeCalculator.js
// Helper functions để tính thời gian webhook
// ============================================

/**
 * Tính tổng thời gian macro từ array timestamps
 * Loại bỏ khoảng nghỉ (gap > maxGap)
 * 
 * @param {Array<Number>} times - Array of timestamps (ms)
 * @param {Number} maxGap - Max gap between messages to consider as same session (default 10 min)
 * @returns {Number} Total active time in milliseconds
 */
function calculateActiveTime(times, maxGap = 10 * 60 * 1000) {
  if (!times || times.length < 2) return 0;
  
  // Ensure sorted
  const sorted = [...times].sort((a, b) => a - b);
  
  let totalActive = 0;
  
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    
    // Only count gaps within maxGap (continuous activity)
    if (gap <= maxGap) {
      totalActive += gap;
    }
  }
  
  return totalActive;
}

/**
 * Fetch webhook messages từ channel và tính thời gian
 * 
 * @param {Channel} channel - Discord text channel
 * @param {Number} limit - Max messages to fetch (max 100)
 * @returns {Promise<Object>} { activeTime: number, webhookCount: number, messages: Collection }
 */
async function fetchAndCalculateTime(channel, limit = 100) {
  try {
    // Discord API limit
    const actualLimit = Math.min(limit, 100);
    
    // Fetch messages
    const messages = await channel.messages.fetch({ limit: actualLimit });
    
    // Filter webhooks only
    const webhookMessages = messages.filter(m => m.webhookId);
    
    if (webhookMessages.size === 0) {
      return {
        activeTime: 0,
        webhookCount: 0,
        messages: webhookMessages,
        error: null
      };
    }
    
    // Get timestamps
    const times = webhookMessages.map(m => m.createdTimestamp);
    
    // Calculate active time
    const activeTime = calculateActiveTime(times);
    
    return {
      activeTime,
      webhookCount: webhookMessages.size,
      messages: webhookMessages,
      error: null
    };
    
  } catch (err) {
    return {
      activeTime: 0,
      webhookCount: 0,
      messages: null,
      error: err.message
    };
  }
}

/**
 * Format milliseconds thành human-readable time
 * 
 * @param {Number} ms - Time in milliseconds
 * @returns {String} Formatted time string (e.g., "3h 45m")
 */
function formatTime(ms) {
  if (!ms || ms <= 0) return '0h 0m';
  
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Convert milliseconds to hours (decimal)
 * 
 * @param {Number} ms - Time in milliseconds
 * @returns {Number} Hours (decimal)
 */
function msToHours(ms) {
  return ms / 3600000;
}

/**
 * Categorize channels by active time
 * 
 * @param {Map} channelDataMap - Map of { channel, activeTime }
 * @returns {Object} { above18h: [], above12h: [], above6h: [] }
 */
function categorizeByTime(channelDataMap) {
  const results = {
    above18h: [],
    above12h: [],
    above6h: []
  };
  
  for (const [channel, data] of channelDataMap) {
    const hours = msToHours(data.activeTime);
    
    if (hours >= 18) results.above18h.push({ channel, ...data });
    if (hours >= 12) results.above12h.push({ channel, ...data });
    if (hours >= 6) results.above6h.push({ channel, ...data });
  }
  
  return results;
}

module.exports = {
  calculateActiveTime,
  fetchAndCalculateTime,
  formatTime,
  msToHours,
  categorizeByTime
};
