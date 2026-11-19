// --- TAB NAVIGATION ---
const navButtons = document.querySelectorAll(".nav-link");
const tabPanels = document.querySelectorAll(".tab-panel");

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    navButtons.forEach((b) => b.classList.remove("active"));
    tabPanels.forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// Helper to trigger browser file download
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- TOOL 1: IMAGE CONVERTER ---
const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const fileLabel = document.getElementById("fileLabel");
const formatSelect = document.getElementById("formatSelect");
const qualityRange = document.getElementById("qualityRange");
const qualityValue = document.getElementById("qualityValue");
const qualityGroup = document.getElementById("qualityGroup");
const convertBtn = document.getElementById("convertBtn");
const statusMsg = document.getElementById("statusMsg");
const canvas = document.getElementById("workCanvas");
const ctx = canvas.getContext("2d");

let selectedFile = null;
const mimeToExt = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/bmp": "bmp"
};

function updateQualityVisibility() {
  const mime = formatSelect.value;
  qualityGroup.style.display = mime === "image/jpeg" || mime === "image/webp" ? "flex" : "none";
}

function handleImageSelection(file) {
  if (!file || !file.type.startsWith("image/")) {
    statusMsg.textContent = "Please choose a valid image file.";
    return;
  }
  selectedFile = file;
  fileLabel.textContent = `Selected: ${file.name}`;
  convertBtn.disabled = false;
  statusMsg.textContent = "";
}

fileInput.addEventListener("change", (e) => handleImageSelection(e.target.files[0]));
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  handleImageSelection(e.dataTransfer.files[0]);
});

formatSelect.addEventListener("change", updateQualityVisibility);
qualityRange.addEventListener("input", () => { qualityValue.textContent = qualityRange.value; });

convertBtn.addEventListener("click", () => {
  if (!selectedFile) return;
  const targetMime = formatSelect.value;
  const targetExt = mimeToExt[targetMime] || "png";
  const quality = Number(qualityRange.value) / 100;

  statusMsg.textContent = "Converting...";
  convertBtn.disabled = true;

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (targetMime === "image/jpeg" || targetMime === "image/bmp") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            statusMsg.textContent = "Conversion failed in this browser.";
            convertBtn.disabled = false;
            return;
          }
          const baseName = selectedFile.name.replace(/\.[^/.]+$/, "");
          triggerDownload(blob, `${baseName}.${targetExt}`);
          statusMsg.textContent = `Done! Downloaded ${baseName}.${targetExt}`;
          convertBtn.disabled = false;
        },
        targetMime,
        quality
      );
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(selectedFile);
});
updateQualityVisibility();

// --- TOOL 2: IMAGES TO PDF ---
const pdfFileInput = document.getElementById("pdfFileInput");
const pdfDropZone = document.getElementById("pdfDropZone");
const pdfFileLabel = document.getElementById("pdfFileLabel");
const orientationSelect = document.getElementById("orientationSelect");
const makePdfBtn = document.getElementById("makePdfBtn");
const pdfStatusMsg = document.getElementById("pdfStatusMsg");

let imageFiles = [];

function setPdfFiles(fileList) {
  const valid = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
  if (valid.length === 0) {
    pdfStatusMsg.textContent = "Please select valid PNG, JPG, or WebP images.";
    return;
  }
  imageFiles = valid;
  pdfFileLabel.textContent = `${valid.length} image(s) selected`;
  makePdfBtn.disabled = false;
  pdfStatusMsg.textContent = "";
}

pdfFileInput.addEventListener("change", (e) => setPdfFiles(e.target.files));
pdfDropZone.addEventListener("dragover", (e) => { e.preventDefault(); pdfDropZone.classList.add("dragover"); });
pdfDropZone.addEventListener("dragleave", () => pdfDropZone.classList.remove("dragover"));
pdfDropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  pdfDropZone.classList.remove("dragover");
  setPdfFiles(e.dataTransfer.files);
});

function loadImageData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve({ img, dataUrl: e.target.result });
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

makePdfBtn.addEventListener("click", async () => {
  if (imageFiles.length === 0) return;
  makePdfBtn.disabled = true;
  pdfStatusMsg.textContent = "Building PDF...";

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: orientationSelect.value, unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const maxW = pageWidth - margin * 2;
    const maxH = pageHeight - margin * 2;

    for (let i = 0; i < imageFiles.length; i++) {
      if (i > 0) doc.addPage();
      const { img, dataUrl } = await loadImageData(imageFiles[i]);
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      const drawW = img.width * ratio;
      const drawH = img.height * ratio;
      const x = (pageWidth - drawW) / 2;
      const y = (pageHeight - drawH) / 2;
      const format = imageFiles[i].type === "image/png" ? "PNG" : "JPEG";
      doc.addImage(dataUrl, format, x, y, drawW, drawH);
    }

    doc.save("converted-images.pdf");
    pdfStatusMsg.textContent = `Done! Downloaded converted-images.pdf (${imageFiles.length} page(s)).`;
  } catch (err) {
    pdfStatusMsg.textContent = "Error generating PDF. Try PNG or JPG files.";
  } finally {
    makePdfBtn.disabled = false;
  }
});

// --- TOOL 3: CSV <-> JSON CONVERTER ---
const dataMode = document.getElementById("dataMode");
const dataFileInput = document.getElementById("dataFileInput");
const inputText = document.getElementById("inputText");
const convertDataBtn = document.getElementById("convertDataBtn");
const dataStatusMsg = document.getElementById("dataStatusMsg");

dataFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    inputText.value = ev.target.result;
    dataStatusMsg.textContent = `Loaded ${file.name}`;
  };
  reader.readAsText(file);
});

function csvToJson(csv) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV needs a header row and at least one data row.");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const result = lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const obj = {};
    headers.forEach((header, idx) => { obj[header] = values[idx] ?? ""; });
    return obj;
  });
  return JSON.stringify(result, null, 2);
}

function jsonToCsv(jsonStr) {
  const arr = JSON.parse(jsonStr);
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("JSON must be a non-empty array of objects.");
  }
  const headers = Object.keys(arr[0]);
  const rows = arr.map((obj) =>
    headers.map((h) => `"${String(obj[h] ?? "").replace(/"/g, '""')}"`).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

convertDataBtn.addEventListener("click", () => {
  const raw = inputText.value.trim();
  if (!raw) {
    dataStatusMsg.textContent = "Please paste data or upload a file first.";
    return;
  }

  try {
    const isCsvToJson = dataMode.value === "csv-to-json";
    const output = isCsvToJson ? csvToJson(raw) : jsonToCsv(raw);
    const ext = isCsvToJson ? "json" : "csv";
    const mime = isCsvToJson ? "application/json" : "text/csv";
    triggerDownload(new Blob([output], { type: mime }), `converted.${ext}`);
    dataStatusMsg.textContent = `Done! Downloaded converted.${ext}`;
  } catch (err) {
    dataStatusMsg.textContent = `Error: ${err.message}`;
  }
});