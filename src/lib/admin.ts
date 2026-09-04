/** Only these accounts can open the Admin panel / AI Studio. */
export const ADMIN_EMAILS = ["salemmoustapha15@gmail.com"] as const;

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase() as (typeof ADMIN_EMAILS)[number]);
}
