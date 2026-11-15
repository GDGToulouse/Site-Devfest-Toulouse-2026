// Shared by the tier import (#637) and the attendee import (#638).
export const BILLETWEB_API = "https://www.billetweb.fr/api";

export function getBilletwebParams(): URLSearchParams | null {
  const user = process.env.BILLETWEB_USER;
  const key = process.env.BILLETWEB_KEY;
  if (!user || !key) return null;
  return new URLSearchParams({ user, key, version: "1" });
}
