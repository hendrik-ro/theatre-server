import { getMovieById } from "../db/queries/movies.js";
import {
  getMovieRating,
  rateMovie,
  unrateMovie,
} from "../db/queries/movieRatings.sql.js";
import { movieRatingSchema } from "../models/ratings.js";
import { AsyncRequestHandler } from "../utils/asyncHandler.js";
import { requireUser } from "./helpers.js";
import { assertUUID } from "../db/queries/utils.js";

export const movieRatingsRate: AsyncRequestHandler = async (req, res) => {
  const user = requireUser(req);
  assertUUID(req.params.movieId);
  const movie = await getMovieById(req.params.movieId);
  if (!movie) return res.sendStatus(404);
  const { rating } = movieRatingSchema.parse(req.body);
  const ratedMovie = await rateMovie(user.id, movie.id, rating);
  res.status(201).json(ratedMovie);
};

export const movieRatingsDelete: AsyncRequestHandler = async (req, res) => {
  const user = requireUser(req);
  const movieId = req.params.movieId;
  assertUUID(movieId);
  await unrateMovie(user.id, movieId);
  res.sendStatus(204);
};

export const movieRatingsGet: AsyncRequestHandler = async (req, res) => {
  const user = requireUser(req);
  const movieId = req.params.movieId;
  assertUUID(movieId);
  const rating = await getMovieRating(user.id, movieId);
  if (!rating) return res.sendStatus(404);
  res.status(200).json(rating);
};
