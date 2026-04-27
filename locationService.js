/**
 * Location Service for Weather Dashboard
 * Manages user location preferences stored in localStorage
 * Provides geocoding from ZIP code and PWS station lookup
 */

const LocationService = {
    STORAGE_KEY: 'weatherDashboardLocation',
    
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
     * Check if input looks like a WU station ID (starts with letter, 6+ alphanumeric chars)
     */
    isStationId: function(input) {
        return /^[A-Za-z][A-Za-z0-9]{5,}$/.test(input);
    },
    
    /**
     * Get the current location from localStorage, or return default
     * @returns {Object} Location object with zipCode, city, state, geocode, stationId
     */
    getLocation: function() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const loc = JSON.parse(stored);
                // Validate that required fields exist
                if ((loc.zipCode || loc.stationId) && loc.city && loc.geocode) {
                    return loc;
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
     * Look up a WU station ID by making a test API call
     * Returns location info if valid, null if invalid
     * @param {string} stationId - WU station ID
     * @param {string} apiKey - Weather.com API key
     * @returns {Promise<Object>} Location details or null
     */
    lookupStationId: async function(stationId, apiKey) {
        try {
            const url = `https://api.weather.com/v2/pws/observations/current?stationId=${encodeURIComponent(stationId)}&format=json&units=e&numericPrecision=decimal&apiKey=${apiKey}`;
            const response = await fetch(url);
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            if (!data.observations || data.observations.length === 0) {
                return null;
            }
            const obs = data.observations[0];
            
            // Reverse geocode to get state from lat/lon
            let state = '';
            try {
                const geoUrl = `https://api.zippopotam.us/us/${obs.lat.toFixed(2)}/${obs.lon.toFixed(2)}`;
                // Use nominatim for reverse geocoding
                const revUrl = `https://nominatim.openstreetmap.org/reverse?lat=${obs.lat}&lon=${obs.lon}&format=json&zoom=10`;
                const revResponse = await fetch(revUrl);
                if (revResponse.ok) {
                    const revData = await revResponse.json();
                    if (revData.address) {
                        state = revData.address['ISO3166-2-lvl4'] ? revData.address['ISO3166-2-lvl4'].replace('US-', '') : (revData.address.state || '');
                    }
                }
            } catch (e) {
                console.warn('Reverse geocode failed:', e);
            }
            
            return {
                zipCode: null,
                city: obs.neighborhood || obs.stationID,
                state: state,
                geocode: `${obs.lat},${obs.lon}`,
                stationId: obs.stationID,
                isDefault: false
            };
        } catch (e) {
            console.error('Error looking up station ID:', e);
            return null;
        }
    },

    /**
     * Full location update: handles both ZIP codes and station IDs
     * @param {string} input - 5-digit ZIP code or WU station ID
     * @param {string} apiKey - Weather.com API key
     * @returns {Promise<Object>} Complete location object or null on failure
     */
    updateLocation: async function(input, apiKey) {
        let location;
        
        if (this.isStationId(input)) {
            // Station ID path
            location = await this.lookupStationId(input, apiKey);
            if (!location) {
                return null;
            }
        } else {
            // ZIP code path
            location = await this.lookupZipCode(input);
            if (!location) {
                return null;
            }
            
            // Find nearby PWS for the ZIP, picking the first one with live data
            if (apiKey) {
                try {
                    const stations = await this.findNearbyStations(location.geocode, apiKey);
                    if (stations && stations.length > 0) {
                        // Try each station until we find one reporting data
                        for (let i = 0; i < stations.length; i++) {
                            const testUrl = `https://api.weather.com/v2/pws/observations/current?stationId=${encodeURIComponent(stations[i].stationId)}&format=json&units=e&numericPrecision=decimal&apiKey=${apiKey}`;
                            try {
                                const resp = await fetch(testUrl);
                                if (resp.ok) {
                                    const testData = await resp.json();
                                    if (testData.observations && testData.observations[0] && testData.observations[0].imperial.temp !== null) {
                                        location.stationId = stations[i].stationId;
                                        location.nearbyStations = stations;
                                        break;
                                    }
                                }
                            } catch (e) {
                                continue;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Could not find nearby PWS:', e);
                }
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
        return this.getLocation().stationId || null;
    },
    
    getCityState: function() {
        const loc = this.getLocation();
        return `${loc.city}, ${loc.state}`;
    }
};

// Make it available globally
window.LocationService = LocationService;
