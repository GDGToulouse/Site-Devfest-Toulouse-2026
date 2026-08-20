// Application semver — bumped by hand on each release and tagged on `main`
// (see #171). Kept as a code constant rather than read from package.json:
// package.json lives outside tsconfig's rootDir ("src"), so importing it would
// break the build. An APP_VERSION env var can still override at runtime.
//
// The dev line carries the *upcoming* version with a `-beta` pre-release
// suffix, so beta never reports the same number as production while holding
// different code. The promotion PR to `main` drops the suffix.
export const APP_VERSION = process.env.APP_VERSION || "1.7.0";

// Deployment environment name (local / beta / prod). ENV_NAME already exists
// for Docker network aliasing; here we surface it so the admin knows which
// deployment is running. Defaults to "local" for dev.
export const APP_ENVIRONMENT = process.env.ENV_NAME || "local";

// Short SHA of the commit this image was built from, baked in at build time.
// The version alone can't tell two beta deploys apart: it stays put across the
// dozens of commits that land between two releases, so "is my merge live?" was
// unanswerable. Empty when built outside CI/Coolify (local dev), and callers
// treat it as optional rather than failing.
export const APP_COMMIT = (process.env.APP_COMMIT || "").slice(0, 7);
