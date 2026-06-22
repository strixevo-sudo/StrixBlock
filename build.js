// StrixBlock v2 — esbuild build script (CommonJS)
'use strict';

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

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
