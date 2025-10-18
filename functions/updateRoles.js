// functions/updateRoles.js
const { getGuildCache, saveCache } = require("../utils/cacheManager");

// ===== Role Logic =====
const BASE_ROLE_ID = "1415319898468651008"; // chỉ add khi có BLOCK_TRIGGER_ROLE
const AUTO_ROLE_ID = "1411240101832298569"; // mất role này mới add BASE
const REMOVE_IF_HAS_ROLE_ID = "1410990099042271352";
const SUPER_LOCK_ROLE_ID = "1411991634194989096"; // giờ chỉ để ẩn kênh

// Danh sách role block
const BLOCK_ROLE_IDS = [
  "1411639327909220352","1411085492631506996","1418990676749848576","1410988790444458015",
  "1415322209320435732","1415351613534503022","1415350650165924002","1415320304569290862",
  "1415351362866380881","1415351226366689460","1415322385095332021","1415351029305704498",
  "1415350143800049736","1415350765291307028","1418990664762523718","1417802085378031689",
  "1417097393752506398","1420270612785401988","1420276021009322064","1415350457706217563",
  "1415320854014984342","1414165862205751326"
];

// SUPER LOCK chỉ ẩn các kênh sau
const SUPER_LOCK_HIDE_CHANNELS = [
  "1419727338119368784",
  "1411049568979648553",
  "1423207293335371776",
  "1419725921363034123",
  "1419725102412726292"
];

// === Role conflict logic mới ===
const BLOCK_TRIGGER_ROLE = "1428898880447316159"; // chỉ khi có role này mới được add BASE
const BLOCK_CONFLICT_ROLES = [
  "1428899156956549151",
  AUTO_ROLE_ID // "1411240101832298569"
];

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
        console.log(`✅ Thêm ${id} cho ${member.user.tag}`);
        logAction(member, `+${id}`);
      }
    };
    const remove = async id => {
      if (has(id)) {
        await member.roles.remove(id).catch(() => {});
        console.log(`❌ Gỡ ${id} khỏi ${member.user.tag}`);
        logAction(member, `-${id}`);
      }
    };

    // 🔒 Nếu có SUPER_LOCK_ROLE → ẩn các kênh cá nhân
    if (has(SUPER_LOCK_ROLE_ID)) {
      for (const channelId of SUPER_LOCK_HIDE_CHANNELS) {
        const channel = member.guild.channels.cache.get(channelId);
        if (!channel) continue;
        const perms = channel.permissionOverwrites.cache.get(member.id);
        if (!perms || !perms.deny.has("ViewChannel")) {
          await channel.permissionOverwrites
            .edit(member.id, { ViewChannel: false })
            .catch(() => {});
          console.log(`🔒 Ẩn kênh ${channel.name} cho ${member.user.tag}`);
        }
      }
    } else {
      // Nếu KHÔNG có SUPER_LOCK_ROLE → xoá deny cá nhân (hiện lại)
      for (const channelId of SUPER_LOCK_HIDE_CHANNELS) {
        const channel = member.guild.channels.cache.get(channelId);
        if (!channel) continue;
        const overwrite = channel.permissionOverwrites.cache.get(member.id);
        if (overwrite) {
          await channel.permissionOverwrites.delete(member.id).catch(() => {});
          console.log(`✅ Hiện lại kênh ${channel.name} cho ${member.user.tag}`);
        }
      }
    }

    // ======= CẬP NHẬT ROLE =======
    const hasBase = has(BASE_ROLE_ID);
    const hasAuto = has(AUTO_ROLE_ID);
    const hasRemove = has(REMOVE_IF_HAS_ROLE_ID);
    const hasBlock = [...roles.keys()].some(r => BLOCK_ROLE_IDS.includes(r));
    const hasTrigger = has(BLOCK_TRIGGER_ROLE);

    // 🚫 Nếu có BLOCK_TRIGGER_ROLE → gỡ các role xung đột
    if (hasTrigger) {
      for (const id of BLOCK_CONFLICT_ROLES) {
        if (has(id)) {
          await remove(id);
          console.log(`🚫 ${member.user.tag} có ${BLOCK_TRIGGER_ROLE} nên gỡ ${id}`);
        }
      }
    }

    // ✅ BASE_ROLE chỉ khi có BLOCK_TRIGGER_ROLE
    if (hasTrigger && !hasBase && !hasRemove && !hasBlock) {
      await add(BASE_ROLE_ID);
    } else if (!hasTrigger && hasBase) {
      await remove(BASE_ROLE_ID);
    }

    // 3️⃣ AUTO_ROLE logic bình thường (trừ khi bị gỡ vì conflict)
    if (!hasAuto && !hasRemove && !hasTrigger) {
      await add(AUTO_ROLE_ID);
    } else if (hasAuto && (hasRemove || hasTrigger)) {
      await remove(AUTO_ROLE_ID);
    }

  } catch (err) {
    console.error("❌ updateMemberRoles error:", err);
  }
}

// Ghi cache
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
  } catch (e) {
    console.warn("logAction failed:", e.message);
  }
}

// === Khởi chạy khi bot restart ===
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

// === Sự kiện theo dõi thay đổi role ===
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
