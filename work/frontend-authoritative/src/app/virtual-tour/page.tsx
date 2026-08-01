import type { Metadata } from "next";
import { VirtualTourLobby } from "@/components/virtual-tour/virtual-tour-lobby";

export const metadata: Metadata = {
  title: "تور مجازی | مجتمع آموزشی بعثت",
  description: "لابی تور مجازی واحدها و دپارتمان‌های مجتمع آموزشی بعثت",
};

export default function VirtualTourPage() {
  return <VirtualTourLobby />;
}
