const moment = require('moment');
const path = require('path');
const db = require('../database/db');
const { MessageMedia } = require('whatsapp-web.js');

// Aktif timeout'ları bellekte tut: id -> timeout handle
const activeTimeouts = new Map();

function getNextSendAt(currentIso, repeatType) {
    const base = new Date(currentIso);
    if (isNaN(base.getTime())) return null;

    const next = new Date(base);
    if (repeatType === 'daily') next.setDate(next.getDate() + 1);
    else if (repeatType === 'weekly') next.setDate(next.getDate() + 7);
    else if (repeatType === 'monthly') next.setMonth(next.getMonth() + 1);
    else return null;

    // Sunucu gecikmişse gelecekteki ilk zamana kadar ilerlet
    while (next.getTime() <= Date.now()) {
        if (repeatType === 'daily') next.setDate(next.getDate() + 1);
        else if (repeatType === 'weekly') next.setDate(next.getDate() + 7);
        else if (repeatType === 'monthly') next.setMonth(next.getMonth() + 1);
        else break;
    }
    return next;
}

/**
 * Bot başladığında veritabanındaki bekleyen mesajları yükler
 */
function initScheduler(client, io = null) {
    const pending = db.prepare('SELECT * FROM scheduled_messages WHERE sent = 0').all();
    const now = Date.now();

    for (const msg of pending) {
        const sendAt = new Date(msg.send_at).getTime();
        const delay = Math.max(sendAt - now, 0);
        addScheduledTimeout(client, msg, delay, io);
    }

    console.log(`⏰ ${pending.length} bekleyen zamanlanmış mesaj yüklendi.`);
}

// setTimeout maksimum ~24.8 gün destekler (2^31-1 ms).
// Daha uzun gecikmeler için özyinelemeli bekleme.
const MAX_TIMEOUT_MS = 2_000_000_000; // ~23.1 gün, güvenli alt sınır

function safeSetTimeout(fn, delayMs) {
    if (delayMs > MAX_TIMEOUT_MS) {
        return setTimeout(() => {
            safeSetTimeout(fn, delayMs - MAX_TIMEOUT_MS);
        }, MAX_TIMEOUT_MS);
    }
    return setTimeout(fn, delayMs);
}

/**
 * Belirli bir gecikme sonra mesaj gönderir ve DB'yi günceller.
 * msgObj: { id, chat_id, chat_ids, message, media_path, media_type }
 */
function addScheduledTimeout(client, msgObj, delayMs, io = null) {
    const id = msgObj.id;

    const handle = safeSetTimeout(async () => {
        try {
            if (client) {
                // Hedef chat ID'lerini parse et
                let targets = [];
                if (msgObj.chat_ids) {
                    try { targets = JSON.parse(msgObj.chat_ids); } catch {}
                }
                if (!targets.length) targets = [msgObj.chat_id];

                for (const chatId of targets) {
                    if (msgObj.media_path) {
                        const media = MessageMedia.fromFilePath(msgObj.media_path);
                        if (msgObj.media_type === 'audio') {
                            await client.sendMessage(chatId, media, { sendAudioAsVoice: true });
                            if (msgObj.message) await client.sendMessage(chatId, msgObj.message);
                        } else {
                            await client.sendMessage(chatId, media, { caption: msgObj.message || '' });
                        }
                    } else {
                        await client.sendMessage(chatId, msgObj.message || '');
                    }
                }
            }

            const repeatType = msgObj.repeat_type || 'none';
            if (repeatType !== 'none') {
                const nextAt = getNextSendAt(msgObj.send_at, repeatType);
                if (nextAt) {
                    const nextIso = nextAt.toISOString();
                    db.prepare('UPDATE scheduled_messages SET send_at = ? WHERE id = ?').run(nextIso, id);
                    msgObj.send_at = nextIso;
                    const nextDelay = Math.max(nextAt.getTime() - Date.now(), 0);
                    addScheduledTimeout(client, msgObj, nextDelay, io);
                }
            } else {
                db.prepare('UPDATE scheduled_messages SET sent = 1 WHERE id = ?').run(id);
                activeTimeouts.delete(id);
            }

            if (io) io.emit('schedule:sent', { id });
        } catch (err) {
            console.error(`Zamanlanmış mesaj #${id} gönderilemedi:`, err.message);
        } finally {
            if ((msgObj.repeat_type || 'none') === 'none') activeTimeouts.delete(id);
        }
    }, Math.max(delayMs, 0));

    activeTimeouts.set(id, handle);
}

/**
 * Zamanlanmış mesajı ID ile iptal eder
 */
function cancelScheduledById(id) {
    const handle = activeTimeouts.get(id);
    if (handle) {
        clearTimeout(handle);
        activeTimeouts.delete(id);
    }
}

/**
 * WhatsApp komutu: !schedule <dakika> <mesaj>
 */
async function scheduleMessage(client, message, args) {
    if (args.length < 2) {
        return message.reply('❌ Kullanım: !schedule <dakika> <mesaj>\nÖrnek: !schedule 10 Toplantı başlıyor!');
    }

    const minutes = parseInt(args[0]);
    if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
        return message.reply('❌ Geçerli bir dakika girin (1–1440 arası).');
    }

    const messageText = args.slice(1).join(' ');
    const chatId = message.from;
    const sendAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

    const result = db.prepare(
        'INSERT INTO scheduled_messages (chat_id, message, send_at) VALUES (?, ?, ?)'
    ).run(chatId, messageText, sendAt);

    const newId = result.lastInsertRowid;
    const newMsg = db.prepare('SELECT * FROM scheduled_messages WHERE id = ?').get(newId);
    addScheduledTimeout(client, newMsg, minutes * 60 * 1000);

    await message.reply(
        `✅ Mesaj zamanlandı!\n` +
        `• *ID:* ${newId}\n` +
        `• *Gönderilecek:* ${moment(sendAt).format('DD.MM.YYYY HH:mm')}\n` +
        `• *Mesaj:* ${messageText}\n\n` +
        `İptal için: !schedulecancel ${newId}`
    );
}

/**
 * WhatsApp komutu: !schedulelist
 */
async function listScheduled(message) {
    const msgs = db.prepare('SELECT * FROM scheduled_messages WHERE sent = 0 ORDER BY send_at ASC').all();

    if (!msgs.length) return message.reply('📋 Aktif zamanlanmış mesaj bulunmuyor.');

    let list = '*⏰ Aktif Zamanlanmış Mesajlar*\n\n';
    for (const m of msgs) {
        list += `• *ID ${m.id}* — ${moment(m.send_at).format('DD.MM.YYYY HH:mm')}\n  📝 ${m.message}\n\n`;
    }
    list += 'İptal için: !schedulecancel <id>';
    await message.reply(list.trim());
}

/**
 * WhatsApp komutu: !schedulecancel <id>
 */
async function cancelScheduled(message, args) {
    const id = parseInt(args[0]);
    if (isNaN(id)) return message.reply('❌ Kullanım: !schedulecancel <id>');

    const msg = db.prepare('SELECT * FROM scheduled_messages WHERE id = ? AND sent = 0').get(id);
    if (!msg) return message.reply(`❌ ID ${id} ile bekleyen mesaj bulunamadı.`);

    cancelScheduledById(id);
    db.prepare('DELETE FROM scheduled_messages WHERE id = ?').run(id);

    await message.reply(`✅ Zamanlanmış mesaj #${id} iptal edildi.`);
}

module.exports = {
    initScheduler,
    addScheduledTimeout,
    cancelScheduledById,
    scheduleMessage,
    listScheduled,
    cancelScheduled
};
