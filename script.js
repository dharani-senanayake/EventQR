// ⚠️ Paste your Apps Script Web App /exec URL here after deploying Code.gs
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby54KzAnJ3_RyPtRMiYlevs5wCspXtN1dYNVYAizNXAx0uvrABC8M17bZmARQH7DTORnw/exec";

let lastScanned = null;
let scanning = true;
let trackCapabilities = null;

const resultCard = document.getElementById("resultCard");
const rawDataEl = document.getElementById("rawData");
const tableField = document.getElementById("tableField");
const nameField = document.getElementById("nameField");
const participantsField = document.getElementById("participantsField");
const codeField = document.getElementById("codeField");
const notesField = document.getElementById("notesField");
const submitBtn = document.getElementById("submitBtn");
const rescanBtn = document.getElementById("rescanBtn");
const statusEl = document.getElementById("status");
const torchBtn = document.getElementById("torchBtn");
const zoomSlider = document.getElementById("zoomSlider");
const zoomWrap = document.getElementById("zoomWrap");

// Use the fastest/most accurate detector available, and only decode QR codes
// (skipping barcode formats speeds up each frame scan).
const html5QrCode = new Html5Qrcode("reader", {
  formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
  useBarCodeDetectorIfSupported: true,
  verbose: false,
});

// Small, high-contrast QR codes printed on a dark background (like this
// invite) are hard to grab at a distance. Two changes fix most of that:
//  1. Ask the camera for a higher resolution feed so the QR has more pixels
//     to work with once it's decoded.
//  2. Make the scan box big (85% of the preview) instead of a fixed 250px,
//     so the guest doesn't have to line the small code up perfectly.
function startScanner() {
  scanning = true;

  const cameraConfig = {
    facingMode: "environment",
    width: { min: 640, ideal: 1920, max: 1920 },
    height: { min: 480, ideal: 1080, max: 1080 },
    advanced: [{ focusMode: "continuous" }],
  };

  const config = {
    fps: 15,
    qrbox: (viewfinderWidth, viewfinderHeight) => {
      const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
      const size = Math.floor(minEdge * 0.7);
      return { width: size, height: size };
    },
    aspectRatio: 1.0,
    disableFlip: false,
  };

  html5QrCode
    .start(cameraConfig, config, onScanSuccess, onScanFailure)
    .then(() => setupCameraControls())
    .catch((err) => {
      statusEl.textContent = "Camera error: " + err;
      statusEl.className = "err";
    });
}

// Silently ignore per-frame "no QR found" errors — only real start() errors
// should be surfaced to the user.
function onScanFailure() {}

// Torch (flash) and zoom aren't supported on every device/browser, so only
// show the controls when the active camera actually reports them.
function setupCameraControls() {
  try {
    trackCapabilities = html5QrCode.getRunningTrackCapabilities();
  } catch (e) {
    trackCapabilities = null;
    return;
  }

  // Ask for continuous autofocus explicitly too — some Android browsers only
  // honor this if it's applied after the stream is already running, not just
  // in the initial getUserMedia constraints.
  if (trackCapabilities && trackCapabilities.focusMode) {
    html5QrCode
      .applyVideoConstraints({ advanced: [{ focusMode: "continuous" }] })
      .catch(() => {});
  }

  if (trackCapabilities && trackCapabilities.torch) {
    torchBtn.style.display = "inline-block";
    torchBtn.dataset.on = "false";
  } else {
    torchBtn.style.display = "none";
  }

  if (trackCapabilities && trackCapabilities.zoom) {
    const { min, max, step } = trackCapabilities.zoom;
    zoomSlider.min = min;
    zoomSlider.max = max;
    zoomSlider.step = step || 0.1;
    // Start slightly zoomed in from the minimum — most small QR codes at a
    // guest's normal holding distance decode better with a little zoom
    // applied by default, without anyone having to touch the slider.
    const defaultZoom = Math.min(max, min + (max - min) * 0.25);
    zoomSlider.value = defaultZoom;
    html5QrCode
      .applyVideoConstraints({ advanced: [{ zoom: defaultZoom }] })
      .catch(() => {});
    zoomWrap.style.display = "flex";
  } else {
    zoomWrap.style.display = "none";
  }
}

if (torchBtn) {
  torchBtn.addEventListener("click", () => {
    const isOn = torchBtn.dataset.on === "true";
    html5QrCode
      .applyVideoConstraints({ advanced: [{ torch: !isOn }] })
      .then(() => {
        torchBtn.dataset.on = (!isOn).toString();
        torchBtn.textContent = !isOn ? "🔦 Torch On" : "🔦 Torch";
      })
      .catch(() => {
        statusEl.textContent = "Torch not supported on this device.";
        statusEl.className = "warn";
      });
  });
}

if (zoomSlider) {
  zoomSlider.addEventListener("input", (e) => {
    const zoomValue = parseFloat(e.target.value);
    html5QrCode
      .applyVideoConstraints({ advanced: [{ zoom: zoomValue }] })
      .catch(() => {
        /* zoom not supported mid-stream on some browsers, ignore */
      });
  });
}


function onScanSuccess(decodedText) {
  if (!scanning) return;
  scanning = false;
  lastScanned = decodedText;
  html5QrCode.pause(true);

  rawDataEl.textContent = decodedText;

  // Parse the entry pass text format:
  //   Name: Frank Perera
  //   Table No: 10
  //   Number of participants: 1
  //   Code: CPBM1333_P1_T10
  const nameMatch = decodedText.match(/Name:\s*(.+)/i);
  const tableMatch = decodedText.match(/Table No:\s*(.+)/i);
  const participantsMatch = decodedText.match(
    /Number of participants:\s*(.+)/i,
  );
  const codeMatch = decodedText.match(/Code:\s*(\S+)/i);

  nameField.value = nameMatch ? nameMatch[1].trim() : "";
  tableField.value = tableMatch ? tableMatch[1].trim() : "";
  participantsField.value = participantsMatch
    ? participantsMatch[1].trim()
    : "";
  codeField.value = codeMatch ? codeMatch[1].trim() : "";

  resultCard.classList.add("visible");
  submitBtn.disabled = false;
  statusEl.textContent = "";
}

submitBtn.addEventListener("click", () => {
  if (APPS_SCRIPT_URL.indexOf("PASTE_YOUR") === 0) {
    statusEl.textContent = "Set APPS_SCRIPT_URL in script.js first.";
    statusEl.className = "err";
    return;
  }

  submitBtn.disabled = true;
  statusEl.textContent = "Saving...";
  statusEl.className = "warn";

  const payload = {
    rawData: lastScanned,
    name: nameField.value,
    table: tableField.value,
    participants: participantsField.value,
    code: codeField.value,
    notes: notesField.value,
  };

  // text/plain avoids a CORS preflight (OPTIONS), which Apps Script doPost doesn't handle
  fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  })
    .then((res) => res.json())
    .then((res) => {
      if (res.status === "success") {
        statusEl.textContent = "✓ " + res.message;
        statusEl.className = "ok";
      } else {
        statusEl.textContent = "✗ " + res.message;
        statusEl.className = "err";
        submitBtn.disabled = false;
      }
    })
    .catch((err) => {
      statusEl.textContent = "✗ " + err.message;
      statusEl.className = "err";
      submitBtn.disabled = false;
    });
});

rescanBtn.addEventListener("click", () => {
  resultCard.classList.remove("visible");
  nameField.value = "";
  tableField.value = "";
  participantsField.value = "";
  codeField.value = "";
  notesField.value = "";
  statusEl.textContent = "";
  submitBtn.disabled = false;
  html5QrCode.resume();
  scanning = true;
});


startScanner();
