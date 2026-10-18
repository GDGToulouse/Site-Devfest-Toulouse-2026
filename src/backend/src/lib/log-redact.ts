// Request URLs as they are logged. A speaker's edit link (30 days), a sponsor
// invitation (7 days), a brochure link, a password reset and a magic link are
// bearer secrets carried in the URL: the request log wrote them in clear,
// readable by anyone with access to the container's logs (#658).
const SECRET_SEGMENT = /(\/api\/(?:edit|sponsor-invitation|brochure|auth\/reset-password)\/)[^/?#]+/;
const SECRET_PARAM = /([?&]token=)[^&#]*/g;

export function redactUrl(url: string): string {
  return url.replace(SECRET_SEGMENT, "$1[redacted]").replace(SECRET_PARAM, "$1[redacted]");
}
