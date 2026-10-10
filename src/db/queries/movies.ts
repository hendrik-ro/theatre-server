import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { movies } from "../schema.js";
import { firstOrUndefined, isUUID } from "./utils.js";
import { Movie } from "../../models/movies.js";

class DBError extends Error {
  constructor(msg: string) {
    super(msg);
    Object.setPrototypeOf(this, DBError.prototype);
  }
}

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
  return result as Movie;
}

export async function getAllMovies(): Promise<Movie[]> {
  const result = await db.select().from(movies);
  return result as Movie[];
}

export async function getMovieById(id: string): Promise<Movie | undefined> {
  if (!isUUID(id)) return undefined;
  const result = await db.select().from(movies).where(eq(movies.id, id));
  return firstOrUndefined(result) as Movie;
}

export async function deleteMovie(id: string): Promise<void> {
  if (!isUUID(id)) throw new DBError("Invalid UUID");
  await db.delete(movies).where(eq(movies.id, id));
}

export async function updateMovie(
  id: string,
  name: string,
  year: number,
  runtime: number,
  imdbRating: number,
  genre: string,
): Promise<Movie> {
  const [result] = await db
    .update(movies)
    .set({
      name,
      year,
      runtime,
      imdbRating: imdbRating,
      genre,
    })
    .where(eq(movies.id, id))
    .returning();
  return result as Movie;
}

export async function resetMovies(): Promise<void> {
  await db.delete(movies);
}
