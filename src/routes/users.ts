import { Router } from "express";
import { deleteUser } from "../controllers/admin.js";
import { requireAdminOrSelf } from "../middleware/requireAdminOrSelf.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  usersLogin,
  usersLogout,
  usersMe,
  usersRegister,
} from "../controllers/users.js";

const userRouter = Router();

userRouter.post("/register", asyncHandler(usersRegister));
userRouter.post("/login", asyncHandler(usersLogin));
userRouter.post("/logout", requireAuth, asyncHandler(usersLogout));
userRouter.get("/me", requireAuth, asyncHandler(usersMe));
// Self-service deletion: a user may delete their own account; admins,
// who can also act through /api/admin/users/:id, pass via requireAdminOrSelf.
userRouter.delete(
  "/:id",
  requireAuth,
  requireAdminOrSelf,
  asyncHandler(deleteUser),
);

export default userRouter;
