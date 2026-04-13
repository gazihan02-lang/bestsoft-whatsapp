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
    const pageTitleEl = document.getElementById('pageTitle');
    if (pageTitleEl) pageTitleEl.textContent = PAGE_TITLES[section] || section;

    // Load data on navigate
    if (section === 'schedule') { loadScheduled(); loadGroupList(); loadGroupTemplates(); loadMessageDrafts(); loadArchivePicker(); }
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

    // (statusChipHeader removed — chip is now in the top nav bar directly)

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

/* ======= Grup Şablonları ======= */
let groupTemplates = [];

function loadGroupTemplates() {
    fetch('/api/group-templates')
        .then(r => r.json())
        .then(data => { groupTemplates = data; renderGroupTemplateChips(); })
        .catch(() => {});
}

function renderGroupTemplateChips() {
    const container = document.getElementById('groupTemplateChips');
    if (!container) return;
    if (!groupTemplates.length) {
        container.innerHTML = '<span class="text-xs text-gray-300 italic">henüz yok</span>';
        return;
    }
    container.innerHTML = groupTemplates.map(t => `
        <span class="inline-flex items-center gap-0.5 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 group">
            <button class="tpl-apply hover:text-indigo-900 truncate max-w-[80px]" data-id="${t.id}" title="Uygula: ${escHtml(t.name)}">${escHtml(t.name)}</button>
            <button class="tpl-del ml-0.5 text-indigo-400 hover:text-red-500 transition-colors" data-id="${t.id}" title="Sil">
                <span class="material-symbols-rounded" style="font-size:12px">close</span>
            </button>
        </span>`).join('');

    container.querySelectorAll('.tpl-apply').forEach(btn => {
        btn.addEventListener('click', () => {
            const tpl = groupTemplates.find(t => t.id === parseInt(btn.dataset.id));
            if (!tpl) return;
            selectedGroupIds.clear();
            tpl.group_ids.forEach(id => selectedGroupIds.add(id));
            renderGroupList(allGroups);
            document.getElementById('selGroupCount').textContent = selectedGroupIds.size;
            showSnack(`"${tpl.name}" şablonu uygulandı.`);
        });
    });
    container.querySelectorAll('.tpl-del').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Bu şablonu silmek istiyor musunuz?')) return;
            await fetch(`/api/group-templates/${btn.dataset.id}`, { method: 'DELETE' });
            loadGroupTemplates();
            showSnack('Şablon silindi.');
        });
    });
}

document.getElementById('saveGroupTemplateBtn')?.addEventListener('click', async () => {
    if (!selectedGroupIds.size) { showSnack('Önce en az bir grup seçin.', true); return; }
    const name = prompt('Şablon adı:');
    if (!name || !name.trim()) return;
    const res = await fetch('/api/group-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), group_ids: [...selectedGroupIds] })
    });
    const data = await res.json();
    if (!res.ok) { showSnack(data.error || 'Kaydedilemedi.', true); return; }
    loadGroupTemplates();
    showSnack(`"${name.trim()}" şablonu kaydedildi.`);
});

/* ======= Mesaj Taslakları ======= */
let messageDrafts = [];

function loadMessageDrafts() {
    fetch('/api/message-drafts')
        .then(r => r.json())
        .then(data => { messageDrafts = data; renderMsgDraftChips(); })
        .catch(() => {});
}

function renderMsgDraftChips() {
    const container = document.getElementById('msgDraftChips');
    if (!container) return;
    if (!messageDrafts.length) {
        container.innerHTML = '<span class="text-xs text-gray-300 italic">kayıtlı taslak yok</span>';
        return;
    }
    container.innerHTML = messageDrafts.map(d => `
        <span class="inline-flex items-center gap-0.5 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
            <button class="draft-apply truncate max-w-[120px] hover:text-violet-900" data-id="${d.id}" title="${escHtml(d.content)}">${escHtml(d.name)}</button>
            <button class="draft-del ml-0.5 text-violet-400 hover:text-red-500 transition-colors" data-id="${d.id}" title="Sil">
                <span class="material-symbols-rounded" style="font-size:12px">close</span>
            </button>
        </span>`).join('');

    container.querySelectorAll('.draft-apply').forEach(btn => {
        btn.addEventListener('click', () => {
            const d = messageDrafts.find(x => x.id === parseInt(btn.dataset.id));
            if (!d) return;
            document.getElementById('schTextMessage').value = d.content;
            showSnack(`"${d.name}" taslağı yapıştırıldı.`);
        });
    });
    container.querySelectorAll('.draft-del').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Bu taslağı silmek istiyor musunuz?')) return;
            await fetch(`/api/message-drafts/${btn.dataset.id}`, { method: 'DELETE' });
            loadMessageDrafts();
            showSnack('Taslak silindi.');
        });
    });
}

document.getElementById('saveMsgDraftBtn')?.addEventListener('click', () => {
    const content = document.getElementById('schTextMessage').value.trim();
    if (!content) { showSnack('Önce mesaj yazın.', true); return; }
    document.getElementById('draftSaveRow').classList.remove('hidden');
    document.getElementById('saveMsgDraftBtn').classList.add('hidden');
    const nameInput = document.getElementById('draftNameInput');
    nameInput.value = '';
    nameInput.focus();
});

document.getElementById('draftSaveCancelBtn')?.addEventListener('click', () => {
    document.getElementById('draftSaveRow').classList.add('hidden');
    document.getElementById('saveMsgDraftBtn').classList.remove('hidden');
});

document.getElementById('draftNameInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('draftSaveConfirmBtn')?.click();
    if (e.key === 'Escape') document.getElementById('draftSaveCancelBtn')?.click();
});

document.getElementById('draftSaveConfirmBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('draftNameInput').value.trim();
    if (!name) { showSnack('Taslak adı girin.', true); return; }
    const content = document.getElementById('schTextMessage').value.trim();
    if (!content) { showSnack('Mesaj boş.', true); return; }
    const res = await fetch('/api/message-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content })
    });
    const data = await res.json();
    if (!res.ok) { showSnack(data.error || 'Kaydedilemedi.', true); return; }
    document.getElementById('draftSaveRow').classList.add('hidden');
    document.getElementById('saveMsgDraftBtn').classList.remove('hidden');
    loadMessageDrafts();
    showSnack(`"${name}" taslağı kaydedildi.`);
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
    const container = document.getElementById('scheduleTableBody');
    document.getElementById('statScheduled').textContent = msgs.length;
    _editScheduleAll = msgs;

    // Build lookup: "YYYY-M-D" -> [msg,...]
    const msgsByDate = {};
    msgs.forEach(m => {
        const d = new Date(m.send_at);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!msgsByDate[key]) msgsByDate[key] = [];
        msgsByDate[key].push(m);
    });

    const today = new Date();
    const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    const DAYS   = ['Pt','Sa','Çr','Pe','Cu','Ct','Pz'];

    let calHtml = '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">';

    const startYear  = today.getFullYear();

    for (let i = 0; i < 12; i++) {
        const mo   = i;
        const yr   = startYear;
        const daysInMonth = new Date(yr, mo + 1, 0).getDate();
        let dow = new Date(yr, mo, 1).getDay();
        dow = dow === 0 ? 6 : dow - 1; // Mon=0

        calHtml += `<div class="rounded-xl border border-gray-100 overflow-hidden bg-white">
          <div class="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span class="text-xs font-bold text-gray-700">${MONTHS[mo]}</span>
            <span class="text-[10px] text-gray-400">${yr}</span>
          </div>
          <div class="p-2">
            <div class="grid grid-cols-7 mb-1">
              ${DAYS.map(d => `<div class="text-center text-[9px] font-semibold text-gray-300">${d}</div>`).join('')}
            </div>
            <div class="grid grid-cols-7 gap-y-0.5">
              ${Array(dow).fill('<div></div>').join('')}
              ${Array.from({length: daysInMonth}, (_, di) => {
                  const day = di + 1;
                  const key = `${yr}-${mo}-${day}`;
                  const dayMsgs = msgsByDate[key] || [];
                  const isToday = today.getFullYear()===yr && today.getMonth()===mo && today.getDate()===day;
                  const hasMsgs = dayMsgs.length > 0;
                  if (hasMsgs) {
                      return `<div class="relative flex items-center justify-center">
                        <button onclick="showDayMessages(${yr},${mo},${day})"
                          class="w-6 h-6 rounded-full text-[10px] font-bold text-white bg-indigo-500 hover:bg-indigo-600 transition-colors flex items-center justify-center leading-none">${day}</button>
                        ${dayMsgs.length > 1 ? `<span class="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] text-[8px] font-bold text-white bg-rose-500 rounded-full flex items-center justify-center px-0.5">${dayMsgs.length}</span>` : ''}
                      </div>`;
                  }
                  if (isToday) {
                      return `<div class="flex items-center justify-center">
                        <span class="w-6 h-6 rounded-full text-[10px] font-semibold text-indigo-600 bg-indigo-50 flex items-center justify-center">${day}</span>
                      </div>`;
                  }
                  return `<div class="flex items-center justify-center">
                    <span class="text-[10px] text-gray-400">${day}</span>
                  </div>`;
              }).join('')}
            </div>
          </div>
        </div>`;
    }

    calHtml += '</div>';
    calHtml += '<div id="dayMsgsPanel" class="hidden px-4 pb-4"></div>';

    if (!msgs.length) {
        container.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">schedule</span>Bekleyen mesaj yok</div>`;
        return;
    }

    container.innerHTML = calHtml;
}

window.showDayMessages = (yr, mo, day) => {
    const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    const msgs = _editScheduleAll.filter(m => {
        const d = new Date(m.send_at);
        return d.getFullYear()===yr && d.getMonth()===mo && d.getDate()===day;
    });
    const panel = document.getElementById('dayMsgsPanel');
    if (!msgs.length) { panel.classList.add('hidden'); return; }

    const dayStr = new Date(yr, mo, day).toLocaleDateString('tr-TR', { weekday: 'long' });

    const msgRows = msgs.map(m => {
        const timeStr = new Date(m.send_at).toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });
        const repeatMap = { none:'', weekly:'Her Hafta', monthly:'Her Ay' };
        const repeatLabel = repeatMap[m.repeat_type || 'none'];
        const typeIcon  = m.media_type==='image' ? 'image' : m.media_type==='video' ? 'videocam' : m.media_type==='audio' ? 'mic' : 'chat';
        const typeColor = m.media_type ? '#6366f1' : '#9ca3af';
        const mediaIdx  = m.media_path ? m.media_path.indexOf('/media/') : -1;
        const mediaSrc  = m.media_path ? (mediaIdx!==-1 ? m.media_path.slice(mediaIdx) : '/'+m.media_path.split('/').pop()) : '';
        let groupLabel = '';
        if (m.chat_ids) { try { const ids=JSON.parse(m.chat_ids); groupLabel=`<span class="inline-flex items-center gap-1 text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full"><span class="material-symbols-rounded" style="font-size:11px">groups</span>${ids.length} grup</span>`; } catch {} }
        if (!groupLabel) groupLabel = `<span class="text-xs text-gray-500">${escHtml(m.chat_id||'')}</span>`;
        const contentLabel = m.media_type==='image' ? 'Resim' : m.media_type==='video' ? 'Video' : m.media_type==='audio' ? 'Ses' : escHtml((m.message||'').substring(0,90));

        return `<div class="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-100 mb-2 hover:bg-gray-50/60 transition-colors">
          <div class="text-sm font-bold text-gray-800 w-10 flex-shrink-0 text-center">${timeStr}</div>
          <div class="w-px h-7 bg-gray-100 flex-shrink-0"></div>
          <div class="w-8 h-8 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center${mediaSrc&&m.media_type==='image'?' cursor-pointer schedule-media-icon':''}" style="color:${typeColor}"${mediaSrc&&m.media_type==='image'?` data-src="${mediaSrc}"`:''}><span class="material-symbols-rounded" style="font-size:18px">${typeIcon}</span></div>
          <div class="flex-1 min-w-0">
            <p class="text-sm text-gray-800 truncate">${contentLabel}</p>
            <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
              ${groupLabel}
              ${repeatLabel?`<span class="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"><span class="material-symbols-rounded" style="font-size:11px">repeat</span>${repeatLabel}</span>`:''}
            </div>
          </div>
          <div class="flex items-center gap-0.5 flex-shrink-0">
            <button onclick="openCopySchedule(${m.id})" class="w-8 h-8 flex items-center justify-center rounded-lg text-emerald-400 hover:bg-emerald-50 transition-colors" title="Diğer tarihlere kopyala"><span class="material-symbols-rounded" style="font-size:16px">content_copy</span></button>
            <button onclick="openEditSchedule(${m.id})" class="w-8 h-8 flex items-center justify-center rounded-lg text-indigo-400 hover:bg-indigo-50 transition-colors"><span class="material-symbols-rounded" style="font-size:16px">edit</span></button>
            <button onclick="deleteScheduled(${m.id})" class="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 transition-colors"><span class="material-symbols-rounded" style="font-size:16px">delete</span></button>
          </div>
        </div>`;
    }).join('');

    panel.classList.remove('hidden');
    panel.innerHTML = `
      <div class="border-t border-gray-100 pt-4">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-sm font-semibold text-gray-700">${day} ${MONTHS[mo]} ${yr}</span>
          <span class="text-xs text-red-500 font-medium capitalize">${dayStr}</span>
          <span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">${msgs.length} mesaj</span>
          <button onclick="document.getElementById('dayMsgsPanel').classList.add('hidden')"
            class="ml-auto w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <span class="material-symbols-rounded" style="font-size:16px">close</span>
          </button>
        </div>
        ${msgRows}
      </div>`;

    // Hover preview for images in panel
    const tooltip    = document.getElementById('mediaHoverTooltip');
    const tooltipImg = document.getElementById('mediaHoverImg');
    panel.querySelectorAll('.schedule-media-icon').forEach(el => {
        el.addEventListener('mouseenter', e => { tooltipImg.src=el.dataset.src; tooltip.classList.remove('hidden'); positionTooltip(e); });
        el.addEventListener('mousemove', positionTooltip);
        el.addEventListener('mouseleave', () => { tooltip.classList.add('hidden'); tooltipImg.src=''; });
    });

    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

function positionTooltip(e) {
    const tooltip = document.getElementById('mediaHoverTooltip');
    const margin = 14, tw = 220, th = 240;
    let x = e.clientX + margin, y = e.clientY + margin;
    if (x + tw > window.innerWidth)  x = e.clientX - tw - margin;
    if (y + th > window.innerHeight) y = e.clientY - th - margin;
    tooltip.style.left = x + 'px';
    tooltip.style.top  = y + 'px';
}

window.deleteScheduled = async (id) => {
    if (!confirm(`#${id} nolu zamanlanmış mesajı iptal etmek istiyor musunuz?`)) return;
    const res = await fetch(`/api/scheduled/${id}`, { method: 'DELETE' });
    if (res.ok) { loadScheduled(); showSnack('Zamanlanmış mesaj iptal edildi.'); }
    else { showSnack('İptal edilemedi.', true); }
};

/* ── Zamanlanmış Mesaj Güncelle Modal ── */
let _editScheduleAll = [];

window.openEditSchedule = (id) => {
    _editScheduleNewFile = null;
    _editScheduleArchiveItem = null;
    const fileInput = document.getElementById('editScheduleFileInput');
    if (fileInput) fileInput.value = '';
    const m = _editScheduleAll.find(x => x.id === id);
    if (!m) return;
    document.getElementById('editScheduleId').value = id;
    document.getElementById('editScheduleMessage').value = m.message || '';
    const d = new Date(m.send_at);
    document.getElementById('editScheduleDate').value = d.toISOString().split('T')[0];
    document.getElementById('editScheduleTime').value = d.toTimeString().slice(0,5);
    document.getElementById('editScheduleRepeat').value = m.repeat_type || 'none';

    // Medya önizleme
    const previewWrap = document.getElementById('editScheduleMediaPreview');
    const previewImg  = document.getElementById('editSchedulePreviewImg');
    const previewVid  = document.getElementById('editSchedulePreviewVid');
    const previewAud  = document.getElementById('editSchedulePreviewAud');
    const mediaName   = document.getElementById('editScheduleMediaName');
    [previewImg, previewVid, previewAud].forEach(el => el.classList.add('hidden'));
    if (m.media_path) {
        previewWrap.classList.remove('hidden');
        // media_path DB'de mutlak sunucu yolu olarak tutulur (/opt/.../media/uploads/file.jpg)
        // Tarayıcıya /media/uploads/file.jpg olarak sunulur
        const mediaIdx = m.media_path.indexOf('/media/');
        const src = mediaIdx !== -1 ? m.media_path.slice(mediaIdx) : '/' + m.media_path.split('/').pop();
        mediaName.textContent = src.split('/').pop();
        if (m.media_type === 'image') {
            previewImg.src = src;
            previewImg.classList.remove('hidden');
        } else if (m.media_type === 'video') {
            previewVid.src = src;
            previewVid.classList.remove('hidden');
        } else if (m.media_type === 'audio') {
            previewAud.src = src;
            previewAud.classList.remove('hidden');
        }
    } else {
        previewWrap.classList.add('hidden');
    }

    const modal = document.getElementById('editScheduleModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

function closeEditScheduleModal() {
    const modal = document.getElementById('editScheduleModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

document.getElementById('editScheduleClose')?.addEventListener('click', closeEditScheduleModal);
document.getElementById('editScheduleCancel')?.addEventListener('click', closeEditScheduleModal);
document.getElementById('editScheduleModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('editScheduleModal')) closeEditScheduleModal();
});

/* ── Diğer Tarihlere Kopyala Modal ── */
let _copyScheduleId = null;
let _copyCalYear = 0;
let _copyCalMonth = 0;
let _copySelectedDates = new Set();

const _COPY_MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const _COPY_DAYS   = ['Pt','Sa','Çr','Pe','Cu','Ct','Pz'];

window.openCopySchedule = (id) => {
    _copyScheduleId = id;
    _copySelectedDates = new Set();
    const today = new Date();
    _copyCalYear  = today.getFullYear();
    _copyCalMonth = today.getMonth();
    renderCopyCalendar();
    renderCopySelectedChips();
    const modal = document.getElementById('copyScheduleModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

function closeCopyModal() {
    document.getElementById('copyScheduleModal').classList.add('hidden');
    document.getElementById('copyScheduleModal').classList.remove('flex');
}

function renderCopyCalendar() {
    const yr = _copyCalYear, mo = _copyCalMonth;
    document.getElementById('copyCalTitle').textContent = `${_COPY_MONTHS[mo]} ${yr}`;
    const daysInMonth = new Date(yr, mo + 1, 0).getDate();
    let dow = new Date(yr, mo, 1).getDay();
    dow = dow === 0 ? 6 : dow - 1;

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    let html = '<div class="grid grid-cols-7 mb-1">';
    html += _COPY_DAYS.map(d => `<div class="text-center text-[10px] font-semibold text-gray-400 py-1">${d}</div>`).join('');
    html += '</div><div class="grid grid-cols-7 gap-y-1">';
    html += Array(dow).fill('<div></div>').join('');
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${yr}-${String(mo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const isPast = dateStr <= todayStr;
        const isSelected = _copySelectedDates.has(dateStr);
        if (isPast) {
            html += `<div class="flex items-center justify-center py-0.5"><span class="w-8 h-8 flex items-center justify-center text-xs text-gray-300">${day}</span></div>`;
        } else if (isSelected) {
            html += `<div class="flex items-center justify-center py-0.5"><button onclick="toggleCopyDate('${dateStr}')" class="w-8 h-8 rounded-full text-xs font-bold text-white bg-indigo-500 hover:bg-indigo-600 transition-colors">${day}</button></div>`;
        } else {
            html += `<div class="flex items-center justify-center py-0.5"><button onclick="toggleCopyDate('${dateStr}')" class="w-8 h-8 rounded-full text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">${day}</button></div>`;
        }
    }
    html += '</div>';
    document.getElementById('copyCalGrid').innerHTML = html;
}

window.toggleCopyDate = (dateStr) => {
    if (_copySelectedDates.has(dateStr)) _copySelectedDates.delete(dateStr);
    else _copySelectedDates.add(dateStr);
    renderCopyCalendar();
    renderCopySelectedChips();
};

function renderCopySelectedChips() {
    const container = document.getElementById('copySelectedDates');
    if (!_copySelectedDates.size) {
        container.innerHTML = '<span class="text-xs text-gray-400">Takvimden tarih seçin</span>';
        return;
    }
    const MONTHS_SHORT = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
    container.innerHTML = [..._copySelectedDates].sort().map(d => {
        const [,m,day] = d.split('-');
        return `<span class="inline-flex items-center gap-1 text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg">
            ${parseInt(day)} ${MONTHS_SHORT[parseInt(m)-1]}
            <button onclick="toggleCopyDate('${d}')" class="text-indigo-400 hover:text-indigo-600 leading-none"><span class="material-symbols-rounded" style="font-size:12px">close</span></button>
        </span>`;
    }).join('');
}

document.getElementById('copyCalPrev')?.addEventListener('click', () => {
    if (_copyCalMonth === 0) { _copyCalMonth = 11; _copyCalYear--; } else _copyCalMonth--;
    renderCopyCalendar();
});
document.getElementById('copyCalNext')?.addEventListener('click', () => {
    if (_copyCalMonth === 11) { _copyCalMonth = 0; _copyCalYear++; } else _copyCalMonth++;
    renderCopyCalendar();
});
document.getElementById('copyScheduleClose')?.addEventListener('click', closeCopyModal);
document.getElementById('copyScheduleCancel')?.addEventListener('click', closeCopyModal);
document.getElementById('copyScheduleModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('copyScheduleModal')) closeCopyModal();
});
document.getElementById('copyScheduleConfirm')?.addEventListener('click', async () => {
    if (!_copySelectedDates.size) { showSnack('En az bir tarih seçin.', true); return; }
    const btn = document.getElementById('copyScheduleConfirm');
    btn.disabled = true;
    const res = await fetch(`/api/scheduled/${_copyScheduleId}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates: [..._copySelectedDates] })
    });
    btn.disabled = false;
    if (res.ok) {
        const data = await res.json();
        showSnack(`${data.created} tarih için mesaj kopyalandı.`);
        closeCopyModal();
        loadScheduled();
    } else {
        const data = await res.json().catch(() => ({}));
        showSnack(data.error || 'Kopyalama başarısız.', true);
    }
});

// Medya değiştir — arşiv seçici modal
let _editScheduleNewFile = null;
let _editScheduleArchiveItem = null; // { path, media_type, name }
let _editMediaPickerSelected = null;

function openEditMediaPicker() {
    _editMediaPickerSelected = null;
    document.getElementById('editMediaPickerModal').classList.remove('hidden');
    document.getElementById('editMediaPickerModal').classList.add('flex');
    loadEditMediaPickerArchive();
}
function closeEditMediaPicker() {
    document.getElementById('editMediaPickerModal').classList.add('hidden');
    document.getElementById('editMediaPickerModal').classList.remove('flex');
}

function loadEditMediaPickerArchive() {
    const folder = document.getElementById('editMediaPickerFolder')?.value || '__all__';
    const folderParam = folder !== '__all__' ? `&folder=${encodeURIComponent(folder)}` : '';
    fetch(`/api/archive?${folderParam}`)
        .then(r => r.json())
        .then(items => renderEditMediaPickerGrid(Array.isArray(items) ? items : []))
        .catch(() => renderEditMediaPickerGrid([]));

    fetch('/api/archive/folders')
        .then(r => r.json())
        .then(rows => {
            const sel = document.getElementById('editMediaPickerFolder');
            if (!sel) return;
            const cur = sel.value;
            sel.innerHTML = '<option value="__all__">Tüm Klasörler</option>' +
                (Array.isArray(rows) ? rows : []).map(r => {
                    const f = r.folder || '';
                    return `<option value="${escHtml(f)}">${escHtml(f)}</option>`;
                }).join('');
            sel.value = cur;
        }).catch(() => {});
}

function renderEditMediaPickerGrid(items) {
    const grid = document.getElementById('editMediaPickerGrid');
    if (!items.length) {
        grid.innerHTML = '<div class="col-span-full py-8 text-center text-gray-400 text-sm">Arşiv boş</div>';
        return;
    }
    grid.innerHTML = items.map(item => {
        const icon = item.media_type === 'video' ? 'movie' : item.media_type === 'audio' ? 'mic' : null;
        const thumb = icon
            ? `<div class="w-full h-full flex items-center justify-center bg-gray-100"><span class="material-symbols-rounded text-gray-400" style="font-size:32px">${icon}</span></div>`
            : `<img src="${escHtml(item.path)}" class="w-full h-full object-cover">`;
        return `<div class="edit-media-pick-item relative rounded-xl overflow-hidden border-2 border-transparent hover:border-indigo-400 cursor-pointer transition-all"
                     style="aspect-ratio:1" data-id="${item.id}" data-path="${escHtml(item.path)}" data-type="${escHtml(item.media_type||'image')}" data-name="${escHtml(item.name||'')}">
            ${thumb}
            <div class="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-1 text-white text-[10px] truncate">${escHtml(item.name||'')}</div>
        </div>`;
    }).join('');
    grid.querySelectorAll('.edit-media-pick-item').forEach(el => {
        el.addEventListener('click', () => {
            grid.querySelectorAll('.edit-media-pick-item').forEach(x => x.classList.remove('border-indigo-500'));
            el.classList.add('border-indigo-500');
            _editScheduleNewFile = null;
            _editScheduleArchiveItem = { path: el.dataset.path, media_type: el.dataset.type, name: el.dataset.name };
            applyEditMediaPreview({ path: el.dataset.path, media_type: el.dataset.type, name: el.dataset.name }, null);
            closeEditMediaPicker();
        });
    });
}

function applyEditMediaPreview(archiveItem, file) {
    const previewWrap = document.getElementById('editScheduleMediaPreview');
    const previewImg  = document.getElementById('editSchedulePreviewImg');
    const previewVid  = document.getElementById('editSchedulePreviewVid');
    const previewAud  = document.getElementById('editSchedulePreviewAud');
    const mediaName   = document.getElementById('editScheduleMediaName');
    [previewImg, previewVid, previewAud].forEach(el => { el.classList.add('hidden'); el.src = ''; });
    previewWrap.classList.remove('hidden');
    if (file) {
        mediaName.textContent = file.name;
        const url = URL.createObjectURL(file);
        if (file.type.startsWith('image')) { previewImg.src = url; previewImg.classList.remove('hidden'); }
        else if (file.type.startsWith('video')) { previewVid.src = url; previewVid.classList.remove('hidden'); }
        else if (file.type.startsWith('audio')) { previewAud.src = url; previewAud.classList.remove('hidden'); }
    } else if (archiveItem) {
        mediaName.textContent = archiveItem.name || archiveItem.path.split('/').pop();
        const t = archiveItem.media_type || 'image';
        if (t === 'image') { previewImg.src = archiveItem.path; previewImg.classList.remove('hidden'); }
        else if (t === 'video') { previewVid.src = archiveItem.path; previewVid.classList.remove('hidden'); }
        else if (t === 'audio') { previewAud.src = archiveItem.path; previewAud.classList.remove('hidden'); }
    }
}

document.getElementById('editScheduleReplaceBtn')?.addEventListener('click', openEditMediaPicker);
document.getElementById('editMediaPickerClose')?.addEventListener('click', closeEditMediaPicker);
document.getElementById('editMediaPickerModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('editMediaPickerModal')) closeEditMediaPicker();
});
document.getElementById('editMediaPickerFolder')?.addEventListener('change', loadEditMediaPickerArchive);

// Picker içindeki "bilgisayardan yükle"
document.getElementById('editScheduleFileInputPicker')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    _editScheduleNewFile = file;
    _editScheduleArchiveItem = null;
    applyEditMediaPreview(null, file);
    closeEditMediaPicker();
});

// Ana modal üzerindeki file input (doğrudan tetiklenirse)
document.getElementById('editScheduleFileInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    _editScheduleNewFile = file;
    _editScheduleArchiveItem = null;
    applyEditMediaPreview(null, file);
});

document.getElementById('editScheduleSave')?.addEventListener('click', async () => {
    const id = document.getElementById('editScheduleId').value;
    const message = document.getElementById('editScheduleMessage').value;
    const date = document.getElementById('editScheduleDate').value;
    const time = document.getElementById('editScheduleTime').value;
    const repeat_type = document.getElementById('editScheduleRepeat').value;
    if (!date || !time) { showSnack('Tarih ve saat zorunlu.', true); return; }
    const send_at = new Date(`${date}T${time}`).toISOString();
    let res;
    if (_editScheduleNewFile) {
        const fd = new FormData();
        fd.append('file', _editScheduleNewFile);
        fd.append('message', message);
        fd.append('send_at', send_at);
        fd.append('repeat_type', repeat_type);
        res = await fetch(`/api/scheduled/${id}`, { method: 'PATCH', body: fd });
    } else if (_editScheduleArchiveItem) {
        res = await fetch(`/api/scheduled/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, send_at, repeat_type,
                archive_path: _editScheduleArchiveItem.path,
                archive_type: _editScheduleArchiveItem.media_type })
        });
    } else {
        res = await fetch(`/api/scheduled/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, send_at, repeat_type })
        });
    }
    if (res.ok) {
        closeEditScheduleModal();
        loadScheduled();
        showSnack('Zamanlanmış mesaj güncellendi.');
    } else {
        const d = await res.json().catch(() => ({}));
        showSnack(d.error || 'Güncellenemedi.', true);
    }
});

document.getElementById('refreshScheduleBtn').addEventListener('click', loadScheduled);

/* ======= Resim Arşivi Yönetimi ======= */
let archiveImages = [];
let archiveFolders = [];
let currentArchivePath = '';

function normalizeArchiveBrowserPath(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === 'Genel' || raw === '__root__' || raw === '__all__') return '';
    return raw;
}

function getArchivePathSegments(pathValue = '') {
    return normalizeArchiveBrowserPath(pathValue).split('/').filter(Boolean);
}

function getArchivePathName(pathValue = '') {
    const parts = getArchivePathSegments(pathValue);
    return parts.length ? parts[parts.length - 1] : 'Ana Arşiv';
}

function getArchivePathParent(pathValue = '') {
    const parts = getArchivePathSegments(pathValue);
    parts.pop();
    return parts.join('/');
}

function formatArchiveSize(bytes = 0) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    const units = ['KB', 'MB', 'GB'];
    let value = n / 1024;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
        value /= 1024;
        idx += 1;
    }
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[idx]}`;
}

function getDirectChildFolders(rows, parentPath, query = '') {
    const parent = normalizeArchiveBrowserPath(parentPath);
    const search = String(query || '').trim().toLowerCase();
    const exactCounts = new Map();
    const allPaths = rows
        .map(row => normalizeArchiveBrowserPath(row.folder))
        .filter(Boolean);

    rows.forEach(row => {
        const pathValue = normalizeArchiveBrowserPath(row.folder);
        if (pathValue) exactCounts.set(pathValue, row.count || 0);
    });

    const directChildren = new Map();
    allPaths.forEach(fullPath => {
        let childPath = '';
        if (!parent) {
            childPath = fullPath.split('/')[0];
        } else if (fullPath.startsWith(parent + '/')) {
            const remainder = fullPath.slice(parent.length + 1);
            childPath = parent + '/' + remainder.split('/')[0];
        }

        if (!childPath || childPath === parent) return;
        if (search && !childPath.toLowerCase().includes(search) && !getArchivePathName(childPath).toLowerCase().includes(search)) return;

        if (!directChildren.has(childPath)) {
            directChildren.set(childPath, {
                path: childPath,
                name: getArchivePathName(childPath),
                count: exactCounts.get(childPath) || 0,
                hasChildren: allPaths.some(pathValue => pathValue !== childPath && pathValue.startsWith(childPath + '/'))
            });
        }
    });

    return [...directChildren.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

function renderArchiveBreadcrumb() {
    const breadcrumb = document.getElementById('archiveBreadcrumb');
    const label = document.getElementById('archiveCurrentLabel');
    const segments = getArchivePathSegments(currentArchivePath);
    const crumbs = ['<button type="button" data-breadcrumb-path="">Arşiv</button>'];
    let builtPath = '';

    segments.forEach(segment => {
        builtPath = builtPath ? builtPath + '/' + segment : segment;
        crumbs.push(`<span class="sep">/</span><button type="button" data-breadcrumb-path="${escHtml(builtPath)}">${escHtml(segment)}</button>`);
    });

    breadcrumb.innerHTML = crumbs.join('');
    label.textContent = currentArchivePath || 'Ana arşiv';
    breadcrumb.querySelectorAll('[data-breadcrumb-path]').forEach(btn => {
        btn.addEventListener('click', () => {
            currentArchivePath = normalizeArchiveBrowserPath(btn.dataset.breadcrumbPath);
            loadArchive();
        });
    });
}

function bindArchiveDropTargets(root) {
    root.querySelectorAll('[data-folder-row], [data-drop-folder]').forEach(target => {
        const folder = normalizeArchiveBrowserPath(target.dataset.folderRow || target.dataset.dropFolder);
        target.addEventListener('dragover', (e) => {
            e.preventDefault();
            target.classList.add('archive-folder-drop');
        });
        target.addEventListener('dragleave', () => target.classList.remove('archive-folder-drop'));
        target.addEventListener('drop', async (e) => {
            e.preventDefault();
            target.classList.remove('archive-folder-drop');
            const itemId = Number(e.dataTransfer?.getData('application/x-archive-item-id') || 0);
            const sourceFolder = normalizeArchiveBrowserPath(e.dataTransfer?.getData('application/x-archive-item-folder') || '');
            if (itemId) {
                if (sourceFolder === folder) return;
                await moveArchiveItem(itemId, folder);
                return;
            }
            const file = e.dataTransfer?.files?.[0];
            if (!file) return;
            await uploadArchiveFile(file, folder);
        });
    });
}

async function moveArchiveItem(id, folder) {
    try {
        const res = await fetch('/api/archive/' + id + '/move', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder: folder || 'Genel' })
        });
        const data = await res.json();
        if (!res.ok) return showSnack(data.error || 'Dosya taşınamadı.', true);
        showSnack('Dosya taşındı.');
        loadArchive();
    } catch {
        showSnack('Dosya taşınamadı.', true);
    }
}

function renderArchiveFolderPanel(rows) {
    archiveFolders = rows;
    const panel = document.getElementById('archiveFolderListPanel');
    const treeRows = [];

    function walk(parentPath = '', depth = 0) {
        const children = getDirectChildFolders(rows, parentPath);
        children.forEach(folder => {
            const isActive = currentArchivePath === folder.path;
            treeRows.push(`
                <div class="archive-folder-row ${isActive ? 'active' : ''}" data-folder-row="${escHtml(folder.path)}">
                  <button class="archive-folder-btn" data-open-folder="${escHtml(folder.path)}" style="padding-left:${8 + depth * 14}px">
                    <span class="material-symbols-rounded" style="font-size:18px">folder</span>
                    <span class="folder-label">${escHtml(folder.name)}</span>
                  </button>
                  <div class="archive-folder-actions">
                    <button class="archive-folder-rename" data-rename-folder="${escHtml(folder.path)}" title="Klasörü Yeniden Adlandır"><span class="material-symbols-rounded" style="font-size:18px">edit</span></button>
                    <button class="archive-folder-delete" data-delete-folder="${escHtml(folder.path)}" title="Klasörü Sil"><span class="material-symbols-rounded" style="font-size:18px">delete</span></button>
                  </div>
                </div>`);
            walk(folder.path, depth + 1);
        });
    }

    walk();
    panel.innerHTML = `
        <div class="archive-folder-row ${currentArchivePath === '' ? 'active' : ''}" data-folder-row="">
          <button class="archive-folder-btn" data-open-folder="">
            <span class="material-symbols-rounded" style="font-size:18px">home_storage</span>
            <span class="folder-label">Ana Arşiv</span>
          </button>
        </div>` + treeRows.join('');

    panel.querySelectorAll('[data-open-folder]').forEach(btn => {
        btn.addEventListener('click', () => {
            currentArchivePath = normalizeArchiveBrowserPath(btn.dataset.openFolder);
            loadArchive();
        });
    });
    panel.querySelectorAll('[data-rename-folder]').forEach(btn => btn.addEventListener('click', (e) => renameArchiveFolder(btn.dataset.renameFolder, e)));
    panel.querySelectorAll('[data-delete-folder]').forEach(btn => btn.addEventListener('click', (e) => deleteArchiveFolder(btn.dataset.deleteFolder, e)));
    bindArchiveDropTargets(panel);

    document.getElementById('archiveFolderList').innerHTML = rows.map(f => `<option value="${escHtml(f.folder)}"></option>`).join('');
    renderArchiveBreadcrumb();
}

async function loadArchive() {
    try {
        const qParam = archiveSearchText ? `&q=${encodeURIComponent(archiveSearchText)}` : '';
        const folderParam = currentArchivePath ? `&folder=${encodeURIComponent(currentArchivePath)}` : '';
        const [imgRes, folderRes] = await Promise.all([
            fetch(`/api/archive?scope=current${folderParam}${qParam}`),
            fetch('/api/archive/folders')
        ]);
        const imgData   = await imgRes.json();
        const folderData = await folderRes.json();
        const images  = Array.isArray(imgData.data)   ? imgData.data   : [];
        const folders = Array.isArray(folderData.data) ? folderData.data : [];
        renderArchiveFolderPanel(folders);
        renderArchiveGrid(images);
    } catch (err) {
        console.error('loadArchive error:', err);
    }
}

function renderArchiveGrid(images) {
    const grid = document.getElementById('archiveGrid');
    const childFolders = getDirectChildFolders(archiveFolders, currentArchivePath, archiveSearchText);

    if (!childFolders.length && !images.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
            <span class="material-symbols-rounded">folder_open</span>Bu klasörde içerik yok</div>`;
        return;
    }

    const folderRows = childFolders.map(folder => `
        <div class="archive-row folder-entry" data-drop-folder="${escHtml(folder.path)}">
            <div class="archive-name-cell" data-open-folder="${escHtml(folder.path)}" style="cursor:pointer">
                <div class="archive-thumb"><span class="material-symbols-rounded text-amber-500">folder</span></div>
                <div class="archive-name-main">
                    <div class="title">${escHtml(folder.name)}</div>
                    <div class="sub">${escHtml(folder.path)}${folder.hasChildren ? ' • alt klasörler var' : ''}</div>
                </div>
            </div>
            <div class="muted owner-col">—</div>
            <div class="muted">Klasör</div>
            <div class="muted">${folder.count} dosya</div>
            <div class="archive-actions">
                <button class="archive-action-btn" data-rename-folder="${escHtml(folder.path)}" title="Klasörü Yeniden Adlandır"><span class="material-symbols-rounded" style="font-size:18px">edit</span></button>
                <button class="archive-action-btn" data-delete-folder="${escHtml(folder.path)}" title="Klasörü Sil"><span class="material-symbols-rounded" style="font-size:18px">delete</span></button>
            </div>
        </div>`).join('');

    const fileRows = images.map(img => {
        const mediaType = img.media_type || 'image';
        const preview = mediaType === 'image'
            ? `<img src="${escHtml(img.path)}" alt="${escHtml(img.name)}" loading="lazy">`
            : mediaType === 'video'
                ? `<video src="${escHtml(img.path)}" preload="metadata" muted></video>`
                : `<span class="material-symbols-rounded text-slate-500">graphic_eq</span>`;
        const icon = mediaType === 'image' ? 'image' : mediaType === 'video' ? 'movie' : 'mic';
        const typeText = mediaType === 'image' ? 'Görsel' : mediaType === 'video' ? 'Video' : 'Ses';
        const modified = new Date(img.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
        const clickable = mediaType === 'image' || mediaType === 'video';
        const folderPath = normalizeArchiveBrowserPath(img.folder);

        return `
        <div class="archive-row" data-id="${img.id}" data-path="${escHtml(img.path)}" data-type="${mediaType}" data-item-folder="${escHtml(folderPath)}" draggable="true">
            <div class="archive-name-cell" ${clickable ? 'data-open-lightbox="1" style="cursor:pointer"' : ''}>
                <div class="archive-thumb">${preview}</div>
                <div class="archive-name-main">
                    <div class="title">${escHtml(img.name)}</div>
                    <div class="sub"><span class="material-symbols-rounded" style="font-size:12px;vertical-align:middle">${icon}</span> ${typeText} • ${escHtml(currentArchivePath || 'Ana arşiv')}</div>
                </div>
            </div>
            <div class="muted owner-col">ben</div>
            <div class="muted">${modified}</div>
            <div class="muted">${formatArchiveSize(img.size_bytes)}</div>
            <div class="archive-actions">
                <button class="archive-action-btn" data-rename-item="${img.id}" data-item-name="${escHtml(img.name)}" title="Dosya Adını Güncelle"><span class="material-symbols-rounded" style="font-size:18px">edit</span></button>
                <button class="archive-action-btn" data-delete-item="${img.id}" title="Sil"><span class="material-symbols-rounded" style="font-size:18px">delete</span></button>
            </div>
        </div>`;
    }).join('');

    grid.innerHTML = folderRows + fileRows;

    grid.querySelectorAll('[data-open-folder]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            currentArchivePath = normalizeArchiveBrowserPath(el.dataset.openFolder);
            loadArchive();
        });
    });
    grid.querySelectorAll('[data-open-lightbox]').forEach(el => {
        el.addEventListener('click', (e) => openArchiveLightbox(e, el.closest('.archive-row')));
    });
    grid.querySelectorAll('.archive-row[data-id]').forEach(el => {
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/x-archive-item-id', String(el.dataset.id));
            e.dataTransfer.setData('application/x-archive-item-folder', String(el.dataset.itemFolder || ''));
            e.dataTransfer.effectAllowed = 'move';
        });
    });
    grid.querySelectorAll('[data-rename-folder]').forEach(el => el.addEventListener('click', (e) => renameArchiveFolder(el.dataset.renameFolder, e)));
    grid.querySelectorAll('[data-delete-folder]').forEach(el => el.addEventListener('click', (e) => deleteArchiveFolder(el.dataset.deleteFolder, e)));
    grid.querySelectorAll('[data-rename-item]').forEach(el => el.addEventListener('click', (e) => renameArchiveItem(Number(el.dataset.renameItem), el.dataset.itemName, e)));
    grid.querySelectorAll('[data-delete-item]').forEach(el => el.addEventListener('click', (e) => deleteArchiveImg(Number(el.dataset.deleteItem), e)));
    bindArchiveDropTargets(grid);
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

async function renameArchiveFolder(folderPath, e) {
    e?.stopPropagation();
    const currentName = getArchivePathName(folderPath);
    const nextName = String(window.prompt('Yeni klasör adı:', currentName) || '').trim();
    if (!nextName || nextName === currentName) return;
    try {
        const res = await fetch('/api/archive/folders', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: folderPath, name: nextName })
        });
        const data = await res.json();
        if (!res.ok) return showSnack(data.error || 'Klasör güncellenemedi.', true);
        if (currentArchivePath === folderPath || currentArchivePath.startsWith(folderPath + '/')) {
            currentArchivePath = data.data.folder + currentArchivePath.slice(folderPath.length);
        }
        loadArchive();
        showSnack('Klasör adı güncellendi.');
    } catch {
        showSnack('Klasör güncellenemedi.', true);
    }
}

async function deleteArchiveFolder(folderPath, e) {
    e?.stopPropagation();
    const label = getArchivePathName(folderPath);
    if (!confirm('"' + label + '" klasörü ve içindeki tüm alt klasör/dosyalar silinsin mi?')) return;
    try {
        const res = await fetch('/api/archive/folders?name=' + encodeURIComponent(folderPath), { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) return showSnack(data.error || 'Klasör silinemedi.', true);
        if (currentArchivePath === folderPath || currentArchivePath.startsWith(folderPath + '/')) {
            currentArchivePath = getArchivePathParent(folderPath);
        }
        loadArchive();
        showSnack('Klasör silindi.');
    } catch {
        showSnack('Klasör silinemedi.', true);
    }
}

async function renameArchiveItem(id, currentName, e) {
    e?.stopPropagation();
    const nextName = String(window.prompt('Yeni dosya adı:', currentName) || '').trim();
    if (!nextName || nextName === currentName) return;
    try {
        const res = await fetch('/api/archive/' + id, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nextName })
        });
        const data = await res.json();
        if (!res.ok) return showSnack(data.error || 'Dosya adı güncellenemedi.', true);
        loadArchive();
        showSnack('Dosya adı güncellendi.');
    } catch {
        showSnack('Dosya adı güncellenemedi.', true);
    }
}

window.deleteArchiveImg = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Bu dosyayı arşivden silmek istiyor musunuz?')) return;
    const res = await fetch('/api/archive/' + id, { method: 'DELETE' });
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
    if (archiveFileInput) archiveFileInput.accept = 'image/*,video/*,audio/*';
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
            body: JSON.stringify({ name: value, parent: currentArchivePath, mediaType: 'all' })
        });
        const data = await res.json();
        if (!res.ok) { showSnack(data.error || 'Klasör oluşturulamadı.', true); return; }
        loadArchive();
        closeArchiveFolderModal();
        showSnack('Klasör oluşturuldu: ' + data.data.folder);
    } catch {
        showSnack('Klasör oluşturulamadı.', true);
    }
}

async function uploadArchiveFile(file, folderName) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', normalizeArchiveBrowserPath(folderName) || 'Genel');

    if (archiveUploadBtn) archiveUploadBtn.disabled = true;
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
            const renameRes = await fetch('/api/archive/' + createdItem.id, {
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
        if (archiveUploadBtn) archiveUploadBtn.disabled = false;
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

archiveUploadBtn?.addEventListener('click', () => archiveFileInput?.click());

archiveFileInput?.addEventListener('change', async () => {
    const file = archiveFileInput.files[0];
    if (!file) return;

    await uploadArchiveFile(file, currentArchivePath);
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
