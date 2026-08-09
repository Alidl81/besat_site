import { redirect } from "next/navigation";

export default function UnitManagerRedirect() {
  redirect("/dashboard/admin/students");
}
