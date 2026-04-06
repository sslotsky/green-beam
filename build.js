const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const src = path.join(__dirname, 'src');
const dist = path.join(__dirname, 'dist');

// Clean and copy src to dist
fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(src, dist, { recursive: true });

// Find all .jsx files
function findJsx(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findJsx(full));
    else if (entry.name.endsWith('.jsx')) results.push(full);
  }
  return results;
}

const jsxFiles = findJsx(src);

if (jsxFiles.length > 0) {
  // Build each .jsx → .js in dist
  esbuild.buildSync({
    entryPoints: jsxFiles,
    bundle: true,
    platform: 'node',
    outdir: dist,
    outbase: src,
    jsx: 'transform',
    jsxFactory: '__jsx',
    jsxFragment: '__Fragment',
    banner: {
      js: `const { jsx: __jsx, Fragment: __Fragment } = require('./jsx-runtime.js');`,
    },
    external: ['@resvg/resvg-js', 'satori', 'better-sqlite3', 'hono', 'hono/*', '@hono/*'],
  });

  // Remove .jsx source files from dist
  for (const file of findJsx(dist)) {
    fs.unlinkSync(file);
  }
}

// Bundle @tonejs/midi for browser
fs.mkdirSync(path.join(dist, 'js', 'vendor'), { recursive: true });
esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'vendor-entry', 'midi.js')],
  bundle: true,
  format: 'esm',
  outfile: path.join(dist, 'js', 'vendor', 'tonejs-midi.js'),
  platform: 'browser',
});

console.log(`Build complete (${jsxFiles.length} JSX file${jsxFiles.length !== 1 ? 's' : ''} compiled)`);
