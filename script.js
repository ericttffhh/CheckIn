// 引入 Firebase SDK 模組 (已升級並統一版本 v10.12.2)
import { 
    initializeApp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    addDoc, 
    serverTimestamp, 
    query, 
    where, 
    getDocs,
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ❗❗❗❗ 請將以下替換為您的 Firebase 專案配置 ❗❗❗❗
const firebaseConfig = {
    apiKey: "AIzaSyCqS2W49BcSvQV5XwKDPfb7HKeQp5-pO9c", // 請確認這是否為您的金鑰
    authDomain: "classcheckinsystem.firebaseapp.com",
    projectId: "classcheckinsystem",
    storageBucket: "classcheckinsystem.firebasestorage.app",
    messagingSenderId: "592387609788",
    appId: "1:592387609788:web:4f00a7fa9653b00fa8acb9"
};


// 初始化 Firebase 應用程式和 Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const studentsCol = collection(db, "users"); // 學生建檔資料集合
const checkinsCol = collection(db, "checkins"); // 打卡紀錄集合

// 課程節次時間表 (用於自動判斷)
const SECTION_TIMES = [
    { hour: 8, minute: 10, name: "第 1 節 " },
    { hour: 9, minute: 0, name: "第 2 節 " },
    { hour: 10, minute: 10, name: "第 3 節 " },
    { hour: 11, minute: 0, name: "第 4 節 " },
    { hour: 12, minute: 0, name: "午休 " },
    { hour: 13, minute: 10, name: "第 5 節 " },
    { hour: 14, minute: 10, name: "第 6 節 " },
    { hour: 15, minute: 10, name: "第 7 節 " },
    { hour: 16, minute: 10, name: "第 8 節 " },
    { hour: 17, minute: 0, name: "放學/課後 (17:00)" }
];


// 手動模式狀態變數
let isManualMode = false; // 預設為 FALSE

// ----------------------------------------------------------------------
// ❗ 核心安全防禦函數：防止 XSS 攻擊
// ----------------------------------------------------------------------
/**
 * 淨化輸入字串，轉義潛在的 HTML 標籤符號，防止 XSS 攻擊。
 * 這會將 < 轉換成 &lt;，> 轉換成 &gt;，確保瀏覽器不會將其解析為 HTML。
 * @param {string} input - 來自使用者輸入的原始字串
 * @returns {string} - 安全的字串
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
// ----------------------------------------------------------------------


// --- 模式與節次函數 (保持不變) ---

/**
 * 格式化日期為 YYYY-MM-DD
 */
function formatDateToISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * 頁面載入時的初始化函數，確保 UI 狀態正確
 */
function initializeMode() {
    const manualStage = document.getElementById('manual-section-stage');
    const statusDisplay = document.getElementById('auto-section-status');
    const switchButton = document.querySelector('.mode-switch-button');
    const manualDateInput = document.getElementById('manual-date-input');

    // 確保隱藏
    manualStage.classList.add('hidden'); 
    
    // 設定手動日期的預設值為今天
    const today = new Date();
    manualDateInput.value = formatDateToISO(today);

    // 確保狀態文字正確
    statusDisplay.innerHTML = '🟢 **目前模式：自動節次判斷**';
    statusDisplay.style.color = '#28a745';
    switchButton.textContent = '切換節次模式';
}

/**
 * 切換手動選擇節次模式的 UI (保持不變)
 */
export function toggleManualMode() {
    isManualMode = !isManualMode;
    const manualStage = document.getElementById('manual-section-stage');
    const statusDisplay = document.getElementById('auto-section-status');
    const switchButton = document.querySelector('.mode-switch-button');

    if (isManualMode) {
        manualStage.classList.remove('hidden');
        statusDisplay.innerHTML = '🔴 **目前模式：手動節次選擇 (可複選)**';
        statusDisplay.style.color = '#dc3545';
        switchButton.textContent = '切換回自動節次模式';
    } else {
        manualStage.classList.add('hidden');
        statusDisplay.innerHTML = '🟢 **目前模式：自動節次判斷**';
        statusDisplay.style.color = '#28a745';
        switchButton.textContent = '切換節次模式';
    }
}


/**
 * 獲取當前自動判斷的節次 (保持不變)
 */
function getSectionByTime() {
    const now = new Date();
    const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();
    
    let currentSection = "尚未開始上課";
    for (const section of SECTION_TIMES) {
        const sectionTimeInMinutes = section.hour * 60 + section.minute;
        if (currentTimeInMinutes >= sectionTimeInMinutes) {
             currentSection = section.name; 
        } else {
            break;
        }
    }
    const firstTime = SECTION_TIMES[0].hour * 60 + SECTION_TIMES[0].minute;
    const lastTime = SECTION_TIMES[SECTION_TIMES.length - 1].hour * 60 + SECTION_TIMES[SECTION_TIMES.length - 1].minute;
    if (currentTimeInMinutes < firstTime) return "尚未開始上課";
    if (currentTimeInMinutes >= lastTime) return "已下課 (本日課程結束)";
    return currentSection;
}


/**
 * 獲取手動選擇的節次列表 (保持不變)
 */
function getManualSections() {
    const checkboxes = document.querySelectorAll('#manual-section-stage input[type="checkbox"]:checked');
    const selectedSections = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedSections.length === 0) {
        alert("您已切換為手動模式，請至少選擇一個節次！");
        return null;
    }
    return selectedSections.join(' | ');
}


/**
 * 根據模式寫入打卡紀錄 (寫入前無需淨化，因為 studentInfo 已被淨化過)
 */
async function recordCheckIn(studentInfo) {
    let sectionToRecord;
    let dateToRecord;
    
    // 獲取節次和日期
    if (isManualMode) {
        sectionToRecord = getManualSections();
        dateToRecord = document.getElementById('manual-date-input').value;
        
        if (!sectionToRecord) return false; 
        if (!dateToRecord) {
            alert("請選擇打卡日期！");
            return false;
        }
    } else {
        sectionToRecord = getSectionByTime();
        dateToRecord = formatDateToISO(new Date());
    }

    const checkInRecord = {
        // studentInfo 包含的資料 (studentId, className, name) 在建檔時已被淨化
        studentId: studentInfo.studentId,
        className: studentInfo.className,
        name: studentInfo.name,
        section: sectionToRecord, 
        checkinDate: dateToRecord, 
        timestamp: serverTimestamp() 
    };
    try {
        await addDoc(checkinsCol, checkInRecord);
        return checkInRecord; 
    } catch (error) {
        console.error("寫入打卡紀錄失敗: ", error);
        return false;
    }
}


/**
 * 顯示打卡成功畫面 (保持不變，因為 `textContent` 是安全的)
 */
function showSuccessStage(studentInfo, record) {
    document.getElementById('password-stage').classList.add('hidden');
    document.getElementById('info-stage').classList.add('hidden');
    const successStage = document.getElementById('success-stage');
    successStage.classList.remove('hidden');
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-TW', { hour12: false });

    const recordDate = new Date(record.checkinDate + 'T00:00:00'); 
    const displayDateString = recordDate.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });


    // ❗ 關鍵：使用 textContent 是安全的，它不會解析 HTML
    document.getElementById('display-class').textContent = studentInfo.className;
    document.getElementById('display-name').textContent = studentInfo.name;
    document.getElementById('display-student-id').textContent = studentInfo.studentId;
    document.getElementById('display-date').textContent = displayDateString; 
    document.getElementById('display-section').textContent = record.section; 
    document.getElementById('display-timestamp').textContent = timeString; 
}


// --- 核心邏輯函數 (保持不變) ---
export function showInfoStage() {
    document.getElementById('password-stage').classList.add('hidden');
    document.getElementById('info-stage').classList.remove('hidden');
    document.getElementById('password-error').textContent = ''; 
}

export async function checkPassword() {
    const passwordInput = document.getElementById('password-input').value;
    const errorDisplay = document.getElementById('password-error');
    const passwordStage = document.getElementById('password-stage');
    
    errorDisplay.textContent = '正在驗證密語...'; 
    
    if (passwordInput.trim() === '') {
        errorDisplay.textContent = "請輸入您的專屬通關密語！";
        passwordStage.classList.remove('hidden');
        return;
    }

    // ❗ 由於密語將用於查詢，為確保一致性，應先淨化
    const safePassword = sanitizeInput(passwordInput);

    const q = query(studentsCol, where("password", "==", safePassword));
    
    try {
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            errorDisplay.textContent = "通關密語錯誤！若您是首次使用，請點擊「我是第一次用！我要建檔」。";
            passwordStage.classList.remove('hidden');
            return;
        }

        const studentDoc = querySnapshot.docs[0];
        // 🚨 警示：如果資料庫中的資料未被淨化，這裡讀出來的 name 仍可能帶有惡意腳本。
        //        雖然 showSuccessStage 使用 textContent 輸出，但為保險起見，應確保資料庫層級的淨化。
        const studentInfo = studentDoc.data(); 
        
        const record = await recordCheckIn(studentInfo); 
        
        if (record) {
            errorDisplay.textContent = '';
            showSuccessStage(studentInfo, record); 
        } else {
            if (!isManualMode) {
                 errorDisplay.textContent = "打卡失敗，無法寫入資料庫！";
            } else {
                 errorDisplay.textContent = "手動模式下必須選擇節次和日期。";
            }
            passwordStage.classList.remove('hidden');
        }

    } catch (error) {
        console.error("打卡驗證失敗: ", error);
        errorDisplay.textContent = "連線失敗，請檢查網路或 Firebase 設定。";
        passwordStage.classList.remove('hidden');
    }
}


/**
 * 處理學生資料表單提交 (建檔)。 
 * ❗ 關鍵修正：對所有輸入欄位進行淨化！
 */
document.getElementById('info-form').addEventListener('submit', async function(e) {
    e.preventDefault(); 

    // 讀取原始輸入
    const personalPassword = document.getElementById('personal-password-input').value;
    const className = document.getElementById('class-input').value;
    const name = document.getElementById('name-input').value;
    const studentId = document.getElementById('student-id-input').value;
    
    if (personalPassword.trim().length < 6) {
        alert("專屬密語必須至少為 6 個字元！");
        return;
    }

    // ❗ 關鍵防禦：在寫入資料庫前對所有欄位進行淨化
    const studentInfo = { 
        password: sanitizeInput(personalPassword), 
        className: sanitizeInput(className), 
        name: sanitizeInput(name), 
        studentId: sanitizeInput(studentId).toUpperCase() // studentId 統一轉大寫
    };
    
    try {
        // 檢查學號是否重複建檔
        const docRef = doc(db, "users", studentInfo.studentId);
        const docSnap = await getDoc(docRef); 
        
        if (docSnap.exists()) {
             alert("此學號已存在建檔紀錄，請確認您的學號是否輸入錯誤，或直接使用密語打卡。");
             return;
        }

        // 寫入淨化後的建檔資料
        await setDoc(docRef, studentInfo);
        
        // 立即打卡
        const record = await recordCheckIn(studentInfo); 
        showSuccessStage(studentInfo, record); 
    } catch (error) {
        console.error("建檔或打卡寫入失敗: ", error);
        alert("資料庫寫入失敗，請檢查網路或專案設定。");
    }
});


/**
 * 清除本地快取資料並返回打卡介面 (重載頁面)。(保持不變)
 */
export function resetData() {
    localStorage.clear();
    window.location.reload();
}


// ❗ 腳本初始化：確保頁面載入後 UI 狀態正確
document.addEventListener('DOMContentLoaded', initializeMode);

// 綁定到 window 
window.checkPassword = checkPassword;
window.resetData = resetData;
window.showInfoStage = showInfoStage;
window.toggleManualMode = toggleManualMode;
