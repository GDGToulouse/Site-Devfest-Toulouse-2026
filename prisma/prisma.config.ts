import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { defineConfig, env } from "prisma/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

export default defineConfig({
  schema: resolve(__dirname, "schema.prisma"),
  migrations: {
    path: resolve(__dirname, "migrations"),
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
