require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const db = require('../database/db');
const fs = require('fs');
const path = require('path');

const groupCommands = require('../commands/group');
const mediaCommands = require('../commands/media');
const { initScheduler, scheduleMessage, listScheduled, cancelScheduled } = require('../commands/scheduler');
const { parseCommand } = require('../utils/helpers');

const PREFIX = process.env.BOT_PREFIX || '!';

// ─── Bot instance factory ─────────────────────────────────────────────────────
// botId = 'bot'  → events: bot:status, bot:qr, bot:ready, bot:groups, bot:message
// botId = 'bot2' → events: bot2:status, bot2:qr, bot2:ready, bot2:groups, bot2:message

function createBotInstance(botId) {
    let io = null;
    let client = null;
    let botStatus = 'disconnected';
    let botInfo = null;
    let lastQrDataUrl = null;
    let groupCount = null;
    let groupList = [];

    const ev = (name) => `${botId}:${name}`;
    const isPrimary = botId === 'bot';

    function getBotStatus() { return { status: botStatus, info: botInfo }; }
    function getLastQr()    { return lastQrDataUrl; }
    function getClient()    { return client; }
    function getGroupCount(){ return groupCount; }
    function getGroupList() { return groupList; }

    function log(type, content) {
        try {
            const prefix = isPrimary ? '' : `[${botId}] `;
            db.prepare('INSERT INTO logs (type, content) VALUES (?, ?)').run(type, prefix + content);
        } catch (e) { /* silent */ }
    }

    function clearSessionLocks(dataPath) {
        const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'DevToolsActivePort'];
        const sessionDir = path.join(dataPath, 'session');
        for (const f of lockFiles) {
            try { fs.rmSync(path.join(sessionDir, f), { force: true }); } catch {}
        }
    }

    function init(socketIo) {
        io = socketIo;

        const envKey = isPrimary ? 'SESSION_PATH' : 'SESSION_PATH2';
        const defaultPath = isPrimary ? './.wwebjs_auth' : './.wwebjs_auth2';
        const dataPath = process.env[envKey] || defaultPath;
        clearSessionLocks(dataPath);

        client = new Client({
            authStrategy: new LocalAuth({ dataPath }),
            puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox', '--no-first-run', '--no-default-browser-check'] }
        });

        botStatus = 'initializing';

        client.on('qr', async (qr) => {
            botStatus = 'qr_pending';
            qrcode.generate(qr, { small: true });
            try {
                lastQrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
                io.emit(ev('qr'), lastQrDataUrl);
            } catch { io.emit(ev('qr'), null); }
            io.emit(ev('status'), { status: 'qr_pending', message: 'QR Kodu bekleniyor' });
            log('info', 'QR kodu oluşturuldu');
        });

        client.on('ready', () => {
            botStatus = 'connected';
            lastQrDataUrl = null;
            botInfo = { name: client.info.pushname, number: client.info.wid.user };
            console.log(`\n✅ [${botId}] ${process.env.BOT_NAME || 'WhatsApp Bot'} hazır! (${botInfo.number})`);
            io.emit(ev('ready'), { status: 'connected', ...botInfo });
            io.emit(ev('status'), { status: 'connected', message: `Bağlandı: ${botInfo.number}` });
            if (isPrimary) initScheduler(client, io);
            log('success', `Bot bağlandı: ${botInfo.number}`);
            client.getChats().then(chats => {
                const groups = chats.filter(c => c.isGroup);
                groupCount = groups.length;
                groupList = groups.map(c => ({ id: c.id._serialized, name: c.name || c.id._serialized }));
                io.emit(ev('groups'), { count: groupCount, list: groupList });
                log('info', `Grup sayısı güncellendi: ${groupCount}`);
            }).catch(() => {});
        });

        client.on('auth_failure', () => {
            botStatus = 'error';
            io.emit(ev('status'), { status: 'error', message: 'Kimlik doğrulama başarısız' });
            log('error', 'Kimlik doğrulama başarısız');
        });

        client.on('disconnected', (reason) => {
            botStatus = 'disconnected';
            botInfo = null;
            groupCount = null;
            groupList = [];
            io.emit(ev('status'), { status: 'disconnected', message: 'Bağlantı kesildi' });
            log('warning', `Bot bağlantısı kesildi: ${reason}`);
        });

        client.on('message', async (message) => {
            try {
                log('message', `[${message.from}] ${message.body.substring(0, 120)}`);
                io.emit(ev('message'), { from: message.from, body: message.body, ts: Date.now() });

                if (!message.body.startsWith(PREFIX)) return;

                const { command, args } = parseCommand(message.body, PREFIX);
                const chat = await message.getChat();

                switch (command) {
                    case 'yardim': case 'help': case 'komutlar':
                        await sendHelp(message); break;
                    case 'kick': case 'at':
                        await groupCommands.kickMember(client, message, chat, args); break;
                    case 'promote': case 'admin':
                        await groupCommands.promoteMember(client, message, chat, args); break;
                    case 'demote': case 'unadmin':
                        await groupCommands.demoteMember(client, message, chat, args); break;
                    case 'grupbilgi': case 'ginfo':
                        await groupCommands.groupInfo(message, chat); break;
                    case 'acik':
                        await groupCommands.openGroup(message, chat); break;
                    case 'kapali':
                        await groupCommands.closeGroup(message, chat); break;
                    case 'uyeler': case 'members':
                        await groupCommands.listMembers(message, chat); break;
                    case 'sticker':
                        await mediaCommands.makeSticker(client, message); break;
                    case 'schedule': case 'zamanlamesaj':
                        if (isPrimary) await scheduleMessage(client, message, args); break;
                    case 'schedulelist': case 'zamanlilistele':
                        if (isPrimary) await listScheduled(message); break;
                    case 'schedulecancel': case 'zamanliiptal':
                        if (isPrimary) await cancelScheduled(message, args); break;
                    default:
                        await message.reply(`❓ Bilinmeyen komut: *${command}*\n${PREFIX}yardim yazarak komutları görebilirsiniz.`);
                }
            } catch (err) {
                console.error(`[${botId}] Mesaj işleme hatası:`, err);
                log('error', `Mesaj hatası: ${err.message}`);
            }
        });

        client.initialize().catch((err) => {
            console.error(`[${botId}] Bot başlatma hatası:`, err.message);
            botStatus = 'error';
            if (io) io.emit(ev('status'), { status: 'error', message: 'Başlatma hatası: ' + err.message });
            log('error', 'Bot başlatma hatası: ' + err.message);
            clearSessionLocks(dataPath);
            console.log(`[${botId}] 5 saniye sonra yeniden denenecek...`);
            setTimeout(() => init(io), 5000);
        });
    }

    async function sendHelp(message) {
        await message.reply(
            `*🤖 ${process.env.BOT_NAME || 'WhatsApp Bot'} Komutları*\nPrefix: \`${PREFIX}\`\n\n` +
            `*👥 Grup*\n• \`${PREFIX}kick @k\` • \`${PREFIX}admin @k\` • \`${PREFIX}unadmin @k\`\n• \`${PREFIX}grupbilgi\` • \`${PREFIX}uyeler\` • \`${PREFIX}acik\` • \`${PREFIX}kapali\`\n\n` +
            `*🖼️ Medya*\n• \`${PREFIX}sticker\` — Resme cevap vererek sticker yap\n\n` +
            `*⏰ Zamanlama*\n• \`${PREFIX}schedule <dk> <mesaj>\`\n• \`${PREFIX}schedulelist\`\n• \`${PREFIX}schedulecancel <id>\``
        );
    }

    async function botLogout() {
        if (client) {
            try { await client.logout(); } catch {}
            try { await client.destroy(); } catch {}
        }
        botStatus = 'disconnected';
        botInfo = null;
        groupCount = null;
        groupList = [];
        lastQrDataUrl = null;
        client = null;
    }

    return { init, getBotStatus, getLastQr, getClient, getGroupCount, getGroupList, botLogout };
}

// ─── Instance registry ────────────────────────────────────────────────────────
const _instances = {};

function getInstance(botId) {
    if (!_instances[botId]) {
        _instances[botId] = createBotInstance(botId);
    }
    return _instances[botId];
}

// Primary bot (backward-compat flat exports)
const _primary = getInstance('bot');

module.exports = {
    // backward compat
    init:         _primary.init,
    getBotStatus: _primary.getBotStatus,
    getLastQr:    _primary.getLastQr,
    getGroupCount:_primary.getGroupCount,
    getGroupList: _primary.getGroupList,
    getClient:    _primary.getClient,
    botLogout:    _primary.botLogout,
    // multi-bot
    getInstance,
    createBotInstance,
};
