import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  moviesCreate,
  moviesGetAll,
  moviesGetById,
  moviesMetaData,
  moviesUpdateById,
} from "../controllers/movies.js";

const movieRouter = Router();

movieRouter.get("/", asyncHandler(moviesGetAll));
movieRouter.get("/meta", asyncHandler(moviesMetaData));
movieRouter.get("/:id", asyncHandler(moviesGetById));
movieRouter.post("/", asyncHandler(moviesCreate));
movieRouter.put("/:id", asyncHandler(moviesUpdateById));

export default movieRouter;
