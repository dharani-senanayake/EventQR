// ⚠️ Paste your Apps Script Web App /exec URL here after deploying Code.gs
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwRd1RrUvgMX_hcnMuP98KeRn1R0nEIVXWsLMJD2J-Dh2nAqS-W6dgP5iElC77-7njnfQ/exec";

let lastScanned = null;
let scanning = true;

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

const html5QrCode = new Html5Qrcode("reader");

function startScanner() {
  scanning = true;
  html5QrCode
    .start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      onScanSuccess,
    )
    .catch((err) => {
      statusEl.textContent = "Camera error: " + err;
      statusEl.className = "err";
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
      } else if (res.status === "duplicate") {
        statusEl.textContent = "⚠ " + res.message;
        statusEl.className = "warn";
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
