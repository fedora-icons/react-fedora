'use client';

import { createElement, forwardRef, useId } from 'react';

function scopeProps(props, prefix) {
  const scoped = {};
  for (const [name, value] of Object.entries(props)) {
    if (name === 'id') {
      scoped.id = `${prefix}-${value}`;
    } else if (typeof value === 'string') {
      scoped[name] = value.replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`);
      if ((name === 'href' || name === 'xlinkHref') && value.startsWith('#')) {
        scoped[name] = `#${prefix}-${value.slice(1)}`;
      }
    } else {
      scoped[name] = value;
    }
  }
  return scoped;
}

function renderNode([tag, props, children], prefix, key) {
  return createElement(
    tag,
    { ...scopeProps(props, prefix), key },
    ...children.map((child, index) => renderNode(child, prefix, index)),
  );
}

export function createIcon(name, rootProps, nodes) {
  const Icon = forwardRef(function FedoraIcon(
    {
      size = 24,
      color,
      primaryColor,
      secondaryColor,
      modifierColor,
      title,
      titleId,
      style,
      children,
      ...props
    },
    ref,
  ) {
    const prefix = `fedora-${useId()}`;
    const hasName = Boolean(title || props['aria-label'] || props['aria-labelledby']);
    const labelledBy = title && !props['aria-label'] && !props['aria-labelledby']
      ? titleId ?? `${prefix}-title`
      : props['aria-labelledby'];
    const mergedStyle = {
      ...(primaryColor != null && { '--fedora-primary': primaryColor }),
      ...(secondaryColor != null && { '--fedora-secondary': secondaryColor }),
      ...(modifierColor != null && { '--fedora-modifier': modifierColor }),
      ...style,
    };

    return createElement(
      'svg',
      {
        ...scopeProps(rootProps, prefix),
        width: size,
        height: size,
        focusable: false,
        ...(hasName ? { role: 'img' } : { 'aria-hidden': true }),
        ...props,
        ...(color != null || primaryColor != null
          ? { color: color ?? primaryColor }
          : {}),
        ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
        ...(Object.keys(mergedStyle).length ? { style: mergedStyle } : {}),
        ref,
      },
      title ? createElement('title', { id: titleId ?? `${prefix}-title` }, title) : null,
      ...nodes.map((node, index) => renderNode(node, prefix, index)),
      children,
    );
  });
  Icon.displayName = name;
  return Icon;
}
