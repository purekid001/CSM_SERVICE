# CSM SERVICE V3 - ไดอะแกรมการทำงาน

อัปเดต: 2026-07-03

ไฟล์นี้สรุปการทำงานของโปรเจคในรูปแบบ Mermaid diagram ภาษาไทย
อ้างอิงจากการตรวจสอบ source code ปัจจุบันของระบบ

## 1. สถาปัตยกรรมภาพรวม

```mermaid
flowchart LR
    user["ผู้ใช้งาน"] --> browser["เบราว์เซอร์ / SPA Shell"]
    browser --> indexShell["index.html"]
    indexShell --> mainEntry["assets/js/main.js"]

    mainEntry --> authLayer["auth.js"]
    mainEntry --> routerLayer["router.js"]
    mainEntry --> uiLayer["ui.js"]
    mainEntry --> utilLayer["utils.js"]

    authLayer --> sessionStore["sessionStorage / localStorage"]
    routerLayer --> pageModules["โมดูลหน้าใช้งาน"]

    pageModules --> engPages["หน้ากลุ่ม Engineering"]
    pageModules --> hrPages["หน้ากลุ่ม HR"]
    pageModules --> adminPages["หน้ากลุ่ม Admin"]
    pageModules --> accountPages["หน้ากลุ่มบัญชีผู้ใช้"]

    engPages --> firebaseEn["Firebase EN Realtime DB"]
    engPages --> storageEn["Firebase Storage"]

    hrPages --> firebaseHr["Firebase HR Realtime DB"]
    hrPages --> googleSheets["บริการ Google Sheets"]
    hrPages --> geminiApi["Gemini API"]

    accountPages --> firebaseEn
    accountPages --> firebaseHr
    accountPages --> googleSheets

    adminPages --> firebaseEn
    adminPages --> firebaseHr
    adminPages --> googleSheets

    authLayer --> weatherApi["Open-Meteo API"]

    engPages --> reports["หน้าเอกสารพิมพ์"]
    hrPages --> reports
```

## 2. การเริ่มระบบและการยืนยันตัวตน

```mermaid
flowchart TD
    appOpen["เปิดระบบ"] --> loadIndex["โหลด index.html"]
    loadIndex --> loadMain["โหลด main.js"]
    loadMain --> importCore["import Firebase, Router, Auth, UI"]
    importCore --> domReady["DOMContentLoaded"]

    domReady --> authMode["ตั้งโหมดเป็นหน้าเข้าสู่ระบบ"]
    domReady --> loadDepartments["โหลดรายชื่อแผนกจาก Google Sheets"]
    domReady --> loadWeather["โหลดธีมสภาพอากาศหน้า Login"]
    domReady --> checkRemember["ตรวจ rememberedUser และ autoLogin"]

    checkRemember --> hasRemember{"เปิด Auto Login ไว้หรือไม่"}
    hasRemember -- "ไม่ใช่" --> showLogin["แสดงหน้า Login"]
    hasRemember -- "ใช่" --> getUser["อ่าน DHR/User/{empId} จาก Firebase EN"]

    getUser --> userFound{"พบผู้ใช้และสถานะ active หรือไม่"}
    userFound -- "ไม่" --> clearRemember["ล้างข้อมูลการจำการเข้าสู่ระบบ"]
    clearRemember --> showLogin

    userFound -- "ใช่" --> setSession["เขียนข้อมูลลง SessionStorage"]
    setSession --> toggleDashboard["toggleView(true)"]
    toggleDashboard --> getHash["อ่าน route จาก location.hash"]
    getHash --> routeGuard["ตรวจ canAccessPage(route)"]
    routeGuard --> renderPage["render หน้าโมดูล"]

    showLogin --> submitLogin["submit ฟอร์ม Login"]
    submitLogin --> fetchLoginUser["อ่าน DHR/User/{username}"]
    fetchLoginUser --> validatePassword{"รหัสผ่านถูกต้องและ active หรือไม่"}
    validatePassword -- "ไม่" --> loginError["แสดงข้อความผิดพลาด"]
    validatePassword -- "ใช่" --> persistRemember["บันทึก remembered login ถ้าเลือกไว้"]
    persistRemember --> setSession
```

## 3. การทำงานของ Router และการ Render หน้า

```mermaid
flowchart TD
    menuAction["คลิกเมนูด้านข้าง หรือ showPage(route)"] --> router["router.js"]
    router --> routeExists{"มี route นี้หรือไม่"}
    routeExists -- "ไม่มี" --> fallbackHome["กลับไปหน้า home"]
    routeExists -- "มี" --> permissionCheck["ตรวจ canAccessPage(route)"]

    permissionCheck -- "ไม่ผ่าน" --> denyToast["แสดงข้อความสิทธิ์ไม่เพียงพอ"]
    denyToast --> fallbackHome

    permissionCheck -- "ผ่าน" --> setActive["ตั้งเมนู active"]
    setActive --> syncHash["sync location.hash"]
    syncHash --> callRender["เรียก page.render()"]
    callRender --> injectHtml["inject HTML ลง #app-container"]
    injectHtml --> initPage["เรียก page.init()"]
```

## 4. ขั้นตอนการแจ้งซ่อม Engineering

```mermaid
flowchart TD
    openEngRequest["เปิดหน้า eng-request"] --> loadMachine["โหลด DEN/Machine"]
    openEngRequest --> loadApprover["โหลด Approver จาก DHR/User ตามแผนก"]
    openEngRequest --> prepareUpload["เตรียมพื้นที่อัปโหลดรูป"]

    loadMachine --> chooseArea["เลือกพื้นที่"]
    chooseArea --> loadMachines["เติมรายการเครื่องจักรใน Dropdown"]

    prepareUpload --> chooseFiles["เลือกรูป หรือ ลากวางรูป"]
    chooseFiles --> previewFiles["แสดงตัวอย่างรูป"]

    loadApprover --> chooseApprover["เลือกผู้อนุมัติ"]
    loadMachines --> fillForm["กรอกฟอร์มแจ้งซ่อม"]
    chooseApprover --> fillForm
    previewFiles --> fillForm

    fillForm --> validateForm["ตรวจข้อมูลที่จำเป็น"]
    validateForm --> confirmed{"ยืนยันหรือไม่"}
    confirmed -- "ไม่" --> waitEdit["กลับไปแก้ไขข้อมูล"]
    confirmed -- "ใช่" --> buildRepairId["สร้าง Repair ID จากเวลา"]

    buildRepairId --> uploadImages["อัปโหลดรูปไป Firebase Storage"]
    uploadImages --> buildPayload["สร้าง Payload ของ DEN/FIX"]
    buildPayload --> saveRepair["บันทึกลง DEN/FIX/{year}/{id}"]
    saveRepair --> successAlert["แสดงข้อความสำเร็จ"]
    successAlert --> resetForm["รีเซ็ตฟอร์ม"]
```

## 5. สถานะงานซ่อม Engineering

```mermaid
stateDiagram-v2
    [*] --> step1
    step1: "ขั้นที่ 1 - รอหัวหน้าอนุมัติ"
    step2: "ขั้นที่ 2 - รอช่างอนุมัติ"
    step3: "ขั้นที่ 3 - กำลังดำเนินการ"
    step5: "ขั้นที่ 5 - รอผู้ใช้ประเมินงาน"
    step4: "ขั้นที่ 4 - เสร็จสิ้น"
    step6: "ขั้นที่ 6 - ยกเลิก"

    step1 --> step2: "หัวหน้าอนุมัติ"
    step1 --> step6: "ยกเลิก"
    step2 --> step3: "Admin EN เปิดใบงาน"
    step2 --> step6: "ยกเลิก"
    step3 --> step5: "ซ่อมเสร็จและส่งประเมิน"
    step3 --> step6: "ยกเลิก"
    step5 --> step4: "ผู้ใช้รับงานซ่อม"
    step5 --> step2: "ผู้ใช้ไม่รับงานและส่งกลับ"
```

## 6. ขั้นตอนการจองรถและรถรับส่ง HR

```mermaid
flowchart TD
    openHrForm["เปิดหน้า hr-car หรือ hr-shuttle"] --> loadType["โหลด Booking/Type"]
    openHrForm --> loadLocation["โหลดรายการสถานที่"]
    openHrForm --> loadHrApprover["โหลด Approver ฝั่ง HR ตามแผนก"]

    loadType --> fillBooking["กรอกฟอร์มจอง"]
    loadLocation --> fillBooking
    loadHrApprover --> fillBooking

    fillBooking --> otherLocation{"เลือกสถานที่อื่นหรือไม่"}
    otherLocation -- "ใช่" --> fillCustomLocation["กรอกสถานที่เองและเลือกจังหวัด"]
    otherLocation -- "ไม่" --> validateBooking["ตรวจฟอร์มจอง"]
    fillCustomLocation --> validateBooking

    validateBooking --> confirmedBooking{"ยืนยันหรือไม่"}
    confirmedBooking -- "ไม่" --> editBooking["กลับไปแก้ไข"]
    confirmedBooking -- "ใช่" --> buildBookingId["สร้างรหัส B1 หรือ B2"]

    buildBookingId --> buildBookingPayload["สร้าง Payload การจอง"]
    buildBookingPayload --> saveBooking["บันทึกลง Booking1 หรือ Booking2"]
    saveBooking --> bookingSuccess["แสดงข้อความสำเร็จ"]
```

## 7. สถานะงานจองรถ HR

```mermaid
stateDiagram-v2
    [*] --> step1
    step1: "ขั้นที่ 1 - รอหัวหน้าอนุมัติ"
    step2: "ขั้นที่ 2 - รอทีมจัดรถ"
    step3: "ขั้นที่ 3 - จัดรถแล้ว"
    step4: "ขั้นที่ 4 - ปิดงานแล้ว"
    step5: "ขั้นที่ 5 - ยกเลิก"

    step1 --> step2: "หัวหน้าอนุมัติ"
    step1 --> step5: "ยกเลิก"
    step2 --> step3: "ทีมจัดรถอนุมัติและกำหนดรถ"
    step2 --> step5: "ยกเลิก"
    step3 --> step4: "ทีมจัดรถปิดงาน"
    step3 --> step5: "ยกเลิก"
```

## 8. การจัดกลุ่ม Shuttle HR

```mermaid
flowchart TD
    openGroupPage["เปิดหน้า hr-shuttle-group"] --> permissionCheck["ตรวจสิทธิ์ hr-shuttle-group"]
    permissionCheck --> allowed{"มีสิทธิ์หรือไม่"}
    allowed -- "ไม่มี" --> denyGroup["แสดงสถานะถูกล็อก"]
    allowed -- "มี" --> loadGroupSources["โหลด Booking2, รถ, คนขับ, แผนก"]

    loadGroupSources --> filterShuttle["กรองรายการ Shuttle"]
    filterShuttle --> selectRows["เลือกหลายรายการ"]
    selectRows --> summarize["คำนวณจำนวนรายการและจำนวนคน"]
    summarize --> assignCar["เลือกรถและคนขับ"]
    assignCar --> approveGroup{"ยืนยันจัดกลุ่มหรือไม่"}

    approveGroup -- "ไม่" --> waitGroupAction["รอการดำเนินการถัดไป"]
    approveGroup -- "ใช่" --> createGroupId["สร้าง Group ID"]
    createGroupId --> updateSelected["อัปเดตรายการ Booking2 ที่เลือกเป็น Step 3"]
    updateSelected --> reloadGroupTables["โหลดตารางรายการและตารางกลุ่มใหม่"]

    reloadGroupTables --> openGroupModal["เปิด Modal รายละเอียดกลุ่ม"]
    openGroupModal --> groupDecision{"ปิดงานกลุ่ม หรือ ยกเลิกกลุ่ม"}
    groupDecision -- "ปิดงานกลุ่ม" --> closeGroup["อัปเดตทุกใบในกลุ่มเป็น Step 4"]
    groupDecision -- "ยกเลิกกลุ่ม" --> cancelGroup["คืนทุกใบกลับ Step 2 และล้างข้อมูลกลุ่ม"]
```

## 9. ขั้นตอนการประเมินผล HR

```mermaid
flowchart TD
    openEval["เปิดหน้า hr-evaluation"] --> loadRefs["โหลดข้อมูลอ้างอิงการประเมิน"]
    loadRefs --> refsReady["รหัสผู้ประเมิน, พนักงาน, หัวข้อ, น้ำหนัก, ผลประเมิน"]

    refsReady --> enterCode["กรอกรหัสเข้าประเมิน"]
    enterCode --> verifyCode["ตรวจรหัสกับชีตผู้ประเมิน"]
    verifyCode --> validCode{"รหัสตรงกับผู้ใช้ที่ Login หรือไม่"}
    validCode -- "ไม่" --> evalError["แสดงข้อผิดพลาด"]
    validCode -- "ใช่" --> buildAssignments["ค้นหาพนักงานที่ต้องประเมินตามตำแหน่งผู้ประเมิน"]

    buildAssignments --> selectEmployee["เลือกพนักงาน"]
    selectEmployee --> renderTopics["แสดงหัวข้อและน้ำหนัก"]
    renderTopics --> scoreTopics["ให้คะแนน 1 ถึง 5"]
    scoreTopics --> addComment["กรอกความคิดเห็นของผู้ประเมิน"]
    addComment --> computeScore["คำนวณคะแนนถ่วงน้ำหนัก"]

    computeScore --> geminiEnabled{"เปิดใช้ Gemini API หรือไม่"}
    geminiEnabled -- "ใช่" --> analyzeAi["ขอสรุปผลจาก Gemini"]
    geminiEnabled -- "ไม่" --> skipAi["ข้ามการวิเคราะห์ด้วย AI"]
    analyzeAi --> confirmEval["แสดงหน้าตรวจสอบก่อนบันทึก"]
    skipAi --> confirmEval

    confirmEval --> confirmedEval{"ยืนยันหรือไม่"}
    confirmedEval -- "ไม่" --> editEval["กลับไปแก้ไข"]
    confirmedEval -- "ใช่" --> upsertResult["บันทึกหรืออัปเดตผลลง Google Sheets"]
    upsertResult --> waitSync["รอการ Sync ผลลัพธ์"]
    waitSync --> reloadRefs["โหลดข้อมูลอ้างอิงใหม่"]
    reloadRefs --> evalDone["อัปเดตผลประเมินเรียบร้อย"]
```

## 10. ขั้นตอนเปลี่ยนเวรและเปลี่ยนกะ HR

```mermaid
flowchart TD
    openShift["เปิดหน้า hr-shift-swap หรือ hr-shift-change"] --> loadShiftEmployees["โหลดรายชื่อพนักงานจาก Google Sheets"]
    openShift --> loadShiftSettings["โหลดช่วงเวลาเปิดรับฟอร์ม"]
    openShift --> initSignature["เตรียม Canvas สำหรับลายเซ็น"]

    loadShiftEmployees --> pickEmployees["เลือกพนักงาน"]
    loadShiftSettings --> checkWindow["ตรวจว่าช่วงเวลาปัจจุบันอนุญาตหรือไม่"]
    initSignature --> fillShiftForm["กรอกฟอร์ม"]
    pickEmployees --> fillShiftForm
    checkWindow --> fillShiftForm

    fillShiftForm --> validateShift["ตรวจข้อมูลในฟอร์ม"]
    validateShift --> confirmedShift{"ยืนยันหรือไม่"}
    confirmedShift -- "ไม่" --> editShift["กลับไปแก้ไข"]
    confirmedShift -- "ใช่" --> createShiftPayload["สร้าง Payload สำหรับเปลี่ยนเวรหรือเปลี่ยนกะ"]
    createShiftPayload --> appendShift["บันทึกลง Google Sheets"]
    appendShift --> shiftSuccess["แสดงข้อความสำเร็จ"]
    shiftSuccess --> clearShiftForm["รีเซ็ตฟอร์มและล้างลายเซ็น"]
```

## 11. การ Sync สิทธิ์ผู้ใช้ของ Admin

```mermaid
flowchart TD
    adminOpen["เปิดหน้า admin-access"] --> loadUsers["โหลดผู้ใช้จาก Firebase EN, Firebase HR และ Google Sheets"]
    loadUsers --> mergeUsers["รวมข้อมูลตาม employeeId"]
    mergeUsers --> renderAdminTable["แสดงตารางสิทธิ์ผู้ใช้"]

    renderAdminTable --> editDraft["แก้ค่า EN, HR, IT และ Active"]
    editDraft --> saveDraft{"บันทึกการเปลี่ยนแปลงหรือไม่"}
    saveDraft -- "ไม่" --> keepDraft["คงค่า draft ไว้ใน UI"]
    saveDraft -- "ใช่" --> syncTargets["เรียก updateUserAccessProfile()"]

    syncTargets --> updateEn["อัปเดต Firebase EN"]
    syncTargets --> updateHr["อัปเดต Firebase HR"]
    syncTargets --> updateSheet["อัปเดต Google Sheet User Directory"]

    updateEn --> syncResult["อัปเดตครบทุกปลายทาง"]
    updateHr --> syncResult
    updateSheet --> syncResult

    syncResult --> refreshUi["รีเฟรชตารางและ Session UI"]
```

## 12. ขั้นตอนการเปิดเอกสารพิมพ์

```mermaid
flowchart TD
    openReport["เปิดหน้า Report ในแท็บใหม่"] --> readQuery["อ่านค่า id จาก URL Query"]

    readQuery --> reportType{"เป็น Report ประเภทใด"}
    reportType -- "Engineering" --> loadFix["โหลด DEN/FIX/{year}/{id}"]
    reportType -- "HR รายการเดี่ยว" --> loadBooking["โหลด Booking1 หรือ Booking2 ตาม Prefix"]
    reportType -- "HR แบบกลุ่ม" --> loadGroup["โหลด Booking2/{year} แล้วกรองตาม Group ID"]

    loadFix --> renderFix["แสดงหน้าเอกสารพิมพ์ Engineering"]
    loadBooking --> renderBooking["แสดงหน้าเอกสารพิมพ์ HR รายการเดี่ยว"]
    loadGroup --> renderGroup["แสดงหน้าเอกสารพิมพ์ HR แบบกลุ่ม"]

    renderFix --> autoPrint["window.print()"]
    renderBooking --> autoPrint
    renderGroup --> autoPrint
```

## 13. แผนผังแหล่งข้อมูลหลัก

```mermaid
flowchart LR
    app["แอป CSM SERVICE"] --> userData["DHR/User"]
    app --> machineData["DEN/Machine"]
    app --> fixData["DEN/FIX/{year}/{id}"]
    app --> bookingType["Booking/Type"]
    app --> bookingCar["Booking/Booking1/{year}/{id}"]
    app --> bookingShuttle["Booking/Booking2/{year}/{id}"]
    app --> bookingMaster["Booking/Car และ Booking/Driver"]
    app --> docEn["Document/EN"]
    app --> docHr["Document/HR"]
    app --> evalSheets["Google Sheets สำหรับ Evaluation"]
    app --> shiftSheets["Google Sheets สำหรับ Shift"]
    app --> repairImages["Firebase Storage รูปงานซ่อม"]
```

