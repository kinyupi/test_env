// src/getDisplayItems.js
// ES module 形式。CommonJS の場合は export を module.exports に置き換えてください.

export function getDisplayItems(items = [], filters = {}) {
  // Defensive normalization
  const src = Array.isArray(items) ? items : [];

  // Filters normalization
  const ratingPreset = (filters.ratingPreset || '').toString();
  const includeUnrated = !!filters.includeUnrated;
  const includeHidden = (filters.includeHidden === undefined) ? true : !!filters.includeHidden;
  const tagsFilter = Array.isArray(filters.tags) ? filters.tags.slice() : [];
  const textQuery = (filters.textQuery || '').toString().trim().toLowerCase();

  // Determine tag match mode with compatibility:
  // Priority: filters.matchMode ('AND'|'OR') -> filters.mode (boolean: true=OR) -> filters.tagModeToggle (boolean: true=OR)
  let matchMode = 'AND';
  if (filters.matchMode && String(filters.matchMode).toUpperCase() === 'OR') matchMode = 'OR';
  else if (filters.matchMode && String(filters.matchMode).toUpperCase() === 'AND') matchMode = 'AND';
  else if (typeof filters.mode === 'boolean') matchMode = filters.mode ? 'OR' : 'AND';
  else if (typeof filters.tagModeToggle === 'boolean') matchMode = filters.tagModeToggle ? 'OR' : 'AND';

  // Simple cache using window.__items_version__ if available
  try {
    if (typeof window !== 'undefined') {
      window.__getDisplayItems_cache__ = window.__getDisplayItems_cache__ || { key: null, value: null };
      const version = (window.__items_version__ !== undefined && window.__items_version__ !== null) ? String(window.__items_version__) : '';
      const key = version + '|' + JSON.stringify({ ratingPreset, includeUnrated, includeHidden, tagsFilter, textQuery, matchMode });
      if (window.__getDisplayItems_cache__.key === key) {
        return window.__getDisplayItems_cache__.value.slice();
      }
    }
  } catch (e) {
    // ignore cache errors
  }

  const normalizeTag = (t) => (t === undefined || t === null) ? '' : String(t).trim().toLowerCase();

  const collectTagsFromItem = (item) => {
    const out = [];
    if (!item) return out;
    ['tags','tagsA','tagsB','tagsC'].forEach(k => {
      const v = item[k];
      if (Array.isArray(v)) out.push(...v);
      else if (typeof v === 'string' && v.trim() !== '') {
        v.split(',').forEach(s => { if (s && s.trim() !== '') out.push(s); });
      }
    });
    return out.map(normalizeTag).filter(Boolean);
  };

  const itemMatchesTags = (item, requiredTags, mode) => {
    if (!requiredTags || requiredTags.length === 0) return true;
    const itemTagsArr = collectTagsFromItem(item);
    if (itemTagsArr.length === 0) return false;
    const itemTagSet = new Set(itemTagsArr);
    if (mode === 'OR') {
      return requiredTags.some(rt => itemTagSet.has(normalizeTag(rt)));
    }
    return requiredTags.every(rt => itemTagSet.has(normalizeTag(rt)));
  };

  const ratingMatchesPreset = (ratingRaw) => {
    const isNull = (ratingRaw === null || ratingRaw === undefined || ratingRaw === '');
    const r = isNull ? null : Number(ratingRaw);
    if (!ratingPreset) return true;
    if (ratingPreset === 'unrated') return isNull;
    if (isNull) return includeUnrated === true;
    if (Number.isNaN(r)) return false;
    if (ratingPreset === 'low') return r <= 3;
    if (ratingPreset === 'mid') return r >= 4 && r <= 6;
    if (ratingPreset === 'high') return r >= 7;
    return true;
  };

  const textMatches = (item) => {
    if (!textQuery) return true;
    const id = (item && item.id) ? String(item.id).toLowerCase() : '';
    const name = (item && item.name) ? String(item.name).toLowerCase() : '';
    const file = (item && item.file) ? String(item.file).toLowerCase() : '';
    return id.includes(textQuery) || name.includes(textQuery) || file.includes(textQuery);
  };

  const result = src.filter(item => {
    if (!includeHidden && item && item.hidden) return false;

    if (!ratingMatchesPreset(item && item.rating)) return false;

    if (!itemMatchesTags(item || {}, tagsFilter, matchMode)) return false;

    if (!textMatches(item || {})) return false;

    return true;
  });

  // cache
  try {
    if (typeof window !== 'undefined') {
      const version = (window.__items_version__ !== undefined && window.__items_version__ !== null) ? String(window.__items_version__) : '';
      window.__getDisplayItems_cache__.key = version + '|' + JSON.stringify({ ratingPreset, includeUnrated, includeHidden, tagsFilter, textQuery, matchMode });
      window.__getDisplayItems_cache__.value = result.slice();
    }
  } catch (e) { /* ignore */ }

  return result.slice();
}
