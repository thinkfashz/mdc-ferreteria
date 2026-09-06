const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const require2 = createRequire('C:\\Users\\fabrickspa\\AppData\\Roaming\\npm\\node_modules\\playwright\\package.json');
const { chromium } = require2('playwright');

const DIR = path.join(__dirname, '.browser-screenshots');
fs.mkdirSync(DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Login
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', 'admin@mdc.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Stock page
  await page.goto('http://localhost:3000/stock', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(DIR, 'stock-01-empty.png') });
  console.log('01-empty queue');

  // Add barcode 1 (Coca-Cola)
  const input = page.locator('input[placeholder*="codigo de barras"]').first();
  await input.fill('5449000000996');
  await page.locator('button').filter({ hasText: 'Agregar' }).first().click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(DIR, 'stock-02-item1.png'), fullPage: true });
  console.log('02-item1 added');

  // Add barcode 2
  await input.fill('7613034626846');
  await page.locator('button').filter({ hasText: 'Agregar' }).first().click();
  await page.waitForTimeout(6000);

  // Add barcode 3
  await input.fill('3017620422003');
  await page.locator('button').filter({ hasText: 'Agregar' }).first().click();
  await page.waitForTimeout(6000);

  await page.screenshot({ path: path.join(DIR, 'stock-03-queue3.png'), fullPage: true });
  console.log('03-queue with 3 items');

  // Save all
  const saveAllBtn = page.locator('button').filter({ hasText: 'Guardar todo' }).first();
  if (await saveAllBtn.isVisible()) {
    await saveAllBtn.click();
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(DIR, 'stock-04-saved.png'), fullPage: true });
    console.log('04-all saved');
  }

  // Products page
  await page.goto('http://localhost:3000/products', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(DIR, 'stock-05-products.png'), fullPage: true });
  console.log('05-products');

  await browser.close();
  console.log('Done!');
})();
