// 引入 Firebase SDK 模組 (已升級並統一版本 v10.12.2) (略)
import { 
    initializeApp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { 
    getFirestore, 
    collection, 
    getDocs, 
    query, 
    orderBy, 
    doc, 
    deleteDoc, 
    writeBatch 
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

// 初始化 Firebase (略)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const checkinsCol = collection(db, "checkins"); // 打卡紀錄
const usersCol = collection(db, "users"); // 建檔紀錄

// --- 管理員密碼設定 (僅為模擬) (略) ---
const ADMIN_USER = "ericqw";
const ADMIN_PASS = "961230";

// --- 核心函數 (略) ---
// ... (handleAdminLogin, fetchUserRecords, fetchCheckInRecords, deleteSingleCheckInRecord, deleteAllCheckInRecords 保持不變)


export function handleAdminLogin() {
    const user = document.getElementById('admin-user').value;
    const pass = document.getElementById('admin-pass').value;
    const message = document.getElementById('admin-message');
    const displayRecords = document.getElementById('records-display');
    const displayUsers = document.getElementById('users-display'); 

    if (user === ADMIN_USER && pass === ADMIN_PASS) {
        message.textContent = "登入成功！正在載入數據...";
        message.style.color = 'green';
        displayRecords.classList.remove('hidden');
        displayUsers.classList.remove('hidden'); 
        fetchCheckInRecords(); 
        fetchUserRecords(); 
    } else {
        message.textContent = "帳號或密碼錯誤。";
        message.style.color = 'red';
        displayRecords.classList.add('hidden');
        displayUsers.classList.add('hidden');
    }
}

// ... (fetchUserRecords 略)

export async function fetchCheckInRecords() {
    const recordsList = document.getElementById('records-list');
    recordsList.innerHTML = '<li>正在從雲端載入所有數據...</li>';

    try {
        const q = query(checkinsCol, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);

        recordsList.innerHTML = '';
        
        if (querySnapshot.empty) {
            recordsList.innerHTML = '<li>目前沒有任何打卡紀錄。</li>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const docId = doc.id; 
            
            // 顯示打卡時間 (資料庫寫入時間)
            const date = data.timestamp ? data.timestamp.toDate().toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'medium', hour12: false }) : 'N/A';
            // 顯示紀錄的打卡日期 (checkinDate欄位)
            const checkinDateDisplay = data.checkinDate ? data.checkinDate : 'N/A'; 
            
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span class="record-header">${date}</span> | 
                <strong>${data.name}</strong> (${data.studentId}) - ${data.className}
                
                <button onclick="deleteSingleCheckInRecord('${docId}')" class="delete-btn">
                    單筆刪除
                </button>
                <br>
                **紀錄日期: ${checkinDateDisplay}** | 節次: ${data.section}
            `;
            recordsList.appendChild(listItem);
        });

    } catch (error) {
        console.error("讀取後台紀錄失敗: ", error);
        recordsList.innerHTML = '<li>讀取數據時發生錯誤，請檢查您的網路或 Firebase 權限設定。</li>';
    }
}

// ... (deleteSingleCheckInRecord, deleteAllCheckInRecords 略)


/**
 * 匯出 CSV 檔案，新增日期欄位
 */
export async function exportCheckinsToCSV() {
    try {
        const q = query(checkinsCol, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("目前沒有任何打卡紀錄可以匯出。");
            return;
        }

        // 關鍵修正：新增 "打卡日期" 欄位
        let csv = "姓名,學號,班級,打卡日期,節次,資料庫記錄時間\n";
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // 資料庫寫入時間
            const timestamp = data.timestamp ? 
                data.timestamp.toDate().toLocaleString('zh-TW', { timeZoneName: 'short' }) : 
                'N/A';
            
            // 打卡日期
            const checkinDate = data.checkinDate || 'N/A'; 
                
            // 輸出順序: 姓名,學號,班級,打卡日期,節次,資料庫記錄時間
            csv += `${data.name},${data.studentId},${data.className},"${checkinDate}","${data.section}","${timestamp}"\n`; 
        });

        const finalCsv = '\ufeff' + csv; 
        const blob = new Blob([finalCsv], { type: 'text/csv;charset=utf-8;' });
        
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        const dateString = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        link.setAttribute("href", url);
        link.setAttribute("download", `checkin_records_${dateString}.csv`);
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert(`成功匯出 ${querySnapshot.size} 筆打卡紀錄！`);

    } catch (error) {
        console.error("匯出 CSV 失敗: ", error);
        alert("匯出 CSV 失敗：無法讀取資料庫。");
    }
}


// 綁定到 window (略)
window.handleAdminLogin = handleAdminLogin;
window.fetchCheckInRecords = fetchCheckInRecords;
window.deleteSingleCheckInRecord = deleteSingleCheckInRecord;
window.deleteAllCheckInRecords = deleteAllCheckInRecords;
window.exportCheckinsToCSV = exportCheckinsToCSV;
window.fetchUserRecords = fetchUserRecords;
