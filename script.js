// 引入 Firebase SDK 模組
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, addDoc, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";


// ❗❗❗❗ Firebase 專案配置 ❗❗❗❗
// 請確認此處的配置資訊與您的 Firebase 專案一致。
const firebaseConfig = {
    apiKey: "AIzaSyCqS2W49BcSvQV5XwKDPfb7HKeQp5-pO9c",
    authDomain: "classcheckinsystem.firebaseapp.com",
    projectId: "classcheckinsystem",
    storageBucket: "classcheckinsystem.firebasestorage.app",
    messagingSenderId: "592387609788",
    appId: "1:592387609788:web:4f00a7fa9653b00fa8acb9"
};

// 初始化 Firebase 應用程式和 Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const studentsCol = collection(db, "students"); // 學生建檔資料集合
const checkinsCol = collection(db, "checkins"); // 打卡紀錄集合

// --- 常數設定 ---
const CORRECT_PASSWORD = "class2025"; 

// 課程節次時間表 (請依您的實際課程時間補齊)
const SECTION_TIMES = [
    { hour: 8, minute: 10, name: "第 1 節 (08:10)" },
    { hour: 9, minute: 0, name: "第 2 節 (09:00)" },
    { hour: 10, minute: 10, name: "第 3 節 (10:10)" },
    { hour: 11, minute: 0, name: "第 4 節 (11:00)" },
    { hour: 12, minute: 0, name: "午休 (12:00)" },
    { hour: 13, minute: 20, name: "第 5 節 (13:20)" },
    { hour: 14, minute: 10, name: "第 6 節 (14:10)" },
    { hour: 15, minute: 20, name: "第 7 節 (15:20)" },
    { hour: 16, minute: 10, name: "第 8 節 (16:10)" },
    { hour: 17, minute: 0, name: "放學/課後 (17:00)" } // 確保有結束時間
];

// --- 輔助函數 ---
/**
 * 根據當前時間自動判斷節次。
 */
function getSectionByTime() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    let currentSection = "尚未開始上課";

    for (let i = 0; i < SECTION_TIMES.length; i++) {
        const section = SECTION_TIMES[i];
        const sectionTimeInMinutes = section.hour * 60 + section.minute;

        if (currentTimeInMinutes >= sectionTimeInMinutes) {
             currentSection = section.name; 
        } else {
            break;
        }
    }
    
    // 檢查是否所有節次都已結束
    const firstSectionTimeInMinutes = SECTION_TIMES[0].hour * 60 + SECTION_TIMES[0].minute;
    const lastSectionTimeInMinutes = SECTION_TIMES[SECTION_TIMES.length - 1].hour * 60 + SECTION_TIMES[SECTION_TIMES.length - 1].minute;

    if (currentTimeInMinutes < firstSectionTimeInMinutes) {
        return "尚未開始上課";
    } else if (currentTimeInMinutes >= lastSectionTimeInMinutes) {
        return "已下課 (本日課程結束)";
    }
    
    return currentSection;
}

/**
 * 將打卡紀錄寫入 Firestore。
 */
async function recordCheckIn(studentInfo) {
    const currentSection = getSectionByTime();
    
    const checkInRecord = {
        studentId: studentInfo.studentId,
        className: studentInfo.className,
        name: studentInfo.name,
        section: currentSection,
        timestamp: serverTimestamp() // 使用 Firebase 伺服器時間戳記 (準確標記日期時間)
    };

    try {
        // 將紀錄新增到 checkins 集合
        await addDoc(checkinsCol, checkInRecord);
        return true;
    } catch (error) {
        console.error("寫入打卡紀錄失敗: ", error);
        return false;
    }
}


/**
 * 顯示打卡成功畫面並填入資料。
 */
function showSuccessStage(studentInfo) {
    document.getElementById('password-stage').classList.add('hidden');
    document.getElementById('info-stage').classList.add('hidden');

    const successStage = document.getElementById('success-stage');
    successStage.classList.remove('hidden');
    
    const now = new Date();
    const currentSection = getSectionByTime();
    // 顯示完整的日期和星期幾
    const dateString = now.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
    const timeString = now.toLocaleTimeString('zh-TW', { hour12: false });

    document.getElementById('display-class').textContent = studentInfo.className;
    document.getElementById('display-name').textContent = studentInfo.name;
    document.getElementById('display-student-id').textContent = studentInfo.studentId;
    document.getElementById('display-date').textContent = dateString; 
    document.getElementById('display-section').textContent = currentSection;
    document.getElementById('display-timestamp').textContent = timeString; 

    // 重設提示狀態 (因為已經自動上傳到 Firebase)
    document.getElementById('upload-status').textContent = "本次打卡紀錄已自動傳送至雲端。";
    document.getElementById('upload-status').style.color = 'green';
    document.getElementById('upload-button').disabled = false;
}


// --- 主要邏輯函數 ---

/**
 * 檢查通關密語並根據是否建檔執行不同動作 (使用 Firestore 檢查)。
 */
export async function checkPassword() {
    const passwordInput = document.getElementById('password-input').value;
    const errorDisplay = document.getElementById('password-error');
    const passwordStage = document.getElementById('password-stage');
    
    errorDisplay.textContent = ''; 

    if (passwordInput !== CORRECT_PASSWORD) {
        errorDisplay.textContent = "通關密語錯誤，請再試一次！";
        return;
    }
    
    passwordStage.classList.add('hidden');
    
    // 檢查 Local Storage 是否有學號快取 (減少 Firestore 讀取次數)
    const savedStudentId = localStorage.getItem('studentIdCache');

    if (savedStudentId) {
        // 【已建檔 (有快取)】: 嘗試從 Firestore 獲取完整資料
        const studentDocRef = doc(db, "students", savedStudentId);
        const studentDoc = await getDoc(studentDocRef);

        if (studentDoc.exists()) {
            const studentInfo = studentDoc.data();
            // 自動打卡成功並將紀錄寫入 Firestore
            const success = await recordCheckIn(studentInfo); 
            if (success) {
                showSuccessStage(studentInfo);
            } else {
                alert("打卡失敗，無法連線至資料庫！請檢查您的網路或 Firebase 權限設定。");
                passwordStage.classList.remove('hidden'); // 失敗則返回密碼頁面
            }
        } else {
            // 快取失效，要求重新建檔
            localStorage.removeItem('studentIdCache');
            document.getElementById('info-stage').classList.remove('hidden');
        }

    } else {
        // 【未建檔】: 顯示填寫表單。
        document.getElementById('info-stage').classList.remove('hidden');
    }
}


/**
 * 處理學生資料表單提交 (建檔)，將資料寫入 Firestore。
 */
document.getElementById('info-form').addEventListener('submit', async function(e) {
    e.preventDefault(); 

    const className = document.getElementById('class-input').value.trim();
    const name = document.getElementById('name-input').value.trim();
    const studentId = document.getElementById('student-id-input').value.trim().toUpperCase();
    
    const studentInfo = { className, name, studentId };
    
    // 將資料存入 Firestore (以學號為文件ID)
    try {
        await setDoc(doc(db, "students", studentId), studentInfo);
        localStorage.setItem('studentIdCache', studentId); // 快取學號到本地
        
        // 立即執行打卡動作並寫入紀錄
        await recordCheckIn(studentInfo);
        
        // 顯示打卡成功畫面
        showSuccessStage(studentInfo);
    } catch (error) {
        console.error("寫入學生資料失敗: ", error);
        alert("資料庫寫入失敗，請檢查網路或專案設定。");
    }
});


/**
 * 確認資料已即時上傳 (取代模擬上傳功能)。
 */
export function confirmUpload() {
    // 由於 recordCheckIn 已自動寫入，此函數僅用於重新確認。
    const uploadStatus = document.getElementById('upload-status');
    uploadStatus.textContent = `✅ 紀錄已即時傳送至雲端 (無需重複操作)。`;
    uploadStatus.style.color = 'green';
}


/**
 * 清除本地快取資料。
 */
export function resetData() {
    if (confirm("確定要清除瀏覽器中您的學號快取嗎？ (下次開啟需要重新輸入資料)")) {
        localStorage.removeItem('studentIdCache');
        alert("本地快取已清除。請刷新頁面重新開始。");
        window.location.reload();
    }
}

// 由於使用了 type="module"，需要將函數綁定到 window，以確保 HTML 中的 onclick 能夠呼叫到。
window.checkPassword = checkPassword;
window.confirmUpload = confirmUpload;
window.resetData = resetData;