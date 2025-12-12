// 引入 Firebase SDK 模組 (v10.12.2)
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

// 🚨 引入 Firebase Auth 模組
import { 
    getAuth, 
    signInWithEmailAndPassword,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


// ❗❗❗❗ 請將以下替換為您的 Firebase 專案配置 ❗❗❗❗
const firebaseConfig = {
    apiKey: "AIzaSyCqS2W49BcSvQV5XwKDPfb7HKeQp5-pO9c", // 請確認這是否為您的金鑰
    authDomain: "classcheckinsystem.firebaseapp.com",
    projectId: "classcheckinsystem",
    storageBucket: "classcheckinsystem.firebasestorage.app",
    messagingSenderId: "592387609788",
    appId: "1:592387609788:web:4f00a7fa9653b00fa8acb9"
};

// 初始化 Firebase 服務
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); 
const checkinsCol = collection(db, "checkins"); // 打卡紀錄
const usersCol = collection(db, "users"); // 建檔紀錄


// ----------------------------------------------------------------------
// ❗ 核心安全防禦函數：XSS 輸出編碼 (Output Encoding) ❗
// ----------------------------------------------------------------------
/**
 * 使用 DOM textContent 屬性安全地對字串進行 HTML 轉義，
 * 防止在將資料庫讀取的內容寫入 innerHTML 時發生 XSS 攻擊。
 * @param {string} str - 從資料庫讀取的字串
 * @returns {string} - 安全的 HTML 實體編碼字串
 */
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}


// ----------------------------------------------------------------------
// I. 登入與介面切換
// ----------------------------------------------------------------------

/**
 * 處理管理員登入 (使用 Firebase Auth)
 */
export async function handleAdminLogin() {
    const email = document.getElementById('admin-user').value;
    const pass = document.getElementById('admin-pass').value;
    const message = document.getElementById('admin-message');
    
    message.textContent = "正在登入...";
    message.style.color = 'blue';

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        // 登入成功後，onAuthStateChanged 會自動處理介面切換和資料載入
        message.textContent = "登入成功！";

    } catch (error) {
        let errorMsg = "登入失敗：請檢查帳號密碼。";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
             errorMsg = "帳號或密碼錯誤。";
        } else if (error.code === 'auth/network-request-failed') {
             errorMsg = "網路連線錯誤，請檢查網路。";
        }
        console.error("Firebase 登入失敗: ", error);
        message.textContent = errorMsg;
        message.style.color = 'red';
    }
}

/**
 * 登出管理員
 */
export async function handleAdminLogout() {
    await signOut(auth);
    window.location.reload(); // 重載頁面以返回登入介面
}


// ----------------------------------------------------------------------
// II. 資料獲取與顯示
// ----------------------------------------------------------------------

/**
 * 從 Firestore 獲取所有學生建檔紀錄。
 */
export async function fetchUserRecords() {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '<li>正在從雲端載入建檔數據...</li>';
    
    if (!auth.currentUser) return; // 確保已登入

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
            
            // ❗ 關鍵防禦：使用 escapeHTML 淨化所有從資料庫讀取的輸出內容
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                🆔 <strong>${escapeHTML(data.studentId)}</strong> | 
                👤 ${escapeHTML(data.name)} (${escapeHTML(data.className)})
                <br>
                🔑 密語: <span style="color: #d9534f; font-weight: bold;">${escapeHTML(data.password)}</span>
            `;
            usersList.appendChild(listItem);
        });

    } catch (error) {
        console.error("讀取建檔紀錄失敗: ", error);
        usersList.innerHTML = '<li>讀取建檔數據時發生錯誤。請確認您的 Firestore 規則已允許管理員讀取。</li>';
    }
}


/**
 * 從 Firestore 獲取所有打卡紀錄，並在後台顯示。
 */
export async function fetchCheckInRecords() {
    const recordsList = document.getElementById('records-list');
    recordsList.innerHTML = '<li>正在從雲端載入所有數據...</li>';

    if (!auth.currentUser) return; // 確保已登入

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
            
            const date = data.timestamp ? data.timestamp.toDate().toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'medium', hour12: false }) : 'N/A';
            const checkinDateDisplay = data.checkinDate ? data.checkinDate : 'N/A'; 
            
            // ❗ 關鍵防禦：使用 escapeHTML 淨化所有從資料庫讀取的輸出內容
            const safeName = escapeHTML(data.name);
            const safeStudentId = escapeHTML(data.studentId);
            const safeClassName = escapeHTML(data.className);
            const safeSection = escapeHTML(data.section);

            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span class="record-header">${date}</span> | 
                <strong>${safeName}</strong> (${safeStudentId}) - ${safeClassName}
                
                <button onclick="deleteSingleCheckInRecord('${docId}')" class="delete-btn">
                    單筆刪除
                </button>
                <br>
                **紀錄日期: ${checkinDateDisplay}** | 節次: ${safeSection}
            `;
            recordsList.appendChild(listItem);
        });

    } catch (error) {
        console.error("讀取後台紀錄失敗: ", error);
        recordsList.innerHTML = '<li>讀取數據時發生錯誤，請檢查您的網路或 Firestore 規則。</li>';
    }
}


// ----------------------------------------------------------------------
// III. 資料操作 (刪除與匯出)
// ----------------------------------------------------------------------

export async function deleteSingleCheckInRecord(docId) {
    if (!auth.currentUser || !confirm("確定要刪除這筆打卡紀錄嗎？此操作不可復原。")) {
        return;
    }

    try {
        await deleteDoc(doc(db, "checkins", docId));
        alert("單筆紀錄刪除成功！");
        fetchCheckInRecords(); 
    } catch (error) {
        console.error("刪除單筆紀錄失敗: ", error);
        alert("刪除失敗：權限不足或資料庫連線錯誤。");
    }
}


export async function deleteAllCheckInRecords() {
    if (!auth.currentUser || !confirm("⚠️ 警告：您確定要刪除所有打卡紀錄嗎？此操作不可復原且影響巨大！")) {
        return;
    }
    
    try {
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

        await batch.commit();
        alert(`成功刪除所有 ${count} 筆打卡紀錄！`);
        fetchCheckInRecords(); 
    } catch (error) {
        console.error("刪除所有紀錄失敗: ", error);
        alert("刪除所有紀錄失敗：請檢查網路或 Firebase 權限。");
    }
}


export async function exportCheckinsToCSV() {
    if (!auth.currentUser) {
        alert('請先登入管理員帳號。');
        return;
    }
    
    try {
        const q = query(checkinsCol, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("目前沒有任何打卡紀錄可以匯出。");
            return;
        }

        let csv = "姓名,學號,班級,打卡日期,節次,資料庫記錄時間\n";
        
        const escapeCsvField = (field) => `"${String(field).replace(/"/g, '""')}"`;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            const timestamp = data.timestamp ? 
                data.timestamp.toDate().toLocaleString('zh-TW', { timeZoneName: 'short' }) : 
                'N/A';
            
            const checkinDate = data.checkinDate || 'N/A'; 
                
            csv += `${escapeCsvField(data.name)},${escapeCsvField(data.studentId)},${escapeCsvField(data.className)},${escapeCsvField(checkinDate)},${escapeCsvField(data.section)},${escapeCsvField(timestamp)}\n`; 
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
        alert("匯出 CSV 失敗：無法讀取資料庫或權限不足。");
    }
}

// ----------------------------------------------------------------------
// IV. 狀態監聽與全局綁定
// ----------------------------------------------------------------------

// 檢查登入狀態並在頁面載入時顯示正確的介面
auth.onAuthStateChanged((user) => {
    const loginStage = document.getElementById('login-stage');
    const dashboardStage = document.getElementById('dashboard-stage');
    
    // 檢查元素是否存在，避免在其他頁面（如 index.html）載入時出錯
    if (loginStage && dashboardStage) {
        if (user) {
            // 已登入，顯示後台
            loginStage.classList.add('hidden');
            dashboardStage.classList.remove('hidden');
            fetchCheckInRecords(); 
            fetchUserRecords();
        } else {
            // 未登入，顯示登入表單
            loginStage.classList.remove('hidden');
            dashboardStage.classList.add('hidden');
        }
    }
});


// ❗ 這是解決 'handleAdminLogin is not defined' 錯誤的關鍵！
//    將所有需要被 HTML onclick 調用的函數顯式綁定到 window
window.handleAdminLogin = handleAdminLogin;
window.handleAdminLogout = handleAdminLogout; 
window.fetchCheckInRecords = fetchCheckInRecords;
window.deleteSingleCheckInRecord = deleteSingleCheckInRecord;
window.deleteAllCheckInRecords = deleteAllCheckInRecords;
window.exportCheckinsToCSV = exportCheckinsToCSV;
window.fetchUserRecords = fetchUserRecords;
window.firebaseAuth = auth;
