// StrixBlock v2 — esbuild build script (CommonJS)
'use strict';

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── Icon generator (pure Node.js, no extra deps) ─────────────────────────────
function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(d.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, d])));
  return Buffer.concat([len, t, d, crcBuf]);
}

function createIconPNG(size) {
  // StrixBlock icon: indigo (#6366f1) background, white 'S' letterform via pixels
  const BG = [99, 102, 241];   // #6366f1 indigo
  const FG = [255, 255, 255];  // white

  // Simple 'S' glyph on a 7×7 grid, scaled to fill icon
  const glyph = [
    [0,1,1,1,1,1,0],
    [1,1,0,0,0,0,0],
    [1,1,0,0,0,0,0],
    [0,1,1,1,1,0,0],
    [0,0,0,0,1,1,0],
    [0,0,0,0,1,1,0],
    [0,1,1,1,1,0,0],
  ];

  const pad = Math.round(size * 0.15);
  const glyphArea = size - pad * 2;
  const cellW = glyphArea / glyph[0].length;
  const cellH = glyphArea / glyph.length;

  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0; // filter type None
    for (let x = 0; x < size; x++) {
      const glyphX = Math.floor((x - pad) / cellW);
      const glyphY = Math.floor((y - pad) / cellH);
      const isGlyph =
        glyphX >= 0 && glyphX < glyph[0].length &&
        glyphY >= 0 && glyphY < glyph.length &&
        glyph[glyphY][glyphX] === 1;
      const [r, g, b] = isGlyph ? FG : BG;
      const off = y * (1 + size * 3) + 1 + x * 3;
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function generateIcons() {
  if (!fs.existsSync('icons')) fs.mkdirSync('icons');
  for (const size of [16, 32, 48, 128]) {
    const file = `icons/icon${size}.png`;
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, createIconPNG(size));
      console.log(`[icons] Generated ${file}`);
    }
  }
}

const isWatch = process.argv.includes('--watch');
const isProd = !isWatch && !process.argv.includes('--dev');

/** @type {import('esbuild').BuildOptions} */
const sharedOptions = {
  target: 'chrome112',
  bundle: true,
  minify: isProd,
  sourcemap: !isProd ? 'inline' : false,
  logLevel: 'info',
};

const entryPoints = [
  // Service worker (ESM)
  {
    in: 'src/background/index.ts',
    out: 'dist/background',
    format: 'esm',
  },
  // Isolated world content scripts (IIFE)
  {
    in: 'src/content/main.ts',
    out: 'dist/content/main',
    format: 'iife',
  },
  // MAIN world script (IIFE)
  {
    in: 'src/content/spoof.ts',
    out: 'dist/content/spoof',
    format: 'iife',
  },
  // Popup
  {
    in: 'src/popup/popup.ts',
    out: 'dist/popup/popup',
    format: 'iife',
  },
  // Dashboard
  {
    in: 'src/dashboard/dashboard.ts',
    out: 'dist/dashboard/dashboard',
    format: 'iife',
  },
];

/**
 * Copy a file, creating the destination directory if needed.
 * @param {string} src
 * @param {string} dest
 */
function copyFile(src, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log(`[copy] ${src} → ${dest}`);
}

function copyStaticAssets() {
  copyFile('src/popup/popup.html', 'dist/popup/popup.html');
  copyFile('src/dashboard/dashboard.html', 'dist/dashboard/dashboard.html');
  if (fs.existsSync('src/content/cosmetic.css')) {
    copyFile('src/content/cosmetic.css', 'dist/content/cosmetic.css');
  }
}

async function build() {
  generateIcons();

  // Ensure dist dirs exist
  ['dist', 'dist/content', 'dist/popup', 'dist/dashboard'].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  if (isWatch) {
    // Dev / watch mode — build all entry points in parallel contexts
    const contexts = await Promise.all(
      entryPoints.map(({ in: entry, out, format }) =>
        esbuild.context({
          ...sharedOptions,
          entryPoints: [entry],
          outfile: `${out}.js`,
          format,
        })
      )
    );

    copyStaticAssets();

    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log('[watch] Watching for changes… (Ctrl-C to stop)');
  } else {
    // Production build
    await Promise.all(
      entryPoints.map(({ in: entry, out, format }) =>
        esbuild.build({
          ...sharedOptions,
          entryPoints: [entry],
          outfile: `${out}.js`,
          format,
        })
      )
    );

    copyStaticAssets();
    console.log('[build] Done.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
