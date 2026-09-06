const { createRequire } = require('node:module');
const path = require('node:path');
const require2 = createRequire('C:\\Users\\fabrickspa\\AppData\\Roaming\\npm\\node_modules\\playwright\\package.json');
const { chromium } = require2('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type="email"]', 'admin@mdc.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  await page.goto('http://localhost:3000/stock', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({
      placeholder: i.placeholder,
      type: i.type,
    }));
  });
  console.log('Inputs found:', JSON.stringify(inputs, null, 2));
  await browser.close();
})();
