// Zero-dependency bundler for this project's module conventions:
// single-line named imports, `export function|const|let|class`, no default exports, no cycles.
// Produces dist/margin.html, one self-contained file that opens straight from disk.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = 'src/ui/main.js';
const IMPORT_RE = /^import\s+\{([^}]*)\}\s+from\s+'([^']+)';?\s*$/gm;
const resolve = (from, spec) => path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));

const order = [];
const seen = new Map();
function visit(rel, chain = []) {
  if (seen.get(rel) === 'done') return;
  if (seen.get(rel) === 'visiting') throw new Error(`Import cycle: ${[...chain, rel].join(' -> ')}`);
  seen.set(rel, 'visiting');
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const m of code.matchAll(IMPORT_RE)) visit(resolve(rel, m[2]), [...chain, rel]);
  seen.set(rel, 'done');
  order.push(rel);
}

function transform(rel, code) {
  const names = [];
  let out = code.replace(IMPORT_RE, (_, list, spec) => {
    const parts = list.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ': '));
    return `const { ${parts.join(', ')} } = __m[${JSON.stringify(resolve(rel, spec))}];`;
  });
  out = out.replace(/^export\s+(async\s+function\*?|function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kw, name) => { names.push(name); return `${kw} ${name}`; });
  for (const line of out.split('\n')) {
    if (/^\s*export\s/.test(line)) throw new Error(`Unsupported export in ${rel}: ${line.trim()}`);
    if (/^\s*import\s/.test(line)) throw new Error(`Unsupported import in ${rel}: ${line.trim()}`);
  }
  return `// ${rel}\n__m[${JSON.stringify(rel)}] = (function () {\n${out}\nreturn { ${names.join(', ')} };\n})();\n`;
}

export function build() {
  order.length = 0;
  seen.clear();
  visit(entry);
  const js = `(function () {\n'use strict';\nconst __m = Object.create(null);\n${order.map((rel) => transform(rel, fs.readFileSync(path.join(root, rel), 'utf8'))).join('\n')}\n})();\n`;
  const css = fs.readFileSync(path.join(root, 'styles/app.css'), 'utf8');
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  html = html.replace('<link rel="stylesheet" href="styles/app.css">', () => `<style>\n${css}\n</style>`);
  html = html.replace('<script type="module" src="src/ui/main.js"></script>', () => `<script>\n${safeJs}\n</script>`);
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist/margin.html'), html);
  fs.writeFileSync(path.join(root, 'dist/margin.bundle.js'), js);
  return { modules: order.length, kb: Math.round(html.length / 1024) };
}

const r = build();
console.log(`Built dist/margin.html from ${r.modules} modules (${r.kb} KB).`);
