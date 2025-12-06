// 引入 Firebase SDK 模組 (保持不變)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, addDoc, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";


// ❗❗❗❗ Firebase 專案配置 ❗❗❗❗
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
// ⚠️ 學生資料集合名稱改為 'users' 以避免與密碼查詢衝突，但仍以學號為 ID 存入。
const studentsCol = collection(db, "users"); 
const checkinsCol = collection(db, "checkins"); 

// 課程節次時間表 (保持不變)
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
    { hour: 17, minute: 0, name: "放學/課後 (17:00)" }
];

// --- 輔助函數 (getSectionByTime, recordCheckIn, showSuccessStage 邏輯與前一版類似，但 checkPassword 需大改) ---

function getSectionByTime() {
    // (邏輯保持不變，省略細節)
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
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

async function recordCheckIn(studentInfo) {
    const currentSection = getSectionByTime();
    const checkInRecord = {
        studentId: studentInfo.studentId,
        className: studentInfo.className,
        name: studentInfo.name,
        section: currentSection,
        timestamp: serverTimestamp()
    };
    try {
        await addDoc(checkinsCol, checkInRecord);
        return true;
    } catch (error) {
        console.error("寫入打卡紀錄失敗: ", error);
        return false;
    }
}

function showSuccessStage(studentInfo) {
    document.getElementById('password-stage').classList.add('hidden');
    document.getElementById('info-stage').classList.add('hidden');
    const successStage = document.getElementById('success-stage');
    successStage.classList.remove('hidden');
    
    const now = new Date();
    const dateString = now.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
    const timeString = now.toLocaleTimeString('zh-TW', { hour12: false });

    document.getElementById('display-class').textContent = studentInfo.className;
    document.getElementById('display-name').textContent = studentInfo.name;
    document.getElementById('display-student-id').textContent = studentInfo.studentId;
    document.getElementById('display-date').textContent = dateString; 
    document.getElementById('display-section').textContent = getSectionByTime();
    document.getElementById('display-timestamp').textContent = timeString; 

    document.getElementById('upload-status').textContent = "本次打卡紀錄已自動傳送至雲端。";
    document.getElementById('upload-status').style.color = 'green';
    document.getElementById('upload-button').disabled = false;
}


// --- 核心邏輯函數 (重大修改處) ---

/**
 * 檢查通關密語：現在是查詢 Firebase 中是否有該密語綁定的使用者。
 */
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

    // 1. 根據輸入的密語，查詢 Firestore 中是否有匹配的用戶
    const q = query(studentsCol, where("password", "==", passwordInput));
    
    try {
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            // 密語錯誤或未建檔
            errorDisplay.textContent = "通關密語錯誤或尚未建檔！";
            passwordStage.classList.remove('hidden');
            return;
        }

        // 2. 找到用戶，取得資料 (應該只有一個結果)
        const studentDoc = querySnapshot.docs[0];
        const studentInfo = studentDoc.data();
        
        // 3. 執行自動打卡並寫入 Firestore
        const success = await recordCheckIn(studentInfo); 
        
        if (success) {
            // 4. 打卡成功，顯示成功頁面
            showSuccessStage(studentInfo);
        } else {
            // 寫入失敗
            errorDisplay.textContent = "打卡失敗，無法寫入資料庫！";
            passwordStage.classList.remove('hidden');
        }

    } catch (error) {
        console.error("打卡驗證失敗: ", error);
        errorDisplay.textContent = "連線失敗，請檢查網路或 Firebase 設定。";
        passwordStage.classList.remove('hidden');
    }
}


/**
 * 處理學生資料表單提交 (建檔)：將專屬密語和資料一起寫入 Firestore。
 */
document.getElementById('info-form').addEventListener('submit', async function(e) {
    e.preventDefault(); 

    const personalPassword = document.getElementById('personal-password-input').value.trim();
    const className = document.getElementById('class-input').value.trim();
    const name = document.getElementById('name-input').value.trim();
    const studentId = document.getElementById('student-id-input').value.trim().toUpperCase();
    
    if (personalPassword.length < 6) {
        alert("專屬密語必須至少為 6 個字元！");
        return;
    }
    
    const studentInfo = { 
        password: personalPassword, // ❗ 綁定的專屬密語
        className: className, 
        name: name, 
        studentId: studentId 
    };
    
    // 將資料存入 Firestore (以學號為文件ID)
    try {
        await setDoc(doc(db, "users", studentId), studentInfo);
        
        // 立即執行打卡動作並寫入紀錄
        await recordCheckIn(studentInfo);
        
        // 顯示打卡成功畫面
        showSuccessStage(studentInfo);
    } catch (error) {
        console.error("建檔或打卡寫入失敗: ", error);
        alert("資料庫寫入失敗，請檢查網路或專案設定。");
    }
});


/**
 * 確認資料已即時上傳。
 */
export function confirmUpload() {
    const uploadStatus = document.getElementById('upload-status');
    uploadStatus.textContent = `✅ 紀錄已即時傳送至雲端 (無需重複操作)。`;
    uploadStatus.style.color = 'green';
}


/**
 * 清除本地快取資料。 (此功能用於模擬重設，實際應用中不需要)
 */
export function resetData() {
    if (confirm("確定要清除瀏覽器中的資料嗎？ (此功能僅為模擬，不會影響雲端建檔)")) {
        // 清除本地儲存
        localStorage.clear();
        alert("本地資料已清除。請刷新頁面重新開始。");
        window.location.reload();
    }
}

// 綁定到 window
window.checkPassword = checkPassword;
window.confirmUpload = confirmUpload;
window.resetData = resetData;
