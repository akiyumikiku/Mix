// Sol's Stat Tracker - Compact Version
// WebSocket client kết nối với Sol's Stat Tracker và gửi webhook Discord

const WebSocket = require('ws');
const { WebhookClient, EmbedBuilder } = require('discord.js');
const express = require('express');

// ==================== CẤU HÌNH ====================
const CONFIG = {
    token: "WpwmZI1ZPezNQKTi*l!5bRfmluKsHGut8Aku1yWhhnlVODqWc*QT0jPHK0xUPt!0GMA3hfbTnTmqb7$&IK5wCD^@qGIcYR@$m@H80e5g$70lB2EC#ws#3CfbRfw#RCI^",
    webhookURL: "https://discord.com/api/webhooks/1433114031216136306/W8wvWjvinHESE8mo1I30IGrijEIZEx6fqX55Cx9LmRP6S1ZUzkfHH0Hsgm1JaNTiApPj",
    gatewayURL: "wss://api.mongoosee.com/solsstattracker/v2/gateway",
    port: process.env.PORT || 3000,
    colors: { success: "#6ab183", error: "#d85a4b", none: "#777f8d" },
    emojis: { 
        success: "<:green_tick:1365702693326422026>",
        error: "<:red_tick:1365702694727188491>",
        none: "<:gray_tick:1365702690985738390>"
    }
};

// ==================== KHỞI TẠO ====================
const webhook = new WebhookClient({ url: CONFIG.webhookURL });
let reconnectDelay = 31000;
const MAX_RECONNECT_DELAY = 120000;

// ==================== EXPRESS SERVER (KEEP-ALIVE) ====================
const app = express();
app.get('/', (req, res) => res.send('✅ Sol\'s Stat Tracker is running!'));
app.listen(CONFIG.port, () => console.log(`🌐 Server running on port ${CONFIG.port}`));

// ==================== WEBSOCKET CONNECTION ====================
function connect() {
    const ws = new WebSocket(CONFIG.gatewayURL, { 
        headers: { token: CONFIG.token } 
    });

    ws.on('open', () => {
        console.log(`✅ Connected to ${CONFIG.gatewayURL}`);
        reconnectDelay = 31000;
        
        setTimeout(() => {
            if (ws.readyState === ws.OPEN) {
                sendEmbed('success', '**Sol\'s Stat Tracker** - Connected');
            }
        }, 1000);
    });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString('utf8'));
            handleMessage(msg);
        } catch (err) {
            console.error(`❌ Message error: ${err.message}`);
        }
    });

    ws.on('close', (code, reason) => {
        reason = reason.toString('utf8');
        console.warn(`⚠️ Disconnected: Code ${code}${reason ? ` - ${reason}` : ''}`);
        handleClose(code);
    });

    ws.on('error', (err) => {
        console.error(`❌ WebSocket error: ${err.message}`);
        ws.terminate();
    });
}

// ==================== MESSAGE HANDLER ====================
function handleMessage(msg) {
    switch (msg.action) {
        case 'enabled':
            sendEmbed('success', '**Sol\'s Stat Tracker** - Enabled');
            break;
        case 'disabled':
            sendEmbed('error', '**Sol\'s Stat Tracker** - Disabled');
            break;
        case 'executeWebhook':
            msg.data.allowedMentions = { parse: [] };
            webhook.send(msg.data);
            break;
        default:
            console.error(`❌ Invalid action: ${msg.action}`);
    }
}

// ==================== CLOSE CODE HANDLER ====================
function handleClose(code) {
    const errorMessages = {
        4001: 'API token is missing',
        4002: 'API token is invalid',
        4004: 'API token has been deleted',
        4003: 'API token is already in-use'
    };

    if (errorMessages[code]) {
        console.error(`❌ ${errorMessages[code]}`);
        sendEmbed('error', `**Sol\'s Stat Tracker** - ${errorMessages[code]}`);
        if (code !== 4003) return; // Không reconnect nếu lỗi token
    }

    // Reconnect với exponential backoff
    console.log(`🔄 Reconnecting in ${reconnectDelay}ms...`);
    sendEmbed('none', '**Sol\'s Stat Tracker** - Reconnecting');
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(MAX_RECONNECT_DELAY, reconnectDelay * 2);
}

// ==================== HELPER ====================
function sendEmbed(type, description) {
    const embed = new EmbedBuilder()
        .setDescription(`${CONFIG.emojis[type]} ${description}`)
        .setColor(CONFIG.colors[type]);
    webhook.send({ embeds: [embed] }).catch(console.error);
}

// ==================== START ====================
connect();
console.log('🚀 Sol\'s Stat Tracker started!');
