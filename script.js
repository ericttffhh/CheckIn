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
const queryResultStage = document.getElementById('query-result-stage');
const batchStage = document.getElementById('batch-stage'); 

const historyListContainer = document.getElementById('history-list-container');
const infoForm = document.getElementById('info-form');
const passwordInput = document.getElementById('password-input');
const passwordError = document.getElementById('password-error');
const manualSectionStage = document.getElementById('manual-section-stage');
const autoSectionStatus = document.getElementById('auto-section-status');
const manualDateInput = document.getElementById('manual-date-input');

// 批量打卡專用元素
const batchDatePicker = document.getElementById('batch-date-picker');
const selectedDatesDisplay = document.getElementById('selected-dates-display');

let isManualMode = false;
let selectedDates = []; // 儲存批量打卡的日期陣列

// ==========================================================
// 3. 核心輔助函數 (安全性與格式化)
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
// 4. 批量打卡功能邏輯
// ==========================================================
window.showBatchStage = async function() {
    const password = passwordInput.value;
    if (!password) {
        alert("請先輸入密語，系統才能確認您的身分。");
        return;
    }

    // 先顯示畫面，並維持「載入中」
    passwordStage.classList.add('hidden');
    batchStage.classList.remove('hidden');

    try {
        // 💡 呼叫與查詢紀錄相同的 API 來獲取身分
        const response = await fetch('https://us-central1-classcheckinsystem.cloudfunctions.net/getUserCheckInHistory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { password: sanitizeInput(password) } })
        });
        
        const result = await response.json();
        const responseData = result.data || result;

        if (response.ok && responseData.success) {
            // 嘗試抓取使用者資料
            const displayUser = responseData.user || {};

            // 💡 填入批量打卡的顯示欄位
            document.getElementById('batch-display-class').textContent = displayUser.className || '後端未回傳';
            document.getElementById('batch-display-name').textContent = displayUser.name || '後端未回傳';
            document.getElementById('batch-display-student-id').textContent = displayUser.studentId || '後端未回傳';
        } else {
            alert("驗證失敗：密語可能錯誤。");
            resetData(); // 返回主畫面
        }
    } catch (error) {
        console.error("Batch Identity Error:", error);
        document.getElementById('batch-display-name').textContent = '連線失敗';
    }
};

window.closeBatchStage = function() {
    batchStage.classList.add('hidden');
    passwordStage.classList.remove('hidden');
    selectedDates = [];
    updateDateListUI();
};

window.addDateToList = function() {
    const dateVal = batchDatePicker.value;
    if (!dateVal) return;
    
    if (selectedDates.includes(dateVal)) {
        alert("該日期已在列表中");
        return;
    }
    
    selectedDates.push(dateVal);
    // 排序日期（由新到舊）
    selectedDates.sort((a, b) => new Date(b) - new Date(a));
    updateDateListUI();
};

window.removeDate = function(dateToRemove) {
    selectedDates = selectedDates.filter(d => d !== dateToRemove);
    updateDateListUI();
};

function updateDateListUI() {
    if (selectedDates.length === 0) {
        selectedDatesDisplay.innerHTML = '<span style="color: #999;">尚未選擇日期</span>';
        return;
    }
    
    selectedDatesDisplay.innerHTML = selectedDates.map(d => `
        <span class="date-tag">
            ${d} <span class="remove-btn" onclick="removeDate('${d}')">×</span>
        </span>
    `).join('');
}

window.submitBatchCheckIn = async function() {
    const password = passwordInput.value;
    const sectionRadio = document.querySelector('input[name="batch_section"]:checked');
    
    if (selectedDates.length === 0) {
        alert("請至少選擇一個日期");
        return;
    }
    if (!sectionRadio) {
        alert("請選擇一個打卡節次");
        return;
    }

    const btn = document.querySelector('button[onclick="submitBatchCheckIn()"]');
    btn.disabled = true;
    btn.textContent = "處理中...";

    try {
        const response = await fetch('https://us-central1-classcheckinsystem.cloudfunctions.net/secureBatchCheckIn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                data: { 
                    password: sanitizeInput(password), 
                    dates: selectedDates, 
                    section: sectionRadio.value 
                } 
            })
        });

        const result = await response.json();
        const resData = result.data || result; // 取得後端回傳的主體

        if (response.ok && resData.success) {
            // 💡 核心修正：自動偵測後端回傳的欄位 (相容 user 物件或直接回傳的欄位)
            const userInfo = resData.user || resData;

            displaySuccess({
                // 檢查 className 或 class，如果都沒有才顯示 "(未提供)"，避免卡在 "載入中"
                className: userInfo.className || userInfo.class || "(未提供)",
                name: userInfo.name || "(未提供)",
                studentId: userInfo.studentId || "N/A",
                // 💡 日期處理：將陣列 [2026-01-01, 2026-01-02] 轉成易讀的字串
                checkInDate: selectedDates.length > 1 
                    ? `${selectedDates[0]} 等 ${selectedDates.length} 個日期` 
                    : selectedDates[0],
                section: sectionRadio.value
            });

            selectedDates = []; // 清空選取日期
            if (typeof updateDateList === 'function') updateDateList(); // 更新畫面上的日期清單標籤
            
        } else {
            alert("失敗：" + (resData.message || "密語錯誤或系統異常"));
        }
    } catch (error) {
        console.error("Batch error:", error);
        alert("連線失敗，請檢查網路");
    } finally {
        btn.disabled = false;
        btn.textContent = "🚀 開始批量打卡";
    }
};

// ==========================================================
// 5. 查詢歷史紀錄功能
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
const responseData = result.data || result;

// 💡 加入這一行，然後在瀏覽器按 F12 打開「控制台 (Console)」查看
console.log("後端回傳的完整資料：", responseData);

        if (response.ok && responseData.success) {
            passwordError.textContent = '';
            
            // 💡 新增：填入個人基本資料
            // 注意：這裡假設後端回傳的 responseData 包含 user 物件 (內含 className, name, studentId)
            if (responseData.user) {
                document.getElementById('query-display-class').textContent = responseData.user.className || '無資料';
                document.getElementById('query-display-name').textContent = responseData.user.name || '無資料';
                document.getElementById('query-display-student-id').textContent = responseData.user.studentId || '無資料';
            }

            // 切換畫面
            passwordStage.classList.add('hidden');
            queryResultStage.classList.remove('hidden');

            // 渲染打卡清單
            if (!responseData.records || responseData.records.length === 0) {
                historyListContainer.innerHTML = '<p style="padding:20px;">尚無任何打卡紀錄。</p>';
            } else {
                // 使用 map 產生列表，建議同樣對 rec.checkinDate 等內容做基本保護
                historyListContainer.innerHTML = responseData.records.map(rec => `
                    <div style="padding: 12px; border-bottom: 1px solid #eee; text-align: left;">
                        📅 <strong>日期：</strong>${rec.checkinDate}<br>
                        ⏰ <strong>節次：</strong>${rec.section}
                    </div>
                `).join('');
            }
        } else {
            passwordError.textContent = `查詢失敗: ${responseData.message || '密語錯誤'}`;
        }
    } catch (error) {
        console.error("Query Error:", error);
        passwordError.textContent = '系統連線異常，請稍後再試。';
    }
};

window.closeQuery = function() {
    queryResultStage.classList.add('hidden');
    passwordStage.classList.remove('hidden');
};

// ==========================================================
// 6. 介面導航與模式切換
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
};

// ==========================================================
// 7. 建檔與打卡核心邏輯
// ==========================================================
if (infoForm) {
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
}

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
    // 隱藏所有輸入舞台
    passwordStage.classList.add('hidden');
    infoStage.classList.add('hidden');
    batchStage.classList.add('hidden');
    queryResultStage.classList.add('hidden');
    
    // 顯示成功舞台
    successStage.classList.remove('hidden');

    document.getElementById('display-class').textContent = data.className || 'N/A';
    document.getElementById('display-name').textContent = data.name || 'N/A';
    document.getElementById('display-student-id').textContent = data.studentId || 'N/A';
    
    // 處理日期顯示 (單次 vs 批量)
    const dateElement = document.getElementById('display-date');
    if (Array.isArray(data.checkInDate)) {
        dateElement.innerHTML = `
            <span style="color: #007bff; font-weight: bold;">[批量共 ${data.checkInDate.length} 筆]</span><br>
            <div style="font-size: 0.9em; max-height: 100px; overflow-y: auto; background: #f9f9f9; padding: 5px; border-radius: 4px;">
                ${data.checkInDate.join(', ')}
            </div>`;
    } else {
        dateElement.textContent = data.checkInDate || 'N/A';
    }

    document.getElementById('display-section').textContent = data.section || 'N/A';
    document.getElementById('display-timestamp').textContent = new Date().toLocaleTimeString('zh-TW', { hour12: false });
}

// 綁定全域函數 (因 script 是 module)
document.addEventListener('DOMContentLoaded', initializeMode);
window.checkPassword = checkPassword;
window.resetData = resetData;
window.showInfoStage = showInfoStage;
window.toggleManualMode = toggleManualMode;
window.removeDate = removeDate;
window.addDateToList = addDateToList;
window.queryHistory = queryHistory;
window.closeQuery = closeQuery;
window.showBatchStage = showBatchStage;
window.closeBatchStage = closeBatchStage;
window.submitBatchCheckIn = submitBatchCheckIn;




