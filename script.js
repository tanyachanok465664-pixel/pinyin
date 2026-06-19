/**
 * แปลง AudioBuffer → WAV PCM (16-bit, mono) แล้วคืนเป็น ArrayBuffer
 * ต้อง resample ให้เป็น 16000 Hz ก่อนเพราะ Azure Pronunciation Assessment
 * ต้องการ 16kHz mono เท่านั้น
 */
function audioBufferToWav(audioBuffer) {
  var TARGET_SAMPLE_RATE = 16000;
  var numChannels = 1; // mono เสมอ

  return new Promise(function (resolve) {
    var offlineCtx = new OfflineAudioContext(
      numChannels,
      Math.ceil(audioBuffer.duration * TARGET_SAMPLE_RATE),
      TARGET_SAMPLE_RATE
    );
    var source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    offlineCtx.startRendering().then(function (rendered) {
      var samples = rendered.getChannelData(0); // Float32Array
      var dataLen = samples.length * 2;         // 16-bit = 2 bytes/sample
      var buffer  = new ArrayBuffer(44 + dataLen);
      var view    = new DataView(buffer);

      function writeStr(offset, str) {
        for (var i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      }

      writeStr(0,  'RIFF');
      view.setUint32(4,  36 + dataLen, true);
      writeStr(8,  'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numChannels, true);
      view.setUint32(24, TARGET_SAMPLE_RATE, true);
      view.setUint32(28, TARGET_SAMPLE_RATE * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, dataLen, true);

      var offset = 44;
      for (var i = 0; i < samples.length; i++) {
        var s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
      }

      resolve(buffer);
    });
  });
}

/** แปลง ArrayBuffer → base64 string */
function arrayBufferToBase64(buffer) {
  var bytes  = new Uint8Array(buffer);
  var binary = '';
  for (var i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/* ============================================================
 * Azure Pronunciation flow — บันทึกเอง (กดเริ่ม/กดหยุด), ฟังเสียงตัวเองก่อนส่ง,
 * แล้วค่อยส่งไปประเมิน เสียงจะถูกเก็บลง Google Drive เป็นหลักฐานเสมอ (ฝั่ง backend)
 * ไม่ว่าผลประเมินจะสำเร็จหรือไม่ก็ตาม
 * ============================================================ */

var AzureRecordState = {
  mediaRecorder: null,
  chunks: [],
  stream: null,
  isRecording: false,
  webmBlobUrl: null,
  maxMs: 15000   // เพดานบนกันลืมกดหยุด ไม่ใช่เวลาบังคับ
};

/** ปุ่มเริ่มต้น — เรียกจาก HTML แทนที่ของเดิม กดครั้งแรกเพื่อขอไมค์ + เริ่มอัด */
function startAzurePronunciation() {
  var item = PhoneticState.currentItem;
  if (!item) { showToast('ไม่พบคำที่ต้องฝึก'); return; }

  var panel = document.getElementById('azure-score-panel');
  if (!panel) { showToast('ไม่พบ element id="azure-score-panel" ใน HTML'); return; }

  panel.style.display = 'block';
  panel.innerHTML = '🎤 กำลังขอสิทธิ์ไมโครโฟน...';

  navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then(function (stream) {
      AzureRecordState.stream  = stream;
      AzureRecordState.chunks  = [];
      AzureRecordState.mediaRecorder = new MediaRecorder(stream);

      AzureRecordState.mediaRecorder.ondataavailable = function (e) {
        if (e.data.size > 0) AzureRecordState.chunks.push(e.data);
      };

      AzureRecordState.mediaRecorder.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        renderAzureReviewStep(panel);
      };

      AzureRecordState.mediaRecorder.start();
      AzureRecordState.isRecording = true;

      panel.innerHTML =
        '🎙️ กำลังบันทึกเสียง... พูดคำว่า "<b class="hanzi">' + escapeHtml(item.exampleWord || item.pinyin) + '</b>"' +
        '<br><button class="btn btn-primary" style="margin-top:8px" onclick="stopAzureRecording()">⏹ หยุดบันทึก</button>';

      // เพดานบนกันลืมกดหยุด ไม่ใช่ตัดเสียงอัตโนมัติแบบเดิม
      setTimeout(function () {
        if (AzureRecordState.isRecording) stopAzureRecording();
      }, AzureRecordState.maxMs);
    })
    .catch(function (err) {
      panel.innerHTML = '❌ ไม่สามารถใช้ไมโครโฟนได้: ' + escapeHtml(err.message);
    });
}

/** ปุ่มหยุดบันทึก — เรียกจากปุ่มที่ขึ้นมาตอนกำลังอัด */
function stopAzureRecording() {
  if (!AzureRecordState.isRecording) return;
  AzureRecordState.isRecording = false;
  if (AzureRecordState.mediaRecorder && AzureRecordState.mediaRecorder.state !== 'inactive') {
    AzureRecordState.mediaRecorder.stop();
  }
}

/** หลังหยุดอัด — แสดงเสียงที่บันทึกได้ให้ฟังก่อน พร้อมปุ่ม "ส่งประเมินผล" และ "บันทึกใหม่" */
function renderAzureReviewStep(panel) {
  var blob = new Blob(AzureRecordState.chunks, { type: 'audio/webm' });

  if (AzureRecordState.webmBlobUrl) URL.revokeObjectURL(AzureRecordState.webmBlobUrl);
  AzureRecordState.webmBlobUrl = URL.createObjectURL(blob);

  panel.innerHTML =
    '<p>✅ บันทึกเสียงเสร็จแล้ว ลองฟังเสียงของตัวเองก่อนส่งประเมิน:</p>' +
    '<audio controls src="' + AzureRecordState.webmBlobUrl + '" style="width:100%"></audio>' +
    '<div style="display:flex;gap:10px;margin-top:10px">' +
      '<button class="btn btn-ghost" style="flex:1" onclick="startAzurePronunciation()">🔁 บันทึกใหม่</button>' +
      '<button class="btn btn-primary" style="flex:1" onclick="sendAzureRecordingForAssessment()">📤 ส่งประเมินผล</button>' +
    '</div>';
}

/** ปุ่ม "ส่งประเมินผล" — แปลง webm → WAV แล้วส่งไป backend จริง */
function sendAzureRecordingForAssessment() {
  var item = PhoneticState.currentItem;
  var targetText = item.exampleWord || item.pinyin;
  var panel = document.getElementById('azure-score-panel');

  panel.innerHTML = '🔄 กำลังแปลงเสียงเป็น WAV...';

  var blob = new Blob(AzureRecordState.chunks, { type: 'audio/webm' });
  var fileReader = new FileReader();

  fileReader.onloadend = function () {
    var arrayBuffer = fileReader.result;
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    audioCtx.decodeAudioData(arrayBuffer)
      .then(function (audioBuffer) { return audioBufferToWav(audioBuffer); })
      .then(function (wavBuffer) {
        audioCtx.close();
        var base64 = arrayBufferToBase64(wavBuffer);
        panel.innerHTML = '⏳ กำลังส่งเสียงไปประเมิน...';

        return callApiPost('assessPronunciation', {
          token:         AppState.token,
          referenceText: targetText,
          audioBase64:   base64
        });
      })
      .then(function (res) {
        renderAzureResult(panel, res);
      })
      .catch(function (err) {
        panel.innerHTML = '❌ ' + escapeHtml(err.message);
      });
  };

  fileReader.readAsArrayBuffer(blob);
}

/** แสดงผลคะแนนสุดท้าย พร้อมลิงก์เสียงที่เก็บไว้ใน Drive (ถ้าเซฟสำเร็จ) */
function renderAzureResult(panel, res) {
  var driveLink = res.driveUrl
    ? '<p style="font-size:13px;margin-top:10px"><a href="' + res.driveUrl + '" target="_blank" rel="noopener">🎧 ฟังเสียงที่บันทึกไว้ (Google Drive)</a></p>'
    : '';

  if (!res.success) {
    panel.innerHTML = '❌ ' + escapeHtml(res.message || 'ประเมินผลไม่สำเร็จ') + driveLink +
      '<div style="margin-top:10px"><button class="btn btn-ghost" onclick="startAzurePronunciation()">🔁 ลองอีกครั้ง</button></div>';
    return;
  }

  var fluencyDisplay      = (res.fluencyScore !== null && res.fluencyScore !== undefined) ? res.fluencyScore : 'ไม่มีข้อมูล';
  var completenessDisplay = (res.completenessScore !== null && res.completenessScore !== undefined) ? res.completenessScore : 'ไม่มีข้อมูล';
  var fluencyNote = (res.fluencyScore === null) ?
    '<p class="score-note">หมายเหตุ: คำเดี่ยวสั้นเกินไปที่ Azure จะวัดความคล่อง/ความครบถ้วนได้ จึงแสดงเฉพาะคะแนนความถูกต้อง</p>' : '';

  panel.innerHTML =
    '<div class="azure-result">' +
      '<h3>🤖 ผลประเมินการออกเสียง</h3>' +
      '<p>คำที่ฝึก: <b class="hanzi">' + escapeHtml(res.referenceText) + '</b></p>' +
      (res.recognizedText ? '<p>ระบบจับได้ว่า: <b>' + escapeHtml(res.recognizedText) + '</b></p>' : '') +
      '<div class="score-grid">' +
        '<div class="score-item"><span class="score-val">' + res.pronunciationScore + '</span><span class="score-lbl">คะแนนรวม</span></div>' +
        '<div class="score-item"><span class="score-val">' + res.accuracyScore     + '</span><span class="score-lbl">ความถูกต้อง</span></div>' +
        '<div class="score-item"><span class="score-val">' + fluencyDisplay        + '</span><span class="score-lbl">ความคล่อง</span></div>' +
        '<div class="score-item"><span class="score-val">' + completenessDisplay   + '</span><span class="score-lbl">ความครบถ้วน</span></div>' +
      '</div>' +
      fluencyNote +
      driveLink +
      '<button class="btn btn-ghost" style="margin-top:10px;width:100%" onclick="startAzurePronunciation()">🔁 ฝึกอีกครั้ง</button>' +
    '</div>';
}
