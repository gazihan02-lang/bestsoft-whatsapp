const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../database/db');

const ROOT = path.join(__dirname, '..');
const UPLOAD_DIR  = path.join(ROOT, 'media', 'uploads');
const ARCHIVE_DIR = path.join(ROOT, 'media', 'archive');
[UPLOAD_DIR, ARCHIVE_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

function makeStorage(dest) {
    return multer.diskStorage({
        destination: (req, file, cb) => cb(null, dest),
        filename:    (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
            cb(null, `${Date.now()}_${Math.random().toString(36).substr(2, 8)}${ext}`);
        }
    });
}
const uploadMedia   = multer({ storage: makeStorage(UPLOAD_DIR),  limits: { fileSize: 50 * 1024 * 1024 } });
const uploadArchive = multer({ storage: makeStorage(ARCHIVE_DIR), limits: { fileSize: 100 * 1024 * 1024 } });

const ALLOWED_MEDIA   = new Set(['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/quicktime','video/x-matroska','audio/mpeg','audio/mp3','audio/wav','audio/ogg','audio/aac','audio/webm','audio/x-m4a','audio/mp4']);
const ALLOWED_ARCHIVE = new Set([
    'image/jpeg','image/png','image/gif','image/webp',
    'video/mp4','video/quicktime','video/x-matroska','video/webm',
    'audio/mpeg','audio/mp3','audio/wav','audio/ogg','audio/aac','audio/webm','audio/x-m4a','audio/mp4'
]);

function archiveTypeFromMime(mime = '') {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return 'other';
}

module.exports = function (io) {
    const router = express.Router();
    const botClient = require('../bot/client');
    const { addScheduledTimeout, cancelScheduledById } = require('../commands/scheduler');

    // ── Bot durumu ────────────────────────────────────────────────
    router.get('/bot/status', (req, res) => {
        res.json(botClient.getBotStatus());
    });

    // ── Grup sayısı (önbellekten) ─────────────────────────────────
    router.get('/bot/groups', (req, res) => {
        const count = botClient.getGroupCount();
        res.json({ count: count !== null ? count : 0, ready: count !== null });
    });

    // ── Grup listesi (önbellekten) ────────────────────────────────
    router.get('/bot/group-list', (req, res) => {
        res.json(botClient.getGroupList());
    });
    // ── WhatsApp oturumunu kapat ───────────────────────────────
    router.post('/bot/wa-logout', async (req, res) => {
        try {
            await botClient.botLogout();
            if (io) io.emit('bot:status', { status: 'disconnected', message: 'WhatsApp oturumu kapatıldı' });
            // Çıkıştan sonra yeni QR üretimi için client'ı tekrar başlat.
            botClient.init(io);
            if (io) io.emit('bot:status', { status: 'initializing', message: 'Yeniden başlatılıyor' });
            db.prepare('INSERT INTO logs (type, content) VALUES (?,?)').run('warning', 'WhatsApp oturumu manuel kapatıldı');
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // ── Zamanlanmış mesajları listele ─────────────────────────────
    router.get('/scheduled', (req, res) => {
        const messages = db.prepare('SELECT * FROM scheduled_messages WHERE sent = 0 ORDER BY send_at ASC').all();
        res.json(messages);
    });

    // ── Zamanlanmış mesaj ekle (multipart/form-data) ──────────────
    router.post('/scheduled', uploadMedia.single('file'), async (req, res) => {
        const { chatIds, sendAt, message, overlayText, repeatType } = req.body;

        if (!chatIds) return res.status(400).json({ error: 'chatIds gerekli.' });
        let ids;
        try { ids = JSON.parse(chatIds); } catch { return res.status(400).json({ error: 'Geçersiz chatIds formatı.' }); }
        if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'En az bir grup/kişi seçin.' });

        // Chat ID güvenlik doğrulaması — @g.us / @c.us / @s.whatsapp.net formatlarına izin ver
        for (const id of ids) {
            if (!/^[\w\d.@:_+-]+$/.test(String(id)) || String(id).length > 100) {
                if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
                return res.status(400).json({ error: `Geçersiz chat ID: ${id}` });
            }
        }

        const sendAtDate = new Date(sendAt);
        if (isNaN(sendAtDate.getTime()) || sendAtDate.getTime() <= Date.now()) {
            if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
            return res.status(400).json({ error: 'Geçerli bir gelecek tarih/saat girin.' });
        }

        const validRepeatTypes = new Set(['none', 'daily', 'weekly', 'monthly']);
        const repeat = validRepeatTypes.has(String(repeatType || 'none')) ? String(repeatType || 'none') : 'none';

        let mediaPath = null;
        let mediaType = null;
        if (req.file) {
            if (!ALLOWED_MEDIA.has(req.file.mimetype)) {
                try { fs.unlinkSync(req.file.path); } catch {}
                return res.status(400).json({ error: 'Desteklenmeyen dosya türü.' });
            }
            mediaPath = req.file.path;
            if (req.file.mimetype.startsWith('image/')) mediaType = 'image';
            else if (req.file.mimetype.startsWith('video/')) mediaType = 'video';
            else if (req.file.mimetype.startsWith('audio/')) mediaType = 'audio';
            else mediaType = 'file';
        }

        if (!message && !mediaPath) return res.status(400).json({ error: 'Mesaj metni veya medya dosyası gerekli.' });

        const sendAtStr = sendAtDate.toISOString();
        const delayMs   = sendAtDate.getTime() - Date.now();

        const result = db.prepare(
            'INSERT INTO scheduled_messages (chat_id, chat_ids, message, send_at, media_path, media_type, overlay_text, repeat_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(ids[0], JSON.stringify(ids), message || '', sendAtStr, mediaPath, mediaType, overlayText || null, repeat);

        const newId  = result.lastInsertRowid;
        const newMsg = db.prepare('SELECT * FROM scheduled_messages WHERE id = ?').get(newId);
        const client = botClient.getClient();
        addScheduledTimeout(client, newMsg, delayMs, io);

        res.json({ success: true, data: newMsg });
    });

    // ── Zamanlanmış mesajı iptal et ───────────────────────────────
    router.delete('/scheduled/:id', (req, res) => {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Geçersiz ID.' });
        cancelScheduledById(id);
        db.prepare('DELETE FROM scheduled_messages WHERE id = ?').run(id);
        res.json({ success: true });
    });

    // ── Arşiv öğelerini listele ───────────────────────────────────
    router.get('/archive', (req, res) => {
        const type = String(req.query.type || '').trim();
        const q = String(req.query.q || '').trim().toLowerCase();
        const folder = String(req.query.folder || '').trim();

        let sql = "SELECT id, name, path, COALESCE(folder, 'Genel') AS folder, COALESCE(media_type, 'image') AS media_type, created_at FROM image_archive WHERE 1=1";
        const params = [];

        if (['image', 'video', 'audio'].includes(type)) {
            sql += " AND COALESCE(media_type, 'image') = ?";
            params.push(type);
        }
        if (folder && folder !== '__all__') {
            sql += " AND COALESCE(folder, 'Genel') = ?";
            params.push(folder);
        }
        if (q) {
            sql += " AND (LOWER(name) LIKE ? OR LOWER(COALESCE(folder, 'Genel')) LIKE ?)";
            params.push(`%${q}%`, `%${q}%`);
        }

        sql += ' ORDER BY folder ASC, created_at DESC';
        const rows = db.prepare(sql).all(...params);
        res.json(rows);
    });

    // ── Arşiv klasörlerini listele ───────────────────────────────
    router.get('/archive/folders', (req, res) => {
        const type = String(req.query.type || '').trim();
        let sql = "SELECT COALESCE(folder, 'Genel') AS folder, COUNT(*) AS count FROM image_archive";
        const params = [];
        if (['image', 'video', 'audio'].includes(type)) {
            sql += " WHERE COALESCE(media_type, 'image') = ?";
            params.push(type);
        }
        sql += " GROUP BY COALESCE(folder, 'Genel') ORDER BY folder ASC";
        const rows = db.prepare(sql).all(...params);

        const createdFolders = ['image', 'video', 'audio'].includes(type)
            ? db.prepare('SELECT name AS folder, 0 AS count FROM archive_folders WHERE media_type = ? ORDER BY name ASC').all(type)
            : db.prepare('SELECT name AS folder, 0 AS count FROM archive_folders ORDER BY name ASC').all();

        const byFolder = new Map();
        [...createdFolders, ...rows].forEach(r => {
            const key = String(r.folder || 'Genel');
            const prev = byFolder.get(key);
            byFolder.set(key, { folder: key, count: (prev?.count || 0) + (r.count || 0) });
        });

        res.json([...byFolder.values()].sort((a, b) => a.folder.localeCompare(b.folder, 'tr')));
    });

    // ── Arşiv klasörü oluştur ────────────────────────────────────
    router.post('/archive/folders', (req, res) => {
        const name = String(req.body.name || '').trim().substring(0, 60);
        const mediaType = String(req.body.mediaType || 'all').trim() || 'all';
        if (!name) return res.status(400).json({ error: 'Klasör adı zorunlu.' });
        if (!['image', 'video', 'audio', 'all'].includes(mediaType)) return res.status(400).json({ error: 'Geçersiz arşiv türü.' });

        db.prepare('INSERT OR IGNORE INTO archive_folders (name, media_type) VALUES (?, ?)').run(name, mediaType);
        res.json({ success: true });
    });

    // ── Arşive medya yükle ────────────────────────────────────────
    router.post('/archive/upload', uploadArchive.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'Dosya gerekli.' });
        if (!ALLOWED_ARCHIVE.has(req.file.mimetype)) {
            try { fs.unlinkSync(req.file.path); } catch {}
            return res.status(400).json({ error: 'Sadece görsel, video veya ses dosyası yüklenebilir.' });
        }
        const rawName = String(req.body.name || '').trim();
        if (!rawName) {
            try { fs.unlinkSync(req.file.path); } catch {}
            return res.status(400).json({ error: 'Arşive eklemek için ad zorunlu.' });
        }

        const folder  = String(req.body.folder || 'Genel').trim().substring(0, 60) || 'Genel';
        const name    = rawName.substring(0, 100);
        const webPath = '/media/archive/' + req.file.filename;
        const mediaType = archiveTypeFromMime(req.file.mimetype);
        if (!['image', 'video', 'audio'].includes(mediaType)) {
            try { fs.unlinkSync(req.file.path); } catch {}
            return res.status(400).json({ error: 'Arşiv türü desteklenmiyor.' });
        }
        db.prepare('INSERT OR IGNORE INTO archive_folders (name, media_type) VALUES (?, ?)').run(folder, mediaType);
        const result  = db.prepare('INSERT INTO image_archive (name, path, folder, media_type) VALUES (?, ?, ?, ?)').run(name, webPath, folder, mediaType);
        const newRow  = db.prepare('SELECT * FROM image_archive WHERE id = ?').get(result.lastInsertRowid);
        res.json({ success: true, data: newRow });
    });

    // ── Arşivden medya sil ────────────────────────────────────────
    router.delete('/archive/:id', (req, res) => {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Geçersiz ID.' });
        const row = db.prepare('SELECT * FROM image_archive WHERE id = ?').get(id);
        if (!row) return res.status(404).json({ error: 'Bulunamadı.' });
        try { fs.unlinkSync(path.join(ARCHIVE_DIR, path.basename(row.path))); } catch {}
        db.prepare('DELETE FROM image_archive WHERE id = ?').run(id);
        res.json({ success: true });
    });

    // ── Loglar ───────────────────────────────────────────────────
    router.get('/logs', (req, res) => {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const logs = db.prepare('SELECT * FROM logs ORDER BY created_at DESC LIMIT ?').all(limit);
        res.json(logs);
    });

    router.delete('/logs', (req, res) => {
        db.prepare('DELETE FROM logs').run();
        res.json({ success: true });
    });

    // ── Ayarlar ──────────────────────────────────────────────────
    router.get('/settings', (req, res) => {
        const rows = db.prepare('SELECT * FROM settings').all();
        const obj = {};
        rows.forEach(r => (obj[r.key] = r.value));
        res.json(obj);
    });

    router.post('/settings', (req, res) => {
        const { key, value } = req.body;
        if (!key) return res.status(400).json({ error: 'key gerekli.' });
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
        res.json({ success: true });
    });

    return router;
};
