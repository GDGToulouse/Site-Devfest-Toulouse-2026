// The origins better-auth trusts for sign-in POSTs, magic-link callbacks and
// reset redirects. Listed, never a wildcard on the registered domain: that
// trusted every subdomain, the other environments, the hosting panel and the
// old sites hosted elsewhere alike (#658). Each environment has its own
// BASE_URL; production is also served with and without `www.`, so a two-label
// domain brings its twin.
function wwwTwin(url: string): string | null {
  try {
    const parsed = new URL(url);
    const { hostname } = parsed;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;
    if (hostname.startsWith("www.")) return `${parsed.protocol}//${hostname.slice(4)}${parsed.port ? `:${parsed.port}` : ""}`;
    if (hostname.split(".").length === 2) return `${parsed.protocol}//www.${hostname}${parsed.port ? `:${parsed.port}` : ""}`;
    return null;
  } catch {
    return null;
  }
}

export function trustedOriginsFor(baseUrl: string, frontendUrl: string): string[] {
  const twin = wwwTwin(baseUrl);
  return [baseUrl, ...(twin ? [twin] : []), frontendUrl].filter((v, i, arr) => arr.indexOf(v) === i);
}
