const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// Schema.org expects absolute URLs. Uploaded assets are stored as /uploads/…,
// so they need the site origin prepended before they go into JSON-LD (#185).
export function absoluteUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${BASE_URL}${path}`;
}
