import { eq, count, asc, desc } from "drizzle-orm";
import { db } from "../index.js";
import { movies } from "../schema.js";
import { firstOrUndefined, isUUID } from "./utils.js";
import { Movie, MoviesMeta } from "../../models/movies.js";
import { HttpError } from "../../utils/errors.js";

export async function createMovie(
  name: string,
  year?: number,
  runtime?: number,
  imdbRating?: number,
  genre?: string,
): Promise<Movie> {
  const [result] = await db
    .insert(movies)
    .values({
      name,
      year,
      runtime,
      imdbRating,
      genre,
    })
    .returning();
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
  if (!isUUID(id)) throw new HttpError(400, "Invalid UUID");
  await db.delete(movies).where(eq(movies.id, id));
}

export async function updateMovie(
  id: string,
  name: string,
  year?: number,
  runtime?: number,
  imdbRating?: number,
  genre?: string,
): Promise<Movie | undefined> {
  if (!isUUID(id)) throw new HttpError(400, "Invalid UUID");
  const [result] = await db
    .update(movies)
    .set({
      name,
      year,
      runtime,
      imdbRating,
      genre,
    })
    .where(eq(movies.id, id))
    .returning();
  return result;
}

export async function resetMovies(): Promise<void> {
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
