/**
 * Configuration file for Weather Dashboard
 * Keep this file secure - it contains API keys
 * 
 * To update API keys, modify the values below
 */

const CONFIG = {
    // Weather.com API key (for PWS observations and forecasts)
    WEATHER_COM_API_KEY: "97745ce68772479fb45ce68772379f8e",
    
    // World Weather Online API key (for astronomy and feels-like data)
    WORLD_WEATHER_API_KEY: "1471a1de0d764bc8aa1210023191412",
    
    // Visual Crossing API key (for historical climate normals)
    VISUAL_CROSSING_API_KEY: "SSDTQWZ4N8BUA5KNVXFAJN965",
    
    // Weather station ID
    //STATION_ID: "KIAEARLH10", // Des Moines, IA
    //STATION_ID: "KAKFAIRB396", // Fairbanks, AK
    STATION_ID: "KNEELMWO8", // Elmwood, NE

    // Location geocode (latitude, longitude)
    //GEOCODE: "41.47,-94.02", // Des Moines, IA
    //GEOCODE: "64.81,-147.82", // Fairbanks, AK
    GEOCODE: "40.84,-96.29", // Elmwood, NE
    
    // Zip code for World Weather Online
    //ZIP_CODE: "50069" // Des Moines, IA
    //ZIP_CODE: "99709" // Fairbanks, AK
    ZIP_CODE: "68349" // Elmwood, NE
};
