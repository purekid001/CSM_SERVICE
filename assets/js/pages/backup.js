/**
 * System — Backup / Delete Database 
 */
import { database, ref, get, remove } from '../firebase.js';
import { hrDatabase, ref as hrRef, get as hrGet, remove as hrRemove } from '../firebase-hr.js';
import { parseDMY } from '../utils.js';
import { showToast, showConfirmModal } from '../ui.js';

export function render() {
  return `
    <div class="app-page app-page-tight">
      <section class="page-hero page-hero-admin fade-in">
        <div class="page-hero-copy">
          <p class="page-hero-eyebrow">Administrator Only</p>
          <h1 class="page-hero-title">Backup / Delete Database</h1>
          <p class="page-hero-subtitle">เครื่องมือนี้ใช้ลบข้อมูลเก่าที่ปิดงานแล้วหรือยกเลิกแล้วออกจากฐานข้อมูลแบบถาวร จึงควรใช้งานอย่างระมัดระวังและตรวจสอบช่วงวันที่ให้ถูกต้องทุกครั้ง</p>
        </div>
        <div class="page-hero-meta">
          <div class="page-hero-stat">
            <span>ผลกระทบ</span>
            <strong>ลบข้อมูลแบบถาวร</strong>
          </div>
          <div class="page-hero-stat">
            <span>สิทธิ์ที่ต้องใช้</span>
            <strong>Admin เท่านั้น</strong>
          </div>
        </div>
      </section>

      <div class="page-note fade-in">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <div><strong>คำเตือน:</strong> หลังยืนยันลบ ข้อมูลจะถูกนำออกจากฐานข้อมูลทันทีและไม่สามารถกู้กลับจากหน้านี้ได้</div>
      </div>

      <div class="admin-grid">
        <div class="card fade-in admin-card">
          <div class="admin-card-head">
            <div>
              <h3><i class="fa-solid fa-wrench"></i> ลบข้อมูลแจ้งซ่อมเก่า (DEN/FIX)</h3>
              <p>ลบเฉพาะรายการที่ซ่อมเสร็จแล้วหรือยกเลิกแล้ว ตามช่วงวันที่ที่เลือก</p>
            </div>
          </div>
          <div class="danger-note">
            <i class="fa-solid fa-trash-can"></i>
            <div>ข้อมูลในหมวดนี้จะถูกลบถาวรจาก <code>DEN/FIX</code> เฉพาะสถานะ <i>ซ่อมเสร็จแล้ว</i> และ <i>ยกเลิก</i></div>
          </div>
          <div class="admin-inline-grid">
            <div class="form-group">
              <label>วันที่เริ่มต้น <span class="text-danger">*</span></label>
              <input type="text" id="eng-start-date" class="form-control" placeholder="เลือกวันที่เริ่มต้น">
            </div>
            <div class="form-group">
              <label>วันที่สิ้นสุด <span class="text-danger">*</span></label>
              <input type="text" id="eng-end-date" class="form-control" placeholder="เลือกวันที่สิ้นสุด">
            </div>
          </div>
          <div class="form-actions admin-actions">
            <button class="btn btn-danger" id="btn-del-eng">
              <i class="fa-solid fa-trash"></i> ลบข้อมูลแจ้งซ่อม
            </button>
          </div>
        </div>

        <div class="card fade-in admin-card" style="animation-delay: 0.08s;">
          <div class="admin-card-head">
            <div>
              <h3><i class="fa-solid fa-car"></i> ลบข้อมูลจองรถเก่า (Booking)</h3>
              <p>ลบเฉพาะรายการที่ปิดงานแล้วหรือยกเลิกแล้วจากระบบ Booking</p>
            </div>
          </div>
          <div class="danger-note">
            <i class="fa-solid fa-trash-can"></i>
            <div>ข้อมูลในหมวดนี้จะถูกลบถาวรจาก <code>Booking/Booking1</code> และ <code>Booking/Booking2</code> เฉพาะสถานะ <i>ปิดงานแล้ว</i> และ <i>ยกเลิก</i></div>
          </div>
          <div class="admin-inline-grid">
            <div class="form-group">
              <label>วันที่เริ่มต้น <span class="text-danger">*</span></label>
              <input type="text" id="hr-start-date" class="form-control" placeholder="เลือกวันที่เริ่มต้น">
            </div>
            <div class="form-group">
              <label>วันที่สิ้นสุด <span class="text-danger">*</span></label>
              <input type="text" id="hr-end-date" class="form-control" placeholder="เลือกวันที่สิ้นสุด">
            </div>
          </div>
          <div class="form-actions admin-actions">
            <button class="btn btn-danger" id="btn-del-hr">
              <i class="fa-solid fa-trash"></i> ลบข้อมูลจองรถ
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  const isAdmin = sessionStorage.getItem('empLevel_en') === 'admin' || sessionStorage.getItem('empLevel_hr') === 'admin' || sessionStorage.getItem('level_Hr') === 'admin';
  const btnEng = document.getElementById('btn-del-eng');
  const btnHr = document.getElementById('btn-del-hr');
  
  if (!isAdmin) {
    showToast('คุณไม่มีสิทธิ์เข้าถึงฟังก์ชันนี้ (เฉพาะ Admin เท่านั้น)', 'error');
    btnEng.disabled = true;
    btnHr.disabled = true;
    btnEng.style.opacity = '0.5';
    btnHr.style.opacity = '0.5';
    btnEng.style.cursor = 'not-allowed';
    btnHr.style.cursor = 'not-allowed';
  }

  // Init date pickers
  flatpickr('#eng-start-date', { dateFormat: "d/m/Y", allowInput: true });
  flatpickr('#eng-end-date', { dateFormat: "d/m/Y", allowInput: true });
  flatpickr('#hr-start-date', { dateFormat: "d/m/Y", allowInput: true });
  flatpickr('#hr-end-date', { dateFormat: "d/m/Y", allowInput: true });

  // ==========================================
  // Engineering Delete Logic
  // ==========================================
  btnEng.addEventListener('click', async () => {
    if (!isAdmin) return;
    const startStr = document.getElementById('eng-start-date').value;
    const endStr = document.getElementById('eng-end-date').value;
    if (!startStr || !endStr) return showToast('กรุณาเลือกวันที่เริ่มต้นและสิ้นสุดของแจ้งซ่อม', 'warning');
    
    const startDate = parseDMY(startStr);
    const endDate = parseDMY(endStr);
    if (!startDate || !endDate) return showToast('รูปแบบวันที่ไม่ถูกต้อง', 'warning');
    endDate.setHours(23, 59, 59, 999);
    if (startDate > endDate) return showToast('วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด', 'warning');

    const confirmMsg = `ยืนยันการลบ <b>แจ้งซ่อม</b> ที่เสร็จสิ้น/ยกเลิกแล้ว<br>ตั้งแต่วันที่ ${startStr} ถึง ${endStr}?`;
    const confirmed = await showConfirmModal('ยืนยันการลบข้อมูล (DEN/FIX)', confirmMsg, 'fa-trash');
    if (!confirmed) return;

    btnEng.disabled = true;
    btnEng.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังลบ...';

    try {
      let deletedCount = 0;
      const deletePromises = [];
      for (let y = startDate.getFullYear(); y <= endDate.getFullYear(); y++) {
        const snap = await get(ref(database, `DEN/FIX/${y}`));
        if (snap.exists()) {
          const data = snap.val();
          for (const id in data) {
            const item = data[id];
            if (String(item.step) === '4' || String(item.step) === '6') {
              const dateStr = item.date ? item.date.split(' ')[0] : null;
              if (dateStr) {
                const itemDate = parseDMY(dateStr);
                if (itemDate && itemDate >= startDate && itemDate <= endDate) {
                  deletePromises.push(remove(ref(database, `DEN/FIX/${y}/${id}`)));
                  deletedCount++;
                }
              }
            }
          }
        }
      }
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
        showToast(`ลบข้อมูลแจ้งซ่อมเรียบร้อย ${deletedCount} รายการ`, 'success');
      } else {
        showToast(`ไม่พบข้อมูลที่ตรงเงื่อนไข`, 'info');
      }
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
    } finally {
      btnEng.disabled = false;
      btnEng.innerHTML = '<i class="fa-solid fa-trash"></i> ลบข้อมูลแจ้งซ่อม';
      document.getElementById('eng-start-date').value = '';
      document.getElementById('eng-end-date').value = '';
    }
  });

  // ==========================================
  // HR Booking Delete Logic
  // ==========================================
  btnHr.addEventListener('click', async () => {
    if (!isAdmin) return;
    const startStr = document.getElementById('hr-start-date').value;
    const endStr = document.getElementById('hr-end-date').value;
    if (!startStr || !endStr) return showToast('กรุณาเลือกวันที่เริ่มต้นและสิ้นสุดของการจองรถ', 'warning');
    
    const startDate = parseDMY(startStr);
    const endDate = parseDMY(endStr);
    if (!startDate || !endDate) return showToast('รูปแบบวันที่ไม่ถูกต้อง', 'warning');
    endDate.setHours(23, 59, 59, 999);
    if (startDate > endDate) return showToast('วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด', 'warning');

    const confirmMsg = `ยืนยันการลบ <b>การจองรถ</b> ที่ปิดงาน/ยกเลิกแล้ว<br>ตั้งแต่วันที่ ${startStr} ถึง ${endStr}?`;
    const confirmed = await showConfirmModal('ยืนยันการลบข้อมูล (Booking)', confirmMsg, 'fa-trash');
    if (!confirmed) return;

    btnHr.disabled = true;
    btnHr.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังลบ...';

    try {
      let deletedCount = 0;
      const deletePromises = [];
      
      for (let y = startDate.getFullYear(); y <= endDate.getFullYear(); y++) {
        // Booking1
        const b1Snap = await hrGet(hrRef(hrDatabase, `Booking/Booking1/${y}`));
        if (b1Snap.exists()) {
          const b1Data = b1Snap.val();
          for (const id in b1Data) {
            const item = b1Data[id];
            if (String(item.step) === '4' || String(item.step) === '5') {
              if (item.bookingDate) {
                const itemDate = parseDMY(item.bookingDate);
                if (itemDate && itemDate >= startDate && itemDate <= endDate) {
                  deletePromises.push(hrRemove(hrRef(hrDatabase, `Booking/Booking1/${y}/${id}`)));
                  deletedCount++;
                }
              }
            }
          }
        }
        // Booking2
        const b2Snap = await hrGet(hrRef(hrDatabase, `Booking/Booking2/${y}`));
        if (b2Snap.exists()) {
          const b2Data = b2Snap.val();
          for (const id in b2Data) {
            const item = b2Data[id];
            if (String(item.step) === '4' || String(item.step) === '5') {
              if (item.bookingDate) {
                const itemDate = parseDMY(item.bookingDate);
                if (itemDate && itemDate >= startDate && itemDate <= endDate) {
                  deletePromises.push(hrRemove(hrRef(hrDatabase, `Booking/Booking2/${y}/${id}`)));
                  deletedCount++;
                }
              }
            }
          }
        }
      }
      
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
        showToast(`ลบข้อมูลจองรถเรียบร้อย ${deletedCount} รายการ`, 'success');
      } else {
        showToast(`ไม่พบข้อมูลที่ตรงเงื่อนไข`, 'info');
      }
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
    } finally {
      btnHr.disabled = false;
      btnHr.innerHTML = '<i class="fa-solid fa-trash"></i> ลบข้อมูลจองรถ';
      document.getElementById('hr-start-date').value = '';
      document.getElementById('hr-end-date').value = '';
    }
  });
}
