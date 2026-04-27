/**
 * Unit tests for LocationService
 * Tests all functions with ZIP, station ID, null, and edge case inputs
 */

// Mock browser globals before loading LocationService
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: jest.fn(key => store[key] || null),
        setItem: jest.fn((key, value) => { store[key] = value; }),
        removeItem: jest.fn(key => { delete store[key]; }),
        clear: () => { store = {}; }
    };
})();

global.localStorage = localStorageMock;
global.window = { LocationService: null };
global.fetch = jest.fn();

// Mock CONFIG
global.CONFIG = {
    WEATHER_COM_API_KEY: 'test-api-key',
    STATION_ID: 'KIAEARLH10',
    GEOCODE: '41.47,-94.02',
    ZIP_CODE: '50069'
};

// Load LocationService (it assigns to window.LocationService)
require('../../locationService.js');
const LocationService = global.window.LocationService || global.LocationService;

// ============================================================
// Helper to reset state between tests
// ============================================================
beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    fetch.mockClear();
});

// ============================================================
// isStationId()
// ============================================================
describe('isStationId', () => {
    test('valid station IDs return true', () => {
        expect(LocationService.isStationId('KIAEARLH10')).toBe(true);
        expect(LocationService.isStationId('KNEELMWO8')).toBe(true);
        expect(LocationService.isStationId('KAKFAIRB396')).toBe(true);
        expect(LocationService.isStationId('abcdef')).toBe(true); // lowercase
    });

    test('ZIP codes return false', () => {
        expect(LocationService.isStationId('50273')).toBe(false);
        expect(LocationService.isStationId('68349')).toBe(false);
        expect(LocationService.isStationId('00000')).toBe(false);
    });

    test('too short inputs return false', () => {
        expect(LocationService.isStationId('KIA')).toBe(false);
        expect(LocationService.isStationId('KIAEA')).toBe(false);
        expect(LocationService.isStationId('K')).toBe(false);
    });

    test('empty/null return false', () => {
        expect(LocationService.isStationId('')).toBe(false);
        expect(LocationService.isStationId(null)).toBe(false);
    });

    test('undefined coerces to "undefined" string and matches regex', () => {
        // Note: RegExp.test(undefined) coerces to "undefined" which matches [A-Za-z]{6+}
        expect(LocationService.isStationId(undefined)).toBe(true);
    });

    test('inputs starting with number return false', () => {
        expect(LocationService.isStationId('1KIAEARLH10')).toBe(false);
        expect(LocationService.isStationId('123ABC')).toBe(false);
    });

    test('inputs with special characters return false', () => {
        expect(LocationService.isStationId('KIA-EARLH')).toBe(false);
        expect(LocationService.isStationId('KIA EARL')).toBe(false);
        expect(LocationService.isStationId('KIA_EARL10')).toBe(false);
    });
});

// ============================================================
// getLocation()
// ============================================================
describe('getLocation', () => {
    test('returns DEFAULT_LOCATION when localStorage is empty', () => {
        const loc = LocationService.getLocation();
        expect(loc).toEqual(LocationService.DEFAULT_LOCATION);
        expect(loc.city).toBe('Winterset');
        expect(loc.stationId).toBe('KIAEARLH10');
    });

    test('returns stored location with zipCode', () => {
        const stored = {
            zipCode: '68349',
            city: 'Elmwood',
            state: 'NE',
            geocode: '40.84,-96.29',
            stationId: 'KNEELMWO8',
            isDefault: false
        };
        localStorageMock.setItem(LocationService.STORAGE_KEY, JSON.stringify(stored));
        
        const loc = LocationService.getLocation();
        expect(loc.city).toBe('Elmwood');
        expect(loc.zipCode).toBe('68349');
        expect(loc.stationId).toBe('KNEELMWO8');
    });

    test('returns stored location with stationId but no zipCode', () => {
        const stored = {
            zipCode: null,
            city: 'Earlham',
            state: 'IA',
            geocode: '41.47,-94.03',
            stationId: 'KIAEARLH10',
            isDefault: false
        };
        localStorageMock.setItem(LocationService.STORAGE_KEY, JSON.stringify(stored));
        
        const loc = LocationService.getLocation();
        expect(loc.city).toBe('Earlham');
        expect(loc.stationId).toBe('KIAEARLH10');
    });

    test('returns DEFAULT when stored data is missing required fields', () => {
        const invalid = { zipCode: null, city: null, geocode: null, stationId: null };
        localStorageMock.setItem(LocationService.STORAGE_KEY, JSON.stringify(invalid));
        
        const loc = LocationService.getLocation();
        expect(loc).toEqual(LocationService.DEFAULT_LOCATION);
    });

    test('returns DEFAULT when localStorage has invalid JSON', () => {
        localStorageMock.setItem(LocationService.STORAGE_KEY, 'not-json{{{');
        
        const loc = LocationService.getLocation();
        expect(loc).toEqual(LocationService.DEFAULT_LOCATION);
    });
});

// ============================================================
// saveLocation()
// ============================================================
describe('saveLocation', () => {
    test('saves location to localStorage', () => {
        const loc = { zipCode: '50273', city: 'Winterset', state: 'IA', geocode: '41.33,-94.01', stationId: 'KIAEARLH10' };
        const result = LocationService.saveLocation(loc);
        
        expect(result).toBe(true);
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            LocationService.STORAGE_KEY,
            JSON.stringify(loc)
        );
    });
});

// ============================================================
// clearLocation()
// ============================================================
describe('clearLocation', () => {
    test('removes location from localStorage', () => {
        const result = LocationService.clearLocation();
        
        expect(result).toBe(true);
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(LocationService.STORAGE_KEY);
    });
});

// ============================================================
// getStationId()
// ============================================================
describe('getStationId', () => {
    test('returns stationId from stored location', () => {
        const stored = { zipCode: '50273', city: 'Winterset', state: 'IA', geocode: '41.33,-94.01', stationId: 'KIAEARLH10' };
        localStorageMock.setItem(LocationService.STORAGE_KEY, JSON.stringify(stored));
        
        expect(LocationService.getStationId()).toBe('KIAEARLH10');
    });

    test('returns null when no stationId in stored location', () => {
        const stored = { zipCode: '54344', city: 'Green Bay', state: 'WI', geocode: '44.42,-88.11', stationId: null };
        localStorageMock.setItem(LocationService.STORAGE_KEY, JSON.stringify(stored));
        
        expect(LocationService.getStationId()).toBeNull();
    });

    test('returns default stationId when no stored location', () => {
        expect(LocationService.getStationId()).toBe('KIAEARLH10');
    });

    test('does NOT fall back to CONFIG.STATION_ID', () => {
        const stored = { zipCode: '54344', city: 'Green Bay', state: 'WI', geocode: '44.42,-88.11', stationId: null };
        localStorageMock.setItem(LocationService.STORAGE_KEY, JSON.stringify(stored));
        
        const result = LocationService.getStationId();
        expect(result).not.toBe(CONFIG.STATION_ID);
        expect(result).toBeNull();
    });
});

// ============================================================
// getZipCode()
// ============================================================
describe('getZipCode', () => {
    test('returns zipCode from stored location', () => {
        const stored = { zipCode: '68349', city: 'Elmwood', state: 'NE', geocode: '40.84,-96.29', stationId: 'KNEELMWO8' };
        localStorageMock.setItem(LocationService.STORAGE_KEY, JSON.stringify(stored));
        
        expect(LocationService.getZipCode()).toBe('68349');
    });

    test('returns null when location was set via station ID', () => {
        const stored = { zipCode: null, city: 'Earlham', state: 'IA', geocode: '41.47,-94.03', stationId: 'KIAEARLH10' };
        localStorageMock.setItem(LocationService.STORAGE_KEY, JSON.stringify(stored));
        
        expect(LocationService.getZipCode()).toBeNull();
    });
});

// ============================================================
// getGeocode()
// ============================================================
describe('getGeocode', () => {
    test('returns geocode from stored location', () => {
        const stored = { zipCode: '68349', city: 'Elmwood', state: 'NE', geocode: '40.84,-96.29', stationId: 'KNEELMWO8' };
        localStorageMock.setItem(LocationService.STORAGE_KEY, JSON.stringify(stored));
        
        expect(LocationService.getGeocode()).toBe('40.84,-96.29');
    });

    test('returns default geocode when no stored location', () => {
        expect(LocationService.getGeocode()).toBe('41.3306,-94.0138');
    });
});

// ============================================================
// getCityState()
// ============================================================
describe('getCityState', () => {
    test('returns formatted city, state', () => {
        const stored = { zipCode: '68349', city: 'Elmwood', state: 'NE', geocode: '40.84,-96.29', stationId: 'X' };
        localStorageMock.setItem(LocationService.STORAGE_KEY, JSON.stringify(stored));
        
        expect(LocationService.getCityState()).toBe('Elmwood, NE');
    });
});

// ============================================================
// isDefaultLocation()
// ============================================================
describe('isDefaultLocation', () => {
    test('returns true when no stored location', () => {
        expect(LocationService.isDefaultLocation()).toBe(true);
    });

    test('returns false when custom location is stored', () => {
        const stored = { zipCode: '68349', city: 'Elmwood', state: 'NE', geocode: '40.84,-96.29', stationId: 'X', isDefault: false };
        localStorageMock.setItem(LocationService.STORAGE_KEY, JSON.stringify(stored));
        
        expect(LocationService.isDefaultLocation()).toBe(false);
    });
});

// ============================================================
// lookupZipCode()
// ============================================================
describe('lookupZipCode', () => {
    test('returns location for valid ZIP', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                places: [{ 'place name': 'Elmwood', 'state abbreviation': 'NE', latitude: '40.84', longitude: '-96.29' }]
            })
        });

        const result = await LocationService.lookupZipCode('68349');
        
        expect(result).not.toBeNull();
        expect(result.city).toBe('Elmwood');
        expect(result.state).toBe('NE');
        expect(result.geocode).toBe('40.84,-96.29');
        expect(result.zipCode).toBe('68349');
        expect(result.stationId).toBeNull();
        expect(result.isDefault).toBe(false);
    });

    test('returns null for invalid ZIP', async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 404 });

        const result = await LocationService.lookupZipCode('99999');
        expect(result).toBeNull();
    });

    test('returns null on network error', async () => {
        fetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await LocationService.lookupZipCode('68349');
        expect(result).toBeNull();
    });
});

// ============================================================
// lookupStationId()
// ============================================================
describe('lookupStationId', () => {
    test('returns location for valid station ID', async () => {
        // First call: WU API
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                observations: [{
                    stationID: 'KIAEARLH10',
                    neighborhood: 'Earlham',
                    country: 'US',
                    lat: 41.47,
                    lon: -94.03
                }]
            })
        });
        // Second call: Nominatim reverse geocode
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                address: { 'ISO3166-2-lvl4': 'US-IA', state: 'Iowa' }
            })
        });

        const result = await LocationService.lookupStationId('KIAEARLH10', 'test-key');
        
        expect(result).not.toBeNull();
        expect(result.city).toBe('Earlham');
        expect(result.state).toBe('IA');
        expect(result.stationId).toBe('KIAEARLH10');
        expect(result.zipCode).toBeNull();
        expect(result.geocode).toBe('41.47,-94.03');
    });

    test('returns null for invalid station ID', async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 404 });

        const result = await LocationService.lookupStationId('INVALIDXXX', 'test-key');
        expect(result).toBeNull();
    });

    test('returns null when station has no observations', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ observations: [] })
        });

        const result = await LocationService.lookupStationId('EMPTYSTATION', 'test-key');
        expect(result).toBeNull();
    });

    test('still works when reverse geocode fails', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                observations: [{
                    stationID: 'KIAEARLH10',
                    neighborhood: 'Earlham',
                    country: 'US',
                    lat: 41.47,
                    lon: -94.03
                }]
            })
        });
        // Reverse geocode fails
        fetch.mockRejectedValueOnce(new Error('Nominatim down'));

        const result = await LocationService.lookupStationId('KIAEARLH10', 'test-key');
        
        expect(result).not.toBeNull();
        expect(result.city).toBe('Earlham');
        expect(result.state).toBe(''); // empty, not null crash
    });

    test('uses stationID as city when neighborhood is missing', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                observations: [{
                    stationID: 'KXXTEST1',
                    neighborhood: null,
                    country: 'US',
                    lat: 40.0,
                    lon: -90.0
                }]
            })
        });
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ address: { state: 'Illinois' } })
        });

        const result = await LocationService.lookupStationId('KXXTEST1', 'test-key');
        expect(result.city).toBe('KXXTEST1');
    });
});

// ============================================================
// updateLocation() — integration-style unit tests
// ============================================================
describe('updateLocation', () => {
    test('routes station ID input through lookupStationId', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                observations: [{
                    stationID: 'KIAEARLH10', neighborhood: 'Earlham',
                    country: 'US', lat: 41.47, lon: -94.03
                }]
            })
        });
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ address: { 'ISO3166-2-lvl4': 'US-IA' } })
        });

        const result = await LocationService.updateLocation('KIAEARLH10', 'test-key');
        
        expect(result.stationId).toBe('KIAEARLH10');
        expect(result.zipCode).toBeNull();
        // Verify it was saved
        expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    test('routes ZIP input through lookupZipCode + findNearbyStations', async () => {
        // lookupZipCode
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                places: [{ 'place name': 'Winterset', 'state abbreviation': 'IA', latitude: '41.33', longitude: '-94.01' }]
            })
        });
        // findNearbyStations
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                location: { stationId: ['KIAEARLH10'], stationName: ['Earlham'] }
            })
        });
        // Station validation
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                observations: [{ imperial: { temp: 65 } }]
            })
        });

        const result = await LocationService.updateLocation('50273', 'test-key');
        
        expect(result.zipCode).toBe('50273');
        expect(result.stationId).toBe('KIAEARLH10');
    });

    test('returns null for invalid ZIP', async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 404 });

        const result = await LocationService.updateLocation('99999', 'test-key');
        expect(result).toBeNull();
    });

    test('returns null for invalid station ID', async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 404 });

        const result = await LocationService.updateLocation('INVALIDXXX', 'test-key');
        expect(result).toBeNull();
    });

    test('skips offline stations and picks next one', async () => {
        // lookupZipCode
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                places: [{ 'place name': 'Elmwood', 'state abbreviation': 'NE', latitude: '40.84', longitude: '-96.29' }]
            })
        });
        // findNearbyStations returns 2 stations
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                location: { stationId: ['OFFLINE1', 'KNEUNADI9'], stationName: ['Offline', 'Unadilla'] }
            })
        });
        // First station validation — temp is null (offline)
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                observations: [{ imperial: { temp: null } }]
            })
        });
        // Second station validation — has data
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                observations: [{ imperial: { temp: 56 } }]
            })
        });

        const result = await LocationService.updateLocation('68349', 'test-key');
        
        expect(result.stationId).toBe('KNEUNADI9'); // skipped OFFLINE1
    });

    test('ZIP with no nearby stations sets stationId to null', async () => {
        // lookupZipCode
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                places: [{ 'place name': 'Nowhere', 'state abbreviation': 'XX', latitude: '0', longitude: '0' }]
            })
        });
        // findNearbyStations — empty response
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ location: {} })
        });

        const result = await LocationService.updateLocation('00001', 'test-key');
        
        expect(result.stationId).toBeNull();
        expect(result.zipCode).toBe('00001');
    });
});
