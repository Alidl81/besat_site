import { Icon, type IconProps } from "@iconify/react";
import type { IconifyIcon } from "@iconify/types";
import albums from "@iconify-icons/tabler/photo";
import bell from "@iconify-icons/tabler/bell";
import building from "@iconify-icons/tabler/building";
import calendar from "@iconify-icons/tabler/calendar-event";
import cash from "@iconify-icons/tabler/cash";
import chart from "@iconify-icons/tabler/chart-bar";
import check from "@iconify-icons/tabler/check";
import chevron from "@iconify-icons/tabler/chevron-left";
import children from "@iconify-icons/tabler/users-group";
import clipboard from "@iconify-icons/tabler/clipboard-list";
import close from "@iconify-icons/tabler/x";
import dashboard from "@iconify-icons/tabler/layout-dashboard";
import document from "@iconify-icons/tabler/file-description";
import download from "@iconify-icons/tabler/download";
import edit from "@iconify-icons/tabler/edit";
import eye from "@iconify-icons/tabler/eye";
import file from "@iconify-icons/tabler/file-text";
import filter from "@iconify-icons/tabler/filter";
import globe from "@iconify-icons/tabler/world";
import graduationCap from "@iconify-icons/tabler/school";
import heart from "@iconify-icons/tabler/heart";
import image from "@iconify-icons/tabler/photo";
import link from "@iconify-icons/tabler/link";
import mail from "@iconify-icons/tabler/mail";
import media from "@iconify-icons/tabler/video";
import megaphone from "@iconify-icons/tabler/speakerphone";
import menu from "@iconify-icons/tabler/menu-2";
import message from "@iconify-icons/tabler/message";
import more from "@iconify-icons/tabler/dots";
import news from "@iconify-icons/tabler/news";
import packageBox from "@iconify-icons/tabler/package";
import plus from "@iconify-icons/tabler/plus";
import profile from "@iconify-icons/tabler/user-circle";
import programs from "@iconify-icons/tabler/calendar-event";
import registration from "@iconify-icons/tabler/clipboard-check";
import review from "@iconify-icons/tabler/file-check";
import search from "@iconify-icons/tabler/search";
import services from "@iconify-icons/tabler/apps";
import settings from "@iconify-icons/tabler/settings";
import shop from "@iconify-icons/tabler/shopping-bag";
import staff from "@iconify-icons/tabler/user";
import students from "@iconify-icons/tabler/users";
import trash from "@iconify-icons/tabler/trash";
import truck from "@iconify-icons/tabler/truck-delivery";
import units from "@iconify-icons/tabler/building-community";
import users from "@iconify-icons/tabler/users-group";
import view360 from "@iconify-icons/tabler/view-360";
import warning from "@iconify-icons/tabler/alert-triangle";

export type PanelIconName =
  | "albums"
  | "bell"
  | "building"
  | "calendar"
  | "cash"
  | "chart"
  | "check"
  | "chevron"
  | "children"
  | "clipboard"
  | "close"
  | "dashboard"
  | "document"
  | "download"
  | "edit"
  | "eye"
  | "file"
  | "filter"
  | "globe"
  | "graduationCap"
  | "heart"
  | "image"
  | "link"
  | "mail"
  | "media"
  | "megaphone"
  | "menu"
  | "message"
  | "more"
  | "news"
  | "packageBox"
  | "plus"
  | "profile"
  | "programs"
  | "registration"
  | "review"
  | "search"
  | "services"
  | "settings"
  | "shop"
  | "staff"
  | "students"
  | "trash"
  | "truck"
  | "units"
  | "users"
  | "virtualTour"
  | "warning";

const icons: Record<PanelIconName, IconifyIcon> = {
  albums,
  bell,
  building,
  calendar,
  cash,
  chart,
  check,
  chevron,
  children,
  clipboard,
  close,
  dashboard,
  document,
  download,
  edit,
  eye,
  file,
  filter,
  globe,
  graduationCap,
  heart,
  image,
  link,
  mail,
  media,
  megaphone,
  menu,
  message,
  more,
  news,
  packageBox,
  plus,
  profile,
  programs,
  registration,
  review,
  search,
  services,
  settings,
  shop,
  staff,
  students,
  trash,
  truck,
  units,
  users,
  virtualTour: view360,
  warning,
};

type PanelIconProps = Omit<IconProps, "icon"> & {
  name: PanelIconName;
};

export function PanelIcon({ name, className = "size-5", ...props }: PanelIconProps) {
  return <Icon icon={icons[name]} aria-hidden="true" className={className} {...props} />;
}
