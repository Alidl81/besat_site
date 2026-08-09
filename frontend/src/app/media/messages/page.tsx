import { redirect } from "next/navigation";

export default function MediaRedirect() {
  redirect("/dashboard/content-manager/messages");
}
