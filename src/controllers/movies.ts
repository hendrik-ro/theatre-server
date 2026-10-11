import { Request, Response, NextFunction } from "express";
import {
  createMovie,
  deleteMovie,
  getAllMovies,
  getMovieById,
  getMoviesMetaData,
  updateMovie,
} from "../db/queries/movies.js";
import { Movie, MoviesMeta, movieInputSchema } from "../models/movies.js";

export const moviesGetAll = async (
  _: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await getAllMovies();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const moviesCreate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input = movieInputSchema.parse(req.body);
    const newMovie: Movie = await createMovie(
      input.name,
      input.year,
      input.runtime,
      input.imdbRating,
      input.genre,
    );
    res.status(201).json(newMovie);
  } catch (err) {
    next(err);
  }
};

export const moviesGetById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id;
    const movie = await getMovieById(id);
    if (!movie) {
      return res.status(404).json({ message: `Movie not found` });
    }
    res.status(200).json(movie);
  } catch (err) {
    next(err);
  }
};

export const moviesUpdateById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
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
      return res.status(404).json({ message: `Failed to update movie ${id}` });
    }
    res.status(200).json(movie);
  } catch (err) {
    next(err);
  }
};

export const moviesDeleteById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id;
    await deleteMovie(id);
    res.status(200).json({ message: `Movie ${id} has been deleted` });
  } catch (err) {
    next(err);
  }
};

export const moviesMetaData = async (
  _: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const meta: MoviesMeta = await getMoviesMetaData();
    res.status(200).json(meta);
  } catch (err) {
    next(err);
  }
};
