// --- Firebase Configuration & Initialization ---
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set, update, remove } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};

function validateFirebaseConfig(config, label) {
  const missing = ['apiKey', 'authDomain', 'projectId'].filter(key => !config[key]);
  if (missing.length > 0) {
    throw new Error(`[Firebase ${label}] Missing config: ${missing.join(', ')}. Please check your .env file and restart Vite.`);
  }
}

validateFirebaseConfig(firebaseConfig, 'EN');

// เริ่มต้นโปรเจกต์ Firebase
const app = initializeApp(firebaseConfig);
const database = firebaseConfig.databaseURL
  ? getDatabase(app, firebaseConfig.databaseURL)
  : getDatabase(app);
const storage = getStorage(app);

export { database, ref, get, set, update, remove, storage, storageRef, uploadBytes, getDownloadURL };
