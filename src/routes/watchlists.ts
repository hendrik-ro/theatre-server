import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  watchlistsAddMovie,
  watchlistsGet,
  watchlistsRemoveMovie,
} from "../controllers/watchlists.js";

const watchlistsRouter = Router();

watchlistsRouter.use(requireAuth);

watchlistsRouter.get("/", asyncHandler(watchlistsGet));
watchlistsRouter.post("/:movieId", asyncHandler(watchlistsAddMovie));
watchlistsRouter.delete("/:movieId", asyncHandler(watchlistsRemoveMovie));

export default watchlistsRouter;
