# CSM SERVICE V3 - Flow Diagrams

อัปเดต: 2026-07-03

ไฟล์นี้สรุปการทำงานของโปรเจคในรูปแบบ Mermaid diagram
อ้างอิงจากการตรวจสอบ source code ปัจจุบันของระบบ

## 1. High-Level Architecture

```mermaid
flowchart LR
    user["User"] --> browser["Browser / SPA Shell"]
    browser --> indexShell["index.html"]
    indexShell --> mainEntry["assets/js/main.js"]

    mainEntry --> authLayer["auth.js"]
    mainEntry --> routerLayer["router.js"]
    mainEntry --> uiLayer["ui.js"]
    mainEntry --> utilLayer["utils.js"]

    authLayer --> sessionStore["sessionStorage / localStorage"]
    routerLayer --> pageModules["Page Modules"]

    pageModules --> engPages["Engineering Pages"]
    pageModules --> hrPages["HR Pages"]
    pageModules --> adminPages["Admin Pages"]
    pageModules --> accountPages["Account Pages"]

    engPages --> firebaseEn["Firebase EN Realtime DB"]
    engPages --> storageEn["Firebase Storage"]

    hrPages --> firebaseHr["Firebase HR Realtime DB"]
    hrPages --> googleSheets["Google Sheets Services"]
    hrPages --> geminiApi["Gemini API"]

    accountPages --> firebaseEn
    accountPages --> firebaseHr
    accountPages --> googleSheets

    adminPages --> firebaseEn
    adminPages --> firebaseHr
    adminPages --> googleSheets

    authLayer --> weatherApi["Open-Meteo API"]

    engPages --> reports["Printable Report Pages"]
    hrPages --> reports
```

## 2. Startup And Authentication Flow

```mermaid
flowchart TD
    appOpen["Open Application"] --> loadIndex["Load index.html"]
    loadIndex --> loadMain["Load main.js"]
    loadMain --> importCore["Import Firebase, Router, Auth, UI"]
    importCore --> domReady["DOMContentLoaded"]

    domReady --> authMode["Set Login Mode"]
    domReady --> loadDepartments["Load Register Departments From Google Sheets"]
    domReady --> loadWeather["Load Login Weather Theme"]
    domReady --> checkRemember["Check rememberedUser and autoLogin"]

    checkRemember --> hasRemember{"Auto Login Enabled?"}
    hasRemember -- "No" --> showLogin["Show Login Screen"]
    hasRemember -- "Yes" --> getUser["Read DHR/User/{empId} From Firebase EN"]

    getUser --> userFound{"User Exists And Active?"}
    userFound -- "No" --> clearRemember["Clear Saved Login"]
    clearRemember --> showLogin

    userFound -- "Yes" --> setSession["Write SessionStorage"]
    setSession --> toggleDashboard["toggleView(true)"]
    toggleDashboard --> getHash["Read Route From location.hash"]
    getHash --> routeGuard["Check canAccessPage(route)"]
    routeGuard --> renderPage["Render Page Module"]

    showLogin --> submitLogin["Submit Login Form"]
    submitLogin --> fetchLoginUser["Read DHR/User/{username}"]
    fetchLoginUser --> validatePassword{"Password Correct And Active?"}
    validatePassword -- "No" --> loginError["Show Error Message"]
    validatePassword -- "Yes" --> persistRemember["Persist Remember Login If Checked"]
    persistRemember --> setSession
```

## 3. Router And Page Rendering Flow

```mermaid
flowchart TD
    menuAction["Sidebar Click Or showPage(route)"] --> router["router.js"]
    router --> routeExists{"Route Exists?"}
    routeExists -- "No" --> fallbackHome["Fallback To home"]
    routeExists -- "Yes" --> permissionCheck["canAccessPage(route)"]

    permissionCheck -- "Denied" --> denyToast["Show Permission Toast"]
    denyToast --> fallbackHome

    permissionCheck -- "Allowed" --> setActive["Set Active Menu"]
    setActive --> syncHash["Sync location.hash"]
    syncHash --> callRender["Call page.render()"]
    callRender --> injectHtml["Inject HTML Into #app-container"]
    injectHtml --> initPage["Call page.init()"]
```

## 4. Engineering Repair Request Flow

```mermaid
flowchart TD
    openEngRequest["Open eng-request Page"] --> loadMachine["Load DEN/Machine"]
    openEngRequest --> loadApprover["Load DHR/User Approvers By Department"]
    openEngRequest --> prepareUpload["Prepare Image Upload Area"]

    loadMachine --> chooseArea["Choose Area"]
    chooseArea --> loadMachines["Populate Machine Dropdown"]

    prepareUpload --> chooseFiles["Select Or Drop Images"]
    chooseFiles --> previewFiles["Render Image Previews"]

    loadApprover --> chooseApprover["Choose Approver"]
    loadMachines --> fillForm["Fill Repair Form"]
    chooseApprover --> fillForm
    previewFiles --> fillForm

    fillForm --> validateForm["Validate Required Fields"]
    validateForm --> confirmed{"Confirmed?"}
    confirmed -- "No" --> waitEdit["Wait For User Edit"]
    confirmed -- "Yes" --> buildRepairId["Create Timestamp Repair ID"]

    buildRepairId --> uploadImages["Upload Images To Firebase Storage"]
    uploadImages --> buildPayload["Build DEN/FIX Payload"]
    buildPayload --> saveRepair["Save To DEN/FIX/{year}/{id}"]
    saveRepair --> successAlert["Show Success Alert"]
    successAlert --> resetForm["Reset Form"]
```

## 5. Engineering Repair State Flow

```mermaid
stateDiagram-v2
    [*] --> step1
    step1: "Step 1 - Wait Leader Approval"
    step2: "Step 2 - Wait Engineer Approval"
    step3: "Step 3 - In Progress"
    step5: "Step 5 - Wait User Evaluation"
    step4: "Step 4 - Completed"
    step6: "Step 6 - Cancelled"

    step1 --> step2: "Leader approves"
    step1 --> step6: "Cancel"
    step2 --> step3: "Admin EN opens work order"
    step2 --> step6: "Cancel"
    step3 --> step5: "Repair completed and sent for evaluation"
    step3 --> step6: "Cancel"
    step5 --> step4: "User accepts repair"
    step5 --> step2: "User rejects repair and sends back"
```

## 6. HR Booking And Shuttle Flow

```mermaid
flowchart TD
    openHrForm["Open hr-car Or hr-shuttle Page"] --> loadType["Load Booking/Type"]
    openHrForm --> loadLocation["Load Locations"]
    openHrForm --> loadHrApprover["Load HR Approvers By Department"]

    loadType --> fillBooking["Fill Booking Form"]
    loadLocation --> fillBooking
    loadHrApprover --> fillBooking

    fillBooking --> otherLocation{"Other Location Selected?"}
    otherLocation -- "Yes" --> fillCustomLocation["Fill Custom Place And Province"]
    otherLocation -- "No" --> validateBooking["Validate Booking Form"]
    fillCustomLocation --> validateBooking

    validateBooking --> confirmedBooking{"Confirmed?"}
    confirmedBooking -- "No" --> editBooking["Edit Form"]
    confirmedBooking -- "Yes" --> buildBookingId["Create B1 Or B2 ID"]

    buildBookingId --> buildBookingPayload["Build Booking Payload"]
    buildBookingPayload --> saveBooking["Save To Booking1 Or Booking2"]
    saveBooking --> bookingSuccess["Show Success Alert"]
```

## 7. HR Booking State Flow

```mermaid
stateDiagram-v2
    [*] --> step1
    step1: "Step 1 - Wait Leader Approval"
    step2: "Step 2 - Wait Dispatch Team"
    step3: "Step 3 - Car Assigned"
    step4: "Step 4 - Closed"
    step5: "Step 5 - Cancelled"

    step1 --> step2: "Leader approves"
    step1 --> step5: "Cancel"
    step2 --> step3: "Dispatch approves and assigns car"
    step2 --> step5: "Cancel"
    step3 --> step4: "Dispatch closes work"
    step3 --> step5: "Cancel"
```

## 8. HR Shuttle Grouping Flow

```mermaid
flowchart TD
    openGroupPage["Open hr-shuttle-group"] --> permissionCheck["Check hr-shuttle-group Permission"]
    permissionCheck --> allowed{"Allowed?"}
    allowed -- "No" --> denyGroup["Show Locked State"]
    allowed -- "Yes" --> loadGroupSources["Load Booking2, Cars, Drivers, Departments"]

    loadGroupSources --> filterShuttle["Filter Shuttle Records"]
    filterShuttle --> selectRows["Select Multiple Shuttle Rows"]
    selectRows --> summarize["Compute Selected Count And Headcount"]
    summarize --> assignCar["Choose Car And Drivers"]
    assignCar --> approveGroup{"Approve Group?"}

    approveGroup -- "No" --> waitGroupAction["Wait For Next Action"]
    approveGroup -- "Yes" --> createGroupId["Create Group ID"]
    createGroupId --> updateSelected["Update Each Booking2 Record To Step 3"]
    updateSelected --> reloadGroupTables["Reload Booking Table And Group Table"]

    reloadGroupTables --> openGroupModal["Open Group Detail Modal"]
    openGroupModal --> groupDecision{"Close Group Or Cancel Group?"}
    groupDecision -- "Close Group" --> closeGroup["Update Each Record To Step 4"]
    groupDecision -- "Cancel Group" --> cancelGroup["Return Each Record To Step 2 And Clear Group Data"]
```

## 9. HR Evaluation Flow

```mermaid
flowchart TD
    openEval["Open hr-evaluation"] --> loadRefs["Load Evaluation Reference Data"]
    loadRefs --> refsReady["Evaluator Codes, Employees, Topics, Weights, Results"]

    refsReady --> enterCode["Enter Evaluation Code"]
    enterCode --> verifyCode["Verify Code Against Evaluator Sheet"]
    verifyCode --> validCode{"Code Matches Logged In Employee?"}
    validCode -- "No" --> evalError["Show Error"]
    validCode -- "Yes" --> buildAssignments["Find Assigned Employees By Evaluator Title"]

    buildAssignments --> selectEmployee["Select Employee"]
    selectEmployee --> renderTopics["Render Topics And Weights"]
    renderTopics --> scoreTopics["Fill Scores 1 To 5"]
    scoreTopics --> addComment["Add Evaluator Comment"]
    addComment --> computeScore["Compute Weighted Score Preview"]

    computeScore --> geminiEnabled{"Gemini API Enabled?"}
    geminiEnabled -- "Yes" --> analyzeAi["Request Gemini Summary"]
    geminiEnabled -- "No" --> skipAi["Skip AI Analysis"]
    analyzeAi --> confirmEval["Show Confirm Preview"]
    skipAi --> confirmEval

    confirmEval --> confirmedEval{"Confirmed?"}
    confirmedEval -- "No" --> editEval["Edit Evaluation"]
    confirmedEval -- "Yes" --> upsertResult["Upsert Result To Google Sheets"]
    upsertResult --> waitSync["Wait For Result Sync"]
    waitSync --> reloadRefs["Reload Reference Data"]
    reloadRefs --> evalDone["Evaluation Updated"]
```

## 10. HR Shift Swap And Shift Change Flow

```mermaid
flowchart TD
    openShift["Open hr-shift-swap Or hr-shift-change"] --> loadShiftEmployees["Load Shift Employees From Google Sheets"]
    openShift --> loadShiftSettings["Load Form Window Settings"]
    openShift --> initSignature["Initialize Signature Canvas"]

    loadShiftEmployees --> pickEmployees["Pick Employees"]
    loadShiftSettings --> checkWindow["Validate Allowed Time Window"]
    initSignature --> fillShiftForm["Fill Shift Form"]
    pickEmployees --> fillShiftForm
    checkWindow --> fillShiftForm

    fillShiftForm --> validateShift["Validate Form Fields"]
    validateShift --> confirmedShift{"Confirmed?"}
    confirmedShift -- "No" --> editShift["Edit Form"]
    confirmedShift -- "Yes" --> createShiftPayload["Create Swap Or Change Payload"]
    createShiftPayload --> appendShift["Append Report To Google Sheets"]
    appendShift --> shiftSuccess["Show Success Alert"]
    shiftSuccess --> clearShiftForm["Reset Form And Clear Signature"]
```

## 11. Admin Account Sync Flow

```mermaid
flowchart TD
    adminOpen["Open admin-access"] --> loadUsers["Load Users From Firebase EN, Firebase HR, Google Sheets"]
    loadUsers --> mergeUsers["Merge By employeeId"]
    mergeUsers --> renderAdminTable["Render Permission Table"]

    renderAdminTable --> editDraft["Edit EN, HR, IT, Active Draft Values"]
    editDraft --> saveDraft{"Save Changes?"}
    saveDraft -- "No" --> keepDraft["Keep Draft In UI State"]
    saveDraft -- "Yes" --> syncTargets["updateUserAccessProfile()"]

    syncTargets --> updateEn["Update Firebase EN"]
    syncTargets --> updateHr["Update Firebase HR"]
    syncTargets --> updateSheet["Update Google Sheet User Directory"]

    updateEn --> syncResult["All Targets Updated"]
    updateHr --> syncResult
    updateSheet --> syncResult

    syncResult --> refreshUi["Refresh Table And Session UI"]
```

## 12. Printable Report Flow

```mermaid
flowchart TD
    openReport["Open Report Page In New Tab"] --> readQuery["Read id From URL Query"]

    readQuery --> reportType{"Report Type?"}
    reportType -- "Engineering" --> loadFix["Load DEN/FIX/{year}/{id}"]
    reportType -- "HR Single" --> loadBooking["Load Booking1 Or Booking2 By Prefix"]
    reportType -- "HR Group" --> loadGroup["Load Booking2/{year} And Filter By Group ID"]

    loadFix --> renderFix["Render Engineering Print Layout"]
    loadBooking --> renderBooking["Render HR Single Print Layout"]
    loadGroup --> renderGroup["Render HR Group Print Layout"]

    renderFix --> autoPrint["window.print()"]
    renderBooking --> autoPrint
    renderGroup --> autoPrint
```

## 13. Main Data Map

```mermaid
flowchart LR
    app["CSM SERVICE App"] --> userData["DHR/User"]
    app --> machineData["DEN/Machine"]
    app --> fixData["DEN/FIX/{year}/{id}"]
    app --> bookingType["Booking/Type"]
    app --> bookingCar["Booking/Booking1/{year}/{id}"]
    app --> bookingShuttle["Booking/Booking2/{year}/{id}"]
    app --> bookingMaster["Booking/Car And Booking/Driver"]
    app --> docEn["Document/EN"]
    app --> docHr["Document/HR"]
    app --> evalSheets["Evaluation Google Sheets"]
    app --> shiftSheets["Shift Google Sheets"]
    app --> repairImages["Firebase Storage Repair Images"]
```
