/**
 * Minimal, test-friendly implementation of the external-search logic.
 *
 * This module is intentionally small and dependency-injectable:
 * - encoderFn (optional) should be a function that takes (text) and returns a percent-encoded EUC-JP string or throws.
 * - windowOpenFn (optional) is used to open URLs (defaults to global.open / window.open).
 *
 * The real project logic can be adapted to call this module or this module can be used
 * as a test harness that mirrors the production behavior.
 */

function isAsciiPrintableOnly(s) {
  return typeof s === 'string' && /^[\x20-\x7E]*$/.test(s);
}

function isLikelyPercentEncoded(bytesStr) {
  if (!bytesStr || typeof bytesStr !== 'string') return false;
  const allPercentPattern = /^(?:%[0-9A-F]{2})+$/i;
  const somePercentPattern = /%[0-9A-F]{2}/i;
  if (allPercentPattern.test(bytesStr)) return true;
  const percentCount = (bytesStr.match(/%/g) || []).length;
  return percentCount >= 2 && somePercentPattern.test(bytesStr);
}

/**
 * doExternalSearch
 * @param {string} text
 * @param {object} [opts]
 *   - encoderFn: async function(text) -> percent-encoded string (EUC-JP candidate)
 *   - windowOpenFn: function(url, target)
 *   - timeoutMs: number
 */
async function doExternalSearch(text, opts = {}) {
  const encoderFn = opts.encoderFn;
  const windowOpenFn = opts.windowOpenFn || (typeof window !== 'undefined' ? window.open.bind(window) : global.open);
  const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 4000;

  if (isAsciiPrintableOnly(text)) {
    const q = encodeURIComponent(text);
    windowOpenFn("https://seesaawiki.jp/w/sougouwiki/search?keywords=" + q, "_blank");
    return { mode: 'utf8', url: "https://seesaawiki.jp/w/sougouwiki/search?keywords=" + q };
  }

  if (typeof encoderFn !== 'function') {
    // No encoder provided: fallback to UTF-8
    const fallback = encodeURIComponent(text);
    windowOpenFn("https://seesaawiki.jp/w/sougouwiki/search?keywords=" + fallback, "_blank");
    return { mode: 'fallback', url: "https://seesaawiki.jp/w/sougouwiki/search?keywords=" + fallback };
  }

  // Try encoder with timeout
  let timedOut = false;
  const timer = new Promise((_, reject) => {
    setTimeout(() => {
      timedOut = true;
      reject(new Error('encodeEUCJP timeout'));
    }, timeoutMs);
  });

  try {
    const eucCandidate = await Promise.race([encoderFn(text), timer]);
    if (isLikelyPercentEncoded(eucCandidate)) {
      const url = "https://seesaawiki.jp/w/sougouwiki/search?keywords=" + eucCandidate;
      windowOpenFn(url, "_blank");
      return { mode: 'euc', url };
    } else {
      const fallback = encodeURIComponent(text);
      const url = "https://seesaawiki.jp/w/sougouwiki/search?keywords=" + fallback;
      windowOpenFn(url, "_blank");
      return { mode: 'fallback-invalid-euc', url };
    }
  } catch (err) {
    const fallback = encodeURIComponent(text);
    const url = "https://seesaawiki.jp/w/sougouwiki/search?keywords=" + fallback;
    windowOpenFn(url, "_blank");
    return { mode: 'fallback-error', error: String(err), url };
  }
}

module.exports = { doExternalSearch, isAsciiPrintableOnly, isLikelyPercentEncoded };
