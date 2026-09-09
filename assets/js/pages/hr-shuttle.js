/**
 * HR — Shuttle Service (รับ-ส่งพนักงาน)
 */
import { hrDatabase, ref, get, set } from '../firebase-hr.js';
import { province_th } from '../province_th.js';
import { escapeHTML, escapeAttr, getApproversByDepartment } from '../utils.js';

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
  // คืนค่าฟอร์มการขออนุมัติเดินทางกลับ (Shuttle Bus / กลับเอง)
  const empName = sessionStorage.getItem('empName') || '';
  const empLastname = sessionStorage.getItem('empLastname') || '';
  const fullName = `${empName} ${empLastname}`.trim() || '-';

  return `
    <div class="app-page">
      <section class="page-hero page-hero-hr fade-in">
        <div class="page-hero-copy">
          <p class="page-hero-eyebrow">HR Mobility</p>
          <h1 class="page-hero-title">Shuttle Service</h1>
          <p class="page-hero-subtitle">จัดคำขอรถรับส่งพนักงานให้ชัดตั้งแต่จำนวนคน จุดรับ และเวลาที่ต้องการ เพื่อให้ทีม HR รวมเที่ยวรถและวางแผนการเดินทางได้ง่ายขึ้น</p>
        </div>
        <div class="page-hero-meta">
          <div class="page-hero-stat">
            <span>ผู้แจ้ง</span>
            <strong>${escapeHTML(fullName)}</strong>
          </div>
          <div class="page-hero-stat">
            <span>บริการ</span>
            <strong>Shuttle Service</strong>
          </div>
        </div>
      </section>

      <div class="page-note fade-in">
        <i class="fa-solid fa-people-group"></i>
        <div>หน้านี้เหมาะกับคำขอที่ต้องบริหารหลายคนในรอบเดียว ยิ่งจำนวนคนและปลายทางชัด ทีมจัดรถยิ่งรวมกลุ่มการเดินทางได้มีประสิทธิภาพขึ้น</div>
      </div>

      <div class="form-card fade-in">

        <!-- Header -->
        <div class="form-header">
          <div class="form-header-copy">
            <div class="form-header-icon" style="background: linear-gradient(135deg, var(--ocean-start), var(--ocean-end)); color: white; border: none;">
              <i class="fa-solid fa-van-shuttle"></i>
            </div>
            <div class="form-header-text">
              <h2>Shuttle Service (รับ-ส่งพนักงาน)</h2>
              <p>แบบฟอร์มขอรถรับ-ส่งพนักงาน</p>
            </div>
          </div>
          <div class="form-header-badge">
            <i class="fa-solid fa-bus"></i>
            รองรับการจัดกลุ่มขนส่งภายหลัง
          </div>
        </div>

        <!-- Form -->
        <form id="shuttle-form" autocomplete="off">
          <div class="form-grid">

          <!-- 1. ชื่อผู้แจ้ง -->
          <div class="form-group">
            <label><i class="fa-solid fa-user"></i> ชื่อผู้แจ้ง</label>
            <input type="text" class="form-control" id="st-reporter" value="${escapeAttr(fullName)}" readonly>
          </div>

          <!-- 2. ประเภท รับ-ส่ง -->
          <div class="form-group">
            <label><i class="fa-solid fa-right-left"></i> ประเภท รับ-ส่ง <span class="required">*</span></label>
            <select class="form-control" id="st-type" required>
              <option value="" disabled selected>กำลังโหลด...</option>
            </select>
          </div>

          <!-- 3. จำนวนพนักงาน -->
          <div class="form-group">
            <label><i class="fa-solid fa-users"></i> จำนวนพนักงาน <span class="required">*</span></label>
            <input type="number" class="form-control" id="st-headcount" min="1" placeholder="ระบุจำนวนคน" required>
          </div>

          <!-- 4. วันที่จอง -->
          <div class="form-group">
            <label><i class="fa-solid fa-calendar-days"></i> วันที่จอง <span class="required">*</span></label>
            <input type="text" class="form-control" id="st-date" placeholder="dd/MM/yyyy" readonly required>
          </div>

          <!-- ===== Section: สถานที่รับ ===== -->
          <div class="form-section-divider full-width">
            <i class="fa-solid fa-arrow-right-to-bracket"></i> สถานที่รับ
          </div>

          <!-- 5. สถานที่รับ -->
          <div class="form-group">
            <label><i class="fa-solid fa-location-dot"></i> สถานที่รับ <span class="required">*</span></label>
            <select class="form-control" id="st-pickup-location" required>
              <option value="" disabled selected>กำลังโหลด...</option>
            </select>
          </div>

          <!-- สถานที่รับอื่นๆ (ซ่อนอยู่) -->
          <div class="form-group" id="st-pickup-other-group" style="display: none;">
            <label><i class="fa-solid fa-pen"></i> กรอกสถานที่รับ <span class="required">*</span></label>
            <input type="text" class="form-control" id="st-pickup-other" placeholder="ระบุสถานที่รับ">
          </div>
          
          <div class="form-group" id="st-pickup-province-group" style="display: none;">
            <label><i class="fa-solid fa-map"></i> เลือกจังหวัด <span class="required">*</span></label>
            <select class="form-control" id="st-pickup-province">
              <option value="" disabled selected>กำลังโหลด...</option>
            </select>
          </div>

          <!-- 6. เวลารับ -->
          <div class="form-group">
            <label><i class="fa-solid fa-clock"></i> เวลารับ <span class="required">*</span></label>
            <input type="text" class="form-control" id="st-pickup-time" placeholder="HH:mm" readonly required>
          </div>

          <!-- ===== Section: สถานที่ส่ง ===== -->
          <div class="form-section-divider full-width">
            <i class="fa-solid fa-arrow-right-from-bracket"></i> สถานที่ส่ง
          </div>

          <!-- 7. สถานที่ส่ง -->
          <div class="form-group">
            <label><i class="fa-solid fa-map-pin"></i> สถานที่ส่ง <span class="required">*</span></label>
            <select class="form-control" id="st-dropoff-location" required>
              <option value="" disabled selected>กำลังโหลด...</option>
            </select>
          </div>

          <!-- สถานที่ส่งอื่นๆ (ซ่อนอยู่) -->
          <div class="form-group" id="st-dropoff-other-group" style="display: none;">
            <label><i class="fa-solid fa-pen"></i> กรอกสถานที่ส่ง <span class="required">*</span></label>
            <input type="text" class="form-control" id="st-dropoff-other" placeholder="ระบุสถานที่ส่ง">
          </div>

          <div class="form-group" id="st-dropoff-province-group" style="display: none;">
            <label><i class="fa-solid fa-map"></i> เลือกจังหวัด <span class="required">*</span></label>
            <select class="form-control" id="st-dropoff-province">
              <option value="" disabled selected>กำลังโหลด...</option>
            </select>
          </div>
       

          <!-- 8. ผู้อนุมัติ -->
          <div class="form-group">
            <label><i class="fa-solid fa-user-check"></i> ผู้อนุมัติ <span class="required">*</span></label>
            <select class="form-control" id="st-approver" required>
              <option value="" disabled selected>กำลังโหลด...</option>
            </select>
          </div>

          </div>

          <!-- ปุ่ม Submit / Reset -->
          <div class="form-actions">
            <button type="reset" class="btn btn-secondary" id="st-reset-btn">
              <i class="fa-solid fa-rotate-left"></i> ล้างฟอร์ม
            </button>
            <button type="submit" class="btn btn-primary" id="st-submit-btn">
              <i class="fa-solid fa-paper-plane"></i> ส่งคำขอรถรับ-ส่ง
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
  // ผูก Event, จัดการซ่อน/แสดงช่องกรอกข้อมูลตามประเภท และโหลดข้อมูล Dropdown
  const form = document.getElementById('shuttle-form');

  // --- Flatpickr: Date Picker ---
  const datePicker = flatpickr('#st-date', {
    dateFormat: 'd/m/Y',
    defaultDate: 'today',
    disableMobile: true,
    allowInput: false,
  });

  // --- Flatpickr: Time Pickers ---
  const pickupTimePicker = flatpickr('#st-pickup-time', {
    enableTime: true,
    noCalendar: true,
    dateFormat: 'H:i',
    time_24hr: true,
    disableMobile: true,
    allowInput: false,
  });

  const dropoffTimePicker = flatpickr('#st-dropoff-time', {
    enableTime: true,
    noCalendar: true,
    dateFormat: 'H:i',
    time_24hr: true,
    disableMobile: true,
    allowInput: false,
  });

  // --- ดึงประเภท รับ-ส่ง จาก Firebase: Booking/Type ---
  const typeSelect = document.getElementById('st-type');

  async function loadTypes() {
    try {
      const snapshot = await get(ref(hrDatabase, 'Booking/Type'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        typeSelect.innerHTML = '<option value="" disabled selected>-- เลือกประเภท --</option>';
        Object.keys(data).forEach(key => {
          const opt = document.createElement('option');
          // ใช้ B2 สำหรับ Shuttle Service
          if (data[key].menu === 'B2') {
            opt.value = data[key].type || key.type;
            opt.textContent = data[key].type || key.type;
            typeSelect.appendChild(opt);
          }
        });
        console.log('✅ [Shuttle] โหลดประเภทสำเร็จ');
      } else {
        typeSelect.innerHTML = '<option value="" disabled selected>ไม่พบข้อมูลประเภท</option>';
      }
    } catch (error) {
      console.error('❌ [Shuttle] โหลดประเภทล้มเหลว:', error);
      typeSelect.innerHTML = '<option value="" disabled selected>เกิดข้อผิดพลาด</option>';
    }
  }

  // --- ดึงสถานที่รับ จาก Firebase: Booking/Location/Location1 ---
  const pickupSelect = document.getElementById('st-pickup-location');

  async function loadPickupLocations() {
    try {
      const snapshot = await get(ref(hrDatabase, 'Booking/Location/Location3'));
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
        console.log('✅ [Shuttle] โหลดสถานที่รับสำเร็จ');
      } else {
        pickupSelect.innerHTML = '<option value="" disabled selected>ไม่พบข้อมูลสถานที่รับ</option>';
      }
    } catch (error) {
      console.error('❌ [Shuttle] โหลดสถานที่รับล้มเหลว:', error);
      pickupSelect.innerHTML = '<option value="" disabled selected>เกิดข้อผิดพลาด</option>';
    }
  }

  // --- ดึงสถานที่ส่ง จาก Firebase: Booking/Location/Location3 ---
  const dropoffSelect = document.getElementById('st-dropoff-location');

  async function loadDropoffLocations() {
    try {
      const snapshot = await get(ref(hrDatabase, 'Booking/Location/Location3'));
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
        console.log('✅ [Shuttle] โหลดสถานที่ส่งสำเร็จ');
      } else {
        dropoffSelect.innerHTML = '<option value="" disabled selected>ไม่พบข้อมูลสถานที่ส่ง</option>';
      }
    } catch (error) {
      console.error('❌ [Shuttle] โหลดสถานที่ส่งล้มเหลว:', error);
      dropoffSelect.innerHTML = '<option value="" disabled selected>เกิดข้อผิดพลาด</option>';
    }
  }

  // --- ดึงผู้อนุมัติ จาก Firebase: DHR/User/ ---
  const approverSelect = document.getElementById('st-approver');
  const userDepartment = sessionStorage.getItem('empDepartment') || '';

  async function loadApprovers() {
    try {
      const snapshot = await get(ref(hrDatabase, 'DHR/User'));
      if (snapshot.exists()) {
        const allUsers = snapshot.val();
        const approvers = getApproversByDepartment(allUsers, userDepartment, 'hr');

        approverSelect.innerHTML = '<option value="" disabled selected>-- เลือกผู้อนุมัติ --</option>';

        if (approvers.length > 0) {
          approvers.forEach(([id, user]) => {
            const opt = document.createElement('option');
            opt.value = `${id} | ${user.firstname || ''} ${user.lastname || ''}`;
            opt.textContent = `${id} | ${user.firstname || ''} ${user.lastname || ''}`;
            approverSelect.appendChild(opt);
          });
          console.log(`✅ [Shuttle] โหลดผู้อนุมัติสำเร็จ: ${approvers.length} คน`);
        } else {
          approverSelect.innerHTML = '<option value="" disabled selected>ไม่พบผู้อนุมัติในแผนกนี้</option>';
        }
      } else {
        approverSelect.innerHTML = '<option value="" disabled selected>ไม่พบข้อมูลผู้ใช้</option>';
      }
    } catch (error) {
      console.error('❌ [Shuttle] โหลดผู้อนุมัติล้มเหลว:', error);
      approverSelect.innerHTML = '<option value="" disabled selected>เกิดข้อผิดพลาด</option>';
    }
  }

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

  populateProvinces('st-pickup-province');
  populateProvinces('st-dropoff-province');

  // --- Toggle "Other" Location Logic ---
  const pickupLocSel = document.getElementById('st-pickup-location');
  const pickupOtherGrp = document.getElementById('st-pickup-other-group');
  const pickupProvGrp = document.getElementById('st-pickup-province-group');

  pickupLocSel.addEventListener('change', () => {
    if (pickupLocSel.value === '***สถานที่อื่นๆ***') {
      pickupOtherGrp.style.display = 'block';
      pickupProvGrp.style.display = 'block';
    } else {
      pickupOtherGrp.style.display = 'none';
      pickupProvGrp.style.display = 'none';
    }
  });

  const dropoffLocSel = document.getElementById('st-dropoff-location');
  const dropoffOtherGrp = document.getElementById('st-dropoff-other-group');
  const dropoffProvGrp = document.getElementById('st-dropoff-province-group');

  dropoffLocSel.addEventListener('change', () => {
    if (dropoffLocSel.value === '***สถานที่อื่นๆ***') {
      dropoffOtherGrp.style.display = 'block';
      dropoffProvGrp.style.display = 'block';
    } else {
      dropoffOtherGrp.style.display = 'none';
      dropoffProvGrp.style.display = 'none';
    }
  });

  // เรียกโหลดข้อมูล
  loadTypes();
  loadPickupLocations();
  loadDropoffLocations();
  loadApprovers();

  // --- Form Reset ---
  form.addEventListener('reset', () => {
    datePicker.clear();
    pickupTimePicker.clear();
    dropoffTimePicker.clear();
    document.getElementById('st-pickup-other-group').style.display = 'none';
    document.getElementById('st-pickup-province-group').style.display = 'none';
    document.getElementById('st-dropoff-other-group').style.display = 'none';
    document.getElementById('st-dropoff-province-group').style.display = 'none';
    setTimeout(() => {
      const empName = sessionStorage.getItem('empName') || '';
      const empLastname = sessionStorage.getItem('empLastname') || '';
      document.getElementById('st-reporter').value = `${empName} ${empLastname}`.trim();
    }, 10);
  });


  // --- Validate ---
  function validateForm() {
    const fields = [
      { id: 'st-type', label: 'ประเภท รับ-ส่ง' },
      { id: 'st-headcount', label: 'จำนวนพนักงาน' },
      { id: 'st-date', label: 'วันที่จอง' },
      { id: 'st-pickup-location', label: 'สถานที่รับ' },
      { id: 'st-pickup-time', label: 'เวลารับ' },
      { id: 'st-dropoff-location', label: 'สถานที่ส่ง' },
      { id: 'st-approver', label: 'ผู้อนุมัติ' },
    ];

    const pickupLoc = document.getElementById('st-pickup-location');
    if (pickupLoc && pickupLoc.value === '***สถานที่อื่นๆ***') {
      fields.push({ id: 'st-pickup-other', label: 'กรอกสถานที่รับ' });
      fields.push({ id: 'st-pickup-province', label: 'เลือกจังหวัดสถานที่รับ' });
    }

    const dropoffLoc = document.getElementById('st-dropoff-location');
    if (dropoffLoc && dropoffLoc.value === '***สถานที่อื่นๆ***') {
      fields.push({ id: 'st-dropoff-other', label: 'กรอกสถานที่ส่ง' });
      fields.push({ id: 'st-dropoff-province', label: 'เลือกจังหวัดสถานที่ส่ง' });
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

  // --- Form Submit ---
  // ==========================================
  // ฟังก์ชันบันทึกข้อมูลการขอเดินทางลง Firebase (Submit)
  // ==========================================
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    const confirmed = await showConfirmModal(
      'ยืนยันส่งคำขอรถรับ-ส่ง',
      'กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนกดยืนยัน',
      'fa-van-shuttle'
    );
    if (!confirmed) return;

    const submitBtn = document.getElementById('st-submit-btn');
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
      const splitData = 'B2-' + today[0].split('/')[2] + today[0].split('/')[1] + today[0].split('/')[0]
        + today[1].split(':')[0] + today[1].split(':')[1] + today[1].split(':')[2];

      const pickupLocSel = document.getElementById('st-pickup-location').value;
      let pickupLocFinal = pickupLocSel;
      if (pickupLocSel === '***สถานที่อื่นๆ***') {
        const otherPlace = document.getElementById('st-pickup-other').value || '-';
        const province = document.getElementById('st-pickup-province').value || '-';
        pickupLocFinal = `${otherPlace} | ${province}`;
      }

      const dropoffLocSel = document.getElementById('st-dropoff-location').value;
      let dropoffLocFinal = dropoffLocSel;
      if (dropoffLocSel === '***สถานที่อื่นๆ***') {
        const otherPlace = document.getElementById('st-dropoff-other').value || '-';
        const province = document.getElementById('st-dropoff-province').value || '-';
        dropoffLocFinal = `${otherPlace} | ${province}`;
      }

      const objectDetail = {
        id: splitData,
        date: dateToString(now),
        dateUpdate: dateToString(now),
        name: `${empId} | ${fullName}`,
        dep: empDept,
        type: document.getElementById('st-type').value,
        amont: document.getElementById('st-headcount').value,
        bookingDate: document.getElementById('st-date').value,
        pickupLoc: pickupLocFinal,
        pickupTime: document.getElementById('st-pickup-time').value,
        deliveryLoc: dropoffLocFinal,
        approve: document.getElementById('st-approver').value,
        step: '1',
        leaderApprove: "",
        leaderApproveTime: "",
        adminApprove: "",
        adminApproveTime: "",
        car: "",
        driverName: "",
        adminClose: "",
        adminCloseTime: "",
        adminCancal: "",
        adminCancalTime: "",
        adminCancalRemark: "",
        remark: "",
        group: ""
      };

      const keyword = `Booking/Booking2/${now.getFullYear()}/${splitData}`;
      await set(ref(hrDatabase, keyword), objectDetail);
      console.log('✅ บันทึกข้อมูลรถรับ-ส่งสำเร็จ:', keyword);

      await showAlert('ส่งคำขอสำเร็จ!', 'ระบบได้บันทึกข้อมูลรถรับ-ส่งของคุณเรียบร้อยแล้ว', 'fa-circle-check');
      form.reset();

    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาด:', error);
      showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> ส่งคำขอรถรับ-ส่ง';
    }
  });
}
