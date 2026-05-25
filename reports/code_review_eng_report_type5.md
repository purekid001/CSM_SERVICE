# 🔍 Code Review — eng-report.js หัวข้อที่ 5: รายงานจาก Google Sheet

**Reviewer:** Senior Developer  
**วันที่:** 20 พฤษภาคม 2026  
**ไฟล์:** `assets/js/pages/eng-report.js`  
**ขอบเขต:** เฉพาะ Report Type 5 — "รายงานจาก Google Sheet (ทดสอบ)"

---

## 📌 ภาพรวมของ Type 5

Type 5 คือระบบดึงข้อมูลแจ้งซ่อมจาก **Google Apps Script (GAS) Web App** แทนที่จะดึงจาก Firebase Realtime Database โดยตรง

**โค้ดที่เกี่ยวข้อง:**
- **การเรียก API + Filter:** `generateReport()` → บรรทัด 274-341
- **การ Render ตาราง:** `renderType5()` → บรรทัด 735-750
- **การ Render แต่ละหน้า:** `renderType5Table()` → บรรทัด 752-780
- **Column Definition:** `columns5` → บรรทัด 11-26
- **การ Export Excel:** `exportToExcel()` → บรรทัด 881-883
- **Pagination:** `renderTablePagination()` + `window.setEngTblPage()` → บรรทัด 1003-1039

---

## 🚨 Critical Issues

### 1. Google Apps Script URL ถูก hardcode ไว้ใน source code

```javascript
// บรรทัด 276
const url = "https://script.google.com/macros/s/AKfycbyisoWKiBKmUCGde.../exec";
```

**ปัญหา:**
- URL นี้คือ public endpoint ที่ใครก็สามารถเข้าถึงได้ ถ้ารู้ URL
- ถ้า GAS script ไม่ได้ทำ authorization ไว้ → ข้อมูลทุกอย่างเปิดเผย
- URL ถูกฝังใน client code → ถ้าต้องเปลี่ยน URL ต้อง deploy ใหม่
- ไม่มี API key / token ในการเรียก

**แนวทางแก้:**
- ย้าย URL ไปเก็บใน `.env` → `VITE_GAS_REPORT_URL`
- ใช้ `import.meta.env.VITE_GAS_REPORT_URL` แทน hardcode
- เพิ่ม secret token ส่งไปกับ request เพื่อ verify ฝั่ง GAS

---

### 2. ไม่มี Timeout สำหรับ fetch()

```javascript
// บรรทัด 277
const response = await fetch(url);
```

**ปัญหา:**
- ถ้า Google Apps Script ตอบช้า (GAS มี cold start ได้ 10-30 วินาที) → ไม่มี timeout
- ปุ่มจะค้างอยู่ที่ "กำลังโหลด..." ไม่มีกำหนดสิ้นสุด
- ไม่ได้เช็ค `response.ok` ก่อน parse

**แนวทางแก้:**
```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 วินาที

try {
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const records = await response.json();
  // ...
} catch (err) {
  if (err.name === 'AbortError') {
    showAlert("Timeout", "การดึงข้อมูลใช้เวลานานเกินไป", "fa-clock");
  }
}
```

---

### 3. XSS — ข้อมูลจาก Google Sheet ไม่ถูก sanitize

```javascript
// บรรทัด 761, 773, 775
let val = r[c.key] !== null && r[c.key] !== undefined ? r[c.key] : '-';
return `<td>${val}</td>`;
```

**ปัญหา:**
- ข้อมูลจาก Google Sheet ถูก inject ลง HTML ตรงๆ ไม่ผ่าน escaping
- ถ้ามีใครใส่ `<script>alert('xss')</script>` ในช่อง detail ของ Google Sheet → โค้ดจะ execute
- เป็นช่องทาง Stored XSS (ข้อมูลถูกเก็บใน Sheet แล้วแสดงผลทุกครั้ง)

**แนวทางแก้:**
```javascript
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ใช้:
return `<td>${escapeHtml(String(val))}</td>`;
```

---

## ⚠️ Major Issues

### 4. JSON Parse ไม่ robust — ใช้ `response.text()` แล้ว `JSON.parse()` แยก

```javascript
// บรรทัด 278-284
const dataText = await response.text();
let records = [];
try {
  records = JSON.parse(dataText);
} catch (e) {
  console.error("JSON parse error:", dataText);
  throw new Error("Invalid JSON data");
}
```

**ปัญหา:**
- ทำไมไม่ใช้ `response.json()` ตรงๆ?
- ถ้า GAS คืนค่า error message ที่ไม่ใช่ JSON → จะ log ข้อมูลดิบ (อาจมี sensitive data) ใน console
- error message `"Invalid JSON data"` ไม่ช่วยให้ user เข้าใจปัญหา

**แนวทางแก้:**
```javascript
let records;
try {
  records = await response.json();
} catch (e) {
  console.error("JSON parse error");
  throw new Error("ข้อมูลจาก Google Sheet ไม่อยู่ในรูปแบบที่ถูกต้อง");
}

if (!Array.isArray(records)) {
  throw new Error("ข้อมูลที่ได้รับไม่ใช่ Array");
}
```

---

### 5. Filter Logic ซ้ำกับ Type 4 — ไม่ DRY

**Type 4** (บรรทัด 346-372) และ **Type 5** (บรรทัด 296-317) มี filter logic คล้ายกันมาก:

```javascript
// Type 5 — Department Filter (บรรทัด 296-303)
const deptFilter5 = document.getElementById('rep-department').value.trim().toLowerCase();
if (deptFilter5 !== "") {
  records = records.filter(r => {
    const rDep = (r.dep || '').toLowerCase().replace(/\s+/g, '');
    const cleanDept = deptFilter5.replace(/\s+/g, '');
    return rDep.includes(cleanDept);
  });
}

// Type 4 — Department Filter (บรรทัด 347-357) — เกือบเหมือนกัน!
const deptFilter = document.getElementById('rep-department').value.trim().toLowerCase();
// ... เหมือนกัน
```

**แนวทางแก้:**
```javascript
function applyFilters(records) {
  const dept = document.getElementById('rep-department').value.trim().toLowerCase();
  const status = document.getElementById('rep-status').value;
  
  return records.filter(r => {
    if (dept && !(r.dep || '').toLowerCase().replace(/\s+/g, '').includes(dept.replace(/\s+/g, ''))) return false;
    if (status) { /* status filter logic */ }
    return true;
  });
}
```

---

### 6. Type 5 — Step Format ไม่ตรงกับ Firebase (Inconsistent)

```javascript
// บรรทัด 306-316 — Google Sheet step format
// Google Sheet step format: "2.รอช่างอนุมัติ" — extract leading number
const stepStr = String(r.step || '').trim();
const stepNum = stepStr.match(/^(\d+)/) ? stepStr.match(/^(\d+)/)[1] : '0';
```

**ปัญหา:**
- Firebase ใช้ step เป็นตัวเลข ("1", "2", "3", ...)
- Google Sheet ใช้ step เป็น "2.รอช่างอนุมัติ" (ตัวเลข + ข้อความ)
- ต้อง regex extract ตัวเลข → error-prone ถ้า format เปลี่ยน
- `getStepBadge()` ที่ใช้กับ Firebase data ไม่ได้ถูกใช้กับ Type 5 (ใช้ badge-info แทนตลอด) → ทำให้สีไม่ตรง

**แนวทางแก้:**
- สร้าง mapping function ที่ normalize step format จากทั้ง Firebase และ Google Sheet ให้เป็น format เดียวกัน
- หรือแก้ GAS script ให้ส่ง step เป็นตัวเลข pure

---

### 7. Type 5 ไม่มี Chart/Timeline

```javascript
// บรรทัด 324-326
document.getElementById('rep-chart-card').style.display = 'none';
document.getElementById('rep-table-card').style.display = 'block';
document.getElementById('rep-timeline-card').style.display = 'none';
```

**ข้อสังเกต:**
- Type 1-4 แสดงทั้ง Chart + Timeline + Table
- Type 5 แสดงแค่ Table เท่านั้น
- อาจตั้งใจให้เป็น "ทดสอบ" แต่ถ้าจะใช้จริง ควรมี visualization ด้วย

---

## 📝 Minor Issues

### 8. `columns5` — Column definitions ดี แต่ไม่ได้ใช้ตอน Export

```javascript
// Export (บรรทัด 882)
exportData = currentData; // Export exactly as fetched from JSON
```

**ปัญหา:**
- Export ส่ง raw data ตรงๆ จาก Google Sheet → column headers จะเป็น key names ดิบ (เช่น `mac_id`, `den_name`)
- ไม่ใช้ `columns5` ที่ map label ไว้สวยๆ แล้ว
- ผลลัพธ์ Excel จะไม่ user-friendly

**แนวทางแก้:**
```javascript
exportData = currentData.map(r => {
  const row = {};
  columns5.forEach(c => {
    row[c.label] = r[c.key] !== null && r[c.key] !== undefined ? r[c.key] : '-';
  });
  return row;
});
```

---

### 9. Error Message ไม่ชัดเจนพอ

```javascript
// บรรทัด 337
showAlert("Error", "ไม่สามารถดึงข้อมูลจาก Google Sheet ได้ โปรดตรวจสอบสิทธิ์การเข้าถึง: " + err.message, "fa-circle-xmark");
```

**ข้อสังเกต:**
- `err.message` อาจมีข้อมูล technical ที่ user ทั่วไปไม่เข้าใจ (เช่น `"Failed to fetch"`, `"NetworkError"`)
- ควรแยกข้อความสำหรับ user กับ log สำหรับ developer

---

### 10. Type 4 กับ Type 5 แชร์ filter UI แต่ไม่ได้ reset ค่า

```javascript
// บรรทัด 158-165 — Toggle filter visibility
if (val === "4") {
  document.getElementById('rep-dept-filter').style.display = 'block';
  document.getElementById('rep-status-filter').style.display = 'block';
} else if (val === "5") {
  document.getElementById('rep-dept-filter').style.display = 'block';
  document.getElementById('rep-status-filter').style.display = 'block';
}
```

**ปัญหา:**
- โค้ด `if (val === "4")` และ `else if (val === "5")` ทำอะไรเหมือนกันเป๊ะ → ซ้ำ
- ถ้าเลือก Type 4 → กรองแผนก → แล้วเปลี่ยนเป็น Type 5 → ค่า filter เดิมยังอยู่ → อาจสับสน

**แนวทางแก้:**
```javascript
if (val === "4" || val === "5") {
  document.getElementById('rep-dept-filter').style.display = 'block';
  document.getElementById('rep-status-filter').style.display = 'block';
} else {
  // ...
}
```

---

## ✅ สิ่งที่ทำได้ดี

| ด้าน | รายละเอียด |
|------|-----------|
| 📋 **Column Mapping** | `columns5` มี column definitions ที่ชัดเจน ทำให้เพิ่ม/ลบ column ง่าย |
| 📄 **Pagination** | มีระบบ pagination ที่ใช้ร่วมกับ Type 4 ได้ (`renderTablePagination`) |
| 🔍 **Filtering** | มี filter ทั้ง date range, department, status ครบ |
| 📤 **Export Excel** | มี export to Excel ด้วย SheetJS |
| 🎨 **Step Badge** | Type 5 แสดง step เป็น badge สวยงาม |
| 💡 **Smart Parsing** | แยก step number จาก Google Sheet format ได้ (regex) |
| 🛡️ **Error Handling** | มี try-catch ครอบ fetch + JSON parse + แสดง alert |

---

## 📊 สรุป Priority

| Priority | หัวข้อ | ประเภท |
|----------|--------|--------|
| 🔴 P0 | XSS — ข้อมูลจาก Google Sheet ไม่ถูก sanitize | Security |
| 🟠 P1 | GAS URL hardcode → ย้ายไป `.env` | Security / Config |
| 🟠 P1 | ไม่มี Timeout + ไม่เช็ค `response.ok` | Reliability |
| 🟡 P2 | JSON parse ไม่ใช้ `response.json()` | Code Quality |
| 🟡 P2 | Filter logic ซ้ำกับ Type 4 | Maintainability |
| 🟢 P3 | Export ไม่ใช้ `columns5` mapping | UX |
| 🟢 P3 | Type 4/5 filter toggle ซ้ำ | Code Quality |
| 🟢 P3 | Step format inconsistent (Firebase vs GSheet) | Data Consistency |

---

## 💬 สรุปจาก Senior

หัวข้อที่ 5 ทำได้ค่อนข้างครบ — มี fetch, filter, pagination, export excel ใช้ได้ดี

**จุดที่ต้องแก้เร่งด่วน:**
1. **XSS** — ข้อมูลจาก external source (Google Sheet) ต้อง sanitize ก่อนแสดงผลเสมอ
2. **GAS URL** — ย้ายไป environment variable
3. **Timeout** — เพิ่ม fetch timeout + เช็ค response status

**จุดที่ควรปรับปรุง:**
- ใช้ `response.json()` แทน `response.text()` + `JSON.parse()`
- Extract filter logic เป็น shared function
- ใช้ `columns5` ตอน export excel ด้วย (ไม่ใช่ส่ง raw data)
