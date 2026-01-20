require(‘dotenv’).config();

// ====== Cấu hình từ .env ======
const BASE_ROLE_ID = process.env.BASE_ROLE_ID;
const AUTO_ROLE_ID = process.env.AUTO_ROLE_ID;
const REMOVE_IF_HAS_ROLE_ID = process.env.REMOVE_IF_HAS_ROLE_IDS.split(’,’);
const SUPER_LOCK_ROLE_ID = process.env.SUPER_LOCK_ROLE_ID;

const BLOCK_ROLE_IDS = process.env.BLOCK_ROLE_IDS.split(’,’);
const REQUIRED_ROLE = process.env.REQUIRED_ROLE;
const BLOCK_TRIGGER_ROLE = process.env.BLOCK_TRIGGER_ROLE;
const BLOCK_CONFLICT_ROLES = process.env.BLOCK_CONFLICT_ROLES.split(’,’);

const ROLE_UPGRADE_MAP = JSON.parse(process.env.ROLE_UPGRADE_MAP);
const ROLE_HIERARCHY = Object.entries(JSON.parse(process.env.ROLE_HIERARCHY)).map(([parent, child]) => ({ parent, child }));

// ====== Tối ưu timing ======
const UPDATE_COOLDOWN = Number(process.env.UPDATE_COOLDOWN_MS || 5000); // Tăng từ 4s → 5s
const MEMBER_SCAN_DELAY = Number(process.env.MEMBER_SCAN_DELAY_MS || 300); // Tăng từ 150ms → 300ms
const FULL_SCAN_INTERVAL = Number(process.env.FULL_SCAN_INTERVAL_MIN || 15) * 60 * 1000; // Tăng từ 10min → 15min
const BATCH_SIZE = 5; // Xử lý 5 members/batch
const BATCH_DELAY = 2000; // Delay 2s giữa các batch

// ====== DANH SÁCH ROLE BLOCK BASE ======
const BASE_BLOCK_LIST = new Set([
‘1415350765291307028’,
‘1415350143800049736’,
‘1415351029305704498’,
‘1415322385095332021’,
‘1415351226366689460’,
‘1415351362866380881’,
‘1415320304569290862’,
‘1415350650165924002’,
‘1415351613534503022’,
‘1417097393752506398’,
‘1420270612785401988’,
‘1415322209320435732’,
‘1420276021009322064’,
‘1415350457706217563’,
‘1415320854014984342’,
‘1414165862205751326’,
‘1411240101832298569’,
‘1428899156956549151’
]);

// ====== Cache & Queue ======
const lastUpdate = new Map();
const updateQueue = [];
let isProcessingQueue = false;

// ====== Rate Limit Manager ======
class RateLimiter {
constructor() {
this.requests = [];
this.maxRequests = 40; // Discord limit: 50/s, dùng 40 để an toàn
this.timeWindow = 1000; // 1 giây
}

async waitForSlot() {
const now = Date.now();
this.requests = this.requests.filter(time => now - time < this.timeWindow);

```
if (this.requests.length >= this.maxRequests) {
  const oldestRequest = this.requests[0];
  const waitTime = this.timeWindow - (now - oldestRequest) + 100;
  console.log('⏳ Rate limit, chờ ' + waitTime + 'ms...');
  await new Promise(resolve => setTimeout(resolve, waitTime));
  return this.waitForSlot();
}

this.requests.push(now);
```

}
}

const rateLimiter = new RateLimiter();

// ====== Hàm hỗ trợ ======
async function safeFetch(member) {
try {
await rateLimiter.waitForSlot();
await member.fetch(true);
} catch (err) {
console.error(‘❌ Lỗi fetch member:’, err.message);
}
}

// ====== Queue Processing ======
async function processQueue() {
if (isProcessingQueue || updateQueue.length === 0) return;

isProcessingQueue = true;

while (updateQueue.length > 0) {
const member = updateQueue.shift();
await updateMemberRolesInternal(member);
await new Promise(resolve => setTimeout(resolve, MEMBER_SCAN_DELAY));
}

isProcessingQueue = false;
}

// ====== Hàm cập nhật roles (với queue) ======
async function updateMemberRoles(member, skipCooldown = false) {
if (!member || member.user?.bot) return;

const now = Date.now();
const lastUpdateTime = lastUpdate.get(member.id);

if (!skipCooldown && lastUpdateTime && now - lastUpdateTime < UPDATE_COOLDOWN) {
console.log(‘⚠️ [SKIP] ’ + member.user.tag + ’ (cooldown)’);
return;
}

// Thêm vào queue thay vì xử lý ngay
if (!updateQueue.find(m => m.id === member.id)) {
updateQueue.push(member);
}

// Bắt đầu xử lý queue nếu chưa chạy
if (!isProcessingQueue) {
processQueue();
}
}

// ====== Hàm cập nhật roles internal (logic thực tế) ======
async function updateMemberRolesInternal(member) {
try {
if (!member || member.user?.bot) return;

```
await safeFetch(member);

const now = Date.now();
lastUpdate.set(member.id, now);

const roles = member.roles.cache;
const has = id => roles.has(id);
const toAdd = new Set();
const toRemove = new Set();

console.log('\n🔄 [UPDATE] ' + member.user.tag);

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
if (hasTrigger && !hasBase && !hasRemove && !hasBlock) {
  toAdd.add(BASE_ROLE_ID);
} else if (!hasTrigger && hasBase) {
  toRemove.add(BASE_ROLE_ID);
}

// 🤖 AUTO role logic
if (!hasAuto && !hasRemove && !hasTrigger) {
  toAdd.add(AUTO_ROLE_ID);
} else if (hasAuto && (hasRemove || hasTrigger)) {
  toRemove.add(AUTO_ROLE_ID);
}

// ⬆️ Thêm role nâng cấp
if (hasRequired) {
  for (const [normal, upgraded] of Object.entries(ROLE_UPGRADE_MAP)) {
    if (has(normal) && !has(upgraded)) {
      toAdd.add(upgraded);
    }
  }
}

// ⬇️ Gỡ role nâng cấp khi mất role thường
for (const [normal, upgraded] of Object.entries(ROLE_UPGRADE_MAP)) {
  if (!has(normal) && has(upgraded)) {
    toRemove.add(upgraded);
  }
}

// 🔗 Kiểm tra cha–con
for (const { parent, child } of ROLE_HIERARCHY) {
  const hasParent = has(parent);
  const hasChild = has(child);
  if (!hasParent && hasChild) {
    console.log('🚨 [HIERARCHY] Mất ' + parent + ', xoá ' + child);
    toRemove.add(child);
  }
}

// 🧩 Logic "block BASE role" theo danh sách (dùng Set để nhanh hơn)
const hasBaseBlock = [...roles.keys()].some(id => BASE_BLOCK_LIST.has(id));
if (hasBaseBlock && hasBase) {
  console.log('🚫 Có role block BASE, xoá BASE_ROLE');
  toRemove.add(BASE_ROLE_ID);
} else if (!hasBaseBlock && !hasBase && hasTrigger && !hasRemove && !hasBlock) {
  console.log('✅ Không có role block, thêm BASE_ROLE');
  toAdd.add(BASE_ROLE_ID);
}

// 🧹 Gộp xử lý add/remove 1 lần
const finalAdd = [...toAdd].filter(id => !has(id));
const finalRemove = [...toRemove].filter(id => has(id));

// Áp dụng thay đổi với rate limiting
if (finalAdd.length > 0) {
  console.log('➕ [' + member.user.tag + '] Add: ' + finalAdd.join(', '));
  await rateLimiter.waitForSlot();
  await member.roles.add(finalAdd).catch(err => 
    console.error('❌ Lỗi add roles: ' + err.message)
  );
}

if (finalRemove.length > 0) {
  console.log('➖ [' + member.user.tag + '] Remove: ' + finalRemove.join(', '));
  await rateLimiter.waitForSlot();
  await member.roles.remove(finalRemove).catch(err => 
    console.error('❌ Lỗi remove roles: ' + err.message)
  );
}
```

} catch (err) {
console.error(‘❌ updateMemberRolesInternal error:’, err);
}
}

// ====== Quét toàn bộ khi khởi động (với batching) ======
async function initRoleUpdater(client) {
console.log(‘🔄 Bắt đầu quét roles (khởi động)…’);

for (const [, guild] of client.guilds.cache) {
try {
await rateLimiter.waitForSlot();
await guild.members.fetch();

```
  const members = guild.members.cache.filter(m => !m.user.bot);
  const memberArray = Array.from(members.values());
  
  console.log('📊 Tổng số thành viên: ' + memberArray.length);

  // Xử lý theo batch
  for (let i = 0; i < memberArray.length; i += BATCH_SIZE) {
    const batch = memberArray.slice(i, i + BATCH_SIZE);
    
    console.log('📦 Batch ' + Math.floor(i / BATCH_SIZE + 1) + '/' + Math.ceil(memberArray.length / BATCH_SIZE));
    
    for (const member of batch) {
      await updateMemberRolesInternal(member);
      await new Promise(res => setTimeout(res, MEMBER_SCAN_DELAY));
    }
    
    // Delay giữa các batch
    if (i + BATCH_SIZE < memberArray.length) {
      console.log('⏸️ Nghỉ ' + BATCH_DELAY + 'ms giữa các batch...');
      await new Promise(res => setTimeout(res, BATCH_DELAY));
    }
  }
} catch (err) {
  console.error('❌ Lỗi quét guild:', err);
}
```

}

console.log(‘✅ Quét hoàn tất!’);

// ♻️ Định kỳ quét lại với batching
setInterval(async () => {
console.log(‘♻️ Bắt đầu quét định kỳ…’);

```
for (const [, guild] of client.guilds.cache) {
  try {
    await rateLimiter.waitForSlot();
    const members = await guild.members.fetch();
    const memberArray = Array.from(members.values()).filter(m => !m.user.bot);

    for (let i = 0; i < memberArray.length; i += BATCH_SIZE) {
      const batch = memberArray.slice(i, i + BATCH_SIZE);
      
      for (const member of batch) {
        await updateMemberRolesInternal(member);
        await new Promise(res => setTimeout(res, MEMBER_SCAN_DELAY));
      }
      
      if (i + BATCH_SIZE < memberArray.length) {
        await new Promise(res => setTimeout(res, BATCH_DELAY));
      }
    }
  } catch (err) {
    console.error('❌ Lỗi quét định kỳ:', err);
  }
}

console.log('♻️ Quét định kỳ hoàn tất');
```

}, FULL_SCAN_INTERVAL);
}

// ====== Theo dõi khi role cụ thể bị gỡ (tối ưu) ======
function setupRoleRemoveWatcher(client) {
const TARGET_ROLE = ‘1428899156956549151’;
const BASE_ROLE = BASE_ROLE_ID;

// Debounce map để tránh xử lý trùng lặp
const debounceMap = new Map();
const DEBOUNCE_TIME = 1000;

client.on(‘guildMemberUpdate’, async (oldMember, newMember) => {
try {
if (!oldMember || !newMember) return;
if (newMember.user?.bot) return;

```
  // Debounce
  const memberId = newMember.id;
  const now = Date.now();
  const lastProcessed = debounceMap.get(memberId);
  
  if (lastProcessed && now - lastProcessed < DEBOUNCE_TIME) {
    return;
  }
  debounceMap.set(memberId, now);

  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;

  const hadTarget = oldRoles.has(TARGET_ROLE);
  const hasTarget = newRoles.has(TARGET_ROLE);

  // Khi role bị gỡ
  if (hadTarget && !hasTarget) {
    console.log('🎯 [EVENT] ' + newMember.user.tag + ' bị gỡ role ' + TARGET_ROLE + ', ép add lại BASE_ROLE');
    
    await rateLimiter.waitForSlot();
    await newMember.roles.add(BASE_ROLE).catch(err =>
      console.error('❌ Lỗi add BASE_ROLE: ' + err.message)
    );
  }

  // Trigger update member roles khi có thay đổi role
  const rolesChanged = oldRoles.size !== newRoles.size || 
    ![...oldRoles.keys()].every(id => newRoles.has(id));
  
  if (rolesChanged) {
    await updateMemberRoles(newMember);
  }

} catch (err) {
  console.error('❌ Role remove watcher error:', err);
}
```

});

// Clear debounce map định kỳ để tránh memory leak
setInterval(() => {
const now = Date.now();
for (const [memberId, time] of debounceMap.entries()) {
if (now - time > 60000) { // 1 phút
debounceMap.delete(memberId);
}
}
}, 300000); // 5 phút
}

module.exports = { updateMemberRoles, initRoleUpdater, setupRoleRemoveWatcher };