// admin.js (最終安全版：整合 CORS 修正、XSS 防禦與動態排序)

// ==========================================================
// 1. 核心安全修正：XSS 輸出編碼函數
// ==========================================================
/**
 * 預防 XSS 攻擊：將 HTML 特殊字符轉義為實體。
 */
function escapeHTML(str) {
    if (typeof str !== 'string') return str; 
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

// 彩蛋偵測
let count = 0;
const repetitiveTask = () => {
    count++;
    console.log(`你是不是想加入學生會?幹嘛一直駭我`);
    console.log(`Do you want to join the student council? Why are you constantly harassing me?`);
};
const intervalId = setInterval(repetitiveTask, 3000);

// ==========================================================
// 2. Firebase SDK 導入與配置
// ==========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCqS2W49BcSvQV5XwKDPfb7HKeQp5-pO9c", 
    authDomain: "classcheckinsystem.firebaseapp.com",
    projectId: "classcheckinsystem",
    storageBucket: "classcheckinsystem.firebasestorage.app",
    messagingSenderId: "592387609788",
    appId: "1:592387609788:web:4f00a7fa9653b00fa8acb9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const FUNCTIONS_URL_BASE = "https://us-central1-classcheckinsystem.cloudfunctions.net/";
const ADMIN_GET_RECORDS_URL = FUNCTIONS_URL_BASE + 'adminGetRecords';
const ADMIN_DELETE_RECORDS_URL = FUNCTIONS_URL_BASE + 'adminDeleteRecords';

// ==========================================================
// 3. DOM 元素獲取
// ==========================================================
const loginStage = document.getElementById('login-stage');
const dashboardStage = document.getElementById('dashboard-stage');
const adminMessage = document.getElementById('admin-message');
const recordsList = document.getElementById('records-list');
const usersList = document.getElementById('users-list');

let allCheckinsData = [];

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
        adminMessage.textContent = `登入失敗: 帳號或密碼錯誤。`;
    }
};

window.handleAdminLogout = async function() {
    await signOut(auth);
    adminMessage.textContent = '';
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const idTokenResult = await user.getIdTokenResult(true);
        if (idTokenResult.claims.admin) {
            loginStage.classList.add('hidden');
            dashboardStage.classList.remove('hidden');
            fetchCheckInRecords(); // 預設載入
            fetchUserRecords();
        } else {
            adminMessage.textContent = '此帳號沒有管理員權限。';
            signOut(auth);
        }
    } else {
        loginStage.classList.remove('hidden');
        dashboardStage.classList.add('hidden');
    }
});

// ==========================================================
// 5. 數據獲取與排序渲染 (核心變更點)
// ==========================================================
async function callAdminFunction(url, data) {
    const user = auth.currentUser;
    if (!user) throw new Error("用戶未登入。");
    const idToken = await user.getIdToken();
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}` 
        },
        body: JSON.stringify({ data: data }) 
    });

    if (!response.ok) throw new Error(`HTTP 錯誤: ${response.status}`);
    return await response.json(); 
}

/**
 * 獲取並排序數據
 * @param {string} collectionName - 集合名稱
 * @param {HTMLElement} listElement - 要顯示的 DOM
 * @param {string} sortBy - 排序方式: 'default', 'name'
 */
async function fetchRecords(collectionName, listElement, sortBy = 'default') {
    listElement.innerHTML = '<li>載入中...</li>';
    adminMessage.textContent = '';
    
    try {
        const response = await callAdminFunction(ADMIN_GET_RECORDS_URL, { collectionName });
        const records = response.data; 
        
        // 💡 執行排序邏輯
        if (collectionName === 'checkins') {
            if (sortBy === 'name') {
                // 中文姓名排序 (由 A-Z 或筆劃少到多)
                records.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
            } else {
                // 預設：按時間排序 (最新在前)
                records.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
            }
            allCheckinsData = records; 
        } else {
            if (sortBy === 'name') {
                records.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
            } else {
                // 預設：按學號排序
                records.sort((a, b) => a.studentId.localeCompare(b.studentId));
            }
        }

        listElement.innerHTML = '';
        if (records.length === 0) {
            listElement.innerHTML = `<li>目前無資料。</li>`;
            return;
        }

        records.forEach(record => {
            const li = document.createElement('li');
            const safeDocId = escapeHTML(record.id);
            const safeCollectionName = escapeHTML(collectionName);
            
            let content = '';
            if (collectionName === 'checkins') {
                const dateString = new Date(record.timestamp.seconds * 1000).toLocaleString('zh-TW');
                content = `
                    <button class="delete-btn" onclick="deleteSingleRecord('${safeCollectionName}', '${safeDocId}')">刪除</button>
                    <span class="record-header">${escapeHTML(record.checkinDate)} ${dateString.split(' ')[1]}</span>
                    [${escapeHTML(record.className)} <strong>${escapeHTML(record.name)}</strong> (${escapeHTML(record.studentId)})] 
                    <br> 打卡節次: ${escapeHTML(record.section)}
                `;
            } else {
                content = `
                    <button class="delete-btn" onclick="deleteSingleRecord('${safeCollectionName}', '${safeDocId}')">刪除</button>
                    <span class="record-header">學號: ${escapeHTML(record.studentId)}</span>
                    姓名: <strong>${escapeHTML(record.name)}</strong> | 班級: ${escapeHTML(record.className)}
                `;
            }
            li.innerHTML = content;
            listElement.appendChild(li);
        });

    } catch (error) {
        adminMessage.textContent = `載入失敗: ${error.message}`;
    }
}

// ==========================================================
// 6. 刪除與 CSV 功能
// ==========================================================
window.deleteSingleRecord = async function(collectionName, docId) {
    if (!confirm(`確定要刪除這筆紀錄嗎？`)) return;
    try {
        const response = await callAdminFunction(ADMIN_DELETE_RECORDS_URL, { collectionName, docId });
        adminMessage.textContent = response.data.message;
        collectionName === 'checkins' ? fetchCheckInRecords() : fetchUserRecords();
    } catch (error) {
        adminMessage.textContent = `刪除失敗: ${error.message}`;
    }
};

window.exportCheckinsToCSV = function() {
    if (allCheckinsData.length === 0) return alert('無打卡數據可匯出。');
    const headers = ['日期', '時間', '班級', '姓名', '學號', '節次'];
    let csvContent = headers.join(',') + '\n';

    allCheckinsData.forEach(record => {
        const timePart = new Date(record.timestamp.seconds * 1000).toLocaleTimeString('zh-TW', { hour12: false });
        const row = [
            `"${record.checkinDate}"`, `"${timePart}"`, `"${record.className}"`,
            `"${record.name}"`, `"${record.studentId}"`, `"${record.section}"`
        ];
        csvContent += row.join(',') + '\n';
    });

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `checkin_records_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
};

// ==========================================================
// 7. 全域函數綁定 (供 HTML 呼叫)
// ==========================================================
window.fetchCheckInRecords = (sort) => fetchRecords('checkins', recordsList, sort);
window.fetchUserRecords = (sort) => fetchRecords('users', usersList, sort);
