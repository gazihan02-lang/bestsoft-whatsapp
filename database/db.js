const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'best.db'));

// Performans için WAL mode
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS scheduled_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    chat_name TEXT,
    message TEXT NOT NULL,
    send_at DATETIME NOT NULL,
    sent INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Schema migrasyonları — sütunlar zaten varsa sessizce geç
const migrations = [
    'ALTER TABLE scheduled_messages ADD COLUMN chat_ids TEXT',
    'ALTER TABLE scheduled_messages ADD COLUMN media_path TEXT',
    'ALTER TABLE scheduled_messages ADD COLUMN media_type TEXT',
    'ALTER TABLE scheduled_messages ADD COLUMN overlay_text TEXT',
];
for (const sql of migrations) {
    try { db.exec(sql); } catch { /* sütun zaten mevcut */ }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS image_archive (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Varsayılan admin kullanıcısı (yoksa oluştur)
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
if (userCount.c === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', hash);
    console.log('✅ Varsayılan kullanıcı: admin / admin123');
}

module.exports = db;
