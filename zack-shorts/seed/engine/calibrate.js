// Render 3 frames per shot, measure mean luma (BT.709 on the JPEG), and update gains.js toward TARGET.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const TARGET = parseFloat(process.argv[2] || 90);
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-web-security'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('console', (m) => { if (m.text().startsWith('INIT FAILED')) { console.error(m.text()); process.exit(2); } });
  await page.goto('file://' + path.resolve(__dirname, 'scene.html'));
  await page.waitForFunction(() => window.ready === true, null, { timeout: 600000 });
  const spans = await page.evaluate(() => window.SHOTSPAN);
  const gains = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'gains.js'), 'utf8').replace(/^export const GAINS = /, '').replace(/;\s*$/, ''));
  const out = { ...gains };
  for (let i = 0; i < spans.length; i++) {
    const [a, b] = spans[i]; const ys = [];
    for (const f of [0.2, 0.5, 0.8]) {
      const t = a + (b - a) * f;
      const y = await page.evaluate((t) => { window.renderFrame(t); const c = document.querySelector('canvas'); const g = c.getContext('2d');
        const d = g.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let k = 0; k < d.length; k += 16) s += 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]; return s / (d.length / 16); }, t);
      ys.push(y);
    }
    const y = ys.reduce((p, q) => p + q, 0) / ys.length; const g0 = out[i] ?? 1;
    const g1 = Math.min(3, Math.max(0.03, g0 * Math.pow(TARGET / y, 1.7)));
    console.log(`shot ${i} [${a.toFixed(2)}-${b.toFixed(2)}] luma ${ys.map((v) => v.toFixed(0)).join('/')} avg ${y.toFixed(1)} gain ${g0.toFixed(3)} -> ${g1.toFixed(3)}`);
    out[i] = +g1.toFixed(3);
  }
  fs.writeFileSync(path.resolve(__dirname, 'gains.js'), 'export const GAINS = ' + JSON.stringify(out) + ';\n');
  await browser.close();
})();
