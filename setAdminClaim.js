// setAdminClaim.js

const admin = require('firebase-admin');

// ❗ 步驟 1: 將您提供的 JSON 內容直接作為一個 JavaScript 物件引入 ❗
const serviceAccountJson = {
    "type": "service_account",
    "project_id": "classcheckinsystem",
    "private_key_id": "3bf15578dd40abe471258b7591fbb31165f572d6",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDG+PiRrTFUNPmN\nPFRXgl5Zqew29jvbtFiL76zUVndUHUvm2ETr9fQfE+OWKmPSv2c4ibKRdQ5weaqZ\nH5vUKjIXzPDbiSQpUZJ1nY3EZUWqykQsszB1lMwL9f/zHsKJDA4KSdZGLIJi3VKp\no2GIj1vxiAh8cg+FppWBXgTYOpjqbmbMp5f0XQTIh7QGQQDSqQjZykbwZoTc/MJU\n34l/BHwSajKNJPV/apn2g8LpSaZbakMPbkQYcl3TvBMl2GeNKaTgOBHlJMxIYbjL\nKuFIAL2JgCh2R3ycuZpSoK7S1JzLoNCsIk3w3gvimTCsxQoP4nkZqLTtlSCVSIyn\n9m79WmQBAgMBAAECggEAIxOohbu072vEAwfxLIqPCx8DJDwxv1Fo/nqgv8cHgn6K\ndJjO2GSigCQA03IZzr8Gf6UTa9vIbTCH37DEguOSmPgH6aXCc1bw46aAvCyDhSpa\nP0kl4EHL3SGAFfhZjl7OtxiPO5LsPIxo+qX6tr4o+YOU3xPrln0D6bdUTj8b3xZc\nv6+W6fT/IrqPBPsMzgb3rT9b6b8XUYwGa1cH61hMJauZHrLs6an6ex2mJKHR69+O\nOsxEl7/c+kHKNjks8ztXrM5XLLMGCwvtDBDLpV3kmZb4p2N+HKnj2swF4UcssZF+\n8vb6OiVujGLVEX7Ea0qhBCLhuU8gA8jwFsWURyp2zQKBgQDxz8kXSrECO2tXlZ4x\n5nR02M3pFGqIqnJMBeDGRBIpTaSPyI9sGaC5s/0FJiV7lMXvNgjcOIeSO0Uw4b6n\nnriVRagwLJpmTjCw8gLWPBRhf02jNTBlpd6+IOq3kNZe1kM5lHjRk+zjaUWNNIh1\nWrLkCPutTiRgWEMFYUzsu/4U+wKBgQDSpbSz0/qhyxzsSpDVESo4tLpjr1T4YsQ4\n8REx9+8XZgrlVS5gbtxFZaEHvwtz/vXA+hCg0YciMVxmwDluN25Ram3AXXY8P1Qi\nUlPTeLqduc/St6ZOJ68cyD0A1q/v21ibhMc8p2pueCVJXOlYJHzOyiYuOZGK5WN9\nYHIddaLCMwKBgBF8R/tCMGiL6Wgs7oKHOpaUctdO3aFCSf+LUUSk+Xc5IRQwmYZk\nmAW1qS8tIfq8uE9i5eMex1bgqFEvkbzHMmvA3LeXEhchwk2ZQnFBaOvf67pIh1Zi\nVygCc1aQx5+V+Mh6Hv5wpumO3DOov9FUnKj2qVRP2TuKRlZmQczAj0/vAoGAfAGL\nCJZRJLBC3aPj8VrChVF3rLmKBxN1uqPH4Ke5vAeZgHqN6703tS7oBnxkTKwalrlf\n0pymte1jHSYqaQT+z7Uc2TLsKPmLGQ1oRcT772B0xPLSV44rG4GR0A2S01xIpH0d\nIUrZcCEQqkilIfuQ8de1dF71nFQAJs4BP/CBmVsCgYBN1pB9+DH31MrlXQGmF0w0\ntDUFM6tXWUKQK+cloxNwwUNvtf8zWeVbmmMI7XyT1+UcJfURNxp6WL+TBlBhkUEQ\nRw8kzLGtoc6kta4hVxWboOzEtP1+Hl5L9C0CCWwEdmHC7bff1UArRoKtCYS1UIct\nLmA/96uQZXZG2PYV3wnnfQ==\n-----END PRIVATE KEY-----\n",
    "client_email": "firebase-adminsdk-fbsvc@classcheckinsystem.iam.gserviceaccount.com",
    "client_id": "103884408062574173903",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40classcheckinsystem.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
};

// 2. 初始化 Admin SDK (使用 serviceAccountJson)
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountJson)
});

// 3. ❗ 替換為您管理員帳號的 UID (必須從 Firebase Console -> Authentication 複製) ❗
const adminUid = '4mzttXFkIFTHdGwYsoGQKuujbP53'; 

async function setAdminClaim() {
    console.log(`正在為 UID: ${adminUid} 設定 Admin 權限...`);
    
    try {
        await admin.auth().setCustomUserClaims(adminUid, { admin: true });
        console.log(`\n✅ 成功設定用戶 UID: ${adminUid} 的 admin 權限為 true！`);
        console.log('---');
        console.log('🎉 最終解決方案：現在請執行步驟 4。');
    } catch (error) {
        console.error('\n❌ 設定管理員權限失敗。常見原因：');
        console.error('   1. UID 格式錯誤。');
        console.error('   2. 網路連線問題。');
        console.error('   3. 服務帳號權限不足 (檢查 Firebase Console IAM)。');
        console.error('詳細錯誤:', error);
    }
}

setAdminClaim();
