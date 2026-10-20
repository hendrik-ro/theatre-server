import { Request } from "express";
import {
  addMovie,
  getWatchlist,
  removeMovie,
} from "../db/queries/watchlists.js";
import { AsyncRequestHandler } from "../utils/asyncHandler.js";
import { User } from "../models/users.js";
import { getMovieById } from "../db/queries/movies.js";

function requireUser(req: Request): User {
  const user = req.user;
  if (!user) throw new Error("requireAuth middleware not mounted");
  return user;
}

export const watchlistsAddMovie: AsyncRequestHandler = async (req, res) => {
  const user = requireUser(req);
  const movie = await getMovieById(req.params.movieId);
  if (!movie) return res.sendStatus(400);
  await addMovie(user.id, movie.id);
  res.status(201).json({ message: "Movie added to watchlist" });
};

export const watchlistsRemoveMovie: AsyncRequestHandler = async (req, res) => {
  const user = requireUser(req);
  await removeMovie(user.id, req.params.movieId);
  res.sendStatus(204);
};

export const watchlistsGet: AsyncRequestHandler = async (req, res) => {
  const user = requireUser(req);
  const movies = await getWatchlist(user.id);
  res.status(200).json(movies);
};
