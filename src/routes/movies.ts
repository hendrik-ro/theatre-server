import { Router } from "express";
import {
  moviesCreate,
  moviesGetAll,
  moviesGetById,
  moviesUpdateById,
} from "../controllers/movies.js";

const router = Router();

router.get("/", moviesGetAll);
router.get("/:id", moviesGetById);
router.post("/", moviesCreate);
router.post("/:id", moviesUpdateById);

export default router;
