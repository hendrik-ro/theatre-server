import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteMovie, deleteUser, listUsers } from "../controllers/admin.js";

// The admin module: everything mounted here requires an authenticated
// admin, enforced once at the router level rather than per route.
const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/users", asyncHandler(listUsers));
adminRouter.delete("/users/:id", asyncHandler(deleteUser));
adminRouter.delete("/movies/:id", asyncHandler(deleteMovie));

export default adminRouter;
