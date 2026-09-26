import type { SVGProps } from 'react';

/**
 * Inline icons.
 *
 * Inline rather than an icon package: these are the only ones the landing page
 * needs, they inherit `currentColor`, and a dependency for six glyphs is the
 * kind of weight §7 says not to add without need.
 *
 * All are decorative. Each is aria-hidden and focusable={false} — a screen
 * reader announcing "graphic" beside a label that already says "Scripture"
 * is noise (§32).
 */
type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...rest }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** The Scrinode mark: an open leaf, for Scripture and growth. */
export function LeafMark(props: IconProps) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M11.4 21.5V12.2C8.9 9.4 5.6 7.9 2.1 7.6c.2 4.9 3.7 9 8.4 9.9v4h.9Z" opacity="0.75" />
      <path d="M12.6 21.5v-4c4.7-.9 8.2-5 8.4-9.9-3.5.3-6.8 1.8-9.3 4.6v9.3h.9Z" />
    </svg>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 6.5C10.5 5 8.5 4.3 6 4.3H3.5v13H6c2.5 0 4.5.7 6 2.2" />
      <path d="M12 6.5c1.5-1.5 3.5-2.2 6-2.2h2.5v13H18c-2.5 0-4.5.7-6 2.2" />
      <path d="M12 6.5v13" />
    </Icon>
  );
}

export function StudyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4 2.5 8.6 12 13.2l9.5-4.6L12 4Z" />
      <path d="M6.5 11v4.6c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6V11" />
    </Icon>
  );
}

/** Zedek. A four-point star: light, not magic. */
export function ZedekIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.2c.5 4.4 4.4 8.3 8.8 8.8-4.4.5-8.3 4.4-8.8 8.8-.5-4.4-4.4-8.3-8.8-8.8 4.4-.5 8.3-4.4 8.8-8.8Z" />
    </Icon>
  );
}

export function WorkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8.2" r="3" />
      <path d="M3.2 19.2c0-2.9 2.6-5.2 5.8-5.2s5.8 2.3 5.8 5.2" />
      <path d="M16.2 6.1a3 3 0 0 1 0 5.9" />
      <path d="M17.6 14.4c1.9.6 3.2 2.3 3.2 4.3" />
    </Icon>
  );
}

export function LibraryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.2 4.5h3.1v15H4.2z" />
      <path d="M9.4 4.5h3.1v15H9.4z" />
      <path d="m15 5.4 3 .8-3.6 13.5-3-.8z" />
    </Icon>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.8" y="5.2" width="18.4" height="13.6" rx="2.2" />
      <path d="m3.6 7 7.3 5.3c.7.5 1.6.5 2.2 0L20.4 7" />
    </Icon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M18 9.4a6 6 0 1 0-12 0c0 5-2 6.4-2 6.4h16s-2-1.4-2-6.4Z" />
      <path d="M13.7 19.2a2 2 0 0 1-3.4 0" />
    </Icon>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 12h14" />
      <path d="m13 6.5 5.5 5.5L13 17.5" />
    </Icon>
  );
}
