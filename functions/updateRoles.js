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

const SUPER_LOCK_HIDE_CHANNELS = [
  "1419727338119368784",
  "1411049568979648553",
  "1423207293335371776",
  "1419725921363034123",
  "1419725102412726292"
];

// Danh mục cần ẩn khi KHÔNG có role REMOVE_IF_HAS_ROLE_ID
const CATEGORY_IDS_TO_HIDE = [
  "1411043139728314478",
  "1411049289685270578",
  "1411034825699233943"
];

// Kênh riêng cần ẩn nếu KHÔNG có role 1428899344010182756
const PRIVATE_CHANNEL_ID = "1428927402444325024";
const PRIVATE_ROLE_ID = "1428899344010182756";

// Role nâng cấp logic
const REQUIRED_ROLE = "1428898880447316159";
const ROLE_UPGRADE_MAP = {
  "1431525750724362330": "1428899630753775626", // #1 → #1.1
  "1431525792365547540": "1410990099042271352", // #2 → #2.1
  "1431525824082870272": "1428899344010182756", // #3 → #3.1
  "1431525863987613877": "1428418711764865156", // #4 → #4.1
  "1431525890587885698": "1431525947684950016"  // #5 → #5.1
};

const BLOCK_TRIGGER_ROLE = "1428898880447316159";
const BLOCK_CONFLICT_ROLES = ["1428899156956549151", AUTO_ROLE_ID];

// ====== Cache và trạng thái ======
const lastUpdate = new Map();
const channelState = new Map(); // memberId => { channelId: visible(bool) }

// ====== Hàm chính ======
async function updateMemberRoles(member) {
  try {
    if (!member || member.user?.bot) return;
    const now = Date.now();
    if (lastUpdate.has(member.id) && now - lastUpdate.get(member.id) < 8000) return;
    lastUpdate.set(member.id, now);

    const roles = member.roles.cache;
    const has = id => roles.has(id);

    const toAdd = [];
    const toRemove = [];

    const hasBase = has(BASE_ROLE_ID);
    const hasAuto = has(AUTO_ROLE_ID);
    const hasRemove = has(REMOVE_IF_HAS_ROLE_ID);
    const hasTrigger = has(BLOCK_TRIGGER_ROLE);
    const hasBlock = [...roles.keys()].some(r => BLOCK_ROLE_IDS.includes(r));

    // 🚫 Conflict xử lý
    if (hasTrigger) {
      for (const id of BLOCK_CONFLICT_ROLES) if (has(id)) toRemove.push(id);
    }

    // BASE ROLE logic
    if (hasTrigger && !hasBase && !hasRemove && !hasBlock) toAdd.push(BASE_ROLE_ID);
    else if (!hasTrigger && hasBase) toRemove.push(BASE_ROLE_ID);

    // AUTO ROLE logic
    if (!hasAuto && !hasRemove && !hasTrigger) toAdd.push(AUTO_ROLE_ID);
    else if (hasAuto && (hasRemove || hasTrigger)) toRemove.push(AUTO_ROLE_ID);

    // ⚙️ Thêm/gỡ role 1 lần (gom batch)
    if (toAdd.length) await member.roles.add(toAdd).catch(() => {});
    if (toRemove.length) await member.roles.remove(toRemove).catch(() => {});

    // 🔁 Nâng cấp role
    if (has(REQUIRED_ROLE)) {
      for (const [normal, upgraded] of Object.entries(ROLE_UPGRADE_MAP)) {
        if (has(normal) && !has(upgraded)) await member.roles.add(upgraded).catch(() => {});
      }
    }

    // 🔁 Gỡ role nâng cấp nếu mất role thường
    for (const [normal, upgraded] of Object.entries(ROLE_UPGRADE_MAP)) {
      if (!has(normal) && has(upgraded) && !has(REQUIRED_ROLE)) {
        await member.roles.remove(upgraded).catch(() => {});
      }
    }

    // 🔒 SUPER LOCK ẩn kênh
    if (has(SUPER_LOCK_ROLE_ID)) {
      for (const channelId of SUPER_LOCK_HIDE_CHANNELS) {
        await setChannelVisibility(member, channelId, false);
      }
    } else {
      for (const channelId of SUPER_LOCK_HIDE_CHANNELS) {
        await setChannelVisibility(member, channelId, true);
      }
    }

    // 🚫 Ẩn danh mục nếu KHÔNG có role REMOVE_IF_HAS_ROLE_ID
    const shouldHideCategory = !has(REMOVE_IF_HAS_ROLE_ID);
    for (const catId of CATEGORY_IDS_TO_HIDE) {
      const category = member.guild.channels.cache.get(catId);
      if (!category) continue;
      for (const channel of category.children.cache.values()) {
        await setChannelVisibility(member, channel.id, !shouldHideCategory);
      }
    }

    // 🚫 Ẩn kênh riêng nếu KHÔNG có PRIVATE_ROLE_ID
    await setChannelVisibility(member, PRIVATE_CHANNEL_ID, has(PRIVATE_ROLE_ID));

  } catch (err) {
    console.error("❌ updateMemberRoles error:", err);
  }
}

// ====== Hàm ẩn/hiện kênh có cache ======
async function setChannelVisibility(member, channelId, visible) {
  try {
    if (!member.guild) return;
    const prev = channelState.get(member.id)?.[channelId];
    if (prev === visible) return; // Không đổi → bỏ qua

    const channel = member.guild.channels.cache.get(channelId);
    if (!channel) return;

    if (visible) {
      await channel.permissionOverwrites.delete(member.id).catch(() => {});
    } else {
      await channel.permissionOverwrites.edit(member.id, { ViewChannel: false }).catch(() => {});
    }

    if (!channelState.has(member.id)) channelState.set(member.id, {});
    channelState.get(member.id)[channelId] = visible;
  } catch (err) {
    console.warn("⚠️ setChannelVisibility failed:", err.message);
  }
}

// ====== Log cache ======
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

// ====== Khởi động ======
async function initRoleUpdater(client) {
  console.log("🔄 Quét roles toàn bộ thành viên (lúc restart)...");

  for (const [, guild] of client.guilds.cache) {
    await guild.members.fetch().catch(() => {});
    const members = guild.members.cache.filter(m =>
      !m.user.bot &&
      (m.roles.cache.has(REQUIRED_ROLE) ||
       m.roles.cache.has(REMOVE_IF_HAS_ROLE_ID) ||
       m.roles.cache.has(SUPER_LOCK_ROLE_ID))
    );

    for (const member of members.values()) {
      await updateMemberRoles(member);
      await new Promise(res => setTimeout(res, 300)); // Nghỉ 0.3s giữa mỗi người
    }
  }

  console.log("✅ Quét hoàn tất!");
}

// ====== Theo dõi thay đổi role ======
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
