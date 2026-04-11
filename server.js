require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: false } });

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'bestapp-gizli-anahtar';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/media', express.static(path.join(__dirname, 'media')));

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
    if (req.session.userId) return next();
    res.redirect('/');
}

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/api', requireAuth, require('./routes/api')(io));

app.get('/', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Socket.io: bağlanan her istemciye mevcut durumu ve QR'ı gönder
io.on('connection', (socket) => {
    const botClient = require('./bot/client');
    const { status, info } = botClient.getBotStatus();
    socket.emit('bot:status', { status, message: info ? `Bağlandı: ${info.number}` : undefined });
    const qr = botClient.getLastQr();
    if (qr) {
        socket.emit('bot:qr', qr);
        socket.emit('bot:status', { status: 'qr_pending', message: 'QR Kodu bekleniyor' });
    }
    if (status === 'connected' && info) {
        socket.emit('bot:ready', { status: 'connected', ...info });
    }
    // Önbellekteki grup sayısını ve listesini hemen gönder
    const gc = botClient.getGroupCount();
    if (gc !== null) socket.emit('bot:groups', { count: gc, list: botClient.getGroupList() });
});

// WhatsApp botunu başlat
const botClient = require('./bot/client');
botClient.init(io);

httpServer.listen(PORT, () => {
    console.log(`\n🌐 Web arayüzü: http://localhost:${PORT}`);
    console.log(`🔑 Varsayılan giriş: admin / admin123\n`);
});
