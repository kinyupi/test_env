// src/utils.js
import Modal from './modal.js';

/**
 * createItemElement(item)
 * item: { id, name, file, thumb, tagsA, tagsB, tagsC, rating, hidden, pendingHidden, pendingOriginalRating }
 */
export function createItemElement(item) {
  const root = document.createElement("div");
  root.className = "item";
  if (item && item.id !== undefined) root.dataset.id = String(item.id);
  if (item.pendingHidden) root.classList.add("pending-hidden");

  // thumbWrap
  const thumbWrap = document.createElement("div");
  thumbWrap.className = "thumbWrap";
  thumbWrap.style.position = thumbWrap.style.position || 'relative';
  // 画像要素
  const img = document.createElement("img");
  img.src = item.thumb || "";
  img.alt = item.name || "";
  img.tabIndex = 0;
  // 補助クラス（CSS 側で必要なら使える）
  img.className = "thumb-img";
  img.addEventListener("click", (e) => { e.stopPropagation(); if (item.file) window.open(item.file, "_blank"); });
  img.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); img.click(); } });
  thumbWrap.appendChild(img);

  // trash button (same markup as app.js)
  const trashBtn = document.createElement("button");
  trashBtn.type = "button";
  trashBtn.className = "mv-trash";
  trashBtn.setAttribute("aria-label", item.pendingHidden ? "保留解除" : "非表示（保留）");
  trashBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6h18v2H3V6zm2 3h14l-1.2 11.2A2 2 0 0 1 15.8 22H8.2a2 2 0 0 1-1.99-1.8L5 9zm5-6h4l1 1H9l1-1z"/></svg>`;
  trashBtn.addEventListener("click", (e) => { e.stopPropagation(); if (typeof window.toggleHidden === 'function') window.toggleHidden(item.id); else console.warn('toggleHidden not found'); });
  trashBtn.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (typeof window.toggleHidden === 'function') window.toggleHidden(item.id); } });
  thumbWrap.appendChild(trashBtn);

  // 虫眼鏡オーバーレイ（常に DOM に挿入）
  const magnBtn = document.createElement("button");
  magnBtn.type = "button";
  magnBtn.className = "thumb-magnifier";
  magnBtn.setAttribute("aria-label", "拡大表示");
  magnBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="18" height="18"><path fill="white" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L20 21.5 21.5 20l-6-6zM10 15a5 5 0 110-10 5 5 0 010 10z"/></svg>';
  Object.assign(magnBtn.style, {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%,-50%)',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.35)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: '0',
    transition: 'opacity 0.12s ease',
    cursor: 'pointer',
    border: 'none',
    padding: '0',
    zIndex: '20'
  });
  thumbWrap.addEventListener('mouseenter', () => { magnBtn.style.opacity = '1'; });
  thumbWrap.addEventListener('mouseleave', () => { magnBtn.style.opacity = '0'; });
  magnBtn.tabIndex = 0;
  magnBtn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); magnBtn.click(); } });
  magnBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const src = img.src || img.dataset.hires || item.file || '';
    Modal.open(src, img.alt || item.name || '');
  });
  thumbWrap.appendChild(magnBtn);

  root.appendChild(thumbWrap);

  // name
  const nameDiv = document.createElement("div");
  nameDiv.className = "name";
  nameDiv.textContent = item.name || "";
  root.appendChild(nameDiv);

  // tags
  const tagsDiv = document.createElement("div");
  tagsDiv.className = "tags";
  const tagHtmlA = (item.tagsA || []).map(t => ({t, cls: "tag A"}));
  const tagHtmlB = (item.tagsB || []).map(t => ({t, cls: "tag B"}));
  const tagHtmlC = (item.tagsC || []).map(t => ({t, cls: "tag C"}));
  const allTags = tagHtmlA.concat(tagHtmlB).concat(tagHtmlC);
  allTags.forEach(obj => {
    const span = document.createElement("span");
    span.className = obj.cls;
    span.classList.add("tag");
    span.textContent = obj.t;
    span.tabIndex = 0;
    span.addEventListener("click", (e) => { e.stopPropagation(); if (typeof window.addTagToFilter === 'function') window.addTagToFilter(obj.t); });
    span.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (typeof window.addTagToFilter === 'function') window.addTagToFilter(obj.t); } });
    tagsDiv.appendChild(span);
  });
  root.appendChild(tagsDiv);

  // --- 評価表示と操作（未評価は null -> 表示は 'ー'） ---
  const ctrl = document.createElement("div");
  ctrl.className = "controls";
  const down = document.createElement("button");
  down.type = "button";
  down.className = "mv-rate-down";
  down.textContent = "▼";
  down.title = "評価を下げる";
  down.addEventListener("click", (e) => { e.stopPropagation(); if (typeof window.updateRating === 'function') window.updateRating(item.id, -1); });
  ctrl.appendChild(down);
  const val = document.createElement("span");
  val.className = "mv-value";
  val.textContent = (item.rating === null || item.rating === undefined) ? "ー" : String(item.rating);
  ctrl.appendChild(val);
  const up = document.createElement("button");
  up.type = "button";
  up.className = "mv-rate-up";
  up.textContent = "▲";
  up.title = "評価を上げる";
  up.addEventListener("click", (e) => { e.stopPropagation(); if (typeof window.updateRating === 'function') window.updateRating(item.id, +1); });
  ctrl.appendChild(up);
  root.appendChild(ctrl);

  return root;
}

// attachRatingHandlers: optional helper to attach handlers to existing .item elements
export function attachRatingHandlers(root = document) {
  const itemsEls = root.querySelectorAll('.item');
  itemsEls.forEach(itemEl => {
    if (itemEl.dataset.ratingHandlersAttached === '1') return;
    const id = itemEl.dataset.id;
    if (!id) return;
    const downBtn = itemEl.querySelector('.mv-rate-down');
    const upBtn = itemEl.querySelector('.mv-rate-up');
    const ratingDisplay = itemEl.querySelector('.mv-value');
    if (!downBtn || !upBtn || !ratingDisplay) return;
    const findItem = () => (window.items || []).find(x => String(x.id) === String(id));
    const updateDisplay = (it) => {
      ratingDisplay.textContent = (it.rating === null || it.rating === undefined) ? 'ー' : String(it.rating);
    };
    upBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const it = findItem(); if (!it) return;
      if (it.rating === null || it.rating === undefined) it.rating = 1; else it.rating = Math.min(10, Number(it.rating) + 1);
      updateDisplay(it);
      try { if (typeof window.saveItemsState === 'function') window.saveItemsState(); } catch (e) {}
      window.dispatchEvent(new CustomEvent('items:updated', { detail: it }));
    });
    downBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const it = findItem(); if (!it) return;
      if (it.rating === null || it.rating === undefined) it.rating = 0; else it.rating = Math.max(0, Number(it.rating) - 1);
      updateDisplay(it);
      try { if (typeof window.saveItemsState === 'function') window.saveItemsState(); } catch (e) {}
      window.dispatchEvent(new CustomEvent('items:updated', { detail: it }));
    });
    itemEl.dataset.ratingHandlersAttached = '1';
  });
}
