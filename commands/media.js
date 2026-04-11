const { MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

/**
 * Bir resmi sticker'a dönüştürür
 * Kullanım: Bir resme cevap vererek !sticker yaz
 */
async function makeSticker(client, message) {
    const quoted = await message.getQuotedMessage();

    if (!quoted || !quoted.hasMedia) {
        return message.reply('❌ Sticker yapmak için bir *resme cevap* vererek komutu kullan.\nÖrnek: Resme cevap ver → !sticker');
    }

    const media = await quoted.downloadMedia();

    if (!media || !media.mimetype.startsWith('image/')) {
        return message.reply('❌ Sadece resimlerden sticker yapılabilir.');
    }

    await client.sendMessage(message.from, media, {
        sendMediaAsSticker: true,
        stickerName: process.env.BOT_NAME || 'BestApp',
        stickerAuthor: 'BestApp Bot'
    });
}

/**
 * Yerel bir resim dosyası gönderir
 * Kullanım: !resim dosyaadi.jpg [açıklama]
 */
async function sendImage(client, message, args) {
    if (!args.length) {
        return message.reply('❌ Kullanım: !resim <dosya_adı> [açıklama]\nÖrnek: !resim foto.jpg Merhaba!');
    }

    const fileName = args[0];
    const caption = args.slice(1).join(' ') || '';
    const mediaDir = path.join(__dirname, '..', 'media');
    const filePath = path.join(mediaDir, fileName);

    // Güvenlik: path traversal engelle
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(mediaDir);
    if (!resolvedPath.startsWith(resolvedDir)) {
        return message.reply('❌ Geçersiz dosya yolu.');
    }

    if (!fs.existsSync(filePath)) {
        return message.reply(`❌ Dosya bulunamadı: ${fileName}\nDosyaları /media klasörüne ekleyin.`);
    }

    try {
        const media = MessageMedia.fromFilePath(filePath);
        await client.sendMessage(message.from, media, { caption });
    } catch {
        await message.reply('❌ Dosya gönderilemedi.');
    }
}

module.exports = { makeSticker, sendImage };
