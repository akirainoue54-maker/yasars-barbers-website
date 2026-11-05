// Usage:
//   node render.js stills out_dir t1 t2 ...       -> out_dir/f_<t>.jpg
//   node render.js video out.mp4 t0 t1 [fps]       -> frames t0..t1 piped to ffmpeg
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

(async () => {
  const [mode, out, ...rest] = process.argv.slice(2);
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
           '--allow-file-access-from-files', '--disable-web-security'],
  });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('[log]')) console.error(m.text()); if (m.text().startsWith('INIT FAILED')) process.exit(2); });
  page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'scene.html'));
  await page.waitForFunction(() => window.ready === true, null, { timeout: 600000 });
  const grab = async (t) => {
    const url = await page.evaluate((t) => window.renderFrame(t), t);
    return Buffer.from(url.split(',')[1], 'base64');
  };
  if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    for (const s of rest) {
      const t0 = Date.now();
      const buf = await grab(parseFloat(s));
      fs.writeFileSync(path.join(out, `f_${parseFloat(s).toFixed(2).padStart(6, '0')}.jpg`), buf);
      console.error(`t=${s} ${Date.now() - t0}ms`);
    }
  } else {
    const t0 = parseFloat(rest[0]), t1 = parseFloat(rest[1]), fps = parseFloat(rest[2] || 30);
    const n0 = Math.round(t0 * fps), n1 = Math.round(t1 * fps);
    const tmp = out + '.tmp.mp4';
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), tmp],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    const start = Date.now();
    for (let n = n0; n < n1; n++) {
      const buf = await grab(n / fps);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if ((n - n0) % 30 === 0) console.error(`frame ${n} (${((Date.now() - start) / (n - n0 + 1)).toFixed(0)} ms/f)`);
    }
    ff.stdin.end();
    const code = await new Promise((r) => ff.on('close', r));
    if (code === 0) fs.renameSync(tmp, out); else { console.error('ffmpeg failed', code); process.exitCode = 1; }
  }
  await browser.close();
})();
