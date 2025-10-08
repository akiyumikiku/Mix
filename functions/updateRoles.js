const BASE_ROLE_ID = "1415319898468651008";
const AUTO_ROLE_ID = "1411240101832298569";
const REMOVE_IF_HAS_ROLE_ID = "1410990099042271352";
const SPECIAL_PROTECT_ROLE_ID = "1411991634194989096"; // role này chặn block-role

const BLOCK_ROLE_IDS = [
  "1411639327909220352","1411085492631506996","1418990676749848576","1410988790444458015",
  "1415322209320435732","1415351613534503022","1415350650165924002","1415320304569290862",
  "1415351362866380881","1415351226366689460","1415322385095332021","1415351029305704498",
  "1415350143800049736","1415350765291307028","1418990664762523718","1417802085378031689",
  "1417097393752506398","1420270612785401988","1420276021009322064","1415350457706217563",
  "1415320854014984342","1414165862205751326"
];

async function updateMemberRoles(member) {
  try {
    if (member.user.bot) return;

    const roles = member.roles.cache;
    const hasBase = roles.has(BASE_ROLE_ID);
    const hasAuto = roles.has(AUTO_ROLE_ID);
    const hasRemove = roles.has(REMOVE_IF_HAS_ROLE_ID);
    const hasProtect = roles.has(SPECIAL_PROTECT_ROLE_ID);
    const hasBlock = roles.some(r => BLOCK_ROLE_IDS.includes(r.id));

    // --- Bước 1: Xử lý BLOCK ROLE ---
    if (hasProtect) {
      // Nếu có SPECIAL_PROTECT_ROLE_ID → xoá hết block roles ngay
      for (const blockId of BLOCK_ROLE_IDS) {
        if (roles.has(blockId)) {
          await member.roles.remove(blockId).catch(() => {});
          console.log(`🧹 Removed blocked role (${blockId}) from ${member.user.tag} (protected)`);
        }
      }
    }

    // --- Bước 2: Xử lý BASE ROLE ---
    if (!hasBase && !hasAuto && !hasBlock) {
      await member.roles.add(BASE_ROLE_ID).catch(() => {});
      console.log(`✅ Added base role to ${member.user.tag}`);
    } 
    else if (hasBase && (hasAuto || hasBlock)) {
      await member.roles.remove(BASE_ROLE_ID).catch(() => {});
      console.log(`❌ Removed base role from ${member.user.tag}`);
    }

    // --- Bước 3: Xử lý AUTO ROLE ---
    if (!hasAuto && !hasRemove) {
      await member.roles.add(AUTO_ROLE_ID).catch(() => {});
      console.log(`✅ Added auto role to ${member.user.tag}`);
    } 
    else if (hasAuto && hasRemove) {
      await member.roles.remove(AUTO_ROLE_ID).catch(() => {});
      console.log(`❌ Removed auto role from ${member.user.tag} (has remove-role)`);
    }

  } catch (err) {
    console.error("❌ updateMemberRoles error:", err);
  }
}

module.exports = { updateMemberRoles };
