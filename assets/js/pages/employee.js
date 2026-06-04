/**
 * หน้าข้อมูลพนักงาน — แสดงรายละเอียดผู้ใช้ที่ Login อยู่
 */
import { showConfirmModal, showToast } from '../ui.js';
import { escapeHTML } from '../utils.js';
import { changeUserPassword } from '../services/account-password.js';

function getFullName() {
  return `${sessionStorage.getItem('empName') || '-'} ${sessionStorage.getItem('empLastname') || ''}`.trim();
}

export function render() {
  // ตรวจสอบสถานะเพื่อทำสีป้าย (Badge)
  const isActive = sessionStorage.getItem('empActive') === 'true';
  const statusColor = isActive ? '#40c057' : '#fa5252';
  const statusText = isActive ? 'กำลังใช้งาน (Active)' : 'ระงับการใช้งาน (Inactive)';
  const fullName = getFullName();
  const employeeId = sessionStorage.getItem('empId') || '-';
  const department = sessionStorage.getItem('empDepartment') || '-';
  const email = sessionStorage.getItem('empEmail') || '-';
  const levelEn = sessionStorage.getItem('empLevel_en') || '-';
  const levelHr = sessionStorage.getItem('empLevel_hr') || '-';

  return `
    <div class="app-page app-page-tight">
      <section class="page-hero page-hero-eng fade-in">
        <div class="page-hero-copy">
          <p class="page-hero-eyebrow">Account Profile</p>
          <h1 class="page-hero-title">${escapeHTML(fullName || '-')}</h1>
          <p class="page-hero-subtitle">ข้อมูลผู้ใช้งาน สิทธิ์การเข้าถึง และสถานะบัญชีสำหรับการใช้งานระบบ CSM SERVICE</p>
        </div>
        <div class="page-hero-meta">
          <div class="page-hero-stat">
            <span>รหัสพนักงาน</span>
            <strong>${escapeHTML(employeeId)}</strong>
          </div>
          <div class="page-hero-stat">
            <span>แผนก</span>
            <strong>${escapeHTML(department)}</strong>
          </div>
        </div>
      </section>

      <section class="form-card fade-in emp-profile-card">
        <div class="emp-profile-header">
          <div class="emp-profile-avatar">
            <i class="fa-solid fa-user-gear"></i>
          </div>
          <div>
            <h2 class="emp-profile-name">${escapeHTML(fullName || '-')}</h2>
            <p class="emp-profile-id">รหัสพนักงาน: ${escapeHTML(employeeId)}</p>
          </div>
        </div>

        <div class="emp-profile-grid">
          <div class="emp-info-section">
            <h4>
              <i class="fa-solid fa-address-card"></i> ข้อมูลทั่วไป
            </h4>
            <div class="emp-info-list">
              <p><strong>แผนก:</strong> ${escapeHTML(department)}</p>
              <p><strong>อีเมล:</strong> ${escapeHTML(email)}</p>
              <p><strong>สถานะ:</strong> 
                <span class="emp-status-badge" style="background: ${statusColor};">
                  ${escapeHTML(statusText)}
                </span>
              </p>
            </div>
          </div>

          <div class="emp-info-section">
            <h4>
              <i class="fa-solid fa-shield-halved"></i> สิทธิ์การเข้าถึงระบบ
            </h4>
            <div class="emp-info-list">
              <div class="emp-level-row">
                <span>Engineer Level:</span>
                <strong class="emp-level-value">${escapeHTML(levelEn)}</strong>
              </div>
              <div class="emp-level-row">
                <span>Human Resources Level:</span>
                <strong class="emp-level-value">${escapeHTML(levelHr)}</strong>
              </div>
              <p class="emp-perm-note">* สิทธิ์การใช้งานถูกกำหนดโดยผู้ดูแลระบบ</p>
            </div>
          </div>
        </div>
      </section>

      <section class="form-card fade-in emp-password-card">
        <div class="emp-password-head">
          <div>
            <p class="page-hero-eyebrow">Password Sync</p>
            <h2 class="emp-password-title">เปลี่ยนรหัสผ่านผู้ใช้งาน</h2>
            <p class="emp-password-subtitle">ระบบจะอัปเดตรหัสผ่านไปยัง Google Sheet, Firebase DHR/User ฝั่ง EN และ Firebase DHR/User ฝั่ง HR ในครั้งเดียว</p>
          </div>
          <div class="emp-password-badge">
            <i class="fa-solid fa-shield-keyhole"></i>
            <span>Sync 3 Targets</span>
          </div>
        </div>

        <form id="emp-password-form" class="emp-password-form" novalidate>
          <div class="emp-password-grid">
            <label class="emp-password-field">
              <span>รหัสผ่านปัจจุบัน</span>
              <input type="password" class="form-control" id="emp-current-password" autocomplete="current-password" placeholder="กรอกรหัสผ่านเดิม">
            </label>
            <label class="emp-password-field">
              <span>รหัสผ่านใหม่</span>
              <input type="password" class="form-control" id="emp-new-password" autocomplete="new-password" placeholder="อย่างน้อย 6 ตัวอักษร">
            </label>
            <label class="emp-password-field">
              <span>ยืนยันรหัสผ่านใหม่</span>
              <input type="password" class="form-control" id="emp-confirm-password" autocomplete="new-password" placeholder="กรอกรหัสผ่านใหม่อีกครั้ง">
            </label>
          </div>

          <div class="emp-password-note">
            ใช้รหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร และหลีกเลี่ยงการใช้รหัสเดิมซ้ำ
          </div>

          <div class="emp-password-actions">
            <button type="submit" class="btn btn-primary" id="emp-password-submit">
              <i class="fa-solid fa-rotate"></i>
              <span>อัปเดตรหัสผ่าน</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  `;
}

async function handlePasswordSubmit(event) {
  event.preventDefault();

  const employeeId = sessionStorage.getItem('empId') || '';
  const currentPassword = document.getElementById('emp-current-password')?.value || '';
  const newPassword = document.getElementById('emp-new-password')?.value || '';
  const confirmPassword = document.getElementById('emp-confirm-password')?.value || '';
  const submitButton = document.getElementById('emp-password-submit');

  if (!employeeId) {
    showToast('ไม่พบข้อมูลผู้ใช้งานที่เข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่', 'error');
    return;
  }

  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast('กรุณากรอกรหัสผ่านให้ครบทั้ง 3 ช่อง', 'warning');
    return;
  }

  if (newPassword.length < 6) {
    showToast('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร', 'warning');
    return;
  }

  if (newPassword === currentPassword) {
    showToast('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน', 'warning');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('ยืนยันรหัสผ่านใหม่ไม่ตรงกัน', 'warning');
    return;
  }

  const confirmed = await showConfirmModal(
    'ยืนยันการเปลี่ยนรหัสผ่าน',
    'ระบบจะอัปเดตรหัสผ่านไปยัง Google Sheet และ Firebase ทุกจุดที่เกี่ยวข้องทันที',
    'fa-key',
    'ยืนยัน',
    'ยกเลิก'
  );

  if (!confirmed) return;

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.classList.add('is-loading');
  }

  const submitLabel = submitButton?.querySelector('span');
  const originalLabel = submitLabel?.textContent || 'อัปเดตรหัสผ่าน';
  if (submitLabel) {
    submitLabel.textContent = 'กำลังอัปเดต...';
  }

  try {
    await changeUserPassword({
      employeeId,
      currentPassword,
      newPassword,
    });

    document.getElementById('emp-password-form')?.reset();
    showToast('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว ระบบซิงก์ข้อมูลครบทุกจุด', 'success');
  } catch (error) {
    console.error('Password sync error:', error);
    showToast(`เปลี่ยนรหัสผ่านไม่สำเร็จ: ${error.message}`, 'error');
  } finally {
    if (submitLabel) {
      submitLabel.textContent = originalLabel;
    }
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.classList.remove('is-loading');
    }
  }
}

export function init() {
  document.getElementById('emp-password-form')?.addEventListener('submit', handlePasswordSubmit);
}
