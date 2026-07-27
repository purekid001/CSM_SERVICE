import { appendLabourGrievance } from '../services/google-sheets.js';

const translations = {
  th: {
    documentTitle: 'แบบฟอร์มแจ้งปัญหาด้านแรงงาน | CSM SERVICE',
    metaDescription: 'แบบฟอร์มแจ้งปัญหาด้านแรงงานของ CSM SERVICE',
    languageSwitcherLabel: 'เลือกภาษา',
    skipLink: 'ข้ามไปยังแบบฟอร์ม',
    brandContext: 'ช่องทางรับฟังข้อร้องเรียนด้านแรงงาน',
    publicChannel: 'ช่องทางสาธารณะ ไม่ต้องเข้าสู่ระบบ',
    formTitle: 'แบบฟอร์มแจ้งปัญหาด้านแรงงาน',
    formSubtitle: 'Labour Grievance Form',
    introDescription: 'โปรดแจ้งข้อมูลตามที่ทราบ เพื่อให้บริษัทตรวจสอบและดำเนินการอย่างเหมาะสม',
    fieldsMarked: 'ช่องที่มีเครื่องหมาย',
    requiredDescription: 'เป็นข้อมูลจำเป็น',
    privacyTitle: 'ความเป็นส่วนตัว:',
    privacyDescription: 'หากเลือกไม่เปิดเผยชื่อ ระบบจะไม่ส่งชื่อ แผนก หรือเบอร์โทรไปกับรายการนี้',
    errorSummaryTitle: 'กรุณาตรวจสอบข้อมูลที่จำเป็น',
    identityTitle: 'การเปิดเผยตัวตน',
    identityDescription: 'โปรดเลือกด้วยตนเองก่อนกรอกข้อมูลส่วนอื่น',
    identityQuestion: 'ต้องการเปิดเผยชื่อหรือไม่',
    required: 'จำเป็น',
    namedChoice: 'ต้องการเปิดเผยชื่อ',
    namedChoiceDescription: 'กรอกชื่อเพื่อให้บริษัทสามารถติดต่อกลับได้',
    anonymousChoice: 'ไม่เปิดเผยชื่อ',
    fullName: 'ชื่อ-นามสกุล',
    department: 'แผนก',
    ifAvailable: '(ถ้ามี)',
    phone: 'เบอร์โทร',
    issueTitle: 'ประเภทปัญหา',
    issueDescription: 'เลือกได้มากกว่าหนึ่งข้อ',
    issueWages: 'ค่าจ้าง',
    issueHours: 'ชั่วโมงการทำงาน',
    issueOvertime: 'OT',
    issueDiscrimination: 'การเลือกปฏิบัติ',
    issueHarassment: 'การล่วงละเมิด',
    issueSafety: 'ความปลอดภัยในการทำงาน',
    issueHygiene: 'สุขอนามัย',
    issueWelfare: 'สวัสดิการ',
    issueSupervisor: 'หัวหน้างาน',
    issueCoworker: 'เพื่อนร่วมงาน',
    issueChildLabour: 'แรงงานเด็ก',
    issueForcedLabour: 'แรงงานบังคับ',
    issueOther: 'อื่น ๆ',
    otherIssueLabel: 'โปรดระบุปัญหาอื่น ๆ',
    requiredWhenOther: 'จำเป็นเมื่อเลือกอื่น ๆ',
    incidentTitle: 'รายละเอียดเหตุการณ์',
    incidentDescription: 'กรอกเท่าที่ทราบ หากไม่แน่ใจสามารถเว้นช่องที่ไม่บังคับได้',
    incidentDate: 'วันที่เกิดเหตุ',
    dateFormatHelp: 'รูปแบบ วัน/เดือน/ปี เช่น 24/07/2026',
    clearDateButton: 'ล้างวันที่',
    openCalendarLabel: 'เปิดปฏิทินเพื่อเลือกวันที่',
    calendarLabel: 'ปฏิทินเลือกวันที่',
    previousMonthLabel: 'เดือนก่อนหน้า',
    nextMonthLabel: 'เดือนถัดไป',
    calendarWeekdays: ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'],
    calendarMonths: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
    ifKnown: '(ถ้าทราบ)',
    location: 'สถานที่',
    incidentDetails: 'รายละเอียดเหตุการณ์',
    incidentHelp: 'ระบุสิ่งที่เกิดขึ้น ลำดับเหตุการณ์ และข้อมูลสำคัญที่ช่วยในการตรวจสอบ',
    involvedPeople: 'บุคคลที่เกี่ยวข้อง',
    requestedAction: 'ต้องการให้บริษัทดำเนินการอย่างไร',
    confirmTitle: 'ยืนยันและส่งข้อมูล',
    confirmDescription: 'โปรดตรวจสอบข้อมูลก่อนส่ง',
    truthConfirmation: 'ข้าพเจ้ายืนยันว่าข้อมูลทั้งหมดเป็นความจริงตามที่ข้าพเจ้าทราบ',
    submitButton: 'ส่งข้อมูล',
    sendingButton: 'กำลังส่งข้อมูล...',
    sendingStatus: 'โปรดรอสักครู่ ระบบกำลังบันทึกข้อมูล',
    submitError: 'ยังไม่สามารถส่งข้อมูลได้ในขณะนี้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง',
    successEyebrow: 'ส่งข้อมูลเรียบร้อย',
    successTitle: 'บริษัทได้รับข้อมูลของคุณแล้ว',
    successDescription: 'ขอบคุณที่แจ้งข้อมูล บริษัทจะนำเรื่องเข้าสู่กระบวนการตรวจสอบที่เกี่ยวข้อง',
    newSubmissionButton: 'ส่งข้อมูลอีกครั้ง',
    validationIdentity: 'กรุณาเลือกว่าต้องการเปิดเผยชื่อหรือไม่',
    validationFullName: 'กรุณาระบุชื่อ-นามสกุล',
    validationIssueTypes: 'กรุณาเลือกประเภทปัญหาอย่างน้อยหนึ่งข้อ',
    validationOtherIssue: 'กรุณาระบุรายละเอียดของปัญหาอื่น ๆ',
    validationIncidentDateFormat: 'กรุณาระบุวันที่ในรูปแบบ dd/MM/yyyy และเป็นวันที่ที่ถูกต้อง',
    validationIncidentDate: 'วันที่เกิดเหตุต้องไม่เกินวันปัจจุบัน',
    validationIncidentDetails: 'กรุณาระบุรายละเอียดเหตุการณ์',
    validationRequestedAction: 'กรุณาระบุสิ่งที่ต้องการให้บริษัทดำเนินการ',
    validationTruth: 'กรุณายืนยันว่าข้อมูลเป็นความจริงตามที่ทราบ',
  },
  en: {
    documentTitle: 'Labour Grievance Form | CSM SERVICE',
    metaDescription: 'CSM SERVICE public labour grievance form',
    languageSwitcherLabel: 'Select language',
    skipLink: 'Skip to the form',
    brandContext: 'Labour grievance reporting channel',
    publicChannel: 'Public channel, no sign-in required',
    formTitle: 'Labour Grievance Form',
    formSubtitle: 'Public labour grievance channel',
    introDescription: 'Please provide the information you know so the company can investigate and take appropriate action.',
    fieldsMarked: 'Fields marked',
    requiredDescription: 'are required.',
    privacyTitle: 'Privacy:',
    privacyDescription: 'If you choose Anonymous, your name, department, and phone number will not be submitted with this report.',
    errorSummaryTitle: 'Please review the required information',
    identityTitle: 'Identity disclosure',
    identityDescription: 'Please make this choice before completing the rest of the form.',
    identityQuestion: 'Do you want to disclose your name?',
    required: 'Required',
    namedChoice: 'Disclose my name',
    namedChoiceDescription: 'Provide your name so the company can contact you.',
    anonymousChoice: 'Do not disclose my name',
    fullName: 'Full name',
    department: 'Department',
    ifAvailable: '(if available)',
    phone: 'Phone number',
    issueTitle: 'Type of issue',
    issueDescription: 'Select all that apply.',
    issueWages: 'Wages',
    issueHours: 'Working hours',
    issueOvertime: 'Overtime (OT)',
    issueDiscrimination: 'Discrimination',
    issueHarassment: 'Harassment',
    issueSafety: 'Workplace safety',
    issueHygiene: 'Hygiene',
    issueWelfare: 'Welfare',
    issueSupervisor: 'Supervisor',
    issueCoworker: 'Coworker',
    issueChildLabour: 'Child labour',
    issueForcedLabour: 'Forced labour',
    issueOther: 'Other',
    otherIssueLabel: 'Please specify the other issue',
    requiredWhenOther: 'Required when Other is selected',
    incidentTitle: 'Incident details',
    incidentDescription: 'Provide what you know. You may leave optional fields blank if you are unsure.',
    incidentDate: 'Date of incident',
    dateFormatHelp: 'Format: day/month/year, for example 24/07/2026',
    clearDateButton: 'Clear',
    openCalendarLabel: 'Open calendar to choose a date',
    calendarLabel: 'Date picker calendar',
    previousMonthLabel: 'Previous month',
    nextMonthLabel: 'Next month',
    calendarWeekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    calendarMonths: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    ifKnown: '(if known)',
    location: 'Location',
    incidentDetails: 'Incident details',
    incidentHelp: 'Describe what happened, the sequence of events, and any important information that may help the investigation.',
    involvedPeople: 'People involved',
    requestedAction: 'What would you like the company to do?',
    confirmTitle: 'Confirm and submit',
    confirmDescription: 'Please review the information before submitting.',
    truthConfirmation: 'I confirm that all information provided is true to the best of my knowledge.',
    submitButton: 'Submit',
    sendingButton: 'Submitting...',
    sendingStatus: 'Please wait while the information is being saved.',
    submitError: 'The form cannot be submitted right now. Please check your internet connection and try again.',
    successEyebrow: 'Submission complete',
    successTitle: 'The company has received your information',
    successDescription: 'Thank you for reporting this issue. The company will proceed with the relevant review process.',
    newSubmissionButton: 'Submit another report',
    validationIdentity: 'Please choose whether you want to disclose your name.',
    validationFullName: 'Please enter your full name.',
    validationIssueTypes: 'Please select at least one type of issue.',
    validationOtherIssue: 'Please describe the other issue.',
    validationIncidentDateFormat: 'Enter a valid date in dd/MM/yyyy format.',
    validationIncidentDate: 'The incident date cannot be later than today.',
    validationIncidentDetails: 'Please provide the incident details.',
    validationRequestedAction: 'Please describe what you would like the company to do.',
    validationTruth: 'Please confirm that the information is true to the best of your knowledge.',
  },
  my: {
    documentTitle: 'အလုပ်သမားရေးရာ တိုင်ကြားစာပုံစံ | CSM SERVICE',
    metaDescription: 'CSM SERVICE အလုပ်သမားရေးရာ တိုင်ကြားစာပုံစံ',
    languageSwitcherLabel: 'ဘာသာစကား ရွေးချယ်ရန်',
    skipLink: 'တိုင်ကြားစာပုံစံသို့ သွားရန်',
    brandContext: 'အလုပ်သမားရေးရာ တိုင်ကြားချက် လက်ခံရေးလမ်းကြောင်း',
    publicChannel: 'အများပြည်သူသုံး လမ်းကြောင်း၊ အကောင့်ဝင်ရန် မလိုပါ',
    formTitle: 'အလုပ်သမားရေးရာ တိုင်ကြားစာပုံစံ',
    formSubtitle: 'Labour Grievance Form',
    introDescription: 'ကုမ္ပဏီက စစ်ဆေးပြီး သင့်လျော်စွာ ဆောင်ရွက်နိုင်ရန် သင်သိရှိသမျှ အချက်အလက်များကို ဖော်ပြပါ။',
    fieldsMarked: 'ဤအမှတ်အသားပါသော အကွက်များ',
    requiredDescription: 'ကို မဖြစ်မနေ ဖြည့်ရမည်။',
    privacyTitle: 'ကိုယ်ရေးအချက်အလက် လုံခြုံရေး:',
    privacyDescription: 'အမည်မဖော်လိုပါ ကိုရွေးချယ်ပါက အမည်၊ ဌာနနှင့် ဖုန်းနံပါတ်တို့ကို ဤတိုင်ကြားချက်နှင့်အတူ ပေးပို့မည်မဟုတ်ပါ။',
    errorSummaryTitle: 'လိုအပ်သော အချက်အလက်များကို စစ်ဆေးပါ',
    identityTitle: 'ကိုယ်ရေးအချက်အလက် ဖော်ပြခြင်း',
    identityDescription: 'အခြားအချက်အလက်များ မဖြည့်မီ ကိုယ်တိုင်ရွေးချယ်ပါ။',
    identityQuestion: 'အမည်ဖော်ပြလိုပါသလား',
    required: 'မဖြစ်မနေ',
    namedChoice: 'အမည်ဖော်ပြလိုပါသည်',
    namedChoiceDescription: 'ကုမ္ပဏီက ပြန်လည်ဆက်သွယ်နိုင်ရန် အမည်ထည့်ပါ။',
    anonymousChoice: 'အမည်မဖော်လိုပါ',
    fullName: 'အမည်အပြည့်အစုံ',
    department: 'ဌာန',
    ifAvailable: '(ရှိပါက)',
    phone: 'ဖုန်းနံပါတ်',
    issueTitle: 'ပြဿနာအမျိုးအစား',
    issueDescription: 'တစ်ခုထက်ပို၍ ရွေးချယ်နိုင်သည်။',
    issueWages: 'လုပ်ခလစာ',
    issueHours: 'အလုပ်ချိန်',
    issueOvertime: 'အချိန်ပို (OT)',
    issueDiscrimination: 'ခွဲခြားဆက်ဆံမှု',
    issueHarassment: 'အနှောင့်အယှက်ပေးမှု',
    issueSafety: 'လုပ်ငန်းခွင် ဘေးကင်းရေး',
    issueHygiene: 'သန့်ရှင်းရေးနှင့် ကျန်းမာရေး',
    issueWelfare: 'ဝန်ထမ်းအကျိုးခံစားခွင့်',
    issueSupervisor: 'ကြီးကြပ်ရေးမှူး',
    issueCoworker: 'လုပ်ဖော်ကိုင်ဖက်',
    issueChildLabour: 'ကလေးလုပ်သား',
    issueForcedLabour: 'အဓမ္မလုပ်အား',
    issueOther: 'အခြား',
    otherIssueLabel: 'အခြားပြဿနာကို ဖော်ပြပါ',
    requiredWhenOther: 'အခြားကို ရွေးချယ်ပါက မဖြစ်မနေ ဖြည့်ရမည်',
    incidentTitle: 'ဖြစ်ရပ်အသေးစိတ်',
    incidentDescription: 'သိရှိသမျှ ဖြည့်ပါ။ မသေချာသော မဖြစ်မနေမဟုတ်သည့် အကွက်များကို ချန်ထားနိုင်ပါသည်။',
    incidentDate: 'ဖြစ်ပွားသည့်ရက်',
    dateFormatHelp: 'ရက်/လ/နှစ် ပုံစံ၊ ဥပမာ 24/07/2026',
    clearDateButton: 'ရက်စွဲရှင်းရန်',
    openCalendarLabel: 'ရက်စွဲရွေးရန် ပြက္ခဒိန်ဖွင့်ရန်',
    calendarLabel: 'ရက်စွဲရွေးရန် ပြက္ခဒိန်',
    previousMonthLabel: 'ယခင်လ',
    nextMonthLabel: 'နောက်လ',
    calendarWeekdays: ['တနင်္ဂနွေ', 'တနင်္လာ', 'အင်္ဂါ', 'ဗုဒ္ဓဟူး', 'ကြာသပတေး', 'သောကြာ', 'စနေ'],
    calendarMonths: ['ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်', 'ဇူလိုင်', 'ဩဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ'],
    ifKnown: '(သိရှိပါက)',
    location: 'နေရာ',
    incidentDetails: 'ဖြစ်ရပ်အသေးစိတ်',
    incidentHelp: 'ဖြစ်ပျက်ခဲ့သည်များ၊ အစီအစဉ်နှင့် စစ်ဆေးရာတွင် အထောက်အကူဖြစ်မည့် အရေးကြီးအချက်များကို ဖော်ပြပါ။',
    involvedPeople: 'ပါဝင်ပတ်သက်သူများ',
    requestedAction: 'ကုမ္ပဏီအား မည်သို့ဆောင်ရွက်စေလိုသနည်း',
    confirmTitle: 'အတည်ပြုပြီး ပေးပို့ရန်',
    confirmDescription: 'မပေးပို့မီ အချက်အလက်များကို စစ်ဆေးပါ။',
    truthConfirmation: 'ဖော်ပြထားသော အချက်အလက်အားလုံးသည် ကျွန်ုပ်သိရှိသမျှအရ မှန်ကန်ကြောင်း အတည်ပြုပါသည်။',
    submitButton: 'ပေးပို့ရန်',
    sendingButton: 'ပေးပို့နေပါသည်...',
    sendingStatus: 'ခဏစောင့်ပါ။ စနစ်က အချက်အလက်ကို သိမ်းဆည်းနေပါသည်။',
    submitError: 'လောလောဆယ် မပေးပို့နိုင်သေးပါ။ အင်တာနက်ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်မံကြိုးစားပါ။',
    successEyebrow: 'အောင်မြင်စွာ ပေးပို့ပြီးပါပြီ',
    successTitle: 'ကုမ္ပဏီက သင့်အချက်အလက်ကို လက်ခံရရှိပြီးပါပြီ',
    successDescription: 'အချက်အလက်ပေးပို့မှုအတွက် ကျေးဇူးတင်ပါသည်။ ကုမ္ပဏီက သက်ဆိုင်ရာ စစ်ဆေးမှုလုပ်ငန်းစဉ်သို့ တင်ပြဆောင်ရွက်မည်ဖြစ်သည်။',
    newSubmissionButton: 'နောက်ထပ်အချက်အလက် ပေးပို့ရန်',
    validationIdentity: 'အမည်ဖော်ပြမည် သို့မဟုတ် မဖော်ပြမည်ကို ရွေးချယ်ပါ။',
    validationFullName: 'အမည်အပြည့်အစုံကို ဖြည့်ပါ။',
    validationIssueTypes: 'ပြဿနာအမျိုးအစား အနည်းဆုံးတစ်ခုကို ရွေးချယ်ပါ။',
    validationOtherIssue: 'အခြားပြဿနာ အသေးစိတ်ကို ဖြည့်ပါ။',
    validationIncidentDateFormat: 'ရက်စွဲအမှန်ကို dd/MM/yyyy ပုံစံဖြင့် ဖြည့်ပါ။',
    validationIncidentDate: 'ဖြစ်ပွားသည့်ရက်သည် ယနေ့ထက် မကျော်ရပါ။',
    validationIncidentDetails: 'ဖြစ်ရပ်အသေးစိတ်ကို ဖြည့်ပါ။',
    validationRequestedAction: 'ကုမ္ပဏီအား မည်သို့ဆောင်ရွက်စေလိုသည်ကို ဖြည့်ပါ။',
    validationTruth: 'အချက်အလက်များ မှန်ကန်ကြောင်း အတည်ပြုပါ။',
  },
};

const form = document.getElementById('grievance-form');
const identityDetails = document.getElementById('identity-details');
const otherIssueCheckbox = document.getElementById('issue-other');
const otherIssueWrapper = document.getElementById('other-issue-wrapper');
const incidentDateInput = document.getElementById('incident-date');
const incidentCalendar = document.getElementById('incident-calendar');
const incidentCalendarTitle = document.getElementById('incident-calendar-title');
const incidentCalendarWeekdays = document.getElementById('incident-calendar-weekdays');
const incidentCalendarGrid = document.getElementById('incident-calendar-grid');
const previousMonthButton = document.getElementById('incident-calendar-prev');
const nextMonthButton = document.getElementById('incident-calendar-next');
const clearIncidentDateButton = document.getElementById('clear-incident-date');
const submitButton = document.getElementById('submit-button');
const submitButtonLabel = submitButton.querySelector('.submit-button__label');
const submitStatus = document.getElementById('submit-status');
const errorSummary = document.getElementById('form-error-summary');
const errorList = document.getElementById('form-error-list');
const successState = document.getElementById('success-state');
const newSubmissionButton = document.getElementById('new-submission-button');
const pageDescription = document.getElementById('page-description');
const languageButtons = Array.from(document.querySelectorAll('[data-language]'));

const validationTargets = {
  identityMode: {
    container: document.getElementById('identity-field-group'),
    focus: () => form.querySelector('input[name="identityMode"]'),
  },
  fullName: {
    container: document.getElementById('full-name'),
    focus: () => document.getElementById('full-name'),
  },
  issueTypes: {
    container: document.getElementById('issue-types-field-group'),
    focus: () => form.querySelector('input[name="issueTypes"]'),
  },
  otherIssue: {
    container: document.getElementById('other-issue'),
    focus: () => document.getElementById('other-issue'),
  },
  incidentDate: {
    container: document.getElementById('incident-date'),
    focus: () => document.getElementById('incident-date'),
  },
  incidentDetails: {
    container: document.getElementById('incident-details'),
    focus: () => document.getElementById('incident-details'),
  },
  requestedAction: {
    container: document.getElementById('requested-action'),
    focus: () => document.getElementById('requested-action'),
  },
  truthConfirmed: {
    container: document.getElementById('truth-field-group'),
    focus: () => document.getElementById('truth-confirmed'),
  },
};

let isSubmitting = false;
let currentLanguage = 'th';
let submitStatusKey = '';
let selectedIncidentDateIso = '';
let calendarViewDate = new Date(`${getBangkokDateParts()}T00:00:00Z`);

function translate(key) {
  return translations[currentLanguage]?.[key] ?? translations.th[key] ?? key;
}

function setSubmitStatus(key = '') {
  submitStatusKey = key;
  submitStatus.textContent = key ? translate(key) : '';
}

function applyLanguage(language) {
  currentLanguage = translations[language] ? language : 'th';
  document.documentElement.lang = currentLanguage;
  document.title = translate('documentTitle');
  pageDescription.setAttribute('content', translate('metaDescription'));

  document.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = translate(element.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
    element.setAttribute('aria-label', translate(element.dataset.i18nAriaLabel));
  });
  languageButtons.forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.language === currentLanguage));
  });

  submitButtonLabel.textContent = translate(isSubmitting ? 'sendingButton' : 'submitButton');
  if (submitStatusKey) {
    submitStatus.textContent = translate(submitStatusKey);
  }
  renderIncidentCalendar();
}

function getBangkokDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatIsoDateForDisplay(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

function getIsoDateParts(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function formatIsoDateParts(year, month, day) {
  return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
}

function getCalendarMonthName(monthIndex) {
  return translations[currentLanguage].calendarMonths[monthIndex];
}

function getCalendarDateLabel(iso) {
  const parts = getIsoDateParts(iso);
  if (!parts) return iso;
  const monthName = getCalendarMonthName(parts.month - 1);
  return currentLanguage === 'en'
    ? `${monthName} ${parts.day}, ${parts.year}`
    : `${parts.day} ${monthName} ${parts.year}`;
}

function renderIncidentCalendar() {
  if (!incidentCalendarTitle || !incidentCalendarGrid) return;

  const year = calendarViewDate.getUTCFullYear();
  const month = calendarViewDate.getUTCMonth();
  incidentCalendarTitle.textContent = `${getCalendarMonthName(month)} ${year}`;

  incidentCalendarWeekdays.replaceChildren(
    ...translations[currentLanguage].calendarWeekdays.map(day => {
      const weekday = document.createElement('span');
      weekday.setAttribute('role', 'columnheader');
      weekday.textContent = day;
      return weekday;
    }),
  );

  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const todayIso = getBangkokDateParts();
  const dayButtons = [];

  for (let index = 0; index < 42; index += 1) {
    const dayOffset = index - firstWeekday + 1;
    const date = new Date(Date.UTC(year, month, dayOffset));
    const dateIso = formatIsoDateParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    const isOutsideMonth = dayOffset < 1 || dayOffset > daysInMonth;
    const dayButton = document.createElement('button');
    dayButton.type = 'button';
    dayButton.className = 'calendar-day';
    dayButton.setAttribute('role', 'gridcell');
    dayButton.setAttribute('aria-label', getCalendarDateLabel(dateIso));
    dayButton.setAttribute('aria-selected', String(dateIso === selectedIncidentDateIso));
    dayButton.dataset.date = dateIso;
    dayButton.textContent = String(date.getUTCDate());

    if (isOutsideMonth) dayButton.classList.add('calendar-day--outside');
    if (dateIso === todayIso) dayButton.classList.add('calendar-day--today');
    if (dateIso > todayIso) dayButton.disabled = true;

    dayButtons.push(dayButton);
  }

  incidentCalendarGrid.replaceChildren(...dayButtons);
}

function setCalendarViewFromDate(iso = getBangkokDateParts()) {
  const parts = getIsoDateParts(iso) || getIsoDateParts(getBangkokDateParts());
  calendarViewDate = new Date(Date.UTC(parts.year, parts.month - 1, 1));
}

function closeIncidentCalendar({ focusInput = false } = {}) {
  incidentCalendar.hidden = true;
  incidentDateInput.setAttribute('aria-expanded', 'false');
  if (focusInput) incidentDateInput.focus();
}

function selectIncidentDate(iso) {
  const todayIso = getBangkokDateParts();
  if (!getIsoDateParts(iso) || iso > todayIso) return;
  selectedIncidentDateIso = iso;
  syncIncidentDate();
  closeIncidentCalendar({ focusInput: true });
}

function parseDisplayDate(value) {
  const match = String(value ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    parsedDate.getUTCFullYear() !== year
    || parsedDate.getUTCMonth() !== month - 1
    || parsedDate.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    display: `${match[1]}/${match[2]}/${match[3]}`,
    iso: `${match[3]}-${match[2]}-${match[1]}`,
  };
}

function getBangkokSubmittedAt(date = new Date()) {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: false,
  }).format(date);
}

function setFieldError(key, message) {
  const target = validationTargets[key];
  const errorElement = document.getElementById(`${key}-error`);
  if (!target || !errorElement) return;

  const errorId = errorElement.id;
  const focusElement = target.focus();
  target.container.classList.add('has-error');
  target.container.setAttribute('aria-invalid', 'true');
  [target.container, focusElement].filter(Boolean).forEach(element => {
    const describedBy = new Set((element.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    describedBy.add(errorId);
    element.setAttribute('aria-describedby', [...describedBy].join(' '));
  });
  errorElement.textContent = message;
  errorElement.hidden = false;
}

function clearFieldError(key) {
  const target = validationTargets[key];
  const errorElement = document.getElementById(`${key}-error`);
  if (!target || !errorElement) return;

  const focusElement = target.focus();
  target.container.classList.remove('has-error');
  target.container.removeAttribute('aria-invalid');
  [target.container, focusElement].filter(Boolean).forEach(element => {
    const describedBy = (element.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter(id => id && id !== errorElement.id);
    if (describedBy.length > 0) {
      element.setAttribute('aria-describedby', describedBy.join(' '));
    } else {
      element.removeAttribute('aria-describedby');
    }
  });
  errorElement.textContent = '';
  errorElement.hidden = true;
}

function clearValidation() {
  Object.keys(validationTargets).forEach(clearFieldError);
  errorList.replaceChildren();
  errorSummary.hidden = true;
}

function syncIdentityMode() {
  const selectedIdentity = form.querySelector('input[name="identityMode"]:checked')?.value || '';
  const isNamed = selectedIdentity === 'named';
  identityDetails.hidden = !isNamed;

  form.querySelectorAll('input[name="identityMode"]').forEach(input => {
    input.setAttribute('aria-expanded', String(isNamed));
  });

  if (!isNamed) {
    document.getElementById('full-name').value = '';
    document.getElementById('department').value = '';
    document.getElementById('phone').value = '';
    clearFieldError('fullName');
  }
}

function syncOtherIssue() {
  otherIssueWrapper.hidden = !otherIssueCheckbox.checked;
  if (!otherIssueCheckbox.checked) {
    document.getElementById('other-issue').value = '';
    clearFieldError('otherIssue');
  }
}

function syncIncidentDate() {
  incidentDateInput.value = formatIsoDateForDisplay(selectedIncidentDateIso);
  clearIncidentDateButton.hidden = !selectedIncidentDateIso;
  clearFieldError('incidentDate');
}

function openIncidentDatePicker() {
  if (!incidentCalendar.hidden) {
    closeIncidentCalendar();
    return;
  }

  setCalendarViewFromDate(selectedIncidentDateIso || getBangkokDateParts());
  renderIncidentCalendar();
  incidentCalendar.hidden = false;
  incidentDateInput.setAttribute('aria-expanded', 'true');
}

function collectValidationErrors() {
  const errors = [];
  const identityMode = form.querySelector('input[name="identityMode"]:checked')?.value || '';
  const issueTypes = Array.from(form.querySelectorAll('input[name="issueTypes"]:checked'));
  const fullName = document.getElementById('full-name').value.trim();
  const otherIssue = document.getElementById('other-issue').value.trim();
  const incidentDate = incidentDateInput.value;
  const incidentDetails = document.getElementById('incident-details').value.trim();
  const requestedAction = document.getElementById('requested-action').value.trim();
  const truthConfirmed = document.getElementById('truth-confirmed').checked;

  if (!identityMode) {
    errors.push({ key: 'identityMode', messageKey: 'validationIdentity' });
  }
  if (identityMode === 'named' && !fullName) {
    errors.push({ key: 'fullName', messageKey: 'validationFullName' });
  }
  if (issueTypes.length === 0) {
    errors.push({ key: 'issueTypes', messageKey: 'validationIssueTypes' });
  }
  if (otherIssueCheckbox.checked && !otherIssue) {
    errors.push({ key: 'otherIssue', messageKey: 'validationOtherIssue' });
  }
  const parsedIncidentDate = incidentDate ? parseDisplayDate(incidentDate) : null;
  if (incidentDate && !parsedIncidentDate) {
    errors.push({ key: 'incidentDate', messageKey: 'validationIncidentDateFormat' });
  } else if (parsedIncidentDate && parsedIncidentDate.iso > getBangkokDateParts()) {
    errors.push({ key: 'incidentDate', messageKey: 'validationIncidentDate' });
  }
  if (!incidentDetails) {
    errors.push({ key: 'incidentDetails', messageKey: 'validationIncidentDetails' });
  }
  if (!requestedAction) {
    errors.push({ key: 'requestedAction', messageKey: 'validationRequestedAction' });
  }
  if (!truthConfirmed) {
    errors.push({ key: 'truthConfirmed', messageKey: 'validationTruth' });
  }

  return errors;
}

function showValidationErrors(errors) {
  errors.forEach(error => {
    const message = translate(error.messageKey);
    setFieldError(error.key, message);
    const item = document.createElement('li');
    item.textContent = message;
    errorList.appendChild(item);
  });

  errorSummary.hidden = false;
  const firstTarget = validationTargets[errors[0]?.key];
  const firstInput = firstTarget?.focus();
  firstTarget?.container.scrollIntoView({ behavior: 'smooth', block: 'center' });
  firstInput?.focus({ preventScroll: true });
}

function buildRecord() {
  const identityMode = form.querySelector('input[name="identityMode"]:checked').value;
  const isAnonymous = identityMode === 'anonymous';

  return {
    submittedAt: getBangkokSubmittedAt(),
    identityMode,
    fullName: isAnonymous ? '' : document.getElementById('full-name').value.trim(),
    department: isAnonymous ? '' : document.getElementById('department').value.trim(),
    phone: isAnonymous ? '' : document.getElementById('phone').value.trim(),
    issueTypes: Array.from(form.querySelectorAll('input[name="issueTypes"]:checked')).map(input => input.value),
    otherIssue: otherIssueCheckbox.checked ? document.getElementById('other-issue').value.trim() : '',
    incidentDate: incidentDateInput.value,
    location: document.getElementById('location').value.trim(),
    incidentDetails: document.getElementById('incident-details').value.trim(),
    involvedPeople: document.getElementById('involved-people').value.trim(),
    requestedAction: document.getElementById('requested-action').value.trim(),
    truthConfirmed: document.getElementById('truth-confirmed').checked,
  };
}

function setSubmitting(isBusy) {
  isSubmitting = isBusy;
  submitButton.disabled = isBusy;
  submitButton.setAttribute('aria-busy', String(isBusy));
  submitButtonLabel.textContent = translate(isBusy ? 'sendingButton' : 'submitButton');
}

function resetFormView() {
  form.reset();
  clearValidation();
  syncIdentityMode();
  syncOtherIssue();
  selectedIncidentDateIso = '';
  setCalendarViewFromDate();
  closeIncidentCalendar();
  syncIncidentDate();
  setSubmitStatus();
  successState.hidden = true;
  form.hidden = false;
  document.getElementById('page-title').focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

incidentDateInput.addEventListener('click', openIncidentDatePicker);
incidentDateInput.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
    event.preventDefault();
    openIncidentDatePicker();
  }
  if (event.key === 'Escape' && !incidentCalendar.hidden) {
    event.preventDefault();
    closeIncidentCalendar({ focusInput: true });
  }
});

previousMonthButton.addEventListener('click', () => {
  calendarViewDate = new Date(Date.UTC(calendarViewDate.getUTCFullYear(), calendarViewDate.getUTCMonth() - 1, 1));
  renderIncidentCalendar();
  previousMonthButton.focus();
});

nextMonthButton.addEventListener('click', () => {
  calendarViewDate = new Date(Date.UTC(calendarViewDate.getUTCFullYear(), calendarViewDate.getUTCMonth() + 1, 1));
  renderIncidentCalendar();
  nextMonthButton.focus();
});

incidentCalendarGrid.addEventListener('click', event => {
  const dayButton = event.target.closest('[data-date]');
  if (dayButton && !dayButton.disabled) selectIncidentDate(dayButton.dataset.date);
});

document.addEventListener('click', event => {
  if (!incidentCalendar.hidden && !event.target.closest('.date-picker-field')) closeIncidentCalendar();
});

clearIncidentDateButton.addEventListener('click', () => {
  selectedIncidentDateIso = '';
  setCalendarViewFromDate();
  closeIncidentCalendar();
  syncIncidentDate();
  incidentDateInput.focus();
});

form.querySelectorAll('input[name="identityMode"]').forEach(input => {
  input.addEventListener('change', () => {
    clearFieldError('identityMode');
    syncIdentityMode();
  });
});

form.querySelectorAll('input[name="issueTypes"]').forEach(input => {
  input.addEventListener('change', () => {
    clearFieldError('issueTypes');
    syncOtherIssue();
  });
});

form.querySelectorAll('[data-validation-key]').forEach(input => {
  input.addEventListener('input', () => clearFieldError(input.dataset.validationKey));
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (isSubmitting) return;

  clearValidation();
  setSubmitStatus();
  const errors = collectValidationErrors();

  if (errors.length > 0) {
    showValidationErrors(errors);
    return;
  }

  setSubmitting(true);
  setSubmitStatus('sendingStatus');

  try {
    await appendLabourGrievance(buildRecord());
    form.hidden = true;
    successState.hidden = false;
    successState.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch {
    setSubmitStatus('submitError');
  } finally {
    setSubmitting(false);
  }
});

languageButtons.forEach(button => {
  button.addEventListener('click', () => {
    if (button.dataset.language === currentLanguage) return;
    clearValidation();
    applyLanguage(button.dataset.language);
  });
});

newSubmissionButton.addEventListener('click', resetFormView);
applyLanguage('th');
syncIdentityMode();
syncOtherIssue();
syncIncidentDate();
