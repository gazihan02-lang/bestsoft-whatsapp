/**
 * Bir kullanıcının grupta admin olup olmadığını kontrol eder
 * @param {GroupChat} chat - Grup chat objesi
 * @param {string} userId - Kullanıcı ID'si (_serialized formatında)
 * @returns {boolean}
 */
function isAdmin(chat, userId) {
    if (!chat.isGroup) return false;
    const participant = chat.participants.find(p => p.id._serialized === userId);
    return participant ? (participant.isAdmin || participant.isSuperAdmin) : false;
}

/**
 * Mesajın sahip numarasından gelip gelmediğini kontrol eder
 * @param {Message} message
 * @returns {boolean}
 */
function isOwner(message) {
    const owner = process.env.OWNER_NUMBER;
    if (!owner) return false;
    return message.from === owner || message.author === owner;
}

/**
 * Gelen mesajı komut ve argümanlara böler
 * @param {string} body - Mesaj içeriği
 * @param {string} prefix - Komut prefixi (örn: !)
 * @returns {{ command: string, args: string[] }}
 */
function parseCommand(body, prefix) {
    const withoutPrefix = body.slice(prefix.length).trim();
    const parts = withoutPrefix.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    return { command, args };
}

module.exports = { isAdmin, isOwner, parseCommand };
