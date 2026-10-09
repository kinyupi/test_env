// src/data.js
// CSV 読み込みと items 管理（厳密パーサを内包）
// 永続化キーは myCsvViewer_items_v1 に統一

const STORAGE_KEY = 'myCsvViewer_items_v1';

function splitCSVLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function parseCSV(text) {
  const lines = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim() !== "");
  if (lines.length === 0) return [];
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length === 0) continue;
    const obj = {
      id: cols[0] || "",
      name: cols[1] || "",
      file: cols[2] || "",
      thumb: cols[3] || "",
      tagsA: cols[4] || "",
      tagsB: cols[5] || "",
      tagsC: cols[6] || "",
      rating: (function(raw){
        if (raw === undefined || raw === null) return null;
        const s = String(raw).trim();
        if (s === "") return null;
        const n = Number(s);
        if (Number.isNaN(n)) return null;
        return Math.max(0, Math.min(10, Math.floor(n)));
      })(cols[7]),
      hidden: cols[8] ? (cols[8] === "1" || cols[8] === "true") : false,
      pendingHidden: false,
      pendingOriginalRating: undefined
    };
    obj.tagsA = obj.tagsA ? obj.tagsA.split(",").map(t => t.trim()).filter(Boolean) : [];
    obj.tagsB = obj.tagsB ? obj.tagsB.split(",").map(t => t.trim()).filter(Boolean) : [];
    obj.tagsC = obj.tagsC ? obj.tagsC.split(",").map(t => t.trim()).filter(Boolean) : [];
    result.push(obj);
  }
  return result;
}

export async function loadCsv(fileHandleOrFile) {
  try {
    let file;
    if (fileHandleOrFile instanceof File) file = fileHandleOrFile;
    else if (fileHandleOrFile && typeof fileHandleOrFile.getFile === 'function') file = await fileHandleOrFile.getFile();
    else throw new Error('Unsupported file handle');
    const text = await file.text();
    const parsed = parseCSV(text);
    window.items = parsed;
    // load saved minimal state (if any)
    try { loadSavedState(); } catch (e) { console.error('loadSavedState error:', e); }
    window.currentPage = 1;
    // persist last handle name (for best-effort reopen)
    try { localStorage.setItem('csvHandleName', fileHandleOrFile.name || file.name || ''); } catch (e) {}
    return parsed;
  } catch (e) {
    console.error('loadCsv error:', e);
    throw e;
  }
}

export function loadCsvFromFile(file) { return loadCsv(file); }

export function saveItemsState() {
  try {
    const minimal = (window.items || []).map((i) => ({
      id: i.id,
      rating: (i.rating === null || i.rating === undefined) ? null : i.rating,
      hidden: !!i.hidden,
      pendingHidden: !!i.pendingHidden,
      pendingOriginalRating: (i.pendingOriginalRating === undefined) ? undefined : (i.pendingOriginalRating === null ? null : i.pendingOriginalRating)
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
  } catch (e) {
    console.error('saveItemsState error:', e);
  }
}

export function loadSavedState() {
  try {
    // Migration: if old key exists, try to migrate
    try {
      const old = localStorage.getItem('myCsvViewer_items');
      if (old && !localStorage.getItem(STORAGE_KEY)) {
        // migrate old -> new (best-effort)
        localStorage.setItem(STORAGE_KEY, old);
      }
    } catch (e) { /* ignore migration errors */ }

    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return;
    const arr = JSON.parse(s);
    arr.forEach((saved) => {
      const it = (window.items || []).find((x) => x.id === saved.id);
      if (it) {
        it.rating = (saved.rating === null || saved.rating === undefined) ? null : Number(saved.rating);
        it.hidden = saved.hidden;
        it.pendingHidden = saved.pendingHidden || false;
        if (Object.prototype.hasOwnProperty.call(saved, 'pendingOriginalRating')) {
          it.pendingOriginalRating = (saved.pendingOriginalRating === undefined) ? undefined : (saved.pendingOriginalRating === null ? null : Number(saved.pendingOriginalRating));
        } else {
          it.pendingOriginalRating = undefined;
        }
      }
    });
  } catch (e) {
    console.error('loadSavedState error:', e);
  }
}

export function applyPendingHiddenToHidden() {
  let changed = false;
  (window.items || []).forEach(it => {
    if (it.pendingHidden) {
      it.hidden = true;
	   // 未評価（null/undefined）の場合、hidden にしたタイミングで 0 にする
      if (it.rating === null || it.rating === undefined) it.rating = 0;
      it.pendingHidden = false;
      it.pendingOriginalRating = undefined;
      changed = true;
    }
  });
  if (changed) saveItemsState();
}

export function exportCsv() {
  applyPendingHiddenToHidden();
  const rows = (window.items || []).map(it => {
    const tagsA = (it.tagsA || []).join(',');
    const tagsB = (it.tagsB || []).join(',');
    const tagsC = (it.tagsC || []).join(',');
    const hiddenVal = it.hidden ? '1' : '0';
    const esc = v => `"${String(v || '').replace(/"/g, '""')}"`;
    const ratingOut = (it.rating === null || it.rating === undefined) ? '' : String(it.rating);
    return [ esc(it.id), esc(it.name), esc(it.file), esc(it.thumb), esc(tagsA), esc(tagsB), esc(tagsC), esc(ratingOut), esc(hiddenVal) ].join(',');
  });
  const csvText = rows.join('\r\n');
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'export.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
