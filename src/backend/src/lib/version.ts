// Application semver — bumped by hand on each release and tagged on `main`
// (see #171). Kept as a code constant rather than read from package.json:
// package.json lives outside tsconfig's rootDir ("src"), so importing it would
// break the build. An APP_VERSION env var can still override at runtime.
//
// The dev line carries the *upcoming* version with a `-beta` pre-release
// suffix, so beta never reports the same number as production while holding
// different code. The promotion PR to `main` drops the suffix.
export const APP_VERSION = process.env.APP_VERSION || "1.4.0-beta";

// Deployment environment name (local / beta / prod). ENV_NAME already exists
// for Docker network aliasing; here we surface it so the admin knows which
// deployment is running. Defaults to "local" for dev.
export const APP_ENVIRONMENT = process.env.ENV_NAME || "local";
