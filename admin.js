// 引入 Firebase SDK 模組
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCqS2W49BcSvQV5XwKDPfb7HKeQp5-pO9c",
  authDomain: "classcheckinsystem.firebaseapp.com",
  projectId: "classcheckinsystem",
  storageBucket: "classcheckinsystem.firebasestorage.app",
  messagingSenderId: "592387609788",
  appId: "1:592387609788:web:4f00a7fa9653b00fa8acb9"
};


// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const checkinsCol = collection(db, "checkins");

// --- 管理員密碼設定 (僅為模擬，請勿用於實際生產環境) ---
const ADMIN_USER = "admin";
const ADMIN_PASS = "123456";

// --- 輔助函數 ---

/**
 * 處理管理員登入。
 */
export function handleAdminLogin() {
    const user = document.getElementById('admin-user').value;
    const pass = document.getElementById('admin-pass').value;
    const message = document.getElementById('admin-message');
    const display = document.getElementById('records-display');

    if (user === ADMIN_USER && pass === ADMIN_PASS) {
        message.textContent = "登入成功！正在載入數據...";
        message.style.color = 'green';
        display.classList.remove('hidden');
        fetchCheckInRecords(); // 登入成功後立即載入數據
    } else {
        message.textContent = "帳號或密碼錯誤。";
        message.style.color = 'red';
        display.classList.add('hidden');
    }
}


/**
 * 從 Firestore 獲取最新的打卡紀錄。
 */
export async function fetchCheckInRecords() {
    const recordsList = document.getElementById('records-list');
    recordsList.innerHTML = '<li>正在從雲端載入數據...</li>';

    try {
        // 查詢最新的 50 筆打卡紀錄，並按時間戳記降序排列
        const q = query(checkinsCol, orderBy("timestamp", "desc"), limit(50));
        const querySnapshot = await getDocs(q);

        recordsList.innerHTML = ''; // 清除載入訊息
        
        if (querySnapshot.empty) {
            recordsList.innerHTML = '<li>目前沒有任何打卡紀錄。</li>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // 將 Firestore 的 Timestamp 轉換為可讀的日期時間
            const date = data.timestamp ? data.timestamp.toDate().toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'medium', hour12: false }) : 'N/A';
            
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span class="record-header">${date}</span> | 
                <strong>${data.name}</strong> (${data.studentId}) - ${data.className}
                <br>
                節次: ${data.section}
            `;
            recordsList.appendChild(listItem);
        });

    } catch (error) {
        console.error("讀取後台紀錄失敗: ", error);
        recordsList.innerHTML = '<li>讀取數據時發生錯誤，請檢查您的網路或 Firebase 權限設定。</li>';
    }
}

// 將函數綁定到 window
window.handleAdminLogin = handleAdminLogin;
window.fetchCheckInRecords = fetchCheckInRecords;
