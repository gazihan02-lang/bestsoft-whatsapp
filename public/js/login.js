'use strict';

const form      = document.getElementById('loginForm');
const usernameI = document.getElementById('username');
const passwordI = document.getElementById('password');
const pwToggle  = document.getElementById('pwToggle');
const pwIcon    = document.getElementById('pwToggleIcon');
const loginBtn  = document.getElementById('loginBtn');
const errorMsg  = document.getElementById('errorMsg');
const errorText = document.getElementById('errorText');

// Şifre görünürlük toggle
pwToggle.addEventListener('click', () => {
    const isPw = passwordI.type === 'password';
    passwordI.type = isPw ? 'text' : 'password';
    pwIcon.textContent = isPw ? 'visibility_off' : 'visibility';
});

function showError(msg) {
    errorText.textContent = msg;
    errorMsg.hidden = false;
}
function hideError() {
    errorMsg.hidden = true;
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const username = usernameI.value.trim();
    const password = passwordI.value;

    if (!username || !password) {
        showError('Lütfen tüm alanları doldurun.');
        return;
    }

    loginBtn.classList.add('loading');
    loginBtn.disabled = true;

    try {
        const res  = await fetch('/auth/login', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (!res.ok) {
            showError(data.error || 'Giriş başarısız.');
        } else {
            window.location.href = '/dashboard';
        }
    } catch {
        showError('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.');
    } finally {
        loginBtn.classList.remove('loading');
        loginBtn.disabled = false;
    }
});

// Enter tuşu ile giriş
[usernameI, passwordI].forEach(el =>
    el.addEventListener('keydown', e => { if (e.key === 'Enter') form.requestSubmit(); })
);
