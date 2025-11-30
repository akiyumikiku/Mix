// functions/webhookTracker.js
const fs = require("fs").promises;
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "webhookActivity.json");

// time constants
const SIX_HOURS = 6 * 60 * 60 * 1000;
const RESET_INACTIVE = 24 * 60 * 60 * 1000;
const SHORT_DIFF_MS = 5 * 60 * 1000;

async function loadData() {
  try {
    const exists = await fs.stat(DATA_FILE).then(() => true).catch(() => false);
    if (!exists) return {};
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("❌ webhookTracker.loadData error:", e);
    return {};
  }
}

async function saveData(data) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("❌ webhookTracker.saveData error:", e);
  }
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function resetIfNeeded(record) {
  const today = todayString();
  if (record.lastReset !== today) {
    record.totalActiveMsToday = 0;
    record.warnCount = 0;
    record.lastReset = today;
  }
}

/**
 * updateWebhookActivity(webhookId, channelId)
 * - persist mapping webhookId -> channelId
 * - maintain totalActiveMsToday as before
 * - maintain streak: reset if > RESET_INACTIVE, +1 if >= SIX_HOURS
 * returns { added, streak, wasReset }
 */
module.exports.updateWebhookActivity = async function (webhookId, channelId = null) {
  const data = await loadData();

  if (!data[webhookId]) {
    data[webhookId] = {
      totalActiveMsToday: 0,
      lastMessageAt: 0,
      warnCount: 0,
      lastReset: todayString(),
      streak: 0,
      lastActiveForStreak: 0,
      channelId: null
    };
  }

  const record = data[webhookId];
  resetIfNeeded(record);

  const now = Date.now();
  let added = false;
  let wasReset = false;

  if (channelId) record.channelId = channelId;

  // reset streak if inactive too long
  if (record.lastActiveForStreak > 0 && (now - record.lastActiveForStreak) >= RESET_INACTIVE) {
    record.streak = 0;
    wasReset = true;
  }

  // add streak if passed SIX_HOURS since lastActiveForStreak (and not the very first)
  if (record.lastActiveForStreak > 0 && (now - record.lastActiveForStreak) >= SIX_HOURS) {
    record.streak = (record.streak || 0) + 1;
    added = true;
  }

  // update lastActiveForStreak to now (always refresh on webhook tick)
  record.lastActiveForStreak = now;

  // keep totalActiveMsToday similar to old logic
  if (record.lastMessageAt > 0) {
    const diff = now - record.lastMessageAt;
    if (diff < SHORT_DIFF_MS) {
      record.totalActiveMsToday = (record.totalActiveMsToday || 0) + diff;
    }
  }
  record.lastMessageAt = now;

  await saveData(data);
  return { added, streak: record.streak || 0, wasReset };
};

module.exports.checkWebhookWarnings = async function (client, warnChannelId, sleepCategoryId) {
  const data = await loadData();
  const warnChannel = client.channels.cache.get(warnChannelId);

  for (const [webhookId, record] of Object.entries(data)) {
    resetIfNeeded(record);
    const hours = (record.totalActiveMsToday || 0) / 1000 / 60 / 60;
    if (hours >= 6) continue;

    record.warnCount = (record.warnCount || 0) + 1;

    await warnChannel?.send(
      `⚠️ Webhook **${webhookId}** chỉ chạy **${hours.toFixed(2)}h/6h** hôm nay \n→ Cảnh cáo **${record.warnCount}/2**`
    ).catch(() => {});

    if (record.warnCount >= 2) {
      record.warnCount = 0;
      // try channelId mapping first
      let channel = null;
      if (record.channelId) channel = client.channels.cache.get(record.channelId);
      // fallback: search runtime lastWebhookId on channels (if set)
      if (!channel) {
        channel = client.channels.cache.find(c => c.isTextBased && c.lastWebhookId === webhookId);
      }
      if (channel) {
        await channel.setParent(sleepCategoryId).catch(() => {});
        await warnChannel?.send(`😴 Kênh **${channel.name}** bị chuyển về danh mục NGỦ do webhook không đủ giờ hoạt động!`).catch(() => {});
      } else {
        await warnChannel?.send(`⚠️ Không tìm thấy kênh tương ứng với webhook ${webhookId} để chuyển danh mục.`).catch(() => {});
      }
    }
  }

  await saveData(data);
};

module.exports.resetStreak = async function (webhookId) {
  const data = await loadData();
  if (!data[webhookId]) return false;
  data[webhookId].streak = 0;
  data[webhookId].lastActiveForStreak = 0;
  await saveData(data);
  return true;
};

module.exports.getRecord = async function (webhookId) {
  const data = await loadData();
  return data[webhookId] || null;
};

module.exports.findWebhookIdByChannelId = async function (channelId) {
  const data = await loadData();
  const entry = Object.entries(data).find(([k, v]) => v && v.channelId === channelId);
  return entry ? entry[0] : null;
};
