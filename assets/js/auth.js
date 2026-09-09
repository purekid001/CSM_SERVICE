// --- ระบบ Authentication (Login / Auto-login / Logout) ---
import {
  auth,
  database,
  get,
  ref,
  signInEmployee,
  signOutEmployee,
} from './firebase.js';
import { getPageFromHash } from './router.js';
import { escapeAttr, escapeHTML, getUserAccessProfile, isActiveUserRecord } from './utils.js';
import { syncEngAutoCloseForSession } from './services/eng-auto-close.js';
import { getUserDirectoryDepartments } from './services/google-sheets.js';
import { registerUserAccount } from './services/account-registration.js';
import { initLoginWeatherTheme } from './services/login-weather.js';
import { showBrandLoader } from './services/brand-loader.js';
import { showAlert, showToast } from './ui.js';

// --- อ้างอิง UI Elements ---
const loginScreen = document.getElementById('login-screen');
const dashboardLayout = document.getElementById('dashboard-layout');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const errorMsg = document.getElementById('error-message');
const registerErrorMsg = document.getElementById('register-error-message');
const displayNameSpan = document.getElementById('display-name');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const registerDepartmentSelect = document.getElementById('register-department');
const loginUsernameInput = document.getElementById('username');
const authModeButtons = Array.from(document.querySelectorAll('[data-auth-mode]'));
const authModeLinks = Array.from(document.querySelectorAll('[data-auth-mode-link]'));
const registerEmployeeIdInput = document.getElementById('register-employee-id');
const authInlineSwitch = document.getElementById('auth-inline-switch');

const AUTH_COPY = {
  login: {
    title: 'เข้าสู่ระบบ',
    subtitle: 'CSM SERVICE DATABASE SYSTEM',
    inlinePrefix: 'ยังไม่มีบัญชีผู้ใช้?',
    inlineAction: 'สมัครสมาชิก',
    inlineTarget: 'register',
  },
  register: {
    title: 'สมัครสมาชิก',
    subtitle: 'สร้างบัญชีผู้ใช้ใหม่ด้วยข้อมูลพนักงานและแผนกจากระบบกลาง',
    inlinePrefix: 'มีบัญชีผู้ใช้แล้ว?',
    inlineAction: 'กลับไปเข้าสู่ระบบ',
    inlineTarget: 'login',
  },
};

/**
 * --- ฟังก์ชัน Helper: บันทึกข้อมูล User ลง Session ---
 * ใช้ร่วมกันทั้ง Auto-login และ Manual Login เพื่อลด Code Duplication
 */
function setUserSession(userId, userData) {
  // sessionStorage เป็นเพียง UI cache; Firebase Auth ID token คือ source of truth
  // สำหรับ Functions และ Security Rules
  sessionStorage.setItem('isLoggedIn', 'true');
  sessionStorage.setItem('empId', userId);
  sessionStorage.setItem('empName', userData.firstname || 'User');
  sessionStorage.setItem('empLastname', userData.lastname || ' ');
  sessionStorage.setItem('empDepartment', userData.department || ' ');
  sessionStorage.setItem('empActive', isActiveUserRecord(userData.active) ? 'true' : 'false');
  sessionStorage.setItem('empEmail', userData.email || ' ');
  sessionStorage.setItem('empLevel_en', userData.level || ' ');
  sessionStorage.setItem('empLevel_hr', userData.level_Hr || ' ');
  sessionStorage.setItem('empLevel_it', userData.level_It || ' ');
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
 * อนุญาตให้เข้าสู่ระบบเฉพาะ user ที่ active เป็น true เท่านั้น
 */
function isUserActive(userData) {
  return isActiveUserRecord(userData.active);
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
  const hrEvalReport = document.querySelector('[data-perm="hr-eval-report"]');
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

  if (access.isHrDispatchAdmin || access.isHrDocAdmin || access.isSystemAdmin) {
    // เห็นรายงานผลประเมิน
  } else {
    if (hrEvalReport) hrEvalReport.style.display = 'none';
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

function refreshSessionUi() {
  if (sessionStorage.getItem('isLoggedIn') !== 'true') return;

  applyMenuPermissions();
  syncEngAutoCloseForSession();

  const currentPage = getPageFromHash();
  if (canAccessPage(currentPage)) {
    showPage(currentPage);
  } else {
    showPage('home');
  }
}

function setAuthMode(mode = 'login') {
  const safeMode = mode === 'register' ? 'register' : 'login';
  const copy = AUTH_COPY[safeMode];
  const isRegisterMode = safeMode === 'register';

  if (loginForm) {
    loginForm.hidden = isRegisterMode;
    loginForm.classList.toggle('auth-form-hidden', isRegisterMode);
  }

  if (registerForm) {
    registerForm.hidden = !isRegisterMode;
    registerForm.classList.toggle('auth-form-hidden', !isRegisterMode);
  }

  authModeButtons.forEach(button => {
    const isActive = button.dataset.authMode === safeMode;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  if (authTitle) authTitle.textContent = copy.title;
  if (authSubtitle) authSubtitle.textContent = copy.subtitle;

  if (authInlineSwitch) {
    authInlineSwitch.innerHTML = `${escapeHTML(copy.inlinePrefix)} <button type="button" class="auth-inline-btn" data-auth-mode-link="${escapeAttr(copy.inlineTarget)}">${escapeHTML(copy.inlineAction)}</button>`;
    authInlineSwitch
      .querySelector('[data-auth-mode-link]')
      ?.addEventListener('click', () => setAuthMode(copy.inlineTarget));
  }

  if (!isRegisterMode) {
    registerErrorMsg.textContent = '';
  } else {
    errorMsg.textContent = '';
  }
}

function setDepartmentLoadingState(message, disabled = true) {
  if (!registerDepartmentSelect) return;
  registerDepartmentSelect.innerHTML = `<option value="">${escapeHTML(message)}</option>`;
  registerDepartmentSelect.disabled = disabled;
}

async function loadRegistrationDepartments() {
  if (!registerDepartmentSelect) return;

  setDepartmentLoadingState('กำลังโหลดข้อมูลแผนก...');

  try {
    const { departments } = await getUserDirectoryDepartments();

    if (!departments.length) {
      setDepartmentLoadingState('ไม่พบข้อมูลแผนก');
      return;
    }

    registerDepartmentSelect.innerHTML = [
      '<option value="">เลือกแผนก</option>',
      ...departments.map(department => `<option value="${escapeAttr(department)}">${escapeHTML(department)}</option>`),
    ].join('');
    registerDepartmentSelect.disabled = false;
  } catch (error) {
    console.error('Department load error:', error);
    setDepartmentLoadingState('โหลดข้อมูลแผนกไม่สำเร็จ');
    registerErrorMsg.textContent = 'ไม่สามารถโหลดรายชื่อแผนกจาก Google Sheet ได้ในขณะนี้';
  }
}

function sanitizeEmployeeIdInput() {
  if (!registerEmployeeIdInput) return;
  registerEmployeeIdInput.value = registerEmployeeIdInput.value.replace(/\D/g, '').slice(0, 8);
}

function isValidRegistrationEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function getRegistrationFormValues() {
  return {
    employeeId: document.getElementById('register-employee-id')?.value.trim() || '',
    password: document.getElementById('register-password')?.value || '',
    confirmPassword: document.getElementById('register-confirm-password')?.value || '',
    firstname: document.getElementById('register-firstname')?.value.trim() || '',
    lastname: document.getElementById('register-lastname')?.value.trim() || '',
    department: document.getElementById('register-department')?.value.trim() || '',
    email: document.getElementById('register-email')?.value.trim() || '',
  };
}

function validateRegistrationForm(values) {
  if (!/^\d{6,8}$/.test(values.employeeId)) {
    return 'User ต้องเป็นรหัสพนักงานตัวเลข 6-8 หลัก';
  }

  if (!values.password || values.password.length < 6) {
    return 'Password ต้องมีอย่างน้อย 6 ตัวอักษร';
  }

  if (values.password !== values.confirmPassword) {
    return 'Password และ Check Password ไม่ตรงกัน';
  }

  if (!values.firstname) {
    return 'กรุณากรอกชื่อ';
  }

  if (!values.lastname) {
    return 'กรุณากรอกนามสกุล';
  }

  if (!values.department) {
    return 'กรุณาเลือกแผนก';
  }

  if (!values.email || !isValidRegistrationEmail(values.email)) {
    return 'กรุณากรอก Email ให้ถูกต้อง';
  }

  return '';
}

async function loadAuthenticatedUser(userId) {
  const snapshot = await get(ref(database, `DHR/User/${userId}`));
  if (!snapshot.exists()) {
    throw new Error('ไม่พบข้อมูลรหัสพนักงานนี้ในระบบ');
  }

  const userData = snapshot.val() || {};
  if (!isUserActive(userData)) {
    await signOutEmployee();
    sessionStorage.clear();
    throw new Error('บัญชีผู้ใช้นี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
  }

  setUserSession(userId, userData);
  toggleView(true, getDisplayName(userData, userId));
  return userData;
}

function getLoginErrorMessage(error) {
  const code = String(error?.code || '');
  if (code === 'auth/user-disabled') {
    return 'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
  }
  if (code === 'auth/too-many-requests') {
    return 'มีการเข้าสู่ระบบผิดหลายครั้ง กรุณารอสักครู่แล้วลองใหม่';
  }
  if (
    code === 'auth/invalid-credential'
    || code === 'auth/invalid-login-credentials'
    || code === 'auth/user-not-found'
    || code === 'auth/wrong-password'
  ) {
    return 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง';
  }
  return error?.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
}

/**
 * --- ระบบตรวจสอบ Auto-login (DOMContentLoaded) ---
 * Firebase Auth จะคืน session ตาม persistence ที่ผู้ใช้เลือกไว้
 */
window.addEventListener('DOMContentLoaded', async () => {
  setAuthMode('login');
  void initLoginWeatherTheme();
  // Department loading has its own disabled state and must not block login.
  void loadRegistrationDepartments();
  const finishLoading = showBrandLoader('กำลังเตรียมระบบ...');

  try {
    const rememberedUser = localStorage.getItem('rememberedUser') || '';
    if (rememberedUser && loginUsernameInput) {
      loginUsernameInput.value = rememberedUser;
    }
    await auth.authStateReady();
    if (auth.currentUser?.uid) {
      await loadAuthenticatedUser(auth.currentUser.uid);
    }
  } catch (error) {
    console.error('Firebase Auth restore error:', error);
    errorMsg.textContent = getLoginErrorMessage(error);
  } finally {
    finishLoading();
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
    await signOutEmployee();
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
  const submitBtn = loginForm.querySelector('.btn-submit');
  if (submitBtn.disabled) return;

  errorMsg.textContent = "";
  submitBtn.textContent = 'กำลังตรวจสอบ...';
  submitBtn.disabled = true;
  const finishLoading = showBrandLoader('กำลังเข้าสู่ระบบ...');

  try {
    const credential = await signInEmployee(
      username,
      password,
      rememberChecked,
    );
    await loadAuthenticatedUser(credential.user.uid);

    if (rememberChecked) {
      localStorage.setItem('rememberedUser', username);
    } else {
      localStorage.removeItem('rememberedUser');
    }

    console.log('เข้าสู่ระบบผ่าน Firebase Auth สำเร็จ');
  } catch (error) {
    console.error('Firebase Auth login error:', error);
    errorMsg.textContent = getLoginErrorMessage(error);
  } finally {
    submitBtn.textContent = 'เข้าสู่ระบบ';
    submitBtn.disabled = false;
    finishLoading();
  }
});

registerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const values = getRegistrationFormValues();
  const submitBtn = document.getElementById('register-submit-btn');
  if (submitBtn?.disabled) return;
  const validationMessage = validateRegistrationForm(values);

  registerErrorMsg.textContent = '';

  if (validationMessage) {
    registerErrorMsg.textContent = validationMessage;
    return;
  }

  if (submitBtn) {
    submitBtn.textContent = 'กำลังสมัครสมาชิก...';
    submitBtn.disabled = true;
  }
  const finishLoading = showBrandLoader('กำลังสมัครสมาชิก...');

  try {
    await registerUserAccount(values);
    // Release the overlay before focusing login or opening the success dialog.
    finishLoading();

    registerForm.reset();
    setAuthMode('login');
    errorMsg.textContent = '';
    registerErrorMsg.textContent = '';

    if (loginUsernameInput) {
      loginUsernameInput.value = values.employeeId;
      loginUsernameInput.focus();
    }

    await loadRegistrationDepartments();
    showToast('สมัครสมาชิกสำเร็จแล้ว', 'success');
    await showAlert(
      'สมัครสมาชิกสำเร็จ',
      `สร้างบัญชีรหัสพนักงาน ${values.employeeId} เรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านที่เพิ่งตั้งค่าไว้`,
      'fa-user-check',
      'ไปหน้าเข้าสู่ระบบ'
    );
  } catch (error) {
    console.error('Register error:', error);
    registerErrorMsg.textContent = error.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก';
  } finally {
    if (submitBtn) {
      submitBtn.textContent = 'สมัครสมาชิก';
      submitBtn.disabled = false;
    }
    finishLoading();
  }
});

authModeButtons.forEach(button => {
  button.addEventListener('click', () => setAuthMode(button.dataset.authMode || 'login'));
});

authModeLinks.forEach(button => {
  button.addEventListener('click', () => setAuthMode(button.dataset.authModeLink || 'login'));
});

registerEmployeeIdInput?.addEventListener('input', sanitizeEmployeeIdInput);

window.addEventListener('csm:session-profile-updated', refreshSessionUi);

export { toggleView };
