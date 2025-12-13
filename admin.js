// admin.js

// ==========================================================
// 1. Firebase SDK 導入與配置
// ==========================================================
// 導入 Auth, Firestore 和 Functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js"; 

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
const functions = getFunctions(app, 'us-central1'); 

// Callable Functions 參考
const adminGetRecords = httpsCallable(functions, 'adminGetRecords');
const deleteRecordById = httpsCallable(functions, 'deleteRecordById');
const deleteAllRecordsInCollection = httpsCallable(functions, 'deleteAllRecordsInCollection');

// ==========================================================
// 2. DOM 元素獲取
// ==========================================================
const loginStage = document.getElementById('login-stage');
const dashboardStage = document.getElementById('dashboard-stage');
const adminMessage = document.getElementById('admin-message');
const recordsList = document.getElementById('records-list');
const usersList = document.getElementById('users-list');

let allCheckinsData = []; // 用於儲存打卡數據，以便匯出

// ==========================================================
// 3. 身份驗證 (Login/Logout)
// ==========================================================

window.handleAdminLogin = async function() {
    const email = document.getElementById('admin-user').value;
    const password = document.getElementById('admin-pass').value;
    adminMessage.textContent = '登入中...';

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        // 登入成功，onAuthStateChanged 會處理後續操作
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
// 4. 數據獲取與渲染
// ==========================================================

async function fetchRecords(collectionName, listElement) {
    listElement.innerHTML = '<li>載入中...</li>';
    adminMessage.textContent = '';
    
    try {
        const response = await adminGetRecords({ collectionName });
        const records = response.data;
        
        // 排序：打卡紀錄按 timestamp 倒序，用戶紀錄按學號排序
        if (collectionName === 'checkins') {
            records.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
            allCheckinsData = records; // 儲存數據用於匯出
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
            li.setAttribute('data-doc-id', record.id); // 儲存文件 ID

            let content = '';
            let deleteBtn = `<button class="delete-btn" onclick="deleteSingleRecord('${collectionName}', '${record.id}')">刪除</button>`;

            if (collectionName === 'checkins') {
                const dateString = new Date(record.timestamp.seconds * 1000).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
                content = `
                    <span class="record-header">${record.checkinDate} ${dateString.split(' ')[1]}</span>
                    [${record.className} ${record.name} (${record.studentId})] 
                    <br> 打卡節次: ${record.section}
                `;
            } else { // users
                content = `
                    <span class="record-header">學號: ${record.studentId}</span>
                    姓名: ${record.name} | 班級: ${record.className} 
                    <br> 建檔時間: ${new Date(record.createdAt.seconds * 1000).toLocaleDateString('zh-TW')}
                `;
            }

            li.innerHTML = deleteBtn + content;
            listElement.appendChild(li);
        });

    } catch (error) {
        console.error("Fetch Records Error:", error);
        adminMessage.textContent = `載入 ${collectionName} 數據失敗: ${error.message}`;
        listElement.innerHTML = `<li>載入錯誤：${error.message}</li>`;
    }
}

window.fetchCheckInRecords = () => fetchRecords('checkins', recordsList);
window.fetchUserRecords = () => fetchRecords('users', usersList);


// ==========================================================
// 5. 數據刪除操作
// ==========================================================

window.deleteSingleRecord = async function(collectionName, docId) {
    if (!confirm(`確定要刪除這筆 ${collectionName} 記錄嗎？ (ID: ${docId})`)) return;

    try {
        const response = await deleteRecordById({ collectionName, docId });
        adminMessage.textContent = response.data.message;
        
        // 刪除成功後重新整理列表
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
        const response = await deleteAllRecordsInCollection({ collectionName: 'checkins' });
        adminMessage.textContent = response.data.message;
        
        // 刪除成功後重新整理列表
        fetchCheckInRecords();
        
    } catch (error) {
        console.error("Delete All Error:", error);
        adminMessage.textContent = `批次刪除失敗: ${error.message}`;
    }
};

// ==========================================================
// 6. CSV 匯出功能
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
