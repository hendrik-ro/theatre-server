import { z } from "zod";

const MAX_YEAR = new Date().getFullYear() + 1;

export interface Movie {
  name: string;
  year: number | null;
  runtime: number | null;
  imdbRating: number | null;
  genre: string | null;
  createdAt: Date;
  updatedAt: Date;
  id: string;
}

export interface MoviesMeta {
  totalMovies: number;
  moviesPerYear: { year: number | null; count: number }[];
  moviesPerGenre: { genre: string | null; count: number }[];
}

export const movieInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  year: z.number().int().min(1750).max(MAX_YEAR).optional(),
  runtime: z.number().int().min(1).max(9999).optional(),
  imdbRating: z.number().min(0).max(10).optional(),
  genre: z.string().trim().min(1).max(100).optional(),
});

export type MovieInput = z.infer<typeof movieInputSchema>;
