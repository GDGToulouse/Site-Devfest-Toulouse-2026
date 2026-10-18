import { startScheduledTasks } from "./lib/scheduler.js";
import { buildServer } from "./server.js";
import { assertSecretsConfigured } from "./lib/secrets-check.js";

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";

// Before anything listens: a deployment on a public placeholder secret must
// not start (#658).
assertSecretsConfigured(process.env);

const app = await buildServer();

try {
  await app.listen({ port, host });
  startScheduledTasks(app.log);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
