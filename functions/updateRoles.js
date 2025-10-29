// functions/updateRoles.js
const { getGuildCache, saveCache } = require("../utils/cacheManager");

// ====== Cấu hình ======
const BASE_ROLE_ID = "1415319898468651008";
const AUTO_ROLE_ID = "1411240101832298569";
const REMOVE_IF_HAS_ROLE_ID = "1428898880447316159","1428899156956549151";
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

// ====== Quan hệ cha–con ======
const ROLE_HIERARCHY = [
  { parent: "1431525792365547540", child: "1431697157437784074" }
];
for (const [parent, child] of Object.entries(ROLE_UPGRADE_MAP)) {
  ROLE_HIERARCHY.push({ parent, child });
}

// ====== Cache chống spam ======
const lastUpdate = new Map();
const UPDATE_COOLDOWN = 4000; // 4s mỗi member

async function safeFetch(member) {
  try { await member.fetch(true); } catch {}
}

// ====== Hàm cập nhật roles ======
async function updateMemberRoles(member) {
  try {
    if (!member || member.user?.bot) return;
    await safeFetch(member);

    const now = Date.now();
    if (lastUpdate.has(member.id) && now - lastUpdate.get(member.id) < UPDATE_COOLDOWN) {
      console.log(`⚠️ [SKIP] Bỏ qua ${member.user.tag} do cooldown`);
      return;
    }
    lastUpdate.set(member.id, now);

    const roles = member.roles.cache;
    const has = id => roles.has(id);
    const toAdd = new Set();
    const toRemove = new Set();

    console.log(`\n🔄 [UPDATE] ${member.user.tag}`);
    console.log("🧩 [CHECK] Roles hiện tại:", Array.from(roles.keys()));

    const hasBase = has(BASE_ROLE_ID);
    const hasAuto = has(AUTO_ROLE_ID);
    const hasRemove = has(REMOVE_IF_HAS_ROLE_ID);
    const hasTrigger = has(BLOCK_TRIGGER_ROLE);
    const hasBlock = [...roles.keys()].some(r => BLOCK_ROLE_IDS.includes(r));

    // ⚖️ Conflict roles
    if (hasTrigger) {
      for (const id of BLOCK_CONFLICT_ROLES) {
        if (has(id)) toRemove.add(id);
      }
    }

    // 🧩 BASE role logic
    if (hasTrigger && !hasBase && !hasRemove && !hasBlock) toAdd.add(BASE_ROLE_ID);
    else if (!hasTrigger && hasBase) toRemove.add(BASE_ROLE_ID);

    // 🤖 AUTO role logic
    if (!hasAuto && !hasRemove && !hasTrigger) toAdd.add(AUTO_ROLE_ID);
    else if (hasAuto && (hasRemove || hasTrigger)) toRemove.add(AUTO_ROLE_ID);

    // ⬆️ Thêm role nâng cấp khi có role thường + REQUIRED_ROLE
    if (has(REQUIRED_ROLE)) {
      for (const [normal, upgraded] of Object.entries(ROLE_UPGRADE_MAP)) {
        if (has(normal) && !has(upgraded)) {
          console.log(`⏫ Thêm role nâng cấp ${upgraded} (gốc: ${normal})`);
          toAdd.add(upgraded);
        }
      }
    }

    // ⬇️ Gỡ role nâng cấp khi mất role thường
    for (const [normal, upgraded] of Object.entries(ROLE_UPGRADE_MAP)) {
      if (!has(normal) && has(upgraded)) {
        console.log(`⏬ Gỡ role nâng cấp ${upgraded} vì mất role ${normal}`);
        toRemove.add(upgraded);
      }
    }

    // 🧩 Kiểm tra thiếu base/nâng cấp (fix quan trọng)
    for (const [normal, upgraded] of Object.entries(ROLE_UPGRADE_MAP)) {
      const hasNormal = has(normal);
      const hasUpgraded = has(upgraded);

      // Nếu không có cả hai → thêm base
      if (!hasNormal && !hasUpgraded) {
        console.log(`🪶 Thêm role base ${normal} vì bị thiếu cả hai`);
        toAdd.add(normal);
      }

      // Nếu có base mà thiếu upgrade + có REQUIRED_ROLE → thêm upgrade
      if (hasNormal && !hasUpgraded && has(REQUIRED_ROLE)) {
        console.log(`⏫ Thêm role nâng cấp ${upgraded} vì thiếu nâng cấp`);
        toAdd.add(upgraded);
      }

      // Nếu có upgrade mà thiếu base → xoá upgrade
      if (!hasNormal && hasUpgraded) {
        console.log(`🧹 Gỡ role nâng cấp ${upgraded} vì mất role base ${normal}`);
        toRemove.add(upgraded);
      }
    }

    // 🔗 Kiểm tra cha–con
    for (const { parent, child } of ROLE_HIERARCHY) {
      const hasParent = has(parent);
      const hasChild = has(child);
      console.log(`🔍 [ROLE HIERARCHY] ${member.user.tag}: cóCha=${hasParent} | cóCon=${hasChild}`);

      if (!hasParent && hasChild) {
        console.log(`🚨 [ROLE HIERARCHY] ${member.user.tag} mất ${parent}, xoá ${child}`);
        toRemove.add(child);
      }
    }

    // 🧹 Gộp xử lý add/remove 1 lần
    const finalAdd = [...toAdd].filter(id => !has(id));
    const finalRemove = [...toRemove].filter(id => has(id));

    if (finalAdd.length > 0) {
      console.log(`➕ [${member.user.tag}] add roles: ${finalAdd.join(", ")}`);
      await member.roles.add(finalAdd).catch(err => console.error(`❌ Lỗi add roles: ${err.message}`));
    }
    if (finalRemove.length > 0) {
      console.log(`➖ [${member.user.tag}] remove roles: ${finalRemove.join(", ")}`);
      await member.roles.remove(finalRemove).catch(err => console.error(`❌ Lỗi remove roles: ${err.message}`));
    }

  } catch (err) {
    console.error("❌ updateMemberRoles error:", err);
  }
}

// ====== Quét toàn bộ khi khởi động ======
async function initRoleUpdater(client) {
  console.log("🔄 Quét roles toàn bộ thành viên (khởi động)...");
  for (const [, guild] of client.guilds.cache) {
    await guild.members.fetch().catch(() => {});
    const members = guild.members.cache.filter(m => !m.user.bot);
    for (const member of members.values()) {
      await updateMemberRoles(member);
      await new Promise(res => setTimeout(res, 150)); // tránh rate-limit
    }
  }
  console.log("✅ Quét hoàn tất!");

  // ♻️ Định kỳ 10 phút quét lại để đảm bảo đồng bộ
  setInterval(async () => {
    for (const [, guild] of client.guilds.cache) {
      const members = await guild.members.fetch();
      for (const member of members.values()) {
        if (member.user.bot) continue;
        await updateMemberRoles(member);
        await new Promise(res => setTimeout(res, 200));
      }
    }
    console.log("♻️ Đã quét toàn bộ roles để đảm bảo đồng bộ");
  }, 1000 * 60 * 10);
}

// ====== Lắng nghe sự kiện role update ======
function registerRoleEvents(client) {
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    const oldRoles = [...oldMember.roles.cache.keys()];
    const newRoles = [...newMember.roles.cache.keys()];

    const lostRoles = oldRoles.filter(id => !newRoles.includes(id));
    const gainedRoles = newRoles.filter(id => !oldRoles.includes(id));

    if (lostRoles.length > 0 || gainedRoles.length > 0) {
      console.log(`\n🔄 [UPDATE] ${newMember.user.tag}`);
      if (lostRoles.length > 0) console.log("🧹 Mất roles:", lostRoles);
      if (gainedRoles.length > 0) console.log("✨ Nhận roles:", gainedRoles);
      await updateMemberRoles(newMember);
    }
  });
}

module.exports = { updateMemberRoles, initRoleUpdater, registerRoleEvents };
