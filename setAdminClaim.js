// setAdminClaim.js
const admin = require('firebase-admin');

// 1. 服務帳號憑證路徑
const serviceAccount = require('./path/to/your/serviceAccountKey.json');

// 2. 初始化 Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 3. ❗ 替換為您管理員帳號的 UID ❗
// 您可以在 Firebase Console -> Authentication 頁面找到此 UID
const adminUid = '4mzttXFkIFTHdGwYsoGQKuujbP53'; 

async function setAdminClaim() {
    try {
        await admin.auth().setCustomUserClaims(adminUid, { admin: true });
        console.log(`✅ 成功設定用戶 UID: ${adminUid} 的 admin 權限為 true`);
        console.log('---');
        console.log('❗ 請記得，管理員必須「登出」並「重新登入」一次，新的權限才會生效。');
    } catch (error) {
        console.error('❌ 設定管理員權限失敗:', error);
    }
}

setAdminClaim();
