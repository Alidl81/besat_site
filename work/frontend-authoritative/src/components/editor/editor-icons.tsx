import type { ReactNode, SVGProps } from "react";

export type EditorIconName =
  | "align-center"
  | "align-left"
  | "align-right"
  | "bold"
  | "bullet-list"
  | "check"
  | "chevron-down"
  | "chevron-left"
  | "chevron-up"
  | "close"
  | "code"
  | "divider"
  | "duplicate"
  | "fullscreen"
  | "gallery"
  | "grip"
  | "heading"
  | "image"
  | "italic"
  | "link"
  | "ordered-list"
  | "paragraph"
  | "quote"
  | "redo"
  | "strike"
  | "table"
  | "trash"
  | "underline"
  | "undo"
  | "upload";

const paths: Record<EditorIconName, ReactNode> = {
  bold: <><path d="M7 4h5.2a4 4 0 0 1 0 8H7z" /><path d="M7 12h6.2a4 4 0 0 1 0 8H7z" /></>,
  italic: <><path d="M10 4h8M6 20h8M14 4 10 20" /></>,
  underline: <><path d="M7 4v7a5 5 0 0 0 10 0V4M5 21h14" /></>,
  strike: <><path d="M17 6.5C16.1 4.8 14.2 4 12 4c-3 0-5 1.5-5 3.7 0 1.8 1.3 2.8 3.4 3.3M7 17.5c1 1.6 2.9 2.5 5 2.5 3 0 5-1.5 5-3.7 0-1.5-.9-2.5-2.5-3.1M4 12h16" /></>,
  heading: <><path d="M5 5v14M19 5v14M5 12h14" /></>,
  paragraph: <><path d="M14 20V5M18 20V5H11a4 4 0 0 0 0 8h3" /></>,
  "bullet-list": <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r=".8" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r=".8" fill="currentColor" stroke="none" /><circle cx="4.5" cy="18" r=".8" fill="currentColor" stroke="none" /></>,
  "ordered-list": <><path d="M10 6h10M10 12h10M10 18h10M4 5h2v3M4 11h2l-2 3h2M4 18c1.8-1.4 2.4 1.4 0 2h2" /></>,
  quote: <><path d="M5 11h5v7H4v-5c0-4.2 2.1-6.5 6-7M15 11h5v7h-6v-5c0-4.2 2.1-6.5 6-7" /></>,
  "align-right": <path d="M4 6h16M8 10h12M4 14h16M10 18h10" />,
  "align-center": <path d="M4 6h16M7 10h10M4 14h16M7 18h10" />,
  "align-left": <path d="M4 6h16M4 10h12M4 14h16M4 18h10" />,
  link: <><path d="M9.5 14.5 14.5 9.5" /><path d="M7.5 17.5H6a4 4 0 0 1 0-8h4M16.5 6.5H18a4 4 0 0 1 0 8h-4" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 20" /></>,
  gallery: <><rect x="5" y="5" width="15" height="15" rx="2" /><path d="M8 2h13v15M9 10h.01M5 17l4-4 3 3 2-2 6 6" /></>,
  undo: <><path d="m9 7-5 5 5 5" /><path d="M20 18a8 8 0 0 0-12-6" /></>,
  redo: <><path d="m15 7 5 5-5 5" /><path d="M4 18a8 8 0 0 1 12-6" /></>,
  table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16M15 4v16" /></>,
  divider: <path d="M3 12h18" />,
  code: <><path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14" /></>,
  grip: <><circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" /></>,
  "chevron-up": <path d="m6 15 6-6 6 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  duplicate: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  trash: <><path d="M3 6h18M9 6V3h6v3M7 6l1 15h8l1-15M10 10v7M14 10v7" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 12 4 4L19 6" />,
  upload: <><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></>,
  fullscreen: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></>,
};

type EditorIconProps = SVGProps<SVGSVGElement> & {
  name: EditorIconName;
};

export function EditorIcon({ name, className = "size-5", ...props }: EditorIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
