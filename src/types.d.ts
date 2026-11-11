import type {
  CSSProperties,
  ForwardRefExoticComponent,
  RefAttributes,
  SVGProps,
} from 'react';

export interface IconStyle extends CSSProperties {
  '--fedora-primary'?: string;
  '--fedora-secondary'?: string;
  '--fedora-modifier'?: string;
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

export type FedoraIcon = ForwardRefExoticComponent<
  IconProps & RefAttributes<SVGSVGElement>
>;
