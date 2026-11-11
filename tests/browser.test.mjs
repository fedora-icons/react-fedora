import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement, createRef, Fragment } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { CameraRegular, CreditCardPlusRegular } from '@fedora-icons/react';

async function withDocument(run) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true });
  const globals = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'];
  const descriptors = globals.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  try {
    await run(dom.window.document.getElementById('root'), dom.window);
  } finally {
    globals.forEach((name, index) => {
      if (descriptors[index]) Object.defineProperty(globalThis, name, descriptors[index]);
      else delete globalThis[name];
    });
    dom.window.close();
  }
}

test('refs target the SVG and normal event handlers remain usable', async () => {
  await withDocument(async (container, window) => {
    const ref = createRef();
    let clicks = 0;
    const root = createRoot(container);
    try {
      await act(async () => root.render(createElement(CameraRegular, {
        ref, onClick: () => { clicks += 1; }, 'aria-label': 'Camera',
      })));
      assert.equal(ref.current, container.querySelector('svg'));
      assert.equal(ref.current.namespaceURI, 'http://www.w3.org/2000/svg');
      await act(async () => ref.current.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
      assert.equal(clicks, 1);
    } finally {
      await act(async () => root.unmount());
    }
  });
});

test('server-rendered titles and mask IDs survive hydration without collisions or warnings', async () => {
  await withDocument(async container => {
    const element = createElement(
      Fragment,
      null,
      createElement(CreditCardPlusRegular, { title: 'Add card' }),
      createElement(CreditCardPlusRegular, { title: 'Another card' }),
    );
    container.innerHTML = renderToString(element);
    const before = container.innerHTML;
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => errors.push(args);
    let root;
    try {
      await act(async () => {
        root = hydrateRoot(container, element, {
          onRecoverableError: error => errors.push(error),
        });
      });
      assert.equal(container.innerHTML, before);
      const ids = [...container.querySelectorAll('[id]')].map(node => node.id);
      assert.equal(ids.length, new Set(ids).size);
      assert.deepEqual(errors, []);
      for (const svg of container.children) {
        assert.ok(svg.querySelector('title'));
        assert.equal(svg.getAttribute('aria-labelledby'), svg.querySelector('title').id);
      }
    } finally {
      if (root) await act(async () => root.unmount());
      console.error = originalError;
    }
  });
});
