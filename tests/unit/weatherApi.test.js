/**
 * Unit tests for WeatherApi (shared fetch + cache helpers)
 */

const localStorageMock = (() => {
    let store = {};
    return {
        getItem: jest.fn(key => (key in store ? store[key] : null)),
        setItem: jest.fn((key, value) => { store[key] = String(value); }),
        removeItem: jest.fn(key => { delete store[key]; }),
        key: jest.fn(i => Object.keys(store)[i] || null),
        get length() { return Object.keys(store).length; },
        clear: () => { store = {}; },
        _dump: () => ({ ...store })
    };
})();

global.localStorage = localStorageMock;
global.fetch = jest.fn();

const WeatherApi = require('../../weatherApi.js');

beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
});

describe('localDateString', () => {
    test('formats a known date as YYYY-MM-DD', () => {
        expect(WeatherApi.localDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
        expect(WeatherApi.localDateString(new Date(2026, 11, 31))).toBe('2026-12-31');
    });

    test('uses local time, not UTC (the toISOString bug)', () => {
        // 11:30 PM local on Sep 30 — toISOString() would roll to Oct 1 in any TZ behind UTC
        const lateEvening = new Date(2026, 8, 30, 23, 30);
        expect(WeatherApi.localDateString(lateEvening)).toBe('2026-09-30');
    });
});

describe('cachedFetchJson', () => {
    const url = 'https://example.com/data';

    test('fetches and stores on cache miss', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ v: 1 }) });

        const data = await WeatherApi.cachedFetchJson(url, 'k1', 10);

        expect(data).toEqual({ v: 1 });
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(localStorage.setItem).toHaveBeenCalledWith(
            'wxcache:k1',
            expect.stringContaining('"v":1')
        );
    });

    test('returns cached data without fetching when fresh', async () => {
        localStorage.setItem('wxcache:k1', JSON.stringify({ t: Date.now(), d: { v: 'cached' } }));

        const data = await WeatherApi.cachedFetchJson(url, 'k1', 10);

        expect(data).toEqual({ v: 'cached' });
        expect(fetch).not.toHaveBeenCalled();
    });

    test('refetches when cache entry is expired', async () => {
        const elevenMinAgo = Date.now() - 11 * 60000;
        localStorage.setItem('wxcache:k1', JSON.stringify({ t: elevenMinAgo, d: { v: 'stale' } }));
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ v: 'fresh' }) });

        const data = await WeatherApi.cachedFetchJson(url, 'k1', 10);

        expect(data).toEqual({ v: 'fresh' });
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('refetches when cache entry is corrupted', async () => {
        localStorage.setItem('wxcache:k1', 'not json {{{');
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ v: 2 }) });

        const data = await WeatherApi.cachedFetchJson(url, 'k1', 10);

        expect(data).toEqual({ v: 2 });
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('throws on non-ok HTTP response and does not cache', async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 503 });

        await expect(WeatherApi.cachedFetchJson(url, 'k1', 10)).rejects.toThrow('HTTP 503');
        expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    test('still returns data when localStorage.setItem throws (quota)', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ v: 3 }) });
        localStorage.setItem.mockImplementationOnce(() => { throw new Error('QuotaExceededError'); });

        const data = await WeatherApi.cachedFetchJson(url, 'k1', 10);

        expect(data).toEqual({ v: 3 });
    });

    test('separate cache keys do not collide', async () => {
        fetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ loc: 'A' }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ loc: 'B' }) });

        const a = await WeatherApi.cachedFetchJson(url, 'normals:A', 10);
        const b = await WeatherApi.cachedFetchJson(url, 'normals:B', 10);

        expect(a).toEqual({ loc: 'A' });
        expect(b).toEqual({ loc: 'B' });
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});

describe('pruneCache', () => {
    test('removes expired and corrupted wxcache entries, keeps fresh and foreign keys', () => {
        const now = Date.now();
        localStorage.setItem('wxcache:fresh', JSON.stringify({ t: now, d: 1 }));
        localStorage.setItem('wxcache:old', JSON.stringify({ t: now - 25 * 3600000, d: 1 }));
        localStorage.setItem('wxcache:bad', '{{{');
        localStorage.setItem('userLocation', 'keep-me');

        WeatherApi.pruneCache(1440);

        expect(localStorage.getItem('wxcache:fresh')).not.toBeNull();
        expect(localStorage.getItem('wxcache:old')).toBeNull();
        expect(localStorage.getItem('wxcache:bad')).toBeNull();
        expect(localStorage.getItem('userLocation')).toBe('keep-me');
    });
});
