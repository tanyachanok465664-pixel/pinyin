function callApiPost(action, payload) {
  return fetch(API_BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: action,
      payload: payload || {}
    })
  })
    .then(function (res) {
      return res.text();
    })
    .then(function (text) {
      try {
        return JSON.parse(text);
      } catch (e) {
        return {
          success: false,
          ok: false,
          message: "Backend ตอบกลับไม่ใช่ JSON: " + text
        };
      }
    });
}

function arrayBufferToBase64(buffer) {
  var bytes = new Uint8Array(buffer);
  var binary = "";
  var chunkSize = 0x8000;

  for (var i = 0; i < bytes.length; i += chunkSize) {
    var chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }

  return btoa(binary);
}

function audioBufferToWav(audioBuffer) {
  var TARGET_SAMPLE_RATE = 16000;

  var offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(audioBuffer.duration * TARGET_SAMPLE_RATE),
    TARGET_SAMPLE_RATE
  );

  var source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  return offlineCtx.startRendering().then(function (rendered) {
    var samples = rendered.getChannelData(0);
    var dataLen = samples.length * 2;
    var buffer = new ArrayBuffer(44 + dataLen);
    var view = new DataView(buffer);

    function writeStr(offset, str) {
      for (var i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    }

    writeStr(0, "RIFF");
    view.setUint32(4, 36 + dataLen, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, TARGET_SAMPLE_RATE, true);
    view.setUint32(28, TARGET_SAMPLE_RATE * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, dataLen, true);

    var offset = 44;
    for (var i = 0; i < samples.length; i++) {
      var s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    return buffer;
  });
}

var AzureRecordState = {
  mediaRecorder: null,
  chunks: [],
  stream: null,
  isRecording: false,
  webmBlobUrl: null,
  maxMs: 15000
};

function startAzurePronunciation() {
  var item = PhoneticState.currentItem;

  if (!item) {
    showToast("ไม่พบคำที่ต้องฝึก");
    return;
  }

  var panel = document.getElementById("azure-score-panel");

  if (!panel) {
    showToast('ไม่พบ element id="azure-score-panel"');
    return;
  }

  panel.style.display = "block";
  panel.innerHTML = "🎤 กำลังขอสิทธิ์ไมโครโฟน...";

  navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then(function (stream) {
      AzureRecordState.stream = stream;
      AzureRecordState.chunks = [];
      AzureRecordState.mediaRecorder = new MediaRecorder(stream);
      AzureRecordState.isRecording = true;

      AzureRecordState.mediaRecorder.ondataavailable = function (e) {
        if (e.data && e.data.size > 0) {
          AzureRecordState.chunks.push(e.data);
        }
      };

      AzureRecordState.mediaRecorder.onstop = function () {
        stream.getTracks().forEach(function (t) {
          t.stop();
        });
        renderAzureReviewStep(panel);
      };

      AzureRecordState.mediaRecorder.start();

      var targetText = item.exampleWord || item.targetWord || item.pinyin || "";

      panel.innerHTML =
        '🎙️ กำลังบันทึกเสียง... พูดคำว่า <b class="hanzi">' +
        escapeHtml(targetText) +
        '</b><br><button class="btn btn-primary" style="margin-top:8px" onclick="stopAzureRecording()">⏹ หยุดบันทึก</button>';

      setTimeout(function () {
        if (AzureRecordState.isRecording) {
          stopAzureRecording();
        }
      }, AzureRecordState.maxMs);
    })
    .catch(function (err) {
      panel.innerHTML = "❌ ไม่สามารถใช้ไมโครโฟนได้: " + escapeHtml(err.message);
    });
}

function stopAzureRecording() {
  if (!AzureRecordState.isRecording) return;

  AzureRecordState.isRecording = false;

  if (
    AzureRecordState.mediaRecorder &&
    AzureRecordState.mediaRecorder.state !== "inactive"
  ) {
    AzureRecordState.mediaRecorder.stop();
  }
}

function renderAzureReviewStep(panel) {
  var blob = new Blob(AzureRecordState.chunks, { type: "audio/webm" });

  if (AzureRecordState.webmBlobUrl) {
    URL.revokeObjectURL(AzureRecordState.webmBlobUrl);
  }

  AzureRecordState.webmBlobUrl = URL.createObjectURL(blob);

  panel.innerHTML =
    "<p>✅ บันทึกเสียงเสร็จแล้ว ลองฟังก่อนส่งประเมิน:</p>" +
    '<audio controls src="' + AzureRecordState.webmBlobUrl + '" style="width:100%"></audio>' +
    '<div style="display:flex;gap:10px;margin-top:10px">' +
    '<button class="btn btn-ghost" style="flex:1" onclick="startAzurePronunciation()">🔁 บันทึกใหม่</button>' +
    '<button class="btn btn-primary" style="flex:1" onclick="sendAzureRecordingForAssessment()">📤 ส่งประเมินผล</button>' +
    "</div>";
}

function sendAzureRecordingForAssessment() {
  var item = PhoneticState.currentItem;

  if (!item) {
    showToast("ไม่พบคำที่ต้องฝึก");
    return;
  }

  var targetText = item.exampleWord || item.targetWord || item.pinyin || "";
  var panel = document.getElementById("azure-score-panel");

  panel.innerHTML = "🔄 กำลังแปลงเสียงเป็น WAV...";

  var blob = new Blob(AzureRecordState.chunks, { type: "audio/webm" });
  var reader = new FileReader();

  reader.onloadend = function () {
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    audioCtx.decodeAudioData(reader.result)
      .then(function (audioBuffer) {
        return audioBufferToWav(audioBuffer);
      })
      .then(function (wavBuffer) {
        audioCtx.close();

        var base64 = arrayBufferToBase64(wavBuffer);

        panel.innerHTML = "⏳ กำลังส่งเสียงไปประเมิน...";

        return callApiPost("assessPronunciation", {
          token: AppState.token,
          referenceText: targetText,
          audioBase64: base64,
          itemId: item.itemId || item.ItemID || ""
        });
      })
      .then(function (res) {
        renderAzureResult(panel, res);
      })
      .catch(function (err) {
        panel.innerHTML =
          "❌ เกิดข้อผิดพลาด: " +
          escapeHtml(err.message || String(err)) +
          '<div style="margin-top:10px"><button class="btn btn-ghost" onclick="startAzurePronunciation()">🔁 ลองอีกครั้ง</button></div>';
      });
  };

  reader.readAsArrayBuffer(blob);
}

function renderAzureResult(panel, res) {
  if (!res || (!res.success && !res.ok)) {
    panel.innerHTML =
      "❌ " +
      escapeHtml((res && res.message) || "ประเมินผลไม่สำเร็จ") +
      '<div style="margin-top:10px"><button class="btn btn-ghost" onclick="startAzurePronunciation()">🔁 ลองอีกครั้ง</button></div>';
    return;
  }

  var pronunciationScore = res.pronunciationScore || res.score || 0;
  var accuracyScore = res.accuracyScore || 0;
  var fluencyScore = res.fluencyScore;
  var completenessScore = res.completenessScore;

  panel.innerHTML =
    '<div class="azure-result">' +
    "<h3>🤖 ผลประเมินการออกเสียง</h3>" +
    '<p>คำที่ฝึก: <b class="hanzi">' + escapeHtml(res.referenceText || "") + "</b></p>" +
    (res.recognizedText ? "<p>ระบบจับได้ว่า: <b>" + escapeHtml(res.recognizedText) + "</b></p>" : "") +
    "<p>คะแนนรวม: <b>" + pronunciationScore + "</b></p>" +
    "<p>ความถูกต้อง: <b>" + accuracyScore + "</b></p>" +
    "<p>ความคล่อง: <b>" + (fluencyScore ?? "ไม่มีข้อมูล") + "</b></p>" +
    "<p>ความครบถ้วน: <b>" + (completenessScore ?? "ไม่มีข้อมูล") + "</b></p>" +
    '<button class="btn btn-ghost" style="margin-top:10px;width:100%" onclick="startAzurePronunciation()">🔁 ฝึกอีกครั้ง</button>' +
    "</div>";
}
