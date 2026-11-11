import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from '@xmldom/xmldom';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const styles = ['regular', 'filled', 'duocolor', 'duotone'];
const tags = new Set([
  'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line',
  'polyline', 'polygon', 'defs', 'clipPath', 'mask', 'use',
]);
const svgNamespace = 'http://www.w3.org/2000/svg';

export function componentName(name, style) {
  const pascal = name.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');
  return `${/^\d/.test(pascal) ? 'Icon' : ''}${pascal}${style[0].toUpperCase()}${style.slice(1)}`;
}

function attributeName(name) {
  if (/^(aria-|data-)/.test(name) || name === 'mask-type') return name;
  if (name === 'class') return 'className';
  return name.replace(/[-:]([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function parseSvg(source, filename) {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error(`${filename}: unsupported XML declarations`);
  const document = new DOMParser({
    onError(level, message) {
      throw new Error(`${filename}: ${level}: ${message}`);
    },
  }).parseFromString(source, 'image/svg+xml');
  const root = document.documentElement;
  if (
    root.localName !== 'svg' || root.namespaceURI !== svgNamespace
    || root.getAttribute('viewBox') !== '0 0 24 24'
    || root.getAttribute('width') !== '24' || root.getAttribute('height') !== '24'
  ) throw new Error(`${filename}: expected a 24px SVG`);

  function visit(node) {
    if (!tags.has(node.localName) || node.namespaceURI !== svgNamespace) {
      throw new Error(`${filename}: unsupported element ${node.nodeName}`);
    }
    const props = {};
    for (const attribute of Array.from(node.attributes)) {
      const { name, value } = attribute;
      if (/^on/i.test(name) || name === 'style') {
        throw new Error(`${filename}: unsupported attribute ${name}`);
      }
      if (name.startsWith('xmlns')) continue;
      props[attributeName(name)] = value;
    }
    return [
      node.localName,
      props,
      Array.from(node.childNodes).filter(child => child.nodeType === 1).map(visit),
    ];
  }
  return visit(root);
}

async function write(relative, content) {
  const filename = path.join(packageRoot, relative);
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, content);
}

export async function build() {
  const snapshot = await readFile(path.join(packageRoot, 'source/icons.json'), 'utf8');
  const lock = JSON.parse(await readFile(path.join(packageRoot, 'source/lock.json'), 'utf8'));
  if (createHash('sha256').update(snapshot).digest('hex') !== lock.snapshotSha256) {
    throw new Error('SVG snapshot digest mismatch; synchronize the canonical sources again');
  }
  const manifest = JSON.parse(snapshot);
  if (
    manifest.schemaVersion !== 1 || manifest.grid !== 24 || manifest.license !== 'MIT'
    || JSON.stringify(manifest.styles) !== JSON.stringify(styles)
    || manifest.iconCount !== manifest.icons.length
  ) throw new Error('Unsupported or inconsistent SVG manifest');

  const outputs = new Map();
  const allNames = new Set();
  const canonicalNames = new Set();
  const indexes = Object.fromEntries(styles.map(style => [style, []]));
  for (const icon of manifest.icons) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(icon.name) || canonicalNames.has(icon.name)) {
      throw new Error(`Invalid or duplicate canonical name: ${icon.name}`);
    }
    if (manifest.excludedBrands.includes(icon.name)) {
      throw new Error(`Excluded brand in manifest: ${icon.name}`);
    }
    canonicalNames.add(icon.name);
    for (const style of styles) {
      const relative = `icons/${style}/${icon.name}.svg`;
      const source = icon.svg[style];
      if (typeof source !== 'string') throw new Error(`Missing SVG source: ${relative}`);
      if (createHash('sha256').update(source).digest('hex') !== icon.sha256[style]) {
        throw new Error(`Source digest mismatch: ${relative}`);
      }
      const name = componentName(icon.name, style);
      if (allNames.has(name)) throw new Error(`Component name collision: ${name}`);
      allNames.add(name);
      const [, root, children] = parseSvg(source, relative);
      const data = `${JSON.stringify(name)}, ${JSON.stringify(root)}, ${JSON.stringify(children)}`;
      outputs.set(`dist/esm/${style}/${icon.name}.js`,
        `'use client';\nimport { createIcon } from '../runtime.js';\n`
        + `export const ${name} = /*#__PURE__*/ createIcon(${data});\n`
        + `export default ${name};\n`);
      outputs.set(`dist/cjs/${style}/${icon.name}.cjs`,
        `'use strict';\n'use client';\nconst { createIcon } = require('../runtime.cjs');\n`
        + `const ${name} = createIcon(${data});\nexports.${name} = ${name};\nexports.default = ${name};\n`);
      for (const extension of ['ts', 'cts']) {
        const importExtension = extension === 'ts' ? 'js' : 'cjs';
        outputs.set(`dist/types/${style}/${icon.name}.d.${extension}`,
          `import type { FedoraIcon } from '../types.${importExtension}';\n`
          + `export declare const ${name}: FedoraIcon;\nexport default ${name};\n`);
      }
      indexes[style].push({ canonical: icon.name, name });
    }
  }

  const rootExports = { esm: [], cjs: [], ts: [], cts: [] };
  for (const style of styles) {
    const esm = indexes[style].map(({ canonical, name }) =>
      `export { ${name} } from './${canonical}.js';`).join('\n') + '\n';
    const cjs = indexes[style].map(({ canonical, name }) =>
      `Object.defineProperty(exports, '${name}', { enumerable: true, get: () => require('./${canonical}.cjs').${name} });`)
      .join('\n') + '\n';
    outputs.set(`dist/esm/${style}/index.js`, esm);
    outputs.set(`dist/cjs/${style}/index.cjs`, `'use strict';\n${cjs}`);
    for (const extension of ['ts', 'cts']) {
      const importExtension = extension === 'ts' ? 'js' : 'cjs';
      outputs.set(`dist/types/${style}/index.d.${extension}`,
        `export type { FedoraIcon, IconProps, IconStyle } from '../types.${importExtension}';\n`
        + indexes[style].map(({ canonical, name }) =>
          `export { ${name} } from './${canonical}.${importExtension}';`).join('\n') + '\n');
      rootExports[extension].push(`export * from './${style}/index.${importExtension}';`);
    }
    rootExports.esm.push(`export * from './${style}/index.js';`);
    rootExports.cjs.push(...indexes[style].map(({ canonical, name }) =>
      `Object.defineProperty(exports, '${name}', { enumerable: true, get: () => require('./${style}/${canonical}.cjs').${name} });`));
  }

  outputs.set('dist/esm/index.js', rootExports.esm.join('\n') + '\n');
  outputs.set('dist/cjs/index.cjs', `'use strict';\n${rootExports.cjs.join('\n')}\n`);
  for (const extension of ['ts', 'cts']) {
    const importExtension = extension === 'ts' ? 'js' : 'cjs';
    outputs.set(`dist/types/index.d.${extension}`,
      `export type { FedoraIcon, IconProps, IconStyle } from './types.${importExtension}';\n`
      + rootExports[extension].join('\n') + '\n');
    outputs.set(`dist/types/types.d.${extension}`,
      await readFile(path.join(packageRoot, 'src/types.d.ts'), 'utf8'));
  }
  const runtime = await readFile(path.join(packageRoot, 'src/runtime.js'), 'utf8');
  outputs.set('dist/esm/runtime.js', runtime);
  outputs.set('dist/cjs/runtime.cjs', runtime
    .replace("import { createElement, forwardRef, useId } from 'react';",
      "const { createElement, forwardRef, useId } = require('react');")
    .replace('export function createIcon', 'function createIcon')
    + '\nexports.createIcon = createIcon;\n');

  const dist = path.join(packageRoot, 'dist');
  await mkdir(dist, { recursive: true });
  for (const relative of await readdir(dist, { recursive: true })) {
    const filename = `dist/${relative}`;
    if (/\.(js|cjs|ts|cts)$/.test(relative) && !outputs.has(filename)) {
      await unlink(path.join(packageRoot, filename));
    }
  }
  const entries = [...outputs];
  for (let offset = 0; offset < entries.length; offset += 64) {
    await Promise.all(entries.slice(offset, offset + 64).map(([name, content]) => write(name, content)));
  }
  console.log(`Built ${allNames.size} React components from ${canonicalNames.size} icons in four styles.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build();
}
