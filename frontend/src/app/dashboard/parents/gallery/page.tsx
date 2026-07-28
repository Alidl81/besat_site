import { redirect } from "next/navigation";

export default function RemovedParentGalleryPage() {
  redirect("/dashboard/parents");
}
