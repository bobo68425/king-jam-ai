const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    let hasError = false;

    async function checkPage(url) {
        console.log(`\n--- Checking ${url} ---`);
        const page = await browser.newPage();
        
        page.on('pageerror', error => {
            console.log(`[PAGE ERROR]: ${error.message}`);
            hasError = true;
        });

        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`[CONSOLE ERROR]: ${msg.text()}`);
                hasError = true;
            }
        });

        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
            await page.waitForTimeout(2000); // Wait for React hydration or async effects
        } catch (err) {
            console.error(`Failed to load ${url}:`, err.message);
        }
        await page.close();
    }

    await checkPage('http://localhost:3000');
    await checkPage('http://localhost:3000/login');
    await checkPage('http://localhost:3000/dashboard/history');
    
    if (!hasError) {
        console.log("\n✅ No client-side errors detected.");
    }

    await browser.close();
    process.exit(0);
})();
