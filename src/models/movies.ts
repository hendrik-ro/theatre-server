import { z } from "zod";

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

export interface MovieWithRatings extends Movie {
  averageRating: number | null;
  ratingCount: number;
}

export interface MoviesPaginated {
  movies: MovieWithRatings[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface MoviesMeta {
  totalMovies: number;
  moviesPerYear: { year: number | null; count: number }[];
  moviesPerGenre: { genre: string | null; count: number }[];
}

export const movieInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  year: z
    .number()
    .int()
    .min(1750)
    .optional()
    .nullable()
    .refine((val) => !val || val <= new Date().getFullYear() + 1, {
      message: "Year cannot be more than one year in the future",
    }),
  runtime: z.number().int().min(1).max(9999).optional().nullable(),
  imdbRating: z.number().min(0).max(10).optional().nullable(),
  genre: z.string().trim().min(1).max(100).optional().nullable(),
});

export const moviePaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const movieFilterSchema = z.object({
  year: z.preprocess(
    (val) => (val === "null" ? null : val),
    z.coerce.number().int().min(1750).optional().nullable(),
  ),
  genre: z.preprocess(
    (val) => (val === "null" ? null : val),
    z.string().optional().nullable(),
  ),
  averageRating: z.preprocess(
    (val) => (val === "null" ? null : val),
    z.coerce.number().min(0).max(10).optional().nullable(),
  ),
  imdbRating: z.preprocess(
    (val) => (val === "null" ? null : val),
    z.coerce.number().min(0).max(10).optional().nullable(),
  ),
  search: z.string().optional(),
});

export const movieSortSchema = z.object({
  sortBy: z
    .enum(["name", "year", "runtime", "imdb", "genre", "avg_rating"])
    .default("year"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export type MovieFilter = z.infer<typeof movieFilterSchema>;

export type MovieSort = z.infer<typeof movieSortSchema>;

export type MovieInput = z.infer<typeof movieInputSchema>;
