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
  "1431525792365547540": "1410990099042271352", // #1
  "1431525824082870272": "1428899344010182756",
  "1431525863987613877": "1428418711764865156",
  "1431525890587885698": "1431525947684950016"
};

const BLOCK_TRIGGER_ROLE = "1428898880447316159";
const BLOCK_CONFLICT_ROLES = ["1428899156956549151", AUTO_ROLE_ID];

// ✅ Quan hệ cha–con
const ROLE_HIERARCHY = [
  { parent: "1410990099042271352", child: "1431697157437784074" }, // #1 → #1.1
  // Thêm nhiều nếu cần
];

// ====== Cache ======
const lastUpdate = new Map();

// ====== Hàm chính ======
async function updateMemberRoles(member) {
  try {
    if (!member || member.user?.bot) return;

    const now = Date.now();
    if (lastUpdate.has(member.id) && now - lastUpdate.get(member.id) < 5000) return;
    lastUpdate.set(member.id, now);

    const roles = member.roles.cache;
    const has = id => roles.has(id);
    const toAdd = [];
    const toRemove = [];

    console.log(`👤 [CHECK] ${member.user.tag}`);
    console.log("Hiện có:", [...roles.keys()].join(", "));

    const hasBase = has(BASE_ROLE_ID);
    const hasAuto = has(AUTO_ROLE_ID);
    const hasRemove = has(REMOVE_IF_HAS_ROLE_ID);
    const hasTrigger = has(BLOCK_TRIGGER_ROLE);
    const hasBlock = [...roles.keys()].some(r => BLOCK_ROLE_IDS.includes(r));

    // ⚖️ Conflict role logic
    if (hasTrigger) {
      for (const id of BLOCK_CONFLICT_ROLES) {
        if (has(id)) {
          console.log(`⚖️ Conflict: có ${id} khi có trigger → xóa`);
          toRemove.push(id);
        }
      }
    }

    // 🧩 BASE role logic
    if (hasTrigger && !hasBase && !hasRemove && !hasBlock) {
      console.log("🧩 Thêm BASE_ROLE");
      toAdd.push(BASE_ROLE_ID);
    } else if (!hasTrigger && hasBase) {
      console.log("🧩 Gỡ BASE_ROLE (mất trigger)");
      toRemove.push(BASE_ROLE_ID);
    }

    // 🤖 AUTO role logic
    if (!hasAuto && !hasRemove && !hasTrigger) {
      console.log("🤖 Thêm AUTO_ROLE");
      toAdd.push(AUTO_ROLE_ID);
    } else if (hasAuto && (hasRemove || hasTrigger)) {
      console.log("🤖 Gỡ AUTO_ROLE (conflict)");
      toRemove.push(AUTO_ROLE_ID);
    }

    // ⬆️ Nâng cấp role
    if (has(REQUIRED_ROLE)) {
      for (const [normal, upgraded] of Object.entries(ROLE_UPGRADE_MAP)) {
        if (has(normal) && !has(upgraded)) {
          console.log(`⬆️ Nâng cấp: ${normal} → ${upgraded}`);
          await member.roles.add(upgraded).catch(err => console.error("❌ Add error:", err));
        }
      }
    }

    // ⬇️ Gỡ role nâng cấp
    for (const [normal, upgraded] of Object.entries(ROLE_UPGRADE_MAP)) {
      if (!has(normal) && has(upgraded) && !has(REQUIRED_ROLE)) {
        console.log(`⬇️ Gỡ role nâng cấp: ${upgraded} (mất ${normal})`);
        await member.roles.remove(upgraded).catch(err => console.error("❌ Remove error:", err));
      }
    }

    // 🧠 Cha–con (#1 → #1.1)
    for (const { parent, child } of ROLE_HIERARCHY) {
      const hasParent = has(parent);
      const hasChild = has(child);
      console.log(`🔗 Kiểm tra cha–con: ${parent} ↔ ${child} | cóCha=${hasParent}, cóCon=${hasChild}`);
      if (!hasParent && hasChild) {
        console.log(`🧹 Xoá role con ${child} khỏi ${member.user.tag} (mất role cha)`);
        await member.roles.remove(child, "Mất role cha nên xoá role con").catch(err => {
          console.error(`❌ Lỗi khi xoá role con ${child}:`, err);
        });
      }
    }

    // 🧾 Áp dụng thay đổi
    if (toAdd.length) {
      console.log("➕ Thêm:", toAdd);
      await member.roles.add(toAdd).catch(err => console.error("❌ Add roles error:", err));
    }
    if (toRemove.length) {
      console.log("➖ Gỡ:", toRemove);
      await member.roles.remove(toRemove).catch(err => console.error("❌ Remove roles error:", err));
    }

  } catch (err) {
    console.error("❌ updateMemberRoles error:", err);
  }
}

// ====== Khởi động ======
async function initRoleUpdater(client) {
  console.log("🔄 Quét roles toàn bộ thành viên (khởi động)...");

  for (const [, guild] of client.guilds.cache) {
    await guild.members.fetch().catch(() => {});
    const members = guild.members.cache.filter(m => !m.user.bot);
    for (const member of members.values()) {
      await updateMemberRoles(member);
      await new Promise(res => setTimeout(res, 150));
    }
  }

  console.log("✅ Quét hoàn tất!");
}

// ====== Sự kiện role ======
function registerRoleEvents(client) {
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    const oldRoles = [...oldMember.roles.cache.keys()];
    const newRoles = [...newMember.roles.cache.keys()];
    const roleChanged =
      oldRoles.length !== newRoles.length ||
      oldRoles.some(id => !newRoles.includes(id)) ||
      newRoles.some(id => !oldRoles.includes(id));

    if (roleChanged) {
      console.log(`⚙️ [EVENT] Role thay đổi cho ${newMember.user.tag}`);
      console.log(`Trước: ${oldRoles.join(", ")}`);
      console.log(`Sau:   ${newRoles.join(", ")}`);
      await updateMemberRoles(newMember);
    }
  });
}

module.exports = { updateMemberRoles, initRoleUpdater, registerRoleEvents };
