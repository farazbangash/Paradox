// Full-page screenshot via Puppeteer.
// Usage: node screenshot.mjs <url> [label] [viewportWidth]
// Saves to ./temporary screenshots/screenshot-N[-label].png (auto-incremented, never overwrites)
import puppeteer from 'puppeteer';
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const url = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] ? `-${process.argv[3]}` : '';
const width = parseInt(process.argv[4], 10) || 1440;

const OUT_DIR = fileURLToPath(new URL('./temporary screenshots/', import.meta.url));

async function nextIndex() {
  await mkdir(OUT_DIR, { recursive: true });
  const files = await readdir(OUT_DIR);
  let max = 0;
  for (const f of files) {
    const m = f.match(/^screenshot-(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

const n = await nextIndex();
const outPath = join(OUT_DIR, `screenshot-${n}${label}.png`);

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);

  // Scroll through the full page to trigger IntersectionObserver reveals,
  // then return to top so entrance state is settled before capture.
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const total = document.body.scrollHeight;
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < total; y += step) {
      window.scrollTo(0, y);
      await sleep(120);
    }
    window.scrollTo(0, 0);
    await sleep(400);
  });
  // Let fonts + any entrance animations settle
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: outPath, fullPage: true });
  console.log(`Saved ${outPath}`);
} finally {
  await browser.close();
}
