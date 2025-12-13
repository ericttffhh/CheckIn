// ==========================================================
// 1. 設置您的 Cloud Functions URL
// 請將以下 URL 替換為您實際部署的 Functions URL！
// ==========================================================
const SIGNUP_URL = 'https://secureusersignup-ncl2p7i3za-uc.a.run.app'; 
const CHECKIN_URL = 'https://securecheckin-ncl2p7i3za-uc.a.run.app'; // <-- ❗❗ 請務必替換為 secureCheckIn 的實際 URL

// ----------------------------------------------------------
// 2. 獲取 DOM 元素
// ----------------------------------------------------------
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

// ----------------------------------------------------------
// 3. 核心安全防禦函數 (保持不變)
// ----------------------------------------------------------

/**
 * 淨化輸入字串，轉義潛在的 HTML 標籤符號，防止 XSS 攻擊。
 */
function sanitizeInput(input) {
    if (!input) return '';
    let cleanString = String(input).trim();
    // 轉義 HTML 特殊字符
    cleanString = cleanString.replace(/&/g, '&amp;')
                             .replace(/</g, '&lt;')
                             .replace(/>/g, '&gt;')
                             .replace(/"/g, '&quot;')
                             .replace(/'/g, '&#x27;')
                             .replace(/\//g, '&#x2F;');
    return cleanString;
}

// ----------------------------------------------------------
// 4. 頁面導航與模式切換函數
// ----------------------------------------------------------

/** 頁面載入時的初始化函數，確保 UI 狀態正確 */
function initializeMode() {
    // 設置手動日期的預設值為今天
    const today = new Date();
    // 格式化日期為 YYYY-MM-DD
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    manualDateInput.value = `${y}-${m}-${d}`;
    
    document.querySelector('.mode-switch-button').textContent = '切換節次模式';
}

/** 顯示建檔頁面 */
window.showInfoStage = function() {
    passwordStage.classList.add('hidden');
    infoStage.classList.remove('hidden');
    passwordError.textContent = '';
};

/** 重置並返回打卡介面 (重新載入頁面確保狀態清除) */
window.resetData = function() {
    window.location.reload(); 
};

/** 切換自動/手動節次模式 */
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
        // 取消所有手動勾選
        document.querySelectorAll('input[name="manual_section"]').forEach(checkbox => {
            checkbox.checked = false;
        });
    }
    passwordError.textContent = '';
};


// ----------------------------------------------------------
// 5. 處理新使用者建檔 (呼叫 secureUserSignup Function)
// ----------------------------------------------------------

infoForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    passwordError.textContent = '';

    // 讀取原始輸入
    const password = document.getElementById('personal-password-input').value;
    const classValue = document.getElementById('class-input').value;
    const name = document.getElementById('name-input').value;
    const studentId = document.getElementById('student-id-input').value;
    
    // 基本前端驗證
    if (password.length < 6) {
        passwordError.textContent = '密語長度必須至少為 6 位數。';
        return;
    }

    // 進行淨化
    const safeInfo = { 
        password: sanitizeInput(password), 
        className: sanitizeInput(classValue), // 建議使用 className
        name: sanitizeInput(name),
        studentId: sanitizeInput(studentId).toUpperCase()
    };

    try {
        // ❗ 關鍵修正：將參數包裝在 'data' 物件中
        const response = await fetch(SIGNUP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                data: safeInfo // <--- 修正後的傳輸格式
            })
        });

        const result = await response.json();

        if (response.ok) {
            console.log('建檔成功，準備打卡...');
            // 建檔成功後，立即使用該密語進行打卡
            await performCheckIn(safeInfo.password, result.data);

        } else {
            // 建檔失敗 (Function 返回錯誤，如學號重複、格式錯誤)
            const errorMsg = result.error ? (result.error.message || '未知錯誤') : '伺服器響應失敗';
            passwordError.textContent = `建檔失敗: ${errorMsg}。請檢查學號是否已存在。`;
            console.error('建檔失敗詳情:', result);
        }

    } catch (error) {
        passwordError.textContent = '網路請求失敗，請檢查網路連線。';
        console.error('網路請求錯誤:', error);
    }
});

// ----------------------------------------------------------
// 6. 處理密語打卡 (呼叫 secureCheckIn Function)
// ----------------------------------------------------------

window.checkPassword = function() {
    const password = passwordInput.value;
    passwordError.textContent = '';
    
    if (!password) {
        passwordError.textContent = '請輸入專屬密語。';
        return;
    }
    
    // 呼叫打卡 Function
    performCheckIn(password);
};

/** 執行打卡的核心邏輯 */
async function performCheckIn(password, signupData = null) {
    const sections = getSectionsToCheckIn();
    const date = isManualMode ? manualDateInput.value : null;

    if (isManualMode && (!date || sections.length === 0)) {
        passwordError.textContent = '手動模式下，請選擇日期和至少一個節次。';
        return;
    }
    
    // 進行淨化
    const safePassword = sanitizeInput(password);

    try {
        // ❗ 關鍵修正：將參數包裝在 'data' 物件中
        const response = await fetch(CHECKIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                data: { // <--- 修正後的傳輸格式
                    password: safePassword,
                    sections: sections, 
                    date: date          
                }
            })
        });

        const result = await response.json();

        if (response.ok) {
            // 打卡成功，Function 返回的 data 包含打卡和用戶資訊
            displaySuccess(result.data); 
        } else {
            // 打卡失敗
            const errorMsg = result.error ? (result.error.message || '未知錯誤') : '伺服器響應失敗';
            passwordError.textContent = `打卡失敗: ${errorMsg}。請確認密語是否正確。`;
            console.error('打卡失敗詳情:', result);
        }

    } catch (error) {
        passwordError.textContent = '打卡請求失敗，請檢查網路連線。';
        console.error('打卡請求錯誤:', error);
    }
}

/** 獲取要打卡的節次列表 */
function getSectionsToCheckIn() {
    if (!isManualMode) {
        return []; // 自動模式下，Functions 會自動判斷
    }
    
    const selectedSections = [];
    document.querySelectorAll('input[name="manual_section"]:checked').forEach(checkbox => {
        // 對手動節次進行簡單淨化
        selectedSections.push(sanitizeInput(checkbox.value)); 
    });
    return selectedSections;
}

// ----------------------------------------------------------
// 7. 顯示成功結果
// ----------------------------------------------------------

/** * 顯示打卡成功畫面
 * @param {object} data - 來自 Function 的成功響應數據 (包含用戶和打卡資訊)
 */
function displaySuccess(data) {
    passwordStage.classList.add('hidden');
    infoStage.classList.add('hidden');
    successStage.classList.remove('hidden');

    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-TW', { hour12: false });
    
    // 填充結果資訊 (使用 Function 返回的數據)
    // 假設 Function 返回的數據包含 className, name, studentId, checkInDate, section
    
    document.getElementById('display-class').textContent = data.className || 'N/A';
    document.getElementById('display-name').textContent = data.name || 'N/A';
    document.getElementById('display-student-id').textContent = data.studentId || 'N/A';
    
    // 顯示 Function 返回的打卡詳細資訊
    document.getElementById('display-date').textContent = data.checkInDate || 'N/A';
    document.getElementById('display-section').textContent = data.section || 'N/A';
    document.getElementById('display-timestamp').textContent = timeString; // 使用本地時間作為顯示時間

    passwordInput.value = ''; 
}

// ----------------------------------------------------------
// 8. 腳本初始化與事件綁定
// ----------------------------------------------------------

document.addEventListener('DOMContentLoaded', initializeMode);

// 將函數綁定到 window 供 HTML 內聯調用
window.checkPassword = checkPassword;
window.resetData = resetData;
window.showInfoStage = showInfoStage;
window.toggleManualMode = toggleManualMode;
