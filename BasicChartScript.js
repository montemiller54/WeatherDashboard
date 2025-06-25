// BasicChartScript.js

document.addEventListener('DOMContentLoaded', async function () {
    // Get the canvas context
    const ctx = document.getElementById('myLineChart').getContext('2d');


    async function getTemperature() {
        try {
            const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=41.475414&longitude=-94.02929&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&hourly=temperature_2m,precipitation_probability,is_day&timezone=America%2FChicago&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch");
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

    const tomorrowURL = "https://api.tomorrow.io/v4/weather/forecast?location=41.47,-94.02&units=imperial&apikey=HiYrUjVOfZTBmZzyP1rf9st7ZfDdIBnZ";

    try {
        const response = await fetch(tomorrowURL);
        const result = await response.json();
        const hourlyData = result.timelines.hourly;

        // Normalize Tomorrow.io timestamps → America/Chicago local hour
        const tmrDataMap = {};
        for (const point of hourlyData) {
            const localTime = luxon.DateTime
                .fromISO(point.time, { zone: 'utc' })         // parse UTC
                .setZone('America/Chicago')                   // convert to local time
                .toFormat("yyyy-MM-dd'T'HH:00");              // truncate to hour
            tmrDataMap[localTime] = {
                temp: point.values.temperature,
                pop: point.values.precipitationProbability
            };
        }

        const now = luxon.DateTime.now().setZone('America/Chicago');

        for (let i = 0; i < timeValues.length; i++) {
            const ts = timeValues[i];
            const tsLocal = luxon.DateTime.fromISO(ts, { zone: 'America/Chicago' });
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
        + `?geocode=41.67,-93.72&units=e&language=en-US`
        + `&format=json&apiKey=97745ce68772479fb45ce68772379f8e`;

    try {
        const wu = await fetch(wuURL).then(r => r.json());
        console.log("Raw icon codes = " + wu.daypart[0].iconCode);
        console.log("Raw dayornight = " + wu.daypart[0].dayOrNight);
        for (let i = 0; i < 5; i++) {       // overwrite days 0-4
            dailyMax[i]    = wu.temperatureMax[i];
            dailyMin[i]    = wu.temperatureMin[i];
            dailyPrecip[i] = wu.qpf[i] + wu.qpfSnow[i];   // qpf+snow

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

        const code = weatherCodes[i];
        // WU icons for days 0-4, placeholder default for 5-6 (can fix later)
        const iconFile = i < 5
        ? `TWC-icons/icon_${code}.png`
        : `TWC-icons/icon_34.png`;
        //console.log("Icon = icon_" + ${code} + ".png" );
        // You can enhance this by dynamically assigning icons later
        //const icon = 'Images/SunnyIcon.png'; // Placeholder

        daySummaries[i].innerHTML = `
        <div style="font-size: 14px; color: #a3a3a3;">${date}</div>
<img src="${iconFile}" alt="weather icon for code ${code}" width="60">
<div>
    <span style="color:red;">${high}°</span>
    <span style="color:gray;"> | </span>
    <span style="color:rgba(75, 75, 255, 1);">${low}°</span>
</div>

        <div style="font-size: 14px; color: rgba(150, 150, 230, 1);">${precip} in</div>
    `;
    }



    // Convert data into { x, y } pairs
    const precipDataset = timeValues.map((ts, i) => ({
        x: ts,
        y: probPrecipValues[i]  // ← actual 0–100 precipitation values
    }));

    const tempDataset = timeValues.map((ts, i) => ({
        x: ts,
        y: tempFValues[i]       // ← actual temperature values (°F)
    }));

    const isdayDataset = timeValues.map((ts, i) => ({
        x: ts,
        y: isDayValues[i]       // ← actual temperature values (°F)
    }));



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
                    tension: 0.5,
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
                            size: 20
                        }
                    },
                    grid: {
                        color: '#555555', // dark grey
                    },
                    ticks: {
                        color: 'red',
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
                            size: 20
                        }
                    },
                    grid: {
                        drawOnChartArea: false
                    },
                    ticks: {
                        color: 'rgba(75, 75, 250, 1)',
                        stepSize: 20,
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
});

