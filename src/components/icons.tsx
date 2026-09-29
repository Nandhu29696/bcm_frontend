import type { SVGProps } from 'react'

/**
 * A small inline icon set. Inline SVG rather than an icon library: a dozen
 * glyphs do not justify a dependency, and inlining keeps them themeable
 * through `currentColor`.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 18, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export const IconBuildings = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01M9 14h.01M15 14h.01" />
  </Icon>
)
export const IconClipboard = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <path d="M9 4V3h6v1M9 11h6M9 15h4" />
  </Icon>
)
export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 2.5 20h19L12 3zM12 10v4M12 17.5h.01" />
  </Icon>
)
export const IconHelp = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01" />
  </Icon>
)
export const IconUsers = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4.5-6.2" />
  </Icon>
)
export const IconShield = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 4 6v6c0 4.5 3.4 7.8 8 9 4.6-1.2 8-4.5 8-9V6l-8-3z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
)
export const IconLogout = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9" />
  </Icon>
)
export const IconChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
)
export const IconChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
)
export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4-4" />
  </Icon>
)
export const IconEye = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
    <circle cx="12" cy="12" r="2.5" />
  </Icon>
)
export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)
export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)
export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12 5 5L20 7" />
  </Icon>
)
export const IconComment = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4V5.5z" />
  </Icon>
)
export const IconMore = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="6" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="18" cy="12" r="1.2" fill="currentColor" />
  </Icon>
)
export const IconEdit = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5z" />
    <path d="m13.5 7 3.5 3.5M14 4l1-1a2.12 2.12 0 0 1 3 3l-1 1" />
  </Icon>
)
export const IconInbox = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 13V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7M4 13h4l1.5 3h5L16 13h4v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5z" />
  </Icon>
)
export const IconArrowLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
)
export const IconChart = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icon>
)
export const IconFile = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </Icon>
)
export const IconBell = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </Icon>
)
export const IconUser = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Icon>
)
export const IconActivity = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12h4l3-8 4 16 3-8h4" />
  </Icon>
)

/** The brand mark: a rounded tile with a "B". */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="url(#bcm-mark)" />
      <path
        d="M10 22V10h6.6c2.5 0 4 1.2 4 3.1 0 1.2-.6 2.1-1.7 2.5 1.5.4 2.4 1.5 2.4 2.9 0 2.2-1.7 3.5-4.3 3.5H10zm2.8-7h3.3c1 0 1.6-.5 1.6-1.4 0-.8-.6-1.3-1.6-1.3h-3.3v2.7zm0 4.7h3.8c1.1 0 1.7-.6 1.7-1.5s-.6-1.5-1.7-1.5h-3.8v3z"
        fill="#fff"
      />
      <defs>
        <linearGradient id="bcm-mark" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#5b5bd6" />
          <stop offset="1" stopColor="#2f2a86" />
        </linearGradient>
      </defs>
    </svg>
  )
}
