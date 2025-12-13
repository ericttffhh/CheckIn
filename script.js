// ==========================================================
// 1. Firebase SDK 導入與配置
// ==========================================================
// 注意：由於 HTML 中使用了 type="module"，這裡的 import 必須使用完整路徑
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js"; 

// ❗❗❗❗ 請將以下替換為您的 Firebase 專案配置 ❗❗❗❗
const firebaseConfig = {
    apiKey: "AIzaSyCqS2W49BcSvQV5XwKDPfb7HKeQp5-pO9c", // 請確認這個金鑰是否正確
    authDomain: "classcheckinsystem.firebaseapp.com",
    projectId: "classcheckinsystem",
    storageBucket: "classcheckinsystem.firebasestorage.app",
    messagingSenderId: "592387609788",
    appId: "1:592387609788:web:4f00a7fa9653b00fa8acb9"
};

// 初始化 Firebase 應用程式和 Functions
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app, 'us-central1'); 

// 獲取 Callable Functions 的參考
const secureUserSignup = httpsCallable(functions, 'secureUserSignup');
// ❗ 關鍵修正：secureCheckIn 已改為 HTTP Function，不再是 Callable ❗
// const secureCheckIn = httpsCallable(functions, 'secureCheckIn'); 


// ==========================================================
// 2. DOM 元素獲取與通用變數
// ==========================================================
const passwordStage = document.getElementById('password-stage');
const infoStage = document.getElementById('info-stage');
const successStage = document.getElementById('success-stage');
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
    let cleanString = String(input).trim();
    cleanString = cleanString.replace(/&/g, '&amp;')
                             .replace(/</g, '&lt;')
                             .replace(/>/g, '&gt;')
                             .replace(/"/g, '&quot;')
                             .replace(/'/g, '&#x27;')
                             .replace(/\//g, '&#x2F;');
    return cleanString;
}


// ==========================================================
// 4. 頁面導航與模式切換函數
// ==========================================================

function initializeMode() {
    // 初始化日期輸入框為今天
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    manualDateInput.value = `${y}-${m}-${d}`;
    
    document.querySelector('.mode-switch-button').textContent = '切換節次模式';
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
        autoSectionStatus.innerHTML = '🔴 **目前模式：手動節次選擇 (可複選)**';
        autoSectionStatus.style.color = '#dc3545';
        switchButton.textContent = '切換回自動節次模式';
    } else {
        manualSectionStage.classList.add('hidden');
        autoSectionStatus.innerHTML = '🟢 **目前模式：自動節次判斷**';
        autoSectionStatus.style.color = '#28a745';
        switchButton.textContent = '切換節次模式';
        document.querySelectorAll('input[name="manual_section"]').forEach(checkbox => {
            checkbox.checked = false;
        });
    }
    passwordError.textContent = '';
};


// ==========================================================
// 5. 處理新使用者建檔 (secureUserSignup)
// ==========================================================

infoForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    passwordError.textContent = ''; // 清除舊錯誤

    const password = document.getElementById('personal-password-input').value.trim(); // 確保去除前後空白
    const classValue = document.getElementById('class-input').value.trim();
    const name = document.getElementById('name-input').value.trim();
    const studentId = document.getElementById('student-id-input').value.trim();
    
    // ❗ 關鍵修正：檢查所有欄位是否為空 ❗
    if (!password || !classValue || !name || !studentId) {
        passwordError.textContent = '請填寫所有建檔欄位 (密語、班級、姓名、學號)！';
        return;
    }
    
    // 密語長度檢查
    if (password.length < 6) {
        passwordError.textContent = '密語長度必須至少為 6 位數。';
        return;
    }

    const signupData = { 
        password: sanitizeInput(password), 
        className: sanitizeInput(classValue),
        name: sanitizeInput(name),
        studentId: sanitizeInput(studentId).toUpperCase()
    };
    
    console.log('--- 準備提交建檔資料 ---');
    console.log(signupData);

    try {
        // 使用 httpsCallable 呼叫 secureUserSignup
        const response = await secureUserSignup(signupData); 
        const result = response.data; // Callable Function 的結果在 response.data 中

        if (result && result.success) { 
            console.log('建檔成功，準備打卡...');
            // 由於建檔成功，直接用該密語進行第一次打卡
            await performCheckIn(signupData.password); 

        } else {
            // Function 執行失敗，顯示後端返回的錯誤訊息
            const errorMsg = result ? (result.message || '學號重複或密語太短') : '伺服器響應失敗';
            passwordError.textContent = `建檔失敗: ${errorMsg}。請檢查學號是否已存在。`;
            console.error('建檔失敗詳情:', response);
        }

    } catch (error) {
        // 處理網路錯誤或 Function 內部拋出的錯誤
        passwordError.textContent = `操作失敗: ${error.message || '請檢查網路連線。'}`;
        console.error('Function 呼叫錯誤:', error);
    }
});

// ==========================================================
// 6. 處理密語打卡 (secureCheckIn)
// ==========================================================

window.checkPassword = function() {
    const password = passwordInput.value;
    passwordError.textContent = '';
    
    if (!password) {
        passwordError.textContent = '請輸入專屬密語。';
        return;
    }
    
    performCheckIn(password);
};

async function performCheckIn(password) {
    const sections = getSectionsToCheckIn();
    const date = isManualMode ? manualDateInput.value : null;

    if (isManualMode && (!date || sections.length === 0)) {
        passwordError.textContent = '手動模式下，請選擇日期和至少一個節次。';
        return;
    }
    
    // 這是實際傳遞給 HTTP Function 的 payload
    const checkinDataPayload = { 
        password: sanitizeInput(password),
        sections: sections, 
        date: date          
    };

    try {
        // ❗ 關鍵修正：使用標準 fetch 呼叫 HTTP Function ❗
        const response = await fetch('https://us-central1-classcheckinsystem.cloudfunctions.net/secureCheckIn', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // 必須將 payload 包裝在 'data' 屬性中，以符合後端解析 (req.body.data)
            body: JSON.stringify({ data: checkinDataPayload }) 
        });
        
        // 解析 JSON 響應
        const result = await response.json(); 

        if (response.ok && result && result.success) { // 檢查 HTTP 狀態碼和結果
            displaySuccess(result); 
        } else {
            // 處理非 200 狀態碼或 success: false 的情況
            const errorMsg = result ? (result.message || '密語無效或系統錯誤') : '伺服器響應失敗';
            passwordError.textContent = `打卡失敗: ${errorMsg}。請確認密語是否正確。`;
            console.error('打卡失敗詳情:', result);
        }

    } catch (error) {
        passwordError.textContent = `操作失敗: ${error.message || '請檢查網路連線或密語。'}`;
        console.error('Function 呼叫錯誤:', error);
    }
}

function getSectionsToCheckIn() {
    if (!isManualMode) {
        // 在自動模式下，您可以根據時間邏輯返回當前節次，
        // 這裡為了保持簡單，我們先讓後端處理，但前端仍需傳遞一個空陣列
        // 如果您有前端時間判斷邏輯，請在這裡實作。
        return []; 
    }
    
    const selectedSections = [];
    document.querySelectorAll('input[name="manual_section"]:checked').forEach(checkbox => {
        selectedSections.push(sanitizeInput(checkbox.value)); 
    });
    return selectedSections;
}


// ==========================================================
// 7. 顯示成功結果
// ==========================================================

function displaySuccess(data) {
    passwordStage.classList.add('hidden');
    infoStage.classList.add('hidden');
    successStage.classList.remove('hidden');

    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-TW', { hour12: false });
    
    document.getElementById('display-class').textContent = data.className || 'N/A';
    document.getElementById('display-name').textContent = data.name || 'N/A';
    document.getElementById('display-student-id').textContent = data.studentId || 'N/A';
    
    document.getElementById('display-date').textContent = data.checkInDate || 'N/A';
    document.getElementById('display-section').textContent = data.section || 'N/A';
    document.getElementById('display-timestamp').textContent = timeString; 

    passwordInput.value = ''; 
}

// ==========================================================
// 8. 腳本初始化與事件綁定
// ==========================================================

document.addEventListener('DOMContentLoaded', initializeMode);

window.checkPassword = checkPassword;
window.resetData = resetData;
window.showInfoStage = showInfoStage;
window.toggleManualMode = toggleManualMode;
