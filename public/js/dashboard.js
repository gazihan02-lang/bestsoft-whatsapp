'use strict';

/* =============================================
   BestApp Dashboard — Main JS
   ============================================= */

const socket = io();

// ─── State ───────────────────────────────────
let currentSection = 'home';

// ─── Group count ───────────────────────────
function loadGroupCount() {
    fetch('/api/bot/groups')
        .then(r => r.json())
        .then(data => {
            document.getElementById('statGroups').textContent = data.count;
        })
        .catch(() => {});
}

// ─── Page title map ──────────────────────────
const PAGE_TITLES = {
    home:     'Ana Sayfa',
    schedule: 'Zamanlama',
    archives: 'Arşivler',
    logs:     'Etkinlik Günlüğü',
    settings: 'Ayarlar'
};

// ─── Navigation ──────────────────────────────
document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.section));
});

function navigate(section) {
    currentSection = section;
    document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === section);
    });
    document.querySelectorAll('.section').forEach(s => {
        s.classList.toggle('active', s.id === `section-${section}`);
    });
    document.getElementById('pageTitle').textContent = PAGE_TITLES[section] || section;

    // Load data on navigate
    if (section === 'schedule') { loadScheduled(); loadGroupList(); loadArchivePicker(); }
    if (section === 'archives') loadArchive();
    if (section === 'logs')     loadLogs();
    if (section === 'settings') loadSettings();
    if (section === 'home')     { loadScheduledCount(); loadLogCount(); }
}
window.navigate = navigate;

// ─── Snackbar ────────────────────────────────
const snackbar    = document.getElementById('snackbar');
const snackbarMsg = document.getElementById('snackbarMsg');
const snackbarIco = document.getElementById('snackbarIcon');
let snackTimer;

function showSnack(msg, isError = false) {
    snackbarMsg.textContent = msg;
    snackbarIco.textContent = isError ? 'error' : 'check_circle';
    snackbar.classList.toggle('error', isError);
    snackbar.classList.add('show');
    clearTimeout(snackTimer);
    snackTimer = setTimeout(() => snackbar.classList.remove('show'), 3500);
}

// ─── Logout ──────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/auth/logout', { method: 'POST' });
    window.location.href = '/';
});

document.getElementById('waLogoutBtn').addEventListener('click', async () => {
    if (!confirm('WhatsApp hesabından çıkmak istediğinizden emin misiniz? Yeniden bağlanmak için QR okutmanız gerekecek.')) return;
    const btn = document.getElementById('waLogoutBtn');
    btn.disabled = true; btn.style.opacity = '0.7';
    try {
        const res = await fetch('/api/bot/wa-logout', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) showSnack(data.error || 'Çıkış yapılamadı.', true);
        else showSnack('WhatsApp oturumu kapatıldı.');
    } catch { showSnack('Sunucu hatası.', true); }
    finally { btn.disabled = false; btn.style.opacity = ''; }
});

// ─── Bot Status ──────────────────────────────
function updateBotStatus({ status, message, name, number }) {
    const chip       = document.getElementById('statusChip');
    const qrSec      = document.getElementById('qrSection');
    const initSec    = document.getElementById('initSection');
    const connSec    = document.getElementById('connectedSection');
    const discSec    = document.getElementById('disconnectedSection');

    // Hide all
    qrSec.hidden = initSec.hidden = connSec.hidden = discSec.hidden = true;

    const configs = {
        initializing: {
            chipClass: 'chip-status-initializing',
            icon: 'sync', label: 'Başlatılıyor',
            show: 'init'
        },
        qr_pending: {
            chipClass: 'chip-status-qr',
            icon: 'qr_code', label: 'QR Bekleniyor',
            show: 'qr'
        },
        connected: {
            chipClass: 'chip-status-connected',
            icon: 'check_circle', label: 'Bağlandı',
            show: 'conn'
        },
        disconnected: {
            chipClass: 'chip-status-disconnected',
            icon: 'wifi_off', label: 'Bağlı Değil',
            show: 'disc'
        },
        error: {
            chipClass: 'chip-status-error',
            icon: 'error', label: 'Hata',
            show: 'disc'
        }
    };

    const cfg = configs[status] || configs.disconnected;

    chip.className = `chip ${cfg.chipClass}`;
    chip.innerHTML = `<span class="material-symbols-rounded" style="font-size:16px">${cfg.icon}</span> ${cfg.label}`;

    // Sync header chip
    const headerChip = document.getElementById('statusChipHeader');
    if (headerChip) {
        headerChip.innerHTML = `<div class="chip ${cfg.chipClass}"><span class="material-symbols-rounded" style="font-size:14px">${cfg.icon}</span> ${cfg.label}</div>`;
    }

    if (cfg.show === 'init') initSec.hidden = false;
    if (cfg.show === 'qr')   qrSec.hidden   = false;
    if (cfg.show === 'conn') {
        connSec.hidden = false;
        if (name)   document.getElementById('connectedName').textContent   = name;
        if (number) document.getElementById('connectedNumber').textContent = `+${number}`;
    }
    if (cfg.show === 'disc') {
        discSec.hidden = false;
        document.getElementById('disconnectedMsg').textContent = message || 'Bot bağlı değil.';
    }

    // Stat card
    const labels = { connected: 'Bağlı', disconnected: 'Bağlı Değil', qr_pending: 'QR Bekleniyor', initializing: 'Başlatılıyor', error: 'Hata' };
    document.getElementById('statStatus').textContent = labels[status] || status;
}

socket.on('bot:status', ({ status, message }) => updateBotStatus({ status, message }));
socket.on('bot:groups', ({ count, list }) => {
    document.getElementById('statGroups').textContent = count;
    if (list && list.length) { allGroups = list; renderGroupList(list); }
});

socket.on('bot:ready', ({ status, name, number }) => {
    updateBotStatus({ status, name, number });
});

socket.on('bot:qr', (dataUrl) => {
    if (dataUrl) document.getElementById('qrImage').src = dataUrl;
});

socket.on('bot:message', () => {
    // mesaj alındığında log sayısını güncelle
    loadLogCount();
});

socket.on('schedule:sent', () => {
    if (currentSection === 'schedule') loadScheduled();
    loadScheduledCount();
});

// Get initial status
fetch('/api/bot/status')
    .then(r => r.json())
    .then(data => updateBotStatus(data))
    .catch(() => {});

// ─── Stats ───────────────────────────────────
function loadScheduledCount() {
    fetch('/api/scheduled')
        .then(r => r.json())
        .then(data => { document.getElementById('statScheduled').textContent = data.length; })
        .catch(() => {});
}

function loadLogCount() {
    fetch('/api/logs?limit=200')
        .then(r => r.json())
        .then(data => { document.getElementById('statLogs').textContent = data.length; })
        .catch(() => {});
}

// ─── Log helpers ─────────────────────────────
const LOG_ICONS = {
    info:    { icon: 'info',         cls: 'log-type-info'    },
    success: { icon: 'check_circle', cls: 'log-type-success' },
    warning: { icon: 'warning',      cls: 'log-type-warning' },
    error:   { icon: 'error',        cls: 'log-type-error'   },
    message: { icon: 'chat',         cls: 'log-type-message' },
    sent:    { icon: 'send',         cls: 'log-type-sent'    }
};

function renderLog(log) {
    const cfg  = LOG_ICONS[log.type] || LOG_ICONS.info;
    const time = new Date(log.created_at).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    const div  = document.createElement('div');
    div.className = `log-item ${cfg.cls}`;
    div.innerHTML = `
        <span class="log-icon"><span class="material-symbols-rounded">${cfg.icon}</span></span>
        <span class="log-content">${escHtml(log.content)}</span>
        <span class="log-time">${time}</span>`;
    return div;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderEmptyLog(container) {
    container.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">history</span>Henüz kayıt yok</div>`;
}

function loadLogs() {
    fetch('/api/logs?limit=100')
        .then(r => r.json())
        .then(logs => {
            const el = document.getElementById('fullLogList');
            el.innerHTML = '';
            if (!logs.length) { renderEmptyLog(el); return; }
            logs.forEach(l => el.appendChild(renderLog(l)));
            document.getElementById('statLogs').textContent = logs.length;
        })
        .catch(() => {});
}

document.getElementById('refreshLogsBtn').addEventListener('click', loadLogs);

document.getElementById('clearLogsBtn').addEventListener('click', async () => {
    if (!confirm('Tüm loglar silinecek. Emin misiniz?')) return;
    const res = await fetch('/api/logs', { method: 'DELETE' });
    if (res.ok) { loadLogs(); loadLogCount(); showSnack('Loglar temizlendi.'); }
});

// ─── Scheduled Messages ──────────────────────

/* ======= Grup Seçici ======= */
let allGroups = [];
const selectedGroupIds = new Set();

function renderGroupList(groups) {
    const container = document.getElementById('groupPickerList');
    if (!groups.length) {
        container.innerHTML = `<div class="empty-state" style="padding:24px 12px;font-size:0.8rem">
            <span class="material-symbols-rounded">groups</span>Grup bulunamadı</div>`;
        return;
    }
    container.innerHTML = groups.map(g => `
        <label class="group-pick-item${selectedGroupIds.has(g.id) ? ' selected' : ''}">
            <input type="checkbox" value="${escHtml(g.id)}"${selectedGroupIds.has(g.id) ? ' checked' : ''}>
            <span class="group-pick-name">${escHtml(g.name)}</span>
        </label>`).join('');
    container.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', () => {
            const label = cb.closest('label');
            if (cb.checked) { selectedGroupIds.add(cb.value); label.classList.add('selected'); }
            else            { selectedGroupIds.delete(cb.value); label.classList.remove('selected'); }
            document.getElementById('selGroupCount').textContent = selectedGroupIds.size;
        });
    });
}

function loadGroupList() {
    fetch('/api/bot/group-list')
        .then(r => r.json())
        .then(data => { allGroups = data; renderGroupList(data); })
        .catch(() => {});
}

document.getElementById('selectAllGroups').addEventListener('click', () => {
    allGroups.forEach(g => selectedGroupIds.add(g.id));
    renderGroupList(allGroups);
    document.getElementById('selGroupCount').textContent = selectedGroupIds.size;
});
document.getElementById('clearGroupSel').addEventListener('click', () => {
    selectedGroupIds.clear();
    renderGroupList(allGroups);
    document.getElementById('selGroupCount').textContent = 0;
});
document.getElementById('groupSearchInput').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    renderGroupList(allGroups.filter(g => g.name.toLowerCase().includes(q)));
});

/* ======= İçerik Sekmeleri ======= */
document.querySelectorAll('.content-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const paneId = 'tab' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1);
        document.getElementById(paneId).classList.add('active');
    });
});

/* ======= Medya Yükleme ======= */
let currentMediaFile = null;

const mediaDropZone = document.getElementById('mediaDropZone');
const mediaFileInput = document.getElementById('mediaFileInput');

mediaDropZone.addEventListener('click', () => mediaFileInput.click());
mediaDropZone.addEventListener('dragover', e => { e.preventDefault(); mediaDropZone.classList.add('drag-over'); });
mediaDropZone.addEventListener('dragleave', () => mediaDropZone.classList.remove('drag-over'));
mediaDropZone.addEventListener('drop', e => {
    e.preventDefault();
    mediaDropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) setMediaFile(file);
});
mediaFileInput.addEventListener('change', () => {
    if (mediaFileInput.files[0]) setMediaFile(mediaFileInput.files[0]);
});

function setMediaFile(file) {
    currentMediaFile = file;
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    document.getElementById('mediaPreviewImg').style.display = (!isVideo && !isAudio) ? 'block' : 'none';
    document.getElementById('mediaPreviewVid').style.display = isVideo ? 'block' : 'none';
    document.getElementById('mediaPreviewAud').style.display = isAudio ? 'block' : 'none';

    if (isVideo) document.getElementById('mediaPreviewVid').src = url;
    else if (isAudio) document.getElementById('mediaPreviewAud').src = url;
    else document.getElementById('mediaPreviewImg').src = url;

    document.getElementById('mediaDropZone').style.display = 'none';
    document.getElementById('mediaPreview').style.display = 'flex';
}

document.getElementById('removeMediaBtn').addEventListener('click', () => {
    currentMediaFile = null;
    mediaFileInput.value = '';
    document.getElementById('mediaDropZone').style.display = '';
    document.getElementById('mediaPreview').style.display = 'none';
    document.getElementById('mediaPreviewImg').src = '';
    document.getElementById('mediaPreviewVid').src = '';
    document.getElementById('mediaPreviewAud').src = '';
});

/* ======= Resim Arşivi Seçici ======= */
let selectedArchiveImg  = null;
let archivePickerImages = [];
let selectedArchiveFolder = '__all__';
let selectedArchiveManageFolder = '__all__';
let currentArchiveType = 'all';
let archiveSearchText = '';

function normalizeFolderName(name) {
    return String(name || '').trim() || 'Genel';
}

function filterArchiveByFolder(images, folder) {
    if (folder === '__all__') return images;
    return images.filter(img => normalizeFolderName(img.folder) === folder);
}

function refreshArchivePickerFolderControl(folders) {
    const pickerSel = document.getElementById('archivePickerFolder');
    if (!pickerSel) return;

    const options = ['<option value="__all__">Tüm Klasörler</option>']
        .concat(folders.map(f => `<option value="${escHtml(f)}">${escHtml(f)}</option>`));

    pickerSel.innerHTML = options.join('');
    if (!folders.includes(selectedArchiveFolder)) selectedArchiveFolder = '__all__';
    pickerSel.value = selectedArchiveFolder;
}

function loadArchivePicker() {
    const folderParam = selectedArchiveFolder !== '__all__' ? `&folder=${encodeURIComponent(selectedArchiveFolder)}` : '';
    fetch(`/api/archive?type=image${folderParam}`)
        .then(r => r.json())
        .then(data => {
            archivePickerImages = data;
            renderArchivePicker(data);
        }).catch(() => {});

    fetch('/api/archive/folders?type=image')
        .then(r => r.json())
        .then(rows => refreshArchivePickerFolderControl(rows.map(r => normalizeFolderName(r.folder))))
        .catch(() => {});
}

function renderArchivePicker(images) {
    const filtered = filterArchiveByFolder(images, selectedArchiveFolder);
    const grid = document.getElementById('archivePickerGrid');
    if (!filtered.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:24px;font-size:0.8rem">
            <span class="material-symbols-rounded">photo_library</span>Bu klasörde görsel yok</div>`;
        return;
    }
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(90px, 1fr))';
    grid.style.gap = '8px';
    grid.innerHTML = filtered.map(img => `
        <div class="archive-item${selectedArchiveImg && selectedArchiveImg.id === img.id ? ' selected' : ''}"
             data-id="${img.id}" style="cursor:pointer;border-radius:8px;overflow:hidden;border:2px solid transparent;aspect-ratio:1">
            <img src="${escHtml(img.path)}" alt="${escHtml(img.name)}" style="width:100%;height:100%;object-fit:cover">
            <div class="archive-name">${escHtml(img.name)}</div>
        </div>`).join('');
    grid.querySelectorAll('.archive-item').forEach(el => {
        el.addEventListener('click', () => {
            const img = archivePickerImages.find(i => i.id === parseInt(el.dataset.id));
            if (!img) return;
            grid.querySelectorAll('.archive-item').forEach(x => x.classList.remove('selected'));
            el.classList.add('selected');
            selectedArchiveImg = img;
            document.getElementById('archiveOverlayEditor').style.display = '';
            drawOverlayCanvas();
        });
    });
}

document.getElementById('archivePickerFolder')?.addEventListener('change', (e) => {
    selectedArchiveFolder = e.target.value;
    selectedArchiveImg = null;
    document.getElementById('archiveOverlayEditor').style.display = 'none';
    loadArchivePicker();
});

/* ======= Canvas Overlay ======= */
function drawOverlayCanvas() {
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        const text = document.getElementById('overlayText').value;
        if (!text) return;
        const size  = parseInt(document.getElementById('overlaySize').value);
        const color = document.getElementById('overlayColor').value;
        const pos   = document.getElementById('overlayPos').value;
        ctx.font      = `bold ${size}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = Math.max(2, size / 8);
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.fillStyle = color;
        let y;
        if (pos === 'top')    y = size + 16;
        else if (pos === 'center') y = canvas.height / 2 + size / 3;
        else                  y = canvas.height - 24;
        ctx.strokeText(text, canvas.width / 2, y);
        ctx.fillText(text, canvas.width / 2, y);
    };
    img.crossOrigin = 'anonymous';
    img.src = selectedArchiveImg.path;
}

['overlayText','overlayColor','overlaySize','overlayPos'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
        if (id === 'overlaySize') document.getElementById('overlaySizeVal').textContent = document.getElementById(id).value;
        if (selectedArchiveImg) drawOverlayCanvas();
    });
});

/* ======= Zamanlama Gönder ======= */
document.getElementById('scheduleBtn').addEventListener('click', async () => {
    if (!selectedGroupIds.size) { showSnack('En az bir grup seçin.', true); return; }

    const dateStr = document.getElementById('schDate').value;
    const timeStr = document.getElementById('schTime').value;
    if (!dateStr || !timeStr) { showSnack('Tarih ve saat girin.', true); return; }

    const sendAt = new Date(`${dateStr}T${timeStr}`);
    if (isNaN(sendAt.getTime()) || sendAt <= new Date()) {
        showSnack('Gelecekte bir tarih/saat seçin.', true); return;
    }

    const activeTab = document.querySelector('.content-tab.active').dataset.tab;
    const fd = new FormData();
    fd.append('chatIds', JSON.stringify([...selectedGroupIds]));
    fd.append('sendAt', sendAt.toISOString());
    fd.append('repeatType', document.getElementById('repeatType').value || 'none');

    if (activeTab === 'text') {
        const msg = document.getElementById('schTextMessage').value.trim();
        if (!msg) { showSnack('Mesaj içeriği girin.', true); return; }
        fd.append('message', msg);

    } else if (activeTab === 'media') {
        if (!currentMediaFile) { showSnack('Dosya seçin.', true); return; }
        fd.append('file', currentMediaFile);
        fd.append('message', document.getElementById('mediaCaption').value.trim());

    } else if (activeTab === 'archive') {
        if (!selectedArchiveImg) { showSnack('Arşivden bir resim seçin.', true); return; }
        const canvas = document.getElementById('previewCanvas');
        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
        fd.append('file', blob, 'overlay_image.jpg');
        fd.append('message', document.getElementById('overlayText').value.trim());
        fd.append('overlayText', document.getElementById('overlayText').value.trim());
    }

    const btn = document.getElementById('scheduleBtn');
    btn.disabled = true; btn.style.opacity = '0.7';

    try {
        const res  = await fetch('/api/scheduled', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) { showSnack(data.error || 'Hata oluştu.', true); }
        else {
            showSnack(`✅ ${selectedGroupIds.size} gruba zamanlandı!`);
            resetScheduleForm();
            loadScheduled();
            loadScheduledCount();
        }
    } catch { showSnack('Sunucu hatası.', true); }
    finally  { btn.disabled = false; btn.style.opacity = ''; }
});

function resetScheduleForm() {
    selectedGroupIds.clear();
    renderGroupList(allGroups);
    document.getElementById('selGroupCount').textContent = '0';
    document.getElementById('schTextMessage').value = '';
    document.getElementById('schDate').value = '';
    document.getElementById('schTime').value = '';
    document.getElementById('repeatType').value = 'none';
    document.getElementById('mediaCaption').value = '';
    currentMediaFile = null;
    document.getElementById('mediaDropZone').style.display = '';
    document.getElementById('mediaPreview').style.display = 'none';
    document.getElementById('mediaPreviewAud').src = '';
    selectedArchiveImg = null;
    document.getElementById('archiveOverlayEditor').style.display = 'none';
    document.getElementById('overlayText').value = '';
    document.querySelectorAll('.archive-item').forEach(x => x.classList.remove('selected'));
    // Reset to text tab
    document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelector('.content-tab[data-tab="text"]').classList.add('active');
    document.getElementById('tabText').classList.add('active');
}

document.getElementById('scheduleFormReset').addEventListener('click', resetScheduleForm);

/* ======= Bekleyen Mesajlar Tablosu ======= */
function loadScheduled() {
    fetch('/api/scheduled')
        .then(r => r.json())
        .then(renderScheduleTable)
        .catch(() => {});
}

function renderScheduleTable(msgs) {
    const tbody = document.getElementById('scheduleTableBody');
    document.getElementById('statScheduled').textContent = msgs.length;

    if (!msgs.length) {
        tbody.innerHTML = `<tr><td colspan="4">
            <div class="empty-state"><span class="material-symbols-rounded">schedule</span>Bekleyen mesaj yok</div>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = msgs.map(m => {
        const sendAt = new Date(m.send_at).toLocaleString('tr-TR');
        let groupCells = '';
        if (m.chat_ids) {
            try {
                const ids = JSON.parse(m.chat_ids);
                groupCells = `<span class="td-groups-badge"><span class="material-symbols-rounded" style="font-size:13px">groups</span>${ids.length} grup</span>`;
            } catch {}
        }
        if (!groupCells) groupCells = `<span class="td-truncate" style="font-size:0.8rem">${escHtml(m.chat_id)}</span>`;

        const contentLabel = m.media_type === 'image' ? '🖼 Resim'
                           : m.media_type === 'video' ? '🎥 Video'
                           : m.media_type === 'audio' ? '🎤 Ses'
                           : escHtml((m.message || '').substring(0, 60));

        const repeatMap = { none: 'Tek Sefer', daily: 'Her Gün', weekly: 'Her Hafta', monthly: 'Her Ay' };
        const repeatLabel = repeatMap[m.repeat_type || 'none'] || 'Tek Sefer';

        return `<tr>
            <td>${groupCells}</td>
            <td class="td-truncate">${contentLabel}</td>
            <td style="white-space:nowrap">${sendAt}<div style="font-size:.75rem;color:#6b7280">${repeatLabel}</div></td>
            <td>
                <button onclick="deleteScheduled(${m.id})" title="İptal Et"
                    class="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 transition-colors">
                    <span class="material-symbols-rounded" style="font-size:18px">delete</span>
                </button>
            </td>
        </tr>`;
    }).join('');
}

window.deleteScheduled = async (id) => {
    if (!confirm(`#${id} nolu zamanlanmış mesajı iptal etmek istiyor musunuz?`)) return;
    const res = await fetch(`/api/scheduled/${id}`, { method: 'DELETE' });
    if (res.ok) { loadScheduled(); showSnack('Zamanlanmış mesaj iptal edildi.'); }
    else { showSnack('İptal edilemedi.', true); }
};

document.getElementById('refreshScheduleBtn').addEventListener('click', loadScheduled);

/* ======= Resim Arşivi Yönetimi ======= */
let archiveImages = [];

function renderArchiveTypeButtons() {
    // Tek arşiv ekranı kullanılıyor.
}

function renderArchiveFolderPanel(rows) {
    const panel = document.getElementById('archiveFolderListPanel');
    const folders = rows.map(r => normalizeFolderName(r.folder));

    if (!folders.includes(selectedArchiveManageFolder)) selectedArchiveManageFolder = '__all__';

    const allRow = `
      <div class="archive-folder-row ${selectedArchiveManageFolder === '__all__' ? 'active' : ''}" data-folder="__all__">
        <button class="archive-folder-btn" data-folder="__all__">
          <span class="material-symbols-rounded" style="font-size:18px">folder_open</span>
          <span class="truncate">Tüm Klasörler</span>
        </button>
      </div>`;

    const folderRows = folders.map(f => {
        const isActive = selectedArchiveManageFolder === f;
        const canDelete = f !== 'Genel';
        return `
        <div class="archive-folder-row ${isActive ? 'active' : ''}" data-folder="${escHtml(f)}">
          <button class="archive-folder-btn" data-folder="${escHtml(f)}">
            <span class="material-symbols-rounded" style="font-size:18px">folder</span>
            <span class="truncate">${escHtml(f)}</span>
          </button>
          ${canDelete ? `<button class="archive-folder-delete" data-delete-folder="${escHtml(f)}" title="Klasörü Sil"><span class="material-symbols-rounded" style="font-size:18px">delete</span></button>` : ''}
        </div>`;
    }).join('');

    panel.innerHTML = allRow + folderRows;

    panel.querySelectorAll('button[data-folder]').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedArchiveManageFolder = btn.dataset.folder;
            loadArchive();
        });
    });

    panel.querySelectorAll('button[data-delete-folder]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const folder = btn.dataset.deleteFolder;
            if (!confirm(`"${folder}" klasörünü silmek istiyor musunuz? Dosyalar Genel klasörüne taşınır.`)) return;
            try {
                const res = await fetch(`/api/archive/folders?name=${encodeURIComponent(folder)}`, { method: 'DELETE' });
                const data = await res.json();
                if (!res.ok) { showSnack(data.error || 'Klasör silinemedi.', true); return; }
                if (selectedArchiveManageFolder === folder) selectedArchiveManageFolder = '__all__';
                loadArchive();
                showSnack('Klasör silindi.');
            } catch {
                showSnack('Klasör silinemedi.', true);
            }
        });
    });

    panel.querySelectorAll('.archive-folder-row').forEach(row => {
        const folder = row.dataset.folder;
        row.addEventListener('dragover', (e) => {
            if (folder === '__all__') return;
            e.preventDefault();
            row.classList.add('archive-folder-drop');
        });
        row.addEventListener('dragleave', () => row.classList.remove('archive-folder-drop'));
        row.addEventListener('drop', async (e) => {
            row.classList.remove('archive-folder-drop');
            if (folder === '__all__') return;
            e.preventDefault();
            const file = e.dataTransfer?.files?.[0];
            if (!file) return;
            await uploadArchiveFile(file, folder);
        });
    });

    document.getElementById('archiveFolderList').innerHTML = folders.map(f => `<option value="${escHtml(f)}"></option>`).join('');
}

function loadArchive() {
    const folderParam = selectedArchiveManageFolder !== '__all__' ? `&folder=${encodeURIComponent(selectedArchiveManageFolder)}` : '';
    const searchParam = archiveSearchText ? `&q=${encodeURIComponent(archiveSearchText)}` : '';

    Promise.all([
        fetch(`/api/archive?${[folderParam.replace('&',''), searchParam.replace('&','')].filter(Boolean).join('&')}`).then(r => r.json()),
        fetch('/api/archive/folders').then(r => r.json())
    ]).then(([items, folders]) => {
        archiveImages = items;
        renderArchiveTypeButtons();
        renderArchiveFolderPanel(folders);
        renderArchiveGrid(items);
    }).catch(() => {});

    // Schedule ekranındaki arşiv seçici her zaman görselleri kullanır.
    loadArchivePicker();
}

function renderArchiveGrid(images) {
    const grid = document.getElementById('archiveGrid');
    if (!images.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
            <span class="material-symbols-rounded">folder_open</span>Bu klasörde dosya yok</div>`;
        return;
    }

    grid.innerHTML = images.map(img => {
        const mediaType = img.media_type || 'image';
        const preview = mediaType === 'image'
            ? `<img src="${escHtml(img.path)}" alt="${escHtml(img.name)}" loading="lazy">`
            : mediaType === 'video'
                ? `<video src="${escHtml(img.path)}" preload="metadata" muted></video>`
                : `<span class="material-symbols-rounded text-slate-500">graphic_eq</span>`;
        const icon = mediaType === 'image' ? 'image' : mediaType === 'video' ? 'movie' : 'mic';
        const typeText = mediaType === 'image' ? 'Görsel' : mediaType === 'video' ? 'Video' : 'Ses';
        const modified = new Date(img.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });

        return `
        <div class="archive-row" data-id="${img.id}" data-path="${escHtml(img.path)}" data-type="${mediaType}">
            <div class="archive-name-cell" style="cursor:pointer" onclick="openArchiveLightbox(event,this.closest('.archive-row'))">
                <div class="archive-thumb">${preview}</div>
                <div class="archive-name-main">
                    <div class="title">${escHtml(img.name)}</div>
                    <div class="sub"><span class="material-symbols-rounded" style="font-size:12px;vertical-align:middle">${icon}</span> ${typeText} • ${escHtml(normalizeFolderName(img.folder))}</div>
                </div>
            </div>
            <div class="muted owner-col">ben</div>
            <div class="muted">${modified}</div>
            <div class="muted">—</div>
            <button class="archive-delete-btn" onclick="deleteArchiveImg(${img.id}, event)" title="Sil">
              <span class="material-symbols-rounded" style="font-size:18px">delete</span>
            </button>
        </div>`;
    }).join('');
}

window.openArchiveLightbox = function(e, row) {
    e.stopPropagation();
    const path = row.dataset.path;
    const type = row.dataset.type;
    const lb   = document.getElementById('archiveLightbox');
    const img  = document.getElementById('archiveLightboxImg');
    const vid  = document.getElementById('archiveLightboxVid');
    if (type === 'video') {
        img.classList.add('hidden'); vid.classList.remove('hidden');
        vid.src = path; vid.load();
    } else if (type === 'image') {
        vid.classList.add('hidden'); img.classList.remove('hidden');
        img.src = path;
    } else { return; }
    lb.classList.remove('hidden'); lb.classList.add('flex');
};

(function initLightbox() {
    const lb  = document.getElementById('archiveLightbox');
    const vid = document.getElementById('archiveLightboxVid');
    function closeLb() {
        lb.classList.add('hidden'); lb.classList.remove('flex');
        vid.pause(); vid.src = '';
        document.getElementById('archiveLightboxImg').src = '';
    }
    document.getElementById('archiveLightboxClose').addEventListener('click', closeLb);
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lb.classList.contains('hidden')) closeLb(); });
})();

window.deleteArchiveImg = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Bu dosyayı arşivden silmek istiyor musunuz?')) return;
    const res = await fetch(`/api/archive/${id}`, { method: 'DELETE' });
    if (res.ok) { loadArchive(); showSnack('Dosya arşivden silindi.'); }
    else showSnack('Silinemedi.', true);
};

const archiveUploadBtn  = document.getElementById('archiveUploadBtn');
const archiveFileInput  = document.getElementById('archiveFileInput');
const archiveFolderModal = document.getElementById('archiveFolderModal');
const archiveFolderModalInput = document.getElementById('archiveFolderModalInput');

function openArchiveFolderModal() {
    archiveFolderModal.classList.remove('hidden');
    archiveFolderModal.classList.add('flex');
    archiveFolderModalInput.value = '';
    archiveFolderModalInput.focus();
}

function closeArchiveFolderModal() {
    archiveFolderModal.classList.add('hidden');
    archiveFolderModal.classList.remove('flex');
}

function syncArchiveFileAccept() {
    archiveFileInput.accept = 'image/*,video/*,audio/*';
}

document.querySelectorAll('.archive-type-btn').forEach(() => {});

document.getElementById('archiveSearchInput')?.addEventListener('input', (e) => {
    archiveSearchText = e.target.value.trim();
    loadArchive();
});

document.getElementById('archiveCreateFolderBtn')?.addEventListener('click', () => {
    openArchiveFolderModal();
});

async function createArchiveFolderFromModal() {
    const value = normalizeFolderName(archiveFolderModalInput.value);
    if (!value) return;
    try {
        const res = await fetch('/api/archive/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: value, mediaType: 'all' })
        });
        const data = await res.json();
        if (!res.ok) { showSnack(data.error || 'Klasör oluşturulamadı.', true); return; }
        selectedArchiveManageFolder = value;
        loadArchive();
        closeArchiveFolderModal();
        showSnack(`Klasör oluşturuldu: ${value}`);
    } catch {
        showSnack('Klasör oluşturulamadı.', true);
    }
}

async function uploadArchiveFile(file, folderName) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', normalizeFolderName(folderName));

    archiveUploadBtn.disabled = true;
    let createdItem = null;
    try {
        const res = await fetch('/api/archive/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) { showSnack(data.error || 'Yükleme başarısız.', true); return; }
        createdItem = data.data;
        loadArchive();

        const suggestedName = String(file.name || 'Yeni Dosya').replace(/\.[^.]+$/, '');
        const enteredName = window.prompt('Yükleme tamamlandı. Dosya adı girin:', suggestedName);
        const customName = String(enteredName || '').trim();
        if (customName && createdItem?.id) {
            const renameRes = await fetch(`/api/archive/${createdItem.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: customName })
            });
            const renameData = await renameRes.json();
            if (!renameRes.ok) showSnack(renameData.error || 'Dosya adı güncellenemedi.', true);
            else showSnack('Yüklendi ve dosya adı güncellendi.');
        } else {
            showSnack('Dosya yüklendi.');
        }
    } catch {
        showSnack('Yükleme başarısız.', true);
    } finally {
        archiveUploadBtn.disabled = false;
        loadArchive();
    }
}

document.getElementById('archiveFolderModalSave')?.addEventListener('click', createArchiveFolderFromModal);
document.getElementById('archiveFolderModalCancel')?.addEventListener('click', closeArchiveFolderModal);
document.getElementById('archiveFolderModalClose')?.addEventListener('click', closeArchiveFolderModal);
archiveFolderModal?.addEventListener('click', (e) => {
    if (e.target === archiveFolderModal) closeArchiveFolderModal();
});
archiveFolderModalInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createArchiveFolderFromModal();
    if (e.key === 'Escape') closeArchiveFolderModal();
});

archiveUploadBtn.addEventListener('click', () => archiveFileInput.click());

archiveFileInput.addEventListener('change', async () => {
    const file = archiveFileInput.files[0];
    if (!file) return;

    await uploadArchiveFile(file, selectedArchiveManageFolder !== '__all__' ? selectedArchiveManageFolder : 'Genel');
    archiveFileInput.value = '';
});

syncArchiveFileAccept();



// ─── Settings ────────────────────────────────
function loadSettings() {
    fetch('/api/settings')
        .then(r => r.json())
        .then(s => {
            if (s.BOT_NAME)      document.getElementById('settingBotName').value = s.BOT_NAME;
            if (s.BOT_PREFIX)    document.getElementById('settingPrefix').value   = s.BOT_PREFIX;
            if (s.OWNER_NUMBER)  document.getElementById('settingOwner').value    = s.OWNER_NUMBER;
        })
        .catch(() => {});
}

document.getElementById('botSettingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const settings = {
        BOT_NAME:     document.getElementById('settingBotName').value.trim(),
        BOT_PREFIX:   document.getElementById('settingPrefix').value.trim() || '!',
        OWNER_NUMBER: document.getElementById('settingOwner').value.trim()
    };

    try {
        await Promise.all(Object.entries(settings).map(([key, value]) =>
            fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            })
        ));
        showSnack('Ayarlar kaydedildi!');
    } catch { showSnack('Kayıt başarısız.', true); }
});

document.getElementById('changeUsernameForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newUsername = document.getElementById('newUsername').value.trim();
    const password    = document.getElementById('usernameConfirmPw').value;
    if (!newUsername || !password) { showSnack('Tüm alanları doldurun.', true); return; }

    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true; btn.style.opacity = '0.7';
    try {
        const res  = await fetch('/auth/change-username', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ newUsername, password })
        });
        const data = await res.json();
        if (!res.ok) showSnack(data.error || 'Hata oluştu.', true);
        else         { showSnack(`Kullanıcı adı "${data.username}" olarak güncellendi!`); e.target.reset(); }
    } catch { showSnack('Sunucu hatası.', true); }
    finally  { btn.disabled = false; btn.style.opacity = ''; }
});

document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPw').value;
    const newPassword     = document.getElementById('newPw').value;
    if (!currentPassword || !newPassword) { showSnack('Şifreleri doldurun.', true); return; }
    if (newPassword.length < 6)           { showSnack('Yeni şifre en az 6 karakter olmalı.', true); return; }

    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true; btn.style.opacity = '0.7';

    try {
        const res  = await fetch('/auth/change-password', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ currentPassword, newPassword })
        });
        const data = await res.json();
        if (!res.ok) showSnack(data.error || 'Hata oluştu.', true);
        else         { showSnack('Şifre güncellendi!'); e.target.reset(); }
    } catch { showSnack('Sunucu hatası.', true); }
    finally  { btn.disabled = false; btn.style.opacity = ''; }
});

// ─── Set username in top bar ──────────────────
(function initUser() {
    // Extract from cookie or fetch — simple approach: avatar initials hardcoded
    const uEl = document.getElementById('topBarUsername');
    const aEl = document.getElementById('topBarAvatar');
    // We can't easily get the username client-side without an extra endpoint,
    // but the session is used. Keep avatar as 'A' default.
})();

// ─── Initial data load ───────────────────────
loadScheduledCount();
loadLogCount();
loadArchive();
