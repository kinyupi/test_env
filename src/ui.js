import * as Data from './data.js';
import * as Filter from './filter.js';
import * as Pagenation from './Pagenation.js';

export function init() {
  const searchBox = document.getElementById('searchBox');
  const tagBox = document.getElementById('tagBox');
  const tagModeToggle = document.getElementById('tagModeToggle');
  const tagModeLabel = document.getElementById('tagModeLabel');
  const applyFilter = document.getElementById('applyFilter');
  const clearFilter = document.getElementById('clearFilter');
  const openCsv = document.getElementById('openCsv');
  const externalSearch = document.getElementById('externalSearch');
  const immediateHideToggle = document.getElementById('immediateHideToggle');

  window.removeEventListener('popstate', Filter.onPopState);
  window.addEventListener('popstate', Filter.onPopState);

  if (searchBox) {
    searchBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { Filter.pushHistory(); window.currentPage = 1; Pagenation.renderPage(); }
    });
  }

  if (externalSearch) {
    externalSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        try {
          const q = externalSearch.value.trim();
          const euc = encodeEUCJP(q); // encoding は HTML に残す前提でグローバル
          window.open('https://seesaawiki.jp/w/sougouwiki/search?keywords=' + euc, '_blank');
        } catch (err) { console.error('externalSearch error:', err); }
      }
    });
  }

  if (tagBox) {
    tagBox.addEventListener('keydown', (e) => { if (e.key === 'Enter') { window.currentPage = 1; Pagenation.renderPage(); } });
  }

  if (openCsv) {
    openCsv.addEventListener('click', async () => {
      try {
        const pickerOpts = { types: [{ description: 'CSV Files', accept: { 'text/csv': ['.csv'] } }] };
        let fileHandle = null;
        if (window.showOpenFilePicker) {
          const res = await window.showOpenFilePicker(pickerOpts);
          if (Array.isArray(res) && res.length > 0) fileHandle = res[0];
        } else {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.csv,text/csv';
          input.style.display = 'none';
          document.body.appendChild(input);
          input.addEventListener('change', async (ev) => {
            const f = ev.target.files && ev.target.files[0];
            if (f) await Data.loadCsvFromFile(f);
            input.remove();
            Pagenation.renderPage();
          }, { once: true });
          input.click();
        }
        if (fileHandle) {
          await Data.loadCsv(fileHandle);
          Pagenation.renderPage();
        }
      } catch (e) {
        console.error('showOpenFilePicker failed or cancelled:', e);
      }
    });
  }

  if (tagModeToggle) {
    tagModeToggle.addEventListener('change', () => {
      if (tagModeLabel) tagModeLabel.textContent = tagModeToggle.checked ? 'OR' : 'AND';
      window.currentPage = 1;
      Pagenation.renderPage();
    });
  }

  if (applyFilter) {
    applyFilter.addEventListener('click', () => { Filter.pushHistory(); window.currentPage = 1; Pagenation.renderPage(); });
  }

  if (clearFilter) {
    clearFilter.addEventListener('click', () => {
      if (searchBox) searchBox.value = '';
      if (tagBox) tagBox.value = '';
      if (tagModeToggle) tagModeToggle.checked = false;
      if (tagModeLabel) tagModeLabel.textContent = 'AND';
      window.currentPage = 1;
      Pagenation.renderPage();
    });
  }

  try {
    if (immediateHideToggle) {
      const savedImmediate = localStorage.getItem('myCsvViewer_immediateHide');
      if (savedImmediate !== null) immediateHideToggle.checked = savedImmediate === '1';
      immediateHideToggle.addEventListener('change', () => {
        try { localStorage.setItem('myCsvViewer_immediateHide', immediateHideToggle.checked ? '1' : '0'); } catch (e) {}
      });
    }
  } catch (e) {
    console.error('immediateHideToggle handling error:', e);
  }

  const initialState = {
    search: searchBox?.value || '',
    tags: tagBox?.value || '',
    mode: tagModeToggle ? tagModeToggle.checked : false,
    page: window.currentPage || 1
  };
  try { history.replaceState(initialState, ''); } catch (e) { console.error('replaceState error:', e); }

  Pagenation.renderPage();
}
