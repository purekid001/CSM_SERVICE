/**
 * Engineer — Request For Repair (แบบฟอร์มแจ้งซ่อมอุปกรณ์)
 */
import { database, ref, get, set, storage, storageRef, uploadBytes, getDownloadURL } from '../firebase.js';
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

function sanitizeFileName(fileName) {
  const normalized = String(fileName || 'image')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'image';
}

export function render() {
  // === ส่วนของ HTML Template ===
  // คืนค่าฟอร์มแจ้งซ่อมเครื่องจักร (Request For Repair) สำหรับให้ผู้ใช้งานกรอกข้อมูล
  const empName = sessionStorage.getItem('empName') || '';
  const empLastname = sessionStorage.getItem('empLastname') || '';
  const fullName = `${empName} ${empLastname}`.trim() || '-';

  return `
    <div class="app-page">
      <section class="page-hero page-hero-eng fade-in">
        <div class="page-hero-copy">
          <p class="page-hero-eyebrow">Engineering Intake</p>
          <h1 class="page-hero-title">Request For Repair</h1>
          <p class="page-hero-subtitle">สร้างใบแจ้งซ่อมให้ครบถ้วนตั้งแต่ต้นทาง เพื่อให้ทีมวิศวกรรมรับงาน วิเคราะห์อาการ และเดินขั้นตอนต่อได้เร็วขึ้น</p>
        </div>
        <div class="page-hero-meta">
          <div class="page-hero-stat">
            <span>ผู้แจ้ง</span>
            <strong>${escapeHTML(fullName)}</strong>
          </div>
          <div class="page-hero-stat">
            <span>ประเภทหน้า</span>
            <strong>สร้างคำขอแจ้งซ่อมใหม่</strong>
          </div>
        </div>
      </section>

      <div class="page-note fade-in">
        <i class="fa-solid fa-circle-info"></i>
        <div>กรอกข้อมูลเครื่องจักร อาการเสีย และกำหนดวันเสร็จให้ชัดเจนที่สุด ถ้ามีภาพประกอบ ระบบจะช่วยให้ทีมที่รับงานประเมินได้เร็วขึ้น</div>
      </div>

      <div class="form-card fade-in">

        <!-- Header -->
        <div class="form-header">
          <div class="form-header-copy">
            <div class="form-header-icon">
              <i class="fa-solid fa-wrench"></i>
            </div>
            <div class="form-header-text">
              <h2>Request For Repair</h2>
              <p>แบบฟอร์มแจ้งซ่อมเครื่องจักร / อุปกรณ์</p>
            </div>
          </div>
          <div class="form-header-badge">
            <i class="fa-solid fa-camera-retro"></i>
            แนบรูปได้สูงสุด 5 ไฟล์
          </div>
        </div>

        <!-- Form -->
        <form id="repair-form" autocomplete="off">
          <div class="form-grid">

          <!-- 1. ชื่อผู้แจ้ง (auto-fill) -->
          <div class="form-group">
            <label>
              <i class="fa-solid fa-user"></i>
              ชื่อผู้แจ้ง
            </label>
            <input type="text" class="form-control" id="rf-reporter" value="${escapeAttr(fullName)}" readonly>
          </div>

          <!-- 2. พื้นที่ (ดึงจาก Firebase: DEN/Machine/) -->
          <div class="form-group">
            <label>
              <i class="fa-solid fa-location-dot"></i>
              พื้นที่ <span class="required">*</span>
            </label>
            <select class="form-control" id="rf-area" required>
              <option value="" disabled selected>กำลังโหลด...</option>
            </select>
          </div>

          <!-- 3. รหัสเครื่องจักร (ดึงจาก Firebase: DEN/Machine/{area}/) -->
          <div class="form-group">
            <label>
              <i class="fa-solid fa-gears"></i>
              รหัสเครื่องจักร <span class="required">*</span>
            </label>
            <select class="form-control" id="rf-machine" required disabled>
              <option value="" disabled selected>-- เลือกพื้นที่ก่อน --</option>
            </select>
          </div>

          <!-- 4. สถานะเครื่อง -->
          <div class="form-group">
            <label>
              <i class="fa-solid fa-circle-info"></i>
              สถานะเครื่อง <span class="required">*</span>
            </label>
            <select class="form-control" id="rf-status" required>
              <option value="" disabled selected>-- เลือกสถานะ --</option>
              <option value="หยุดทั้ง LINE">🔴 หยุดทั้ง LINE</option>
              <option value="หยุดเฉพาะเครื่อง">🟡 หยุดเฉพาะเครื่อง</option>             
            </select>
          </div>

          <!-- 5. ประเภทงาน -->
          <div class="form-group">
            <label>
              <i class="fa-solid fa-tags"></i>
              ประเภทงาน <span class="required">*</span>
            </label>
            <select class="form-control" id="rf-worktype" required>
              <option value="" disabled selected>-- เลือกประเภทงาน --</option>
              <option value="SD = ซ่อมบำรุง">SD = ซ่อมบำรุง</option>
              <option value="PM = งานบำรุงรักษา">PM = งานบำรุงรักษา</option>
              <option value="IM = ปรับปรุง/ต่อเติม">IM = ปรับปรุง/ต่อเติม</option>
              <option value="PRO = สร้างใหม่">PRO = สร้างใหม่</option>              
            </select>
          </div>

          <!-- 7. กำหนดวันเสร็จ -->
          <div class="form-group">
            <label>
              <i class="fa-solid fa-calendar-days"></i>
              กำหนดวันเสร็จ <span class="required">*</span>
            </label>
            <input type="text" class="form-control" id="rf-duedate" placeholder="dd/MM/yyyy" readonly required>
          </div>

          <!-- 6. รายละเอียดงาน (full width) -->
          <div class="form-group full-width">
            <label>
              <i class="fa-solid fa-align-left"></i>
              รายละเอียดงาน <span class="required">*</span>
            </label>
            <textarea class="form-control" id="rf-detail" rows="4" placeholder="อธิบายอาการเสีย / สิ่งที่ต้องการแจ้งซ่อม..." required></textarea>
          </div>

          <!-- 8. อัปโหลดรูปภาพ (full width) -->
          <div class="form-group full-width">
            <label>
              <i class="fa-solid fa-camera"></i>
              รูปภาพประกอบ
            </label>
            <div class="file-upload-area" id="rf-upload-area">
              <input type="file" id="rf-files" accept="image/*" multiple>
              <div class="file-upload-icon">
                <i class="fa-solid fa-cloud-arrow-up"></i>
              </div>
              <div class="file-upload-text">
                ลากไฟล์มาวาง หรือ <span>เลือกไฟล์</span>
              </div>
              <div class="file-upload-hint">รองรับ JPG, PNG, WEBP (สูงสุด 5 ไฟล์)</div>
            </div>
            <div class="file-preview-container" id="rf-preview"></div>
          </div>

          <!-- 9. ผู้อนุมัติ (ดึงจาก Firebase: DHR/User/) -->
          <div class="form-group">
            <label>
              <i class="fa-solid fa-user-check"></i>
              ผู้อนุมัติ <span class="required">*</span>
            </label>
            <select class="form-control" id="rf-approver" required>
              <option value="" disabled selected>กำลังโหลด...</option>
            </select>
          </div>

          </div>

          <!-- 10 & 11. ปุ่ม Submit / Reset -->
          <div class="form-actions">
            <button type="reset" class="btn btn-secondary" id="rf-reset-btn">
              <i class="fa-solid fa-rotate-left"></i>
              ล้างฟอร์ม
            </button>
            <button type="submit" class="btn btn-primary" id="rf-submit-btn">
              <i class="fa-solid fa-paper-plane"></i>
              ส่งคำขอแจ้งซ่อม
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/** ผูก event listeners หลัง render เสร็จ */
export function init() {
  // === ฟังก์ชันเริ่มต้น (Initialization) ===
  // จัดการการอัปโหลดรูปภาพ, ดึงข้อมูลพื้นที่และรหัสเครื่องจักรจาก Firebase และตรวจสอบการ Submit
  const form = document.getElementById('repair-form');
  const fileInput = document.getElementById('rf-files');
  const uploadArea = document.getElementById('rf-upload-area');
  const previewContainer = document.getElementById('rf-preview');

  // --- Flatpickr: Date Picker dd/MM/yyyy ---
  const dueDatePicker = flatpickr('#rf-duedate', {
    dateFormat: 'd/m/Y',
    minDate: 'today',
    disableMobile: true,
    allowInput: false,
  });

  // --- ดึงข้อมูลพื้นที่จาก Firebase: DEN/Machine/ ---
  const areaSelect = document.getElementById('rf-area');
  const machineSelect = document.getElementById('rf-machine');
  let machineData = {}; // เก็บข้อมูลเครื่องจักรทั้งหมดไว้ใช้ตอนเลือกพื้นที่

  async function loadAreas() {
    try {
      const machineRef = ref(database, 'DEN/Machine');
      const snapshot = await get(machineRef);

      if (snapshot.exists()) {
        machineData = snapshot.val();
        const areas = Object.keys(machineData);

        // ล้าง options เดิม แล้วใส่ใหม่
        areaSelect.innerHTML = '<option value="" disabled selected>-- เลือกพื้นที่ --</option>';
        areas.forEach(area => {
          const opt = document.createElement('option');
          opt.value = area;
          opt.textContent = area;
          areaSelect.appendChild(opt);
        });

        console.log(`✅ โหลดพื้นที่สำเร็จ: ${areas.length} รายการ`);
      } else {
        areaSelect.innerHTML = '<option value="" disabled selected>ไม่พบข้อมูลพื้นที่</option>';
        console.warn('⚠️ ไม่พบข้อมูลใน DEN/Machine/');
      }
    } catch (error) {
      console.error('❌ โหลดพื้นที่ล้มเหลว:', error);
      areaSelect.innerHTML = '<option value="" disabled selected>เกิดข้อผิดพลาด</option>';
    }
  }

  // เรียกโหลดพื้นที่ทันที
  loadAreas();

  // --- เมื่อเลือกพื้นที่ → โหลดรหัสเครื่องจักร ---
  areaSelect.addEventListener('change', () => {
    const selectedArea = areaSelect.value;
    const machines = machineData[selectedArea];

    // ล้าง + เปิดใช้งาน dropdown เครื่องจักร
    machineSelect.innerHTML = '<option value="" disabled selected>-- เลือกเครื่องจักร --</option>';
    machineSelect.disabled = false;

    if (machines && typeof machines === 'object') {
      Object.keys(machines).forEach(machineKey => {
        const opt = document.createElement('option');
        opt.value = machineKey + ' | ' + machines[machineKey].machine_name;
        // ถ้ามี name ก็แสดงคู่กัน ถ้าไม่มีก็แสดงแค่ key
        const machineInfo = machines[machineKey];
        if (typeof machineInfo === 'object' && machineInfo.machine_name) {
          opt.textContent = `${machineKey} | ${machineInfo.machine_name}`;
        } else {
          opt.textContent = machineKey;
        }
        machineSelect.appendChild(opt);
      });

      // เพิ่มตัวเลือก "แจ้งซ่อมอื่นๆ" เข้าไปทุกพื้นที่
      const otherOpt = document.createElement('option');
      otherOpt.value = 'XXX-XXX-XX-XX | แจ้งซ่อมอื่นๆ'
      otherOpt.textContent = 'XXX-XXX-XX-XX | แจ้งซ่อมอื่นๆ';
      machineSelect.appendChild(otherOpt);

      console.log(`✅ โหลดเครื่องจักร [${selectedArea}]: ${Object.keys(machines).length} เครื่อง`);
    }
  });

  // --- ดึงข้อมูลผู้อนุมัติจาก Firebase: DHR/User/ ---
  const approverSelect = document.getElementById('rf-approver');
  const userDepartment = sessionStorage.getItem('empDepartment') || '';

  async function loadApprovers() {
    try {
      const usersRef = ref(database, 'DHR/User');
      const snapshot = await get(usersRef);

      if (snapshot.exists()) {
        const allUsers = snapshot.val();
        const approvers = getApproversByDepartment(allUsers, userDepartment, 'engineering');

        approverSelect.innerHTML = '<option value="" disabled selected>-- เลือกผู้อนุมัติ --</option>';

        if (approvers.length > 0) {
          approvers.forEach(([id, user]) => {
            const opt = document.createElement('option');
            opt.value = `${id} | ${user.firstname || ''} ${user.lastname || ''}`;
            opt.textContent = `${id} | ${user.firstname || ''} ${user.lastname || ''}`;
            approverSelect.appendChild(opt);
          });
          console.log(`✅ โหลดผู้อนุมัติสำเร็จ: ${approvers.length} คน (แผนก: ${userDepartment})`);
        } else {
          approverSelect.innerHTML = '<option value="" disabled selected>ไม่พบผู้อนุมัติในแผนกนี้</option>';
          console.warn(`⚠️ ไม่พบผู้อนุมัติ (dept: ${userDepartment})`);
        }
      } else {
        approverSelect.innerHTML = '<option value="" disabled selected>ไม่พบข้อมูลผู้ใช้</option>';
      }
    } catch (error) {
      console.error('❌ โหลดผู้อนุมัติล้มเหลว:', error);
      approverSelect.innerHTML = '<option value="" disabled selected>เกิดข้อผิดพลาด</option>';
    }
  }

  // เรียกโหลดผู้อนุมัติทันที
  loadApprovers();

  // เก็บไฟล์ที่เลือกไว้
  let selectedFiles = [];
  const MAX_FILES = 5;

  // --- File Upload: เลือกไฟล์ ---
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });

  // --- Drag & Drop ---
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragging');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragging');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragging');
    handleFiles(e.dataTransfer.files);
  });

  function handleFiles(files) {
    const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    const available = MAX_FILES - selectedFiles.length;

    if (available <= 0) {
      alert(`อัปโหลดได้สูงสุด ${MAX_FILES} ไฟล์`);
      return;
    }

    // เพิ่มเฉพาะจำนวนที่ยังว่าง
    const toAdd = newFiles.slice(0, available);
    selectedFiles = [...selectedFiles, ...toAdd];
    renderPreviews();
  }

  function renderPreviews() {
    previewContainer.innerHTML = '';
    selectedFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const item = document.createElement('div');
        item.className = 'file-preview-item';
        const img = document.createElement('img');
        img.src = String(e.target?.result || '');
        img.alt = file.name || `preview-${index + 1}`;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'file-preview-remove';
        removeBtn.dataset.index = String(index);

        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-xmark';
        removeBtn.appendChild(icon);

        item.appendChild(img);
        item.appendChild(removeBtn);
        previewContainer.appendChild(item);

        // ปุ่มลบ
        removeBtn.addEventListener('click', () => {
          selectedFiles.splice(index, 1);
          renderPreviews();
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // --- Form Reset ---
  form.addEventListener('reset', () => {
    selectedFiles = [];
    previewContainer.innerHTML = '';
    dueDatePicker.clear();
    // รีเซ็ต machine dropdown กลับเป็น disabled
    machineSelect.innerHTML = '<option value="" disabled selected>-- เลือกพื้นที่ก่อน --</option>';
    machineSelect.disabled = true;
    // รอ reset event ทำงานเสร็จก่อนค่อย set ชื่อคืน
    setTimeout(() => {
      const empName = sessionStorage.getItem('empName') || '';
      const empLastname = sessionStorage.getItem('empLastname') || '';
      document.getElementById('rf-reporter').value = `${empName} ${empLastname}`.trim();
    }, 10);
  });





  // =============================================
  // Helper: Validate Form Fields
  // =============================================
  function validateForm() {
    const fields = [
      { id: 'rf-area', label: 'พื้นที่' },
      { id: 'rf-machine', label: 'รหัสเครื่องจักร' },
      { id: 'rf-status', label: 'สถานะเครื่อง' },
      { id: 'rf-worktype', label: 'ประเภทงาน' },
      { id: 'rf-detail', label: 'รายละเอียดงาน' },
      { id: 'rf-duedate', label: 'กำหนดวันเสร็จ' },
      { id: 'rf-approver', label: 'ผู้อนุมัติ' },
    ];

    // ล้าง error เดิม
    form.querySelectorAll('.form-group.has-error').forEach(g => g.classList.remove('has-error'));
    form.querySelectorAll('.field-error').forEach(e => e.remove());

    const errors = [];
    for (const f of fields) {
      const el = document.getElementById(f.id);
      if (!el || !el.value || el.value.trim() === '') {
        errors.push(f.label);
        // เพิ่ม visual error
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
      // scroll ไปยัง field แรกที่ error
      const firstErr = form.querySelector('.form-group.has-error');
      if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }

  // =============================================
  // Form Submit
  // =============================================
  // ==========================================
  // ฟังก์ชันบันทึกข้อมูลการแจ้งซ่อมลง Firebase (Submit)
  // ==========================================
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1) Validate
    if (!validateForm()) return;

    // 2) Confirm
    const confirmed = await showConfirmModal(
      'ยืนยันส่งคำขอแจ้งซ่อม',
      'กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนกดยืนยัน',
      'fa-paper-plane'
    );
    if (!confirmed) return;

    // 3) Lock button
    const submitBtn = document.getElementById('rf-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังส่ง...';

    try {
      // ดึงค่าจากฟอร์ม
      const empId = sessionStorage.getItem('empId') || '';
      const empName = sessionStorage.getItem('empName') || '';
      const empLastname = sessionStorage.getItem('empLastname') || '';
      const empDept = sessionStorage.getItem('empDepartment') || '';
      const fullName = `${empName} ${empLastname}`.trim();

      const p = document.getElementById('rf-area').value;
      const m = document.getElementById('rf-machine').value;
      const s = document.getElementById('rf-status').value;
      const t = document.getElementById('rf-worktype').value;
      const detail = document.getElementById('rf-detail').value;
      const completionDate = document.getElementById('rf-duedate').value; // dd/mm/yyyy
      const a = document.getElementById('rf-approver').value;

      // สร้าง timestamp สำหรับ ID
      const today = dateToString(new Date()).split(" ");
      const splitData = today[0].split('/')[2] + today[0].split('/')[1] + today[0].split('/')[0]
        + today[1].split(':')[0] + today[1].split(':')[1] + today[1].split(':')[2];

      // --- อัปโหลดรูปภาพไป Firebase Storage (Promise.all) ---
      let arrayImage = [];
      if (selectedFiles.length > 0) {
        submitBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up fa-beat"></i> อัปโหลดรูป 0/${selectedFiles.length}...`;

        let uploadedCount = 0;
        const uploadPromises = selectedFiles.map((file, i) => {
          // ชื่อไฟล์ unique: timestamp_index_originalName
          const uniqueName = `${splitData}_${i + 1}_${sanitizeFileName(file.name)}`;
          const filePath = `DEN/FIX/${new Date().getFullYear()}/${splitData}/${uniqueName}`;
          const fileRef = storageRef(storage, filePath);

          return uploadBytes(fileRef, file)
            .then(snapshot => getDownloadURL(snapshot.ref))
            .then(url => {
              uploadedCount++;
              submitBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up fa-beat"></i> อัปโหลดรูป ${uploadedCount}/${selectedFiles.length}...`;
              console.log(`✅ อัปโหลดรูปที่ ${uploadedCount} สำเร็จ: ${file.name}`);
              return url;
            });
        });

        arrayImage = await Promise.all(uploadPromises);
      }

      submitBtn.innerHTML = '<i class="fa-solid fa-database fa-beat"></i> บันทึกข้อมูล...';

      // สร้าง objectDetail
      const objectDetail = {
        date: dateToString(new Date()),
        dateUpdate: dateToString(new Date()),
        name: `${empId} | ${fullName}`,
        plant: p,
        mac: m,
        status: s,
        type: t,
        detail: detail,
        complete: completionDate,
        approve: a,
        id: splitData,
        image: arrayImage.length > 0 ? arrayImage.join(", ") : "",
        adminApprove: "-",
        adminCancal: "-",
        clean: "-",
        closeApprove: "-",
        den_end: "-",
        den_end_real: "-",
        den_fix: "-",
        den_name: "-,-,-,-,-,-",
        den_parts: "-",
        den_remack: "-",
        den_start: "-",
        den_start_real: "-",
        leaderApprove: "-",
        step: "1",
        remack: "-",
        dep: empDept
      };

      const keyword = `DEN/FIX/${new Date().getFullYear()}/${splitData}`;

      // --- บันทึกลง Firebase Realtime Database ---
      await set(ref(database, keyword), objectDetail);
      console.log('✅ บันทึกข้อมูลสำเร็จ:', keyword, objectDetail);

      await showAlert('ส่งคำขอสำเร็จ!', 'ระบบได้บันทึกข้อมูลการแจ้งซ่อมของคุณเรียบร้อยแล้ว', 'fa-circle-check');
      form.reset();

    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาด:', error);
      showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> ส่งคำขอแจ้งซ่อม';
    }
  });
}
