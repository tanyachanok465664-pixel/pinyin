/**
 * AI PINYIN LAB — script.js
 * ฟรอนต์เอนด์แบบ static host บน GitHub Pages
 * Apps Script ทำหน้าที่เป็น JSON API เท่านั้น (ไม่มีการเสิร์ฟ HTML จากฝั่งเซิร์ฟเวอร์)
 *
 * สถาปัตยกรรมการเรียก API มี 2 ทาง:
 *   - callApi()      : JSONP ผ่าน <script> tag (GET) — ใช้กับ payload เล็ก ๆ ทั่วไป
 *   - callApiPost()   : fetch() แบบ POST — ใช้เฉพาะตอนต้องส่งข้อมูลก้อนใหญ่ (เช่นไฟล์เสียง base64)
 *                       ที่ยัดเข้า URL querystring ของ JSONP ไม่ได้
 */

/* ============================================================
 * ตั้งค่า API
 * ============================================================
 * แก้ค่านี้เป็น URL ของเว็บแอป Apps Script ที่ deploy แล้ว (ลงท้ายด้วย /exec)
 * วิธีหา: Apps Script Editor → Deploy → Manage deployments → คัดลอก "Web app URL"
 */
var API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxIMAkjisB3GzQ2wy5uE3eP2s7cfCpBvw5j3c8uk75_8eDwkrkApJ-l95pOaNMNVCQ/exec';

/**
 * เรียก Apps Script API หนึ่งฟังก์ชัน — ใช้เทคนิค JSONP (โหลดผ่าน <script> tag)
 * ไม่ใช้ fetch() เพราะพบว่า Apps Script web app ตอบกลับ fetch() ข้าม origin ด้วยหน้า
 * error ของ Google เอง (HTTP 404) ระหว่าง redirect ภายในของระบบ ทั้งที่ URL เดียวกัน
 * เปิดตรง ๆ ในเบราว์เซอร์ใช้ได้ปกติ — การโหลดผ่าน <script> tag ไม่ติดปัญหานี้ เพราะ
 * ไม่ถูกจำกัดด้วย CORS แบบเดียวกับ fetch()/XHR
 *
 * ข้อจำกัด: ข้อมูลทั้งหมดถูกฝังไว้ใน URL querystring จึงใช้ได้แค่กับ payload ขนาดเล็ก
 * (ไฟล์เสียงหรือข้อมูลก้อนใหญ่ ห้ามส่งผ่านฟังก์ชันนี้ — ให้ใช้ callApiPost() แทน)
 *
 * คืนค่าเป็น Promise ที่ resolve เป็น JSON เสมอ (ทั้งกรณี success:true และ success:false ของ business logic)
 * จะ reject (เข้า .catch) เฉพาะปัญหาระดับเครือข่าย/หมดเวลาเท่านั้น
 */
var _jsonpCounter = 0;

function callApi(action, payload) {
  return new Promise(function (resolve, reject) {
    var callbackName = '_aiplCallback' + (_jsonpCounter++);
    var script = document.createElement('script');

    function cleanup() {
      clearTimeout(timeoutId);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    var timeoutId = setTimeout(function () {
      cleanup();
      reject(new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ (หมดเวลารอการตอบกลับ)'));
    }, 15000);

    window[callbackName] = function (result) {
      cleanup();
      resolve(result);
    };

    script.onerror = function () {
      cleanup();
      reject(new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ'));
    };

    var url = API_BASE_URL + '?action=' + encodeURIComponent(action) +
      '&payload=' + encodeURIComponent(JSON.stringify(payload || {})) +
      '&callback=' + callbackName;
    script.src = url;
    document.head.appendChild(script);
  });
}

/**
 * เรียก Apps Script API ผ่าน fetch() แบบ POST — ใช้เฉพาะตอน payload มีขนาดใหญ่
 * (เช่นไฟล์เสียง base64 จากการบันทึกเสียงนักเรียน) ที่ยัดเข้า URL ของ JSONP ไม่ได้
 *
 * จงใจตั้ง Content-Type เป็น "text/plain;charset=utf-8" (ไม่ใช่ application/json)
 * เพราะ "text/plain" ถือเป็น CORS "simple request" ตามสเปก — เบราว์เซอร์จะไม่ยิง
 * preflight (OPTIONS) ก่อน ซึ่ง Apps Script web app ไม่ได้ implement doOptions() ไว้
 * ถ้าใช้ Content-Type: application/json จะติด preflight แล้วถูกบล็อกทันทีโดยไม่ทันได้
 * ยิง POST จริงเลย ฝั่ง backend (Code.gs) ยัง JSON.parse(e.postData.contents) ได้ปกติ
 * ไม่ว่า Content-Type ที่ส่งมาจะระบุว่าอะไรก็ตาม
 *
 * คืนค่าเป็น Promise ที่ resolve เป็น JSON เสมอ (รูปแบบเดียวกับ callApi())
 * reject เฉพาะปัญหาระดับเครือข่าย/หมดเวลา/HTTP error เท่านั้น
 */
function callApiPost(action, payload, timeoutMs) {
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, timeoutMs || 30000);

  return fetch(API_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: action, payload: payload || {} }),
    signal: controller.signal
  })
    .then(function (res) {
      clearTimeout(timer);
      if (!res.ok) throw new Error('เซิร์ฟเวอร์ตอบกลับผิดพลาด (HTTP ' + res.status + ')');
      return res.json();
    })
    .catch(function (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ (หมดเวลารอการตอบกลับ)');
      }
      throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ: ' + err.message);
    });
}

var AppState = { token: null, user: null };

var MODULES = [
  { title: 'GPAS 5 Steps', active: true, action: "showView('gpas')" },
  { title: 'Phonetic Lab — ห้องเสียงสัทอักษร', active: true, action: 'openPhoneticLab()' },
  { title: 'Minimal Pair Lab' },
  { title: 'Pronunciation Practice' },
  { title: 'AI Coach' },
  { title: 'AI Diagnostic Test' },
  { title: 'แผนการเรียนรู้ส่วนบุคคล' },
  { title: 'Pretest' },
  { title: 'Posttest' },
  { title: 'พอร์ตโฟลิโอ' },
  { title: 'Pronunciation Passport' },
  { title: 'ภารกิจรายสัปดาห์' },
  { title: 'กระดานผู้นำ' }
];

window.addEventListener('load', function () {
  var token = sessionStorage.getItem('aipl_token');
  if (!token) { showView('login'); return; }
  callApi('validateSession', { token: token }).then(onSessionRestored).catch(onSessionLost);
});

function onSessionRestored(res) {
  if (!res.success) { onSessionLost(); return; }
  AppState.token = sessionStorage.getItem('aipl_token');
  AppState.user = res.user;
  routeToRoleHome();
}

function onSessionLost() {
  sessionStorage.removeItem('aipl_token');
  showView('login');
}

/**
 * สลับการแสดงผลระหว่าง view ต่าง ๆ (login/home/teacher/phonetic/gpas)
 * มีการเช็คว่า element มีอยู่จริงก่อนเสมอ — ถ้าไม่เจอ id ที่ระบุจะ log คำเตือนใน
 * console แทนการโยน error ออกมาทำให้สคริปต์ที่เหลือ "ค้าง" ทั้งหน้า (อาการเดิมที่พบ
 * คือถ้า id ใน index.html ไม่ตรงกับที่นี่ การเรียก .classList.add() บน null จะทำให้
 * โค้ดส่วนถัดไปไม่ได้รันต่อ และหน้าเว็บค้างว่างเปล่าโดยไม่มีคำอธิบาย)
 */
function showView(name) {
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  var target = document.getElementById('view-' + name);
  if (!target) {
    console.warn('showView: ไม่พบ element id="view-' + name + '" ใน index.html');
    return;
  }
  target.classList.add('active');
}

/* ---------------- Login / Register ---------------- */

var AuthState = { role: 'student', mode: 'login' };

function switchLoginRole(role) {
  AuthState.role = role;
  document.getElementById('tab-student').classList.toggle('active', role === 'student');
  document.getElementById('tab-teacher').classList.toggle('active', role === 'teacher');
  hideLoginError();
  updateAuthFormVisibility();
}

function toggleAuthMode() {
  AuthState.mode = AuthState.mode === 'login' ? 'register' : 'login';
  hideLoginError();
  updateAuthFormVisibility();
}

function updateAuthFormVisibility() {
  document.getElementById('form-student-login').style.display = (AuthState.role === 'student' && AuthState.mode === 'login') ? 'block' : 'none';
  document.getElementById('form-teacher-login').style.display = (AuthState.role === 'teacher' && AuthState.mode === 'login') ? 'block' : 'none';
  document.getElementById('form-student-register').style.display = (AuthState.role === 'student' && AuthState.mode === 'register') ? 'block' : 'none';
  document.getElementById('form-teacher-register').style.display = (AuthState.role === 'teacher' && AuthState.mode === 'register') ? 'block' : 'none';

  document.getElementById('auth-switch-text').textContent = AuthState.mode === 'login' ? 'ยังไม่มีบัญชี?' : 'มีบัญชีอยู่แล้ว?';
  document.getElementById('auth-switch-btn').textContent = AuthState.mode === 'login' ? 'สร้างบัญชีใหม่' : 'เข้าสู่ระบบ';
}

function showLoginError(message) {
  var el = document.getElementById('login-error');
  el.textContent = message;
  el.classList.add('show');
}

function hideLoginError() {
  document.getElementById('login-error').classList.remove('show');
}

function handleStudentLogin(e) {
  e.preventDefault();
  hideLoginError();
  var btn = document.getElementById('student-login-btn');
  btn.disabled = true; btn.textContent = 'กำลังเข้าสู่ระบบ...';
  var id = document.getElementById('student-id').value.trim();
  var pw = document.getElementById('student-password').value;
  callApi('loginStudent', { studentId: id, password: pw })
    .then(function (res) { onLoginResult(res, btn, 'เข้าสู่ระบบ'); })
    .catch(function (err) { onLoginFailure(err, btn, 'เข้าสู่ระบบ'); });
}

function handleTeacherLogin(e) {
  e.preventDefault();
  hideLoginError();
  var btn = document.getElementById('teacher-login-btn');
  btn.disabled = true; btn.textContent = 'กำลังเข้าสู่ระบบ...';
  var username = document.getElementById('teacher-username').value.trim();
  var pw = document.getElementById('teacher-password').value;
  callApi('loginTeacher', { username: username, password: pw })
    .then(function (res) { onLoginResult(res, btn, 'เข้าสู่ระบบ'); })
    .catch(function (err) { onLoginFailure(err, btn, 'เข้าสู่ระบบ'); });
}

function handleStudentRegister(e) {
  e.preventDefault();
  hideLoginError();
  var fullName = document.getElementById('reg-student-name').value.trim();
  var classRoom = document.getElementById('reg-student-class').value.trim();
  var username = document.getElementById('reg-student-username').value.trim();
  var pw = document.getElementById('reg-student-password').value;
  var pwConfirm = document.getElementById('reg-student-password-confirm').value;

  if (pw !== pwConfirm) { showLoginError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน'); return; }

  var btn = document.getElementById('student-register-btn');
  btn.disabled = true; btn.textContent = 'กำลังสร้างบัญชี...';
  callApi('registerStudent', { fullName: fullName, classRoom: classRoom, username: username, password: pw })
    .then(function (res) { onLoginResult(res, btn, 'สร้างบัญชี'); })
    .catch(function (err) { onLoginFailure(err, btn, 'สร้างบัญชี'); });
}

function handleTeacherRegister(e) {
  e.preventDefault();
  hideLoginError();
  var fullName = document.getElementById('reg-teacher-name').value.trim();
  var username = document.getElementById('reg-teacher-username').value.trim();
  var pw = document.getElementById('reg-teacher-password').value;
  var pwConfirm = document.getElementById('reg-teacher-password-confirm').value;

  if (pw !== pwConfirm) { showLoginError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน'); return; }

  var btn = document.getElementById('teacher-register-btn');
  btn.disabled = true; btn.textContent = 'กำลังสร้างบัญชี...';
  callApi('registerTeacher', { fullName: fullName, username: username, password: pw })
    .then(function (res) { onLoginResult(res, btn, 'สร้างบัญชี'); })
    .catch(function (err) { onLoginFailure(err, btn, 'สร้างบัญชี'); });
}

function onLoginResult(res, btn, label) {
  btn.disabled = false; btn.textContent = label;
  if (!res.success) { showLoginError(res.message); return; }
  sessionStorage.setItem('aipl_token', res.token);
  AppState.token = res.token;
  AppState.user = res.user;
  routeToRoleHome();
}

function onLoginFailure(err, btn, label) {
  btn.disabled = false; btn.textContent = label;
  showLoginError('เชื่อมต่อระบบไม่สำเร็จ: ' + err.message);
}

/**
 * พา user ไปหน้าที่ถูกต้องตามบทบาทหลัง login สำเร็จ
 * ทุกจุดที่อ่าน element ด้วย id จะเช็ค null ก่อนเซ็ตค่าเสมอ เพื่อไม่ให้ทั้งฟังก์ชัน
 * ค้างกลางทางถ้า index.html ขาด element ใดไปจุดหนึ่ง (จะ login สำเร็จและสลับหน้าได้
 * อยู่ดี แค่ช่องที่ขาด element จะไม่แสดงข้อความ พร้อม log คำเตือนให้ตรวจสอบทีหลัง)
 */
function routeToRoleHome() {
  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) { el.textContent = text; } else { console.warn('routeToRoleHome: ไม่พบ element id="' + id + '"'); }
  }

  if (AppState.user.role === 'teacher') {
    setText('teacher-name', AppState.user.name);
    showView('teacher');
    injectTeacherGradingTab();
    loadDashboardSummary();
    loadStudentList();
  } else {
    setText('home-student-name', AppState.user.name);
    setText('home-student-class', AppState.user.classRoom);
    renderModuleGrid();
    showView('home');
  }
}

function handleLogout() {
  if (AppState.token) callApi('logout', { token: AppState.token }).catch(function () {});
  sessionStorage.removeItem('aipl_token');
  AppState.token = null; AppState.user = null;
  document.getElementById('form-student-login').reset();
  document.getElementById('form-teacher-login').reset();
  document.getElementById('form-student-register').reset();
  document.getElementById('form-teacher-register').reset();
  AuthState.role = 'student'; AuthState.mode = 'login';
  switchLoginRole('student');
  updateAuthFormVisibility();
  showView('login');
}

/* ---------------- หน้า Home (นักเรียน) ---------------- */

function renderModuleGrid() {
  var grid = document.getElementById('module-grid');
  if (!grid) { console.warn('renderModuleGrid: ไม่พบ element id="module-grid"'); return; }
  grid.innerHTML = MODULES.map(function (m) {
    if (m.active) {
      return '<div class="module-card is-active" onclick="' + m.action + '">' +
        '<h3>' + m.title + '</h3>' +
        '<span class="pill pill-active">พร้อมใช้งาน</span>' +
        '</div>';
    }
    return '<div class="module-card is-locked" onclick="showToast(\'โมดูลนี้จะเปิดให้ใช้งานในเฟสถัดไป\')">' +
      '<h3>' + m.title + '</h3>' +
      '<span class="pill pill-locked">เร็ว ๆ นี้</span>' +
      '</div>';
  }).join('');
}

/* ---------------- Teacher Dashboard ---------------- */

function switchTeacherTab(name) {
  document.querySelectorAll('.tab-btn').forEach(function (b) {
    if (!b.classList.contains('is-locked')) b.classList.remove('active');
  });
  document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
  // Use event.currentTarget when called from DOM, or look up by data-tab when called programmatically
  var activeBtn = (typeof event !== 'undefined' && event && event.currentTarget)
    ? event.currentTarget
    : document.querySelector('.tab-btn[data-tab="' + name + '"]');
  if (activeBtn) activeBtn.classList.add('active');
  var panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
  if (name === 'students') loadStudentList();
  if (name === 'phonetic-items') loadPracticeItemsAdmin();
}

function showLockedNotice() {
  showToast('ฟีเจอร์นี้จะเปิดให้ใช้งานในเฟสถัดไป');
}

function loadDashboardSummary() {
  callApi('getDashboardSummary', { token: AppState.token }).then(function (res) {
    if (!res.success) { onApiError(res); return; }
    document.getElementById('stat-total').textContent = res.summary.totalStudents;
    document.getElementById('stat-active').textContent = res.summary.activeStudents;
    document.getElementById('stat-today').textContent = res.summary.loggedInToday;
  }).catch(onApiError);
}

function loadStudentList() {
  callApi('getStudentList', { token: AppState.token }).then(renderStudentTable).catch(onApiError);
}

function renderStudentTable(res) {
  if (!res.success) { onApiError(res); return; }
  var tbody = document.getElementById('student-table-body');
  var emptyState = document.getElementById('student-empty-state');
  if (res.students.length === 0) {
    tbody.innerHTML = ''; emptyState.style.display = 'block'; return;
  }
  emptyState.style.display = 'none';
  tbody.innerHTML = res.students.map(function (s) {
    var isActive = s.status !== 'Inactive';
    return '<tr>' +
      '<td>' + s.studentId + '</td>' +
      '<td>' + escapeHtml(s.fullName) + '</td>' +
      '<td>' + escapeHtml(s.classRoom) + '</td>' +
      '<td><span class="status-badge ' + (isActive ? 'status-active' : 'status-inactive') + '">' + (isActive ? 'ใช้งานได้' : 'ระงับแล้ว') + '</span></td>' +
      '<td>' + formatDateThai(s.lastLogin) + '</td>' +
      '<td class="row-actions">' +
        '<button class="btn btn-ghost" onclick="toggleStudentStatus(\'' + s.studentId + '\',\'' + s.status + '\')">' + (isActive ? 'ระงับ' : 'เปิดใช้') + '</button>' +
        '<button class="btn btn-ghost" onclick="resetPassword(\'' + s.studentId + '\')">รีเซ็ตรหัสผ่าน</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

function openAddStudentModal() {
  document.getElementById('form-add-student').reset();
  document.getElementById('modal-add-student').classList.add('show');
}

function handleAddStudent(e) {
  e.preventDefault();
  var name = document.getElementById('new-student-name').value.trim();
  var classRoom = document.getElementById('new-student-class').value.trim();
  callApi('addStudent', { token: AppState.token, fullName: name, classRoom: classRoom })
    .then(onStudentAdded).catch(onApiError);
}

function onStudentAdded(res) {
  if (!res.success) { showToast(res.message); return; }
  closeModal('modal-add-student');
  document.getElementById('cred-id').textContent = res.studentId;
  document.getElementById('cred-password').textContent = res.password;
  document.getElementById('modal-credentials').classList.add('show');
  loadStudentList();
  loadDashboardSummary();
}

function toggleStudentStatus(studentId, currentStatus) {
  var newStatus = currentStatus === 'Inactive' ? 'Active' : 'Inactive';
  if (!confirm(newStatus === 'Inactive' ? 'ระงับการใช้งานนักเรียนคนนี้?' : 'เปิดการใช้งานนักเรียนคนนี้อีกครั้ง?')) return;
  callApi('setStudentStatus', { token: AppState.token, studentId: studentId, newStatus: newStatus })
    .then(function (res) {
      if (!res.success) { showToast(res.message); return; }
      loadStudentList(); loadDashboardSummary();
    }).catch(onApiError);
}

function resetPassword(studentId) {
  if (!confirm('สร้างรหัสผ่านใหม่ให้นักเรียนคนนี้?')) return;
  callApi('resetStudentPassword', { token: AppState.token, studentId: studentId })
    .then(function (res) {
      if (!res.success) { showToast(res.message); return; }
      document.getElementById('cred-id').textContent = studentId;
      document.getElementById('cred-password').textContent = res.password;
      document.getElementById('modal-credentials').classList.add('show');
    }).catch(onApiError);
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

/* ---------------- คลังหน่วยเสียง (จัดการโดยครู) ---------------- */

var PracticeItemsAdminState = { items: [] };

function loadPracticeItemsAdmin() {
  callApi('getPracticeItemsAdmin', { token: AppState.token })
    .then(function (res) {
      if (!res.success) { onApiError(res); return; }
      PracticeItemsAdminState.items = res.items;
      renderPracticeItemsAdminTable();
    })
    .catch(onApiError);
}

function renderPracticeItemsAdminTable() {
  var filterVal = document.getElementById('pi-filter-module').value;
  var tbody = document.getElementById('pi-table-body');
  var emptyState = document.getElementById('pi-empty-state');
  var items = PracticeItemsAdminState.items.filter(function (i) {
    return !filterVal || i.Module === filterVal;
  });

  if (items.length === 0) {
    tbody.innerHTML = ''; emptyState.style.display = 'block'; return;
  }
  emptyState.style.display = 'none';
  tbody.innerHTML = items.map(function (i) {
    return '<tr>' +
      '<td>' + escapeHtml(i.ItemID) + '</td>' +
      '<td>' + escapeHtml(i.Module) + '</td>' +
      '<td>' + escapeHtml(i.Type) + '</td>' +
      '<td>' + escapeHtml(i.Pinyin) + '</td>' +
      '<td>' + escapeHtml(i.ThaiSound || '-') + '</td>' +
      '<td>' + escapeHtml(i.ExampleWord || '-') + '</td>' +
      '<td class="row-actions">' +
        '<button class="btn btn-ghost" onclick="openEditPracticeItemModal(\'' + i.ItemID + '\')">แก้ไข</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

function openAddPracticeItemModal() {
  document.getElementById('form-edit-practice-item').reset();
  document.getElementById('pi-item-id').value = '';
  document.getElementById('pi-modal-title').textContent = 'เพิ่มรายการใหม่';
  document.getElementById('pi-delete-btn').style.display = 'none';
  document.getElementById('pi-level').value = 1;
  document.getElementById('modal-edit-practice-item').classList.add('show');
}

function openEditPracticeItemModal(itemId) {
  var item = PracticeItemsAdminState.items.find(function (i) { return i.ItemID === itemId; });
  if (!item) { showToast('ไม่พบรายการนี้'); return; }

  document.getElementById('form-edit-practice-item').reset();
  document.getElementById('pi-item-id').value = item.ItemID;
  document.getElementById('pi-modal-title').textContent = 'แก้ไขรายการ: ' + item.ItemID;
  document.getElementById('pi-delete-btn').style.display = 'inline-block';

  document.getElementById('pi-module').value = item.Module || 'Initials';
  document.getElementById('pi-type').value = item.Type || '';
  document.getElementById('pi-pinyin').value = item.Pinyin || '';
  document.getElementById('pi-tone-number').value = item.ToneNumber || '';
  document.getElementById('pi-thai-sound').value = item.ThaiSound || '';
  document.getElementById('pi-articulation').value = item.Articulation || '';
  document.getElementById('pi-diagram-key').value = item.DiagramKey || '';
  document.getElementById('pi-example-word').value = item.ExampleWord || '';
  document.getElementById('pi-example-pinyin').value = item.ExamplePinyin || '';
  document.getElementById('pi-example-meaning').value = item.ExampleMeaning || '';
  document.getElementById('pi-audio-url').value = item.AudioURL || '';
  document.getElementById('pi-example-audio-url').value = item.ExampleAudioURL || '';
  document.getElementById('pi-image-url').value = item.ImageURL || '';
  document.getElementById('pi-level').value = item.Level || 1;

  document.getElementById('modal-edit-practice-item').classList.add('show');
}

function collectPracticeItemFormFields() {
  return {
    Module: document.getElementById('pi-module').value,
    Type: document.getElementById('pi-type').value.trim(),
    Pinyin: document.getElementById('pi-pinyin').value.trim(),
    ToneNumber: document.getElementById('pi-tone-number').value || '',
    ThaiSound: document.getElementById('pi-thai-sound').value.trim(),
    Articulation: document.getElementById('pi-articulation').value.trim(),
    DiagramKey: document.getElementById('pi-diagram-key').value.trim(),
    ExampleWord: document.getElementById('pi-example-word').value.trim(),
    ExamplePinyin: document.getElementById('pi-example-pinyin').value.trim(),
    ExampleMeaning: document.getElementById('pi-example-meaning').value.trim(),
    AudioURL: document.getElementById('pi-audio-url').value.trim(),
    ExampleAudioURL: document.getElementById('pi-example-audio-url').value.trim(),
    ImageURL: document.getElementById('pi-image-url').value.trim(),
    Level: document.getElementById('pi-level').value || 1
  };
}

function handleSavePracticeItem(e) {
  e.preventDefault();
  var itemId = document.getElementById('pi-item-id').value;
  var fields = collectPracticeItemFormFields();
  var action = itemId ? 'updatePracticeItem' : 'addPracticeItem';
  var payload = itemId ? { token: AppState.token, itemId: itemId, fields: fields } : { token: AppState.token, fields: fields };

  callApi(action, payload).then(function (res) {
    if (!res.success) { showToast(res.message); return; }
    closeModal('modal-edit-practice-item');
    showToast(itemId ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มรายการใหม่แล้ว');
    loadPracticeItemsAdmin();
  }).catch(onApiError);
}

function handleDeletePracticeItem() {
  var itemId = document.getElementById('pi-item-id').value;
  if (!itemId) return;
  if (!confirm('ลบรายการ ' + itemId + ' ออกจากคลังหน่วยเสียง?')) return;

  callApi('deletePracticeItem', { token: AppState.token, itemId: itemId }).then(function (res) {
    if (!res.success) { showToast(res.message); return; }
    closeModal('modal-edit-practice-item');
    showToast('ลบรายการแล้ว');
    loadPracticeItemsAdmin();
  }).catch(onApiError);
}

/* ---------------- ส่วนช่วยทั่วไป ---------------- */

function onApiError(err) {
  if (err && err.message && err.message.indexOf('เซสชัน') !== -1) { onSessionLost(); return; }
  showToast('เกิดข้อผิดพลาด: ' + (err && err.message ? err.message : 'ไม่สามารถเชื่อมต่อระบบได้'));
}

function showToast(message) {
  var toast = document.getElementById('toast');
  if (!toast) { console.warn('showToast: ไม่พบ element id="toast" — ' + message); return; }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function () { toast.classList.remove('show'); }, 2800);
}

function formatDateThai(iso) {
  if (!iso) return '-';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ============================================================
 * DiagramJS — เครื่องสร้างไดอะแกรมปาก/ลิ้น/กระแสลม และกราฟวรรณยุกต์
 * (ทำงานฝั่ง client ล้วน ๆ ไม่เรียก API)
 * ============================================================ */

var HEAD_PATH = 'M90,15 C120,14 145,22 165,45 C175,55 183,58 186,62 C189,66 184,70 179,72 ' +
  'C184,78 185,84 181,88 C185,93 183,99 177,101 C181,110 175,120 165,128 ' +
  'C150,140 125,148 100,148 C70,148 42,135 30,108 C20,85 22,55 38,35 C50,20 70,16 90,15 Z';
var PALATE_PATH = 'M58,96 Q100,68 178,78';

var PLACE_GEOMETRY = {
  'bilabial':        { tongue: [108, 116, 34, 13], lips: 'closed',  contact: null },
  'labiodental':     { tongue: [108, 116, 34, 13], lips: 'underbite', contact: null },
  'alveolar':        { tongue: [142, 92, 30, 13],  lips: 'open',    contact: [160, 80] },
  'velar':           { tongue: [88, 84, 32, 14],   lips: 'open',    contact: [95, 71] },
  'palatal':         { tongue: [118, 86, 36, 15],  lips: 'spread',  contact: [126, 75] },
  'retroflex':       { tongue: [138, 94, 28, 13],  lips: 'open',    contact: [150, 81], curl: true },
  'dental':          { tongue: [150, 97, 26, 11],  lips: 'open',    contact: [165, 86] },
  'glide-i':         { tongue: [128, 80, 30, 13],  lips: 'spread',  contact: null },
  'glide-u':         { tongue: [92, 80, 32, 14],   lips: 'rounded', contact: null }
};

var MANNER_LABEL_TH = {
  unaspirated: 'ลมเบา ไม่มีลมพ่น', aspirated: 'ลมแรง (มีลมพ่น)', nasal: 'ปล่อยเสียงออกทางจมูก',
  fricative: 'ลมเสียดแทรกออกมา', lateral: 'ลมไหลออกทางข้างลิ้น', approximant: 'เสียงก้องนุ่ม ๆ',
  glide: 'เลื่อนเข้าสู่สระที่ตามมา'
};

function parseDiagramKey(key) {
  if (!key) return null;
  if (key.indexOf('glide-') === 0) return { place: key, manner: 'glide' };
  if (key === 'labiodental') return { place: 'labiodental', manner: 'fricative' };
  var parts = key.split('-');
  var manner = parts.pop();
  return { place: parts.join('-'), manner: manner };
}

function airflowMarkup(manner) {
  switch (manner) {
    case 'aspirated':
      return '<path d="M188,80 L214,80" stroke="#C8472E" stroke-width="3" stroke-linecap="round" marker-end="url(#arrowHead)"/>' +
        '<path d="M196,70 L204,64" stroke="#C8472E" stroke-width="2" stroke-linecap="round"/>' +
        '<path d="M196,90 L204,96" stroke="#C8472E" stroke-width="2" stroke-linecap="round"/>';
    case 'unaspirated':
      return '<path d="M188,80 L200,80" stroke="#545B6B" stroke-width="2" stroke-linecap="round" marker-end="url(#arrowHeadSoft)"/>';
    case 'nasal':
      return '<path d="M150,55 Q160,30 168,18" stroke="#2F7A5E" stroke-width="2.5" stroke-linecap="round" fill="none" marker-end="url(#arrowHeadGreen)"/>';
    case 'fricative':
      return '<path d="M188,76 q5,-6 10,0 q5,6 10,0" stroke="#C8472E" stroke-width="2" fill="none" stroke-linecap="round"/>' +
        '<path d="M188,86 q5,-6 10,0 q5,6 10,0" stroke="#C8472E" stroke-width="2" fill="none" stroke-linecap="round"/>';
    case 'lateral':
      return '<path d="M150,92 L138,86" stroke="#2F7A5E" stroke-width="2" stroke-linecap="round" marker-end="url(#arrowHeadGreen)"/>' +
        '<path d="M150,100 L138,106" stroke="#2F7A5E" stroke-width="2" stroke-linecap="round" marker-end="url(#arrowHeadGreen)"/>';
    case 'approximant':
      return '<path d="M188,82 Q200,80 206,86" stroke="#2F7A5E" stroke-width="2.5" fill="none" stroke-linecap="round" marker-end="url(#arrowHeadGreen)"/>';
    default:
      return '';
  }
}

function lipsMarkup(state) {
  switch (state) {
    case 'closed':    return '<line x1="178" y1="72" x2="178" y2="92" stroke="#C8472E" stroke-width="5" stroke-linecap="round"/>';
    case 'underbite': return '<line x1="178" y1="74" x2="178" y2="90" stroke="#545B6B" stroke-width="2.5" stroke-linecap="round"/>' +
      '<line x1="178" y1="74" x2="186" y2="68" stroke="#C8472E" stroke-width="3" stroke-linecap="round"/>';
    case 'rounded':   return '<circle cx="183" cy="81" r="8" fill="none" stroke="#C8472E" stroke-width="2.5"/>';
    case 'spread':    return '<line x1="172" y1="74" x2="186" y2="78" stroke="#545B6B" stroke-width="2"/><line x1="172" y1="88" x2="186" y2="84" stroke="#545B6B" stroke-width="2"/>';
    default:          return '';
  }
}

function renderArticulationDiagram(svgId, diagramKey) {
  var svg = document.getElementById(svgId);
  if (!svg) return;
  var parsed = parseDiagramKey(diagramKey);
  if (!parsed || !PLACE_GEOMETRY[parsed.place]) { svg.innerHTML = ''; return; }
  var geo = PLACE_GEOMETRY[parsed.place];
  var t = geo.tongue;

  var tongueShape = geo.curl
    ? '<path d="M' + (t[0]-t[2]) + ',' + t[1] + ' Q' + t[0] + ',' + (t[1]-t[3]*1.6) + ' ' + (t[0]+t[2]*0.6) + ',' + (t[1]-t[3]*0.3) +
      ' Q' + (t[0]+t[2]*1.1) + ',' + (t[1]+t[3]*0.2) + ' ' + (t[0]+t[2]*0.7) + ',' + (t[1]+t[3]*0.6) + ' Z" fill="#E8A79A" stroke="#C8472E" stroke-width="1.5"/>'
    : '<ellipse cx="' + t[0] + '" cy="' + t[1] + '" rx="' + t[2] + '" ry="' + t[3] + '" fill="#E8A79A" stroke="#C8472E" stroke-width="1.5"/>';

  var contactDot = geo.contact ? '<circle cx="' + geo.contact[0] + '" cy="' + geo.contact[1] + '" r="4" fill="#1F2430"/>' : '';

  svg.innerHTML =
    '<defs>' +
      '<marker id="arrowHead" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#C8472E"/></marker>' +
      '<marker id="arrowHeadSoft" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#545B6B"/></marker>' +
      '<marker id="arrowHeadGreen" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#2F7A5E"/></marker>' +
    '</defs>' +
    '<path d="' + HEAD_PATH + '" fill="#F6F3EC" stroke="#1F2430" stroke-width="2"/>' +
    '<path d="' + PALATE_PATH + '" fill="none" stroke="#9AA0AC" stroke-width="1.5" stroke-dasharray="3 3"/>' +
    tongueShape + contactDot + lipsMarkup(geo.lips) + airflowMarkup(parsed.manner);
}

function articulationMannerLabel(diagramKey) {
  var parsed = parseDiagramKey(diagramKey);
  return parsed ? (MANNER_LABEL_TH[parsed.manner] || '') : '';
}

/* ---------------- ไดอะแกรมรูปปากสำหรับสระ/ส่วนท้าย ---------------- */

var FINAL_GEOMETRY = {
  'open-a':            { rx: 34, ry: 26, badge: null },
  'rounded-o':         { rx: 24, ry: 24, badge: null },
  'mid-e':             { rx: 30, ry: 18, badge: null },
  'close-i':           { rx: 34, ry: 9,  badge: null },
  'rounded-u':         { rx: 18, ry: 18, badge: null },
  'rounded-front-u':   { rx: 18, ry: 18, badge: 'i' },
  'diphthong-ai':      { rx: 34, ry: 26, badge: null, morphTo: [34, 9] },
  'diphthong-ei':      { rx: 30, ry: 18, badge: null, morphTo: [34, 9] },
  'diphthong-ao':      { rx: 34, ry: 26, badge: null, morphTo: [24, 24] },
  'diphthong-ou':      { rx: 24, ry: 24, badge: null, morphTo: [18, 18] },
  'nasal-n-a':         { rx: 34, ry: 26, badge: 'n' },
  'nasal-n-e':         { rx: 30, ry: 18, badge: 'n' },
  'nasal-n-i':         { rx: 34, ry: 9,  badge: 'n' },
  'nasal-ng-a':        { rx: 34, ry: 26, badge: 'ng' },
  'nasal-ng-e':        { rx: 30, ry: 18, badge: 'ng' },
  'nasal-ng-o':        { rx: 24, ry: 24, badge: 'ng' },
  'nasal-ng-i':        { rx: 34, ry: 9,  badge: 'ng' }
};

function renderFinalDiagram(svgId, diagramKey) {
  var svg = document.getElementById(svgId);
  if (!svg) return;
  var geo = FINAL_GEOMETRY[diagramKey];
  if (!geo) { svg.innerHTML = ''; return; }
  var cx = 60, cy = 60;
  var markup = '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + geo.rx + '" ry="' + geo.ry + '" fill="none" stroke="#C8472E" stroke-width="3"/>';

  if (geo.morphTo) {
    markup += '<path d="M' + (cx + geo.rx) + ',' + cy + ' Q105,' + cy + ' 118,' + cy + '" stroke="#9AA0AC" stroke-width="2" fill="none" marker-end="url(#finalArrow)"/>' +
      '<defs><marker id="finalArrow" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#9AA0AC"/></marker></defs>' +
      '<ellipse cx="118" cy="' + cy + '" rx="' + geo.morphTo[0] + '" ry="' + geo.morphTo[1] + '" fill="none" stroke="#9AA0AC" stroke-width="2" stroke-dasharray="3 3"/>';
  }
  if (geo.badge) {
    markup += '<circle cx="' + (cx + geo.rx - 2) + '" cy="' + (cy + geo.ry - 4) + '" r="11" fill="#2F7A5E"/>' +
      '<text x="' + (cx + geo.rx - 2) + '" y="' + (cy + geo.ry - 1) + '" text-anchor="middle" font-size="10" fill="#fff" font-family="Kanit, sans-serif">' + geo.badge + '</text>';
  }
  svg.innerHTML = markup;
}

/* ---------------- กราฟเส้นวรรณยุกต์ ---------------- */

var TONE_CURVES = {
  1: { points: [[0,80],[33,80],[66,80],[100,80]], color: '#C8472E' },
  2: { points: [[0,40],[33,55],[66,70],[100,90]], color: '#2F7A5E' },
  3: { points: [[0,60],[33,30],[50,20],[66,35],[100,55]], color: '#1F2430' },
  4: { points: [[0,90],[33,75],[66,50],[100,15]], color: '#B5781F' }
};

function renderToneGraph(svgId, highlightTone) {
  var svg = document.getElementById(svgId);
  if (!svg) return;
  var w = 320, h = 170, padL = 36, padR = 14, padT = 14, padB = 14;
  var plotW = w - padL - padR, plotH = h - padT - padB;

  function mapPoint(p) {
    var x = padL + (p[0] / 100) * plotW;
    var y = padT + (1 - p[1] / 100) * plotH;
    return x + ',' + y;
  }

  var axisLabels = [['5 สูงสุด', 0], ['4 สูง', 0.25], ['3 กลาง', 0.5], ['2 ต่ำ', 0.75], ['1 ต่ำสุด', 1]];
  var axisMarkup = axisLabels.map(function (lbl) {
    var y = padT + lbl[1] * plotH;
    return '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" text-anchor="end" font-size="9" fill="#545B6B" font-family="Sarabun, sans-serif">' + lbl[0] + '</text>' +
      '<line x1="' + padL + '" y1="' + y + '" x2="' + (w - padR) + '" y2="' + y + '" stroke="#E4DFD2" stroke-width="1"/>';
  }).join('');

  var curvesMarkup = Object.keys(TONE_CURVES).map(function (toneKey) {
    var curve = TONE_CURVES[toneKey];
    var isHighlighted = !highlightTone || Number(highlightTone) === Number(toneKey);
    var pts = curve.points.map(mapPoint).join(' ');
    return '<polyline points="' + pts + '" fill="none" stroke="' + curve.color + '" stroke-width="' + (isHighlighted ? 3.5 : 1.5) +
      '" stroke-linecap="round" opacity="' + (isHighlighted ? 1 : 0.25) + '"/>';
  }).join('');

  svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
  svg.innerHTML = axisMarkup + curvesMarkup;
}

/* ============================================================
 * Phonetic Lab — ห้องปฏิบัติการเสียง
 * ============================================================ */

var PhoneticState = {
  currentModule: 'Initials', items: [], currentItem: null,
  mediaRecorder: null, audioChunks: [], stream: null, isRecording: false,
  recordedBlobUrl: null, practicedItemIds: {}, practiceCounts: {}
};

function openPhoneticLab() {
  showView('phonetic');
  switchToModuleTab('Initials');
  loadPhoneticItems('Initials');
}

function switchPhoneticModule(moduleName) {
  document.querySelectorAll('.sub-tab-btn').forEach(function (b) { b.classList.remove('active'); });
  event.currentTarget.classList.add('active');
  switchToModuleTab(moduleName);
  loadPhoneticItems(moduleName);
}

function switchToModuleTab(moduleName) {
  PhoneticState.currentModule = moduleName;
  var overview = document.getElementById('tone-overview-card');
  if (!overview) return;
  if (moduleName === 'Tones') {
    overview.style.display = 'block';
    renderToneGraph('tone-overview-svg', null);
  } else {
    overview.style.display = 'none';
  }
}

function loadPhoneticItems(moduleName) {
  var grid = document.getElementById('phonetic-item-grid');
  grid.innerHTML = '<div class="empty-state">กำลังโหลด...</div>';
  callApi('getPracticeItems', { token: AppState.token, moduleName: moduleName })
    .then(function (res) {
      if (!res.success) {
        grid.innerHTML = '<div class="empty-state">เกิดข้อผิดพลาด: ' + escapeHtml(res.message || 'ไม่สามารถโหลดข้อมูลได้') + '</div>';
        return;
      }
      PhoneticState.items = res.items;
      renderPhoneticGrid(res.items);
    })
    .catch(function (err) {
      grid.innerHTML = '<div class="empty-state">เกิดข้อผิดพลาด: ' + escapeHtml(err.message || 'ไม่สามารถเชื่อมต่อระบบได้') + '</div>';
      onApiError(err);
    });
}

function renderPhoneticGrid(items) {
  var grid = document.getElementById('phonetic-item-grid');
  if (!items || items.length === 0) {
    grid.innerHTML = '<div class="empty-state">ไม่พบข้อมูลใน PracticeItems</div>';
    return;
  }
  var isTones = PhoneticState.currentModule === 'Tones';
  grid.innerHTML = items.map(function (it, idx) {
    var practiced = PhoneticState.practicedItemIds[it.itemId] ? ' is-practiced' : '';
    var typeLabel = isTones ? ('เสียง ' + it.toneNumber) : it.type;
    var subLabel = isTones ? escapeHtml(it.exampleWord || '-') : escapeHtml(it.thaiSound || '-');
    return '<div class="item-card' + practiced + '" id="item-card-' + idx + '" onclick="openPracticeModal(' + idx + ')">' +
      '<span class="item-practiced-dot"></span>' +
      '<button class="item-listen-btn" onclick="event.stopPropagation(); playItemAudio(' + idx + ', this)" aria-label="ฟังเสียง" title="ฟังเสียง">🔊</button>' +
      '<div class="item-type">' + escapeHtml(typeLabel) + '</div>' +
      '<div class="item-thai-sound">' + subLabel + '</div>' +
      '</div>';
  }).join('');
}

/** เล่นไฟล์เสียงจริงถ้ามี (audioUrl) ถ้าไม่มีหรือโหลดไม่ได้ ใช้เสียงสังเคราะห์ (TTS) จาก fallbackText แทนอัตโนมัติ */
function playSound(audioUrl, fallbackText, btn, opts) {
  stopAnyPlayback();
  if (!audioUrl) { speakText(fallbackText, btn, opts); return; }

  var iconOnly = !!(opts && opts.iconOnly);
  var originalLabel = btn ? btn.textContent : '';
  var audio = new Audio(audioUrl);
  PhoneticState.currentAudioEl = audio;

  function restore() {
    if (!btn) return;
    if (iconOnly) btn.classList.remove('is-playing'); else btn.textContent = originalLabel;
  }
  if (btn) { if (iconOnly) btn.classList.add('is-playing'); else btn.textContent = 'กำลังเล่น...'; }

  audio.onended = restore;
  audio.onerror = function () { restore(); speakText(fallbackText, btn, opts); };
  audio.play().catch(function () { restore(); speakText(fallbackText, btn, opts); });
}

/** ปุ่มฟังเสียงด่วนจากการ์ดในกริด ไม่ต้องเปิดโมดัลรายละเอียดก่อน */
function playItemAudio(idx, btn) {
  var item = PhoneticState.items[idx];
  if (!item) return;
  var textToSpeak = PhoneticState.currentModule === 'Tones' ? (item.exampleWord || item.pinyin) : item.pinyin;
  playSound(item.audioUrl, textToSpeak, btn, { iconOnly: true });
}

function openPracticeModal(idx) {
  var item = PhoneticState.items[idx];
  PhoneticState.currentItem = item;
  PhoneticState.currentItemIdx = idx;
  resetPracticeModal();

  var isTones = PhoneticState.currentModule === 'Tones';

  document.getElementById('practice-pinyin').textContent = item.pinyin || '-';
  document.getElementById('practice-thai-sound').textContent = isTones ? ('เสียงวรรณยุกต์ที่ ' + item.toneNumber) : (item.thaiSound || '');
  document.getElementById('practice-articulation').textContent = item.articulation || 'ไม่มีคำอธิบายการออกเสียง';
  document.getElementById('example-hanzi').textContent = item.exampleWord || '-';
  document.getElementById('example-pinyin').textContent = item.examplePinyin || '-';
  document.getElementById('example-meaning').textContent = item.exampleMeaning || 'ไม่มีคำแปล';

  var svg = document.getElementById('practice-diagram-svg');
  if (isTones) {
    svg.setAttribute('viewBox', '0 0 320 170');
    renderToneGraph('practice-diagram-svg', item.toneNumber);
    document.getElementById('diagram-caption').textContent = 'เส้นทึบ = เสียงวรรณยุกต์ของหน่วยเสียงนี้';
  } else if (PhoneticState.currentModule === 'Initials') {
    svg.setAttribute('viewBox', '0 0 220 160');
    renderArticulationDiagram('practice-diagram-svg', item.diagramKey);
    document.getElementById('diagram-caption').textContent = articulationMannerLabel(item.diagramKey);
  } else {
    svg.setAttribute('viewBox', '0 0 120 100');
    renderFinalDiagram('practice-diagram-svg', item.diagramKey);
    document.getElementById('diagram-caption').textContent = 'รูปปากโดยประมาณ (วงประ = ตำแหน่งปลาย ถ้าเป็นสระประสม)';
  }

  updatePracticeCounterLabel();
  document.getElementById('modal-practice').classList.add('show');
}

function updatePracticeCounterLabel() {
  var count = PhoneticState.practiceCounts[PhoneticState.currentItem.itemId] || 0;
  document.getElementById('practice-counter').textContent = count > 0 ? ('ฝึกพูดตามแล้ว ' + count + ' ครั้ง') : '';
}

function resetPracticeModal() {
  stopAnyPlayback();
  document.getElementById('playback-panel').classList.remove('show');
  document.getElementById('rec-indicator').classList.remove('show');
  var micBtn = document.getElementById('mic-btn');
  micBtn.textContent = 'ฝึกพูดตาม';
  micBtn.classList.remove('is-recording');
  micBtn.disabled = false;
  document.getElementById('listen-example-btn').textContent = '▶ ฟังคำตัวอย่าง';
  document.getElementById('listen-example-btn').disabled = false;

  if (PhoneticState.recordedBlobUrl) { URL.revokeObjectURL(PhoneticState.recordedBlobUrl); }
  PhoneticState.recordedBlobUrl = null;
  PhoneticState.audioChunks = [];
  PhoneticState.isRecording = false;
}

/* เลือกเสียงพากย์ภาษาจีนที่คุณภาพดีที่สุดที่เบราว์เซอร์มีให้ */
var _cachedVoices = [];
function refreshVoiceCache() {
  if ('speechSynthesis' in window) _cachedVoices = window.speechSynthesis.getVoices();
}
if ('speechSynthesis' in window) {
  refreshVoiceCache();
  window.speechSynthesis.onvoiceschanged = refreshVoiceCache;
}
function pickBestChineseVoice() {
  if (_cachedVoices.length === 0) refreshVoiceCache();
  var zhVoices = _cachedVoices.filter(function (v) {
    return v.lang && v.lang.toLowerCase().indexOf('zh') === 0;
  });
  if (zhVoices.length === 0) return null;
  var preferred = zhVoices.filter(function (v) { return /google|microsoft|natural|enhanced|online/i.test(v.name); });
  return preferred[0] || zhVoices[0];
}

function stopAnyPlayback() {
  PhoneticState.speechRequestId = (PhoneticState.speechRequestId || 0) + 1;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (PhoneticState.currentAudioEl) { PhoneticState.currentAudioEl.pause(); }
}

function speakText(text, btn, opts) {
  if (!('speechSynthesis' in window)) { showToast('เบราว์เซอร์นี้ไม่รองรับการอ่านออกเสียงตัวอย่าง'); return; }
  stopAnyPlayback();
  var iconOnly = !!(opts && opts.iconOnly);
  var originalLabel = btn ? btn.textContent : '';

  if (btn) {
    if (iconOnly) btn.classList.add('is-playing');
    else btn.textContent = 'กำลังเล่น...';
  }
  function restore() {
    if (!btn) return;
    if (iconOnly) btn.classList.remove('is-playing');
    else btn.textContent = originalLabel;
  }

  // หน่วงเล็กน้อยก่อนเล่นเสียงใหม่จริง เพราะ speechSynthesis.cancel() ในหลายเบราว์เซอร์
  // ไม่เคลียร์คำขอเดิมทันทีแบบ synchronous
  PhoneticState.speechRequestId = (PhoneticState.speechRequestId || 0) + 1;
  var requestId = PhoneticState.speechRequestId;
  setTimeout(function () {
    if (requestId !== PhoneticState.speechRequestId) return;
    window.speechSynthesis.cancel();
    var utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'zh-CN';
    utter.rate = 0.8;
    var voice = pickBestChineseVoice();
    if (voice) utter.voice = voice;
    utter.onend = restore;
    utter.onerror = restore;
    window.speechSynthesis.speak(utter);
  }, 80);
}

function playExampleAudio() {
  var item = PhoneticState.currentItem;
  playSound(item.exampleAudioUrl, item.exampleWord, document.getElementById('listen-example-btn'));
}

function toggleRecording() {
  if (PhoneticState.isRecording) { stopRecording(); } else { startRecording(); }
}

function startRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('เบราว์เซอร์นี้ไม่รองรับการบันทึกเสียงผ่านไมโครโฟน'); return;
  }
  document.getElementById('playback-panel').classList.remove('show');
  if (PhoneticState.recordedBlobUrl) { URL.revokeObjectURL(PhoneticState.recordedBlobUrl); PhoneticState.recordedBlobUrl = null; }

  navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
    PhoneticState.stream = stream;
    PhoneticState.audioChunks = [];
    PhoneticState.mediaRecorder = new MediaRecorder(stream);
    PhoneticState.mediaRecorder.ondataavailable = function (e) { if (e.data.size > 0) PhoneticState.audioChunks.push(e.data); };
    PhoneticState.mediaRecorder.onstop = function () {
      var recMime = PhoneticState.mediaRecorder.mimeType || 'audio/mp4';
      var blob = new Blob(PhoneticState.audioChunks, { type: recMime });
      PhoneticState.recordedBlobUrl = URL.createObjectURL(blob);
      document.getElementById('playback-panel').classList.add('show');

      var itemId = PhoneticState.currentItem.itemId;
      PhoneticState.practiceCounts[itemId] = (PhoneticState.practiceCounts[itemId] || 0) + 1;
      PhoneticState.practicedItemIds[itemId] = true;
      updatePracticeCounterLabel();
      var card = document.getElementById('item-card-' + PhoneticState.currentItemIdx);
      if (card) card.classList.add('is-practiced');
    };
    PhoneticState.mediaRecorder.start();

    PhoneticState.isRecording = true;
    var micBtn = document.getElementById('mic-btn');
    micBtn.textContent = 'หยุดบันทึก';
    micBtn.classList.add('is-recording');
    document.getElementById('rec-indicator').classList.add('show');

    setTimeout(function () { if (PhoneticState.isRecording) stopRecording(); }, 6000);
  }).catch(function () {
    showToast('ไม่สามารถเข้าถึงไมโครโฟนได้ กรุณาอนุญาตการใช้งานไมโครโฟนในเบราว์เซอร์');
  });
}

function stopRecording() {
  if (!PhoneticState.isRecording) return;
  PhoneticState.isRecording = false;
  document.getElementById('rec-indicator').classList.remove('show');
  var micBtn = document.getElementById('mic-btn');
  micBtn.textContent = 'ฝึกพูดตาม';
  micBtn.classList.remove('is-recording');

  if (PhoneticState.mediaRecorder && PhoneticState.mediaRecorder.state !== 'inactive') {
    PhoneticState.mediaRecorder.stop();
  }
  if (PhoneticState.stream) PhoneticState.stream.getTracks().forEach(function (t) { t.stop(); });
}

function playMyRecording() {
  if (!PhoneticState.recordedBlobUrl) return;
  stopAnyPlayback();
  var audio = new Audio(PhoneticState.recordedBlobUrl);
  PhoneticState.currentAudioEl = audio;
  audio.play();
}

function closePracticeModal() {
  if (PhoneticState.isRecording) stopRecording();
  stopAnyPlayback();
  closeModal('modal-practice');
}


/* ================================================================
 * RECORDING PIPELINE v3 — Web Audio ScriptProcessor
 *
 * ROOT CAUSE of previous failures:
 *   1. MediaRecorder produces audio/mp4 on iOS — not WAV
 *   2. OfflineAudioContext post-processing silently fails on iOS
 *      because AudioContext created in async callbacks is suspended
 *   3. Resulting WAV was silent → Azure: InitialSilenceTimeout / NoMatch
 *
 * NEW APPROACH:
 *   • ScriptProcessor node intercepts raw Float32 PCM during recording
 *   • Downsamples in real-time from device rate (44100/48000Hz) → 16kHz
 *   • After recording stops, merges chunks and encodes WAV in one pass
 *   • NO OfflineAudioContext needed — no async decode failures
 *   • Works on iOS Safari, Android Chrome, Chrome, Edge, Firefox
 *
 * PIPELINE:
 *   getUserMedia → AudioContext → MediaStreamSource
 *     → ScriptProcessor (downsample + capture) → destination
 *     → [stop] → merge Float32 chunks → encodeWAV → bufferToBase64
 *     → callApiPost('assessPronunciation') → Azure → scores
 * ================================================================ */

/* ----------------------------------------------------------------
 * DSP helpers
 * ---------------------------------------------------------------- */

/**
 * Downsample Float32 mono PCM from inputRate to outputRate.
 * Uses block-averaging (simple low-pass) to reduce aliasing.
 */
function downsamplePCM(buffer, inputRate, outputRate) {
  if (inputRate === outputRate) return buffer;
  var ratio     = inputRate / outputRate;
  var outLen    = Math.floor(buffer.length / ratio);
  var out       = new Float32Array(outLen);
  for (var i = 0; i < outLen; i++) {
    var start = Math.floor(i * ratio);
    var end   = Math.min(Math.floor((i + 1) * ratio), buffer.length);
    var sum   = 0;
    for (var j = start; j < end; j++) sum += buffer[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

/** Concatenate an array of Float32Arrays into one contiguous buffer */
function mergeFloat32Chunks(chunks) {
  var total = 0;
  for (var i = 0; i < chunks.length; i++) total += chunks[i].length;
  var out = new Float32Array(total);
  var off = 0;
  for (var i = 0; i < chunks.length; i++) {
    out.set(chunks[i], off);
    off += chunks[i].length;
  }
  return out;
}

/**
 * Encode Float32 mono PCM → WAV (PCM 16-bit LE, mono, specified sampleRate).
 * Produces a valid RIFF/WAVE file that Azure Speech accepts.
 */
function encodeWAV(samples, sampleRate) {
  var dataLen = samples.length * 2;          // 16-bit = 2 bytes/sample
  var buf     = new ArrayBuffer(44 + dataLen);
  var v       = new DataView(buf);

  function ws(off, str) {
    for (var i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i));
  }

  // RIFF chunk
  ws(0, 'RIFF');
  v.setUint32(4,  36 + dataLen, true);  // ChunkSize
  ws(8, 'WAVE');

  // fmt sub-chunk
  ws(12, 'fmt ');
  v.setUint32(16, 16,            true); // Subchunk1Size = 16 (PCM)
  v.setUint16(20, 1,             true); // AudioFormat = 1 (PCM)
  v.setUint16(22, 1,             true); // NumChannels = 1 (mono)
  v.setUint32(24, sampleRate,    true); // SampleRate
  v.setUint32(28, sampleRate*2,  true); // ByteRate = SR * ch * bps/8
  v.setUint16(32, 2,             true); // BlockAlign = ch * bps/8
  v.setUint16(34, 16,            true); // BitsPerSample

  // data sub-chunk
  ws(36, 'data');
  v.setUint32(40, dataLen,       true); // Subchunk2Size

  // PCM samples: Float32 [-1,1] → Int16 [-32768, 32767]
  var off = 44;
  for (var i = 0; i < samples.length; i++) {
    var s   = Math.max(-1, Math.min(1, samples[i]));
    var val = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
    v.setInt16(off, val, true);
    off += 2;
  }
  return buf;
}

/**
 * ArrayBuffer → base64 string.
 * Uses 8 KB chunks to avoid call-stack overflow on large files.
 */
function bufferToBase64(buf) {
  var uint8  = new Uint8Array(buf);
  var CHUNK  = 8192;
  var result = '';
  for (var i = 0; i < uint8.length; i += CHUNK) {
    result += String.fromCharCode.apply(
      null,
      uint8.subarray(i, Math.min(i + CHUNK, uint8.length))
    );
  }
  return btoa(result);
}

/* ----------------------------------------------------------------
 * Recording state
 * ---------------------------------------------------------------- */

var RecordState = {
  audioCtx:       null,
  stream:         null,
  source:         null,
  processor:      null,
  keepAliveOsc:   null,   // iOS: prevents silent-graph stall
  keepAliveGain:  null,
  isRecording:    false,
  pcmChunks:      [],
  sourceSR:       44100,  // actual AudioContext sample rate (set at runtime)
  targetSR:       16000,  // Azure requirement
  wavBuffer:      null,   // ArrayBuffer of final WAV
  wavBlobUrl:     null,   // Object URL for <audio> playback
  timerRef:       null,
  startedAt:      0,
  maxMs:          20000   // 20-second ceiling
};

/* ----------------------------------------------------------------
 * startAzurePronunciation() — entry point (called from HTML button)
 * ---------------------------------------------------------------- */
function startAzurePronunciation() {
  var item = PhoneticState.currentItem;
  if (!item) { showToast('ไม่พบคำที่ต้องฝึก'); return; }

  var panel = document.getElementById('azure-score-panel');
  if (!panel) { showToast('ไม่พบ element id="azure-score-panel" ใน index.html'); return; }

  _cleanupRecordState();

  panel.style.display = 'block';
  panel.innerHTML     = '🎤 กำลังขอสิทธิ์ไมโครโฟน...';

  navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount:     { ideal: 1 },
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl:  true
    },
    video: false
  })
  .then(function (stream) {
    RecordState.stream = stream;

    // ──────────────────────────────────────────────────────
    // AudioContext MUST be created inside the getUserMedia
    // .then() callback — this IS triggered by the user's
    // click gesture on iOS, so the context starts 'running'.
    // ──────────────────────────────────────────────────────
    try {
      RecordState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      panel.innerHTML = '❌ ไม่รองรับ AudioContext: ' + escapeHtml(e.message);
      stream.getTracks().forEach(function (t) { t.stop(); });
      return;
    }

    RecordState.sourceSR = RecordState.audioCtx.sampleRate;

    // Resume if the browser pre-suspended the context
    var resumeOp = RecordState.audioCtx.state === 'suspended'
      ? RecordState.audioCtx.resume()
      : Promise.resolve();

    resumeOp.then(function () {
      RecordState.source    = RecordState.audioCtx.createMediaStreamSource(stream);

      // bufferSize must be power of 2; 1 input ch, 1 output ch
      RecordState.processor = RecordState.audioCtx.createScriptProcessor(4096, 1, 1);

      RecordState.processor.onaudioprocess = function (e) {
        if (!RecordState.isRecording) return;
        var raw  = e.inputBuffer.getChannelData(0); // Float32Array
        var down = downsamplePCM(raw, RecordState.sourceSR, RecordState.targetSR);
        RecordState.pcmChunks.push(new Float32Array(down));
      };

      // source → processor → destination
      // Connecting to destination is required on iOS Safari to fire onaudioprocess
      RecordState.source.connect(RecordState.processor);
      RecordState.processor.connect(RecordState.audioCtx.destination);

      // iOS Safari "silent graph" workaround:
      // A near-inaudible oscillator keeps the audio graph active so
      // onaudioprocess fires even when the microphone input is quiet.
      RecordState.keepAliveOsc  = RecordState.audioCtx.createOscillator();
      RecordState.keepAliveGain = RecordState.audioCtx.createGain();
      RecordState.keepAliveGain.gain.value = 0.00001; // -100 dB — inaudible
      RecordState.keepAliveOsc.connect(RecordState.keepAliveGain);
      RecordState.keepAliveGain.connect(RecordState.audioCtx.destination);
      RecordState.keepAliveOsc.start();

      RecordState.isRecording = true;
      RecordState.startedAt   = Date.now();

      panel.innerHTML =
        '🎙️ บันทึกเสียงอยู่...<br>' +
        'พูดคำว่า <span class="hanzi" style="font-size:22px">' +
        escapeHtml(item.exampleWord || item.pinyin) + '</span>' +
        '<br><small style="color:#888;font-size:12px">' +
          'ต้นทาง: ' + RecordState.sourceSR + ' Hz → ปลายทาง: 16000 Hz' +
        '</small>' +
        '<br><br><button class="btn btn-primary" ' +
          'style="margin-top:8px;width:100%" ' +
          'onclick="stopAzureRecording()">⏹ หยุดบันทึก</button>';

      RecordState.timerRef = setTimeout(function () {
        if (RecordState.isRecording) stopAzureRecording();
      }, RecordState.maxMs);
    });
  })
  .catch(function (err) {
    panel.innerHTML = '❌ ไม่สามารถใช้ไมโครโฟนได้: ' + escapeHtml(err.message);
  });
}

/* ----------------------------------------------------------------
 * stopAzureRecording() — stops capture, encodes WAV synchronously
 * ---------------------------------------------------------------- */
function stopAzureRecording() {
  if (!RecordState.isRecording) return;
  RecordState.isRecording = false;
  clearTimeout(RecordState.timerRef);

  var durationMs = Date.now() - RecordState.startedAt;

  // Disconnect audio graph
  try { RecordState.source.disconnect(); }    catch (e) {}
  try { RecordState.processor.disconnect(); } catch (e) {}
  try { RecordState.keepAliveOsc.stop(); }    catch (e) {}
  try { RecordState.audioCtx.close(); }       catch (e) {}
  if (RecordState.stream) {
    RecordState.stream.getTracks().forEach(function (t) { t.stop(); });
  }

  var panel = document.getElementById('azure-score-panel');
  if (!panel) return;

  if (RecordState.pcmChunks.length === 0) {
    panel.innerHTML =
      '❌ ไม่พบข้อมูลเสียง (ScriptProcessor ไม่ได้รับข้อมูล)<br>' +
      '<small style="color:#888">อาจเกิดจาก: ไมโครโฟนถูกปิดเสียง หรือ AudioContext ถูก block</small><br>' +
      '<button class="btn btn-ghost" style="margin-top:8px;width:100%" ' +
        'onclick="startAzurePronunciation()">🔁 ลองใหม่</button>';
    return;
  }

  // Merge all PCM chunks and encode to WAV
  var merged  = mergeFloat32Chunks(RecordState.pcmChunks);
  var wavBuf  = encodeWAV(merged, RecordState.targetSR);
  var wavBlob = new Blob([wavBuf], { type: 'audio/wav' });

  if (RecordState.wavBlobUrl) URL.revokeObjectURL(RecordState.wavBlobUrl);
  RecordState.wavBuffer  = wavBuf;
  RecordState.wavBlobUrl = URL.createObjectURL(wavBlob);

  var pcmKb  = (merged.length * 4 / 1024).toFixed(1);
  var wavKb  = (wavBuf.byteLength / 1024).toFixed(1);
  var durSec = (durationMs / 1000).toFixed(1);

  panel.innerHTML =
    '<p>✅ บันทึกเสร็จ — ฟังเสียง WAV ก่อนส่ง<br>' +
    '<small style="color:#888">Duration: ' + durSec + 's | ' +
    'PCM samples: ' + merged.length.toLocaleString() + ' | ' +
    'WAV: ' + wavKb + ' KB</small></p>' +
    '<audio controls src="' + RecordState.wavBlobUrl + '" ' +
      'style="width:100%;margin-bottom:10px"></audio>' +
    '<div style="display:flex;gap:8px">' +
      '<button class="btn btn-ghost" style="flex:1" ' +
        'onclick="startAzurePronunciation()">🔁 บันทึกใหม่</button>' +
      '<button class="btn btn-primary" style="flex:1" ' +
        'onclick="sendToAzure()">📤 ส่งประเมินผล</button>' +
    '</div>';
}

/* ----------------------------------------------------------------
 * sendToAzure() — converts WAV to base64, calls backend
 * ---------------------------------------------------------------- */
function sendToAzure() {
  var item = PhoneticState.currentItem;
  if (!RecordState.wavBuffer) {
    showToast('ไม่พบไฟล์เสียง — กรุณาบันทึกใหม่');
    return;
  }

  var panel = document.getElementById('azure-score-panel');
  panel.innerHTML = '🔄 กำลังเตรียมส่ง...';

  var b64    = bufferToBase64(RecordState.wavBuffer);
  var b64Kb  = (b64.length / 1024).toFixed(0);
  var wavKb  = (RecordState.wavBuffer.byteLength / 1024).toFixed(0);

  panel.innerHTML =
    '⏳ กำลังส่งไป Azure...<br>' +
    '<small style="color:#888">WAV: ' + wavKb + ' KB | base64: ' + b64Kb + ' KB</small>';

  callApiPost('assessPronunciation', {
    token:         AppState.token,
    referenceText: item.exampleWord || item.pinyin,
    audioBase64:   b64
  })
  .then(function (res) { renderAzureResult(panel, res); })
  .catch(function (err) {
    panel.innerHTML =
      '❌ ' + escapeHtml(err.message) +
      '<br><button class="btn btn-ghost" style="margin-top:8px;width:100%" ' +
        'onclick="startAzurePronunciation()">🔁 ลองใหม่</button>';
  });
}

/* ----------------------------------------------------------------
 * submitRecordingToTeacher() — sends WAV to Drive (teacher review)
 * ---------------------------------------------------------------- */
function submitRecordingToTeacher() {
  var item = PhoneticState.currentItem;
  if (!RecordState.wavBuffer || !item) {
    showToast('ไม่พบไฟล์เสียง — กรุณาบันทึกก่อน');
    return;
  }

  var panel = document.getElementById('azure-score-panel');
  panel.innerHTML = '⏳ กำลังส่งให้ครู...';

  var b64 = bufferToBase64(RecordState.wavBuffer);

  callApiPost('submitRecording', {
    token:       AppState.token,
    itemId:      item.itemId,
    audioBase64: b64,
    mimeType:    'audio/wav'
  })
  .then(function (res) {
    if (!res.success) {
      panel.innerHTML =
        '❌ ' + escapeHtml(res.message) +
        '<br><button class="btn btn-ghost" style="margin-top:8px" ' +
          'onclick="startAzurePronunciation()">🔁 ลองใหม่</button>';
      return;
    }
    panel.innerHTML =
      '<div style="text-align:center;padding:8px">' +
        '<p style="font-size:28px">✅</p>' +
        '<p><b>ส่งเสียงให้ครูตรวจแล้ว</b></p>' +
        '<p style="font-size:13px;color:#888">ครูจะฟังและให้คะแนนจาก Teacher Dashboard</p>' +
        '<button class="btn btn-ghost" style="margin-top:10px;width:100%" ' +
          'onclick="startAzurePronunciation()">🔁 ฝึกอีกครั้ง</button>' +
      '</div>';
  })
  .catch(function (err) {
    panel.innerHTML =
      '❌ ' + escapeHtml(err.message) +
      '<br><button class="btn btn-ghost" style="margin-top:8px" ' +
        'onclick="startAzurePronunciation()">🔁 ลองใหม่</button>';
  });
}

/* ----------------------------------------------------------------
 * renderAzureResult() — displays pronunciation scores
 * ---------------------------------------------------------------- */
function renderAzureResult(panel, res) {
  var debugHtml = res.debugLog
    ? '<details style="margin-top:8px"><summary style="font-size:12px;color:#888;cursor:pointer">Debug Log</summary>' +
      '<pre style="font-size:10px;overflow:auto;max-height:200px;background:#f5f5f5;padding:8px;border-radius:4px">' +
      escapeHtml(res.debugLog) + '</pre></details>'
    : '';

  if (!res.success) {
    panel.innerHTML =
      '<p>❌ ' + escapeHtml(res.message || 'ประเมินผลไม่สำเร็จ') + '</p>' +
      debugHtml +
      '<div style="display:flex;gap:8px;margin-top:10px">' +
        '<button class="btn btn-ghost" style="flex:1" onclick="startAzurePronunciation()">🔁 ลองใหม่</button>' +
        '<button class="btn btn-ghost" style="flex:1" onclick="submitRecordingToTeacher()">📋 ส่งครูตรวจ</button>' +
      '</div>';
    return;
  }

  function sc(score) {
    return score >= 80 ? 'color:#2F7A5E' : score >= 60 ? 'color:#B5781F' : 'color:#C8472E';
  }

  var fVal = res.fluencyScore      != null ? res.fluencyScore      : '—';
  var cVal = res.completenessScore != null ? res.completenessScore : '—';

  panel.innerHTML =
    '<div class="azure-result">' +
      '<h3 style="margin:0 0 8px">🤖 ผลประเมินการออกเสียง</h3>' +
      '<p>คำที่ฝึก: <span class="hanzi" style="font-size:22px">' + escapeHtml(res.referenceText) + '</span></p>' +
      (res.recognizedText
        ? '<p>ระบบจับได้: <b>' + escapeHtml(res.recognizedText) + '</b></p>'
        : '<p style="color:#B5781F">⚠️ ระบบจับเสียงไม่ได้ — ลองพูดให้ชัดขึ้น</p>') +
      '<div class="score-grid" style="margin:12px 0">' +
        '<div class="score-item"><span class="score-val" style="' + sc(res.pronunciationScore) + '">' + res.pronunciationScore + '</span><span class="score-lbl">คะแนนรวม</span></div>' +
        '<div class="score-item"><span class="score-val" style="' + sc(res.accuracyScore)      + '">' + res.accuracyScore      + '</span><span class="score-lbl">ความถูกต้อง</span></div>' +
        '<div class="score-item"><span class="score-val">' + fVal + '</span><span class="score-lbl">ความคล่อง</span></div>' +
        '<div class="score-item"><span class="score-val">' + cVal + '</span><span class="score-lbl">ความครบถ้วน</span></div>' +
      '</div>' +
      debugHtml +
      '<div style="display:flex;gap:8px;margin-top:10px">' +
        '<button class="btn btn-ghost" style="flex:1" onclick="startAzurePronunciation()">🔁 ฝึกอีกครั้ง</button>' +
        '<button class="btn btn-ghost" style="flex:1" onclick="submitRecordingToTeacher()">📋 ส่งครูตรวจ</button>' +
      '</div>' +
    '</div>';
}

/* ----------------------------------------------------------------
 * _cleanupRecordState() — release all WebAudio resources
 * ---------------------------------------------------------------- */
function _cleanupRecordState() {
  clearTimeout(RecordState.timerRef);
  try { if (RecordState.source)       RecordState.source.disconnect(); }       catch (e) {}
  try { if (RecordState.processor)    RecordState.processor.disconnect(); }    catch (e) {}
  try { if (RecordState.keepAliveOsc) RecordState.keepAliveOsc.stop(); }       catch (e) {}
  try { if (RecordState.audioCtx)     RecordState.audioCtx.close(); }          catch (e) {}
  if (RecordState.stream) {
    RecordState.stream.getTracks().forEach(function (t) { t.stop(); });
  }
  if (RecordState.wavBlobUrl) URL.revokeObjectURL(RecordState.wavBlobUrl);

  RecordState.audioCtx      = null;
  RecordState.stream        = null;
  RecordState.source        = null;
  RecordState.processor     = null;
  RecordState.keepAliveOsc  = null;
  RecordState.keepAliveGain = null;
  RecordState.isRecording   = false;
  RecordState.pcmChunks     = [];
  RecordState.wavBuffer     = null;
  RecordState.wavBlobUrl    = null;
}

/* ================================================================
 * Teacher Dashboard — Recording Review Tab
 * Injected dynamically — no changes needed to index.html
 * ================================================================ */

function injectTeacherGradingTab() {
  var tabsEl = document.querySelector('.tabs');
  if (!tabsEl || document.getElementById('tab-btn-recordings')) return;

  var btn       = document.createElement('button');
  btn.id        = 'tab-btn-recordings';
  btn.className = 'tab-btn';
  btn.textContent = 'ตรวจการออกเสียง';
  btn.onclick   = function () { _switchToRecordingsTab(btn); };

  var firstLocked = tabsEl.querySelector('.is-locked');
  if (firstLocked) tabsEl.insertBefore(btn, firstLocked);
  else             tabsEl.appendChild(btn);

  var wrap = document.querySelector('.page-wrap');
  if (wrap && !document.getElementById('panel-recordings')) {
    var p       = document.createElement('div');
    p.id        = 'panel-recordings';
    p.className = 'tab-panel';
    wrap.appendChild(p);
  }
}

function _switchToRecordingsTab(btnEl) {
  document.querySelectorAll('.tab-btn').forEach(function (b) {
    if (!b.classList.contains('is-locked')) b.classList.remove('active');
  });
  document.querySelectorAll('.tab-panel').forEach(function (p) {
    p.classList.remove('active');
  });
  if (btnEl) btnEl.classList.add('active');
  var panel = document.getElementById('panel-recordings');
  if (panel) panel.classList.add('active');
  loadRecordings();
}

function loadRecordings() {
  var panel = document.getElementById('panel-recordings');
  if (!panel) return;
  panel.innerHTML = '<div class="empty-state">กำลังโหลด...</div>';

  callApi('getRecordingsForTeacher', { token: AppState.token })
    .then(function (res) {
      if (!res.success) { onApiError(res); return; }
      panel.innerHTML = renderRecordingsPanel(res.recordings);
    })
    .catch(onApiError);
}

function renderRecordingsPanel(recordings) {
  var ungraded = recordings.filter(function (r) { return !r.isGraded; }).length;

  var html =
    '<div class="panel-head">' +
      '<h2>ตรวจการออกเสียง</h2>' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<span class="pill ' + (ungraded > 0 ? 'pill-locked' : 'pill-active') + '">' +
          (ungraded > 0 ? 'รอตรวจ ' + ungraded + ' รายการ' : '✓ ตรวจครบแล้ว') +
        '</span>' +
        '<button class="btn btn-ghost" onclick="loadRecordings()">↻ รีเฟรช</button>' +
      '</div>' +
    '</div>';

  if (!recordings.length) {
    return html + '<div class="empty-state">ยังไม่มีเสียงที่นักเรียนส่งมา</div>';
  }

  html +=
    '<div class="table-wrap" style="overflow-x:auto"><table>' +
    '<thead><tr>' +
      '<th>ชื่อนักเรียน</th><th>ห้อง</th><th>คำที่พูด</th>' +
      '<th>วันที่</th><th>ฟังเสียง</th>' +
      '<th>คะแนน (0-100)</th><th>หมายเหตุ</th><th>บันทึก</th>' +
    '</tr></thead><tbody>';

  recordings.forEach(function (r) {
    var rid      = escapeHtml(r.recordingId);
    var audioUrl = r.driveFileId
      ? 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(r.driveFileId)
      : escapeHtml(r.driveUrl || '');
    var rowStyle = r.isGraded ? '' : ' style="background:#FFFBF0"';

    html +=
      '<tr id="row-' + rid + '"' + rowStyle + '>' +
        '<td>' + escapeHtml(r.studentName || r.studentId) + '</td>' +
        '<td>' + escapeHtml(r.classRoom   || '-')         + '</td>' +
        '<td>' +
          '<span class="hanzi" style="font-size:18px">' + escapeHtml(r.targetWord || '') + '</span> ' +
          '<small style="color:#888">' + escapeHtml(r.pinyin || '') + '</small>' +
        '</td>' +
        '<td style="white-space:nowrap;font-size:12px">' + formatDateThai(r.timestamp) + '</td>' +
        '<td>' +
          (audioUrl
            ? '<audio controls src="' + audioUrl + '" preload="none" style="width:200px;height:32px"></audio>' +
              '<br><a href="' + escapeHtml(r.driveUrl || '') + '" target="_blank" rel="noopener" style="font-size:11px">เปิด Drive</a>'
            : '<span style="color:#888;font-size:12px">ไม่มีลิงก์</span>'
          ) +
        '</td>' +
        '<td>' +
          '<input type="number" id="score-' + rid + '" min="0" max="100" ' +
            'value="' + escapeHtml(String(r.teacherScore || '')) + '" placeholder="0-100" ' +
            'style="width:72px;padding:6px;border:1px solid #E4DFD2;border-radius:6px">' +
        '</td>' +
        '<td>' +
          '<input type="text" id="notes-' + rid + '" ' +
            'value="' + escapeHtml(r.teacherNotes || '') + '" placeholder="หมายเหตุ..." ' +
            'style="width:150px;padding:6px;border:1px solid #E4DFD2;border-radius:6px">' +
        '</td>' +
        '<td>' +
          '<button class="btn ' + (r.isGraded ? 'btn-ghost' : 'btn-primary') + '" ' +
            'id="grade-btn-' + rid + '" onclick="saveGrade(\'' + rid + '\')">' +
            (r.isGraded ? '✓ บันทึกแล้ว' : 'บันทึก') +
          '</button>' +
        '</td>' +
      '</tr>';
  });

  return html + '</tbody></table></div>';
}

function saveGrade(recordingId) {
  var scoreEl = document.getElementById('score-' + recordingId);
  var notesEl = document.getElementById('notes-' + recordingId);
  var score   = scoreEl ? scoreEl.value.trim() : '';
  var notes   = notesEl ? notesEl.value.trim() : '';

  if (score === '' || isNaN(Number(score)) || Number(score) < 0 || Number(score) > 100) {
    showToast('กรุณากรอกคะแนน 0-100');
    return;
  }

  var btn = document.getElementById('grade-btn-' + recordingId);
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }

  callApi('gradeRecording', {
    token: AppState.token, recordingId: recordingId,
    score: score, notes: notes
  })
  .then(function (res) {
    if (!res.success) {
      showToast(res.message);
      if (btn) { btn.disabled = false; btn.textContent = 'บันทึก'; }
      return;
    }
    showToast('บันทึกคะแนนแล้ว');
    if (btn) { btn.disabled = false; btn.textContent = '✓ บันทึกแล้ว'; btn.className = 'btn btn-ghost'; }
    var row = document.getElementById('row-' + recordingId);
    if (row) row.style.background = '';
  })
  .catch(function (err) {
    onApiError(err);
    if (btn) { btn.disabled = false; btn.textContent = 'บันทึก'; }
  });
}
