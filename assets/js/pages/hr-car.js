/**
 * HR — Car Booking (จองรถ)
 */
import { hrDatabase, ref, get, set } from '../firebase-hr.js';
import { province_th } from '../province_th.js';
import { escapeHTML, escapeAttr } from '../utils.js';

/** แปลง Date → "dd/MM/yyyy HH:mm:ss" */
function dateToString(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
}

export function render() {
  // === ส่วนของ HTML Template ===
  // คืนค่าฟอร์มการจองรถ (Request For Booking) สำหรับให้ผู้ใช้งานกรอกข้อมูล
  const empName = sessionStorage.getItem('empName') || '';
  const empLastname = sessionStorage.getItem('empLastname') || '';
  const fullName = `${empName} ${empLastname}`.trim() || '-';

  return `
    <div class="app-page">
      <section class="page-hero page-hero-hr fade-in">
        <div class="page-hero-copy">
          <p class="page-hero-eyebrow">HR Mobility</p>
          <h1 class="page-hero-title">Request For Booking</h1>
          <p class="page-hero-subtitle">สร้างคำขอใช้รถบริษัทพร้อมข้อมูลจุดรับ จุดส่ง และเวลาที่ชัดเจน เพื่อให้ทีม HR จัดรถและคนขับได้แม่นยำขึ้น</p>
        </div>
        <div class="page-hero-meta">
          <div class="page-hero-stat">
            <span>ผู้แจ้ง</span>
            <strong>${escapeHTML(fullName)}</strong>
          </div>
          <div class="page-hero-stat">
            <span>บริการ</span>
            <strong>Car Booking</strong>
          </div>
        </div>
      </section>

      <div class="page-note fade-in">
        <i class="fa-solid fa-route"></i>
        <div>ระบุประเภทการเดินทาง เวลารับ และเวลาส่งให้ครบ ระบบจะช่วยให้การจัดรถลื่นขึ้น โดยเฉพาะกรณีมีการเดินทางต่างจังหวัดหรือเวลานอกช่วงปกติ</div>
      </div>

      <div class="form-card fade-in">

        <!-- Header -->
        <div class="form-header">
          <div class="form-header-copy">
            <div class="form-header-icon" style="background: linear-gradient(135deg, #fef3c7, #fde68a); border-color: #fcd34d;">
              <i class="fa-solid fa-car-side" style="color: #b45309;"></i>
            </div>
            <div class="form-header-text">
              <h2>Request For Booking (จองรถ)</h2>
              <p>แบบฟอร์มจองรถยนต์บริษัทเพื่อออกปฏิบัติงาน</p>
            </div>
          </div>
          <div class="form-header-badge">
            <i class="fa-solid fa-user-check"></i>
            ส่งต่อหัวหน้าอนุมัติก่อนจัดรถ
          </div>
        </div>

        <!-- Form -->
        <form id="booking-form" autocomplete="off">
          <div class="form-grid">

          <!-- 1. ชื่อผู้แจ้ง -->
          <div class="form-group">
            <label><i class="fa-solid fa-user"></i> ชื่อผู้แจ้ง</label>
            <input type="text" class="form-control" id="bk-reporter" value="${escapeAttr(fullName)}" readonly>
          </div>

          <!-- 2. ประเภท รับ-ส่ง -->
          <div class="form-group">
            <label><i class="fa-solid fa-tags"></i> ประเภท รับ-ส่ง <span class="required">*</span></label>
            <select class="form-control" id="bk-type" required>
              <option value="" disabled selected>กำลังโหลด...</option>
            </select>
          </div>

          <!-- 3. รายละเอียดเพิ่มเติม (ประเภท) -->
          <div class="form-group full-width">
            <label><i class="fa-solid fa-comment-dots"></i> รายละเอียดเพิ่มเติม (ประเภท)</label>
            <input type="text" class="form-control" id="bk-type-detail" placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)">
          </div>

          <!-- 4. วันที่จอง -->
          <div class="form-group">
            <label><i class="fa-solid fa-calendar-days"></i> วันที่จอง <span class="required">*</span></label>
            <input type="text" class="form-control" id="bk-date" placeholder="dd/MM/yyyy" readonly required>
          </div>

          <!-- Spacer -->
          <div class="form-group"></div>

          <!-- ===== Section: สถานที่รับ ===== -->
          <div class="form-section-divider full-width">
            <i class="fa-solid fa-arrow-right-to-bracket"></i> สถานที่รับ
          </div>

          <!-- 5. สถานที่รับ -->
          <div class="form-group">
            <label><i class="fa-solid fa-location-dot"></i> สถานที่รับ <span class="required">*</span></label>
            <select class="form-control" id="bk-pickup-location" required>
              <option value="" disabled selected>กำลังโหลด...</option>
            </select>
          </div>

          <!-- สถานที่รับอื่นๆ (ซ่อนอยู่) -->
          <div class="form-group" id="bk-pickup-other-group" style="display: none;">
            <label><i class="fa-solid fa-pen"></i> กรอกสถานที่รับ <span class="required">*</span></label>
            <input type="text" class="form-control" id="bk-pickup-other" placeholder="ระบุสถานที่รับ">
          </div>
          
          <div class="form-group" id="bk-pickup-province-group" style="display: none;">
            <label><i class="fa-solid fa-map"></i> เลือกจังหวัด <span class="required">*</span></label>
            <select class="form-control" id="bk-pickup-province">
              <option value="" disabled selected>กำลังโหลด...</option>
            </select>
          </div>

          <!-- 7. เวลารับ -->
          <div class="form-group">
            <label><i class="fa-solid fa-clock"></i> เวลารับ <span class="required">*</span></label>
            <input type="text" class="form-control" id="bk-pickup-time" placeholder="HH:mm" readonly required>
          </div>

          <!-- 6. รายละเอียดเพิ่มเติม (สถานที่รับ) -->
          <div class="form-group full-width">
            <label><i class="fa-solid fa-comment-dots"></i> รายละเอียดเพิ่มเติม (สถานที่รับ)</label>
            <input type="text" class="form-control" id="bk-pickup-detail" placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)">
          </div>

          <!-- ===== Section: สถานที่ส่ง ===== -->
          <div class="form-section-divider full-width">
            <i class="fa-solid fa-arrow-right-from-bracket"></i> สถานที่ส่ง
          </div>

          <!-- 8. สถานที่ส่ง -->
          <div class="form-group">
            <label><i class="fa-solid fa-map-pin"></i> สถานที่ส่ง <span class="required">*</span></label>
            <select class="form-control" id="bk-dropoff-location" required>
              <option value="" disabled selected>กำลังโหลด...</option>
            </select>
          </div>

          <!-- สถานที่ส่งอื่นๆ (ซ่อนอยู่) -->
          <div class="form-group" id="bk-dropoff-other-group" style="display: none;">
            <label><i class="fa-solid fa-pen"></i> กรอกสถานที่ส่ง <span class="required">*</span></label>
            <input type="text" class="form-control" id="bk-dropoff-other" placeholder="ระบุสถานที่ส่ง">
          </div>

          <div class="form-group" id="bk-dropoff-province-group" style="display: none;">
            <label><i class="fa-solid fa-map"></i> เลือกจังหวัด <span class="required">*</span></label>
            <select class="form-control" id="bk-dropoff-province">
              <option value="" disabled selected>กำลังโหลด...</option>
            </select>
          </div>

          <!-- 10. เวลาส่ง -->
          <div class="form-group">
            <label><i class="fa-solid fa-clock"></i> เวลาส่ง <span class="required">*</span></label>
            <input type="text" class="form-control" id="bk-dropoff-time" placeholder="HH:mm" readonly required>
          </div>

          <!-- 9. รายละเอียดเพิ่มเติม (สถานที่ส่ง) -->
          <div class="form-group full-width">
            <label><i class="fa-solid fa-comment-dots"></i> รายละเอียดเพิ่มเติม (สถานที่ส่ง)</label>
            <input type="text" class="form-control" id="bk-dropoff-detail" placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)">
          </div>

          <!-- 11. หมายเหตุ -->
          <div class="form-group full-width">
            <label><i class="fa-solid fa-note-sticky"></i> หมายเหตุ</label>
            <textarea class="form-control" id="bk-remark" rows="3" placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)"></textarea>
          </div>

          <!-- 12. ผู้อนุมัติ -->
          <div class="form-group">
            <label><i class="fa-solid fa-user-check"></i> ผู้อนุมัติ <span class="required">*</span></label>
            <select class="form-control" id="bk-approver" required>
              <option value="" disabled selected>กำลังโหลด...</option>
            </select>
          </div>

          </div>

          <!-- 13. ปุ่ม Submit / Reset -->
          <div class="form-actions">
            <button type="reset" class="btn btn-secondary" id="bk-reset-btn">
              <i class="fa-solid fa-rotate-left"></i> ล้างฟอร์ม
            </button>
            <button type="submit" class="btn btn-primary" id="bk-submit-btn">
              <i class="fa-solid fa-paper-plane"></i> ส่งคำขอจองรถ
            </button>
          </div>
        </form>

        <!-- Notice Box -->
        <div class="booking-notice" style="margin-top: 24px;">
          <div class="booking-notice-header">
            <i class="fa-solid fa-circle-info"></i>
            <h4>การจองรถ</h4>
          </div>
          <ul class="booking-notice-list">
            <li>จองล่วงหน้า 1 วัน (กรณีไม่จองล่วงหน้า อาจจะไม่มีรถ)</li>
            <li>กรณีฉุกเฉินหรือเร่งด่วน ให้โทรสอบถาม HR ก่อนที่จะจองรถ อาจจะไม่มีทั้งรถและพนักงานขับรถให้</li>
            <li>กรณีการเลื่อนรถหลังจากเลยเวลาทำงานปกติ ให้หัวหน้างานติดต่อกับเจ้าของรถได้เลย แต่ต้องดูจำนวนคนที่จะมีการเปลี่ยนแปลง</li>
          </ul>
          <p class="booking-notice-contact">
            <i class="fa-solid fa-phone"></i>
            แจ้งรายละเอียด หรือ สอบถามเพิ่มเติม ได้ที่เบอร์ <strong>1512</strong>
          </p>
        </div>
      </div>
    </div>
  `;
}

/** ผูก event listeners หลัง render เสร็จ */
export function init() {
  // === ฟังก์ชันเริ่มต้น (Initialization) ===
  // ใช้สำหรับตั้งค่า Input Date/Time, ดึงข้อมูลตัวเลือก (Dropdown) จาก Firebase, และตั้งค่าการคลิกบันทึกข้อมูล
  const form = document.getElementById('booking-form');

  // --- Flatpickr: Date Picker dd/MM/yyyy ---
  const datePicker = flatpickr('#bk-date', {
    dateFormat: 'd/m/Y',
    minDate: 'today',
    defaultDate: 'today',
    disableMobile: true,
    allowInput: false,
  });

  // --- Flatpickr: Time Picker HH:mm ---
  const pickupTimePicker = flatpickr('#bk-pickup-time', {
    enableTime: true,
    noCalendar: true,
    dateFormat: 'H:i',
    time_24hr: true,
    disableMobile: true,
    allowInput: false,
  });

  const dropoffTimePicker = flatpickr('#bk-dropoff-time', {
    enableTime: true,
    noCalendar: true,
    dateFormat: 'H:i',
    time_24hr: true,
    disableMobile: true,
    allowInput: false,
  });

  // --- ดึงประเภท รับ-ส่ง จาก Firebase: Booking/Type/ ---
  const typeSelect = document.getElementById('bk-type');

  async function loadTypes() {
    try {
      const snapshot = await get(ref(hrDatabase, 'Booking/Type'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        typeSelect.innerHTML = '<option value="" disabled selected>-- เลือกประเภท --</option>';
        Object.keys(data).forEach(key => {
          const opt = document.createElement('option');
          if (data[key].menu === 'B1') {
            opt.value = data[key].type || key.type;
            opt.textContent = data[key].type || key.type;
            typeSelect.appendChild(opt);
          }
        });
        console.log('✅ โหลดประเภทสำเร็จ');
      } else {
        typeSelect.innerHTML = '<option value="" disabled selected>ไม่พบข้อมูลประเภท</option>';
      }
    } catch (error) {
      console.error('❌ โหลดประเภทล้มเหลว:', error);
      typeSelect.innerHTML = '<option value="" disabled selected>เกิดข้อผิดพลาด</option>';
    }
  }

  // --- ดึงสถานที่รับ จาก Firebase: Booking/Location/Location1 ---
  const pickupSelect = document.getElementById('bk-pickup-location');

  async function loadPickupLocations() {
    try {
      const snapshot = await get(ref(hrDatabase, 'Booking/Location/Location1'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        pickupSelect.innerHTML = '<option value="" disabled selected>-- เลือกสถานที่รับ --</option>';
        Object.keys(data).forEach(key => {
          const loc = data[key].location || key.location;
          const county = data[key].location_county || key.location_county;
          const val = loc === '***สถานที่อื่นๆ***' ? loc : `${loc} | ${county}`;
          const opt = document.createElement('option');
          opt.value = val;
          opt.textContent = val;
          pickupSelect.appendChild(opt);
        });
        console.log('✅ โหลดสถานที่รับสำเร็จ');
      } else {
        pickupSelect.innerHTML = '<option value="" disabled selected>ไม่พบข้อมูลสถานที่รับ</option>';
      }
    } catch (error) {
      console.error('❌ โหลดสถานที่รับล้มเหลว:', error);
      pickupSelect.innerHTML = '<option value="" disabled selected>เกิดข้อผิดพลาด</option>';
    }
  }

  // --- ดึงสถานที่ส่ง จาก Firebase: Booking/Location/Location2 ---
  const dropoffSelect = document.getElementById('bk-dropoff-location');

  async function loadDropoffLocations() {
    try {
      const snapshot = await get(ref(hrDatabase, 'Booking/Location/Location2'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        dropoffSelect.innerHTML = '<option value="" disabled selected>-- เลือกสถานที่ส่ง --</option>';
        Object.keys(data).forEach(key => {
          const loc = data[key].location || key.location;
          const county = data[key].location_county || key.location_county;
          const val = loc === '***สถานที่อื่นๆ***' ? loc : `${loc} | ${county}`;
          const opt = document.createElement('option');
          opt.value = val;
          opt.textContent = val;
          dropoffSelect.appendChild(opt);
        });
        console.log('✅ โหลดสถานที่ส่งสำเร็จ');
      } else {
        dropoffSelect.innerHTML = '<option value="" disabled selected>ไม่พบข้อมูลสถานที่ส่ง</option>';
      }
    } catch (error) {
      console.error('❌ โหลดสถานที่ส่งล้มเหลว:', error);
      dropoffSelect.innerHTML = '<option value="" disabled selected>เกิดข้อผิดพลาด</option>';
    }
  }

  // --- ดึงผู้อนุมัติ จาก Firebase: DHR/User/ ---
  const approverSelect = document.getElementById('bk-approver');
  const userDepartment = sessionStorage.getItem('empDepartment') || '';

  async function loadApprovers() {
    try {
      const snapshot = await get(ref(hrDatabase, 'DHR/User'));
      if (snapshot.exists()) {
        const allUsers = snapshot.val();
        const approvers = Object.entries(allUsers).filter(([id, user]) => {
          return user.department === userDepartment
            && user.active === 'Yes'
            && (user.level_Hr === '1' || user.level_Hr === 1 || user.level_Hr === 'admin' || user.level_Hr === 'admin_hr');
        });

        approverSelect.innerHTML = '<option value="" disabled selected>-- เลือกผู้อนุมัติ --</option>';

        if (approvers.length > 0) {
          approvers.forEach(([id, user]) => {
            const opt = document.createElement('option');
            opt.value = `${id} | ${user.firstname || ''} ${user.lastname || ''}`;
            opt.textContent = `${id} | ${user.firstname || ''} ${user.lastname || ''}`;
            approverSelect.appendChild(opt);
          });
          console.log(`✅ โหลดผู้อนุมัติสำเร็จ: ${approvers.length} คน`);
        } else {
          approverSelect.innerHTML = '<option value="" disabled selected>ไม่พบผู้อนุมัติในแผนกนี้</option>';
        }
      } else {
        approverSelect.innerHTML = '<option value="" disabled selected>ไม่พบข้อมูลผู้ใช้</option>';
      }
    } catch (error) {
      console.error('❌ โหลดผู้อนุมัติล้มเหลว:', error);
      approverSelect.innerHTML = '<option value="" disabled selected>เกิดข้อผิดพลาด</option>';
    }
  }

  // เรียกโหลดข้อมูลทั้งหมด
  loadTypes();
  loadPickupLocations();
  loadDropoffLocations();
  loadApprovers();

  // --- Populate Provinces ---
  function populateProvinces(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '';
    province_th.forEach((prov, idx) => {
      const opt = document.createElement('option');
      opt.value = idx === 0 ? '' : prov;
      opt.textContent = prov;
      if (idx === 0) opt.disabled = true;
      sel.appendChild(opt);
    });
    sel.value = '';
  }

  populateProvinces('bk-pickup-province');
  populateProvinces('bk-dropoff-province');

  // --- Toggle "Other" Location Logic ---
  const pickupLocSel = document.getElementById('bk-pickup-location');
  const pickupOtherGrp = document.getElementById('bk-pickup-other-group');
  const pickupProvGrp = document.getElementById('bk-pickup-province-group');

  pickupLocSel.addEventListener('change', () => {
    if (pickupLocSel.value === '***สถานที่อื่นๆ***') {
      pickupOtherGrp.style.display = 'block';
      pickupProvGrp.style.display = 'block';
    } else {
      pickupOtherGrp.style.display = 'none';
      pickupProvGrp.style.display = 'none';
    }
  });

  const dropoffLocSel = document.getElementById('bk-dropoff-location');
  const dropoffOtherGrp = document.getElementById('bk-dropoff-other-group');
  const dropoffProvGrp = document.getElementById('bk-dropoff-province-group');

  dropoffLocSel.addEventListener('change', () => {
    if (dropoffLocSel.value === '***สถานที่อื่นๆ***') {
      dropoffOtherGrp.style.display = 'block';
      dropoffProvGrp.style.display = 'block';
    } else {
      dropoffOtherGrp.style.display = 'none';
      dropoffProvGrp.style.display = 'none';
    }
  });

  // --- Form Reset ---
  form.addEventListener('reset', () => {
    datePicker.clear();
    pickupTimePicker.clear();
    dropoffTimePicker.clear();
    document.getElementById('bk-pickup-other-group').style.display = 'none';
    document.getElementById('bk-pickup-province-group').style.display = 'none';
    document.getElementById('bk-dropoff-other-group').style.display = 'none';
    document.getElementById('bk-dropoff-province-group').style.display = 'none';
    setTimeout(() => {
      const empName = sessionStorage.getItem('empName') || '';
      const empLastname = sessionStorage.getItem('empLastname') || '';
      document.getElementById('bk-reporter').value = `${empName} ${empLastname}`.trim();
    }, 10);
  });

  // --- Validate ---
  function validateForm() {
    const fields = [
      { id: 'bk-type', label: 'ประเภท รับ-ส่ง' },
      { id: 'bk-date', label: 'วันที่จอง' },
      { id: 'bk-pickup-location', label: 'สถานที่รับ' },
      { id: 'bk-pickup-time', label: 'เวลารับ' },
      { id: 'bk-dropoff-location', label: 'สถานที่ส่ง' },
      { id: 'bk-dropoff-time', label: 'เวลาส่ง' },
      { id: 'bk-approver', label: 'ผู้อนุมัติ' },
    ];

    const pickupLoc = document.getElementById('bk-pickup-location');
    if (pickupLoc && pickupLoc.value === '***สถานที่อื่นๆ***') {
      fields.push({ id: 'bk-pickup-other', label: 'กรอกสถานที่รับ' });
      fields.push({ id: 'bk-pickup-province', label: 'เลือกจังหวัดสถานที่รับ' });
    }

    const dropoffLoc = document.getElementById('bk-dropoff-location');
    if (dropoffLoc && dropoffLoc.value === '***สถานที่อื่นๆ***') {
      fields.push({ id: 'bk-dropoff-other', label: 'กรอกสถานที่ส่ง' });
      fields.push({ id: 'bk-dropoff-province', label: 'เลือกจังหวัดสถานที่ส่ง' });
    }

    form.querySelectorAll('.form-group.has-error').forEach(g => g.classList.remove('has-error'));
    form.querySelectorAll('.field-error').forEach(e => e.remove());

    const errors = [];
    for (const f of fields) {
      const el = document.getElementById(f.id);
      if (!el || !el.value || el.value.trim() === '') {
        errors.push(f.label);
        const group = el?.closest('.form-group');
        if (group) {
          group.classList.add('has-error');
          if (!group.querySelector('.field-error')) {
            const errSpan = document.createElement('span');
            errSpan.className = 'field-error';
            errSpan.textContent = `กรุณาเลือก${f.label}`;
            group.appendChild(errSpan);
          }
        }
      }
    }

    if (errors.length > 0) {
      showToast(`กรุณากรอกข้อมูลให้ครบ: ${errors.join(', ')}`, 'warning');
      const firstErr = form.querySelector('.form-group.has-error');
      if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }

  // ==========================================
  // ฟังก์ชันบันทึกข้อมูลการจองรถลง Firebase (Submit)
  // ==========================================
  document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    const confirmed = await showConfirmModal(
      'ยืนยันส่งคำขอจองรถ',
      'กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนกดยืนยัน',
      'fa-car-side'
    );
    if (!confirmed) return;

    const submitBtn = document.getElementById('bk-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังส่ง...';

    try {
      const empId = sessionStorage.getItem('empId') || '';
      const empName = sessionStorage.getItem('empName') || '';
      const empLastname = sessionStorage.getItem('empLastname') || '';
      const empDept = sessionStorage.getItem('empDepartment') || '';
      const fullName = `${empName} ${empLastname}`.trim();

      const now = new Date();
      const today = dateToString(now).split(" ");
      const splitData = 'B1-' + today[0].split('/')[2] + today[0].split('/')[1] + today[0].split('/')[0]
        + today[1].split(':')[0] + today[1].split(':')[1] + today[1].split(':')[2];

      const pickupLocSel = document.getElementById('bk-pickup-location').value;
      let pickupLocFinal = pickupLocSel;
      if (pickupLocSel === '***สถานที่อื่นๆ***') {
        const otherPlace = document.getElementById('bk-pickup-other').value || '-';
        const province = document.getElementById('bk-pickup-province').value || '-';
        pickupLocFinal = `${otherPlace} | ${province}`;
      }

      const dropoffLocSel = document.getElementById('bk-dropoff-location').value;
      let dropoffLocFinal = dropoffLocSel;
      if (dropoffLocSel === '***สถานที่อื่นๆ***') {
        const otherPlace = document.getElementById('bk-dropoff-other').value || '-';
        const province = document.getElementById('bk-dropoff-province').value || '-';
        dropoffLocFinal = `${otherPlace} | ${province}`;
      }

      const objectDetail = {
        id: splitData,
        date: dateToString(now),
        dateUpdate: dateToString(now),
        name: `${empId} | ${fullName}`,
        dep: empDept,
        type: document.getElementById('bk-type').value,
        detailType: document.getElementById('bk-type-detail').value || '-',
        bookingDate: document.getElementById('bk-date').value,
        pickupLoc: pickupLocFinal,
        pickupTime: document.getElementById('bk-pickup-time').value,
        detailPickup: document.getElementById('bk-pickup-detail').value || '-',
        deliveryLoc: dropoffLocFinal,
        deliveryTime: document.getElementById('bk-dropoff-time').value,
        detailDelivery: document.getElementById('bk-dropoff-detail').value || '-',
        remark: document.getElementById('bk-remark').value || '-',
        approve: document.getElementById('bk-approver').value,
        step: '1',
        leaderApprove: '',
        leaderApproveTime: '',
        adminApprove: '',
        adminApproveTime: '',
        car: '',
        driverName: '',
        adminClose: '',
        adminCloseTime: '',
        adminCancal: '',
        adminCancalTime: '',
        adminCancalRemark: '',
        group: ''
      };

      const keyword = `Booking/Booking1/${now.getFullYear()}/${splitData}`;
      await set(ref(hrDatabase, keyword), objectDetail);
      console.log('✅ บันทึกข้อมูลจองรถสำเร็จ:', keyword);

      await showAlert('ส่งคำขอสำเร็จ!', 'ระบบได้บันทึกข้อมูลการจองรถของคุณเรียบร้อยแล้ว', 'fa-circle-check');
      form.reset();

    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาด:', error);
      showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> ส่งคำขอจองรถ';
    }
  });
}
