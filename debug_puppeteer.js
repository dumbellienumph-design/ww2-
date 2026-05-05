const puppeteer = require('puppeteer');
(async () => {
  try {
    const browser = await puppeteer.launch({
      executablePath: 'C:\\Users\\dumbe\\.cache\\puppeteer\\chrome\\win64-147.0.7727.57\\chrome-win64\\chrome.exe',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    await page.goto('http://localhost:8080');
    console.log('Navigated to page');
    await new Promise(r => setTimeout(r, 10000));
    await page.screenshot({path: 'debug_puppeteer.png'});
    console.log('Screenshot taken');
    await browser.close();
  } catch (e) {
    console.log('ERROR:', e.message);
  }
})();
