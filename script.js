/**
 * AI PINYIN LAB — script.js
 * ฟรอนต์เอนด์แบบ static host บน GitHub Pages
 * Apps Script ทำหน้าที่เป็น JSON API เท่านั้น (ไม่มีการเสิร์ฟ HTML จากฝั่งเซิร์ฟเวอร์อีกต่อไป)
 */

/* ============================================================
 * ตั้งค่า API
 * ============================================================
 * แก้ค่านี้เป็น URL ของเว็บแอป Apps Script ที่ deploy แล้ว (ลงท้ายด้วย /exec)
 * วิธีหา: Apps Script Editor → Deploy → Manage deployments → คัดลอก "Web app URL"
 */
var API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxIMAkjisB3GzQ2wy5uE3eP2s7cfCpBvw5j3c8uk75_8eDwkrkApJ-l95pOaNMNVCQ/exec';

/**
 * เรียก Apps Script API หนึ่งฟังก์ชัน
 * ใช้ GET เสมอ (ไม่ใช่ POST) เพื่อเลี่ยง 2 ปัญหาที่พบบ่อยกับ Apps Script ข้าม origin:
 *   1) CORS preflight ค้าง — GET แบบไม่มี custom header ถือเป็น "simple request" เสมอ ไม่ trigger preflight
 *   2) Apps Script เปลี่ยน POST เป็น GET ตอน redirect ข้าม origin ทำให้ body ของ POST หายไปกลางทาง
 * คืนค่าเป็น Promise ที่ resolve เป็น JSON เสมอ (ทั้งกรณี success:true และ success:false ของ business logic)
 * จะ reject (เข้า .catch) เฉพาะปัญหาระดับเครือข่าย/เซิร์ฟเวอร์เท่านั้น
 */
function callApi(action, payload) {
  var url = API_BASE_URL + '?action=' + encodeURIComponent(action) +
    '&payload=' + encodeURIComponent(JSON.stringify(payload || {}));
  return fetch(url).then(function (res) {
    if (!res.ok) throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ (HTTP ' + res.status + ')');
    return res.json();
  });
}
