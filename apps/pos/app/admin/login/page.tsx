import { redirect } from "next/navigation";

// Legacy PIN-based admin login removed. Admin lives in the dedicated admin app.
// POS users authenticate via the real POS login.
export default function LegacyAdminLoginRedirect() {
  redirect("/pos/login");
}
