import type { ReactNode, SVGProps } from "react";

export type PanelIconName =
  | "albums"
  | "bell"
  | "building"
  | "calendar"
  | "chart"
  | "check"
  | "chevron"
  | "children"
  | "clipboard"
  | "dashboard"
  | "document"
  | "download"
  | "edit"
  | "eye"
  | "file"
  | "filter"
  | "globe"
  | "heart"
  | "image"
  | "link"
  | "mail"
  | "media"
  | "megaphone"
  | "message"
  | "more"
  | "news"
  | "plus"
  | "profile"
  | "programs"
  | "registration"
  | "review"
  | "search"
  | "services"
  | "settings"
  | "staff"
  | "students"
  | "trash"
  | "units"
  | "users"
  | "warning";

const paths: Record<PanelIconName, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  megaphone: <><path d="m3 11 14-6v14L3 13z" /><path d="M11.6 16.7 13 21H8l-1.8-6" /><path d="M21 9v6" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20V7" /><path d="M2 20h21" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  units: <><path d="M3 21V8l9-5 9 5v13" /><path d="M9 21v-7h6v7M7 10h.01M12 10h.01M17 10h.01" /></>,
  building: <><path d="M4 21V4h10v17M14 9h6v12M8 8h2M8 12h2M8 16h2M17 13h.01M17 17h.01M2 21h20" /></>,
  students: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 21v-2.5A5.5 5.5 0 0 1 8 13h2a5.5 5.5 0 0 1 5.5 5.5V21" /><path d="M16 5.5a3 3 0 0 1 0 5.8M17 14a4.5 4.5 0 0 1 4.5 4.5V21" /></>,
  staff: <><circle cx="12" cy="7" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
  file: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5M9 12h6M9 16h6" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="18" rx="2" /><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4" /></>,
  users: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="8" r="3" /><path d="M2 20v-2a5 5 0 0 1 10 0v2M12 20v-2a5 5 0 0 1 10 0v2" /></>,
  message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 22a8 8 0 0 1 16 0" /></>,
  news: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h4v4H7zM14 8h3M14 12h3M7 16h10" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  media: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m10 9 5 3-5 3z" /></>,
  albums: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 2h12v14M8 10h.01M4 17l5-5 4 4 2-2 5 5" /></>,
  review: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h3M14.5 15.5l1.3 1.3 2.7-3" /></>,
  services: <><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" /><path d="M17 14v6M14 17h6" /></>,
  children: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2 21a6 6 0 0 1 12 0M13 21a5 5 0 0 1 9 0" /></>,
  programs: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>,
  registration: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3V1h6v2M9 9h6M9 13h4M15 17h4M17 15v4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  edit: <><path d="M12 20h9" /><path d="m16.5 3.5 4 4L8 20H4v-4z" /></>,
  trash: <><path d="M3 6h18M8 6V3h8v3M7 6l1 15h8l1-15M10 10v7M14 10v7" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></>,
  document: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5M9 11h6M9 15h6" /></>,
  warning: <><path d="M12 3 2.5 20h19z" /><path d="M12 9v5M12 17h.01" /></>,
};

type PanelIconProps = SVGProps<SVGSVGElement> & {
  name: PanelIconName;
};

export function PanelIcon({ name, className = "size-5", ...props }: PanelIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
