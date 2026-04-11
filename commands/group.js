const { isAdmin, isOwner } = require('../utils/helpers');

/**
 * Üyeyi gruptan atar
 * Kullanım: !kick @kullanici
 */
async function kickMember(client, message, chat, args) {
    if (!chat.isGroup) return message.reply('❌ Bu komut sadece gruplarda kullanılabilir.');

    const botId = client.info.wid._serialized;
    const botIsAdmin = await isAdmin(chat, botId);
    if (!botIsAdmin) return message.reply('❌ Bot admin değil, bu işlemi yapamam.');

    const senderIsAdmin = await isAdmin(chat, message.author);
    if (!senderIsAdmin) return message.reply('❌ Bu komutu sadece adminler kullanabilir.');

    const mentioned = await message.getMentions();
    if (!mentioned.length) return message.reply(`❌ Kullanım: !kick @kullanici`);

    for (const contact of mentioned) {
        try {
            await chat.removeParticipants([contact.id._serialized]);
            await message.reply(`✅ ${contact.pushname || contact.number} gruptan atıldı.`);
        } catch {
            await message.reply(`❌ ${contact.pushname || contact.number} atılamadı.`);
        }
    }
}

/**
 * Üyeyi admin yapar
 * Kullanım: !admin @kullanici
 */
async function promoteMember(client, message, chat, args) {
    if (!chat.isGroup) return message.reply('❌ Bu komut sadece gruplarda kullanılabilir.');

    const botId = client.info.wid._serialized;
    const botIsAdmin = await isAdmin(chat, botId);
    if (!botIsAdmin) return message.reply('❌ Bot admin değil, bu işlemi yapamam.');

    const senderIsAdmin = await isAdmin(chat, message.author);
    if (!senderIsAdmin) return message.reply('❌ Bu komutu sadece adminler kullanabilir.');

    const mentioned = await message.getMentions();
    if (!mentioned.length) return message.reply(`❌ Kullanım: !admin @kullanici`);

    for (const contact of mentioned) {
        try {
            await chat.promoteParticipants([contact.id._serialized]);
            await message.reply(`✅ ${contact.pushname || contact.number} admin yapıldı.`);
        } catch {
            await message.reply(`❌ ${contact.pushname || contact.number} admin yapılamadı.`);
        }
    }
}

/**
 * Adminliği alır
 * Kullanım: !unadmin @kullanici
 */
async function demoteMember(client, message, chat, args) {
    if (!chat.isGroup) return message.reply('❌ Bu komut sadece gruplarda kullanılabilir.');

    const botId = client.info.wid._serialized;
    const botIsAdmin = await isAdmin(chat, botId);
    if (!botIsAdmin) return message.reply('❌ Bot admin değil, bu işlemi yapamam.');

    const senderIsAdmin = await isAdmin(chat, message.author);
    if (!senderIsAdmin) return message.reply('❌ Bu komutu sadece adminler kullanabilir.');

    const mentioned = await message.getMentions();
    if (!mentioned.length) return message.reply(`❌ Kullanım: !unadmin @kullanici`);

    for (const contact of mentioned) {
        try {
            await chat.demoteParticipants([contact.id._serialized]);
            await message.reply(`✅ ${contact.pushname || contact.number} adminlikten alındı.`);
        } catch {
            await message.reply(`❌ ${contact.pushname || contact.number} adminlikten alınamadı.`);
        }
    }
}

/**
 * Grup bilgilerini gösterir
 */
async function groupInfo(message, chat) {
    if (!chat.isGroup) return message.reply('❌ Bu komut sadece gruplarda kullanılabilir.');

    const admins = chat.participants.filter(p => p.isAdmin || p.isSuperAdmin);
    const info = `
*📊 Grup Bilgisi*
• *Ad:* ${chat.name}
• *Üye Sayısı:* ${chat.participants.length}
• *Admin Sayısı:* ${admins.length}
• *Oluşturulma:* ${new Date(chat.createdAt * 1000).toLocaleDateString('tr-TR')}
    `.trim();

    await message.reply(info);
}

/**
 * Grubu herkese açar (mesaj gönderebilir)
 */
async function openGroup(message, chat) {
    if (!chat.isGroup) return message.reply('❌ Bu komut sadece gruplarda kullanılabilir.');

    const senderIsAdmin = await isAdmin(chat, message.author);
    if (!senderIsAdmin) return message.reply('❌ Bu komutu sadece adminler kullanabilir.');

    try {
        await chat.setMessagesAdminsOnly(false);
        await message.reply('✅ Grup açıldı. Artık herkes mesaj gönderebilir.');
    } catch {
        await message.reply('❌ Grup ayarı değiştirilemedi.');
    }
}

/**
 * Grubu sadece adminlere kapatır
 */
async function closeGroup(message, chat) {
    if (!chat.isGroup) return message.reply('❌ Bu komut sadece gruplarda kullanılabilir.');

    const senderIsAdmin = await isAdmin(chat, message.author);
    if (!senderIsAdmin) return message.reply('❌ Bu komutu sadece adminler kullanabilir.');

    try {
        await chat.setMessagesAdminsOnly(true);
        await message.reply('🔒 Grup kapatıldı. Sadece adminler mesaj gönderebilir.');
    } catch {
        await message.reply('❌ Grup ayarı değiştirilemedi.');
    }
}

/**
 * Grup üyelerini listeler
 */
async function listMembers(message, chat) {
    if (!chat.isGroup) return message.reply('❌ Bu komut sadece gruplarda kullanılabilir.');

    const members = chat.participants;
    let list = `*👥 Grup Üyeleri (${members.length})*\n\n`;

    for (const member of members) {
        const role = member.isSuperAdmin ? '👑' : member.isAdmin ? '🔧' : '👤';
        const number = member.id.user;
        list += `${role} +${number}\n`;
    }

    await message.reply(list.trim());
}

module.exports = {
    kickMember,
    promoteMember,
    demoteMember,
    groupInfo,
    openGroup,
    closeGroup,
    listMembers
};
