require('dotenv').config();

const BASE_ROLE_ID = process.env.BASE_ROLE_ID;
const AUTO_ROLE_ID = process.env.AUTO_ROLE_ID;
const REMOVE_IF_HAS_ROLE_ID = process.env.REMOVE_IF_HAS_ROLE_IDS.split(',');
const SUPER_LOCK_ROLE_ID = process.env.SUPER_LOCK_ROLE_ID;
const BLOCK_ROLE_IDS = process.env.BLOCK_ROLE_IDS.split(',');
const REQUIRED_ROLE = process.env.REQUIRED_ROLE;
const BLOCK_TRIGGER_ROLE = process.env.BLOCK_TRIGGER_ROLE;
const BLOCK_CONFLICT_ROLES = process.env.BLOCK_CONFLICT_ROLES.split(',');
const ROLE_UPGRADE_MAP = JSON.parse(process.env.ROLE_UPGRADE_MAP);
const ROLE_HIERARCHY = Object.entries(JSON.parse(process.env.ROLE_HIERARCHY)).map(([parent, child]) => ({ parent, child }));
const UPDATE_COOLDOWN = Number(process.env.UPDATE_COOLDOWN_MS || 5000);
const MEMBER_SCAN_DELAY = Number(process.env.MEMBER_SCAN_DELAY_MS || 300);
const FULL_SCAN_INTERVAL = Number(process.env.FULL_SCAN_INTERVAL_MIN || 15) * 60 * 1000;
const BATCH_SIZE = 5;
const BATCH_DELAY = 2000;

const BASE_BLOCK_LIST = new Set(['1415350765291307028','1415350143800049736','1415351029305704498','1415322385095332021','1415351226366689460','1415351362866380881','1415320304569290862','1415350650165924002','1415351613534503022','1417097393752506398','1420270612785401988','1415322209320435732','1420276021009322064','1415350457706217563','1415320854014984342','1414165862205751326','1411240101832298569','1428899156956549151']);

const lastUpdate = new Map();
const updateQueue = [];
let isProcessingQueue = false;

class RateLimiter {
  constructor() {
    this.requests = [];
    this.maxRequests = 40;
    this.timeWindow = 1000;
  }
  async waitForSlot() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.timeWindow - (now - oldestRequest) + 100;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.waitForSlot();
    }
    this.requests.push(now);
  }
}

const rateLimiter = new RateLimiter();

async function safeFetch(member) {
  try {
    await rateLimiter.waitForSlot();
    await member.fetch(true);
  } catch (err) {}
}

async function processQueue() {
  if (isProcessingQueue || updateQueue.length === 0) return;
  isProcessingQueue = true;
  while (updateQueue.length > 0) {
    const member = updateQueue.shift();
    await updateMemberRolesInternal(member);
    await new Promise(resolve => setTimeout(resolve, MEMBER_SCAN_DELAY));
  }
  isProcessingQueue = false;
}

async function updateMemberRoles(member, skipCooldown = false) {
  if (!member || member.user?.bot) return;
  const now = Date.now();
  const lastUpdateTime = lastUpdate.get(member.id);
  if (!skipCooldown && lastUpdateTime && now - lastUpdateTime < UPDATE_COOLDOWN) return;
  if (!updateQueue.find(m => m.id === member.id)) {
    updateQueue.push(member);
  }
  if (!isProcessingQueue) processQueue();
}

async function updateMemberRolesInternal(member) {
  try {
    if (!member || member.user?.bot) return;
    await safeFetch(member);
    const now = Date.now();
    lastUpdate.set(member.id, now);
    const roles = member.roles.cache;
    const has = id => roles.has(id);
    const toAdd = new Set();
    const toRemove = new Set();
    const hasBase = has(BASE_ROLE_ID);
    const hasAuto = has(AUTO_ROLE_ID);
    const hasRemove = REMOVE_IF_HAS_ROLE_ID.some(id => has(id));
    const hasTrigger = has(BLOCK_TRIGGER_ROLE);
    const hasBlock = [...roles.keys()].some(r => BLOCK_ROLE_IDS.includes(r));
    const hasRequired = has(REQUIRED_ROLE);
    if (hasTrigger) {
      for (const id of BLOCK_CONFLICT_ROLES) {
        if (has(id)) toRemove.add(id);
      }
    }
    if (hasTrigger && !hasBase && !hasRemove && !hasBlock) toAdd.add(BASE_ROLE_ID);
    else if (!hasTrigger && hasBase) toRemove.add(BASE_ROLE_ID);
    if (!hasAuto && !hasRemove && !hasTrigger) toAdd.add(AUTO_ROLE_ID);
    else if (hasAuto && (hasRemove || hasTrigger)) toRemove.add(AUTO_ROLE_ID);
    if (hasRequired) {
      for (const [normal, upgraded] of Object.entries(ROLE_UPGRADE_MAP)) {
        if (has(normal) && !has(upgraded)) toAdd.add(upgraded);
      }
    }
    for (const [normal, upgraded] of Object.entries(ROLE_UPGRADE_MAP)) {
      if (!has(normal) && has(upgraded)) toRemove.add(upgraded);
    }
    for (const { parent, child } of ROLE_HIERARCHY) {
      const hasParent = has(parent);
      const hasChild = has(child);
      if (!hasParent && hasChild) toRemove.add(child);
    }
    const hasBaseBlock = [...roles.keys()].some(id => BASE_BLOCK_LIST.has(id));
    if (hasBaseBlock && hasBase) toRemove.add(BASE_ROLE_ID);
    else if (!hasBaseBlock && !hasBase && hasTrigger && !hasRemove && !hasBlock) toAdd.add(BASE_ROLE_ID);
    const finalAdd = [...toAdd].filter(id => !has(id));
    const finalRemove = [...toRemove].filter(id => has(id));
    if (finalAdd.length > 0) {
      await rateLimiter.waitForSlot();
      await member.roles.add(finalAdd).catch(() => {});
    }
    if (finalRemove.length > 0) {
      await rateLimiter.waitForSlot();
      await member.roles.remove(finalRemove).catch(() => {});
    }
  } catch (err) {}
}

async function initRoleUpdater(client) {
  console.log('Starting role scan');
  for (const [, guild] of client.guilds.cache) {
    try {
      await rateLimiter.waitForSlot();
      await guild.members.fetch();
      const members = guild.members.cache.filter(m => !m.user.bot);
      const memberArray = Array.from(members.values());
      for (let i = 0; i < memberArray.length; i += BATCH_SIZE) {
        const batch = memberArray.slice(i, i + BATCH_SIZE);
        for (const member of batch) {
          await updateMemberRolesInternal(member);
          await new Promise(res => setTimeout(res, MEMBER_SCAN_DELAY));
        }
        if (i + BATCH_SIZE < memberArray.length) {
          await new Promise(res => setTimeout(res, BATCH_DELAY));
        }
      }
    } catch (err) {}
  }
  console.log('Scan complete');
  setInterval(async () => {
    for (const [, guild] of client.guilds.cache) {
      try {
        await rateLimiter.waitForSlot();
        const members = await guild.members.fetch();
        const memberArray = Array.from(members.values()).filter(m => !m.user.bot);
        for (let i = 0; i < memberArray.length; i += BATCH_SIZE) {
          const batch = memberArray.slice(i, i + BATCH_SIZE);
          for (const member of batch) {
            await updateMemberRolesInternal(member);
            await new Promise(res => setTimeout(res, MEMBER_SCAN_DELAY));
          }
          if (i + BATCH_SIZE < memberArray.length) {
            await new Promise(res => setTimeout(res, BATCH_DELAY));
          }
        }
      } catch (err) {}
    }
  }, FULL_SCAN_INTERVAL);
}

function setupRoleRemoveWatcher(client) {
  const TARGET_ROLE = '1428899156956549151';
  const BASE_ROLE = BASE_ROLE_ID;
  const debounceMap = new Map();
  const DEBOUNCE_TIME = 1000;
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
      if (!oldMember || !newMember) return;
      if (newMember.user?.bot) return;
      const memberId = newMember.id;
      const now = Date.now();
      const lastProcessed = debounceMap.get(memberId);
      if (lastProcessed && now - lastProcessed < DEBOUNCE_TIME) return;
      debounceMap.set(memberId, now);
      const oldRoles = oldMember.roles.cache;
      const newRoles = newMember.roles.cache;
      const hadTarget = oldRoles.has(TARGET_ROLE);
      const hasTarget = newRoles.has(TARGET_ROLE);
      if (hadTarget && !hasTarget) {
        await rateLimiter.waitForSlot();
        await newMember.roles.add(BASE_ROLE).catch(() => {});
      }
      const rolesChanged = oldRoles.size !== newRoles.size || ![...oldRoles.keys()].every(id => newRoles.has(id));
      if (rolesChanged) await updateMemberRoles(newMember);
    } catch (err) {}
  });
  setInterval(() => {
    const now = Date.now();
    for (const [memberId, time] of debounceMap.entries()) {
      if (now - time > 60000) debounceMap.delete(memberId);
    }
  }, 300000);
}

module.exports = { updateMemberRoles, initRoleUpdater, setupRoleRemoveWatcher };
