import z from "zod";

export interface UserMovieRating {
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  movieId: string;
  rating: number;
}

export const movieRatingSchema = z.object({
  rating: z.int().min(0).max(10),
});
