
// ═══════════════════════════════════════════════
// DOSYA YÖNETİCİSİ (FILE MANAGER)
// ═══════════════════════════════════════════════
let fmCurrentPath = "";
let fmFolders = [];
let fmFiles = [];
let fmSearchQuery = "";

// Selectors
const fmBreadcrumb = document.getElementById('fmBreadcrumb');
const fmGrid = document.getElementById('fmGrid');
const fmSearchInput = document.getElementById('fmSearchInput');

// INIT
function loadFileManager() {
    const params = new URLSearchParams({ scope: 'current' });
    if (fmCurrentPath) params.set('folder', fmCurrentPath);
    if (fmSearchQuery) params.set('q', fmSearchQuery);

    Promise.all([
        fetch('/api/archive?' + params.toString()).then(r => r.json()),
        fetch('/api/archive/folders').then(r => r.json())
    ]).then(([items, folders]) => {
        fmFiles = items;
        fmFolders = folders;
        renderFileManager();
    }).catch(err => {
        console.error(err);
        showSnack('Klasör yüklenemedi.', true);
    });
}

function renderFileManager() {
    // Render breadcrumbs
    const parts = fmCurrentPath ? fmCurrentPath.split('/') : [];
    let bcHtml = `<button class="hover:text-indigo-600 transition-colors flex items-center font-medium" onclick="fmGoTo('')"><span class="material-symbols-rounded" style="font-size:18px">home</span></button>`;
    let buildPath = "";
    parts.forEach((p, i) => {
        buildPath += (i === 0 ? p : '/' + p);
        bcHtml += ` <span class="text-gray-400 mx-1">/</span> <button class="hover:text-indigo-600 transition-colors font-medium text-gray-800" onclick="fmGoTo('${escHtml(buildPath)}')">${escHtml(p)}</button>`;
    });
    if (fmBreadcrumb) fmBreadcrumb.innerHTML = bcHtml;

    // Filter child folders
    let children = [];
    if (!fmSearchQuery) {
        children = fmFolders.filter(f => {
            if (f.folder === 'Genel') return false;
            const pParts = fmCurrentPath ? fmCurrentPath.split('/') : [];
            const fParts = f.folder.split('/');
            if (fParts.length !== pParts.length + 1) return false;
            if (fmCurrentPath && !f.folder.startsWith(fmCurrentPath + '/')) return false;
            return true;
        });
    }

    if (!children.length && !fmFiles.length) {
        fmGrid.innerHTML = `
            <div class="py-12 text-center text-gray-400 flex flex-col items-center col-span-full">
                <span class="material-symbols-rounded" style="font-size:48px; opacity:0.4">folder_open</span>
                <span class="mt-3 text-sm font-medium">Bu klasör tamamen boş</span>
            </div>`;
        return;
    }

    let rowsHtml = '';
    
    // FOLDERS
    children.forEach(f => {
        const folderName = f.folder.split('/').pop();
        rowsHtml += `
        <div class="group flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 transition-colors cursor-pointer" onclick="fmGoTo('${escHtml(f.folder)}')">
            <div class="flex items-center gap-3 flex-1 min-w-0">
                <span class="material-symbols-rounded text-blue-400" style="font-size:24px">folder</span>
                <span class="text-sm font-medium text-gray-800 truncate">${escHtml(folderName)}</span>
            </div>
            <div class="hidden sm:block text-xs text-gray-400 w-[120px]">—</div>
            <div class="hidden sm:block text-xs text-gray-400 w-[100px]">${f.count} öğe</div>
            <div class="flex items-center justify-end w-[60px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button class="p-1.5 text-gray-400 hover:text-indigo-600 rounded" onclick="event.stopPropagation(); fmRename('folder', '${escHtml(f.folder)}', '${escHtml(folderName)}')"><span class="material-symbols-rounded" style="font-size:18px">edit</span></button>
                <button class="p-1.5 text-gray-400 hover:text-red-500 rounded" onclick="event.stopPropagation(); fmDeleteFolder('${escHtml(f.folder)}')"><span class="material-symbols-rounded" style="font-size:18px">delete</span></button>
            </div>
        </div>`;
    });

    // FILES
    fmFiles.forEach(f => {
        const d = new Date(f.created_at);
        const dateStr = d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
        const sizeStr = f.size_bytes ? (f.size_bytes / 1024 / 1024).toFixed(2) + ' MB' : '0 MB';
        let icon = 'description';
        let color = 'text-gray-400';
        if (f.media_type === 'image') { icon = 'image'; color = 'text-emerald-500'; }
        if (f.media_type === 'video') { icon = 'movie'; color = 'text-rose-500'; }
        if (f.media_type === 'audio') { icon = 'mic'; color = 'text-amber-500'; }
        
        let pathThumb = f.path; // Or we can rely solely on icon

        rowsHtml += `
        <div class="group flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 transition-colors">
            <div class="flex items-center gap-3 flex-1 min-w-0" style="cursor:pointer" onclick="window.open('${escHtml(f.path)}', '_blank')">
                ${f.media_type === 'image' 
                    ? `<img src="${escHtml(f.path)}" class="w-6 h-6 rounded object-cover">`
                    : `<span class="material-symbols-rounded ${color}" style="font-size:24px">${icon}</span>`}
                <span class="text-sm font-medium text-gray-700 truncate">${escHtml(f.name)}</span>
            </div>
            <div class="hidden sm:block text-xs text-gray-500 w-[120px]">${dateStr}</div>
            <div class="hidden sm:block text-xs text-gray-500 w-[100px]">${sizeStr}</div>
            <div class="flex items-center justify-end w-[60px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button class="p-1.5 text-gray-400 hover:text-indigo-600 rounded" onclick="event.stopPropagation(); fmRename('file', ${f.id}, '${escHtml(f.name)}')"><span class="material-symbols-rounded" style="font-size:18px">edit</span></button>
                <button class="p-1.5 text-gray-400 hover:text-red-500 rounded" onclick="event.stopPropagation(); fmDeleteFile(${f.id})"><span class="material-symbols-rounded" style="font-size:18px">delete</span></button>
            </div>
        </div>`;
    });

    fmGrid.innerHTML = rowsHtml;
}

function fmGoTo(path) {
    if (fmSearchQuery) fmSearchInput.value = '';
    fmSearchQuery = '';
    fmCurrentPath = path;
    loadFileManager();
}

// SEARCH
fmSearchInput?.addEventListener('input', (e) => {
    fmSearchQuery = e.target.value.trim();
    loadFileManager();
});

// UPLOAD
document.getElementById('fmUploadBtn')?.addEventListener('click', () => document.getElementById('fmFileInput').click());
document.getElementById('fmFileInput')?.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files || !files.length) return;

    for (let i=0; i<files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);
        if (fmCurrentPath) formData.append('folder', fmCurrentPath);
        
        try {
            await fetch('/api/archive/upload', { method: 'POST', body: formData });
        } catch { }
    }
    showSnack('Yükleme tamamlandı.');
    e.target.value = '';
    loadFileManager();
});

// NEW FOLDER
document.getElementById('fmNewFolderBtn')?.addEventListener('click', async () => {
    const name = prompt('Yeni klasör adı:');
    if (!name) return;
    try {
        const res = await fetch('/api/archive/folders', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, parent: fmCurrentPath, mediaType: 'all' })
        });
        const data = await res.json();
        if (data.error) showSnack(data.error, true);
        else loadFileManager();
    } catch { showSnack('Klasör oluşturulamadı', true); }
});

// DELETE FOLDER
async function fmDeleteFolder(folderPath) {
    if (!confirm(`'${folderPath}' klasörünü ve içindeki her şeyi silmek istediğinize emin misiniz?`)) return;
    try {
        await fetch('/api/archive/folders?name=' + encodeURIComponent(folderPath), { method: 'DELETE' });
        showSnack('Klasör silindi');
        loadFileManager();
    } catch { showSnack('Klasör silinemedi', true); }
}

// DELETE FILE
async function fmDeleteFile(id) {
    if (!confirm('Bu dosyayı silmek istediğinize emin misiniz?')) return;
    try {
        await fetch('/api/archive/' + id, { method: 'DELETE' });
        showSnack('Dosya silindi');
        loadFileManager();
    } catch { showSnack('Dosya silinemedi', true); }
}

// RENAME
const fmRenameModal = document.getElementById('fmRenameModal');
const fmRenameType = document.getElementById('fmRenameType');
const fmRenameIdOrPath = document.getElementById('fmRenameIdOrPath');
const fmRenameInput = document.getElementById('fmRenameInput');
const fmRenameOldName = document.getElementById('fmRenameOldName');

function fmRename(type, idOrPath, oldName) {
    fmRenameType.value = type;
    fmRenameIdOrPath.value = idOrPath;
    fmRenameInput.value = oldName;
    fmRenameOldName.textContent = oldName;
    fmRenameModal.classList.remove('hidden');
    fmRenameModal.classList.add('flex');
    fmRenameInput.focus();
}

document.getElementById('fmRenameCancel')?.addEventListener('click', () => {
    fmRenameModal.classList.add('hidden');
    fmRenameModal.classList.remove('flex');
});

document.getElementById('fmRenameSave')?.addEventListener('click', async () => {
    const type = fmRenameType.value;
    const idOrPath = fmRenameIdOrPath.value;
    const newName = fmRenameInput.value.trim();
    if (!newName) return;

    try {
        if (type === 'folder') {
            await fetch('/api/archive/folders', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: idOrPath, name: newName })
            });
        } else {
            await fetch('/api/archive/' + idOrPath, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });
        }
        fmRenameModal.classList.add('hidden');
        fmRenameModal.classList.remove('flex');
        showSnack('Yeniden adlandırıldı');
        loadFileManager();
    } catch {
        showSnack('Hata oluştu', true);
    }
});

// Override existing archive loader
window.loadArchive = function() {
    loadFileManager();
};
document.addEventListener('DOMContentLoaded', () => {
    // Check if we are currently on archives tab
    if (document.querySelector('.nav-item.active')?.getAttribute('data-section') === 'archives') {
        loadFileManager();
    }
});
