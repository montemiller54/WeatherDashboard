/**
 * Location Service for Weather Dashboard
 * Manages user location preferences stored in localStorage
 * Provides geocoding from ZIP code and PWS station lookup
 */

const LocationService = {
    STORAGE_KEY: 'weatherDashboardLocation',
    
    // Known ZIP codes mapped to specific PWS station IDs
    KNOWN_STATIONS: {
        '50273': 'KIAEARLH10',  // Winterset, IA
    },
    
    // Default location (Winterset, IA) - used when no location is stored
    DEFAULT_LOCATION: {
        zipCode: '50273',
        city: 'Winterset',
        state: 'IA',
        geocode: '41.3306,-94.0138',
        stationId: 'KIAEARLH10',
        isDefault: true
    },
    
    /**
     * Get the current location from localStorage, or return default
     * @returns {Object} Location object with zipCode, city, state, geocode, stationId
     */
    getLocation: function() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const location = JSON.parse(stored);
                // Validate that required fields exist
                if (location.zipCode && location.city && location.geocode) {
                    return location;
                }
            }
        } catch (e) {
            console.error('Error reading location from localStorage:', e);
        }
        return this.DEFAULT_LOCATION;
    },
    
    /**
     * Save location to localStorage
     * @param {Object} location - Location object to save
     */
    saveLocation: function(location) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(location));
            return true;
        } catch (e) {
            console.error('Error saving location to localStorage:', e);
            return false;
        }
    },
    
    /**
     * Clear stored location (revert to default)
     */
    clearLocation: function() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            return true;
        } catch (e) {
            console.error('Error clearing location:', e);
            return false;
        }
    },
    
    /**
     * Look up location details from a ZIP code using free geocoding API
     * @param {string} zipCode - 5-digit US ZIP code
     * @returns {Promise<Object>} Location details or null if not found
     */
    lookupZipCode: async function(zipCode) {
        try {
            // Use Zippopotam.us - free, no API key required
            const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
            if (!response.ok) {
                throw new Error('ZIP code not found');
            }
            const data = await response.json();
            
            const place = data.places[0];
            return {
                zipCode: zipCode,
                city: place['place name'],
                state: place['state abbreviation'],
                geocode: `${place.latitude},${place.longitude}`,
                stationId: null,  // Will be looked up separately
                isDefault: false
            };
        } catch (e) {
            console.error('Error looking up ZIP code:', e);
            return null;
        }
    },
    
    /**
     * Find nearby Personal Weather Stations (PWS) for a geocode
     * Uses Weather.com API to search for stations
     * @param {string} geocode - "lat,lon" format
     * @param {string} apiKey - Weather.com API key
     * @returns {Promise<Array>} Array of nearby stations, sorted by distance
     */
    findNearbyStations: async function(geocode, apiKey) {
        try {
            // Weather.com PWS search by geocode - search within 25 miles
            const url = `https://api.weather.com/v2/pws/observations/all?numericPrecision=decimal&stationId=nearby:${geocode}&format=json&units=e&apiKey=${apiKey}`;
            
            // Alternative approach: use the station locator
            const locatorUrl = `https://api.weather.com/v3/location/near?geocode=${geocode}&product=pws&format=json&apiKey=${apiKey}`;
            
            // Try the location near API first
            let response = await fetch(locatorUrl);
            
            if (response.ok) {
                const data = await response.json();
                if (data.location && data.location.stationId) {
                    // Return array of stations
                    const stations = [];
                    for (let i = 0; i < data.location.stationId.length && i < 5; i++) {
                        stations.push({
                            stationId: data.location.stationId[i],
                            stationName: data.location.stationName ? data.location.stationName[i] : null,
                            distance: data.location.distanceMi ? data.location.distanceMi[i] : null
                        });
                    }
                    return stations;
                }
            }
            
            // If that doesn't work, try an alternative approach
            // Search for observations using geocode
            const searchUrl = `https://api.weather.com/v2/pws/observations/current?stationId=pws:nearest&geocode=${geocode}&format=json&units=e&apiKey=${apiKey}`;
            response = await fetch(searchUrl);
            
            if (response.ok) {
                const data = await response.json();
                if (data.observations && data.observations.length > 0) {
                    return data.observations.map(obs => ({
                        stationId: obs.stationID,
                        stationName: obs.neighborhood || obs.stationID,
                        distance: null
                    }));
                }
            }
            
            return [];
        } catch (e) {
            console.error('Error finding nearby stations:', e);
            return [];
        }
    },
    
    /**
     * Full location update: lookup ZIP, find stations, and save
     * @param {string} zipCode - 5-digit US ZIP code
     * @param {string} apiKey - Weather.com API key for station lookup
     * @returns {Promise<Object>} Complete location object or null on failure
     */
    updateLocation: async function(zipCode, apiKey) {
        // First, look up the ZIP code
        const location = await this.lookupZipCode(zipCode);
        if (!location) {
            return null;
        }
        
        // Check if this ZIP has a known station ID
        if (this.KNOWN_STATIONS[zipCode]) {
            location.stationId = this.KNOWN_STATIONS[zipCode];
        } else if (apiKey) {
            // Try to find nearby PWS stations
            try {
                const stations = await this.findNearbyStations(location.geocode, apiKey);
                if (stations && stations.length > 0) {
                    location.stationId = stations[0].stationId;
                    location.nearbyStations = stations;
                }
            } catch (e) {
                console.warn('Could not find nearby PWS, will use default observations:', e);
            }
        }
        
        // Save the location
        this.saveLocation(location);
        
        return location;
    },
    
    /**
     * Check if current location is the default
     * @returns {boolean}
     */
    isDefaultLocation: function() {
        const location = this.getLocation();
        return location.isDefault === true;
    },
    
    /**
     * Get individual location properties (for backward compatibility with CONFIG)
     */
    getGeocode: function() {
        return this.getLocation().geocode;
    },
    
    getZipCode: function() {
        return this.getLocation().zipCode;
    },
    
    getStationId: function() {
        return this.getLocation().stationId || CONFIG.STATION_ID;
    },
    
    getCityState: function() {
        const loc = this.getLocation();
        return `${loc.city}, ${loc.state}`;
    }
};

// Make it available globally
window.LocationService = LocationService;
