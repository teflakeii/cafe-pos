import { redirect } from "next/navigation";

// Legacy in-POS menu admin removed. Menu management lives in the dedicated admin app.
export default function LegacyAdminMenuRedirect() {
  redirect("/pos");
}
