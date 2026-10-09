// src/filter.js
// フィルタロジックと履歴管理（履歴管理を単一化）

/**
 * filterItems: DOM の検索ボックス / タグ入力 / タグモードを参照して
 * window.items をフィルタして返す。
 */
export function filterItems() {
  const q = (document.getElementById('searchBox')?.value || '').trim().toLowerCase();
  const tagStr = (document.getElementById('tagBox')?.value || '').trim();
  const tags = tagStr ? tagStr.split(',').map(s => s.trim()).filter(Boolean) : [];
  const tagModeOr = !!document.getElementById('tagModeToggle')?.checked;
  return (window.items || []).filter(it => {
    if (it.hidden) return false;
    if (q) {
      const hay = ((it.name || '') + ' ' + (it.id || '') + ' ' + (it.file || '')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (tags.length) {
      const allTags = [].concat(it.tagsA || [], it.tagsB || [], it.tagsC || []);
      if (tagModeOr) {
        if (!tags.some(t => allTags.includes(t))) return false;
      } else {
        if (!tags.every(t => allTags.includes(t))) return false;
      }
    }
    return true;
  });
}

/**
 * pushHistory: 現在のフォーム状態とページを history に push する。
 * 履歴に入れる内容は必要最小限にする（search, tags, mode, page）。
 */
export function pushHistory() {
  const state = {
    search: document.getElementById('searchBox')?.value || '',
    tags: document.getElementById('tagBox')?.value || '',
    mode: document.getElementById('tagModeToggle')?.checked || false,
    page: window.currentPage
  };
  try {
    // debug: 出力してどの state が push されるか確認する
    console.debug('[history-debug] pushHistory called', { state });
    history.pushState(state, '');
  } catch (e) {
    console.error('[history-debug] pushState error:', e, { state });
  }
}

/**
 * onPopState: popstate イベントハンドラ（history から復元）
 * - event.state がある場合はフォームと page を復元して描画を呼ぶ。
 * - event.state がない場合はフォームをクリアして最初のページを描画する。
 *
 * 注意: この関数自体は export され、initHistory() が一度だけ popstate を登録する。
 */
export function onPopState(event) {
  // debug: popstate を受け取ったときの event.state を必ずログに出す
  console.debug('[history-debug] onPopState fired', { state: event.state });
  if (event.state) {
    const sb = document.getElementById('searchBox');
    const tb = document.getElementById('tagBox');
    const tagModeToggle = document.getElementById('tagModeToggle');
    const tagModeLabel = document.getElementById('tagModeLabel');
    if (sb) sb.value = event.state.search || '';
    if (tb) tb.value = event.state.tags || '';
    if (tagModeToggle) { tagModeToggle.checked = !!event.state.mode; if (tagModeLabel) tagModeLabel.textContent = event.state.mode ? 'OR' : 'AND'; }
    window.currentPage = event.state.page || 1;
    // renderPage は外部モジュールが提供するためグローバルに存在する想定
    if (typeof window.renderPage === 'function') window.renderPage();
  } else {
    const sb = document.getElementById('searchBox');
    const tb = document.getElementById('tagBox');
    const tagModeToggle = document.getElementById('tagModeToggle');
    const tagModeLabel = document.getElementById('tagModeLabel');
    if (sb) sb.value = '';
    if (tb) tb.value = '';
    if (tagModeToggle) { tagModeToggle.checked = false; if (tagModeLabel) tagModeLabel.textContent = 'AND'; }
    window.currentPage = 1;
    if (typeof window.renderPage === 'function') window.renderPage();
  }
}

/**
 * initHistory: popstate の登録を一度だけ行う（冪等）。
 * 他モジュールはこれを呼ぶだけで良い（重複登録を避ける）。
 */
let __history_initialized = false;
export function initHistory() {
  if (__history_initialized) return;
  try {
    // debug: initHistory が呼ばれたことをログに出す
    console.debug('[history-debug] initHistory registering popstate listener');
    window.addEventListener('popstate', onPopState);
    __history_initialized = true;
  } catch (e) {
    console.error('initHistory error:', e);
  }
}
