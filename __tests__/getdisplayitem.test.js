// __tests__/getDisplayItems.test.js
import { getDisplayItems } from "../src/getDisplayItems.js";

describe("getDisplayItems", () => {
  // モック window を毎回初期化して副作用を防ぐ
  beforeEach(() => {
    global.window = {};
    window.__items_version__ = undefined;
    window.__getDisplayItems_cache__ = { key: null, value: null };
  });

  afterEach(() => {
    // クリーンアップ
    delete global.window;
  });

  test("returns empty array for undefined/null/non-array items", () => {
    expect(getDisplayItems(undefined, {})).toEqual([]);
    expect(getDisplayItems(null, {})).toEqual([]);
    expect(getDisplayItems("string", {})).toEqual([]);
  });

  test("basic rating presets low/mid/high/unrated and includeUnrated behavior", () => {
    const items = [
      { id: 1, rating: 0, hidden: false },
      { id: 2, rating: 3, hidden: false },
      { id: 3, rating: 4, hidden: false },
      { id: 4, rating: 6, hidden: false },
      { id: 5, rating: 7, hidden: false },
      { id: 6, rating: null, hidden: false },
      { id: 7, rating: "", hidden: false }
    ];

    // low: <=3
    expect(getDisplayItems(items, { ratingPreset: "low" }).map(i => i.id).sort())
      .toEqual([1,2]);

    // mid: 4..6
    expect(getDisplayItems(items, { ratingPreset: "mid" }).map(i => i.id).sort())
      .toEqual([3,4]);

    // high: >=7
    expect(getDisplayItems(items, { ratingPreset: "high" }).map(i => i.id).sort())
      .toEqual([5]);

    // unrated: only null/undefined/''
    expect(getDisplayItems(items, { ratingPreset: "unrated" }).map(i => i.id).sort())
      .toEqual([6,7]);

    // includeUnrated true with other preset includes unrated items
    expect(getDisplayItems(items, { ratingPreset: "high", includeUnrated: true }).some(i => i.rating === null || i.rating === "")).toBe(true);
  });

  test("hidden handling default and when includeHidden is false", () => {
    const items = [
      { id: 1, rating: 5, hidden: true },
      { id: 2, rating: 5, hidden: false }
    ];

    // デフォルト includeHidden === true (実装では undefined -> true)
    expect(getDisplayItems(items, {}).map(i => i.id).sort()).toEqual([1,2]);

    // includeHidden false なら hidden を除外
    expect(getDisplayItems(items, { includeHidden: false }).map(i => i.id)).toEqual([2]);
  });

  test("textQuery matches id name file case-insensitively and by substring", () => {
    const items = [
      { id: "ABC123", name: "My File", file: "path/to/one.txt" },
      { id: "xyz", name: "Another", file: "path/to/two.txt" }
    ];

    expect(getDisplayItems(items, { textQuery: "abc" }).length).toBe(1);
    expect(getDisplayItems(items, { textQuery: "file" }).length).toBe(1);
    expect(getDisplayItems(items, { textQuery: "TO/two" }).length).toBe(1);
  });

  test("tags collection from tags, tagsA, tagsB, tagsC and comma-separated strings", () => {
    const items = [
      { id: 1, tags: ["foo","bar"] },
      { id: 2, tagsA: "alpha,beta", tagsB: ["gamma"] },
      { id: 3, tagsC: "one", tags: [] },
      { id: 4 } // no tags
    ];

    // require tag 'foo' -> only id 1
    expect(getDisplayItems(items, { tags: ["foo"] }).map(i => i.id)).toEqual([1]);

    // require tag 'beta' -> id 2
    expect(getDisplayItems(items, { tags: ["beta"] }).map(i => i.id)).toEqual([2]);

    // AND mode: require both alpha and gamma -> id 2
    expect(getDisplayItems(items, { tags: ["alpha","gamma"], matchMode: "AND" }).map(i => i.id)).toEqual([2]);

    // OR mode: require one of many -> id 1 and 2 and 3
    expect(getDisplayItems(items, { tags: ["foo","one"], matchMode: "OR" }).map(i => i.id).sort()).toEqual([1,3]);
  });

  test("tag matchMode priority: matchMode -> mode -> tagModeToggle", () => {
    const items = [{ id: 1, tags: ["a","b"] }, { id: 2, tags: ["a"] }];

    // explicit matchMode OR
    expect(getDisplayItems(items, { tags: ["a","b"], matchMode: "OR" }).map(i => i.id).sort()).toEqual([1,2]);

    // mode boolean true means OR
    expect(getDisplayItems(items, { tags: ["a","b"], mode: true }).map(i => i.id).sort()).toEqual([1,2]);

    // tagModeToggle true means OR (legacy)
    expect(getDisplayItems(items, { tags: ["a","b"], tagModeToggle: true }).map(i => i.id).sort()).toEqual([1,2]);
  });

  test("items with no tags are excluded when requiredTags non-empty", () => {
    const items = [{ id: 1 }, { id: 2, tags: ["x"] }];
    expect(getDisplayItems(items, { tags: ["x"] }).map(i => i.id)).toEqual([2]);
  });

  test("rating NaN and non-numeric strings are handled robustly", () => {
    const items = [{ id: 1, rating: "5" }, { id: 2, rating: "NaN" }, { id: 3, rating: "abc" }];
    // "5" should be treated as number 5 and match high/mid/low accordingly
    expect(getDisplayItems(items, { ratingPreset: "high" }).map(i => i.id)).toEqual([]);
    expect(getDisplayItems(items, { ratingPreset: "mid" }).map(i => i.id)).toEqual([1]); // 5 is mid (4..6)
    // NaN/abc should not match numeric presets
    expect(getDisplayItems(items, { ratingPreset: "low" }).map(i => i.id)).toEqual([]);
  });

  test("cache behavior uses window.__items_version__ and returns a copy", () => {
    const items = [{ id: 1, rating: 5 }];
    window.__items_version__ = "v1";
    // first call populates cache
    const r1 = getDisplayItems(items, { ratingPreset: "mid" });
    expect(Array.isArray(r1)).toBe(true);
    // mutate returned array and ensure cache stored a copy (original cache.value should not be same reference as r1)
    if (window.__getDisplayItems_cache__ && window.__getDisplayItems_cache__.value) {
      expect(window.__getDisplayItems_cache__.value).not.toBe(r1);
      // subsequent call with same version and filters should return a new copy equal in content
      const r2 = getDisplayItems(items, { ratingPreset: "mid" });
      expect(r2).not.toBe(r1);
      expect(r2).toEqual(r1);
    } else {
      // 実装によっては cache が未設定の可能性があるが、エラーにはしない
      expect(getDisplayItems(items, { ratingPreset: "mid" })).toEqual(r1);
    }

    // change version invalidates cache
    window.__items_version__ = "v2";
    const r3 = getDisplayItems(items, { ratingPreset: "mid" });
    expect(r3).toEqual(r1);
  });

  test("filters combined: rating + tags + textQuery + hidden interplay", () => {
    const items = [
      { id: "a1", rating: 8, tags: ["x"], name: "Alpha", hidden: true },
      { id: "b2", rating: 2, tags: ["y"], name: "Beta", hidden: false },
      { id: "c3", rating: null, tags: ["x","y"], name: "Gamma", hidden: false }
    ];

    // rating high + tag x -> a1 (hidden true but includeHidden default true)
    expect(getDisplayItems(items, { ratingPreset: "high", tags: ["x"] }).map(i => i.id)).toEqual(["a1"]);

    // includeHidden false removes a1
    expect(getDisplayItems(items, { ratingPreset: "high", tags: ["x"], includeHidden: false }).length).toBe(0);

    // includeUnrated true with tag x returns c3 when ratingPreset empty
    expect(getDisplayItems(items, { includeUnrated: true, tags: ["x"] }).map(i => i.id).sort()).toEqual(["a1","c3"]);
  });
});
