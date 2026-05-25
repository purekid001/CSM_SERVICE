// --- ระบบ Authentication (Login / Auto-login / Logout) ---
import { database, ref, get } from './firebase.js';
import { getPageFromHash } from './router.js';
import { getUserAccessProfile } from './utils.js';
import { syncEngAutoCloseForSession } from './services/eng-auto-close.js';

// --- อ้างอิง UI Elements ---
const loginScreen = document.getElementById('login-screen');
const dashboardLayout = document.getElementById('dashboard-layout');
const loginForm = document.getElementById('login-form');
const errorMsg = document.getElementById('error-message');
const displayNameSpan = document.getElementById('display-name');

/**
 * --- ฟังก์ชัน Helper: บันทึกข้อมูล User ลง Session ---
 * ใช้ร่วมกันทั้ง Auto-login และ Manual Login เพื่อลด Code Duplication
 */
function setUserSession(userId, userData) {
  // TODO(next-security): sessionStorage ควรเป็นแค่ cache ฝั่ง UI ไม่ใช่ source of truth ของสิทธิ์การใช้งาน
  // รอบถัดไปควรย้าย auth ไปใช้ Firebase Auth / backend session แล้วให้ route ต่าง ๆ ตรวจจาก token/session จริง
  sessionStorage.setItem('isLoggedIn', 'true');
  sessionStorage.setItem('empId', userId);
  sessionStorage.setItem('empName', userData.firstname || 'User');
  sessionStorage.setItem('empLastname', userData.lastname || ' ');
  sessionStorage.setItem('empDepartment', userData.department || ' ');
  sessionStorage.setItem('empActive', userData.active || ' ');
  sessionStorage.setItem('empEmail', userData.email || ' ');
  sessionStorage.setItem('empLevel_en', userData.level || ' ');
  sessionStorage.setItem('empLevel_hr', userData.level_Hr || ' ');
}

/**
 * --- ฟังก์ชันสร้างชื่อแสดงผล ---
 */
function getDisplayName(userData, fallback) {
  const name = `${userData.firstname || ''} ${userData.lastname || ''}`.trim();
  return name || fallback;
}

/**
 * --- ตรวจสอบสถานะบัญชี ---
 * อนุญาตให้เข้าสู่ระบบเฉพาะ user ที่ active เป็น "Yes" เท่านั้น
 */
function isUserActive(userData) {
  return String(userData.active || '').trim().toLowerCase() === 'yes';
}

/**
 * --- ฟังก์ชันจัดการการแสดงผล (View Switching) ---
 * ทำหน้าที่สลับก้อน Container ระหว่างหน้า Login และ Dashboard
 */
/**
 * --- กำหนดสิทธิ์เมนูตาม Level ---
 */
function applyMenuPermissions() {
  const access = getUserAccessProfile();

  // Engineer menus
  const enDoc = document.querySelector('[data-perm="en-doc"]');
  // HR menus
  const hrDoc = document.querySelector('[data-perm="hr-doc"]');
  // Admin menus
  const adminGroup = document.getElementById('admin-menu-group');

  // Engineer rules
  if (access.isEngineeringDocAdmin) {
    // admin, admin_en เห็นหมดในส่วนของ Engineer
  } else {
    // level 1, 0, หรืออื่นๆ
    if (enDoc) enDoc.style.display = 'none';
  }

  // HR rules
  if (access.isHrDocAdmin) {
    // admin, admin_hr เห็นหมดในส่วนของ HR
  } else {
    // level 1, 0, หรืออื่นๆ
    if (hrDoc) hrDoc.style.display = 'none';
  }
  
  
  // System Admin rules
  if (access.isSystemAdmin) {
    if (adminGroup) adminGroup.style.display = 'block';
  } else {
    if (adminGroup) adminGroup.style.display = 'none';
  }
}

function toggleView(isDashboard, name = "") {
  if (isDashboard) {
    loginScreen.style.display = 'none';
    dashboardLayout.style.display = 'flex';
    displayNameSpan.textContent = name;
    applyMenuPermissions();
    syncEngAutoCloseForSession();
    showPage(getPageFromHash());
  } else {
    loginScreen.style.display = 'block';
    dashboardLayout.style.display = 'none';
  }
}

/**
 * --- ระบบตรวจสอบ Auto-login (DOMContentLoaded) ---
 * ทำงานทันทีที่โหลดหน้าเว็บ เพื่อเช็คว่าเคย "จดจำการเข้าสู่ระบบ" ไว้หรือไม่
 */
window.addEventListener('DOMContentLoaded', async () => {
  const savedUser = localStorage.getItem('rememberedUser');
  const autoLogin = localStorage.getItem('autoLogin');

  if (savedUser && autoLogin === 'true') {
    try {
      const userRef = ref(database, `DHR/User/${savedUser}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();

        if (!isUserActive(userData)) {
          localStorage.removeItem('rememberedUser');
          localStorage.removeItem('autoLogin');
          sessionStorage.clear();
          errorMsg.textContent = "บัญชีผู้ใช้นี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ";
          return;
        }

        // บันทึก Session ชั่วคราว
        setUserSession(savedUser, userData);

        console.log("🚀 ระบบจำคุณได้: กำลังเข้าสู่หน้า Dashboard");
        toggleView(true, getDisplayName(userData, savedUser));
      }
    } catch (e) {
      console.error("Auto-login error:", e);
    }
  }
});

/**
 * --- จัดการการ Logout ---
 * ล้างข้อมูลทั้งในเครื่อง (ถาวร) และใน Session (ชั่วคราว)
 */
window.logout = async () => {
  const confirmed = await showConfirmModal(
    'ออกจากระบบ',
    'คุณต้องการออกจากระบบใช่หรือไม่?',
    'fa-right-from-bracket'
  );
  
  if (confirmed) {
    localStorage.removeItem('rememberedUser');
    localStorage.removeItem('autoLogin');
    sessionStorage.clear();
    window.location.reload();
  }
};

/**
 * --- จัดการฟอร์ม Login ---
 */
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const rememberChecked = document.getElementById('remember').checked;
  const submitBtn = document.querySelector('.btn-submit');

  errorMsg.textContent = "";
  submitBtn.textContent = 'กำลังตรวจสอบ...';
  submitBtn.disabled = true;

  try {
    const userRef = ref(database, `DHR/User/${username}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      const userData = snapshot.val();

      // TODO(next-security): ห้ามตรวจ password ตรงจาก client ในระยะยาว
      // จุดนี้ควรย้ายไป verify ผ่าน Firebase Auth หรือ Cloud Function เพื่อไม่ให้ client อ่าน/เทียบรหัสผ่านเอง
      // ตรวจสอบรหัสผ่านตรงๆ จาก Database
      if (userData.password === password) {
        if (!isUserActive(userData)) {
          localStorage.removeItem('rememberedUser');
          localStorage.removeItem('autoLogin');
          sessionStorage.clear();
          errorMsg.textContent = "บัญชีผู้ใช้นี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ";
          return;
        }

        // จัดการระบบจดจำรหัส (localStorage)
        if (rememberChecked) {
          localStorage.setItem('rememberedUser', username);
          localStorage.setItem('autoLogin', 'true');
        } else {
          localStorage.removeItem('rememberedUser');
          localStorage.removeItem('autoLogin');
        }

        // เก็บข้อมูลลง Session
        setUserSession(username, userData);

        console.log("✅ เข้าสู่ระบบสำเร็จ");
        toggleView(true, getDisplayName(userData, username));

      } else {
        errorMsg.textContent = "รหัสผ่านไม่ถูกต้อง";
      }
    } else {
      errorMsg.textContent = "ไม่พบข้อมูลรหัสพนักงานนี้";
    }
  } catch (error) {
    console.error(error);
    errorMsg.textContent = "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล";
  } finally {
    submitBtn.textContent = 'เข้าสู่ระบบ';
    submitBtn.disabled = false;
  }
});

export { toggleView };
