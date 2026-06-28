import { redirect } from "next/navigation";

export default function UnitManagerRedirect() {
  redirect("/dashboard/unit-manager/attendance");
}
