import {
  eq,
  count,
  asc,
  desc,
  getTableColumns,
  sql,
  like,
  and,
  isNull,
  gte,
} from "drizzle-orm";
import { db } from "../index.js";
import { movies } from "../schema/movies.sql.js";
import { assertUUID, firstOrUndefined, isUUID } from "./utils.js";
import {
  Movie,
  MovieFilter,
  MovieInput,
  MoviesMeta,
  MovieSort,
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
      average: sql<number>`ROUND(AVG(${movieRatings.rating}), 1)`.as("average"),
      count: count().as("count"),
    })
    .from(movieRatings)
    .groupBy(movieRatings.movieId)
    .as("avg_rating");
}

function toMovieWithRatings(
  row: Movie & {
    averageRating: string | number | null;
    ratingCount: number | null;
  },
): MovieWithRatings {
  // Handle averageRating: null -> null, NaN -> 0
  let averageRating: number | null = null;
  if (row.averageRating !== null) {
    const num =
      typeof row.averageRating === "string"
        ? Number(row.averageRating)
        : row.averageRating;
    averageRating = Number.isNaN(num) ? 0 : num;
  }
  return {
    ...row,
    averageRating,
    ratingCount: row.ratingCount ?? 0,
  };
}

function buildFilterConditions(
  averages: ReturnType<typeof ratingAverages>,
  filter?: MovieFilter,
) {
  const whereConditions = [];

  if (filter?.year !== undefined) {
    whereConditions.push(
      filter.year === null ? isNull(movies.year) : eq(movies.year, filter.year),
    );
  }
  if (filter?.genre !== undefined) {
    whereConditions.push(
      filter.genre === null
        ? isNull(movies.genre)
        : like(movies.genre, `%${filter.genre}%`),
    );
  }
  if (filter?.averageRating !== undefined) {
    whereConditions.push(
      filter.averageRating === null
        ? isNull(averages.average)
        : gte(averages.average, filter.averageRating),
    );
  }
  if (filter?.imdbRating !== undefined) {
    whereConditions.push(
      filter.imdbRating === null
        ? isNull(movies.imdbRating)
        : gte(movies.imdbRating, filter.imdbRating),
    );
  }

  return whereConditions;
}

export async function getAllMovies(
  page: number,
  limit: number,
  filter?: MovieFilter,
  sort?: MovieSort,
): Promise<MoviesPaginated> {
  if (!sort) {
    sort = { sortBy: "year", sortDir: "asc" };
  }
  const averages = ratingAverages();

  const sortColumnMap = {
    name: movies.name,
    year: movies.year,
    runtime: movies.runtime,
    imdb: movies.imdbRating,
    genre: movies.genre,
    avg_rating: averages.average,
  };

  const whereConditions = buildFilterConditions(averages, filter);

  const countSelection = db
    .select({ count: count() })
    .from(movies)
    .leftJoin(averages, eq(averages.movieId, movies.id));

  const countSelectionWithFilters =
    whereConditions.length > 0
      ? countSelection.where(and(...whereConditions))
      : countSelection;

  const [total] = await countSelectionWithFilters;

  const column = sortColumnMap[sort.sortBy as keyof typeof sortColumnMap];

  // Build entire query in one chain - no intermediate variables
  const rows = await db
    .select({
      ...getTableColumns(movies),
      averageRating: averages.average,
      ratingCount: averages.count,
    })
    .from(movies)
    .leftJoin(averages, eq(averages.movieId, movies.id))
    .where(and(...whereConditions))
    .orderBy(
      column
        ? sort.sortDir === "asc"
          ? asc(column)
          : desc(column)
        : asc(movies.name),
    )
    .limit(limit)
    .offset((page - 1) * limit);

  return {
    movies: rows.map(toMovieWithRatings),
    page,
    limit,
    total: total.count,
    totalPages: Math.ceil(total.count / limit),
  };
}

export async function getMovieById(id: string) {
  if (!isUUID(id)) return undefined;
  const averages = ratingAverages();
  const rows = await db
    .select({
      ...getTableColumns(movies),
      averageRating: averages.average,
      ratingCount: averages.count,
    })
    .from(movies)
    .leftJoin(averages, eq(averages.movieId, movies.id))
    .where(eq(movies.id, id));
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
