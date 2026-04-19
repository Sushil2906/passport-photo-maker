// ── remove.bg Config (Cloudinary removed) ──────────────────────────────────
const HARDCODED_KEY = '71nkYTcWk39kzddBidsPiVKf';
function getApiKey() {
  return localStorage.getItem('removebg_key') || HARDCODED_KEY;
}
function saveApiKey(key) { localStorage.setItem('removebg_key', key); }


// ── State ───────────────────────────────────────────────────────────────────
const state = {
  passportW: 35, passportH: 45, passportLabel: 'India (35×45mm)',
  originalImage: null,
  croppedCanvas: null,
  removedCanvas: null,  // bg-removed version, null if not done
  bgCanvas: null,
  bgColor: '#ffffff',
  borderEnabled: false,
  borderColor: '#000000',
  borderSize: 3,
  finalCanvas: null,
  rotationDeg: 0,
};

let manualState = { maskCanvas: null, tolerance: 30, feather: 2, mode: 'add', selecting: false };

// ── Navigation ──────────────────────────────────────────────────────────────
function goTo(n) {
  document.querySelectorAll('.panel').forEach((p, i) => p.classList.toggle('active', i + 1 === n));
  document.querySelectorAll('.step').forEach((s, i) => {
    s.classList.toggle('active', i + 1 === n);
    s.classList.toggle('done', i + 1 < n);
  });
  if (n === 3 && state.croppedCanvas) initBgStep();
  if (n === 4 && state.bgCanvas) initBeautifyStep();
  if (n === 5) initExportStep();
}

// ── Step 1: Passport Type ───────────────────────────────────────────────────
document.querySelectorAll('.type-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.passportW = +card.dataset.w;
    state.passportH = +card.dataset.h;
    state.passportLabel = card.dataset.label;
    document.getElementById('selectedInfo').textContent = 'Selected: ' + state.passportLabel;
  });
});

// ── Step 2: Upload & Crop ───────────────────────────────────────────────────
const fileInput  = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const cropSection = document.getElementById('cropSection');
const cropCanvas = document.getElementById('cropCanvas');
const guideCanvas = document.getElementById('guideCanvas');
const cropBox    = document.getElementById('cropBox');

uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag'));
uploadArea.addEventListener('drop', e => { e.preventDefault(); uploadArea.classList.remove('drag'); loadFile(e.dataTransfer.files[0]); });
uploadArea.addEventListener('click', e => {
  if (e.target === fileInput) return; // prevent re-trigger
  fileInput.click();
});
fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));

let cropState = {};

function loadFile(file) {
  if (!file) return;
  // Use createObjectURL — zero re-encoding, original bytes preserved
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.originalImage = img;
    state.originalURL   = url; // keep alive
    setupCrop(img);
  };
  img.src = url;
}

function setupCrop(img) {
  state.rotationDeg = 0;
  document.getElementById('rotateSlider').value = 0;
  document.getElementById('rotateVal').textContent = '0°';
  redrawRotated();

  uploadArea.style.display = 'none';
  cropSection.style.display = 'block';
  setupCropDrag();
}

// Redraw the original image onto cropCanvas at current rotation.
// Canvas pixel size = actual display size so cropState coords == screen coords.
function redrawRotated() {
  const img = state.originalImage;
  const rad = state.rotationDeg * Math.PI / 180;
  const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));

  const natW = img.width * cos + img.height * sin;
  const natH = img.width * sin + img.height * cos;

  const containerW = cropCanvas.parentElement.clientWidth || 680;
  const maxW = Math.min(680, containerW);
  const maxH = 480;
  const scale = Math.min(maxW / natW, maxH / natH, 1);

  const cw = Math.round(natW * scale);
  const ch = Math.round(natH * scale);

  // Save crop box as fractions of old canvas BEFORE resizing
  const hadCrop = cropState.cw && cropState.ch;
  const fracX = hadCrop ? cropState.x / cropState.cw : null;
  const fracY = hadCrop ? cropState.y / cropState.ch : null;
  const fracW = hadCrop ? cropState.w / cropState.cw : null;
  const fracH = hadCrop ? cropState.h / cropState.ch : null;

  cropCanvas.width  = cw;
  cropCanvas.height = ch;
  cropCanvas.style.width  = cw + 'px';
  cropCanvas.style.height = ch + 'px';

  const ctx = cropCanvas.getContext('2d');
  ctx.clearRect(0, 0, cw, ch);
  ctx.save();
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate(rad);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, -img.width * scale / 2, -img.height * scale / 2, img.width * scale, img.height * scale);
  ctx.restore();

  state.displayScale = scale;

  const aspect = state.passportW / state.passportH;

  if (hadCrop) {
    // Restore crop box position/size scaled to new canvas, clamped inside bounds
    let bw = Math.round(fracW * cw);
    let bh = Math.round(bw / aspect);          // re-enforce aspect ratio
    let bx = Math.round(fracX * cw);
    let by = Math.round(fracY * ch);
    bx = Math.max(0, Math.min(cw - bw, bx));
    by = Math.max(0, Math.min(ch - bh, by));
    cropState = { x: bx, y: by, w: bw, h: bh, cw, ch, aspect };
  } else {
    // First load — center the box
    let bh = Math.round(ch * 0.80);
    let bw = Math.round(bh * aspect);
    if (bw > cw * 0.90) { bw = Math.round(cw * 0.90); bh = Math.round(bw / aspect); }
    const bx = Math.round((cw - bw) / 2);
    const by = Math.round((ch - bh) / 2);
    cropState = { x: bx, y: by, w: bw, h: bh, cw, ch, aspect };
  }

  updateCropBox();
}

function rotateby(deg, reset) {
  if (reset) {
    state.rotationDeg = 0;
  } else {
    state.rotationDeg = (state.rotationDeg + deg) % 360;
  }
  document.getElementById('rotateSlider').value = Math.max(-45, Math.min(45, state.rotationDeg));
  document.getElementById('rotateVal').textContent = state.rotationDeg + '°';
  redrawRotated();
}

function rotateToAngle(deg) {
  state.rotationDeg = deg;
  document.getElementById('rotateVal').textContent = deg + '°';
  redrawRotated();
}

function updateCropBox() {
  const { x, y, w, h } = cropState;
  // Canvas pixel size == display size (1:1), so no scaling needed
  cropBox.style.left   = x + 'px';
  cropBox.style.top    = y + 'px';
  cropBox.style.width  = w + 'px';
  cropBox.style.height = h + 'px';
  drawGuides();
}

function drawGuides() {
  const { x: bx, y: by, w: bw, h: bh } = cropState;

  // guideCanvas pixel size == cropCanvas pixel size (1:1 with display)
  guideCanvas.width  = cropCanvas.width;
  guideCanvas.height = cropCanvas.height;
  guideCanvas.style.width  = cropCanvas.style.width;
  guideCanvas.style.height = cropCanvas.style.height;

  // Passport standard proportions (country-agnostic percentages):
  // Crown ~8% from top, chin ~78%, shoulders ~94%
  const crownY    = by + bh * 0.08;
  const chinY     = by + bh * 0.78;
  const shoulderY = by + bh * 0.94;
  const faceH     = chinY - crownY;
  const faceW     = bw * 0.56;
  const cx        = bx + bw / 2;
  const ovalCY    = crownY + faceH / 2;

  const ctx = guideCanvas.getContext('2d');
  ctx.clearRect(0, 0, guideCanvas.width, guideCanvas.height);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,220,40,0.92)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);

  // Face oval
  ctx.beginPath();
  ctx.ellipse(cx, ovalCY, faceW / 2, faceH / 2, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Chin line
  ctx.beginPath();
  ctx.moveTo(bx + bw * 0.12, chinY);
  ctx.lineTo(bx + bw * 0.88, chinY);
  ctx.stroke();

  // Shoulder line
  ctx.beginPath();
  ctx.moveTo(bx + bw * 0.04, shoulderY);
  ctx.lineTo(bx + bw * 0.96, shoulderY);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.font = `bold ${Math.max(10, Math.round(bw * 0.07))}px sans-serif`;
  ctx.fillStyle = 'rgba(255,220,40,0.95)';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 3;
  ctx.textAlign = 'center';
  ctx.fillText('align face', cx, crownY - 6);
  ctx.textAlign = 'right';
  ctx.fillText('chin ──', bx + bw * 0.88, chinY - 4);
  ctx.textAlign = 'left';
  ctx.fillText('── shoulder', bx + bw * 0.04, shoulderY - 4);
  ctx.restore();
}

// ── Crop drag ───────────────────────────────────────────────────────────────
function setupCropDrag() {
  let drag = null;

  function getCanvasPos(e) {
    // Canvas pixel == display pixel (1:1), just subtract canvas offset
    const rect = cropCanvas.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  }

  function onDown(e, type) {
    e.preventDefault();
    const pos = getCanvasPos(e);
    drag = { type, startX: pos.x, startY: pos.y, ...cropState };
  }

  cropBox.addEventListener('mousedown', e => onDown(e, 'move'));
  cropBox.addEventListener('touchstart', e => onDown(e, 'move'), { passive: false });

  cropBox.querySelectorAll('.handle').forEach(h => {
    const type = h.className.split(' ')[1];
    h.addEventListener('mousedown', e => { e.stopPropagation(); onDown(e, type); });
    h.addEventListener('touchstart', e => { e.stopPropagation(); onDown(e, type); }, { passive: false });
  });

  function onMove(e) {
    if (!drag) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    const dx = pos.x - drag.startX, dy = pos.y - drag.startY;
    const { cw, ch, aspect } = cropState;
    let { x, y, w, h } = drag;

    if (drag.type === 'move') {
      x = Math.max(0, Math.min(cw - w, x + dx));
      y = Math.max(0, Math.min(ch - h, y + dy));
    } else {
      let nw = w, nh = h, nx = x, ny = y;
      if (drag.type === 'br') { nw = Math.max(30, w + dx); nh = Math.round(nw / aspect); }
      if (drag.type === 'bl') { nw = Math.max(30, w - dx); nh = Math.round(nw / aspect); nx = x + w - nw; }
      if (drag.type === 'tr') { nw = Math.max(30, w + dx); nh = Math.round(nw / aspect); ny = y + h - nh; }
      if (drag.type === 'tl') { nw = Math.max(30, w - dx); nh = Math.round(nw / aspect); nx = x + w - nw; ny = y + h - nh; }
      nx = Math.max(0, nx); ny = Math.max(0, ny);
      nw = Math.min(nw, cw - nx); nh = Math.min(nh, ch - ny);
      x = nx; y = ny; w = nw; h = nh;
    }
    cropState = { ...cropState, x, y, w, h };
    updateCropBox();
  }

  function onUp() { drag = null; }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onUp);
}

// ── Keyboard arrow movement for crop box ───────────────────────────────────────
document.addEventListener('keydown', e => {
  // Only active when crop section is visible
  if (cropSection.style.display === 'none') return;
  // Don't hijack input/range focus
  if (['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)) return;

  const ARROWS = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
  if (!ARROWS.includes(e.key)) return;
  e.preventDefault();

  const step = e.shiftKey ? 10 : 1;  // Shift = 10px jump
  const { cw, ch } = cropState;
  let { x, y, w, h } = cropState;

  if (e.key === 'ArrowLeft')  x = Math.max(0, x - step);
  if (e.key === 'ArrowRight') x = Math.min(cw - w, x + step);
  if (e.key === 'ArrowUp')    y = Math.max(0, y - step);
  if (e.key === 'ArrowDown')  y = Math.min(ch - h, y + step);

  cropState = { ...cropState, x, y };
  updateCropBox();
});

function applyCrop() {
  const { x, y, w, h } = cropState;
  const invScale = 1 / state.displayScale;
  const img = state.originalImage;
  const rad = state.rotationDeg * Math.PI / 180;
  const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));

  // Full-res rotated canvas from original image — no downsampling
  const fullW = Math.round(img.width * cos + img.height * sin);
  const fullH = Math.round(img.width * sin + img.height * cos);
  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = fullW; fullCanvas.height = fullH;
  const fctx = fullCanvas.getContext('2d');
  fctx.save();
  fctx.translate(fullW / 2, fullH / 2);
  fctx.rotate(rad);
  fctx.imageSmoothingEnabled = true;
  fctx.imageSmoothingQuality = 'high';
  fctx.drawImage(img, -img.width / 2, -img.height / 2); // draw at native resolution
  fctx.restore();

  // Crop region mapped back to full-res coordinates
  const sx = Math.round(x * invScale);
  const sy = Math.round(y * invScale);
  const sw = Math.round(w * invScale);
  const sh = Math.round(h * invScale);

  // Output at native crop resolution — no upscale, no downscale
  // This preserves every original pixel inside the crop box
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(fullCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  state.croppedCanvas = c;
  goTo(3);
}

// ── Step 3: Background ──────────────────────────────────────────────────────
let manualState = { maskCanvas: null, tolerance: 30, feather: 2, mode: 'add', selecting: false };

function initBgStep() {
  state.removedCanvas = null;
  manualState.maskCanvas = null;
  state.bgCanvas = cloneCanvas(state.croppedCanvas);
  renderBgCanvas();
  document.getElementById('manualTools').style.display = 'none';
}

function initManualRemoval() {
  document.getElementById('manualTools').style.display = 'block';
  const canvas = document.getElementById('selectionCanvas');
  const ctx = canvas.getContext('2d');
  const src = state.croppedCanvas;
  canvas.width = src.width; canvas.height = src.height;
  ctx.drawImage(src, 0, 0);
  manualState.maskCanvas = createMaskCanvas(src.width, src.height);
  updateWandPreview();
}

function createMaskCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const data = ctx.createImageData(w, h);
  data.data.fill(0); // transparent mask
  ctx.putImageData(data, 0, 0);
  return c;
}

function updateWandPreview() {
  const canvas = document.getElementById('selectionCanvas');
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(state.croppedCanvas, 0, 0, canvas.width, canvas.height);
  
  if (manualState.maskCanvas) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Feather preview
    const feather = manualState.feather;
    if (feather > 0) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      for (let i = 3; i < d.length; i += 4) {
        if (d[i] > 0) d[i] *= Math.max(0, 1 - feather / 50);
      }
      ctx.putImageData(imgData, 0, 0);
    }
  }
  ctx.restore();
}

function doMagicWand(mode) {
  manualState.mode = mode;
  document.body.style.cursor = 'crosshair';
  const canvas = document.getElementById('selectionCanvas');
  canvas.style.cursor = 'crosshair';
  
  let startX, startY;
  const onClick = (e) => {
    const rect = canvas.getBoundingClientRect();
    startX = (e.clientX - rect.left) * (state.croppedCanvas.width / canvas.width);
    startY = (e.clientY - rect.top) * (state.croppedCanvas.height / canvas.height);
    
    floodFill(startX|0, startY|0, manualState.tolerance, mode);
    updateWandPreview();
  };
  
  canvas.onclick = onClick;
  document.onkeydown = (e) => {
    if (e.ctrlKey && e.key === 'z') clearSelection();
  };
  
  // Single click handler
  setTimeout(() => canvas.onclick = onClick, 100);
}

function floodFill(x, y, tolerance, mode) {
  const srcCanvas = state.croppedCanvas;
  const maskCtx = manualState.maskCanvas.getContext('2d');
  const srcData = srcCanvas.getContext('2d').getImageData(x, y, 1, 1);
  const targetR = srcData.data[0], targetG = srcData.data[1], targetB = srcData.data[2];
  
  const stack = [[x, y]];
  const maskData = maskCtx.createImageData(manualState.maskCanvas.width, manualState.maskCanvas.height);
  const visited = new Set();
  
  while (stack.length) {
    const [cx, cy] = stack.pop();
    const key = `${cx},${cy}`;
    if (visited.has(key)) continue;
    visited.add(key);
    
    if (cx < 0 || cx >= srcCanvas.width || cy < 0 || cy >= srcCanvas.height) continue;
    
    const pxData = srcCanvas.getContext('2d').getImageData(cx, cy, 1, 1).data;
    const dist = Math.abs(pxData[0]-targetR) + Math.abs(pxData[1]-targetG) + Math.abs(pxData[2]-targetB);
    
    if (dist <= tolerance * 3) {
      const maskIdx = (cy * maskData.width + cx) * 4;
      if (mode === 'add') {
        maskData.data[maskIdx + 3] = 255;  // opaque mask = keep foreground
      } else {
        maskData.data[maskIdx + 3] = 0;    // transparent mask = remove BG
      }
      
      stack.push([cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]);
    }
  }
  
  maskCtx.putImageData(maskData, 0, 0);
}

function invertSelection() {
  const ctx = manualState.maskCanvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, manualState.maskCanvas.width, manualState.maskCanvas.height);
  const d = imgData.data;
  for (let i = 3; i < d.length; i += 4) {
    d[i] = 255 - d[i];
  }
  ctx.putImageData(imgData, 0, 0);
  updateWandPreview();
}

function clearSelection() {
  manualState.maskCanvas = createMaskCanvas(state.croppedCanvas.width, state.croppedCanvas.height);
  updateWandPreview();
}

async function applyManualRemoval() {
  const statusEl = document.getElementById('apiStatus');
  statusEl.textContent = '⏳ Applying manual mask...';
  
  const feather = manualState.feather;
  let resultCanvas = document.createElement('canvas');
  resultCanvas.width = state.croppedCanvas.width;
  resultCanvas.height = state.croppedCanvas.height;
  const ctx = resultCanvas.getContext('2d');
  
  // Feather mask edges
  if (feather > 0) {
    const maskBlur = document.createElement('canvas');
    maskBlur.width = resultCanvas.width;
    maskBlur.height = resultCanvas.height;
    const mctx = maskBlur.getContext('2d');
    mctx.filter = `blur(${feather}px)`;
    mctx.drawImage(manualState.maskCanvas, 0, 0);
    mctx.filter = 'none';
    
    // Composite with feather
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(state.croppedCanvas, 0, 0);
    
    // Use mask as alpha
    const srcData = ctx.getImageData(0, 0, resultCanvas.width, resultCanvas.height);
    const maskData = mctx.getImageData(0, 0, resultCanvas.width, resultCanvas.height);
    const sd = srcData.data, md = maskData.data;
    for (let i = 3; i < sd.length; i += 4) {
      sd[i] = md[i];  // copy mask alpha
    }
    ctx.putImageData(srcData, 0, 0);
  } else {
    // Simple mask
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(state.croppedCanvas, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(manualState.maskCanvas, 0, 0);
  }
  
  state.removedCanvas = resultCanvas;
  applyBgColor();
  statusEl.textContent = '✅ Manual BG removal applied!';
  document.getElementById('manualTools').style.display = 'none';
}

function cloneCanvas(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

function renderBgCanvas() {
  const display = document.getElementById('bgCanvas');
  const maxW = 260;
  const scale = Math.min(1, maxW / state.bgCanvas.width);
  display.width  = Math.round(state.bgCanvas.width  * scale);
  display.height = Math.round(state.bgCanvas.height * scale);
  const ctx = display.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(state.bgCanvas, 0, 0, display.width, display.height);
}

document.querySelectorAll('.swatch:not(.custom-swatch)').forEach(s => {
  s.addEventListener('click', () => {
    document.querySelectorAll('.swatch').forEach(x => x.classList.remove('selected'));
    s.classList.add('selected');
    state.bgColor = s.dataset.color;
    if (state.bgCanvas) applyBgColor();
  });
});

document.getElementById('customColor').addEventListener('input', e => {
  state.bgColor = e.target.value;
  document.querySelectorAll('.swatch').forEach(x => x.classList.remove('selected'));
  e.target.closest('.swatch').classList.add('selected');
  if (state.bgCanvas) applyBgColor();
});

document.querySelectorAll('.b-swatch:not(.custom-swatch)').forEach(s => {
  s.addEventListener('click', () => {
    document.querySelectorAll('.b-swatch').forEach(x => x.classList.remove('selected'));
    s.classList.add('selected');
    state.borderColor = s.dataset.bcolor;
    if (state.bgCanvas) applyBgColor();
  });
});

document.getElementById('borderCustomColor').addEventListener('input', e => {
  state.borderColor = e.target.value;
  document.querySelectorAll('.b-swatch').forEach(x => x.classList.remove('selected'));
  e.target.closest('.b-swatch').classList.add('selected');
  if (state.bgCanvas) applyBgColor();
});

document.getElementById('borderEnabled').addEventListener('change', e => {
  state.borderEnabled = e.target.checked;
  document.getElementById('borderOptions').style.display = e.target.checked ? 'block' : 'none';
  if (state.bgCanvas) applyBgColor();
});

function applyBgColor() {
  // Source: use bg-removed layer if available, else original crop
  const src = state.removedCanvas || state.croppedCanvas;
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0);
  if (state.borderEnabled) {
    const b = +document.getElementById('borderSize').value;
    ctx.fillStyle = state.borderColor;
    // Draw 4 solid filled strips inside the photo — never clips outside
    ctx.fillRect(0, 0, c.width, b);           // top
    ctx.fillRect(0, c.height - b, c.width, b); // bottom
    ctx.fillRect(0, 0, b, c.height);           // left
    ctx.fillRect(c.width - b, 0, b, c.height); // right
  }
  state.bgCanvas = c;
  renderBgCanvas();
}

async function removeBgAPI() {
  const statusEl = document.getElementById('apiStatus');
  statusEl.textContent = '⏳ remove.bg API...';
  const key = getApiKey();
  if (!key || key === 'YOUR_REMOVE_BG_API_KEY') {
    statusEl.textContent = '❌ Set remove.bg key in app.js';
    return;
  }
  const blob = await canvasToBlob(state.croppedCanvas);
  const form = new FormData();
  form.append('image_file', blob, 'photo.png');
  form.append('size', 'auto');
  form.append('format', 'png');
  try {
    const res = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST', headers: { 'X-Api-Key': key }, body: form
    });
    if (!res.ok) { statusEl.textContent = '❌ ' + res.statusText; return; }
    saveApiKey(key);
    const imgBlob = new Blob([await res.arrayBuffer()], { type: 'image/png' });
    const url = URL.createObjectURL(imgBlob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      state.removedCanvas = c;
      URL.revokeObjectURL(url);
      applyBgColor();
      statusEl.textContent = '✅ remove.bg done!';
    };
    img.src = url;
  } catch (err) { statusEl.textContent = '❌ ' + err.message; }
    // Original remove.bg (backup)
    statusEl.textContent = '⏳ remove.bg API...';
    const key = getApiKey();
    if (!key || key === 'YOUR_REMOVE_BG_API_KEY') {
      statusEl.textContent = '❌ Set remove.bg key in app.js';
      return;
    }
    const blob = await canvasToBlob(state.croppedCanvas);
    const form = new FormData();
    form.append('image_file', blob, 'photo.png');
    form.append('size', 'auto');
    form.append('format', 'png');
    try {
      const res = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST', headers: { 'X-Api-Key': key }, body: form
      });
      if (!res.ok) { statusEl.textContent = '❌ ' + res.statusText; return; }
      saveApiKey(key);
      const imgBlob = new Blob([await res.arrayBuffer()], { type: 'image/png' });
      const url = URL.createObjectURL(imgBlob);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        state.removedCanvas = c;
        URL.revokeObjectURL(url);
        applyBgColor();
        statusEl.textContent = '✅ remove.bg done!';
      };
      img.src = url;
    } catch (err) { statusEl.textContent = '❌ ' + err.message; }
  }



function canvasToBlob(canvas) {
  return new Promise(res => canvas.toBlob(res, 'image/png'));
}

function removeBgCanvas() {
  const src = state.croppedCanvas;
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  const imgData = ctx.getImageData(0, 0, c.width, c.height);
  const d = imgData.data;

  function cornerColor(x, y) {
    const i = (y * c.width + x) * 4;
    return [d[i], d[i+1], d[i+2]];
  }
  const corners = [cornerColor(0,0), cornerColor(c.width-1,0), cornerColor(0,c.height-1), cornerColor(c.width-1,c.height-1)];
  const bgR = Math.round(corners.reduce((s,c)=>s+c[0],0)/4);
  const bgG = Math.round(corners.reduce((s,c)=>s+c[1],0)/4);
  const bgB = Math.round(corners.reduce((s,c)=>s+c[2],0)/4);

  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i]-bgR) + Math.abs(d[i+1]-bgG) + Math.abs(d[i+2]-bgB) < 180) d[i+3] = 0;
  }
  ctx.putImageData(imgData, 0, 0);

  state.removedCanvas = c;  // store transparent layer
  applyBgColor();           // composite bg + border on top
}

// ── Step 4: Beautify ────────────────────────────────────────────────────────
function initBeautifyStep() {
  document.getElementById('beautyLevel').value = 0;
  document.getElementById('beautyBadge').textContent = 'OFF';
  document.getElementById('beautyBadge').className = 'beauty-badge';
  document.getElementById('beautyDesc').textContent = 'Drag to apply automatic passport-grade enhancement';
  applyFilters();
}

// Beauty level presets tuned for India passport photo standard:
// neutral skin tone, sharp eyes, clean bright background-ready look
const BEAUTY_PRESETS = [
  // level 0 — off
  { brightness:100, contrast:100, saturation:100, sharpness:0, smooth:0 },
  // level 1 — very subtle
  { brightness:102, contrast:102, saturation:102, sharpness:1, smooth:1 },
  // level 2
  { brightness:104, contrast:104, saturation:104, sharpness:1, smooth:2 },
  // level 3
  { brightness:106, contrast:106, saturation:106, sharpness:2, smooth:3 },
  // level 4
  { brightness:108, contrast:108, saturation:107, sharpness:2, smooth:4 },
  // level 5 — balanced passport look
  { brightness:110, contrast:110, saturation:108, sharpness:2, smooth:5 },
  // level 6
  { brightness:112, contrast:112, saturation:109, sharpness:3, smooth:6 },
  // level 7
  { brightness:114, contrast:113, saturation:110, sharpness:3, smooth:7 },
  // level 8
  { brightness:116, contrast:114, saturation:110, sharpness:4, smooth:8 },
  // level 9
  { brightness:118, contrast:115, saturation:111, sharpness:4, smooth:9 },
  // level 10 — max passport-grade beauty
  { brightness:120, contrast:116, saturation:112, sharpness:5, smooth:10 },
];

const BEAUTY_LABELS = [
  'No enhancement',
  'Barely there — natural look',
  'Subtle glow — slight skin smoothing',
  'Light retouch — soft & bright',
  'Moderate — clear skin, vivid eyes',
  'Balanced — passport-grade standard ✅',
  'Enhanced — smooth skin, sharp details',
  'Strong — studio-quality finish',
  'High — polished professional look',
  'Very high — maximum clarity & glow',
  'Ultra — full passport beauty mode ✨',
];

function applyBeautyLevel(level) {
  const p = BEAUTY_PRESETS[level];
  document.getElementById('brightness').value  = p.brightness;
  document.getElementById('contrast').value    = p.contrast;
  document.getElementById('saturation').value  = p.saturation;
  document.getElementById('sharpness').value   = p.sharpness;
  document.getElementById('smooth').value      = p.smooth;

  const badge = document.getElementById('beautyBadge');
  badge.textContent = level === 0 ? 'OFF' : `L${level}`;
  badge.className = 'beauty-badge' + (level === 0 ? '' : level <= 3 ? ' low' : level <= 6 ? ' mid' : ' high');
  document.getElementById('beautyDesc').textContent = BEAUTY_LABELS[level];
  applyFilters();
}

let filterTimeout = null;

function applyFilters() {
  // Throttle to ~60fps max
  if (filterTimeout) return;
  filterTimeout = setTimeout(() => {
    filterTimeout = null;
    _applyFilters();
  }, 16);
}

function _applyFilters() {
  const brightness = +document.getElementById('brightness').value;
  const contrast   = +document.getElementById('contrast').value;
  const saturation = +document.getElementById('saturation').value;
  const sharpness  = +document.getElementById('sharpness').value;
  const smooth     = +document.getElementById('smooth').value;
  const quality    = +document.getElementById('quality').value;

  document.getElementById('brightnessVal').textContent = brightness;
  document.getElementById('contrastVal').textContent   = contrast;
  document.getElementById('saturationVal').textContent = saturation;
  document.getElementById('sharpnessVal').textContent  = sharpness;
  document.getElementById('smoothVal').textContent     = smooth;
  document.getElementById('qualityVal').textContent    = quality;

  const src = state.bgCanvas;
  
  // PREVIEW ONLY: Downscale to max 300x400px to reduce processing
  const MAX_PREV_W = 300, MAX_PREV_H = 400;
  const prevScale = Math.min(1, MAX_PREV_W / src.width, MAX_PREV_H / src.height);
  const prevW = Math.round(src.width * prevScale);
  const prevH = Math.round(src.height * prevScale);
  
  const c = document.createElement('canvas');
  c.width = prevW; c.height = prevH;
  const ctx = c.getContext('2d');
  
  // CSS GPU filters FIRST (brightness/contrast/saturation) - super fast
  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, prevW, prevH);
  ctx.filter = 'none';
  
  // THEN JS effects (only on small preview canvas)
  if (smooth > 0) applyBlurSmooth(ctx, prevW, prevH, Math.max(0.5, smooth * 0.3));
  if (sharpness > 0) applySharpen(ctx, prevW, prevH, sharpness * 0.6);
  
  // Quality upscale: ONLY preview effect (disabled for perf), full on export
  // Note: Full quality applied later in exportPhoto() / sheet functions
  
  state.finalCanvas = c; // Still store full-res for export

  // Display preview (already downscaled)
  const display = document.getElementById('beautifyCanvas');
  display.width = prevW; display.height = prevH;
  const dctx = display.getContext('2d');
  dctx.imageSmoothingQuality = 'high';
  dctx.drawImage(c, 0, 0);
}

function applyBlurSmooth(ctx, w, h, radius) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data, tmp = new Uint8ClampedArray(d);
  const r = Math.ceil(radius);
  for (let y = r; y < h - r; y++) {
    for (let x = r; x < w - r; x++) {
      let rr = 0, gg = 0, bb = 0, n = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const i = ((y+dy)*w+(x+dx))*4;
          rr += tmp[i]; gg += tmp[i+1]; bb += tmp[i+2]; n++;
        }
      }
      const i = (y*w+x)*4;
      d[i] = rr/n; d[i+1] = gg/n; d[i+2] = bb/n;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function applySharpen(ctx, w, h, amount) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data, tmp = new Uint8ClampedArray(d);
  const k = amount * 0.3;
  const kernel = [0,-k,0,-k,1+4*k,-k,0,-k,0];
  for (let y = 1; y < h-1; y++) {
    for (let x = 1; x < w-1; x++) {
      const i = (y*w+x)*4;
      for (let c = 0; c < 3; c++) {
        let v = 0;
        for (let ky = -1; ky <= 1; ky++)
          for (let kx = -1; kx <= 1; kx++)
            v += tmp[((y+ky)*w+(x+kx))*4+c] * kernel[(ky+1)*3+(kx+1)];
        d[i+c] = Math.min(255, Math.max(0, v));
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function resetFilters() {
  document.getElementById('beautyLevel').value = 0;
  document.getElementById('beautyBadge').textContent = 'OFF';
  document.getElementById('beautyBadge').className = 'beauty-badge';
  document.getElementById('beautyDesc').textContent = 'Drag to apply automatic passport-grade enhancement';
  ['brightness','contrast','saturation'].forEach(id => document.getElementById(id).value = 100);
  document.getElementById('sharpness').value = 0;
  document.getElementById('smooth').value = 0;
  document.getElementById('quality').value = 0;
  applyFilters();
}

// ── Step 5: Export ──────────────────────────────────────────────────────────
function initExportStep() {
  const src = state.finalCanvas || state.bgCanvas || state.croppedCanvas;
  if (!src) return;

  const display = document.getElementById('exportCanvas');
  const maxW = 280;
  const scale = Math.min(1, maxW / src.width);
  display.width  = Math.round(src.width  * scale);
  display.height = Math.round(src.height * scale);
  const ctx = display.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, display.width, display.height);

  const DPI = 300 / 25.4;
  document.getElementById('exportInfo').textContent =
    `${state.passportLabel} · ${Math.round(state.passportW*DPI)} × ${Math.round(state.passportH*DPI)} px base · select resolution below`;

  previewSheet();
  previewCombo();
  previewTriple();
}

function exportPhoto() {
  const src = state.finalCanvas || state.bgCanvas || state.croppedCanvas;
  if (!src) { alert('No photo to export.'); return; }

  const format = document.getElementById('exportFormat').value;
  const resMul = +document.getElementById('exportRes').value; // 1,2,4,8
  const outW   = Math.round(src.width  * resMul);
  const outH   = Math.round(src.height * resMul);

  const out = document.createElement('canvas');
  out.width = outW; out.height = outH;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, outW, outH);
  if (resMul > 1) applySharpen(ctx, outW, outH, 1);

  const resLabel = resMul === 8 ? '8K' : resMul === 4 ? '4K' : resMul === 2 ? 'HD' : '300dpi';
  const ext = format === 'image/jpeg' ? 'jpg' : 'png';
  const url = out.toDataURL(format, 1.0);
  const a = document.createElement('a');
  a.href = url;
  a.download = `passport_${state.passportW}x${state.passportH}mm_${resLabel}_${outW}x${outH}.${ext}`;
  a.click();
}

// drawCutLines: draws dashed lines STRICTLY inside gutter gaps — never on photos.
// vCuts: [{x, y1, y2}]  vertical line at x spanning gutter gap from y1 to y2
// hCuts: [{y, x1, x2}]  horizontal line at y spanning gutter gap from x1 to x2
function drawCutLines(ctx, vCuts, hCuts, P) {
  const lw   = Math.max(1, Math.round(P * 0.12));
  const dash = [Math.round(P * 2), Math.round(P * 1.5)];
  ctx.strokeStyle = 'rgba(60,60,60,0.7)';
  ctx.lineWidth = lw;
  ctx.setLineDash(dash);
  for (const c of vCuts) { ctx.beginPath(); ctx.moveTo(c.x, c.y1); ctx.lineTo(c.x, c.y2); ctx.stroke(); }
  for (const c of hCuts) { ctx.beginPath(); ctx.moveTo(c.x1, c.y); ctx.lineTo(c.x2, c.y); ctx.stroke(); }
  ctx.setLineDash([]);
}

// drawCellBorder: draws border strips directly on sheet canvas at cell coords.
// Border is always fully visible regardless of photo aspect ratio.
function drawCellBorder(ctx, x, y, cw, ch) {
  if (!state.borderEnabled) return;
  const b = state.borderSize;
  ctx.fillStyle = state.borderColor;
  ctx.fillRect(x,          y,          cw, b);  // top
  ctx.fillRect(x,          y + ch - b, cw, b);  // bottom
  ctx.fillRect(x,          y,          b,  ch); // left
  ctx.fillRect(x + cw - b, y,          b,  ch); // right
}

// photoSrc: returns bgCanvas (no border) for sheet drawing — border is redrawn on sheet
function sheetSrc() {
  return state.finalCanvas || state.bgCanvas || state.croppedCanvas;
}

// ── 4×6 Sheet builder ──────────────────────────────────────────────────────────
function buildSheetCanvas(dpi) {
  const src = sheetSrc();
  if (!src) return null;

  const PX_PER_MM = dpi / 25.4;
  const gutterMM  = +document.getElementById('sheetGutter').value;
  const bgColor   = document.getElementById('sheetBg').value;

  const COLS = 4, ROWS = 2;
  const sheetW = Math.round(152.4 * PX_PER_MM);
  const sheetH = Math.round(101.6 * PX_PER_MM);
  const gutter = Math.round(gutterMM * PX_PER_MM);
  const cellW  = Math.round((sheetW - gutter * (COLS + 1)) / COLS);
  const cellH  = Math.round((sheetH - gutter * (ROWS + 1)) / ROWS);

  const sheet = document.createElement('canvas');
  sheet.width = sheetW; sheet.height = sheetH;
  const ctx = sheet.getContext('2d');
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, sheetW, sheetH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw photos
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = gutter + col * (cellW + gutter);
      const y = gutter + row * (cellH + gutter);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, cellW, cellH);
      const pa = src.width / src.height, ca = cellW / cellH;
      let sw, sh, sx, sy;
      if (pa > ca) { sh = src.height; sw = Math.round(src.height * ca); sy = 0; sx = Math.round((src.width - sw) / 2); }
      else         { sw = src.width;  sh = Math.round(src.width / ca);  sx = 0; sy = Math.round((src.height - sh) / 2); }
      ctx.drawImage(src, sx, sy, sw, sh, x, y, cellW, cellH);
      drawCellBorder(ctx, x, y, cellW, cellH);
    }
  }

  // Cut lines: vertical gaps between columns, horizontal gap between rows
  // Each line sits in the middle of the gutter, spanning only the gutter height/width
  const vCuts = [], hCuts = [];
  const photoTop    = gutter;                          // top of first row
  const photoBottom = gutter + ROWS * cellH + (ROWS - 1) * gutter; // bottom of last row
  const photoLeft   = gutter;                          // left of first col
  const photoRight  = gutter + COLS * cellW + (COLS - 1) * gutter; // right of last col

  // Vertical cuts: between col 0–1, 1–2, 2–3
  for (let col = 0; col < COLS - 1; col++) {
    const rightEdge = gutter + col * (cellW + gutter) + cellW;  // right edge of col
    const leftEdge  = rightEdge + gutter;                        // left edge of next col
    vCuts.push({ x: Math.round((rightEdge + leftEdge) / 2), y1: photoTop, y2: photoBottom });
  }
  // Horizontal cut: between row 0 and row 1
  const bottomEdge = gutter + cellH;
  const topEdge2   = bottomEdge + gutter;
  hCuts.push({ y: Math.round((bottomEdge + topEdge2) / 2), x1: photoLeft, x2: photoRight });

  drawCutLines(ctx, vCuts, hCuts, PX_PER_MM);
  return sheet;
}

function previewSheet() {
  const sheet = buildSheetCanvas(300);
  if (!sheet) return;

  const display  = document.getElementById('sheetCanvas');
  const previewW = Math.min(480, (display.parentElement.clientWidth || 500) - 20);
  const scale    = previewW / sheet.width;
  display.width  = Math.round(sheet.width  * scale);
  display.height = Math.round(sheet.height * scale);
  display.style.width  = display.width  + 'px';
  display.style.height = display.height + 'px';
  const ctx = display.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sheet, 0, 0, display.width, display.height);

  document.getElementById('sheetInfo').textContent =
    `Preview at 300 DPI · Landscape 4×6 inch · 8 photos in 4×2 grid · Download in 8K (4800×3200)`;
}

function downloadSheet() {
  const dpi   = +document.getElementById('sheetDpi').value;
  const sheet = buildSheetCanvas(dpi);
  if (!sheet) { alert('No photo to export.'); return; }
  const label = dpi >= 800 ? '8K' : dpi >= 600 ? '4K' : '300dpi';
  const url = sheet.toDataURL('image/jpeg', 1.0);
  const a = document.createElement('a');
  a.href = url;
  a.download = `passport_4x6_landscape_${label}_${sheet.width}x${sheet.height}_8photos.jpg`;
  a.click();
}

// ── Combo Sheet: 4 Passport (35×45mm) + 6 Stamp (25×30mm) ─────────────────────────
// Landscape 4×6 inch sheet split into two zones:
//   Zone A (top):    4 passport photos side by side  — 35×45mm each
//   Zone B (bottom): 6 stamp size photos side by side — 25×30mm each
// Stamp size (India): 25mm wide × 30mm tall — used for school/railway/govt forms

function buildComboCanvas(dpi) {
  const src = sheetSrc();
  if (!src) return null;

  const P   = dpi / 25.4;
  const gMM = +document.getElementById('comboGutter').value;
  const g   = Math.round(gMM * P);
  const bg  = '#ffffff';

  // Sheet: landscape 6×4 inch
  const sheetW = Math.round(152.4 * P);
  const sheetH = Math.round(101.6 * P);

  // ── Passport zone: 2 cols × 2 rows (35×45mm each) ──────────────────────
  const passW = Math.round(35 * P);
  const passH = Math.round(45 * P);
  // Total passport block: 2 cols, 3 gutters (left, middle, right)
  const passBlockW = g + passW + g + passW + g;  // 3g + 2*passW
  const passBlockH = g + passH + g + passH + g;  // 3g + 2*passH

  // ── Stamp zone: 3 cols × 2 rows (25×30mm each) ─────────────────────────
  const stmpW = Math.round(25 * P);
  const stmpH = Math.round(30 * P);
  // Total stamp block: 2 cols, 3 gutters
  const stmpBlockW = g + stmpW + g + stmpW + g;              // 3g + 2*stmpW
  const stmpBlockH = g + stmpH + g + stmpH + g + stmpH + g;  // 4g + 3*stmpH

  // Place passport block on left, stamp block on right, both vertically centered
  const passStartX = g;
  const passStartY = Math.round((sheetH - passBlockH) / 2);

  const stmpStartX = passStartX + passBlockW + g;  // gap between blocks
  const stmpStartY = Math.round((sheetH - stmpBlockH) / 2);

  const sheet = document.createElement('canvas');
  sheet.width = sheetW; sheet.height = sheetH;
  const ctx = sheet.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sheetW, sheetH);

  const cells = [];
  function drawCell(x, y, cw, ch) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, cw, ch);
    const pa = src.width / src.height, ca = cw / ch;
    let sx, sy, sw, sh;
    if (pa > ca) { sh = src.height; sw = Math.round(src.height * ca); sy = 0; sx = Math.round((src.width - sw) / 2); }
    else         { sw = src.width;  sh = Math.round(src.width / ca);  sx = 0; sy = Math.round((src.height - sh) / 2); }
    ctx.drawImage(src, sx, sy, sw, sh, x, y, cw, ch);
    drawCellBorder(ctx, x, y, cw, ch);
  }

  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 2; col++)
      drawCell(passStartX + g + col * (passW + g), passStartY + g + row * (passH + g), passW, passH);

  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 2; col++)
      drawCell(stmpStartX + g + col * (stmpW + g), stmpStartY + g + row * (stmpH + g), stmpW, stmpH);

  // ── Explicit cut lines — strictly inside gutters, never on photos ──
  const vCuts = [], hCuts = [];

  // Passport block: 1 vertical cut between col 0 and col 1
  const pColGapX = passStartX + g + passW;  // right edge of passport col 0
  const pColGapX2 = pColGapX + g;           // left edge of passport col 1
  vCuts.push({ x: Math.round((pColGapX + pColGapX2) / 2),
               y1: passStartY + g, y2: passStartY + g + 2 * passH + g });
  // Passport block: 1 horizontal cut between row 0 and row 1
  const pRowGapY  = passStartY + g + passH; // bottom of passport row 0
  const pRowGapY2 = pRowGapY + g;           // top of passport row 1
  hCuts.push({ y: Math.round((pRowGapY + pRowGapY2) / 2),
               x1: passStartX + g, x2: passStartX + g + 2 * passW + g });

  // Stamp block: 1 vertical cut between col 0 and col 1
  const sColGapX  = stmpStartX + g + stmpW;
  const sColGapX2 = sColGapX + g;
  vCuts.push({ x: Math.round((sColGapX + sColGapX2) / 2),
               y1: stmpStartY + g, y2: stmpStartY + g + 3 * stmpH + 2 * g });
  // Stamp block: 2 horizontal cuts between rows 0–1 and 1–2
  for (let row = 0; row < 2; row++) {
    const bot = stmpStartY + g + (row + 1) * stmpH + row * g;
    hCuts.push({ y: Math.round((bot + bot + g) / 2),
                 x1: stmpStartX + g, x2: stmpStartX + g + 2 * stmpW + g });
  }

  drawCutLines(ctx, vCuts, hCuts, P);
  return sheet;
}

function previewCombo() {
  const sheet = buildComboCanvas(300);
  if (!sheet) return;
  const display  = document.getElementById('comboCanvas');
  const previewW = Math.min(480, (display.parentElement.clientWidth || 500) - 20);
  const scale    = previewW / sheet.width;
  display.width  = Math.round(sheet.width  * scale);
  display.height = Math.round(sheet.height * scale);
  display.style.width  = display.width  + 'px';
  display.style.height = display.height + 'px';
  const ctx = display.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sheet, 0, 0, display.width, display.height);
  document.getElementById('comboInfo').textContent =
    `4 Passport (35×45mm) + 6 Stamp size (25×30mm) · Landscape 4×6 inch · Export up to 8K`;
}

function downloadCombo() {
  const dpi   = +document.getElementById('comboDpi').value;
  const sheet = buildComboCanvas(dpi);
  if (!sheet) { alert('No photo to export.'); return; }
  const label = dpi >= 800 ? '8K' : dpi >= 600 ? '4K' : '300dpi';
  const url = sheet.toDataURL('image/jpeg', 1.0);
  const a = document.createElement('a');
  a.href = url;
  a.download = `combo_4passport_6stamp_${label}_${sheet.width}x${sheet.height}.jpg`;
  a.click();
}

// ── Triple Combo: 4 Passport (35×45mm) + 4 Stamp (25×30mm) + 4 Token (20×25mm) ───────
// Token/Coin size (20×25mm) — used for PAN card, Aadhaar, Voter ID, railway concession
// Layout: 3 blocks side by side, each 2×2, on landscape 4×6 inch sheet

function buildTripleCanvas(dpi) {
  const src = sheetSrc();
  if (!src) return null;

  const P   = dpi / 25.4;
  const gMM = +document.getElementById('tripleGutter').value;
  const g   = Math.round(gMM * P);

  // Sheet: 152.4 × 101.6 mm (landscape 6×4 inch)
  const sheetW = Math.round(152.4 * P);
  const sheetH = Math.round(101.6 * P);

  const sheet = document.createElement('canvas');
  sheet.width = sheetW; sheet.height = sheetH;
  const ctx = sheet.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sheetW, sheetH);

  // ── EXACT photo sizes, no scaling ──
  // Passport 35×45mm upright        → cell 35w × 45h mm
  // Stamp    25×30mm rotated 90° CW  → cell 30w × 25h mm  (fits height)
  // Token    20×25mm rotated 90° CW  → cell 25w × 20h mm  (fits height)
  //
  // Right column stacked: stamp (top) + token (bottom)
  // Right internal gutter fixed at 1.5mm so both blocks fit in 101.6mm height:
  //   sBlockH = 3×1.5 + 2×25 = 54.5mm
  //   tBlockH = 3×1.5 + 2×20 = 44.5mm
  //   total   = 54.5 + 1.5 + 44.5 = 100.5mm ✔

  const rg = Math.round(1.5 * P); // fixed right-column internal gutter

  // Passport (left column, uses user gutter)
  const pW = Math.round(35 * P), pH = Math.round(45 * P);
  const pBlockW = 3 * g + 2 * pW;
  const pBlockH = 3 * g + 2 * pH;
  const pX = 0;
  const pY = Math.round((sheetH - pBlockH) / 2); // passport stays perfectly centered

  // Stamp rotated 90°: 25×30mm → 30w×25h on sheet
  const sW = Math.round(30 * P), sH = Math.round(25 * P);
  const sBlockW = 3 * rg + 2 * sW;
  const sBlockH = 3 * rg + 2 * sH;

  // Token rotated 90°: 20×25mm → 25w×20h on sheet
  const tW = Math.round(25 * P), tH = Math.round(20 * P);
  const tBlockW = 3 * rg + 2 * tW;
  const tBlockH = 3 * rg + 2 * tH;

  // Right column X start
  const rightX = pBlockW + g;
  const rightW = sheetW - rightX;

  // Stamp + token stacked, centered vertically on sheet — equal margin top and bottom
  const rightTotalH = sBlockH + rg + tBlockH;
  const sY = Math.round((sheetH - rightTotalH) / 2);
  const sX = rightX + Math.round((rightW - sBlockW) / 2);

  // Token: immediately below stamp with just rg cut-gap
  const tX = rightX + Math.round((rightW - tBlockW) / 2);
  const tY = sY + sBlockH + rg;

  const cells = [];
  function drawCell(x, y, cw, ch) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, cw, ch);
    const pa = src.width / src.height, ca = cw / ch;
    let sx, sy, sw, sh;
    if (pa > ca) { sh = src.height; sw = Math.round(src.height * ca); sy = 0; sx = Math.round((src.width - sw) / 2); }
    else         { sw = src.width;  sh = Math.round(src.width / ca);  sx = 0; sy = Math.round((src.height - sh) / 2); }
    ctx.drawImage(src, sx, sy, sw, sh, x, y, cw, ch);
    drawCellBorder(ctx, x, y, cw, ch);
  }

  function drawCellRotated(x, y, cw, ch) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, cw, ch);
    const tmp = document.createElement('canvas');
    tmp.width = cw; tmp.height = ch;
    const tc = tmp.getContext('2d');
    tc.imageSmoothingEnabled = true;
    tc.imageSmoothingQuality = 'high';
    tc.translate(cw / 2, ch / 2);
    tc.rotate(Math.PI / 2);
    const pa = src.width / src.height, ca = ch / cw;
    let sx, sy, sw, sh;
    if (pa > ca) { sh = src.height; sw = Math.round(src.height * ca); sy = 0; sx = Math.round((src.width - sw) / 2); }
    else         { sw = src.width;  sh = Math.round(src.width / ca);  sx = 0; sy = Math.round((src.height - sh) / 2); }
    tc.drawImage(src, sx, sy, sw, sh, -ch / 2, -cw / 2, ch, cw);
    ctx.drawImage(tmp, x, y);
    drawCellBorder(ctx, x, y, cw, ch);
  }

  // Block A: 4 Passport
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 2; col++)
      drawCell(pX + g + col * (pW + g), pY + g + row * (pH + g), pW, pH);

  // Block B: 4 Stamp rotated
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 2; col++)
      drawCellRotated(sX + rg + col * (sW + rg), sY + rg + row * (sH + rg), sW, sH);

  // Block C: 4 Token rotated
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 2; col++)
      drawCellRotated(tX + rg + col * (tW + rg), tY + rg + row * (tH + rg), tW, tH);

  // ── Explicit cut lines — strictly inside gutters ──
  const vCuts = [], hCuts = [];

  // Passport block (left): 1 vertical cut between col 0 and col 1
  const pC0right = pX + g + pW;           // right edge of passport col 0
  const pC1left  = pC0right + g;          // left edge of passport col 1
  vCuts.push({ x: Math.round((pC0right + pC1left) / 2),
               y1: pY + g, y2: pY + g + 2 * pH + g });
  // Passport block: 1 horizontal cut between row 0 and row 1
  const pR0bot = pY + g + pH;             // bottom of passport row 0
  const pR1top = pR0bot + g;              // top of passport row 1
  hCuts.push({ y: Math.round((pR0bot + pR1top) / 2),
               x1: pX + g, x2: pX + g + 2 * pW + g });

  // Stamp block (right-top): 1 vertical cut between col 0 and col 1
  const sC0right = sX + rg + sW;
  const sC1left  = sC0right + rg;
  vCuts.push({ x: Math.round((sC0right + sC1left) / 2),
               y1: sY + rg, y2: sY + rg + 2 * sH + rg });
  // Stamp block: 1 horizontal cut between row 0 and row 1
  const sR0bot = sY + rg + sH;
  const sR1top = sR0bot + rg;
  hCuts.push({ y: Math.round((sR0bot + sR1top) / 2),
               x1: sX + rg, x2: sX + rg + 2 * sW + rg });

  // Token block (right-bottom): 1 vertical cut between col 0 and col 1
  const tC0right = tX + rg + tW;
  const tC1left  = tC0right + rg;
  vCuts.push({ x: Math.round((tC0right + tC1left) / 2),
               y1: tY + rg, y2: tY + rg + 2 * tH + rg });
  // Token block: 1 horizontal cut between row 0 and row 1
  const tR0bot = tY + rg + tH;
  const tR1top = tR0bot + rg;
  hCuts.push({ y: Math.round((tR0bot + tR1top) / 2),
               x1: tX + rg, x2: tX + rg + 2 * tW + rg });

  // Horizontal cut between stamp block and token block (in the rg gap between them)
  const stGapTop = sY + sBlockH;          // bottom of stamp block
  const stGapBot = tY;                    // top of token block
  hCuts.push({ y: Math.round((stGapTop + stGapBot) / 2),
               x1: Math.min(sX, tX) + rg, x2: Math.max(sX + sBlockW, tX + tBlockW) - rg });

  drawCutLines(ctx, vCuts, hCuts, P);
  return sheet;
}

function previewTriple() {
  const sheet = buildTripleCanvas(300);
  if (!sheet) return;
  const display  = document.getElementById('tripleCanvas');
  const previewW = Math.min(480, (display.parentElement.clientWidth || 500) - 20);
  const scale    = previewW / sheet.width;
  display.width  = Math.round(sheet.width  * scale);
  display.height = Math.round(sheet.height * scale);
  display.style.width  = display.width  + 'px';
  display.style.height = display.height + 'px';
  const ctx = display.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sheet, 0, 0, display.width, display.height);
  document.getElementById('tripleInfo').textContent =
    `4 Passport (35×45mm) + 4 Stamp (25×30mm) + 4 Token (20×25mm) · 12 photos · Landscape 4×6 inch`;
}

function downloadTriple() {
  const dpi   = +document.getElementById('tripleDpi').value;
  const sheet = buildTripleCanvas(dpi);
  if (!sheet) { alert('No photo to export.'); return; }
  const label = dpi >= 800 ? '8K' : dpi >= 600 ? '4K' : '300dpi';
  const url = sheet.toDataURL('image/jpeg', 1.0);
  const a = document.createElement('a');
  a.href = url;
  a.download = `combo_triple_${label}_${sheet.width}x${sheet.height}.jpg`;
  a.click();
}