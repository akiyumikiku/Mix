const BASE_ROLE_ID = "1415319898468651008";
const AUTO_ROLE_ID = "1411240101832298569";
const REMOVE_IF_HAS_ROLE_ID = "1410990099042271352";
const SUPER_BLOCK_ROLE = "1411991634194989096"; // Không được giữ bất kỳ role nào khác
const BASE_BLOCK_ROLE = "1411240101832298569"; // Khi có role này → không có base role

const BLOCK_ROLE_IDS = [
  "1411639327909220352","1411085492631506996","1418990676749848576","1410988790444458015",
  "1415322209320435732","1415351613534503022","1415350650165924002","1415320304569290862",
  "1415351362866380881","1415351226366689460","1415322385095332021","1415351029305704498",
  "1415350143800049736","1415350765291307028","1418990664762523718","1417802085378031689",
  "1417097393752506398","1420270612785401988","1420276021009322064","1415350457706217563",
  "1415320854014984342","1414165862205751326"
];

/**
 * 🧠 Xử lý cập nhật roles cho member cụ thể
 */
async function updateMemberRoles(member) {
  try {
    if (!member || member.user.bot || !member.manageable) return;

    const roles = member.roles.cache;
    const hasBase = roles.has(BASE_ROLE_ID);
    const hasAuto = roles.has(AUTO_ROLE_ID);
    const hasRemove = roles.has(REMOVE_IF_HAS_ROLE_ID);
    const hasBlock = roles.some(r => BLOCK_ROLE_IDS.includes(r.id));
    const hasBaseBlock = roles.has(BASE_BLOCK_ROLE);
    const hasSuperBlock = roles.has(SUPER_BLOCK_ROLE);

    // 🔒 SUPER BLOCK → chỉ giữ lại chính nó
    if (hasSuperBlock) {
      const rolesToRemove = roles.filter(r => r.id !== SUPER_BLOCK_ROLE);
      if (rolesToRemove.size > 0) {
        for (const role of rolesToRemove.values()) {
          await member.roles.remove(role).catch(() => {});
        }
        console.log(`🚫 ${member.user.tag}: super-block → cleared all other roles.`);
      }
      return;
    }

    // 🚫 Có BASE_BLOCK_ROLE thì không thể có BASE
    if (hasBaseBlock && hasBase) {
      await member.roles.remove(BASE_ROLE_ID).catch(() => {});
      console.log(`❌ Removed base role from ${member.user.tag} (has base-block role)`);
    }

    // ✅ Thêm BASE nếu đủ điều kiện
    if (!hasBase && !hasBlock && !hasBaseBlock) {
      await member.roles.add(BASE_ROLE_ID).catch(() => {});
      console.log(`✅ Added base role for ${member.user.tag}`);
    } else if (hasBase && hasBlock) {
      await member.roles.remove(BASE_ROLE_ID).catch(() => {});
      console.log(`❌ Removed base role from ${member.user.tag} (has block role)`);
    }

    // ✅ AUTO ROLE logic
    if (!hasAuto && !hasRemove && !hasSuperBlock) {
      await member.roles.add(AUTO_ROLE_ID).catch(() => {});
      console.log(`✅ Added auto role for ${member.user.tag}`);
    } else if (hasAuto && (hasRemove || hasSuperBlock)) {
      await member.roles.remove(AUTO_ROLE_ID).catch(() => {});
      console.log(`❌ Removed auto role from ${member.user.tag}`);
    }

    // 🧹 Nếu có BASE_BLOCK_ROLE → gỡ tất cả block roles
    if (hasBaseBlock) {
      for (const id of BLOCK_ROLE_IDS) {
        if (roles.has(id)) {
          await member.roles.remove(id).catch(() => {});
          console.log(`🚫 Removed blocked role (${id}) from ${member.user.tag} (base-block active)`);
        }
      }
    }

  } catch (err) {
    console.error(`❌ updateMemberRoles error (${member?.user?.tag}):`, err);
  }
}

/**
 * ⚙️ Khởi tạo auto role system
 */
function initRoleUpdater(client) {
  client.once("ready", async () => {
    const guild = client.guilds.cache.first();
    if (!guild) return console.log("⚠️ Không tìm thấy guild.");

    console.log(`🔍 Đang quét roles trong guild: ${guild.name}...`);
    await guild.members.fetch();

    const members = guild.members.cache.filter(m => !m.user.bot);
    let i = 0;

    for (const member of members.values()) {
      i++;
      // Gọi xử lý role từng member
      updateMemberRoles(member);
      await new Promise(r => setTimeout(r, 300)); // tránh rate-limit
    }

    console.log(`✅ Đã quét ${i} thành viên khi khởi động.`);
  });

  // 🔄 Cập nhật realtime khi member thay đổi
  client.on("guildMemberAdd", updateMemberRoles);
  client.on("guildMemberUpdate", (_, newMember) => updateMemberRoles(newMember));
}

module.exports = { initRoleUpdater, updateMemberRoles };


module.exports = { updateMemberRoles };
