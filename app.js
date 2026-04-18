// ── Paste your Firebase config here ──────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app  = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

const loginScreen = document.getElementById('loginScreen');
const appRoot     = document.getElementById('appRoot');
const loginBtn    = document.getElementById('loginBtn');
const logoutBtn   = document.getElementById('logoutBtn');
const loginMsg    = document.getElementById('loginMsg');

loginBtn.addEventListener('click', async () => {
  loginMsg.textContent = '';
  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    await checkAccess(result.user);
  } catch (e) {
    loginMsg.textContent = '❌ ' + e.message;
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async user => {
  if (user) await checkAccess(user);
  else showLogin('');
});

async function checkAccess(user) {
  const email = user.email.toLowerCase();
  try {
    const snap = await getDoc(doc(db, 'allowlist', email));
    if (snap.exists() && snap.data().active) {
      showApp(user);
    } else {
      await signOut(auth);
      showLogin(`❌ Access denied for ${email}. Ask the owner to add you.`);
    }
  } catch {
    await signOut(auth);
    showLogin('❌ Could not verify access. Try again.');
  }
}

function showApp(user) {
  loginScreen.style.display = 'none';
  appRoot.style.display     = 'block';
  logoutBtn.textContent     = `Sign out (${user.email})`;
  logoutBtn.style.display   = 'inline-block';
}

function showLogin(msg) {
  loginScreen.style.display = 'flex';
  appRoot.style.display     = 'none';
  logoutBtn.style.display   = 'none';
  loginMsg.textContent      = msg;
}

// ────────────────────── PASSPORT APP LOGIC ─────────────────────────────────

// ── State ───────────────────────────────────────────────────────────────────
const state = {
  mode: 'passport',
  passportW: 35, passportH: 45, passportLabel: 'India (35×45mm)',
  idW: 86, idH: 54, idAspect: 86/54,  // Aadhaar/PAN fixed size
  
  // Passport
  originalImage: null,
  croppedCanvas: null,
  bgCanvas: null,
  finalCanvas: null,
  rotationDeg: 0,
  
  // ID Card - Front
  idFrontImage: null,
  idFrontCanvas: null,
  idFrontBgCanvas: null,
  idFrontFinalCanvas: null,
  idFrontRotationDeg: 0,
  idFrontDisplayScale: 1,
  
  // ID Card - Back  
  idBackImage: null,
  idBackCanvas: null,
  idBackBgCanvas: null,
  idBackFinalCanvas: null,
  idBackRotationDeg: 0,
  idBackDisplayScale: 1,
  
  // Shared
  bgColor: '#ffffff',
  borderEnabled: false,
  borderColor: '#000000',
  borderSize: 3,
  idSheetBg: '#ffffff',
  idGutterMM: 5
};

let cropState = {};           // Passport crop
let idFrontCropState = {};    // ID Front crop
let idBackCropState = {};     // ID Back crop

// ── DOM Elements ────────────────────────────────────────────────────────────
const panels = document.querySelectorAll('.panel');
const steps = document.querySelectorAll('.step');

// ── Navigation ──────────────────────────────────────────────────────────────
function goTo(n) {
  panels.forEach((p, i) => p.classList.toggle('active', i + 1 === n));
  steps.forEach((s, i) => {
    s.classList.toggle('active', i + 1 === n);
    s.classList.toggle('done', i + 1 < n);
  });
  
  if (n === 3) initBgStep();
  if (n === 4) initBeautifyStep();
  if (n === 5) initExportStep();
}

function goToID(n) {
  // ID mode panels: panel2b=2, then panel3=3, panel4=4, panel5=5
  panels.forEach(p => p.classList.remove('active'));
  
  if (n === 2) document.getElementById('panel2b').classList.add('active');
  else if (n === 3) { document.getElementById('panel3').classList.add('active'); initIDBgStep(); }
  else if (n === 4) { document.getElementById('panel4').classList.add('active'); initIDBeautifyStep(); }
  else if (n === 5) { document.getElementById('panel5').classList.add('active'); initIDExportStep(); }
  
  // Update step 2 label
  steps[1].textContent = state.mode === 'idcard' ? '2. ID Crop' : '2. Crop';
  steps[1].classList.toggle('active', n === 2);
  steps.forEach((s,i) => s.classList.toggle('done', i+1 < n));
  
  steps[1].classList.toggle('active', n === 2);
}

// ── Step 1: Type Selection ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.type-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      
      state.passportW = +card.dataset.w;
      state.passportH = +card.dataset.h;
      state.passportLabel = card.dataset.label;
      document.getElementById('selectedInfo').textContent = `Selected: ${state.passportLabel}`;
      
      if (card.dataset.type === 'idcard') {
        state.mode = 'idcard';
        document.getElementById('selectedInfo').textContent += ' - Front + Back on 4×6 sheet';
        goToID(2);
      } else {
        state.mode = 'passport';
        goTo(2);
      }
    });
  });

  // ── ID Dual Crop Elements ─────────────────────────────────────────────────
  const frontUploadArea = document.getElementById('frontUploadArea');
  const frontFileInput = document.getElementById('frontFileInput');
  const frontCropSection = document.getElementById('frontCropSection');
  const frontCropCanvas = document.getElementById('frontCropCanvas');
  const frontGuideCanvas = document.getElementById('frontGuideCanvas');
  const frontCropBox = document.getElementById('frontCropBox');
  
  const backUploadArea = document.getElementById('backUploadArea');
  const backFileInput = document.getElementById('backFileInput');
  const backCropSection = document.getElementById('backCropSection');
  const backCropCanvas = document.getElementById('backCropCanvas');
  const backGuideCanvas = document.getElementById('backGuideCanvas');
  const backCropBox = document.getElementById('backCropBox');

  // ── ID Front Upload ────────────────────────────────────────────────────────
  ['dragover', 'dragenter'].forEach(ev => frontUploadArea.addEventListener(ev, e => {
    e.preventDefault(); frontUploadArea.classList.add('drag');
  }));
  ['dragleave', 'drop'].forEach(ev => frontUploadArea.addEventListener(ev, e => {
    e.preventDefault(); frontUploadArea.classList.remove('drag');
    if (ev === 'drop') loadIDFrontFile(e.dataTransfer.files[0]);
  }));
  frontUploadArea.addEventListener('click', () => frontFileInput.click());
  frontFileInput.addEventListener('change', () => loadIDFrontFile(frontFileInput.files[0]));

  // ── ID Back Upload ────────────────────────────────────────────────────────
  ['dragover', 'dragenter'].forEach(ev => backUploadArea.addEventListener(ev, e => {
    e.preventDefault(); backUploadArea.classList.add('drag');
  }));
  ['dragleave', 'drop'].forEach(ev => backUploadArea.addEventListener(ev, e => {
    e.preventDefault(); backUploadArea.classList.remove('drag');
    if (ev === 'drop') loadIDBackFile(e.dataTransfer.files[0]);
  }));
  backUploadArea.addEventListener('click', () => backFileInput.click());
  backFileInput.addEventListener('change', () => loadIDBackFile(backFileInput.files[0]));

  // Init crop drag handlers when panel loads
  setupIDFrontCropDrag();
  setupIDBackCropDrag();
});

function loadIDFrontFile(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.idFrontImage = img;
    state.idFrontOriginalURL = url;
    state.idFrontRotationDeg = 0;
    setupIDFrontCrop();
  };
  img.src = url;
}

function loadIDBackFile(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.idBackImage = img;
    state.idBackOriginalURL = url;
    state.idBackRotationDeg = 0;
    setupIDBackCrop();
    backCropSection.style.display = 'block';
  };
  img.src = url;
}

// ── ID FRONT Crop Functions ─────────────────────────────────────────────────
function setupIDFrontCrop() {
  state.idFrontRotationDeg = 0;
  document.getElementById('frontRotateSlider').value = 0;
  document.getElementById('frontRotateVal').textContent = '0°';
  redrawIDFrontRotated();
}

function redrawIDFrontRotated() {
  const img = state.idFrontImage;
  if (!img) return;
  
  const rad = state.idFrontRotationDeg * Math.PI / 180;
  const sinr = Math.sin(rad), cosr = Math.cos(rad);
  const natW = img.width * Math.abs(cosr) + img.height * Math.abs(sinr);
  const natH = img.width * Math.abs(sinr) + img.height * Math.abs(cosr);
  
  const container = frontCropCanvas.parentElement;
  const maxW = 340, maxH = 280;
  const scale = Math.min(maxW / natW, maxH / natH, 1);
  
  const cw = Math.round(natW * scale);
  const ch = Math.round(natH * scale);
  
  frontCropCanvas.width = cw;
  frontCropCanvas.height = ch;
  frontCropCanvas.style.width = cw + 'px';
  frontCropCanvas.style.height = ch + 'px';
  
  const ctx = frontCropCanvas.getContext('2d');
  ctx.save();
  ctx.translate(cw/2, ch/2);
  ctx.rotate(rad);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, -img.width*scale/2, -img.height*scale/2, img.width*scale, img.height*scale);
  ctx.restore();
  
  state.idFrontDisplayScale = scale;
  
  // Fixed ID aspect 86:54, auto-center crop box
  const aspect = state.idAspect;
  let bw = Math.min(cw * 0.85, Math.round(ch * 0.75 * aspect));
  let bh = Math.round(bw / aspect);
  let bx = Math.round((cw - bw) / 2);
  let by = Math.round((ch - bh) / 2);
  
  // Preserve previous crop if exists
  if (idFrontCropState.cw) {
    const fX = idFrontCropState.x / idFrontCropState.cw;
    const fY = idFrontCropState.y / idFrontCropState.ch;
    bx = Math.round(fX * cw);
    by = Math.round(fY * ch);
    bx = Math.max(0, Math.min(cw - bw, bx));
    by = Math.max(0, Math.min(ch - bh, by));
  }
  
  idFrontCropState = {x: bx, y: by, w: bw, h: bh, cw, ch, aspect};
  updateIDFrontCropBox();
}

function idRotateFront(deg, reset) {
  if (reset) state.idFrontRotationDeg = 0;
  else state.idFrontRotationDeg = (state.idFrontRotationDeg + deg + 360) % 360;
  
  const sliderVal = Math.max(-45, Math.min(45, state.idFrontRotationDeg));
  document.getElementById('frontRotateSlider').value = sliderVal;
  document.getElementById('frontRotateVal').textContent = state.idFrontRotationDeg + '°';
  redrawIDFrontRotated();
}

function idRotateFrontTo(val) {
  state.idFrontRotationDeg = +val;
  document.getElementById('frontRotateVal').textContent = val + '°';
  redrawIDFrontRotated();
}

function updateIDFrontCropBox() {
  const {x, y, w, h} = idFrontCropState;
  frontCropBox.style.left = x + 'px';
  frontCropBox.style.top = y + 'px';
  frontCropBox.style.width = w + 'px';
  frontCropBox.style.height = h + 'px';
  
  // Draw ID card guides (simplified rectangle)
  drawIDCardGuides(frontGuideCanvas, x, y, w, h);
}

function drawIDCardGuides(canvas, x, y, w, h) {
  canvas.width = frontCropCanvas.width;
  canvas.height = frontCropCanvas.height;
  canvas.style.width = frontCropCanvas.style.width;
  canvas.style.height = frontCropCanvas.style.height;
  
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.strokeStyle = '#38a169';
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(x+4, y+4, w-8, h-8);
  ctx.setLineDash([]);
  
  ctx.fillStyle = 'rgba(56, 166, 103, 0.9)';
  ctx.font = `bold ${Math.min(14, w*0.08)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('ID Card 86×54mm', x + w/2, y + h + 20);
}

// ── ID BACK Crop Functions (mirror front) ──────────────────────────────────
function setupIDBackCrop() {
  state.idBackRotationDeg = 0;
  document.getElementById('backRotateSlider').value = 0;
  document.getElementById('backRotateVal').textContent = '0°';
  redrawIDBackRotated();
}

function redrawIDBackRotated() {
  const img = state.idBackImage;
  if (!img) return;
  
  const rad = state.idBackRotationDeg * Math.PI / 180;
  const sinr = Math.sin(rad), cosr = Math.cos(rad);
  const natW = img.width * Math.abs(cosr) + img.height * Math.abs(sinr);
  const natH = img.width * Math.abs(sinr) + img.height * Math.abs(cosr);
  
  const maxW = 340, maxH = 280;
  const scale = Math.min(maxW / natW, maxH / natH, 1);
  
  const cw = Math.round(natW * scale);
  const ch = Math.round(natH * scale);
  
  backCropCanvas.width = cw;
  backCropCanvas.height = ch;
  backCropCanvas.style.width = cw + 'px';
  backCropCanvas.style.height = ch + 'px';
  
  const ctx = backCropCanvas.getContext('2d');
  ctx.save();
  ctx.translate(cw/2, ch/2);
  ctx.rotate(rad);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, -img.width*scale/2, -img.height*scale/2, img.width*scale, img.height*scale);
  ctx.restore();
  
  state.idBackDisplayScale = scale;
  
  const aspect = state.idAspect;
  let bw = Math.min(cw * 0.85, Math.round(ch * 0.75 * aspect));
  let bh = Math.round(bw / aspect);
  let bx = Math.round((cw - bw) / 2);
  let by = Math.round((ch - bh) / 2);
  
  if (idBackCropState.cw) {
    const fX = idBackCropState.x / idBackCropState.cw;
    const fY = idBackCropState.y / idBackCropState.ch;
    bx = Math.round(fX * cw);
    by = Math.round(fY * ch);
    bx = Math.max(0, Math.min(cw - bw, bx));
    by = Math.max(0, Math.min(ch - bh, by));
  }
  
  idBackCropState = {x: bx, y: by, w: bw, h: bh, cw, ch, aspect};
  updateIDBackCropBox();
}

function idRotateBack(deg, reset) {
  if (reset) state.idBackRotationDeg = 0;
  else state.idBackRotationDeg = (state.idBackRotationDeg + deg + 360) % 360;
  
  const sliderVal = Math.max(-45, Math.min(45, state.idBackRotationDeg));
  document.getElementById('backRotateSlider').value = sliderVal;
  document.getElementById('backRotateVal').textContent = state.idBackRotationDeg + '°';
  redrawIDBackRotated();
}

function idRotateBackTo(val) {
  state.idBackRotationDeg = +val;
  document.getElementById('backRotateVal').textContent = val + '°';
  redrawIDBackRotated();
}

function updateIDBackCropBox() {
  const {x, y, w, h} = idBackCropState;
  backCropBox.style.left = x + 'px';
  backCropBox.style.top = y + 'px';
  backCropBox.style.width = w + 'px';
  backCropBox.style.height = h + 'px';
  
  drawIDCardGuides(backGuideCanvas, x, y, w, h);
}

// ── ID Crop Drag Handlers ───────────────────────────────────────────────────
function setupIDFrontCropDrag() {
  let drag = null;
  const canvas = frontCropCanvas;
  const box = frontCropBox;
  
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0] : e).clientX - rect.left;
    const cy = (e.touches ? e.touches[0] : e).clientY - rect.top;
    return {x: cx, y: cy};
  }
  
  function onStart(e, type) {
    e.preventDefault();
    const pos = getPos(e);
    drag = {type, startX: pos.x, startY: pos.y, ...idFrontCropState};
  }
  
  // Move entire box
  box.addEventListener('mousedown', e => onStart(e, 'move'));
  box.addEventListener('touchstart', e => onStart(e.touches[0], 'move'), {passive: false});
  
  // Corner resize
  box.querySelectorAll('.handle').forEach(handle => {
    const type = Array.from(handle.classList).find(cls => ['tl','tr','bl','br'].includes(cls));
    handle.addEventListener('mousedown', e => { e.stopPropagation(); onStart(e, type); });
    handle.addEventListener('touchstart', e => { e.stopPropagation(); onStart(e.touches[0], type); }, {passive: false});
  });
  
  function onMove(e) {
    if (!drag) return;
    e.preventDefault();
    const pos = getPos(e);
    const dx = pos.x - drag.startX;
    const dy = pos.y - drag.startY;
    const aspect = state.idAspect;
    
    let nx = drag.x, ny = drag.y, nw = drag.w, nh = drag.h;
    
    if (drag.type === 'move') {
      nx = Math.max(0, Math.min(drag.cw - nw, drag.x + dx));
      ny = Math.max(0, Math.min(drag.ch - nh, drag.y + dy));
    } else {
      if (drag.type === 'br') { nw = Math.max(50, drag.w + dx); nh = Math.round(nw / aspect); }
      if (drag.type === 'bl') { nw = Math.max(50, drag.w - dx); nh = Math.round(nw / aspect); nx = drag.x + drag.w - nw; }
      if (drag.type === 'tr') { nw = Math.max(50, drag.w + dx); nh = Math.round(nw / aspect); ny = drag.y + drag.h - nh; }
      if (drag.type === 'tl') { nw = Math.max(50, drag.w - dx); nh = Math.round(nw / aspect); nx = drag.x + drag.w - nw; ny = drag.y + drag.h - nh; }
      
      nx = Math.max(0, nx);
      ny = Math.max(0, ny);
      nw = Math.min(nw, drag.cw - nx);
      nh = Math.min(nh, drag.ch - ny);
    }
    
    idFrontCropState = { ...idFrontCropState, x: nx, y: ny, w: nw, h: nh };
    updateIDFrontCropBox();
  }
  
  function onEnd() { drag = null; }
  
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchmove', onMove, {passive: false});
  document.addEventListener('touchend', onEnd);
}

function setupIDBackCropDrag() {
  // Mirror front logic for back
  let drag = null;
  const canvas = backCropCanvas;
  const box = backCropBox;
  
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0] : e).clientX - rect.left;
    const cy = (e.touches ? e.touches[0] : e).clientY - rect.top;
    return {x: cx, y: cy};
  }
  
  function onStart(e, type) {
    e.preventDefault();
    const pos = getPos(e);
    drag = {type, startX: pos.x, startY: pos.y, ...idBackCropState};
  }
  
  box.addEventListener('mousedown', e => onStart(e, 'move'));
  box.addEventListener('touchstart', e => onStart(e.touches[0], 'move'), {passive: false});
  
  box.querySelectorAll('.handle').forEach(handle => {
    const type = Array.from(handle.classList).find(cls => ['tl','tr','bl','br'].includes(cls));
    handle.addEventListener('mousedown', e => { e.stopPropagation(); onStart(e, type); });
    handle.addEventListener('touchstart', e => { e.stopPropagation(); onStart(e.touches[0], type); }, {passive: false});
  });
  
  function onMove(e) {
    if (!drag) return;
    e.preventDefault();
    const pos = getPos(e);
    const dx = pos.x - drag.startX;
    const dy = pos.y - drag.startY;
    const aspect = state.idAspect;
    
    let nx = drag.x, ny = drag.y, nw = drag.w, nh = drag.h;
    
    if (drag.type === 'move') {
      nx = Math.max(0, Math.min(drag.cw - nw, drag.x + dx));
      ny = Math.max(0, Math.min(drag.ch - nh, drag.y + dy));
    } else {
      if (drag.type === 'br') { nw = Math.max(50, drag.w + dx); nh = Math.round(nw / aspect); }
      if (drag.type === 'bl') { nw = Math.max(50, drag.w - dx); nh = Math.round(nw / aspect); nx = drag.x + drag.w - nw; }
      if (drag.type === 'tr') { nw = Math.max(50, drag.w + dx); nh = Math.round(nw / aspect); ny = drag.y + drag.h - nh; }
      if (drag.type === 'tl') { nw = Math.max(50, drag.w - dx); nh = Math.round(nw / aspect); nx = drag.x + drag.w - nw; ny = drag.y + drag.h - nh; }
      
      nx = Math.max(0, nx);
      ny = Math.max(0, ny);
      nw = Math.min(nw, drag.cw - nx);
      nh = Math.min(nh, drag.ch - ny);
    }
    
    idBackCropState = { ...idBackCropState, x: nx, y: ny, w: nw, h: nh };
    updateIDBackCropBox();
  }
  
  function onEnd() { drag = null; }
  
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchmove', onMove, {passive: false});
  document.addEventListener('touchend', onEnd);
}

// ── Apply ID Crops (both sides → full-res canvases) ─────────────────────────
// ── ID Background/Beautify Init ────────────────────────────────────────────
function initIDBgStep() {
  // Clone cropped canvases for BG processing
  state.idFrontBgCanvas = cloneCanvas(state.idFrontCanvas);
  state.idBackBgCanvas = cloneCanvas(state.idBackCanvas);
  renderIDBgPreview();
}

function cloneCanvas(src) {
  const dst = document.createElement('canvas');
  dst.width = src.width;
  dst.height = src.height;
  dst.getContext('2d').drawImage(src, 0, 0);
  return dst;
}

function renderIDBgPreview() {
  // Preview front (main display)
  const canvas = document.getElementById('bgCanvas');
  const src = state.idFrontBgCanvas;
  const maxW = 260;
  const scale = Math.min(1, maxW / src.width);
  
  canvas.width = Math.round(src.width * scale);
  canvas.height = Math.round(src.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
}

function applyIDBgColor() {
  // Apply to both front/back with same settings
  const srcFront = state.idFrontRemovedCanvas || state.idFrontCanvas;
  const srcBack = state.idBackRemovedCanvas || state.idBackCanvas;
  
  state.idFrontBgCanvas = addBackground(srcFront, state.bgColor, state.borderEnabled, state.borderColor, state.borderSize);
  state.idBackBgCanvas = addBackground(srcBack, state.bgColor, state.borderEnabled, state.borderColor, state.borderSize);
  
  renderIDBgPreview();
}

function addBackground(src, bgColor, border, bColor, bSize) {
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0);
  
  if (border) {
    ctx.fillStyle = bColor;
    ctx.fillRect(0, 0, canvas.width, bSize);                    // top
    ctx.fillRect(0, canvas.height - bSize, canvas.width, bSize); // bottom
    ctx.fillRect(0, 0, bSize, canvas.height);                   // left
    ctx.fillRect(canvas.width - bSize, 0, bSize, canvas.height); // right
  }
  
  return canvas;
}

function initIDBeautifyStep() {
  // Reset sliders
  document.getElementById('beautyLevel').value = 0;
  ['brightness','contrast','saturation','sharpness','smooth','quality'].forEach(id => 
    document.getElementById(id).value = id.includes('brightness') || id.includes('contrast') || id.includes('saturation') ? '100' : '0'
  );
  applyIDFilters();
}

function applyIDFilters() {
  // Apply same filters to both front/back
  const filters = {
    brightness: +document.getElementById('brightness').value / 100,
    contrast: +document.getElementById('contrast').value / 100,
    saturation: +document.getElementById('saturation').value / 100,
    // ... more filter logic (simplified)
  };
  
  state.idFrontFinalCanvas = applyFiltersToCanvas(state.idFrontBgCanvas, filters);
  state.idBackFinalCanvas = applyFiltersToCanvas(state.idBackBgCanvas, filters);
  
  // Update slider values display
  document.querySelectorAll('[id$="Val"]').forEach(el => {
    const id = el.id.replace('Val', '');
    el.textContent = document.getElementById(id).value;
  });
  
  // Preview front
  const canvas = document.getElementById('beautifyCanvas');
  const src = state.idFrontFinalCanvas;
  const scale = Math.min(1, 260 / src.width);
  canvas.width = Math.round(src.width * scale);
  canvas.height = Math.round(src.height * scale);
  canvas.getContext('2d').drawImage(src, 0, 0, canvas.width, canvas.height);
}

function applyFiltersToCanvas(canvas, filters) {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  
  ctx.filter = `brightness(${filters.brightness}) contrast(${filters.contrast}) saturate(${filters.saturation})`;
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';
  
  return out;
}

function initIDExportStep() {
  previewIDSheet();
}

// ── 4x6 ID Sheet Builder (Front Left + Back Right) ──────────────────────────
function buildIDSheetCanvas(dpi = 300) {
  if (!state.idFrontFinalCanvas || !state.idBackFinalCanvas) return null;
  
  const PX_PER_MM = dpi / 25.4;
  const sheetWMM = 152.4, sheetHMM = 101.6;  // 4x6 landscape
  const sheetW = Math.round(sheetWMM * PX_PER_MM);
  const sheetH = Math.round(sheetHMM * PX_PER_MM);
  
  const gutterMM = +document.getElementById('idGutter').value || 5;
  const gutter = Math.round(gutterMM * PX_PER_MM);
  const bgColor = document.getElementById('idSheetBg').value;
  
  const canvas = document.createElement('canvas');
  canvas.width = sheetW;
  canvas.height = sheetH;
  const ctx = canvas.getContext('2d');
  
  // Sheet background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, sheetW, sheetH);
  
  // Left: Front card (86x54mm + border)
  const cardWMM = 86, cardHMM = 54;
  const cardW = Math.round(cardWMM * PX_PER_MM);
  const cardH = Math.round(cardHMM * PX_PER_MM);
  const borderPx = state.idBorderPx || 8;
  
  const frontX = gutter;
  const frontY = Math.round((sheetH - cardH) / 2);
  const frontCellW = cardW + borderPx*2;
  const frontCellH = cardH + borderPx*2;
  
  // Front card background + image + thick black border
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(frontX, frontY, frontCellW, frontCellH);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(state.idFrontFinalCanvas, 
    frontX + borderPx, frontY + borderPx, cardW, cardH);
  
  // Thick black border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = borderPx * 2;
  ctx.lineJoin = 'round';
  ctx.strokeRect(frontX, frontY, frontCellW, frontCellH);
  
  // Right: Back card (symmetric)
  const backX = sheetW - gutter - frontCellW;
  const backY = frontY;
  
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(backX, backY, frontCellW, frontCellH);
  ctx.drawImage(state.idBackFinalCanvas, 
    backX + borderPx, backY + borderPx, cardW, cardH);
  
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = borderPx * 2;
  ctx.strokeRect(backX, backY, frontCellW, frontCellH);
  
  // Center cut line (vertical gutter between cards)
  const cutX = Math.round((frontX + frontCellW + backX) / 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(cutX, gutter);
  ctx.lineTo(cutX, sheetH - gutter);
  ctx.stroke();
  
  return canvas;
}

function previewIDSheet() {
  const sheet = buildIDSheetCanvas(300);
  if (!sheet) return;
  
  const canvas = document.getElementById('idSheetCanvas');
  const previewW = Math.min(480, canvas.parentElement.clientWidth - 20);
  const scale = previewW / sheet.width;
  
  canvas.width = Math.round(sheet.width * scale);
  canvas.height = Math.round(sheet.height * scale);
  canvas.style.width = canvas.width + 'px';
  canvas.style.height = canvas.height + 'px';
  
  canvas.getContext('2d').drawImage(sheet, 0, 0, canvas.width, canvas.height);
  
  document.getElementById('idSheetInfo').textContent = 
    `4×6" Landscape | Front (L) + Back (R) | 86×54mm cards | ${sheet.width}×${sheet.height}px`;
}

function downloadIDSheet() {
  const dpi = +document.getElementById('idDpi').value;
  const sheet = buildIDSheetCanvas(dpi);
  if (!sheet) { alert('No ID photos ready'); return; }
  
  const label = dpi >= 800 ? '8K' : dpi >= 600 ? 'HD' : 'std';
  sheet.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `idcard_4x6_front-back_${label}_${sheet.width}x${sheet.height}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/jpeg', 0.98);  // High quality
}

// ── Background color swatches (shared passport/ID) ──────────────────────────
document.querySelectorAll('.swatch:not(.custom-swatch):not(.b-swatch)').forEach(swatch => {
  swatch.addEventListener('click', () => {
    document.querySelectorAll('.swatch:not(.b-swatch)').forEach(s => s.classList.remove('selected'));
    swatch.classList.add('selected');
    state.bgColor = swatch.dataset.color;
    if (state.mode === 'passport' && state.bgCanvas) applyBgColor();
    else if (state.mode === 'idcard') applyIDBgColor();
  });
});
