import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  SERVER_PORT: z.coerce.number().int().min(0).max(65535),
  POSTGRES_USER: z.string().default("postgres"),
  POSTGRES_PASSWORD: z.string().default("postgres"),
  POSTGRES_HOST: z.string().default("localhost"),
  POSTGRES_PORT: z.coerce.number().int().min(0).max(65535).default(5432),
  POSTGRES_DB: z.string().default("theatre"),
  JWT_SECRET: z.string().min(32),
  REFRESH_SECRET: z.string().min(32),
});

// Resolve from this module's location so the file is found regardless of
// the process cwd. Both src/ and dist/ sit one level below the .env file
// at the repo root.
const envPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.env",
);
dotenv.config({ path: envPath });

const env = schema.parse(process.env);

export const config = {
  env: env.NODE_ENV,
  serverPort: env.SERVER_PORT,
  // Assembled from the POSTGRES_* parts — one path for every context.
  // Parts are encoded so URL-special characters in credentials stay
  // valid.
  dbURL: `postgres://${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(env.POSTGRES_PASSWORD)}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`,
  jwtSecret: env.JWT_SECRET,
  refreshSecret: env.REFRESH_SECRET,
};
