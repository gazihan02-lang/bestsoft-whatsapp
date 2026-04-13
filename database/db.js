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
    repeat_type TEXT DEFAULT 'none',
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
  "ALTER TABLE scheduled_messages ADD COLUMN repeat_type TEXT DEFAULT 'none'",
  "ALTER TABLE image_archive ADD COLUMN folder TEXT DEFAULT 'Genel'",
  "ALTER TABLE image_archive ADD COLUMN media_type TEXT DEFAULT 'image'",
];
for (const sql of migrations) {
    try { db.exec(sql); } catch { /* sütun zaten mevcut */ }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS image_archive (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    folder TEXT DEFAULT 'Genel',
    media_type TEXT DEFAULT 'image',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS archive_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    media_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, media_type)
  );
`);

try { db.exec("UPDATE image_archive SET media_type = 'image' WHERE media_type IS NULL OR media_type = ''"); } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS group_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    group_ids TEXT NOT NULL,
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
