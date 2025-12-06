// 引入 Firebase SDK 模組
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, doc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";


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

// --- 管理員密碼設定 (僅為模擬) ---
const ADMIN_USER = "ericqw";
const ADMIN_PASS = "961230";

// --- 核心函數 ---

export function handleAdminLogin() {
    const user = document.getElementById('admin-user').value;
    const pass = document.getElementById('admin-pass').value;
    const message = document.getElementById('admin-message');
    const display = document.getElementById('records-display');

    if (user === ADMIN_USER && pass === ADMIN_PASS) {
        message.textContent = "登入成功！正在載入數據...";
        message.style.color = 'green';
        display.classList.remove('hidden');
        fetchCheckInRecords(); 
    } else {
        message.textContent = "帳號或密碼錯誤。";
        message.style.color = 'red';
        display.classList.add('hidden');
    }
}


/**
 * 從 Firestore 獲取所有打卡紀錄，並在後台顯示。
 */
export async function fetchCheckInRecords() {
    const recordsList = document.getElementById('records-list');
    recordsList.innerHTML = '<li>正在從雲端載入所有數據...</li>';

    try {
        // 查詢所有打卡紀錄，按時間戳記降序排列
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
            
            const date = data.timestamp ? data.timestamp.toDate().toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'medium', hour12: false }) : 'N/A';
            
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span class="record-header">${date}</span> | 
                <strong>${data.name}</strong> (${data.studentId}) - ${data.className}
                
                <button onclick="deleteSingleCheckInRecord('${docId}')" class="delete-btn">
                    單筆刪除
                </button>
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


/**
 * 刪除單筆打卡紀錄。
 */
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


/**
 * 刪除所有打卡紀錄 (使用批次寫入)。
 */
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

/**
 * 📥 將 Firestore 的打卡紀錄匯出為 CSV 檔案。
 */
export async function exportCheckinsToCSV() {
    try {
        // 1. 獲取所有紀錄
        const q = query(checkinsCol, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("目前沒有任何打卡紀錄可以匯出。");
            return;
        }

        // 2. 定義 CSV 標頭
        let csv = "姓名,學號,班級,節次,打卡時間\n";
        
        // 3. 遍歷數據並格式化
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // 轉換 Firebase Timestamp 為可讀的字串
            const timestamp = data.timestamp ? 
                data.timestamp.toDate().toLocaleString('zh-TW', { timeZoneName: 'short' }) : 
                'N/A';
                
            // 數據行，確保使用引號包裹時間，以避免逗號導致格式混亂
            csv += `${data.name},${data.studentId},${data.className},${data.section},"${timestamp}"\n`;
        });

        // 4. 建立 Blob 對象並觸發下載
        // \ufeff 是 BOM (Byte Order Mark)，確保 Excel 能正確識別 UTF-8 編碼的中文
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

// 綁定到 window
window.handleAdminLogin = handleAdminLogin;
window.fetchCheckInRecords = fetchCheckInRecords;
window.deleteSingleCheckInRecord = deleteSingleCheckInRecord;
window.deleteAllCheckInRecords = deleteAllCheckInRecords;
window.exportCheckinsToCSV = exportCheckinsToCSV;

