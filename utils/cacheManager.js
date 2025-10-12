// utils/cacheManager.js
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'cache.json');

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

let cache = {
  guilds: {},
  pending: []
};

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf8');
      cache = JSON.parse(raw);
      console.log('[CacheManager] Cache loaded.');
    } else {
      console.log('[CacheManager] No cache found, creating new.');
      saveCache();
    }
  } catch (err) {
    console.error('[CacheManager] Failed to load cache:', err);
  }
}

function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error('[CacheManager] Failed to save cache:', err);
  }
}

function getCache() { return cache; }

function getGuildCache(guildId) {
  cache.guilds[guildId] = cache.guilds[guildId] || { autoRoles: {}, menus: {}, tickets: {} };
  return cache.guilds[guildId];
}

function setAutoRoles(guildId, config) {
  const g = getGuildCache(guildId);
  g.autoRoles = config;
  saveCache();
}

function addPending(action) {
  cache.pending.push({ ts: Date.now(), action });
  saveCache();
}

function clearPending() {
  cache.pending = [];
  saveCache();
}

module.exports = {
  loadCache,
  saveCache,
  getCache,
  getGuildCache,
  setAutoRoles,
  addPending,
  clearPending
};
