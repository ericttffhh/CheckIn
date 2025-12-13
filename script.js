// ==========================================================
// 1. 設置您的 Cloud Functions URL
// 請將以下 URL 替換為您實際部署的 Functions URL！
// ==========================================================
const SIGNUP_URL = 'https://secureusersignup-ncl2p7i3za-uc.a.run.app'; // <--- 替換成您自己的 URL
const CHECKIN_URL = 'https://YOUR_SECURE_CHECKIN_URL'; // <--- 替換成您自己的 secureCheckIn URL

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
// 3. 頁面導航與模式切換
// ----------------------------------------------------------

/** 顯示建檔頁面 */
window.showInfoStage = function() {
    passwordStage.classList.add('hidden');
    infoStage.classList.remove('hidden');
    passwordError.textContent = ''; // 清除錯誤
};

/** 重置並返回打卡介面 */
window.resetData = function() {
    passwordStage.classList.remove('hidden');
    infoStage.classList.add('hidden');
    successStage.classList.add('hidden');
    passwordInput.value = ''; // 清空密語輸入框
    infoForm.reset();         // 清空建檔表單
    passwordError.textContent = '';
};

/** 切換自動/手動節次模式 */
window.toggleManualMode = function() {
    isManualMode = !isManualMode;
    if (isManualMode) {
        manualSectionStage.classList.remove('hidden');
        autoSectionStatus.innerHTML = '🟡 **目前模式：手動選擇節次**';
        autoSectionStatus.style.color = '#ffc107';
        // 預設日期為今天
        manualDateInput.valueAsDate = new Date(); 
    } else {
        manualSectionStage.classList.add('hidden');
        autoSectionStatus.innerHTML = '🟢 **目前模式：自動節次判斷**';
        autoSectionStatus.style.color = '#28a745';
        // 取消所有手動勾選
        document.querySelectorAll('input[name="manual_section"]').forEach(checkbox => {
            checkbox.checked = false;
        });
    }
    passwordError.textContent = ''; // 模式切換時清除錯誤
};


// ----------------------------------------------------------
// 4. 處理新使用者建檔 (呼叫 secureUserSignup Function)
// ----------------------------------------------------------

infoForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    passwordError.textContent = ''; // 清除錯誤訊息

    const password = document.getElementById('personal-password-input').value;
    const classValue = document.getElementById('class-input').value;
    const name = document.getElementById('name-input').value;
    const studentId = document.getElementById('student-id-input').value;
    
    // 基本前端驗證
    if (password.length < 6) {
        passwordError.textContent = '密語長度必須至少為 6 位數。';
        return;
    }

    try {
        // 發送 POST 請求到 secureUserSignup Function
        const response = await fetch(SIGNUP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                password: password, 
                class: classValue, 
                name: name,
                studentId: studentId 
            })
        });

        const result = await response.json();

        if (response.ok) {
            // 建檔成功，執行一次打卡
            console.log('建檔成功，準備打卡...', result);
            // 成功註冊後，立即用這個密碼進行一次打卡
            // 注意：這裡假設註冊 Function 成功後會返回一個 Token 或狀態，
            // 簡單起見，我們直接使用註冊的密語進行後續打卡 Function 呼叫。
            await performCheckIn(password, { 
                name: name, 
                class: classValue, 
                studentId: studentId 
            });

        } else {
            // 建檔失敗 (例如學號重複)
            passwordError.textContent = `建檔失敗: ${result.error || '未知錯誤'}`;
            console.error('建檔失敗詳情:', result);
        }

    } catch (error) {
        passwordError.textContent = '網路請求失敗，請檢查網路連線。';
        console.error('網路請求錯誤:', error);
    }
});

// ----------------------------------------------------------
// 5. 處理密語打卡 (呼叫 secureCheckIn Function)
// ----------------------------------------------------------

window.checkPassword = function() {
    const password = passwordInput.value;
    passwordError.textContent = ''; // 清除錯誤訊息
    
    if (!password) {
        passwordError.textContent = '請輸入專屬密語。';
        return;
    }
    
    // 呼叫打卡 Function
    performCheckIn(password);
};

/** 執行打卡的核心邏輯 */
async function performCheckIn(password, userData = null) {
    const sections = getSectionsToCheckIn();
    const date = isManualMode ? manualDateInput.value : null;

    if (isManualMode && (!date || sections.length === 0)) {
        passwordError.textContent = '手動模式下，請選擇日期和至少一個節次。';
        return;
    }

    try {
        const response = await fetch(CHECKIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                password: password,
                sections: sections, // 傳遞節次陣列
                date: date          // 傳遞手動日期 (如果非自動模式)
            })
        });

        const result = await response.json();

        if (response.ok) {
            // 打卡成功
            displaySuccess(result);
        } else {
            // 打卡失敗 (例如密語錯誤、非打卡時間、已打卡等)
            passwordError.textContent = `打卡失敗: ${result.error || '密語無效或系統錯誤'}`;
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
        selectedSections.push(checkbox.value);
    });
    return selectedSections;
}

// ----------------------------------------------------------
// 6. 顯示成功結果
// ----------------------------------------------------------

function displaySuccess(data) {
    passwordStage.classList.add('hidden');
    infoStage.classList.add('hidden');
    successStage.classList.remove('hidden');

    // 填充結果資訊
    document.getElementById('display-class').textContent = data.class || 'N/A';
    document.getElementById('display-name').textContent = data.name || 'N/A';
    document.getElementById('display-student-id').textContent = data.studentId || 'N/A';
    
    // 顯示 Function 返回的打卡詳細資訊
    document.getElementById('display-date').textContent = data.checkInDate || 'N/A';
    document.getElementById('display-section').textContent = data.section || 'N/A';
    document.getElementById('display-timestamp').textContent = data.timestamp || new Date().toLocaleString('zh-TW');

    passwordInput.value = ''; // 成功後清空密語
}
