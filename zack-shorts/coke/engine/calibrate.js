// Per-frame auto exposure: sample every ~0.35 s inside each shot, measure mean luma (BT.709) of the finished frame,
// and store a gain curve [t, gain] per shot in gains.js (linear interpolation in main.js). Run 3-4 passes to converge.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const TARGET = parseFloat(process.argv[2] || 90);
const parse = () => JSON.parse(fs.readFileSync(path.resolve(__dirname, 'gains.js'), 'utf8').replace(/^export const GAINS = /, '').replace(/;\s*$/, ''));
const gainOf = (g, t) => { if (g == null) return 1; if (typeof g === 'number') return g; if (t <= g[0][0]) return g[0][1];
  for (let i = 1; i < g.length; i++) if (t <= g[i][0]) { const k = (t - g[i - 1][0]) / (g[i][0] - g[i - 1][0]); return g[i - 1][1] * (1 - k) + g[i][1] * k; } return g[g.length - 1][1]; };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--disable-web-security'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('console', (m) => { if (m.text().startsWith('INIT FAILED')) { console.error(m.text()); process.exit(2); } });
  await page.goto('file://' + path.resolve(__dirname, 'scene.html'));
  await page.waitForFunction(() => window.ready === true, null, { timeout: 600000 });
  await page.evaluate(() => { window.__NOFLASH = true; });
  const spans = await page.evaluate(() => window.SHOTSPAN); const END = await page.evaluate(() => window.END);
  const cur = parse(); const out = {};
  for (let i = 0; i < spans.length; i++) {
    const [a, b] = spans[i]; const n = Math.max(3, Math.ceil((b - a) / 0.35)); const ts = [];
    for (let j = 0; j < n; j++) ts.push(a + 0.15 + (b - a - 0.25) * (j / (n - 1)));
    if (a === 0) ts[0] = 0; if (i === spans.length - 1) ts[n - 1] = END - 1 / 30;
    const curve = []; let line = [];
    for (const t of ts) {
      const y = await page.evaluate((t) => { window.renderFrame(t); const c = document.querySelector('canvas'); const g = c.getContext('2d');
        const d = g.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let k = 0; k < d.length; k += 16) s += 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]; return s / (d.length / 16); }, t);
      const g0 = gainOf(cur[i], t); const g1 = Math.min(3, Math.max(0.03, g0 * Math.pow(TARGET / y, 1.7)));
      curve.push([+t.toFixed(3), +g1.toFixed(4)]); line.push(y.toFixed(0));
    }
    // light smoothing so exposure never pumps
    const sm = curve.map((p, k) => [p[0], +((curve[Math.max(0, k - 1)][1] + 2 * p[1] + curve[Math.min(curve.length - 1, k + 1)][1]) / 4).toFixed(4)]);
    sm[0][1] = curve[0][1]; sm[sm.length - 1][1] = curve[curve.length - 1][1];
    out[i] = sm; console.log(`shot ${i} [${a.toFixed(2)}-${b.toFixed(2)}] n=${n} luma ${line.join('/')}`);
  }
  fs.writeFileSync(path.resolve(__dirname, 'gains.js'), 'export const GAINS = ' + JSON.stringify(out) + ';\n');
  await browser.close();
})();
