// The demo accounts' documented passwords (docs/comptes-dev-local.md) are in
// the public repository. They may only be set where no one else reaches the
// accounts: a local machine, or the CI, neither of which names its
// environment. A deployed one (ENV_NAME set to anything but "local") takes its
// password from DEV_SEED_PASSWORD and refuses to seed without it, rather than
// fall back on a password anyone can read.

const MIN_LENGTH = 12;

/** The password for every demo account, or null to keep the documented ones. */
export function devSeedPassword(env: NodeJS.ProcessEnv): string | null {
  const password = env.DEV_SEED_PASSWORD;
  if (password) {
    if (password.length < MIN_LENGTH) {
      throw new Error(`DEV_SEED_PASSWORD must be at least ${MIN_LENGTH} characters long.`);
    }
    return password;
  }
  if (!env.ENV_NAME || env.ENV_NAME === "local") return null;
  throw new Error(
    `ENV_NAME is "${env.ENV_NAME}": set DEV_SEED_PASSWORD, the documented demo passwords are public.`,
  );
}
