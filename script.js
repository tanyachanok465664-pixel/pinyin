const speechKey = "";
const speechRegion = "southeastasia";

var API_BASE_URL = "https://script.google.com/macros/s/AKfycbxIMAkjisB3GzQ2wy5uE3eP2s7cfCpBvw5j3c8uk75_8eDwkrkApJ-l95pOaNMNVCQ/exec";

var _jsonpCounter = 0;

function callApi(action, payload) {
  return new Promise(function(resolve, reject) {
    var callbackName = "_aiplCallback" + (_jsonpCounter++);
    var script = document.createElement("script");

    function cleanup() {
      clearTimeout(timeoutId);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    var timeoutId = setTimeout(function() {
      cleanup();
      reject(new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ"));
    }, 15000);

    window[callbackName] = function(result) {
      cleanup();
      resolve(result);
    };

    script.onerror = function() {
      cleanup();
      reject(new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ"));
    };

    script.src =
      API_BASE_URL +
      "?action=" + encodeURIComponent(action) +
      "&payload=" + encodeURIComponent(JSON.stringify(payload || {})) +
      "&callback=" + callbackName;

    document.head.appendChild(script);
  });
}

var AppState = { token: null, user: null };

var MODULES = [
  { title: "GPAS 5 Steps", active: true, action: "showView('gpas')" },
  { title: "Phonetic Lab — ห้องเสียงสัทอักษร", active: true, action: "openPhoneticLab()" },
  { title: "Minimal Pair Lab" },
  { title: "Pronunciation Practice" },
  { title: "AI Coach" },
  { title: "AI Diagnostic Test" },
  { title: "แผนการเรียนรู้ส่วนบุคคล" },
  { title: "Pretest" },
  { title: "Posttest" },
  { title: "พอร์ตโฟลิโอ" },
  { title: "Pronunciation Passport" },
  { title: "ภารกิจรายสัปดาห์" },
  { title: "กระดานผู้นำ" }
];

window.addEventListener("load", function() {
  var token = sessionStorage.getItem("aipl_token");
  if (!token) {
    showView("login");
    return;
  }

  callApi("validateSession", { token: token })
    .then(onSessionRestored)
    .catch(onSessionLost);
});

function onSessionRestored(res) {
  if (!res.success) {
    onSessionLost();
    return;
  }

  AppState.token = sessionStorage.getItem("aipl_token");
  AppState.user = res.user;
  routeToRoleHome();
}

function onSessionLost() {
  sessionStorage.removeItem("aipl_token");
  showView("login");
}

function showView(name) {
  document.querySelectorAll(".view").forEach(function(v) {
    v.classList.remove("active");
  });

  var view = document.getElementById("view-" + name);
  if (view) view.classList.add("active");
}

/* LOGIN */

var AuthState = { role: "student", mode: "login" };

function switchLoginRole(role) {
  AuthState.role = role;

  document.getElementById("tab-student").classList.toggle("active", role === "student");
  document.getElementById("tab-teacher").classList.toggle("active", role === "teacher");

  hideLoginError();
  updateAuthFormVisibility();
}

function toggleAuthMode() {
  AuthState.mode = AuthState.mode === "login" ? "register" : "login";
  hideLoginError();
  updateAuthFormVisibility();
}

function updateAuthFormVisibility() {
  document.getElementById("form-student-login").style.display =
    AuthState.role === "student" && AuthState.mode === "login" ? "block" : "none";

  document.getElementById("form-teacher-login").style.display =
    AuthState.role === "teacher" && AuthState.mode === "login" ? "block" : "none";

  document.getElementById("form-student-register").style.display =
    AuthState.role === "student" && AuthState.mode === "register" ? "block" : "none";

  document.getElementById("form-teacher-register").style.display =
    AuthState.role === "teacher" && AuthState.mode === "register" ? "block" : "none";

  document.getElementById("auth-switch-text").textContent =
    AuthState.mode === "login" ? "ยังไม่มีบัญชี?" : "มีบัญชีอยู่แล้ว?";

  document.getElementById("auth-switch-btn").textContent =
    AuthState.mode === "login" ? "สร้างบัญชีใหม่" : "เข้าสู่ระบบ";
}

function showLoginError(message) {
  var el = document.getElementById("login-error");
  el.textContent = message;
  el.classList.add("show");
}

function hideLoginError() {
  document.getElementById("login-error").classList.remove("show");
}

function handleStudentLogin(e) {
  e.preventDefault();
  hideLoginError();

  var btn = document.getElementById("student-login-btn");
  btn.disabled = true;
  btn.textContent = "กำลังเข้าสู่ระบบ...";

  callApi("loginStudent", {
    studentId: document.getElementById("student-id").value.trim(),
    password: document.getElementById("student-password").value
  })
    .then(function(res) {
      onLoginResult(res, btn, "เข้าสู่ระบบ");
    })
    .catch(function(err) {
      onLoginFailure(err, btn, "เข้าสู่ระบบ");
    });
}

function handleTeacherLogin(e) {
  e.preventDefault();
  hideLoginError();

  var btn = document.getElementById("teacher-login-btn");
  btn.disabled = true;
  btn.textContent = "กำลังเข้าสู่ระบบ...";

  callApi("loginTeacher", {
    username: document.getElementById("teacher-username").value.trim(),
    password: document.getElementById("teacher-password").value
  })
    .then(function(res) {
      onLoginResult(res, btn, "เข้าสู่ระบบ");
    })
    .catch(function(err) {
      onLoginFailure(err, btn, "เข้าสู่ระบบ");
    });
}

function handleStudentRegister(e) {
  e.preventDefault();
  hideLoginError();

  var pw = document.getElementById("reg-student-password").value;
  var pwConfirm = document.getElementById("reg-student-password-confirm").value;

  if (pw !== pwConfirm) {
    showLoginError("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
    return;
  }

  var btn = document.getElementById("student-register-btn");
  btn.disabled = true;
  btn.textContent = "กำลังสร้างบัญชี...";

  callApi("registerStudent", {
    fullName: document.getElementById("reg-student-name").value.trim(),
    classRoom: document.getElementById("reg-student-class").value.trim(),
    username: document.getElementById("reg-student-username").value.trim(),
    password: pw
  })
    .then(function(res) {
      onLoginResult(res, btn, "สร้างบัญชี");
    })
    .catch(function(err) {
      onLoginFailure(err, btn, "สร้างบัญชี");
    });
}

function handleTeacherRegister(e) {
  e.preventDefault();
  hideLoginError();

  var pw = document.getElementById("reg-teacher-password").value;
  var pwConfirm = document.getElementById("reg-teacher-password-confirm").value;

  if (pw !== pwConfirm) {
    showLoginError("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
    return;
  }

  var btn = document.getElementById("teacher-register-btn");
  btn.disabled = true;
  btn.textContent = "กำลังสร้างบัญชี...";

  callApi("registerTeacher", {
    fullName: document.getElementById("reg-teacher-name").value.trim(),
    username: document.getElementById("reg-teacher-username").value.trim(),
    password: pw
  })
    .then(function(res) {
      onLoginResult(res, btn, "สร้างบัญชี");
    })
    .catch(function(err) {
      onLoginFailure(err, btn, "สร้างบัญชี");
    });
}

function onLoginResult(res, btn, label) {
  btn.disabled = false;
  btn.textContent = label;

  if (!res.success) {
    showLoginError(res.message);
    return;
  }

  sessionStorage.setItem("aipl_token", res.token);
  AppState.token = res.token;
  AppState.user = res.user;
  routeToRoleHome();
}

function onLoginFailure(err, btn, label) {
  btn.disabled = false;
  btn.textContent = label;
  showLoginError("เชื่อมต่อระบบไม่สำเร็จ: " + err.message);
}

function routeToRoleHome() {
  if (AppState.user.role === "teacher") {
    document.getElementById("teacher-name").textContent = AppState.user.name;
    showView("teacher");
    loadDashboardSummary();
    loadStudentList();
  } else {
    document.getElementById("home-student-name").textContent = AppState.user.name;
    document.getElementById("home-student-class").textContent = AppState.user.classRoom;
    renderModuleGrid();
    showView("home");
  }
}

function handleLogout() {
  if (AppState.token) {
    callApi("logout", { token: AppState.token }).catch(function() {});
  }

  sessionStorage.removeItem("aipl_token");
  AppState.token = null;
  AppState.user = null;

  AuthState.role = "student";
  AuthState.mode = "login";
  switchLoginRole("student");
  showView("login");
}

/* HOME */

function renderModuleGrid() {
  var grid = document.getElementById("module-grid");

  grid.innerHTML = MODULES.map(function(m) {
    if (m.active) {
      return (
        '<div class="module-card is-active" onclick="' + m.action + '">' +
        "<h3>" + m.title + "</h3>" +
        '<span class="pill pill-active">พร้อมใช้งาน</span>' +
        "</div>"
      );
    }

    return (
      '<div class="module-card is-locked" onclick="showToast(\'โมดูลนี้จะเปิดให้ใช้งานในเฟสถัดไป\')">' +
      "<h3>" + m.title + "</h3>" +
      '<span class="pill pill-locked">เร็ว ๆ นี้</span>' +
      "</div>"
    );
  }).join("");
}

/* TEACHER */

function switchTeacherTab(name) {
  document.querySelectorAll(".tab-btn").forEach(function(b) {
    if (!b.classList.contains("is-locked")) b.classList.remove("active");
  });

  document.querySelectorAll(".tab-panel").forEach(function(p) {
    p.classList.remove("active");
  });

  if (event && event.currentTarget) event.currentTarget.classList.add("active");

  var panel = document.getElementById("panel-" + name);
  if (panel) panel.classList.add("active");

  if (name === "students") loadStudentList();
  if (name === "phonetic-items") loadPracticeItemsAdmin();
}

function showLockedNotice() {
  showToast("ฟีเจอร์นี้จะเปิดให้ใช้งานในเฟสถัดไป");
}

function loadDashboardSummary() {
  callApi("getDashboardSummary", { token: AppState.token })
    .then(function(res) {
      if (!res.success) {
        onApiError(res);
        return;
      }

      document.getElementById("stat-total").textContent = res.summary.totalStudents;
      document.getElementById("stat-active").textContent = res.summary.activeStudents;
      document.getElementById("stat-today").textContent = res.summary.loggedInToday;
    })
    .catch(onApiError);
}

function loadStudentList() {
  callApi("getStudentList", { token: AppState.token })
    .then(renderStudentTable)
    .catch(onApiError);
}

function renderStudentTable(res) {
  if (!res.success) {
    onApiError(res);
    return;
  }

  var tbody = document.getElementById("student-table-body");
  var emptyState = document.getElementById("student-empty-state");

  if (!res.students || res.students.length === 0) {
    tbody.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  tbody.innerHTML = res.students.map(function(s) {
    var isActive = s.status !== "Inactive";

    return (
      "<tr>" +
      "<td>" + escapeHtml(s.studentId) + "</td>" +
      "<td>" + escapeHtml(s.fullName) + "</td>" +
      "<td>" + escapeHtml(s.classRoom) + "</td>" +
      '<td><span class="status-badge ' + (isActive ? "status-active" : "status-inactive") + '">' +
      (isActive ? "ใช้งานได้" : "ระงับแล้ว") +
      "</span></td>" +
      "<td>" + formatDateThai(s.lastLogin) + "</td>" +
      '<td class="row-actions">' +
      '<button class="btn btn-ghost" onclick="toggleStudentStatus(\'' + s.studentId + "','" + s.status + "')\">" +
      (isActive ? "ระงับ" : "เปิดใช้") +
      "</button>" +
      '<button class="btn btn-ghost" onclick="resetPassword(\'' + s.studentId + "')\">รีเซ็ตรหัสผ่าน</button>" +
      "</td>" +
      "</tr>"
    );
  }).join("");
}

function openAddStudentModal() {
  document.getElementById("form-add-student").reset();
  document.getElementById("modal-add-student").classList.add("show");
}

function handleAddStudent(e) {
  e.preventDefault();

  callApi("addStudent", {
    token: AppState.token,
    fullName: document.getElementById("new-student-name").value.trim(),
    classRoom: document.getElementById("new-student-class").value.trim()
  })
    .then(onStudentAdded)
    .catch(onApiError);
}

function onStudentAdded(res) {
  if (!res.success) {
    showToast(res.message);
    return;
  }

  closeModal("modal-add-student");

  document.getElementById("cred-id").textContent = res.studentId;
  document.getElementById("cred-password").textContent = res.password;
  document.getElementById("modal-credentials").classList.add("show");

  loadStudentList();
  loadDashboardSummary();
}

function toggleStudentStatus(studentId, currentStatus) {
  var newStatus = currentStatus === "Inactive" ? "Active" : "Inactive";

  if (!confirm(newStatus === "Inactive" ? "ระงับการใช้งานนักเรียนคนนี้?" : "เปิดการใช้งานนักเรียนคนนี้อีกครั้ง?")) return;

  callApi("setStudentStatus", {
    token: AppState.token,
    studentId: studentId,
    newStatus: newStatus
  })
    .then(function(res) {
      if (!res.success) {
        showToast(res.message);
        return;
      }

      loadStudentList();
      loadDashboardSummary();
    })
    .catch(onApiError);
}

function resetPassword(studentId) {
  if (!confirm("สร้างรหัสผ่านใหม่ให้นักเรียนคนนี้?")) return;

  callApi("resetStudentPassword", {
    token: AppState.token,
    studentId: studentId
  })
    .then(function(res) {
      if (!res.success) {
        showToast(res.message);
        return;
      }

      document.getElementById("cred-id").textContent = studentId;
      document.getElementById("cred-password").textContent = res.password;
      document.getElementById("modal-credentials").classList.add("show");
    })
    .catch(onApiError);
}

function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove("show");
}

/* PRACTICE ITEMS ADMIN */

var PracticeItemsAdminState = { items: [] };

function loadPracticeItemsAdmin() {
  callApi("getPracticeItemsAdmin", { token: AppState.token })
    .then(function(res) {
      if (!res.success) {
        onApiError(res);
        return;
      }

      PracticeItemsAdminState.items = res.items || [];
      renderPracticeItemsAdminTable();
    })
    .catch(onApiError);
}

function renderPracticeItemsAdminTable() {
  var tbody = document.getElementById("pi-table-body");
  var emptyState = document.getElementById("pi-empty-state");
  var filterVal = document.getElementById("pi-filter-module").value;

  var items = PracticeItemsAdminState.items.filter(function(i) {
    return !filterVal || i.Module === filterVal;
  });

  if (items.length === 0) {
    tbody.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  tbody.innerHTML = items.map(function(i) {
    return (
      "<tr>" +
      "<td>" + escapeHtml(i.ItemID) + "</td>" +
      "<td>" + escapeHtml(i.Module) + "</td>" +
      "<td>" + escapeHtml(i.Type) + "</td>" +
      "<td>" + escapeHtml(i.Pinyin) + "</td>" +
      "<td>" + escapeHtml(i.ThaiSound || "-") + "</td>" +
      "<td>" + escapeHtml(i.ExampleWord || "-") + "</td>" +
      '<td><button class="btn btn-ghost" onclick="openEditPracticeItemModal(\'' + i.ItemID + "')\">แก้ไข</button></td>" +
      "</tr>"
    );
  }).join("");
}

function openAddPracticeItemModal() {
  document.getElementById("form-edit-practice-item").reset();
  document.getElementById("pi-item-id").value = "";
  document.getElementById("pi-modal-title").textContent = "เพิ่มรายการใหม่";
  document.getElementById("pi-delete-btn").style.display = "none";
  document.getElementById("modal-edit-practice-item").classList.add("show");
}

function openEditPracticeItemModal(itemId) {
  var item = PracticeItemsAdminState.items.find(function(i) {
    return i.ItemID === itemId;
  });

  if (!item) {
    showToast("ไม่พบรายการนี้");
    return;
  }

  document.getElementById("form-edit-practice-item").reset();
  document.getElementById("pi-item-id").value = item.ItemID;
  document.getElementById("pi-modal-title").textContent = "แก้ไขรายการ: " + item.ItemID;
  document.getElementById("pi-delete-btn").style.display = "inline-block";

  document.getElementById("pi-module").value = item.Module || "Initials";
  document.getElementById("pi-type").value = item.Type || "";
  document.getElementById("pi-pinyin").value = item.Pinyin || "";
  document.getElementById("pi-tone-number").value = item.ToneNumber || "";
  document.getElementById("pi-thai-sound").value = item.ThaiSound || "";
  document.getElementById("pi-articulation").value = item.Articulation || "";
  document.getElementById("pi-diagram-key").value = item.DiagramKey || "";
  document.getElementById("pi-example-word").value = item.ExampleWord || "";
  document.getElementById("pi-example-pinyin").value = item.ExamplePinyin || "";
  document.getElementById("pi-example-meaning").value = item.ExampleMeaning || "";
  document.getElementById("pi-audio-url").value = item.AudioURL || "";
  document.getElementById("pi-example-audio-url").value = item.ExampleAudioURL || "";
  document.getElementById("pi-image-url").value = item.ImageURL || "";
  document.getElementById("pi-level").value = item.Level || 1;

  document.getElementById("modal-edit-practice-item").classList.add("show");
}

function collectPracticeItemFormFields() {
  return {
    Module: document.getElementById("pi-module").value,
    Type: document.getElementById("pi-type").value.trim(),
    Pinyin: document.getElementById("pi-pinyin").value.trim(),
    ToneNumber: document.getElementById("pi-tone-number").value || "",
    ThaiSound: document.getElementById("pi-thai-sound").value.trim(),
    Articulation: document.getElementById("pi-articulation").value.trim(),
    DiagramKey: document.getElementById("pi-diagram-key").value.trim(),
    ExampleWord: document.getElementById("pi-example-word").value.trim(),
    ExamplePinyin: document.getElementById("pi-example-pinyin").value.trim(),
    ExampleMeaning: document.getElementById("pi-example-meaning").value.trim(),
    AudioURL: document.getElementById("pi-audio-url").value.trim(),
    ExampleAudioURL: document.getElementById("pi-example-audio-url").value.trim(),
    ImageURL: document.getElementById("pi-image-url").value.trim(),
    Level: document.getElementById("pi-level").value || 1
  };
}

function handleSavePracticeItem(e) {
  e.preventDefault();

  var itemId = document.getElementById("pi-item-id").value;
  var fields = collectPracticeItemFormFields();

  callApi(itemId ? "updatePracticeItem" : "addPracticeItem", itemId ? {
    token: AppState.token,
    itemId: itemId,
    fields: fields
  } : {
    token: AppState.token,
    fields: fields
  })
    .then(function(res) {
      if (!res.success) {
        showToast(res.message);
        return;
      }

      closeModal("modal-edit-practice-item");
      showToast("บันทึกแล้ว");
      loadPracticeItemsAdmin();
    })
    .catch(onApiError);
}

function handleDeletePracticeItem() {
  var itemId = document.getElementById("pi-item-id").value;
  if (!itemId) return;

  if (!confirm("ลบรายการนี้?")) return;

  callApi("deletePracticeItem", {
    token: AppState.token,
    itemId: itemId
  })
    .then(function(res) {
      if (!res.success) {
        showToast(res.message);
        return;
      }

      closeModal("modal-edit-practice-item");
      showToast("ลบรายการแล้ว");
      loadPracticeItemsAdmin();
    })
    .catch(onApiError);
}

/* DIAGRAM */

function renderArticulationDiagram(svgId, diagramKey) {
  var svg = document.getElementById(svgId);
  if (!svg) return;
  svg.innerHTML =
    '<circle cx="80" cy="60" r="35" fill="#F6F3EC" stroke="#1F2430" stroke-width="2"></circle>' +
    '<ellipse cx="100" cy="75" rx="28" ry="10" fill="#E8A79A" stroke="#C8472E" stroke-width="2"></ellipse>';
}

function articulationMannerLabel(diagramKey) {
  return "แผนภาพตำแหน่งปาก/ลิ้นโดยประมาณ";
}

function renderFinalDiagram(svgId, diagramKey) {
  var svg = document.getElementById(svgId);
  if (!svg) return;
  svg.innerHTML =
    '<ellipse cx="60" cy="50" rx="34" ry="18" fill="none" stroke="#C8472E" stroke-width="3"></ellipse>';
}

function renderToneGraph(svgId, highlightTone) {
  var svg = document.getElementById(svgId);
  if (!svg) return;
  svg.setAttribute("viewBox", "0 0 320 170");
  svg.innerHTML =
    '<polyline points="30,80 290,80" fill="none" stroke="#C8472E" stroke-width="3"></polyline>' +
    '<polyline points="30,120 110,100 190,70 290,35" fill="none" stroke="#2F7A5E" stroke-width="3"></polyline>' +
    '<polyline points="30,80 110,120 190,110 290,60" fill="none" stroke="#1F2430" stroke-width="3"></polyline>' +
    '<polyline points="30,35 110,70 190,100 290,130" fill="none" stroke="#B5781F" stroke-width="3"></polyline>';
}

/* PHONETIC LAB */

var PhoneticState = {
  currentModule: "Initials",
  items: [],
  currentItem: null,
  currentItemIdx: 0,
  mediaRecorder: null,
  audioChunks: [],
  stream: null,
  isRecording: false,
  recordedBlobUrl: null,
  practicedItemIds: {},
  practiceCounts: {},
  currentAudioEl: null
};

function openPhoneticLab() {
  showView("phonetic");
  switchToModuleTab("Initials");
  loadPhoneticItems("Initials");
}

function switchPhoneticModule(moduleName) {
  document.querySelectorAll(".sub-tab-btn").forEach(function(b) {
    b.classList.remove("active");
  });

  if (event && event.currentTarget) event.currentTarget.classList.add("active");

  switchToModuleTab(moduleName);
  loadPhoneticItems(moduleName);
}

function switchToModuleTab(moduleName) {
  PhoneticState.currentModule = moduleName;

  var overview = document.getElementById("tone-overview-card");

  if (overview) {
    overview.style.display = moduleName === "Tones" ? "block" : "none";
    if (moduleName === "Tones") renderToneGraph("tone-overview-svg", null);
  }
}

function loadPhoneticItems(moduleName) {
  var grid = document.getElementById("phonetic-item-grid");
  grid.innerHTML = '<div class="empty-state">กำลังโหลด...</div>';

  callApi("getPracticeItems", {
    token: AppState.token,
    moduleName: moduleName
  })
    .then(function(res) {
      if (!res.success) {
        grid.innerHTML = '<div class="empty-state">เกิดข้อผิดพลาด: ' + escapeHtml(res.message) + "</div>";
        return;
      }

      PhoneticState.items = res.items || [];
      renderPhoneticGrid(PhoneticState.items);
    })
    .catch(function(err) {
      grid.innerHTML = '<div class="empty-state">โหลดไม่ได้: ' + escapeHtml(err.message) + "</div>";
    });
}

function renderPhoneticGrid(items) {
  var grid = document.getElementById("phonetic-item-grid");

  if (!items || items.length === 0) {
    grid.innerHTML = '<div class="empty-state">ไม่พบข้อมูลใน PracticeItems</div>';
    return;
  }

  var isTones = PhoneticState.currentModule === "Tones";

  grid.innerHTML = items.map(function(it, idx) {
    var typeLabel = isTones ? "เสียง " + it.toneNumber : it.type;
    var subLabel = isTones ? it.exampleWord
