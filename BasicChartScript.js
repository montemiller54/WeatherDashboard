// BasicChartScript.js

document.addEventListener('DOMContentLoaded', async function () {
    // Get the canvas context
    const ctx = document.getElementById('myLineChart').getContext('2d');

    // Calculate font scale factor based on viewport height
    const fontScaleFactor = window.innerHeight / 500;
    const axisTitleFontSize = Math.max(12, Math.min(20, 20 * fontScaleFactor * 0.5));
    const axisTickFontSize = Math.max(10, Math.min(14, 14 * fontScaleFactor * 0.5));

    // WMO weather code to TWC icon code mapping
    // https://open-meteo.com/en/docs (WMO codes)
    // TWC icons: https://weather.com/swagger-docs/ui/sun/v3/sunV3DailyForecast
    const wmoToTwcIcon = {
        0: 32,   // Clear sky → Sunny
        1: 34,   // Mainly clear → Mostly Sunny
        2: 30,   // Partly cloudy → Partly Cloudy
        3: 26,   // Overcast → Cloudy
        45: 20,  // Fog → Fog
        48: 20,  // Depositing rime fog → Fog
        51: 9,   // Light drizzle → Drizzle
        53: 9,   // Moderate drizzle → Drizzle
        55: 9,   // Dense drizzle → Drizzle
        56: 8,   // Light freezing drizzle → Freezing Drizzle
        57: 8,   // Dense freezing drizzle → Freezing Drizzle
        61: 11,  // Slight rain → Light Rain
        63: 12,  // Moderate rain → Rain
        65: 40,  // Heavy rain → Heavy Rain
        66: 10,  // Light freezing rain → Freezing Rain
        67: 10,  // Heavy freezing rain → Freezing Rain
        71: 13,  // Slight snow → Light Snow
        73: 14,  // Moderate snow → Snow
        75: 16,  // Heavy snow → Heavy Snow
        77: 18,  // Snow grains → Sleet
        80: 39,  // Slight rain showers → Scattered Showers
        81: 39,  // Moderate rain showers → Scattered Showers
        82: 40,  // Violent rain showers → Heavy Rain
        85: 41,  // Slight snow showers → Snow Showers
        86: 42,  // Heavy snow showers → Heavy Snow
        95: 47,  // Thunderstorm → Scattered Thunderstorms
        96: 47,  // Thunderstorm with slight hail → Thunderstorms
        99: 47   // Thunderstorm with heavy hail → Thunderstorms
    };

    async function getTemperature() {
        try {
            // Use LocationService if available, otherwise fall back to CONFIG
            const geocode = (typeof LocationService !== 'undefined') ? LocationService.getGeocode() : CONFIG.GEOCODE;
            const [lat, lon] = geocode.split(',');
            const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&hourly=temperature_2m,precipitation_probability,is_day&timezone=auto&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch`);
            const result = await response.json();

            return {
                timeValues: result.hourly.time,
                tempFValues: result.hourly.temperature_2m,
                probPrecipValues: result.hourly.precipitation_probability,
                isDayValues: result.hourly.is_day,
                dailyMax: result.daily.temperature_2m_max,
                dailyMin: result.daily.temperature_2m_min,
                dailyPrecip: result.daily.precipitation_sum,
                dailyTime: result.daily.time,
                weatherCodes: result.daily.weather_code
            };
        } catch (error) {
            console.error("Error fetching temperature:", error);
        }
    }

    const { timeValues, tempFValues, probPrecipValues, isDayValues, dailyMax, dailyMin, dailyPrecip, dailyTime, weatherCodes } = await getTemperature();

    /* ────────────────────────────────────────────────────────────── */
    /* NWS overlay – replace temperature + PoP with MOS-corrected   */
    /* forecasts from api.weather.gov (US only, no key required)    */
    /* ────────────────────────────────────────────────────────────── */
    try {
        const geocodeNWS = (typeof LocationService !== 'undefined') ? LocationService.getGeocode() : CONFIG.GEOCODE;
        const [nwsLat, nwsLon] = geocodeNWS.split(',');

        // Step 1: resolve lat/lon to NWS grid point
        const pointsResp = await fetch(`https://api.weather.gov/points/${nwsLat},${nwsLon}`);
        const pointsData = await pointsResp.json();
        const hourlyUrl  = pointsData.properties.forecastHourly;

        // Step 2: fetch hourly forecast
        const hourlyResp = await fetch(hourlyUrl);
        const hourlyData = await hourlyResp.json();
        const periods    = hourlyData.properties.periods;

        // Build lookup keyed by "YYYY-MM-DDTHH:00" (matches Open-Meteo's local-time format)
        const nwsMap = {};
        for (const period of periods) {
            const hourKey = period.startTime.substring(0, 16); // trim offset
            nwsMap[hourKey] = {
                temp: period.temperature,                              // already °F
                pop:  period.probabilityOfPrecipitation?.value ?? 0
            };
        }

        // Overwrite Open-Meteo values where NWS has data
        for (let i = 0; i < timeValues.length; i++) {
            if (nwsMap[timeValues[i]]) {
                tempFValues[i]      = nwsMap[timeValues[i]].temp;
                probPrecipValues[i] = nwsMap[timeValues[i]].pop;
            }
        }
    } catch (err) {
        console.error('NWS overlay failed → keeping Open-Meteo data', err);
    }
    /* ────────────────────────────────────────────────────────────── */


    /* Calculate daily highs/lows from actual hourly data            */
    /* This ensures headers match the plotted temperature line       */
    /* ────────────────────────────────────────────────────────────── */
    
    // Group hourly temps by weather day (5am-to-5am).
    // Hours 0-4 (midnight–4am) belong to the previous calendar day.
    const dailyTemps = {};
    for (let i = 0; i < timeValues.length; i++) {
        const ts = luxon.DateTime.fromISO(timeValues[i]);
        const weatherDay = ts.hour < 5
            ? ts.minus({ days: 1 }).toISODate()
            : ts.toISODate();
        if (!dailyTemps[weatherDay]) {
            dailyTemps[weatherDay] = [];
        }
        dailyTemps[weatherDay].push(tempFValues[i]);
    }
    
    // Update dailyMax and dailyMin from the actual hourly data
    for (let i = 0; i < dailyTime.length; i++) {
        const dateKey = dailyTime[i];
        if (dailyTemps[dateKey] && dailyTemps[dateKey].length > 0) {
            dailyMax[i] = Math.max(...dailyTemps[dateKey]);
            dailyMin[i] = Math.min(...dailyTemps[dateKey]);
        }
    }

    /* ────────────────────────────────────────────────────────────── */


    /* ────────────────────────────────────────────────────────────── */
    /* Weather Underground daily forecast (days 0-4) - icons only   */
    /* Icons saved locally in Images/TWC-icons/icon_###.png          */
    // Use LocationService if available, otherwise fall back to CONFIG
    const geocodeForWU = (typeof LocationService !== 'undefined') ? LocationService.getGeocode() : CONFIG.GEOCODE;
    const wuURL =
        `https://api.weather.com/v3/wx/forecast/daily/5day`
        + `?geocode=${geocodeForWU}&units=e&language=en-US`
        + `&format=json&apiKey=${CONFIG.WEATHER_COM_API_KEY}`;

    try {
        const wu = await fetch(wuURL).then(r => r.json());

        const daypart = wu.daypart[0];

        // Find the first true daytime ("D") slot.
        // If today's daytime has already passed, WU omits/nulls index 0,
        // so firstDayIdx will be 2 (= tomorrow). dayShift is how many
        // calendar days ahead that first "D" slot is vs. Open-Meteo day 0.
        const firstDayIdx = daypart.dayOrNight.findIndex(flag => flag === "D");
        const base = firstDayIdx >= 0 ? firstDayIdx : 0;
        const dayShift = Math.floor(base / 2);  // 0 = today has daytime, 1 = today's daytime has passed

        for (let i = 0; i < 5; i++) {       // overwrite days 0-4
            // Precipitation: WU daily arrays are always today=0, no shift needed
            dailyPrecip[i] = (wu.qpf[i] || 0) + (wu.qpfSnow[i] || 0);

            // Map Open-Meteo day i to the correct WU daypart index
            const wuDayIdx = i - dayShift;
            if (wuDayIdx < 0) {
                // Today's daytime has already passed — WU has no daytime icon for it.
                // Leave weatherCodes[i] as the Open-Meteo WMO-based value.
                continue;
            }

            const dIndex = base + 2 * wuDayIdx;
            let iconCode = daypart.iconCode[dIndex];
            if (iconCode == null) iconCode = 34;  // fallback: mostly sunny
            weatherCodes[i] = iconCode;

        }
    } catch (err) {
        console.error('WU fetch failed → falling back to Open-Meteo only', err);
    }
    /* ────────────────────────────────────────────────────────────── */

    // Export daily data globally so other components can use it
    window.chartDailyData = {
        dailyMax: dailyMax,
        dailyMin: dailyMin,
        dailyTime: dailyTime,
        dailyPrecip: dailyPrecip,
        weatherCodes: weatherCodes
    };
    // Dispatch event to notify other components that data is ready
    window.dispatchEvent(new CustomEvent('chartDataReady'));

    const daySummaries = document.querySelectorAll('.day-summary');

    for (let i = 0; i < daySummaries.length; i++) {
        const date = luxon.DateTime.fromISO(dailyTime[i]).toFormat('ccc d');
        const high = Math.round(dailyMax[i]);
        const low = Math.round(dailyMin[i]);
        const precipRaw = dailyPrecip[i]; // now qpf+qpfSnow for i<5
        const precip = precipRaw === 0 ? '0' : precipRaw.toFixed(2);

        let iconCode;
        if (i < 5) {
            // Days 0-4: Use TWC icon codes from Weather.com
            iconCode = weatherCodes[i];
        } else {
            // Days 5-6: Convert WMO code to TWC icon code
            const wmoCode = weatherCodes[i];
            iconCode = wmoToTwcIcon[wmoCode];
            if (iconCode === undefined) {
                console.log(`Day ${i}: WMO code ${wmoCode} not found in mapping, using default`);
                iconCode = 34; // Default to mostly sunny
            }
        }
        
        // Fallback for missing icon files - map to similar icons that exist.
        // Codes 1 & 2 (hurricane/tropical storm) have no file → use 04 (thunderstorms).
        // Code 45 (thundershowers) has no file → use 47.
        const iconFallbacks = {
            1:  4,   // Tropical Storm / Hurricane → Thunderstorms
            2:  3,   // Hurricane → Severe Thunderstorms
            8: 10,   // Freezing Drizzle → Freezing Rain
            9: 11,   // Drizzle → Light Rain
            18: 14,  // Sleet → Snow
            20: 26,  // Fog → Cloudy
            45: 47,  // Thundershowers → Scattered Thunderstorms
        };
        if (iconFallbacks[iconCode] !== undefined) {
            iconCode = iconFallbacks[iconCode];
        }

        // All icon files use 2-digit zero-padded names (icon_00.png … icon_47.png).
        const paddedCode = String(iconCode).padStart(2, '0');
        const iconFile = `TWC-icons/icon_${paddedCode}.png`;

        daySummaries[i].innerHTML = `
        <div style="font-size: 1.5vh; color: #a3a3a3;">${date}</div>
<img src="${iconFile}" alt="weather icon" onerror="this.src='TWC-icons/icon_34.png'" style="width: 6vh; height: auto;">
<div style="font-size: 1.8vh;">
    <span style="color:red;">${high}°</span>
    <span style="color:gray;"> | </span>
    <span style="color:rgba(75, 75, 255, 1);">${low}°</span>
</div>

        <div style="font-size: 1.5vh; color: rgba(150, 150, 230, 1);">${precip} in</div>
    `;
    }


    // Apply a 5-hour moving average to smooth the temperature data
    function movingAverage(arr, windowSize) {
        const result = [];
        const halfWindow = Math.floor(windowSize / 2);
        for (let i = 0; i < arr.length; i++) {
            let sum = 0;
            let count = 0;
            for (let j = i - halfWindow; j <= i + halfWindow; j++) {
                if (j >= 0 && j < arr.length && arr[j] != null) {
                    sum += arr[j];
                    count++;
                }
            }
            result.push(count > 0 ? sum / count : arr[i]);
        }
        return result;
    }

    const smoothedTempValues = movingAverage(tempFValues, 5);  // 5-hour moving average
    const smoothedPrecipValues = movingAverage(probPrecipValues, 7);  // 7-hour moving average

    // Convert data into { x, y } pairs
    const precipDataset = timeValues.map((ts, i) => ({
        x: ts,
        y: smoothedPrecipValues[i]
    }));

    const tempDataset = timeValues.map((ts, i) => ({
        x: ts,
        y: smoothedTempValues[i]  // ← smoothed temperature values (°F)
    }));

    const isdayDataset = timeValues.map((ts, i) => ({
        x: ts,
        y: isDayValues[i]       // ← actual temperature values (°F)
    }));

    // Current time for "now" line
    const nowTime = luxon.DateTime.now().setZone('local').toISO();

    //added this to force it to draw a line on the right side of the chart
    Chart.register({
        id: 'rightBorderLine',
        afterDraw(chart) {
            const ctx = chart.ctx;
            const chartArea = chart.chartArea;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(chartArea.right, chartArea.top);
            ctx.lineTo(chartArea.right, chartArea.bottom);
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#555555'; // ← match your grid color
            ctx.stroke();
            ctx.restore();
        }
    });


    const myLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                /* is_day shading first (back) */
                {
                    data: isdayDataset,
                    borderWidth: 0,
                    pointRadius: 0,
                    borderColor: 'rgba(0, 0, 0, 1)',
                    backgroundColor: 'rgba(255, 255, 255, .08)',
                    fill: true,
                    yAxisID: 'y-axis-3',
                    order: 0
                },

                /* precipitation second (middle layer) */
                {
                    label: 'Chance of Precip',
                    data: precipDataset,
                    backgroundColor: 'rgba(50, 50, 200, 0.4)',
                    borderColor: 'rgba(50, 50, 200, 0.1)',
                    fill: true,
                    yAxisID: 'y-axis-2',
                    tension: 0.4,
                    cubicInterpolationMode: 'monotone',
                    order: 1
                },

                /* temperature last (front) */
                {
                    label: 'Temperature',
                    data: tempDataset,
                    borderColor: 'rgba(175, 17, 46, 1)',
                    yAxisID: 'y-axis-1',
                    tension: 0.4,
                    cubicInterpolationMode: 'monotone',
                    order: 2
                }
            ]
        },
        options: {
            font: {
                family: 'Calibri, sans-serif'
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        tooltipFormat: 'ccc ha',
                    },
                    ticks: {
                        display: false,
                    },
                    grid: {
                        color: '#555555', // dark grey
                        borderColor: '#555555',
                        drawBorder: true,
                        drawTicks: true
                    },
                    position: 'top',
                },
                'y-axis-1': {
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Temperature',
                        color: 'red',
                        font: {
                            size: axisTitleFontSize
                        }
                    },
                    grid: {
                        color: '#555555', // dark grey
                    },
                    ticks: {
                        color: 'red',
                        stepSize: 10,
                        font: {
                            size: axisTickFontSize
                        },
                        callback: function(value) {
                            return value + '°';
                        }
                    },
                },

                'y-axis-2': {
                    beginAtZero: true,
                    position: 'right',
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Chance of Precip (%)',
                        color: 'rgba(75, 75, 250, 1)',
                        font: {
                            size: axisTitleFontSize
                        }
                    },
                    grid: {
                        drawOnChartArea: false
                    },
                    ticks: {
                        color: 'rgba(75, 75, 250, 1)',
                        stepSize: 20,
                        font: {
                            size: axisTickFontSize
                        },
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },



                'y-axis-3': {
                    beginAtZero: true,
                    position: 'right',
                    min: 0,
                    max: 1,
                    title: {
                        display: false,
                        text: 'Chance of Precip (%)',
                        color: 'white',
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                    ticks: {
                        display: false, // 👈 Hides the numbers
                    },
                },
            },
            plugins: {
                annotation: {
                    annotations: {
                        freezingLine: {
                            type: 'line',
                            yMin: 32,
                            yMax: 32,
                            yScaleID: 'y-axis-1',
                            borderColor: 'white',
                            borderWidth: 1,
                            borderDash: [5, 5],
                            drawTime: 'beforeDatasetsDraw'
                        },
                        nowLine: {
                            type: 'line',
                            xMin: nowTime,
                            xMax: nowTime,
                            borderColor: 'rgba(255, 255, 255, 0.8)',
                            borderWidth: 2,
                            drawTime: 'afterDatasetsDraw'
                        }
                    }
                },
                legend: {
                    display: false,
                    position: 'top',
                    labels: {
                        color: 'white',
                    },
                },
                title: {
                    display: false,
                    text: '7 Day Forecast',
                    color: 'white',
                },
            },
            elements: {
                point: {
                    radius: 0,
                },
            },
            maintainAspectRatio: false,
            responsive: true,
            layout: {
                padding: {
                    top: 0,
                    right: 20,
                    bottom: 20,
                    left: 20,
                },
            },
        }
    });

    // Align day summary header with chart area after chart renders
    function alignDaySummary() {
        const chartArea = myLineChart.chartArea;
        const canvas = document.getElementById('myLineChart');
        const daySummaryInner = document.querySelector('.day-summary-inner');
        if (chartArea && daySummaryInner) {
            // chartArea.left is the pixel offset from the left edge of canvas to the plot area
            // chartArea.right is the pixel offset from left edge to the right side of plot area
            const rightMargin = canvas.offsetWidth - chartArea.right;
            daySummaryInner.style.marginLeft = chartArea.left + 'px';
            daySummaryInner.style.marginRight = rightMargin + 'px';
        }
    }

    // Initial alignment after chart renders
    setTimeout(alignDaySummary, 100);

    // Re-align on window resize
    window.addEventListener('resize', () => {
        setTimeout(alignDaySummary, 100);
    });
});

