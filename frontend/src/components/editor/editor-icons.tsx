import { Icon, type IconProps } from "@iconify/react";
import type { IconifyIcon } from "@iconify/types";
import alertCircle from "@iconify-icons/tabler/alert-circle";
import alertTriangle from "@iconify-icons/tabler/alert-triangle";
import alignCenter from "@iconify-icons/tabler/align-center";
import alignLeft from "@iconify-icons/tabler/align-left";
import alignRight from "@iconify-icons/tabler/align-right";
import bold from "@iconify-icons/tabler/bold";
import bulletList from "@iconify-icons/tabler/list";
import check from "@iconify-icons/tabler/check";
import chevronDown from "@iconify-icons/tabler/chevron-down";
import chevronLeft from "@iconify-icons/tabler/chevron-left";
import chevronUp from "@iconify-icons/tabler/chevron-up";
import circleCheck from "@iconify-icons/tabler/circle-check";
import close from "@iconify-icons/tabler/x";
import code from "@iconify-icons/tabler/code";
import divider from "@iconify-icons/tabler/separator-horizontal";
import duplicate from "@iconify-icons/tabler/copy";
import fullscreen from "@iconify-icons/tabler/maximize";
import gallery from "@iconify-icons/tabler/photo-video";
import grip from "@iconify-icons/tabler/grip-vertical";
import heading from "@iconify-icons/tabler/heading";
import image from "@iconify-icons/tabler/photo";
import italic from "@iconify-icons/tabler/italic";
import link from "@iconify-icons/tabler/link";
import orderedList from "@iconify-icons/tabler/list-numbers";
import paragraph from "@iconify-icons/tabler/pilcrow";
import quote from "@iconify-icons/tabler/quote";
import redo from "@iconify-icons/tabler/arrow-forward-up";
import search from "@iconify-icons/tabler/search";
import strike from "@iconify-icons/tabler/strikethrough";
import table from "@iconify-icons/tabler/table";
import trash from "@iconify-icons/tabler/trash";
import underline from "@iconify-icons/tabler/underline";
import undo from "@iconify-icons/tabler/arrow-back-up";
import upload from "@iconify-icons/tabler/upload";

export type EditorIconName =
  | "alert-circle"
  | "alert-triangle"
  | "align-center"
  | "align-left"
  | "align-right"
  | "bold"
  | "bullet-list"
  | "check"
  | "chevron-down"
  | "chevron-left"
  | "chevron-up"
  | "circle-check"
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
  | "search"
  | "strike"
  | "table"
  | "trash"
  | "underline"
  | "undo"
  | "upload";

const icons: Record<EditorIconName, IconifyIcon> = {
  "alert-circle": alertCircle,
  "alert-triangle": alertTriangle,
  "align-center": alignCenter,
  "align-left": alignLeft,
  "align-right": alignRight,
  bold,
  "bullet-list": bulletList,
  check,
  "chevron-down": chevronDown,
  "chevron-left": chevronLeft,
  "chevron-up": chevronUp,
  "circle-check": circleCheck,
  close,
  code,
  divider,
  duplicate,
  fullscreen,
  gallery,
  grip,
  heading,
  image,
  italic,
  link,
  "ordered-list": orderedList,
  paragraph,
  quote,
  redo,
  search,
  strike,
  table,
  trash,
  underline,
  undo,
  upload,
};

type EditorIconProps = Omit<IconProps, "icon"> & {
  name: EditorIconName;
};

export function EditorIcon({ name, className = "size-5", ...props }: EditorIconProps) {
  return <Icon icon={icons[name]} aria-hidden="true" className={className} {...props} />;
}
