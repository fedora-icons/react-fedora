import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));

test('the packed npm artifact works independently for ESM, CommonJS, and TypeScript consumers', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'fedora-react-consumer-'));
  try {
    const output = execFileSync('npm', [
      'pack', '--json', '--ignore-scripts', '--pack-destination', temporary,
    ], { cwd: packageRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    const [packed] = JSON.parse(output);
    assert.ok(packed.files.some(file => file.path === 'LICENSE'));
    assert.ok(packed.files.some(file => file.path === 'README.md'));
    assert.ok(packed.files.every(file => !/^(src|scripts|tests|node_modules)\//.test(file.path)));
    execFileSync('tar', ['-xzf', path.join(temporary, packed.filename), '-C', temporary]);
    const scope = path.join(temporary, 'node_modules/@fedora-icons');
    await mkdir(scope, { recursive: true });
    await rename(path.join(temporary, 'package'), path.join(scope, 'react'));
    for (const dependency of ['react', 'react-dom', '@types']) {
      await symlink(path.join(packageRoot, 'node_modules', dependency),
        path.join(temporary, 'node_modules', dependency), 'dir');
    }
    await writeFile(path.join(temporary, 'package.json'), '{"type":"module"}');
    await writeFile(path.join(temporary, 'consumer.mjs'), `
      import assert from 'node:assert/strict';
      import { createElement } from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { CameraRegular } from '@fedora-icons/react';
      import Camera from '@fedora-icons/react/regular/camera';
      assert.equal(Camera, CameraRegular);
      assert.match(renderToStaticMarkup(createElement(Camera)), /viewBox="0 0 24 24"/);
    `);
    await writeFile(path.join(temporary, 'consumer.cjs'), `
      const assert = require('node:assert/strict');
      const { createElement } = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { CameraFilled } = require('@fedora-icons/react/filled');
      const Camera = require('@fedora-icons/react/filled/camera').default;
      assert.equal(Camera, CameraFilled);
      assert.match(renderToStaticMarkup(createElement(Camera)), /viewBox="0 0 24 24"/);
    `);
    for (const extension of ['mjs', 'cjs']) {
      execFileSync(process.execPath, [`consumer.${extension}`], { cwd: temporary, stdio: 'pipe' });
    }
    await writeFile(path.join(temporary, 'consumer.tsx'), `
      import { createRef } from 'react';
      import { CameraRegular, type IconProps } from '@fedora-icons/react';
      import Camera from '@fedora-icons/react/regular/camera';
      const props: IconProps = { size: 32, style: { '--fedora-primary': 'red' } };
      const ref = createRef<SVGSVGElement>();
      export const example = <><CameraRegular {...props} ref={ref} /><Camera title="Camera" /></>;
    `);
    await writeFile(path.join(temporary, 'consumer.cts'), `
      import icons = require('@fedora-icons/react');
      import camera = require('@fedora-icons/react/duotone/camera');
      import React = require('react');
      export const example = React.createElement(icons.CameraDuotone, { size: 32 });
      export const same: typeof icons.CameraDuotone = camera.default;
    `);
    execFileSync(process.execPath, [
      path.join(packageRoot, 'node_modules/typescript/bin/tsc'),
      '--noEmit', '--strict', '--skipLibCheck', '--module', 'NodeNext',
      '--target', 'ES2022', '--jsx', 'react-jsx', 'consumer.tsx', 'consumer.cts',
    ], { cwd: temporary, stdio: 'pipe' });
    const license = await readFile(path.join(scope, 'react/LICENSE'), 'utf8');
    assert.match(license, /MIT License/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
