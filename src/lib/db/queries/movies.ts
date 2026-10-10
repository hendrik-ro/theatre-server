import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { movies } from "../schema.js";
import { firstOrUndefined } from "./utils.js";

export async function createMovie(
  name: string,
  year?: number,
  runtime?: number,
  imdbRating?: number,
  genre?: string,
) {
  const [result] = await db
    .insert(movies)
    .values({
      name,
      year,
      runtime,
      imdb_rating: imdbRating,
      genre,
    })
    .returning();
  return result;
}

export async function getAllMovies() {
  const result = await db.select().from(movies);
  return result;
}

export async function getMovieByName(name: string) {
  const result = await db.select().from(movies).where(eq(movies.name, name));
  return firstOrUndefined(result);
}

export async function deleteMovie(id: string) {
  await db.delete(movies).where(eq(movies.id, id));
}

export async function resetMovies() {
  await db.delete(movies);
}
