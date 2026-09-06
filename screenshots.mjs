import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(__dirname, '.browser-screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const { createRequire } = await import('node:module');
const require = createRequire('C:\\Users\\fabrickspa\\AppData\\Roaming\\npm\\node_modules\\playwright\\package.json');
const { chromium: pw } = require('playwright');

const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

// Login
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-login.png') });
console.log('01-login.png saved');

await page.fill('input[type="email"]', 'admin@mdc.com');
await page.fill('input[type="password"]', 'admin123');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);

// Dashboard
await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-dashboard.png') });
console.log('02-dashboard.png saved');

// Stock/Scanner
await page.goto('http://localhost:3000/stock', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-stock-scanner.png') });
console.log('03-stock-scanner.png saved');

// Manual barcode search
const searchInput = page.locator('input[placeholder*="Código de barras"]');
await searchInput.fill('5449000000996');
await page.click('button:has-text("Buscar")');
await page.waitForTimeout(5000);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-barcode-lookup.png') });
console.log('04-barcode-lookup.png saved');

// Products page
await page.goto('http://localhost:3000/products', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-products.png') });
console.log('05-products.png saved');

// Inventory
await page.goto('http://localhost:3000/inventory', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-inventory.png') });
console.log('06-inventory.png saved');

await browser.close();
console.log('All screenshots done!');
