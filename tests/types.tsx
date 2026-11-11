import { createRef } from 'react';
import { CameraRegular, type FedoraIcon, type IconProps } from '@fedora-icons/react';
import Camera from '@fedora-icons/react/regular/camera';
import { CameraDuotone } from '@fedora-icons/react/duotone';

const props: IconProps = {
  size: '1em',
  primaryColor: 'red',
  secondaryColor: 'blue',
  modifierColor: 'green',
  style: { '--fedora-primary': 'purple', opacity: 0.8 },
};
const ref = createRef<SVGSVGElement>();
const component: FedoraIcon = Camera;
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
