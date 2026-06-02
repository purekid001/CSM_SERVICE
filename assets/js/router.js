/**
 * --- ระบบสลับเนื้อหาภายใน Container (Single Page logic) ---
 * ใช้สำหรับเปลี่ยนเนื้อหาตรงกลางโดยไม่ต้องเปลี่ยนหน้าเว็บใหม่
 * แต่ละหน้าแยกเป็นไฟล์ใน /pages/ เพื่อให้จัดการง่าย
 */
import { showToast } from './ui.js';
import { canAccessPage } from './utils.js';
import * as home from './pages/home.js';
import * as employee from './pages/employee.js';
import * as engRequest from './pages/eng-request.js';
import * as engList from './pages/eng-list.js';
import * as engAutoClose from './pages/eng-auto-close.js';
import * as engDoc from './pages/eng-doc.js';
import * as engReport from './pages/eng-report.js';
import * as hrCar from './pages/hr-car.js';
import * as hrShuttle from './pages/hr-shuttle.js';
import * as hrBookingList from './pages/hr-booking-list.js';
import * as hrShuttleGroup from './pages/hr-shuttle-group.js';
import * as hrReport from './pages/hr-report.js';
import * as hrDoc from './pages/hr-doc.js';
import * as hrEvaluation from './pages/hr-evaluation.js';
import * as hrEvaluationReport from './pages/hr-evaluation-report.js';
import * as backup from './pages/backup.js';

// แมปชื่อหน้ากับ module
const pages = {
  'home':            home,
  'employee':        employee,
  'eng-request':     engRequest,
  'eng-list':        engList,
  'eng-auto-close':  engAutoClose,
  'eng-doc':         engDoc,
  'eng-report':      engReport,

  // HR Routes
  'hr-car':          hrCar,
  'hr-shuttle':      hrShuttle,
  'hr-list':         hrBookingList,
  'hr-doc':          hrDoc,
  'hr-report':       hrReport,
  'hr-shuttle-group': hrShuttleGroup,
  'hr-evaluation':   hrEvaluation,
  'hr-evaluation-report': hrEvaluationReport,

  // Admin Routes
  'admin-backup':    backup,
};

function renderPage(page, { syncHash = true, notifyOnDeny = false } = {}) {
  const appContainer = document.getElementById('app-container');
  const targetPage = pages[page] ? page : 'home';

  if (!canAccessPage(targetPage)) {
    if (notifyOnDeny) {
      showToast('คุณไม่มีสิทธิ์เข้าถึงหน้านี้', 'error');
    }
    if (targetPage !== 'home' && canAccessPage('home')) {
      return renderPage('home', { syncHash: true, notifyOnDeny: false });
    }
    return;
  }

  // 1. จัดการสถานะ Active: ลบจากทุกปุ่ม แล้วใส่ให้ปุ่มที่ถูกกด
  document.querySelectorAll('.menu-item').forEach(btn => btn.classList.remove('active'));

  // ค้นหาปุ่มที่มีการเรียกหน้าชื่อเดียวกับ 'page' แล้วใส่คลาส active
  const activeBtn = document.querySelector(`[onclick*="'${targetPage}'"]`);
  if (activeBtn) activeBtn.classList.add('active');

  // เปิด dropdown ของปุ่มที่ active (ถ้าอยู่ใน sub-menu)
  if (activeBtn) {
    const dropdownGroup = activeBtn.closest('.dropdown-group');
    if (dropdownGroup) {
      const container = dropdownGroup.querySelector('.dropdown-container');
      if (container) container.style.display = 'block';
    }
  }

  // 2. บันทึกหน้าปัจจุบันไว้ใน URL hash (เพื่อให้ F5 กลับมาหน้าเดิมได้)
  if (syncHash && window.location.hash !== `#${targetPage}`) {
    window.location.hash = targetPage;
  }

  // 3. ดึง module ของหน้าที่ต้องการ
  const pageModule = pages[targetPage];

  if (pageModule) {
    // ฉีด HTML จาก render()
    appContainer.innerHTML = pageModule.render();
    // เรียก init() ถ้ามี (สำหรับผูก event listeners หลัง render)
    if (typeof pageModule.init === 'function') {
      pageModule.init();
    }
  } else {
    // Default fallback
    appContainer.innerHTML = `
      <div class="card fade-in">
        <h2>🏠 หน้าหลัก</h2>
        <p>ยินดีต้อนรับสู่ระบบ CSM SERVICE</p>
      </div>`;
  }
}

window.showPage = (page) => {
  renderPage(page, { syncHash: true, notifyOnDeny: true });
};

window.addEventListener('hashchange', () => {
  if (sessionStorage.getItem('isLoggedIn') === 'true') {
    renderPage(getPageFromHash(), { syncHash: false, notifyOnDeny: true });
  }
});

/**
 * อ่านหน้าจาก URL hash เพื่อกลับไปหน้าเดิมหลังกด F5
 * คืนค่าชื่อหน้า หรือ 'home' ถ้าไม่มี hash
 */
function getPageFromHash() {
  const hash = window.location.hash.replace('#', '');
  return (hash && pages[hash]) ? hash : 'home';
}

// Export ให้ auth.js เรียกใช้ตอน login สำเร็จ
export { getPageFromHash };
