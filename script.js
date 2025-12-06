// 引入 Firebase SDK 模組
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, addDoc, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";


// Your web app's Firebase configuration
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
const studentsCol = collection(db, "users"); // 學生建檔資料集合
const checkinsCol = collection(db, "checkins"); // 打卡紀錄集合

// 課程節次時間表 (保持不變)
const SECTION_TIMES = [
    { hour: 8, minute: 10, name: "第 1 節 (08:10)" },
    { hour: 9, minute: 10, name: "第 2 節 (09:00)" },
    { hour: 10, minute: 10, name: "第 3 節 (10:10)" },
    { hour: 11, minute: 10, name: "第 4 節 (11:00)" },
    { hour: 12, minute: 0, name: "午休 (12:00)" },
    { hour: 13, minute: 10, name: "第 5 節 (13:20)" },
    { hour: 14, minute: 10, name: "第 6 節 (14:10)" },
    { hour: 15, minute: 10, name: "第 7 節 (15:20)" },
    { hour: 16, minute: 10, name: "第 8 節 (16:10)" },
    { hour: 17, minute: 0, name: "放學/課後 (17:00)" }
];

// --- 輔助函數 (保持不變) ---

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
}


// --- 核心邏輯函數 (保持不變) ---

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

    const q = query(studentsCol, where("password", "==", passwordInput));
    
    try {
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            errorDisplay.textContent = "通關密語錯誤！若您是首次使用，請在下方建立您的密語。";
            passwordStage.classList.remove('hidden');
            document.getElementById('info-stage').classList.remove('hidden');
            return;
        }

        const studentDoc = querySnapshot.docs[0];
        const studentInfo = studentDoc.data();
        
        const success = await recordCheckIn(studentInfo); 
        
        if (success) {
            errorDisplay.textContent = '';
            showSuccessStage(studentInfo);
        } else {
            errorDisplay.textContent = "打卡失敗，無法寫入資料庫！";
            passwordStage.classList.remove('hidden');
        }

    } catch (error) {
        console.error("打卡驗證失敗: ", error);
        errorDisplay.textContent = "連線失敗，請檢查網路或 Firebase 設定。";
        passwordStage.classList.remove('hidden');
    }
}


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
        password: personalPassword, 
        className: className, 
        name: name, 
        studentId: studentId 
    };
    
    try {
        await setDoc(doc(db, "users", studentId), studentInfo);
        await recordCheckIn(studentInfo);
        showSuccessStage(studentInfo);
    } catch (error) {
        console.error("建檔或打卡寫入失敗: ", error);
        alert("資料庫寫入失敗，請檢查網路或專案設定。");
    }
});


/**
 * ❗❗ 刪除 'confirmUpload' 函數，因為它已不再有對應按鈕。
 */

/**
 * 清除本地快取資料並返回打卡介面 (重載頁面)。
 */
export function resetData() {
    // 清除本地儲存，確保完全重置狀態
    localStorage.clear();
    // 重載頁面，回到初始密碼輸入畫面
    window.location.reload();
}

// 綁定到 window 
window.checkPassword = checkPassword;
// ❗❗ 移除 window.confirmUpload 綁定
window.resetData = resetData;

