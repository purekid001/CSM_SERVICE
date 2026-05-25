/**
 * หน้าข้อมูลพนักงาน — แสดงรายละเอียดผู้ใช้ที่ Login อยู่
 */
export function render() {
  // ตรวจสอบสถานะเพื่อทำสีป้าย (Badge)
  const isActive = sessionStorage.getItem('empActive') === 'Yes';
  const statusColor = isActive ? '#40c057' : '#fa5252';
  const statusText = isActive ? 'กำลังใช้งาน (Active)' : 'ระงับการใช้งาน (Inactive)';
  const fullName = `${sessionStorage.getItem('empName') || '-'} ${sessionStorage.getItem('empLastname') || ''}`.trim();

  return `
    <div class="app-page app-page-tight">
      <section class="page-hero page-hero-eng fade-in">
        <div class="page-hero-copy">
          <p class="page-hero-eyebrow">Account Profile</p>
          <h1 class="page-hero-title">${fullName || '-'}</h1>
          <p class="page-hero-subtitle">ข้อมูลผู้ใช้งาน สิทธิ์การเข้าถึง และสถานะบัญชีสำหรับการใช้งานระบบ CSM SERVICE</p>
        </div>
        <div class="page-hero-meta">
          <div class="page-hero-stat">
            <span>รหัสพนักงาน</span>
            <strong>${sessionStorage.getItem('empId') || '-'}</strong>
          </div>
          <div class="page-hero-stat">
            <span>แผนก</span>
            <strong>${sessionStorage.getItem('empDepartment') || '-'}</strong>
          </div>
        </div>
      </section>

      <section class="form-card fade-in emp-profile-card">
        <div class="emp-profile-header">
          <div class="emp-profile-avatar">
            <i class="fa-solid fa-user-gear"></i>
          </div>
          <div>
            <h2 class="emp-profile-name">${fullName || '-'}</h2>
            <p class="emp-profile-id">รหัสพนักงาน: ${sessionStorage.getItem('empId') || '-'}</p>
          </div>
        </div>

        <div class="emp-profile-grid">
          <div class="emp-info-section">
            <h4>
              <i class="fa-solid fa-address-card"></i> ข้อมูลทั่วไป
            </h4>
            <div class="emp-info-list">
              <p><strong>แผนก:</strong> ${sessionStorage.getItem('empDepartment') || '-'}</p>
              <p><strong>อีเมล:</strong> ${sessionStorage.getItem('empEmail') || '-'}</p>
              <p><strong>สถานะ:</strong> 
                <span class="emp-status-badge" style="background: ${statusColor};">
                  ${statusText}
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
                <strong class="emp-level-value">${sessionStorage.getItem('empLevel_en') || '-'}</strong>
              </div>
              <div class="emp-level-row">
                <span>Human Resources Level:</span>
                <strong class="emp-level-value">${sessionStorage.getItem('empLevel_hr') || '-'}</strong>
              </div>
              <p class="emp-perm-note">* สิทธิ์การใช้งานถูกกำหนดโดยผู้ดูแลระบบ</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}
