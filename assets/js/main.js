/**
 * main.js — Entry Point
 * 
 * ไฟล์นี้ทำหน้าที่เป็นจุดเริ่มต้นหลักของแอปพลิเคชัน
 * โดย import โมดูลย่อยทั้งหมดมารวมไว้ที่นี่:
 * 
 *  - firebase.js  → ตั้งค่าและเชื่อมต่อ Firebase
 *  - auth.js      → ระบบ Login / Auto-login / Logout
 *  - router.js    → ระบบสลับหน้า (SPA Page Routing)
 *  - ui.js        → ฟังก์ชัน UI เช่น Dropdown Toggle
 */

import './firebase.js';
import './firebase-hr.js';
import './router.js';
import './auth.js';
import './ui.js';