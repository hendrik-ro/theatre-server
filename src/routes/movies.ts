import { Router } from "express";
import {
  moviesCreate,
  moviesDeleteById,
  moviesGetAll,
  moviesGetById,
  moviesMetaData,
  moviesUpdateById,
} from "../controllers/movies.js";

const router = Router();

router.get("/", moviesGetAll);
router.get("/meta", moviesMetaData);
router.get("/:id", moviesGetById);
router.post("/", moviesCreate);
router.post("/:id", moviesUpdateById);
router.delete("/:id", moviesDeleteById);

export default router;
