import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { config } from "../config.js";
import { movies } from "./schema/movies.sql.js";
import { users } from "./schema/users.sql.js";
import { appBootstrap } from "./schema/appBootstrap.sql.js";
import { movieRatings } from "./schema/movieRatings.sql.js";
import { watchlists } from "./schema/watchlists.sql.js";
import { refreshTokens } from "./schema/refreshTokens.sql.js";

export const schema = {
  movieRatings,
  watchlists,
  movies,
  users,
  appBootstrap,
  refreshTokens,
};

const conn = postgres(config.dbURL);
export const db = drizzle(conn, { schema });
export const closeDB = () => conn.end({ timeout: 5 });
