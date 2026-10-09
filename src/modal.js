// src/modal.js
// Modal module for image preview with:
// - image width fixed to 90vw (height auto)
// - pan (drag), pinch-to-zoom, wheel zoom (modal-center based)
// - global session persistence of transform (scale, tx, ty) under key 'cv_modal_global_state'
// - API: open(src, alt), close()
// - Self-contained: creates DOM nodes on first use

const STORAGE_KEY = 'cv_modal_global_state';

function saveGlobalState(state) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}
function loadGlobalState() {
  try { const s = sessionStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}

let overlayEl = null;
let modalEl = null;
let containerEl = null;
let imgEl = null;
let closeBtnEl = null;

// internal transform state (global)
const state = { scale: 1, tx: 0, ty: 0 };
const MIN_SCALE = 0.5;
const MAX_SCALE = 4.0;

function createModalIfNeeded() {
  if (modalEl) return;

  // overlay
  overlayEl = document.createElement('div');
  overlayEl.id = 'cv-modal-overlay';
  Object.assign(overlayEl.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(0,0,0,0.6)',
    zIndex: '100000',
    display: 'none'
  });

  // modal container
  modalEl = document.createElement('div');
  modalEl.id = 'cv-modal';
  Object.assign(modalEl.style, {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%,-50%)',
    zIndex: '100001',
    display: 'none',
    padding: '8px',
    boxSizing: 'border-box',
    maxWidth: '100%',
    maxHeight: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  });

  // scrollable inner container (for fallback scrolling)
  containerEl = document.createElement('div');
  containerEl.id = 'cv-modal-container';
  Object.assign(containerEl.style, {
    maxWidth: '90vw',
    maxHeight: '100vh',
    overflow: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: '8px',
    boxSizing: 'border-box',
    background: 'transparent'
  });

  // image element
  imgEl = document.createElement('img');
  imgEl.id = 'cv-modal-img';
  imgEl.alt = 'preview';
  Object.assign(imgEl.style, {
    width: '90vw',
    height: 'auto',
    display: 'block',
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
    userSelect: 'none',
    WebkitUserDrag: 'none',
    touchAction: 'none',
    cursor: 'grab',
    transformOrigin: '0 0',
    willChange: 'transform'
  });

  // close button
  closeBtnEl = document.createElement('button');
  closeBtnEl.id = 'cv-modal-close';
  closeBtnEl.type = 'button';
  closeBtnEl.innerHTML = '&times;';
  Object.assign(closeBtnEl.style, {
    position: 'absolute',
    right: '8px',
    top: '8px',
    zIndex: '100002',
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    border: 'none',
    fontSize: '22px',
    lineHeight: '1',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    cursor: 'pointer'
  });

  // append structure
  containerEl.appendChild(imgEl);
  modalEl.appendChild(closeBtnEl);
  modalEl.appendChild(containerEl);
  document.body.appendChild(overlayEl);
  document.body.appendChild(modalEl);

  // event wiring
  overlayEl.addEventListener('click', close);
  closeBtnEl.addEventListener('click', close);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  // interaction handlers
  setupInteractions();
}

function applyTransform() {
  imgEl.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
}

function setupInteractions() {
  // pointer drag & pinch & wheel
  let isDown = false;
  let startX = 0;
  let startY = 0;
  let startTx = 0;
  let startTy = 0;
  const pointers = new Map();
  let wheelSaveTimer = null;

  // pointerdown: track pointer and start drag if primary
  imgEl.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, e);
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    isDown = true;
    imgEl.setPointerCapture && imgEl.setPointerCapture(e.pointerId);
    startX = e.clientX;
    startY = e.clientY;
    startTx = state.tx;
    startTy = state.ty;
    imgEl.style.cursor = 'grabbing';
    e.preventDefault();
  });

  // pointermove: handle drag or pinch
  window.addEventListener('pointermove', (e) => {
    // update pointer map for pinch detection
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, e);

    // pinch handling when two pointers present
    if (pointers.size === 2) {
      const [p1, p2] = Array.from(pointers.values());
      const dist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
      if (!imgEl._pinch) {
        imgEl._pinch = { dist, scaleStart: state.scale, mid: { x: (p1.clientX + p2.clientX) / 2, y: (p1.clientY + p2.clientY) / 2 } };
      } else {
        const factor = dist / imgEl._pinch.dist;
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, imgEl._pinch.scaleStart * factor));
        // use pinch midpoint as center
        const rect = imgEl.getBoundingClientRect();
        const cx = imgEl._pinch.mid.x;
        const cy = imgEl._pinch.mid.y;
        const imgX = (cx - rect.left - state.tx) / state.scale;
        const imgY = (cy - rect.top - state.ty) / state.scale;
        state.tx = cx - rect.left - imgX * newScale;
        state.ty = cy - rect.top - imgY * newScale;
        state.scale = newScale;
        applyTransformSafe();
      }
      return;
    }

    // drag (single pointer)
    if (!isDown) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    state.tx = startTx + dx;
    state.ty = startTy + dy;
    applyTransformSafe();
  });

  // pointerup / cancel
  window.addEventListener('pointerup', (e) => {
    pointers.delete(e.pointerId);
    if (!isDown) return;
    isDown = false;
    try { imgEl.releasePointerCapture && imgEl.releasePointerCapture(e.pointerId); } catch (err) {}
    imgEl.style.cursor = 'grab';
    imgEl._pinch = null;
    // save shortly after drag ends
    setTimeout(() => saveGlobalState({ scale: state.scale, tx: state.tx, ty: state.ty }), 80);
  });
  window.addEventListener('pointercancel', (e) => {
    pointers.delete(e.pointerId);
    isDown = false;
    imgEl.style.cursor = 'grab';
    imgEl._pinch = null;
  });

  // wheel zoom: modal/container center as zoom center
  containerEl.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const rect = imgEl.getBoundingClientRect();
    const crect = containerEl.getBoundingClientRect();
    const centerX = crect.left + crect.width / 2;
    const centerY = crect.top + crect.height / 2;
    const imgX = (centerX - rect.left - state.tx) / state.scale;
    const imgY = (centerY - rect.top - state.ty) / state.scale;
    const delta = -ev.deltaY;
    const factor = delta > 0 ? 1.12 : 0.9;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, state.scale * factor));
    state.tx = centerX - rect.left - imgX * newScale;
    state.ty = centerY - rect.top - imgY * newScale;
    state.scale = newScale;
    applyTransformSafe();
    // debounce save
    if (wheelSaveTimer) clearTimeout(wheelSaveTimer);
    wheelSaveTimer = setTimeout(() => saveGlobalState({ scale: state.scale, tx: state.tx, ty: state.ty }), 250);
  }, { passive: false });

  // helper to apply transform with safety (ensure imgEl exists)
  function applyTransformSafe() {
    if (!imgEl) return;
    imgEl.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
  }
}

// open modal with src and optional alt
function open(src, alt) {
  if (!src) return;
  createModalIfNeeded();

  // restore global state
  const persisted = loadGlobalState();
  if (persisted && typeof persisted.scale === 'number') {
    state.scale = persisted.scale;
    state.tx = persisted.tx || 0;
    state.ty = persisted.ty || 0;
  } else {
    state.scale = 1;
    state.tx = 0;
    state.ty = 0;
  }

  imgEl.src = src;
  if (alt) imgEl.alt = alt;
  // apply restored transform after image layout
  setTimeout(() => {
    applyTransform();
  }, 10);

  overlayEl.style.display = 'block';
  modalEl.style.display = 'flex';
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  // reset container scroll (fallback)
  containerEl.scrollLeft = 0;
  containerEl.scrollTop = 0;
}

// close modal and persist global state
function close() {
  if (!modalEl) return;
  overlayEl.style.display = 'none';
  modalEl.style.display = 'none';
  // save current state globally
  saveGlobalState({ scale: state.scale, tx: state.tx, ty: state.ty });
  if (imgEl) imgEl.src = '';
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
}

export default { open, close };
