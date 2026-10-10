import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";
import { config } from "../../config.js";

const conn = postgres(config.db);
export const db = drizzle(conn, { schema });
