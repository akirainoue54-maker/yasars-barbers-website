// Per-frame auto exposure: sample every ~0.35 s inside each shot, measure mean luma (BT.709) of the finished frame,
// and store a gain curve [t, gain] per shot in gains.js (linear interpolation in main.js). Run 3-4 passes to converge.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const TARGET_BASE = parseFloat(process.argv[2] || 88), TARGET_HOOK = 95;
// the hook seconds (first and last ~1 s, which are the same frame for the loop) sit at the top of the 85-95 band so the white tooth and foam stay bright
let END_T = 33.2; const targetAt = (t) => (t < 1.0 ? TARGET_HOOK : t < 2.0 ? TARGET_HOOK + (TARGET_BASE - TARGET_HOOK) * (t - 1.0) : t > END_T - 1.2 ? TARGET_HOOK : TARGET_BASE);
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
  const spans = await page.evaluate(() => window.SHOTSPAN); const END = await page.evaluate(() => window.END); END_T = END;
  const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
  const cur = parse(); const out = {};
  for (let i = 0; i < spans.length; i++) {
    if (only && !only.includes(i)) { out[i] = cur[i]; continue; }
    const [a, b, cuts] = spans[i]; const bounds = [a, ...cuts, b]; let curve = []; let line = [];
    for (let sI = 0; sI < bounds.length - 1; sI++) {
      const s0 = bounds[sI], s1 = bounds[sI + 1]; const n = Math.max(2, Math.ceil((s1 - s0) / 0.35)); const ts = [];
      for (let j = 0; j < n; j++) ts.push(s0 + 0.12 + (s1 - s0 - 0.2) * (j / (n - 1)));
      if (a === 0 && sI === 0) ts[0] = 0; if (i === spans.length - 1 && sI === bounds.length - 2) ts[n - 1] = END - 1 / 30;
      const seg = [];
      for (const t of ts) {
        const y = await page.evaluate((t) => { window.renderFrame(t); const c = document.querySelector('canvas'); const g = c.getContext('2d');
          const d = g.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let k = 0; k < d.length; k += 16) s += 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]; return s / (d.length / 16); }, t);
        const g0 = gainOf(cur[i], t); const g1 = Math.min(3, Math.max(0.03, g0 * Math.pow(targetAt(t) / y, 1.0)));
        seg.push([+t.toFixed(3), +g1.toFixed(4)]); line.push(y.toFixed(0));
      }
      // smooth inside a segment only (never across a cut), then make the cut a step
      const sm = seg.map((p, k) => [p[0], +((seg[Math.max(0, k - 1)][1] + 2 * p[1] + seg[Math.min(seg.length - 1, k + 1)][1]) / 4).toFixed(4)]);
      sm[0][1] = seg[0][1]; sm[sm.length - 1][1] = seg[seg.length - 1][1];
      if (sI > 0) { curve.push([+(s0 - 0.0005).toFixed(4), curve[curve.length - 1][1]]); curve.push([+s0.toFixed(4), sm[0][1]]); }
      curve = curve.concat(sm);
    }
    const sm = curve;
    out[i] = sm; console.log(`shot ${i} [${a.toFixed(2)}-${b.toFixed(2)}] luma ${line.join('/')}`);
  }
  fs.writeFileSync(path.resolve(__dirname, 'gains.js'), 'export const GAINS = ' + JSON.stringify(out) + ';\n');
  await browser.close();
})();
