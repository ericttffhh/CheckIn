// 引入 Firebase SDK 模組 (已升級並統一版本 v10.12.2)
import { 
    initializeApp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { 
    getFirestore, 
    collection, 
    getDocs, 
    query, 
    where, 
    addDoc, 
    serverTimestamp 
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

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const checkinsCol = collection(db, "checkins"); // 打卡紀錄
const usersCol = collection(db, "users"); // 建檔紀錄


// ----------------------------------------------------------------------
// ❗ 核心安全防禦函數：XSS 輸入淨化 (Input Sanitization) ❗
// ----------------------------------------------------------------------
/**
 * 淨化使用者輸入的字串，將潛在的 HTML 標籤或危險字元轉換為純文字，
 * 防止 XSS 攻擊的 Payload 寫入資料庫。
 * * @param {string} input - 使用者輸入的原始字串
 * @returns {string} - 經過淨化的安全字串
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') {
        // 如果輸入不是字串（如 null, undefined），轉為空字串再處理
        input = String(input || ''); 
    }
    
    // 簡單的淨化策略：
    // 1. 移除前後空白。
    // 2. 替換 < 和 > 為 HTML 實體，防止標籤注入。
    // 3. 替換單引號和雙引號，防止字串逃逸。
    return input.trim()
                .replace(/&/g, '&amp;') // 必須先轉義 & 符號
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .replace(/\//g, '&#x2F;');
}



// ----------------------------------------------------------------------
// I. 建檔相關函數
// ----------------------------------------------------------------------

/**
 * 處理學生建檔
 */
export async function handleUserRegistration() {
    const studentId = sanitizeInput(document.getElementById('reg-student-id').value);
    const name = sanitizeInput(document.getElementById('reg-name').value);
    const className = sanitizeInput(document.getElementById('reg-class-name').value);
    const password = sanitizeInput(document.getElementById('reg-password').value);
    const message = document.getElementById('reg-message');

    message.textContent = ''; // 清除前次訊息

    if (!studentId || !name || !className || !password) {
        message.textContent = "所有欄位都是必填的！";
        message.style.color = 'red';
        return;
    }

    try {
        // 1. 檢查學號是否已存在
        const q = query(usersCol, where("studentId", "==", studentId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            message.textContent = `學號 ${studentId} 已存在建檔中，請勿重複註冊。`;
            message.style.color = 'orange';
            return;
        }

        // 2. 寫入新的建檔紀錄 (已使用 sanitizeInput 淨化過的資料)
        await addDoc(usersCol, {
            studentId: studentId,
            name: name,
            className: className,
            password: password, // 密語已淨化
            createdAt: serverTimestamp()
        });

        message.textContent = `恭喜，學號 ${studentId} - ${name} 建檔成功！您現在可以使用密語進行打卡。`;
        message.style.color = 'green';
        
        // 清空輸入欄位
        document.getElementById('reg-student-id').value = '';
        document.getElementById('reg-name').value = '';
        document.getElementById('reg-class-name').value = '';
        document.getElementById('reg-password').value = '';

    } catch (error) {
        console.error("建檔失敗: ", error);
        message.textContent = "建檔失敗，請檢查網路或聯繫管理員。";
        message.style.color = 'red';
    }
}


// ----------------------------------------------------------------------
// II. 打卡相關函數
// ----------------------------------------------------------------------

/**
 * 處理學生打卡
 */
export async function handleCheckIn() {
    const password = sanitizeInput(document.getElementById('checkin-password').value);
    const section = sanitizeInput(document.getElementById('checkin-section').value);
    const message = document.getElementById('checkin-message');

    message.textContent = ''; // 清除前次訊息

    if (!password || !section) {
        message.textContent = "請輸入密語並選擇節次。";
        message.style.color = 'red';
        return;
    }

    try {
        // 1. 根據密語查詢建檔紀錄 (Users)
        const q = query(usersCol, where("password", "==", password));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            message.textContent = "密語錯誤或尚未建檔。";
            message.style.color = 'red';
            return;
        }
        
        // 密語匹配成功，取得學生的建檔資料
        const userData = querySnapshot.docs[0].data();
        
        // 2. 寫入打卡紀錄 (Checkins)
        const checkinDate = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });

        await addDoc(checkinsCol, {
            studentId: userData.studentId,
            name: userData.name,
            className: userData.className,
            section: section,
            checkinDate: checkinDate, // 僅記錄日期 (YYYY/MM/DD)
            timestamp: serverTimestamp() // 資料庫寫入時間
        });

        message.textContent = `${userData.name} (${userData.studentId})，第 ${section} 節打卡成功！`;
        message.style.color = 'green';
        
        // 清空密語輸入欄位
        document.getElementById('checkin-password').value = '';

    } catch (error) {
        console.error("打卡失敗: ", error);
        message.textContent = "打卡失敗，請檢查網路或聯繫管理員。";
        message.style.color = 'red';
    }
}


// ----------------------------------------------------------------------
// III. 全局綁定
// ----------------------------------------------------------------------

// ❗ 確保這些函數可以被 HTML 中的 onclick 調用
window.handleUserRegistration = handleUserRegistration;
window.handleCheckIn = handleCheckIn;
