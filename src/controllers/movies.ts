import { Request, Response, NextFunction } from "express";
import {
  createMovie,
  deleteMovie,
  getAllMovies,
  getMovieById,
  updateMovie,
} from "../db/queries/movies.js";
import { Movie } from "../models/movies.js";

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
    const { name, year, runtime, imbdRating, genre } = req.body;
    const newMovie: Movie = await createMovie(
      name,
      year,
      runtime,
      imbdRating,
      genre,
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
    const { name, year, runtime, imdbRating, genre } = req.body;
    const movie = await updateMovie(id, name, year, runtime, imdbRating, genre);
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
