require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const groupCommands = require('./commands/group');
const mediaCommands = require('./commands/media');
const { initScheduler } = require('./commands/scheduler');
const { isAdmin, isOwner, parseCommand } = require('./utils/helpers');

const PREFIX = process.env.BOT_PREFIX || '!';

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: process.env.SESSION_PATH || './.wwebjs_auth'
    }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// QR Kodu terminalde göster
client.on('qr', (qr) => {
    console.log('\n🔗 QR Kodu tarayın:\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log(`\n✅ ${process.env.BOT_NAME || 'WhatsApp Bot'} hazır!\n`);
    initScheduler(client);
});

client.on('auth_failure', () => {
    console.error('❌ Kimlik doğrulama başarısız. Lütfen tekrar deneyin.');
});

client.on('disconnected', (reason) => {
    console.log('⚠️ Bağlantı kesildi:', reason);
});

// Gelen mesajları işle
client.on('message', async (message) => {
    try {
        // Sadece prefix ile başlayan mesajları işle
        if (!message.body.startsWith(PREFIX)) return;

        const { command, args } = parseCommand(message.body, PREFIX);
        const chat = await message.getChat();
        const contact = await message.getContact();

        // Komut yönlendirme
        switch (command) {
            // --- Yardım ---
            case 'yardim':
            case 'help':
            case 'komutlar':
                await sendHelp(message);
                break;

            // --- Grup Komutları ---
            case 'kick':
            case 'at':
                await groupCommands.kickMember(client, message, chat, args);
                break;

            case 'promote':
            case 'admin':
                await groupCommands.promoteMember(client, message, chat, args);
                break;

            case 'demote':
            case 'unadmin':
                await groupCommands.demoteMember(client, message, chat, args);
                break;

            case 'grupbilgi':
            case 'ginfo':
                await groupCommands.groupInfo(message, chat);
                break;

            case 'herkesiaç':
            case 'acik':
                await groupCommands.openGroup(message, chat);
                break;

            case 'herkesikapat':
            case 'kapali':
                await groupCommands.closeGroup(message, chat);
                break;

            case 'uyeler':
            case 'members':
                await groupCommands.listMembers(message, chat);
                break;

            // --- Medya Komutları ---
            case 'resim':
            case 'gorsel':
                await mediaCommands.sendImage(client, message, args);
                break;

            case 'sticker':
                await mediaCommands.makeSticker(client, message);
                break;

            // --- Zamanlanmış Mesaj ---
            case 'zamanlamesaj':
            case 'schedule':
                await require('./commands/scheduler').scheduleMessage(client, message, args);
                break;

            case 'zamanlilistele':
            case 'schedulelist':
                await require('./commands/scheduler').listScheduled(message);
                break;

            case 'zamanliiptal':
            case 'schedulecancel':
                await require('./commands/scheduler').cancelScheduled(message, args);
                break;

            default:
                await message.reply(`❓ Bilinmeyen komut: *${command}*\n${PREFIX}yardim yazarak komutları görebilirsiniz.`);
        }
    } catch (error) {
        console.error('Mesaj işleme hatası:', error);
    }
});

async function sendHelp(message) {
    const help = `
*🤖 ${process.env.BOT_NAME || 'WhatsApp Bot'} Komutları*
Prefix: \`${PREFIX}\`

*👥 Grup Yönetimi*
• \`${PREFIX}kick @kullanici\` — Üyeyi gruptan at
• \`${PREFIX}admin @kullanici\` — Admin yap
• \`${PREFIX}unadmin @kullanici\` — Adminliği al
• \`${PREFIX}grupbilgi\` — Grup bilgilerini göster
• \`${PREFIX}uyeler\` — Üyeleri listele
• \`${PREFIX}acik\` — Grubu herkese aç
• \`${PREFIX}kapali\` — Grubu sadece adminlere kapat

*🖼️ Medya*
• \`${PREFIX}sticker\` — Resmi sticker yap (resme cevap ver)

*⏰ Zamanlanmış Mesaj*
• \`${PREFIX}schedule <dakika> <mesaj>\` — Dakika sonra mesaj gönder
• \`${PREFIX}schedulelist\` — Zamanlanmış mesajları listele
• \`${PREFIX}schedulecancel <id>\` — Zamanlanmış mesajı iptal et
    `.trim();

    await message.reply(help);
}

client.initialize();
