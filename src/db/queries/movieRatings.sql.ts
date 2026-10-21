import { and, eq } from "drizzle-orm";
import { UserMovieRating } from "../../models/ratings.js";
import { db } from "../index.js";
import { movieRatings } from "../schema/movieRatings.js";
import { assertUUID, firstOrUndefined, isDevOrTest } from "./utils.js";
import { HttpError } from "../../utils/errors.js";

export async function rateMovie(
  userId: string,
  movieId: string,
  rating: number,
): Promise<UserMovieRating | undefined> {
  assertUUID(userId);
  assertUUID(movieId);
  if (!Number.isInteger(rating) || rating < 0 || rating > 10)
    throw new HttpError(400, "Invalid rating");
  const newRating = await db
    .insert(movieRatings)
    .values({ userId, movieId, rating })
    .onConflictDoUpdate({
      target: [movieRatings.userId, movieRatings.movieId],
      set: { rating },
    })
    .returning();
  return firstOrUndefined(newRating);
}

export async function getMovieRating(
  userId: string,
  movieId: string,
): Promise<UserMovieRating | undefined> {
  assertUUID(userId);
  assertUUID(movieId);
  const rating = await db
    .select()
    .from(movieRatings)
    .where(
      and(eq(movieRatings.userId, userId), eq(movieRatings.movieId, movieId)),
    );
  return firstOrUndefined(rating);
}

export async function unrateMovie(
  userId: string,
  movieId: string,
): Promise<boolean> {
  assertUUID(userId);
  assertUUID(movieId);
  const [deletedRating] = await db
    .delete(movieRatings)
    .where(
      and(eq(movieRatings.userId, userId), eq(movieRatings.movieId, movieId)),
    )
    .returning({
      movieId: movieRatings.movieId,
      userId: movieRatings.userId,
    });
  return deletedRating !== undefined;
}

export async function resetMovieRatings(): Promise<void> {
  if (!isDevOrTest()) return;
  await db.delete(movieRatings);
}
