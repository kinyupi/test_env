// src/app.js
import Modal from './modal.js';
import * as Data from './data.js';
import * as Filter from './filter.js';
import { createItemElement } from './utils.js';

// 公開名前空間
window.app = window.app || {};
window.app.data = window.app.data || {};
window.app.filter = window.app.filter || {};
window.app.pagination = window.app.pagination || {};

let savedHandle = null;
window.items = window.items || [];
window.perPage = window.perPage || 40;
window.currentPage = window.currentPage || 1;

window.app.state = window.app.state || {
  filter: { search: "", tags: [], modeOr: false }
};

// 文字コード変換ユーティリティ（既存）
function encodeShiftJIS(str) {
  const unicodeArray = Encoding.stringToCode(str);
  const sjisArray = Encoding.convert(unicodeArray, "SJIS");
  return sjisArray.map(b => "%" + b.toString(16).toUpperCase().padStart(2, "0")).join("");
}
function encodeEUCJP(str) {
  const unicodeArray = Encoding.stringToCode(str);
  const eucArray = Encoding.convert(unicodeArray, "EUCJP");
  return eucArray.map(b => "%" + b.toString(16).toUpperCase().padStart(2, "0")).join("");
}

// CSV 読み込みは data.js に委譲
async function loadCsv(fileHandle) {
  console.log("loadCsv called:", fileHandle);
  if (!fileHandle) {
    console.warn("loadCsv: no fileHandle provided");
    return;
  }
  savedHandle = fileHandle;
  try {
    await Data.loadCsv(fileHandle);
    window.currentPage = 1;
    renderPage();
  } catch (err) {
    console.error("loadCsv error:", err);
  }
}
async function loadCsvFromFile(file) {
  console.log("loadCsvFromFile called:", file);
  try {
    await Data.loadCsvFromFile(file);
    window.currentPage = 1;
    renderPage();
  } catch (e) {
    console.error("loadCsvFromFile error:", e);
  }
}

// filterItems はローカル実装（互換性のため残すが、Filter.filterItems を使っても良い）
function filterItems() {
  return Filter.filterItems();
}

// ページネーション（既存の実装を使用）
function renderPagination(totalPages) {
  const container = document.getElementById("pagination");
  if (!container) return;
  container.innerHTML = "";
  function makeBtn(text, cls, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls || "page-btn";
    b.textContent = text;
    b.addEventListener("click", onClick);
    return b;
  }
  const prevBtn = makeBtn("前へ", "nav-btn", () => {
    if (window.currentPage > 1) { Filter.pushHistory(); window.currentPage--; renderPage(); }
  });
  prevBtn.disabled = window.currentPage <= 1;
  container.appendChild(prevBtn);

  const maxVisible = 5;
  const pages = [];
  const addPage = (p) => { if (p >= 1 && p <= totalPages && !pages.includes(p)) pages.push(p); };
  addPage(1);
  let start = Math.max(2, window.currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages - 1, start + maxVisible - 1);
  start = Math.max(2, Math.min(start, Math.max(2, totalPages - maxVisible)));
  for (let p = start; p <= end; p++) addPage(p);
  if (totalPages > 1) addPage(totalPages);
  pages.sort((a,b) => a - b);
  let last = null;
  pages.forEach((p) => {
    if (last !== null && p - last > 1) {
      const ell = document.createElement("span");
      ell.className = "ellipsis";
      ell.textContent = "...";
      container.appendChild(ell);
    }
    const btn = makeBtn(String(p), p === window.currentPage ? "page-btn current" : "page-btn", () => {
      if (p === window.currentPage) return;
      Filter.pushHistory();
      window.currentPage = p;
      renderPage();
    });
    if (p === window.currentPage) btn.setAttribute("aria-current", "page");
    container.appendChild(btn);
    last = p;
  });

  const nextBtn = makeBtn("次へ", "nav-btn", () => {
    if (window.currentPage < totalPages) { Filter.pushHistory(); window.currentPage++; renderPage(); }
  });
  nextBtn.disabled = window.currentPage >= totalPages;
  container.appendChild(nextBtn);

  const spacer = document.createElement("span");
  spacer.className = "pagination-spacer";
  spacer.textContent = " ";
  container.appendChild(spacer);

  function addJump(n) {
    const target = Math.min(totalPages, Math.max(1, window.currentPage + n));
    const label = (n > 0 ? "+" + n : String(n));
    const btn = makeBtn(label, "jump-btn", () => {
      if (target === window.currentPage) return;
      Filter.pushHistory();
      window.currentPage = target;
      renderPage();
    });
    if ((n > 0 && window.currentPage >= totalPages) || (n < 0 && window.currentPage <= 1)) btn.disabled = true;
    container.appendChild(btn);
  }
  addJump(5);
  addJump(10);
}

// createItemElement は utils に移譲済み
function createItemElementWrapper(item) {
  return createItemElement(item);
}

// renderPage
function renderPage() {
  const container = document.getElementById("container");
  if (!container) return;
  while (container.firstChild) container.removeChild(container.firstChild);
  const filtered = filterItems();
  const start = (window.currentPage - 1) * window.perPage;
  const pageItems = filtered.slice(start, start + window.perPage);
  const frag = document.createDocumentFragment();
  pageItems.forEach(item => frag.appendChild(createItemElementWrapper(item)));
  container.appendChild(frag);
  const totalPages = Math.max(1, Math.ceil(filtered.length / window.perPage));
  renderPagination(totalPages);
}

// アイテム操作（評価 / 非表示 / タグ追加）
function updateRating(id, delta) {
  const it = window.items.find(x => String(x.id) === String(id));
  if (!it) return;
  if (it.rating === null || it.rating === undefined) {
    it.rating = (delta > 0) ? 1 : 0;
  } else {
    const n = Number(it.rating) + delta;
    it.rating = Math.max(0, Math.min(10, Math.floor(n)));
  }
  try { Data.saveItemsState(); } catch (e) {}
  renderPage();
}

function toggleHidden(id) {
  const idStr = String(id);
  const item = window.items.find(x => String(x.id) === idStr);
  if (!item) {
    console.warn('toggleHidden: item not found for id', id);
    return;
  }
  const immediate = !!document.getElementById("immediateHideToggle")?.checked;
  if (immediate) {
    item.hidden = true;
    if (item.rating === null || item.rating === undefined) {
      item.rating = 0;
    }
    item.pendingHidden = false;
    try { Data.saveItemsState(); } catch (e) {}
    const filtered = filterItems();
    const totalPages = Math.max(1, Math.ceil(filtered.length / window.perPage));
    if (window.currentPage > totalPages) window.currentPage = totalPages;
    renderPage();
  } else {
    item.pendingHidden = !item.pendingHidden;
    if (item.pendingHidden) {
      if (item.pendingOriginalRating === undefined) {
        if (item.rating === null || item.rating === undefined) {
          item.pendingOriginalRating = null;
          item.rating = 0;
        } else {
          item.pendingOriginalRating = item.rating;
        }
      } else {
        if (item.rating === null || item.rating === undefined) {
          item.rating = 0;
        }
      }
    } else {
      if (Object.prototype.hasOwnProperty.call(item, 'pendingOriginalRating') && item.pendingOriginalRating !== undefined) {
        item.rating = (item.pendingOriginalRating === null) ? null : Number(item.pendingOriginalRating);
        item.pendingOriginalRating = undefined;
      }
    }
    try { Data.saveItemsState(); } catch (e) {}
    const el = document.querySelector(`.item[data-id="${CSS.escape(String(id))}"]`);
    if (el) {
      if (item.pendingHidden) el.classList.add("pending-hidden");
      else el.classList.remove("pending-hidden");
    }
    renderPage();
  }
}

function addTagToFilter(tag) {
  Filter.pushHistory();
  const box = document.getElementById("tagBox");
  const cur = (box.value || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!cur.includes(tag)) cur.push(tag);
  box.value = cur.join(",");
  window.currentPage = 1;
  renderPage();
}

function applyPendingHiddenToHiddenWrapper() {
  Data.applyPendingHiddenToHidden();
  renderPage();
}

function exportCsvWrapper() {
  const auto = document.getElementById('autoApplyCheckbox')?.checked;
  if (auto) Data.applyPendingHiddenToHidden();
  Data.exportCsv();
}

// attachUI
function attachUI() {
  console.log("attachUI running");
  const searchBox = document.getElementById("searchBox");
  const tagBox = document.getElementById("tagBox");
  const tagModeToggle = document.getElementById("tagModeToggle");
  const tagModeLabel = document.getElementById("tagModeLabel");
  const applyFilter = document.getElementById("applyFilter");
  const clearFilter = document.getElementById("clearFilter");
  const openCsv = document.getElementById("openCsv");
  const externalSearch = document.getElementById("externalSearch");
  const immediateHideToggle = document.getElementById("immediateHideToggle");

  // 履歴管理を一度だけ初期化（popstate の単一登録）
  try { Filter.initHistory(); } catch (e) { console.error('Filter.initHistory error:', e); }

  if (searchBox) {
    searchBox.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { Filter.pushHistory(); window.currentPage = 1; renderPage(); }
    });
  }
  // debug: searchBox Enter の push を可視化
  if (searchBox) {
    searchBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        console.debug('[history-debug] searchBox Enter -> calling Filter.pushHistory', { value: searchBox.value });
      }
    });
  }

  if (externalSearch) {
    externalSearch.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        try {
          const q = externalSearch.value.trim();
          const sjis = encodeShiftJIS(q);
          const euc = encodeEUCJP(q);
          console.log("externalSearch SJIS:", sjis);
          window.open("https://seesaawiki.jp/w/sougouwiki/search?keywords=" + euc, "_blank");
        } catch (err) { console.error("externalSearch error:", err); }
      }
    });
  }

  if (tagBox) {
    tagBox.addEventListener("keydown", (e) => { if (e.key === "Enter") { window.currentPage = 1; renderPage(); } });
  }

  if (openCsv) {
    openCsv.addEventListener("click", async () => {
      console.log("openCsv clicked");
      try {
        const pickerOpts = { types: [{ description: "CSV Files", accept: { "text/csv": [".csv"] } }] };
        let fileHandle = null;
        if (window.showOpenFilePicker) {
          const res = await window.showOpenFilePicker(pickerOpts);
          if (Array.isArray(res) && res.length > 0) fileHandle = res[0];
        } else {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".csv,text/csv";
          input.style.display = "none";
          document.body.appendChild(input);
          input.addEventListener("change", async (ev) => {
            const f = ev.target.files && ev.target.files[0];
            if (f) await loadCsvFromFile(f);
            input.remove();
          }, { once: true });
          input.click();
        }
        if (fileHandle) {
          await loadCsv(fileHandle);
        }
      } catch (e) {
        console.error("showOpenFilePicker failed or cancelled:", e);
      }
    });
  }

  (async function tryAutoOpen() {
    try {
      const lastName = localStorage.getItem("csvHandleName");
      if (!lastName) return;
      if (!window.showOpenFilePicker) return;
      const [fileHandle] = await window.showOpenFilePicker({ startIn: "documents" });
      if (fileHandle && fileHandle.name === lastName) {
        await loadCsv(fileHandle);
      }
    } catch (e) {
      console.log("自動再オープン失敗:", e);
    }
  })();

  if (tagModeToggle) {
    tagModeToggle.addEventListener("change", () => {
      if (tagModeLabel) tagModeLabel.textContent = tagModeToggle.checked ? "OR" : "AND";
      window.currentPage = 1;
      renderPage();
    });
  }

  if (applyFilter) {
    applyFilter.addEventListener("click", () => {
      console.debug('[history-debug] applyFilter clicked -> calling Filter.pushHistory', {
        search: document.getElementById('searchBox')?.value,
        tags: document.getElementById('tagBox')?.value
     });
      Filter.pushHistory(); window.currentPage = 1; renderPage();
	 });
  }

  if (clearFilter) {
    clearFilter.addEventListener("click", () => {
      if (searchBox) searchBox.value = "";
      if (tagBox) tagBox.value = "";
      if (tagModeToggle) tagModeToggle.checked = false;
      if (tagModeLabel) tagModeLabel.textContent = "AND";
      window.currentPage = 1;
      renderPage();
    });
  }
  // debug: clearFilter の押下を可視化
  if (clearFilter) {
    clearFilter.addEventListener('click', () => {
      console.debug('[history-debug] clearFilter clicked -> state cleared');
    }, { once: false });
  }
  try {
    if (immediateHideToggle) {
      const savedImmediate = localStorage.getItem("myCsvViewer_immediateHide");
      if (savedImmediate !== null) immediateHideToggle.checked = savedImmediate === "1";
      immediateHideToggle.addEventListener("change", () => {
        try { localStorage.setItem("myCsvViewer_immediateHide", immediateHideToggle.checked ? "1" : "0"); } catch (e) {}
      });
    }
  } catch (e) {
    console.error("immediateHideToggle handling error:", e);
  }

  const initialState = {
    search: searchBox?.value || "",
    tags: tagBox?.value || "",
    mode: tagModeToggle ? tagModeToggle.checked : false,
    page: window.currentPage || 1
  };
  try { history.replaceState(initialState, ""); } catch (e) { console.error("replaceState error:", e); }

  // Apply / Export hookup
  try {
    const applyBtn = document.getElementById('applyBtn');
    if (applyBtn) {
      applyBtn.removeEventListener('click', window.__applyPendingHandler__);
      window.__applyPendingHandler__ = () => { applyPendingHiddenToHiddenWrapper(); };
      applyBtn.addEventListener('click', window.__applyPendingHandler__);
    }

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.removeEventListener('click', window.__exportHandler__);
      window.__exportHandler__ = () => { exportCsvWrapper(); };
      exportBtn.addEventListener('click', window.__exportHandler__);
    }

    const autoApplyCheckbox = document.getElementById('autoApplyCheckbox');
    if (autoApplyCheckbox) {
      try {
        const saved = localStorage.getItem('myCsvViewer_autoApply');
        if (saved !== null) autoApplyCheckbox.checked = saved === '1';
      } catch (e) {}
      autoApplyCheckbox.removeEventListener('change', window.__autoApplyHandler__);
      window.__autoApplyHandler__ = () => {
        try { localStorage.setItem('myCsvViewer_autoApply', autoApplyCheckbox.checked ? '1' : '0'); } catch (e) {}
      };
      autoApplyCheckbox.addEventListener('change', window.__autoApplyHandler__);
    }
  } catch (e) {
    console.error('Apply/Export hookup error:', e);
  }

  renderPage();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", attachUI, { once: true });
} else {
  attachUI();
}

// 公開 API
window.app.data.loadCsv = loadCsv;
window.app.data.loadCsvFromFile = loadCsvFromFile;
window.renderPage = renderPage;
window.app.pagination.renderPagination = renderPagination;
window.app.filter.filterItems = filterItems;
window.app.filter.pushHistory = Filter.pushHistory;
window.app.data.exportCsv = Data.exportCsv;
window.app.data.applyPendingHiddenToHidden = Data.applyPendingHiddenToHidden;

// 互換性のためグローバル関数も残す（既存コードが参照する場合）
window.updateRating = updateRating;
window.toggleHidden = toggleHidden;
window.addTagToFilter = addTagToFilter;
window.saveItemsState = Data.saveItemsState;
