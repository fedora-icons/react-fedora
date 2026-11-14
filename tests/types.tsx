import { createRef } from 'react';
import { CameraRegular, type FosIcon, type IconProps } from '@fos-icons/react';
import Camera from '@fos-icons/react/regular/camera';
import { CameraDuotone } from '@fos-icons/react/duotone';

const props: IconProps = {
  size: '1em',
  primaryColor: 'red',
  secondaryColor: 'blue',
  modifierColor: 'green',
  style: { '--fos-primary': 'purple', opacity: 0.8 },
};
const ref = createRef<SVGSVGElement>();
const component: FosIcon = Camera;
export const examples = <>
  <CameraRegular {...props} ref={ref} title="Take photo" onClick={event => event.currentTarget.focus()} />
  <CameraDuotone size={32} aria-label="Camera" />
  <Camera width={40} height={40} />
</>;
export { component };

// @ts-expect-error Size must be a number or CSS length.
export const invalidSize = <Camera size={{ width: 24 }} />;
// @ts-expect-error Refs must target SVG elements.
export const invalidRef = <Camera ref={createRef<HTMLDivElement>()} />;
// @ts-expect-error Unknown icon-specific props are not accepted.
export const invalidProp = <Camera unexpectedProp />;
