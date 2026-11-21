import type { SVGProps } from "react";

export type IconName =
  | "flight"
  | "rail"
  | "coach"
  | "ferry"
  | "local_transit"
  | "walking"
  | "transfer"
  | "search"
  | "swap"
  | "calendar"
  | "user"
  | "users"
  | "bag"
  | "check"
  | "alert"
  | "info"
  | "close"
  | "chevron-down"
  | "chevron-right"
  | "arrow-up"
  | "arrow-down"
  | "arrow-right"
  | "clock"
  | "moon"
  | "refresh"
  | "plus"
  | "minus"
  | "trash"
  | "ticket"
  | "download"
  | "route"
  | "receipt"
  | "home"
  | "pin"
  | "offline"
  | "sparkle"
  | "filter"
  | "shield"
  | "external";

const paths: Record<IconName, React.ReactNode> = {
  flight: (
    <path d="M10.2 13.8 4 12l-1 1 5 3 3 5 1-1-1.8-6.2L14 11l5.5 5.5 1-1-2.7-7.7 1.9-1.9a1.9 1.9 0 0 0-2.7-2.7L15.2 5 7.5 2.3l-1 1L12 8.8l-2.8 2.8" />
  ),
  rail: (
    <>
      <rect x="5" y="3" width="14" height="14" rx="3" />
      <path d="M5 11h14M9 21l-2-4M15 21l2-4M9 14h.01M15 14h.01" />
    </>
  ),
  coach: (
    <>
      <path d="M4 17V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v11" />
      <path d="M3 17h18M4 11h16M7 17v2.5M17 17v2.5M8 14h.01M16 14h.01" />
    </>
  ),
  ferry: (
    <>
      <path d="M3 18c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0" />
      <path d="M5 15 4 11h16l-1 4M7 11V7h10v4M11 7V4h2v3" />
    </>
  ),
  local_transit: (
    <>
      <rect x="6" y="5" width="12" height="12" rx="2.5" />
      <path d="M9 2h6M12 2v3M6 12h12M8 21l1.5-4M16 21l-1.5-4" />
    </>
  ),
  walking: (
    <>
      <circle cx="13" cy="4" r="1.6" />
      <path d="m9 21 2.5-6.5L14 17v4M11.5 14.5 12.5 9l-3 1.5V14M12.5 9l2.5 2.5 2.5.5" />
    </>
  ),
  transfer: <path d="M4 8h13l-3-3M20 16H7l3 3" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </>
  ),
  swap: <path d="M7 4v16l-3-3M17 20V4l3 3" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0M15.5 4.9a3.2 3.2 0 0 1 0 6.2M17.5 14.3A6 6 0 0 1 21 20" />
    </>
  ),
  bag: (
    <>
      <rect x="5" y="7" width="14" height="13" rx="2.5" />
      <path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M9 11v5M15 11v5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: (
    <>
      <path d="M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "arrow-up": <path d="M12 19V5M6 11l6-6 6 6" />,
  "arrow-down": <path d="M12 5v14M6 13l6 6 6-6" />,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />,
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" />
      <path d="M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  trash: (
    <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />
  ),
  ticket: (
    <>
      <path d="M3.5 8V6.5a1.5 1.5 0 0 1 1.5-1.5h14a1.5 1.5 0 0 1 1.5 1.5V8a2.5 2.5 0 0 0 0 5v1.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V13a2.5 2.5 0 0 0 0-5Z" transform="translate(0 2)" />
      <path d="M14 7v2M14 12v2M14 17v2" />
    </>
  ),
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />,
  route: (
    <>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" />
    </>
  ),
  receipt: (
    <path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5V3ZM9 8h6M9 12h6M9 16h3" />
  ),
  home: <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4v-9.5Z" />,
  pin: (
    <>
      <path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  offline: (
    <path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4.2-2.6M19 13a10 10 0 0 0-2.4-1.6M2 9.5a15 15 0 0 1 4.4-2.7M22 9.5A15 15 0 0 0 11 5.1M12 20h.01" />
  ),
  sparkle: (
    <path d="M12 3.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5ZM18.5 16c.3 1.6 1 2.3 2.5 2.5-1.5.2-2.2.9-2.5 2.5-.3-1.6-1-2.3-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5Z" />
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  shield: (
    <>
      <path d="M12 3 5 6v5.5c0 4.2 3 7.8 7 9.5 4-1.7 7-5.3 7-9.5V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
};

export function Icon({
  name,
  size = 20,
  title,
  ...rest
}: { name: IconName; size?: number; title?: string } & Omit<
  SVGProps<SVGSVGElement>,
  "name"
>) {
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
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {paths[name]}
    </svg>
  );
}
