const BASE_ROLE_ID = "1415319898468651008";
const AUTO_ROLE_ID = "1411240101832298569";
const REMOVE_IF_HAS_ROLE_ID = "1410990099042271352";

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

    const hasBaseRole = member.roles.cache.has(BASE_ROLE_ID);
    const hasAnyBlockRole = member.roles.cache.some(r => BLOCK_ROLE_IDS.includes(r.id));

    if (!hasBaseRole && !hasAnyBlockRole) {
      await member.roles.add(BASE_ROLE_ID).catch(() => {});
      console.log(`✅ Added base role for ${member.user.tag}`);
    }
    if (hasBaseRole && hasAnyBlockRole) {
      await member.roles.remove(BASE_ROLE_ID).catch(() => {});
      console.log(`❌ Removed base role from ${member.user.tag} (has block role)`);
    }

    const hasAutoRole = member.roles.cache.has(AUTO_ROLE_ID);
    const hasRemoveRole = member.roles.cache.has(REMOVE_IF_HAS_ROLE_ID);

    if (!hasAutoRole && !hasRemoveRole) {
      await member.roles.add(AUTO_ROLE_ID).catch(() => {});
      console.log(`✅ Added auto role for ${member.user.tag}`);
    }
    if (hasAutoRole && hasRemoveRole) {
      await member.roles.remove(AUTO_ROLE_ID).catch(() => {});
      console.log(`❌ Removed auto role from ${member.user.tag} (has remove role)`);
    }

  } catch (err) {
    console.error("❌ updateMemberRoles error:", err);
  }
}

module.exports = { updateMemberRoles };
