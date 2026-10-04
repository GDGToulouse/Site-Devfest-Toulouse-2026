import { startScheduledTasks } from "./lib/scheduler.js";
import { buildServer } from "./server.js";

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";

const app = await buildServer();

try {
  await app.listen({ port, host });
  startScheduledTasks(app.log);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
