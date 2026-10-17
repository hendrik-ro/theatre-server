import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  SERVER_PORT: z.coerce.number().int().min(0).max(65535),
  DB_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  REFRESH_SECRET: z.string().min(32),
});

// Resolve from this module's location so the file is found regardless of
// the process cwd. Both src/ and dist/ sit one level below the repo root.
const envPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.env",
);
dotenv.config({ path: envPath });

const env = schema.parse(process.env);

export const config = {
  env: env.NODE_ENV,
  serverPort: env.SERVER_PORT,
  dbURL: env.DB_URL,
  jwtSecret: env.JWT_SECRET,
  refreshSecret: env.REFRESH_SECRET,
};
