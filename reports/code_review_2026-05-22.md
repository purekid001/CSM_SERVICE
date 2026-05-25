# Code Review — 2026-05-22

ขอบเขตการรีวิว

- `index.html`
- `assets/js/**`
- `assets/css/style.css`
- `reports/**/*.html`
- config หลักของโปรเจค

## Findings

### 1. Critical: ระบบ login ตรวจรหัสผ่านบน client โดยตรงจากฐานข้อมูล

ไฟล์อ้างอิง

- `assets/js/auth.js`

รายละเอียด

- หน้า login อ่าน `DHR/User/{username}` จาก client โดยตรงแล้วเทียบ `userData.password === password`
- ผู้ใช้ที่เข้าถึง node นี้ได้ย่อมเห็นข้อมูลผู้ใช้ทั้งหมดรวมถึง password field
- `sessionStorage` ถูกใช้เป็นตัวบอกสถานะ login/permission จึงไม่ใช่ authorization boundary ที่เชื่อถือได้

ผลกระทบ

- เสี่ยงข้อมูลบัญชีรั่วทั้งระบบ
- ผู้ใช้แก้ค่าใน browser storage เพื่อปลอมสิทธิ์ได้ง่าย

ข้อเสนอแนะ

- ย้ายไปใช้ Firebase Authentication หรือ backend/Cloud Function สำหรับ verify password
- ลดการอ่าน `DHR/User` ฝั่ง client ให้เหลือเท่าที่หน้า UI จำเป็นจริง

### 2. High: ไม่มี route guard จริง ทำให้หน้า restricted ถูกเปิดได้แม้เมนูจะถูกซ่อน

ไฟล์อ้างอิง

- `assets/js/auth.js`
- `assets/js/router.js`
- `assets/js/pages/backup.js`

รายละเอียด

- `applyMenuPermissions()` ซ่อนเมนูบางรายการเท่านั้น
- `window.showPage()` ใน router render route ทันทีโดยไม่ตรวจสิทธิ์
- หน้า `admin-backup` ยังสามารถถูกเปิดได้จาก hash หรือ console แม้ไม่ได้กดจากเมนู

ผลกระทบ

- ผู้ใช้ที่รู้ชื่อ route สามารถเปิดหน้าที่ไม่ควรเห็นได้
- แม้ปุ่ม action ใน `backup.js` จะ disable ไว้ แต่โมเดลสิทธิ์ทั้งระบบยังอาศัย UI concealment มากเกินไป

ข้อเสนอแนะ

- เพิ่ม guard ก่อน render ทุก route
- ผูก permission matrix กลางแทนการซ่อนทีละปุ่ม

### 3. High: มีช่อง Stored XSS หลายจุดจากการใช้ `innerHTML` กับข้อมูลในฐานข้อมูล

ไฟล์อ้างอิง

- `assets/js/pages/eng-report.js`
- `reports/eng/reporteng01.html`
- `reports/hr/reporthr02.html`

รายละเอียด

- ตาราง report type 4 และ timeline ของ `eng-report.js` interpolate ค่าจาก Firebase ลง HTML ตรง ๆ
- หน้า print ของ Engineering และ HR ใช้ `innerHTML` เติมข้อมูล record หลาย field โดยไม่ escape
- ถ้ามีข้อมูลที่มี HTML/script ถูกบันทึกลง DB จะถูก execute ตอนเปิดหน้า/print report ได้

ผลกระทบ

- ข้อมูลในระบบสามารถกลายเป็น payload โจมตีผู้ใช้คนอื่นได้
- หน้า print/report มักถูกเปิดโดยผู้มีสิทธิ์สูง จึงยิ่งเสี่ยง

ข้อเสนอแนะ

- เพิ่ม helper กลางสำหรับ escape HTML
- field ทั่วไปให้ใช้ `textContent`
- ถ้าจำเป็นต้องรองรับ markup ให้ whitelist/sanitize ก่อนเสมอ

### 4. Medium: repo ยัง track ไฟล์ที่ไม่ควรอยู่ใน source control

ไฟล์อ้างอิง

- `.env`
- `node_modules/**`
- `dist/**`
- `.vs/**`

รายละเอียด

- ไม่มี `.gitignore` เดิม
- worktree ปัจจุบันมี dependency/build artifact/local IDE state ปะปนกับ source

ผลกระทบ

- review diff ยาก
- เสี่ยงเผลอ commit ความลับหรือไฟล์ generated เพิ่ม
- clone/pull หนักและ noisy เกินจำเป็น

ข้อเสนอแนะ

- ใช้ `.gitignore` ที่เพิ่มในรอบนี้
- ทำ cleanup รอบแยกด้วย `git rm --cached` สำหรับ path ที่ไม่ควรถูก track ต่อ
- ย้ายค่า config ไป `.env.example` แล้วเก็บของจริงไว้นอก repo

### 5. Medium: หลายหน้าดึง `DHR/User` ทั้งก้อนเพื่อใช้ข้อมูลย่อย ทำให้ surface area ของข้อมูลกว้างเกินจำเป็น

ไฟล์อ้างอิง

- `assets/js/pages/eng-request.js`
- `assets/js/pages/hr-car.js`
- `assets/js/pages/hr-shuttle.js`
- `assets/js/pages/eng-report.js`

รายละเอียด

- ใช้ข้อมูลทั้งหมดเพื่อหา approver หรือ department list
- ถ้า rules เปิดกว้าง ข้อมูลพนักงานทั้งชุดจะถูก client โหลดได้จากหลายหน้า

ผลกระทบ

- เพิ่มการเปิดเผยข้อมูลเกินความจำเป็น
- เพิ่ม payload ตอนโหลดหน้า

ข้อเสนอแนะ

- แยก node สำหรับ approver master / department master
- จำกัด read rule ให้แคบลงตาม use case

## สรุปสั้น

โปรเจคมีโครงสร้างหน้าและการแยก module ใช้งานได้จริงแล้ว แต่ debt หลักยังอยู่ที่ security model มากกว่า UI หรือ build tool

ถ้าจะเริ่มรอบถัดไป ให้เรียงงานดังนี้

1. แก้ auth + authorization
2. ปิด XSS surface จาก `innerHTML`
3. cleanup repository hygiene
