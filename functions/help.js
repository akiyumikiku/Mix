// functions/help.js
const { EmbedBuilder } = require("discord.js");

function createHelpEmbed() {
  return new EmbedBuilder()
    .setColor("#007ACC")
    .setTitle("HƯỚNG DẪN SỬ DỤNG BOT")
    .setDescription(
      "Danh sách các lệnh hiện có trong server **SuperNova Citadel**.\n" +
      "Các lệnh được chia theo nhóm để bạn dễ dàng tra cứu và sử dụng hiệu quả."
    )

    // I. HỆ THỐNG & THÔNG TIN
    .addFields({
      name: "I. HỆ THỐNG & THÔNG TIN — <@1417797395634196521>",
      value:
        "`/report` — Báo cáo người dùng vi phạm\n" +
        "`/findlink` — Lấy link mời server (<@720351927581278219>)",
      inline: false,
    })

    // II. LEVEL & XẾP HẠNG
    .addFields({
      name: "II. LEVEL & XẾP HẠNG — <@437808476106784770>",
      value:
        "`/level (@user)` — Xem level tương tác hiện tại\n" +
        "`/leaderboard` — Bảng xếp hạng top 10 level cao nhất\n" +
        "`/rank` — Tương tự `/level`\n" +
        "`/leaderboard message` — Top người gửi nhiều tin nhắn nhất (<@720351927581278219>)\n" +
        "`/leaderboard invites` — Top người mời nhiều nhất (<@720351927581278219>)",
      inline: false,
    })

    // III. HỆ THỐNG SOL'S RNG (GLOBAL / AURA)
    .addFields({
      name: "III. HỆ THỐNG SOL'S RNG (GLOBAL / AURA) — <@1380356714225995776>",
      value:
        "`/link` — Liên kết tài khoản Roblox của bạn với bot\n" +
        "`/statsfound discord_user (@user)` — Xem global aura của người dùng Discord (<@1365663330160611490>)\n" +
        "`/statsfound roblox_username (tên Roblox)` — Xem global aura theo tài khoản Roblox (<@1365663330160611490>)\n" +
        "`/collectedstatsfound` — Xem bảng xếp hạng người có collected stats cao nhất (<@1365663330160611490>)\n" +
        "`/auracounts` — Xem top những aura được sở hữu nhiều nhất (<@1365663330160611490>)",
      inline: false,
    })

    // IV. KINH TẾ & GIẢI TRÍ
    .addFields({
      name: "IV. KINH TẾ & GIẢI TRÍ — <@172002275412279296>",
      value:
        "`t!points` — Kiểm tra điểm tương tác của bạn\n" +
        "`t!wallet` — Xem ví toàn cầu\n" +
        "`t!inventory` — Xem kho đồ của bạn\n" +
        "`t!profile` — Xem hồ sơ cá nhân\n" +
        "`t!house` — Xem ngôi nhà của bạn\n" +
        "`t!fishy` — Câu cá kiếm vật phẩm\n" +
        "`t!fish inv` — Xem kho đồ câu cá\n" +
        "`t!fish sell` — Bán cá\n" +
        "`t!tg` — Xem thú cưng của bạn\n" +
        "`t!tg feed / play / walk / train / clean` — Chăm sóc thú cưng\n" +
        "`t!daycare` — Gửi pet vào nhà trẻ\n" +
        "`t!vote` — Vote cho Tatsu bot\n" +
        "`t!daily` — Điểm danh hằng ngày\n" +
        "`t!quest` — Mở nhiệm vụ hằng ngày\n" +
        "`t!shop + 2` — Mở cửa hàng của server",
      inline: false,
    })

    // V. ÂM NHẠC
    .addFields({
      name: "V. ÂM NHẠC — <@412347257233604609>",
      value:
        "`/play <link>` — Phát nhạc từ link\n" +
        "`/pause` — Tạm dừng phát nhạc\n" +
        "`/resume` — Tiếp tục phát\n" +
        "`/skip` — Bỏ qua bài hát hiện tại",
      inline: false,
    })

    // VI. QUY ĐỊNH & HỖ TRỢ
    .addFields({
      name: "VI. QUY ĐỊNH & HỖ TRỢ — <@1417797395634196521>",
      value:
        "Khi sử dụng bot trong **SuperNova Citadel**, bạn cần tuân thủ các quy tắc sau:\n" +
        "- Không spam hoặc ping bot liên tục.\n" +
        "- Không lợi dụng bug hoặc tính năng chưa hoàn thiện.\n" +
        "- Không gửi nội dung phản cảm, gây khó chịu hoặc độc hại.\n" +
        "- Tuân thủ nội quy server và hướng dẫn từ quản trị viên.\n\n" +
        "Nếu bạn gặp sự cố hoặc lỗi, hãy báo qua `/report` hoặc liên hệ với đội ngũ quản trị viên.",
      inline: false,
    })

    .setFooter({
      text: "SuperNova Citadel — Bot Help Menu | Phiên bản cập nhật mới nhất",
    })
    .setTimestamp();
}

module.exports = { createHelpEmbed };
