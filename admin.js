// 引入 Firebase SDK 模組 (已升級並統一版本 v10.12.2)
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

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const checkinsCol = collection(db, "checkins"); // 打卡紀錄
const usersCol = collection(db, "users"); // 建檔紀錄

// --- 管理員密碼設定 (僅為模擬) ---
const ADMIN_USER = "ericqw";
const ADMIN_PASS = "961230";

// --- 核心函數 (使用 export 導出) ---

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
        // 確保成功登入後，模組內的函數能夠被呼叫
        fetchCheckInRecords(); 
        fetchUserRecords(); 
    } else {
        message.textContent = "帳號或密碼錯誤。";
        message.style.color = 'red';
        displayRecords.classList.add('hidden');
        displayUsers.classList.add('hidden');
    }
}


/**
 * 從 Firestore 獲取所有學生建檔紀錄。
 */
export async function fetchUserRecords() {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '<li>正在從雲端載入建檔數據...</li>';

    try {
        const q = query(usersCol, orderBy("studentId", "asc"));
        const querySnapshot = await getDocs(q);

        usersList.innerHTML = '';
        
        if (querySnapshot.empty) {
            usersList.innerHTML = '<li>目前沒有任何學生建檔紀錄。</li>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                🆔 <strong>${data.studentId}</strong> | 
                👤 ${data.name} (${data.className})
                <br>
                🔑 密語: <span style="color: #d9534f; font-weight: bold;">${data.password}</span>
            `;
            usersList.appendChild(listItem);
        });

    } catch (error) {
        console.error("讀取建檔紀錄失敗: ", error);
        usersList.innerHTML = '<li>讀取建檔數據時發生錯誤。</li>';
    }
}


/**
 * 從 Firestore 獲取所有打卡紀錄，並在後台顯示。
 */
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
            // ❗ 關鍵點：onclick="deleteSingleCheckInRecord('${docId}')" 會報錯，需要確認函數已綁定到 window
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

// --- 刪除與匯出函數 ---

export async function deleteSingleCheckInRecord(docId) {
    if (!confirm("確定要刪除這筆打卡紀錄嗎？此操作不可復原。")) {
        return;
    }

    try {
        await deleteDoc(doc(db, "checkins", docId));
        alert("單筆紀錄刪除成功！");
        fetchCheckInRecords(); 
    } catch (error) {
        console.error("刪除單筆紀錄失敗: ", error);
        alert("刪除失敗：無法連線至資料庫或權限不足。");
    }
}


export async function deleteAllCheckInRecords() {
    if (!confirm("⚠️ 警告：您確定要刪除所有打卡紀錄嗎？此操作不可復原且影響巨大！")) {
        return;
    }
    
    const querySnapshot = await getDocs(checkinsCol);
    if (querySnapshot.empty) {
        alert("目前資料庫中沒有任何紀錄可以刪除。");
        return;
    }

    const batch = writeBatch(db);
    let count = 0;

    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref); 
        count++;
    });

    try {
        await batch.commit();
        alert(`成功刪除所有 ${count} 筆打卡紀錄！`);
        fetchCheckInRecords(); 
    } catch (error) {
        console.error("刪除所有紀錄失敗: ", error);
        alert("刪除所有紀錄失敗：請檢查網路或 Firebase 權限。");
    }
}


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


// ❗❗ 最終解決方案：將所有需要被 HTML onclick 調用的函數顯式綁定到 window ❗❗
window.handleAdminLogin = handleAdminLogin;
window.fetchCheckInRecords = fetchCheckInRecords;
window.deleteSingleCheckInRecord = deleteSingleCheckInRecord;
window.deleteAllCheckInRecords = deleteAllCheckInRecords;
window.exportCheckinsToCSV = exportCheckinsToCSV;
window.fetchUserRecords = fetchUserRecords;

