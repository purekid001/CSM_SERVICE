// --- Firebase HR Configuration & Initialization ---
// ใช้สำหรับระบบ HR (จองรถ, Shuttle, etc.) แยก project จาก Firebase หลัก
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set, update, remove } from "firebase/database";

const firebaseConfigHR = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY_HR,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN_HR,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL_HR,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID_HR,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET_HR,
};

function validateFirebaseConfig(config, label) {
  const missing = ['apiKey', 'authDomain', 'projectId'].filter(key => !config[key]);
  if (missing.length > 0) {
    throw new Error(`[Firebase ${label}] Missing config: ${missing.join(', ')}. Please check your .env file and restart Vite.`);
  }
}

validateFirebaseConfig(firebaseConfigHR, 'HR');

// สร้าง Firebase App แยก (ใช้ชื่อ 'hrApp' เพื่อไม่ชนกับ App หลัก)
const hrApp = initializeApp(firebaseConfigHR, 'hrApp');
const hrDatabase = firebaseConfigHR.databaseURL
  ? getDatabase(hrApp, firebaseConfigHR.databaseURL)
  : getDatabase(hrApp);

export { hrDatabase, ref, get, set, update, remove };
