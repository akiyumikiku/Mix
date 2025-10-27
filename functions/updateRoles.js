// functions/updateRoles.js

const { getGuildCache, saveCache } = require("../utils/cacheManager");

// ====== Cấu hình ======
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

const ROLE_HIERARCHY = [
  { parent: "1431525792365547540", child: "1431697157437784074" }
];

// ====== Cache + Hàng đợi ======
const lastUpdate = new Map();
const queue = [];
let processing = false;

// ====== Helper ======
const delay = ms => new Promise(res => setTimeout(res, ms));

async function safeFetch(member) {
  try { await member.fetch(true); } catch {}
}

async function safeRoleAction(action, member, roles, type) {
  let success = false;
  for (let attempt = 1; attempt <= 3 && !success; attempt++) {
    try {
      if (type === "add") await member.roles.add(roles);
      else await member.roles.remove(roles);
      success = true;
      console.log(`✅ [${member.user.tag}] ${type === "add" ? "Đã thêm" : "Đã xoá"} roles sau ${attempt} lần thử`);
    } catch (err) {
      console.warn(`⚠️ [${member.user.tag}] Thử ${type} lần ${attempt} thất bại: ${err.message}`);
      if (attempt < 3) await delay(1500 * attempt);
      else console.error(`❌ [${member.user.tag}] Không thể ${type} roles sau 3 lần thử`);
    }
  }
}

// ====== Xử lý chính ======
async function updateMemberRoles(member) {
  try {
    if (!member || member.user?.bot) return;

    const now = Date.now();
    if (lastUpdate.has(member.id) && now - lastUpdate.get(member.id) < 4000) return;
    lastUpdate.set(member.id, now);

    await safeFetch(member);

    const roles = member.roles.cache;
    const has = id => roles.has(id);
    const toAdd = [];
    const toRemove = [];

    console.log(`\n🔄 [UPDATE] ${member.user.tag}`);
    console.log("🧩 [CHECK] Roles hiện tại:", Array.from(roles.keys()));

    const hasBase = has(BASE_ROLE_ID);
    const hasAuto = has(AUTO_ROLE_ID);
    const hasRemove = has(REMOVE_IF_HAS_ROLE_ID);
    const hasTrigger = has(BLOCK_TRIGGER_ROLE);
    const hasBlock = [...roles.keys()].some(r => BLOCK_ROLE_IDS.includes(r));

    // ⚖️ Conflict role logic
    if (hasTrigger) {
      for (const id of BLOCK_CONFLICT_ROLES) if (has(id)) toRemove.push(id);
    }

    // 🧩 BASE role logic
    if (hasTrigger && !hasBase && !hasRemove && !hasBlock) toAdd.push(BASE_ROLE_ID);
    else if (!hasTrigger && hasBase) toRemove.push(BASE_ROLE_ID);

    // 🤖 AUTO role logic
    if (!hasAuto && !hasRemove && !hasTrigger) toAdd.push(AUTO_ROLE_ID);
    else if (hasAuto && (hasRemove || hasTrigger)) toRemove.push(AUTO_ROLE_ID);

    // ⬆️ Nâng cấp role khi có REQUIRED_ROLE
    if (has(REQUIRED_ROLE)) {
      for (const [normal, upgraded] of Object.entries(ROLE_UPGRADE_MAP)) {
        if (has(normal) && !has(upgraded)) {
          console.log(`⏫ Thêm role nâng cấp ${upgraded} cho ${member.user.tag}`);
          toAdd.push(upgraded);
        }
      }
    }

    // ⬇️ Gỡ role nâng cấp khi mất role thường
    for (const [normal, upgraded] of Object.entries(ROLE_UPGRADE_MAP)) {
      if (!has(normal) && has(upgraded) && !has(REQUIRED_ROLE)) {
        console.log(`⏬ Gỡ role nâng cấp ${upgraded} vì mất role ${normal}`);
        toRemove.push(upgraded);
      }
    }

    // 🧠 Kiểm tra quan hệ cha–con
    for (const { parent, child } of ROLE_HIERARCHY) {
      console.log(`🔍 [ROLE HIERARCHY] ${member.user.tag}: cóCha=${has(parent)} | cóCon=${has(child)}`);
      if (!has(parent) && has(child)) {
        console.log(`🚨 [ROLE HIERARCHY] ${member.user.tag} mất ${parent}, xoá ${child}`);
        toRemove.push(child);
      }
    }

    // ===== Hàng đợi xử lý =====
    queue.push({ member, toAdd, toRemove });
    if (!processing) processQueue();
  } catch (err) {
    console.error("❌ updateMemberRoles error:", err);
  }
}

// ====== Hàng đợi tuần tự ======
async function processQueue() {
  processing = true;

  while (queue.length > 0) {
    const { member, toAdd, toRemove } = queue.shift();

    if (toAdd.length > 0) {
      console.log(`➕ [${member.user.tag}] add roles: ${toAdd.join(", ")}`);
      await safeRoleAction("add", member, toAdd, "add");
      await delay(500);
    }

    if (toRemove.length > 0) {
      console.log(`➖ [${member.user.tag}] remove roles: ${toRemove.join(", ")}`);
      await safeRoleAction("remove", member, toRemove, "remove");
      await delay(500);
    }

    await delay(300); // ngắt nhẹ giữa các member để tránh spam API
  }

  processing = false;
}

// ====== Khởi tạo auto role ======
async function initRoleUpdater(client) {
  console.log("🔄 Quét roles toàn bộ thành viên (khởi động)...");

  for (const [, guild] of client.guilds.cache) {
    await guild.members.fetch().catch(() => {});
    const members = guild.members.cache.filter(m => !m.user.bot);
    for (const member of members.values()) {
      await updateMemberRoles(member);
      await delay(200);
    }
  }

  console.log("✅ Quét hoàn tất!");
}

// ====== Lắng nghe sự kiện role update ======
function registerRoleEvents(client) {
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    const oldRoles = [...oldMember.roles.cache.keys()];
    const newRoles = [...newMember.roles.cache.keys()];

    const lostRoles = oldRoles.filter(id => !newRoles.includes(id));
    const gainedRoles = newRoles.filter(id => !oldRoles.includes(id));

    if (lostRoles.length > 0 || gainedRoles.length > 0) {
      console.log(`🔄 [UPDATE] ${newMember.user.tag}`);
      if (lostRoles.length) console.log(`🧹 Mất roles: ${lostRoles.join(", ")}`);
      if (gainedRoles.length) console.log(`✨ Nhận roles: ${gainedRoles.join(", ")}`);
      await updateMemberRoles(newMember);
    }
  });
}

module.exports = { updateMemberRoles, initRoleUpdater, registerRoleEvents };

