// The secrets a deployed backend must not start with. The placeholders of
// .env.example and the compose defaults all begin with `change-me` and are
// public: a deployment that kept one signs its sessions or links with a known
// key (#658). A local run keeps them, which is what they are for.
const SECRETS = ["SESSION_SECRET", "MAGIC_LINK_SECRET", "REVALIDATE_SECRET", "BROCHURE_TOKEN_SECRET", "TRASH_PURGE_SECRET"];

export function assertSecretsConfigured(env: NodeJS.ProcessEnv): void {
  const isDeployed = env.NODE_ENV === "production" || (!!env.ENV_NAME && env.ENV_NAME !== "local");
  if (!isDeployed) return;

  if (!env.SESSION_SECRET && !env.BETTER_AUTH_SECRET) {
    throw new Error("SESSION_SECRET is not set: refusing to sign sessions with a default key.");
  }
  for (const name of SECRETS) {
    if (env[name]?.startsWith("change-me")) {
      throw new Error(`${name} is still the public placeholder: set a random value before deploying.`);
    }
  }
}
