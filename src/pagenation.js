// src/Pagenation.js
import { filterItems } from './filter.js';
import { createItemElement } from './utils.js';
import { pushHistory } from './filter.js'; // 履歴は filter.js に集約

export function renderPagenation(totalPages) {
  const Pagenation = document.getElementById('Pagenation');
  if (!Pagenation) return;
  while (Pagenation.firstChild) Pagenation.removeChild(Pagenation.firstChild);
  const createBtn = (text, page, disabled) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    if (disabled) b.disabled = true;
    else b.addEventListener('click', () => {
      // debug: ページ切替の push を可視化
      console.debug('[history-debug] pagination button clicked', { page, currentPage: window.currentPage });
      window.currentPage = page;
      pushHistory();
      renderPage();

    });
    return b;
  };
  Pagenation.appendChild(createBtn('<<', 1, window.currentPage === 1));
  Pagenation.appendChild(createBtn('<', Math.max(1, window.currentPage - 1), window.currentPage === 1));
  const start = Math.max(1, window.currentPage - 2);
  const end = Math.min(totalPages, window.currentPage + 2);
  for (let p = start; p <= end; p++) {
    const btn = createBtn(String(p), p, false);
    if (p === window.currentPage) btn.classList.add('active');
    Pagenation.appendChild(btn);
  }
  Pagenation.appendChild(createBtn('>', Math.min(totalPages, window.currentPage + 1), window.currentPage === totalPages));
  Pagenation.appendChild(createBtn('>>', totalPages, window.currentPage === totalPages));
}

export function renderPage() {
  const container = document.getElementById('container');
  if (!container) return;
  while (container.firstChild) container.removeChild(container.firstChild);
  const filtered = filterItems();
  const start = (window.currentPage - 1) * window.perPage;
  const pageItems = filtered.slice(start, start + window.perPage);
  const frag = document.createDocumentFragment();
  pageItems.forEach(item => frag.appendChild(createItemElement(item)));
  container.appendChild(frag);
  const totalPages = Math.max(1, Math.ceil(filtered.length / window.perPage));
  renderPagenation(totalPages);
}
