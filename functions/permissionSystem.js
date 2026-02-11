/* ================== CONFIG ================== */
const SPECIAL_ROLES = [
  "1426522399645634691",
  "1411991634194989096",
  "1470784585519468584"
];

const BLOCKED_CHANNELS = [
  "1423207293335371776",
  "1419725921363034123",
  "1419989424904736880",
  "1419727338119368784",
  "1419727361062076418",
  "1446868843652845608"
];

const ALLOWED_CHANNELS = [
  "1411043248406794461",
  "1411043297694060614",
  "1411994491858063380",
  "1411049384816148643",
  "1411049568979648553",
  "1445395166666952714"
];

/* ================== CACHE TRACKING ================== */
let lastCounterUpdate = {
  all: 0,
  members: 0,
  timestamp: 0
};

/* ================== UTILS ================== */
async function getChannel(guild, id) {
  try {
    return guild.channels.cache.get(id) || await guild.channels.fetch(id);
  } catch {
    return null;
  }
}

async function applyUserPermissions(member) {
  try {
    console.log(`🔍 Checking permissions for: ${member.user.tag}`);
    
    const guild = member.guild;
    const hasRole = member.roles.cache.hasAny(...SPECIAL_ROLES);
    
    console.log(`   └─ Has special role: ${hasRole}`);

    const allChannels = [...BLOCKED_CHANNELS, ...ALLOWED_CHANNELS];

    if (!hasRole) {
      console.log(`   └─ Removing permissions (no special role)`);
      for (const id of allChannels) {
        const ch = await getChannel(guild, id);
        if (ch?.permissionOverwrites.cache.has(member.id)) {
          console.log(`      └─ Deleted override in: ${ch.name}`);
          await ch.permissionOverwrites.delete(member.id).catch(() => {});
        }
      }
      return;
    }

    console.log(`   └─ Applying BLOCKED channels...`);
    for (const id of BLOCKED_CHANNELS) {
      const ch = await getChannel(guild, id);
      if (ch) {
        console.log(`      └─ Blocking: ${ch.name}`);
        await ch.permissionOverwrites.edit(member.id, { ViewChannel: false }).catch(e => {
          console.error(`         └─ Error: ${e.message}`);
        });
      } else {
        console.warn(`      └─ Channel not found: ${id}`);
      }
    }

    console.log(`   └─ Applying ALLOWED channels...`);
    for (const id of ALLOWED_CHANNELS) {
      const ch = await getChannel(guild, id);
      if (ch) {
        console.log(`      └─ Allowing: ${ch.name}`);
        await ch.permissionOverwrites.edit(member.id, { ViewChannel: true }).catch(e => {
          console.error(`         └─ Error: ${e.message}`);
        });
      } else {
        console.warn(`      └─ Channel not found: ${id}`);
      }
    }
    
    console.log(`✅ Permissions applied for: ${member.user.tag}`);
  } catch (err) {
    console.error(`❌ Error in applyUserPermissions for ${member.user.tag}:`, err);
  }
}

/* ================== COUNTER (WITH RATE LIMIT & CACHE) ================== */
async function updateCounters(client, online = true) {
  try {
    // ✅ Kiểm tra rate limit (10 phút giữa mỗi lần update)
    const now = Date.now();
    if (now - lastCounterUpdate.timestamp < 10 * 60 * 1000 && lastCounterUpdate.timestamp > 0) {
      console.log("⏰ Rate limited - skipping counter update");
      return;
    }

    console.log("🔄 Updating counters...");
    
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    
    // ✅ FORCE FETCH - lấy dữ liệu mới từ Discord
    await guild.members.fetch({ force: true });
    
    const totalMembers = guild.members.cache.filter(m => !m.user.bot).size;
    const allMembers = guild.memberCount;

    // ✅ Chỉ update nếu số liệu thay đổi
    if (
      lastCounterUpdate.all === allMembers && 
      lastCounterUpdate.members === totalMembers &&
      lastCounterUpdate.timestamp > 0
    ) {
      console.log("📊 No changes detected - skipping update");
      return;
    }

    console.log(`📊 Stats changed: All=${allMembers} (was ${lastCounterUpdate.all}), Members=${totalMembers} (was ${lastCounterUpdate.members})`);

    const chAll = await guild.channels.fetch(process.env.CH_ALL).catch(() => null);
    const chMem = await guild.channels.fetch(process.env.CH_MEMBERS).catch(() => null);
    const chSrv = await guild.channels.fetch(process.env.CH_SERVER).catch(() => null);

    if (!chAll || !chMem || !chSrv) {
      console.error("❌ Counter channels not found!");
      return;
    }

    await Promise.allSettled([
      chAll.setName(`╭ All Members: ${allMembers}`),
      chMem.setName(`┊ Members: ${totalMembers}`),
      chSrv.setName(`╰ Server: ${online ? "🟢 Active" : "🔴 Offline"}`)
    ]);
    
    // ✅ Lưu cache
    lastCounterUpdate = {
      all: allMembers,
      members: totalMembers,
      timestamp: now
    };
    
    console.log(`✅ Counters updated! All=${allMembers}, Members=${totalMembers}`);
  } catch (err) {
    console.error("❌ Update counters error:", err);
  }
}

/* ================== INIT ================== */
function initPermissionSystem(client) {
  console.log("🚀 Initializing permission system...");

  // ✅ Validate environment variables
  const requiredEnvs = ['GUILD_ID', 'CH_ALL', 'CH_MEMBERS', 'CH_SERVER'];
  const missing = requiredEnvs.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(`❌ Permission system: Missing env vars: ${missing.join(', ')}`);
    return;
  }

  console.log("✅ Environment variables OK");

  // ✅ Event: Member mới join
  client.on("guildMemberAdd", async (member) => {
    if (!member.user.bot) {
      console.log(`👋 New member joined: ${member.user.tag}`);
      await applyUserPermissions(member);
    }
    // Update counter khi có member mới
    await updateCounters(client, true);
  });

  // ✅ Event: Member leave
  client.on("guildMemberRemove", async (member) => {
    console.log(`👋 Member left: ${member.user.tag}`);
    // Update counter khi member rời
    await updateCounters(client, true);
  });

  // ✅ Event: Member update roles
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    if (!newMember.user.bot && !oldMember.roles.cache.equals(newMember.roles.cache)) {
      console.log(`🔄 Roles updated for: ${newMember.user.tag}`);
      await applyUserPermissions(newMember);
    }
  });

  // ✅ Event: Bot ready
  client.once("ready", async () => {
    try {
      console.log("🔄 Bot ready - Starting permission system setup...");
      
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      
      if (!guild) {
        console.error("❌ Không tìm thấy guild với ID:", process.env.GUILD_ID);
        return;
      }

      console.log(`✅ Guild found: ${guild.name}`);
      
      await guild.members.fetch({ force: true });
      console.log(`✅ Fetched ${guild.members.cache.size} members`);
      
      console.log("🔄 Đang apply permissions cho tất cả members...");
      
      let count = 0;
      for (const [, member] of guild.members.cache) {
        if (!member.user.bot) {
          await applyUserPermissions(member);
          count++;
        }
      }

      console.log(`✅ Permissions applied cho ${count} members!`);

      // ✅ Update counters lần đầu (force)
      lastCounterUpdate.timestamp = 0; // Reset để force update
      await updateCounters(client, true);

      // ✅ Auto update counters mỗi 15 phút (tránh rate limit)
      setInterval(() => updateCounters(client, true), 15 * 60 * 1000);
      console.log("⏰ Counter auto-update scheduled (every 15 minutes)");
      
    } catch (err) {
      console.error("❌ Init permission system error:", err.stack || err);
    }
  });

  // ✅ Graceful shutdown
  const shutdownHandler = async () => {
    console.log("🔴 Bot đang tắt...");
    try {
      lastCounterUpdate.timestamp = 0; // Force update
      await updateCounters(client, false);
      console.log("✅ Counters updated to offline");
    } catch (err) {
      console.error("❌ Error updating counters on shutdown:", err);
    }
  };

  process.on("SIGINT", shutdownHandler);
  process.on("SIGTERM", shutdownHandler);
  
  console.log("✅ Permission system setup complete!");
}

module.exports = { initPermissionSystem };
