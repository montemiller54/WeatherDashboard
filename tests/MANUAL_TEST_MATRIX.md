# Weather Dashboard — Manual Test Matrix

A structured checklist for manual verification after changes.

## 1. First-Time Visitor (no localStorage)
- [ ] Open MainDashboard.html in incognito → shows Winterset, IA
- [ ] Temperature circle displays a number
- [ ] Wind, Humidity, Rainfall, Almanac cards all render
- [ ] Radar button visible and clickable

## 2. ZIP Code Entry
- [ ] Click city name → modal opens with "Change Location"
- [ ] Type `68349` → preview shows "Elmwood, NE"
- [ ] Click Save → dashboard updates to Elmwood data
- [ ] Reload page → still shows Elmwood (localStorage persisted)
- [ ] Temperature, wind, humidity, almanac update to Elmwood data

## 3. Station ID Entry
- [ ] Click city name → modal opens
- [ ] Type `KIAEARLH10` → preview shows "Earlham, IA"
- [ ] Click Save → dashboard updates to Earlham data
- [ ] PWS data (temp, wind, humidity) populates from station
- [ ] Rainfall card shows PWS data (not Open-Meteo fallback)

## 4. Invalid Inputs
- [ ] Enter `00000` → error message appears, Save disabled
- [ ] Enter `INVALIDXXX` → error message appears, Save disabled
- [ ] Enter `abc` (too short) → no preview, Save disabled
- [ ] Enter special characters → no crash

## 5. Offline Station Handling
- [ ] Enter ZIP for area with offline stations → dashboard still loads
- [ ] Skips offline stations, picks first with live data
- [ ] If all stations offline → rainfall falls back to Open-Meteo

## 6. Navigation
- [ ] Click Radar button → RadarMap.html loads
- [ ] Radar map displays with tiles
- [ ] Play/pause controls work, timestamps update
- [ ] Back button → returns to MainDashboard.html
- [ ] Click Rainfall card → RainfallHistory.html with chart
- [ ] Click Almanac card → Almanac.html loads
- [ ] Click main area → DetailGraphs.html loads
- [ ] Browser back button works from all sub-pages

## 7. RadarMap Specific
- [ ] Map centered on current location
- [ ] Radar tiles animate (not frozen)
- [ ] No redirect loop (stays on RadarMap.html)
- [ ] Zoom in/out works
- [ ] Step forward/backward buttons work

## 8. Data Accuracy Spot Checks
- [ ] Compare dashboard temp to weather.com PWS page
- [ ] Compare wind speed/direction to weather.com
- [ ] Verify sunrise/sunset times against known sources
- [ ] Check almanac normal highs/lows against historical data
- [ ] Rainfall totals match station data

## 9. Responsive / Visual
- [ ] Dashboard renders on mobile viewport (375px)
- [ ] Dashboard renders on tablet (768px)
- [ ] Dashboard renders on desktop (1440px)
- [ ] No horizontal scrolling
- [ ] Temp circle text is readable at all sizes
- [ ] Modal is usable on mobile

## 10. Error Recovery
- [ ] Disable network → page shows graceful fallback (no blank screen)
- [ ] Re-enable network → refresh loads data
- [ ] API rate limit → page degrades gracefully
- [ ] Clear localStorage → page reverts to Winterset default

## 11. Cross-Page Location Consistency
- [ ] Change location on MainDashboard → DetailGraphs uses same location
- [ ] Change location → Almanac uses same location
- [ ] Change location → RainfallHistory uses same location
- [ ] Change location → RadarMap centers on new location
