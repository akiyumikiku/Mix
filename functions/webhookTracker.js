const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "webhookActivity.json");

function loadData() {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function resetIfNeeded(record) {
    const today = new Date().toISOString().slice(0, 10);
    if (record.lastReset !== today) {
        record.totalActiveMsToday = 0;
        record.warnCount = 0;
        record.lastReset = today;
    }
}

module.exports.updateWebhookActivity = function (webhookId) {
    const data = loadData();

    if (!data[webhookId]) {
        data[webhookId] = {
            totalActiveMsToday: 0,
            lastMessageAt: 0,
            warnCount: 0,
            lastReset: new Date().toISOString().slice(0, 10)
        };
    }

    const record = data[webhookId];
    resetIfNeeded(record);

    const now = Date.now();

    if (record.lastMessageAt > 0) {
        const diff = now - record.lastMessageAt;
        if (diff < 5 * 60 * 1000) {
            record.totalActiveMsToday += diff;
        }
    }

    record.lastMessageAt = now;
    saveData(data);
};

module.exports.checkWebhookWarnings = async function (
    client,
    warnChannelId,
    sleepCategoryId
) {
    const data = loadData();
    const warnChannel = client.channels.cache.get(warnChannelId);

    for (const [webhookId, record] of Object.entries(data)) {
        resetIfNeeded(record);

        const hours = record.totalActiveMsToday / 1000 / 60 / 60;

        if (hours >= 6) continue;

        record.warnCount++;

        await warnChannel?.send(
            `⚠️ Webhook **${webhookId}** chỉ chạy **${hours.toFixed(
                2
            )}h/6h** hôm nay \n→ Cảnh cáo **${record.warnCount}/2**`
        );

        if (record.warnCount >= 2) {
            const channel = client.channels.cache.find(
                (c) => c.isTextBased() && c.lastWebhookId === webhookId
            );

            if (channel) {
                await channel.setParent(sleepCategoryId).catch(() => {});
                await warnChannel?.send(
                    `😴 Kênh **${channel.name}** bị chuyển về danh mục ngủ do webhook không đủ giờ hoạt động!`
                );
            }

            record.warnCount = 0;
        }
    }

    saveData(data);
};
