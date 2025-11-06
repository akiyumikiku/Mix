require("dotenv").config();
const { getGuildCache, saveCache } = require("../utils/cacheManager");

// ====== Cấu hình từ .env ======
const BASE_ROLE_ID = process.env.BASE_ROLE_ID;
const AUTO_ROLE_ID = process.env.AUTO_ROLE_ID;
const REMOVE_IF_HAS_ROLE_ID = process.env.REMOVE_IF_HAS_ROLE_IDS.split(",");
const SUPER_LOCK_ROLE_ID = process.env.SUPER_LOCK_ROLE_ID;

const BLOCK_ROLE_IDS = process.env.BLOCK_ROLE_IDS.split(",");
const REQUIRED_ROLE = process.env.REQUIRED_ROLE;
const BLOCK_TRIGGER_ROLE = process.env.BLOCK_TRIGGER_ROLE;
const BLOCK_CONFLICT_ROLES = process.env.BLOCK_CONFLICT_ROLES.split(",");

const ROLE_UPGRADE_MAP = JSON.parse(process.env.ROLE_UPGRADE_MAP);
const ROLE_HIERARCHY = Object.entries(JSON.parse(process.env.ROLE_HIERARCHY)).map(([parent, child]) => ({ parent, child }));

const lastUpdate = new Map();
const UPDATE_COOLDOWN = Number(process.env.UPDATE_COOLDOWN_MS || 4000);
const MEMBER_SCAN_DELAY = Number(process.env.MEMBER_SCAN_DELAY_MS || 150);
const FULL_SCAN_INTERVAL = Number(process.env.FULL_SCAN_INTERVAL_MIN || 10) * 60 * 1000;

// ====== Hàm hỗ trợ ======
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
      console.log(`⚠️ [SKIP] ${member.user.tag} (cooldown)`);
      return;
    }
    lastUpdate.set(member.id, now);

    const roles = member.roles.cache;
    const has = id => roles.has(id);
    const toAdd = new Set();
    const toRemove = new Set();

    console.log(`\n🔄 [UPDATE] ${member.user.tag}`);
    console.log("🧩 Roles hiện tại:", Array.from(roles.keys()));

    const hasBase = has(BASE_ROLE_ID);
    const hasAuto = has(AUTO_ROLE_ID);
    const hasRemove = REMOVE_IF_HAS_ROLE_ID.some(id => has(id));
    const hasTrigger = has(BLOCK_TRIGGER_ROLE);
    const hasBlock = [...roles.keys()].some(r => BLOCK_ROLE_IDS.includes(r));
    const hasRequired = has(REQUIRED_ROLE);

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

    // ⬆️ Thêm role nâng cấp
    if (hasRequired) {
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

    // 🔗 Kiểm tra cha–con
    for (const { parent, child } of ROLE_HIERARCHY) {
      const hasParent = has(parent);
      const hasChild = has(child);
      if (!hasParent && hasChild) {
        console.log(`🚨 [ROLE HIERARCHY] Mất ${parent}, xoá ${child}`);
        toRemove.add(child);
      }
    }

    // 🧹 Gộp xử lý add/remove 1 lần
    const finalAdd = [...toAdd].filter(id => !has(id));
    const finalRemove = [...toRemove].filter(id => has(id));

    if (finalAdd.length > 0) {
      console.log(`➕ [${member.user.tag}] Add roles: ${finalAdd.join(", ")}`);
      await member.roles.add(finalAdd).catch(err => console.error(`❌ Lỗi add roles: ${err.message}`));
    }
    if (finalRemove.length > 0) {
      console.log(`➖ [${member.user.tag}] Remove roles: ${finalRemove.join(", ")}`);
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
      await new Promise(res => setTimeout(res, MEMBER_SCAN_DELAY));
    }
  }

  console.log("✅ Quét hoàn tất!");

  // ♻️ Định kỳ quét lại
  setInterval(async () => {
    for (const [, guild] of client.guilds.cache) {
      const members = await guild.members.fetch();
      for (const member of members.values()) {
        if (member.user.bot) continue;
        await updateMemberRoles(member);
        await new Promise(res => setTimeout(res, MEMBER_SCAN_DELAY));
      }
    }
    console.log("♻️ Đã quét toàn bộ roles để đảm bảo đồng bộ");
  }, FULL_SCAN_INTERVAL);
}

// ====== Theo dõi khi role cụ thể bị gỡ ======
function setupRoleRemoveWatcher(client) {
  const TARGET_ROLE = "1428899156956549151"; // role bị gỡ sẽ kích hoạt
  const BASE_ROLE = BASE_ROLE_ID; // role cần add lại

  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    try {
      if (!oldMember || !newMember) return;
      if (newMember.user?.bot) return;

      const oldRoles = oldMember.roles.cache;
      const newRoles = newMember.roles.cache;

      const hadTarget = oldRoles.has(TARGET_ROLE);
      const hasTarget = newRoles.has(TARGET_ROLE);

      // Nếu role TARGET bị gỡ (có trước mà giờ mất)
      if (hadTarget && !hasTarget) {
        console.log(`🎯 [EVENT] ${newMember.user.tag} vừa bị gỡ role ${TARGET_ROLE}`);
        // Chạy lại toàn bộ logic roles (theo nguyên tắc sẵn có)
        await updateMemberRoles(newMember);
      }
    } catch (err) {
      console.error("❌ Role remove watcher error:", err);
    }
  });
}

module.exports = { updateMemberRoles, initRoleUpdater, setupRoleRemoveWatcher };
