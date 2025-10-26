// functions/updateRoles.js
const { Collection } = require("discord.js");
const { getGuildCache, saveCache } = require("../utils/cacheManager");

// ====== CONFIG ======
const BASE_ROLE_ID = "1415319898468651008";
const AUTO_ROLE_ID = "1411240101832298569";
const REMOVE_IF_HAS_ROLE_ID = "1410990099042271352";
const SUPER_LOCK_ROLE_ID = "1411991634194989096";

const BLOCK_ROLE_IDS = [
  "1411639327909220352", "1411085492631506996", "1418990676749848576", "1410988790444458015",
  "1415322209320435732", "1415351613534503022", "1415350650165924002", "1415320304569290862",
  "1415351362866380881", "1415351226366689460", "1415322385095332021", "1415351029305704498",
  "1415350143800049736", "1415350765291307028", "1418990664762523718", "1417802085378031689",
  "1417097393752506398", "1420270612785401988", "1420276021009322064", "1415350457706217563",
  "1415320854014984342", "1414165862205751326"
];

const REQUIRED_ROLE = "1428898880447316159";
const ROLE_UPGRADE_MAP = {
  "1431525750724362330": "1428899630753775626",
  "1431525792365547540": "1410990099042271352",
  "1431525824082870272": "1428899344010182756",
  "1431525863987613877": "1428418711764865156",
  "1431525890587885698": "1431525947684950016"
};

const BLOCK_TRIGGER_ROLE = "1428898880447316159";
const BLOCK_CONFLICT_ROLES = ["1428899156956549151", AUTO_ROLE_ID];

// Tự động nối role upgrade vào role hierarchy
const ROLE_HIERARCHY = [
  { parent: "1431525792365547540", child: "1431697157437784074" },
  ...Object.entries(ROLE_UPGRADE_MAP).map(([p, c]) => ({ parent: p, child: c }))
];

// ====== CACHE / QUEUE ======
const lastUpdate = new Map();
const roleQueue = new Collection(); // Map<guildId, Array<Function>>

// ====== Utility: Delay ======
const delay = ms => new Promise(res => setTimeout(res, ms));

// ====== Safe fetch member ======
async function safeFetch(member) {
  try { await member.fetch(true); } catch {}
}

// ====== Thêm tác vụ vào hàng đợi ======
function queueAction(guildId, actionFn) {
  if (!roleQueue.has(guildId)) {
    roleQueue.set(guildId, []);
    processQueue(guildId);
  }
  roleQueue.get(guildId).push(actionFn);
}

// ====== Xử lý hàng đợi theo guild ======
async function processQueue(guildId) {
  const queue = roleQueue.get(guildId);
  if (!queue || queue.running) return;

  queue.running = true;
  while (queue.length > 0) {
    const fn = queue.shift();
    try { await fn(); } catch (err) {
      console.error(`❌ [QUEUE ERROR]`, err.message);
    }
    await delay(750); // nghỉ giữa mỗi hành động, tránh rate-limit
  }
  queue.running = false;
}

// ====== Hàm chính ======
async function updateMemberRoles(member) {
  try {
    if (!member || member.user?.bot) return;
    await safeFetch(member);

    const now = Date.now();
    if (lastUpdate.has(member.id) && now - lastUpdate.get(member.id) < 5000) return;
    lastUpdate.set(member.id, now);

    const roles = member.roles.cache;
    const has = id => roles.has(id);
    const toAdd = [];
    const toRemove = [];

    // ⚙️ Logic role
    const hasBase = has(BASE_ROLE_ID);
    const hasAuto = has(AUTO_ROLE_ID);
    const hasRemove = has(REMOVE_IF_HAS_ROLE_ID);
    const hasTrigger = has(BLOCK_TRIGGER_ROLE);
    const hasBlock = [...roles.keys()].some(r => BLOCK_ROLE_IDS.includes(r));

    // Conflict roles
    if (hasTrigger) {
      for (const id of BLOCK_CONFLICT_ROLES) if (has(id)) toRemove.push(id);
    }

    // BASE role
    if (hasTrigger && !hasBase && !hasRemove && !hasBlock) toAdd.push(BASE_ROLE_ID);
    else if (!hasTrigger && hasBase) toRemove.push(BASE_ROLE_ID);

    // AUTO role
    if (!hasAuto && !hasRemove && !hasTrigger) toAdd.push(AUTO_ROLE_ID);
    else if (hasAuto && (hasRemove || hasTrigger)) toRemove.push(AUTO_ROLE_ID);

    // Role upgrade
    if (has(REQUIRED_ROLE)) {
      for (const [normal, upgraded] of Object.entries(ROLE_UPGRADE_MAP)) {
        if (has(normal) && !has(upgraded)) toAdd.push(upgraded);
      }
    }
    for (const [normal, upgraded] of Object.entries(ROLE_UPGRADE_MAP)) {
      if (!has(normal) && has(upgraded) && !has(REQUIRED_ROLE)) toRemove.push(upgraded);
    }

    // Cha - Con
    for (const { parent, child } of ROLE_HIERARCHY) {
      if (!has(parent) && has(child)) toRemove.push(child);
    }

    // 🧠 Xử lý role trong queue
    if (toAdd.length > 0) {
      queueAction(member.guild.id, async () => {
        console.log(`➕ [${member.user.tag}] add roles: ${toAdd.join(", ")}`);
        await member.roles.add(toAdd).catch(err => console.error("ADD ERR:", err.message));
      });
    }

    if (toRemove.length > 0) {
      queueAction(member.guild.id, async () => {
        console.log(`➖ [${member.user.tag}] remove roles: ${toRemove.join(", ")}`);
        await member.roles.remove(toRemove).catch(err => console.error("REMOVE ERR:", err.message));
      });
    }

  } catch (err) {
    console.error("❌ updateMemberRoles error:", err);
  }
}

// ====== Khởi tạo ======
async function initRoleUpdater(client) {
  console.log("🔄 Quét roles toàn bộ thành viên...");
  for (const [, guild] of client.guilds.cache) {
    await guild.members.fetch().catch(() => {});
    const members = guild.members.cache.filter(m => !m.user.bot);
    for (const member of members.values()) {
      queueAction(guild.id, () => updateMemberRoles(member));
    }
  }
  console.log("✅ Đã thêm toàn bộ vào queue!");
}

// ====== Event ======
function registerRoleEvents(client) {
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    const oldRoles = [...oldMember.roles.cache.keys()];
    const newRoles = [...newMember.roles.cache.keys()];

    const lostRoles = oldRoles.filter(id => !newRoles.includes(id));
    const gainedRoles = newRoles.filter(id => !oldRoles.includes(id));

    if (lostRoles.length || gainedRoles.length) {
      console.log(`🔄 [UPDATE] ${newMember.user.tag}`);
      queueAction(newMember.guild.id, () => updateMemberRoles(newMember));
    }
  });
}

module.exports = { updateMemberRoles, initRoleUpdater, registerRoleEvents };
