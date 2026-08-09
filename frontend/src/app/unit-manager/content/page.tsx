import { redirect } from "next/navigation";

export default function UnitManagerRedirect() {
  redirect("/dashboard/content-manager/content");
}
