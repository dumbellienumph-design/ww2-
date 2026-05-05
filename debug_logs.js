const playwright = require('playwright');
(async () => {
  try {
    const browser = await playwright.chromium.launch({
      executablePath: 'C:\\Users\\dumbe\\.cache\\puppeteer\\chrome\\win64-147.0.7727.57\\chrome-win64\\chrome.exe'
    });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    await page.goto('https://dumbellienumph-design.github.io/ww2-/');
    await page.waitForTimeout(5000);
    await browser.close();
  } catch (e) {
    console.log('SCRIPT ERROR:', e.message);
  }
})();
