# CSM SERVICE Project Workflow

อัปเดตล่าสุด: 2026-05-22

## 1. ภาพรวมโปรเจค

โปรเจคนี้เป็น Single Page Application สำหรับงานภายใน CSM SERVICE โดยรวม 2 กลุ่มงานหลักไว้ในหน้าเดียว

- Engineering: แจ้งซ่อม, ติดตามงานซ่อม, รายงาน, เอกสาร
- HR: จองรถ, รถรับ-ส่ง, ติดตามงาน, จัดกลุ่ม shuttle, เอกสาร

เทคโนโลยีหลัก

- Frontend: Vanilla JavaScript แบบ ES Modules
- Build tool: Vite
- Data source: Firebase Realtime Database 2 โปรเจค
- File storage: Firebase Storage เฉพาะฝั่ง Engineering
- UI library จาก CDN: Flatpickr, Chart.js, SheetJS, Font Awesome

## 2. วิธีรันโปรเจค

ต้องมีไฟล์ `.env` สำหรับ Firebase ก่อนรัน

คำสั่งหลัก

```bash
npm install
npm run dev
```

คำสั่ง build

```bash
npm run build
```

หมายเหตุ

- โปรเจคนี้ใช้ `vite.config.js` ตั้ง `base: './'` เพื่อให้ deploy/เปิดไฟล์แบบ relative path ได้ง่าย
- ตอนนี้ repo มีทั้ง `dist/` และ `node_modules/` ถูก track อยู่แล้ว แต่ `.gitignore` ถูกเพิ่มไว้เพื่อกันไฟล์ใหม่ในรอบถัดไป

## 3. โครงสร้างไฟล์ที่ควรรู้

```text
index.html                  หน้า shell หลักของระบบ
assets/css/style.css        style กลางทั้งหมด
assets/js/main.js           entry point
assets/js/auth.js           login / auto-login / logout / session UI
assets/js/router.js         SPA page switching
assets/js/ui.js             modal / toast / dropdown / UI helpers
assets/js/utils.js          badge, date, pagination helpers
assets/js/firebase.js       Firebase ฝั่ง Engineering + Storage
assets/js/firebase-hr.js    Firebase ฝั่ง HR
assets/js/pages/            page modules ทั้งหมด
reports/eng/*.html          หน้า print/report ฝั่ง Engineering
reports/hr/*.html           หน้า print/report ฝั่ง HR
docs/PROJECT_WORKFLOW.md    คู่มือโปรเจคไฟล์นี้
```

## 4. ลำดับการทำงานของระบบ

### 4.1 Startup flow

1. `index.html` โหลด shell และ asset กลาง
2. `assets/js/main.js` import โมดูลหลักทั้งหมด
3. `auth.js` ฟัง `DOMContentLoaded`
4. ถ้ามี `rememberedUser` + `autoLogin` จะอ่าน `DHR/User/{empId}` จาก Firebase
5. ถ้า login ผ่าน `toggleView(true)` จะเปิด dashboard และเรียก `showPage(getPageFromHash())`
6. `router.js` จะ render HTML ของ page module ลง `#app-container`

### 4.2 Routing

หน้าแต่ละหน้าอยู่ใน `assets/js/pages/*.js`

route หลักที่ใช้งานจริง

- `home`
- `employee`
- `eng-request`
- `eng-list`
- `eng-doc`
- `eng-report`
- `hr-car`
- `hr-shuttle`
- `hr-list`
- `hr-doc`
- `hr-report`
- `hr-shuttle-group`
- `admin-backup`

ข้อควรจำ

- ระบบปัจจุบันใช้ `window.showPage()` + `location.hash`
- การซ่อนเมนูยังไม่ใช่ route guard จริง

## 5. หน้าที่ของโมดูลสำคัญ

### `assets/js/auth.js`

- login แบบอ่านข้อมูล user จาก Realtime Database
- เขียนข้อมูลผู้ใช้ลง `sessionStorage`
- จัดการ remember login ด้วย `localStorage`
- กำหนดการมองเห็นบางเมนูจาก level

### `assets/js/router.js`

- map route name ไปยัง page module
- render HTML ด้วย `page.render()`
- ถ้ามี `page.init()` จะถูกเรียกหลัง render

### `assets/js/ui.js`

- modal confirm
- modal alert
- toast notification
- toggle dropdown
- toggle พื้นหลังคลื่น

### `assets/js/utils.js`

- step badge ของ Engineering/HR
- parse/format วันที่
- pagination helper

## 6. แหล่งข้อมูล Firebase ที่ใช้บ่อย

ฝั่ง Engineering

- `DHR/User` ข้อมูลผู้ใช้/ผู้อนุมัติ
- `DEN/FIX/{year}` ใบแจ้งซ่อม
- `DEN/Machine` master พื้นที่/เครื่องจักร

ฝั่ง HR

- `DHR/User` ข้อมูลผู้อนุมัติฝั่ง HR
- `Booking/Booking1/{year}` จองรถ
- `Booking/Booking2/{year}` shuttle
- `Booking/Type` ประเภทการจอง
- `Booking/Location/Location1` สถานที่รับ
- `Booking/Location/Location2` สถานที่ส่ง

เอกสาร

- `CHOICE/EN`
- `CHOICE/HR`

## 7. วิธีแก้ไขงานแบบปลอดภัย

Checklist ก่อนแก้

1. เช็กก่อนว่า logic อยู่ใน page module ไหน
2. ถ้าเป็นข้อมูลจาก Firebase ให้ดู path ที่อ่าน/เขียนจริง
3. ถ้า render ด้วย `innerHTML` ให้ระวัง XSS ทันที
4. ถ้าแก้สิทธิ์การเข้าถึง อย่าแก้แค่การซ่อนเมนู ต้องดู route และ write rule ด้วย
5. ถ้าแตะ `reports/*.html` ให้ทดสอบทั้งเปิดหน้าและ print preview

แนวทางเวลาเพิ่มหน้าใหม่

1. สร้างไฟล์ใน `assets/js/pages/`
2. export `render()` และ `init()` ตามรูปแบบเดิม
3. import เข้า `assets/js/router.js`
4. เพิ่มปุ่มเมนูใน `index.html`
5. เพิ่ม style ใน `assets/css/style.css`

## 8. Known Risks / Technical Debt

รายการนี้คือสิ่งที่ควรใช้เป็น backlog รอบถัดไป

### P0

- auth ตรวจ password บน client จากข้อมูลใน Realtime Database
- สิทธิ์การเข้าถึงอิง `sessionStorage` และการซ่อนเมนูเป็นหลัก

### P1

- หลายหน้ารวมถึงหน้า print ใช้ `innerHTML` กับข้อมูลจากฐานข้อมูลโดยตรง
- repo มี `.env`, `node_modules/`, `dist/` ถูก track มาแล้ว

### P2

- หลายจุดอ่าน `DHR/User` ทั้งก้อนเพื่อเอาแค่ approver/department
- มี inline style และ page logic ขนาดใหญ่บางไฟล์ เช่น `eng-list.js`, `hr-booking-list.js`, `eng-report.js`

## 9. จุดเริ่มต้นถ้าจะทำต่อรอบหน้า

ลำดับที่แนะนำ

1. แก้ auth/authorization ก่อน
2. ทำ escaping helper กลางแล้วค่อยไล่แทนที่ `innerHTML` ที่รับข้อมูลจาก DB
3. cleanup git tracking ของ `.env`, `node_modules`, `dist`
4. ค่อยแยก page logic ขนาดใหญ่เป็น service/helper ย่อย

## 10. บันทึกย้อนหลัง

กติกาต่อจากนี้

- ทุกครั้งที่มีการรีวิว แก้บั๊ก harden security หรือ refactor ให้บันทึกลง `docs/WORK_LOG.md`
- ถ้าเป็นภาพรวมสถาปัตยกรรมหรือวิธีทำงานของโปรเจค ให้สรุปเพิ่มในไฟล์นี้
- ถ้าเป็น code review เต็มรอบ ให้แยกไฟล์ใน `reports/` ได้ตามเดิม แต่ให้มี bullet สรุปสั้นใน `docs/WORK_LOG.md` ด้วยเสมอ

### 2026-05-22

- รีวิว source หลักทั้งโปรเจค
- เพิ่ม `.gitignore`
- ปัก TODO ในจุดเสี่ยงหลักของ auth, router, report rendering
- สร้างคู่มือโปรเจคไฟล์นี้เพื่อใช้ onboarding และอ้างอิงย้อนหลัง

- เริ่มใช้ `docs/WORK_LOG.md` เป็นสมุดบันทึกงานต่อเนื่องของโปรเจค

### Template สำหรับบันทึกรอบถัดไป

```md
### YYYY-MM-DD
- เปลี่ยนอะไร
- กระทบไฟล์ไหน
- ต้องตามต่ออะไร
```
