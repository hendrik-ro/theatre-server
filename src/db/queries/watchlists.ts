import { and, eq } from "drizzle-orm";
import { db } from "../index.js";
import { watchlists } from "../schema/watchlists.sql.js";
import { assertUUID } from "./utils.js";
import { Movie } from "../../models/movies.js";
import { movies } from "../schema/movies.sql.js";

export async function addMovie(
  userId: string,
  movieId: string,
): Promise<boolean> {
  assertUUID(userId);
  assertUUID(movieId);
  const [newEntry] = await db
    .insert(watchlists)
    .values({ userId, movieId })
    .returning();
  if (!newEntry) return false;
  return true;
}

export async function removeMovie(
  userId: string,
  movieId: string,
): Promise<boolean> {
  assertUUID(userId);
  assertUUID(movieId);
  const [removed] = await db
    .delete(watchlists)
    .where(and(eq(watchlists.userId, userId), eq(watchlists.movieId, movieId)))
    .returning();
  if (!removed) return false;
  return true;
}

export async function getWatchlist(userId: string): Promise<Movie[]> {
  assertUUID(userId);
  const result = await db
    .select({ movies })
    .from(watchlists)
    .where(eq(watchlists.userId, userId))
    .innerJoin(movies, eq(watchlists.movieId, movies.id));
  return result.map((m) => {
    return m.movies;
  });
}
