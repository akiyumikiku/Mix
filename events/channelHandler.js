const { renameChannel } = require("../functions/rename");
const { EmbedBuilder } = require("discord.js");

const CATEGORY_ID = process.env.CATEGORY_ID;   // ID category chứa channel
const ROLE_ID = process.env.AUTO_ROLE_ID;      // Role auto add khi tạo channel
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID; // ID channel để log

// Map lưu timer cho từng channel
const channelTimers = new Map();

// Hàm log embed
async function sendLog(channel, title, desc, color) {
  try {
    const logChannel = channel.client.channels.cache.get(LOG_CHANNEL_ID);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(desc)
      .setColor(color)
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("❌ Lỗi gửi log:", err);
  }
}

module.exports = (client) => {
  // ====== Khi channel mới được tạo ======
  client.on("channelCreate", async (channel) => {
    try {
      if (channel.parentId !== CATEGORY_ID) return;

      await renameChannel(channel, CATEGORY_ID);

      if (!channel.topic) return;
      const match = channel.topic.match(/(\d{17,19})$/);
      if (!match) return;

      const userId = match[1];
      const member = await channel.guild.members.fetch(userId).catch(() => null);
      if (!member) return;

      await member.roles.add(ROLE_ID).catch(() => {});
      console.log(`✅ Đã add role ${ROLE_ID} cho ${member.user.tag} khi tạo channel`);

      await sendLog(
        channel,
        "📂 Channel Created",
        `Channel <#${channel.id}> được tạo cho **${member.user.tag}** và đã add role <@&${ROLE_ID}>.`,
        "#57F287"
      );
    } catch (err) {
      console.error("❌ Lỗi channelCreate:", err);
    }
  });

  // ====== Khi có tin nhắn mới trong channel ======
  client.on("messageCreate", async (message) => {
    try {
      const channel = message.channel;
      if (channel.parentId !== CATEGORY_ID) return;

      if (!channel.topic) return;
      const match = channel.topic.match(/(\d{17,19})$/);
      if (!match) return;

      const userId = match[1];
      const member = await channel.guild.members.fetch(userId).catch(() => null);
      if (!member) return;

      const isWebhookMsg = !!message.webhookId;

      // Check xem channel hiện đang ẩn hay mở
      const isHidden = channel.permissionOverwrites.cache.some(
        ow => ow.deny.has("ViewChannel") && ow.id === channel.guild.roles.everyone.id
      );

      // Nếu là webhook → luôn mở lại và reset 3 ngày
      if (isWebhookMsg) {
        // Mở lại
        for (const role of channel.guild.roles.cache.values()) {
          if (role.managed) continue;
          await channel.permissionOverwrites.edit(role, { ViewChannel: true }).catch(() => {});
        }

        // Reset timer 3 ngày
        if (channelTimers.has(channel.id)) clearTimeout(channelTimers.get(channel.id));
        const timer = setTimeout(async () => {
          try {
            for (const role of channel.guild.roles.cache.values()) {
              if (role.managed) continue;
              await channel.permissionOverwrites.edit(role, { ViewChannel: false }).catch(() => {});
            }
            if (member.roles.cache.has(ROLE_ID)) {
              await member.roles.remove(ROLE_ID).catch(() => {});
            }
            await sendLog(
              channel,
              "⏳ Channel Hidden",
              `Channel <#${channel.id}> của **${member.user.tag}** đã bị ẩn sau 3 ngày không có webhook.`,
              "#ED4245"
            );
          } catch (err) {
            console.error("❌ Lỗi khi ẩn channel:", err);
          }
        }, 3 * 24 * 60 * 60 * 1000);

        channelTimers.set(channel.id, timer);

        console.log(`✅ Channel ${channel.name} mở lại do có webhook mới`);
        await sendLog(
          channel,
          "🔓 Channel Re-Opened",
          `Channel <#${channel.id}> đã mở lại vì có webhook mới.`,
          "#5865F2"
        );
      }

      // Nếu là user → chỉ xử lý khi channel đang ẩn
      else if (!isWebhookMsg && isHidden) {
        // Mở lại trong 8h
        for (const role of channel.guild.roles.cache.values()) {
          if (role.managed) continue;
          await channel.permissionOverwrites.edit(role, { ViewChannel: true }).catch(() => {});
        }

        if (channelTimers.has(channel.id)) clearTimeout(channelTimers.get(channel.id));
        const timer = setTimeout(async () => {
          try {
            for (const role of channel.guild.roles.cache.values()) {
              if (role.managed) continue;
              await channel.permissionOverwrites.edit(role, { ViewChannel: false }).catch(() => {});
            }
            if (member.roles.cache.has(ROLE_ID)) {
              await member.roles.remove(ROLE_ID).catch(() => {});
            }
            await sendLog(
              channel,
              "⏳ Channel Hidden",
              `Channel <#${channel.id}> của **${member.user.tag}** đã bị ẩn sau 8 giờ không hoạt động.`,
              "#ED4245"
            );
          } catch (err) {
            console.error("❌ Lỗi khi ẩn channel:", err);
          }
        }, 8 * 60 * 60 * 1000);

        channelTimers.set(channel.id, timer);

        console.log(`✅ Channel ${channel.name} mở lại do user nhắn`);
        await sendLog(
          channel,
          "🔓 Channel Re-Opened",
          `Channel <#${channel.id}> đã mở lại vì có tin nhắn từ **${message.author.tag}**.`,
          "#FEE75C"
        );
      }

    } catch (err) {
      console.error("❌ Lỗi messageCreate:", err);
    }
  });
};
