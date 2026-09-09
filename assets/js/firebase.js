// --- Firebase Configuration & Initialization ---
import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from "firebase/auth";
import { getDatabase, ref, get, set, update, remove } from "firebase/database";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
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
const auth = getAuth(app);
const database = firebaseConfig.databaseURL
  ? getDatabase(app, firebaseConfig.databaseURL)
  : getDatabase(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'asia-southeast1');

const useFunctionsEmulator = import.meta.env.DEV
  && String(import.meta.env.VITE_USE_FUNCTIONS_EMULATOR || '').toLowerCase() === 'true';

if (useFunctionsEmulator) {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

const healthCallable = httpsCallable(functions, 'health', {
  timeout: 10_000,
});
const workspaceCallable = httpsCallable(functions, 'workspace', {
  timeout: 120_000,
});
const hrDatabaseCallable = httpsCallable(functions, 'hrDatabase', {
  timeout: 120_000,
});
const analyzeEvaluationCallable = httpsCallable(functions, 'analyzeEvaluation', {
  timeout: 120_000,
});

async function callHealthFunction() {
  const response = await healthCallable({});
  return response.data;
}

async function callWorkspaceFunction(action, payload = {}) {
  const response = await workspaceCallable({
    action,
    payload,
  });
  return response.data;
}

async function callHrDatabaseFunction(operation, path, value) {
  const response = await hrDatabaseCallable({
    operation,
    path,
    ...(value === undefined ? {} : { value }),
  });
  return response.data;
}

async function callAnalyzeEvaluationFunction(payload = {}) {
  const response = await analyzeEvaluationCallable(payload);
  return response.data;
}

function getEmployeeAuthEmail(employeeId) {
  const normalizedEmployeeId = String(employeeId ?? '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{1,128}$/.test(normalizedEmployeeId)) {
    throw new Error('รูปแบบรหัสพนักงานไม่ถูกต้อง');
  }
  return `${normalizedEmployeeId}@auth.csm.local`;
}

async function signInEmployee(employeeId, password, remember = false) {
  await setPersistence(
    auth,
    remember ? browserLocalPersistence : browserSessionPersistence,
  );
  return signInWithEmailAndPassword(
    auth,
    getEmployeeAuthEmail(employeeId),
    String(password ?? ''),
  );
}

async function signOutEmployee() {
  await signOut(auth);
}

async function changeFirebaseAuthPassword(currentPassword, nextPassword) {
  const currentUser = auth.currentUser;
  if (!currentUser?.email) {
    throw new Error('ไม่พบ Firebase Auth session กรุณาเข้าสู่ระบบใหม่');
  }

  const credential = EmailAuthProvider.credential(
    currentUser.email,
    String(currentPassword ?? ''),
  );
  await reauthenticateWithCredential(currentUser, credential);
  await updatePassword(currentUser, String(nextPassword ?? ''));
}

export {
  app,
  auth,
  database,
  ref,
  get,
  set,
  update,
  remove,
  storage,
  storageRef,
  uploadBytes,
  getDownloadURL,
  functions,
  callHealthFunction,
  callHrDatabaseFunction,
  callAnalyzeEvaluationFunction,
  callWorkspaceFunction,
  changeFirebaseAuthPassword,
  getEmployeeAuthEmail,
  signInEmployee,
  signOutEmployee,
};
