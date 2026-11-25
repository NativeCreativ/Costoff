import { redirect } from "next/navigation";

/**
 * The self-service reset page was removed (security fix, 25 Nov 2026): it set a new password for
 * any email typed in. Old links land on the explanation page instead.
 */
export default function ResetPasswordPage() {
  redirect("/forgot-password");
}
