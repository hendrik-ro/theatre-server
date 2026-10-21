import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  movieRatingsDelete,
  movieRatingsGet,
  movieRatingsRate,
} from "../controllers/movieRatings.js";

const movieRatingsRouter = Router();

movieRatingsRouter.use(requireAuth);

movieRatingsRouter.get("/:movieId", asyncHandler(movieRatingsGet));
movieRatingsRouter.post("/:movieId", asyncHandler(movieRatingsRate));
movieRatingsRouter.delete("/:movieId", asyncHandler(movieRatingsDelete));

export default movieRatingsRouter;
