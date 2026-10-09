// editor.js
// Standalone editor module. Safe to include as a plain script (defer).
// Exposes: window.openEditorForItem, window.closeEditor, window.attachItemEditHooks

(function () {
  // avoid double initialization
  if (window.__editorModuleInitialized__) return;
  window.__editorModuleInitialized__ = true;

  let __editingId = null;

  function getItemById(id) {
    const idStr = String(id);
    return Array.isArray(window.items) ? window.items.find(x => String(x.id) === idStr) : undefined;
  }

  function openEditorForItem(id) {
    const it = getItemById(id);
    if (!it) {
      console.warn('openEditorForItem: item not found', id);
      return;
    }
    __editingId = id;
    const idEl = document.getElementById('editorItemId');
    const nameEl = document.getElementById('editorName');
    const tagTextEl = document.getElementById('editorTagText');

    if (idEl) idEl.textContent = String(it.id);
    if (nameEl) nameEl.value = it.name || '';
    if (tagTextEl) {
      tagTextEl.value = Array.isArray(it.tags) ? it.tags.join(',') : (it.tags || '');
    }

    // quick tag radio: pick first matching tagA/B/C if present
    const radios = document.getElementsByName('quickTag');
    let matched = '';
    if (Array.isArray(it.tags)) {
      for (const r of ['tagA', 'tagB', 'tagC']) if (it.tags.includes(r)) { matched = r; break; }
    } else if (typeof it.tags === 'string' && it.tags.length) {
      const arr = it.tags.split(',').map(s => s.trim());
      for (const r of ['tagA', 'tagB', 'tagC']) if (arr.includes(r)) { matched = r; break; }
    }
    for (const r of radios) r.checked = (r.value === matched);

    // show pane
    const pane = document.getElementById('itemEditorPane');
    if (pane) pane.setAttribute('aria-hidden', 'false');

    // focus name input
    setTimeout(() => {
      const el = document.getElementById('editorName');
      if (el) el.focus();
    }, 120);
  }

  function closeEditor() {
    __editingId = null;
    const pane = document.getElementById('itemEditorPane');
    if (pane) pane.setAttribute('aria-hidden', 'true');
  }

  function saveEditor() {
    if (!__editingId) return;
    const it = getItemById(__editingId);
    if (!it) {
      console.warn('saveEditor: item not found', __editingId);
      return;
    }

    const nameEl = document.getElementById('editorName');
    const tagTextEl = document.getElementById('editorTagText');
    const radios = document.getElementsByName('quickTag');

    const newName = nameEl ? nameEl.value.trim() : (it.name || '');
    const tagText = tagTextEl ? tagTextEl.value.trim() : '';
    let quick = '';
    for (const r of radios) if (r.checked) { quick = r.value; break; }

    // compute new tags
    let newTags = [];
    if (quick) {
      const existing = Array.isArray(it.tags) ? it.tags.slice() : (typeof it.tags === 'string' && it.tags.length ? it.tags.split(',').map(s => s.trim()).filter(Boolean) : []);
      const filtered = existing.filter(t => !['tagA', 'tagB', 'tagC'].includes(t));
      filtered.push(quick);
      newTags = filtered;
    } else {
      newTags = tagText.length ? tagText.split(',').map(s => s.trim()).filter(Boolean) : [];
    }

    // apply changes
    it.name = newName;
    it.tags = newTags;

    // persist and refresh
    if (typeof window.saveItemsState === 'function') {
      try { window.saveItemsState(); } catch (e) { console.error('saveItemsState error:', e); }
    }
    if (typeof window.renderPage === 'function') {
      try { window.renderPage(); } catch (e) { console.error('renderPage error:', e); }
    }

    closeEditor();
  }

  // attach editor UI handlers
  function attachEditorUI() {
    // avoid duplicate handlers
    if (window.__editorUIAttached__) return;
    window.__editorUIAttached__ = true;

    const closeBtn = document.getElementById('editorCloseBtn');
    const cancelBtn = document.getElementById('editorCancelBtn');
    const saveBtn = document.getElementById('editorSaveBtn');

    if (closeBtn) closeBtn.addEventListener('click', closeEditor);
    if (cancelBtn) cancelBtn.addEventListener('click', closeEditor);
    if (saveBtn) saveBtn.addEventListener('click', saveEditor);

    // Esc to close
    document.addEventListener('keydown', (e) => {
      const pane = document.getElementById('itemEditorPane');
      if (!pane || pane.getAttribute('aria-hidden') === 'true') return;
      if (e.key === 'Escape') closeEditor();
    });
  }

  // attach click delegation to container
  function attachItemEditHooks() {
    // find container (try common ids, fallback to body)
    const container = document.getElementById('itemsContainer') || document.getElementById('list') || document.querySelector('.items') || document.body;
    if (!container) return;

    // remove previous handler if present
    try {
      if (container.__itemEditHandler__) container.removeEventListener('click', container.__itemEditHandler__);
    } catch (e) { /* ignore */ }

    container.__itemEditHandler__ = function (e) {
      // if clicked an explicit edit button inside item, prefer that
      const editBtn = e.target.closest && e.target.closest('.edit-btn');
      if (editBtn) {
        const id = editBtn.closest && editBtn.closest('.item')?.dataset?.id || editBtn.dataset?.id;
        if (id) { openEditorForItem(id); e.stopPropagation(); return; }
      }
      // otherwise if clicked an item row
      const itemEl = e.target.closest && e.target.closest('.item[data-id]');
      if (itemEl) {
        const id = itemEl.dataset.id;
        if (id) openEditorForItem(id);
      }
    };

    container.addEventListener('click', container.__itemEditHandler__);

    // best-effort: add small Edit buttons to each item if not present
    try {
      const items = container.querySelectorAll && container.querySelectorAll('.item[data-id]');
      if (items && items.length) {
        items.forEach(el => {
          if (!el.querySelector('.edit-btn')) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'edit-btn ae-btn ae-btn-ghost';
            btn.style.marginLeft = '8px';
            btn.textContent = 'Edit';
            btn.dataset.id = el.dataset.id;
            el.appendChild(btn);
          }
        });
      }
    } catch (e) { /* ignore DOM shape differences */ }
  }

  // expose API
  window.openEditorForItem = openEditorForItem;
  window.closeEditor = closeEditor;
  window.attachItemEditHooks = attachItemEditHooks;
  window.__editorAttachUI = attachEditorUI;

  // initialize editor UI handlers immediately (safe no-op if elements missing)
  try { attachEditorUI(); } catch (e) { console.error('attachEditorUI init error:', e); }
})();
