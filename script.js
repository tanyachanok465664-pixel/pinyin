const speechKey = "";
const speechRegion = "southeastasia";

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
 * เรียก Apps Script API หนึ่งฟังก์ชัน — ใช้เทคนิค JSONP (โหลดผ่าน <script> tag)
 * ไม่ใช้ fetch() เพราะพบว่า Apps Script web app ตอบกลับ fetch() ข้าม origin ด้วยหน้า
 * error ของ Google เอง (HTTP 404) ระหว่าง redirect ภายในของระบบ ทั้งที่ URL เดียวกัน
 * เปิดตรง ๆ ในเบราว์เซอร์ใช้ได้ปกติ — การโหลดผ่าน <script> tag ไม่ติดปัญหานี้ เพราะ
 * ไม่ถูกจำกัดด้วย CORS แบบเดียวกับ fetch()/XHR
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

function showView(name) {
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  document.getElementById('view-' + name).classList.add('active');
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

function routeToRoleHome() {
  if (AppState.user.role === 'teacher') {
    document.getElementById('teacher-name').textContent = AppState.user.name;
    showView('teacher');
    loadDashboardSummary();
    loadStudentList();
  } else {
    document.getElementById('home-student-name').textContent = AppState.user.name;
    document.getElementById('home-student-class').textContent = AppState.user.classRoom;
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
  event.currentTarget.classList.add('active');
  document.getElementById('panel-' + name).classList.add('active');
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

  /**
   * DiagramJS — เครื่องสร้างไดอะแกรมปาก/ลิ้น/กระแสลม สำหรับพยัญชนะต้น
   * เครื่องสร้างไดอะแกรมรูปปาก สำหรับสระ/ส่วนท้าย
   * และกราฟเส้นวรรณยุกต์ สำหรับ Tone Lab
   * วาดด้วย SVG ที่สร้างแบบพารามิเตอร์ (ไม่ใช่ภาพถ่าย) เพื่อความสอดคล้องของข้อมูลตำแหน่งออกเสียง
   */

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

  /**
   * Phonetic Lab — ห้องปฏิบัติการเสียง (เฟส 2.1)
   * แสดงไดอะแกรมการออกเสียง คำอ่านเทียบเสียงไทย คำอธิบายการออกเสียง คำศัพท์ตัวอย่าง
   * ฟังเสียง 2 แบบ (หน่วยเสียงเดี่ยว / คำตัวอย่าง) และฝึกพูดตามแล้วฟังเสียงตัวเอง
   * (บันทึก-เล่นกลับชั่วคราว ไม่มีการประเมินผลด้วย AI — จะเพิ่มในเฟส 2.2)
   */

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
        console.log('Phonetic Lab items (' + moduleName + '):', res.items);
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

  /* เลือกเสียงพากย์ภาษาจีนที่คุณภาพดีที่สุดที่เบราว์เซอร์มีให้ (บางเบราว์เซอร์มีหลายเสียงให้เลือก
     เสียงที่มาจาก Google/Microsoft มักจะฟังเป็นธรรมชาติกว่าเสียง default ของระบบปฏิบัติการ) */
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

    // หน่วงเล็กน้อยก่อนเล่นเสียงใหม่จริง เพราะ speechSynthesis.cancel() ในหลายเบราว์เซอร์ (เช่น Chrome)
    // ไม่เคลียร์คำขอเดิมทันทีแบบ synchronous ถ้าเรียก speak() ติดกันจะได้ยินเสียงของรายการก่อนหน้าค้างอยู่แทน
    PhoneticState.speechRequestId = (PhoneticState.speechRequestId || 0) + 1;
    var requestId = PhoneticState.speechRequestId;
    setTimeout(function () {
      if (requestId !== PhoneticState.speechRequestId) return; // มีคำขอใหม่กว่าเข้ามาแทนที่แล้ว ไม่ต้องพูดคำขอนี้
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
        var blob = new Blob(PhoneticState.audioChunks, { type: 'audio/webm' });
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
function callApiPost(action, payload) {
  return fetch(API_BASE_URL, {
    method: "POST",
    body: JSON.stringify({
      action: action,
      payload: payload || {}
    })
  }).then(function(res) {
    return res.json();
  });
}
function callApiPost(action, payload) {
  return fetch(API_BASE_URL, {
    method: "POST",
    body: JSON.stringify({
      action: action,
      payload: payload || {}
    })
  }).then(function(res) {
    return res.json();
  });
}

async function startAzurePronunciation() {

  const item = PhoneticState.currentItem;

  if (!item) {
    showToast("ไม่พบคำที่ต้องฝึก");
    return;
  }

  const targetText = item.exampleWord || item.pinyin;

  const panel = document.getElementById("azure-score-panel");
  panel.style.display = "block";
  panel.innerHTML = "🎤 กำลังขอสิทธิ์ไมโครโฟน...";

  try {

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    const recorder = new MediaRecorder(stream);
    const chunks = [];

    recorder.ondataavailable = e => {
      chunks.push(e.data);
    };

    recorder.onstop = async () => {

      panel.innerHTML = "⏳ กำลังส่งเสียงไปประเมิน...";

      const blob = new Blob(chunks, {
        type: "audio/webm"
      });

      const reader = new FileReader();

      reader.onloadend = function() {

        const base64 =
          reader.result.split(",")[1];

        .then(function(res) {

          if (!res.success) {
            panel.innerHTML =
              "❌ " + res.message;
            return;
          }

          panel.innerHTML = `
            <h3>🤖 ผลประเมิน AI</h3>
            <p>คำที่ฝึก: <b>${res.referenceText}</b></p>
            <p>คะแนนรวม: <b>${res.pronunciationScore}</b></p>
            <p>ความถูกต้อง: <b>${res.accuracyScore}</b></p>
            <p>ความคล่อง: <b>${res.fluencyScore}</b></p>
            <p>พูดครบถ้วน: <b>${res.completenessScore}</b></p>
          `;
        });
      };

      reader.readAsDataURL(blob);

      stream.getTracks().forEach(t => t.stop());
    };

    recorder.start();

    panel.innerHTML =
      "🎙️ กำลังบันทึกเสียง 4 วินาที...";

    setTimeout(() => {
      recorder.stop();
    }, 1500);

  } catch(err) {

    panel.innerHTML =
      "❌ ไม่สามารถใช้ไมโครโฟนได้<br>" +
      err.message;
  }
}

function startAzurePronunciation() {
  const item = PhoneticState.currentItem;

  if (!item) {
    showToast("ไม่พบคำที่ต้องฝึก");
    return;
  }

  const targetText = item.exampleWord || item.pinyin;
  const panel = document.getElementById("azure-score-panel");

  panel.style.display = "block";
  panel.innerHTML = "🎤 ระบบกลับมาใช้งานได้แล้ว กำลังทดสอบการเชื่อมต่อ...";

  callApi("assessPronunciation", {
    token: AppState.token,
    referenceText: targetText,
    audioBase64: "TEST_AUDIO"
  }).then(function(res) {
    if (!res.success) {
      panel.innerHTML = "❌ " + res.message;
      return;
    }

    panel.innerHTML = `
      <h3>🤖 ผลประเมิน AI</h3>
      <p>คำที่ฝึก: <b>${res.referenceText}</b></p>
      <p>คะแนนรวม: <b>${res.pronunciationScore}</b></p>
      <p>ความถูกต้อง: <b>${res.accuracyScore}</b></p>
      <p>ความคล่อง: <b>${res.fluencyScore}</b></p>
      <p>พูดครบถ้วน: <b>${res.completenessScore}</b></p>
    `;
  }).catch(function(err) {
    panel.innerHTML = "❌ เชื่อมต่อไม่ได้: " + err.message;
  });
}
