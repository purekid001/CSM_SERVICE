/**
 * HR — Document (เอกสาร HR)
 */
import { createDocumentPage } from './doc-links.js';

const page = createDocumentPage({
  prefix: 'hr',
  path: 'CHOICE/HR',
  title: 'HR Documents',
  subtitle: 'คลังลิงก์เอกสาร HR ระเบียบพนักงาน และแบบฟอร์มจาก Firebase: CHOICE/HR',
  heroEyebrow: 'HR Knowledge Base',
  heroTitle: 'HR Documents',
  heroSubtitle: 'รวมระเบียบพนักงาน แบบฟอร์ม และลิงก์เอกสารสำคัญของ HR เพื่อให้ค้นหาและเปิดใช้งานได้สะดวกขึ้นจากหน้าเดียว',
  heroMetaLabelOne: 'แหล่งข้อมูล',
  heroMetaValueOne: 'CHOICE / HR',
  heroMetaLabelTwo: 'รูปแบบการเข้าถึง',
  heroMetaValueTwo: 'ค้นหาและเปิดลิงก์ได้ทันที',
  noteTitle: 'คลังเอกสาร HR',
  noteMessage: 'เหมาะสำหรับค้นหาแบบฟอร์ม ระเบียบ หรือเอกสารใช้งานประจำ แล้วเปิดลิงก์ภายนอกต่อได้โดยตรงจากระบบ',
  emptyMessage: 'ไม่พบลิงก์เอกสารใน Firebase CHOICE/HR',
  errorMessage: 'ไม่สามารถโหลดข้อมูลจาก Firebase CHOICE/HR ได้',
  icon: 'fa-file-signature',
  theme: 'blue',
  totalLabel: 'ลิงก์ทั้งหมด',
  visibleLabel: 'รายงานที่แสดง',
  searchLabel: 'ค้นหาลิงก์',
  searchPlaceholder: 'ค้นหาชื่อลิงก์ รายละเอียด หรือ URL',
  loadingMessage: 'กำลังโหลดลิงก์...',
  noSearchResultsMessage: 'ไม่พบลิงก์ตามเงื่อนไขที่ค้นหา',
});

export const render = page.render;
export const init = page.init;
