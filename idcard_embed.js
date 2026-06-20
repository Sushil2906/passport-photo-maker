// Embedded ID Card Printer (isolated from passport photo maker)
// Uses idcard-* DOM ids from New folder/index.html

// ── Toast ───────────────────────────────────────────────────────────────
function idcardToast(msg, type = 'success') {
  const el = document.getElementById('idCardToast');
  if (!el) return;
  el.textContent = msg;
  el.style.position = 'fixed';
  el.style.bottom = '28px';
  el.style.left = '50%';
  el.style.transform = 'translateX(-50%) translateY(0)';
  el.style.background = type === 'error' ? '#dc2626' : '#1e293b';
  el.style.color = '#fff';
  el.style.padding = '10px 22px';
  el.style.borderRadius = '8px';
  el.style.fontSize = '0.9rem';
  el.style.fontWeight = '500';
  el.style.zIndex = '999';
  el.style.whiteSpace = 'nowrap';

  clearTimeout(idcardToast._t);
  idcardToast._t = setTimeout(() => {
    el.textContent = '';
  }, 2800);
}

// ── State ───────────────────────────────────────────────────────────────
const idcardState = {
  cardW: 85,
  cardH: 54,
  frontImg: null,
  backImg: null,
  croppedFront: null,
  croppedBack: null,
  editedFront: null,
  editedBack: null,
  cropSide: 'front',
  editSide: 'front',
  hasBack: true,
  edits: {
    front: { brightness: 100, contrast: 100, sharpness: 0, clarity: 0 },
    back: { brightness: 100, contrast: 100, sharpness: 0, clarity: 0 }
  }
};

// ── Helpers ─────────────────────────────────────────────────────────────
function idcardCap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function idcardGetStepPanel(n) {
  const map = { 1: 'idcard-step-size', 2: 'idcard-step-upload', 3: 'idcard-step-crop', 4: 'idcard-step-edit', 5: 'idcard-step-preview' };
  return map[n];
}

function idcardSetProgress(n) {
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('idcard-prog-' + i);
    if (!el) continue;
    el.style.background = (i === n) ? '#1a56db' : (i < n) ? '#16a34a' : '#e2e8f0';
    el.style.color = (i <= n) ? '#fff' : '#94a3b8';
    el.style.borderRadius = '50%';
    el.style.width = '32px';
    el.style.height = '32px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.textContent = String(i <= 5 ? i : '');
  }
}

function idcardHideAllSteps() {
  document.querySelectorAll('.idcard-step').forEach(s => s.classList.add('hidden'));
}

// ── Step navigation ─────────────────────────────────────────────────────
function idcardGoToStep(n) {
  if (n === 2) {
    // no-op
  }
  if (n === 3 && !idcardState.frontImg) {
    idcardToast('Please upload the front image first.', 'error');
    return;
  }
  if (n === 4 && !idcardState.croppedFront) {
    idcardToast('Please crop the front side first.', 'error');
    return;
  }
  if (n === 5) idcardBuildPrintPreview();

  idcardHideAllSteps();
  const pid = idcardGetStepPanel(n);
  const panel = document.getElementById(pid);
  if (panel) panel.classList.remove('hidden');

  idcardSetProgress(n);

  if (n === 3) idcardInitCrop();
  if (n === 4) idcardInitEdit();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Show/Hide wrapper ───────────────────────────────────────────────────
function showIdCardMaker() {
  const wrap = document.getElementById('idCardWrapper');
  if (!wrap) return;

  // Hide passport maker UI while showing ID maker
  document.querySelectorAll('#appRoot .steps').forEach(s => {
    s.style.display = 'none';
  });

  document.querySelectorAll('#appRoot .step').forEach(s => {
    s.style.display = 'none';
    s.classList.remove('active');
  });

  document.querySelectorAll('#appRoot .panel').forEach(p => {
    p.style.display = 'none';
    p.classList.remove('active');
  });

  // Hide selected label in ID maker mode too
  const selectedInfo = document.getElementById('selectedInfo');
  if (selectedInfo) selectedInfo.style.display = 'none';

  wrap.style.display = 'block';
  // ensure crop has correct state
  idcardState.hasBack = document.getElementById('idcard-has-back').checked;
  idcardApplyBackToggle();
  idcardGoToStep(1);
}

function hideIdCardMaker() {
  const wrap = document.getElementById('idCardWrapper');
  if (!wrap) return;

  wrap.style.display = 'none';

  // Always restore the passport maker UI fully.
  document.querySelectorAll('#appRoot .steps').forEach(s => {
    s.style.display = '';
  });

  // app.js uses classes (.panel.active / .step.active) to control visibility,
  // but idcard maker overwrites inline styles, so remove those inline styles.
  document.querySelectorAll('#appRoot .panel').forEach(p => {
    p.style.display = '';
  });

  document.querySelectorAll('#appRoot .step').forEach(s => {
    s.style.display = '';
  });

  // Do NOT change app.js active/done classes here.
}




function showPassportMaker() {
  const wrap = document.getElementById('idCardWrapper');
  if (wrap) wrap.style.display = 'none';

  document.querySelectorAll('#appRoot .steps').forEach(s => {
    s.style.display = '';
  });

  document.querySelectorAll('#appRoot .panel').forEach(p => {
    p.style.display = '';
  });

  document.querySelectorAll('#appRoot .step').forEach(s => {
    s.style.display = '';
  });

  // Hide until user clicks a passport type button
  const selectedInfo = document.getElementById('selectedInfo');
  if (selectedInfo) selectedInfo.style.display = 'none';

  // Start from step 1 every time
  // (app.js goTo uses panel/step classes)
  if (typeof goTo === 'function') goTo(1);
}

function hidePassportMaker() {
  // Default: return to ID card option screen
  showIdCardMaker();
}

// If user clicks browser back from ID maker, keep passport maker visible and move to step 1
// (No extra back button is rendered.)


window.showIdCardMaker = showIdCardMaker;
window.hideIdCardMaker = hideIdCardMaker;
window.showPassportMaker = showPassportMaker;
window.hidePassportMaker = hidePassportMaker;
window.idcardGoToStep = idcardGoToStep;


// ── Back-side toggle ────────────────────────────────────────────────────
document.getElementById('idcard-has-back')?.addEventListener('change', function () {
  idcardState.hasBack = this.checked;
  idcardApplyBackToggle();
});

function idcardApplyBackToggle() {
  const show = idcardState.hasBack;
  const backUploadBox = document.getElementById('idcard-back-upload-box');
  const backTab = document.getElementById('idcard-tab-back');
  const backCropped = document.getElementById('idcard-back-cropped-preview');
  const editTabBack = document.getElementById('idcard-edit-tab-back-btn');

  if (backUploadBox) backUploadBox.style.display = show ? '' : 'none';
  if (backTab) backTab.style.display = show ? '' : 'none';
  if (backCropped) backCropped.style.display = show ? '' : 'none';
  if (editTabBack) editTabBack.style.display = show ? '' : 'none';

  if (!show) {
    if (idcardState.cropSide === 'back') idcardSwitchCropTab('front');
    if (idcardState.editSide === 'back') idcardSwitchEditTab('front');
  }
}

// ── Step 1: Card Size ───────────────────────────────────────────────────
document.querySelectorAll('.size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!btn.closest('#idCardWrapper')) return;

    document.querySelectorAll('#idCardWrapper .size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const custom = document.getElementById('idcard-custom-size');
    const isOther = btn.id === 'idcard-other-btn';

    if (isOther) {
      custom.style.display = 'flex';
      return;
    }

    custom.style.display = 'none';
    idcardState.cardW = parseFloat(btn.dataset.w);
    idcardState.cardH = parseFloat(btn.dataset.h);
    document.getElementById('idcard-size-display').textContent = `${idcardState.cardW} × ${idcardState.cardH} mm`;
  });
});

document.getElementById('idcard-apply-custom')?.addEventListener('click', () => {
  const w = parseFloat(document.getElementById('idcard-custom-w').value);
  const h = parseFloat(document.getElementById('idcard-custom-h').value);
  if (!w || !h || w <= 0 || h <= 0) {
    idcardToast('Enter valid mm values.', 'error');
    return;
  }
  idcardState.cardW = w;
  idcardState.cardH = h;
  document.getElementById('idcard-size-display').textContent = `${idcardState.cardW} × ${idcardState.cardH} mm`;
  idcardToast('Custom size applied ✓');
});

// ── Step 2: Upload ──────────────────────────────────────────────────────
// pdf.js worker
if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

function idcardSetupUpload(inputId, canvasId, statusId, dropInnerId, side) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener('change', async function () {
    const file = this.files[0];
    if (!file) return;
    await idcardHandleFile(file, canvasId, statusId, dropInnerId, side);
  });
}

async function idcardHandleFile(file, canvasId, statusId, dropInnerId, side) {
  const statusEl = document.getElementById(statusId);
  const dropInner = document.getElementById(dropInnerId);

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    statusEl.innerHTML = '<span class="spinner"></span> Loading PDF…';
    statusEl.style.display = 'flex';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await idcardLoadPDF(arrayBuffer);
    if (!pdf) {
      statusEl.style.display = 'none';
      return;
    }

    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });

    const targetPx = 4800;
    const scale = Math.min(targetPx / baseViewport.width, 12);
    const viewport = page.getViewport({ scale });

    const offscreen = document.createElement('canvas');
    offscreen.width = Math.round(viewport.width);
    offscreen.height = Math.round(viewport.height);

    const octx = offscreen.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';

    await page.render({ canvasContext: octx, viewport }).promise;

    idcardState[side + 'Img'] = offscreen;
    statusEl.style.display = 'none';
    if (dropInner) {
      dropInner.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg><span style="color:#16a34a">PDF loaded ✓</span>`;
    }

    idcardShowUploadPreview(canvasId, offscreen);
  } else {
    statusEl.innerHTML = '<span class="spinner"></span> Loading…';
    statusEl.style.display = 'flex';

    const img = new Image();
    img.onload = () => {
      idcardState[side + 'Img'] = img;
      statusEl.style.display = 'none';
      if (dropInner) {
        dropInner.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg><span style="color:#16a34a">Image loaded ✓</span>`;
      }
      idcardShowUploadPreview(canvasId, img);
    };
    img.src = URL.createObjectURL(file);
  }
}

function idcardShowUploadPreview(canvasId, source) {
  const cv = document.getElementById(canvasId);
  if (!cv) return;
  const w = source.width || source.naturalWidth;
  const h = source.height || source.naturalHeight;

  cv.style.display = 'block';
  const sc = Math.min(380 / w, 220 / h);
  cv.width = Math.round(w * sc);
  cv.height = Math.round(h * sc);

  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, cv.width, cv.height);
}

async function idcardLoadPDF(arrayBuffer) {
  return new Promise(resolve => {
    function tryLoad(password) {
      const params = { data: arrayBuffer };
      if (password) params.password = password;
      const task = window.pdfjsLib.getDocument(params);
      task.onPassword = (updatePwd, reason) => {
        const msg = reason === 2 ? 'Wrong password, try again:' : 'PDF is password protected. Enter password:';
        const pwd = prompt(msg);
        if (pwd === null) {
          task.destroy();
          resolve(null);
          return;
        }
        updatePwd(pwd);
      };
      task.promise.then(resolve).catch(() => resolve(null));
    }
    tryLoad(null);
  });
}

idcardSetupUpload('idcard-front-upload', 'idcard-front-preview-canvas', 'idcard-front-status', 'idcard-front-drop-inner', 'front');
idcardSetupUpload('idcard-back-upload', 'idcard-back-preview-canvas', 'idcard-back-status', 'idcard-back-drop-inner', 'back');

// drag/drop for upload boxes (optional, minimal)
function idcardEnableDrop(dropInnerId, inputId, side) {
  const box = document.getElementById(dropInnerId)?.closest('.file-drop');
  const input = document.getElementById(inputId);
  if (!box || !input) return;

  box.addEventListener('dragover', e => { e.preventDefault(); box.style.borderColor = '#1a56db'; });
  box.addEventListener('dragleave', () => { box.style.borderColor = ''; });
  box.addEventListener('drop', async e => {
    e.preventDefault();
    box.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (!file) return;
    await idcardHandleFile(file, side === 'front' ? 'idcard-front-preview-canvas' : 'idcard-back-preview-canvas',
      side === 'front' ? 'idcard-front-status' : 'idcard-back-status',
      side === 'front' ? 'idcard-front-drop-inner' : 'idcard-back-drop-inner', side);
  });
}

idcardEnableDrop('idcard-front-drop-inner', 'idcard-front-upload', 'front');
idcardEnableDrop('idcard-back-drop-inner', 'idcard-back-upload', 'back');

// ── Step 3: Crop ─────────────────────────────────────────────────────────
let idcardCropScale = 1;
let idcardCropBox = { x: 0, y: 0, w: 0, h: 0 };
let idcardInteraction = null;

function idcardSwitchCropTab(side) {
  idcardState.cropSide = side;
  const tf = document.getElementById('idcard-tab-front');
  const tb = document.getElementById('idcard-tab-back');
  if (tf) tf.classList.toggle('active', side === 'front');
  if (tb) tb.classList.toggle('active', side === 'back');
  idcardInitCrop();
}
window.idcardSwitchCropTab = idcardSwitchCropTab;

function idcardInitCrop() {
  const src = idcardState.cropSide === 'front' ? idcardState.frontImg : idcardState.backImg;
  if (!src) {
    if (idcardState.cropSide === 'back') return;
    idcardToast('No image for this side.', 'error');
    return;
  }

  const srcW = src.width || src.naturalWidth;
  const srcH = src.height || src.naturalHeight;

  const cv = document.getElementById('idcard-crop-canvas');
  const maxW = Math.min(window.innerWidth - 64, 780);
  const maxH = 520;
  idcardCropScale = Math.min(maxW / srcW, maxH / srcH);

  cv.width = Math.round(srcW * idcardCropScale);
  cv.height = Math.round(srcH * idcardCropScale);

  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, cv.width, cv.height);

  const ratio = idcardState.cardW / idcardState.cardH;
  let bw = cv.width * 0.6;
  let bh = bw / ratio;
  if (bh > cv.height * 0.6) { bh = cv.height * 0.6; bw = bh * ratio; }

  idcardCropBox = { x: (cv.width - bw) / 2, y: (cv.height - bh) / 2, w: bw, h: bh };
  idcardRenderCropBox();
}

function idcardRenderCropBox() {
  const el = document.getElementById('idcard-crop-box');
  el.style.left = idcardCropBox.x + 'px';
  el.style.top = idcardCropBox.y + 'px';
  el.style.width = idcardCropBox.w + 'px';
  el.style.height = idcardCropBox.h + 'px';
}

const idcardCropBoxEl = document.getElementById('idcard-crop-box');

function idcardGetPointer(e) {
  const t = e.touches ? e.touches[0] : e;
  return { x: t.clientX, y: t.clientY };
}

idcardCropBoxEl?.addEventListener('mousedown', startMove);
idcardCropBoxEl?.addEventListener('touchstart', startMove, { passive: false });

function startMove(e) {
  if (e.target.classList.contains('rh')) return;
  e.preventDefault();
  idcardInteraction = { type: 'move', startMouse: idcardGetPointer(e), startBox: { ...idcardCropBox } };
}

idcardCropBoxEl?.querySelectorAll('.rh').forEach(h => {
  h.addEventListener('mousedown', e => startResize(e, h.dataset.h));
  h.addEventListener('touchstart', e => startResize(e, h.dataset.h), { passive: false });
});

function startResize(e, handle) {
  e.preventDefault();
  e.stopPropagation();
  idcardInteraction = { type: 'resize', handle, startMouse: idcardGetPointer(e), startBox: { ...idcardCropBox } };
}

document.addEventListener('mousemove', idcardOnDrag);
document.addEventListener('touchmove', idcardOnDrag, { passive: false });
document.addEventListener('mouseup', () => { idcardInteraction = null; });
document.addEventListener('touchend', () => { idcardInteraction = null; });

function idcardOnDrag(e) {
  if (!idcardInteraction) return;
  e.preventDefault();

  const p = idcardGetPointer(e);
  const dx = p.x - idcardInteraction.startMouse.x;
  const dy = p.y - idcardInteraction.startMouse.y;

  const cv = document.getElementById('idcard-crop-canvas');
  const ratio = idcardState.cardW / idcardState.cardH;
  const sb = idcardInteraction.startBox;

  if (idcardInteraction.type === 'move') {
    idcardCropBox.x = Math.max(0, Math.min(cv.width - idcardCropBox.w, sb.x + dx));
    idcardCropBox.y = Math.max(0, Math.min(cv.height - idcardCropBox.h, sb.y + dy));
  } else {
    const h = idcardInteraction.handle;
    const isN = h.includes('n'), isS = h.includes('s');
    const isW = h.includes('w'), isE = h.includes('e');

    let delta;
    if (h.length === 2) {
      delta = Math.abs(dx) > Math.abs(dy) ? (isE ? dx : -dx) : (isS ? dy : -dy);
    } else if (isN || isS) {
      delta = isS ? dy : -dy;
    } else {
      delta = isE ? dx : -dx;
    }

    let newW = Math.max(40, sb.w + delta);
    let newH = newW / ratio;

    if (isE && sb.x + newW > cv.width) { newW = cv.width - sb.x; newH = newW / ratio; }
    if (isS && sb.y + newH > cv.height) { newH = cv.height - sb.y; newW = newH * ratio; }
    if (isW && sb.x + sb.w - newW < 0) { newW = sb.x + sb.w; newH = newW / ratio; }
    if (isN && sb.y + sb.h - newH < 0) { newH = sb.y + sb.h; newW = newH * ratio; }

    idcardCropBox.w = newW;
    idcardCropBox.h = newH;

    idcardCropBox.x = isW ? sb.x + sb.w - newW : (h === 'n' || h === 's') ? sb.x + (sb.w - newW) / 2 : sb.x;
    idcardCropBox.y = isN ? sb.y + sb.h - newH : (h === 'e' || h === 'w') ? sb.y + (sb.h - newH) / 2 : sb.y;

    idcardCropBox.x = Math.max(0, Math.min(cv.width - idcardCropBox.w, idcardCropBox.x));
    idcardCropBox.y = Math.max(0, Math.min(cv.height - idcardCropBox.h, idcardCropBox.y));
  }

  idcardRenderCropBox();
}

// Keyboard crop control
document.addEventListener('keydown', e => {
  const cropStep = document.getElementById('idcard-step-crop');
  if (!cropStep || cropStep.classList.contains('hidden')) return;

  const cv = document.getElementById('idcard-crop-canvas');
  if (!cv) return;

  const ratio = idcardState.cardW / idcardState.cardH;
  const step = e.shiftKey ? 10 : 1;

  if (e.key === 'ArrowLeft') idcardCropBox.x = Math.max(0, idcardCropBox.x - step);
  if (e.key === 'ArrowRight') idcardCropBox.x = Math.min(cv.width - idcardCropBox.w, idcardCropBox.x + step);
  if (e.key === 'ArrowUp') idcardCropBox.y = Math.max(0, idcardCropBox.y - step);
  if (e.key === 'ArrowDown') idcardCropBox.y = Math.min(cv.height - idcardCropBox.h, idcardCropBox.y + step);

  if (e.ctrlKey) {
    let delta = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      idcardCropBox.w = Math.min(cv.width - idcardCropBox.x, idcardCropBox.w + delta);
      idcardCropBox.h = idcardCropBox.w / ratio;
      if (idcardCropBox.y + idcardCropBox.h > cv.height) {
        idcardCropBox.h = cv.height - idcardCropBox.y;
        idcardCropBox.w = idcardCropBox.h * ratio;
      }
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      idcardCropBox.w = Math.max(40, idcardCropBox.w - delta);
      idcardCropBox.h = idcardCropBox.w / ratio;
    }
  }

  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault();
    idcardRenderCropBox();
  }
});

function idcardApplyCrop() {
  const src = idcardState.cropSide === 'front' ? idcardState.frontImg : idcardState.backImg;
  if (!src) {
    idcardToast('No image for this side.', 'error');
    return;
  }

  const srcX = idcardCropBox.x / idcardCropScale;
  const srcY = idcardCropBox.y / idcardCropScale;
  const srcCW = idcardCropBox.w / idcardCropScale;
  const srcCH = idcardCropBox.h / idcardCropScale;

  const DPI = 1200;
  const outW = Math.round((idcardState.cardW / 25.4) * DPI);
  const outH = Math.round((idcardState.cardH / 25.4) * DPI);

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;

  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, srcX, srcY, srcCW, srcCH, 0, 0, outW, outH);

  const side = idcardState.cropSide;
  idcardState[`cropped${idcardCap(side)}`] = out;
  idcardState[`edited${idcardCap(side)}`] = out;
  idcardState.edits[side] = { brightness: 100, contrast: 100, sharpness: 0, clarity: 0 };

  const pvEl = document.getElementById(`idcard-cropped-${side}`);


  if (pvEl) {
    pvEl.style.display = 'block';
    const sc = Math.min(200 / outW, 130 / outH);
    pvEl.width = Math.round(outW * sc);
    pvEl.height = Math.round(outH * sc);
    const pctx = pvEl.getContext('2d');
    pctx.imageSmoothingEnabled = true;
    pctx.imageSmoothingQuality = 'high';
    pctx.drawImage(out, 0, 0, pvEl.width, pvEl.height);
  }

  idcardToast(`${idcardCap(side)} side cropped ✓`);
}

window.idcardApplyCrop = idcardApplyCrop;
window.idcardSwitchCropTab = idcardSwitchCropTab;

// ── Step 4: Edit ─────────────────────────────────────────────────────────
const idcardEditSliders = ['brightness', 'contrast', 'sharpness', 'clarity'];

function idcardSwitchEditTab(side) {
  idcardState.editSide = side;
  const tf = document.getElementById('idcard-edit-tab-front');
  const tb = document.getElementById('idcard-edit-tab-back-btn');
  if (tf) tf.classList.toggle('active', side === 'front');
  if (tb) tb.classList.toggle('active', side === 'back');
  idcardLoadEditSliders();
  idcardRenderEditPreview();
}
window.idcardSwitchEditTab = idcardSwitchEditTab;

function idcardInitEdit() {
  idcardState.editSide = 'front';
  const tf = document.getElementById('idcard-edit-tab-front');
  const tb = document.getElementById('idcard-edit-tab-back-btn');
  if (tf) tf.classList.add('active');
  if (tb) tb.classList.remove('active');

  idcardLoadEditSliders();
  idcardRenderEditPreview(true);

  idcardEditSliders.forEach(sl => {
    const el = document.getElementById('idcard-' + sl);
    const val = document.getElementById('idcard-' + sl + '-val');
    if (!el || !val) return;

    el.oninput = () => {
      idcardState.edits[idcardState.editSide][sl] = parseFloat(el.value);
      val.textContent = String(el.value);
      idcardScheduleEditRender(false);
    };
    el.onchange = () => {
      idcardState.edits[idcardState.editSide][sl] = parseFloat(el.value);
      val.textContent = String(el.value);
      idcardScheduleEditRender(true);
    };
  });
}

function idcardLoadEditSliders() {
  const e = idcardState.edits[idcardState.editSide];
  idcardEditSliders.forEach(sl => {
    const el = document.getElementById('idcard-' + sl);
    const val = document.getElementById('idcard-' + sl + '-val');
    if (!el || !val) return;
    el.value = e[sl];
    val.textContent = String(e[sl]);
  });
}

let idcardEditRaf = null;
let idcardEditTimer = null;
let idcardEditArgs = { full: false };

function idcardScheduleEditRender(full) {
  idcardEditArgs.full = full;
  if (idcardEditRaf) return;

  idcardEditRaf = requestAnimationFrame(() => {
    idcardEditRaf = null;
    if (idcardEditTimer) clearTimeout(idcardEditTimer);
    idcardEditTimer = setTimeout(() => {
      idcardRenderEditPreview(idcardEditArgs.full);
    }, full ? 0 : 40);
  });
}

function idcardRenderEditPreview(full = false) {
  const src = idcardState[`cropped${idcardCap(idcardState.editSide)}`];
  if (!src) return;

  const e = idcardState.edits[idcardState.editSide];

  const maxFast = 520;
  const doFast = !full;
  const scale = doFast ? Math.min(1, maxFast / src.width, maxFast / src.height) : 1;
  const w = Math.max(2, Math.round(src.width * scale));
  const h = Math.max(2, Math.round(src.height * scale));

  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const ctx = tmp.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.filter = `brightness(${e.brightness}%) contrast(${e.contrast}%)`;
  ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, w, h);
  ctx.filter = 'none';

  if (full) {
    if (e.sharpness > 0) idcardApplyUnsharp(ctx, w, h, e.sharpness * 0.3);
    if (e.clarity > 0) idcardApplyClarity(ctx, w, h, e.clarity);
  }

  idcardState[`edited${idcardCap(idcardState.editSide)}`] = tmp;

  const cv = document.getElementById('idcard-edit-preview');
  if (!cv) return;
  cv.style.display = 'block';

  const sc = Math.min(500 / w, 380 / h);
  cv.width = Math.round(w * sc);
  cv.height = Math.round(h * sc);

  const pctx = cv.getContext('2d');
  pctx.imageSmoothingEnabled = true;
  pctx.imageSmoothingQuality = 'high';
  pctx.drawImage(tmp, 0, 0, cv.width, cv.height);
}

function idcardApplyUnsharp(ctx, w, h, strength) {
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  const out = new Uint8ClampedArray(d);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const i = (y * w + x) * 4 + c;
        const blur = (
          d[((y-1)*w+(x-1))*4+c] + d[((y-1)*w+x)*4+c] + d[((y-1)*w+(x+1))*4+c] +
          d[(y*w+(x-1))*4+c] + d[(y*w+(x+1))*4+c] +
          d[((y+1)*w+(x-1))*4+c] + d[((y+1)*w+x)*4+c] + d[((y+1)*w+(x+1))*4+c]
        ) / 8;
        out[i] = Math.min(255, Math.max(0, d[i] + strength * (d[i] - blur)));
      }
    }
  }

  id.data.set(out);
  ctx.putImageData(id, 0, 0);
}

function idcardApplyClarity(ctx, w, h, amount) {
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  const out = new Uint8ClampedArray(d);
  const r = 3;
  const k = amount * 0.25;

  for (let y = r; y < h - r; y++) {
    for (let x = r; x < w - r; x++) {
      let rS = 0, gS = 0, bS = 0, cnt = 0;
      for (let ky = -r; ky <= r; ky++) {
        for (let kx = -r; kx <= r; kx++) {
          const ni = ((y+ky)*w+(x+kx))*4;
          rS += d[ni];
          gS += d[ni+1];
          bS += d[ni+2];
          cnt++;
        }
      }

      const ci = (y*w+x)*4;
      out[ci]   = Math.min(255, Math.max(0, d[ci]   + k*(d[ci]   - rS/cnt)));
      out[ci+1] = Math.min(255, Math.max(0, d[ci+1] + k*(d[ci+1] - gS/cnt)));
      out[ci+2] = Math.min(255, Math.max(0, d[ci+2] + k*(d[ci+2] - bS/cnt)));

      const avg = (out[ci] + out[ci+1] + out[ci+2]) / 3;
      const sat = 1 + amount*0.04;
      out[ci]   = Math.min(255, Math.max(0, avg + sat*(out[ci]   - avg)));
      out[ci+1] = Math.min(255, Math.max(0, avg + sat*(out[ci+1] - avg)));
      out[ci+2] = Math.min(255, Math.max(0, avg + sat*(out[ci+2] - avg)));
    }
  }

  id.data.set(out);
  ctx.putImageData(id, 0, 0);
}

function idcardApplyEditsAndPreview() {
  const saved = idcardState.editSide;
  ['front', 'back'].forEach(side => {
    if (!idcardState[`cropped${idcardCap(side)}`]) return;
    idcardState.editSide = side;
    idcardRenderEditPreview();
  });
  idcardState.editSide = saved;
  idcardGoToStep(5);
}
window.idcardApplyEditsAndPreview = idcardApplyEditsAndPreview;

// ── Step 5: Print Preview ───────────────────────────────────────────────
function idcardGetBorderSettings() {
  const chk = document.getElementById('idcard-border-enabled');
  return {
    enabled: chk ? chk.checked : false,
    thickness: parseInt(document.getElementById('idcard-border-thickness')?.value || '6', 10),
    color: document.getElementById('idcard-border-color')?.value || '#000000',
    front: document.getElementById('idcard-border-front')?.checked ?? true,
    back: document.getElementById('idcard-border-back')?.checked ?? true
  };
}

function idcardInitBorderControls() {
  const chk = document.getElementById('idcard-border-enabled');
  if (chk) {
    chk.addEventListener('change', () => {
      const opts = document.getElementById('idcard-border-options');
      if (opts) opts.style.display = chk.checked ? 'flex' : 'none';
      idcardBuildPrintPreview();
    });
  }

  const t = document.getElementById('idcard-border-thickness');
  const tv = document.getElementById('idcard-border-thickness-val');
  t?.addEventListener('input', () => {
    if (tv) tv.textContent = t.value + ' px';
    idcardBuildPrintPreview();
  });

  const c = document.getElementById('idcard-border-color');
  const cv = document.getElementById('idcard-border-color-val');
  c?.addEventListener('input', () => {
    if (cv) cv.textContent = c.value;
    idcardBuildPrintPreview();
  });

  document.getElementById('idcard-border-front')?.addEventListener('change', idcardBuildPrintPreview);
  document.getElementById('idcard-border-back')?.addEventListener('change', idcardBuildPrintPreview);
}

idcardInitBorderControls();

function idcardBuildPrintPreview() {
  const DPI = 1200;
  const pageW = Math.round(4 * DPI);
  const pageH = Math.round(6 * DPI);

  const cardWpx = Math.round((idcardState.cardW / 25.4) * DPI);
  const cardHpx = Math.round((idcardState.cardH / 25.4) * DPI);

  const cv = document.getElementById('idcard-print-canvas');
  if (!cv) return;

  cv.width = pageW;
  cv.height = pageH;

  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pageW, pageH);

  const front = idcardState.editedFront || idcardState.croppedFront;
  const back = idcardState.hasBack ? (idcardState.editedBack || idcardState.croppedBack) : null;

  const margin = 34;
  const halfH = pageH / 2;
  const border = idcardGetBorderSettings();

  if (front) idcardDrawCentered(ctx, front, cardWpx, cardHpx, 0, 0, pageW, halfH, margin, border.enabled && border.front ? border : null);
  if (back) idcardDrawCentered(ctx, back, cardWpx, cardHpx, 0, halfH, pageW, halfH, margin, border.enabled && border.back ? border : null);

  if (front && back) {
    ctx.save();
    ctx.setLineDash([20, 14]);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(margin, halfH);
    ctx.lineTo(pageW - margin, halfH);
    ctx.stroke();
    ctx.restore();
  }

  const dispScale = Math.min(420 / pageW, 630 / pageH);
  cv.style.width = Math.round(pageW * dispScale) + 'px';
  cv.style.height = Math.round(pageH * dispScale) + 'px';
}

function idcardDrawCentered(ctx, img, cardW, cardH, zoneX, zoneY, zoneW, zoneH, margin, border) {
  // scale is applied on top of the physical mm->px size so the rendered artwork
  // matches the printer output (browser/driver scaling can leave a small margin).
  // cardW/cardH passed here are already computed in PX for DPI=1200.
  const scale = Math.min((zoneW - margin * 2) / cardW, (zoneH - margin * 2) / cardH) * 0.83;
  const dw = cardW * scale;
  const dh = cardH * scale;
  const dx = zoneX + (zoneW - dw) / 2;
  const dy = zoneY + (zoneH - dh) / 2;

  if (border) {
    const t = border.thickness;
    ctx.save();
    ctx.strokeStyle = border.color;
    ctx.lineWidth = t;
    ctx.strokeRect(dx - t/2, dy - t/2, dw + t, dh + t);
    ctx.restore();
  }

  ctx.drawImage(img, dx, dy, dw, dh);
}

function idcardExportImage() {
  const src = document.getElementById('idcard-print-canvas');
  if (!src) return;

  const flat = document.createElement('canvas');
  flat.width = src.width;
  flat.height = src.height;
  const ctx = flat.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(src, 0, 0);

  flat.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'id-card-print-8k.jpg';
    a.click();
    idcardToast('Exported as JPG 8K ✓');
  }, 'image/jpeg', 1.0);
}

function idcardPrintCard() {
  const src = document.getElementById('idcard-print-canvas');
  if (!src) return;

  const dataUrl = src.toDataURL('image/png');
  const win = window.open('', '_blank');

  // Enforce exact 4in x 6in printable area and scale the image to fill it.
  win.document.write(`
    <html>
      <head>
        <style>
          *{margin:0;padding:0;}
          @page{size:4in 6in;margin:0;}
          html,body{width:4in;height:6in;overflow:hidden;}
          .page{width:4in;height:6in;}
          img{
            width:100%;
            height:100%;
            display:block;
            object-fit:fill;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <img src="${dataUrl}" />
        </div>
        <script>
          window.onload = () => { window.print(); window.close(); };
        <\/script>
      </body>
    </html>
  `);
  win.document.close();
}

window.idcardExportImage = idcardExportImage;
window.idcardPrintCard = idcardPrintCard;
window.idcardBuildPrintPreview = idcardBuildPrintPreview;

/**
 * Initial UI state:
 * - ID Card Maker hidden by default
 * - Passport maker UI visible by default
 *
 * This prevents the “only buttons visible / blank until click” issue.
 */
function initIdCardVisibility() {
  const wrap = document.getElementById('idCardWrapper');
  if (wrap) wrap.style.display = 'none';

  // Default: show only the option buttons (no passport flow panels/steps yet)
  document.querySelectorAll('#appRoot .steps').forEach(s => { s.style.display = 'none'; });
  document.querySelectorAll('#appRoot .step').forEach(s => { s.style.display = 'none'; });
  document.querySelectorAll('#appRoot .panel').forEach(p => { p.style.display = 'none'; });

  // Hide selected label until a passport type/size button is clicked
  const selectedInfo = document.getElementById('selectedInfo');
  if (selectedInfo) selectedInfo.style.display = 'none';
}

// expose for inline onclick usage
window.idcardGoToStep = idcardGoToStep;
window.showIdCardMaker = showIdCardMaker;
window.hideIdCardMaker = hideIdCardMaker;

initIdCardVisibility();

