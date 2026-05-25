# CSM SERVICE Work Log

อัปเดตล่าสุด: 2026-05-22

ไฟล์นี้ใช้เป็นบันทึกงานต่อเนื่องของโปรเจค

- บันทึกทุกครั้งที่มีการแก้โค้ด, review, hardening, cleanup repo, หรือเปลี่ยน flow สำคัญ
- เขียนสั้น กระชับ แต่ต้องพอให้รอบถัดไปย้อนตามงานได้
- ถ้ามีไฟล์ review แยกใน `reports/` ให้ใส่สรุปและลิงก์อ้างอิงไว้ที่นี่ด้วย

## 2026-05-22

### Project Review และเอกสารเริ่มต้น

- รีวิวโค้ดทั้งโปรเจคและสรุป findings หลักด้าน auth, route access, XSS, และ repository hygiene
- สร้างเอกสาร [PROJECT_WORKFLOW.md](/C:/Users/chanakorn.c/Desktop/www/docs/PROJECT_WORKFLOW.md:1)
- สร้างรายงานรีวิว [code_review_2026-05-22.md](/C:/Users/chanakorn.c/Desktop/www/reports/code_review_2026-05-22.md:1)
- เพิ่ม `.gitignore`

### Route Guard และ Permission Layer

- เพิ่ม permission helper กลางใน `assets/js/utils.js`
- เพิ่ม client-side route guard ใน `assets/js/router.js`
- ผูก UI หลักให้ใช้ guard เดียวกันใน `auth.js`, `home.js`, `hr-booking-list.js`, `hr-shuttle-group.js`
- เป้าหมาย: กันการเปิด route restricted ผ่าน hash หรือ `showPage()` ตรง ๆ

### XSS Hardening รอบแรก

- เพิ่ม `escapeHTML`, `escapeAttr`, `sanitizeUrl` ใน `assets/js/utils.js`
- ปิดจุดเสี่ยงหลักใน `eng-report.js`
- ปิดจุดเสี่ยงหลักใน `reports/eng/reporteng01.html`
- ปิดจุดเสี่ยงหลักใน `reports/hr/reporthr02.html`
- harden modal/toast กลางใน `assets/js/ui.js`

### XSS Hardening รอบสอง

- harden ตารางและ modal ใน `eng-list.js`
- harden ตารางและ modal ใน `hr-booking-list.js`
- harden ตารางกลุ่มและ modal ใน `hr-shuttle-group.js`
- harden form render ใน `eng-request.js`, `hr-car.js`, `hr-shuttle.js`
- เปลี่ยน preview รูปใน `eng-request.js` เป็น DOM API แทน `innerHTML`
- harden `hr-report.js` สำหรับ table/timeline จากข้อมูล DB
- sanitize ชื่อไฟล์อัปโหลดใน `eng-request.js`

### Repository Cleanup

- เพิ่ม `.env.example`
- เอา `.env`, `.vs`, `dist`, `node_modules` ออกจากการ track ใน git index แล้ว
- ไฟล์จริงยังอยู่ในเครื่อง แต่ไม่ควรถูก commit ต่อในรอบถัดไป

### Review เฉพาะ `hr-booking-list.js`

- พบ regression เรื่องตัวแปร `remark` / `detail_remark`
- พบ local state ของคนขับและหมายเหตุไม่ sync หลัง approve/edit/cancel
- พบปุ่ม `จัดกลุ่มขนส่งพนักงาน` ใช้ permission logic คนละชุดกับ route guard
- พบ stored XSS ในตารางรายการจากการ render ค่า DB ลง `innerHTML`

### Fix เฉพาะ `hr-booking-list.js`

- แก้ bug ตัวแปร `detail_remark` ใน approve step 2/3 และ cancel flow
- sync `driverName`, `driverName1`, `driverName2`, `detail_remark` กลับเข้า local state
- ใช้ `canAccessPage('hr-shuttle-group')` กับปุ่มทางเข้า shuttle group
- escape ค่า DB ก่อน render ตารางรายการ

## Template

```md
## YYYY-MM-DD

### หัวข้องาน

- เปลี่ยนอะไร
- กระทบไฟล์ไหน
- ต้องตามต่ออะไร
```
