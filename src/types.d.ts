import type {
  CSSProperties,
  ForwardRefExoticComponent,
  RefAttributes,
  SVGProps,
} from 'react';

export interface IconStyle extends CSSProperties {
  '--fos-primary'?: string;
  '--fos-secondary'?: string;
  '--fos-modifier'?: string;
}

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref' | 'style'> {
  size?: number | string;
  primaryColor?: string;
  secondaryColor?: string;
  modifierColor?: string;
  title?: string;
  titleId?: string;
  style?: IconStyle;
}

export type FosIcon = ForwardRefExoticComponent<
  IconProps & RefAttributes<SVGSVGElement>
>;
