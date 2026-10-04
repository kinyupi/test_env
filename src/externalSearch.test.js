const { doExternalSearch } = require('../src/externalSearch');

describe('doExternalSearch', () => {
  test('opens UTF-8 URL for ASCII-only text', async () => {
    const opened = [];
    const fakeOpen = (url, target) => opened.push({ url, target });

    const res = await doExternalSearch('abc123', { windowOpenFn: fakeOpen });
    expect(res.mode).toBe('utf8');
    expect(opened.length).toBe(1);
    expect(opened[0].url).toContain('keywords=abc123');
  });

  test('uses encoderFn when provided and valid EUC-JP percent string returned', async () => {
    const opened = [];
    const fakeOpen = (url) => opened.push(url);

    // encoder returns a valid percent-encoded string
    const encoderFn = async (text) => '%A4%A2%A4%A4'; // looks like %XX%XX...
    const res = await doExternalSearch('テスト', { encoderFn, windowOpenFn: fakeOpen });
    expect(res.mode).toBe('euc');
    expect(opened.length).toBe(1);
    expect(opened[0]).toContain('%A4%A2%A4%A4');
  });

  test('falls back to UTF-8 when encoder returns invalid string', async () => {
    const opened = [];
    const fakeOpen = (url) => opened.push(url);

    // encoder returns something not percent-encoded
    const encoderFn = async (text) => 'not-percent';
    const res = await doExternalSearch('テスト', { encoderFn, windowOpenFn: fakeOpen });
    expect(res.mode).toBe('fallback-invalid-euc');
    expect(opened.length).toBe(1);
    expect(opened[0]).toContain(encodeURIComponent('テスト'));
  });

  test('falls back to UTF-8 on encoder error or timeout', async () => {
    const opened = [];
    const fakeOpen = (url) => opened.push(url);

    // encoder that rejects
    const encoderFn = async (text) => { throw new Error('boom'); };
    const res = await doExternalSearch('テスト', { encoderFn, windowOpenFn: fakeOpen });
    expect(res.mode).toBe('fallback-error');
    expect(res.error).toMatch(/boom/);
    expect(opened.length).toBe(1);
  });

  test('times out if encoder takes too long', async () => {
    const opened = [];
    const fakeOpen = (url) => opened.push(url);

    // encoder that never resolves
    const encoderFn = () => new Promise(() => {});
    const res = await doExternalSearch('テスト', { encoderFn, windowOpenFn: fakeOpen, timeoutMs: 50 });
    // Should fallback due to timeout
    expect(res.mode).toBe('fallback-error');
    expect(res.error).toMatch(/timeout/);
    expect(opened.length).toBe(1);
  });
});
