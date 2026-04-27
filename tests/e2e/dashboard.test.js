/**
 * E2E tests for the Weather Dashboard
 * Tests page loading, navigation, location changes, and data rendering
 * 
 * Uses 'domcontentloaded' instead of 'networkidle' because the dashboard
 * has periodic refresh intervals that prevent network idle.
 */
const { test, expect } = require('@playwright/test');

// Helper: go to dashboard and wait for React to mount
async function gotoDashboard(page) {
    await page.goto('/MainDashboard.html', { waitUntil: 'domcontentloaded' });
    // Wait for React to render the temp circle (signals app is mounted)
    await page.locator('.temp-circle').waitFor({ state: 'visible', timeout: 15000 });
}

// ============================================================
// MainDashboard — Page Load & Default Location
// ============================================================
test.describe('MainDashboard - Default Location', () => {
    test('page loads without JS crashes', async ({ page }) => {
        const errors = [];
        page.on('pageerror', err => errors.push(err.message));
        
        await gotoDashboard(page);
        
        // Filter out API/network errors (expected when keys are rate-limited)
        const jsErrors = errors.filter(e => 
            !e.includes('fetch') && !e.includes('API') && !e.includes('Failed to fetch') &&
            !e.includes('NetworkError') && !e.includes('net::')
        );
        expect(jsErrors).toEqual([]);
    });

    test('displays default location (Winterset, IA)', async ({ page }) => {
        await gotoDashboard(page);
        
        const locationText = page.locator('.css-location');
        await expect(locationText).toContainText('Winterset');
    });

    test('temperature circle renders with data', async ({ page }) => {
        await gotoDashboard(page);
        
        const tempCircle = page.locator('.current-temp');
        await expect(tempCircle).toBeVisible({ timeout: 15000 });
        
        const text = await tempCircle.textContent();
        expect(text).toMatch(/\d/);
    });

    test('all four cards are visible', async ({ page }) => {
        await gotoDashboard(page);
        
        await expect(page.locator('.wind-card')).toBeVisible();
        await expect(page.locator('.humidity-card')).toBeVisible();
        await expect(page.locator('.rainfall-card')).toBeVisible();
        await expect(page.locator('.almanac-card')).toBeVisible();
    });

    test('Weather Radar button is visible', async ({ page }) => {
        await gotoDashboard(page);
        
        const radarBtn = page.locator('.radar-btn');
        await expect(radarBtn).toBeVisible();
        await expect(radarBtn).toContainText('Weather');
        await expect(radarBtn).toContainText('Radar');
    });

    test('hi/lo temperatures display numbers', async ({ page }) => {
        await gotoDashboard(page);
        
        const hiLo = page.locator('.hi-lo');
        await expect(hiLo).toBeVisible({ timeout: 15000 });
        const text = await hiLo.textContent();
        expect(text).toMatch(/\d+°\s*\|\s*\d+°/);
    });

    test('feels-like temperature displays', async ({ page }) => {
        await gotoDashboard(page);
        
        const feelsLike = page.locator('.feels-like');
        await expect(feelsLike).toBeVisible({ timeout: 15000 });
        const text = await feelsLike.textContent();
        expect(text).toMatch(/Feels like \d+°/);
    });
});

// ============================================================
// MainDashboard — Location Modal
// ============================================================
test.describe('MainDashboard - Location Modal', () => {
    test('opens when clicking location name', async ({ page }) => {
        await gotoDashboard(page);
        
        await page.locator('.css-location').click();
        
        const modal = page.locator('.location-modal');
        await expect(modal).toBeVisible();
        await expect(modal).toContainText('Change Location');
    });

    test('accepts letter input for station IDs', async ({ page }) => {
        await gotoDashboard(page);
        await page.locator('.css-location').click();
        
        const input = page.locator('.location-modal input');
        await input.fill('KIAEARLH10');
        
        const value = await input.inputValue();
        expect(value).toBe('KIAEARLH10');
    });

    test('accepts numeric input for ZIP codes', async ({ page }) => {
        await gotoDashboard(page);
        await page.locator('.css-location').click();
        
        const input = page.locator('.location-modal input');
        await input.fill('50273');
        
        const value = await input.inputValue();
        expect(value).toBe('50273');
    });

    test('shows preview for valid ZIP code', async ({ page }) => {
        await gotoDashboard(page);
        await page.locator('.css-location').click();
        
        const input = page.locator('.location-modal input');
        await input.fill('68349');
        
        const preview = page.locator('.location-modal-preview');
        await expect(preview).toContainText('Elmwood', { timeout: 10000 });
    });

    test('shows error for invalid ZIP code', async ({ page }) => {
        await gotoDashboard(page);
        await page.locator('.css-location').click();
        
        const input = page.locator('.location-modal input');
        await input.fill('00000');
        
        const error = page.locator('.location-modal-error');
        await expect(error).toBeVisible({ timeout: 10000 });
    });

    test('cancel button closes modal', async ({ page }) => {
        await gotoDashboard(page);
        await page.locator('.css-location').click();
        
        await expect(page.locator('.location-modal')).toBeVisible();
        
        await page.locator('.location-modal button.cancel').click();
        
        await expect(page.locator('.location-modal')).not.toBeVisible();
    });

    test('save button is disabled without valid preview', async ({ page }) => {
        await gotoDashboard(page);
        await page.locator('.css-location').click();
        
        const saveBtn = page.locator('.location-modal button.save');
        await expect(saveBtn).toBeDisabled();
    });
});

// ============================================================
// Navigation
// ============================================================
test.describe('Navigation', () => {
    test('radar button navigates to RadarMap page', async ({ page }) => {
        await gotoDashboard(page);
        
        await page.locator('.radar-btn').click();
        
        await expect(page).toHaveURL(/RadarMap/);
    });

    test('rainfall card navigates to RainfallHistory page', async ({ page }) => {
        await gotoDashboard(page);
        
        await page.locator('.rainfall-card').click();
        
        await expect(page).toHaveURL(/RainfallHistory/);
    });

    test('almanac card navigates to Almanac page', async ({ page }) => {
        await gotoDashboard(page);
        
        await page.locator('.almanac-card').click();
        
        await expect(page).toHaveURL(/Almanac/);
    });

    test('container area navigates to DetailGraphs page', async ({ page }) => {
        await gotoDashboard(page);
        
        // Click the outer container (not a card) to navigate
        await page.locator('.container').first().click({ position: { x: 10, y: 10 } });
        
        await expect(page).toHaveURL(/DetailGraphs/);
    });
});

// ============================================================
// RadarMap
// ============================================================
test.describe('RadarMap', () => {
    test('page loads without JS errors', async ({ page }) => {
        const errors = [];
        page.on('pageerror', err => errors.push(err.message));
        
        await page.goto('/RadarMap.html', { waitUntil: 'domcontentloaded' });
        await page.locator('#mapid').waitFor({ state: 'visible', timeout: 15000 });
        
        expect(errors).toEqual([]);
    });

    test('map container is visible', async ({ page }) => {
        await page.goto('/RadarMap.html', { waitUntil: 'domcontentloaded' });
        
        await expect(page.locator('#mapid')).toBeVisible({ timeout: 15000 });
    });

    test('play/pause controls are visible', async ({ page }) => {
        await page.goto('/RadarMap.html', { waitUntil: 'domcontentloaded' });
        await page.locator('#mapid').waitFor({ state: 'visible', timeout: 15000 });
        
        await expect(page.locator('#playBtn')).toBeVisible();
        await expect(page.locator('#timestamp')).toBeVisible();
    });

    test('back button navigates to MainDashboard', async ({ page }) => {
        await page.goto('/RadarMap.html', { waitUntil: 'domcontentloaded' });
        await page.locator('.back-btn').waitFor({ state: 'visible', timeout: 15000 });
        
        await page.locator('.back-btn').click();
        
        await expect(page).toHaveURL(/MainDashboard/);
    });

    test('no window.location override bug (no redirect loop)', async ({ page }) => {
        await page.goto('/RadarMap.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        
        // Should stay on RadarMap page, not redirect
        await expect(page).toHaveURL(/RadarMap/);
    });
});

// ============================================================
// RainfallHistory
// ============================================================
test.describe('RainfallHistory', () => {
    test('page loads without JS crashes', async ({ page }) => {
        const errors = [];
        page.on('pageerror', err => errors.push(err.message));
        
        await page.goto('/RainfallHistory.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        
        const jsErrors = errors.filter(e => 
            !e.includes('fetch') && !e.includes('API') && !e.includes('Failed to fetch') &&
            !e.includes('NetworkError') && !e.includes('net::')
        );
        expect(jsErrors).toEqual([]);
    });
});

// ============================================================
// Almanac
// ============================================================
test.describe('Almanac', () => {
    test('page loads without JS crashes', async ({ page }) => {
        const errors = [];
        page.on('pageerror', err => errors.push(err.message));
        
        await page.goto('/Almanac.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        
        const jsErrors = errors.filter(e => 
            !e.includes('fetch') && !e.includes('API') && !e.includes('Failed to fetch') &&
            !e.includes('NetworkError') && !e.includes('net::')
        );
        expect(jsErrors).toEqual([]);
    });
});

// ============================================================
// DetailGraphs
// ============================================================
test.describe('DetailGraphs', () => {
    test('page loads without JS crashes', async ({ page }) => {
        const errors = [];
        page.on('pageerror', err => errors.push(err.message));
        
        await page.goto('/DetailGraphs.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        
        const jsErrors = errors.filter(e => 
            !e.includes('fetch') && !e.includes('API') && !e.includes('Failed to fetch') &&
            !e.includes('NetworkError') && !e.includes('net::')
        );
        expect(jsErrors).toEqual([]);
    });
});

// ============================================================
// Index redirect
// ============================================================
test.describe('Index', () => {
    test('index.html redirects to MainDashboard', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        
        await expect(page).toHaveURL(/MainDashboard/, { timeout: 10000 });
    });
});

// ============================================================
// Broken images / resources
// ============================================================
test.describe('Resource Loading', () => {
    test('no broken images on MainDashboard', async ({ page }) => {
        const brokenImages = [];
        
        page.on('response', response => {
            if (response.url().match(/\.(png|jpg|gif|svg)/) && response.status() === 404) {
                brokenImages.push(response.url());
            }
        });
        
        await gotoDashboard(page);
        await page.waitForTimeout(3000);
        
        expect(brokenImages).toEqual([]);
    });
});
