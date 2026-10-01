/**
 * WeatherApi — shared fetch + cache helpers for all dashboard pages.
 * Cached entries live in localStorage under "wxcache:<key>" with a timestamp.
 */

const WeatherApi = {
    CACHE_PREFIX: 'wxcache:',

    // Local-timezone YYYY-MM-DD (never use toISOString() for "today": it's UTC)
    localDateString(d = new Date()) {
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${m}-${day}`;
    },

    /**
     * Fetch JSON with a localStorage cache.
     * @param {string} url
     * @param {string} cacheKey  unique key; include location/date so entries don't collide
     * @param {number} ttlMinutes  how long a cached entry stays fresh
     */
    async cachedFetchJson(url, cacheKey, ttlMinutes) {
        const storageKey = this.CACHE_PREFIX + cacheKey;
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const entry = JSON.parse(raw);
                if (entry && typeof entry.t === 'number' && (Date.now() - entry.t) < ttlMinutes * 60000) {
                    return entry.d;
                }
            }
        } catch (e) {
            // corrupted cache entry — fall through to refetch
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
        const data = await res.json();

        try {
            localStorage.setItem(storageKey, JSON.stringify({ t: Date.now(), d: data }));
        } catch (e) {
            // storage full or unavailable — caching is best-effort
        }
        return data;
    },

    // Remove expired cache entries (call occasionally to keep localStorage tidy)
    pruneCache(maxAgeMinutes = 1440) {
        try {
            const cutoff = Date.now() - maxAgeMinutes * 60000;
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.CACHE_PREFIX)) {
                    try {
                        const entry = JSON.parse(localStorage.getItem(key));
                        if (!entry || typeof entry.t !== 'number' || entry.t < cutoff) {
                            localStorage.removeItem(key);
                        }
                    } catch (e) {
                        localStorage.removeItem(key);
                    }
                }
            }
        } catch (e) {
            // localStorage unavailable — nothing to prune
        }
    }
};

if (typeof window !== 'undefined') {
    window.WeatherApi = WeatherApi;
    WeatherApi.pruneCache();
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeatherApi;
}
