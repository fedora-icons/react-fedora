# React Fedora Icons

Fedora Icons for React: an open-source SVG icon library in **Regular, Filled,
Duocolor, and Duotone**. Drawn on a 24 x 24 grid, with 1.25px line strokes and
transparent cutouts.

TypeScript declarations, tree-shakeable ESM exports, CommonJS imports, and SVG
refs are included. React 18 and 19 are supported; React is not bundled.

## Installation

**Not yet published to npm.** Build a local package from this repository:

```sh
git clone https://github.com/fedora-icons/react-fedora.git
cd react-fedora
npm ci
npm pack
```

In your application:

```sh
npm install /absolute/path/to/react-fedora/fedora-icons-react-0.1.0.tgz
```

After the first npm release, the installation command will be:

```sh
npm install @fedora-icons/react
```

## Usage

```tsx
import { CameraRegular } from '@fedora-icons/react';

export default function App() {
  return <CameraRegular color="currentColor" size={24} />;
}
```

For an icon-only button, give the button an accessible name:

```tsx
import { CameraRegular } from '@fedora-icons/react';

export function PhotoButton() {
  return (
    <button type="button" aria-label="Take a photo">
      <CameraRegular size={24} />
    </button>
  );
}
```

## Four styles

```tsx
import {
  CameraRegular,
  CameraFilled,
  CameraDuocolor,
  CameraDuotone,
} from '@fedora-icons/react';

<CameraRegular />;
<CameraFilled />;
<CameraDuocolor />;
<CameraDuotone />;
```

Canonical names become PascalCase with a style suffix: `fuel-pump` becomes
`FuelPumpRegular`, `FuelPumpFilled`, `FuelPumpDuocolor`, or `FuelPumpDuotone`.
All four styles are separate components, not runtime variants.

## Imports

Root ESM exports are tree-shakeable. Style and individual-icon entry points
are also available, including matching TypeScript and CommonJS exports:

```tsx
import { CameraFilled } from '@fedora-icons/react/filled';
import Camera from '@fedora-icons/react/regular/camera';
```

```js
const { CameraRegular } = require('@fedora-icons/react');
```

The components are client components that also support server rendering and
hydration. They do not use the DOM during render. In React Server Component
frameworks, their `'use client'` boundary is retained.

## Size, color, and refs

```tsx
import { createRef } from 'react';
import { CameraRegular, CameraDuocolor } from '@fedora-icons/react';
import type { IconProps } from '@fedora-icons/react';

const ref = createRef<SVGSVGElement>();
const props: IconProps = { size: 32, color: 'currentColor' };

<CameraRegular {...props} ref={ref} className="camera" />;
<CameraDuocolor
  size="2em"
  primaryColor="#245B9E"
  secondaryColor="#60A5FA"
/>;
```

`size` defaults to 24 and sets both dimensions. Explicit `width` and `height`
override it. Preserve equal dimensions for the intended square canvas.
Sizing scales the original artwork; it does not select a separately drawn
optical size. Native SVG props, event handlers, and SVG refs are supported.

Regular and Filled inherit `currentColor`. Duo styles retain their original
blue defaults. `color` or `primaryColor` can override the primary color;
`color` takes precedence when both are supplied. `secondaryColor` controls
duo accents. Presets with an independent glyph color accept `modifierColor`.
Other glyphs keep the paint roles encoded in their source SVGs.

The existing CSS variables work on the SVG or an ancestor:

```tsx
<CameraDuocolor
  style={{
    '--fedora-primary': '#245B9E',
    '--fedora-secondary': '#60A5FA',
  }}
/>;
```

Inline `style` values override custom properties supplied by the color props.
Strokes, fills, masks, and nested SVG viewports are preserved rather than
overwritten globally. Definition IDs are scoped per rendered instance to
avoid collisions when the same masked icon appears more than once.

## Accessibility

Icons are decorative by default (`aria-hidden="true"`, `focusable="false"`).
Label the containing button or link for icon-only controls.

For a meaningful standalone icon, provide `title`, `aria-label`, or
`aria-labelledby`:

```tsx
<CameraRegular title="Photography" />;
<CameraRegular aria-label="Photography" />;
<CameraRegular aria-labelledby="photography-heading" />;
```

`title` creates an escaped SVG title and a unique associated ID. `titleId`
can supply an explicit ID; ensure custom IDs are unique. Explicit ARIA labels
take precedence over the generated title association. Caller-provided
`role` and `aria-hidden` remain authoritative.

## Source and development

The canonical artwork lives in `fedora-icons/fedora-icons`; this repository
owns the React API, build, tests, and releases. Do not edit icon paths here.
Figma-only changes are not included until their canonical SVGs are synchronized.

Until the core library has a package dependency, `source/icons.json` contains
an explicit snapshot of its SVGs. `source/lock.json` records the originating
Git revision, whether local changes were included, and manifest/snapshot
SHA-256 digests. The snapshot can be built without the core checkout or network
access.

To synchronize a local core checkout and verify the package:

```sh
npm run sync -- --source ../fedora-icons
npm test
npm pack
```

Review and commit snapshot changes alongside the lock file. The initial
snapshot includes local core changes, not just its published release.

`npm run build` verifies the snapshot and per-SVG SHA-256 digests, then generates
ESM, CommonJS, and declarations for all four styles. Generated output is ignored
by git. Building requires Node.js 20 or later; consumers do not need the XML
parser, SVG snapshot, or build scripts.

`npm test` builds the package and checks all components against their source
SVGs, repeated-instance IDs, accessibility, props, refs, events, hydration,
tree-shaking, TypeScript, and an isolated packed-package consumer.

Rebuild after synchronizing SVG changes. The package does not generate
animation, runtime modifier composition, a website, or a dynamic icon-name
registry; existing named modifier icons are exported like every other icon.

## License

MIT. The original Fedora Icons license is included in every package.
