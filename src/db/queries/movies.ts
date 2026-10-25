import {
  eq,
  count,
  asc,
  desc,
  getTableColumns,
  sql,
  like,
  and,
} from "drizzle-orm";
import { db } from "../index.js";
import { movies } from "../schema/movies.sql.js";
import { assertUUID, firstOrUndefined, isUUID } from "./utils.js";
import {
  Movie,
  MovieInput,
  MoviesMeta,
  MoviesPaginated,
  MovieWithRatings,
} from "../../models/movies.js";
import { movieRatings } from "../schema/movieRatings.js";

export async function createMovie(input: MovieInput): Promise<Movie> {
  const [result] = await db.insert(movies).values(input).returning();
  return result;
}

function ratingAverages() {
  return db
    .select({
      movieId: movieRatings.movieId,
      average: sql<string>`ROUND(AVG(${movieRatings.rating}), 1)`.as("average"),
      count: count().as("count"),
    })
    .from(movieRatings)
    .groupBy(movieRatings.movieId)
    .as("avg_rating");
}

function toMovieWithRatings(
  row: Awaited<ReturnType<typeof selectAllMoviesWithRatings>>[number],
): MovieWithRatings {
  return {
    ...row,
    averageRating:
      row.averageRating === null ? null : Number(row.averageRating),
    ratingCount: row.ratingCount ?? 0,
  };
}

interface Pagination {
  page: number;
  limit: number;
}

interface Filter {
  year?: number;
  genre?: string;
  averageRating?: number;
  imdbRating?: number;
}

function buildFilterConditions(filter?: Filter) {
  const averages = ratingAverages();
  const whereConditions = [];

  if (filter?.year) whereConditions.push(eq(movies.year, filter.year));
  if (filter?.genre)
    whereConditions.push(like(movies.genre, `%${filter.genre}%`));
  if (filter?.averageRating)
    whereConditions.push(eq(averages.average, filter.averageRating.toString()));
  if (filter?.imdbRating)
    whereConditions.push(eq(movies.imdbRating, filter.imdbRating));

  return whereConditions;
}

function selectAllMoviesWithRatings(pagination?: Pagination) {
  const averages = ratingAverages();
  const selection = db
    .select({
      ...getTableColumns(movies),
      averageRating: averages.average,
      ratingCount: averages.count,
    })
    .from(movies)
    .leftJoin(averages, eq(averages.movieId, movies.id));
  if (!pagination) return selection;
  return selection
    .orderBy(asc(movies.name))
    .limit(pagination.limit)
    .offset((pagination.page - 1) * pagination.limit);
}

export async function getAllMovies(
  page: number,
  limit: number,
  filter?: Filter,
): Promise<MoviesPaginated> {
  const whereConditions = buildFilterConditions(filter);
  const averages = ratingAverages();

  const countSelection = db
    .select({ count: count() })
    .from(movies)
    .leftJoin(averages, eq(averages.movieId, movies.id));

  const countSelectionWithFilters =
    whereConditions.length > 0
      ? countSelection.where(and(...whereConditions))
      : countSelection;

  const [total] = await countSelectionWithFilters;
  const rows = await selectAllMoviesWithRatings({ page, limit });

  return {
    movies: rows.map(toMovieWithRatings),
    page,
    limit,
    total: total.count,
    totalPages: Math.ceil(total.count / limit),
  };
}

export async function getMovieById(
  id: string,
): Promise<MovieWithRatings | undefined> {
  if (!isUUID(id)) return undefined;
  const rows = await selectAllMoviesWithRatings().where(eq(movies.id, id));
  return firstOrUndefined(rows.map(toMovieWithRatings));
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
