import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const nodeEnv = process.env.NODE_ENV;
if (!nodeEnv) {
  throw new Error("NODE_ENV not set");
}

const dbUrl = process.env.DB_URL;
if (!dbUrl) {
  throw new Error("DB_URL not set");
}

export const config = {
  nodeEnv: nodeEnv,
  db: dbUrl,
};
