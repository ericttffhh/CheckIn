// admin.js (最終安全版：整合 CORS 修正與 XSS 防禦)

// ==========================================================
// 1. 核心安全修正：XSS 輸出編碼函數
// ==========================================================
/**
 * 預防 XSS 攻擊：將 HTML 特殊字符轉義為實體。
 * 這是防止惡意代碼（如 <img onerror="...">）被執行的最有效方法。
 * @param {string} str - 需要編碼的字符串
 * @returns {string} - 編碼後的安全字符串
 */
function escapeHTML(str) {
    if (typeof str !== 'string') {
        // 確保非字符串類型（如數字、對象）不會出錯
        return str; 
    }
    // 將五個常見的 HTML 特殊字符轉義為 HTML 實體
    return str.replace(/[&<>"']/g, function(match) {
        switch (match) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return match;
        }
    });
}

let count = 0;

// 定義要重複執行的函數
const repetitiveTask = () => {
    count++;
    // 這裡放置您想要重複印出的內容
    console.log(`你是不是想加入學生會?幹嘛一直駭我`);
    console.log(`Do you want to join the student council? Why are you constantly harassing me?`);
   
};

// 設置定時器：每 3000 毫秒（即 3 秒）執行一次 repetitiveTask
const intervalId = setInterval(repetitiveTask, 3000);


console.log("STOP:clearInterval(intervalId)");
// ==========================================================
// 2. Firebase SDK 導入與配置
// ==========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
// 不再需要導入 firebase-functions SDK

// ❗❗❗❗ 請將以下替換為您的 Firebase 專案配置 ❗❗❗❗
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
const auth = getAuth(app);

// 函數 URL 定義 (請確保這是您的 Firebase Functions 區域)
const FUNCTIONS_URL_BASE = "https://us-central1-classcheckinsystem.cloudfunctions.net/";
const ADMIN_GET_RECORDS_URL = FUNCTIONS_URL_BASE + 'adminGetRecords';
const ADMIN_DELETE_RECORDS_URL = FUNCTIONS_URL_BASE + 'adminDeleteRecords'; // 統一處理刪除

// ==========================================================
// 3. DOM 元素獲取與狀態管理
// ==========================================================
const loginStage = document.getElementById('login-stage');
const dashboardStage = document.getElementById('dashboard-stage');
const adminMessage = document.getElementById('admin-message');
const recordsList = document.getElementById('records-list');
const usersList = document.getElementById('users-list');

let allCheckinsData = []; // 用於儲存打卡數據，以便匯出

// ==========================================================
// 4. 身份驗證 (Login/Logout)
// ==========================================================

window.handleAdminLogin = async function() {
    const email = document.getElementById('admin-user').value;
    const password = document.getElementById('admin-pass').value;
    adminMessage.textContent = '登入中...';

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Login Error:", error);
        adminMessage.textContent = `登入失敗: ${getErrorMessage(error)}`;
    }
};

window.handleAdminLogout = async function() {
    await signOut(auth);
    adminMessage.textContent = '';
};

// 狀態監聽器：判斷是否登入並具有管理員權限
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // 取得 ID Token，檢查 Custom Claim
        const idTokenResult = await user.getIdTokenResult(true);

        if (idTokenResult.claims.admin) {
            loginStage.classList.add('hidden');
            dashboardStage.classList.remove('hidden');
            adminMessage.textContent = '';
            
            // 自動載入數據
            fetchCheckInRecords();
            fetchUserRecords();

        } else {
            // 登入但非管理員
            adminMessage.textContent = '此帳號沒有管理員權限。';
            signOut(auth);
        }
    } else {
        // 登出或未登入
        loginStage.classList.remove('hidden');
        dashboardStage.classList.add('hidden');
    }
});

function getErrorMessage(error) {
    switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return '帳號或密碼錯誤。';
        case 'auth/invalid-email':
            return 'Email 格式無效。';
        default:
            return '發生未知錯誤，請稍後再試。';
    }
}

// ==========================================================
// 5. 數據獲取與渲染 (核心：使用 Fetch API 解決 CORS)
// ==========================================================

/**
 * 呼叫 Firebase onRequest Function 的通用邏輯
 */
async function callAdminFunction(url, data) {
    const user = auth.currentUser;
    if (!user) throw new Error("用戶未登入。");

    // 獲取當前用戶的 ID Token，用於後端身份驗證
    const idToken = await user.getIdToken();
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // 身份驗證關鍵：將 Token 放入 Authorization 標頭
            'Authorization': `Bearer ${idToken}` 
        },
        // onRequest 函數從 req.body.data 中獲取數據
        body: JSON.stringify({ data: data }) 
    });

    if (!response.ok) {
        // 嘗試解析錯誤訊息
        const errorText = await response.text();
        let errorMessage = `HTTP 錯誤：狀態碼 ${response.status}。`;
        try {
            const errorJson = JSON.parse(errorText);
            // 優先顯示後端定義的錯誤訊息
            errorMessage = errorJson.message || errorMessage; 
        } catch (e) {
             errorMessage = `Functions 呼叫失敗 (${response.status} ${response.statusText}): ${errorText.substring(0, 50)}...`;
        }
        throw new Error(errorMessage);
    }
    
    // 返回包含 data 字段的結果結構
    return await response.json(); 
}

async function fetchRecords(collectionName, listElement) {
    listElement.innerHTML = '<li>載入中...</li>';
    adminMessage.textContent = '';
    
    try {
        const response = await callAdminFunction(ADMIN_GET_RECORDS_URL, { collectionName });
        const records = response.data; // 讀取後端返回的 data 字段
        
        // 排序邏輯
        if (collectionName === 'checkins') {
            records.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
            allCheckinsData = records; 
        } else {
            records.sort((a, b) => a.studentId.localeCompare(b.studentId));
        }

        listElement.innerHTML = ''; // 清空列表
        if (records.length === 0) {
            listElement.innerHTML = `<li>目前沒有任何 ${collectionName === 'checkins' ? '打卡記錄' : '用戶建檔'}。</li>`;
            return;
        }

        records.forEach(record => {
            const li = document.createElement('li');
            li.setAttribute('data-doc-id', record.id); 

            // 確保 docId 也是安全字串
            const safeDocId = escapeHTML(record.id); 
            const safeCollectionName = escapeHTML(collectionName);
            let deleteBtn = `<button class="delete-btn" onclick="deleteSingleRecord('${safeCollectionName}', '${safeDocId}')">刪除</button>`;
            let content = '';

            // ❗❗ XSS 修復點：對所有數據使用 escapeHTML 函數 ❗❗
            if (collectionName === 'checkins') {
                const dateString = new Date(record.timestamp.seconds * 1000).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
                
                // 對所有可能包含用戶輸入的欄位進行編碼
                const safeCheckinDate = escapeHTML(record.checkinDate); 
                const safeClassName = escapeHTML(record.className);
                const safeName = escapeHTML(record.name);
                const safeStudentId = escapeHTML(record.studentId);
                const safeSection = escapeHTML(record.section);
                
                content = `
                    <span class="record-header">${safeCheckinDate} ${dateString.split(' ')[1]}</span>
                    [${safeClassName} ${safeName} (${safeStudentId})] 
                    <br> 打卡節次: ${safeSection}
                `;
            } else { // users
                // 對所有用戶數據進行編碼
                const safeStudentId = escapeHTML(record.studentId);
                const safeName = escapeHTML(record.name);
                const safeClassName = escapeHTML(record.className);
                
                content = `
                    <span class="record-header">學號: ${safeStudentId}</span>
                    姓名: ${safeName} | 班級: ${safeClassName} 
                    <br> 建檔時間: ${new Date(record.createdAt.seconds * 1000).toLocaleDateString('zh-TW')}
                `;
            }

            // 使用 innerHTML 確保拼接的內容是安全淨化過的
            li.innerHTML = deleteBtn + content;
            listElement.appendChild(li);
        });

    } catch (error) {
        console.error("Fetch Records Error:", error);
        // 確保錯誤訊息也被編碼
        adminMessage.textContent = escapeHTML(`載入 ${collectionName} 數據失敗: ${error.message}`);
        listElement.innerHTML = `<li>載入錯誤：${escapeHTML(error.message)}</li>`;
    }
}

window.fetchCheckInRecords = () => fetchRecords('checkins', recordsList);
window.fetchUserRecords = () => fetchRecords('users', usersList);


// ==========================================================
// 6. 數據刪除操作 (使用 Fetch API 呼叫 adminDeleteRecords)
// ==========================================================

window.deleteSingleRecord = async function(collectionName, docId) {
    if (!confirm(`確定要刪除這筆 ${collectionName} 記錄嗎？ (ID: ${docId})`)) return;

    try {
        // 呼叫 adminDeleteRecords，帶有 docId
        const response = await callAdminFunction(ADMIN_DELETE_RECORDS_URL, { collectionName, docId });
        adminMessage.textContent = response.data.message;
        
        // 重新整理列表
        if (collectionName === 'checkins') {
            fetchCheckInRecords();
        } else {
            fetchUserRecords();
        }

    } catch (error) {
        console.error("Delete Error:", error);
        adminMessage.textContent = `刪除失敗: ${error.message}`;
    }
};

window.deleteAllCheckInRecords = async function() {
    if (!confirm('!!! 警告 !!! 確定要刪除所有打卡紀錄嗎？此操作不可復原！')) return;

    try {
        // 呼叫 adminDeleteRecords，不帶 docId，進行批次刪除
        const response = await callAdminFunction(ADMIN_DELETE_RECORDS_URL, { collectionName: 'checkins' });
        adminMessage.textContent = response.data.message;
        
        fetchCheckInRecords();
        
    } catch (error) {
        console.error("Delete All Error:", error);
        adminMessage.textContent = `批次刪除失敗: ${error.message}`;
    }
};

// ==========================================================
// 7. CSV 匯出功能
// ==========================================================

window.exportCheckinsToCSV = function() {
    if (allCheckinsData.length === 0) {
        alert('無打卡數據可匯出。');
        return;
    }

    // 1. 定義標頭
    const headers = ['日期', '時間', '班級', '姓名', '學號', '打卡節次'];
    let csvContent = headers.join(',') + '\n';

    // 2. 轉換數據
    allCheckinsData.forEach(record => {
        const dateObj = new Date(record.timestamp.seconds * 1000);
        const datePart = dateObj.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' });
        const timePart = dateObj.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });

        // 對 CSV 數據使用雙引號包裹，以確保數據中的逗號不會破壞格式
        const row = [
            `"${record.checkinDate || 'N/A'}"`, 
            `"${timePart}"`,
            `"${record.className || 'N/A'}"`,
            `"${record.name || 'N/A'}"`,
            `"${record.studentId || 'N/A'}"`,
            `"${record.section || 'N/A'}"`
        ];
        csvContent += row.join(',') + '\n';
    });

    // 3. 創建並下載 CSV 檔案
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }); // \ufeff 確保中文編碼
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `checkin_records_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    adminMessage.textContent = `成功匯出 ${allCheckinsData.length} 筆紀錄到 CSV 檔案。`;
};


