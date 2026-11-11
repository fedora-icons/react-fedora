import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DOMParser } from '@xmldom/xmldom';
import { build as bundle } from 'esbuild';
import * as icons from '@fedora-icons/react';
import Camera from '@fedora-icons/react/regular/camera';
import { CameraFilled } from '@fedora-icons/react/filled';
import { componentName, parseSvg } from '../scripts/build.mjs';

const require = createRequire(import.meta.url);
const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(packageRoot, 'source/icons.json'), 'utf8'));
const parse = text => new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;

function canonical(node, originalIds = []) {
  const attributes = Array.from(node.attributes)
    .filter(({ name }) => !['xmlns', 'focusable', 'aria-hidden'].includes(name))
    .map(({ name, value }) => {
      for (const id of originalIds) {
        value = value.replaceAll(`url(#${id.actual})`, `url(#${id.source})`);
        if (name === 'id' && value === id.actual) value = id.source;
      }
      return [name, value];
    })
    .sort(([a], [b]) => a.localeCompare(b));
  return [node.nodeName, attributes, Array.from(node.childNodes)
    .filter(child => child.nodeType === 1).map(child => canonical(child, originalIds))];
}

function elements(root) {
  return [root, ...Array.from(root.getElementsByTagName('*'))];
}

test('every component preserves the canonical SVG geometry, paints, and nested viewports', async () => {
  const expected = [];
  const warnings = [];
  const originalError = console.error;
  console.error = (...args) => warnings.push(args);
  try {
    for (const icon of manifest.icons) {
      for (const style of manifest.styles) {
        const name = componentName(icon.name, style);
        expected.push(name);
        assert.ok(icons[name], `Missing ${name}`);
        const source = parse(icon.svg[style]);
        const rendered = parse(renderToStaticMarkup(createElement(icons[name])));
        const sourceIds = elements(source).map(node => node.getAttribute('id')).filter(Boolean);
        const renderedIds = elements(rendered).map(node => node.getAttribute('id')).filter(Boolean);
        assert.equal(renderedIds.length, sourceIds.length, name);
        const idMap = sourceIds.map((id, index) => {
          assert.ok(renderedIds[index].endsWith(`-${id}`), name);
          return { actual: renderedIds[index], source: id };
        });
        assert.deepEqual(canonical(rendered, idMap), canonical(source), name);
      }
    }
    assert.deepEqual(Object.keys(icons).sort(), expected.sort());
    assert.deepEqual(warnings, [], 'React emitted SVG property warnings');
  } finally {
    console.error = originalError;
  }
});

test('root, style, per-icon, and CommonJS imports resolve consistently', () => {
  assert.equal(Camera, icons.CameraRegular);
  assert.equal(CameraFilled, icons.CameraFilled);
  const common = require('@fedora-icons/react');
  assert.deepEqual(Object.keys(common).sort(), Object.keys(icons).sort());
  assert.equal(
    renderToStaticMarkup(createElement(common.CameraRegular)),
    renderToStaticMarkup(createElement(Camera)),
  );
  assert.equal(
    require('@fedora-icons/react/regular/camera').default,
    require('@fedora-icons/react/regular').CameraRegular,
  );
});

test('repeated icons have unique, locally resolving mask and clip IDs', () => {
  const svg = renderToStaticMarkup(createElement(
    Fragment,
    null,
    ...Array.from({ length: 3 }, (_, key) => createElement(icons.CreditCardPlusRegular, { key })),
  ));
  const document = new DOMParser().parseFromString(`<main>${svg}</main>`, 'text/xml');
  const allIds = Array.from(document.getElementsByTagName('*'))
    .map(node => node.getAttribute('id')).filter(Boolean);
  assert.equal(new Set(allIds).size, allIds.length);
  assert.ok(allIds.length >= 6);
  for (const root of Array.from(document.getElementsByTagName('main')[0].childNodes)) {
    const localIds = new Set(elements(root).map(node => node.getAttribute('id')).filter(Boolean));
    for (const node of elements(root)) {
      for (const attribute of Array.from(node.attributes)) {
        for (const [, id] of attribute.value.matchAll(/url\(#([^)]+)\)/g)) {
          assert.ok(localIds.has(id), `Broken local reference ${id}`);
        }
      }
    }
  }
});

test('icons are decorative by default and support titles and caller-provided labels', () => {
  let svg = parse(renderToStaticMarkup(createElement(Camera)));
  assert.equal(svg.getAttribute('aria-hidden'), 'true');
  assert.equal(svg.getAttribute('focusable'), 'false');
  assert.equal(svg.getAttribute('role'), null);
  svg = parse(renderToStaticMarkup(createElement(Camera, { title: 'A <camera> & photo' })));
  assert.equal(svg.getAttribute('role'), 'img');
  assert.equal(svg.getAttribute('aria-hidden'), null);
  const title = svg.getElementsByTagName('title')[0];
  assert.equal(title.textContent, 'A <camera> & photo');
  assert.equal(svg.getAttribute('aria-labelledby'), title.getAttribute('id'));
  svg = parse(renderToStaticMarkup(createElement(Camera, {
    title: 'Tooltip', titleId: 'camera-title', 'aria-label': 'Take a photo',
  })));
  assert.equal(svg.getAttribute('aria-label'), 'Take a photo');
  assert.equal(svg.getAttribute('aria-labelledby'), null);
  assert.equal(svg.getElementsByTagName('title')[0].getAttribute('id'), 'camera-title');
  svg = parse(renderToStaticMarkup(createElement(Camera, {
    title: 'Tooltip', 'aria-labelledby': 'external-label', role: 'presentation',
    'aria-hidden': true,
  })));
  assert.equal(svg.getAttribute('aria-labelledby'), 'external-label');
  assert.equal(svg.getAttribute('role'), 'presentation');
  assert.equal(svg.getAttribute('aria-hidden'), 'true');
});

test('size, SVG props, color roles, and style overrides reach the SVG', () => {
  const svg = parse(renderToStaticMarkup(createElement(icons.CreditCardPlusDuocolor, {
    size: '2em',
    width: 40,
    color: 'purple',
    primaryColor: 'red',
    secondaryColor: 'orange',
    modifierColor: 'green',
    className: 'example',
    'data-testid': 'icon',
    style: { '--fedora-secondary': 'pink', opacity: 0.5 },
  })));
  assert.equal(svg.getAttribute('width'), '40');
  assert.equal(svg.getAttribute('height'), '2em');
  assert.equal(svg.getAttribute('viewBox'), '0 0 24 24');
  assert.equal(svg.getAttribute('color'), 'purple');
  assert.equal(svg.getAttribute('class'), 'example');
  assert.equal(svg.getAttribute('data-testid'), 'icon');
  assert.match(svg.getAttribute('style'), /--fedora-primary:red/);
  assert.match(svg.getAttribute('style'), /--fedora-secondary:pink/);
  assert.match(svg.getAttribute('style'), /--fedora-modifier:green/);
  assert.match(svg.getAttribute('style'), /opacity:0.5/);
  const primary = parse(renderToStaticMarkup(createElement(Camera, { primaryColor: 'teal' })));
  assert.equal(primary.getAttribute('color'), 'teal');
});

test('root named imports tree-shake down to the requested icon and shared runtime', async () => {
  const result = await bundle({
    stdin: {
      contents: "export { CameraRegular } from '@fedora-icons/react';",
      resolveDir: packageRoot,
    },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    external: ['react'],
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
  const retained = Object.values(result.metafile.outputs).flatMap(output =>
    Object.entries(output.inputs)
      .filter(([name, data]) => /dist\/esm\/(regular|filled|duocolor|duotone)\/[^/]+\.js$/.test(name)
        && !name.endsWith('/index.js') && data.bytesInOutput > 0)
      .map(([name]) => name));
  assert.equal(retained.length, 1);
  assert.ok(retained[0].endsWith('/regular/camera.js'));
});

test('SVG conversion preserves presentation and namespace attributes and rejects malformed input', () => {
  const [, props, nodes] = parseSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
      + 'width="24" height="24" viewBox="0 0 24 24"><use xlink:href="#a" '
      + 'stroke-width="1.25" mask-type="luminance" aria-label="test"/></svg>',
    'fixture',
  );
  assert.equal(props.xmlns, undefined);
  assert.equal(nodes[0][1].xlinkHref, '#a');
  assert.equal(nodes[0][1].strokeWidth, '1.25');
  assert.equal(nodes[0][1]['mask-type'], 'luminance');
  assert.equal(nodes[0][1]['aria-label'], 'test');
  assert.throws(() => parseSvg('<svg><path></svg>', 'broken'));
  assert.throws(() => parseSvg('<!DOCTYPE svg><svg/>', 'broken'));
  assert.throws(() => parseSvg('<svg xmlns="http://www.w3.org/2000/svg"/>', 'broken'));
  assert.equal(componentName('4k-sparkles', 'duocolor'), 'Icon4kSparklesDuocolor');
});
