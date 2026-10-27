import { z } from "zod";

export interface Movie {
  name: string;
  year: number | null;
  runtime: number | null;
  genre: string | null;
  createdAt: Date;
  updatedAt: Date;
  id: string;
}

export interface MovieWithRatings extends Movie {
  averageRating: number | null;
  ratingCount: number;
  userRating: number | null;
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
  genre: z.string().trim().min(1).max(100).optional().nullable(),
});

export const moviePaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const movieFilterSchema = z.object({
  year: z.coerce.number().int().optional().nullable(),
  genre: z.string().optional().nullable(),
  averageRating: z.coerce.number().min(1).optional().nullable(),
  search: z.string().optional(),
});

export const movieSortSchema = z.object({
  sortBy: z
    .enum(["name", "year", "runtime", "genre", "avg_rating"])
    .default("year"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export type MovieFilter = z.infer<typeof movieFilterSchema>;

export type MovieSort = z.infer<typeof movieSortSchema>;

export type MovieInput = z.infer<typeof movieInputSchema>;
