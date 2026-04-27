// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 30000,
    retries: 0,
    use: {
        baseURL: 'http://localhost:8080',
        headless: true,
        screenshot: 'only-on-failure',
    },
    webServer: {
        command: 'npx serve -l 8080 --no-clipboard',
        url: 'http://localhost:8080',
        reuseExistingServer: true,
        timeout: 10000,
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
    ],
});
