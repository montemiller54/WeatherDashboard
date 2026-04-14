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
            const [lat, lon] = CONFIG.GEOCODE.split(',');
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
    /* NEW CODE – Merge Meteo + Tomorrow.io based on timestamps      */
    /* ────────────────────────────────────────────────────────────── */

    const tomorrowURL = `https://api.tomorrow.io/v4/weather/forecast?location=${CONFIG.GEOCODE}&units=imperial&apikey=HiYrUjVOfZTBmZzyP1rf9st7ZfDdIBnZ`;

    try {
        const response = await fetch(tomorrowURL);
        const result = await response.json();
        const hourlyData = result.timelines.hourly;

        // Normalize Tomorrow.io timestamps to local hour
        const tmrDataMap = {};
        for (const point of hourlyData) {
            const localTime = luxon.DateTime
                .fromISO(point.time, { zone: 'utc' })         // parse UTC
                .setZone('local')                             // convert to local time
                .toFormat("yyyy-MM-dd'T'HH:00");              // truncate to hour
            tmrDataMap[localTime] = {
                temp: point.values.temperature,
                pop: point.values.precipitationProbability
            };
        }

        const now = luxon.DateTime.now().setZone('local');

        for (let i = 0; i < timeValues.length; i++) {
            const ts = timeValues[i];
            const tsLocal = luxon.DateTime.fromISO(ts, { zone: 'local' });
            const isFuture = tsLocal > now;

            const roundedTs = tsLocal.toFormat("yyyy-MM-dd'T'HH:00");

            if (isFuture && tmrDataMap[roundedTs]) {
                tempFValues[i] = tmrDataMap[roundedTs].temp;
                probPrecipValues[i] = tmrDataMap[roundedTs].pop;
            }
        }

    } catch (err) {
        console.error("Failed to fetch Tomorrow.io data → continuing with Open-Meteo only", err);
    }




    /* ────────────────────────────────────────────────────────────── */


    /* ────────────────────────────────────────────────────────────── */
    /* NEW CODE – Weather Underground daily forecast (days 0-4)     */
    /* Icons saved locally in Images/TWC-icons/icon_###.png          */
    const wuURL =
        `https://api.weather.com/v3/wx/forecast/daily/5day`
        + `?geocode=${CONFIG.GEOCODE}&units=e&language=en-US`
        + `&format=json&apiKey=${CONFIG.WEATHER_COM_API_KEY}`;

    try {
        const wu = await fetch(wuURL).then(r => r.json());
        console.log("Raw icon codes = " + wu.daypart[0].iconCode);
        console.log("Raw dayornight = " + wu.daypart[0].dayOrNight);
        for (let i = 0; i < 5; i++) {       // overwrite days 0-4
            // Only overwrite if Weather.com returns a valid value (not null)
            if (wu.temperatureMax[i] != null) {
                dailyMax[i] = wu.temperatureMax[i];
            }
            if (wu.temperatureMin[i] != null) {
                dailyMin[i] = wu.temperatureMin[i];
            }
            dailyPrecip[i] = (wu.qpf[i] || 0) + (wu.qpfSnow[i] || 0);   // qpf+snow

            // --- revised daytime-icon selection -------------------------
            const daypart = wu.daypart[0];

            // 1) find the FIRST index that is truly daytime ("D")
            const firstDayIdx = daypart.dayOrNight.findIndex(flag => flag === "D");   // e.g. 2

            // safety: if not found, default to 0
            const base = firstDayIdx >= 0 ? firstDayIdx : 0;

            // 2) pick the daytime slot for this day: base + 2*i
            const dIndex   = base + 2 * i;               // i = 0 → base, i = 1 → base+2, etc.
            let iconCode   = daypart.iconCode[dIndex];

            // fallback if iconCode is null / undefined
            if (iconCode == null) iconCode = 34;         // 34 = mostly sunny

            weatherCodes[i] = iconCode;
            // ------------------------------------------------------------

        }
    } catch (err) {
        console.error('WU fetch failed → falling back to Open-Meteo only', err);
    }
    /* ────────────────────────────────────────────────────────────── */

    console.log("weatherCodes array = " + weatherCodes);

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
        
        // Fallback for missing icon files - map to similar icons that exist
        const iconFallbacks = {
            9: 11,   // Drizzle → Light Rain
            8: 10,   // Freezing Drizzle → Freezing Rain
            18: 14,  // Sleet → Snow
            20: 26,  // Fog → Cloudy
        };
        if (iconFallbacks[iconCode]) {
            iconCode = iconFallbacks[iconCode];
        }
        
        console.log(`Day ${i}: iconCode = ${iconCode}, file = TWC-icons/icon_${iconCode}.png`);
        const iconFile = `TWC-icons/icon_${iconCode}.png`;
        //console.log("Icon = icon_" + ${code} + ".png" );
        // You can enhance this by dynamically assigning icons later
        //const icon = 'Images/SunnyIcon.png'; // Placeholder

        daySummaries[i].innerHTML = `
        <div style="font-size: 1.5vh; color: #a3a3a3;">${date}</div>
<img src="${iconFile}" alt="weather icon for code ${iconCode}" style="width: 6vh; height: auto;">
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

    // Convert data into { x, y } pairs
    const precipDataset = timeValues.map((ts, i) => ({
        x: ts,
        y: probPrecipValues[i]  // ← actual 0–100 precipitation values
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
                    tension: 0.1,
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

