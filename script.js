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

