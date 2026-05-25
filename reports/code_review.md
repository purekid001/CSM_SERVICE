# 🔍 Code Review — CSM SERVICE Database System

**Reviewer:** Senior Developer  
**วันที่:** 20 พฤษภาคม 2026  
**โปรเจกต์:** CSM SERVICE | ระบบจัดการข้อมูล (SPA + Firebase Realtime Database)

---

## ภาพรวม (Overall Impression)

โปรเจกต์นี้เป็น **Single Page Application (SPA)** ที่ใช้ Vite + Vanilla JS + Firebase Realtime Database ครอบคลุมระบบ Engineer (แจ้งซ่อม) และ HR (จองรถ/Shuttle) โครงสร้างโค้ดค่อนข้างเป็นระเบียบ แยก module ชัดเจน มี design system ที่ดี มี UI components กลาง (Modal, Toast) ที่ reusable

**แต่มีประเด็นที่ต้องปรับปรุงเร่งด่วนหลายจุด โดยเฉพาะเรื่อง Security**

---

## 🚨 ระดับ Critical — ต้องแก้ทันที

### 1. รหัสผ่านเก็บ/ตรวจสอบแบบ Plaintext (CRITICAL)

> **⛔ ปัญหาร้ายแรงที่สุด** — ระบบตรวจสอบรหัสผ่านแบบ Plaintext ตรงๆ จาก Database

ไฟล์: `assets/js/auth.js`

```javascript
// ❌ ตรวจสอบรหัสผ่านตรงๆ จาก Database
if (userData.password === password) {
```

**ปัญหา:**
- รหัสผ่านถูกเก็บเป็น plaintext ใน Firebase Realtime Database
- ใครก็ตามที่มี read access กับ Database node `DHR/User/` จะเห็นรหัสผ่านทุกคน
- ทุกคนที่ login ได้ ก็สามารถ dump รหัสผ่านทุกคนออกมาได้ (เพราะ client อ่าน DB ตรง)

**แนวทางแก้:**
- ใช้ **Firebase Authentication** แทนการเก็บ password เอง
- หรืออย่างน้อยต้อง hash ด้วย bcrypt/argon2 ฝั่ง server (ใช้ Cloud Functions)
- **ห้ามตรวจ password ฝั่ง client เด็ดขาด** — ต้องทำผ่าน server/Cloud Functions

---

### 2. Firebase API Keys ถูก commit ลง `.env` (HIGH)

> **⚠️ คำเตือน** — ไฟล์ `.env` มี API keys ทั้ง 2 โปรเจกต์ — ต้องตรวจสอบ Firebase Security Rules

ไฟล์: `.env`

**ข้อสังเกต:**
- Firebase API keys สำหรับ frontend ไม่ใช่ "secret" โดยตัวมันเอง (มันถูกฝังใน client อยู่แล้ว)
- **แต่** ถ้า Firebase Security Rules เปิดกว้างเกินไป (เช่น `.read: true`) ใครก็ตามจะเข้าถึงข้อมูลทั้งหมดได้
- ควรตรวจว่า `.env` ไม่ถูก commit ขึ้น git (ตรวจ `.gitignore`)

**แนวทางแก้:**
- ตรวจสอบ Firebase Security Rules ให้ restrict access ตาม authentication
- เพิ่ม `.env` ใน `.gitignore`
- ย้าย operations ที่ sensitive (เช่น การอ่านข้อมูล users, การเขียน backup) ไปทำบน Cloud Functions

---

### 3. XSS Vulnerability — ใช้ `innerHTML` กับ user data โดยไม่ sanitize

> **⚠️ คำเตือน** — หลายจุดใน codebase ใช้ `innerHTML` กับข้อมูลจาก Database โดยตรง ซึ่งเปิดช่องให้โจมตี XSS ได้

ตัวอย่างจาก `assets/js/pages/home.js`:
```javascript
// ❌ item.detail มาจาก DB ตรงๆ ไม่ผ่าน sanitize
`<div title="${item.detail}">${item.detail}</div>`
```

ตัวอย่างจาก `assets/js/pages/eng-request.js`:
```javascript
// ❌ e.target.result ใส่ใน img src ตรง
`<img src="${e.target.result}" alt="${file.name}">`
```

**แนวทางแก้:**
- สร้าง utility function `escapeHtml()` สำหรับ sanitize ข้อมูลก่อนแสดงผล
- ใช้ `textContent` แทน `innerHTML` ในกรณีที่ไม่ต้องการ HTML
- หรือใช้ DOM API (`createElement`) แทนการสร้าง HTML string

---

## ⚠️ ระดับ Major — ควรแก้ในเร็วๆ นี้

### 4. Code Duplication — Session Storage Logic ซ้ำกัน ✅ (แก้แล้ว)

ไฟล์: `assets/js/auth.js`

การเก็บ session ถูกเขียนซ้ำ **2 ที่เหมือนกันเป๊ะ** (auto-login กับ manual login):

```javascript
// ❌ ซ้ำกัน 2 ที่ (บรรทัด 82-90 และ 162-170)
sessionStorage.setItem('isLoggedIn', 'true');
sessionStorage.setItem('empId', savedUser);
sessionStorage.setItem('empName', userData.firstname || 'User');
// ... อีก 5 บรรทัด
```

**แก้ไขแล้ว — Extract เป็น function:**
```javascript
// ✅ Extract เป็น function
function setUserSession(userId, userData) {
  sessionStorage.setItem('isLoggedIn', 'true');
  sessionStorage.setItem('empId', userId);
  sessionStorage.setItem('empName', userData.firstname || 'User');
  sessionStorage.setItem('empLastname', userData.lastname || ' ');
  // ...
}
```

---

### 5. ไม่มี Route Guard / Session Validation ที่เพียงพอ

> **❗ สำคัญ** — ระบบไม่ได้ตรวจสอบ session validity อย่างแท้จริง — user สามารถ manipulate sessionStorage แล้วเข้าถึง Dashboard ได้

**ปัญหา:**
- ไม่มีการตรวจ `isLoggedIn` ก่อนแสดง Dashboard
- ถ้า user เปิด DevTools แล้ว set `sessionStorage.setItem('isLoggedIn', 'true')` ก็อาจเข้าถึงหน้าอื่นได้
- `hashchange` ไม่ได้ถูก listen — user สามารถเปลี่ยน hash โดยตรงได้

**แนวทางแก้:**
- ใช้ Firebase Auth + `onAuthStateChanged()` เป็น source of truth
- เพิ่ม auth guard ใน `showPage()` ให้ตรวจ session ก่อนโหลดหน้า
- Listen `hashchange` event

---

### 6. Firebase `ref` และ `get` ถูก re-export ซ้ำ

ไฟล์: `assets/js/firebase.js` กับ `assets/js/firebase-hr.js`

```javascript
// firebase.js
export { database, ref, get, set, update, ... };

// firebase-hr.js
export { hrDatabase, ref, get, set, update };  // ← ref, get, set, update ซ้ำกัน!
```

**ปัญหา:** `ref`, `get`, `set`, `update` เป็น SDK functions ตัวเดียวกัน ถูก export จาก 2 ไฟล์ — สร้างความสับสนให้คนอ่านโค้ด

**แนวทางแก้:**
- Export `ref`, `get`, `set`, `update` จากที่เดียว (firebase.js)
- firebase-hr.js export แค่ `hrDatabase`

---

### 7. Inline Styles มากเกินไป ✅ (แก้แล้ว)

หลายไฟล์ (โดยเฉพาะ `home.js`, `employee.js`, `index.html`) ใช้ inline style มากเกินไป

```html
<!-- ❌ index.html L80 -->
<img src="..." style="max-width:100%; width:200px; height:auto; display:block; margin:0 auto;">

<!-- ❌ employee.js มี inline style แทบทุก element -->
<div style="width: 80px; height: 80px; background: var(--ocean-soft); border-radius: 50%; ...">
```

**แก้ไขแล้ว — ย้าย inline styles ไปเป็น CSS classes:**
- `home.js` → ใช้ `home-hero`, `kpi-card`, `kpi-amber/blue/purple/green`, `home-section-title`
- `employee.js` → ใช้ `emp-profile-*`, `emp-info-*`, `emp-level-*`, `emp-status-badge`
- `index.html` → ใช้ `.sidebar-logo`

---

### 8. home.js ใช้ `<style>` tag ใน JavaScript ✅ (แก้แล้ว)

ไฟล์: `assets/js/pages/home.js`

```javascript
export function render() {
  return `
    <style>
      .home-wrap { ... }
      .home-kpi-row { ... }
      // ...
    </style>
    ...
  `;
}
```

**ปัญหา:**
- ทุกครั้งที่ navigate กลับมาหน้า Home จะมีการ inject `<style>` ซ้ำ
- CSS อาจ leak ไปหน้าอื่น (ไม่มี scope)
- ทำให้ยากต่อการ debug CSS

**แก้ไขแล้ว — ย้าย CSS ไปไว้ใน `style.css` หลัก**

---

## 📝 ระดับ Minor — ข้อเสนอแนะเพิ่มเติม

### 9. การใช้ `window.xxx` เพื่อทำ global functions

ไฟล์: `assets/js/ui.js`, `assets/js/router.js`, `assets/js/auth.js`

```javascript
window.toggleDropdown = (btn) => { ... };
window.showPage = (page) => { ... };
window.logout = async () => { ... };
```

**ข้อสังเกต:** ใช้ `window.xxx` เพื่อให้ inline onclick ใน HTML เรียกใช้ได้ — เข้าใจว่าจำเป็นเพราะ HTML อยู่ใน `index.html` (ไม่ได้ render จาก JS)

**แนวทางที่ดีกว่า (ในอนาคต):**
- ใช้ `addEventListener` แทน inline `onclick`
- หรือย้ายไป framework เล็กๆ เช่น Alpine.js ที่จัดการ event binding ได้ดีกว่า

---

### 10. Typos ในโค้ด ✅ (แก้บางส่วนแล้ว)

- `eng-request.js` L96: `"IM = ปรุับปรุง/ต่อเติม"` → แก้เป็น `"IM = ปรับปรุง/ต่อเติม"` ✅
- `eng-request.js` L528: `den_remack` → ควรเป็น `den_remark` (ไม่แก้ — เป็น DB field name ที่มี data อยู่แล้ว)
- `eng-request.js` L520: `adminCancal` → ควรเป็น `adminCancel` (ไม่แก้ — เป็น DB field name ที่มี data อยู่แล้ว)

---

### 11. Date/Time Parsing ไม่ robust

ไฟล์: `assets/js/pages/home.js`

```javascript
// ❌ ใช้ string includes เพื่อ match เดือน/ปี
if (rec.date && rec.date.includes(`/${currentMonthStr}/${currentYearStr}`)) {
```

**ปัญหา:** ถ้า format date เปลี่ยน หรือมี substring ตรงกัน จะผิดพลาดได้

**แนวทางแก้:**
- Parse date เป็น `Date` object ก่อน แล้ว compare ด้วย `getMonth()` / `getFullYear()`

---

### 12. `package.json` ไม่มี `name`, `version`, `description`

ไฟล์: `package.json`

ควรเพิ่ม metadata พื้นฐาน:
```json
{
  "name": "csm-service-web",
  "version": "1.0.0",
  "description": "CSM SERVICE Database Management System",
  "private": true,
  ...
}
```

---

### 13. Operator Precedence Bug ✅ (แก้แล้ว)

ไฟล์: `assets/js/auth.js`

```javascript
// ❌ || มี precedence ต่ำกว่า + ทำให้ผลลัพธ์อาจไม่ถูกต้อง
toggleView(true, userData.firstname + " " + userData.lastname || savedUser);
// ตีความเป็น: (userData.firstname + " " + userData.lastname) || savedUser
// ถ้า lastname เป็น undefined → จะได้ "สมชาย undefined" แทนที่จะ fallback
```

**แก้ไขแล้ว — สร้าง helper function:**
```javascript
function getDisplayName(userData, fallback) {
  const name = `${userData.firstname || ''} ${userData.lastname || ''}`.trim();
  return name || fallback;
}
```

---

### 14. `closeModal` ถูกเรียกโดยไม่ตรวจว่ามีอยู่จริงหรือไม่ ✅ (แก้แล้ว)

ไฟล์: `assets/js/auth.js`

```javascript
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && typeof closeModal === 'function') {
    closeModal(); // ← closeModal ไม่ได้ถูก define ใน scope นี้ — dead code
  }
});
```

**แก้ไขแล้ว — ลบ dead code ออก**

---

### 15. ไม่มี Error Boundary / Global Error Handler

ถ้า Firebase ล่ม หรือ Network error เกิดขึ้น หลายหน้าจะแสดง spinner ค้างไม่จบ

**แนวทางแก้:**
- เพิ่ม timeout mechanism สำหรับ Firebase calls
- เพิ่ม `window.onerror` / `window.addEventListener('unhandledrejection')` เพื่อจับ error ที่หลุด
- แสดง error state ที่ user-friendly แทน spinner ค้าง

---

## ✅ สิ่งที่ทำได้ดี (Positive Feedback)

| ด้าน | รายละเอียด |
|------|-----------|
| 🏗️ **Architecture** | แยก module ชัดเจน (firebase, auth, router, ui, pages) — อ่านง่าย maintain ง่าย |
| 🎨 **Design System** | CSS Custom Properties ครบถ้วน, มี design tokens ที่ดี, spacing/shadow/color consistent |
| 🧩 **UI Components** | `showConfirmModal`, `showAlert`, `showToast` เป็น reusable components ที่ดี ทำ standardized ได้เนียน |
| 📱 **Responsive** | มี media queries สำหรับ mobile/tablet, sidebar collapse ได้ |
| 🔀 **SPA Routing** | ระบบ hash-based routing ทำได้ดี, มี F5 support, page mapping ชัดเจน |
| 📝 **Comments** | มี comment อธิบายภาษาไทยครบถ้วน เข้าใจง่าย |
| 🎭 **UX** | Wave animation, glassmorphism login, loading states, button feedback ทำได้ดี |
| 📋 **Form Validation** | eng-request.js มี validation ครบ, แสดง error ชัดเจน, scroll ไป field ที่ผิด |
| 🔐 **Permission System** | มี menu permission ตาม level ที่ทำได้เรียบร้อย |

---

## 📊 สรุป Priority ที่ควรทำ

| Priority | หัวข้อ | ความเสี่ยง | ความยาก | สถานะ |
|----------|--------|-----------|---------|-------|
| 🔴 P0 | Plaintext password → ใช้ Firebase Auth | Security Critical | Medium | ❌ ยังไม่แก้ |
| 🔴 P0 | XSS vulnerability → sanitize HTML | Security High | Easy | ❌ ยังไม่แก้ |
| 🟠 P1 | Firebase Security Rules review | Security High | Medium | ❌ ยังไม่แก้ |
| 🟠 P1 | Route guard / auth validation | Security Medium | Easy | ❌ ยังไม่แก้ |
| 🟡 P2 | Operator precedence bug | Bug | Easy | ✅ แก้แล้ว |
| 🟡 P2 | Code duplication (session logic) | Maintainability | Easy | ✅ แก้แล้ว |
| 🟡 P2 | Dead code (closeModal) | Code Quality | Easy | ✅ แก้แล้ว |
| 🟢 P3 | Inline styles → CSS classes | Code Quality | Medium | ✅ แก้แล้ว |
| 🟢 P3 | `<style>` in JS → move to CSS file | Code Quality | Easy | ✅ แก้แล้ว |
| 🟢 P3 | Typos fix (UI) | Code Quality | Easy | ✅ แก้แล้ว |
| 🟢 P3 | Error handling / timeout | Reliability | Medium | ❌ ยังไม่แก้ |

---

## 💬 สรุปจาก Senior

โดยรวมโปรเจกต์นี้ทำได้ดีในแง่โครงสร้างและ UI/UX — เห็นได้ชัดว่าตั้งใจทำ design system มาอย่างดี, แยก module เป็นระเบียบ, มี comments อธิบายครบ

**แต่จุดที่ต้องแก้เร่งด่วนที่สุดคือเรื่อง Security** — โดยเฉพาะ plaintext password และ XSS ถ้าระบบนี้ใช้งานจริงภายในองค์กรอยู่แล้ว ควรวางแผน migrate ไป Firebase Authentication โดยเร็วที่สุดครับ

**สิ่งที่แก้ไปแล้ว (P2 + P3):**
- ✅ แก้ operator precedence bug + สร้าง `getDisplayName()` helper
- ✅ Extract `setUserSession()` ลด code duplication
- ✅ ลบ dead code (closeModal Escape handler)
- ✅ แก้ typo `ปรุับปรุง` → `ปรับปรุง`
- ✅ ย้าย `<style>` block จาก home.js ไปไว้ใน style.css
- ✅ ย้าย inline styles เป็น CSS classes (home.js, employee.js, index.html)
