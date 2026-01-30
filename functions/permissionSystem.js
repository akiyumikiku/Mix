/* ================== CONFIG ================== */
const SPECIAL_ROLES = [
  "1426522399645634691",
  "1411991634194989096"
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

/* ================== UTILS ================== */
async function getChannel(guild, id) {
  return guild.channels.cache.get(id) || guild.channels.fetch(id).catch(() => null);
}

async function applyUserPermissions(member) {
  const guild = member.guild;
  const hasRole = member.roles.cache.hasAny(...SPECIAL_ROLES);

  const allChannels = [...BLOCKED_CHANNELS, ...ALLOWED_CHANNELS];

  if (!hasRole) {
    for (const id of allChannels) {
      const ch = await getChannel(guild, id);
      if (ch?.permissionOverwrites.cache.has(member.id)) {
        await ch.permissionOverwrites.delete(member.id).catch(() => {});
      }
    }
    return;
  }

  for (const id of BLOCKED_CHANNELS) {
    const ch = await getChannel(guild, id);
    if (ch) await ch.permissionOverwrites.edit(member.id, { ViewChannel: false }).catch(() => {});
  }

  for (const id of ALLOWED_CHANNELS) {
    const ch = await getChannel(guild, id);
    if (ch) await ch.permissionOverwrites.edit(member.id, { ViewChannel: true }).catch(() => {});
  }
}

/* ================== COUNTER ================== */
async function updateCounters(client, online = true) {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const members = await guild.members.fetch();

    const chAll = await guild.channels.fetch(process.env.CH_ALL).catch(() => null);
    const chMem = await guild.channels.fetch(process.env.CH_MEMBERS).catch(() => null);
    const chSrv = await guild.channels.fetch(process.env.CH_SERVER).catch(() => null);

    if (!chAll || !chMem || !chSrv) return;

    await Promise.allSettled([
      chAll.setName(`╭ All Members: ${guild.memberCount}`),
      chMem.setName(`┊ Members: ${members.filter(m => !m.user.bot).size}`),
      chSrv.setName(`╰ Server: ${online ? "🟢 Active" : "🔴 Offline"}`)
    ]);
  } catch (err) {
    console.error("❌ Update counters error:", err);
  }
}

/* ================== INIT ================== */
function initPermissionSystem(client) {
  // ✅ Event: Member mới join
  client.on("guildMemberAdd", m => {
    if (!m.user.bot) applyUserPermissions(m);
  });

  // ✅ Event: Member update roles
  client.on("guildMemberUpdate", (o, n) => {
    if (!n.user.bot && !o.roles.cache.equals(n.roles.cache)) {
      applyUserPermissions(n);
    }
  });

  // ✅ Event: Bot ready - apply permissions cho tất cả members
  client.once("ready", async () => {
    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      await guild.members.fetch();

      console.log("🔄 Đang apply permissions cho tất cả members...");
      
      for (const [, member] of guild.members.cache) {
        if (!member.user.bot) {
          await applyUserPermissions(member);
        }
      }

      console.log("✅ Permissions applied xong!");

      // ✅ Update counters lần đầu
      await updateCounters(client, true);

      // ✅ Auto update counters mỗi 5 phút
      setInterval(() => updateCounters(client, true), 5 * 60 * 1000);
      
    } catch (err) {
      console.error("❌ Init permission system error:", err);
    }
  });

  // ✅ Graceful shutdown - update counter về offline
  process.on("SIGINT", async () => {
    console.log("🔴 Bot đang tắt...");
    await updateCounters(client, false);
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("🔴 Bot đang tắt...");
    await updateCounters(client, false);
    process.exit(0);
  });
}

module.exports = { initPermissionSystem };
