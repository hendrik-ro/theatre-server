import {
  addMovie,
  getWatchlist,
  removeMovie,
} from "../db/queries/watchlists.js";
import { AsyncRequestHandler } from "../utils/asyncHandler.js";
import { getMovieById } from "../db/queries/movies.js";
import { requireUser } from "./helpers.js";

export const watchlistsAddMovie: AsyncRequestHandler = async (req, res) => {
  const user = requireUser(req);
  const movie = await getMovieById(req.params.movieId);
  if (!movie) {
    res.status(404).json({ message: "Movie not found" });
    return;
  }
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
