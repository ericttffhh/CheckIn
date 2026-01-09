// ==========================================================
// 1. Firebase SDK 導入與配置
// ==========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const firebaseConfig = {
    apiKey: "AIzaSyCqS2W49BcSvQV5XwKDPfb7HKeQp5-pO9c",
    authDomain: "classcheckinsystem.firebaseapp.com",
    projectId: "classcheckinsystem",
    storageBucket: "classcheckinsystem.firebasestorage.app",
    messagingSenderId: "592387609788",
    appId: "1:592387609788:web:4f00a7fa9653b00fa8acb9"
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app, 'us-central1');

const secureUserSignup = httpsCallable(functions, 'secureUserSignup');

// ==========================================================
// 2. DOM 元素獲取
// ==========================================================
const passwordStage = document.getElementById('password-stage');
const infoStage = document.getElementById('info-stage');
const successStage = document.getElementById('success-stage');
const queryResultStage = document.getElementById('query-result-stage'); // 新增：查詢結果區域
const historyListContainer = document.getElementById('history-list-container'); // 新增：紀錄列表

const infoForm = document.getElementById('info-form');
const passwordInput = document.getElementById('password-input');
const passwordError = document.getElementById('password-error');
const manualSectionStage = document.getElementById('manual-section-stage');
const autoSectionStatus = document.getElementById('auto-section-status');
const manualDateInput = document.getElementById('manual-date-input');

let isManualMode = false;

// ==========================================================
// 3. 核心安全防禦函數 (淨化輸入)
// ==========================================================
function sanitizeInput(input) {
    if (!input) return '';
    return String(input).trim()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

function getTodayDateString() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ==========================================================
// 4. 查詢歷史紀錄功能 (新增)
// ==========================================================
window.queryHistory = async function() {
    const password = passwordInput.value;
    if (!password) {
        passwordError.textContent = '請先輸入密語再點擊查詢。';
        return;
    }

    passwordError.textContent = '正在查詢紀錄...';
    historyListContainer.innerHTML = '<p>載入中...</p>';

    try {
        const response = await fetch('https://us-central1-classcheckinsystem.cloudfunctions.net/getUserCheckInHistory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { password: sanitizeInput(password) } })
        });
        
        const result = await response.json();

        // 檢查後端回傳格式 (通常 Firebase HTTP 會包在 result.data 內)
        const responseData = result.data || result;

        if (response.ok && responseData.success) {
            passwordError.textContent = '';
            passwordStage.classList.add('hidden');
            queryResultStage.classList.remove('hidden');

            if (!responseData.records || responseData.records.length === 0) {
                historyListContainer.innerHTML = '<p>尚無任何打卡紀錄。</p>';
            } else {
                historyListContainer.innerHTML = responseData.records.map(rec => `
                    <div style="padding: 10px; border-bottom: 1px solid #eee; text-align: left;">
                        📅 <strong>日期：</strong>${rec.checkinDate}<br>
                        ⏰ <strong>節次：</strong>${rec.section}
                    </div>
                `).join('');
            }
        } else {
            passwordError.textContent = `查詢失敗: ${responseData.message || '密語錯誤'}`;
        }
    } catch (error) {
        passwordError.textContent = '系統連線異常，請稍後再試。';
    }
};

window.closeQuery = function() {
    queryResultStage.classList.add('hidden');
    passwordStage.classList.remove('hidden');
};

// ==========================================================
// 5. 頁面導航與模式切換
// ==========================================================
function initializeMode() {
    if (manualDateInput) manualDateInput.value = getTodayDateString();
}

window.showInfoStage = function() {
    passwordStage.classList.add('hidden');
    infoStage.classList.remove('hidden');
    passwordError.textContent = '';
};

window.resetData = function() {
    window.location.reload();
};

window.toggleManualMode = function() {
    isManualMode = !isManualMode;
    const switchButton = document.querySelector('.mode-switch-button');

    if (isManualMode) {
        manualSectionStage.classList.remove('hidden');
        autoSectionStatus.innerHTML = '🔴 **手動模式 (可複選)**';
        autoSectionStatus.style.color = '#dc3545';
        if(switchButton) switchButton.textContent = '切換回自動模式';
    } else {
        manualSectionStage.classList.add('hidden');
        autoSectionStatus.innerHTML = '🟢 **自動節次判斷**';
        autoSectionStatus.style.color = '#28a745';
        if(switchButton) switchButton.textContent = '切換節次模式';
        document.querySelectorAll('input[name="manual_section"]').forEach(cb => cb.checked = false);
    }
    passwordError.textContent = '';
};

// ==========================================================
// 6. 建檔與打卡邏輯
// ==========================================================
infoForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    passwordError.textContent = '正在建檔...';

    const signupData = {
        password: sanitizeInput(document.getElementById('personal-password-input').value),
        className: sanitizeInput(document.getElementById('class-input').value),
        name: sanitizeInput(document.getElementById('name-input').value),
        studentId: sanitizeInput(document.getElementById('student-id-input').value).toUpperCase()
    };

    try {
        const response = await secureUserSignup(signupData);
        if (response.data && response.data.success) {
            await performCheckIn(signupData.password);
        } else {
            passwordError.textContent = `建檔失敗: ${response.data.message}`;
        }
    } catch (error) {
        passwordError.textContent = `建檔出錯: ${error.message}`;
    }
});

window.checkPassword = function() {
    const password = passwordInput.value;
    if (!password) { passwordError.textContent = '請輸入密語。'; return; }
    performCheckIn(password);
};

async function performCheckIn(password) {
    const checkInBtn = document.querySelector('button[onclick="checkPassword()"]');
    if (checkInBtn) checkInBtn.disabled = true;
    
    const sections = isManualMode ? 
        Array.from(document.querySelectorAll('input[name="manual_section"]:checked')).map(cb => sanitizeInput(cb.value)) : [];
    const date = isManualMode ? manualDateInput.value : getTodayDateString();

    try {
        const response = await fetch('https://us-central1-classcheckinsystem.cloudfunctions.net/secureCheckIn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { password: sanitizeInput(password), sections, date } })
        });
        
        const result = await response.json(); 
        const resData = result.data || result;

        if (response.ok && resData.success) {
            displaySuccess(resData); 
        } else {
            passwordError.textContent = `打卡失敗: ${resData.message || '密語無效'}`;
        }
    } catch (error) {
        passwordError.textContent = `連線失敗`;
    } finally {
        if (checkInBtn) checkInBtn.disabled = false;
    }
}

function displaySuccess(data) {
    passwordStage.classList.add('hidden');
    infoStage.classList.add('hidden');
    successStage.classList.remove('hidden');

    document.getElementById('display-class').textContent = data.className || 'N/A';
    document.getElementById('display-name').textContent = data.name || 'N/A';
    document.getElementById('display-student-id').textContent = data.studentId || 'N/A';
    document.getElementById('display-date').textContent = data.checkInDate || 'N/A';
    document.getElementById('display-section').textContent = data.section || 'N/A';
    document.getElementById('display-timestamp').textContent = new Date().toLocaleTimeString('zh-TW', { hour12: false });
}

document.addEventListener('DOMContentLoaded', initializeMode);
window.checkPassword = checkPassword;
window.resetData = resetData;
window.showInfoStage = showInfoStage;
window.toggleManualMode = toggleManualMode;
