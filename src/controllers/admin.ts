import {
  deleteUser as deleteUserRow,
  getAllUsers,
} from "../db/queries/users.js";
import { deleteMovie as deleteMovieRow } from "../db/queries/movies.js";
import type { AsyncRequestHandler } from "../utils/asyncHandler.js";
import { logEvent } from "../logger.js";
import { requestId } from "./helpers.js";

export const listUsers: AsyncRequestHandler = async (_req, res) => {
  const all = await getAllUsers();
  res.status(200).json(all.map(({ passwordHash: _omit, ...user }) => user));
};

export const deleteUser: AsyncRequestHandler = async (req, res) => {
  await deleteUserRow(req.params.id);
  // The actor disambiguates self-service deletion (/api/users/:id) from
  // an admin acting through /api/admin/users/:id.
  logEvent("user_deletion", {
    requestId: requestId(res),
    actor: req.user?.username,
    target: req.params.id,
  });
  res.sendStatus(204);
};

export const deleteMovie: AsyncRequestHandler = async (req, res) => {
  await deleteMovieRow(req.params.id);
  res.sendStatus(204);
};
