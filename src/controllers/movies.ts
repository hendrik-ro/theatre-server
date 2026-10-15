import {
  createMovie,
  getAllMovies,
  getMovieById,
  getMoviesMetaData,
  updateMovie,
} from "../db/queries/movies.js";
import { Movie, MoviesMeta, movieInputSchema } from "../models/movies.js";
import type { AsyncRequestHandler } from "../utils/asyncHandler.js";

export const moviesGetAll: AsyncRequestHandler = async (_req, res) => {
  const result = await getAllMovies();
  res.json(result);
};

export const moviesCreate: AsyncRequestHandler = async (req, res) => {
  const input = movieInputSchema.parse(req.body);
  const newMovie: Movie = await createMovie(
    input.name,
    input.year,
    input.runtime,
    input.imdbRating,
    input.genre,
  );
  res.status(201).json(newMovie);
};

export const moviesGetById: AsyncRequestHandler = async (req, res) => {
  const id = req.params.id;
  const movie = await getMovieById(id);
  if (!movie) {
    res.status(404).json({ message: "Movie not found" });
    return;
  }
  res.status(200).json(movie);
};

export const moviesUpdateById: AsyncRequestHandler = async (req, res) => {
  const id = req.params.id;
  const input = movieInputSchema.parse(req.body);
  const movie = await updateMovie(
    id,
    input.name,
    input.year,
    input.runtime,
    input.imdbRating,
    input.genre,
  );
  if (!movie) {
    res.status(404).json({ message: `Failed to update movie ${id}` });
    return;
  }
  res.status(200).json(movie);
};

export const moviesMetaData: AsyncRequestHandler = async (_req, res) => {
  const meta: MoviesMeta = await getMoviesMetaData();
  res.status(200).json(meta);
};
