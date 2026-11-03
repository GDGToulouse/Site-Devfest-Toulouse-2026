// Whether this backend serves the real event's data (#774). Read at call time.
// Two signals, since a prod that lost its ENV_NAME would otherwise read as
// "local": the name `prod`, and the apex address the production serves from.
const PRODUCTION_NAMES = new Set(["prod", "production"]);
const PRODUCTION_HOSTS = new Set(["devfesttoulouse.fr", "www.devfesttoulouse.fr"]);

export function isProductionEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  if (PRODUCTION_NAMES.has((env.ENV_NAME ?? "").trim().toLowerCase())) return true;
  try {
    return PRODUCTION_HOSTS.has(new URL(env.BASE_URL ?? "").hostname.toLowerCase());
  } catch {
    return false;
  }
}
