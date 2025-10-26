const { getGuildCache, saveCache } = require("../utils/cacheManager");

// ===== Role Logic =====
const BASE_ROLE_ID = "1415319898468651008";
const AUTO_ROLE_ID = "1411240101832298569";
const REMOVE_IF_HAS_ROLE_ID = "1410990099042271352";
const SUPER_LOCK_ROLE_ID = "1411991634194989096";

// Các role block
const BLOCK_ROLE_IDS = [
  "1411639327909220352", "1411085492631506996", "1418990676749848576", "1410988790444458015",
  "1415322209320435732", "1415351613534503022", "1415350650165924002", "1415320304569290862",
  "1415351362866380881", "1415351226366689460", "1415322385095332021", "1415351029305704498",
  "1415350143800049736", "1415350765291307028", "1418990664762523718", "1417802085378031689",
  "1417097393752506398", "1420270612785401988", "1420276021009322064", "1415350457706217563",
  "1415320854014984342", "1414165862205751326"
];

const SUPER_LOCK_HIDE_CHANNELS = [
  "1419727338119368784",
  "1411049568979648553",
  "1423207293335371776",
  "1419725921363034123",
  "1419725102412726292"
];

const BLOCK_TRIGGER_ROLE = "1428898880447316159";
const BLOCK_CONFLICT_ROLES = [
  "1428899156956549151",
  AUTO_ROLE_ID
];

// ==== MỚI THÊM ====
const CATEGORY_HIDE_IF_NO_ROLE = [
  "1411043139728314478",
  "1411049289685270578",
  "1411034825699233943"
];

const REQUIRED_ROLE_FOR_CATEGORIES = "1410990099042271352"; // phải có mới xem được 3 danh mục
const CHANNEL_3_1_RESTRICT = "1427958980059336774";
const ROLE_3_1 = "1428899344010182756";

const lastUpdate = new Map();

async function updateMemberRoles(member) {
  try {
    if (!member || member.user?.bot) return;

    const now = Date.now();
    if (lastUpdate.has(member.id) && now - lastUpdate.get(member.id) < 2000) return;
    lastUpdate.set(member.id, now);

    const roles = member.roles.cache;
    const has = id => roles.has(id);
    const add = async id => {
      if (!has(id)) {
        await member.roles.add(id).catch(() => {});
        logAction(member, `+${id}`);
      }
    };
    const remove = async id => {
      if (has(id)) {
        await member.roles.remove(id).catch(() => {});
        logAction(member, `-${id}`);
      }
    };

    // 🔒 SUPER_LOCK → ẩn 5 kênh
    if (has(SUPER_LOCK_ROLE_ID)) {
      for (const channelId of SUPER_LOCK_HIDE_CHANNELS) {
        const ch = member.guild.channels.cache.get(channelId);
        if (!ch) continue;
        const perms = ch.permissionOverwrites.cache.get(member.id);
        if (!perms || !perms.deny.has("ViewChannel")) {
          await ch.permissionOverwrites.edit(member.id, { ViewChannel: false }).catch(() => {});
        }
      }
    } else {
      // Nếu không có SUPER_LOCK thì mở lại
      for (const channelId of SUPER_LOCK_HIDE_CHANNELS) {
        const ch = member.guild.channels.cache.get(channelId);
        if (!ch) continue;
        const perms = ch.permissionOverwrites.cache.get(member.id);
        if (perms) await ch.permissionOverwrites.delete(member.id).catch(() => {});
      }
    }

    // 🚫 Nếu có role cần thiết → xoá các role xung đột
    if (has(BLOCK_TRIGGER_ROLE)) {
      for (const id of BLOCK_CONFLICT_ROLES) {
        if (has(id)) await remove(id);
      }
    }

    // BASE_ROLE logic
    const hasBase = has(BASE_ROLE_ID);
    const hasAuto = has(AUTO_ROLE_ID);
    const hasRemove = has(REMOVE_IF_HAS_ROLE_ID);
    const hasBlock = [...roles.keys()].some(r => BLOCK_ROLE_IDS.includes(r));
    const hasTrigger = has(BLOCK_TRIGGER_ROLE);

    if (hasTrigger && !hasBase && !hasRemove && !hasBlock) await add(BASE_ROLE_ID);
    else if (!hasTrigger && hasBase) await remove(BASE_ROLE_ID);

    if (!hasAuto && !hasRemove && !hasTrigger) await add(AUTO_ROLE_ID);
    else if (hasAuto && (hasRemove || hasTrigger)) await remove(AUTO_ROLE_ID);

    // ======= ROLE NÂNG CẤP =======
    const REQUIRED_ROLE = "1428898880447316159";
    const roleUpgradeMap = {
      "1431525750724362330": "1428899630753775626",
      "1431525792365547540": "1410990099042271352",
      "1431525824082870272": "1428899344010182756",
      "1431525863987613877": "1428418711764865156",
      "1431525890587885698": "1431525947684950016",
    };

    if (has(REQUIRED_ROLE)) {
      for (const [normalRole, upgradedRole] of Object.entries(roleUpgradeMap)) {
        if (has(normalRole)) await add(upgradedRole);
      }
    }

    for (const [normalRole, upgradedRole] of Object.entries(roleUpgradeMap)) {
      if (!has(normalRole) && has(upgradedRole)) await remove(upgradedRole);
    }

    // 🔐 ẨN KÊNH KHI KHÔNG CÓ ROLE BẮT BUỘC
    const guild = member.guild;

    // 1️⃣ Nếu KHÔNG có 1410990099042271352 → ẩn tất cả các kênh trong 3 category
    if (!has(REQUIRED_ROLE_FOR_CATEGORIES)) {
      for (const categoryId of CATEGORY_HIDE_IF_NO_ROLE) {
        const category = guild.channels.cache.get(categoryId);
        if (!category) continue;
        for (const ch of category.children.cache.values()) {
          await ch.permissionOverwrites.edit(member.id, { ViewChannel: false }).catch(() => {});
        }
      }
    } else {
      // Có role → hiện lại
      for (const categoryId of CATEGORY_HIDE_IF_NO_ROLE) {
        const category = guild.channels.cache.get(categoryId);
        if (!category) continue;
        for (const ch of category.children.cache.values()) {
          const overwrite = ch.permissionOverwrites.cache.get(member.id);
          if (overwrite) await ch.permissionOverwrites.delete(member.id).catch(() => {});
        }
      }
    }

    // 2️⃣ Nếu KHÔNG có role #3.1 → ẩn riêng 1 kênh
    const specialChannel = guild.channels.cache.get(CHANNEL_3_1_RESTRICT);
    if (specialChannel) {
      if (!has(ROLE_3_1)) {
        await specialChannel.permissionOverwrites.edit(member.id, { ViewChannel: false }).catch(() => {});
      } else {
        const overwrite = specialChannel.permissionOverwrites.cache.get(member.id);
        if (overwrite) await specialChannel.permissionOverwrites.delete(member.id).catch(() => {});
      }
    }

  } catch (err) {
    console.error("❌ updateMemberRoles error:", err);
  }
}

function logAction(member, action) {
  try {
    const guildCache = getGuildCache(member.guild.id);
    guildCache.lastRoleActions = guildCache.lastRoleActions || [];
    guildCache.lastRoleActions.push({
      user: member.user?.tag || null,
      userId: member.id,
      action,
      time: new Date().toISOString(),
    });
    if (guildCache.lastRoleActions.length > 200) guildCache.lastRoleActions.shift();
    saveCache();
  } catch (e) {}
}

async function initRoleUpdater(client) {
  console.log("🔄 Quét roles toàn bộ thành viên (lúc restart)...");
  for (const [, guild] of client.guilds.cache) {
    await guild.members.fetch().catch(() => {});
    for (const member of guild.members.cache.values()) {
      await updateMemberRoles(member);
    }
  }
  console.log("✅ Quét hoàn tất!");
}

function registerRoleEvents(client) {
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    if (
      oldMember.roles.cache.size !== newMember.roles.cache.size ||
      [...oldMember.roles.cache.keys()].some(id => !newMember.roles.cache.has(id)) ||
      [...newMember.roles.cache.keys()].some(id => !oldMember.roles.cache.has(id))
    ) {
      await updateMemberRoles(newMember);
    }
  });
}

module.exports = { updateMemberRoles, initRoleUpdater, registerRoleEvents };
