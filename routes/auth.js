const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');

const router = express.Router();

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
    if (!user) {
        return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
        return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true });
});

router.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

router.post('/change-username', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Oturum açın.' });

    const { newUsername, password } = req.body;
    if (!newUsername || newUsername.trim().length < 3) {
        return res.status(400).json({ error: 'Kullanıcı adı en az 3 karakter olmalı.' });
    }
    const clean = newUsername.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (clean !== newUsername.trim()) {
        return res.status(400).json({ error: 'Sadece harf, rakam ve _ kullanabilirsiniz.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Şifre hatalı.' });

    const exists = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(clean, req.session.userId);
    if (exists) return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' });

    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(clean, req.session.userId);
    req.session.username = clean;
    res.json({ success: true, username: clean });
});

router.post('/change-password', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Oturum açın.' });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Geçerli şifreler girin (en az 6 karakter).' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Mevcut şifre hatalı.' });

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.session.userId);
    res.json({ success: true });
});

module.exports = router;
