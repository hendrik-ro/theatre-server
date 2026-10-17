import { eq, count, asc, desc } from "drizzle-orm";
import { db } from "../index.js";
import { movies } from "../schema/movies.sql.js";
import { assertUUID, firstOrUndefined, isDevOrTest, isUUID } from "./utils.js";
import { Movie, MovieInput, MoviesMeta } from "../../models/movies.js";

export async function createMovie(input: MovieInput): Promise<Movie> {
  const [result] = await db.insert(movies).values(input).returning();
  return result;
}

export async function getAllMovies(): Promise<Movie[]> {
  const result = await db.select().from(movies);
  return result;
}

export async function getMovieById(id: string): Promise<Movie | undefined> {
  if (!isUUID(id)) return undefined;
  const result = await db.select().from(movies).where(eq(movies.id, id));
  return firstOrUndefined(result);
}

export async function deleteMovie(id: string): Promise<void> {
  assertUUID(id);
  await db.delete(movies).where(eq(movies.id, id));
}

export async function updateMovie(
  id: string,
  input: MovieInput,
): Promise<Movie | undefined> {
  assertUUID(id);
  const [result] = await db
    .update(movies)
    .set(input)
    .where(eq(movies.id, id))
    .returning();
  return result;
}

export async function resetMovies(): Promise<void> {
  if (!isDevOrTest()) return;
  await db.delete(movies);
}

export async function getMoviesMetaData(): Promise<MoviesMeta> {
  const [totalMovies] = await db.select({ count: count() }).from(movies);
  const moviesPerYear = await db
    .select({
      year: movies.year,
      count: count(),
    })
    .from(movies)
    .groupBy(movies.year)
    .orderBy(asc(movies.year));
  const moviesPerGenre = await db
    .select({
      genre: movies.genre,
      count: count(),
    })
    .from(movies)
    .groupBy(movies.genre)
    .orderBy(desc(count()), asc(movies.genre));
  const meta: MoviesMeta = {
    totalMovies: totalMovies.count,
    moviesPerYear,
    moviesPerGenre,
  };
  return meta;
}
