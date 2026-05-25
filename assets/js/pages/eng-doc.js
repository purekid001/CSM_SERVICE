/**
 * Engineer — Document (คลังเอกสารมาตรฐานวิศวกรรม)
 */
import { createDocumentPage } from './doc-links.js';

const page = createDocumentPage({
  prefix: 'eng',
  path: 'CHOICE/EN',
  title: 'Engineering Documents',
  subtitle: 'คลังลิงก์เอกสารมาตรฐานวิศวกรรมจาก Firebase: CHOICE/EN',
  heroEyebrow: 'Engineering Library',
  heroTitle: 'Engineering Documents',
  heroSubtitle: 'รวมลิงก์เอกสารมาตรฐานวิศวกรรม คู่มือ และไฟล์อ้างอิงสำหรับการทำงานประจำวันไว้ในมุมมองเดียว',
  heroMetaLabelOne: 'แหล่งข้อมูล',
  heroMetaValueOne: 'CHOICE / EN',
  heroMetaLabelTwo: 'รูปแบบการเข้าถึง',
  heroMetaValueTwo: 'ค้นหาและเปิดลิงก์ได้ทันที',
  noteTitle: 'คลังเอกสารวิศวกรรม',
  noteMessage: 'ใช้ช่องค้นหาเพื่อกรองชื่อเอกสาร รายละเอียด หรือ URL แล้วเปิดลิงก์ภายนอกได้โดยตรงจากรายการด้านล่าง',
  emptyMessage: 'ไม่พบลิงก์เอกสารใน Firebase CHOICE/EN',
  errorMessage: 'ไม่สามารถโหลดข้อมูลจาก Firebase CHOICE/EN ได้',
  icon: 'fa-folder-open',
  theme: 'green',
  totalLabel: 'ลิงก์ทั้งหมด',
  visibleLabel: 'รายงานที่แสดง',
  searchLabel: 'ค้นหาลิงก์',
  searchPlaceholder: 'ค้นหาชื่อลิงก์ รายละเอียด หรือ URL',
  loadingMessage: 'กำลังโหลดลิงก์...',
  noSearchResultsMessage: 'ไม่พบลิงก์ตามเงื่อนไขที่ค้นหา',
});

export const render = page.render;
export const init = page.init;
